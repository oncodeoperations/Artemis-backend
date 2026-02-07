const { z } = require('zod');

// ─── Reusable Primitives ─────────────────────────────────────────

/** MongoDB ObjectId (24-hex-char string) */
const mongoId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ObjectId');

/** Pagination query params */
const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/** Non-negative currency amount */
const currencyAmount = z.number().positive('Amount must be greater than zero');

/** ISO currency code */
const currencyCode = z.string().min(1).max(5).default('USD');

module.exports = {
  mongoId,
  paginationQuery,
  currencyAmount,
  currencyCode,
};
