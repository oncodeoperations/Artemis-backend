const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const config = require('./config');
const logger = require('./utils/logger');
const githubRoutes = require('./routes/githubRoutes');
const leaderboardRoutes = require('./routes/leaderboardRoutes');
const codeRoutes = require('./routes/codeRoutes');
const authRoutes = require('./routes/auth');
const contractRoutes = require('./routes/contracts');
const notificationRoutes = require('./routes/notifications');
const userRoutes = require('./routes/users');
const adminRoutes = require('./routes/admin');
const assessmentRoutes = require('./routes/assessments');
const clerkWebhookController = require('./controllers/clerkWebhookController');
const paymentRoutes = require('./routes/payments');
const paymentController = require('./controllers/paymentController');

const app = express();

// ─── Rate Limiting ──────────────────────────────────────────────
// Global limiter
const limiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMaxRequests,
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter limiter for expensive / sensitive endpoints
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: { error: 'Rate limit exceeded on this endpoint. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware
app.use(limiter);

// Security Headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "https:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));

app.use(cors({
  origin: config.allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-ID']
}));

// Webhook routes MUST come before express.json() to handle raw body
app.post('/api/webhooks/clerk', express.raw({ type: 'application/json' }), clerkWebhookController.handleWebhook);
app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), paymentController.handleWebhook);

// Regular JSON middleware for other routes
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Sanitize inputs against NoSQL injection
app.use(mongoSanitize());

// Logger middleware - attaches logger to req with correlation ID and user context
app.use(logger.requestMiddleware);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'Artemis Developer Evaluator Backend'
  });
});

// Swagger API docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'Artemis AI — API Docs',
  customCss: '.swagger-ui .topbar { display: none }',
}));
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// API routes
// Authentication & User Management
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);

// Contract Management
app.use('/api/contracts', contractRoutes);

// Assessments
app.use('/api/assessments', assessmentRoutes);

// Payments
app.use('/api/payments', paymentRoutes);

// Notifications
app.use('/api/notifications', notificationRoutes);

// Developer Evaluation & Leaderboard (strict rate limit — expensive endpoint)
app.use('/api', strictLimiter, githubRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api', codeRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    message: `The requested endpoint ${req.originalUrl} was not found on this server.`
  });
});

// Global error handler
app.use((err, req, res, next) => {
  const correlationId = req.headers['x-correlation-id'];
  logger.withContext({ correlationId }).error('Global error handler caught error', { 
    error: err.message, 
    stack: err.stack,
    url: req.originalUrl,
    method: req.method
  });
  
  const status = err.status || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : err.message;

  res.status(status).json({
    error: message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

module.exports = app;
