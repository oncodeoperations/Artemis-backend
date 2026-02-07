const { z } = require('zod');
const { paginationQuery } = require('./common');

// ─── Leaderboard Query Params ─────────────────────────────────

const leaderboardQuery = z.object({
  country: z.string().max(100).optional(),
  level: z.string().max(50).optional(),
  language: z.string().max(50).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const leaderboardUsernameParam = z.object({
  username: z.string().min(1, 'Username is required').max(100),
});

module.exports = {
  leaderboardQuery,
  leaderboardUsernameParam,
};
