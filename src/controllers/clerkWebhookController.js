const { Webhook } = require('svix');
const User = require('../models/User');
const auditService = require('../services/auditService');
const logger = require('../utils/logger');

/**
 * Clerk Webhook Controller
 * Handles webhooks from Clerk for user lifecycle events
 */

/**
 * Handle Clerk webhooks
 * Verifies signature and processes user events
 */
const handleWebhook = async (req, res) => {
  try {
    // Get Svix headers for verification
    const svixId = req.headers['svix-id'];
    const svixTimestamp = req.headers['svix-timestamp'];
    const svixSignature = req.headers['svix-signature'];

    // Verify webhook signature
    if (!svixId || !svixTimestamp || !svixSignature) {
      return res.status(400).json({ 
        error: 'Missing Svix headers' 
      });
    }

    // Verify timestamp to prevent replay attacks
    // Svix timestamps are in seconds, convert to milliseconds
    const webhookTimestamp = parseInt(svixTimestamp) * 1000;
    const currentTimestamp = Date.now();
    const timeDifference = currentTimestamp - webhookTimestamp;
    
    // Reject webhooks older than 5 minutes (300,000 ms)
    const MAX_WEBHOOK_AGE = 5 * 60 * 1000;
    
    if (timeDifference > MAX_WEBHOOK_AGE) {
      logger.warn('Webhook rejected: too old', { ageSeconds: Math.floor(timeDifference / 1000) });
      return res.status(400).json({
        error: 'Webhook timestamp too old',
        message: 'This webhook has expired and cannot be processed'
      });
    }
    
    // Reject webhooks with future timestamps (clock skew tolerance: 1 minute)
    if (timeDifference < -60000) {
      logger.warn('Webhook rejected: timestamp in future', { secondsAhead: Math.abs(Math.floor(timeDifference / 1000)) });
      return res.status(400).json({
        error: 'Invalid webhook timestamp',
        message: 'Webhook timestamp is in the future'
      });
    }

    // Verify the webhook signature
    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
    
    if (!webhookSecret) {
      logger.error('CLERK_WEBHOOK_SECRET is not configured');
      return res.status(500).json({ 
        error: 'Webhook secret not configured' 
      });
    }

    const wh = new Webhook(webhookSecret);
    let evt;

    try {
      // Verify and parse the webhook payload
      evt = wh.verify(JSON.stringify(req.body), {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': svixSignature,
      });
    } catch (err) {
      logger.error('Webhook signature verification failed', { details: err.message });
      return res.status(400).json({ 
        error: 'Invalid signature',
        message: err.message 
      });
    }

    // Handle different event types
    const { type, data } = evt;

    switch (type) {
      case 'user.created':
        await handleUserCreated(data);
        break;
      
      case 'user.updated':
        await handleUserUpdated(data);
        break;
      
      case 'user.deleted':
        await handleUserDeleted(data);
        break;
      
      default:
        logger.info('Unhandled webhook event type', { type });
    }

    res.status(200).json({ received: true });

  } catch (error) {
    // Return 200 for verified webhooks to prevent Clerk retry storms on non-transient errors
    logger.error('Webhook processing error', { error: error.message, stack: error.stack });
    res.status(200).json({ 
      received: true,
      error: 'Webhook processing failed internally'
    });
  }
};

/**
 * Handle user.created event
 * Creates a new user in MongoDB when they sign up via Clerk
 */
