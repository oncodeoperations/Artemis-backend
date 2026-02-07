/**
 * Service for calculating developer scores based on GitHub data
 * Redesigned: 5-category, 100-point gradient scoring system
 *
 * Categories:
 *   Code Sophistication  (25)  – actual code complexity, language features, abstraction
 *   Engineering Practices (25)  – testing, CI/CD, documentation, config, reviews
 *   Project Maturity      (20)  – completeness, README, config, community readiness
 *   Contribution Activity (15)  – recency, consistency, commit quality, volume
 *   Breadth & Depth       (15)  – language diversity, domain coverage, stack depth
 */
class ScoringService {
  /**
   * Calculate all scores for a developer (new 100-point system)
   * @param {Object} profile - User profile data
   * @param {Array}  repos - Filtered quality repositories
   * @param {Array}  repoDetails - Detailed analysis from codeExtractor (ratio-based)
   * @param {Object} activityData - Commit activity metrics
   * @returns {Object} Complete scores object
   */
  calculateScores(profile, repos, repoDetails, activityData) {
    const scores = {
      code_sophistication: this.calculateCodeSophistication(repoDetails),
      engineering_practices: this.calculateEngineeringPractices(repoDetails),
      project_maturity: this.calculateProjectMaturity(repoDetails),
      contribution_activity: this.calculateContributionActivity(activityData),
      breadth_and_depth: this.calculateBreadthAndDepth(repos, repoDetails)
    };

    const overall_score = Math.round(
      scores.code_sophistication +
      scores.engineering_practices +
      scores.project_maturity +
      scores.contribution_activity +
      scores.breadth_and_depth
    );

    const overall_level = this.classifyLevel(overall_score);

    return {
      overall_level,
      overall_score,
      job_readiness_score: this.calculateJobReadiness(scores),
      tech_depth_score: this.calculateTechDepth(scores),
      hiring_readiness: this.getHiringReadiness(overall_score),
      ...scores,
      // Provide category_scores in the shape the leaderboard / frontend expects
      category_scores: {
        code_sophistication: round2(scores.code_sophistication),
        engineering_practices: round2(scores.engineering_practices),
        project_maturity: round2(scores.project_maturity),
        contribution_activity: round2(scores.contribution_activity),
        breadth_and_depth: round2(scores.breadth_and_depth)
      }
    };
  }

  // ──────────────────────────────────────────────
  // 1. Code Sophistication (0-25)
  // ──────────────────────────────────────────────
  calculateCodeSophistication(repoDetails) {
    if (repoDetails.length === 0) return 0;

    let total = 0;
    for (const repo of repoDetails) {
      let repoScore = 0;

      // Abstraction / complexity level (0-7)
      // avgComplexity is 0-10 from codeExtractor; scale to 0-7
      repoScore += Math.min(7, (repo.avgComplexity || 0) * 0.7);

      // Error handling density (0-5)
      // 0% → 0, 100% → 5
      repoScore += (repo.errorHandlingDensity || 0) * 5;

      // Modern language features (0-5)
      repoScore += (repo.modernSyntaxRatio || 0) * 5;

      // Type safety (0-4)
      repoScore += (repo.typeSafetyRatio || 0) * 4;

      // DRY / modularity (0-4)
      // Ideal avg file size is 50-300 lines → score 4; <20 or >500 → lower
      const avg = repo.avgFileSize || 0;
      let modScore = 0;
      if (avg >= 50 && avg <= 300) modScore = 4;
      else if (avg >= 30 && avg <= 500) modScore = 3;
      else if (avg >= 15 && avg <= 700) modScore = 2;
      else if (avg > 0) modScore = 1;
      repoScore += modScore;

      total += Math.min(25, repoScore);
    }

    return round2(total / repoDetails.length);
  }

  // ──────────────────────────────────────────────
  // 2. Engineering Practices (0-25)
  // ──────────────────────────────────────────────
  calculateEngineeringPractices(repoDetails) {
    if (repoDetails.length === 0) return 0;

    let total = 0;
    for (const repo of repoDetails) {
      let repoScore = 0;

      // Test coverage breadth (0-8)
      // testFileRatio scaled + bonus for test file count
      const testBase = Math.min(1, (repo.testFileRatio || 0) * 3); // boost low ratios
      const testCountBonus = Math.min(1, (repo.testFileCount || 0) / 10); // up to 10 test files
      repoScore += (testBase * 0.6 + testCountBonus * 0.4) * 8;

      // CI/CD maturity (0-5)
      // cicdMaturity is 0-3 from codeExtractor
      const cicdMap = { 0: 0, 1: 2, 2: 3.5, 3: 5 };
      repoScore += cicdMap[repo.cicdMaturity] || 0;

      // Documentation quality (0-5)
      // Blend of documentation density + comment density
      const docScore = ((repo.documentationDensity || 0) * 0.6 + (repo.commentDensity || 0) * 0.4) * 5;
      repoScore += Math.min(5, docScore);

      // Dependency management (0-3)
      let depScore = 0;
      if (repo.hasLockfile) depScore += 1;
      if (repo.hasConfig) depScore += 1;
      if (repo.hasBuildScript) depScore += 1;
      repoScore += depScore;

      // Code review / branching signals (0-4)
      // Score lint config + env config + gitignore as proxy for engineering culture
      let reviewScore = 0;
      if (repo.hasLintConfig) reviewScore += 1.5;
      if (repo.hasEnvConfig) reviewScore += 1.5;
      if (repo.hasGitignore) reviewScore += 1;
      repoScore += Math.min(4, reviewScore);

      total += Math.min(25, repoScore);
    }

    return round2(total / repoDetails.length);
  }

