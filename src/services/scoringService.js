/**
 * Service for calculating developer scores based on GitHub data
 * Implements scoring logic from BACKEND_SPEC.md
 */
class ScoringService {
  /**
   * Calculate all scores for a developer
   * @param {Object} profile - User profile data
   * @param {Array} repos - Repositories array
   * @param {Array} repoDetails - Detailed repository analysis
   * @param {Object} activityData - Activity metrics
   * @returns {Object} Complete scores object
   */
  calculateScores(profile, repos, repoDetails, activityData) {
    const scores = {
      code_quality: this.calculateCodeQuality(repoDetails),
      project_diversity: this.calculateProjectDiversity(repoDetails),
      activity: this.calculateActivity(activityData),
      architecture: this.calculateArchitecture(repoDetails),
      repo_quality: this.calculateRepoQuality(repos, repoDetails),
      professionalism: this.calculateProfessionalism(profile, repoDetails)
    };

    const overall_score = Object.values(scores).reduce((sum, score) => sum + score, 0);
    const overall_level = this.classifyLevel(overall_score);
    
    return {
      overall_level,
      overall_score: Math.round(overall_score),
      job_readiness_score: this.calculateJobReadiness(scores),
      tech_depth_score: this.calculateTechDepth(scores),
      ...scores
    };
  }

  /**
   * Calculate Code Quality score (0-20)
   * Based on: tests, structure, commits, style, documentation, code smells
   */
  calculateCodeQuality(repoDetails) {
    let score = 0;
    let repoCount = 0;

    for (const repo of repoDetails) {
      let repoScore = 0;

      // Tests exist (+4)
      if (repo.hasTests) {
        repoScore += 4;
      }

      // Readable folder structure (+4)
      if (repo.hasGoodStructure) {
        repoScore += 4;
      }

      // Meaningful commits (+3)
      if (repo.meaningfulCommitsRatio > 0.4) {
        repoScore += 3;
      }

      // Clean code style (+3)
      if (repo.hasConsistentStyle) {
        repoScore += 3;
      }

      // Documentation exists (+3)
      if (repo.hasDocumentation) {
        repoScore += 3;
      }

      // Low code smells (+3)
      if (!repo.hasCodeSmells) {
        repoScore += 3;
      }

      score += repoScore;
      repoCount++;
    }

    // Average across analyzed repos
    const avgScore = repoCount > 0 ? score / repoCount : 0;
    return Math.min(20, Math.round(avgScore));
  }

  /**
   * Calculate Project Diversity score (0-20)
   * Based on: tech stack breadth (10) + project type variation (10)
   */
  calculateProjectDiversity(repoDetails) {
    let techStackScore = 0;
    let projectTypeScore = 0;

    // Collect all technologies
    const technologies = {
      frontend: new Set(),
      backend: new Set(),
      database: new Set(),
      api: new Set(),
      devops: new Set()
    };

    const projectTypes = {
      webApp: false,
      api: false,
      cli: false,
      library: false,
      mobile: false
    };

    // Analyze each repo
    for (const repo of repoDetails) {
      // Tech stack detection
      if (repo.frameworks) {
        repo.frameworks.forEach(fw => {
          const fwLower = fw.toLowerCase();
          // Frontend
          if (['react', 'vue', 'angular', 'svelte', 'next'].some(t => fwLower.includes(t))) {
            technologies.frontend.add(fw);
          }
          // Backend
          if (['node', 'express', 'django', 'flask', 'spring', 'rails', 'laravel'].some(t => fwLower.includes(t))) {
            technologies.backend.add(fw);
          }
          // Database
          if (['sql', 'mongo', 'postgres', 'mysql', 'redis', 'firebase'].some(t => fwLower.includes(t))) {
            technologies.database.add(fw);
          }
          // API
          if (['rest', 'graphql', 'api', 'grpc'].some(t => fwLower.includes(t))) {
            technologies.api.add(fw);
          }
          // DevOps
          if (['docker', 'kubernetes', 'k8s', 'aws', 'azure', 'gcp'].some(t => fwLower.includes(t))) {
            technologies.devops.add(fw);
          }
        });
      }

      // Project type detection
      const name = repo.name.toLowerCase();
      const desc = (repo.description || '').toLowerCase();
      
      if (desc.includes('web') || desc.includes('app') || ['react', 'vue', 'angular'].some(t => desc.includes(t))) {
        projectTypes.webApp = true;
      }
      if (desc.includes('api') || desc.includes('rest') || desc.includes('graphql')) {
        projectTypes.api = true;
      }
      if (desc.includes('cli') || desc.includes('command') || desc.includes('tool')) {
        projectTypes.cli = true;
      }
      if (desc.includes('library') || desc.includes('package') || desc.includes('sdk')) {
        projectTypes.library = true;
      }
      if (desc.includes('mobile') || desc.includes('ios') || desc.includes('android')) {
        projectTypes.mobile = true;
      }
    }

    // Calculate tech stack score (0-10)
    if (technologies.frontend.size > 0) techStackScore += 2;
    if (technologies.backend.size > 0) techStackScore += 2;
    if (technologies.database.size > 0) techStackScore += 2;
    if (technologies.api.size > 0) techStackScore += 2;
    if (technologies.devops.size > 0) techStackScore += 2;

    // Calculate project type score (0-10)
    if (projectTypes.webApp) projectTypeScore += 2;
    if (projectTypes.api) projectTypeScore += 2;
    if (projectTypes.cli) projectTypeScore += 2;
    if (projectTypes.library) projectTypeScore += 2;
    if (projectTypes.mobile) projectTypeScore += 2;

    return techStackScore + projectTypeScore;
  }

