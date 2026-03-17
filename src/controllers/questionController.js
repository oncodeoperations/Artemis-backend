const Question = require('../models/Question');
const logger = require('../utils/logger');

/**
 * Question Controller
 * CRUD for coding challenges and MCQ questions used in assessments.
 */

// ─── Create Question ──────────────────────────────────────────
exports.createQuestion = async (req, res) => {
  try {
    const {
      title, description, type, difficulty, points, category, tags,
      testCases, starterCode, solutionCode, allowedLanguages, constraints, examples,
      options, timeLimitSeconds, isPublic,
    } = req.body;

    const question = await Question.create({
      title,
      description,
      type,
      difficulty,
      points,
      category,
      tags,
      testCases: testCases || [],
      starterCode: starterCode || [],
      solutionCode,
      allowedLanguages,
      constraints,
      examples,
      options: options || [],
      timeLimitSeconds,
      isPublic: isPublic || false,
      createdBy: req.user._id,
    });

    res.status(201).json({ question });
  } catch (error) {
    logger.error('createQuestion error', { error: error.message });
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to create question' });
  }
};

// ─── Get Questions (own + public library) ─────────────────────
exports.getQuestions = async (req, res) => {
  try {
    const { type, difficulty, category, tag, search, isPublic, page = 1, limit = 20 } = req.query;

    const filter = { isActive: true };

    // Show own questions + public library
    if (isPublic === 'true') {
      filter.isPublic = true;
    } else {
      filter.$or = [
        { createdBy: req.user._id },
        { isPublic: true },
      ];
    }

    if (type) filter.type = type;
    if (difficulty) filter.difficulty = difficulty;
    if (category) filter.category = category;
    if (tag) filter.tags = { $in: Array.isArray(tag) ? tag : [tag] };
    if (search) {
      filter.$text = { $search: search };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [questions, total] = await Promise.all([
      Question.find(filter)
        .select('-solutionCode -testCases.expectedOutput')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Question.countDocuments(filter),
    ]);

    res.json({
      questions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    logger.error('getQuestions error', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch questions' });
  }
};

// ─── Get Single Question ──────────────────────────────────────
exports.getQuestion = async (req, res) => {
  try {
    const question = await Question.findById(req.params.id).lean();

    if (!question || !question.isActive) {
      return res.status(404).json({ error: 'Question not found' });
    }

    // Only creator can see solution code and hidden test case outputs
    const isOwner = question.createdBy.toString() === req.user._id.toString();

    if (!isOwner) {
      delete question.solutionCode;
      question.testCases = question.testCases.filter(tc => !tc.isHidden).map(tc => ({
        ...tc,
        // Keep input/output visible for sample test cases
      }));
    }

    res.json({ question });
  } catch (error) {
    logger.error('getQuestion error', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch question' });
  }
};

// ─── Update Question ──────────────────────────────────────────
exports.updateQuestion = async (req, res) => {
  try {
    const question = await Question.findById(req.params.id);

    if (!question || !question.isActive) {
      return res.status(404).json({ error: 'Question not found' });
    }
    if (question.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not authorized to edit this question' });
    }

    const allowedFields = [
      'title', 'description', 'type', 'difficulty', 'points', 'category', 'tags',
      'testCases', 'starterCode', 'solutionCode', 'allowedLanguages', 'constraints',
      'examples', 'options', 'timeLimitSeconds', 'isPublic',
    ];

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        question[field] = req.body[field];
      }
    });

    await question.save();
    res.json({ question });
  } catch (error) {
    logger.error('updateQuestion error', { error: error.message });
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to update question' });
  }
};

// ─── Delete Question (soft delete) ────────────────────────────
exports.deleteQuestion = async (req, res) => {
  try {
    const question = await Question.findById(req.params.id);

    if (!question || !question.isActive) {
      return res.status(404).json({ error: 'Question not found' });
    }
    if (question.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Not authorized to delete this question' });
    }

    question.isActive = false;
    await question.save();

    res.json({ message: 'Question deleted' });
  } catch (error) {
    logger.error('deleteQuestion error', { error: error.message });
    res.status(500).json({ error: 'Failed to delete question' });
  }
};

// ─── Get Question Categories ──────────────────────────────────
exports.getCategories = async (_req, res) => {
  try {
    const categories = await Question.distinct('category', { isActive: true });
    res.json({ categories: categories.filter(Boolean).sort() });
  } catch (error) {
    logger.error('getCategories error', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
};
