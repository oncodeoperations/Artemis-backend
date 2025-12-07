const express = require('express');
const router = express.Router();
const leaderboardService = require('../services/leaderboardService');

/**
 * GET /api/leaderboard
 * Get top developers with optional filters
 * Query params: country, level, language, limit
 */
router.get('/', async (req, res) => {
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
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch leaderboard', 
      message: error.message 
    });
  }
});

/**
 * GET /api/leaderboard/stats
 * Get leaderboard statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await leaderboardService.getStats();
    
    res.json({ 
      success: true, 
      data: stats 
    });
    
  } catch (error) {
    console.error('Error fetching leaderboard stats:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch stats', 
      message: error.message 
    });
  }
});

/**
 * GET /api/leaderboard/:username
 * Get specific user's rank and stats
 */
router.get('/:username', async (req, res) => {
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
    console.error(`Error fetching user rank for ${req.params.username}:`, error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch user rank', 
      message: error.message 
    });
  }
});

/**
 * DELETE /api/leaderboard/:username
 * Remove user from leaderboard (GDPR compliance)
 */
router.delete('/:username', async (req, res) => {
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
    console.error(`Error removing ${req.params.username} from leaderboard:`, error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to remove entry', 
      message: error.message 
    });
  }
});

module.exports = router;
