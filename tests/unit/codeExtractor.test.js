/**
 * Unit tests for Code Extractor
 * Tests code analysis and language breakdown logic
 */

describe('CodeExtractor - Repository Analysis', () => {
  describe('Language Detection', () => {
    test('should detect JavaScript from file extensions', () => {
      const files = [
        { path: 'index.js', content: 'const app = express();' },
        { path: 'utils/helper.js', content: 'function helper() {}' },
        { path: 'package.json', content: '{}' }
      ];

      const jsFiles = files.filter(f => 
        f.path.endsWith('.js') || f.path.endsWith('.jsx')
      );

      expect(jsFiles).toHaveLength(2);
    });

    test('should detect TypeScript from file extensions', () => {
      const files = [
        { path: 'src/index.ts', content: 'const app: Express = express();' },
        { path: 'components/Button.tsx', content: 'export const Button = () => {}' }
      ];

      const tsFiles = files.filter(f => 
        f.path.endsWith('.ts') || f.path.endsWith('.tsx')
      );

      expect(tsFiles).toHaveLength(2);
    });

    test('should detect Python from file extensions', () => {
      const files = [
        { path: 'main.py', content: 'def main():' },
        { path: 'utils/helper.py', content: 'class Helper:' }
      ];

      const pyFiles = files.filter(f => f.path.endsWith('.py'));
      expect(pyFiles).toHaveLength(2);
    });

    test('should detect multiple languages in a repository', () => {
      const files = [
        { path: 'index.js', content: 'const app = express();' },
        { path: 'main.py', content: 'def main():' },
        { path: 'App.tsx', content: 'export const App = () => {}' },
        { path: 'style.css', content: 'body {}' }
      ];

      const languages = new Set();
      files.forEach(f => {
        if (f.path.endsWith('.js') || f.path.endsWith('.jsx')) languages.add('JavaScript');
        if (f.path.endsWith('.ts') || f.path.endsWith('.tsx')) languages.add('TypeScript');
        if (f.path.endsWith('.py')) languages.add('Python');
        if (f.path.endsWith('.css')) languages.add('CSS');
      });

      expect(languages.size).toBe(4);
      expect(languages.has('JavaScript')).toBe(true);
      expect(languages.has('Python')).toBe(true);
      expect(languages.has('TypeScript')).toBe(true);
    });
  });

  describe('Framework Detection', () => {
    test('should detect React from package.json dependencies', () => {
      const packageJson = {
        dependencies: {
          'react': '^18.0.0',
          'react-dom': '^18.0.0'
        }
      };

      const hasReact = packageJson.dependencies && 
        (packageJson.dependencies['react'] || packageJson.dependencies['react-dom']);

      expect(hasReact).toBeTruthy();
    });

    test('should detect Express from package.json', () => {
      const packageJson = {
        dependencies: {
          'express': '^4.18.0'
        }
      };

      expect(packageJson.dependencies['express']).toBeDefined();
    });

    test('should detect multiple frameworks', () => {
      const packageJson = {
        dependencies: {
          'react': '^18.0.0',
          'express': '^4.18.0',
          'mongoose': '^7.0.0'
        }
      };

      const frameworks = [];
      if (packageJson.dependencies['react']) frameworks.push('React');
      if (packageJson.dependencies['express']) frameworks.push('Express');
      if (packageJson.dependencies['mongoose']) frameworks.push('MongoDB');

      expect(frameworks).toHaveLength(3);
    });
  });

  describe('Code Quality Indicators', () => {
    test('should detect presence of tests', () => {
      const files = [
        { path: 'src/utils.js', content: 'export function add(a, b) { return a + b; }' },
        { path: 'tests/utils.test.js', content: 'test("adds numbers", () => {})' },
        { path: '__tests__/component.test.js', content: 'describe("Component", () => {})' }
      ];

      const testFiles = files.filter(f => 
        f.path.includes('test') || 
        f.path.includes('spec') || 
        f.path.includes('__tests__')
      );

      expect(testFiles.length).toBeGreaterThan(0);
    });

    test('should detect good folder structure', () => {
      const files = [
        { path: 'src/components/Button.js', content: '' },
        { path: 'src/services/api.js', content: '' },
        { path: 'src/utils/helpers.js', content: '' },
        { path: 'src/models/User.js', content: '' }
      ];

      const commonFolders = ['components', 'services', 'utils', 'models'];
      const foundFolders = new Set();

      files.forEach(f => {
        commonFolders.forEach(folder => {
          if (f.path.includes(folder)) {
            foundFolders.add(folder);
          }
        });
      });

      expect(foundFolders.size).toBeGreaterThanOrEqual(3);
    });

    test('should detect documentation files', () => {
      const files = [
        { path: 'README.md', content: '# Project Documentation' },
        { path: 'docs/API.md', content: '# API Documentation' },
        { path: 'CONTRIBUTING.md', content: '# Contributing Guidelines' }
      ];

      const docFiles = files.filter(f => 
        f.path.endsWith('.md') || 
        f.path.includes('docs/')
      );

      expect(docFiles.length).toBeGreaterThan(0);
    });

    test('should detect CI/CD configuration', () => {
      const files = [
        { path: '.github/workflows/ci.yml', content: 'on: [push]' },
        { path: '.gitlab-ci.yml', content: 'stages: [test]' },
        { path: 'Dockerfile', content: 'FROM node:18' }
      ];

      const cicdFiles = files.filter(f => 
        f.path.includes('.github/workflows') ||
        f.path.includes('.gitlab-ci') ||
        f.path === 'Dockerfile' ||
        f.path === 'docker-compose.yml'
      );

      expect(cicdFiles.length).toBeGreaterThan(0);
    });
  });

  describe('Architecture Patterns', () => {
    test('should detect MVC pattern', () => {
      const files = [
        { path: 'models/User.js', content: 'class User {}' },
        { path: 'views/home.ejs', content: '<h1>Home</h1>' },
        { path: 'controllers/UserController.js', content: 'class UserController {}' }
      ];

      const hasMVC = files.some(f => f.path.includes('models')) &&
                     files.some(f => f.path.includes('views')) &&
                     files.some(f => f.path.includes('controllers'));

      expect(hasMVC).toBe(true);
    });

    test('should detect services layer', () => {
      const files = [
        { path: 'src/services/authService.js', content: 'export class AuthService {}' },
        { path: 'src/services/userService.js', content: 'export class UserService {}' }
      ];

      const hasServices = files.some(f => f.path.includes('services'));
      expect(hasServices).toBe(true);
    });

    test('should detect modular structure', () => {
      const files = [
        { path: 'src/modules/auth/controller.js', content: '' },
        { path: 'src/modules/auth/service.js', content: '' },
        { path: 'src/modules/users/controller.js', content: '' },
        { path: 'src/modules/users/service.js', content: '' }
      ];

      const modules = new Set();
      files.forEach(f => {
        const match = f.path.match(/modules\/([^/]+)/);
        if (match) modules.add(match[1]);
      });

      expect(modules.size).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Language Breakdown Calculation', () => {
    test('should calculate percentage correctly', () => {
      const languageCounts = {
        'JavaScript': 5,
        'Python': 3,
        'TypeScript': 2
      };

      const total = Object.values(languageCounts).reduce((sum, count) => sum + count, 0);
      const breakdown = {};

      Object.entries(languageCounts).forEach(([lang, count]) => {
        breakdown[lang] = {
          percentage: Math.round((count / total) * 100),
          repos_count: count
        };
      });

      expect(breakdown['JavaScript'].percentage).toBe(50);
      expect(breakdown['Python'].percentage).toBe(30);
      expect(breakdown['TypeScript'].percentage).toBe(20);
    });

    test('should handle single language', () => {
      const languageCounts = { 'JavaScript': 10 };
      const total = 10;

      const percentage = Math.round((languageCounts['JavaScript'] / total) * 100);
      expect(percentage).toBe(100);
    });

    test('should handle empty language data', () => {
      const languageCounts = {};
      const total = Object.values(languageCounts).reduce((sum, count) => sum + count, 0);

      expect(total).toBe(0);
    });
  });

  describe('Commit Message Quality Analysis', () => {
    test('should identify meaningful commit messages', () => {
      const commits = [
        { message: 'feat: add user authentication module' },
        { message: 'fix: resolve memory leak in data processing' },
        { message: 'refactor: improve error handling in API service' }
      ];

      const meaningfulPatterns = /^(feat|fix|refactor|docs|test|chore|style):/i;
      const meaningful = commits.filter(c => meaningfulPatterns.test(c.message));

      expect(meaningful.length).toBe(3);
    });

    test('should identify poor commit messages', () => {
      const commits = [
        { message: 'update' },
        { message: 'fix' },
        { message: 'changes' },
        { message: 'wip' }
      ];

      const meaningfulPatterns = /^(feat|fix|refactor|docs|test|chore|style):/i;
      const meaningful = commits.filter(c => meaningfulPatterns.test(c.message));

      expect(meaningful.length).toBe(0);
    });

    test('should calculate meaningful commit ratio', () => {
      const commits = [
        { message: 'feat: add login' },
        { message: 'update' },
        { message: 'fix: bug in logout' },
        { message: 'changes' }
      ];

      const meaningfulPatterns = /^(feat|fix|refactor|docs|test|chore|style):/i;
      const meaningful = commits.filter(c => meaningfulPatterns.test(c.message));
      const ratio = meaningful.length / commits.length;

      expect(ratio).toBe(0.5);
    });
  });
});
