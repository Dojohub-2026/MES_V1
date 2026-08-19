// Nothing in the schema tags a blueprint quantity metric's role, and
// position isn't reliable either — e.g. Fruit Pulp Extraction orders its
// metrics [Input Fruit, Juice/Pulp Output, Waste Pomace], so "waste" isn't
// always second. Classify by name instead:
//   - any metric matching WASTE_METRIC_PATTERN, at any position, in any
//     stage -> rolled into total scrap
//   - final output: prefer the first metric anywhere matching
//     FILL_METRIC_PATTERN — filling is the point a unit actually becomes a
//     finished good, and later stages (labeling, QC inspection) may log a
//     different count or nothing at all, so the true last stage isn't a
//     reliable place to look. Falls back to the last stage's first
//     non-waste metric only if nothing matches "fill" anywhere.
//   - among each stage's remaining non-waste metrics (excluding whichever
//     one was already claimed as final output), the first one:
//       - in the FIRST stage -> raw material consumed, matched to the BOM
//       - otherwise          -> another logged input added mid-process
//         (e.g. water, sugar) — reported as logged, not matched to the BOM
//   - any further non-waste metric in a stage (e.g. an intermediate output
//     like pulp) is shown in the per-stage breakdown only — it's neither
//     final output, waste, nor a fresh material, so it isn't rolled into
//     any summary bucket
const WASTE_METRIC_PATTERN = /reject|waste|scrap|loss|defect/i;
const FILL_METRIC_PATTERN = /fill/i;

function buildProductionReport(job) {
  const stageReports = (job.stages ?? []).map((stage) => {
    const quantities = stage.blueprint?.quantities ?? [];
    const unitByMetric = Object.fromEntries(quantities.map((q) => [q.metricName, q.unitLabel]));

    const batches = (stage.sessions ?? [])
      .flatMap((session) =>
        (session.batches ?? []).map((entry) => ({
          batchNumber: entry.batchNumber,
          loggedAt: entry.loggedAt,
          operatorName: session.operator?.name ?? null,
          quantityData: entry.quantityData,
        }))
      )
      .sort((a, b) => new Date(a.loggedAt) - new Date(b.loggedAt));

    const metrics = quantities.map((q) => {
      const total = batches.reduce((sum, b) => {
        const value = b.quantityData?.[q.metricName];
        return typeof value === 'number' ? sum + value : sum;
      }, 0);
      return { name: q.metricName, unit: q.unitLabel ?? '', total: Math.round(total * 100) / 100 };
    });

    return { stageOrder: stage.stageOrder, stageName: stage.stageName, metrics, batches, unitByMetric };
  });

  // Find the definitive "produced" metric: the first fill-named metric in
  // stage order, anywhere in the job; otherwise the last stage's first
  // non-waste metric.
  let producedStageIndex = -1;
  let producedMetricName = null;
  for (let i = 0; i < stageReports.length; i++) {
    const fillMetric = stageReports[i].metrics.find((m) => !WASTE_METRIC_PATTERN.test(m.name) && FILL_METRIC_PATTERN.test(m.name));
    if (fillMetric) {
      producedStageIndex = i;
      producedMetricName = fillMetric.name;
      break;
    }
  }
  if (producedMetricName === null && stageReports.length > 0) {
    const lastIndex = stageReports.length - 1;
    const fallback = stageReports[lastIndex].metrics.find((m) => !WASTE_METRIC_PATTERN.test(m.name));
    if (fallback) {
      producedStageIndex = lastIndex;
      producedMetricName = fallback.name;
    }
  }

  let actualProduced = 0;
  const materialsConsumed = [];
  let scrapFromStages = 0;
  const scrapBreakdown = [];

  stageReports.forEach((stage, index) => {
    const isFirst = index === 0;

    const wasteMetrics = stage.metrics.filter((m) => WASTE_METRIC_PATTERN.test(m.name));
    const nonWasteMetrics = stage.metrics
      .filter((m) => !WASTE_METRIC_PATTERN.test(m.name))
      .filter((m) => !(index === producedStageIndex && m.name === producedMetricName));

    if (index === producedStageIndex) {
      const produced = stage.metrics.find((m) => m.name === producedMetricName);
      if (produced) actualProduced += produced.total;
    }

    const primary = nonWasteMetrics[0];
    if (primary) {
      if (isFirst) {
        const requirement = (job.materialRequirements ?? []).find((m) => m.name.toLowerCase() === primary.name.toLowerCase());
        materialsConsumed.push({ name: primary.name, qtyUsed: primary.total, unit: requirement?.unit ?? primary.unit, source: stage.stageName });
      } else {
        materialsConsumed.push({ name: primary.name, qtyUsed: primary.total, unit: primary.unit, source: stage.stageName });
      }
    }

    for (const waste of wasteMetrics) {
      scrapFromStages += waste.total;
      scrapBreakdown.push({ source: stage.stageName, metric: waste.name, quantity: waste.total, unit: waste.unit });
    }
  });

  const scrapFromLogs = (job.scrapLogs ?? []).reduce((sum, s) => sum + s.quantity, 0);
  if (scrapFromLogs > 0) {
    scrapBreakdown.push({ source: 'Manager-logged waste', metric: 'ScrapLog', quantity: Math.round(scrapFromLogs * 100) / 100, unit: 'mixed' });
  }

  return {
    stages: stageReports.map(({ unitByMetric, ...rest }) => rest),
    summary: {
      actualProduced: Math.round(actualProduced),
      actualScrap: Math.round(scrapFromStages + scrapFromLogs),
      scrapBreakdown,
      materialsConsumed,
    },
  };
}

function buildProductionDataPayload(job) {
  const report = buildProductionReport(job);

  return {
    work_order_id: job.externalWorkOrderId,
    job_id: job.jobId,
    batch_number: job.batchNumber,
    actual_produced: report.summary.actualProduced,
    actual_scrap: report.summary.actualScrap,
    // qty_used and lot_number: qty_used is now the real total logged at the
    // material's stage. lot_number stays null — raw-material lot capture
    // hasn't been built anywhere in MES.
    materials_consumed: report.summary.materialsConsumed.map((m) => ({
      name: m.name,
      qty_used: m.qtyUsed,
      unit: m.unit,
      lot_number: null,
    })),
    // Manager-logged downtime (POST /manager/jobs/:id/downtime) has no
    // stageId and an optional end time, so it's never auto-closed by
    // completeStage — an entry can genuinely still have endedAt: null here.
    // ERP's schema requires a real end string, so unclosed entries are
    // dropped rather than sent as null.
    downtime_log: (job.downtimeLogs ?? [])
      .filter((d) => d.endedAt !== null)
      .map((d) => ({
        start: d.startedAt,
        end: d.endedAt,
        reason: d.reason,
      })),
  };
}

const PRODUCTION_DATA_INCLUDE = {
  materialRequirements: true,
  downtimeLogs: true,
  scrapLogs: true,
  stages: {
    orderBy: { stageOrder: 'asc' },
    include: {
      faults: true,
      blueprint: { include: { quantities: { orderBy: { sortOrder: 'asc' } } } },
      sessions: {
        include: {
          operator: { select: { name: true } },
          batches: { orderBy: { batchNumber: 'asc' } },
        },
      },
    },
  },
};

module.exports = { buildProductionDataPayload, buildProductionReport, PRODUCTION_DATA_INCLUDE };
