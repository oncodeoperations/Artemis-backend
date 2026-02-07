const User = require('../models/User');
const logger = require('../utils/logger');

/**
 * Get current user
 * GET /api/auth/me
 * Requires authentication
 */
const getCurrentUser = async (req, res) => {
  try {
    // User is already attached to req by auth middleware
    res.status(200).json({
      user: req.user.toPublicJSON()
    });
  } catch (error) {
    logger.error('Get current user error', { error: error.message });
    res.status(500).json({
      error: 'Failed to fetch user data',
      message: 'An error occurred while retrieving your profile.'
    });
  }
};

/**
 * Update user profile
 * PUT /api/auth/profile
 * Requires authentication
 */
const updateProfile = async (req, res) => {
  try {
    const { firstName, lastName, country, companyName, bio, githubUsername, profession, professionalRole, skills } = req.body;

    const user = req.user;

    // Update allowed fields
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (country) user.country = country;
    if (companyName) user.companyName = companyName;
    if (bio !== undefined) user.bio = bio;
    if (githubUsername !== undefined) user.githubUsername = githubUsername;
    if (profession !== undefined) user.profession = profession;
    if (professionalRole !== undefined) user.professionalRole = professionalRole;
    if (skills !== undefined) user.skills = skills;

    await user.save();

    res.status(200).json({
      message: 'Profile updated successfully',
      user: user.toPublicJSON()
    });

  } catch (error) {
    logger.error('Update profile error', { error: error.message });

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        error: 'Validation error',
        message: Object.values(error.errors).map(err => err.message).join(', ')
      });
    }

    res.status(500).json({
      error: 'Update failed',
      message: 'An error occurred while updating your profile.'
    });
  }
};

module.exports = {
  getCurrentUser,
  updateProfile
};
