const Notification = require('../models/Notification');
const logger = require('../utils/logger');

/**
 * Notification Service
 * Handles creating, querying, and real-time delivery of in-app notifications.
 * Works alongside Socket.io — when a notification is created, it is both
 * persisted to MongoDB and pushed to the user's socket room.
 */
class NotificationService {
  constructor() {
    this.io = null; // Set by socketManager after init
  }

  /**
   * Attach the Socket.io server instance
   * Called once from socketManager.js
   */
  setIO(io) {
    this.io = io;
    logger.info('NotificationService: Socket.io instance attached');
  }

  // ──────────────────────────────────────────────
  // Core CRUD
  // ──────────────────────────────────────────────

  /**
   * Create a notification, persist it, and push via socket
   * @param {Object} data
   * @param {string} data.recipientId - MongoDB user _id
   * @param {string} data.type - Notification type enum
   * @param {string} data.title
   * @param {string} data.message
   * @param {string} [data.contractId]
   * @param {string} [data.assessmentId]
   * @param {string} [data.actorId]
   * @param {string} [data.actionUrl]
   * @param {Object} [data.metadata]
   * @returns {Object} Created notification document
   */
  async create({ recipientId, type, title, message, contractId, assessmentId, actorId, actionUrl, metadata }) {
    try {
      const notification = await Notification.create({
        recipient: recipientId,
        type,
        title,
        message,
        contract: contractId || null,
        assessment: assessmentId || null,
        actor: actorId || null,
        actionUrl: actionUrl || null,
        metadata: metadata || {},
      });

      // Populate actor for the real-time push
      await notification.populate('actor', 'firstName lastName profilePicture');

      // Push to user's socket room
      this._emitToUser(recipientId, 'notification:new', notification);

      logger.info(`Notification created: [${type}] for user ${recipientId}`);
      return notification;
    } catch (error) {
      logger.error('Failed to create notification', error);
      throw error;
    }
  }

  /**
   * Get paginated notifications for a user
   */
  async getForUser(userId, { page = 1, limit = 20, unreadOnly = false } = {}) {
    const query = { recipient: userId };
    if (unreadOnly) query.read = false;

    const [notifications, total] = await Promise.all([
      Notification.find(query)
        .populate('actor', 'firstName lastName profilePicture')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Notification.countDocuments(query),
    ]);

    return {
      notifications,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get unread count for a user
   */
  async getUnreadCount(userId) {
    return Notification.countDocuments({ recipient: userId, read: false });
  }

  /**
   * Mark a single notification as read
   */
  async markAsRead(notificationId, userId) {
    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, recipient: userId },
      { read: true, readAt: new Date() },
      { new: true }
    );

    if (notification) {
      // Push updated unread count
      const unreadCount = await this.getUnreadCount(userId);
      this._emitToUser(userId, 'notification:unreadCount', { count: unreadCount });
    }

    return notification;
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId) {
    const result = await Notification.updateMany(
      { recipient: userId, read: false },
      { read: true, readAt: new Date() }
    );

    if (result.modifiedCount > 0) {
      this._emitToUser(userId, 'notification:unreadCount', { count: 0 });
    }

    return result.modifiedCount;
  }

  /**
   * Delete a notification
   */
  async deleteNotification(notificationId, userId) {
    return Notification.findOneAndDelete({ _id: notificationId, recipient: userId });
  }

  // ──────────────────────────────────────────────
  // Contract lifecycle notification helpers
  // ──────────────────────────────────────────────

  /**
   * Notify recipient of a new contract invitation
   */
  async notifyContractInvitation(contract, creator) {
    // Find recipient user ID
    const recipientId = contract.contributor?._id || contract.contributor;
    if (!recipientId) return null; // Contributor not on platform yet

    return this.create({
      recipientId: recipientId.toString(),
      type: 'contract_invitation',
      title: 'New Contract Invitation',
      message: `${creator.firstName} ${creator.lastName} sent you a contract: "${contract.contractName}"`,
      contractId: contract._id.toString(),
      actorId: creator._id.toString(),
      actionUrl: `/contracts/${contract._id}/respond`,
      metadata: {
        contractName: contract.contractName,
        contractType: contract.contractType,
        budget: contract.budget,
        currency: contract.currency,
      },
    });
  }

  /**
   * Notify creator that contract was accepted
   */
  async notifyContractAccepted(contract, contributor) {
    const creatorId = contract.creator?._id || contract.creator;

    return this.create({
      recipientId: creatorId.toString(),
      type: 'contract_accepted',
      title: 'Contract Accepted',
      message: `${contributor.firstName} ${contributor.lastName} accepted "${contract.contractName}"`,
      contractId: contract._id.toString(),
      actorId: contributor._id.toString(),
      actionUrl: `/employer/contracts/${contract._id}`,
    });
  }

