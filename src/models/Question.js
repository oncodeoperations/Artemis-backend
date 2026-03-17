const mongoose = require('mongoose');

/**
 * Test Case Schema (embedded in Question)
 * Each test case has an input and expected output for auto-grading.
 */
const TestCaseSchema = new mongoose.Schema(
  {
    input: {
      type: String,
      required: [true, 'Test case input is required'],
      maxlength: [10000, 'Input cannot exceed 10,000 characters'],
    },
    expectedOutput: {
      type: String,
      required: [true, 'Expected output is required'],
      maxlength: [10000, 'Expected output cannot exceed 10,000 characters'],
    },
    isHidden: {
      type: Boolean,
      default: false,
    },
    explanation: {
      type: String,
      maxlength: [500, 'Explanation cannot exceed 500 characters'],
      default: '',
    },
  },
  { _id: true }
);

/**
 * Starter Code Schema (per-language boilerplate)
 */
const StarterCodeSchema = new mongoose.Schema(
  {
    language: {
      type: String,
      required: true,
      trim: true,
    },
    languageId: {
      type: Number,
      required: true,
    },
    code: {
      type: String,
      required: true,
      maxlength: [5000, 'Starter code cannot exceed 5,000 characters'],
    },
  },
  { _id: false }
);

/**
 * MCQ Option Schema
 */
const MCQOptionSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: true,
      maxlength: [1000, 'Option text cannot exceed 1,000 characters'],
    },
    isCorrect: {
      type: Boolean,
      default: false,
    },
  },
  { _id: true }
);

/**
 * Question Model
 * A coding challenge, MCQ, or SQL problem that can be included in assessments.
 */
const QuestionSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Question title is required'],
      maxlength: [300, 'Title cannot exceed 300 characters'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Question description is required'],
      maxlength: [10000, 'Description cannot exceed 10,000 characters'],
    },
    type: {
      type: String,
      enum: {
        values: ['coding', 'mcq'],
        message: 'Type must be coding or mcq',
      },
      required: [true, 'Question type is required'],
      index: true,
    },

    // ─── Coding-specific ──────────────────────────────────────
    testCases: {
      type: [TestCaseSchema],
      default: [],
      validate: {
        validator: function (v) {
          if (this.type === 'coding') return v.length >= 1;
          return true;
        },
        message: 'Coding questions must have at least 1 test case',
      },
    },
    starterCode: {
      type: [StarterCodeSchema],
      default: [],
    },
    solutionCode: {
      type: String,
      maxlength: [10000, 'Solution code cannot exceed 10,000 characters'],
      default: '',
    },
    allowedLanguages: {
      type: [String],
      default: ['javascript', 'python', 'java', 'cpp'],
    },
    constraints: {
      type: String,
      maxlength: [2000, 'Constraints cannot exceed 2,000 characters'],
      default: '',
    },
    examples: {
      type: String,
      maxlength: [5000, 'Examples cannot exceed 5,000 characters'],
      default: '',
    },

    // ─── MCQ-specific ─────────────────────────────────────────
    options: {
      type: [MCQOptionSchema],
      default: [],
      validate: {
        validator: function (v) {
          if (this.type === 'mcq') return v.length >= 2;
          return true;
        },
        message: 'MCQ questions must have at least 2 options',
      },
    },

    // ─── Common fields ────────────────────────────────────────
    difficulty: {
      type: String,
      enum: {
        values: ['easy', 'medium', 'hard'],
        message: 'Difficulty must be easy, medium, or hard',
      },
      default: 'medium',
    },
    points: {
      type: Number,
      min: [1, 'Minimum 1 point'],
      max: [100, 'Maximum 100 points'],
      default: 10,
    },
    category: {
      type: String,
      trim: true,
      default: 'general',
      index: true,
    },
    tags: {
      type: [String],
      default: [],
    },
    timeLimitSeconds: {
      type: Number,
      min: [30, 'Minimum 30 seconds'],
      max: [7200, 'Maximum 2 hours'],
      default: 600, // 10 minutes per question
    },

    // ─── Ownership & Visibility ───────────────────────────────
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Created-by user is required'],
      index: true,
    },
    isPublic: {
      type: Boolean,
      default: false,
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

// Indexes
QuestionSchema.index({ type: 1, difficulty: 1, category: 1 });
QuestionSchema.index({ tags: 1 });
QuestionSchema.index({ createdBy: 1, isActive: 1 });
QuestionSchema.index({ isPublic: 1, isActive: 1, type: 1 });

module.exports = mongoose.model('Question', QuestionSchema);
