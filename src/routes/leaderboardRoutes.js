const express = require('express');
const router = express.Router();
const leaderboardService = require('../services/leaderboardService');
const logger = require('../utils/logger');
const { requireAuth, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { leaderboardQuery, leaderboardUsernameParam } = require('../schemas/leaderboard');

/**
 * @swagger
 * tags:
 *   name: Leaderboard
 *   description: Developer leaderboard rankings
 */

/**
 * @swagger
 * /api/leaderboard:
 *   get:
 *     summary: Get top developers with optional filters
 *     tags: [Leaderboard]
 *     security: []
 *     parameters:
 *       - in: query
 *         name: country
 *         schema: { type: string }
 *       - in: query
 *         name: level
 *         schema: { type: string }
 *       - in: query
 *         name: language
 *         schema: { type: string }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, maximum: 100 }
 *     responses:
 *       200:
 *         description: Leaderboard entries
 */
router.get('/', validate({ query: leaderboardQuery }), async (req, res) => {
  try {
    const filters = {
      country: req.query.country,
      level: req.query.level,
      language: req.query.language,
      limit: req.query.limit
    };
    
    const leaderboard = await leaderboardService.getLeaderboard(filters);
    
    res.json({ 
      success: true, 
      data: leaderboard, 
      count: leaderboard.length,
      filters: filters
    });
    
  } catch (error) {
    logger.error('Error fetching leaderboard', { error: error.message });
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch leaderboard', 
      message: error.message 
    });
  }
});

/**
 * @swagger
 * /api/leaderboard/stats:
 *   get:
 *     summary: Get leaderboard statistics
 *     tags: [Leaderboard]
 *     security: []
 *     responses:
 *       200:
 *         description: Aggregate leaderboard stats
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await leaderboardService.getStats();
    
    res.json({ 
      success: true, 
      data: stats 
    });
    
  } catch (error) {
    logger.error('Error fetching leaderboard stats', { error: error.message });
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch stats', 
      message: error.message 
    });
  }
});

/**
 * @swagger
 * /api/leaderboard/{username}:
 *   get:
 *     summary: Get specific user's rank and stats
 *     tags: [Leaderboard]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: username
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: User rank and stats
 *       404:
 *         description: User not found in leaderboard
 */
router.get('/:username', validate({ params: leaderboardUsernameParam }), async (req, res) => {
  try {
    const username = req.params.username;
    const result = await leaderboardService.getUserRank(username);
    
    if (!result) {
      return res.status(404).json({ 
        success: false,
        error: 'User not found in leaderboard',
        message: `${username} has not been submitted to the leaderboard yet`
      });
    }
    
    res.json({ 
      success: true, 
      data: result 
    });
    
  } catch (error) {
    const username = req.params.username;
    logger.error('Error fetching user rank', { username, error: error.message });
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch user rank', 
      message: error.message 
    });
  }
});

/**
 * @swagger
 * /api/leaderboard/{username}:
 *   delete:
 *     summary: Remove user from leaderboard (admin only, GDPR)
 *     tags: [Leaderboard]
 *     parameters:
 *       - in: path
 *         name: username
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: User removed
 *       404:
 *         description: User not found
 *       403:
 *         description: Admin role required
 */
router.delete('/:username', requireAuth, requireRole('Admin'), validate({ params: leaderboardUsernameParam }), async (req, res) => {
  try {
    const username = req.params.username;
    const removed = await leaderboardService.removeEntry(username);
    
    if (!removed) {
      return res.status(404).json({ 
        success: false,
        error: 'User not found',
        message: `${username} is not in the leaderboard`
      });
    }
    
    res.json({ 
      success: true, 
      message: `${username} has been removed from the leaderboard` 
    });
    
  } catch (error) {
    const username = req.params.username;
    logger.error('Error removing user from leaderboard', { username, error: error.message });
    res.status(500).json({ 
      success: false,
      error: 'Failed to remove entry', 
      message: error.message 
    });
  }
});

module.exports = router;
