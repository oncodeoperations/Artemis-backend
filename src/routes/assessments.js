const express = require('express');
const router = express.Router();
const assessmentController = require('../controllers/assessmentController');
const { requireAuth, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const {
  createAssessmentBody,
  updateAssessmentBody,
  assessmentIdParam,
  sendInvitationBody,
  invitationIdParam,
  inviteTokenParam,
  startSessionBody,
  sessionIdParam,
  sendMessageBody,
} = require('../schemas/assessments');

/**
 * @swagger
 * tags:
 *   name: Assessments
 *   description: AI-powered skill assessment management
 */

// ═══════════════════════════════════════════════════════════════
//  ASSESSMENT TEMPLATES
// ═══════════════════════════════════════════════════════════════

/**
 * @swagger
 * /api/assessments:
 *   post:
 *     summary: Create a new assessment template
 *     tags: [Assessments]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, profession]
 *             properties:
 *               title: { type: string, maxLength: 200 }
 *               description: { type: string, maxLength: 2000 }
 *               profession: { type: string, maxLength: 100 }
 *               role: { type: string, maxLength: 100 }
 *               skills: { type: array, items: { type: string } }
 *               difficulty: { type: string, enum: [beginner, intermediate, advanced] }
 *               questionCount: { type: integer, minimum: 3, maximum: 20 }
 *               timeLimitMinutes: { type: integer, minimum: 5, maximum: 120 }
 *     responses:
 *       201: { description: Assessment created }
 *       401: { description: Unauthorized }
 */
router.post(
  '/',
  requireAuth,
  requireRole('BusinessOwner'),
  validate({ body: createAssessmentBody }),
  assessmentController.createAssessment
);

/**
 * @swagger
 * /api/assessments:
 *   get:
 *     summary: List assessments created by the current employer
 *     tags: [Assessments]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *       - in: query
 *         name: profession
 *         schema: { type: string }
 *     responses:
 *       200: { description: Paginated list of assessments }
 */
router.get(
  '/',
  requireAuth,
  requireRole('BusinessOwner'),
  assessmentController.getAssessments
);

// ═══════════════════════════════════════════════════════════════
//  INVITATIONS  (must be before /:id to avoid param collision)
// ═══════════════════════════════════════════════════════════════

/**
 * @swagger
 * /api/assessments/invitations:
 *   post:
 *     summary: Send an assessment invitation to a freelancer
 *     tags: [Assessments]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [assessmentId, freelancerEmail]
 *             properties:
 *               assessmentId: { type: string }
 *               freelancerEmail: { type: string, format: email }
 *               message: { type: string, maxLength: 1000 }
 *               expiresInDays: { type: integer, minimum: 1, maximum: 30, default: 7 }
 *     responses:
 *       201: { description: Invitation created and email sent }
 *       404: { description: Assessment not found }
 *       409: { description: Duplicate pending invitation }
 */
router.post(
  '/invitations',
  requireAuth,
  requireRole('BusinessOwner'),
  validate({ body: sendInvitationBody }),
  assessmentController.sendInvitation
);

/**
 * @swagger
 * /api/assessments/invitations:
 *   get:
 *     summary: List assessment invitations (employer sees sent, freelancer sees received)
 *     tags: [Assessments]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [pending, accepted, completed, expired, declined] }
 *     responses:
 *       200: { description: List of invitations }
 */
router.get(
  '/invitations',
  requireAuth,
  assessmentController.getInvitations
);

/**
 * @swagger
 * /api/assessments/invitations/token/{token}:
 *   get:
 *     summary: Resolve an invite link by token (public — no auth)
 *     tags: [Assessments]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Invitation details }
 *       404: { description: Not found }
 *       410: { description: Expired }
 */
router.get(
  '/invitations/token/:token',
  validate({ params: inviteTokenParam }),
  assessmentController.getInvitationByToken
);

/**
 * @swagger
 * /api/assessments/invitations/{id}/decline:
 *   patch:
 *     summary: Decline an assessment invitation
 *     tags: [Assessments]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Invitation declined }
 *       404: { description: Not found }
 */
router.patch(
  '/invitations/:id/decline',
  requireAuth,
  validate({ params: invitationIdParam }),
  assessmentController.declineInvitation
);

// ═══════════════════════════════════════════════════════════════
//  SESSIONS  (must be before /:id to avoid param collision)
// ═══════════════════════════════════════════════════════════════

/**
 * @swagger
 * /api/assessments/sessions:
 *   get:
 *     summary: List assessment sessions (freelancer or employer)
 *     tags: [Assessments]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [in_progress, completed, timed_out, abandoned] }
 *       - in: query
 *         name: assessmentId
 *         schema: { type: string }
 *     responses:
 *       200: { description: List of sessions }
 */
router.get(
  '/sessions',
  requireAuth,
  assessmentController.getSessions
);

/**
 * @swagger
 * /api/assessments/sessions/start:
 *   post:
 *     summary: Start a new assessment session (freelancer)
 *     tags: [Assessments]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [invitationId]
 *             properties:
 *               invitationId: { type: string }
 *     responses:
 *       201: { description: Session started with first question }
 *       404: { description: Invitation not found }
 *       409: { description: Already completed }
 *       410: { description: Expired }
 */
router.post(
  '/sessions/start',
  requireAuth,
  validate({ body: startSessionBody }),
  assessmentController.startSession
);

/**
 * @swagger
 * /api/assessments/sessions/{id}:
 *   get:
 *     summary: Get session details (freelancer or assessment owner)
 *     tags: [Assessments]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Session with messages and scores }
 *       403: { description: Access denied }
 *       404: { description: Not found }
 */
router.get(
  '/sessions/:id',
  requireAuth,
  validate({ params: sessionIdParam }),
  assessmentController.getSession
);

/**
 * @swagger
 * /api/assessments/sessions/{id}/message:
 *   post:
 *     summary: Send an answer in an active session (freelancer)
 *     tags: [Assessments]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [content]
 *             properties:
 *               content: { type: string, maxLength: 10000 }
 *     responses:
 *       200: { description: Evaluation + next question (or final result) }
 *       404: { description: No active session }
 *       410: { description: Time limit exceeded }
 */
router.post(
  '/sessions/:id/message',
  requireAuth,
  validate({ params: sessionIdParam, body: sendMessageBody }),
  assessmentController.sendMessage
);

// ═══════════════════════════════════════════════════════════════
//  ASSESSMENT TEMPLATES — param routes (after /invitations & /sessions)
// ═══════════════════════════════════════════════════════════════

/**
 * @swagger
 * /api/assessments/{id}:
 *   get:
 *     summary: Get a single assessment by ID
 *     tags: [Assessments]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Assessment details }
 *       404: { description: Not found }
 */
router.get(
  '/:id',
  requireAuth,
  requireRole('BusinessOwner'),
  validate({ params: assessmentIdParam }),
  assessmentController.getAssessment
);

/**
 * @swagger
 * /api/assessments/{id}:
 *   put:
 *     summary: Update an assessment template
 *     tags: [Assessments]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string }
 *               description: { type: string }
 *               profession: { type: string }
 *               role: { type: string }
 *               skills: { type: array, items: { type: string } }
 *               difficulty: { type: string, enum: [beginner, intermediate, advanced] }
 *               questionCount: { type: integer }
 *               timeLimitMinutes: { type: integer }
 *               isActive: { type: boolean }
 *     responses:
 *       200: { description: Updated assessment }
 *       404: { description: Not found }
 */
router.put(
  '/:id',
  requireAuth,
  requireRole('BusinessOwner'),
  validate({ params: assessmentIdParam, body: updateAssessmentBody }),
  assessmentController.updateAssessment
);

/**
 * @swagger
 * /api/assessments/{id}:
 *   delete:
 *     summary: Archive (soft-delete) an assessment
 *     tags: [Assessments]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Assessment archived }
 *       404: { description: Not found }
 */
router.delete(
  '/:id',
  requireAuth,
  requireRole('BusinessOwner'),
  validate({ params: assessmentIdParam }),
  assessmentController.deleteAssessment
);

module.exports = router;
