const path = require('path');
const dotenv = require('dotenv');

// Load environment-specific .env file
const envFile = process.env.NODE_ENV === 'production'
  ? '.env.production'
  : '.env.development';
const envPath = path.resolve(__dirname, envFile);
const fallbackPath = path.resolve(__dirname, '.env');

const result = dotenv.config({ path: envPath });
if (result.error) {
  dotenv.config({ path: fallbackPath });
}

const http = require('http');
const mongoose = require('mongoose');
const app = require('./src/app');
const connectDB = require('./src/db/connection');
const emailService = require('./src/services/emailService');
const { initializeSocket } = require('./src/services/socketManager');
const logger = require('./src/utils/logger');

const PORT = process.env.PORT || 5000;

let httpServer;

// ─── Graceful Shutdown ──────────────────────────────────────────
function gracefulShutdown(signal) {
  logger.info(`${signal} received — shutting down gracefully`);

  if (!httpServer) {
    process.exit(0);
  }

  // Stop accepting new connections
  httpServer.close(async () => {
    logger.info('HTTP server closed');
    try {
      await mongoose.connection.close(false);
      logger.info('MongoDB connection closed');
    } catch (err) {
      logger.error('Error closing MongoDB connection', { error: err.message });
    }
    process.exit(0);
  });

  // Force exit after 10s if graceful close hangs
  setTimeout(() => {
    logger.error('Forced shutdown — graceful close timed out');
    process.exit(1);
  }, 10_000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Validate environment variables
const requiredEnvVars = ['OPENAI_API_KEY', 'GITHUB_TOKEN', 'CLERK_PUBLISHABLE_KEY', 'CLERK_SECRET_KEY'];
const optionalEnvVars = ['MONGODB_URI', 'CLERK_WEBHOOK_SECRET']; // Optional for leaderboard feature
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error(`❌ Missing required environment variables: ${missingEnvVars.join(', ')}`);
  console.error('Please check your .env file and ensure all required variables are set.');
  process.exit(1);
}

// Check for Clerk webhook secret
if (!process.env.CLERK_WEBHOOK_SECRET) {
  console.warn('⚠️  WARNING: CLERK_WEBHOOK_SECRET not set. Clerk webhooks will not be verified.');
  console.warn('   To enable secure webhooks, add CLERK_WEBHOOK_SECRET to your .env file.');
}

// Check for optional MongoDB connection
if (!process.env.MONGODB_URI) {
  console.warn('⚠️  WARNING: MONGODB_URI not set. Leaderboard and user features will be disabled.');
  console.warn('   To enable all features, add MONGODB_URI to your .env file.');
} else {
  console.log('✅ MongoDB URI configured - Database features enabled');
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

  // Initialize email service
  emailService.initialize();
  if (emailService.isConfigured) {
    await emailService.verify();
    console.log('📧 Email service initialized');
  } else {
    console.warn('⚠️  Email service not configured — emails will be logged to console');
  }

  // Create HTTP server and attach Socket.io
  httpServer = http.createServer(app);
  initializeSocket(httpServer);

  // Start server
  httpServer.listen(PORT, () => {
    console.log(`🚀 Artemis Remote Work Platform - Backend Server running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`🔐 Auth API: http://localhost:${PORT}/api/auth`);
    console.log(`👥 Users API: http://localhost:${PORT}/api/users`);
    console.log(`📄 Contracts API: http://localhost:${PORT}/api/contracts`);
    console.log(`🔍 Evaluation API: http://localhost:${PORT}/api/evaluate`);
    console.log(`🔔 Notifications API: http://localhost:${PORT}/api/notifications`);
    console.log(`⚡ Socket.io: ws://localhost:${PORT}`);
    if (process.env.MONGODB_URI) {
      console.log(`🏆 Leaderboard API: http://localhost:${PORT}/api/leaderboard`);
    }
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`✅ GitHub token configured: ${process.env.GITHUB_TOKEN.substring(0, 8)}...`);
  });
};

startServer();
