const { z } = require('zod');
const { mongoId } = require('./common');

// ─── Create Contract ──────────────────────────────────────────

const milestoneSchema = z.object({
  name: z.string().min(1, 'Milestone name is required').max(200),
  description: z.string().max(2000).optional(),
  budget: z.number().nonnegative('Milestone budget must be non-negative'),
  dueDate: z.string().optional(),
});

const createContractBody = z.object({
  contractName: z.string().min(1, 'Contract name is required').max(200),
  contributorEmail: z.string().email('Valid contributor email is required'),
  category: z.string().min(1).max(100).optional(),
  subcategory: z.string().max(100).optional(),
  description: z.string().max(5000).optional(),
  contractType: z.enum(['fixed', 'hourly']).default('fixed'),
  budget: z.number().nonnegative().optional(),
  splitMilestones: z.boolean().optional(),
  milestones: z.array(milestoneSchema).optional(),
  hourlyRate: z.number().nonnegative().optional(),
  hoursPerWeek: z.number().nonnegative().optional(),
  weeklyLimit: z.number().nonnegative().optional(),
  currency: z.string().min(1).max(5).default('USD'),
  dueDate: z.string().optional(),
  platformFee: z.number().min(0).max(100).optional(),
  recipientMessage: z.string().max(2000).optional(),
});

// ─── Update Contract ──────────────────────────────────────────

const updateContractBody = z.object({
  contractName: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  category: z.string().max(100).optional(),
  subcategory: z.string().max(100).optional(),
  budget: z.number().nonnegative().optional(),
  hourlyRate: z.number().nonnegative().optional(),
  hoursPerWeek: z.number().nonnegative().optional(),
  weeklyLimit: z.number().nonnegative().optional(),
  dueDate: z.string().optional(),
  milestones: z.array(milestoneSchema).optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided for update',
});

// ─── Update Contract Status ───────────────────────────────────

const updateContractStatusBody = z.object({
  status: z.enum(['draft', 'pending', 'active', 'completed', 'rejected', 'disputed', 'archived']),
  rejectionReason: z.string().max(2000).optional(),
});

// ─── Update Milestone Status ──────────────────────────────────

const updateMilestoneStatusBody = z.object({
  status: z.enum(['submitted', 'in-progress', 'approved', 'rejected']),
  submissionDetails: z.string().max(5000).optional(),
  feedback: z.string().max(5000).optional(),
  message: z.string().max(2000).optional(),
});

// ─── Route Params ─────────────────────────────────────────────

const contractIdParam = z.object({
  id: mongoId,
});

const milestoneParam = z.object({
  id: mongoId,
  milestoneIndex: z.coerce.number().int().min(0),
});

module.exports = {
  createContractBody,
  updateContractBody,
  updateContractStatusBody,
  updateMilestoneStatusBody,
  contractIdParam,
  milestoneParam,
};
