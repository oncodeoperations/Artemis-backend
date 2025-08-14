const axios = require('axios');

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
   * Get user's public repositories
   * @param {string} username - GitHub username
   * @returns {Array} Array of repository objects
   */
  async getUserRepos(username) {
    try {
      const response = await this.client.get(`/users/${username}/repos`, {
        params: {
          type: 'public',
          sort: 'updated',
          direction: 'desc',
          per_page: 10 // Limit to 10 most recent repos
        }
      });

      return response.data.map(repo => ({
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
        disabled: repo.disabled
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
            console.warn(`Failed to fetch file ${file.path}:`, error.message);
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
        name: response.data.name,
        bio: response.data.bio,
        location: response.data.location,
        company: response.data.company,
        blog: response.data.blog,
        public_repos: response.data.public_repos,
        followers: response.data.followers,
        following: response.data.following,
        created_at: response.data.created_at,
        updated_at: response.data.updated_at
      };
    } catch (error) {
      console.warn(`Failed to fetch user profile: ${error.message}`);
      return null;
    }
  }
}

module.exports = new GitHubService();
