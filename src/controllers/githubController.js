const githubService = require('../services/githubService');
const aiService = require('../services/aiService');
const scoringService = require('../services/scoringService');
const codeExtractor = require('../utils/codeExtractor');
const promptBuilder = require('../utils/promptBuilder');
const logger = require('../utils/logger');

/**
 * Main controller for evaluating GitHub developers
 * Implements BACKEND_SPEC.md v2.0.0
 */
class GitHubController {
  constructor() {
    // Bounded in-memory cache (max 500 entries, LRU eviction)
    this.cache = new Map();
    this.cacheExpiry = 30 * 60 * 1000; // 30 minutes
    this.maxCacheSize = 500;
  }

  /**
   * Set cache entry with LRU eviction when full
   */
  _setCache(key, value) {
    if (this.cache.size >= this.maxCacheSize) {
      // Evict oldest entry (first key in Map iteration order)
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    this.cache.set(key, value);
  }
  /**
   * Evaluate a developer based on their GitHub profile
   * Returns comprehensive analysis with profile, scores, recruiter_summary, engineer_breakdown
   */
  async evaluateDeveloper(req, res) {
    const startTime = Date.now(); // Track performance
    
    try {
      // Support both githubUrl and github_url for backward compatibility
      const githubUrl = req.body.githubUrl || req.body.github_url;

      // Validate input (CHECKLIST: Input validation ✓)
      if (!githubUrl) {
        return res.status(400).json({
          error: 'Missing required field',
          message: 'Please provide a GitHub URL in the request body'
        });
      }

      // Extract username from GitHub URL
      const username = extractUsernameFromUrl(githubUrl);
      if (!username) {
        return res.status(400).json({
          error: 'Invalid GitHub URL',
          message: 'Please provide a valid GitHub profile URL (e.g., https://github.com/username)'
        });
      }

      // Check cache first (CHECKLIST: Caching ✓)
      const cacheKey = username.toLowerCase();
      if (this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey);
        if (Date.now() - cached.timestamp < this.cacheExpiry) {
          logger.info(`Returning cached result for ${username} (${Date.now() - startTime}ms)`);
          
          // Even with cached results, handle leaderboard submission if requested
          if (req.body.submitToLeaderboard === true && !cached.data.leaderboard_submitted) {
            try {
              const leaderboardService = require('../services/leaderboardService');
              await leaderboardService.submitEntry(cached.data, username);
              logger.info(`User ${username} submitted to leaderboard (from cache)`);
              cached.data.leaderboard_submitted = true;
              // Update cache with new leaderboard status
              this._setCache(cacheKey, cached);
            } catch (leaderboardError) {
              logger.error('Failed to submit to leaderboard', { error: leaderboardError.message });
              cached.data.leaderboard_submitted = false;
              cached.data.leaderboard_error = leaderboardError.message;
            }
          }
          
          return res.json(cached.data);
        } else {
          this.cache.delete(cacheKey);
        }
      }

      logger.info('Starting comprehensive evaluation for GitHub user', { username });

      // Step 1: Fetch user profile
      logger.info('Fetching user profile');
      const userProfile = await githubService.getUserProfile(username);
      if (!userProfile) {
        return res.status(404).json({
          error: 'GitHub user not found',
          message: `User '${username}' does not exist or profile is private. Please verify the username.`
        });
      }

      // Step 2: Fetch user's repositories
      logger.info('Fetching repositories');
      const allRepos = await githubService.getUserRepos(username);
      
      if (!allRepos || allRepos.length === 0) {
        return res.status(404).json({
          error: 'No repositories found',
          message: 'This user has no public repositories to analyze'
        });
      }

      // Step 3: Filter quality repositories (CHECKLIST: Edge cases - only forks, no repos ✓)
      logger.info('Filtering repositories', { totalRepos: allRepos.length });
      const qualityRepos = githubService.filterRepositories(allRepos, username);
      
      if (qualityRepos.length === 0) {
        // Provide helpful feedback based on what we found
        const forksCount = allRepos.filter(r => r.fork).length;
        const smallRepos = allRepos.filter(r => r.size < 10).length;
        
        let helpfulMessage = 'No quality repositories found for analysis. ';
        if (forksCount === allRepos.length) {
          helpfulMessage += 'All repositories are forks. We need original work to evaluate.';
        } else if (smallRepos > 0) {
          helpfulMessage += `${smallRepos} repositories were too small (empty or nearly empty).`;
        } else {
          helpfulMessage += 'Repositories appear to be school assignments or auto-generated.';
        }
        
        return res.status(422).json({
          error: 'No analyzable repositories',
          message: helpfulMessage,
          details: {
            total_repos: allRepos.length,
            forks: forksCount,
            filtered_out: allRepos.length - qualityRepos.length
          }
        });
      }

      logger.info('Analyzing quality repositories', { count: qualityRepos.length });

      // Step 4: Get commit activity data
      logger.info('Analyzing commit activity');
      const activityData = await githubService.getCommitActivity(username, qualityRepos);

      // Step 5: Analyze repositories in detail
      logger.info('Performing deep repository analysis');
      const reposToAnalyze = qualityRepos.slice(0, 30);
      const repoDetails = [];
      const codeData = [];

      for (const repo of reposToAnalyze) {
        try {
          logger.info('Analyzing repository', { repoName: repo.name });
          const repoFiles = await githubService.getRepoFiles(username, repo.name);
          
          if (repoFiles.length > 0) {
            // Get detailed analysis for scoring
            const analysis = codeExtractor.analyzeRepositoryForScoring(repoFiles, repo);
            repoDetails.push(analysis);

            // Also get code snippets for AI analysis
            const extractedCode = codeExtractor.extractRelevantCode(repoFiles, repo);
            if (extractedCode.codeSnippets.length > 0) {
              codeData.push(extractedCode);
            }
          }
        } catch (error) {
          logger.warn('Failed to analyze repository', { repoName: repo.name, error: error.message });
        }
      }

      if (repoDetails.length === 0) {
        return res.status(422).json({
          error: 'No analyzable code found',
          message: 'Unable to find suitable code files for analysis in the repositories'
        });
      }

      // Step 6: Calculate scores
      logger.info('Calculating scores');
      const scores = scoringService.calculateScores(
        userProfile,
        qualityRepos,
        repoDetails,
        activityData
      );

      // Step 7: Get primary languages
      const languageCounts = {};
      qualityRepos.forEach(repo => {
        if (repo.language) {
          languageCounts[repo.language] = (languageCounts[repo.language] || 0) + 1;
        }
      });
      const primary_languages = Object.entries(languageCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([lang]) => lang);

      // Step 8: Build AI analysis prompt (now includes pre-computed scores as context)
      logger.info('Building AI analysis prompt');
      const prompt = promptBuilder.buildEvaluationPrompt(username, codeData, qualityRepos, scores, activityData);

      // Step 9: Get AI insights
      logger.info('Generating AI insights');
      const aiInsights = await aiService.generateInsights(prompt, scores);

      // Step 10: Build language breakdown for engineer view
      const language_breakdown = {};
      repoDetails.forEach(repo => {
        repo.languages.forEach(lang => {
          if (!language_breakdown[lang]) {
            language_breakdown[lang] = {
              percentage: 0,
              repos_count: 0
            };
          }
          language_breakdown[lang].repos_count++;
        });
      });

      // Calculate percentages
      const totalLangRepos = Object.values(language_breakdown).reduce((sum, l) => sum + l.repos_count, 0);
      if (totalLangRepos > 0) {
        Object.keys(language_breakdown).forEach(lang => {
          language_breakdown[lang].percentage = Math.round((language_breakdown[lang].repos_count / totalLangRepos) * 100);
        });
      }

      // Step 11: Build repo-level details for engineer view
      const repo_level_details = repoDetails.slice(0, 10).map(repo => {
        const repoMeta = qualityRepos.find(r => r.name === repo.name);
        // Gradient scoring per repo: avg of key ratios × 100
        const repoScoreRaw = (
          (repo.errorHandlingDensity || 0) * 20 +
          (repo.modernSyntaxRatio || 0) * 20 +
          (repo.typeSafetyRatio || 0) * 15 +
          (repo.testFileRatio || 0) * 20 +
          (repo.isComplete || (repo.hasEntryPoint && repo.hasConfig) ? 15 : 0) +
          (repo.cicdMaturity > 0 ? 10 : 0)
        );
        return {
          repo_name: repo.name,
          score: Math.round(Math.min(100, repoScoreRaw)),
          notes: this.generateRepoNotes(repo),
          languages: repo.languages,
          complexity: (repo.avgComplexity || 0) > 5 ? 'High' : (repo.avgComplexity || 0) > 2 ? 'Medium' : 'Low',
          stars: repoMeta?.stargazers_count || 0,
          forks: repoMeta?.forks_count || 0
        };
      });

      // Step 12: Assemble complete response (new 100-point system)
      const response = {
        profile: {
          username: userProfile.username,
          name: userProfile.name,
          bio: userProfile.bio,
          avatar: userProfile.avatar,
          location: userProfile.location,
          github_url: userProfile.github_url,
          primary_languages,
          total_repositories: allRepos.length,
          analyzed_repositories: repoDetails.length,
          activity_status: activityData.activityStatus
        },
        scores: {
          overall_level: scores.overall_level,
          overall_score: scores.overall_score,
          max_score: 100,
          job_readiness_score: scores.job_readiness_score,
          tech_depth_score: scores.tech_depth_score,
          hiring_readiness: scores.hiring_readiness,
          // 5-category breakdown
          code_sophistication: scores.code_sophistication,
          engineering_practices: scores.engineering_practices,
          project_maturity: scores.project_maturity,
          contribution_activity: scores.contribution_activity,
          breadth_and_depth: scores.breadth_and_depth
        },
        recruiter_summary: {
          top_strengths: aiInsights.recruiter_summary.top_strengths,
          risks_or_weaknesses: aiInsights.recruiter_summary.risks_or_weaknesses,
          recommended_role_level: aiInsights.recruiter_summary.recommended_role_level,
          hiring_readiness: scores.hiring_readiness,
          project_maturity_rating: scoringService.getProjectMaturityRating(repoDetails),
          portfolio_readiness: aiInsights.recruiter_summary.portfolio_readiness || 'Needs polish'
        },
        engineer_breakdown: {
          code_patterns: aiInsights.engineer_breakdown.code_patterns,
          architecture_analysis: aiInsights.engineer_breakdown.architecture_analysis,
          testing_analysis: {
            maturity: aiInsights.engineer_breakdown.testing_analysis?.maturity || 'Basic',
            test_presence: repoDetails.some(r => r.hasTests),
            test_file_ratio: repoDetails.length > 0
              ? (repoDetails.reduce((s, r) => s + (r.testFileRatio || 0), 0) / repoDetails.length).toFixed(2)
              : '0',
            test_libraries_seen: aiInsights.engineer_breakdown.testing_analysis?.test_libraries_seen || [],
            details: aiInsights.engineer_breakdown.testing_analysis?.details || ''
          },
          complexity_insights: aiInsights.engineer_breakdown.complexity_insights,
          commit_message_quality: aiInsights.engineer_breakdown.commit_message_quality || 'Fair',
          language_breakdown: language_breakdown,
          repo_level_details: repo_level_details,
          notable_implementations: aiInsights.engineer_breakdown.notable_implementations || [],
          improvement_areas: aiInsights.engineer_breakdown.improvement_areas || [],
          interview_probes: aiInsights.engineer_breakdown.interview_probes || []
        }
      };

      // Cache the response
      this._setCache(cacheKey, {
        data: response,
        timestamp: Date.now()
      });

      const duration = Date.now() - startTime;
      logger.info('Evaluation complete', { username, level: scores.overall_level, score: scores.overall_score, maxScore: 100, durationMs: duration });
      
      // Add performance warning if too slow
      if (duration > 5000) {
        logger.warn('Response time exceeded 5 seconds', { durationMs: duration });
      }

      // Check if user wants to submit to leaderboard (opt-in)
      if (req.body.submitToLeaderboard === true) {
        try {
          const leaderboardService = require('../services/leaderboardService');
          await leaderboardService.submitEntry(response, username);
          logger.info('User submitted to leaderboard', { username });
          response.leaderboard_submitted = true;
        } catch (leaderboardError) {
          logger.error('Failed to submit to leaderboard', { error: leaderboardError.message });
          // Don't fail the whole request if leaderboard submission fails
          response.leaderboard_submitted = false;
          response.leaderboard_error = leaderboardError.message;
        }
      } else {
        response.leaderboard_submitted = false;
      }
      
      res.json(response);

    } catch (error) {
      logger.error('Error evaluating developer', { error: error.message, stack: error.stack });
      
      // Handle specific error types
      if (error.message.includes('rate limit')) {
        return res.status(429).json({
          error: 'Rate limit exceeded',
          message: 'GitHub API rate limit reached. Please try again later.',
          retry_after: 900
        });
      }

      if (error.message.includes('Not Found') || error.message.includes('not found')) {
        return res.status(404).json({
          error: 'User not found',
          message: 'The specified GitHub user does not exist or has no public repositories.'
        });
      }

      if (error.message.includes('OpenAI')) {
        return res.status(503).json({
          error: 'AI service unavailable',
          message: 'The AI evaluation service is currently unavailable. Please try again later.'
        });
      }

      // Generic error response
      res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'production' 
          ? 'An unexpected error occurred while processing your request.'
          : error.message
      });
    }
  }

  /**
   * Generate notes for a repository
   * @param {Object} repo - Repository analysis
   * @returns {string} Notes
   */
  generateRepoNotes(repo) {
    const notes = [];
    
    if (repo.isComplete || (repo.hasEntryPoint && repo.hasConfig)) notes.push('Complete project');
    if (repo.testFileCount > 0) notes.push(`${repo.testFileCount} test file${repo.testFileCount > 1 ? 's' : ''}`);
    if (repo.cicdMaturity > 0) notes.push(`CI/CD (level ${repo.cicdMaturity})`);
    if (repo.uniqueFolderCount >= 3 || repo.hasGoodStructure) notes.push('Well-structured');
    if (repo.readmeQuality >= 3) notes.push('Good README');
    if (repo.hasDocumentation || repo.documentationDensity > 0.2) notes.push('Documented');
    if (repo.typeSafetyRatio > 0.5) notes.push('Type-safe');
    if (repo.frameworks.length > 0) notes.push(`Uses ${repo.frameworks.slice(0, 2).join(', ')}`);
    
    return notes.length > 0 ? notes.join(', ') : 'Basic project structure';
  }
}

/**
 * Extract username from various GitHub URL formats
 */
function extractUsernameFromUrl(url) {
  try {
    // Handle different GitHub URL formats
    const patterns = [
      /github\.com\/([^\/\?]+)/i,           // https://github.com/username
      /^([a-zA-Z0-9\-_]+)$/                // Just username
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1] && match[1] !== 'orgs') {
        return match[1];
      }
    }

    return null;
  } catch (error) {
    return null;
  }
}

module.exports = new GitHubController();
