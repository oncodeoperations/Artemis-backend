const stripeService = require('../services/stripeService');
const User = require('../models/User');
const Contract = require('../models/Contract');
const Withdrawal = require('../models/Withdrawal');
const emailService = require('../services/emailService');
const notificationService = require('../services/notificationService');
const logger = require('../utils/logger');

// ─── Payment Methods (for employers / payers) ──────────────────

/**
 * POST /api/payments/setup-intent
 * Create a Setup Intent so the employer can save a card
 */
const createSetupIntent = async (req, res) => {
  try {
    const user = req.user;

    if (!user.stripeCustomerId) {
      const customer = await stripeService.createCustomer(user);
      user.stripeCustomerId = customer.id;
      await user.save();
    }

    const setupIntent = await stripeService.createSetupIntent(user.stripeCustomerId);
    res.json({ clientSecret: setupIntent.client_secret });
  } catch (error) {
    logger.error('Create setup intent error', { error: error.message });
    res.status(500).json({ error: 'Failed to create setup intent', message: error.message });
  }
};

/**
 * GET /api/payments/methods
 * List saved payment methods for the current user
 */
const listPaymentMethods = async (req, res) => {
  try {
    const user = req.user;
    if (!user.stripeCustomerId) {
      return res.json({ methods: [] });
    }
    const methods = await stripeService.listPaymentMethods(user.stripeCustomerId);
    res.json({ methods });
  } catch (error) {
    logger.error('List payment methods error', { error: error.message });
    res.status(500).json({ error: 'Failed to list payment methods', message: error.message });
  }
};

// ─── Milestone Payments ────────────────────────────────────────

/**
 * POST /api/payments/milestones/:contractId/:milestoneIndex/pay
 * Employer pays a milestone — money goes to platform. Freelancer balance is
 * credited when the webhook confirms success.
 */
const payMilestone = async (req, res) => {
  try {
    const { contractId, milestoneIndex } = req.params;
    const { paymentMethodId } = req.body;
    const userId = req.user._id;

    const contract = await Contract.findById(contractId)
      .populate('creator', 'firstName lastName email stripeCustomerId')
      .populate('contributor', 'firstName lastName email');

    if (!contract) {
      return res.status(404).json({ error: 'Contract not found' });
    }

    if (!contract.creator._id.equals(userId)) {
      return res.status(403).json({ error: 'Unauthorized', message: 'Only the contract creator can issue payments.' });
    }

    const index = parseInt(milestoneIndex);
    if (isNaN(index) || index < 0 || index >= contract.milestones.length) {
      return res.status(400).json({ error: 'Invalid milestone index' });
    }

    const milestone = contract.milestones[index];

    if (milestone.status !== 'approved') {
      return res.status(400).json({ error: 'Milestone not approved', message: 'Only approved milestones can be paid.' });
    }

    // Allow retry on failed, block if processing or succeeded
    if (milestone.paymentIntentId && milestone.paymentStatus !== 'failed') {
      return res.status(400).json({ error: 'Payment already initiated', message: 'A payment is already in progress for this milestone.' });
    }

    // Ensure creator has a Stripe customer
    let creatorCustomerId = contract.creator.stripeCustomerId;
    if (!creatorCustomerId) {
      const customer = await stripeService.createCustomer(req.user);
      req.user.stripeCustomerId = customer.id;
      await req.user.save();
      creatorCustomerId = customer.id;
    }

    const amountCents = Math.round(milestone.budget * 100);

    // Cancel stale failed PI before creating a new one
    if (milestone.paymentIntentId && milestone.paymentStatus === 'failed') {
      try { await stripeService.stripe.paymentIntents.cancel(milestone.paymentIntentId); } catch (_) { /* ok */ }
    }

    const paymentIntent = await stripeService.createMilestonePayment({
      amount: amountCents,
      currency: contract.currency,
      customerStripeId: creatorCustomerId,
      contractId: contract._id.toString(),
      milestoneIndex: index,
      milestoneName: milestone.name,
      platformFeePercent: contract.platformFee,
    });

    // Auto-confirm with payment method
    if (paymentMethodId) {
      await stripeService.stripe.paymentIntents.confirm(paymentIntent.id, { payment_method: paymentMethodId });
    } else {
      // Try first saved card
      const methods = await stripeService.listPaymentMethods(creatorCustomerId);
      if (methods && methods.length > 0) {
        await stripeService.stripe.paymentIntents.confirm(paymentIntent.id, { payment_method: methods[0].id });
      }
    }

    milestone.paymentIntentId = paymentIntent.id;
    milestone.paymentStatus = 'processing';
    milestone.paymentAttempts = (milestone.paymentAttempts || 0) + 1;
    milestone.paymentError = null;

    milestone.activityLog.push({
      action: 'payment_initiated',
      by: 'creator',
      message: `Payment of ${contract.currency} ${milestone.budget.toFixed(2)} initiated`,
      timestamp: new Date(),
    });

    await contract.save();

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: amountCents / 100,
    });
  } catch (error) {
    logger.error('Pay milestone error', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Payment failed', message: error.message });
  }
};

