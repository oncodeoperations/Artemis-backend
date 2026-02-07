const mongoose = require('mongoose');

/**
 * AuditLog Schema - Tracks security and authentication events
 */
const auditLogSchema = new mongoose.Schema({
  // Event information
  eventType: {
    type: String,
    required: true,
    enum: [
      'LOGIN_SUCCESS',
      'LOGIN_FAILED',
      'LOGOUT',
      'TOKEN_REFRESH',
      'TOKEN_INVALID',
      'EMAIL_VERIFICATION_CHANGED',
      'PASSWORD_CHANGED',
      'ROLE_ACCESS_DENIED',
      'ACCOUNT_CREATED',
      'ACCOUNT_UPDATED',
      'ACCOUNT_DEACTIVATED',
      'PERMISSION_DENIED',
      'SUSPICIOUS_ACTIVITY'
    ]
  },
  
  // User information
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  clerkId: {
    type: String,
    index: true
  },
  email: {
    type: String,
    index: true
  },
  role: String,
  
  // Request metadata
  ipAddress: String,
  userAgent: String,
  correlationId: String,
  
  // Resource accessed
  resource: String,  // e.g., '/api/contracts', '/api/users/:id'
  action: String,    // e.g., 'POST', 'PUT', 'DELETE'
  
  // Event details
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  
  // Status
  success: {
    type: Boolean,
    default: true
  },
  errorMessage: String,
  
  // Timestamp
  timestamp: {
    type: Date,
    default: Date.now
    // Note: indexed via TTL index below (no need for index: true)
  }
}, {
  timestamps: false  // We use custom timestamp field
});

// Compound indexes for common queries
auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ eventType: 1, timestamp: -1 });
auditLogSchema.index({ clerkId: 1, timestamp: -1 });
auditLogSchema.index({ success: 1, eventType: 1, timestamp: -1 });

// TTL index to automatically delete old logs after 90 days
auditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 7776000 }); // 90 days

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

module.exports = AuditLog;
