const nodemailer = require('nodemailer');
const logger = require('../utils/logger');
const { buildEmailTemplate } = require('../utils/emailTemplateBuilder');

/**
 * Email Service
 * Handles all transactional email sending via Nodemailer + SMTP (Amazon SES or other relay)
 */
class EmailService {
  constructor() {
    this.transporter = null;
    this.fromEmail = process.env.SMTP_FROM_EMAIL || 'noreply@escon.app';
    this.fromName = process.env.SMTP_FROM_NAME || 'Escon';
    this.frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    this.isConfigured = false;
  }

  /**
   * Initialize the SMTP transporter
   * Call this once on server startup
   */
  initialize() {
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || '587');
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !user || !pass) {
      logger.warn('Email service not configured — SMTP_HOST, SMTP_USER, or SMTP_PASS missing. Emails will be logged only.');
      this.isConfigured = false;
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      rateLimit: 14, // SES default: 14 emails/sec
    });

    this.isConfigured = true;
    logger.info(`Email service initialized — SMTP host: ${host}`);
  }

  /**
   * Verify SMTP connection (call after initialize)
   */
  async verify() {
    if (!this.isConfigured) return false;
    try {
      await this.transporter.verify();
      logger.info('SMTP connection verified successfully');
      return true;
    } catch (error) {
      logger.error('SMTP connection verification failed', error);
      this.isConfigured = false;
      return false;
    }
  }

  /**
   * Send an email
   * @param {Object} options
   * @param {string} options.to - Recipient email
   * @param {string} options.subject - Email subject
   * @param {string} options.html - HTML body
   * @param {string} [options.text] - Plain text fallback
   * @returns {Object} { success, messageId } or { success: false, error }
   */
  async send({ to, subject, html, text }) {
    const mailOptions = {
      from: `"${this.fromName}" <${this.fromEmail}>`,
      to,
      subject,
      html,
      text: text || this._stripHtml(html),
    };

    if (!this.isConfigured) {
      logger.info(`[EMAIL-DEV] Would send to: ${to} | Subject: ${subject}`);
      logger.debug(`[EMAIL-DEV] Body preview: ${(text || '').substring(0, 200)}`);
      return { success: true, messageId: `dev-${Date.now()}`, dev: true };
    }

    try {
      const info = await this.transporter.sendMail(mailOptions);
      logger.info(`Email sent to ${to} — MessageID: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      logger.error(`Failed to send email to ${to}`, error);
      return { success: false, error: error.message };
    }
  }

  // ──────────────────────────────────────────────
  // Contract lifecycle emails
  // ──────────────────────────────────────────────

  /**
   * Send contract invitation email to the recipient
   * @param {Object} contract - Populated contract document
   * @param {Object} creator - Creator user object
   * @param {string} [personalMessage] - Optional message from sender
   */
  async sendContractInvitation(contract, creator, personalMessage) {
    // Determine the recipient's intended role (opposite of creator's role)
    const recipientRole = creator.role === 'BusinessOwner' ? 'Freelancer' : 'BusinessOwner';
    const viewUrl = `${this.frontendUrl}/contracts/${contract._id}/respond?recipientRole=${recipientRole}`;
    const amount = this._formatAmount(contract);

    const html = buildEmailTemplate('contractInvitation', {
      recipientEmail: contract.contributorEmail,
      senderName: `${creator.firstName} ${creator.lastName}`,
      senderCompany: creator.companyName || null,
      contractName: contract.contractName,
      description: contract.description,
      category: contract.category,
      subcategory: contract.subcategory,
      contractType: contract.contractType === 'fixed' ? 'Fixed Price' : 'Hourly Rate',
      amount,
      currency: contract.currency,
      personalMessage: personalMessage || null,
      actionUrl: viewUrl,
      actionText: 'View Contract',
    });

    return this.send({
      to: contract.contributorEmail,
      subject: `📄 New contract from ${creator.firstName}: "${contract.contractName}"`,
      html,
    });
  }

  /**
   * Notify creator that the recipient accepted
   */
  async sendContractAccepted(contract, contributor) {
    const viewUrl = `${this.frontendUrl}/employer/contracts/${contract._id}`;

    const html = buildEmailTemplate('contractAccepted', {
      recipientName: contract.creator.firstName || 'there',
      contributorName: `${contributor.firstName} ${contributor.lastName}`,
      contractName: contract.contractName,
      actionUrl: viewUrl,
      actionText: 'View Contract',
    });

    return this.send({
      to: contract.creator.email,
      subject: `✅ Contract accepted: "${contract.contractName}"`,
      html,
    });
  }

  /**
   * Notify creator that the recipient declined
   */
  async sendContractRejected(contract, contributor, reason) {
    const viewUrl = `${this.frontendUrl}/employer/contracts/${contract._id}`;

    const html = buildEmailTemplate('contractRejected', {
      recipientName: contract.creator.firstName || 'there',
      contributorName: `${contributor.firstName} ${contributor.lastName}`,
      contractName: contract.contractName,
      reason: reason || 'No reason provided',
      actionUrl: viewUrl,
      actionText: 'View Contract',
    });

    return this.send({
      to: contract.creator.email,
      subject: `❌ Contract declined: "${contract.contractName}"`,
      html,
    });
  }

  /**
   * Notify employer that a milestone was submitted for review
   */
  async sendMilestoneSubmitted(contract, milestone, milestoneIndex, options = {}) {
    const { customMessage, isResubmission, revisionCount } = options;
    const viewUrl = `${this.frontendUrl}/employer/contracts/${contract._id}`;
    const contributorName = contract.contributor
      ? `${contract.contributor.firstName} ${contract.contributor.lastName}`
      : contract.contributorEmail;

    const html = buildEmailTemplate('milestoneSubmitted', {
      recipientName: contract.creator.firstName || 'there',
      contractName: contract.contractName,
      milestoneName: milestone.name,
      milestoneNumber: milestoneIndex + 1,
      milestoneIndex: milestoneIndex + 1,
      totalMilestones: contract.milestones.length,
      milestoneAmount: `${contract.currency} ${milestone.budget?.toFixed(2) || '0.00'}`,
      submissionDetails: milestone.submissionDetails || '',
      contributorName,
      customMessage: customMessage || null,
      isResubmission: isResubmission || false,
      revisionCount: revisionCount || 0,
      actionUrl: viewUrl,
      actionText: isResubmission ? 'Review Resubmission' : 'Review Milestone',
    });

    const subjectPrefix = isResubmission ? '🔄 Milestone resubmitted' : '📋 Milestone submitted';
    return this.send({
      to: contract.creator.email,
      subject: `${subjectPrefix}: "${milestone.name}" — ${contract.contractName}`,
      html,
    });
  }

  /**
   * Notify freelancer that a milestone was approved
   */
  async sendMilestoneApproved(contract, milestone, milestoneIndex, options = {}) {
    const { customMessage, paymentInitiated } = options;
    const viewUrl = `${this.frontendUrl}/employer/contracts/${contract._id}`;
    const creatorName = contract.creator
      ? `${contract.creator.firstName} ${contract.creator.lastName}`
      : 'Employer';

    const html = buildEmailTemplate('milestoneApproved', {
      recipientName: contract.contributor?.firstName || 'there',
      contractName: contract.contractName,
      milestoneName: milestone.name,
      milestoneNumber: milestoneIndex + 1,
      milestoneIndex: milestoneIndex + 1,
      totalMilestones: contract.milestones.length,
      amount: `${contract.currency} ${milestone.budget?.toFixed(2) || '0.00'}`,
      creatorName,
      customMessage: customMessage || null,
      paymentInitiated: paymentInitiated || false,
      hasNextMilestone: milestoneIndex < contract.milestones.length - 1,
      actionUrl: viewUrl,
      actionText: 'View Contract',
    });

    return this.send({
      to: contract.contributorEmail,
      subject: `✅ Milestone approved: "${milestone.name}" — ${contract.contractName}`,
      html,
    });
  }

  /**
   * Notify freelancer that a milestone was rejected (changes requested)
   */
  async sendMilestoneRejected(contract, milestone, milestoneIndex, options = {}) {
    const { feedback, revisionCount } = options;
    const viewUrl = `${this.frontendUrl}/employer/contracts/${contract._id}`;
    const creatorName = contract.creator
      ? `${contract.creator.firstName} ${contract.creator.lastName}`
      : 'Employer';

    const html = buildEmailTemplate('milestoneRejected', {
      recipientName: contract.contributor?.firstName || 'there',
      contractName: contract.contractName,
      milestoneName: milestone.name,
      milestoneNumber: milestoneIndex + 1,
      milestoneIndex: milestoneIndex + 1,
      totalMilestones: contract.milestones.length,
      milestoneAmount: `${contract.currency} ${milestone.budget?.toFixed(2) || '0.00'}`,
      reason: feedback || 'No reason provided',
      creatorName,
      revisionCount: revisionCount || 0,
      actionUrl: viewUrl,
      actionText: 'View & Resubmit',
    });

    return this.send({
      to: contract.contributorEmail,
      subject: `🔄 Changes requested: "${milestone.name}" — ${contract.contractName}`,
      html,
    });
  }

  /**
   * Notify contributor that a milestone payment was received
   */
  async sendMilestonePaid(contract, milestone, milestoneIndex, paymentInfo = {}) {
    const { amount, payout, currency } = paymentInfo;
    const viewUrl = `${this.frontendUrl}/employer/contracts/${contract._id}`;
    const creatorName = contract.creator
      ? `${contract.creator.firstName} ${contract.creator.lastName}`
      : 'Employer';

    const html = buildEmailTemplate('milestonePaid', {
      recipientName: contract.contributor?.firstName || 'there',
      contractName: contract.contractName,
      milestoneName: milestone.name,
      milestoneNumber: milestoneIndex + 1,
      amount: `${currency} ${amount?.toFixed(2) || '0.00'}`,
      payout: `${currency} ${payout?.toFixed(2) || '0.00'}`,
      currency: currency || contract.currency,
      creatorName,
      actionUrl: viewUrl,
      actionText: 'View Contract',
    });

    return this.send({
      to: contract.contributorEmail,
      subject: `💰 Payment received: "${milestone.name}" — ${contract.contractName}`,
      html,
    });
  }

  /**
   * Send payment receipt to creator (employer)
   */
  async sendPaymentReceipt(contract, milestone, milestoneIndex, paymentInfo = {}) {
    const { amount, fee, currency } = paymentInfo;
    const viewUrl = `${this.frontendUrl}/employer/contracts/${contract._id}`;
    const contributorName = contract.contributor
      ? `${contract.contributor.firstName} ${contract.contributor.lastName}`
      : contract.contributorEmail;

    const html = buildEmailTemplate('paymentReceipt', {
      recipientName: contract.creator?.firstName || 'there',
      contractName: contract.contractName,
      milestoneName: milestone.name,
      milestoneNumber: milestoneIndex + 1,
      amount: `${currency} ${amount?.toFixed(2) || '0.00'}`,
      fee: `${currency} ${fee?.toFixed(2) || '0.00'}`,
      total: `${currency} ${amount?.toFixed(2) || '0.00'}`,
      currency: currency || contract.currency,
      contributorName,
      actionUrl: viewUrl,
      actionText: 'View Contract',
    });

    return this.send({
      to: contract.creator.email,
      subject: `🧾 Payment receipt: "${milestone.name}" — ${contract.contractName}`,
      html,
    });
  }

  /**
   * Notify creator that a milestone payment failed
   */
  async sendPaymentFailed(contract, milestone, milestoneIndex, paymentInfo = {}) {
    const { errorMessage, paymentAttempts } = paymentInfo;
    const viewUrl = `${this.frontendUrl}/employer/contracts/${contract._id}`;

    const html = buildEmailTemplate('paymentFailed', {
      recipientName: contract.creator?.firstName || 'there',
      contractName: contract.contractName,
      milestoneName: milestone.name,
      milestoneNumber: milestoneIndex + 1,
      amount: `${contract.currency} ${milestone.budget?.toFixed(2) || '0.00'}`,
      errorMessage: errorMessage || 'An unknown error occurred',
      paymentAttempts: paymentAttempts || 1,
      actionUrl: viewUrl,
      actionText: 'Retry Payment',
    });

    return this.send({
      to: contract.creator.email,
      subject: `⚠️ Payment failed: "${milestone.name}" — ${contract.contractName}`,
      html,
    });
  }

  /**
   * Notify both parties that the contract is complete
   */
  async sendContractCompleted(contract) {
    const creatorUrl = `${this.frontendUrl}/employer/contracts/${contract._id}`;
    const contributorUrl = `${this.frontendUrl}/employer/contracts/${contract._id}`;

    const creatorHtml = buildEmailTemplate('contractCompleted', {
      recipientName: contract.creator.firstName || 'there',
      contractName: contract.contractName,
      otherPartyName: contract.contributor?.firstName || contract.contributorEmail,
      role: 'employer',
      actionUrl: creatorUrl,
      actionText: 'View Contract',
    });

    const contributorHtml = buildEmailTemplate('contractCompleted', {
      recipientName: contract.contributor?.firstName || 'there',
      contractName: contract.contractName,
      otherPartyName: `${contract.creator.firstName} ${contract.creator.lastName}`,
      role: 'freelancer',
      actionUrl: contributorUrl,
      actionText: 'View Contract',
    });

    const results = await Promise.allSettled([
      this.send({
        to: contract.creator.email,
        subject: `🎉 Contract completed: "${contract.contractName}"`,
        html: creatorHtml,
      }),
      this.send({
        to: contract.contributorEmail,
        subject: `🎉 Contract completed: "${contract.contractName}"`,
        html: contributorHtml,
      }),
    ]);

    return results.map((r, i) =>
      r.status === 'fulfilled' ? r.value : { success: false, error: r.reason?.message, party: i === 0 ? 'creator' : 'contributor' }
    );
  }

  // ──────────────────────────────────────────────
  // Withdrawal Emails
  // ──────────────────────────────────────────────

  async sendWithdrawalRequested(user, withdrawal) {
    const html = buildEmailTemplate('withdrawalRequested', {
      recipientName: user.firstName || 'there',
      amount: `${withdrawal.currency} ${withdrawal.amount.toFixed(2)}`,
      remainingBalance: `${withdrawal.currency} ${(user.balance || 0).toFixed(2)}`,
      bankName: withdrawal.withdrawalInfo?.bankName || 'N/A',
      accountLast4: (withdrawal.withdrawalInfo?.accountNumber || '').slice(-4),
      actionUrl: `${this.frontendUrl}/freelancer/withdrawals`,
      actionText: 'View Withdrawals',
    });

    return this.send({
      to: user.email,
      subject: `Withdrawal request received — ${withdrawal.currency} ${withdrawal.amount.toFixed(2)}`,
      html,
    });
  }

  async sendWithdrawalCompleted(user, withdrawal) {
    const html = buildEmailTemplate('withdrawalCompleted', {
      recipientName: user.firstName || 'there',
      amount: `${withdrawal.currency} ${withdrawal.amount.toFixed(2)}`,
      currency: withdrawal.currency,
      bankName: withdrawal.withdrawalInfo?.bankName || 'N/A',
      accountLast4: (withdrawal.withdrawalInfo?.accountNumber || '').slice(-4),
      adminNote: withdrawal.adminNote || '',
      actionUrl: `${this.frontendUrl}/freelancer/withdrawals`,
      actionText: 'View Withdrawals',
    });

    return this.send({
      to: user.email,
      subject: `💸 Withdrawal sent — ${withdrawal.currency} ${withdrawal.amount.toFixed(2)}`,
      html,
    });
  }

  async sendWithdrawalRejected(user, withdrawal) {
    const html = buildEmailTemplate('withdrawalRejected', {
      recipientName: user.firstName || 'there',
      amount: `${withdrawal.currency} ${withdrawal.amount.toFixed(2)}`,
      adminNote: withdrawal.adminNote || '',
      actionUrl: `${this.frontendUrl}/freelancer/withdrawals`,
      actionText: 'View Withdrawals',
    });

    return this.send({
      to: user.email,
      subject: `Withdrawal rejected — ${withdrawal.currency} ${withdrawal.amount.toFixed(2)}`,
      html,
    });
  }

  // ──────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────

  _formatAmount(contract) {
    if (contract.contractType === 'fixed') {
      return `${contract.currency} ${(contract.budget || 0).toFixed(2)}`;
    }
    return `${contract.currency} ${(contract.hourlyRate || 0).toFixed(2)}/hr`;
  }

  _stripHtml(html) {
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }
}

// Singleton
const emailService = new EmailService();
module.exports = emailService;
