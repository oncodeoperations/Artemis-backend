const Contract = require('../models/Contract');
const User = require('../models/User');
const emailService = require('../services/emailService');
const notificationService = require('../services/notificationService');
const stripeService = require('../services/stripeService');
const logger = require('../utils/logger');

/**
 * Get all contracts for current user
 * GET /api/contracts
 * Query params: ?status=active&role=creator&type=fixed
 */
const getAllContracts = async (req, res) => {
  try {
    const { status, role, type, page = 1, limit = 50 } = req.query;
    const userId = req.user._id;

    // Build query
    let query = {};

    // Filter by role (creator or contributor)
    // Include contributorEmail match for recipients not yet linked
    const userEmail = req.user.email;
    if (role === 'creator') {
      query.creator = userId;
    } else if (role === 'contributor') {
      query.$or = [
        { contributor: userId },
        { contributor: null, contributorEmail: userEmail }
      ];
    } else {
      // Return both created and contributed contracts
      query.$or = [
        { creator: userId },
        { contributor: userId },
        { contributor: null, contributorEmail: userEmail }
      ];
    }

    // Filter by status
    if (status) {
      query.status = status;
    }

    // Filter by contract type
    if (type) {
      query.contractType = type;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [contracts, total] = await Promise.all([
      Contract.find(query)
        .populate('creator', 'firstName lastName email role companyName')
        .populate('contributor', 'firstName lastName email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Contract.countDocuments(query),
    ]);

    res.status(200).json({
      contracts,
      count: contracts.length,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    logger.error('Get contracts error', { error: error.message });
    res.status(500).json({
      error: 'Failed to fetch contracts',
      message: 'An error occurred while retrieving contracts.'
    });
  }
};

/**
 * Get contract by ID
 * GET /api/contracts/:id
 */
const getContractById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const contract = await Contract.findById(id)
      .populate('creator', 'firstName lastName email role companyName')
      .populate('contributor', 'firstName lastName email role');

    if (!contract) {
      return res.status(404).json({
        error: 'Contract not found',
        message: 'The requested contract does not exist.'
      });
    }

    // Check if user is authorized to view contract
    const isCreator = contract.creator._id.equals(userId);
    const isContributor = contract.contributor && contract.contributor._id.equals(userId);
    const isRecipientByEmail = !contract.contributor && 
      contract.contributorEmail === req.user.email;

    if (!isCreator && !isContributor && !isRecipientByEmail) {
      return res.status(403).json({
        error: 'Unauthorized',
        message: 'You do not have permission to view this contract.'
      });
    }

    // Auto-link contributor if they're the intended recipient but not yet linked
    if (isRecipientByEmail) {
      contract.contributor = userId;
      await contract.save();
      await contract.populate('contributor', 'firstName lastName email role');
    }

    res.status(200).json({ contract });

  } catch (error) {
    logger.error('Get contract error', { error: error.message });
    res.status(500).json({
      error: 'Failed to fetch contract',
      message: 'An error occurred while retrieving the contract.'
    });
  }
};

/**
 * Create new contract
 * POST /api/contracts
 */
const createContract = async (req, res) => {
  try {
    const {
      contractName,
      contributorEmail,
      category,
      subcategory,
      description,
      contractType,
      budget,
      splitMilestones,
      milestones,
      hourlyRate,
      hoursPerWeek,
      weeklyLimit,
      currency,
      dueDate,
      platformFee,
      status: requestedStatus
    } = req.body;

    const isDraft = requestedStatus === 'draft';

    // Validate required fields — drafts only need contractName
    if (isDraft) {
      if (!contractName) {
        return res.status(400).json({
          error: 'Missing required fields',
          message: 'Please provide at least a contract name to save a draft.'
        });
      }
    } else {
      if (!contractName || !contributorEmail || !category || !description || !contractType) {
        return res.status(400).json({
          error: 'Missing required fields',
          message: 'Please provide contractName, contributorEmail, category, description, and contractType.'
        });
      }

      // Validate contract type specific fields
      if (contractType === 'fixed' && !budget) {
        return res.status(400).json({
          error: 'Missing budget',
          message: 'Budget is required for fixed-price contracts.'
        });
      }

      if (contractType === 'hourly' && !hourlyRate) {
        return res.status(400).json({
          error: 'Missing hourly rate',
          message: 'Hourly rate is required for hourly contracts.'
        });
      }
    }

    // Check if contributor exists
    const contributor = contributorEmail
      ? await User.findOne({ email: contributorEmail.toLowerCase() })
      : null;

    // Create contract
    const contract = new Contract({
      contractName,
      creator: req.user._id,
      contributor: contributor ? contributor._id : null,
      contributorEmail: contributorEmail ? contributorEmail.toLowerCase() : undefined,
      category: category || undefined,
      subcategory,
      description: description || undefined,
      contractType: contractType || 'fixed',
      budget: contractType === 'fixed' ? budget : undefined,
      splitMilestones: contractType === 'fixed' ? splitMilestones : false,
      milestones: contractType === 'fixed' && splitMilestones ? milestones : [],
      hourlyRate: contractType === 'hourly' ? hourlyRate : undefined,
      hoursPerWeek: contractType === 'hourly' ? hoursPerWeek : undefined,
      weeklyLimit: contractType === 'hourly' ? weeklyLimit : undefined,
      currency: currency || 'USD',
      dueDate,
      platformFee: platformFee || 3.6,
      status: isDraft ? 'draft' : 'pending'
    });

    await contract.save();

    // Populate creator and contributor
    await contract.populate('creator', 'firstName lastName email role companyName');
    if (contributor) {
      await contract.populate('contributor', 'firstName lastName email role');
    }

    res.status(201).json({
      message: isDraft ? 'Draft saved successfully' : 'Contract created successfully',
      contract
    });

    // Send invitation email only for non-draft contracts (fire-and-forget, don't block response)
    if (!isDraft) {
      try {
        const personalMessage = req.body.recipientMessage || null;
        await emailService.sendContractInvitation(contract, contract.creator, personalMessage);
        await notificationService.notifyContractInvitation(contract, contract.creator);
      } catch (emailError) {
        logger.error('Failed to send contract invitation email', { error: emailError.message });
      }
    }

  } catch (error) {
    logger.error('Create contract error', { error: error.message });

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        error: 'Validation error',
        message: Object.values(error.errors).map(err => err.message).join(', ')
      });
    }

    res.status(500).json({
      error: 'Failed to create contract',
      message: 'An error occurred while creating the contract.'
    });
  }
};

