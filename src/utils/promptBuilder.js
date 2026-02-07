const logger = require('./logger');

/**
 * Utility for building AI analysis prompts from extracted code data
 */
class PromptBuilder {
  /**
   * Build a comprehensive evaluation prompt for OpenAI
   * @param {string} username - GitHub username
   * @param {Array} codeData - Array of extracted code data from repositories
   * @param {Array} allRepos - All repositories metadata
   * @returns {string} Complete prompt for AI analysis
   */
  buildEvaluationPrompt(username, codeData, allRepos) {
    const prompt = this.buildPromptSections(username, codeData, allRepos);
    
    // Estimate token count and truncate if necessary
    const estimatedTokens = this.estimateTokens(prompt);
    if (estimatedTokens > 12000) { // Leave room for response
      logger.warn('Prompt exceeds token limit, truncating', { estimatedTokens });
      return this.buildTruncatedPrompt(username, codeData, allRepos);
    }
    
    return prompt;
  }

  /**
   * Build all sections of the evaluation prompt
   * @param {string} username - GitHub username
   * @param {Array} codeData - Extracted code data
   * @param {Array} allRepos - All repositories
   * @returns {string} Complete prompt
   */
  buildPromptSections(username, codeData, allRepos) {
    const sections = [
      this.buildHeader(),
      this.buildDeveloperOverview(username, allRepos),
      this.buildRepositoryAnalysis(codeData),
      this.buildCodeSamples(codeData),
      this.buildInstructions()
    ];

    return sections.join('\n\n');
  }

  /**
   * Build the prompt header
   * @returns {string} Header section
   */
  buildHeader() {
    return `You are an expert senior software engineer and technical interviewer.
Analyze the following GitHub developer's work and grade them as Beginner, Intermediate, or Advanced.

GRADING CRITERIA:
• Beginner (0-2 years equivalent): Basic syntax, simple scripts, minimal structure, few best practices
• Intermediate (2-5 years equivalent): Good structure, some patterns, error handling, readable code, basic testing  
• Advanced (5+ years equivalent): Excellent architecture, design patterns, comprehensive testing, documentation, performance optimization, complex problem-solving

ANALYSIS FOCUS:
1. Code structure and organization
2. Use of design patterns and best practices
3. Error handling and edge cases
4. Code readability and maintainability
5. Testing and documentation quality
6. Project complexity and technical depth
7. Consistency across repositories
8. Modern language features and frameworks`;
  }

  /**
   * Build developer overview section
   * @param {string} username - GitHub username
   * @param {Array} allRepos - All repositories
   * @returns {string} Developer overview
   */
  buildDeveloperOverview(username, allRepos) {
    const languages = [...new Set(allRepos.map(repo => repo.language).filter(Boolean))];
    const totalStars = allRepos.reduce((sum, repo) => sum + (repo.stargazers_count || 0), 0);
    const totalForks = allRepos.reduce((sum, repo) => sum + (repo.forks_count || 0), 0);
    const recentActivity = this.analyzeRecentActivity(allRepos);

    return `DEVELOPER PROFILE:
Username: ${username}
Total Public Repositories: ${allRepos.length}
Primary Languages: ${languages.slice(0, 5).join(', ') || 'Not specified'}
Total Stars Received: ${totalStars}
Total Forks: ${totalForks}
Recent Activity: ${recentActivity}`;
  }

  /**
   * Build repository analysis section
   * @param {Array} codeData - Extracted code data
   * @returns {string} Repository analysis
   */
  buildRepositoryAnalysis(codeData) {
    let analysis = 'REPOSITORY ANALYSIS:\n';
    
    codeData.forEach((repo, index) => {
      const repoInfo = this.summarizeRepository(repo);
      analysis += `\n${index + 1}. ${repo.repoName}
   Description: ${repo.repoDescription || 'No description'}
   Primary Language: ${repo.repoLanguage}
   Stars: ${repo.repoStars} | Forks: ${repo.repoForks}
   Files Analyzed: ${repo.analysis.totalFiles}
   Languages Used: ${repo.analysis.languages.join(', ')}
   Frameworks: ${repo.analysis.frameworks.join(', ') || 'None detected'}
   Patterns Detected: ${repo.analysis.patterns.join(', ') || 'None detected'}
   Complexity Score: ${repo.analysis.avgComplexity.toFixed(1)}/10`;
    });

    return analysis;
  }

