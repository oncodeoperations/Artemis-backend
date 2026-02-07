const express = require('express');
const githubController = require('../controllers/githubController');
const { requireAuth, requireVerification } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { evaluateDeveloperBody } = require('../schemas/github');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: GitHub
 *   description: Developer evaluation via GitHub profile analysis
 */

/**
 * @swagger
 * /api/evaluate:
 *   post:
 *     summary: Evaluate a developer based on their GitHub profile
 *     tags: [GitHub]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               githubUrl: { type: string, format: uri, description: GitHub profile URL }
 *               github_url: { type: string, format: uri, description: Alias for githubUrl }
 *               submitToLeaderboard: { type: boolean }
 *     responses:
 *       200:
 *         description: Evaluation results with scores, summary, and breakdown
 *       400:
 *         description: Missing or invalid GitHub URL
 *       429:
 *         description: Rate limit exceeded
 */
router.post('/evaluate', requireAuth, requireVerification, validate({ body: evaluateDeveloperBody }), (req, res) => githubController.evaluateDeveloper(req, res));

/**
 * @swagger
 * /api/status:
 *   get:
 *     summary: Service status check
 *     tags: [GitHub]
 *     security: []
 *     responses:
 *       200:
 *         description: Service operational
 */
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
