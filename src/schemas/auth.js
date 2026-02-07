const { z } = require('zod');

// ─── Update Profile (auth) ────────────────────────────────────

const updateProfileBody = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  country: z.string().max(100).optional(),
  companyName: z.string().max(200).optional(),
  bio: z.string().max(2000).optional(),
  githubUsername: z.string().max(100).optional(),
  profession: z.string().max(100).optional(),
  professionalRole: z.string().max(100).optional(),
  skills: z.array(z.string().max(50)).max(30).optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided for update',
});

module.exports = {
  updateProfileBody,
};
