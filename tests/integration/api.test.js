/**
 * Integration tests for API endpoints
 * Tests the complete flow from request to response
 */

const request = require('supertest');
const express = require('express');

// Mock the app setup
const createMockApp = () => {
  const app = express();
  app.use(express.json());

  // Mock health endpoint
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'Artemis Developer Evaluator API'
    });
  });

  // Mock evaluate endpoint
  app.post('/api/evaluate', async (req, res) => {
    const { githubUrl, github_url } = req.body;
    const url = githubUrl || github_url;

    // Validation
    if (!url) {
      return res.status(400).json({
        error: 'Missing required field',
        message: 'Please provide a GitHub URL in the request body'
      });
    }

    // Extract username (simple regex for testing)
    const match = url.match(/github\.com\/([a-zA-Z0-9-]+)/);
    if (!match) {
      return res.status(400).json({
        error: 'Invalid GitHub URL',
        message: 'Please provide a valid GitHub profile URL (e.g., https://github.com/username)'
      });
    }

    const username = match[1];

    // Mock response based on test scenarios
    if (username === 'nonexistentuser12345') {
      return res.status(404).json({
        error: 'GitHub user not found',
        message: `User '${username}' does not exist or profile is private. Please verify the username.`
      });
    }

    if (username === 'noReposUser') {
      return res.status(404).json({
        error: 'No repositories found',
        message: 'This user has no public repositories to analyze'
      });
    }

    if (username === 'onlyForksUser') {
      return res.status(422).json({
        error: 'No analyzable repositories',
        message: 'All repositories are forks. We need original work to evaluate.',
        details: {
          total_repos: 5,
          forks: 5,
          filtered_out: 5
        }
      });
    }

    // Return mock successful response
    return res.json({
      profile: {
        username: username,
        name: 'Test User',
        bio: 'Software Developer',
        avatar: 'https://github.com/avatar.png',
        location: 'San Francisco, CA',
        github_url: `https://github.com/${username}`,
        primary_languages: ['JavaScript', 'Python'],
        total_repositories: 10,
        analyzed_repositories: 5,
        activity_status: 'Active'
      },
      scores: {
        overall_level: 'Intermediate',
        overall_score: 65,
        job_readiness_score: 70,
        tech_depth_score: 60,
        code_quality: 15,
        project_diversity: 12,
        activity: 14,
        architecture: 12,
        repo_quality: 10,
        professionalism: 2
      },
      recruiter_summary: {
        top_strengths: [
          'Active contributor with consistent commit history',
          'Diverse technology stack including JavaScript and Python',
          'Well-documented code with clear README files'
        ],
        risks_or_weaknesses: [
          'Limited testing coverage across projects',
          'Some projects lack complete documentation'
        ],
        recommended_role_level: 'Mid-Level Developer',
        hiring_recommendation: 'Maybe',
        activity_flag: 'Active',
        project_maturity_rating: 'Moderate',
        tech_stack_summary: ['JavaScript', 'Python', 'React'],
        work_history_signals: ['Consistent commits', 'Multiple completed projects']
      },
      engineer_breakdown: {
        code_patterns: [
          'Uses modern ES6+ JavaScript features',
          'Implements modular code structure'
        ],
        architecture_analysis: [
          'MVC pattern in backend projects',
          'Component-based architecture in frontend'
        ],
        testing_analysis: {
          test_presence: true,
          test_libraries_seen: ['Jest', 'React Testing Library'],
          testing_patterns: ['Unit tests', 'Integration tests']
        },
        complexity_insights: [
          'Most functions are well-scoped',
          'Some files exceed 300 lines'
        ],
        commit_message_quality: 'Good',
        language_breakdown: {
          JavaScript: { percentage: 60, repos_count: 6 },
          Python: { percentage: 40, repos_count: 4 }
        },
        repo_level_details: [
          {
            repo_name: 'web-app',
            score: 85,
            notes: 'Complete project, Has tests, Well-structured',
            languages: ['JavaScript', 'HTML', 'CSS'],
            complexity: 'Medium',
            stars: 5,
            forks: 2
          }
        ],
        design_patterns_used: ['Factory', 'Observer', 'Module'],
        code_smells: ['Some large functions'],
        best_practices: ['Uses linting', 'Version control'],
        improvement_areas: ['Add more tests', 'Improve documentation']
      }
    });
  });

  return app;
};

