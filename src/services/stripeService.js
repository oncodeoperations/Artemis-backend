const Stripe = require('stripe');
const logger = require('../utils/logger');

/**
 * Stripe Service
 * Platform-direct payments — all charges go to the platform's own Stripe account.
 * No Stripe Connect. Freelancer payouts are manual (balance-based).
 */
class StripeService {
  constructor() {
    if (!process.env.STRIPE_SECRET_KEY) {
      logger.warn('STRIPE_SECRET_KEY not set – Stripe service will not function');
      this.stripe = null;
    } else {
      this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: '2024-12-18.acacia',
      });
    }
  }

  /** Throw early if Stripe is not configured */
  _ensureStripe() {
    if (!this.stripe) {
      throw new Error('Stripe is not configured. Set STRIPE_SECRET_KEY in your environment.');
    }
  }

  // ─── Customer ────────────────────────────────────────────────

  /**
   * Create a Stripe customer for a payer (employer)
   */
  async createCustomer(user) {
    this._ensureStripe();
    const customer = await this.stripe.customers.create({
      email: user.email,
      name: `${user.firstName} ${user.lastName}`,
      metadata: {
        userId: user._id.toString(),
        role: user.role,
      },
    });
    return customer;
  }

  // ─── Payments ────────────────────────────────────────────────

  /**
   * Create a Payment Intent for a milestone.
   * The full amount goes to the platform. No destination / transfer.
   */
  async createMilestonePayment({
    amount, // in smallest currency unit (cents)
    currency,
    customerStripeId,
    contractId,
    milestoneIndex,
    milestoneName,
    platformFeePercent,
  }) {
    this._ensureStripe();
    const paymentIntent = await this.stripe.paymentIntents.create({
      amount,
      currency: currency.toLowerCase(),
      customer: customerStripeId,
      metadata: {
        contractId,
        milestoneIndex: String(milestoneIndex),
        milestoneName,
        platformFeePercent: String(platformFeePercent || 3.6),
      },
      description: `Milestone payment: "${milestoneName}"`,
      automatic_payment_methods: {
        enabled: true,
      },
    });
    return paymentIntent;
  }

  /**
   * Retrieve a Payment Intent
   */
  async getPaymentIntent(paymentIntentId) {
    this._ensureStripe();
    return this.stripe.paymentIntents.retrieve(paymentIntentId);
  }

  // ─── Saved Payment Methods ───────────────────────────────────

  /**
   * Create a Setup Intent so a payer can save a card for future payments
   */
  async createSetupIntent(stripeCustomerId) {
    this._ensureStripe();
    const setupIntent = await this.stripe.setupIntents.create({
      customer: stripeCustomerId,
      automatic_payment_methods: { enabled: true },
    });
    return setupIntent;
  }

  /**
   * List saved payment methods for a customer
   */
  async listPaymentMethods(stripeCustomerId) {
    this._ensureStripe();
    const methods = await this.stripe.paymentMethods.list({
      customer: stripeCustomerId,
      type: 'card',
    });

    return methods.data.map((m) => ({
      id: m.id,
      brand: m.card.brand,
      last4: m.card.last4,
      expMonth: m.card.exp_month,
      expYear: m.card.exp_year,
    }));
  }

  // ─── Webhook Verification ────────────────────────────────────

  /**
   * Verify and construct a Stripe webhook event from raw body
   */
  constructWebhookEvent(rawBody, signature) {
    this._ensureStripe();
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!endpointSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET not configured');
    }
    return this.stripe.webhooks.constructEvent(rawBody, signature, endpointSecret);
  }
}

// Singleton
const stripeService = new StripeService();
module.exports = stripeService;