  // ──────────────────────────────────────────────
  // 3. Project Maturity (0-20)
  // ──────────────────────────────────────────────
  calculateProjectMaturity(repoDetails) {
    if (repoDetails.length === 0) return 0;

    let total = 0;
    for (const repo of repoDetails) {
      let repoScore = 0;

      // Completeness (0-5) — gradient based on multiple signals
      let completeness = 0;
      if (repo.hasEntryPoint) completeness += 1;
      if (repo.hasConfig) completeness += 1;
      if (repo.sourceFileCount > 10) completeness += 1;
      else if (repo.sourceFileCount > 5) completeness += 0.5;
      if (repo.hasBuildScript) completeness += 1;
      if (repo.totalFileCount > 15) completeness += 1;
      else if (repo.totalFileCount > 8) completeness += 0.5;
      repoScore += Math.min(5, completeness);

      // README quality (0-5)
      repoScore += Math.min(5, repo.readmeQuality || 0);

      // Configuration (0-4)
      let configScore = 0;
      if (repo.hasEnvConfig) configScore += 1.5;
      if (repo.hasLintConfig) configScore += 1.5;
      if (repo.hasGitignore) configScore += 1;
      repoScore += Math.min(4, configScore);

      // Community readiness (0-3)
      let communityScore = 0;
      if (repo.hasLicense) communityScore += 1;
      if (repo.hasContributing) communityScore += 1;
      if (repo.hasChangelog) communityScore += 1;
      repoScore += communityScore;

      // Release maturity (0-3)
      // Using folder depth and structure maturity as proxy
      let releaseScore = 0;
      if (repo.uniqueFolderCount >= 5) releaseScore += 1;
      if (repo.maxFolderDepth >= 3) releaseScore += 1;
      if (repo.frameworks.length >= 2) releaseScore += 1;
      repoScore += Math.min(3, releaseScore);

      total += Math.min(20, repoScore);
    }

    return round2(total / repoDetails.length);
  }

  // ──────────────────────────────────────────────
  // 4. Contribution Activity (0-15)
  // ──────────────────────────────────────────────
  calculateContributionActivity(activityData) {
    let score = 0;

    // Recency — smooth decay (0-5)
    const daysSinceLastCommit = activityData.daysSinceLastCommit ?? 365;
    if (daysSinceLastCommit <= 7) score += 5;
    else if (daysSinceLastCommit <= 14) score += 4.5;
    else if (daysSinceLastCommit <= 30) score += 4;
    else if (daysSinceLastCommit <= 60) score += 3;
    else if (daysSinceLastCommit <= 90) score += 2;
    else if (daysSinceLastCommit <= 180) score += 1;
    // >180 days = 0

    // Consistency — weeks active / 26 (0-5)
    const weeksActive = activityData.weeksWithCommits || 0;
    const consistencyRatio = weeksActive / 26;
    if (consistencyRatio > 0.7) score += 5;
    else if (consistencyRatio > 0.5) score += 4;
    else if (consistencyRatio > 0.3) score += 3;
    else if (consistencyRatio > 0.15) score += 1.5;
    else if (consistencyRatio > 0) score += 0.5;

    // Commit message quality (0-3)
    const msgQuality = activityData.commitMessageQuality ?? 0; // 0-1 ratio from githubService
    score += msgQuality * 3;

    // Volume — normalized, least weight (0-2)
    const totalCommits = (activityData.commitsLast30Days || 0) + (activityData.commitsLast90Days || 0);
    if (totalCommits > 100) score += 2;
    else if (totalCommits > 50) score += 1.5;
    else if (totalCommits > 20) score += 1;
    else if (totalCommits > 5) score += 0.5;

    return round2(Math.min(15, score));
  }