/**
 * GET /api/payments/milestones/:contractId/:milestoneIndex/status
 */
const getMilestonePaymentStatus = async (req, res) => {
  try {
    const { contractId, milestoneIndex } = req.params;
    const contract = await Contract.findById(contractId);
    if (!contract) return res.status(404).json({ error: 'Contract not found' });

    const index = parseInt(milestoneIndex);
    if (isNaN(index) || index < 0 || index >= contract.milestones.length) {
      return res.status(400).json({ error: 'Invalid milestone index' });
    }

    const milestone = contract.milestones[index];

    if (!milestone.paymentIntentId) {
      return res.json({
        paymentStatus: milestone.paymentStatus || 'none',
        paymentIntentId: null,
        paymentError: milestone.paymentError || null,
      });
    }

    const paymentIntent = await stripeService.getPaymentIntent(milestone.paymentIntentId);

    res.json({
      paymentStatus: milestone.paymentStatus,
      stripeStatus: paymentIntent.status,
      paymentIntentId: milestone.paymentIntentId,
      amount: paymentIntent.amount / 100,
      currency: paymentIntent.currency,
      paidAt: milestone.paidAt || null,
      paymentAttempts: milestone.paymentAttempts || 0,
      paymentError: milestone.paymentError || null,
    });
  } catch (error) {
    logger.error('Get milestone payment status error', { error: error.message });
    res.status(500).json({ error: 'Failed to get payment status', message: error.message });
  }
};

// ─── Freelancer Balance & Withdrawals ──────────────────────────

/**
 * GET /api/payments/balance
 * Get current user's balance and withdrawal info
 */
const getBalance = async (req, res) => {
  try {
    const user = req.user;
    res.json({
      balance: user.balance || 0,
      totalEarnings: user.totalEarnings || 0,
      withdrawalInfo: user.withdrawalInfo || null,
    });
  } catch (error) {
    logger.error('Get balance error', { error: error.message });
    res.status(500).json({ error: 'Failed to get balance' });
  }
};

/**
 * PUT /api/payments/withdrawal-info
 * Save or update freelancer's bank/withdrawal details
 */
const updateWithdrawalInfo = async (req, res) => {
  try {
    const { bankName, accountName, accountNumber, routingNumber, bankCountry, currency, additionalInfo } = req.body;

    if (!bankName || !accountName || !accountNumber) {
      return res.status(400).json({
        error: 'Missing fields',
        message: 'Bank name, account name, and account number are required.',
      });
    }

    req.user.withdrawalInfo = {
      bankName,
      accountName,
      accountNumber,
      routingNumber: routingNumber || '',
      bankCountry: bankCountry || '',
      currency: currency || 'USD',
      additionalInfo: additionalInfo || '',
    };
    await req.user.save();

    res.json({ message: 'Withdrawal info updated', withdrawalInfo: req.user.withdrawalInfo });
  } catch (error) {
    logger.error('Update withdrawal info error', { error: error.message });
    res.status(500).json({ error: 'Failed to update withdrawal info' });
  }
};

/**
 * POST /api/payments/withdraw
 * Request a withdrawal
 */