const handleUserCreated = async (clerkUser) => {
  try {
    const {
      id: clerkId,
      email_addresses,
      first_name,
      last_name,
      unsafe_metadata,
      public_metadata,
      image_url,
      external_accounts
    } = clerkUser;

    // Get primary email
    const primaryEmail = email_addresses?.find(email => email.id === clerkUser.primary_email_address_id);
    
    if (!primaryEmail) {
      throw new Error('No primary email found for user');
    }

    const email = primaryEmail.email_address;
    const isEmailVerified = primaryEmail.verification?.status === 'verified';

    // Get role from metadata (set during signup)
    const role = unsafe_metadata?.role || public_metadata?.role;
    
    // Enhanced logging for role debugging
    logger.info('Webhook user.created - Processing new user', {
      clerkId,
      email,
      role,
      hasUnsafeMetadata: !!unsafe_metadata?.role,
      hasPublicMetadata: !!public_metadata?.role,
      unsafeMetadata: unsafe_metadata,
      publicMetadata: public_metadata
    });

    if (!role) {
      logger.error('Webhook user.created - No role specified', {
        clerkId,
        email,
        unsafe_metadata,
        public_metadata
      });
      throw new Error('No role specified in user metadata. Sign up through proper role selection page.');
    }
    
    // Validate role
    if (role !== 'Freelancer' && role !== 'BusinessOwner') {
      logger.error('Webhook user.created - Invalid role', { clerkId, email, role });
      throw new Error(`Invalid role: ${role}. Must be 'Freelancer' or 'BusinessOwner'.`);
    }

    // Check if email already exists with a different role
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    
    if (existingUser) {
      // Email already exists - this shouldn't happen with Clerk but handle it
      const errorMsg = `Email ${email} is already registered as ${existingUser.role}. Users cannot have multiple accounts with different roles.`;
      logger.error('Duplicate email registration attempted', { email, existingRole: existingUser.role, existingClerkId: existingUser.clerkId, newClerkId: clerkId });
      
      // If it's the same Clerk ID, it's just a duplicate webhook - ignore
      if (existingUser.clerkId === clerkId) {
        logger.info('Duplicate webhook for same user - ignoring', { clerkId });
        return;
      }
      
      throw new Error(errorMsg);
    }

    // Extract GitHub username if connected
    let githubUsername = null;
    if (external_accounts) {
      const githubAccount = external_accounts.find(acc => acc.provider === 'oauth_github');
      if (githubAccount) {
        githubUsername = githubAccount.username;
      }
    }

    // Create new user in MongoDB
    const newUser = new User({
      clerkId,
      email: email.toLowerCase(),
      firstName: first_name || '',
      lastName: last_name || '',
      role,
      country: unsafe_metadata?.country || public_metadata?.country || '',
      companyName: role === 'BusinessOwner' ? (unsafe_metadata?.companyName || public_metadata?.companyName) : undefined,
      isEmailVerified,
      githubUsername,
      profilePicture: image_url || '',
      lastLoginAt: new Date()
    });

    await newUser.save();

    logger.info('User created in MongoDB via webhook', { email, role });
    
    // Audit log: Account created
    await auditService.logEvent({
      eventType: 'ACCOUNT_CREATED',
      user: newUser,
      details: {
        role,
        createdVia: 'clerk_webhook',
        isEmailVerified
      },
      success: true
    });

  } catch (error) {
    logger.error('Error handling user.created webhook', { error: error.message });
    throw error;
  }
};

/**
 * Handle user.updated event
 * Syncs user updates from Clerk to MongoDB
 */
const handleUserUpdated = async (clerkUser) => {
  try {
    const {
      id: clerkId,
      email_addresses,
      first_name,
      last_name,
      unsafe_metadata,
      public_metadata,
      image_url,
      external_accounts
    } = clerkUser;

    // Find user in MongoDB
    const user = await User.findOne({ clerkId });

    if (!user) {
      logger.error('User not found in MongoDB for update', { clerkId });
      return;
    }

    // Get primary email verification status
    const primaryEmail = email_addresses?.find(email => email.id === clerkUser.primary_email_address_id);
    const isEmailVerified = primaryEmail?.verification?.status === 'verified';
    
    // Track email verification change
    const emailVerificationChanged = user.isEmailVerified !== isEmailVerified;
    const oldVerificationStatus = user.isEmailVerified;

    // Extract GitHub username if connected
    let githubUsername = user.githubUsername;
    if (external_accounts) {
      const githubAccount = external_accounts.find(acc => acc.provider === 'oauth_github');
      if (githubAccount) {
        githubUsername = githubAccount.username;
      }
    }

    // Update user data
    user.firstName = first_name || user.firstName;
    user.lastName = last_name || user.lastName;
    user.isEmailVerified = isEmailVerified;
    user.profilePicture = image_url || user.profilePicture;
    user.githubUsername = githubUsername;
    user.lastLoginAt = new Date();

    // Update metadata if provided
    if (unsafe_metadata?.country || public_metadata?.country) {
      user.country = unsafe_metadata?.country || public_metadata?.country;
    }
    if (user.role === 'BusinessOwner' && (unsafe_metadata?.companyName || public_metadata?.companyName)) {
      user.companyName = unsafe_metadata?.companyName || public_metadata?.companyName;
    }

    await user.save();

    logger.info('User updated in MongoDB via webhook', { email: user.email });
    
    // Audit log: Email verification changed
    if (emailVerificationChanged) {
      await auditService.logEvent({
        eventType: 'EMAIL_VERIFICATION_CHANGED',
        user,
        details: {
          verified: isEmailVerified,
          previousStatus: oldVerificationStatus,
          changedVia: 'clerk_webhook'
        },
        success: true
      });
    }

  } catch (error) {
    logger.error('Error handling user.updated webhook', { error: error.message });
    throw error;
  }
};

/**
 * Handle user.deleted event
 * Soft delete user in MongoDB (set isActive to false)
 */
const handleUserDeleted = async (clerkUser) => {
  try {
    const { id: clerkId } = clerkUser;

    // Find and soft delete user
    const user = await User.findOne({ clerkId });

    if (!user) {
      logger.error('User not found in MongoDB for deletion', { clerkId });
      return;
    }

    user.isActive = false;
    await user.save();

    logger.info('User soft deleted in MongoDB', { email: user.email });

  } catch (error) {
    logger.error('Error handling user.deleted webhook', { error: error.message });
    throw error;
  }
};

module.exports = {
  handleWebhook
};
