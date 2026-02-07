const mongoose = require('mongoose');
const crypto = require('crypto');

/**
 * AssessmentInvitation Model
 * An employer sends an invitation for a freelancer to take an assessment.
 * The invite can be sent to an existing user or via email (auto-creates account on signup).
 */
const AssessmentInvitationSchema = new mongoose.Schema(
  {
    assessment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assessment',
      required: [true, 'Assessment reference is required'],
      index: true,
    },
    employer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Employer reference is required'],
      index: true,
    },

    // Freelancer — may be null if invited by email before signup
    freelancer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    freelancerEmail: {
      type: String,
      required: [true, 'Freelancer email is required'],
      trim: true,
      lowercase: true,
    },

    status: {
      type: String,
      enum: {
        values: ['pending', 'accepted', 'completed', 'expired', 'declined'],
        message: 'Status must be pending, accepted, completed, expired, or declined',
      },
      default: 'pending',
      index: true,
    },

    // Unique token used in the invite link
    inviteToken: {
      type: String,
      unique: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: [true, 'Expiration date is required'],
      index: true,
    },

    // Optional message from employer
    message: {
      type: String,
      maxlength: [1000, 'Message cannot exceed 1000 characters'],
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Generate a secure invite token before first save
AssessmentInvitationSchema.pre('validate', function (next) {
  if (!this.inviteToken) {
    this.inviteToken = crypto.randomBytes(32).toString('hex');
  }
  next();
});

// Virtual — check expiration
AssessmentInvitationSchema.virtual('isExpired').get(function () {
  return this.expiresAt < new Date();
});

// Compound indexes for common queries
AssessmentInvitationSchema.index({ freelancerEmail: 1, status: 1 });
AssessmentInvitationSchema.index({ employer: 1, status: 1 });

module.exports = mongoose.model('AssessmentInvitation', AssessmentInvitationSchema);