/**
 * Update contract
 * PUT /api/contracts/:id
 */
const updateContract = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const contract = await Contract.findById(id);

    if (!contract) {
      return res.status(404).json({
        error: 'Contract not found',
        message: 'The requested contract does not exist.'
      });
    }

    // Only creator can update contract
    if (!contract.creator.equals(userId)) {
      return res.status(403).json({
        error: 'Unauthorized',
        message: 'Only the contract creator can update the contract.'
      });
    }

    // Cannot update completed or archived contracts
    if (['completed', 'archived'].includes(contract.status)) {
      return res.status(400).json({
        error: 'Cannot update contract',
        message: 'Completed or archived contracts cannot be updated.'
      });
    }

    // Update allowed fields
    const allowedUpdates = [
      'contractName', 'description', 'category', 'subcategory', 
      'budget', 'hourlyRate', 'hoursPerWeek', 'weeklyLimit', 
      'dueDate', 'milestones', 'contributorEmail', 'contractType',
      'splitMilestones', 'currency', 'recipientMessage'
    ];

    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        contract[field] = req.body[field];
      }
    });

    // Allow status update only for draft contracts (draft → pending)
    if (req.body.status && contract.status === 'draft') {
      contract.status = req.body.status;
    }

    await contract.save();

    await contract.populate('creator', 'firstName lastName email role companyName');
    await contract.populate('contributor', 'firstName lastName email role');

    res.status(200).json({
      message: 'Contract updated successfully',
      contract
    });

  } catch (error) {
    logger.error('Update contract error', { error: error.message });

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        error: 'Validation error',
        message: Object.values(error.errors).map(err => err.message).join(', ')
      });
    }

    res.status(500).json({
      error: 'Failed to update contract',
      message: 'An error occurred while updating the contract.'
    });
  }
};

/**
 * Update contract status
 * PATCH /api/contracts/:id/status
 */
const updateContractStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, rejectionReason } = req.body;
    const userId = req.user._id;

    if (!status) {
      return res.status(400).json({
        error: 'Missing status',
        message: 'Please provide a status.'
      });
    }

    const contract = await Contract.findById(id);

    if (!contract) {
      return res.status(404).json({
        error: 'Contract not found',
        message: 'The requested contract does not exist.'
      });
    }

    // Check authorization based on status change
    const isCreator = contract.creator.equals(userId);
    let isContributor = contract.contributor && contract.contributor.equals(userId);
    const isRecipientByEmail = !contract.contributor &&
      contract.contributorEmail === req.user.email;

    // Auto-link contributor if they're the intended recipient but not yet linked
    if (isRecipientByEmail) {
      contract.contributor = userId;
      isContributor = true;
    }

    if (!isCreator && !isContributor) {
      return res.status(403).json({
        error: 'Unauthorized',
        message: 'You do not have permission to update this contract.'
      });
    }

    // Validate status transitions
    const validStatuses = ['draft', 'pending', 'active', 'completed', 'rejected', 'disputed', 'archived'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Invalid status',
        message: `Status must be one of: ${validStatuses.join(', ')}`
      });
    }

    // Update status
    contract.status = status;

    if (status === 'rejected' && rejectionReason) {
      contract.rejectionReason = rejectionReason;
    }

    if (status === 'completed') {
      contract.completedAt = new Date();
    }

    await contract.save();

    await contract.populate('creator', 'firstName lastName email role companyName');
    await contract.populate('contributor', 'firstName lastName email role');

    res.status(200).json({
      message: 'Contract status updated successfully',
      contract
    });

    // Send status change emails + in-app notifications (fire-and-forget)
    try {
      if (status === 'active' && contract.contributor) {
        await emailService.sendContractAccepted(contract, contract.contributor);
        await notificationService.notifyContractAccepted(contract, contract.contributor);
      } else if (status === 'rejected') {
        const rejector = isContributor && contract.contributor ? contract.contributor : contract.creator;
        await emailService.sendContractRejected(contract, rejector, rejectionReason);
        await notificationService.notifyContractRejected(contract, rejector, rejectionReason);
      } else if (status === 'completed') {
        await emailService.sendContractCompleted(contract);
        await notificationService.notifyContractCompleted(contract);
      }
    } catch (emailError) {
      logger.error('Failed to send contract status email', { error: emailError.message });
    }

  } catch (error) {
    logger.error('Update contract status error', { error: error.message });
    res.status(500).json({
      error: 'Failed to update contract status',
      message: 'An error occurred while updating the contract status.'
    });
  }
};

/**
 * Update milestone status
 * PATCH /api/contracts/:id/milestones/:milestoneIndex/status
 *
 * Complete lifecycle:
 *   pending → in-progress → submitted → [approved → paid] or [rejected → submitted → …]
 *
 * Body params:
 *   status             — required: the target status
 *   submissionDetails  — when submitting/resubmitting: description of the work
 *   message            — optional custom message included in emails
 *   feedback           — when rejecting: required feedback for the contributor
 */
