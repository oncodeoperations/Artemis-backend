const LeaderboardEntry = require('../models/LeaderboardEntry');
const logger = require('../utils/logger');

/**
 * Service for managing the public developer leaderboard
 * Handles opt-in submissions, rankings, and filtering
 */
class LeaderboardService {
  
  /**
   * Submit a user's evaluation to the leaderboard
   * @param {Object} evaluationResult - Complete evaluation response
   * @param {string} username - GitHub username
   * @returns {Promise<Object>} Saved leaderboard entry
   */
  async submitEntry(evaluationResult, username) {
    try {
      const entry = {
        username: username.toLowerCase().trim(),
        name: evaluationResult.profile.name || username,
        avatar: evaluationResult.profile.avatar || `https://github.com/${username}.png`,
        location: evaluationResult.profile.location || '',
        country: this.parseCountry(evaluationResult.profile.location),
        
        // Scores
        overall_score: evaluationResult.scores.overall_score,
        overall_level: evaluationResult.scores.overall_level,
        job_readiness_score: evaluationResult.scores.job_readiness_score,
        tech_depth_score: evaluationResult.scores.tech_depth_score,
        hiring_readiness: evaluationResult.scores.hiring_readiness,
        category_scores: evaluationResult.scores.category_scores,
        
        // Technical details
        primary_languages: evaluationResult.profile.primary_languages || [],
        total_repositories: evaluationResult.profile.total_repositories || 0,
        
        // Metadata
        opted_in: true,
        consent_timestamp: new Date(),
        last_updated: new Date()
      };
      
      // Upsert: update if exists, insert if new
      const result = await LeaderboardEntry.findOneAndUpdate(
        { username: entry.username },
        entry,
        { 
          upsert: true, 
          new: true, // Return updated document
          runValidators: true 
        }
      );
      
      logger.info('Leaderboard entry saved', { username });
      return result;
      
    } catch (error) {
      logger.error('Failed to save leaderboard entry', { username, error: error.message });
      throw new Error(`Failed to submit to leaderboard: ${error.message}`);
    }
  }
  
  /**
   * Get top developers with optional filters
   * @param {Object} filters - { country, level, language, limit }
   * @returns {Promise<Array>} Array of leaderboard entries
   */
  async getLeaderboard(filters = {}) {
    try {
      const query = { opted_in: true };
      
      // Apply filters
      if (filters.country && filters.country !== 'all') {
        query.country = filters.country.toUpperCase();
      }
      
      if (filters.level && filters.level !== 'all') {
        query.overall_level = filters.level;
      }
      
      if (filters.language) {
        query.primary_languages = { $in: [filters.language] };
      }
      
      const limit = Math.min(parseInt(filters.limit) || 100, 500); // Max 500
      
      const results = await LeaderboardEntry
        .find(query)
        .sort({ overall_score: -1, last_updated: -1 }) // Higher scores first, then recent
        .limit(limit)
        .select('-__v -createdAt -updatedAt') // Exclude internal fields
        .lean(); // Return plain JavaScript objects for performance
      
      // Add rank numbers
      return results.map((entry, index) => ({
        ...entry,
        rank: index + 1
      }));
      
    } catch (error) {
      logger.error('Failed to fetch leaderboard', { error: error.message });
      throw new Error(`Failed to fetch leaderboard: ${error.message}`);
    }
  }
  
  /**
   * Get a specific user's rank and stats
   * @param {string} username - GitHub username
   * @returns {Promise<Object|null>} User data with rank
   */
  async getUserRank(username) {
    try {
      const user = await LeaderboardEntry.findOne({ 
        username: username.toLowerCase().trim() 
      }).lean();
      
      if (!user) {
        return null;
      }
      
      // Calculate rank by counting users with higher scores
      const rank = await LeaderboardEntry.countDocuments({
        overall_score: { $gt: user.overall_score },
        opted_in: true
      }) + 1;
      
      // Get total number of users in leaderboard
      const total = await LeaderboardEntry.countDocuments({ opted_in: true });
      
      // Calculate percentile
      const percentile = Math.round(((total - rank + 1) / total) * 100);
      
      return {
        ...user,
        rank,
        total_users: total,
        percentile
      };
      
    } catch (error) {
      logger.error('Failed to fetch user rank', { username, error: error.message });
      throw new Error(`Failed to fetch user rank: ${error.message}`);
    }
  }
  
