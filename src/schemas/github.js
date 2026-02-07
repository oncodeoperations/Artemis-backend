const { z } = require('zod');

// ─── Evaluate Developer ───────────────────────────────────────

const evaluateDeveloperBody = z.object({
  githubUrl: z.string().url('Must be a valid URL').optional(),
  github_url: z.string().url('Must be a valid URL').optional(),
  submitToLeaderboard: z.boolean().optional(),
}).refine(data => data.githubUrl || data.github_url, {
  message: 'Either githubUrl or github_url must be provided',
});

module.exports = {
  evaluateDeveloperBody,
};
