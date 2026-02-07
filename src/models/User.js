const mongoose = require('mongoose');

/**
 * User Model
 * Unified user model for both Freelancers and Business Owners
 * Authentication handled by Clerk
 */
const UserSchema = new mongoose.Schema({
  // Clerk User ID - Primary identifier
  clerkId: {
    type: String,
    required: [true, 'Clerk ID is required'],
    unique: true,
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address']
  },
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true
  },
  role: {
    type: String,
    enum: ['Freelancer', 'BusinessOwner', 'Admin'],
    required: [true, 'Role is required']
  },
  country: {
    type: String,
    required: false,
    trim: true,
    default: ''
  },
  companyName: {
    type: String,
    trim: true,
    // Required only for BusinessOwner role
    validate: {
      validator: function(value) {
        if (this.role === 'BusinessOwner') {
          return value && value.length > 0;
        }
        return true;
      },
      message: 'Company name is required for Business Owners'
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // Email verification status (synced from Clerk)
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  // Last login timestamp
  lastLoginAt: {
    type: Date
  },
  // Optional: Link to evaluated GitHub profile
  githubUsername: {
    type: String,
    trim: true,
    lowercase: true
  },
  // Profession & skills (set during freelancer onboarding)
  profession: {
    type: String,
    trim: true,
    index: true
  },
  professionalRole: {
    type: String,
    trim: true
  },
  skills: [{
    type: String,
    trim: true
  }],
  // Optional: Link to leaderboard entry
  leaderboardEntry: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LeaderboardEntry'
  },
  // Saved developers (for Business Owners)
  savedDevelopers: [{
    type: String, // GitHub usernames
    trim: true
  }],
  // Profile metadata
  profilePicture: {
    type: String,
    trim: true
  },
  bio: {
    type: String,
    trim: true,
    maxlength: 500
  },
  // Stripe Customer ID (for making payments as employer)
  stripeCustomerId: {
    type: String,
    trim: true
  },
  // ── Freelancer Balance & Withdrawal ───────────
  // Available balance (credited when milestones are paid)
  balance: {
    type: Number,
    default: 0,
    min: [0, 'Balance cannot be negative']
  },
  // Lifetime earnings (never decremented)
  totalEarnings: {
    type: Number,
    default: 0
  },
  // Withdrawal bank info (entered by freelancer)
  withdrawalInfo: {
    bankName: { type: String, trim: true },
    accountName: { type: String, trim: true },
    accountNumber: { type: String, trim: true },
    routingNumber: { type: String, trim: true },  // or sort code
    bankCountry: { type: String, trim: true },
    currency: { type: String, trim: true, default: 'USD' },
    additionalInfo: { type: String, trim: true }  // IBAN, SWIFT, etc.
  }
}, {
  timestamps: true
});

// Note: clerkId and email are automatically indexed via unique: true
// No need for explicit index() calls

// Method to get public profile (without sensitive data)
UserSchema.methods.toPublicJSON = function() {
  return {
    _id: this._id,
    clerkId: this.clerkId,
    email: this.email,
    firstName: this.firstName,
    lastName: this.lastName,
    role: this.role,
    country: this.country,
    companyName: this.companyName,
    githubUsername: this.githubUsername,
    profession: this.profession,
    professionalRole: this.professionalRole,
    skills: this.skills,
    profilePicture: this.profilePicture,
    bio: this.bio,
    isActive: this.isActive,
    isEmailVerified: this.isEmailVerified,
    balance: this.balance || 0,
    totalEarnings: this.totalEarnings || 0,
    lastLoginAt: this.lastLoginAt,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

module.exports = mongoose.model('User', UserSchema);
