const winston = require('winston');
const path = require('path');

/**
 * Custom log format with timestamps and correlation IDs
 */
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp', 'label'] }),
  winston.format.printf(({ timestamp, level, message, metadata }) => {
    const correlationId = metadata.correlationId ? `[${metadata.correlationId}]` : '';
    const userId = metadata.userId ? `[User: ${metadata.userId}]` : '';
    const metaStr = Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : '';
    
    return `${timestamp} ${level.toUpperCase()} ${correlationId}${userId}: ${message} ${metaStr}`.trim();
  })
);

/**
 * Console format with colors for development
 */
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  logFormat
);

/**
 * Winston logger instance
 * Logs to both console and files
 */
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'artemis-backend' },
  transports: [
    // Error logs: only errors
    new winston.transports.File({
      filename: path.join('logs', 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Combined logs: all levels
    new winston.transports.File({
      filename: path.join('logs', 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
});

/**
 * Console logging for development
 */
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: consoleFormat,
    })
  );
}

/**
 * Helper methods with correlation ID support
 */
logger.withContext = (context = {}) => {
  return {
    info: (message, meta = {}) => logger.info(message, { ...context, ...meta }),
    warn: (message, meta = {}) => logger.warn(message, { ...context, ...meta }),
    error: (message, meta = {}) => logger.error(message, { ...context, ...meta }),
    debug: (message, meta = {}) => logger.debug(message, { ...context, ...meta }),
  };
};

/**
 * Express middleware to attach logger to request
 */
logger.requestMiddleware = (req, res, next) => {
  const correlationId = req.headers['x-correlation-id'];
  const userId = req.user?.userId;
  
  req.logger = logger.withContext({ correlationId, userId });
  next();
};

module.exports = logger;
