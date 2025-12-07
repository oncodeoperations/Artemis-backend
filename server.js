require('dotenv').config();

const app = require('./src/app');
const connectDB = require('./src/db/connection');

const PORT = process.env.PORT || 5000;

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Validate environment variables
const requiredEnvVars = ['OPENAI_API_KEY', 'GITHUB_TOKEN'];
const optionalEnvVars = ['MONGODB_URI']; // Optional for leaderboard feature
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error(`❌ Missing required environment variables: ${missingEnvVars.join(', ')}`);
  console.error('Please check your .env file and ensure all required variables are set.');
  process.exit(1);
}

// Check for optional MongoDB connection
if (!process.env.MONGODB_URI) {
  console.warn('⚠️  WARNING: MONGODB_URI not set. Leaderboard feature will be disabled.');
  console.warn('   To enable leaderboard, add MONGODB_URI to your .env file.');
}

// Validate GitHub token format
if (!process.env.GITHUB_TOKEN.startsWith('ghp_') && !process.env.GITHUB_TOKEN.startsWith('github_pat_')) {
  console.warn('⚠️  WARNING: GITHUB_TOKEN format looks incorrect. Expected format: ghp_xxx or github_pat_xxx');
  console.warn('   Generate a new token at https://github.com/settings/tokens');
  console.warn('   Required scopes: public_repo, read:user');
}

// Connect to MongoDB (if configured) and start server
const startServer = async () => {
  // Connect to MongoDB if URI is provided
  if (process.env.MONGODB_URI) {
    try {
      await connectDB();
      console.log('🏆 Leaderboard feature enabled');
    } catch (error) {
      console.error('❌ MongoDB connection failed. Leaderboard will be disabled.');
      console.error('   Server will continue without leaderboard feature.');
    }
  }

  // Start server
  app.listen(PORT, () => {
    console.log(`🚀 Artemis Backend Server running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`🔍 API endpoint: http://localhost:${PORT}/api/evaluate`);
    if (process.env.MONGODB_URI) {
      console.log(`🏆 Leaderboard API: http://localhost:${PORT}/api/leaderboard`);
    }
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`✅ GitHub token configured: ${process.env.GITHUB_TOKEN.substring(0, 8)}...`);
  });
};

startServer();
