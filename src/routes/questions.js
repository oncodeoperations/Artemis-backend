const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const questionController = require('../controllers/questionController');

/**
 * Question Routes
 * POST   /api/questions           — Create a question (BusinessOwner)
 * GET    /api/questions           — List questions (own + public library)
 * GET    /api/questions/categories — Get distinct categories
 * GET    /api/questions/:id       — Get single question
 * PUT    /api/questions/:id       — Update question (owner only)
 * DELETE /api/questions/:id       — Soft-delete question (owner only)
 */

// All routes require authentication
router.use(requireAuth);

// Create — only BusinessOwner
router.post('/', requireRole('BusinessOwner'), questionController.createQuestion);

// List — any authenticated user (shows own + public)
router.get('/', questionController.getQuestions);

// Categories — any authenticated user
router.get('/categories', questionController.getCategories);

// Get single question
router.get('/:id', questionController.getQuestion);

// Update — owner only (checked in controller)
router.put('/:id', requireRole('BusinessOwner'), questionController.updateQuestion);

// Delete — owner only (checked in controller)
router.delete('/:id', requireRole('BusinessOwner'), questionController.deleteQuestion);

module.exports = router;
