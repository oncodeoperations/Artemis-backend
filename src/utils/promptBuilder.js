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
   * @param {Object} [scores] - Pre-computed scores (optional, for enhanced prompt)
   * @param {Object} [activityData] - Activity metrics (optional)
   * @returns {string} Complete prompt for AI analysis
   */
  buildEvaluationPrompt(username, codeData, allRepos, scores, activityData) {
    const prompt = this.buildPromptSections(username, codeData, allRepos, scores, activityData);
    
    // Estimate token count and truncate if necessary
    const estimatedTokens = this.estimateTokens(prompt);
    if (estimatedTokens > 14000) { // Leave room for response
      logger.warn('Prompt exceeds token limit, truncating', { estimatedTokens });
      return this.buildTruncatedPrompt(username, codeData, allRepos, scores, activityData);
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
  buildPromptSections(username, codeData, allRepos, scores, activityData) {
    const sections = [
      this.buildHeader(),
      this.buildDeveloperOverview(username, allRepos, scores, activityData),
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
    return `Analyze the following GitHub developer's portfolio.
Base EVERY observation on specific evidence from the code samples below.
If you cannot determine something, say "Insufficient data" — do not guess.
Do NOT assess years of experience.`;
  }

  /**
   * Build developer overview section
   * @param {string} username - GitHub username
   * @param {Array} allRepos - All repositories
   * @returns {string} Developer overview
   */
  buildDeveloperOverview(username, allRepos, scores, activityData) {
    const languages = [...new Set(allRepos.map(repo => repo.language).filter(Boolean))];
    const totalStars = allRepos.reduce((sum, repo) => sum + (repo.stargazers_count || 0), 0);
    const totalForks = allRepos.reduce((sum, repo) => sum + (repo.forks_count || 0), 0);
    const recentActivity = this.analyzeRecentActivity(allRepos);

    // Build language counts string
    const langCounts = {};
    allRepos.forEach(r => { if (r.language) langCounts[r.language] = (langCounts[r.language] || 0) + 1; });
    const langSummary = Object.entries(langCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([lang, count]) => `${lang} (${count})`)
      .join(', ');

    let overview = `DEVELOPER: ${username}
REPOSITORIES: ${allRepos.length} public
PRIMARY LANGUAGES: ${langSummary || 'Not specified'}
Total Stars: ${totalStars} | Total Forks: ${totalForks}
Recent Activity: ${recentActivity}`;

    // Add activity data if available
    if (activityData) {
      overview += `\nCommits (6mo): ~${(activityData.commitsLast30Days || 0) + (activityData.commitsLast90Days || 0)} | Weeks active: ${activityData.weeksWithCommits || 0}/26 | Last commit: ${activityData.daysSinceLastCommit ?? '?'} days ago`;
    }

    // Add pre-computed scores as context (not determinant)
    if (scores) {
      overview += `\n\nPRE-COMPUTED METRICS (for context — form your own assessment from the code):
- Code Sophistication: ${scores.code_sophistication ?? '?'}/25
- Engineering Practices: ${scores.engineering_practices ?? '?'}/25
- Project Maturity: ${scores.project_maturity ?? '?'}/20
- Contribution Activity: ${scores.contribution_activity ?? '?'}/15
- Breadth & Depth: ${scores.breadth_and_depth ?? '?'}/15
- Overall: ${scores.overall_score ?? '?'}/100 (${scores.overall_level ?? '?'})`;
    }

    return overview;
  }

  /**
   * Build repository analysis section
   * @param {Array} codeData - Extracted code data
   * @returns {string} Repository analysis
   */
  buildRepositoryAnalysis(codeData) {
    let analysis = 'REPOSITORY DETAILS:\n';
    
    // Show up to 8 repositories (increased from truncated 2)
    const reposToShow = codeData.slice(0, 8);
    
    reposToShow.forEach((repo, index) => {
      analysis += `\n## ${index + 1}. ${repo.repoName} — ${repo.repoLanguage}
   Description: ${repo.repoDescription || 'No description'}
   Stars: ${repo.repoStars} | Forks: ${repo.repoForks} | Last updated: ${repo.lastUpdated || 'Unknown'}
   Files Analyzed: ${repo.analysis.totalFiles}
   Languages: ${repo.analysis.languages.join(', ')}
   Frameworks: ${repo.analysis.frameworks.join(', ') || 'None detected'}
   Patterns: ${repo.analysis.patterns.join(', ') || 'None detected'}
   Complexity: ${repo.analysis.avgComplexity.toFixed(1)}/10`;
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
    
    // Show up to 8 repos
    const reposToShow = codeData.slice(0, 8);
    
    reposToShow.forEach((repo) => {
      samples += `\n--- Repository: ${repo.repoName} ---\n`;
      
      // Select most relevant files (up to 3 per repo, including test files)
      const relevantFiles = this.selectRelevantFiles(repo.codeSnippets);
      
      relevantFiles.forEach((file, fileIndex) => {
        if (file.content && file.content.trim().length > 0) {
          const isTest = /test|spec|__tests__/i.test(file.path);
          samples += `\nFile ${fileIndex + 1}: ${file.path} (${file.language})${isTest ? ' [TEST FILE]' : ''}\n`;
          samples += `Lines: ${file.lineCount} | Complexity: ${file.complexity}/10\n`;
          samples += `Quality Indicators: ${this.formatQualityIndicators(file.codeQuality)}\n`;
          samples += '```\n';
          samples += this.truncateCode(file.content, 1500); // Increased from 800
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
Analyze the provided code samples and repository data.

For the RECRUITER perspective, focus on:
- Specific role fit (e.g., "Mid-level React/Node.js developer", not just "Full-Stack")
- Observable work patterns and reliability signals
- Portfolio readiness: would these projects impress in an interview?
- Honest risks, framed constructively

For the ENGINEER perspective, focus on:
- Specific design patterns you observe (reference file names)
- Error handling maturity and testing quality
- Complexity level: CRUD / Service architecture / Distributed / Algorithm-heavy
- 2-3 technical interview questions you would ask based on their code
- Ranked, actionable improvement priorities

Respond with ONLY valid JSON matching the response format specified in the system prompt.`;
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
  buildTruncatedPrompt(username, codeData, allRepos, scores, activityData) {
    // Use top 4 repositories and limit code samples
    const limitedCodeData = codeData.slice(0, 4);
    
    // Reduce code sample sizes
    limitedCodeData.forEach(repo => {
      repo.codeSnippets = repo.codeSnippets.slice(0, 2);
      repo.codeSnippets.forEach(file => {
        file.content = this.truncateCode(file.content, 800);
      });
    });

    const sections = [
      this.buildHeader(),
      this.buildDeveloperOverview(username, allRepos, scores, activityData),
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
