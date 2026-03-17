const mongoose = require('mongoose');

/**
 * Assessment Model
 * A reusable assessment template created by an employer.
 * Supports two modes:
 *   - 'ai_chat'  → adaptive AI-generated Q&A (legacy)
 *   - 'coding'   → HackerRank-style coding challenges with test cases (new)
 */
const AssessmentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Assessment title is required'],
      maxlength: [200, 'Title cannot exceed 200 characters'],
      trim: true,
    },
    description: {
      type: String,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
      trim: true,
      default: '',
    },

    // ─── Assessment Type ───────────────────────────────────────
    assessmentType: {
      type: String,
      enum: {
        values: ['coding', 'ai_chat'],
        message: 'Assessment type must be coding or ai_chat',
      },
      default: 'coding',
      index: true,
    },

    // ─── Targeting ─────────────────────────────────────────────
    profession: {
      type: String,
      required: [true, 'Profession is required'],
      trim: true,
      index: true,
    },
    role: {
      type: String,
      trim: true,
      default: '',
    },
    skills: {
      type: [String],
      default: [],
      validate: {
        validator: v => v.length <= 30,
        message: 'Cannot have more than 30 skills',
      },
    },

    // ─── Configuration ─────────────────────────────────────────
    difficulty: {
      type: String,
      enum: {
        values: ['beginner', 'intermediate', 'advanced'],
        message: 'Difficulty must be beginner, intermediate, or advanced',
      },
      default: 'intermediate',
    },
    questionCount: {
      type: Number,
      min: [1, 'Minimum 1 question'],
      max: [20, 'Maximum 20 questions'],
      default: 5,
    },
    timeLimitMinutes: {
      type: Number,
      min: [5, 'Minimum 5 minutes'],
      max: [180, 'Maximum 180 minutes'],
      default: 60,
    },

    // ─── Questions (for coding assessments) ────────────────────
    questions: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question',
    }],

    // ─── Allowed Languages (for coding assessments) ────────────
    allowedLanguages: {
      type: [String],
      default: ['javascript', 'python', 'java', 'cpp'],
    },

    // ─── Sharing ───────────────────────────────────────────────
    inviteCode: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    isPublic: {
      type: Boolean,
      default: false,
    },

    // ─── Ownership ─────────────────────────────────────────────
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Created-by user is required'],
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes
AssessmentSchema.index({ createdBy: 1, isActive: 1 });
AssessmentSchema.index({ assessmentType: 1, isActive: 1 });
AssessmentSchema.index({ inviteCode: 1 });

module.exports = mongoose.model('Assessment', AssessmentSchema);