  /**
   * Notify creator that contract was rejected
   */
  async notifyContractRejected(contract, contributor, reason) {
    const creatorId = contract.creator?._id || contract.creator;

    return this.create({
      recipientId: creatorId.toString(),
      type: 'contract_rejected',
      title: 'Contract Declined',
      message: `${contributor.firstName} ${contributor.lastName} declined "${contract.contractName}"`,
      contractId: contract._id.toString(),
      actorId: contributor._id.toString(),
      actionUrl: `/employer/contracts/${contract._id}`,
      metadata: { reason },
    });
  }

  /**
   * Notify both parties when a contract is completed
   */
  async notifyContractCompleted(contract) {
    const creatorId = (contract.creator?._id || contract.creator).toString();
    const contributorId = (contract.contributor?._id || contract.contributor)?.toString();

    const promises = [
      this.create({
        recipientId: creatorId,
        type: 'contract_completed',
        title: 'Contract Completed',
        message: `"${contract.contractName}" has been marked as complete`,
        contractId: contract._id.toString(),
        actionUrl: `/employer/contracts/${contract._id}`,
      }),
    ];

    if (contributorId) {
      promises.push(
        this.create({
          recipientId: contributorId,
          type: 'contract_completed',
          title: 'Contract Completed',
          message: `"${contract.contractName}" has been marked as complete`,
          contractId: contract._id.toString(),
          actionUrl: `/employer/contracts/${contract._id}`,
        })
      );
    }

    return Promise.allSettled(promises);
  }

  /**
   * Notify employer that a milestone was submitted
   */
  async notifyMilestoneSubmitted(contract, milestone, milestoneIndex, options = {}) {
    const { isResubmission, customMessage } = options;
    const creatorId = (contract.creator?._id || contract.creator).toString();
    const contributorName = contract.contributor
      ? `${contract.contributor.firstName} ${contract.contributor.lastName}`
      : 'Contributor';

    const title = isResubmission ? 'Milestone Resubmitted' : 'Milestone Submitted';
    const verb = isResubmission ? 'resubmitted' : 'submitted';

    return this.create({
      recipientId: creatorId,
      type: 'milestone_submitted',
      title,
      message: `${contributorName} ${verb} "${milestone.name}" for review`,
      contractId: contract._id.toString(),
      actorId: (contract.contributor?._id || contract.contributor)?.toString(),
      actionUrl: `/employer/contracts/${contract._id}`,
      metadata: { milestoneName: milestone.name, milestoneIndex, isResubmission, customMessage },
    });
  }

  /**
   * Notify freelancer that a milestone was approved
   */
  async notifyMilestoneApproved(contract, milestone, milestoneIndex, options = {}) {
    const { customMessage, paymentInitiated } = options;
    const contributorId = (contract.contributor?._id || contract.contributor)?.toString();
    if (!contributorId) return null;

    const creatorName = contract.creator
      ? `${contract.creator.firstName} ${contract.creator.lastName}`
      : 'Employer';

    let msg = `${creatorName} approved "${milestone.name}"`;
    if (paymentInitiated) {
      msg += ' — payment is being processed';
    }

    return this.create({
      recipientId: contributorId,
      type: 'milestone_approved',
      title: 'Milestone Approved',
      message: msg,
      contractId: contract._id.toString(),
      actorId: (contract.creator?._id || contract.creator).toString(),
      actionUrl: `/employer/contracts/${contract._id}`,
      metadata: {
        milestoneName: milestone.name,
        milestoneIndex,
        amount: milestone.budget,
        currency: contract.currency,
        customMessage,
        paymentInitiated,
      },
    });
  }

  /**
   * Notify freelancer that a milestone was rejected
   */
  async notifyMilestoneRejected(contract, milestone, milestoneIndex, options = {}) {
    const { feedback, revisionCount } = options;
    const contributorId = (contract.contributor?._id || contract.contributor)?.toString();
    if (!contributorId) return null;

    const creatorName = contract.creator
      ? `${contract.creator.firstName} ${contract.creator.lastName}`
      : 'Employer';

    return this.create({
      recipientId: contributorId,
      type: 'milestone_rejected',
      title: 'Milestone Revision Requested',
      message: `${creatorName} requested revisions on "${milestone.name}"`,
      contractId: contract._id.toString(),
      actorId: (contract.creator?._id || contract.creator).toString(),
      actionUrl: `/employer/contracts/${contract._id}`,
      metadata: { milestoneName: milestone.name, milestoneIndex, reason: feedback, revisionCount },
    });
  }

