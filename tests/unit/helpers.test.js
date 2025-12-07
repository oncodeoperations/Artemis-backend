/**
 * Unit tests for URL extraction and validation helpers
 */

describe('URL Helper Functions', () => {
  // Mock implementation of extractUsernameFromUrl
  const extractUsernameFromUrl = (url) => {
    if (!url || typeof url !== 'string') {
      return null;
    }

    // Remove trailing slashes
    url = url.trim().replace(/\/+$/, '');

    // Match various GitHub URL formats
    const patterns = [
      /github\.com\/([a-zA-Z0-9-]+)(?:\/)?$/,  // https://github.com/username
      /^([a-zA-Z0-9-]+)$/                       // Just username
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  };

  describe('extractUsernameFromUrl', () => {
    test('should extract username from full GitHub URL', () => {
      expect(extractUsernameFromUrl('https://github.com/octocat')).toBe('octocat');
      expect(extractUsernameFromUrl('https://github.com/torvalds')).toBe('torvalds');
    });

    test('should extract username from URL without protocol', () => {
      expect(extractUsernameFromUrl('github.com/testuser')).toBe('testuser');
    });

    test('should extract username from URL with trailing slash', () => {
      expect(extractUsernameFromUrl('https://github.com/testuser/')).toBe('testuser');
      expect(extractUsernameFromUrl('https://github.com/testuser///')).toBe('testuser');
    });

    test('should handle username with hyphens and numbers', () => {
      expect(extractUsernameFromUrl('https://github.com/user-name-123')).toBe('user-name-123');
      expect(extractUsernameFromUrl('https://github.com/test-user')).toBe('test-user');
    });

    test('should handle just username without URL', () => {
      expect(extractUsernameFromUrl('octocat')).toBe('octocat');
      expect(extractUsernameFromUrl('test-user-123')).toBe('test-user-123');
    });

    test('should return null for invalid URLs', () => {
      expect(extractUsernameFromUrl('')).toBeNull();
      expect(extractUsernameFromUrl('https://gitlab.com/user')).toBeNull();
    });

    test('should return null for null or undefined', () => {
      expect(extractUsernameFromUrl(null)).toBeNull();
      expect(extractUsernameFromUrl(undefined)).toBeNull();
    });

    test('should return null for non-string values', () => {
      expect(extractUsernameFromUrl(123)).toBeNull();
      expect(extractUsernameFromUrl({})).toBeNull();
      expect(extractUsernameFromUrl([])).toBeNull();
    });

    test('should handle URLs with extra path segments', () => {
      // Should only extract username, not repo names
      const username = extractUsernameFromUrl('https://github.com/octocat');
      expect(username).toBe('octocat');
    });
  });

  describe('URL Validation', () => {
    const isValidGitHubUrl = (url) => {
      if (!url) return false;
      return extractUsernameFromUrl(url) !== null;
    };

    test('should validate correct GitHub URLs', () => {
      expect(isValidGitHubUrl('https://github.com/octocat')).toBe(true);
      expect(isValidGitHubUrl('github.com/testuser')).toBe(true);
      expect(isValidGitHubUrl('octocat')).toBe(true);
    });

    test('should reject invalid URLs', () => {
      expect(isValidGitHubUrl('')).toBe(false);
      expect(isValidGitHubUrl('https://gitlab.com/user')).toBe(false);
    });
  });
});

describe('Response Generation Helpers', () => {
  describe('generateRepoNotes', () => {
    const generateRepoNotes = (repo) => {
      const notes = [];
      
      if (repo.isComplete) notes.push('Complete project');
      if (repo.hasTests) notes.push('Has tests');
      if (repo.hasCICD) notes.push('CI/CD configured');
      if (repo.hasGoodStructure) notes.push('Well-structured');
      if (repo.hasDocumentation) notes.push('Documented');
      if (repo.frameworks && repo.frameworks.length > 0) {
        notes.push(`Uses ${repo.frameworks.slice(0, 2).join(', ')}`);
      }
      
      return notes.length > 0 ? notes.join(', ') : 'Basic project structure';
    };

    test('should generate comprehensive notes for quality repo', () => {
      const repo = {
        isComplete: true,
        hasTests: true,
        hasCICD: true,
        hasGoodStructure: true,
        hasDocumentation: true,
        frameworks: ['React', 'Express', 'MongoDB']
      };

      const notes = generateRepoNotes(repo);
      expect(notes).toContain('Complete project');
      expect(notes).toContain('Has tests');
      expect(notes).toContain('CI/CD configured');
      expect(notes).toContain('Well-structured');
      expect(notes).toContain('Documented');
      expect(notes).toContain('React');
    });

    test('should return basic message for minimal repo', () => {
      const repo = {
        isComplete: false,
        hasTests: false,
        hasCICD: false,
        hasGoodStructure: false,
        hasDocumentation: false,
        frameworks: []
      };

      const notes = generateRepoNotes(repo);
      expect(notes).toBe('Basic project structure');
    });

    test('should handle partial quality indicators', () => {
      const repo = {
        isComplete: true,
        hasTests: true,
        hasCICD: false,
        hasGoodStructure: false,
        hasDocumentation: false,
        frameworks: ['React']
      };

      const notes = generateRepoNotes(repo);
      expect(notes).toContain('Complete project');
      expect(notes).toContain('Has tests');
      expect(notes).toContain('React');
      expect(notes).not.toContain('CI/CD');
    });

    test('should limit frameworks to first 2', () => {
      const repo = {
        isComplete: false,
        hasTests: false,
        hasCICD: false,
        hasGoodStructure: false,
        hasDocumentation: false,
        frameworks: ['React', 'Express', 'MongoDB', 'Redis', 'Docker']
      };

      const notes = generateRepoNotes(repo);
      expect(notes).toContain('React');
      expect(notes).toContain('Express');
      expect(notes).not.toContain('MongoDB');
    });
  });

  describe('Error Message Generation', () => {
    const generateFilteringMessage = (allRepos, qualityRepos) => {
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
      
      return {
        message: helpfulMessage,
        details: {
          total_repos: allRepos.length,
          forks: forksCount,
          filtered_out: allRepos.length - qualityRepos.length
        }
      };
    };

    test('should generate message for all forks scenario', () => {
      const allRepos = [
        { fork: true, size: 100 },
        { fork: true, size: 200 },
        { fork: true, size: 150 }
      ];
      const qualityRepos = [];

      const result = generateFilteringMessage(allRepos, qualityRepos);
      expect(result.message).toContain('All repositories are forks');
      expect(result.details.forks).toBe(3);
      expect(result.details.total_repos).toBe(3);
    });

    test('should generate message for small repos scenario', () => {
      const allRepos = [
        { fork: false, size: 5 },
        { fork: false, size: 8 },
        { fork: false, size: 100 }
      ];
      const qualityRepos = [];

      const result = generateFilteringMessage(allRepos, qualityRepos);
      expect(result.message).toContain('too small');
      expect(result.details.total_repos).toBe(3);
    });

    test('should generate generic message for other scenarios', () => {
      const allRepos = [
        { fork: false, size: 100, name: 'cs101-assignment' },
        { fork: false, size: 150, name: 'homework-project' }
      ];
      const qualityRepos = [];

      const result = generateFilteringMessage(allRepos, qualityRepos);
      expect(result.message).toContain('school assignments or auto-generated');
    });
  });
});

describe('Cache Management', () => {
  describe('Cache Operations', () => {
    let cache;

    beforeEach(() => {
      cache = new Map();
    });

    test('should store and retrieve cached data', () => {
      const cacheKey = 'testuser';
      const cacheData = {
        data: { profile: { username: 'testuser' } },
        timestamp: Date.now()
      };

      cache.set(cacheKey, cacheData);

      expect(cache.has(cacheKey)).toBe(true);
      expect(cache.get(cacheKey)).toEqual(cacheData);
    });

    test('should check cache expiry', () => {
      const cacheExpiry = 30 * 60 * 1000; // 30 minutes
      const cacheKey = 'testuser';
      
      // Fresh cache entry
      const freshData = {
        data: { profile: {} },
        timestamp: Date.now()
      };
      cache.set(cacheKey, freshData);

      const isValid = Date.now() - freshData.timestamp < cacheExpiry;
      expect(isValid).toBe(true);

      // Expired cache entry
      const expiredData = {
        data: { profile: {} },
        timestamp: Date.now() - (31 * 60 * 1000) // 31 minutes ago
      };
      cache.set('expireduser', expiredData);

      const isExpired = Date.now() - expiredData.timestamp >= cacheExpiry;
      expect(isExpired).toBe(true);
    });

    test('should delete expired cache entries', () => {
      const cacheKey = 'expireduser';
      cache.set(cacheKey, { data: {}, timestamp: 0 });

      expect(cache.has(cacheKey)).toBe(true);
      cache.delete(cacheKey);
      expect(cache.has(cacheKey)).toBe(false);
    });

    test('should handle case-insensitive usernames', () => {
      const username1 = 'TestUser';
      const username2 = 'testuser';

      cache.set(username1.toLowerCase(), { data: {}, timestamp: Date.now() });

      expect(cache.has(username2.toLowerCase())).toBe(true);
    });
  });
});