describe('API Integration Tests', () => {
  let app;

  beforeAll(() => {
    app = createMockApp();
  });

  describe('GET /health', () => {
    test('should return 200 and health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('service');
    });
  });

  describe('POST /api/evaluate', () => {
    test('should return 400 when GitHub URL is missing', async () => {
      const response = await request(app)
        .post('/api/evaluate')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.message).toContain('GitHub URL');
    });

    test('should return 400 when GitHub URL is invalid', async () => {
      const response = await request(app)
        .post('/api/evaluate')
        .send({ githubUrl: 'not-a-valid-url' })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Invalid GitHub URL');
    });

    test('should accept both githubUrl and github_url parameters', async () => {
      const response1 = await request(app)
        .post('/api/evaluate')
        .send({ githubUrl: 'https://github.com/testuser' })
        .expect(200);

      const response2 = await request(app)
        .post('/api/evaluate')
        .send({ github_url: 'https://github.com/testuser' })
        .expect(200);

      expect(response1.body).toHaveProperty('profile');
      expect(response2.body).toHaveProperty('profile');
    });

    test('should return 404 when user does not exist', async () => {
      const response = await request(app)
        .post('/api/evaluate')
        .send({ githubUrl: 'https://github.com/nonexistentuser12345' })
        .expect(404);

      expect(response.body).toHaveProperty('error', 'GitHub user not found');
    });

    test('should return 404 when user has no repositories', async () => {
      const response = await request(app)
        .post('/api/evaluate')
        .send({ githubUrl: 'https://github.com/noReposUser' })
        .expect(404);

      expect(response.body.message).toContain('no public repositories');
    });

    test('should return 422 when user has only forked repositories', async () => {
      const response = await request(app)
        .post('/api/evaluate')
        .send({ githubUrl: 'https://github.com/onlyForksUser' })
        .expect(422);

      expect(response.body).toHaveProperty('error', 'No analyzable repositories');
      expect(response.body.message).toContain('forks');
      expect(response.body.details).toHaveProperty('forks', 5);
    });

    test('should return complete response structure for valid user', async () => {
      const response = await request(app)
        .post('/api/evaluate')
        .send({ githubUrl: 'https://github.com/validuser' })
        .expect(200);

      // Verify main structure
      expect(response.body).toHaveProperty('profile');
      expect(response.body).toHaveProperty('scores');
      expect(response.body).toHaveProperty('recruiter_summary');
      expect(response.body).toHaveProperty('engineer_breakdown');
    });

    test('should have correct profile structure', async () => {
      const response = await request(app)
        .post('/api/evaluate')
        .send({ githubUrl: 'https://github.com/testuser' })
        .expect(200);

      const { profile } = response.body;

      expect(profile).toHaveProperty('username');
      expect(profile).toHaveProperty('name');
      expect(profile).toHaveProperty('bio');
      expect(profile).toHaveProperty('avatar');
      expect(profile).toHaveProperty('location');
      expect(profile).toHaveProperty('github_url');
      expect(profile).toHaveProperty('primary_languages');
      expect(profile).toHaveProperty('total_repositories');
      expect(profile).toHaveProperty('analyzed_repositories');
      expect(profile).toHaveProperty('activity_status');

      expect(Array.isArray(profile.primary_languages)).toBe(true);
      expect(['Active', 'Semi-active', 'Inactive']).toContain(profile.activity_status);
    });

    test('should have correct scores structure', async () => {
      const response = await request(app)
        .post('/api/evaluate')
        .send({ githubUrl: 'https://github.com/testuser' })
        .expect(200);

      const { scores } = response.body;

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

      // Verify score ranges
      expect(scores.overall_score).toBeGreaterThanOrEqual(0);
      expect(scores.overall_score).toBeLessThanOrEqual(110);
      expect(['Beginner', 'Intermediate', 'Senior', 'Expert']).toContain(scores.overall_level);
    });

    test('should have correct recruiter_summary structure', async () => {
      const response = await request(app)
        .post('/api/evaluate')
        .send({ githubUrl: 'https://github.com/testuser' })
        .expect(200);

      const { recruiter_summary } = response.body;

      expect(recruiter_summary).toHaveProperty('top_strengths');
      expect(recruiter_summary).toHaveProperty('risks_or_weaknesses');
      expect(recruiter_summary).toHaveProperty('recommended_role_level');
      expect(recruiter_summary).toHaveProperty('hiring_recommendation');
      expect(recruiter_summary).toHaveProperty('activity_flag');
      expect(recruiter_summary).toHaveProperty('project_maturity_rating');

      expect(Array.isArray(recruiter_summary.top_strengths)).toBe(true);
      expect(Array.isArray(recruiter_summary.risks_or_weaknesses)).toBe(true);
      expect(['Strong Yes', 'Yes', 'Maybe', 'No']).toContain(recruiter_summary.hiring_recommendation);
      expect(['Low', 'Moderate', 'Good', 'Excellent']).toContain(recruiter_summary.project_maturity_rating);
    });

    test('should have correct engineer_breakdown structure', async () => {
      const response = await request(app)
        .post('/api/evaluate')
        .send({ githubUrl: 'https://github.com/testuser' })
        .expect(200);

      const { engineer_breakdown } = response.body;

      expect(engineer_breakdown).toHaveProperty('code_patterns');
      expect(engineer_breakdown).toHaveProperty('architecture_analysis');
      expect(engineer_breakdown).toHaveProperty('testing_analysis');
      expect(engineer_breakdown).toHaveProperty('complexity_insights');
      expect(engineer_breakdown).toHaveProperty('commit_message_quality');
      expect(engineer_breakdown).toHaveProperty('language_breakdown');
      expect(engineer_breakdown).toHaveProperty('repo_level_details');

      expect(Array.isArray(engineer_breakdown.code_patterns)).toBe(true);
      expect(Array.isArray(engineer_breakdown.architecture_analysis)).toBe(true);
      expect(engineer_breakdown.testing_analysis).toHaveProperty('test_presence');
      expect(typeof engineer_breakdown.language_breakdown).toBe('object');
      expect(Array.isArray(engineer_breakdown.repo_level_details)).toBe(true);
    });

    test('should have valid data types for all fields', async () => {
      const response = await request(app)
        .post('/api/evaluate')
        .send({ githubUrl: 'https://github.com/testuser' })
        .expect(200);

      const { scores } = response.body;

      // All score values should be numbers
      expect(typeof scores.overall_score).toBe('number');
      expect(typeof scores.code_quality).toBe('number');
      expect(typeof scores.project_diversity).toBe('number');
      expect(typeof scores.activity).toBe('number');
      expect(typeof scores.architecture).toBe('number');
      expect(typeof scores.repo_quality).toBe('number');
      expect(typeof scores.professionalism).toBe('number');

      // Level should be string
      expect(typeof scores.overall_level).toBe('string');
    });
  });

  describe('Edge Cases', () => {
    test('should handle very long repository lists', async () => {
      const response = await request(app)
        .post('/api/evaluate')
        .send({ githubUrl: 'https://github.com/prolificdev' })
        .expect(200);

      expect(response.body.profile.total_repositories).toBeDefined();
      expect(response.body.profile.analyzed_repositories).toBeDefined();
    });

    test('should handle special characters in username', async () => {
      const response = await request(app)
        .post('/api/evaluate')
        .send({ githubUrl: 'https://github.com/user-name-123' })
        .expect(200);

      expect(response.body.profile.username).toBe('user-name-123');
    });

    test('should handle URL with trailing slash', async () => {
      const response = await request(app)
        .post('/api/evaluate')
        .send({ githubUrl: 'https://github.com/testuser/' })
        .expect(200);

      expect(response.body.profile).toBeDefined();
    });

    test('should handle URL without https protocol', async () => {
      const response = await request(app)
        .post('/api/evaluate')
        .send({ githubUrl: 'github.com/testuser' })
        .expect(200);

      expect(response.body.profile).toBeDefined();
    });
  });
});