  // ──────────────────────────────────────────────
  // 5. Breadth & Depth (0-15)
  // ──────────────────────────────────────────────
  calculateBreadthAndDepth(repos, repoDetails) {
    let score = 0;

    // Language diversity — diminishing returns (0-6)
    const languages = new Set();
    repoDetails.forEach(r => (r.languages || []).forEach(l => languages.add(l)));
    repos.forEach(r => { if (r.language) languages.add(r.language); });
    const langCount = languages.size;
    if (langCount >= 5) score += 6;
    else if (langCount === 4) score += 5;
    else if (langCount === 3) score += 4;
    else if (langCount === 2) score += 2;
    else if (langCount === 1) score += 1;

    // Domain coverage (0-5)
    // Detect domains from repo names, descriptions, frameworks
    const domains = new Set();
    for (const repo of repoDetails) {
      const nameDesc = `${repo.name || ''} ${repo.description || ''} ${(repo.frameworks || []).join(' ')}`.toLowerCase();
      if (/react|vue|angular|svelte|next|frontend|tailwind|css|html|ui|component/.test(nameDesc)) domains.add('frontend');
      if (/express|django|flask|fastapi|spring|rails|api|server|backend|graphql|rest/.test(nameDesc)) domains.add('backend');
      if (/cli|command|terminal|argv|script/.test(nameDesc)) domains.add('cli');
      if (/library|package|sdk|npm|pip|gem|crate/.test(nameDesc)) domains.add('library');
      if (/mobile|ios|android|react.native|flutter|swift|kotlin/.test(nameDesc)) domains.add('mobile');
      if (/ml|machine.learning|tensorflow|pytorch|pandas|numpy|data|jupyter|notebook/.test(nameDesc)) domains.add('data-ml');
      if (/docker|kubernetes|k8s|ci.cd|deploy|terraform|ansible|devops|infrast/.test(nameDesc)) domains.add('devops');
    }
    score += Math.min(5, domains.size * 1.25);

    // Stack depth (0-4)
    let stackScore = 0;
    if (domains.has('frontend') && domains.has('backend')) stackScore += 2;
    else if (domains.has('frontend') || domains.has('backend')) stackScore += 1;
    const allFrameworks = new Set();
    repoDetails.forEach(r => (r.frameworks || []).forEach(f => allFrameworks.add(f.toLowerCase())));
    if (['mongo', 'mongoose', 'sql', 'postgres', 'mysql', 'redis', 'firebase', 'prisma', 'sequelize', 'typeorm']
        .some(db => [...allFrameworks].some(f => f.includes(db)))) {
      stackScore += 1;
    }
    if (domains.has('devops')) stackScore += 1;
    score += Math.min(4, stackScore);

    return round2(Math.min(15, score));
  }

  // ──────────────────────────────────────────────
  // Level classification (new 5-level, 0-100)
  // ──────────────────────────────────────────────
  classifyLevel(score) {
    if (score >= 85) return 'Expert';
    if (score >= 70) return 'Senior';
    if (score >= 50) return 'Mid-Level';
    if (score >= 30) return 'Junior';
    return 'Entry';
  }

  // ──────────────────────────────────────────────
  // Hiring readiness (displayed to recruiters)
  // ──────────────────────────────────────────────
  getHiringReadiness(overallScore) {
    if (overallScore >= 80) return 'Strong Hire';
    if (overallScore >= 65) return 'Hire';
    if (overallScore >= 45) return 'Consider';
    return 'Develop';
  }

  /** @deprecated Use getHiringReadiness instead */
  getHiringRecommendation(overallScore) {
    return this.getHiringReadiness(overallScore);
  }

  // ──────────────────────────────────────────────
  // Derived convenience scores
  // ──────────────────────────────────────────────
  calculateJobReadiness(scores) {
    const weights = {
      code_sophistication: 0.25,
      engineering_practices: 0.25,
      project_maturity: 0.20,
      contribution_activity: 0.15,
      breadth_and_depth: 0.15
    };
    const maxes = {
      code_sophistication: 25,
      engineering_practices: 25,
      project_maturity: 20,
      contribution_activity: 15,
      breadth_and_depth: 15
    };

    let weighted = 0;
    for (const [key, weight] of Object.entries(weights)) {
      weighted += (scores[key] / maxes[key]) * weight;
    }
    return Math.round(weighted * 100);
  }

  calculateTechDepth(scores) {
    const weights = {
      code_sophistication: 0.40,
      engineering_practices: 0.35,
      breadth_and_depth: 0.25
    };
    const maxes = {
      code_sophistication: 25,
      engineering_practices: 25,
      breadth_and_depth: 15
    };

    let weighted = 0;
    for (const [key, weight] of Object.entries(weights)) {
      weighted += (scores[key] / maxes[key]) * weight;
    }
    return Math.round(weighted * 100);
  }

  /**
   * Get project maturity rating label
   * @param {Array} repoDetails - Repository details
   * @returns {string} Maturity rating
   */
  getProjectMaturityRating(repoDetails) {
    if (repoDetails.length === 0) return 'Low';

    let sum = 0;
    for (const r of repoDetails) {
      let s = 0;
      if (r.isComplete || (r.hasEntryPoint && r.hasConfig)) s++;
      if (r.cicdMaturity > 0) s++;
      if (r.uniqueFolderCount >= 3 || r.isWellStructured) s++;
      sum += s;
    }
    const ratio = sum / (repoDetails.length * 3);

    if (ratio >= 0.75) return 'Excellent';
    if (ratio >= 0.5) return 'Good';
    if (ratio >= 0.25) return 'Moderate';
    return 'Low';
  }
}

/** Round to 2 decimal places */
function round2(n) {
  return Math.round(n * 100) / 100;
}

module.exports = new ScoringService();
