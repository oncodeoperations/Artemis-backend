/**
 * Unit tests for Scoring Service
 * Tests all 6 scoring categories and level classification
 */

const scoringService = require('../../src/services/scoringService');

describe('ScoringService', () => {
  describe('calculateScores', () => {
    test('should return complete scores object with all required fields', () => {
      const mockProfile = {
        username: 'testuser',
        name: 'Test User',
        bio: 'Test bio',
        public_repos: 10
      };

      const mockRepos = [
        { name: 'repo1', language: 'JavaScript', stargazers_count: 5, size: 100 },
        { name: 'repo2', language: 'Python', stargazers_count: 10, size: 200 }
      ];

      const mockRepoDetails = [
        {
          name: 'repo1',
          hasTests: true,
          hasGoodStructure: true,
          meaningfulCommitsRatio: 0.8,
          hasConsistentStyle: true,
          hasDocumentation: true,
          hasCodeSmells: false,
          frameworks: ['React', 'Express'],
          hasMVCPattern: true,
          hasModularStructure: true,
          hasSeparationOfConcerns: true,
          hasReusableComponents: true,
          hasServicesLayer: true,
          isComplete: true,
          hasCICD: true,
          isWellStructured: true,
          hasGoodREADME: true,
          languages: ['JavaScript']
        }
      ];

      const mockActivityData = {
        commitsLast30Days: 20,
        commitsLast90Days: 50,
        weeksWithCommits: 10,
        activityStatus: 'Active'
      };

      const scores = scoringService.calculateScores(
        mockProfile,
        mockRepos,
        mockRepoDetails,
        mockActivityData
      );

      expect(scores).toHaveProperty('overall_level');
      expect(scores).toHaveProperty('overall_score');
      expect(scores).toHaveProperty('job_readiness_score');
      expect(scores).toHaveProperty('tech_depth_score');
      expect(scores).toHaveProperty('code_quality');
      expect(scores).toHaveProperty('project_diversity');
      expect(scores).toHaveProperty('activity');
      expect(scores).toHaveProperty('architecture');
      expect(scores).toHaveProperty('repo_quality');
      expect(scores).toHaveProperty('professionalism');
    });

    test('should calculate overall score within valid range (0-110)', () => {
      const mockProfile = { username: 'test', public_repos: 5 };
      const mockRepos = [{ name: 'test-repo', language: 'JavaScript', size: 100 }];
      const mockRepoDetails = [{
        name: 'test-repo',
        hasTests: false,
        hasGoodStructure: false,
        meaningfulCommitsRatio: 0.5,
        hasConsistentStyle: false,
        hasDocumentation: false,
        hasCodeSmells: true,
        frameworks: [],
        hasMVCPattern: false,
        hasModularStructure: false,
        hasSeparationOfConcerns: false,
        hasReusableComponents: false,
        hasServicesLayer: false,
        isComplete: false,
        hasCICD: false,
        isWellStructured: false,
        hasGoodREADME: false,
        languages: ['JavaScript']
      }];
      const mockActivityData = {
        commitsLast30Days: 5,
        commitsLast90Days: 10,
        weeksWithCommits: 3,
        activityStatus: 'Semi-active'
      };

      const scores = scoringService.calculateScores(mockProfile, mockRepos, mockRepoDetails, mockActivityData);

      expect(scores.overall_score).toBeGreaterThanOrEqual(0);
      expect(scores.overall_score).toBeLessThanOrEqual(110);
    });
  });

  describe('calculateCodeQuality', () => {
    test('should award full points (20) for excellent code quality', () => {
      const excellentRepoDetails = [{
        hasTests: true,
        hasGoodStructure: true,
        meaningfulCommitsRatio: 0.9,
        hasConsistentStyle: true,
        hasDocumentation: true,
        hasCodeSmells: false
      }];

      const score = scoringService.calculateCodeQuality(excellentRepoDetails);
      expect(score).toBe(20);
    });

    test('should award low points for poor code quality', () => {
      const poorRepoDetails = [{
        hasTests: false,
        hasGoodStructure: false,
        meaningfulCommitsRatio: 0.2,
        hasConsistentStyle: false,
        hasDocumentation: false,
        hasCodeSmells: true
      }];

      const score = scoringService.calculateCodeQuality(poorRepoDetails);
      expect(score).toBeLessThan(10);
    });

    test('should handle empty repository details', () => {
      const score = scoringService.calculateCodeQuality([]);
      expect(score).toBe(0);
    });
  });

  describe('calculateProjectDiversity', () => {
    test('should award points for diverse tech stack', () => {
      const diverseRepoDetails = [
        { name: 'webapp', frameworks: ['React', 'Node.js', 'Express'], languages: ['JavaScript'], description: 'web app' },
        { name: 'api', frameworks: ['Django', 'PostgreSQL'], languages: ['Python'], description: 'REST API' },
        { name: 'backend', frameworks: ['Spring Boot'], languages: ['Java'], description: 'microservice' }
      ];

      const score = scoringService.calculateProjectDiversity(diverseRepoDetails);
      expect(score).toBeGreaterThanOrEqual(10);
    });

    test('should award low points for limited diversity', () => {
      const limitedRepoDetails = [
        { name: 'app1', frameworks: ['React'], languages: ['JavaScript'], description: 'app' },
        { name: 'app2', frameworks: ['React'], languages: ['JavaScript'], description: 'app' }
      ];

      const score = scoringService.calculateProjectDiversity(limitedRepoDetails);
      expect(score).toBeLessThan(15);
    });
  });

  describe('calculateActivity', () => {
    test('should award high points for active developers', () => {
      const activeData = {
        commitsLast30Days: 30,
        commitsLast90Days: 100,
        weeksWithCommits: 12,
        activityStatus: 'Active'
      };

      const score = scoringService.calculateActivity(activeData);
      expect(score).toBeGreaterThanOrEqual(12);
    });

    test('should award low points for inactive developers', () => {
      const inactiveData = {
        commitsLast30Days: 0,
        commitsLast90Days: 2,
        weeksWithCommits: 1,
        activityStatus: 'Inactive'
      };

      const score = scoringService.calculateActivity(inactiveData);
      expect(score).toBeLessThan(8);
    });
  });

  describe('calculateArchitecture', () => {
    test('should award full points for excellent architecture', () => {
      const excellentArchitecture = [{
        hasMVCPattern: true,
        hasModularStructure: true,
        hasSeparationOfConcerns: true,
        hasReusableComponents: true,
        hasServicesLayer: true
      }];

      const score = scoringService.calculateArchitecture(excellentArchitecture);
      expect(score).toBe(20);
    });

    test('should award low points for poor architecture', () => {
      const poorArchitecture = [{
        hasMVCPattern: false,
        hasModularStructure: false,
        hasSeparationOfConcerns: false,
        hasReusableComponents: false,
        hasServicesLayer: false
      }];

      const score = scoringService.calculateArchitecture(poorArchitecture);
      expect(score).toBeLessThan(5);
    });
  });

  describe('calculateRepoQuality', () => {
    test('should award high points for quality repositories', () => {
      const qualityRepos = [
        { name: 'repo1', stargazers_count: 50, size: 500 },
        { name: 'repo2', stargazers_count: 30, size: 300 }
      ];

      const qualityDetails = [
        { isComplete: true, hasCICD: true, isWellStructured: true, hasGoodREADME: true },
        { isComplete: true, hasCICD: true, isWellStructured: true, hasGoodREADME: true }
      ];

      const score = scoringService.calculateRepoQuality(qualityRepos, qualityDetails);
      expect(score).toBeGreaterThan(15);
    });
  });

  describe('calculateProfessionalism', () => {
    test('should award high points for professional profile', () => {
      const professionalProfile = {
        name: 'John Doe',
        bio: 'Senior Software Engineer with 10 years experience',
        location: 'San Francisco, CA'
      };

      const professionalRepoDetails = [
        { hasGoodREADME: true, hasDocumentation: true }
      ];

      const score = scoringService.calculateProfessionalism(professionalProfile, professionalRepoDetails);
      expect(score).toBeGreaterThan(5);
    });

    test('should award low points for minimal profile', () => {
      const minimalProfile = {
        username: 'user123'
      };

      const minimalRepoDetails = [
        { hasGoodREADME: false, hasDocumentation: false }
      ];

      const score = scoringService.calculateProfessionalism(minimalProfile, minimalRepoDetails);
      expect(score).toBeLessThan(5);
    });
  });

  describe('classifyLevel', () => {
    test('should classify as Beginner for score 0-40', () => {
      expect(scoringService.classifyLevel(0)).toBe('Beginner');
      expect(scoringService.classifyLevel(20)).toBe('Beginner');
      expect(scoringService.classifyLevel(40)).toBe('Beginner');
    });

    test('should classify as Intermediate for score 41-75', () => {
      expect(scoringService.classifyLevel(41)).toBe('Intermediate');
      expect(scoringService.classifyLevel(60)).toBe('Intermediate');
      expect(scoringService.classifyLevel(75)).toBe('Intermediate');
    });

    test('should classify as Senior for score 76-95', () => {
      expect(scoringService.classifyLevel(76)).toBe('Senior');
      expect(scoringService.classifyLevel(85)).toBe('Senior');
      expect(scoringService.classifyLevel(95)).toBe('Senior');
    });

    test('should classify as Expert for score 96-110', () => {
      expect(scoringService.classifyLevel(96)).toBe('Expert');
      expect(scoringService.classifyLevel(100)).toBe('Expert');
      expect(scoringService.classifyLevel(110)).toBe('Expert');
    });
  });

  describe('getHiringRecommendation', () => {
    test('should return "Strong Yes" for expert scores', () => {
      expect(scoringService.getHiringRecommendation(100)).toBe('Strong Yes');
      expect(scoringService.getHiringRecommendation(96)).toBe('Strong Yes');
    });

    test('should return "Strong Yes" or "Yes" for high scores', () => {
      const result85 = scoringService.getHiringRecommendation(85);
      expect(['Strong Yes', 'Yes']).toContain(result85);
      expect(scoringService.getHiringRecommendation(76)).toBe('Yes');
    });

    test('should return "Maybe" or "No" for intermediate/low scores', () => {
      expect(scoringService.getHiringRecommendation(60)).toBe('Maybe');
      const result41 = scoringService.getHiringRecommendation(41);
      expect(['Maybe', 'No']).toContain(result41);
    });

    test('should return "No" for beginner scores', () => {
      expect(scoringService.getHiringRecommendation(30)).toBe('No');
      expect(scoringService.getHiringRecommendation(0)).toBe('No');
    });
  });

  describe('getProjectMaturityRating', () => {
    test('should return high maturity rating for quality projects', () => {
      const matureProjects = [
        { isComplete: true, hasCICD: true, hasTests: true, hasGoodREADME: true },
        { isComplete: true, hasCICD: true, hasTests: true, hasGoodREADME: true }
      ];

      const rating = scoringService.getProjectMaturityRating(matureProjects);
      expect(['Good', 'Excellent']).toContain(rating);
    });

    test('should return "Low" for immature projects', () => {
      const immatureProjects = [
        { isComplete: false, hasCICD: false, hasTests: false, hasGoodREADME: false }
      ];

      expect(scoringService.getProjectMaturityRating(immatureProjects)).toBe('Low');
    });
  });
});
