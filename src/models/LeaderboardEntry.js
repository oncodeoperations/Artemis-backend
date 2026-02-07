const mongoose = require('mongoose');

/**
 * LeaderboardEntry Model
 * Stores developer profiles submitted to the public leaderboard
 * Only stores computed scores and basic profile info (not raw GitHub data)
 */
const LeaderboardEntrySchema = new mongoose.Schema({
  // Basic Profile Info
  username: { 
    type: String, 
    required: true, 
    unique: true, 
    index: true,
    lowercase: true,
    trim: true
  },
  name: { type: String, required: true },
  avatar: { type: String, required: true },
  location: String,
  country: { type: String, default: 'Unknown', index: true }, // ISO country code
  
  // Scores (from evaluation — new 100-point system)
  overall_score: { 
    type: Number, 
    required: true, 
    index: true,
    min: 0,
    max: 100
  },
  overall_level: { 
    type: String, 
    required: true,
    enum: ['Entry', 'Junior', 'Mid-Level', 'Senior', 'Expert',
           'Beginner', 'Intermediate'] // legacy compat
  },
  job_readiness_score: { type: Number, min: 0, max: 100 },
  tech_depth_score: { type: Number, min: 0, max: 100 },
  hiring_readiness: { type: String, enum: ['Strong Hire', 'Hire', 'Consider', 'Develop'] },
  
  // Category Breakdown (new 5-category system)
  category_scores: {
    code_sophistication: { type: Number, min: 0, max: 25 },
    engineering_practices: { type: Number, min: 0, max: 25 },
    project_maturity: { type: Number, min: 0, max: 20 },
    contribution_activity: { type: Number, min: 0, max: 15 },
    breadth_and_depth: { type: Number, min: 0, max: 15 },
    // Legacy fields (kept for backward compat with existing entries)
    code_quality: { type: Number, min: 0, max: 20 },
    project_diversity: { type: Number, min: 0, max: 20 },
    activity: { type: Number, min: 0, max: 20 },
    architecture: { type: Number, min: 0, max: 20 },
    repo_quality: { type: Number, min: 0, max: 20 },
    professionalism: { type: Number, min: 0, max: 10 }
  },
  
  // Technical Details
  primary_languages: [String],
  total_repositories: { type: Number, default: 0 },
  
  // Privacy & Legal
  opted_in: { type: Boolean, default: true, required: true },
  consent_timestamp: { type: Date, default: Date.now },
  
  // Metadata
  rank: Number, // Computed field, updated by cron job
  submitted_at: { type: Date, default: Date.now },
  last_updated: { type: Date, default: Date.now }
}, {
  timestamps: true // Adds createdAt and updatedAt automatically
});

// Indexes for performance
LeaderboardEntrySchema.index({ overall_score: -1, submitted_at: -1 });
LeaderboardEntrySchema.index({ country: 1, overall_score: -1 });
LeaderboardEntrySchema.index({ overall_level: 1, overall_score: -1 });

// Virtual for GitHub profile URL
LeaderboardEntrySchema.virtual('github_url').get(function() {
  return `https://github.com/${this.username}`;
});

// Ensure virtuals are included in JSON
LeaderboardEntrySchema.set('toJSON', { virtuals: true });
LeaderboardEntrySchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('LeaderboardEntry', LeaderboardEntrySchema);
