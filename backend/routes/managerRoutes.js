const express = require('express');
const { rateLimit } = require('express-rate-limit');

const managerController = require('../controllers/managerController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();
/**
 * @swagger
 * /manager/lines:
 *   get:
 *     summary: List production lines assigned to the logged-in manager
 *     tags: [Manager - Dashboard]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Assigned lines
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/ProductionLine' }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403: { $ref: '#/components/responses/ForbiddenError' }
 */
router.get('/lines', authenticateToken, requireRole('MANAGER'), managerController.getLines);

/**
 * @swagger
 * /manager/metrics:
 *   get:
 *     summary: Manager dashboard metrics (assigned lines, active jobs, unresolved faults)
 *     tags: [Manager - Dashboard]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Metrics summary
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403: { $ref: '#/components/responses/ForbiddenError' }
 */
router.get('/metrics', authenticateToken, requireRole('MANAGER'), managerController.getMetrics);

/**
 * @swagger
 * /manager/jobs:
 *   get:
 *     summary: List active jobs on the manager's assigned lines, with live stage progress
 *     tags: [Manager - Dashboard]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Active jobs
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 allOf:
 *                   - $ref: '#/components/schemas/Job'
 *                   - type: object
 *                     properties:
 *                       stages:
 *                         type: array
 *                         items: { $ref: '#/components/schemas/JobStage' }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403: { $ref: '#/components/responses/ForbiddenError' }
 */
router.get('/jobs', authenticateToken, requireRole('MANAGER'), managerController.getActiveJobs);

/**
 * @swagger
 * /manager/alerts:
 *   get:
 *     summary: Unresolved faults/paused operations for the manager's lines, newest first
 *     tags: [Manager - Dashboard]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Live alerts
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/FaultLog' }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403: { $ref: '#/components/responses/ForbiddenError' }
 */
router.get('/alerts', authenticateToken, requireRole('MANAGER'), managerController.getAlerts);

/**
 * @swagger
 * /manager/faults/{id}/resolve:
 *   patch:
 *     summary: Resolve a fault from the manager dashboard
 *     tags: [Manager - Dashboard]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               resolutionNotes: { type: string }
 *     responses:
 *       200:
 *         description: Fault resolved
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/FaultLog' }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403: { $ref: '#/components/responses/ForbiddenError' }
 *       404: { $ref: '#/components/responses/NotFoundError' }
 */
router.patch('/faults/:id/resolve', authenticateToken, requireRole('MANAGER'), managerController.resolveFault);

/**
 * @swagger
 * /manager/operators:
 *   get:
 *     summary: List operators available to the manager (for assigning to stages)
 *     tags: [Manager - Dashboard]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Operator directory
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/User' }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403: { $ref: '#/components/responses/ForbiddenError' }
 */
router.get('/operators', authenticateToken, requireRole('MANAGER'), managerController.getOperators);

/**
 * @swagger
 * /manager/search:
 *   get:
 *     summary: Search jobs, operators, or faults from the manager console search bar
 *     tags: [Manager - Dashboard]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Matching results
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403: { $ref: '#/components/responses/ForbiddenError' }
 */
router.get(
  '/search',
  rateLimit({
    windowMs: 60 * 1000,
    limit: 60,
    standardHeaders: true,
    legacyHeaders: false,
  }),
  authenticateToken,
  requireRole('MANAGER'),
  managerController.search
);

module.exports = router;