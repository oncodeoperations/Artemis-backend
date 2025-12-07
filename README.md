# 🎯 Artemis Backend - Developer Evaluation API

**AI-powered GitHub developer analysis and grading system**

A robust Node.js/Express backend service that analyzes GitHub profiles, examines code quality, and provides comprehensive developer evaluations using OpenAI's GPT models.

---

## 📋 Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Server](#running-the-server)
- [API Documentation](#api-documentation)
- [Project Structure](#project-structure)
- [Deployment](#deployment)

---

## ✨ Features

- 🔍 **GitHub Profile Analysis** - Fetches and analyzes public repositories
- 🤖 **AI-Powered Evaluation** - Uses OpenAI GPT-4o-mini for intelligent code assessment
- 📊 **Comprehensive Grading** - Provides detailed grades, strengths, weaknesses, and suggestions
- 🛡️ **Rate Limiting** - Built-in protection against API abuse (100 req/15min per IP)
- 🌐 **CORS Support** - Configurable cross-origin resource sharing
- ⚡ **Error Handling** - Robust error management with user-friendly messages
- 📈 **Health Monitoring** - Health check endpoint for uptime monitoring

---

## 🏗️ Architecture

```
Backend (Node.js/Express)
    ↓
GitHub API ← Fetch repos & code
    ↓
Code Analysis & Extraction
    ↓
OpenAI API ← AI evaluation
    ↓
JSON Response → Frontend
```

**Tech Stack:**
- **Runtime**: Node.js (v16+)
- **Framework**: Express.js
- **AI Service**: OpenAI GPT-4o-mini
- **HTTP Client**: Axios
- **Security**: CORS, Rate Limiting

---

## 📦 Prerequisites

Before you begin, ensure you have:

- **Node.js** v16.0.0 or higher ([Download](https://nodejs.org/))
- **npm** v7+ (comes with Node.js)
- **OpenAI API Key** ([Get one here](https://platform.openai.com/api-keys))
- **GitHub Personal Access Token** ([Create one here](https://github.com/settings/tokens))
  - Required scopes: `public_repo`, `read:user`

---

## 🚀 Installation

### 1. Clone the repository

```bash
git clone https://github.com/oncodeoperations/Artemis-backend.git
cd Artemis-backend
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

```bash
# Copy the example environment file
cp .env.example .env
```

Edit `.env` and add your API keys (see [Configuration](#configuration) section)

---

## ⚙️ Configuration

Create a `.env` file in the root directory with the following variables:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# OpenAI API Key (Required)
OPENAI_API_KEY=sk-your-openai-api-key-here

# GitHub Personal Access Token (Required)
GITHUB_TOKEN=ghp_your-github-token-here

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000        # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100        # Max requests per window

# CORS (comma-separated origins)
ALLOWED_ORIGINS=http://localhost:8080,http://localhost:5173
```

### Environment Variables Explained:

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PORT` | Server port | 5000 | No |
| `NODE_ENV` | Environment mode | development | No |
| `OPENAI_API_KEY` | OpenAI API key | - | **Yes** |
| `GITHUB_TOKEN` | GitHub access token | - | **Yes** |
| `RATE_LIMIT_WINDOW_MS` | Rate limit time window (ms) | 900000 | No |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | 100 | No |

---

## 🏃 Running the Server

### Development Mode (with auto-restart)

```bash
npm run dev
```

### Production Mode

```bash
npm start
```

### Expected Output:

```
🚀 Artemis Backend Server running on port 5000
📊 Health check: http://localhost:5000/health
🔍 API endpoint: http://localhost:5000/api/evaluate
🌍 Environment: development
```

---

## 📡 API Documentation

### Base URL

- **Development**: `http://localhost:5000`
- **Production**: `https://artemis-backend-mx4u.onrender.com`

---

### Endpoints

#### 1. Health Check

**GET** `/health`

Check if the server is running.

**Response:**
```json
{
  "status": "OK",
  "timestamp": "2025-12-07T10:30:00.000Z",
  "service": "Artemis Developer Evaluator Backend"
}
```

---

#### 2. Evaluate Developer

**POST** `/api/evaluate`

Analyze a GitHub profile and get AI-powered evaluation.

**Request Body:**
```json
{
  "githubUrl": "https://github.com/username"
}
```

**Success Response (200 OK):**
```json
{
  "grade": "Advanced",
  "reasoning": "Demonstrates strong software engineering principles...",
  "strengths": [
    "Clean code architecture",
    "Comprehensive testing",
    "Good documentation"
  ],
  "weaknesses": [
    "Limited use of design patterns",
    "Could improve error handling"
  ],
  "suggestions": [
    "Implement more unit tests",
    "Add API documentation"
  ],
  "analyzedRepos": 5,
  "totalRepos": 12,
  "username": "username",
  "timestamp": "2025-12-07T10:30:00.000Z"
}
```

**Error Responses:**

| Status Code | Description | Example Response |
|-------------|-------------|------------------|
| 400 | Invalid request | `{"error": "Invalid GitHub URL"}` |
| 404 | User not found | `{"error": "GitHub user 'username' not found"}` |
| 422 | No analyzable code | `{"error": "No analyzable code found"}` |
| 429 | Rate limit exceeded | `{"error": "Too many requests..."}` |
| 500 | Server error | `{"error": "Internal server error"}` |

---

### Request Examples

#### cURL

```bash
curl -X POST http://localhost:5000/api/evaluate \
  -H "Content-Type: application/json" \
  -d '{"githubUrl": "https://github.com/octocat"}'
```

#### JavaScript (Fetch)

```javascript
const response = await fetch('http://localhost:5000/api/evaluate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ githubUrl: 'https://github.com/octocat' })
});

const result = await response.json();
```

#### Python (Requests)

```python
import requests

response = requests.post(
    'http://localhost:5000/api/evaluate',
    json={'githubUrl': 'https://github.com/octocat'}
)
print(response.json())
```

---

## 📁 Project Structure

```
Artemis-backend/
├── src/
│   ├── app.js                    # Express app configuration
│   ├── controllers/
│   │   └── githubController.js   # Request handlers
│   ├── routes/
│   │   └── githubRoutes.js       # API routes
│   ├── services/
│   │   ├── aiService.js          # OpenAI integration
│   │   └── githubService.js      # GitHub API client
│   └── utils/
│       ├── codeExtractor.js      # Code analysis logic
│       └── promptBuilder.js      # AI prompt generation
├── server.js                      # Entry point
├── package.json                   # Dependencies
├── .env                           # Environment variables (not in git)
├── .env.example                   # Example environment file
├── .gitignore                     # Git ignore rules
└── README.md                      # This file
```

---

## 🔍 How It Works

1. **Input**: Client sends GitHub profile URL
2. **Fetch**: Retrieves user's public repositories via GitHub API
3. **Analyze**: Examines code files for patterns, structure, and quality
4. **Evaluate**: Sends curated data to OpenAI for intelligent assessment
5. **Grade**: Returns comprehensive evaluation with grade, strengths, weaknesses, and suggestions

---

## 🛡️ Security & Rate Limiting

The API implements multiple security layers:

- ✅ **Rate Limiting**: 100 requests per 15 minutes per IP
- ✅ **CORS Protection**: Configurable allowed origins
- ✅ **Input Validation**: Validates all user inputs
- ✅ **Error Sanitization**: Hides sensitive info in production
- ✅ **Environment Variables**: Secure API key management

**Rate Limit Headers:**
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining
- `X-RateLimit-Reset`: Time until limit resets

---

## 🎯 Grading Criteria

### Beginner (0-2 years experience)
- ✅ Basic syntax understanding
- ✅ Simple scripts and functions
- ✅ Minimal code organization
- ❌ Few best practices

### Intermediate (2-5 years experience)  
- ✅ Good code structure
- ✅ Some design patterns
- ✅ Error handling
- ✅ Readable, maintainable code
- ✅ Basic testing

### Advanced (5+ years experience)
- ✅ Excellent architecture
- ✅ Advanced design patterns
- ✅ Comprehensive testing
- ✅ Performance optimization
- ✅ Complex problem solving
- ✅ Strong documentation

---

## 🌐 Deployment

### Deploy to Render

1. Create a new Web Service on [Render](https://render.com)
2. Connect your GitHub repository
3. Configure environment variables in Render dashboard
4. Set build command: `npm install`
5. Set start command: `npm start`

### Deploy to Railway

1. Create a new project on [Railway](https://railway.app)
2. Connect your repository
3. Add environment variables
4. Deploy automatically on push

### Deploy to Heroku

```bash
heroku login
heroku create artemis-backend
heroku config:set OPENAI_API_KEY=your_key
heroku config:set GITHUB_TOKEN=your_token
git push heroku main
```

---

## 🔧 Troubleshooting

### Port Already in Use

```bash
# Windows
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# Or change port
PORT=3000 npm start
```

### GitHub API Rate Limit

- Without token: 60 requests/hour
- With token: 5000 requests/hour
- **Solution**: Add `GITHUB_TOKEN` to `.env`

### OpenAI API Errors

- Verify API key is valid
- Check billing and usage limits
- Ensure sufficient credits

---

## 🧪 Testing

```bash
# Test health endpoint
curl http://localhost:5000/health

# Test evaluation endpoint
curl -X POST http://localhost:5000/api/evaluate \
  -H "Content-Type: application/json" \
  -d '{"githubUrl": "https://github.com/octocat"}'
```

---

## 📈 Performance & Limits

- **Repositories analyzed**: Max 5 per request
- **Code files per repo**: Max 15 files
- **File size limit**: 50KB per file
- **Request timeout**: 30 seconds
- **Concurrent processing**: Parallel file fetching with Promise.all

---

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

MIT License - see LICENSE file for details

---

## 🔗 Related Projects

- **Frontend**: [dev-insight-lens-1](../dev-insight-lens-1) - React/Vite frontend application

---

## 📞 Support

For issues and questions:
- GitHub Issues: [Create an issue](https://github.com/oncodeoperations/Artemis-backend/issues)
- Email: support@artemis.dev

---

## 🙏 Acknowledgments

- [OpenAI](https://openai.com) for GPT API
- [GitHub](https://github.com) for developer platform
- [Express.js](https://expressjs.com) for web framework

---

**Made with ❤️ by the Artemis Team**
