const express = require('express');

const blueprintController = require('../controllers/blueprintController');
const { authenticateToken, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

/**
 * @swagger
 * /blueprints:
 *   get:
 *     summary: List all process blueprints
 *     tags: [Blueprints]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: List of blueprints
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Blueprint' }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403: { $ref: '#/components/responses/ForbiddenError' }
 */
router.get('/', authenticateToken, requireRole('MANAGER'), blueprintController.getAll);

/**
 * @swagger
 * /blueprints/{id}:
 *   get:
 *     summary: Get a single blueprint with its checklist/quantity/fault sections
 *     tags: [Blueprints]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Blueprint detail
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Blueprint' }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403: { $ref: '#/components/responses/ForbiddenError' }
 *       404: { $ref: '#/components/responses/NotFoundError' }
 */
router.get('/:id', authenticateToken, requireRole('MANAGER'), blueprintController.getOne);

/**
 * @swagger
 * /blueprints:
 *   post:
 *     summary: Create a new process blueprint
 *     tags: [Blueprints]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/Blueprint' }
 *     responses:
 *       201:
 *         description: Blueprint created
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Blueprint' }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403: { $ref: '#/components/responses/ForbiddenError' }
 */
router.post('/', authenticateToken, requireRole('MANAGER'), blueprintController.create);

/**
 * @swagger
 * /blueprints/{id}:
 *   put:
 *     summary: Replace a blueprint's configuration
 *     tags: [Blueprints]
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
 *           schema: { $ref: '#/components/schemas/Blueprint' }
 *     responses:
 *       200:
 *         description: Blueprint updated
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Blueprint' }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403: { $ref: '#/components/responses/ForbiddenError' }
 *       404: { $ref: '#/components/responses/NotFoundError' }
 */
router.put('/:id', authenticateToken, requireRole('MANAGER'), blueprintController.update);

/**
 * @swagger
 * /blueprints/{id}/archive:
 *   patch:
 *     summary: Archive a blueprint (soft delete — hides it from active pickers)
 *     tags: [Blueprints]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Blueprint archived
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Blueprint' }
 *       401: { $ref: '#/components/responses/UnauthorizedError' }
 *       403: { $ref: '#/components/responses/ForbiddenError' }
 *       404: { $ref: '#/components/responses/NotFoundError' }
 */
router.patch('/:id/archive', authenticateToken, requireRole('MANAGER'), blueprintController.archive);

module.exports = router;