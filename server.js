require('dotenv').config();

const app = require('./src/app');

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
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error(`❌ Missing required environment variables: ${missingEnvVars.join(', ')}`);
  console.error('Please check your .env file and ensure all required variables are set.');
  process.exit(1);
}

// Validate GitHub token format
if (!process.env.GITHUB_TOKEN.startsWith('ghp_') && !process.env.GITHUB_TOKEN.startsWith('github_pat_')) {
  console.warn('⚠️  WARNING: GITHUB_TOKEN format looks incorrect. Expected format: ghp_xxx or github_pat_xxx');
  console.warn('   Generate a new token at https://github.com/settings/tokens');
  console.warn('   Required scopes: public_repo, read:user');
}

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Artemis Backend Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔍 API endpoint: http://localhost:${PORT}/api/evaluate`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`✅ GitHub token configured: ${process.env.GITHUB_TOKEN.substring(0, 8)}...`);
});
