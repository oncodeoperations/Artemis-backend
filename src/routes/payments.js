const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const paymentController = require('../controllers/paymentController');
const {
  payMilestoneBody,
  payMilestoneParams,
  milestoneStatusParams,
  updateWithdrawalInfoBody,
  requestWithdrawalBody,
  withdrawalsQuery,
  adminWithdrawalsQuery,
  adminProcessWithdrawalParams,
  adminProcessWithdrawalBody,
} = require('../schemas/payments');

/**
 * @swagger
 * tags:
 *   name: Payments
 *   description: Payment methods, milestone payments, balance & withdrawals
 */

// ─── Payment Methods (for payers / employers) ─────────────────

/**
 * @swagger
 * /api/payments/setup-intent:
 *   post:
 *     summary: Create a Stripe Setup Intent to save a card
 *     tags: [Payments]
 *     responses:
 *       200:
 *         description: Client secret returned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 clientSecret: { type: string }
 */
router.post('/setup-intent', requireAuth, paymentController.createSetupIntent);

/**
 * @swagger
 * /api/payments/methods:
 *   get:
 *     summary: List saved payment methods
 *     tags: [Payments]
 *     responses:
 *       200:
 *         description: Array of payment methods
 */
router.get('/methods', requireAuth, paymentController.listPaymentMethods);

// ─── Milestone Payments ────────────────────────────────────────

/**
 * @swagger
 * /api/payments/milestones/{contractId}/{milestoneIndex}/pay:
 *   post:
 *     summary: Pay an approved milestone
 *     tags: [Payments]
 *     parameters:
 *       - in: path
 *         name: contractId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: milestoneIndex
 *         required: true
 *         schema: { type: integer, minimum: 0 }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               paymentMethodId: { type: string }
 *     responses:
 *       200:
 *         description: Payment initiated
 *       400:
 *         description: Milestone not approved or payment already in progress
 */
router.post(
  '/milestones/:contractId/:milestoneIndex/pay',
  requireAuth,
  validate({ params: payMilestoneParams, body: payMilestoneBody }),
  paymentController.payMilestone
);

/**
 * @swagger
 * /api/payments/milestones/{contractId}/{milestoneIndex}/retry:
 *   post:
 *     summary: Retry a failed milestone payment
 *     tags: [Payments]
 *     parameters:
 *       - in: path
 *         name: contractId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: milestoneIndex
 *         required: true
 *         schema: { type: integer, minimum: 0 }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               paymentMethodId: { type: string }
 *     responses:
 *       200:
 *         description: Payment retried
 */
router.post(
  '/milestones/:contractId/:milestoneIndex/retry',
  requireAuth,
  validate({ params: payMilestoneParams, body: payMilestoneBody }),
  paymentController.payMilestone
);

/**
 * @swagger
 * /api/payments/milestones/{contractId}/{milestoneIndex}/status:
 *   get:
 *     summary: Get payment status for a milestone
 *     tags: [Payments]
 *     parameters:
 *       - in: path
 *         name: contractId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: milestoneIndex
 *         required: true
 *         schema: { type: integer, minimum: 0 }
 *     responses:
 *       200:
 *         description: Payment status details
 */
router.get(
  '/milestones/:contractId/:milestoneIndex/status',
  requireAuth,
  validate({ params: milestoneStatusParams }),
  paymentController.getMilestonePaymentStatus
);

// ─── Freelancer Balance & Withdrawals ──────────────────────────

/**
 * @swagger
 * /api/payments/balance:
 *   get:
 *     summary: Get current user balance and earnings
 *     tags: [Payments]
 *     responses:
 *       200:
 *         description: Balance info
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 balance: { type: number }
 *                 totalEarnings: { type: number }
 *                 withdrawalInfo: { type: object }
 */
router.get('/balance', requireAuth, paymentController.getBalance);

/**
 * @swagger
 * /api/payments/withdrawal-info:
 *   put:
 *     summary: Update bank/withdrawal details
 *     tags: [Payments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [bankName, accountName, accountNumber]
 *             properties:
 *               bankName: { type: string }
 *               accountName: { type: string }
 *               accountNumber: { type: string }
 *               routingNumber: { type: string }
 *               bankCountry: { type: string }
 *               currency: { type: string }
 *               additionalInfo: { type: string }
 *     responses:
 *       200:
 *         description: Withdrawal info updated
 *       400:
 *         description: Validation error
 */
router.put('/withdrawal-info', requireAuth, validate({ body: updateWithdrawalInfoBody }), paymentController.updateWithdrawalInfo);

/**
 * @swagger
 * /api/payments/withdraw:
 *   post:
 *     summary: Request a withdrawal
 *     tags: [Payments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount]
 *             properties:
 *               amount: { type: number, minimum: 0.01 }
 *     responses:
 *       200:
 *         description: Withdrawal request submitted
 *       400:
 *         description: Insufficient balance or pending withdrawal exists
 */
router.post('/withdraw', requireAuth, validate({ body: requestWithdrawalBody }), paymentController.requestWithdrawal);

/**
 * @swagger
 * /api/payments/withdrawals:
 *   get:
 *     summary: Get user's withdrawal history
 *     tags: [Payments]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Paginated withdrawal list
 */
router.get('/withdrawals', requireAuth, validate({ query: withdrawalsQuery }), paymentController.getWithdrawals);

// ─── Admin Withdrawal Management ───────────────────────────────

/**
 * @swagger
 * /api/payments/admin/withdrawals:
 *   get:
 *     summary: List all withdrawal requests (admin only)
 *     tags: [Payments]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [pending, processing, completed, rejected] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Paginated withdrawal list
 *       403:
 *         description: Admin role required
 */
router.get('/admin/withdrawals', requireAuth, requireRole('Admin'), validate({ query: adminWithdrawalsQuery }), paymentController.adminGetWithdrawals);

/**
 * @swagger
 * /api/payments/admin/withdrawals/{withdrawalId}:
 *   patch:
 *     summary: Process a withdrawal (admin only)
 *     tags: [Payments]
 *     parameters:
 *       - in: path
 *         name: withdrawalId
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
 *               status: { type: string, enum: [completed, rejected, processing] }
 *               adminNote: { type: string }
 *               externalReference: { type: string }
 *     responses:
 *       200:
 *         description: Withdrawal processed
 *       400:
 *         description: Already processed or invalid status
 *       403:
 *         description: Admin role required
 */
router.patch(
  '/admin/withdrawals/:withdrawalId',
  requireAuth,
  requireRole('Admin'),
  validate({ params: adminProcessWithdrawalParams, body: adminProcessWithdrawalBody }),
  paymentController.adminProcessWithdrawal
);

module.exports = router;
