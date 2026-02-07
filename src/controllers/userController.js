const User = require('../models/User');
const Contract = require('../models/Contract');
const Assessment = require('../models/Assessment');
const AssessmentInvitation = require('../models/AssessmentInvitation');
const AssessmentSession = require('../models/AssessmentSession');
const LeaderboardEntry = require('../models/LeaderboardEntry');
const logger = require('../utils/logger');

/**
 * Get all users with pagination
 * GET /api/users?role=&country=&page=1&limit=50
 */
const getAllUsers = async (req, res) => {
  try {
    const { role, country, page = 1, limit = 50 } = req.query;

    let query = { isActive: true };

    if (role) {
      query.role = role;
    }

    if (country) {
      query.country = country;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [users, total] = await Promise.all([
      User.find(query)
        .select('clerkId email firstName lastName role country profilePicture bio githubUsername createdAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      User.countDocuments(query),
    ]);

    res.status(200).json({
      users,
      count: users.length,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    logger.error('Get users error', { error: error.message });
    res.status(500).json({
      error: 'Failed to fetch users',
      message: 'An error occurred while retrieving users.'
    });
  }
};

/**
 * Get user by ID
 * GET /api/users/:id
 */
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id)
      .select('clerkId email firstName lastName role country profilePicture bio githubUsername isActive isEmailVerified createdAt');

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'The requested user does not exist.'
      });
    }

    res.status(200).json({ user });

  } catch (error) {
    logger.error('Get user error', { error: error.message });
    res.status(500).json({
      error: 'Failed to fetch user',
      message: 'An error occurred while retrieving the user.'
    });
  }
};

/**
 * Update user
 * PUT /api/users/:id
 */
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    // Users can only update their own profile
    if (id !== userId.toString()) {
      return res.status(403).json({
        error: 'Unauthorized',
        message: 'You can only update your own profile.'
      });
    }

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'The requested user does not exist.'
      });
    }

    // Update allowed fields
    const allowedUpdates = ['firstName', 'lastName', 'country', 'companyName', 'bio', 'githubUsername', 'profilePicture', 'profession', 'professionalRole', 'skills'];

    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        user[field] = req.body[field];
      }
    });

    // Handle skills array separately — allow clearing
    if (req.body.skills !== undefined) {
      user.skills = req.body.skills;
    }

    // Handle savedDevelopers for Business Owners
    if (req.body.savedDevelopers && user.role === 'BusinessOwner') {
      user.savedDevelopers = req.body.savedDevelopers;
    }

    await user.save();

    res.status(200).json({
      message: 'Profile updated successfully',
      user: user.toPublicJSON()
    });

  } catch (error) {
    logger.error('Update user error', { error: error.message });

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        error: 'Validation error',
        message: Object.values(error.errors).map(err => err.message).join(', ')
      });
    }

    res.status(500).json({
      error: 'Failed to update user',
      message: 'An error occurred while updating the user profile.'
    });
  }
};

/**
 * Delete user (deactivate)
 * DELETE /api/users/:id
 */
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    // Users can only delete their own account
    if (id !== userId.toString()) {
      return res.status(403).json({
        error: 'Unauthorized',
        message: 'You can only delete your own account.'
      });
    }

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'The requested user does not exist.'
      });
    }

    // Soft delete - deactivate account
    user.isActive = false;
    await user.save();

    res.status(200).json({
      message: 'Account deactivated successfully'
    });

  } catch (error) {
    logger.error('Delete user error', { error: error.message });
    res.status(500).json({
      error: 'Failed to delete user',
      message: 'An error occurred while deactivating the account.'
    });
  }
};

/**
 * Get saved developers with hydrated profiles (Business Owners only)
 * GET /api/users/saved-developers
 */