const requestWithdrawal = async (req, res) => {
  try {
    const user = req.user;
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    if (amount > (user.balance || 0)) {
      return res.status(400).json({ error: 'Insufficient balance', message: `Your balance is ${user.balance || 0}` });
    }

    if (!user.withdrawalInfo?.bankName || !user.withdrawalInfo?.accountNumber) {
      return res.status(400).json({ error: 'Withdrawal info required', message: 'Please set up your bank details before requesting a withdrawal.' });
    }

    // Check for pending withdrawal
    const pendingWithdrawal = await Withdrawal.findOne({ user: user._id, status: { $in: ['pending', 'processing'] } });
    if (pendingWithdrawal) {
      return res.status(400).json({ error: 'Pending withdrawal exists', message: 'You already have a pending withdrawal request.' });
    }

    // Atomic balance deduction — prevents race conditions
    const updatedUser = await User.findOneAndUpdate(
      { _id: user._id, balance: { $gte: amount } },
      { $inc: { balance: -amount } },
      { new: true }
    );
    if (!updatedUser) {
      return res.status(400).json({ error: 'Insufficient balance', message: 'Balance changed during request. Please try again.' });
    }

    const withdrawal = await Withdrawal.create({
      user: user._id,
      amount,
      currency: user.withdrawalInfo.currency || 'USD',
      withdrawalInfo: { ...user.withdrawalInfo.toObject() },
    });

    // Notify user (fire-and-forget)
    try {
      await notificationService.create({
        recipientId: user._id.toString(),
        type: 'withdrawal_requested',
        title: 'Withdrawal Requested',
        message: `Your withdrawal of ${withdrawal.currency} ${amount.toFixed(2)} is being processed`,
        metadata: { withdrawalId: withdrawal._id.toString(), amount },
      });
      await emailService.sendWithdrawalRequested(updatedUser, withdrawal);
    } catch (err) {
      logger.error('Failed to send withdrawal notification', { error: err.message });
    }

    res.json({
      message: 'Withdrawal request submitted',
      withdrawal: {
        _id: withdrawal._id,
        amount: withdrawal.amount,
        currency: withdrawal.currency,
        status: withdrawal.status,
        createdAt: withdrawal.createdAt,
      },
      newBalance: updatedUser.balance,
    });
  } catch (error) {
    logger.error('Request withdrawal error', { error: error.message });
    res.status(500).json({ error: 'Failed to request withdrawal' });
  }
};

/**
 * GET /api/payments/withdrawals
 * Get user's withdrawal history
 */
