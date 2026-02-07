const { clerkClient } = require('@clerk/clerk-sdk-node');
const User = require('../models/User');
const { ErrorResponses, sendError } = require('../utils/errorResponses');
const logger = require('../utils/logger');
const auditService = require('../services/auditService');

/**
 * Middleware to verify Clerk session token and attach user to request
 */
const requireAuth = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, ErrorResponses.authRequired());
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Quick check: JWT must be three dot-separated segments
    const tokenParts = token.split('.');
    if (tokenParts.length !== 3 || tokenParts.some(p => p.length === 0)) {
      return sendError(res, ErrorResponses.invalidToken());
    }

    // Verify Clerk session token
    let clerkUserId;
    let clerkUser;
    try {
      const sessionClaims = await clerkClient.verifyToken(token);
      clerkUserId = sessionClaims.sub; // Clerk user ID
      
      // Fetch full user details from Clerk
      clerkUser = await clerkClient.users.getUser(clerkUserId);
    } catch (err) {
      const correlationId = req.headers['x-correlation-id'];
      logger.withContext({ correlationId }).error('Token verification failed', { error: err.message });
      
      // Audit log: Invalid token attempt
      await auditService.logInvalidToken(req, err.message);
      
      return sendError(res, ErrorResponses.invalidToken());
    }

    // Get user from MongoDB using clerkId
    let user = await User.findOne({ clerkId: clerkUserId });

    // If user doesn't exist in MongoDB but has valid Clerk token, create them
    // This handles the case where webhook hasn't processed yet
    if (!user && clerkUser) {
      const correlationId = req.headers['x-correlation-id'];
      logger.withContext({ correlationId, clerkUserId }).info('Creating user in MongoDB (webhook may not have processed yet)');
      
      const primaryEmail = clerkUser.emailAddresses.find(
        (email) => email.id === clerkUser.primaryEmailAddressId
      );

      const email = primaryEmail?.emailAddress?.toLowerCase() || '';
      const newRole = clerkUser.publicMetadata?.role || clerkUser.unsafeMetadata?.role;
      
      // Critical: No role found - this should never happen
      if (!newRole) {
        const correlationId = req.headers['x-correlation-id'];
        logger.withContext({ correlationId, clerkUserId, email }).error('No role found in Clerk metadata', {
          publicMetadata: clerkUser.publicMetadata,
          unsafeMetadata: clerkUser.unsafeMetadata
        });
        return sendError(res, ErrorResponses.internalError(
          'Account role not specified. Please contact support or sign up again.'
        ));
      }

      // Check if this email already exists with a different Clerk ID
      const existingUserWithEmail = await User.findOne({ email });
      
      if (existingUserWithEmail && existingUserWithEmail.clerkId !== clerkUserId) {
        const correlationId = req.headers['x-correlation-id'];
        logger.withContext({ correlationId, email }).error('Email already registered with different role', {
          existingRole: existingUserWithEmail.role,
          attemptedRole: newRole
        });
        
        // Audit log: Login failed due to email conflict
        await auditService.logLoginFailed(req, 'Email already registered with different role', email);
        
        return sendError(res, ErrorResponses.emailAlreadyExists(
          existingUserWithEmail.role,
          newRole
        ));
      }

      // Use findOneAndUpdate with upsert to atomically create user
      // This prevents race conditions when multiple requests arrive simultaneously
      try {
        user = await User.findOneAndUpdate(
          { clerkId: clerkUserId }, // Find by clerkId
          {
            $setOnInsert: {
              clerkId: clerkUser.id,
              email,
              firstName: clerkUser.firstName || '',
              lastName: clerkUser.lastName || '',
              role: newRole,
              country: clerkUser.publicMetadata?.country || clerkUser.unsafeMetadata?.country || '',
              profilePicture: clerkUser.imageUrl,
              isActive: true,
              isEmailVerified: primaryEmail?.verification?.status === 'verified',
              createdAt: new Date(),
            },
            $set: {
              lastLoginAt: new Date(),
              updatedAt: new Date(),
            }
          },
          { 
            upsert: true,  // Create if doesn't exist
            new: true,     // Return the updated document
            runValidators: true
          }
        );
        
        const correlationId = req.headers['x-correlation-id'];
        logger.withContext({ correlationId, userId: user._id, clerkUserId }).info('User created/updated successfully in MongoDB');
      } catch (saveError) {
        const correlationId = req.headers['x-correlation-id'];
        logger.withContext({ correlationId, clerkUserId }).error('Error creating/updating user in MongoDB', {
          error: saveError.message,
          code: saveError.code
        });
        
        // Check if it's a duplicate email error
        if (saveError.code === 11000 && saveError.keyPattern?.email) {
          return sendError(res, ErrorResponses.duplicateResource(
            'This email is already registered. You cannot create multiple accounts with the same email.'
          ));
        }
        
        // For other errors, return 500
        return sendError(res, ErrorResponses.databaseError());
      }
    }

    if (!user) {
      return sendError(res, ErrorResponses.userNotFound());
    }

    if (!user.isActive) {
      return sendError(res, ErrorResponses.accountDeactivated());
    }

    // Attach user to request object
    req.user = user;
    req.clerkUserId = clerkUserId;
    
    // Audit log: Successful authentication
    await auditService.logLogin(req, user);
    
    next();

  } catch (error) {
    const correlationId = req.headers['x-correlation-id'];
    logger.withContext({ correlationId }).error('Auth middleware error', { error: error.message, stack: error.stack });
    return sendError(res, ErrorResponses.internalError(
      'An error occurred during authentication.'
    ));
  }
};

/**
 * Optional auth middleware - doesn't block if no token provided
 * Useful for endpoints that work both authenticated and unauthenticated
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No token provided - continue without user
      req.user = null;
      req.clerkUserId = null;
      return next();
    }

    const token = authHeader.substring(7);

    try {
      // Verify Clerk token
      const sessionClaims = await clerkClient.verifyToken(token);
      const clerkUserId = sessionClaims.sub;
      
      // Get user from MongoDB
      const user = await User.findOne({ clerkId: clerkUserId });

      if (user && user.isActive) {
        req.user = user;
        req.clerkUserId = clerkUserId;
      } else {
        req.user = null;
        req.clerkUserId = null;
      }
    } catch (err) {
      // Token invalid - continue without user
      req.user = null;
      req.clerkUserId = null;
    }

    next();

  } catch (error) {
    // Error - continue without user
    req.user = null;
    req.clerkUserId = null;
    next();
  }
};

/**
 * Middleware to check if user has specific role
 */
const requireRole = (...allowedRoles) => {
  return async (req, res, next) => {
    if (!req.user) {
      return sendError(res, ErrorResponses.authRequired());
    }

    if (!allowedRoles.includes(req.user.role)) {
      // Audit log: Role-based access denied
      await auditService.logRoleAccessDenied(
        req, 
        req.user, 
        allowedRoles.join(' or '), 
        req.originalUrl
      );
      
      return sendError(res, ErrorResponses.forbidden(allowedRoles));
    }

    next();
  };
};

/**
 * Middleware to check if user has verified their email
 */
const requireVerification = async (req, res, next) => {
  if (!req.user) {
    return sendError(res, ErrorResponses.authRequired());
  }

  if (!req.user.isEmailVerified) {
    // Audit log: Permission denied due to unverified email
    await auditService.logPermissionDenied(
      req, 
      req.user, 
      'Email verification required to access this resource'
    );
    
    return sendError(res, ErrorResponses.emailNotVerified());
  }

  next();
};

module.exports = {
  requireAuth,
  optionalAuth,
  requireRole,
  requireVerification
};
