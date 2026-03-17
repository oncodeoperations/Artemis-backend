const crypto = require('crypto');
const Assessment = require('../models/Assessment');
const AssessmentInvitation = require('../models/AssessmentInvitation');
const AssessmentSession = require('../models/AssessmentSession');
const Question = require('../models/Question');
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
 * Supports both 'ai_chat' (legacy) and 'coding' (HackerRank-style) types.
 */
exports.createAssessment = async (req, res) => {
  try {
    const {
      title, description, profession, role, skills, difficulty,
      questionCount, timeLimitMinutes,
      assessmentType, questions, allowedLanguages, isPublic,
    } = req.body;

    // Generate a unique invite code for shareable links
    const inviteCode = crypto.randomBytes(6).toString('hex');

    const assessmentData = {
      title,
      description,
      profession,
      role,
      skills,
      difficulty,
      questionCount,
      timeLimitMinutes,
      assessmentType: assessmentType || 'ai_chat',
      allowedLanguages: allowedLanguages || ['javascript', 'python', 'java', 'cpp'],
      isPublic: isPublic || false,
      inviteCode,
      createdBy: req.user._id,
    };

    // For coding assessments, attach question IDs and auto-set questionCount
    if (assessmentType === 'coding' && Array.isArray(questions) && questions.length > 0) {
      // Validate that all question IDs exist
      const validQuestions = await Question.find({
        _id: { $in: questions },
        isActive: true,
      }).select('_id');

      if (validQuestions.length !== questions.length) {
        return res.status(400).json({ message: 'One or more question IDs are invalid or inactive' });
      }

      assessmentData.questions = questions;
      assessmentData.questionCount = questions.length;
    }

    const assessment = await Assessment.create(assessmentData);

    // Populate questions for the response
    if (assessment.assessmentType === 'coding' && assessment.questions.length > 0) {
      await assessment.populate('questions', 'title difficulty points type category tags timeLimitSeconds');
    }

    logger.info('Assessment created', {
      assessmentId: assessment._id,
      type: assessment.assessmentType,
      createdBy: req.user._id,
    });
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
 * GET /api/assessments/:id — single assessment detail (with populated questions for coding type)
 */
exports.getAssessment = async (req, res) => {
  try {
    let query = Assessment.findOne({
      _id: req.params.id,
      createdBy: req.user._id,
    });

    // Populate questions for coding assessments
    query = query.populate('questions', 'title description difficulty points type category tags timeLimitSeconds allowedLanguages testCases starterCode constraints examples');

    const assessment = await query.lean();

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
 * GET /api/assessments/code/:inviteCode — get assessment by shareable invite code
 * Public access (no auth). Returns assessment info for the landing page.
 */
exports.getAssessmentByInviteCode = async (req, res) => {
  try {
    const assessment = await Assessment.findOne({
      inviteCode: req.params.inviteCode,
      isActive: true,
    })
      .select('title description profession role difficulty questionCount timeLimitMinutes assessmentType allowedLanguages skills createdBy')
      .populate('createdBy', 'firstName lastName companyName')
      .lean();

    if (!assessment) {
      return res.status(404).json({ message: 'Assessment not found' });
    }

    res.json({ assessment });
  } catch (error) {
    logger.error('Error fetching assessment by invite code', { error: error.message });
    res.status(500).json({ message: 'Failed to fetch assessment', error: error.message });
  }
};

/**
 * POST /api/assessments/:id/questions — add questions to a coding assessment
 */
exports.addQuestions = async (req, res) => {
  try {
    const { questionIds } = req.body;
    if (!Array.isArray(questionIds) || questionIds.length === 0) {
      return res.status(400).json({ message: 'questionIds array is required' });
    }

    const assessment = await Assessment.findOne({
      _id: req.params.id,
      createdBy: req.user._id,
      assessmentType: 'coding',
    });

    if (!assessment) {
      return res.status(404).json({ message: 'Coding assessment not found' });
    }

    // Validate question IDs
    const validQuestions = await Question.find({
      _id: { $in: questionIds },
      isActive: true,
    }).select('_id');

    const validIds = validQuestions.map((q) => q._id.toString());
    const newIds = questionIds.filter(
      (id) => validIds.includes(id) && !assessment.questions.map(String).includes(id)
    );

    assessment.questions.push(...newIds);
    assessment.questionCount = assessment.questions.length;
    await assessment.save();

    await assessment.populate('questions', 'title difficulty points type category tags timeLimitSeconds');

    res.json({ assessment });
  } catch (error) {
    logger.error('Error adding questions', { error: error.message });
    res.status(500).json({ message: 'Failed to add questions', error: error.message });
  }
};

/**
 * DELETE /api/assessments/:id/questions/:questionId — remove a question from assessment
 */
exports.removeQuestion = async (req, res) => {
  try {
    const assessment = await Assessment.findOne({
      _id: req.params.id,
      createdBy: req.user._id,
      assessmentType: 'coding',
    });

    if (!assessment) {
      return res.status(404).json({ message: 'Coding assessment not found' });
    }

    assessment.questions = assessment.questions.filter(
      (qId) => qId.toString() !== req.params.questionId
    );
    assessment.questionCount = assessment.questions.length;
    await assessment.save();

    await assessment.populate('questions', 'title difficulty points type category tags timeLimitSeconds');

    res.json({ assessment });
  } catch (error) {
    logger.error('Error removing question', { error: error.message });
    res.status(500).json({ message: 'Failed to remove question', error: error.message });
  }
};

/**
 * PUT /api/assessments/:id/questions/reorder — reorder questions
 */
exports.reorderQuestions = async (req, res) => {
  try {
    const { questionIds } = req.body;
    if (!Array.isArray(questionIds)) {
      return res.status(400).json({ message: 'questionIds array is required' });
    }

    const assessment = await Assessment.findOne({
      _id: req.params.id,
      createdBy: req.user._id,
      assessmentType: 'coding',
    });

    if (!assessment) {
      return res.status(404).json({ message: 'Coding assessment not found' });
    }

    // Ensure the provided IDs match the existing questions
    const currentIds = assessment.questions.map(String).sort();
    const newIds = [...questionIds].sort();

    if (JSON.stringify(currentIds) !== JSON.stringify(newIds)) {
      return res.status(400).json({ message: 'Question IDs must match existing questions' });
    }

    assessment.questions = questionIds;
    await assessment.save();

    await assessment.populate('questions', 'title difficulty points type category tags timeLimitSeconds');

    res.json({ assessment });
  } catch (error) {
    logger.error('Error reordering questions', { error: error.message });
    res.status(500).json({ message: 'Failed to reorder questions', error: error.message });
  }
};

/**
 * POST /api/assessments/:id/regenerate-code — regenerate the invite code
 */
exports.regenerateInviteCode = async (req, res) => {
  try {
    const assessment = await Assessment.findOneAndUpdate(
      { _id: req.params.id, createdBy: req.user._id },
      { $set: { inviteCode: crypto.randomBytes(6).toString('hex') } },
      { new: true }
    );

    if (!assessment) {
      return res.status(404).json({ message: 'Assessment not found' });
    }

    res.json({ inviteCode: assessment.inviteCode });
  } catch (error) {
    logger.error('Error regenerating invite code', { error: error.message });
    res.status(500).json({ message: 'Failed to regenerate invite code', error: error.message });
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
 * Supports both AI-chat (generates first question via AI) and coding (loads questions from assessment).
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
    }).populate({
      path: 'assessment',
      populate: { path: 'questions', model: 'Question' },
    });

    if (existing) {
      // Resume existing session — include questions for coding
      return res.json({ session: existing, resumed: true });
    }

    const assessment = invitation.assessment;
    const isCoding = assessment.assessmentType === 'coding';

    if (isCoding) {
      // ── Coding session: load questions from assessment ────────
      const populatedAssessment = await Assessment.findById(assessment._id)
        .populate('questions', 'title description type difficulty points category tags timeLimitSeconds testCases starterCode constraints examples allowedLanguages');

      const questions = populatedAssessment.questions || [];
      if (questions.length === 0) {
        return res.status(400).json({ message: 'This coding assessment has no questions configured' });
      }

      const session = await AssessmentSession.create({
        invitation: invitationId,
        assessment: assessment._id,
        freelancer: req.user._id,
        sessionType: 'coding',
        totalQuestions: questions.length,
        currentQuestionIndex: 0,
        messages: [],
        submissions: [],
      });

      // Update invitation status
      invitation.status = 'accepted';
      if (!invitation.freelancer) invitation.freelancer = req.user._id;
      await invitation.save();

      logger.info('Coding session started', { sessionId: session._id, freelancer: req.user._id, questionCount: questions.length });

      // Notify employer (non-blocking)
      notificationService.notifyAssessmentStarted(session, assessment, req.user).catch((err) =>
        logger.warn('Failed to send assessment started notification', { error: err.message })
      );

      // Return session + full question data (hide hidden test cases from response)
      const safeQuestions = questions.map(q => {
        const obj = q.toObject ? q.toObject() : q;
        return {
          ...obj,
          testCases: (obj.testCases || []).filter(tc => !tc.isHidden),
        };
      });

      res.status(201).json({
        session,
        questions: safeQuestions,
        resumed: false,
      });
    } else {
      // ── AI-chat session (legacy flow) ────────────────────────
      const firstQ = await assessmentEngine.generateFirstQuestion({
        profession: assessment.profession,
        role: assessment.role,
        skills: assessment.skills,
        difficulty: assessment.difficulty,
        totalQuestions: assessment.questionCount,
      });

      const session = await AssessmentSession.create({
        invitation: invitationId,
        assessment: assessment._id,
        freelancer: req.user._id,
        sessionType: 'ai_chat',
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

      invitation.status = 'accepted';
      if (!invitation.freelancer) invitation.freelancer = req.user._id;
      await invitation.save();

      logger.info('AI-chat session started', { sessionId: session._id, freelancer: req.user._id });

      notificationService.notifyAssessmentStarted(session, assessment, req.user).catch((err) =>
        logger.warn('Failed to send assessment started notification', { error: err.message })
      );

      res.status(201).json({ session, resumed: false });
    }
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
      .populate({
        path: 'assessment',
        select: 'title profession role skills difficulty questionCount timeLimitMinutes createdBy assessmentType allowedLanguages questions',
        populate: {
          path: 'questions',
          model: 'Question',
          select: 'title description type difficulty points category tags timeLimitSeconds testCases starterCode constraints examples allowedLanguages',
        },
      })
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

// ═══════════════════════════════════════════════════════════════
//  FINISH CODING SESSION
// ═══════════════════════════════════════════════════════════════

/**
 * POST /api/assessments/sessions/:id/finish — Complete a coding session.
 * Calculates total score from all submissions, generates summary, marks complete.
 */
exports.finishCodingSession = async (req, res) => {
  try {
    const session = await AssessmentSession.findOne({
      _id: req.params.id,
      freelancer: req.user._id,
      status: 'in_progress',
      sessionType: 'coding',
    }).populate('assessment');

    if (!session) {
      return res.status(404).json({ message: 'Active coding session not found' });
    }

    const assessment = session.assessment;
    const elapsed = (Date.now() - session.startedAt.getTime()) / 1000;

    // Calculate weighted score from submissions
    // Load the actual questions to get points/weights
    const questionIds = session.submissions.map(s => s.question);
    const questions = await Question.find({ _id: { $in: questionIds } })
      .select('title difficulty points category')
      .lean();
    const questionMap = {};
    questions.forEach(q => { questionMap[q._id.toString()] = q; });

    let totalPoints = 0;
    let earnedPoints = 0;
    const breakdown = {};

    // Also compute from all assessment questions (not just submitted ones)
    const allAssessmentQuestions = await Question.find({
      _id: { $in: assessment.questions || [] },
    }).select('title difficulty points category').lean();

    allAssessmentQuestions.forEach(q => {
      totalPoints += q.points || 10;
    });

    session.submissions.forEach(sub => {
      const q = questionMap[sub.question.toString()];
      if (!q) return;
      const maxPts = q.points || 10;
      const earned = (sub.score / 100) * maxPts;
      earnedPoints += earned;

      // Breakdown by category
      const cat = q.category || q.difficulty || 'General';
      if (!breakdown[cat]) breakdown[cat] = { earned: 0, total: 0 };
      breakdown[cat].earned += earned;
      breakdown[cat].total += maxPts;
    });

    // Account for unanswered questions in total
    const overallScore = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
    const breakdownPercent = {};
    Object.entries(breakdown).forEach(([cat, vals]) => {
      breakdownPercent[cat] = vals.total > 0 ? Math.round((vals.earned / vals.total) * 100) : 0;
    });

    // Build strengths/weaknesses from question results
    const strengths = [];
    const weaknesses = [];
    session.submissions.forEach(sub => {
      const q = questionMap[sub.question.toString()];
      if (!q) return;
      if (sub.score === 100) {
        strengths.push(`Solved "${q.title}" (${q.difficulty}) — all test cases passed`);
      } else if (sub.score >= 50) {
        strengths.push(`Partial solve on "${q.title}" (${sub.passedCount}/${sub.totalCount} test cases)`);
      } else {
        weaknesses.push(`Struggled with "${q.title}" (${q.difficulty}) — ${sub.passedCount}/${sub.totalCount} test cases`);
      }
    });

    // Mark unanswered questions as weaknesses
    const submittedQIds = new Set(session.submissions.map(s => s.question.toString()));
    allAssessmentQuestions.forEach(q => {
      if (!submittedQIds.has(q._id.toString())) {
        weaknesses.push(`Did not attempt "${q.title}" (${q.difficulty})`);
      }
    });

    // Generate a simple AI summary
    const aiSummary = `Candidate completed ${session.submissions.length}/${allAssessmentQuestions.length} questions with an overall score of ${overallScore}%. ` +
      `Time spent: ${Math.round(elapsed / 60)} minutes. ` +
      (strengths.length > 0 ? `Strengths include: ${strengths.slice(0, 3).join('; ')}. ` : '') +
      (weaknesses.length > 0 ? `Areas to improve: ${weaknesses.slice(0, 3).join('; ')}.` : '');

    session.status = 'completed';
    session.completedAt = new Date();
    session.timeSpentSeconds = Math.round(elapsed);
    session.score = _clamp(overallScore, 0, 100);
    session.breakdown = breakdownPercent;
    session.strengths = strengths.slice(0, 10);
    session.weaknesses = weaknesses.slice(0, 10);
    session.aiSummary = aiSummary;

    await session.save();

    // Update invitation
    await AssessmentInvitation.findByIdAndUpdate(session.invitation, { status: 'completed' });

    logger.info('Coding session completed', {
      sessionId: session._id,
      score: overallScore,
      submitted: session.submissions.length,
      total: allAssessmentQuestions.length,
    });

    // Notify employer of completion (non-blocking)
    notificationService.notifyAssessmentCompleted(session, assessment, req.user).catch((err) =>
      logger.warn('Failed to send assessment completed notification', { error: err.message })
    );

    res.json({ session });
  } catch (error) {
    logger.error('Error finishing coding session', { error: error.message });
    res.status(500).json({ message: 'Failed to finish session', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════
//  ANTI-CHEAT EVENT RECORDING
// ═══════════════════════════════════════════════════════════════

/**
 * POST /api/assessments/sessions/:id/anti-cheat — Record an anti-cheat event
 */
exports.recordAntiCheatEvent = async (req, res) => {
  try {
    const { event, details } = req.body;

    const session = await AssessmentSession.findOne({
      _id: req.params.id,
      freelancer: req.user._id,
      status: 'in_progress',
    });

    if (!session) {
      return res.status(404).json({ message: 'Active session not found' });
    }

    session.antiCheatEvents.push({
      event,
      timestamp: new Date(),
      details: details || '',
    });

    // Decrement anti-cheat score (starts at 100, loses points per event)
    const penalties = {
      tab_switch: 5,
      window_blur: 3,
      copy_attempt: 8,
      paste_attempt: 8,
      devtools_open: 15,
      right_click: 2,
      screen_resize: 1,
    };
    const penalty = penalties[event] || 3;
    session.antiCheatScore = Math.max(0, (session.antiCheatScore || 100) - penalty);

    await session.save();

    res.json({
      recorded: true,
      antiCheatScore: session.antiCheatScore,
      totalEvents: session.antiCheatEvents.length,
    });
  } catch (error) {
    logger.error('Error recording anti-cheat event', { error: error.message });
    res.status(500).json({ message: 'Failed to record event', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════
//  JOIN BY INVITE CODE  (create invitation + start session)
// ═══════════════════════════════════════════════════════════════

/**
 * POST /api/assessments/join/:inviteCode — Freelancer joins via shareable link.
 * Creates an invitation if one doesn't exist, then creates/resumes a session.
 */
exports.joinByInviteCode = async (req, res) => {
  try {
    const assessment = await Assessment.findOne({
      inviteCode: req.params.inviteCode,
      isActive: true,
    });

    if (!assessment) {
      return res.status(404).json({ message: 'Assessment not found or inactive' });
    }

    // Check if this freelancer already has an invitation for this assessment
    let invitation = await AssessmentInvitation.findOne({
      assessment: assessment._id,
      $or: [
        { freelancer: req.user._id },
        { freelancerEmail: req.user.email },
      ],
    });

    if (invitation && invitation.status === 'completed') {
      return res.status(409).json({ message: 'You have already completed this assessment' });
    }

    if (invitation && invitation.status === 'declined') {
      return res.status(409).json({ message: 'You have declined this assessment' });
    }

    // Create invitation if it doesn't exist
    if (!invitation) {
      const inviteToken = crypto.randomBytes(32).toString('hex');
      invitation = await AssessmentInvitation.create({
        assessment: assessment._id,
        employer: assessment.createdBy,
        freelancer: req.user._id,
        freelancerEmail: req.user.email,
        inviteToken,
        status: 'pending',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      });
    }

    // Populate for the response
    await invitation.populate('assessment', 'title description profession role difficulty questionCount timeLimitMinutes assessmentType allowedLanguages skills');
    await invitation.populate('employer', 'firstName lastName companyName');

    res.json({
      invitation,
      assessment: invitation.assessment,
    });
  } catch (error) {
    logger.error('Error joining by invite code', { error: error.message });
    res.status(500).json({ message: 'Failed to join assessment', error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════
//  PUBLIC ASSESSMENT CATALOG
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/assessments/public — browse assessments marked as public
 * No auth required. Supports pagination, search, and filtering.
 */
exports.getPublicAssessments = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 12,
      search,
      profession,
      difficulty,
      assessmentType,
      sort = 'recent',
    } = req.query;

    const query = { isPublic: true, isActive: true };

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { profession: { $regex: search, $options: 'i' } },
        { skills: { $elemMatch: { $regex: search, $options: 'i' } } },
      ];
    }

    if (profession) query.profession = { $regex: profession, $options: 'i' };
    if (difficulty) query.difficulty = difficulty;
    if (assessmentType) query.assessmentType = assessmentType;

    const sortMap = {
      recent: { createdAt: -1 },
      popular: { 'stats.totalSessions': -1, createdAt: -1 },
      title: { title: 1 },
    };
    const sortOrder = sortMap[sort] || sortMap.recent;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [assessments, total] = await Promise.all([
      Assessment.find(query)
        .populate('createdBy', 'firstName lastName companyName profilePicture')
        .select('title description profession skills difficulty questionCount timeLimitMinutes assessmentType allowedLanguages createdBy createdAt')
        .sort(sortOrder)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Assessment.countDocuments(query),
    ]);

    // Enrich each with total completions count
    const assessmentIds = assessments.map(a => a._id);
    const sessionCounts = await AssessmentSession.aggregate([
      { $match: { assessment: { $in: assessmentIds }, status: 'completed' } },
      { $group: { _id: '$assessment', count: { $sum: 1 }, avgScore: { $avg: '$score' } } },
    ]);
    const countMap = {};
    sessionCounts.forEach(sc => {
      countMap[sc._id.toString()] = { completions: sc.count, avgScore: Math.round(sc.avgScore || 0) };
    });

    const enriched = assessments.map(a => ({
      ...a,
      completions: countMap[a._id.toString()]?.completions || 0,
      avgScore: countMap[a._id.toString()]?.avgScore || null,
    }));

    res.json({
      assessments: enriched,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    logger.error('Get public assessments error', { error: error.message });
    res.status(500).json({ message: 'Failed to get public assessments', error: error.message });
  }
};
