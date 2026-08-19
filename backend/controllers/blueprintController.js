const prisma = require('../prismaClient');

const CHILD_INCLUDE = {
  checklistItems: { orderBy: { sortOrder: 'asc' } },
  quantities: { orderBy: { sortOrder: 'asc' } },
  faultCategories: { orderBy: { sortOrder: 'asc' } },
};

function buildNestedCreates(body) {
  return {
    checklistItems: {
      create: (body.checklistItems || []).map((item, i) => ({
        itemText: item.itemText,
        isRequired: item.isRequired ?? true,
        sortOrder: i,
      })),
    },
    quantities: {
      create: (body.quantityMetrics || []).map((m, i) => ({
        metricName: m.metricName,
        unitLabel: m.unitLabel,
        minValue: m.minValue ?? null,
        maxValue: m.maxValue ?? null,
        inputFrequency: m.inputFrequency,
        sortOrder: i,
      })),
    },
    faultCategories: {
      create: (body.faultCategories || []).map((f, i) => ({
        faultName: f.faultName,
        sortOrder: i,
      })),
    },
  };
}

async function getAll(req, res) {
  try {
    const blueprints = await prisma.blueprint.findMany({ orderBy: { createdAt: 'desc' } });
    return res.status(200).json({ blueprints });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load blueprints', error: error.message });
  }
}

async function getOne(req, res) {
  try {
    const blueprint = await prisma.blueprint.findUnique({
      where: { id: req.params.id },
      include: CHILD_INCLUDE,
    });
    if (!blueprint) return res.status(404).json({ message: 'Blueprint not found' });
    return res.status(200).json({ blueprint });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load blueprint', error: error.message });
  }
}

async function create(req, res) {
  const body = req.body;
  try {
    const blueprint = await prisma.blueprint.create({
      data: {
        name: body.name,
        description: body.description || null,
        category: body.category,
        stationTag: body.stationTag || null,
        estimatedDurationMinutes: body.estimatedDurationMinutes || 0,
        guidelinesEnabled: !!body.guidelinesEnabled,
        guidelinesContent: body.guidelinesContent || null,
        // checklistEnabled only takes effect when quantityLoggingEnabled is
        // also true — the checklist is re-completed per batch now, nested
        // under Quantity Logging rather than a standalone stage gate.
        checklistEnabled: !!body.checklistEnabled,
        quantityLoggingEnabled: !!body.quantityLoggingEnabled,
        faultCategoriesEnabled: !!body.faultCategoriesEnabled,
        ...buildNestedCreates(body),
      },
      include: CHILD_INCLUDE,
    });
    return res.status(201).json({ blueprint });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create blueprint', error: error.message });
  }
}

async function update(req, res) {
  const { id } = req.params;
  const body = req.body;
  try {
    const blueprint = await prisma.$transaction(async (tx) => {
      await tx.blueprintChecklistItem.deleteMany({ where: { blueprintId: id } });
      await tx.blueprintQuantity.deleteMany({ where: { blueprintId: id } });
      await tx.blueprintFaultCategory.deleteMany({ where: { blueprintId: id } });

      return tx.blueprint.update({
        where: { id },
        data: {
          name: body.name,
          description: body.description || null,
          category: body.category,
          stationTag: body.stationTag || null,
          estimatedDurationMinutes: body.estimatedDurationMinutes || 0,
          guidelinesEnabled: !!body.guidelinesEnabled,
          guidelinesContent: body.guidelinesContent || null,
          checklistEnabled: !!body.checklistEnabled,
          quantityLoggingEnabled: !!body.quantityLoggingEnabled,
          faultCategoriesEnabled: !!body.faultCategoriesEnabled,
          ...buildNestedCreates(body),
        },
        include: CHILD_INCLUDE,
      });
    });
    return res.status(200).json({ blueprint });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update blueprint', error: error.message });
  }
}

async function archive(req, res) {
  try {
    const blueprint = await prisma.blueprint.update({
      where: { id: req.params.id },
      data: { isArchived: !!req.body.isArchived },
    });
    return res.status(200).json({ blueprint });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update archive status', error: error.message });
  }
}

module.exports = { getAll, getOne, create, update, archive };