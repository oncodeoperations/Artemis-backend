const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const codeExecutionController = require('../controllers/codeExecutionController');

/**
 * Code Execution Routes
 * POST /api/execute/run          — Run code with custom stdin (sandbox)
 * POST /api/execute/run-samples  — Run code against sample test cases
 * POST /api/execute/submit       — Submit code for full grading
 * GET  /api/execute/languages    — Get supported languages
 * GET  /api/execute/starter/:language — Get starter code
 * GET  /api/execute/health       — Judge0 health check
 */

// Run code (sandbox) — requires auth
router.post('/run', requireAuth, codeExecutionController.runCode);

// Run against sample test cases — requires auth
router.post('/run-samples', requireAuth, codeExecutionController.runAgainstSamples);

// Submit code for grading — requires auth
router.post('/submit', requireAuth, codeExecutionController.submitCode);

// Get supported languages — public
router.get('/languages', codeExecutionController.getLanguages);

// Get starter code for a language — public
router.get('/starter/:language', codeExecutionController.getStarterCode);

// Judge0 health check — public
router.get('/health', codeExecutionController.healthCheck);

module.exports = router;
