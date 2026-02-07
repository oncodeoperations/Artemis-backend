const AuditLog = require('../models/AuditLog');
const logger = require('../utils/logger');

/**
 * Service for recording security and authentication audit logs
 */
class AuditService {
  
  /**
   * Log an authentication or security event
   * @param {Object} eventData - Event information
   * @param {string} eventData.eventType - Type of event (LOGIN_SUCCESS, etc.)
   * @param {Object} req - Express request object (optional)
   * @param {Object} user - User object (optional)
   * @param {Object} details - Additional event details (optional)
   * @param {boolean} success - Whether the event was successful (default: true)
   * @param {string} errorMessage - Error message if failed (optional)
   */
  async logEvent({ eventType, req, user, details = {}, success = true, errorMessage = null }) {
    try {
      const auditData = {
        eventType,
        success,
        errorMessage,
        details,
        timestamp: new Date()
      };

      // Extract user information
      if (user) {
        auditData.userId = user._id || user.userId;
        auditData.clerkId = user.clerkId;
        auditData.email = user.email;
        auditData.role = user.role;
      }

      // Extract request metadata
      if (req) {
        auditData.ipAddress = this.getClientIp(req);
        auditData.userAgent = req.headers['user-agent'];
        auditData.correlationId = req.headers['x-correlation-id'];
        auditData.resource = req.originalUrl || req.url;
        auditData.action = req.method;
      }

      // Create audit log entry
      const auditLog = new AuditLog(auditData);
      await auditLog.save();

      // Also log to winston for immediate visibility
      const logLevel = success ? 'info' : 'warn';
      logger.withContext({ 
        correlationId: auditData.correlationId,
        userId: auditData.userId 
      })[logLevel](`Audit: ${eventType}`, {
        event: eventType,
        user: auditData.email || auditData.clerkId,
        ip: auditData.ipAddress,
        success,
        details
      });

      return auditLog;
    } catch (error) {
      // Audit logging should never break the application
      logger.error('Failed to create audit log', { 
        eventType, 
        error: error.message 
      });
    }
  }

  /**
   * Log successful login
   */
  async logLogin(req, user) {
    return this.logEvent({
      eventType: 'LOGIN_SUCCESS',
      req,
      user,
      details: {
        loginMethod: 'clerk_jwt'
      }
    });
  }

  /**
   * Log failed login attempt
   */
  async logLoginFailed(req, reason, email = null) {
    return this.logEvent({
      eventType: 'LOGIN_FAILED',
      req,
      user: email ? { email } : null,
      success: false,
      errorMessage: reason,
      details: { reason }
    });
  }

  /**
   * Log token refresh
   */
  async logTokenRefresh(req, user) {
    return this.logEvent({
      eventType: 'TOKEN_REFRESH',
      req,
      user,
      details: {
        refreshMethod: 'automatic'
      }
    });
  }

  /**
   * Log invalid token attempt
   */
  async logInvalidToken(req, reason) {
    return this.logEvent({
      eventType: 'TOKEN_INVALID',
      req,
      success: false,
      errorMessage: reason,
      details: { reason }
    });
  }

  /**
   * Log email verification change
   */
  async logEmailVerificationChange(req, user, verified) {
    return this.logEvent({
      eventType: 'EMAIL_VERIFICATION_CHANGED',
      req,
      user,
      details: {
        verified,
        previousStatus: !verified
      }
    });
  }

  /**
   * Log role-based access denial
   */
  async logRoleAccessDenied(req, user, requiredRole, resource) {
    return this.logEvent({
      eventType: 'ROLE_ACCESS_DENIED',
      req,
      user,
      success: false,
      errorMessage: `User with role ${user?.role} attempted to access ${resource} requiring ${requiredRole}`,
      details: {
        userRole: user?.role,
        requiredRole,
        resource
      }
    });
  }

  /**
   * Log permission denied (email verification required)
   */
  async logPermissionDenied(req, user, reason) {
    return this.logEvent({
      eventType: 'PERMISSION_DENIED',
      req,
      user,
      success: false,
      errorMessage: reason,
      details: {
        reason,
        isEmailVerified: user?.isEmailVerified
      }
    });
  }

  /**
   * Log account creation
   */
  async logAccountCreated(req, user) {
    return this.logEvent({
      eventType: 'ACCOUNT_CREATED',
      req,
      user,
      details: {
        role: user.role,
        createdVia: 'clerk_webhook'
      }
    });
  }

  /**
   * Log account deactivation
   */
  async logAccountDeactivated(req, user) {
    return this.logEvent({
      eventType: 'ACCOUNT_DEACTIVATED',
      req,
      user,
      details: {
        reason: 'user_requested'
      }
    });
  }

  /**
   * Log suspicious activity
   */
  async logSuspiciousActivity(req, user, reason, details = {}) {
    return this.logEvent({
      eventType: 'SUSPICIOUS_ACTIVITY',
      req,
      user,
      success: false,
      errorMessage: reason,
      details: { ...details, reason }
    });
  }

  /**
   * Get client IP address from request
   */
  getClientIp(req) {
    return req.headers['x-forwarded-for']?.split(',')[0].trim() ||
           req.headers['x-real-ip'] ||
           req.connection?.remoteAddress ||
           req.socket?.remoteAddress ||
           'unknown';
  }

  /**
   * Query audit logs with filters
   * @param {Object} filters - Query filters
   * @param {number} limit - Maximum records to return (default: 100)
   */
  async queryLogs(filters = {}, limit = 100) {
    try {
      const query = {};

      if (filters.userId) query.userId = filters.userId;
      if (filters.clerkId) query.clerkId = filters.clerkId;
      if (filters.email) query.email = filters.email;
      if (filters.eventType) query.eventType = filters.eventType;
      if (filters.success !== undefined) query.success = filters.success;
      if (filters.ipAddress) query.ipAddress = filters.ipAddress;
      
      // Date range filter
      if (filters.startDate || filters.endDate) {
        query.timestamp = {};
        if (filters.startDate) query.timestamp.$gte = new Date(filters.startDate);
        if (filters.endDate) query.timestamp.$lte = new Date(filters.endDate);
      }

      const logs = await AuditLog.find(query)
        .sort({ timestamp: -1 })
        .limit(limit)
        .lean();

      return logs;
    } catch (error) {
      logger.error('Failed to query audit logs', { error: error.message, filters });
      throw error;
    }
  }

  /**
   * Get security statistics for a user
   */
  async getUserSecurityStats(userId) {
    try {
      const stats = await AuditLog.aggregate([
        { $match: { userId: mongoose.Types.ObjectId(userId) } },
        {
          $group: {
            _id: '$eventType',
            count: { $sum: 1 },
            lastOccurrence: { $max: '$timestamp' }
          }
        }
      ]);

      return stats;
    } catch (error) {
      logger.error('Failed to get user security stats', { userId, error: error.message });
      throw error;
    }
  }
}

module.exports = new AuditService();