  /**
   * Build code samples section
   * @param {Array} codeData - Extracted code data
   * @returns {string} Code samples
   */
  buildCodeSamples(codeData) {
    let samples = 'CODE SAMPLES:\n';
    
    codeData.forEach((repo, repoIndex) => {
      samples += `\n--- Repository: ${repo.repoName} ---\n`;
      
      // Select most relevant files for each repository
      const relevantFiles = this.selectRelevantFiles(repo.codeSnippets);
      
      relevantFiles.forEach((file, fileIndex) => {
        if (file.content && file.content.trim().length > 0) {
          samples += `\nFile ${fileIndex + 1}: ${file.path} (${file.language})\n`;
          samples += `Lines: ${file.lineCount} | Complexity: ${file.complexity}/10\n`;
          samples += `Quality Indicators: ${this.formatQualityIndicators(file.codeQuality)}\n`;
          samples += '```\n';
          samples += this.truncateCode(file.content, 800); // Limit code length
          samples += '\n```\n';
        }
      });
    });

    return samples;
  }

  /**
   * Build instruction section
   * @returns {string} Instructions
   */
  buildInstructions() {
    return `INSTRUCTIONS:
Analyze the provided code and repository data. Consider:
- Overall code quality and architecture
- Use of best practices and modern features
- Project complexity and scope
- Consistency across different repositories
- Evidence of testing, documentation, and error handling

Respond with ONLY valid JSON in this exact format:
{
  "grade": "Beginner|Intermediate|Advanced",
  "reasoning": "2-3 sentence explanation of the grade decision based on specific code observations",
  "strengths": ["specific strength 1", "specific strength 2", "specific strength 3"],
  "weaknesses": ["specific weakness 1", "specific weakness 2", "specific weakness 3"],
  "suggestions": ["actionable suggestion 1", "actionable suggestion 2", "actionable suggestion 3"]
}`;
  }

  /**
   * Analyze recent activity patterns
   * @param {Array} repos - Repository data
   * @returns {string} Activity summary
   */
  analyzeRecentActivity(repos) {
    const now = new Date();
    const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());

    const recentRepos = repos.filter(repo => new Date(repo.updated_at) > oneMonthAgo);
    const activeRepos = repos.filter(repo => new Date(repo.updated_at) > sixMonthsAgo);