  /**
   * Calculate Activity score (0-20)
   * Based on: recent activity (10) + consistency (10)
   */
  calculateActivity(activityData) {
    let score = 0;

    // Recent activity (0-10)
    if (activityData.commitsLast30Days > 10) {
      score += 10;
    } else if (activityData.commitsLast90Days > 20) {
      score += 5;
    }

    // Consistency (0-10)
    const weeksWithCommits = activityData.weeksWithCommits || 0;
    if (weeksWithCommits > 20) {  // ~80% of weeks in 6 months
      score += 10;
    } else if (weeksWithCommits > 13) {  // ~50% of weeks
      score += 5;
    } else if (weeksWithCommits > 6) {  // ~25% of weeks
      score += 2;
    }

    return Math.min(20, score);
  }

  /**
   * Calculate Architecture score (0-20)
   * Based on: MVC pattern, modular structure, separation of concerns, reusable components, services
   */
  calculateArchitecture(repoDetails) {
    let score = 0;
    let repoCount = 0;

    for (const repo of repoDetails) {
      let repoScore = 0;

      // MVC/MVVM pattern (+5)
      if (repo.hasMVCPattern) {
        repoScore += 5;
      }

      // Modular structure (+5)
      if (repo.hasModularStructure) {
        repoScore += 5;
      }

      // Separation of concerns (+4)
      if (repo.hasSeparationOfConcerns) {
        repoScore += 4;
      }

      // Reusable components (+3)
      if (repo.hasReusableComponents) {
        repoScore += 3;
      }

      // Services/Utils structure (+3)
      if (repo.hasServicesLayer) {
        repoScore += 3;
      }

      score += repoScore;
      repoCount++;
    }

    const avgScore = repoCount > 0 ? score / repoCount : 0;
    return Math.min(20, Math.round(avgScore));
  }

  /**
   * Calculate Repository Quality score (0-20)
   * Based on: complete project, CI/CD, well-structured, community engagement
   */
  calculateRepoQuality(repos, repoDetails) {
    let score = 0;
    let repoCount = 0;

    for (let i = 0; i < repoDetails.length; i++) {
      const repo = repos[i];
      const details = repoDetails[i];
      let repoScore = 0;

      // Complete project (+5)
      if (details.isComplete) {
        repoScore += 5;
      }

      // CI/CD pipelines (+5)
      if (details.hasCICD) {
        repoScore += 5;
      }

      // Well-structured repo (+5)
      if (details.isWellStructured) {
        repoScore += 5;
      }

      // Community engagement (+5)
      const stars = repo.stargazers_count || 0;
      const forks = repo.forks_count || 0;
      if (stars > 5 || forks > 2) {
        repoScore += 5;
      }

      score += repoScore;
      repoCount++;
    }

    const avgScore = repoCount > 0 ? score / repoCount : 0;
    return Math.min(20, Math.round(avgScore));
  }