  /**
   * Remove a user from the leaderboard (GDPR compliance)
   * @param {string} username - GitHub username
   * @returns {Promise<boolean>} Success status
   */
  async removeEntry(username) {
    try {
      const result = await LeaderboardEntry.findOneAndDelete({ 
        username: username.toLowerCase().trim() 
      });
      
      if (result) {
        logger.info('Removed user from leaderboard', { username });
        return true;
      }
      
      return false;
      
    } catch (error) {
      logger.error('Failed to remove from leaderboard', { username, error: error.message });
      throw new Error(`Failed to remove from leaderboard: ${error.message}`);
    }
  }
  
  /**
   * Get leaderboard statistics
   * @returns {Promise<Object>} Stats about the leaderboard
   */
  async getStats() {
    try {
      const total = await LeaderboardEntry.countDocuments({ opted_in: true });
      
      const levelCounts = await LeaderboardEntry.aggregate([
        { $match: { opted_in: true } },
        { $group: { _id: '$overall_level', count: { $sum: 1 } } }
      ]);
      
      const countryCounts = await LeaderboardEntry.aggregate([
        { $match: { opted_in: true } },
        { $group: { _id: '$country', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]);
      
      const avgScore = await LeaderboardEntry.aggregate([
        { $match: { opted_in: true } },
        { $group: { _id: null, average: { $avg: '$overall_score' } } }
      ]);
      
      return {
        total_users: total,
        by_level: levelCounts.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        top_countries: countryCounts.map(c => ({ country: c._id, count: c.count })),
        average_score: avgScore[0]?.average || 0
      };
      
    } catch (error) {
      logger.error('Failed to fetch leaderboard stats', { error: error.message });
      throw new Error(`Failed to fetch stats: ${error.message}`);
    }
  }
  
  /**
   * Parse country from location string (best-effort)
   * @param {string} location - Free-text location from GitHub
   * @returns {string} ISO country code or 'Unknown'
   */
  parseCountry(location) {
    if (!location) return 'Unknown';
    
    const locationUpper = location.toUpperCase();
    
    // Common country mappings
    const countryMap = {
      // North America
      'USA': 'US', 'UNITED STATES': 'US', 'AMERICA': 'US', 'U.S.': 'US', 'U.S.A': 'US',
      'CANADA': 'CA', 'MEXICO': 'MX',
      
      // Europe
      'UK': 'GB', 'UNITED KINGDOM': 'GB', 'ENGLAND': 'GB', 'BRITAIN': 'GB', 'SCOTLAND': 'GB',
      'GERMANY': 'DE', 'DEUTSCHLAND': 'DE',
      'FRANCE': 'FR',
      'SPAIN': 'ES', 'ESPAÑA': 'ES',
      'ITALY': 'IT', 'ITALIA': 'IT',
      'NETHERLANDS': 'NL', 'HOLLAND': 'NL',
      'POLAND': 'PL', 'POLSKA': 'PL',
      'PORTUGAL': 'PT',
      'SWEDEN': 'SE', 'SVERIGE': 'SE',
      'NORWAY': 'NO', 'NORGE': 'NO',
      'DENMARK': 'DK', 'DANMARK': 'DK',
      'FINLAND': 'FI', 'SUOMI': 'FI',
      'SWITZERLAND': 'CH', 'SCHWEIZ': 'CH',
      'AUSTRIA': 'AT', 'ÖSTERREICH': 'AT',
      'BELGIUM': 'BE', 'BELGIË': 'BE',
      'IRELAND': 'IE',
      'UKRAINE': 'UA',
      'RUSSIA': 'RU', 'RUSSIAN FEDERATION': 'RU',
      
      // Asia
      'INDIA': 'IN', 'BHARAT': 'IN',
      'CHINA': 'CN', 'PEOPLE\'S REPUBLIC OF CHINA': 'CN',
      'JAPAN': 'JP', 'NIPPON': 'JP',
      'SOUTH KOREA': 'KR', 'KOREA': 'KR', 'REPUBLIC OF KOREA': 'KR',
      'SINGAPORE': 'SG',
      'THAILAND': 'TH',
      'VIETNAM': 'VN',
      'INDONESIA': 'ID',
      'MALAYSIA': 'MY',
      'PHILIPPINES': 'PH',
      'PAKISTAN': 'PK',
      'BANGLADESH': 'BD',
      'ISRAEL': 'IL',
      'TURKEY': 'TR', 'TÜRKIYE': 'TR',
      'UAE': 'AE', 'UNITED ARAB EMIRATES': 'AE', 'DUBAI': 'AE',
      'SAUDI ARABIA': 'SA',
      
      // Africa
      'NIGERIA': 'NG',
      'SOUTH AFRICA': 'ZA',
      'EGYPT': 'EG',
      'KENYA': 'KE',
      'GHANA': 'GH',
      'ETHIOPIA': 'ET',
      'MOROCCO': 'MA',
      
      // Oceania
      'AUSTRALIA': 'AU',
      'NEW ZEALAND': 'NZ',
      
      // South America
      'BRAZIL': 'BR', 'BRASIL': 'BR',
      'ARGENTINA': 'AR',
      'CHILE': 'CL',
      'COLOMBIA': 'CO',
      'PERU': 'PE',
      'VENEZUELA': 'VE'
    };
    
    // Check for exact matches
    for (const [key, code] of Object.entries(countryMap)) {
      if (locationUpper.includes(key)) {
        return code;
      }
    }
    
    // Check for common city -> country mappings
    const cityMap = {
      'NEW YORK': 'US', 'SAN FRANCISCO': 'US', 'LOS ANGELES': 'US', 'CHICAGO': 'US',
      'SEATTLE': 'US', 'BOSTON': 'US', 'AUSTIN': 'US', 'SILICON VALLEY': 'US',
      'LONDON': 'GB', 'MANCHESTER': 'GB', 'BIRMINGHAM': 'GB',
      'PARIS': 'FR', 'BERLIN': 'DE', 'MUNICH': 'DE', 'HAMBURG': 'DE',
      'MADRID': 'ES', 'BARCELONA': 'ES',
      'ROME': 'IT', 'MILAN': 'IT',
      'AMSTERDAM': 'NL', 'ROTTERDAM': 'NL',
      'TORONTO': 'CA', 'VANCOUVER': 'CA', 'MONTREAL': 'CA',
      'SYDNEY': 'AU', 'MELBOURNE': 'AU',
      'TOKYO': 'JP', 'OSAKA': 'JP',
      'BANGALORE': 'IN', 'MUMBAI': 'IN', 'DELHI': 'IN', 'HYDERABAD': 'IN',
      'BEIJING': 'CN', 'SHANGHAI': 'CN', 'SHENZHEN': 'CN',
      'SINGAPORE': 'SG',
      'LAGOS': 'NG', 'ABUJA': 'NG',
      'CAPE TOWN': 'ZA', 'JOHANNESBURG': 'ZA',
      'SÃO PAULO': 'BR', 'RIO DE JANEIRO': 'BR'
    };
    
    for (const [city, code] of Object.entries(cityMap)) {
      if (locationUpper.includes(city)) {
        return code;
      }
    }
    
    return 'Unknown';
  }
}

module.exports = new LeaderboardService();
