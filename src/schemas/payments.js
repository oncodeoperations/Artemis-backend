const { z } = require('zod');
const { mongoId, paginationQuery, currencyAmount } = require('./common');

// ─── Pay Milestone ────────────────────────────────────────────

const payMilestoneBody = z.object({
  paymentMethodId: z.string().min(1).optional(),
});

const payMilestoneParams = z.object({
  contractId: mongoId,
  milestoneIndex: z.coerce.number().int().min(0),
});

// ─── Milestone Payment Status ─────────────────────────────────

const milestoneStatusParams = z.object({
  contractId: mongoId,
  milestoneIndex: z.coerce.number().int().min(0),
});

// ─── Withdrawal Info ──────────────────────────────────────────

const updateWithdrawalInfoBody = z.object({
  bankName: z.string().min(1, 'Bank name is required').max(200),
  accountName: z.string().min(1, 'Account name is required').max(200),
  accountNumber: z.string().min(1, 'Account number is required').max(50),
  routingNumber: z.string().max(50).optional(),
  bankCountry: z.string().max(100).optional(),
  currency: z.string().min(1).max(5).optional(),
  additionalInfo: z.string().max(1000).optional(),
});

// ─── Request Withdrawal ───────────────────────────────────────

const requestWithdrawalBody = z.object({
  amount: currencyAmount,
});

// ─── Withdrawals List (user) ──────────────────────────────────

const withdrawalsQuery = paginationQuery;

// ─── Admin Withdrawals ────────────────────────────────────────

const adminWithdrawalsQuery = paginationQuery.extend({
  status: z.enum(['pending', 'processing', 'completed', 'rejected']).optional(),
});

const adminProcessWithdrawalParams = z.object({
  withdrawalId: mongoId,
});

const adminProcessWithdrawalBody = z.object({
  status: z.enum(['completed', 'rejected', 'processing']),
  adminNote: z.string().max(2000).optional(),
  externalReference: z.string().max(500).optional(),
});

module.exports = {
  payMilestoneBody,
  payMilestoneParams,
  milestoneStatusParams,
  updateWithdrawalInfoBody,
  requestWithdrawalBody,
  withdrawalsQuery,
  adminWithdrawalsQuery,
  adminProcessWithdrawalParams,
  adminProcessWithdrawalBody,
};