  /**
   * Calculate Professionalism score (0-10)
   * Based on: profile completeness, README quality, community engagement, documentation
   */
  calculateProfessionalism(profile, repoDetails) {
    let score = 0;

    // Profile completeness (+3)
    let profileScore = 0;
    if (profile.name) profileScore += 1;
    if (profile.bio) profileScore += 1;
    if (profile.location) profileScore += 0.5;
    if (profile.avatar) profileScore += 0.5;
    score += Math.min(3, profileScore);

    // README quality (+3)
    const reposWithGoodREADME = repoDetails.filter(r => r.hasGoodREADME).length;
    const readmeScore = (reposWithGoodREADME / repoDetails.length) * 3;
    score += readmeScore;

    // Community engagement (+2)
    if (profile.followers > 10 || profile.following > 5) {
      score += 2;
    } else if (profile.followers > 5) {
      score += 1;
    }

    // Documentation clarity (+2)
    const reposWithDocs = repoDetails.filter(r => r.hasDocumentation).length;
    const docsScore = (reposWithDocs / repoDetails.length) * 2;
    score += docsScore;

    return Math.min(10, Math.round(score));
  }

  /**
   * Classify skill level based on overall score
   * @param {number} score - Overall score (0-110)
   * @returns {string} Skill level
   */
  classifyLevel(score) {
    if (score >= 96) return 'Expert';
    if (score >= 76) return 'Senior';
    if (score >= 41) return 'Intermediate';
    return 'Beginner';
  }

  /**
   * Calculate job readiness score (0-100)
   * Weighted average focusing on practical skills
   */
  calculateJobReadiness(scores) {
    const weights = {
      code_quality: 0.25,
      project_diversity: 0.20,
      activity: 0.15,
      architecture: 0.20,
      repo_quality: 0.15,
      professionalism: 0.05
    };

    let weightedSum = 0;
    let maxWeightedSum = 0;

    Object.keys(weights).forEach(key => {
      const maxScore = key === 'professionalism' ? 10 : 20;
      weightedSum += (scores[key] / maxScore) * weights[key];
      maxWeightedSum += weights[key];
    });

    return Math.round((weightedSum / maxWeightedSum) * 100);
  }

  /**
   * Calculate technical depth score (0-100)
   * Focuses on architecture and code quality
   */
  calculateTechDepth(scores) {
    const weights = {
      architecture: 0.35,
      code_quality: 0.35,
      project_diversity: 0.30
    };

    let weightedSum = 0;
    let maxWeightedSum = 0;

    Object.keys(weights).forEach(key => {
      const maxScore = 20;
      weightedSum += (scores[key] / maxScore) * weights[key];
      maxWeightedSum += weights[key];
    });

    return Math.round((weightedSum / maxWeightedSum) * 100);
  }

  /**
   * Generate hiring recommendation based on overall score
   * @param {number} overallScore - Overall score (0-110)
   * @returns {string} Hiring recommendation
   */
  getHiringRecommendation(overallScore) {
    if (overallScore >= 85) return 'Strong Yes';
    if (overallScore >= 70) return 'Yes';
    if (overallScore >= 50) return 'Maybe';
    return 'No';
  }

  /**
   * Get project maturity rating
   * @param {Array} repoDetails - Repository details
   * @returns {string} Maturity rating
   */
  getProjectMaturityRating(repoDetails) {
    const completeRepos = repoDetails.filter(r => r.isComplete).length;
    const cicdRepos = repoDetails.filter(r => r.hasCICD).length;
    const wellStructured = repoDetails.filter(r => r.isWellStructured).length;

    const score = (completeRepos + cicdRepos + wellStructured) / (repoDetails.length * 3);

    if (score >= 0.75) return 'Excellent';
    if (score >= 0.5) return 'Good';
    if (score >= 0.25) return 'Moderate';
    return 'Low';
  }
}

module.exports = new ScoringService();
