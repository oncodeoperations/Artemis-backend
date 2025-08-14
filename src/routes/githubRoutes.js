const express = require('express');
const githubController = require('../controllers/githubController');

const router = express.Router();

// POST /api/evaluate - Main endpoint to evaluate a GitHub developer
router.post('/evaluate', githubController.evaluateDeveloper);

// GET /api/status - Service status check
router.get('/status', (req, res) => {
  res.json({
    service: 'Developer Evaluator API',
    status: 'operational',
    version: '1.0.0',
    endpoints: {
      evaluate: 'POST /api/evaluate',
      status: 'GET /api/status'
    }
  });
});

module.exports = router;
