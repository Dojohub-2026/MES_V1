const prisma = require('../prismaClient');

async function getLines(req, res) {
  try {
    const lines = await prisma.productionLine.findMany({
      where: { managerId: req.user.id },
      orderBy: { lineCode: 'asc' },
    });

    return res.status(200).json({ lines });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load assigned lines', error: error.message });
  }
}

async function getMetrics(req, res) {
  try {
    const [assignedLineCount, activeJobCount, unresolvedFaultCount] = await Promise.all([
      prisma.productionLine.count({
        where: { managerId: req.user.id },
      }),
      prisma.job.count({
        where: {
          status: 'ACTIVE',
          line: { managerId: req.user.id },
        },
      }),
      prisma.faultLog.count({
        where: {
          resolvedAt: null,
          job: { line: { managerId: req.user.id } },
        },
      }),
    ]);

    return res.status(200).json({ assignedLineCount, activeJobCount, unresolvedFaultCount });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load manager metrics', error: error.message });
  }
}

async function getActiveJobs(req, res) {
  try {
    const status = (req.query.status || 'ACTIVE').toUpperCase();

    // Draft jobs may not have a line assigned yet (e.g. an ERP work order
    // whose production_line didn't match an existing line) — any manager
    // needs to be able to see and claim those, not just line owners.
    const where =
      status === 'DRAFT'
        ? { status: 'DRAFT', OR: [{ line: { managerId: req.user.id } }, { lineId: null }] }
        : { status, line: { managerId: req.user.id } };

    const jobs = await prisma.job.findMany({
      where,
      include: {
        stages: {
          orderBy: { stageOrder: 'asc' },
          include: { operator: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const shaped = jobs.map((job) => ({
      id: job.id,
      jobId: job.jobId,
      name: job.name,
      productName: job.productName,
      status: job.status,
      source: job.source,
      batchNumber: job.batchNumber,
      lineId: job.lineId,
      stages: job.stages.map((stage) => ({
        id: stage.id,
        stageOrder: stage.stageOrder,
        stageName: stage.stageName,
        status: stage.status,
        stationTag: stage.stationTag,
        estimatedDurationMinutes: stage.estimatedDurationMinutes,
        operatorName: stage.operator?.name ?? null,
      })),
    }));

    return res.status(200).json({ jobs: shaped });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load jobs', error: error.message });
  }
}

async function getAlerts(req, res) {
  try {
    const faults = await prisma.faultLog.findMany({
      where: {
        resolvedAt: null,
        job: { line: { managerId: req.user.id } },
      },
      include: {
        job: { select: { jobId: true, name: true } },
        operator: { select: { name: true } },
      },
      orderBy: { loggedAt: 'desc' },
    });

    const shaped = faults.map((fault) => ({
      id: fault.id,
      title: fault.title,
      description: fault.description,
      severity: fault.severity,
      jobId: fault.job.jobId,
      jobName: fault.job.name,
      operatorName: fault.operator?.name ?? null,
      loggedAt: fault.loggedAt,
    }));

    return res.status(200).json({ alerts: shaped });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load alerts', error: error.message });
  }
}

async function resolveFault(req, res) {
  try {
    const fault = await prisma.faultLog.findUnique({
      where: { id: req.params.id },
      include: { job: { include: { line: true } } },
    });

    // Same pattern as runtimeController's ensureOwnedStage: ownership is
    // the access check, and a mismatch reads as "not found" rather than
    // "forbidden" so a manager can't probe for faults on lines they don't
    // own.
    if (!fault || fault.job.line?.managerId !== req.user.id) {
      return res.status(404).json({ message: 'Fault not found' });
    }

    const resolved = await prisma.faultLog.update({
      where: { id: req.params.id },
      data: {
        resolvedAt: new Date(),
        resolvedBy: req.user.name,
        resolutionNotes: req.body.resolutionNotes || null,
      },
    });

    return res.status(200).json({ id: resolved.id, resolvedAt: resolved.resolvedAt });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to resolve fault', error: error.message });
  }
}

async function search(req, res) {
  const q = (req.query.q || '').trim();
  if (q.length < 2) {
    return res.status(200).json({ jobs: [], operators: [], faults: [] });
  }

  try {
    const [jobs, operators, faults] = await Promise.all([
      prisma.job.findMany({
        where: {
          AND: [
            { OR: [{ line: { managerId: req.user.id } }, { lineId: null }] },
            {
              OR: [
                { jobId: { contains: q, mode: 'insensitive' } },
                { name: { contains: q, mode: 'insensitive' } },
                { productName: { contains: q, mode: 'insensitive' } },
              ],
            },
          ],
        },
        select: { id: true, jobId: true, name: true, productName: true, status: true },
        orderBy: { createdAt: 'desc' },
        take: 6,
      }),
      // Unlike jobs and faults above, operator results aren't scoped to
      // this manager's own lines — any manager searching can find any
      // active operator system-wide. Matches getOperators below; operators
      // aren't modeled as belonging to a specific manager or line.
      prisma.user.findMany({
        where: {
          role: 'OPERATOR',
          isActive: true,
          OR: [{ name: { contains: q, mode: 'insensitive' } }, { identifier: { contains: q, mode: 'insensitive' } }],
        },
        select: { id: true, name: true, identifier: true, skills: true },
        orderBy: { name: 'asc' },
        take: 6,
      }),
      prisma.faultLog.findMany({
        where: {
          job: { line: { managerId: req.user.id } },
          OR: [{ title: { contains: q, mode: 'insensitive' } }, { category: { contains: q, mode: 'insensitive' } }],
        },
        include: { job: { select: { jobId: true, name: true } } },
        orderBy: { loggedAt: 'desc' },
        take: 6,
      }),
    ]);

    return res.status(200).json({
      jobs: jobs.map((j) => ({ id: j.id, jobId: j.jobId, name: j.name, productName: j.productName, status: j.status })),
      operators: operators.map((o) => ({ id: o.id, name: o.name, phone: o.identifier, skills: o.skills })),
      faults: faults.map((f) => ({
        id: f.id,
        title: f.title,
        severity: f.severity,
        resolvedAt: f.resolvedAt,
        jobId: f.job?.jobId ?? null,
        jobName: f.job?.name ?? null,
      })),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Search failed', error: error.message });
  }
}

async function getOperators(req, res) {
  try {
    const operators = await prisma.user.findMany({
      where: { role: 'OPERATOR', isActive: true },
      select: { id: true, name: true, identifier: true, phone: true, skills: true },
      orderBy: { name: 'asc' },
    });
    res.json(operators);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch operators' });
  }
}

module.exports = {
  getLines,
  getMetrics,
  getActiveJobs,
  getAlerts,
  resolveFault,
  getOperators,
  search,
};