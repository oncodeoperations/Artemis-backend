const axios = require('axios');
const logger = require('../utils/logger');

/**
 * Service for interacting with GitHub API
 */
class GitHubService {
  constructor() {
    this.baseURL = 'https://api.github.com';
    this.token = process.env.GITHUB_TOKEN;
    
    // Create axios instance with default config
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Authorization': `token ${this.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Artemis-Developer-Evaluator/1.0'
      },
      timeout: 30000 // 30 seconds timeout
    });
  }

  /**
   * Get user's public repositories with pagination
   * @param {string} username - GitHub username
   * @returns {Array} Array of repository objects
   */
  async getUserRepos(username) {
    try {
      let allRepos = [];
      let page = 1;
      const perPage = 100;
      let hasMore = true;

      // Fetch all repos with pagination (max 300 repos to avoid excessive API calls)
      while (hasMore && page <= 3) {
        const response = await this.client.get(`/users/${username}/repos`, {
          params: {
            type: 'public',
            sort: 'updated',
            direction: 'desc',
            per_page: perPage,
            page: page
          }
        });

        if (response.data.length === 0) {
          hasMore = false;
        } else {
          allRepos = allRepos.concat(response.data);
          if (response.data.length < perPage) {
            hasMore = false;
          }
          page++;
        }
      }

      return allRepos.map(repo => ({
        name: repo.name,
        description: repo.description,
        language: repo.language,
        stargazers_count: repo.stargazers_count,
        forks_count: repo.forks_count,
        size: repo.size,
        updated_at: repo.updated_at,
        created_at: repo.created_at,
        topics: repo.topics || [],
        default_branch: repo.default_branch || 'main',
        has_issues: repo.has_issues,
        has_wiki: repo.has_wiki,
        archived: repo.archived,
        disabled: repo.disabled,
        fork: repo.fork || false,
        open_issues_count: repo.open_issues_count || 0
      }));
    } catch (error) {
      if (error.response?.status === 404) {
        throw new Error(`GitHub user '${username}' not found`);
      }
      if (error.response?.status === 403) {
        throw new Error('GitHub API rate limit exceeded');
      }
      throw new Error(`Failed to fetch repositories: ${error.message}`);
    }
  }

  /**
   * Get repository file structure and content
   * @param {string} username - GitHub username
   * @param {string} repoName - Repository name
   * @returns {Array} Array of file objects with content
   */
  async getRepoFiles(username, repoName) {
    try {
      // Get repository tree
      const treeResponse = await this.client.get(`/repos/${username}/${repoName}/git/trees/HEAD`, {
        params: { recursive: 1 }
      });

      const tree = treeResponse.data.tree;
      
      // Filter for code files we want to analyze
      const codeFiles = tree.filter(item => 
        item.type === 'blob' && 
        this.isRelevantCodeFile(item.path) &&
        item.size < 50000 // Skip large files (>50KB)
      );

      // Limit number of files to analyze (prevent API overuse)
      const filesToFetch = codeFiles.slice(0, 15);
      
      // Fetch file contents
      const fileContents = await Promise.all(
        filesToFetch.map(async (file) => {
          try {
            const content = await this.getFileContent(username, repoName, file.path);
            return {
              path: file.path,
              content: content,
              size: file.size,
              sha: file.sha
            };
          } catch (error) {
            logger.warn('Failed to fetch file from repository', { 
              file: file.path, 
              username, 
              repo: repoName, 
              error: error.message 
            });
            return null;
          }
        })
      );

      // Filter out failed fetches
      return fileContents.filter(file => file !== null);

    } catch (error) {
      if (error.response?.status === 404) {
        throw new Error(`Repository '${username}/${repoName}' not found or empty`);
      }
      throw new Error(`Failed to fetch repository files: ${error.message}`);
    }
  }

  /**
   * Get content of a specific file
   * @param {string} username - GitHub username
   * @param {string} repoName - Repository name
   * @param {string} filePath - Path to the file
   * @returns {string} File content
   */
  async getFileContent(username, repoName, filePath) {
    try {
      const response = await this.client.get(`/repos/${username}/${repoName}/contents/${filePath}`);
      
      if (response.data.content) {
        // Decode base64 content
        const content = Buffer.from(response.data.content, 'base64').toString('utf-8');
        
        // Limit content length to first 150 lines to stay within token limits
        const lines = content.split('\n');
        if (lines.length > 150) {
          return lines.slice(0, 150).join('\n') + '\n// ... (truncated for analysis)';
        }
        
        return content;
      }
      
      return '';
    } catch (error) {
      throw new Error(`Failed to fetch file content: ${error.message}`);
    }
  }

  /**
   * Check if a file is relevant for code analysis
   * @param {string} filePath - File path
   * @returns {boolean} Whether file should be analyzed
   */
  isRelevantCodeFile(filePath) {
    // File extensions we want to analyze
    const relevantExtensions = [
      '.js', '.jsx', '.ts', '.tsx',           // JavaScript/TypeScript
      '.py',                                   // Python
      '.java',                                 // Java
      '.cpp', '.c', '.cc', '.cxx',            // C/C++
      '.cs',                                   // C#
      '.go',                                   // Go
      '.rs',                                   // Rust
      '.php',                                  // PHP
      '.rb',                                   // Ruby
      '.swift',                                // Swift
      '.kt',                                   // Kotlin
      '.dart',                                 // Dart
      '.scala',                                // Scala
      '.clj',                                  // Clojure
      '.hs',                                   // Haskell
      '.elm',                                  // Elm
      '.vue',                                  // Vue
      '.svelte'                                // Svelte
    ];

    // Directories/files to exclude
    const excludePatterns = [
      'node_modules',
      'dist',
      'build',
      'coverage',
      '.git',
      'vendor',
      'target',
      '__pycache__',
      '.next',
      '.nuxt',
      'public',
      'assets',
      'images',
      'img',
      'fonts',
      'test',
      'tests',
      '__tests__',
      'spec',
      '.test.',
      '.spec.',
      'mock',
      'fixture',
      'example',
      'demo',
      'docs',
      'documentation',
      'README',
      'LICENSE',
      'CHANGELOG',
      '.env',
      'package-lock.json',
      'yarn.lock',
      'Gemfile.lock'
    ];

    // Check if file has relevant extension
    const hasRelevantExtension = relevantExtensions.some(ext => 
      filePath.toLowerCase().endsWith(ext)
    );

    // Check if file path contains excluded patterns
    const isExcluded = excludePatterns.some(pattern => 
      filePath.toLowerCase().includes(pattern.toLowerCase())
    );

    // Include important config files even if they don't have typical extensions
    const importantFiles = [
      'package.json',
      'tsconfig.json',
      'webpack.config.js',
      'babel.config.js',
      '.eslintrc',
      'Dockerfile',
      'docker-compose.yml'
    ];

    const isImportantFile = importantFiles.some(file => 
      filePath.toLowerCase().includes(file.toLowerCase())
    );

    return (hasRelevantExtension || isImportantFile) && !isExcluded;
  }

  /**
   * Get user profile information
   * @param {string} username - GitHub username
   * @returns {Object} User profile data
   */
  async getUserProfile(username) {
    try {
      const response = await this.client.get(`/users/${username}`);
      return {
        username: response.data.login,
        name: response.data.name || username,
        bio: response.data.bio || '',
        avatar: response.data.avatar_url || '',
        location: response.data.location || '',
        github_url: response.data.html_url,
        company: response.data.company,
        blog: response.data.blog,
        public_repos: response.data.public_repos,
        followers: response.data.followers,
        following: response.data.following,
        created_at: response.data.created_at,
        updated_at: response.data.updated_at
      };
    } catch (error) {
      if (error.response?.status === 401) {
        throw new Error('GitHub API authentication failed. Please check your GITHUB_TOKEN in the .env file. Generate a new token at https://github.com/settings/tokens with "public_repo" and "read:user" scopes.');
      }
      if (error.response?.status === 404) {
        throw new Error(`GitHub user '${username}' not found`);
      }
      if (error.response?.status === 403) {
        throw new Error('GitHub API rate limit exceeded. Please wait or use an authenticated token.');
      }
      logger.warn('Failed to fetch user profile from GitHub', { username, error: error.message });
      throw error;
    }
  }

  /**
   * Get user's commit activity for activity analysis
   * @param {string} username - GitHub username
   * @param {Array} repos - User's repositories
   * @returns {Object} Activity data
   */
  async getCommitActivity(username, repos) {
    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);

      let commitsLast30Days = 0;
      let commitsLast90Days = 0;
      const weeklyCommits = new Map();

      // Sample up to 10 most recent repos for activity
      const reposToCheck = repos.slice(0, 10);

      for (const repo of reposToCheck) {
        try {
          const commits = await this.client.get(`/repos/${username}/${repo.name}/commits`, {
            params: {
              author: username,
              since: sixMonthsAgo.toISOString(),
              per_page: 100
            }
          });

          commits.data.forEach(commit => {
            const commitDate = new Date(commit.commit.author.date);
            
            if (commitDate >= thirtyDaysAgo) {
              commitsLast30Days++;
            }
            if (commitDate >= ninetyDaysAgo) {
              commitsLast90Days++;
            }

            // Track weekly commits
            const weekKey = this.getWeekKey(commitDate);
            weeklyCommits.set(weekKey, (weeklyCommits.get(weekKey) || 0) + 1);
          });
        } catch (error) {
          logger.warn(`Failed to fetch commits for ${repo.name}`, { error: error.message });
        }
      }

      // Determine activity status
      let activityStatus = 'Inactive';
      if (commitsLast30Days > 0) {
        activityStatus = 'Active';
      } else if (commitsLast90Days > 0) {
        activityStatus = 'Semi-active';
      }

      return {
        commitsLast30Days,
        commitsLast90Days,
        weeksWithCommits: weeklyCommits.size,
        activityStatus
      };
    } catch (error) {
      logger.warn('Failed to fetch commit activity', { error: error.message });
      return {
        commitsLast30Days: 0,
        commitsLast90Days: 0,
        weeksWithCommits: 0,
        activityStatus: 'Inactive'
      };
    }
  }

  /**
   * Get week key for commit grouping
   * @param {Date} date - Commit date
   * @returns {string} Week identifier
   */
  getWeekKey(date) {
    const year = date.getFullYear();
    const week = Math.floor((date - new Date(year, 0, 1)) / (7 * 24 * 60 * 60 * 1000));
    return `${year}-W${week}`;
  }

  /**
   * Filter repositories to analyze (remove forks, low-quality repos, etc.)
   * Implements BACKEND_SPEC.md repository filtering logic
   * @param {Array} repos - All repositories
   * @param {string} username - GitHub username
   * @returns {Array} Filtered repositories
   */
  filterRepositories(repos, username) {
    return repos.filter(repo => this.shouldAnalyzeRepo(repo));
  }

  /**
   * Determine if a repository should be analyzed
   * @param {Object} repo - Repository object
   * @returns {boolean} Whether to analyze
   */
  shouldAnalyzeRepo(repo) {
    // Skip forks (CHECKLIST: filter forks ✓)
    if (repo.fork) {
      return false;
    }

    // Skip archived repos
    if (repo.archived) {
      return false;
    }

    // Skip disabled repos
    if (repo.disabled) {
      return false;
    }

    // Skip empty or very small repos (CHECKLIST: <5 files ~ 10KB ✓)
    if (repo.size < 10) {  // Less than 10KB
      return false;
    }

    // Skip repos with school assignment patterns (CHECKLIST: school assignments ✓)
    const assignmentPatterns = /assignment|lab\d+|project\d+|homework|cs\d+|course|class\d+|school|university/i;
    if (assignmentPatterns.test(repo.name) || assignmentPatterns.test(repo.description || '')) {
      return false;
    }

    // Skip auto-generated repos (CHECKLIST: auto-generated ✓)
    const autoGenPatterns = /generated by|created by github|template|boilerplate|starter/i;
    if (repo.description && autoGenPatterns.test(repo.description.toLowerCase())) {
      return false;
    }

    // Skip very old repos with no recent activity
    const createdDate = new Date(repo.created_at);
    const updatedDate = new Date(repo.updated_at);
    const now = new Date();
    
    const ageYears = (now - createdDate) / (365 * 24 * 60 * 60 * 1000);
    const daysSinceUpdate = (now - updatedDate) / (24 * 60 * 60 * 1000);
    
    if (ageYears > 5 && daysSinceUpdate > 730) {  // 2 years
      return false;
    }

    return true;
  }
}

module.exports = new GitHubService();
