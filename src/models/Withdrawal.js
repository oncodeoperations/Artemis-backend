const mongoose = require('mongoose');

/**
 * Withdrawal Model
 * Tracks freelancer withdrawal requests and admin processing
 */
const WithdrawalSchema = new mongoose.Schema({
  // Requesting user
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User is required']
  },

  // Amount requested
  amount: {
    type: Number,
    required: [true, 'Withdrawal amount is required'],
    min: [1, 'Minimum withdrawal is 1']
  },

  currency: {
    type: String,
    default: 'USD',
    trim: true,
    uppercase: true
  },

  // Status lifecycle: pending → processing → completed / rejected
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'rejected'],
    default: 'pending'
  },

  // Snapshot of user's bank info at time of request
  withdrawalInfo: {
    bankName: { type: String },
    accountName: { type: String },
    accountNumber: { type: String },
    routingNumber: { type: String },
    bankCountry: { type: String },
    currency: { type: String },
    additionalInfo: { type: String }
  },

  // Admin notes / reason if rejected
  adminNote: {
    type: String,
    trim: true
  },

  // Admin who processed this withdrawal
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  processedAt: {
    type: Date
  },

  // Optional external reference (e.g. bank transfer ID)
  externalReference: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Index for fast queries
WithdrawalSchema.index({ user: 1, status: 1 });
WithdrawalSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Withdrawal', WithdrawalSchema);