const updateMilestoneStatus = async (req, res) => {
  try {
    const { id, milestoneIndex } = req.params;
    const { status, submissionDetails, feedback, message } = req.body;
    const userId = req.user._id;
    const userEmail = req.user.email?.toLowerCase();

    const contract = await Contract.findById(id);

    if (!contract) {
      return res.status(404).json({
        error: 'Contract not found',
        message: 'The requested contract does not exist.'
      });
    }

    // Contract must be active for milestone operations
    if (contract.status !== 'active') {
      return res.status(400).json({
        error: 'Contract not active',
        message: 'Milestones can only be updated on active contracts.'
      });
    }

    const index = parseInt(milestoneIndex);
    if (isNaN(index) || index < 0 || index >= contract.milestones.length) {
      return res.status(400).json({
        error: 'Invalid milestone index',
        message: 'The specified milestone does not exist.'
      });
    }

    const milestone = contract.milestones[index];
    const isCreator = contract.creator.equals(userId);
    const isContributor = (contract.contributor && contract.contributor.equals(userId))
      || (userEmail && contract.contributorEmail === userEmail);

    // Auto-link contributor if matched by email but ObjectId is not yet set
    if (isContributor && !contract.contributor) {
      contract.contributor = userId;
    }

    // ── Validate allowed status values ────────────────────────
    const allowedStatuses = ['submitted', 'in-progress', 'approved', 'rejected'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Invalid status',
        message: `Status must be one of: ${allowedStatuses.join(', ')}`
      });
    }

    // ── Validate permissions ──────────────────────────────────
    if ((status === 'submitted' || status === 'in-progress') && !isContributor) {
      return res.status(403).json({
        error: 'Unauthorized',
        message: 'Only the contributor can submit milestones.'
      });
    }

    if ((status === 'approved' || status === 'rejected') && !isCreator) {
      return res.status(403).json({
        error: 'Unauthorized',
        message: 'Only the creator can approve or request changes on milestones.'
      });
    }

    // ── Validate required feedback for rejection ─────────────
    if (status === 'rejected' && (!feedback || !feedback.trim())) {
      return res.status(400).json({
        error: 'Feedback required',
        message: 'You must provide feedback when requesting changes.'
      });
    }

    // ── Validate status transitions ──────────────────────────
    const validTransitions = {
      'pending':     ['in-progress', 'submitted'],
      'in-progress': ['submitted'],
      'submitted':   ['approved', 'rejected'],
      'approved':    [],            // terminal until payment
      'paid':        [],            // terminal
      'rejected':    ['in-progress', 'submitted'],  // contributor re-submits
    };

    const allowed = validTransitions[milestone.status] || [];
    if (!allowed.includes(status)) {
      return res.status(400).json({
        error: 'Invalid transition',
        message: `Cannot move milestone from "${milestone.status}" to "${status}".`
      });
    }

    // ── Apply update ─────────────────────────────────────────
    const previousStatus = milestone.status;
    milestone.status = status;

    if (status === 'submitted') {
      milestone.submittedAt = new Date();
      if (submissionDetails) {
        milestone.submissionDetails = submissionDetails;
      }

      // Determine if this is a first submission or a resubmission
      const isResubmission = previousStatus === 'rejected';
      const activityAction = isResubmission ? 'resubmitted' : 'submitted';

      milestone.activityLog.push({
        action: activityAction,
        by: 'contributor',
        message: message || submissionDetails || null,
        timestamp: new Date()
      });
    }

    if (status === 'in-progress') {
      // No activity log entry needed for in-progress
    }

    if (status === 'approved') {
      milestone.approvedAt = new Date();

      milestone.activityLog.push({
        action: 'approved',
        by: 'creator',
        message: message || feedback || null,
        timestamp: new Date()
      });
    }

    if (status === 'rejected') {
      milestone.revisionCount = (milestone.revisionCount || 0) + 1;

      milestone.activityLog.push({
        action: 'changes_requested',
        by: 'creator',
        message: feedback,
        timestamp: new Date()
      });
    }

    await contract.save();

    await contract.populate('creator', 'firstName lastName email role companyName stripeCustomerId');
    if (contract.contributor) {
      await contract.populate('contributor', 'firstName lastName email role');
    }

    // ── Auto-trigger payment on approval ─────────────────────
    let paymentResult = null;
    if (status === 'approved') {
      paymentResult = await attemptAutoPayment(contract, milestone, index, req.user);
    }

    // ── Check if all milestones are paid → auto-complete contract
    if (status === 'approved' || previousStatus === 'approved') {
      await checkAutoComplete(contract);
    }

    res.status(200).json({
      message: 'Milestone status updated successfully',
      contract,
      payment: paymentResult
    });

    // ── Send emails + notifications (fire-and-forget) ────────
    try {
      const isResubmission = previousStatus === 'rejected' && status === 'submitted';

      if (status === 'submitted') {
        await emailService.sendMilestoneSubmitted(contract, milestone, index, {
          customMessage: message || null,
          isResubmission,
          revisionCount: milestone.revisionCount || 0
        });
        await notificationService.notifyMilestoneSubmitted(contract, milestone, index, {
          isResubmission,
          customMessage: message || null
        });
      } else if (status === 'approved') {
        await emailService.sendMilestoneApproved(contract, milestone, index, {
          customMessage: message || feedback || null,
          paymentInitiated: !!paymentResult?.paymentIntentId
        });
        await notificationService.notifyMilestoneApproved(contract, milestone, index, {
          customMessage: message || feedback || null,
          paymentInitiated: !!paymentResult?.paymentIntentId
        });
      } else if (status === 'rejected') {
        await emailService.sendMilestoneRejected(contract, milestone, index, {
          feedback: feedback,
          revisionCount: milestone.revisionCount
        });
        await notificationService.notifyMilestoneRejected(contract, milestone, index, {
          feedback: feedback,
          revisionCount: milestone.revisionCount
        });
      }
    } catch (emailError) {
      logger.error('Failed to send milestone status email:', { error: emailError.message });
    }

  } catch (error) {
    logger.error('Update milestone status error:', { error: error.message, stack: error.stack });
    res.status(500).json({
      error: 'Failed to update milestone status',
      message: 'An error occurred while updating the milestone status.'
    });
  }
};

/**
 * Attempt to auto-pay a milestone after approval.
 * If the employer has a Stripe customer with a default payment method,
 * payment is initiated. The full amount goes to the platform.
 * Freelancer balance is credited via the webhook on payment success.
 */
