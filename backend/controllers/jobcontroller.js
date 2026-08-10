const { PrismaClient } = require('@prisma/client');
const { emitToExecutives } = require('../socket');
const erpClient = require('../services/erpClient');
const { buildProductionDataPayload, buildProductionReport, PRODUCTION_DATA_INCLUDE } = require('../services/productionDataBuilder');
const prisma = new PrismaClient();

function generateJobDisplayId() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `JOB-${timestamp}-${random}`;
}

async function createJob(req, res) {
  const {
    name,
    productName,
    targetQuantity,
    unit,
    notes,
    targetDate,
    lineId,
    scheduledStartAt,
    status, // 'DRAFT' | 'ACTIVE'
    stages, // [{ blueprintId, stageName, estimatedDurationMinutes, stationTag, operatorId }]
  } = req.body;

  if (!name || !Array.isArray(stages) || stages.length === 0) {
    return res.status(400).json({ message: 'Job name and at least one stage are required' });
  }
  if (status === 'ACTIVE' && stages.some((s) => !s.operatorId)) {
    return res.status(400).json({ message: 'Every stage must have an assigned operator before activation' });
  }

  const jobStatus = status === 'ACTIVE' ? 'ACTIVE' : 'DRAFT';
  const stageStatus = jobStatus === 'ACTIVE' ? 'AVAILABLE' : 'PENDING';

  const startTime = scheduledStartAt ? new Date(scheduledStartAt) : new Date();
  let cumulativeMinutes = 0;
  const stageRows = stages.map((s, idx) => {
    const durationMin = s.estimatedDurationMinutes || 0;
    const stageStart = new Date(startTime.getTime() + cumulativeMinutes * 60000);
    const stageEnd = new Date(stageStart.getTime() + durationMin * 60000);
    cumulativeMinutes += durationMin;
    return {
      blueprintId: s.blueprintId || null,
      stageOrder: idx,
      stageName: s.stageName,
      estimatedDurationMinutes: durationMin,
      stationTag: s.stationTag || null,
      operatorId: s.operatorId || null,
      status: stageStatus,
      scheduledStartAt: stageStart,
      scheduledEndAt: stageEnd,
    };
  });
  const scheduledEndAt = new Date(startTime.getTime() + cumulativeMinutes * 60000);

  let attempts = 0;
  while (attempts < 5) {
    attempts++;
    try {
      const job = await prisma.job.create({
        data: {
          jobId: generateJobDisplayId(),
          name,
          productName: productName || null,
          targetQuantity: targetQuantity || 0,
          unit: unit || 'Units',
          status: jobStatus,
          notes: notes || null,
          targetDate: targetDate ? new Date(targetDate) : null,
          lineId: lineId || null,
          scheduledStartAt: startTime,
          scheduledEndAt,
          startedAt: jobStatus === 'ACTIVE' ? new Date() : null,
          createdById: req.user.id, // matches authController's jwt.sign payload ({ id, name, role })
          stages: { create: stageRows },
        },
        include: { stages: true },
      });
      return res.status(201).json(job);
    } catch (err) {
      if (err.code === 'P2002' && attempts < 5) continue; // jobId collision — regenerate and retry
      console.error(err);
      return res.status(500).json({ message: 'Failed to create job' });
    }
  }
}

function buildStageRows(stages, startTime) {
  let cumulativeMinutes = 0;
  return stages.map((s, idx) => {
    const durationMin = s.estimatedDurationMinutes || 0;
    const stageStart = new Date(startTime.getTime() + cumulativeMinutes * 60000);
    const stageEnd = new Date(stageStart.getTime() + durationMin * 60000);
    cumulativeMinutes += durationMin;
    return {
      blueprintId: s.blueprintId || null,
      stageOrder: idx,
      stageName: s.stageName,
      instruction: s.instruction || null,
      requiresQc: !!s.requiresQc,
      estimatedDurationMinutes: durationMin,
      stationTag: s.stationTag || null,
      operatorId: s.operatorId || null,
      status: s.status || 'PENDING',
      scheduledStartAt: stageStart,
      scheduledEndAt: stageEnd,
    };
  });
}

async function canManagerAccessJob(job, managerId) {
  if (!job) return false;
  if (!job.lineId) return true; // unclaimed (e.g. ERP work order) — any manager may pick it up
  return job.line?.managerId === managerId;
}

async function getJob(req, res) {
  try {
    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
      include: {
        line: { select: { id: true, name: true, managerId: true } },
        stages: { orderBy: { stageOrder: 'asc' }, include: { operator: { select: { id: true, name: true } } } },
        materialRequirements: { orderBy: { sortOrder: 'asc' } },
      },
    });

    if (!job || !(await canManagerAccessJob(job, req.user.id))) {
      return res.status(404).json({ message: 'Job not found' });
    }

    return res.status(200).json(job);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load job', error: error.message });
  }
}

async function previewErpData(req, res) {
  try {
    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
      include: { line: { select: { managerId: true } }, ...PRODUCTION_DATA_INCLUDE },
    });

    if (!job || !(await canManagerAccessJob(job, req.user.id))) {
      return res.status(404).json({ message: 'Job not found' });
    }
    if (job.status !== 'COMPLETED') {
      return res.status(409).json({ message: `Job is not yet complete (current status: ${job.status})` });
    }
    if (job.source !== 'ERP' || !job.externalWorkOrderId) {
      return res.status(400).json({ message: "This job wasn't dispatched from ERP — there's no work order to report data against." });
    }

    const payload = buildProductionDataPayload(job);
    const report = buildProductionReport(job);
    return res.status(200).json({ ...payload, stages: report.stages, scrap_breakdown: report.summary.scrapBreakdown });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to build ERP preview', error: error.message });
  }
}