    if (recentRepos.length > 0) {
      return `${recentRepos.length} repositories updated in last month`;
    } else if (activeRepos.length > 0) {
      return `${activeRepos.length} repositories updated in last 6 months`;
    } else {
      return 'Low recent activity';
    }
  }

  /**
   * Summarize repository characteristics
   * @param {Object} repo - Repository data
   * @returns {Object} Repository summary
   */
  summarizeRepository(repo) {
    return {
      complexity: repo.analysis.avgComplexity,
      languages: repo.analysis.languages.length,
      frameworks: repo.analysis.frameworks.length,
      patterns: repo.analysis.patterns.length,
      quality: this.calculateOverallQuality(repo.codeSnippets)
    };
  }

  /**
   * Select most relevant files from a repository
   * @param {Array} files - Array of file data
   * @returns {Array} Selected relevant files
   */
  selectRelevantFiles(files) {
    // Sort files by relevance score
    const scoredFiles = files.map(file => ({
      ...file,
      relevanceScore: this.calculateRelevanceScore(file)
    }));

    scoredFiles.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Return top 3 most relevant files per repository
    return scoredFiles.slice(0, 3);
  }

  /**
   * Calculate relevance score for a file
   * @param {Object} file - File data
   * @returns {number} Relevance score
   */
  calculateRelevanceScore(file) {
    let score = 0;

    // Language importance
    const importantLanguages = ['JavaScript', 'TypeScript', 'Python', 'Java', 'C++'];
    if (importantLanguages.includes(file.language)) {
      score += 3;
    }

    // Complexity bonus
    score += file.complexity * 0.5;

    // Size consideration (prefer medium-sized files)
    if (file.lineCount > 20 && file.lineCount < 200) {
      score += 2;
    }

    // Framework usage
    score += file.frameworks.length * 0.5;

    // Pattern usage
    score += file.patterns.length * 0.3;

    // Quality indicators
    const quality = file.codeQuality;
    if (quality.hasComments) score += 0.5;
    if (quality.hasErrorHandling) score += 1;
    if (quality.hasTests) score += 1;
    if (quality.usesModernSyntax) score += 0.5;
    if (quality.hasTypeDefinitions) score += 0.5;
    if (quality.isWellStructured) score += 1;

    return score;
  }

  /**
   * Format code quality indicators
   * @param {Object} quality - Quality indicators object
   * @returns {string} Formatted quality string
   */
  formatQualityIndicators(quality) {
    const indicators = [];
    if (quality.hasComments) indicators.push('Comments');
    if (quality.hasErrorHandling) indicators.push('Error Handling');
    if (quality.hasTests) indicators.push('Tests');
    if (quality.usesModernSyntax) indicators.push('Modern Syntax');
    if (quality.hasTypeDefinitions) indicators.push('Type Definitions');
    if (quality.isWellStructured) indicators.push('Well Structured');
    
    return indicators.length > 0 ? indicators.join(', ') : 'Basic';
  }

  /**
   * Calculate overall quality score for repository
   * @param {Array} files - Array of file data
   * @returns {number} Quality score (0-10)
   */
  calculateOverallQuality(files) {
    if (files.length === 0) return 0;

    const totalScore = files.reduce((sum, file) => {
      const quality = file.codeQuality;
      let fileScore = 0;
      
      if (quality.hasComments) fileScore += 1;
      if (quality.hasErrorHandling) fileScore += 2;
      if (quality.hasTests) fileScore += 2;
      if (quality.usesModernSyntax) fileScore += 1;
      if (quality.hasTypeDefinitions) fileScore += 1;
      if (quality.isWellStructured) fileScore += 3;
      
      return sum + fileScore;
    }, 0);

    return Math.min(Math.round((totalScore / files.length)), 10);
  }

  /**
   * Truncate code to specified character limit
   * @param {string} code - Code content
   * @param {number} maxLength - Maximum character length
   * @returns {string} Truncated code
   */
  truncateCode(code, maxLength) {
    if (code.length <= maxLength) {
      return code;
    }

    const truncated = code.substring(0, maxLength);
    const lastNewline = truncated.lastIndexOf('\n');
    
    return lastNewline > 0 
      ? truncated.substring(0, lastNewline) + '\n// ... (truncated for analysis)'
      : truncated + '\n// ... (truncated for analysis)';
  }

  /**
   * Build a truncated version of the prompt if it's too long
   * @param {string} username - GitHub username  
   * @param {Array} codeData - Extracted code data
   * @param {Array} allRepos - All repositories
   * @returns {string} Truncated prompt
   */
  buildTruncatedPrompt(username, codeData, allRepos) {
    // Use only top 2 repositories and limit code samples
    const limitedCodeData = codeData.slice(0, 2);
    
    // Reduce code sample sizes
    limitedCodeData.forEach(repo => {
      repo.codeSnippets = repo.codeSnippets.slice(0, 2);
      repo.codeSnippets.forEach(file => {
        file.content = this.truncateCode(file.content, 400);
      });
    });

    const sections = [
      this.buildHeader(),
      this.buildDeveloperOverview(username, allRepos),
      this.buildRepositoryAnalysis(limitedCodeData),
      this.buildCodeSamples(limitedCodeData),
      this.buildInstructions()
    ];

    return sections.join('\n\n');
  }

  /**
   * Estimate token count for text (rough approximation)
   * @param {string} text - Text to estimate
   * @returns {number} Estimated token count
   */
  estimateTokens(text) {
    // Rough approximation: 1 token ≈ 4 characters for English text
    // For code, it might be closer to 3 characters per token
    return Math.ceil(text.length / 3.5);
  }
}

module.exports = new PromptBuilder();
