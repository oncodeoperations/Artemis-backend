const mongoose = require('mongoose');

/**
 * AssessmentSession Model
 * Tracks a single assessment attempt: every message, timing, and the final score.
 */

const MessageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ['ai', 'user'],
      required: true,
    },
    content: {
      type: String,
      required: true,
      maxlength: [10000, 'Message cannot exceed 10 000 characters'],
    },
    // For AI messages — which question number this corresponds to (1-indexed)
    questionIndex: {
      type: Number,
      default: null,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const AssessmentSessionSchema = new mongoose.Schema(
  {
    invitation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AssessmentInvitation',
      required: [true, 'Invitation reference is required'],
      index: true,
    },
    assessment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assessment',
      required: [true, 'Assessment reference is required'],
      index: true,
    },
    freelancer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Freelancer reference is required'],
      index: true,
    },

    // ─── Status & Timing ──────────────────────────────────────
    status: {
      type: String,
      enum: {
        values: ['in_progress', 'completed', 'timed_out', 'abandoned'],
        message: 'Status must be in_progress, completed, timed_out, or abandoned',
      },
      default: 'in_progress',
      index: true,
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    timeSpentSeconds: {
      type: Number,
      default: 0,
    },

    // ─── Conversation ─────────────────────────────────────────
    messages: {
      type: [MessageSchema],
      default: [],
    },
    currentQuestionIndex: {
      type: Number,
      default: 0,
    },
    totalQuestions: {
      type: Number,
      required: true,
    },

    // ─── Results (populated on completion) ────────────────────
    score: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },
    breakdown: {
      // Category → score  (e.g., { "Problem Solving": 85, "Communication": 70 })
      type: Map,
      of: Number,
      default: {},
    },
    aiSummary: {
      type: String,
      maxlength: [5000, 'AI summary cannot exceed 5000 characters'],
      default: '',
    },
    strengths: {
      type: [String],
      default: [],
    },
    weaknesses: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes
AssessmentSessionSchema.index({ freelancer: 1, status: 1 });
AssessmentSessionSchema.index({ assessment: 1, status: 1 });

module.exports = mongoose.model('AssessmentSession', AssessmentSessionSchema);