const getSavedDevelopers = async (req, res) => {
  try {
    const user = req.user;
    const usernames = user.savedDevelopers || [];

    if (usernames.length === 0) {
      return res.json({ savedDevelopers: [] });
    }

    // Hydrate from LeaderboardEntry (GitHub-analyzed devs)
    const leaderboardEntries = await LeaderboardEntry.find({
      username: { $in: usernames }
    }).lean();
    const lbMap = new Map(leaderboardEntries.map(e => [e.username.toLowerCase(), e]));

    // Hydrate from User collection (platform talent with githubUsername)
    const talentUsers = await User.find({
      githubUsername: { $in: usernames },
      role: 'Freelancer',
      isActive: true
    }).select('firstName lastName email profilePicture profession professionalRole skills bio country githubUsername').lean();
    const talentMap = new Map(talentUsers.map(u => [u.githubUsername.toLowerCase(), u]));

    // Also find talent by matching username to firstName/lastName patterns or direct lookup
    // For talent without GitHub usernames, try matching by _id string if stored that way
    const objectIdUsernames = usernames.filter(u => /^[0-9a-fA-F]{24}$/.test(u));
    let talentByIdMap = new Map();
    if (objectIdUsernames.length > 0) {
      const talentById = await User.find({
        _id: { $in: objectIdUsernames },
        role: 'Freelancer',
        isActive: true
      }).select('firstName lastName email profilePicture profession professionalRole skills bio country githubUsername').lean();
      talentByIdMap = new Map(talentById.map(u => [u._id.toString(), u]));
    }

    // Build hydrated response preserving saved order
    const hydrated = usernames.map(username => {
      const key = username.toLowerCase();
      const lb = lbMap.get(key);
      const talent = talentMap.get(key) || talentByIdMap.get(username);

      if (talent) {
        // Platform talent profile
        return {
          username: talent.githubUsername || talent._id.toString(),
          name: `${talent.firstName} ${talent.lastName}`.trim(),
          avatar: talent.profilePicture || null,
          level: lb ? lb.overall_level : null,
          score: lb ? lb.overall_score : null,
          location: talent.country || null,
          github_url: talent.githubUsername ? `https://github.com/${talent.githubUsername}` : null,
          primary_languages: lb ? (lb.primary_languages || []) : [],
          skills: talent.skills || [],
          type: 'talent',
          profileId: talent._id.toString(),
          profession: talent.profession || null,
          savedAt: null // order preserved from array position
        };
      }

      if (lb) {
        // Leaderboard-only developer
        return {
          username: lb.username,
          name: lb.name || lb.username,
          avatar: lb.avatar || null,
          level: lb.overall_level || null,
          score: lb.overall_score || null,
          location: lb.location || lb.country || null,
          github_url: lb.github_url || `https://github.com/${lb.username}`,
          primary_languages: lb.primary_languages || [],
          skills: [],
          type: 'developer',
          profileId: null,
          profession: null,
          savedAt: null
        };
      }

      // Minimal fallback — username only
      return {
        username,
        name: username,
        avatar: null,
        level: null,
        score: null,
        location: null,
        github_url: `https://github.com/${username}`,
        primary_languages: [],
        skills: [],
        type: 'developer',
        profileId: null,
        profession: null,
        savedAt: null
      };
    });

    res.json({ savedDevelopers: hydrated });
  } catch (error) {
    logger.error('Get saved developers error', { error: error.message });
    res.status(500).json({
      error: 'Failed to fetch saved developers',
      message: 'An error occurred while retrieving saved developers.'
    });
  }
};

/**
 * Add developer to saved list (Business Owners only)
 * POST /api/users/saved-developers
 */
const addSavedDeveloper = async (req, res) => {
  try {
    const { username } = req.body;
    const user = req.user;

    if (user.role !== 'BusinessOwner') {
      return res.status(403).json({
        error: 'Unauthorized',
        message: 'Only Business Owners can save developers.'
      });
    }

    if (!username) {
      return res.status(400).json({
        error: 'Missing username',
        message: 'Please provide a username.'
      });
    }

    // Check if already saved
    if (user.savedDevelopers.includes(username.toLowerCase())) {
      return res.status(400).json({
        error: 'Already saved',
        message: 'This developer is already in your saved list.'
      });
    }

    user.savedDevelopers.push(username.toLowerCase());
    await user.save();

    res.status(200).json({
      message: 'Developer saved successfully',
      savedDevelopers: user.savedDevelopers
    });

  } catch (error) {
    logger.error('Add saved developer error', { error: error.message });
    res.status(500).json({
      error: 'Failed to save developer',
      message: 'An error occurred while saving the developer.'
    });
  }
};

/**
 * Remove developer from saved list
 * DELETE /api/users/saved-developers/:username
 */
const removeSavedDeveloper = async (req, res) => {
  try {
    const { username } = req.params;
    const user = req.user;

    if (user.role !== 'BusinessOwner') {
      return res.status(403).json({
        error: 'Unauthorized',
        message: 'Only Business Owners can manage saved developers.'
      });
    }

    user.savedDevelopers = user.savedDevelopers.filter(
      dev => dev !== username.toLowerCase()
    );

    await user.save();

    res.status(200).json({
      message: 'Developer removed from saved list',
      savedDevelopers: user.savedDevelopers
    });

  } catch (error) {
    logger.error('Remove saved developer error', { error: error.message });
    res.status(500).json({
      error: 'Failed to remove developer',
      message: 'An error occurred while removing the developer.'
    });
  }
};