const getWithdrawals = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [withdrawals, total] = await Promise.all([
      Withdrawal.find({ user: req.user._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Withdrawal.countDocuments({ user: req.user._id }),
    ]);

    res.json({ withdrawals, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    logger.error('Get withdrawals error', { error: error.message });
    res.status(500).json({ error: 'Failed to get withdrawals' });
  }
};

// ─── Admin Withdrawal Management ───────────────────────────────

/**
 * GET /api/payments/admin/withdrawals
 * List all withdrawal requests (admin)
 */
const adminGetWithdrawals = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const query = {};
    if (status) query.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [withdrawals, total] = await Promise.all([
      Withdrawal.find(query)
        .populate('user', 'firstName lastName email')
        .populate('processedBy', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Withdrawal.countDocuments(query),
    ]);

    res.json({ withdrawals, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    logger.error('Admin get withdrawals error', { error: error.message });
    res.status(500).json({ error: 'Failed to get withdrawals' });
  }
};

/**
 * PATCH /api/payments/admin/withdrawals/:withdrawalId
 * Admin processes a withdrawal — mark as completed or rejected
 */
const adminProcessWithdrawal = async (req, res) => {
  try {
    const { withdrawalId } = req.params;
    const { status, adminNote, externalReference } = req.body;
    const adminUserId = req.user._id;

    if (!['completed', 'rejected', 'processing'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status', message: 'Status must be completed, rejected, or processing.' });
    }

    const withdrawal = await Withdrawal.findById(withdrawalId).populate('user', 'firstName lastName email balance');
    if (!withdrawal) {
      return res.status(404).json({ error: 'Withdrawal not found' });
    }

    if (withdrawal.status === 'completed' || withdrawal.status === 'rejected') {
      return res.status(400).json({ error: 'Already processed', message: 'This withdrawal has already been processed.' });
    }

    withdrawal.status = status;
    withdrawal.adminNote = adminNote || withdrawal.adminNote;
    withdrawal.processedBy = adminUserId;
    withdrawal.processedAt = new Date();
    if (externalReference) withdrawal.externalReference = externalReference;

    // If rejected, refund the balance atomically
    if (status === 'rejected') {
      await User.findByIdAndUpdate(withdrawal.user._id, {
        $inc: { balance: withdrawal.amount }
      });
    }

    await withdrawal.save();

    // Notify the user
    try {
      const notifType = status === 'completed' ? 'withdrawal_completed' : status === 'rejected' ? 'withdrawal_rejected' : 'withdrawal_processing';
      const notifTitle = status === 'completed' ? 'Withdrawal Sent' : status === 'rejected' ? 'Withdrawal Rejected' : 'Withdrawal Processing';
      const notifMessage = status === 'completed'
        ? `Your withdrawal of ${withdrawal.currency} ${withdrawal.amount.toFixed(2)} has been sent`
        : status === 'rejected'
        ? `Your withdrawal of ${withdrawal.currency} ${withdrawal.amount.toFixed(2)} was rejected${adminNote ? `: ${adminNote}` : ''}`
        : `Your withdrawal of ${withdrawal.currency} ${withdrawal.amount.toFixed(2)} is being processed`;

      await notificationService.create({
        recipientId: withdrawal.user._id.toString(),
        type: notifType,
        title: notifTitle,
        message: notifMessage,
        metadata: { withdrawalId: withdrawal._id.toString() },
      });

      // Send email based on status
      const withdrawalUser = await User.findById(withdrawal.user._id);
      if (withdrawalUser) {
        if (status === 'completed') {
          await emailService.sendWithdrawalCompleted(withdrawalUser, withdrawal);
        } else if (status === 'rejected') {
          await emailService.sendWithdrawalRejected(withdrawalUser, withdrawal);
        }
      }
    } catch (err) {
      logger.error('Failed to notify user about withdrawal', { error: err.message });
    }

    res.json({ message: `Withdrawal marked as ${status}`, withdrawal });
  } catch (error) {
    logger.error('Admin process withdrawal error', { error: error.message });
    res.status(500).json({ error: 'Failed to process withdrawal' });
  }
};

// ─── Stripe Webhook ────────────────────────────────────────────

const handleWebhook = async (req, res) => {
  let event;

  try {
    const signature = req.headers['stripe-signature'];
    event = stripeService.constructWebhookEvent(req.body, signature);
  } catch (err) {
    logger.error('Stripe webhook signature verification failed', { error: err.message });
    return res.status(400).json({ error: 'Webhook signature verification failed' });
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSuccess(event.data.object);
        break;
      case 'payment_intent.payment_failed':
        await handlePaymentFailure(event.data.object);
        break;
      default:
        logger.info(`Unhandled Stripe event: ${event.type}`);
    }
    res.json({ received: true });
  } catch (error) {
    logger.error('Stripe webhook processing error', { eventType: event?.type, error: error.message });
    res.json({ received: true }); // 200 to stop retries
  }
};

// ─── Webhook Handlers ──────────────────────────────────────────

async function handlePaymentSuccess(paymentIntent) {
  const { contractId, milestoneIndex } = paymentIntent.metadata;
  if (!contractId || milestoneIndex === undefined) return;

  const contract = await Contract.findById(contractId)
    .populate('creator', 'firstName lastName email')
    .populate('contributor', 'firstName lastName email');

  if (!contract) {
    logger.error('Payment success: contract not found', { contractId });
    return;
  }

  const index = parseInt(milestoneIndex);
  const milestone = contract.milestones[index];
  if (!milestone) return;

  // Idempotency: skip if already processed
  if (milestone.paymentStatus === 'succeeded') {
    logger.info('Duplicate webhook — milestone already paid', { contractId, milestoneIndex: index });
    return;
  }

  // Update milestone to paid
  milestone.status = 'paid';
  milestone.paidAt = new Date();
  milestone.paymentStatus = 'succeeded';
  milestone.paymentError = null;

  // Calculate payout (minus platform fee) and credit freelancer balance
  const payoutAmount = milestone.budget * (1 - contract.platformFee / 100);
  milestone.payoutAmount = payoutAmount;

  milestone.activityLog.push({
    action: 'payment_succeeded',
    by: 'system',
    message: `Payment of ${contract.currency} ${milestone.budget.toFixed(2)} completed — ${contract.currency} ${payoutAmount.toFixed(2)} credited to your balance`,
    timestamp: new Date(),
  });

  await contract.save();

  // ── Credit freelancer balance ──────────────────────────────
  if (contract.contributor?._id) {
    try {
      await User.findByIdAndUpdate(contract.contributor._id, {
        $inc: {
          balance: payoutAmount,
          totalEarnings: payoutAmount,
        },
      });
      logger.info('Freelancer balance credited', {
        userId: contract.contributor._id,
        amount: payoutAmount,
        contractId,
        milestoneIndex: index,
      });
    } catch (err) {
      logger.error('CRITICAL: Failed to credit freelancer balance', {
        error: err.message, userId: contract.contributor._id, amount: payoutAmount,
      });
    }
  }

  logger.info('Milestone payment successful', { contractId, milestoneIndex: index, amount: paymentIntent.amount / 100 });

  // ── Email + notification → CONTRIBUTOR (payment credited) ──
  try {
    await emailService.sendMilestonePaid(contract, milestone, index, {
      amount: milestone.budget,
      payout: payoutAmount,
      currency: contract.currency,
    });
    await notificationService.create({
      recipientId: contract.contributor._id.toString(),
      type: 'milestone_paid',
      title: 'Payment Credited!',
      message: `${contract.currency} ${payoutAmount.toFixed(2)} has been added to your balance for "${milestone.name}"`,
      contractId: contract._id.toString(),
      actionUrl: `/employer/contracts/${contract._id}`,
      metadata: { milestoneName: milestone.name, milestoneIndex: index, amount: milestone.budget, payout: payoutAmount },
    });
  } catch (err) {
    logger.error('Failed to send paid notification to contributor', { error: err.message });
  }

  // ── Email + notification → CREATOR (receipt) ───────────────
  try {
    await emailService.sendPaymentReceipt(contract, milestone, index, {
      amount: milestone.budget,
      fee: milestone.budget * (contract.platformFee / 100),
      currency: contract.currency,
    });
    await notificationService.create({
      recipientId: contract.creator._id.toString(),
      type: 'payment_receipt',
      title: 'Payment Processed',
      message: `${contract.currency} ${milestone.budget.toFixed(2)} paid for "${milestone.name}"`,
      contractId: contract._id.toString(),
      actionUrl: `/employer/contracts/${contract._id}`,
    });
  } catch (err) {
    logger.error('Failed to send receipt to creator', { error: err.message });
  }

  // ── Auto-complete contract if ALL milestones paid ──────────
  const allPaid = contract.milestones.every(m => m.status === 'paid');
  if (allPaid && contract.status === 'active') {
    contract.status = 'completed';
    contract.completedAt = new Date();
    await contract.save();
    try {
      await emailService.sendContractCompleted(contract);
      await notificationService.notifyContractCompleted(contract);
    } catch (err) {
      logger.error('Failed to send auto-complete notification', { error: err.message });
    }
  }
}

async function handlePaymentFailure(paymentIntent) {
  const { contractId, milestoneIndex } = paymentIntent.metadata;
  if (!contractId || milestoneIndex === undefined) return;

  const contract = await Contract.findById(contractId)
    .populate('creator', 'firstName lastName email')
    .populate('contributor', 'firstName lastName email');

  if (!contract) return;

  const index = parseInt(milestoneIndex);
  const milestone = contract.milestones[index];
  if (!milestone) return;

  const failureMessage = paymentIntent.last_payment_error?.message || 'Payment could not be processed';

  milestone.paymentStatus = 'failed';
  milestone.paymentFailedAt = new Date();
  milestone.paymentError = failureMessage;

  milestone.activityLog.push({
    action: 'payment_failed',
    by: 'system',
    message: `Payment failed: ${failureMessage}`,
    timestamp: new Date(),
  });

  await contract.save();

  logger.warn('Milestone payment failed', { contractId, milestoneIndex: index, failureMessage });

  // ── Email + notification → CREATOR (payment failed) ────────
  try {
    await emailService.sendPaymentFailed(contract, milestone, index, {
      errorMessage: failureMessage,
      paymentAttempts: milestone.paymentAttempts || 1,
    });
    await notificationService.create({
      recipientId: contract.creator._id.toString(),
      type: 'payment_failed',
      title: 'Payment Failed',
      message: `Payment for "${milestone.name}" failed: ${failureMessage}`,
      contractId: contract._id.toString(),
      actionUrl: `/employer/contracts/${contract._id}`,
      metadata: { milestoneName: milestone.name, errorMessage: failureMessage },
    });
  } catch (err) {
    logger.error('Failed to send payment failure notification', { error: err.message });
  }

  // ── Notification → CONTRIBUTOR (payment delay) ─────────────
  if (contract.contributor?._id) {
    try {
      await notificationService.create({
        recipientId: contract.contributor._id.toString(),
        type: 'payment_delayed',
        title: 'Payment Delayed',
        message: `Payment for "${milestone.name}" is delayed. The client has been notified.`,
        contractId: contract._id.toString(),
        actionUrl: `/employer/contracts/${contract._id}`,
      });
    } catch (err) {
      logger.error('Failed to send payment delay notification', { error: err.message });
    }
  }
}

module.exports = {
  createSetupIntent,
  listPaymentMethods,
  payMilestone,
  getMilestonePaymentStatus,
  getBalance,
  updateWithdrawalInfo,
  requestWithdrawal,
  getWithdrawals,
  adminGetWithdrawals,
  adminProcessWithdrawal,
  handleWebhook,
};
