const express = require('express');
const router = express.Router();
const codeController = require('../controllers/codeController');
const { requireAuth, requireVerification } = require('../middleware/auth');

// POST /api/execute-code - Execute code (CRITICAL: requires auth + verification)
router.post('/execute-code', requireAuth, requireVerification, codeController.executeCode);

module.exports = router;
