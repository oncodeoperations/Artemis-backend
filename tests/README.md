# Artemis Backend - Test Suite

Comprehensive unit and integration tests for the Artemis Developer Evaluator Backend.

## Test Structure

```
tests/
├── unit/                          # Unit tests for individual components
│   ├── scoringService.test.js    # Scoring logic tests (6 categories)
│   ├── githubService.test.js     # Repository filtering and validation
│   ├── codeExtractor.test.js     # Code analysis and language detection
│   └── helpers.test.js           # URL validation and helper functions
└── integration/                   # Integration tests for API endpoints
    └── api.test.js               # End-to-end API tests
```

## Running Tests

### Install Dependencies

```bash
npm install
```

This will install Jest and Supertest for testing.

### Run All Tests

```bash
npm test
```

### Run Unit Tests Only

```bash
npm run test:unit
```

### Run Integration Tests Only

```bash
npm run test:integration
```

### Run Tests in Watch Mode

```bash
npm run test:watch
```

### View Coverage Report

```bash
npm test
# Coverage report will be in ./coverage/lcov-report/index.html
```

## Test Coverage

### Unit Tests

#### 1. Scoring Service (`scoringService.test.js`)
- **calculateScores**: Complete scores object validation
- **calculateCodeQuality**: Tests (0-20 points), structure, commits, style, docs
- **calculateProjectDiversity**: Tech stack and project type variation
- **calculateActivity**: Active/Semi-active/Inactive classification
- **calculateArchitecture**: MVC, modularity, separation of concerns
- **calculateRepoQuality**: Completeness, CI/CD, structure, README
- **calculateProfessionalism**: Profile quality and documentation
- **classifyLevel**: Beginner/Intermediate/Senior/Expert thresholds
- **getHiringRecommendation**: Strong Yes/Yes/Maybe/No
- **getProjectMaturityRating**: Low/Moderate/Good/Excellent

**Coverage**: All 6 scoring categories + helper functions

#### 2. GitHub Service (`githubService.test.js`)
- **shouldAnalyzeRepo**: Fork filtering, archived repos, disabled repos
- **Repository Filtering**: Small repos (<10KB), school assignments, auto-generated
- **Pattern Matching**: Assignment detection, old inactive repos
- **Activity Analysis**: Active/Semi-active/Inactive classification
- **Edge Cases**: Empty repos, only forks, valid quality repos

**Coverage**: Complete filtering logic with 15+ test scenarios

#### 3. Code Extractor (`codeExtractor.test.js`)
- **Language Detection**: JS, TS, Python, multi-language repos
- **Framework Detection**: React, Express, Django, MongoDB
- **Code Quality Indicators**: Tests, folder structure, documentation, CI/CD
- **Architecture Patterns**: MVC, services layer, modular structure
- **Language Breakdown**: Percentage calculation, single/multiple languages
- **Commit Quality**: Meaningful vs poor commit messages, ratio calculation

**Coverage**: 20+ code analysis scenarios

#### 4. Helper Functions (`helpers.test.js`)
- **URL Extraction**: Full URLs, protocol-less, trailing slashes, special characters
- **URL Validation**: Valid/invalid GitHub URLs
- **Response Generation**: Repo notes, error messages
- **Cache Management**: Storage, retrieval, expiry, case-insensitive keys

**Coverage**: URL parsing, validation, caching, error handling

### Integration Tests

#### API Endpoints (`api.test.js`)
- **GET /health**: Health check endpoint
- **POST /api/evaluate**: Full evaluation flow
- **Input Validation**: Missing URL, invalid URL format
- **Error Scenarios**: User not found (404), no repos (404), only forks (422)
- **Response Structure**: Profile, scores, recruiter_summary, engineer_breakdown
- **Data Types**: Number validation, string validation, array validation
- **Edge Cases**: Long repo lists, special characters, URL variations

**Coverage**: 25+ integration test cases

## Test Scenarios

### Edge Cases Covered

✅ User with no repositories  
✅ User with only forked repositories  
✅ Very inactive accounts (no commits in 90 days)  
✅ Empty/small repositories (< 10KB)  
✅ School assignment detection  
✅ Auto-generated repositories  
✅ Invalid GitHub URLs  
✅ Non-existent users  
✅ Special characters in usernames  
✅ URLs with/without protocol  
✅ URLs with trailing slashes  

### Scoring Edge Cases

✅ Perfect score (110/110) - Expert level  
✅ Zero score (0/110) - Beginner level  
✅ Threshold boundaries (40, 75, 95, 110)  
✅ Empty repository details  
✅ Single vs multiple languages  
✅ Minimal vs comprehensive profiles  

## Expected Test Results

When running `npm test`, you should see:

```
Test Suites: 5 passed, 5 total
Tests:       80+ passed, 80+ total
Snapshots:   0 total
Time:        ~5s
Coverage:    > 80% overall
```

### Coverage Targets

- **Statements**: > 80%
- **Branches**: > 75%
- **Functions**: > 80%
- **Lines**: > 80%

## Writing New Tests

### Unit Test Template

```javascript
describe('ComponentName', () => {
  describe('methodName', () => {
    test('should do something specific', () => {
      // Arrange
      const input = 'test data';
      
      // Act
      const result = methodName(input);
      
      // Assert
      expect(result).toBe('expected value');
    });
  });
});
```

### Integration Test Template

```javascript
describe('POST /api/endpoint', () => {
  test('should return expected response', async () => {
    const response = await request(app)
      .post('/api/endpoint')
      .send({ data: 'test' })
      .expect(200);

    expect(response.body).toHaveProperty('expectedField');
  });
});
```

## Continuous Integration

These tests are designed to run in CI/CD pipelines:

```yaml
# .github/workflows/test.yml
- name: Run tests
  run: npm test
  
- name: Upload coverage
  uses: codecov/codecov-action@v3
```

## Debugging Tests

### Run specific test file

```bash
npm test githubService.test.js
```

### Run tests matching pattern

```bash
npm test -- --testNamePattern="should filter"
```

### Debug with verbose output

```bash
npm test -- --verbose
```

## Common Issues

### Jest not found
```bash
npm install --save-dev jest supertest
```

### Tests timeout
Increase timeout in test:
```javascript
test('long operation', async () => {
  // test code
}, 10000); // 10 second timeout
```

### Module not found
Ensure you're running from the correct directory:
```bash
cd Artemis-backend
npm test
```

## Contributing

When adding new features:
1. Write tests first (TDD)
2. Ensure > 80% coverage
3. Test edge cases
4. Update this README

## Test Maintenance

- Update tests when API changes
- Add tests for new features
- Remove tests for deprecated features
- Keep test data realistic but anonymized
