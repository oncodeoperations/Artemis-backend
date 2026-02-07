const User = require('../models/User');
const notificationService = require('../services/notificationService');
const logger = require('../utils/logger');

/**
 * Get user statistics including verification status
 * GET /api/admin/stats
 * Uses a single aggregation instead of 7 separate queries.
 */
const getUserStats = async (req, res) => {
  try {
    const [stats] = await User.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          verifiedUsers: { $sum: { $cond: ['$isEmailVerified', 1, 0] } },
          unverifiedUsers: { $sum: { $cond: ['$isEmailVerified', 0, 1] } },
          freelancers: { $sum: { $cond: [{ $eq: ['$role', 'Freelancer'] }, 1, 0] } },
          businessOwners: { $sum: { $cond: [{ $eq: ['$role', 'BusinessOwner'] }, 1, 0] } },
          verifiedFreelancers: {
            $sum: { $cond: [{ $and: [{ $eq: ['$role', 'Freelancer'] }, '$isEmailVerified'] }, 1, 0] }
          },
          verifiedBusinessOwners: {
            $sum: { $cond: [{ $and: [{ $eq: ['$role', 'BusinessOwner'] }, '$isEmailVerified'] }, 1, 0] }
          },
        },
      },
    ]);

    const s = stats || {
      totalUsers: 0, verifiedUsers: 0, unverifiedUsers: 0,
      freelancers: 0, businessOwners: 0,
      verifiedFreelancers: 0, verifiedBusinessOwners: 0,
    };

    res.status(200).json({
      stats: {
        total: {
          users: s.totalUsers,
          verified: s.verifiedUsers,
          unverified: s.unverifiedUsers,
          verificationRate: s.totalUsers > 0 ? ((s.verifiedUsers / s.totalUsers) * 100).toFixed(2) : 0
        },
        freelancers: {
          total: s.freelancers,
          verified: s.verifiedFreelancers,
          unverified: s.freelancers - s.verifiedFreelancers,
          verificationRate: s.freelancers > 0 ? ((s.verifiedFreelancers / s.freelancers) * 100).toFixed(2) : 0
        },
        businessOwners: {
          total: s.businessOwners,
          verified: s.verifiedBusinessOwners,
          unverified: s.businessOwners - s.verifiedBusinessOwners,
          verificationRate: s.businessOwners > 0 ? ((s.verifiedBusinessOwners / s.businessOwners) * 100).toFixed(2) : 0
        }
      }
    });
  } catch (error) {
    logger.error('Get stats error', { error: error.message });
    res.status(500).json({
      error: 'Failed to fetch statistics',
      message: 'An error occurred while retrieving user statistics.'
    });
  }
};

/**
 * Get all unverified users
 * GET /api/admin/users/unverified
 */
const getUnverifiedUsers = async (req, res) => {
  try {
    const { role, limit = 50, page = 1 } = req.query;
    
    const query = { 
      isActive: true, 
      isEmailVerified: false 
    };
    
    if (role) {
      query.role = role;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const users = await User.find(query)
      .select('clerkId email firstName lastName role country createdAt lastLoginAt')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const total = await User.countDocuments(query);

    res.status(200).json({
      users,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('Get unverified users error', { error: error.message });
    res.status(500).json({
      error: 'Failed to fetch unverified users',
      message: 'An error occurred while retrieving unverified users.'
    });
  }
};

/**
 * Get all verified users
 * GET /api/admin/users/verified
 */
const getVerifiedUsers = async (req, res) => {
  try {
    const { role, limit = 50, page = 1 } = req.query;
    
    const query = { 
      isActive: true, 
      isEmailVerified: true 
    };
    
    if (role) {
      query.role = role;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const users = await User.find(query)
      .select('clerkId email firstName lastName role country createdAt lastLoginAt')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const total = await User.countDocuments(query);

    res.status(200).json({
      users,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('Get verified users error', { error: error.message });
    res.status(500).json({
      error: 'Failed to fetch verified users',
      message: 'An error occurred while retrieving verified users.'
    });
  }
};

/**
 * Get all users with verification status
 * GET /api/admin/users
 */
const getAllUsersWithStatus = async (req, res) => {
  try {
    const { role, isEmailVerified, limit = 50, page = 1, search } = req.query;
    
    const query = { isActive: true };
    
    if (role) {
      query.role = role;
    }
    
    if (isEmailVerified !== undefined) {
      query.isEmailVerified = isEmailVerified === 'true';
    }

    // Search by name or email (escape regex special chars to prevent ReDoS)
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { email: { $regex: escaped, $options: 'i' } },
        { firstName: { $regex: escaped, $options: 'i' } },
        { lastName: { $regex: escaped, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const users = await User.find(query)
      .select('clerkId email firstName lastName role country isEmailVerified createdAt lastLoginAt')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const total = await User.countDocuments(query);

    res.status(200).json({
      users,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('Get all users error', { error: error.message });
    res.status(500).json({
      error: 'Failed to fetch users',
      message: 'An error occurred while retrieving users.'
    });
  }
};

/**
 * POST /api/admin/broadcast — send system announcement
 */
const broadcastAnnouncement = async (req, res) => {
  try {
    const { title, message, targetRole } = req.body;

    if (!title || !message) {
      return res.status(400).json({ message: 'Title and message are required' });
    }

    // Build query for target recipients
    const query = { isActive: true };
    if (targetRole && targetRole !== 'all') {
      query.role = targetRole;
    }

    const users = await User.find(query).select('_id').lean();
    const recipientIds = users.map((u) => u._id);

    const results = await notificationService.broadcastAnnouncement({
      title,
      message,
      recipientIds,
      actorId: req.user._id.toString(),
    });

    logger.info('Admin broadcast sent', { count: results.length, targetRole: targetRole || 'all' });
    res.json({ message: 'Broadcast sent successfully', recipientCount: results.length });
  } catch (error) {
    logger.error('Error broadcasting announcement', { error: error.message });
    res.status(500).json({ message: 'Failed to send broadcast', error: error.message });
  }
};

module.exports = {
  getUserStats,
  getUnverifiedUsers,
  getVerifiedUsers,
  getAllUsersWithStatus,
  broadcastAnnouncement,
};
