const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');
const jobController = require('../controllers/jobcontroller');

router.use(authenticateToken, requireRole('MANAGER'));

/**
 * @swagger
 * /manager/jobs:
 *   post:
 *     summary: Create a new job (production pipeline) on a line
 *     tags: [Manager - Jobs]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/Job' }
 *     responses:
 *       201:
 *         description: Job created
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Job' }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403: { $ref: '#/components/responses/ForbiddenError' }
 */
router.post('/', jobController.createJob);

/**
 * @swagger
 * /manager/jobs/{id}:
 *   get:
 *     summary: Get a job with its stages, material requirements, and logs
 *     tags: [Manager - Jobs]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Job detail
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Job'
 *                 - type: object
 *                   properties:
 *                     stages:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/JobStage' }
 *                     materialRequirements:
 *                       type: array
 *                       items: { $ref: '#/components/schemas/JobMaterialRequirement' }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403: { $ref: '#/components/responses/ForbiddenError' }
 *       404: { $ref: '#/components/responses/NotFoundError' }
 */
router.get('/:id', jobController.getJob);

/**
 * @swagger
 * /manager/jobs/{id}:
 *   put:
 *     summary: Update a job's details
 *     tags: [Manager - Jobs]
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
 *           schema: { $ref: '#/components/schemas/Job' }
 *     responses:
 *       200:
 *         description: Job updated
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Job' }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403: { $ref: '#/components/responses/ForbiddenError' }
 *       404: { $ref: '#/components/responses/NotFoundError' }
 */
router.put('/:id', jobController.updateJob);

/**
 * @swagger
 * /manager/jobs/{id}/downtime:
 *   post:
 *     summary: Log a downtime event against a job
 *     tags: [Manager - Jobs]
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
 *             required: [startedAt, reason]
 *             properties:
 *               stageId: { type: string, format: uuid }
 *               startedAt: { type: string, format: date-time }
 *               endedAt: { type: string, format: date-time }
 *               reason: { type: string, example: "equipment_malfunction" }
 *               category: { type: string }
 *     responses:
 *       201:
 *         description: Downtime logged
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/JobDowntimeLog' }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403: { $ref: '#/components/responses/ForbiddenError' }
 *       404: { $ref: '#/components/responses/NotFoundError' }
 */
router.post('/:id/downtime', jobController.logDowntime);

/**
 * @swagger
 * /manager/jobs/{id}/scrap:
 *   post:
 *     summary: Log scrap/waste against a job
 *     tags: [Manager - Jobs]
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
 *             required: [quantity, unit, wasteType]
 *             properties:
 *               stageId: { type: string, format: uuid }
 *               quantity: { type: number }
 *               unit: { type: string, example: "kg" }
 *               wasteType: { type: string, example: "Fibrous Scrap Material" }
 *               notes: { type: string }
 *     responses:
 *       201:
 *         description: Scrap logged
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ScrapLog' }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403: { $ref: '#/components/responses/ForbiddenError' }
 *       404: { $ref: '#/components/responses/NotFoundError' }
 */
router.post('/:id/scrap', jobController.logScrap);

/**
 * @swagger
 * /manager/jobs/{id}/erp-preview:
 *   get:
 *     summary: Preview the exact production data payload that would be sent to ERP
 *     tags: [Manager - Jobs]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: The ERP payload, unsent
 *       400:
 *         description: Job wasn't dispatched from ERP — no work order to report against
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403: { $ref: '#/components/responses/ForbiddenError' }
 *       404: { $ref: '#/components/responses/NotFoundError' }
 *       409:
 *         description: Job is not yet COMPLETED
 */
router.get('/:id/erp-preview', jobController.previewErpData);

/**
 * @swagger
 * /manager/jobs/{id}/send-to-erp:
 *   post:
 *     summary: Manually (re-)send a completed job's production data to ERP
 *     tags: [Manager - Jobs]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Production data sent to ERP
 *       400:
 *         description: Job wasn't dispatched from ERP — no work order to report against
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403: { $ref: '#/components/responses/ForbiddenError' }
 *       404: { $ref: '#/components/responses/NotFoundError' }
 *       409:
 *         description: Job is not yet COMPLETED
 *       502:
 *         description: ERP login or delivery failed
 */
router.post('/:id/send-to-erp', jobController.sendToErp);

module.exports = router;