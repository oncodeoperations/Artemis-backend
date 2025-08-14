const githubService = require('../services/githubService');
const aiService = require('../services/aiService');
const codeExtractor = require('../utils/codeExtractor');
const promptBuilder = require('../utils/promptBuilder');

/**
 * Main controller for evaluating GitHub developers
 */
class GitHubController {
  /**
   * Evaluate a developer based on their GitHub profile
   */
  async evaluateDeveloper(req, res) {
    try {
      const { githubUrl } = req.body;

      // Validate input
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

      console.log(`🔍 Starting evaluation for GitHub user: ${username}`);

      // Step 1: Fetch user's repositories
      console.log('📚 Fetching repositories...');
      const repos = await githubService.getUserRepos(username);
      
      if (!repos || repos.length === 0) {
        return res.status(404).json({
          error: 'No repositories found',
          message: 'This user has no public repositories to analyze'
        });
      }

      console.log(`📊 Found ${repos.length} repositories, analyzing top ${Math.min(repos.length, 5)}...`);

      // Step 2: Extract code from repositories (limit to first 5 for MVP)
      const reposToAnalyze = repos.slice(0, 5);
      const codeData = [];

      for (const repo of reposToAnalyze) {
        try {
          console.log(`🔎 Analyzing repository: ${repo.name}`);
          const repoFiles = await githubService.getRepoFiles(username, repo.name);
          const extractedCode = codeExtractor.extractRelevantCode(repoFiles, repo);
          
          if (extractedCode.codeSnippets.length > 0) {
            codeData.push(extractedCode);
          }
        } catch (error) {
          console.warn(`⚠️ Failed to analyze repository ${repo.name}:`, error.message);
          // Continue with other repos even if one fails
        }
      }

      if (codeData.length === 0) {
        return res.status(422).json({
          error: 'No analyzable code found',
          message: 'Unable to find suitable code files for analysis in the repositories'
        });
      }

      // Step 3: Build prompt for AI analysis
      console.log('🤖 Building AI analysis prompt...');
      const prompt = promptBuilder.buildEvaluationPrompt(username, codeData, repos);

      // Step 4: Get AI evaluation
      console.log('🧠 Sending to AI for evaluation...');
      const evaluation = await aiService.gradeDeveloper(prompt);

      // Step 5: Return results
      const response = {
        ...evaluation,
        analyzedRepos: codeData.length,
        totalRepos: repos.length,
        username,
        timestamp: new Date().toISOString()
      };

      console.log(`✅ Evaluation complete for ${username}: ${evaluation.grade}`);
      res.json(response);

    } catch (error) {
      console.error('❌ Error evaluating developer:', error);
      
      // Handle specific error types
      if (error.message.includes('rate limit')) {
        return res.status(429).json({
          error: 'Rate limit exceeded',
          message: 'GitHub API rate limit reached. Please try again later.'
        });
      }

      if (error.message.includes('Not Found')) {
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
        message: 'An unexpected error occurred while processing your request.'
      });
    }
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
