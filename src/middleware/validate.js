const { ZodError } = require('zod');
const logger = require('../utils/logger');

/**
 * Express middleware factory for Zod schema validation.
 *
 * @param {{ body?: ZodSchema, query?: ZodSchema, params?: ZodSchema }} schemas
 *   An object whose keys indicate which part of the request to validate.
 * @returns {Function} Express middleware
 *
 * @example
 *   const { validate } = require('../middleware/validate');
 *   router.post('/', validate({ body: createContractBody }), controller.create);
 */
const validate = (schemas) => (req, res, next) => {
  const errors = [];

  try {
    if (schemas.params) {
      req.params = schemas.params.parse(req.params);
    }
  } catch (err) {
    if (err instanceof ZodError) {
      errors.push(...formatZodErrors(err, 'params'));
    }
  }

  try {
    if (schemas.query) {
      req.query = schemas.query.parse(req.query);
    }
  } catch (err) {
    if (err instanceof ZodError) {
      errors.push(...formatZodErrors(err, 'query'));
    }
  }

  try {
    if (schemas.body) {
      req.body = schemas.body.parse(req.body);
    }
  } catch (err) {
    if (err instanceof ZodError) {
      errors.push(...formatZodErrors(err, 'body'));
    }
  }

  if (errors.length > 0) {
    logger.warn('Request validation failed', {
      url: req.originalUrl,
      method: req.method,
      errorCount: errors.length,
    });
    return res.status(400).json({
      error: 'Validation failed',
      details: errors,
    });
  }

  next();
};

/**
 * Format Zod issues into a consistent shape.
 */
function formatZodErrors(zodError, source) {
  return zodError.issues.map((issue) => ({
    source,
    path: issue.path.join('.'),
    message: issue.message,
    code: issue.code,
  }));
}

module.exports = { validate };
