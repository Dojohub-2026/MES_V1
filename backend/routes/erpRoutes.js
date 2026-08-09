const express = require('express');

const erpController = require('../controllers/erpController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authenticateToken, requireRole('ERP'));

/**
 * @swagger
 * /erp/work-orders:
 *   post:
 *     summary: Receive a work order from an external ERP system, creating a Job
 *     tags: [ERP Integration]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [work_order_id, batch_number, product, target_quantity, unit]
 *             properties:
 *               work_order_id: { type: string, description: "ERP's own work order ID, stored for de-duplication" }
 *               batch_number: { type: string }
 *               product: { type: string }
 *               target_quantity: { type: integer }
 *               unit: { type: string }
 *               production_line: { type: string, description: "Matched case-insensitively against ProductionLine.name or ProductionLine.lineCode; if no match, the job is created with no line and is visible to all managers as an unassigned draft" }
 *               scheduled_date: { type: string, format: date-time }
 *               due_date: { type: string, format: date-time }
 *               material_requirements:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name: { type: string }
 *                     qty_per_unit: { type: number }
 *                     unit: { type: string }
 *                     total_required: { type: number }
 *                     wastage_pct: { type: number, nullable: true }
 *               work_instructions:
 *                 type: array
 *                 description: "Optional. Ordered process stages the job will run through in MES. If omitted, the job is created with no stages — a manager must add them via Job Builder before the job can be activated."
 *                 items:
 *                   type: object
 *                   required: [order, instruction]
 *                   properties:
 *                     order: { type: integer }
 *                     station: { type: string, nullable: true }
 *                     instruction: { type: string }
 *                     requires_qc: { type: boolean }
 *                     expected_duration_min: { type: integer }
 *     responses:
 *       201:
 *         description: Job created from the work order (status DRAFT)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 jobId: { type: string }
 *                 id: { type: string, format: uuid }
 *                 status: { type: string }
 *                 lineMatched: { type: boolean }
 *                 lineName: { type: string, nullable: true }
 *                 stageCount: { type: integer }
 *                 materialCount: { type: integer }
 *       400:
 *         description: Missing required fields
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403: { $ref: '#/components/responses/ForbiddenError' }
 *       409:
 *         description: A job for this work_order_id already exists
 */
router.post('/work-orders', erpController.receiveWorkOrder);

module.exports = router;
