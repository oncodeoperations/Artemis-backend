const express = require('express');
const router = express.Router();
const contractController = require('../controllers/contractController');
const { requireAuth, requireVerification } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  createContractBody,
  updateContractBody,
  updateContractStatusBody,
  updateMilestoneStatusBody,
  contractIdParam,
  milestoneParam,
} = require('../schemas/contracts');

/**
 * All contract routes require authentication
 */

/**
 * @swagger
 * tags:
 *   name: Contracts
 *   description: Contract CRUD and status management
 */

/**
 * @swagger
 * /api/contracts:
 *   get:
 *     summary: Get all contracts for current user
 *     tags: [Contracts]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [draft, pending, active, completed, rejected, disputed, archived] }
 *       - in: query
 *         name: role
 *         schema: { type: string, enum: [creator, contributor] }
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [fixed, hourly] }
 *     responses:
 *       200:
 *         description: List of contracts
 *       401:
 *         description: Unauthorized
 */
router.get('/', requireAuth, contractController.getAllContracts);

/**
 * @swagger
 * /api/contracts:
 *   post:
 *     summary: Create a new contract
 *     tags: [Contracts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [contractName, contributorEmail]
 *             properties:
 *               contractName: { type: string }
 *               contributorEmail: { type: string, format: email }
 *               category: { type: string }
 *               subcategory: { type: string }
 *               description: { type: string }
 *               contractType: { type: string, enum: [fixed, hourly], default: fixed }
 *               budget: { type: number }
 *               splitMilestones: { type: boolean }
 *               milestones:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name: { type: string }
 *                     description: { type: string }
 *                     budget: { type: number }
 *                     dueDate: { type: string }
 *               hourlyRate: { type: number }
 *               hoursPerWeek: { type: number }
 *               weeklyLimit: { type: number }
 *               currency: { type: string, default: USD }
 *               dueDate: { type: string }
 *               platformFee: { type: number }
 *               recipientMessage: { type: string }
 *     responses:
 *       201:
 *         description: Contract created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Contract'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 */
router.post('/', requireAuth, requireVerification, validate({ body: createContractBody }), contractController.createContract);

/**
 * @swagger
 * /api/contracts/{id}:
 *   get:
 *     summary: Get contract by ID
 *     tags: [Contracts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Contract details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Contract'
 *       404:
 *         description: Contract not found
 */
router.get('/:id', requireAuth, validate({ params: contractIdParam }), contractController.getContractById);

/**
 * @swagger
 * /api/contracts/{id}:
 *   put:
 *     summary: Update contract (creator only, draft status)
 *     tags: [Contracts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               contractName: { type: string }
 *               description: { type: string }
 *               category: { type: string }
 *               subcategory: { type: string }
 *               budget: { type: number }
 *               hourlyRate: { type: number }
 *               hoursPerWeek: { type: number }
 *               weeklyLimit: { type: number }
 *               dueDate: { type: string }
 *               milestones: { type: array, items: { $ref: '#/components/schemas/Milestone' } }
 *     responses:
 *       200:
 *         description: Contract updated
 *       400:
 *         description: Validation error
 */
router.put('/:id', requireAuth, requireVerification, validate({ params: contractIdParam, body: updateContractBody }), contractController.updateContract);

/**
 * @swagger
 * /api/contracts/{id}/status:
 *   patch:
 *     summary: Update contract status
 *     tags: [Contracts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [draft, pending, active, completed, rejected, disputed, archived] }
 *               rejectionReason: { type: string }
 *     responses:
 *       200:
 *         description: Status updated
 *       400:
 *         description: Invalid status transition
 */
router.patch('/:id/status', requireAuth, requireVerification, validate({ params: contractIdParam, body: updateContractStatusBody }), contractController.updateContractStatus);

/**
 * @swagger
 * /api/contracts/{id}/milestones/{milestoneIndex}/status:
 *   patch:
 *     summary: Update milestone status
 *     tags: [Contracts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: milestoneIndex
 *         required: true
 *         schema: { type: integer, minimum: 0 }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [submitted, in-progress, approved, rejected] }
 *               submissionDetails: { type: string }
 *               feedback: { type: string }
 *               message: { type: string }
 *     responses:
 *       200:
 *         description: Milestone status updated
 *       400:
 *         description: Invalid status transition
 */
router.patch('/:id/milestones/:milestoneIndex/status', requireAuth, requireVerification, validate({ params: milestoneParam, body: updateMilestoneStatusBody }), contractController.updateMilestoneStatus);

/**
 * @swagger
 * /api/contracts/{id}:
 *   delete:
 *     summary: Delete contract (draft only)
 *     tags: [Contracts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Contract deleted
 *       403:
 *         description: Not authorized or contract not in draft status
 */
router.delete('/:id', requireAuth, requireVerification, validate({ params: contractIdParam }), contractController.deleteContract);

module.exports = router;