  // ──────────────────────────────────────────────
  // Assessment notification helpers
  // ──────────────────────────────────────────────

  /**
   * Notify freelancer they've been invited to an assessment
   */
  async notifyAssessmentInvitation(assessment, invitation, employer) {
    const recipientId = invitation.freelancer;
    if (!recipientId) return null; // user may not exist yet (email-only invite)

    const employerName = `${employer.firstName || ''} ${employer.lastName || ''}`.trim() || 'An employer';
    return this.create({
      recipientId: recipientId.toString(),
      type: 'assessment_invitation',
      title: 'Assessment Invitation',
      message: `${employerName} invited you to take the "${assessment.title}" assessment.`,
      assessmentId: assessment._id.toString(),
      actorId: employer._id.toString(),
      actionUrl: `/assessment/invite/${invitation.inviteToken}`,
      metadata: { assessmentTitle: assessment.title, profession: assessment.profession },
    });
  }

  /**
   * Notify employer that a freelancer declined their assessment invitation
   */
  async notifyAssessmentDeclined(invitation, assessment, freelancer) {
    const recipientId = invitation.employer;
    if (!recipientId) return null;

    const freelancerName = `${freelancer.firstName || ''} ${freelancer.lastName || ''}`.trim() || freelancer.email;
    return this.create({
      recipientId: recipientId.toString(),
      type: 'assessment_declined',
      title: 'Assessment Declined',
      message: `${freelancerName} declined the "${assessment?.title || 'assessment'}" invitation.`,
      assessmentId: assessment?._id?.toString() || null,
      actorId: freelancer._id.toString(),
      actionUrl: '/employer/assessments',
      metadata: { freelancerEmail: freelancer.email },
    });
  }

  /**
   * Notify employer that a freelancer started their assessment session
   */
  async notifyAssessmentStarted(session, assessment, freelancer) {
    const recipientId = assessment.createdBy;
    if (!recipientId) return null;

    const freelancerName = `${freelancer.firstName || ''} ${freelancer.lastName || ''}`.trim() || freelancer.email;
    return this.create({
      recipientId: recipientId.toString(),
      type: 'assessment_started',
      title: 'Assessment Started',
      message: `${freelancerName} started the "${assessment.title}" assessment.`,
      assessmentId: assessment._id.toString(),
      actorId: freelancer._id.toString(),
      actionUrl: `/employer/assessments/${assessment._id}`,
      metadata: { sessionId: session._id.toString() },
    });
  }

  /**
   * Notify employer that a freelancer completed their assessment
   */
  async notifyAssessmentCompleted(session, assessment, freelancer) {
    const recipientId = assessment.createdBy;
    if (!recipientId) return null;

    const freelancerName = `${freelancer.firstName || ''} ${freelancer.lastName || ''}`.trim() || freelancer.email;
    return this.create({
      recipientId: recipientId.toString(),
      type: 'assessment_completed',
      title: 'Assessment Completed',
      message: `${freelancerName} scored ${session.score}/100 on "${assessment.title}".`,
      assessmentId: assessment._id.toString(),
      actorId: freelancer._id.toString(),
      actionUrl: `/employer/assessments/${assessment._id}`,
      metadata: { score: session.score, sessionId: session._id.toString() },
    });
  }

  /**
   * Broadcast a system announcement to multiple users
   */
  async broadcastAnnouncement({ title, message, recipientIds, actorId }) {
    const results = [];
    for (const rid of recipientIds) {
      try {
        const n = await this.create({
          recipientId: rid.toString(),
          type: 'system_announcement',
          title,
          message,
          actorId: actorId || null,
          actionUrl: null,
        });
        results.push(n);
      } catch (err) {
        logger.error(`Failed to send announcement to ${rid}`, err);
      }
    }
    return results;
  }

  // ──────────────────────────────────────────────
  // Socket helpers
  // ──────────────────────────────────────────────

  /**
   * Emit an event to a specific user's room
   * Room name = user's MongoDB _id as string
   */
  _emitToUser(userId, event, data) {
    if (!this.io) {
      logger.debug(`Socket not available — skipping emit [${event}] to ${userId}`);
      return;
    }
    this.io.to(userId.toString()).emit(event, data);
  }
}

// Singleton
const notificationService = new NotificationService();
module.exports = notificationService;
