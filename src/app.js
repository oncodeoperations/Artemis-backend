const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const githubRoutes = require('./routes/githubRoutes');
const leaderboardRoutes = require('./routes/leaderboardRoutes');
require('dotenv').config();

const app = express();

// Rate limiting middleware
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// CORS Configuration
const getAllowedOrigins = () => {
  const envOrigins = process.env.ALLOWED_ORIGINS;
  const defaultOrigins = process.env.NODE_ENV === 'production' 
    ? ['https://artemisfe.vercel.app'] 
    : ['http://localhost:8080', 'http://localhost:5173', 'http://172.20.10.2:8080'];
  
  if (envOrigins) {
    return envOrigins.split(',').map(origin => origin.trim());
  }
  
  return defaultOrigins;
};

// Middleware
app.use(limiter);
app.use(cors({
  origin: getAllowedOrigins(),
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'Artemis Developer Evaluator Backend'
  });
});

// API routes
app.use('/api', githubRoutes);
app.use('/api/leaderboard', leaderboardRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    message: `The requested endpoint ${req.originalUrl} was not found on this server.`
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
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