async function sendToErp(req, res) {
  try {
    const job = await prisma.job.findUnique({
      where: { id: req.params.id },
      include: { line: { select: { managerId: true } } },
    });

    if (!job || !(await canManagerAccessJob(job, req.user.id))) {
      return res.status(404).json({ message: 'Job not found' });
    }
    if (job.status !== 'COMPLETED') {
      return res.status(409).json({ message: `Job is not yet complete (current status: ${job.status})` });
    }
    if (job.source !== 'ERP' || !job.externalWorkOrderId) {
      return res.status(400).json({ message: "This job wasn't dispatched from ERP — there's no work order to report data against." });
    }

    await erpClient.pushProductionData(job.id);
    return res.status(200).json({ message: 'Production data sent to ERP' });
  } catch (error) {
    return res.status(502).json({ message: 'Failed to send production data to ERP', error: error.message });
  }
}

async function updateJob(req, res) {
  const { id } = req.params;
  const {
    name,
    productName,
    targetQuantity,
    unit,
    notes,
    targetDate,
    lineId,
    scheduledStartAt,
    status,
    stages,
  } = req.body;

  try {
    const existing = await prisma.job.findUnique({
      where: { id },
      include: { line: { select: { managerId: true } } },
    });

    if (!existing || !(await canManagerAccessJob(existing, req.user.id))) {
      return res.status(404).json({ message: 'Job not found' });
    }
    if (existing.status !== 'DRAFT') {
      return res.status(409).json({ message: 'Only draft jobs can be edited in Job Builder' });
    }
    if (!name || !Array.isArray(stages) || stages.length === 0) {
      return res.status(400).json({ message: 'Job name and at least one stage are required' });
    }
    if (status === 'ACTIVE' && stages.some((s) => !s.operatorId)) {
      return res.status(400).json({ message: 'Every stage must have an assigned operator before activation' });
    }

    const jobStatus = status === 'ACTIVE' ? 'ACTIVE' : 'DRAFT';
    const startTime = scheduledStartAt ? new Date(scheduledStartAt) : existing.scheduledStartAt || new Date();
    const stageRows = buildStageRows(
      stages.map((s) => ({ ...s, status: jobStatus === 'ACTIVE' ? 'AVAILABLE' : 'PENDING' })),
      startTime
    );
    const totalMinutes = stages.reduce((sum, s) => sum + (s.estimatedDurationMinutes || 0), 0);
    const scheduledEndAt = new Date(startTime.getTime() + totalMinutes * 60000);

    const job = await prisma.$transaction(async (tx) => {
      await tx.jobStage.deleteMany({ where: { jobId: id } });
      return tx.job.update({
        where: { id },
        data: {
          name,
          productName: productName || null,
          targetQuantity: targetQuantity || 0,
          unit: unit || 'Units',
          status: jobStatus,
          notes: notes || null,
          targetDate: targetDate ? new Date(targetDate) : existing.targetDate,
          lineId: lineId || existing.lineId,
          scheduledStartAt: startTime,
          scheduledEndAt,
          startedAt: jobStatus === 'ACTIVE' && !existing.startedAt ? new Date() : existing.startedAt,
          stages: { create: stageRows },
        },
        include: { stages: true },
      });
    });

    return res.status(200).json(job);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update job', error: error.message });
  }
}

async function logDowntime(req, res) {
  const { id } = req.params;
  const { reason, startedAt, endedAt } = req.body;

  if (!reason || !startedAt) {
    return res.status(400).json({ message: 'reason and startedAt are required' });
  }

  try {
    const job = await prisma.job.findUnique({
      where: { id },
      include: { line: { select: { managerId: true } } },
    });

    if (!job || !(await canManagerAccessJob(job, req.user.id))) {
      return res.status(404).json({ message: 'Job not found' });
    }

    const entry = await prisma.jobDowntimeLog.create({
      data: {
        jobId: id,
        reason,
        startedAt: new Date(startedAt),
        endedAt: endedAt ? new Date(endedAt) : null,
      },
    });

    return res.status(201).json(entry);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to log downtime', error: error.message });
  }
}

async function logScrap(req, res) {
  const { id } = req.params;
  const { stageId, quantity, unit, wasteType, notes } = req.body;

  if (!quantity || !unit || !wasteType) {
    return res.status(400).json({ message: 'quantity, unit, and wasteType are required' });
  }

  try {
    const job = await prisma.job.findUnique({
      where: { id },
      include: { line: { select: { managerId: true } } },
    });

    if (!job || !(await canManagerAccessJob(job, req.user.id))) {
      return res.status(404).json({ message: 'Job not found' });
    }

    if (stageId) {
      const stage = await prisma.jobStage.findFirst({ where: { id: stageId, jobId: id } });
      if (!stage) {
        return res.status(400).json({ message: 'stageId does not belong to this job' });
      }
    }

    const entry = await prisma.scrapLog.create({
      data: {
        jobId: id,
        stageId: stageId || null,
        quantity: Number(quantity),
        unit,
        wasteType,
        notes: notes || null,
      },
    });

    emitToExecutives('scrap:logged', { jobId: id, quantity: entry.quantity, unit, wasteType });

    return res.status(201).json(entry);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to log scrap', error: error.message });
  }
}

module.exports = { createJob, getJob, updateJob, logDowntime, logScrap, sendToErp, previewErpData };