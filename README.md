# Artemis Backend - Developer Evaluator

A Node.js backend service that analyzes GitHub developer profiles and provides AI-powered skill assessments.

## 🚀 Features

- **GitHub Profile Analysis**: Fetches and analyzes public repositories
- **AI-Powered Grading**: Uses OpenAI GPT to evaluate developer skills
- **Code Quality Assessment**: Analyzes code structure, patterns, and best practices
- **RESTful API**: Simple JSON API for frontend integration
- **Rate Limiting**: Built-in protection against API abuse
- **Lightweight**: No database required - fully in-memory operation

## 📋 Requirements

- Node.js 16+ 
- GitHub Personal Access Token
- OpenAI API Key

## ⚡ Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Setup
Copy `.env` file and add your API keys:
```bash
# GitHub API Configuration
GITHUB_TOKEN=your_github_personal_access_token_here

# OpenAI API Configuration  
OPENAI_API_KEY=your_openai_api_key_here

# Server Configuration
PORT=5000
NODE_ENV=development
```

### 3. Start Development Server
```bash
npm run dev
```

### 4. Start Production Server
```bash
npm start
```

## 🔗 API Endpoints

### Health Check
```
GET /health
```
Returns server health status.

### Evaluate Developer
```
POST /api/evaluate
Content-Type: application/json

{
  "githubUrl": "https://github.com/username"
}
```

**Response:**
```json
{
  "grade": "Intermediate",
  "reasoning": "The developer shows strong knowledge of JS and API design but lacks advanced architecture patterns...",
  "strengths": ["Clean function names", "Consistent commit history", "Good error handling"],
  "weaknesses": ["Minimal test coverage", "Few advanced concepts", "Limited documentation"],
  "suggestions": ["Add more unit tests", "Explore design patterns", "Improve code documentation"],
  "analyzedRepos": 3,
  "totalRepos": 8,
  "username": "octocat",
  "timestamp": "2025-08-14T10:30:00.000Z"
}
```

### API Status
```
GET /api/status
```
Returns API service information.

## 🏗️ Architecture

```
/backend
  /src
    /routes
      githubRoutes.js      # API route definitions
    /controllers  
      githubController.js  # Request handling and coordination
    /services
      githubService.js     # GitHub API interactions
      aiService.js         # OpenAI API interactions
    /utils
      codeExtractor.js     # Code analysis and extraction
      promptBuilder.js     # AI prompt generation
    app.js                 # Express app configuration
  server.js                # Server entry point
  .env                     # Environment variables
  package.json
  README.md
```

## 🔍 How It Works

1. **Input**: Receives GitHub profile URL
2. **Fetch**: Retrieves user's public repositories via GitHub API
3. **Extract**: Analyzes code files for structure, patterns, and quality
4. **Analyze**: Sends curated code samples to OpenAI for evaluation
5. **Grade**: Returns skill level (Beginner/Intermediate/Advanced) with detailed feedback

## 🛡️ Security Features

- Rate limiting (100 requests per 15 minutes per IP)
- Input validation and sanitization
- CORS protection
- Environment variable protection
- Error message sanitization in production

## 🎯 Grading Criteria

### Beginner (0-2 years equivalent)
- Basic syntax understanding
- Simple scripts and functions
- Minimal code organization
- Few best practices

### Intermediate (2-5 years equivalent)  
- Good code structure
- Some design patterns
- Error handling
- Readable, maintainable code
- Basic testing

### Advanced (5+ years equivalent)
- Excellent architecture
- Advanced design patterns
- Comprehensive testing
- Performance optimization
- Complex problem solving
- Documentation

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `GITHUB_TOKEN` | GitHub Personal Access Token | Required |
| `OPENAI_API_KEY` | OpenAI API Key | Required |
| `PORT` | Server port | 5000 |
| `NODE_ENV` | Environment mode | development |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window | 900000 (15 min) |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | 100 |

### GitHub Token Setup

1. Go to GitHub Settings → Developer settings → Personal access tokens
2. Generate new token with `public_repo` scope
3. Add token to `.env` file

### OpenAI API Key Setup

1. Sign up at [OpenAI Platform](https://platform.openai.com/)
2. Generate API key from API settings
3. Add key to `.env` file

## 📊 API Usage Examples

### cURL
```bash
curl -X POST http://localhost:5000/api/evaluate \
  -H "Content-Type: application/json" \
  -d '{"githubUrl": "https://github.com/octocat"}'
```

### JavaScript (Fetch)
```javascript
const response = await fetch('http://localhost:5000/api/evaluate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    githubUrl: 'https://github.com/octocat'
  })
});

const result = await response.json();
console.log(result);
```

### Python (Requests)
```python
import requests

response = requests.post(
    'http://localhost:5000/api/evaluate',
    json={'githubUrl': 'https://github.com/octocat'}
)

result = response.json()
print(result)
```

## 🚀 Deployment

### Heroku
```bash
heroku create artemis-backend
heroku config:set GITHUB_TOKEN=your_token
heroku config:set OPENAI_API_KEY=your_key
git push heroku main
```

### Render
1. Connect your GitHub repository
2. Set environment variables in dashboard
3. Deploy automatically

### Vercel
```bash
vercel --prod
```

## 🐛 Troubleshooting

### Common Issues

**GitHub API Rate Limit**
- Solution: Check your GitHub token has correct permissions
- Solution: Wait for rate limit reset or use authenticated token

**OpenAI API Errors**
- Solution: Verify API key is correct and has sufficient credits
- Solution: Check if request size is within token limits

**Invalid GitHub URL**
- Solution: Ensure URL format is `https://github.com/username`
- Solution: Verify user has public repositories

## 📈 Performance Optimization

- Repositories limited to 5 for analysis
- Code files limited to 150 lines each
- File size limit: 50KB
- Request timeout: 30 seconds
- Concurrent file fetching with Promise.all

## 🔄 Development

### Scripts
```bash
npm run dev     # Start with nodemon (hot reload)
npm start       # Start production server
npm test        # Run tests (when implemented)
```

### Code Structure
- **Routes**: Define API endpoints
- **Controllers**: Handle request/response logic
- **Services**: External API interactions
- **Utils**: Helper functions and data processing

## 📄 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Create Pull Request

---

Built with ❤️ for developer evaluation and portfolio analysis.