async function attemptAutoPayment(contract, milestone, milestoneIndex, creatorUser) {
  try {
    // Check creator has a Stripe customer
    let creatorCustomerId = creatorUser.stripeCustomerId;
    if (!creatorCustomerId) {
      // Lazily create customer
      const customer = await stripeService.createCustomer(creatorUser);
      creatorUser.stripeCustomerId = customer.id;
      await creatorUser.save();
      creatorCustomerId = customer.id;
    }

    // Check creator has a saved payment method
    const methods = await stripeService.listPaymentMethods(creatorCustomerId);
    if (!methods || methods.length === 0) {
      return {
        paymentIntentId: null,
        status: 'no_payment_method',
        reason: 'No saved payment method. Please add a card to enable automatic payments.'
      };
    }

    // Use the first saved payment method
    const paymentMethodId = methods[0].id;

    // Calculate amounts
    const amountCents = Math.round(milestone.budget * 100);
    const feeCents = Math.round(amountCents * (contract.platformFee / 100));
    const payoutCents = amountCents - feeCents;

    // Create and auto-confirm payment (platform-direct, no destination)
    const paymentIntent = await stripeService.createMilestonePayment({
      amount: amountCents,
      currency: contract.currency,
      customerStripeId: creatorCustomerId,
      contractId: contract._id.toString(),
      milestoneIndex,
      milestoneName: milestone.name,
      platformFeePercent: contract.platformFee,
    });

    // Confirm with saved payment method
    await stripeService.stripe.paymentIntents.confirm(paymentIntent.id, {
      payment_method: paymentMethodId,
    });

    // Update milestone
    milestone.paymentIntentId = paymentIntent.id;
    milestone.payoutAmount = payoutCents / 100;
    milestone.paymentStatus = 'processing';
    milestone.paymentAttempts = (milestone.paymentAttempts || 0) + 1;

    milestone.activityLog.push({
      action: 'payment_initiated',
      by: 'system',
      message: `Payment of ${contract.currency} ${milestone.budget.toFixed(2)} initiated`,
      timestamp: new Date()
    });

    await contract.save();

    return {
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
      status: 'processing',
      amount: amountCents / 100,
      fee: feeCents / 100,
      payout: payoutCents / 100,
    };

  } catch (error) {
    logger.error('Auto-payment failed', { error: error.message, milestoneIndex });

    milestone.paymentStatus = 'failed';
    milestone.paymentFailedAt = new Date();
    milestone.paymentAttempts = (milestone.paymentAttempts || 0) + 1;
    milestone.paymentError = error.message;

    milestone.activityLog.push({
      action: 'payment_failed',
      by: 'system',
      message: `Automatic payment failed: ${error.message}`,
      timestamp: new Date()
    });

    await contract.save();

    return {
      paymentIntentId: null,
      status: 'failed',
      reason: error.message
    };
  }
}

/**
 * Check if all milestones are paid and auto-complete the contract
 */
async function checkAutoComplete(contract) {
  if (!contract.milestones || contract.milestones.length === 0) return;

  const allPaid = contract.milestones.every(m => m.status === 'paid');
  if (allPaid && contract.status === 'active') {
    contract.status = 'completed';
    contract.completedAt = new Date();
    await contract.save();

    // Fire-and-forget notifications
    try {
      await emailService.sendContractCompleted(contract);
      await notificationService.notifyContractCompleted(contract);
    } catch (err) {
      logger.error('Failed to send auto-complete notification', { error: err.message });
    }
  }
}

/**
 * Delete contract
 * DELETE /api/contracts/:id
 */
const deleteContract = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const contract = await Contract.findById(id);

    if (!contract) {
      return res.status(404).json({
        error: 'Contract not found',
        message: 'The requested contract does not exist.'
      });
    }

    // Only creator can delete, and only if in draft status
    if (!contract.creator.equals(userId)) {
      return res.status(403).json({
        error: 'Unauthorized',
        message: 'Only the contract creator can delete the contract.'
      });
    }

    if (contract.status !== 'draft') {
      return res.status(400).json({
        error: 'Cannot delete contract',
        message: 'Only draft contracts can be deleted. Archive active contracts instead.'
      });
    }

    await Contract.findByIdAndDelete(id);

    res.status(200).json({
      message: 'Contract deleted successfully'
    });

  } catch (error) {
    logger.error('Delete contract error', { error: error.message });
    res.status(500).json({
      error: 'Failed to delete contract',
      message: 'An error occurred while deleting the contract.'
    });
  }
};

module.exports = {
  getAllContracts,
  getContractById,
  createContract,
  updateContract,
  updateContractStatus,
  updateMilestoneStatus,
  deleteContract
};