/**
 * Browse talent — profession-based freelancer discovery
 * GET /api/users/talent?profession=&skills=&search=&minScore=&sort=&page=&limit=
 *
 * Returns freelancers with their best assessment score, profession, skills.
 * Employers use this to find verified talent.
 */
const browseTalent = async (req, res) => {
  try {
    const { profession, skills, search, minScore, sort = 'score', page = 1, limit = 20 } = req.query;

    // Base filter: active freelancers who have completed onboarding (have a profession)
    const filter = {
      isActive: true,
      role: 'Freelancer',
      profession: { $exists: true, $ne: '' },
    };

    if (profession) {
      filter.profession = profession;
    }

    if (skills) {
      const skillList = skills.split(',').map((s) => s.trim()).filter(Boolean);
      if (skillList.length > 0) {
        filter.skills = { $in: skillList };
      }
    }

    if (search) {
      const regex = new RegExp(search, 'i');
      filter.$or = [
        { firstName: regex },
        { lastName: regex },
        { profession: regex },
        { professionalRole: regex },
        { skills: regex },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);

    // Get matching freelancers
    const [users, total] = await Promise.all([
      User.find(filter)
        .select('firstName lastName email profilePicture profession professionalRole skills bio country githubUsername createdAt')
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      User.countDocuments(filter),
    ]);

    if (users.length === 0) {
      return res.json({ talent: [], total: 0, page: Number(page), limit: Number(limit) });
    }

    // Aggregate best assessment score per freelancer
    const userIds = users.map((u) => u._id);
    const scorePipeline = [
      { $match: { freelancer: { $in: userIds }, status: 'completed', score: { $ne: null } } },
      {
        $group: {
          _id: '$freelancer',
          bestScore: { $max: '$score' },
          avgScore: { $avg: '$score' },
          assessmentCount: { $sum: 1 },
        },
      },
    ];

    const scores = await AssessmentSession.aggregate(scorePipeline);
    const scoreMap = new Map(scores.map((s) => [s._id.toString(), s]));

    // Merge scores into user objects
    let talent = users.map((u) => {
      const s = scoreMap.get(u._id.toString());
      return {
        ...u,
        bestScore: s?.bestScore ?? null,
        avgScore: s?.avgScore ? Math.round(s.avgScore) : null,
        assessmentCount: s?.assessmentCount ?? 0,
      };
    });

    // Optional minScore filter (post-aggregation)
    if (minScore != null) {
      talent = talent.filter((t) => t.bestScore != null && t.bestScore >= Number(minScore));
    }

    // Sort
    if (sort === 'score') {
      talent.sort((a, b) => (b.bestScore ?? -1) - (a.bestScore ?? -1));
    } else if (sort === 'name') {
      talent.sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));
    } else {
      // recent
      talent.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    res.json({ talent, total, page: Number(page), limit: Number(limit) });
  } catch (error) {
    logger.error('Browse talent error', { error: error.message });
    res.status(500).json({ error: 'Failed to browse talent', message: error.message });
  }
};

/**
 * Get a single freelancer's public talent profile + assessment history
 * GET /api/users/talent/:id
 */
const getTalentProfile = async (req, res) => {
  try {
    const user = await User.findOne({
      _id: req.params.id,
      role: 'Freelancer',
      isActive: true,
    })
      .select('firstName lastName email profilePicture profession professionalRole skills bio country githubUsername createdAt')
      .lean();

    if (!user) {
      return res.status(404).json({ error: 'Freelancer not found' });
    }

    // Get completed assessment sessions for this freelancer
    const sessions = await AssessmentSession.find({
      freelancer: user._id,
      status: 'completed',
    })
      .populate('assessment', 'title profession difficulty questionCount timeLimitMinutes')
      .select('assessment score breakdown strengths weaknesses timeSpentSeconds completedAt')
      .sort({ completedAt: -1 })
      .lean();

    const bestScore = sessions.length > 0 ? Math.max(...sessions.map((s) => s.score || 0)) : null;
    const avgScore = sessions.length > 0 ? Math.round(sessions.reduce((sum, s) => sum + (s.score || 0), 0) / sessions.length) : null;

    res.json({
      profile: {
        ...user,
        bestScore,
        avgScore,
        assessmentCount: sessions.length,
      },
      assessments: sessions,
    });
  } catch (error) {
    logger.error('Get talent profile error', { error: error.message });
    res.status(500).json({ error: 'Failed to get talent profile', message: error.message });
  }
};

/**
 * Get dashboard stats for the authenticated user
 * GET /api/users/dashboard-stats
 */
