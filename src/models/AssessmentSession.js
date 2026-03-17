const mongoose = require('mongoose');

/**
 * AssessmentSession Model
 * Tracks a single assessment attempt.
 * Supports both AI-chat sessions and coding sessions with code submissions.
 */

// ─── AI Chat Messages (legacy) ─────────────────────────────────
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

// ─── Test Case Result (per test case execution) ────────────────
const TestCaseResultSchema = new mongoose.Schema(
  {
    testCaseId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    input: String,
    expectedOutput: String,
    actualOutput: String,
    passed: {
      type: Boolean,
      default: false,
    },
    isHidden: {
      type: Boolean,
      default: false,
    },
    executionTime: Number,    // ms
    memoryUsed: Number,       // KB
    error: String,            // compilation/runtime error
  },
  { _id: false }
);

// ─── Code Submission (per question) ────────────────────────────
const CodeSubmissionSchema = new mongoose.Schema(
  {
    question: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question',
      required: true,
    },
    code: {
      type: String,
      required: true,
      maxlength: [50000, 'Code cannot exceed 50,000 characters'],
    },
    language: {
      type: String,
      required: true,
    },
    languageId: {
      type: Number,
      required: true,
    },

    // Execution results
    testCaseResults: {
      type: [TestCaseResultSchema],
      default: [],
    },
    passedCount: {
      type: Number,
      default: 0,
    },
    totalCount: {
      type: Number,
      default: 0,
    },
    score: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },

    // Execution metadata
    stdout: String,
    stderr: String,
    compileOutput: String,
    statusDescription: String,  // e.g. "Accepted", "Wrong Answer", "Time Limit Exceeded"
    executionTime: Number,      // ms
    memoryUsed: Number,         // KB

    // AI code review (generated after submission)
    aiReview: {
      type: String,
      maxlength: [3000, 'AI review cannot exceed 3,000 characters'],
      default: '',
    },

    submittedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

// ─── MCQ Answer (per question) ─────────────────────────────────
const MCQAnswerSchema = new mongoose.Schema(
  {
    question: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question',
      required: true,
    },
    selectedOptionId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    isCorrect: {
      type: Boolean,
      default: false,
    },
    answeredAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

// ─── Anti-Cheat Log ────────────────────────────────────────────
const AntiCheatEventSchema = new mongoose.Schema(
  {
    event: {
      type: String,
      enum: ['tab_switch', 'blur', 'paste_attempt', 'copy_attempt', 'devtools', 'resize'],
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    details: String,
  },
  { _id: false }
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

    // ─── Session Type ─────────────────────────────────────────
    sessionType: {
      type: String,
      enum: ['coding', 'ai_chat'],
      default: 'coding',
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

    // ─── AI Chat fields (for ai_chat sessions) ────────────────
    messages: {
      type: [MessageSchema],
      default: [],
    },

    // ─── Coding fields (for coding sessions) ──────────────────
    submissions: {
      type: [CodeSubmissionSchema],
      default: [],
    },
    mcqAnswers: {
      type: [MCQAnswerSchema],
      default: [],
    },
    selectedLanguage: {
      type: String,
      default: 'javascript',
    },

    // ─── Progress Tracking ─────────────────────────────────────
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

    // ─── Anti-Cheat ───────────────────────────────────────────
    antiCheatEvents: {
      type: [AntiCheatEventSchema],
      default: [],
    },
    antiCheatScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 100,  // starts at 100 (trustworthy), decreases with violations
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
