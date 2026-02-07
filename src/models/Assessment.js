const mongoose = require('mongoose');

/**
 * Assessment Model
 * A reusable assessment template created by an employer.
 * Defines what profession / skills to test, difficulty, and time limits.
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
      min: [3, 'Minimum 3 questions'],
      max: [20, 'Maximum 20 questions'],
      default: 10,
    },
    timeLimitMinutes: {
      type: Number,
      min: [5, 'Minimum 5 minutes'],
      max: [120, 'Maximum 120 minutes'],
      default: 30,
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

// Compound index for fast employer lookups
AssessmentSchema.index({ createdBy: 1, isActive: 1 });

module.exports = mongoose.model('Assessment', AssessmentSchema);