const getDashboardStats = async (req, res) => {
  try {
    const userId = req.auth.mongoUser._id;
    const role = req.auth.mongoUser.role;

    if (role === 'BusinessOwner') {
      // ─── Employer stats ─────────────────────────────────────
      const [contractStats, assessmentCount, invitationCount, recentContracts] = await Promise.all([
        Contract.aggregate([
          { $match: { creator: userId } },
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
              pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
              completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
              totalBudget: { $sum: { $ifNull: ['$budget', 0] } },
            },
          },
        ]),
        Assessment.countDocuments({ createdBy: userId, isActive: true }),
        AssessmentInvitation.countDocuments({ employer: userId }),
        Contract.find({ creator: userId })
          .populate('contributor', 'firstName lastName email profilePicture')
          .select('contractName status budget contractType contributorEmail createdAt')
          .sort({ createdAt: -1 })
          .limit(5)
          .lean(),
      ]);

      // Get recent completed sessions for assessments this employer created
      const employerAssessmentIds = await Assessment.find({ createdBy: userId }).select('_id').lean();
      const assessmentIds = employerAssessmentIds.map((a) => a._id);

      const recentSessions = await AssessmentSession.find({
        assessment: { $in: assessmentIds },
        status: 'completed',
      })
        .populate('freelancer', 'firstName lastName email profilePicture profession')
        .populate('assessment', 'title profession difficulty')
        .select('score completedAt freelancer assessment')
        .sort({ completedAt: -1 })
        .limit(5)
        .lean();

      const stats = contractStats[0] || { total: 0, active: 0, pending: 0, completed: 0, totalBudget: 0 };

      res.json({
        role: 'BusinessOwner',
        contracts: {
          total: stats.total,
          active: stats.active,
          pending: stats.pending,
          completed: stats.completed,
          totalBudget: stats.totalBudget,
        },
        assessments: {
          created: assessmentCount,
          invitationsSent: invitationCount,
        },
        recentContracts,
        recentSessions,
      });
    } else {
      // ─── Freelancer stats ───────────────────────────────────
      const [contractStats, sessions, recentContracts] = await Promise.all([
        Contract.aggregate([
          { $match: { contributor: userId } },
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
              pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
              completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
              totalEarnings: {
                $sum: {
                  $cond: [
                    { $in: ['$status', ['active', 'completed']] },
                    { $ifNull: ['$budget', 0] },
                    0,
                  ],
                },
              },
            },
          },
        ]),
        AssessmentSession.find({ freelancer: userId, status: 'completed' })
          .select('score completedAt')
          .sort({ completedAt: -1 })
          .lean(),
        Contract.find({ contributor: userId })
          .populate('creator', 'firstName lastName email companyName profilePicture')
          .select('contractName status budget contractType createdAt')
          .sort({ createdAt: -1 })
          .limit(5)
          .lean(),
      ]);

      const cStats = contractStats[0] || { total: 0, active: 0, pending: 0, completed: 0, totalEarnings: 0 };
      const bestScore = sessions.length > 0 ? Math.max(...sessions.map((s) => s.score || 0)) : null;
      const avgScore = sessions.length > 0 ? Math.round(sessions.reduce((sum, s) => sum + (s.score || 0), 0) / sessions.length) : null;

      res.json({
        role: 'Freelancer',
        contracts: {
          total: cStats.total,
          active: cStats.active,
          pending: cStats.pending,
          completed: cStats.completed,
          totalEarnings: cStats.totalEarnings,
        },
        assessments: {
          completed: sessions.length,
          bestScore,
          avgScore,
        },
        recentContracts,
      });
    }
  } catch (error) {
    logger.error('Get dashboard stats error', { error: error.message });
    res.status(500).json({ error: 'Failed to get dashboard stats', message: error.message });
  }
};

/**
 * Get current user's full profile for settings page
 * GET /api/users/me/profile
 */
const getMyProfile = async (req, res) => {
  try {
    const user = await User.findById(req.auth.mongoUser._id)
      .select('-savedDevelopers -stripeCustomerId -withdrawalInfo')
      .lean();

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Enrich with assessment stats
    const sessions = await AssessmentSession.find({
      freelancer: user._id,
      status: 'completed',
    }).select('score').lean();

    const assessmentStats = {
      completed: sessions.length,
      bestScore: sessions.length > 0 ? Math.max(...sessions.map(s => s.score || 0)) : null,
      avgScore: sessions.length > 0 ? Math.round(sessions.reduce((sum, s) => sum + (s.score || 0), 0) / sessions.length) : null,
    };

    res.json({ user, assessmentStats });
  } catch (error) {
    logger.error('Get my profile error', { error: error.message });
    res.status(500).json({ error: 'Failed to get profile', message: error.message });
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  getSavedDevelopers,
  addSavedDeveloper,
  removeSavedDeveloper,
  browseTalent,
  getTalentProfile,
  getDashboardStats,
  getMyProfile,
};
