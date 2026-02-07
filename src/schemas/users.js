const { z } = require('zod');
const { mongoId, paginationQuery } = require('./common');

// ─── Update User ──────────────────────────────────────────────

const updateUserBody = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  country: z.string().max(100).optional(),
  companyName: z.string().max(200).optional(),
  bio: z.string().max(2000).optional(),
  githubUsername: z.string().max(100).optional(),
  profilePicture: z.string().url().optional(),
  profession: z.string().max(100).optional(),
  professionalRole: z.string().max(100).optional(),
  skills: z.array(z.string().max(50)).max(30).optional(),
  savedDevelopers: z.array(z.string()).optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided for update',
});

const userIdParam = z.object({
  id: mongoId,
});

// ─── Saved Developers ─────────────────────────────────────────

const addSavedDeveloperBody = z.object({
  username: z.string().min(1, 'Username is required').max(100),
});

const removeSavedDeveloperParam = z.object({
  username: z.string().min(1).max(100),
});

// ─── User List Query ──────────────────────────────────────────

const usersQuery = paginationQuery.extend({
  role: z.string().max(50).optional(),
  search: z.string().max(200).optional(),
});

// ─── Browse Talent Query ──────────────────────────────────────

const browseTalentQuery = paginationQuery.extend({
  profession: z.string().max(100).optional(),
  skills: z.string().max(500).optional(), // comma-separated
  search: z.string().max(200).optional(),
  minScore: z.coerce.number().min(0).max(100).optional(),
  sort: z.enum(['score', 'recent', 'name']).optional(),
});

module.exports = {
  updateUserBody,
  userIdParam,
  addSavedDeveloperBody,
  removeSavedDeveloperParam,
  usersQuery,
  browseTalentQuery,
};
