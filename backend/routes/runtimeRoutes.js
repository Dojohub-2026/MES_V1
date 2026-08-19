const express = require('express');
const runtimeController = require('../controllers/runtimeController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();
router.use(authenticateToken, requireRole('OPERATOR'));

/**
 * @swagger
 * /operator/assignments:
 *   get:
 *     summary: "O1 — List stages assigned to the logged-in operator"
 *     tags: [Operator Runtime]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Assigned stages
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/JobStage' }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403: { $ref: '#/components/responses/ForbiddenError' }
 */
router.get('/assignments', runtimeController.getAssignments);

/**
 * @swagger
 * /operator/stages/{id}:
 *   get:
 *     summary: "O2 — Full stage detail (guidelines, checklist, quantity)"
 *     tags: [Operator Runtime]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Stage detail
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/JobStage' }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403:
 *         description: Forbidden — wrong role, or stage not assigned to this operator
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       404: { $ref: '#/components/responses/NotFoundError' }
 */
router.get('/stages/:id', runtimeController.getStageDetail);

/**
 * @swagger
 * /operator/stages/{id}/start:
 *   post:
 *     summary: "O2 — Start a stage (AVAILABLE → RUNNING), opens a ProcessSession"
 *     tags: [Operator Runtime]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Stage started
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/JobStage' }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403: { $ref: '#/components/responses/ForbiddenError' }
 *       404: { $ref: '#/components/responses/NotFoundError' }
 *       409:
 *         description: Stage is not in AVAILABLE status
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.post('/stages/:id/start', runtimeController.startStage);

/**
 * @swagger
 * /operator/stages/{id}/pause:
 *   post:
 *     summary: "O2 — Pause a running stage"
 *     tags: [Operator Runtime]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Stage paused
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/JobStage' }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403: { $ref: '#/components/responses/ForbiddenError' }
 *       404: { $ref: '#/components/responses/NotFoundError' }
 *       409:
 *         description: Stage is not RUNNING
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.post('/stages/:id/pause', runtimeController.pauseStage);

/**
 * @swagger
 * /operator/stages/{id}/resume:
 *   post:
 *     summary: "O2 — Resume a paused stage"
 *     tags: [Operator Runtime]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Stage resumed
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/JobStage' }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403: { $ref: '#/components/responses/ForbiddenError' }
 *       404: { $ref: '#/components/responses/NotFoundError' }
 *       409:
 *         description: Stage is not PAUSED
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.post('/stages/:id/resume', runtimeController.resumeStage);

/**
 * @swagger
 * /operator/stages/{id}/complete:
 *   post:
 *     summary: "O2 — Complete a stage (closes the ProcessSession)"
 *     tags: [Operator Runtime]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Stage completed
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/JobStage' }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403: { $ref: '#/components/responses/ForbiddenError' }
 *       404: { $ref: '#/components/responses/NotFoundError' }
 *       409:
 *         description: Stage is not RUNNING or PAUSED
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.post('/stages/:id/complete', runtimeController.completeStage);

/**
 * @swagger
 * /operator/stages/{id}/quantity:
 *   get:
 *     summary: "O2 — List batch entries logged for the stage's active session"
 *     tags: [Operator Runtime]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Batch entries
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/BatchEntry' }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403: { $ref: '#/components/responses/ForbiddenError' }
 *       404: { $ref: '#/components/responses/NotFoundError' }
 */
router.get('/stages/:id/quantity', runtimeController.getQuantityLogs);

/**
 * @swagger
 * /operator/stages/{id}/quantity:
 *   post:
 *     summary: "O2 — Log a batch entry; if the blueprint's checklist is enabled, all required items must be checked for this batch"
 *     tags: [Operator Runtime]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [entries]
 *             properties:
 *               entries:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     metricName: { type: string }
 *                     value: { type: number }
 *                 example: [{ "metricName": "Units Filled", "value": 25 }]
 *               checklist:
 *                 type: array
 *                 description: Required when the blueprint's checklist is enabled — one entry per checklist item for this batch.
 *                 items:
 *                   type: object
 *                   properties:
 *                     itemId: { type: string, format: uuid }
 *                     checked: { type: boolean }
 *               notes: { type: string }
 *     responses:
 *       201:
 *         description: Batch logged
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/BatchEntry' }
 *       400:
 *         description: Missing entries, or required checklist items not checked
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403: { $ref: '#/components/responses/ForbiddenError' }
 *       404: { $ref: '#/components/responses/NotFoundError' }
 */
router.post('/stages/:id/quantity', runtimeController.logQuantity);

/**
 * @swagger
 * /operator/stages/{id}/faults:
 *   post:
 *     summary: "O3 — Report a fault/issue against this stage. The process keeps running."
 *     tags: [Operator Runtime]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [category, severity]
 *             properties:
 *               category: { type: string, example: "Seal Integrity Failure" }
 *               severity: { type: string, enum: [CRITICAL, MINOR] }
 *               description: { type: string }
 *               photoUrl: { type: string, nullable: true }
 *     responses:
 *       201:
 *         description: Fault reported
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/FaultLog' }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403: { $ref: '#/components/responses/ForbiddenError' }
 *       404: { $ref: '#/components/responses/NotFoundError' }
 */
router.post('/stages/:id/faults', runtimeController.reportFault);

module.exports = router;