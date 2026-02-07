/**
 * Centralized Configuration Module
 * Validates and exports all environment variables and constants.
 * Import this instead of using process.env.* directly.
 */

require('dotenv').config();

// ─── Helper ─────────────────────────────────────────────────────
function required(name) {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

function optional(name, fallback) {
  return process.env[name] || fallback;
}

// ─── Allowed Origins (shared between Express CORS and Socket.io) ─
function getAllowedOrigins() {
  const envOrigins = process.env.ALLOWED_ORIGINS;
  const defaultOrigins =
    process.env.NODE_ENV === 'production'
      ? ['https://artemisfe.vercel.app']
      : ['http://localhost:8080', 'http://localhost:5173', 'http://172.20.10.2:8080'];

  if (envOrigins) {
    return envOrigins.split(',').map((o) => o.trim());
  }
  return defaultOrigins;
}

// ─── Exported Config ────────────────────────────────────────────
const config = {
  // Server
  port: parseInt(optional('PORT', '5000'), 10),
  nodeEnv: optional('NODE_ENV', 'development'),

  // MongoDB
  mongoUri: optional('MONGODB_URI', ''),

  // Clerk auth
  clerkPublishableKey: optional('CLERK_PUBLISHABLE_KEY', ''),
  clerkSecretKey: optional('CLERK_SECRET_KEY', ''),
  clerkWebhookSecret: optional('CLERK_WEBHOOK_SECRET', ''),

  // GitHub
  githubToken: optional('GITHUB_TOKEN', ''),

  // OpenAI
  openaiApiKey: optional('OPENAI_API_KEY', ''),

  // Stripe
  stripeSecretKey: optional('STRIPE_SECRET_KEY', ''),
  stripeWebhookSecret: optional('STRIPE_WEBHOOK_SECRET', ''),

  // Email / SMTP
  smtp: {
    host: optional('SMTP_HOST', ''),
    port: parseInt(optional('SMTP_PORT', '587'), 10),
    user: optional('SMTP_USER', ''),
    pass: optional('SMTP_PASS', ''),
    from: optional('SMTP_FROM', 'noreply@artemis.dev'),
  },

  // Judge0
  judge0ApiUrl: optional('JUDGE0_API_URL', ''),
  judge0ApiKey: optional('JUDGE0_API_KEY', ''),

  // ─── Application Constants ──────────────────────────────────
  platformFeePercent: parseFloat(optional('PLATFORM_FEE_PERCENT', '3.6')),
  cacheTtlMs: parseInt(optional('CACHE_TTL_MS', String(30 * 60 * 1000)), 10), // 30 min
  webhookMaxAgeMs: parseInt(optional('WEBHOOK_MAX_AGE_MS', String(5 * 60 * 1000)), 10), // 5 min
  tokenRefreshMs: parseInt(optional('TOKEN_REFRESH_MS', String(50 * 60 * 1000)), 10), // 50 min

  // Rate limiting
  rateLimitWindowMs: parseInt(optional('RATE_LIMIT_WINDOW_MS', String(15 * 60 * 1000)), 10),
  rateLimitMaxRequests: parseInt(optional('RATE_LIMIT_MAX_REQUESTS', '100'), 10),

  // CORS
  allowedOrigins: getAllowedOrigins(),
};

module.exports = config;
