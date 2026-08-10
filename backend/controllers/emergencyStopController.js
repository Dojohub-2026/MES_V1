const prisma = require('../prismaClient');
const { emitToOperator, emitToManager, emitToExecutives } = require('../socket');

// Deliberately excludes PAUSED (an operator already paused that stage
// themselves — leave it alone rather than double-pausing) and COMPLETED
// (already done, nothing to stop). Only stages that were genuinely in
// progress or waiting to start get swept into the emergency pause.
const ACTIVE_STAGE_STATUSES = ['PENDING', 'AVAILABLE', 'RUNNING'];
// Tags the downtime/fault records this controller creates so resumeJob can
// find and close exactly those records later, without touching downtime a
// manager logged manually or faults an operator reported on their own.
const EMERGENCY_CATEGORY = 'emergency_stop';

// One FaultLog per job, not per stage — even when several stages get
// individually marked PAUSED below, there's a single record representing
// "this job was emergency-stopped", which is what resumeJob looks for and
// resolves when the manager clears it.
async function pauseJobWithFault(tx, job, reason, notes, managerId) {
  const stages = await tx.jobStage.findMany({
    where: { jobId: job.id, status: { in: ACTIVE_STAGE_STATUSES } },
    select: { id: true, operatorId: true },
  });

  await tx.job.update({ where: { id: job.id }, data: { status: 'PAUSED' } });

  if (stages.length > 0) {
    await tx.jobStage.updateMany({
      where: { id: { in: stages.map((s) => s.id) } },
      data: { status: 'PAUSED' },
    });

    await tx.jobDowntimeLog.createMany({
      data: stages.map((s) => ({
        jobId: job.id,
        stageId: s.id,
        reason,
        category: EMERGENCY_CATEGORY,
        startedAt: new Date(),
      })),
    });
  }

  await tx.faultLog.create({
    data: {
      jobId: job.id,
      operatorId: managerId,
      title: reason,
      description: notes || null,
      severity: 'CRITICAL',
      category: EMERGENCY_CATEGORY,
    },
  });

  return stages.map((s) => s.operatorId).filter(Boolean);
}

async function resumeJob(tx, job, resumeNotes, managerId) {
  const openLogs = await tx.jobDowntimeLog.findMany({
    where: { jobId: job.id, category: EMERGENCY_CATEGORY, endedAt: null },
    select: { id: true, stageId: true },
  });
  const stageIds = openLogs.map((l) => l.stageId).filter(Boolean);

  const stages = await tx.jobStage.findMany({
    where: { id: { in: stageIds } },
    include: { sessions: { where: { endedAt: null }, select: { id: true } } },
  });

  const now = new Date();
  const stageUpdates = [];

  // A stage resumes to RUNNING only if it had an open ProcessSession when
  // the stop hit — meaning an operator was actively mid-task on it.
  // Anything that hadn't been started yet (no open session) goes back to
  // AVAILABLE instead, rather than every paused stage resuming as if work
  // was already underway.
  for (const stage of stages) {
    const nextStatus = stage.sessions.length > 0 ? 'RUNNING' : 'AVAILABLE';
    await tx.jobStage.update({ where: { id: stage.id }, data: { status: nextStatus } });
    stageUpdates.push({ stageId: stage.id, operatorId: stage.operatorId, status: nextStatus });
  }

  await tx.job.update({ where: { id: job.id }, data: { status: 'ACTIVE' } });

  if (openLogs.length > 0) {
    await tx.jobDowntimeLog.updateMany({
      where: { id: { in: openLogs.map((l) => l.id) } },
      data: { endedAt: now },
    });
  }

  const openFault = await tx.faultLog.findFirst({
    where: { jobId: job.id, category: EMERGENCY_CATEGORY, resolvedAt: null },
    orderBy: { loggedAt: 'desc' },
  });
  if (openFault) {
    await tx.faultLog.update({
      where: { id: openFault.id },
      data: {
        resolvedAt: now,
        resolvedBy: managerId,
        resolutionNotes: resumeNotes || 'Production resumed by manager.',
      },
    });
  }

  return stageUpdates;
}

// Fans a single event out to every affected operator's own room, the
// triggering manager, and all Executives at once (see socket.js for what
// each room means) — so everyone with a stake in the affected jobs finds
// out in the same tick, not just whoever made the request.
function notify(event, jobs, operatorIds, managerId, extra) {
  const payload = {
    jobIds: jobs.map((j) => j.jobId),
    at: new Date().toISOString(),
    ...extra,
  };
  [...new Set(operatorIds)].forEach((operatorId) => emitToOperator(operatorId, event, payload));
  emitToManager(managerId, event, payload);
  emitToExecutives(event, payload);
}

