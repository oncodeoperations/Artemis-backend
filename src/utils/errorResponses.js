/**
 * Standard Error Response Structure and Status Codes
 * Ensures consistent error handling across the backend
 */

/**
 * Standard error codes for the application
 */
const ERROR_CODES = {
  // Authentication errors (401)
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  AUTH_INVALID_TOKEN: 'AUTH_INVALID_TOKEN',
  AUTH_TOKEN_EXPIRED: 'AUTH_TOKEN_EXPIRED',
  
  // Authorization errors (403)
  FORBIDDEN: 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  ACCOUNT_DEACTIVATED: 'ACCOUNT_DEACTIVATED',
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  
  // Resource errors (404)
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  
  // Conflict errors (409)
  EMAIL_ALREADY_EXISTS: 'EMAIL_ALREADY_EXISTS',
  DUPLICATE_RESOURCE: 'DUPLICATE_RESOURCE',
  
  // Validation errors (400)
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  
  // Server errors (500)
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
};

/**
 * Create a standardized error response
 * @param {number} statusCode - HTTP status code
 * @param {string} errorCode - Application error code
 * @param {string} message - User-friendly error message
 * @param {object} additionalData - Additional error context
 * @returns {object} Standardized error response
 */
const createErrorResponse = (statusCode, errorCode, message, additionalData = {}) => {
  const response = {
    success: false,
    error: {
      code: errorCode,
      message,
      timestamp: new Date().toISOString(),
    }
  };

  // Add additional data if provided
  if (Object.keys(additionalData).length > 0) {
    response.error.details = additionalData;
  }

  // Add stack trace in development
  if (process.env.NODE_ENV !== 'production' && additionalData.stack) {
    response.error.stack = additionalData.stack;
  }

  return { statusCode, response };
};

/**
 * Predefined error responses
 */
const ErrorResponses = {
  // 401 Unauthorized
  authRequired: () => createErrorResponse(
    401,
    ERROR_CODES.AUTH_REQUIRED,
    'Authentication required. Please provide a valid authentication token.'
  ),
  
  invalidToken: () => createErrorResponse(
    401,
    ERROR_CODES.AUTH_INVALID_TOKEN,
    'The provided authentication token is invalid or expired. Please sign in again.'
  ),
  
  // 403 Forbidden
  forbidden: (requiredRoles = []) => createErrorResponse(
    403,
    ERROR_CODES.INSUFFICIENT_PERMISSIONS,
    'You do not have permission to access this resource.',
    { requiredRoles }
  ),
  
  accountDeactivated: () => createErrorResponse(
    403,
    ERROR_CODES.ACCOUNT_DEACTIVATED,
    'Your account has been deactivated. Please contact support for assistance.'
  ),
  
  emailNotVerified: () => createErrorResponse(
    403,
    ERROR_CODES.EMAIL_NOT_VERIFIED,
    'Email verification required. Please verify your email address to access this resource.',
    { needsVerification: true }
  ),
  
  // 404 Not Found
  userNotFound: () => createErrorResponse(
    404,
    ERROR_CODES.USER_NOT_FOUND,
    'User account not found. Please ensure you have completed the signup process.'
  ),
  
  resourceNotFound: (resourceType) => createErrorResponse(
    404,
    ERROR_CODES.RESOURCE_NOT_FOUND,
    `The requested ${resourceType || 'resource'} was not found.`
  ),
  
  // 409 Conflict
  emailAlreadyExists: (existingRole, attemptedRole) => createErrorResponse(
    409,
    ERROR_CODES.EMAIL_ALREADY_EXISTS,
    `This email is already registered as a ${existingRole}. You cannot create multiple accounts with different roles.`,
    { existingRole, attemptedRole }
  ),
  
  duplicateResource: (message) => createErrorResponse(
    409,
    ERROR_CODES.DUPLICATE_RESOURCE,
    message || 'This resource already exists.'
  ),
  
  // 400 Bad Request
  validationError: (errors) => createErrorResponse(
    400,
    ERROR_CODES.VALIDATION_ERROR,
    'Validation failed. Please check your input.',
    { errors }
  ),
  
  invalidInput: (field, reason) => createErrorResponse(
    400,
    ERROR_CODES.INVALID_INPUT,
    `Invalid input: ${reason}`,
    { field }
  ),
  
  // 500 Internal Server Error
  internalError: (message) => createErrorResponse(
    500,
    ERROR_CODES.INTERNAL_SERVER_ERROR,
    message || 'An internal server error occurred. Please try again later.'
  ),
  
  databaseError: () => createErrorResponse(
    500,
    ERROR_CODES.DATABASE_ERROR,
    'A database error occurred. Please try again later.'
  ),
};

/**
 * Express error response helper
 * @param {object} res - Express response object
 * @param {object} error - Error response from ErrorResponses
 */
const sendError = (res, error) => {
  const { statusCode, response } = error;
  res.status(statusCode).json(response);
};

module.exports = {
  ERROR_CODES,
  createErrorResponse,
  ErrorResponses,
  sendError,
};
