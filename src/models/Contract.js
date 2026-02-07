const mongoose = require('mongoose');

/**
 * Contract Model
 * Manages fixed-price and hourly contracts between creators and contributors
 */
const ContractSchema = new mongoose.Schema({
  contractName: {
    type: String,
    required: [true, 'Contract name is required'],
    maxlength: [70, 'Contract name cannot exceed 70 characters'],
    trim: true
  },
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Contract creator is required']
  },
  contributor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  contributorEmail: {
    type: String,
    required: [function() { return this.status !== 'draft'; }, 'Contributor email is required'],
    trim: true,
    lowercase: true
  },
  category: {
    type: String,
    required: [function() { return this.status !== 'draft'; }, 'Category is required'],
    trim: true
  },
  subcategory: {
    type: String,
    trim: true
  },
  description: {
    type: String,
    required: [function() { return this.status !== 'draft'; }, 'Description is required']
  },
  contractType: {
    type: String,
    enum: {
      values: ['fixed', 'hourly'],
      message: 'Contract type must be either "fixed" or "hourly"'
    },
    required: [function() { return this.status !== 'draft'; }, 'Contract type is required']
  },
  // Fixed-price contract fields
  budget: {
    type: Number,
    required: function() {
      return this.status !== 'draft' && this.contractType === 'fixed';
    },
    min: [0, 'Budget cannot be negative']
  },
  splitMilestones: {
    type: Boolean,
    default: false
  },
  milestones: [{
    name: {
      type: String,
      required: true,
      trim: true
    },
    budget: {
      type: Number,
      required: true,
      min: [0, 'Milestone budget cannot be negative']
    },
    dueDate: {
      type: Date
    },
    status: {
      type: String,
      enum: ['pending', 'in-progress', 'submitted', 'approved', 'paid', 'rejected'],
      default: 'pending'
    },
    submissionDetails: {
      type: String
    },
    submittedAt: {
      type: Date
    },
    approvedAt: {
      type: Date
    },
    paymentIntentId: {
      type: String
    },
    paidAt: {
      type: Date
    },
    payoutAmount: {
      type: Number
    },
    // Revision tracking
    revisionCount: {
      type: Number,
      default: 0
    },
    // Payment failure tracking
    paymentStatus: {
      type: String,
      enum: ['none', 'processing', 'succeeded', 'failed'],
      default: 'none'
    },
    paymentFailedAt: {
      type: Date
    },
    paymentAttempts: {
      type: Number,
      default: 0
    },
    paymentError: {
      type: String
    },
    // Activity log — keeps the full message thread between parties
    activityLog: [{
      action: {
        type: String,
        enum: [
          'submitted', 'approved', 'changes_requested', 'resubmitted',
          'payment_initiated', 'payment_succeeded', 'payment_failed'
        ],
        required: true
      },
      by: {
        type: String,
        enum: ['creator', 'contributor', 'system'],
        required: true
      },
      message: { type: String },
      timestamp: { type: Date, default: Date.now }
    }],
    order: {
      type: Number,
      required: true
    }
  }],
  // Hourly contract fields
  hourlyRate: {
    type: Number,
    required: function() {
      return this.status !== 'draft' && this.contractType === 'hourly';
    },
    min: [0, 'Hourly rate cannot be negative']
  },
  weeklyLimit: {
    type: Number,
    min: [0, 'Weekly limit cannot be negative']
  },
  hoursPerWeek: {
    type: Number,
    min: [0, 'Hours per week cannot be negative']
  },
  // Common fields
  currency: {
    type: String,
    default: 'USD',
    trim: true,
    uppercase: true
  },
  dueDate: {
    type: Date
  },
  status: {
    type: String,
    enum: {
      values: ['draft', 'pending', 'active', 'completed', 'rejected', 'disputed', 'archived'],
      message: 'Invalid contract status'
    },
    default: 'draft'
  },
  platformFee: {
    type: Number,
    default: 3.6, // percentage
    min: [0, 'Platform fee cannot be negative'],
    max: [100, 'Platform fee cannot exceed 100%']
  },
  // Metadata
  rejectionReason: {
    type: String
  },
  completedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Validate milestone budgets sum to total budget for fixed contracts (skip for drafts)
ContractSchema.pre('save', function(next) {
  if (this.status !== 'draft' && this.contractType === 'fixed' && this.splitMilestones && this.milestones.length > 0) {
    const totalMilestoneBudget = this.milestones.reduce((sum, m) => sum + m.budget, 0);
    if (Math.abs(totalMilestoneBudget - this.budget) > 0.01) {
      return next(new Error('Milestone budgets must sum to total contract budget'));
    }
  }
  next();
});

// Limit milestones to 10
ContractSchema.pre('save', function(next) {
  if (this.milestones && this.milestones.length > 10) {
    return next(new Error('Cannot have more than 10 milestones'));
  }
  next();
});

// Calculate payout amount with platform fee
ContractSchema.methods.calculatePayout = function() {
  let amount = 0;
  
  if (this.contractType === 'fixed') {
    amount = this.budget;
  } else if (this.contractType === 'hourly' && this.hoursPerWeek) {
    amount = this.hourlyRate * this.hoursPerWeek;
  }
  
  const fee = amount * (this.platformFee / 100);
  const payout = amount - fee;
  
  return {
    amount: amount,
    fee: parseFloat(fee.toFixed(2)),
    payout: parseFloat(payout.toFixed(2))
  };
};

// Get contract progress
ContractSchema.methods.getProgress = function() {
  if (this.contractType === 'hourly' || !this.milestones || this.milestones.length === 0) {
    return {
      total: 0,
      completed: 0,
      percentage: 0
    };
  }

  const total = this.milestones.length;
  const completed = this.milestones.filter(m => 
    m.status === 'approved' || m.status === 'paid'
  ).length;

  return {
    total,
    completed,
    percentage: total > 0 ? Math.round((completed / total) * 100) : 0
  };
};

// Index for queries
ContractSchema.index({ creator: 1, status: 1 });
ContractSchema.index({ contributor: 1, status: 1 });
ContractSchema.index({ contributorEmail: 1 });
ContractSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Contract', ContractSchema);
