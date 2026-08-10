const prisma = require('../prismaClient');

function generateJobDisplayId() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `JOB-${timestamp}-${random}`;
}

async function receiveWorkOrder(req, res) {
  const {
    work_order_id: workOrderId,
    batch_number: batchNumber,
    product,
    target_quantity: targetQuantity,
    unit,
    production_line: productionLine,
    scheduled_date: scheduledDate,
    due_date: dueDate,
    material_requirements: materialRequirements,
    work_instructions: workInstructions,
  } = req.body;

  if (!workOrderId || !batchNumber || !product || !targetQuantity || !unit) {
    return res.status(400).json({
      message: 'work_order_id, batch_number, product, target_quantity, and unit are required',
    });
  }

  try {
    const existing = await prisma.job.findUnique({ where: { externalWorkOrderId: workOrderId } });
    if (existing) {
      return res.status(409).json({ message: 'A job for this work_order_id already exists', jobId: existing.jobId });
    }

    let line = null;
    if (productionLine) {
      line = await prisma.productionLine.findFirst({
        where: {
          OR: [
            { name: { equals: productionLine, mode: 'insensitive' } },
            { lineCode: { equals: productionLine, mode: 'insensitive' } },
          ],
        },
      });
    }

    // work_instructions is optional — ERP systems generally have no concept
    // of MES's stage-based process pipeline. When omitted, the job is
    // created with no stages; the manager fills them in via Job Builder
    // before activation (which already requires at least one stage and an
    // assigned operator per stage — see jobController.updateJob).
    const stageRows = Array.isArray(workInstructions)
      ? [...workInstructions]
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          .map((step) => ({
            stageOrder: step.order ?? 0,
            stageName: step.station || `Step ${step.order}`,
            stationTag: step.station || null,
            instruction: step.instruction || null,
            requiresQc: !!step.requires_qc,
            estimatedDurationMinutes: step.expected_duration_min || 0,
            status: 'PENDING',
          }))
      : [];

    const materialRows = Array.isArray(materialRequirements)
      ? materialRequirements.map((m, i) => ({
          name: m.name,
          qtyPerUnit: Number(m.qty_per_unit) || 0,
          unit: m.unit,
          totalRequired: Number(m.total_required) || 0,
          wastagePct: m.wastage_pct != null ? Number(m.wastage_pct) : null,
          sortOrder: i,
        }))
      : [];

    // Retries on any unique-constraint violation, on the assumption it's
    // the randomly-generated jobId colliding (astronomically unlikely, but
    // cheap to guard against). The externalWorkOrderId duplicate case is
    // already handled above via the upfront findUnique check — but if two
    // dispatches for the same work order genuinely race each other, both
    // could pass that check before either inserts, and this loop would
    // then exhaust all 5 attempts hitting the same externalWorkOrderId
    // conflict rather than the jobId it's actually meant to route around,
    // surfacing as a raw 500 instead of the clean 409 above.
    let attempts = 0;
    let job;
    while (attempts < 5) {
      attempts++;
      try {
        job = await prisma.job.create({
          data: {
            jobId: generateJobDisplayId(),
            name: `${product} — ${batchNumber}`,
            productName: product,
            targetQuantity: Number(targetQuantity),
            unit,
            status: 'DRAFT',
            source: 'ERP',
            externalWorkOrderId: workOrderId,
            batchNumber,
            targetDate: dueDate ? new Date(dueDate) : null,
            scheduledStartAt: scheduledDate ? new Date(scheduledDate) : null,
            lineId: line?.id || null,
            createdById: line?.managerId || null,
            stages: { create: stageRows },
            materialRequirements: { create: materialRows },
          },
          include: { stages: true, materialRequirements: true },
        });
        break;
      } catch (err) {
        if (err.code === 'P2002' && attempts < 5) continue;
        throw err;
      }
    }

    return res.status(201).json({
      message: 'Work order received',
      jobId: job.jobId,
      id: job.id,
      status: job.status,
      lineMatched: !!line,
      lineName: line?.name || null,
      stageCount: job.stages.length,
      materialCount: job.materialRequirements.length,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to receive work order', error: error.message });
  }
}

module.exports = { receiveWorkOrder };
