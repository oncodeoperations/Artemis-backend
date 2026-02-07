const { z } = require('zod');
const { mongoId } = require('./common');

// ─── Assessment CRUD ──────────────────────────────────────────

const createAssessmentBody = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(2000).optional().default(''),
  profession: z.string().min(1, 'Profession is required').max(100),
  role: z.string().max(100).optional().default(''),
  skills: z
    .array(z.string().max(50))
    .max(30, 'Maximum 30 skills')
    .optional()
    .default([]),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).default('intermediate'),
  questionCount: z.number().int().min(3).max(20).default(10),
  timeLimitMinutes: z.number().int().min(5).max(120).default(30),
});

const updateAssessmentBody = z
  .object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).optional(),
    profession: z.string().min(1).max(100).optional(),
    role: z.string().max(100).optional(),
    skills: z.array(z.string().max(50)).max(30).optional(),
    difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
    questionCount: z.number().int().min(3).max(20).optional(),
    timeLimitMinutes: z.number().int().min(5).max(120).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: 'At least one field must be provided for update',
  });

const assessmentIdParam = z.object({ id: mongoId });

// ─── Invitations ──────────────────────────────────────────────

const sendInvitationBody = z.object({
  assessmentId: mongoId,
  freelancerEmail: z.string().email('Valid email is required'),
  message: z.string().max(1000).optional().default(''),
  expiresInDays: z.number().int().min(1).max(30).default(7),
});

const invitationIdParam = z.object({ id: mongoId });
const inviteTokenParam = z.object({ token: z.string().min(1) });

// ─── Sessions ─────────────────────────────────────────────────

const startSessionBody = z.object({
  invitationId: mongoId,
});

const sessionIdParam = z.object({ id: mongoId });

const sendMessageBody = z.object({
  content: z
    .string()
    .min(1, 'Message cannot be empty')
    .max(10000, 'Message cannot exceed 10 000 characters'),
});

module.exports = {
  createAssessmentBody,
  updateAssessmentBody,
  assessmentIdParam,
  sendInvitationBody,
  invitationIdParam,
  inviteTokenParam,
  startSessionBody,
  sessionIdParam,
  sendMessageBody,
};