async function getActiveJobs(req, res) {
  try {
    const jobs = await prisma.job.findMany({
      where: {
        status: 'ACTIVE',
        line: { managerId: req.user.id },
      },
      select: {
        id: true,
        jobId: true,
        name: true,
        line: { select: { lineCode: true, name: true } },
      },
      orderBy: { name: 'asc' },
    });

    return res.status(200).json({ jobs });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load active jobs', error: error.message });
  }
}

async function getPausedJobs(req, res) {
  try {
    const jobs = await prisma.job.findMany({
      where: { status: 'PAUSED', line: { managerId: req.user.id } },
      select: {
        id: true,
        jobId: true,
        name: true,
        line: { select: { lineCode: true, name: true } },
        faults: {
          where: { category: EMERGENCY_CATEGORY, resolvedAt: null },
          orderBy: { loggedAt: 'desc' },
          take: 1,
          select: { title: true, description: true, loggedAt: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    const shaped = jobs.map((j) => ({
      id: j.id,
      jobId: j.jobId,
      name: j.name,
      line: j.line,
      reason: j.faults[0]?.title ?? null,
      notes: j.faults[0]?.description ?? null,
      stoppedAt: j.faults[0]?.loggedAt ?? null,
    }));

    return res.status(200).json({ jobs: shaped });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load paused jobs', error: error.message });
  }
}

async function triggerStop(req, res) {
  const { scope, jobId, reason, notes } = req.body;

  if (!reason) {
    return res.status(400).json({ message: 'A reason is required' });
  }

  try {
    if (scope === 'specific_job') {
      const job = await prisma.job.findFirst({
        where: { id: jobId, status: 'ACTIVE', line: { managerId: req.user.id } },
      });

      if (!job) {
        return res.status(404).json({ message: 'Active job not found on your lines' });
      }

      const operatorIds = await prisma.$transaction((tx) => pauseJobWithFault(tx, job, reason, notes, req.user.id));
      notify('emergency:triggered', [job], operatorIds, req.user.id, { scope, reason, notes: notes || null });

      return res.status(200).json({ message: 'Job stopped', stoppedCount: 1 });
    }

    if (scope === 'facility_wide') {
      const jobs = await prisma.job.findMany({
        where: { status: 'ACTIVE', line: { managerId: req.user.id } },
      });

      if (jobs.length === 0) {
        return res.status(200).json({ message: 'No active jobs to stop', stoppedCount: 0 });
      }

      const allOperatorIds = [];
      await prisma.$transaction(async (tx) => {
        for (const job of jobs) {
          const ids = await pauseJobWithFault(tx, job, reason, notes, req.user.id);
          allOperatorIds.push(...ids);
        }
      });
      notify('emergency:triggered', jobs, allOperatorIds, req.user.id, { scope, reason, notes: notes || null });

      return res.status(200).json({ message: 'All active jobs stopped', stoppedCount: jobs.length });
    }

    return res.status(400).json({ message: 'Invalid scope' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to trigger emergency stop', error: error.message });
  }
}

async function resumeStop(req, res) {
  const { scope, jobId, notes } = req.body;

  try {
    if (scope === 'specific_job') {
      const job = await prisma.job.findFirst({
        where: { id: jobId, status: 'PAUSED', line: { managerId: req.user.id } },
      });

      if (!job) {
        return res.status(404).json({ message: 'Paused job not found on your lines' });
      }

      const stageUpdates = await prisma.$transaction((tx) => resumeJob(tx, job, notes, req.user.id));
      const operatorIds = stageUpdates.map((s) => s.operatorId).filter(Boolean);
      notify('emergency:resumed', [job], operatorIds, req.user.id, {
        stages: stageUpdates.map(({ stageId, status }) => ({ stageId, status })),
      });

      return res.status(200).json({ message: 'Job resumed', resumedCount: 1 });
    }

    if (scope === 'facility_wide') {
      const jobs = await prisma.job.findMany({
        where: { status: 'PAUSED', line: { managerId: req.user.id } },
      });

      if (jobs.length === 0) {
        return res.status(200).json({ message: 'No paused jobs to resume', resumedCount: 0 });
      }

      const allStageUpdates = [];
      await prisma.$transaction(async (tx) => {
        for (const job of jobs) {
          const stageUpdates = await resumeJob(tx, job, notes, req.user.id);
          allStageUpdates.push(...stageUpdates);
        }
      });
      const allOperatorIds = allStageUpdates.map((s) => s.operatorId).filter(Boolean);
      notify('emergency:resumed', jobs, allOperatorIds, req.user.id, {
        stages: allStageUpdates.map(({ stageId, status }) => ({ stageId, status })),
      });

      return res.status(200).json({ message: 'All paused jobs resumed', resumedCount: jobs.length });
    }

    return res.status(400).json({ message: 'Invalid scope' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to resume production', error: error.message });
  }
}

module.exports = { getActiveJobs, getPausedJobs, triggerStop, resumeStop };
