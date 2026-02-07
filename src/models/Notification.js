const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  // Who receives this notification
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },

  // Notification type
  type: {
    type: String,
    required: true,
    enum: [
      // Contract lifecycle
      'contract_invitation',
      'contract_accepted',
      'contract_rejected',
      'contract_completed',
      'contract_updated',

      // Milestone lifecycle
      'milestone_submitted',
      'milestone_approved',
      'milestone_rejected',

      // Payment lifecycle
      'milestone_paid',
      'payment_receipt',
      'payment_failed',
      'payment_delayed',

      // Withdrawals
      'withdrawal_requested',
      'withdrawal_processing',
      'withdrawal_completed',
      'withdrawal_rejected',

      // Assessments
      'assessment_invitation',
      'assessment_declined',
      'assessment_started',
      'assessment_completed',

      // System
      'system_announcement',
    ],
  },

  // Human-readable title
  title: {
    type: String,
    required: true,
    maxlength: 200,
  },

  // Short description / body text
  message: {
    type: String,
    required: true,
    maxlength: 500,
  },

  // Related entities
  contract: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contract',
    default: null,
  },

  assessment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Assessment',
    default: null,
  },

  // Who triggered the notification (null for system)
  actor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },

  // Deep link path (frontend route)
  actionUrl: {
    type: String,
    default: null,
  },

  // Read state
  read: {
    type: Boolean,
    default: false,
    index: true,
  },

  readAt: {
    type: Date,
    default: null,
  },

  // Optional metadata (milestone index, amounts, etc.)
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
}, {
  timestamps: true,
});

// Compound index for efficient queries: "unread notifications for user X, newest first"
notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });

// TTL index: auto-delete notifications older than 90 days
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = mongoose.model('Notification', notificationSchema);
