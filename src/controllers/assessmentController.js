const Assessment = require('../models/Assessment');
const AssessmentInvitation = require('../models/AssessmentInvitation');
const AssessmentSession = require('../models/AssessmentSession');
const User = require('../models/User');
const assessmentEngine = require('../services/assessmentEngine');
const emailService = require('../services/emailService');
const notificationService = require('../services/notificationService');
const logger = require('../utils/logger');

// ═══════════════════════════════════════════════════════════════
//  ASSESSMENT TEMPLATES  (employer CRUD)
// ═══════════════════════════════════════════════════════════════

/**
 * POST /api/assessments — create a new assessment template
 */
exports.createAssessment = async (req, res) => {
  try {
    const { title, description, profession, role, skills, difficulty, questionCount, timeLimitMinutes } = req.body;

    const assessment = await Assessment.create({
      title,
      description,
      profession,
      role,
      skills,
      difficulty,
      questionCount,
      timeLimitMinutes,
      createdBy: req.user._id,
    });

    logger.info('Assessment created', { assessmentId: assessment._id, createdBy: req.user._id });
    res.status(201).json({ assessment });
  } catch (error) {
    logger.error('Error creating assessment', { error: error.message });
    res.status(500).json({ message: 'Failed to create assessment', error: error.message });
  }
};

/**
 * GET /api/assessments — list assessments created by the current employer
 */
exports.getAssessments = async (req, res) => {
  try {
    const { page = 1, limit = 20, profession } = req.query;
    const filter = { createdBy: req.user._id };
    if (profession) filter.profession = profession;

    const assessments = await Assessment.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();

    const total = await Assessment.countDocuments(filter);

    res.json({ assessments, total, page: Number(page), limit: Number(limit) });
  } catch (error) {
    logger.error('Error fetching assessments', { error: error.message });
    res.status(500).json({ message: 'Failed to fetch assessments', error: error.message });
  }
};

/**
 * GET /api/assessments/:id — single assessment detail
 */
exports.getAssessment = async (req, res) => {
  try {
    const assessment = await Assessment.findOne({
      _id: req.params.id,
      createdBy: req.user._id,
    }).lean();

    if (!assessment) {
      return res.status(404).json({ message: 'Assessment not found' });
    }

    res.json({ assessment });
  } catch (error) {
    logger.error('Error fetching assessment', { error: error.message });
    res.status(500).json({ message: 'Failed to fetch assessment', error: error.message });
  }
};

/**
 * PUT /api/assessments/:id — update an assessment template
 */
exports.updateAssessment = async (req, res) => {
  try {
    const assessment = await Assessment.findOneAndUpdate(
      { _id: req.params.id, createdBy: req.user._id },
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!assessment) {
      return res.status(404).json({ message: 'Assessment not found' });
    }

    res.json({ assessment });
  } catch (error) {
    logger.error('Error updating assessment', { error: error.message });
    res.status(500).json({ message: 'Failed to update assessment', error: error.message });
  }
};

/**
 * DELETE /api/assessments/:id — soft-delete (set isActive=false)
 */
exports.deleteAssessment = async (req, res) => {
  try {
    const assessment = await Assessment.findOneAndUpdate(
      { _id: req.params.id, createdBy: req.user._id },
      { $set: { isActive: false } },
      { new: true }
    );

    if (!assessment) {
      return res.status(404).json({ message: 'Assessment not found' });
    }

    res.json({ message: 'Assessment archived successfully' });
  } catch (error) {
    logger.error('Error deleting assessment', { error: error.message });
    res.status(500).json({ message: 'Failed to delete assessment', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════
//  INVITATIONS
// ═══════════════════════════════════════════════════════════════

/**
 * POST /api/assessments/invitations — send an assessment invitation
 */
exports.sendInvitation = async (req, res) => {
  try {
    const { assessmentId, freelancerEmail, message, expiresInDays } = req.body;

    // Verify assessment belongs to this employer
    const assessment = await Assessment.findOne({
      _id: assessmentId,
      createdBy: req.user._id,
      isActive: true,
    });

    if (!assessment) {
      return res.status(404).json({ message: 'Assessment not found or inactive' });
    }

    // Check for duplicate pending invitation
    const existing = await AssessmentInvitation.findOne({
      assessment: assessmentId,
      freelancerEmail: freelancerEmail.toLowerCase(),
      status: 'pending',
    });

    if (existing) {
      return res.status(409).json({ message: 'A pending invitation already exists for this email' });
    }

    // Look up freelancer user (may not exist yet)
    const freelancerUser = await User.findOne({
      email: freelancerEmail.toLowerCase(),
    });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (expiresInDays || 7));

    const invitation = await AssessmentInvitation.create({
      assessment: assessmentId,
      employer: req.user._id,
      freelancer: freelancerUser?._id || null,
      freelancerEmail: freelancerEmail.toLowerCase(),
      message,
      expiresAt,
    });

    // Send invitation email
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const inviteLink = `${frontendUrl}/assessment/invite/${invitation.inviteToken}`;

    try {
      await emailService.send({
        to: freelancerEmail,
        subject: `You've been invited to take a skill assessment — ${assessment.title}`,
        html: `
          <h2>Skill Assessment Invitation</h2>
          <p><strong>${req.user.firstName || 'An employer'} ${req.user.lastName || ''}</strong> has invited you to complete a skill assessment.</p>
          <p><strong>Assessment:</strong> ${assessment.title}</p>
          <p><strong>Profession:</strong> ${assessment.profession}</p>
          <p><strong>Difficulty:</strong> ${assessment.difficulty}</p>
          <p><strong>Questions:</strong> ${assessment.questionCount} questions</p>
          <p><strong>Time Limit:</strong> ${assessment.timeLimitMinutes} minutes</p>
          ${message ? `<p><strong>Message:</strong> ${message}</p>` : ''}
          <p><a href="${inviteLink}" style="display:inline-block;padding:12px 24px;background:#000;color:#fff;text-decoration:none;border-radius:8px;">Take Assessment</a></p>
          <p style="color:#888;font-size:12px;">This invitation expires on ${expiresAt.toLocaleDateString()}.</p>
        `,
        text: `You've been invited to take a skill assessment: ${assessment.title}. Open this link to start: ${inviteLink}`,
      });
    } catch (emailError) {
      logger.warn('Failed to send invitation email — saving invitation anyway', { error: emailError.message });
    }

    logger.info('Assessment invitation sent', { invitationId: invitation._id, to: freelancerEmail });

    // Send in-app notification (non-blocking)
    notificationService.notifyAssessmentInvitation(assessment, invitation, req.user).catch((err) =>
      logger.warn('Failed to send assessment invitation notification', { error: err.message })
    );

    res.status(201).json({ invitation });
  } catch (error) {
    logger.error('Error sending invitation', { error: error.message });
    res.status(500).json({ message: 'Failed to send invitation', error: error.message });
  }
};

/**
 * GET /api/assessments/invitations — list invitations
 *   - Employers see invitations they sent
 *   - Freelancers see invitations addressed to them
 */
exports.getInvitations = async (req, res) => {
  try {
    const { status } = req.query;
    let filter = {};

    if (req.user.role === 'BusinessOwner') {
      filter.employer = req.user._id;
    } else {
      // Freelancer — match by userId OR email
      filter.$or = [
        { freelancer: req.user._id },
        { freelancerEmail: req.user.email },
      ];
    }

    if (status) filter.status = status;

    const invitations = await AssessmentInvitation.find(filter)
      .populate('assessment', 'title profession difficulty questionCount timeLimitMinutes')
      .populate('employer', 'firstName lastName email companyName')
      .populate('freelancer', 'firstName lastName email profession')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ invitations });
  } catch (error) {
    logger.error('Error fetching invitations', { error: error.message });
    res.status(500).json({ message: 'Failed to fetch invitations', error: error.message });
  }
};

/**
 * GET /api/assessments/invitations/token/:token — resolve an invite link
 * Public (no auth required) — returns assessment info + invitation status
 */
exports.getInvitationByToken = async (req, res) => {
  try {
    const invitation = await AssessmentInvitation.findOne({
      inviteToken: req.params.token,
    })
      .populate('assessment', 'title description profession role skills difficulty questionCount timeLimitMinutes')
      .populate('employer', 'firstName lastName companyName')
      .lean();

    if (!invitation) {
      return res.status(404).json({ message: 'Invitation not found' });
    }

    if (invitation.expiresAt < new Date()) {
      return res.status(410).json({ message: 'This invitation has expired' });
    }

    res.json({ invitation });
  } catch (error) {
    logger.error('Error resolving invite token', { error: error.message });
    res.status(500).json({ message: 'Failed to resolve invitation', error: error.message });
  }
};

/**
 * PATCH /api/assessments/invitations/:id/decline — freelancer declines
 */
exports.declineInvitation = async (req, res) => {
  try {
    const invitation = await AssessmentInvitation.findOne({
      _id: req.params.id,
      $or: [
        { freelancer: req.user._id },
        { freelancerEmail: req.user.email },
      ],
      status: 'pending',
    });

    if (!invitation) {
      return res.status(404).json({ message: 'Invitation not found or already responded' });
    }

    invitation.status = 'declined';
    await invitation.save();

    // Notify employer (non-blocking)
    const assessment = await Assessment.findById(invitation.assessment).lean();
    notificationService.notifyAssessmentDeclined(invitation, assessment, req.user).catch((err) =>
      logger.warn('Failed to send assessment declined notification', { error: err.message })
    );

    res.json({ message: 'Invitation declined', invitation });
  } catch (error) {
    logger.error('Error declining invitation', { error: error.message });
    res.status(500).json({ message: 'Failed to decline invitation', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════
//  SESSIONS  (the live assessment)
// ═══════════════════════════════════════════════════════════════

/**
 * POST /api/assessments/sessions/start — begin an assessment session
 */
exports.startSession = async (req, res) => {
  try {
    const { invitationId } = req.body;

    // Find the invitation
    const invitation = await AssessmentInvitation.findOne({
      _id: invitationId,
      $or: [
        { freelancer: req.user._id },
        { freelancerEmail: req.user.email },
      ],
    }).populate('assessment');

    if (!invitation) {
      return res.status(404).json({ message: 'Invitation not found' });
    }

    if (invitation.status === 'completed') {
      return res.status(409).json({ message: 'This assessment has already been completed' });
    }

    if (invitation.expiresAt < new Date()) {
      invitation.status = 'expired';
      await invitation.save();
      return res.status(410).json({ message: 'This invitation has expired' });
    }

    // Check if there's already an in-progress session
    const existing = await AssessmentSession.findOne({
      invitation: invitationId,
      freelancer: req.user._id,
      status: 'in_progress',
    });

    if (existing) {
      // Resume existing session
      return res.json({ session: existing, resumed: true });
    }

    const assessment = invitation.assessment;

    // Generate the first question via AI
    const firstQ = await assessmentEngine.generateFirstQuestion({
      profession: assessment.profession,
      role: assessment.role,
      skills: assessment.skills,
      difficulty: assessment.difficulty,
      totalQuestions: assessment.questionCount,
    });

    // Create the session
    const session = await AssessmentSession.create({
      invitation: invitationId,
      assessment: assessment._id,
      freelancer: req.user._id,
      totalQuestions: assessment.questionCount,
      currentQuestionIndex: 1,
      messages: [
        {
          role: 'ai',
          content: firstQ.question,
          questionIndex: 1,
        },
      ],
    });

    // Update invitation status
    invitation.status = 'accepted';
    // Link freelancer if not already linked
    if (!invitation.freelancer) {
      invitation.freelancer = req.user._id;
    }
    await invitation.save();

    logger.info('Assessment session started', { sessionId: session._id, freelancer: req.user._id });

    // Notify employer (non-blocking)
    notificationService.notifyAssessmentStarted(session, assessment, req.user).catch((err) =>
      logger.warn('Failed to send assessment started notification', { error: err.message })
    );

    res.status(201).json({ session, resumed: false });
  } catch (error) {
    logger.error('Error starting session', { error: error.message });
    res.status(500).json({ message: 'Failed to start assessment session', error: error.message });
  }
};

/**
 * POST /api/assessments/sessions/:id/message — send an answer, get next question
 */
exports.sendMessage = async (req, res) => {
  try {
    const { content } = req.body;

    const session = await AssessmentSession.findOne({
      _id: req.params.id,
      freelancer: req.user._id,
      status: 'in_progress',
    }).populate('assessment');

    if (!session) {
      return res.status(404).json({ message: 'Active session not found' });
    }

    // Check time limit
    const assessment = session.assessment;
    const elapsed = (Date.now() - session.startedAt.getTime()) / 1000;
    if (elapsed > assessment.timeLimitMinutes * 60) {
      session.status = 'timed_out';
      session.completedAt = new Date();
      session.timeSpentSeconds = Math.round(elapsed);
      await session.save();
      return res.status(410).json({ message: 'Time limit exceeded', session });
    }

    // Save user's answer
    session.messages.push({
      role: 'user',
      content,
    });

    const isLastQuestion = session.currentQuestionIndex >= session.totalQuestions;

    // Build conversation history for AI
    const conversationHistory = session.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // Evaluate answer + get next question
    const aiResponse = await assessmentEngine.evaluateAndNextQuestion({
      profession: assessment.profession,
      role: assessment.role,
      skills: assessment.skills,
      difficulty: assessment.difficulty,
      totalQuestions: session.totalQuestions,
      currentIndex: session.currentQuestionIndex,
      conversationHistory,
    });

    // Save AI evaluation as a message
    const evalMsg = aiResponse.evaluation || '';
    session.messages.push({
      role: 'ai',
      content: evalMsg,
      questionIndex: null, // evaluation, not a question
    });

    if (!isLastQuestion && aiResponse.nextQuestion) {
      // Save next question
      session.currentQuestionIndex += 1;
      session.messages.push({
        role: 'ai',
        content: aiResponse.nextQuestion,
        questionIndex: session.currentQuestionIndex,
      });
    }

    // Update time spent
    session.timeSpentSeconds = Math.round((Date.now() - session.startedAt.getTime()) / 1000);

    // If that was the last question, finalize the assessment
    if (isLastQuestion) {
      // Collect per-question scores from all evaluate calls
      // The score from this call is the last one
      const questionScores = _extractQuestionScores(session.messages, aiResponse.score);

      const report = await assessmentEngine.generateFinalReport({
        profession: assessment.profession,
        role: assessment.role,
        skills: assessment.skills,
        difficulty: assessment.difficulty,
        totalQuestions: session.totalQuestions,
        conversationHistory: session.messages.map((m) => ({ role: m.role, content: m.content })),
        questionScores,
      });

      session.status = 'completed';
      session.completedAt = new Date();
      session.score = _clamp(report.score, 0, 100);
      session.breakdown = report.breakdown || {};
      session.aiSummary = report.summary || '';
      session.strengths = report.strengths || [];
      session.weaknesses = report.weaknesses || [];

      // Update invitation
      await AssessmentInvitation.findByIdAndUpdate(session.invitation, { status: 'completed' });

      logger.info('Assessment completed', { sessionId: session._id, score: session.score });

      // Notify employer of completion (non-blocking)
      notificationService.notifyAssessmentCompleted(session, assessment, req.user).catch((err) =>
        logger.warn('Failed to send assessment completed notification', { error: err.message })
      );
    }

    await session.save();

    res.json({
      session,
      evaluation: aiResponse.evaluation,
      score: aiResponse.score,
      nextQuestion: aiResponse.nextQuestion || null,
      isComplete: isLastQuestion,
    });
  } catch (error) {
    logger.error('Error processing message', { error: error.message });
    res.status(500).json({ message: 'Failed to process message', error: error.message });
  }
};

/**
 * GET /api/assessments/sessions/:id — get session details (freelancer or employer who owns the assessment)
 */
exports.getSession = async (req, res) => {
  try {
    const session = await AssessmentSession.findById(req.params.id)
      .populate('assessment', 'title profession role skills difficulty questionCount timeLimitMinutes createdBy')
      .populate('freelancer', 'firstName lastName email profession professionalRole')
      .lean();

    if (!session) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Access control: freelancer who took it OR employer who created the assessment
    const isFreelancer = session.freelancer?._id?.toString() === req.user._id.toString();
    const isEmployer = session.assessment?.createdBy?.toString() === req.user._id.toString();

    if (!isFreelancer && !isEmployer) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json({ session });
  } catch (error) {
    logger.error('Error fetching session', { error: error.message });
    res.status(500).json({ message: 'Failed to fetch session', error: error.message });
  }
};

/**
 * GET /api/assessments/sessions — list sessions
 *   - Freelancer: their own sessions
 *   - Employer: sessions for assessments they created
 */
exports.getSessions = async (req, res) => {
  try {
    const { status, assessmentId } = req.query;
    let filter = {};

    if (req.user.role === 'BusinessOwner') {
      // Get all assessments by this employer, then find sessions
      const assessmentIds = await Assessment.find({ createdBy: req.user._id }).distinct('_id');
      filter.assessment = { $in: assessmentIds };
    } else {
      filter.freelancer = req.user._id;
    }

    if (status) filter.status = status;
    if (assessmentId) filter.assessment = assessmentId;

    const sessions = await AssessmentSession.find(filter)
      .populate('assessment', 'title profession difficulty questionCount timeLimitMinutes')
      .populate('freelancer', 'firstName lastName email profession')
      .select('-messages') // Omit messages in list view for performance
      .sort({ createdAt: -1 })
      .lean();

    res.json({ sessions });
  } catch (error) {
    logger.error('Error fetching sessions', { error: error.message });
    res.status(500).json({ message: 'Failed to fetch sessions', error: error.message });
  }
};

// ─── Helpers ──────────────────────────────────────────────────

/**
 * Extract per-question scores from conversation messages.
 * The AI returns a score with each evaluation. We store them in order.
 * For now, the last score is passed explicitly; earlier scores are
 * estimated from the conversation pattern.
 */
function _extractQuestionScores(messages, lastScore) {
  // A very simple heuristic: count AI messages that are evaluations (no questionIndex)
  // and estimate an average. In a production system, scores would be
  // stored per-message during the evaluate calls.
  //
  // For now we return an array with the last score repeated.
  // The final report AI sees the full conversation and computes a holistic score.
  const evalCount = messages.filter(
    (m) => m.role === 'ai' && m.questionIndex == null
  ).length;

  const scores = Array(Math.max(evalCount, 1)).fill(lastScore != null ? lastScore : 5);
  return scores;
}

function _clamp(value, min, max) {
  return Math.min(Math.max(Number(value) || 0, min), max);
}
