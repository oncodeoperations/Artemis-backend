const judge0Service = require('../services/judge0Service');
const Question = require('../models/Question');
const AssessmentSession = require('../models/AssessmentSession');
const logger = require('../utils/logger');

/**
 * Code Execution Controller
 * Handles running code, grading submissions, and fetching language info.
 */

// ─── Run Code (sandbox, no grading) ───────────────────────────
exports.runCode = async (req, res) => {
  try {
    const { sourceCode, language, stdin } = req.body;

    if (!sourceCode || !language) {
      return res.status(400).json({ error: 'sourceCode and language are required' });
    }

    const langInfo = judge0Service.getLanguageInfo(language);
    if (!langInfo) {
      return res.status(400).json({ error: `Unsupported language: ${language}` });
    }

    const result = await judge0Service.runCode({
      sourceCode,
      languageId: langInfo.id,
      stdin: stdin || '',
    });

    res.json({
      stdout: result.stdout,
      stderr: result.stderr,
      compileOutput: result.compileOutput,
      status: result.status,
      executionTime: result.time,
      memoryUsed: result.memory,
    });
  } catch (error) {
    logger.error('runCode error', { error: error.message });
    res.status(500).json({ error: 'Code execution failed' });
  }
};

// ─── Run Code Against Sample Test Cases (visible only) ────────
exports.runAgainstSamples = async (req, res) => {
  try {
    const { sourceCode, language, questionId } = req.body;

    if (!sourceCode || !language || !questionId) {
      return res.status(400).json({ error: 'sourceCode, language, and questionId are required' });
    }

    const langInfo = judge0Service.getLanguageInfo(language);
    if (!langInfo) {
      return res.status(400).json({ error: `Unsupported language: ${language}` });
    }

    const question = await Question.findById(questionId);
    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    // Only run against visible (non-hidden) test cases
    const sampleTestCases = question.testCases.filter(tc => !tc.isHidden);

    if (sampleTestCases.length === 0) {
      return res.status(400).json({ error: 'No sample test cases available for this question' });
    }

    const results = await judge0Service.executeAgainstTestCases({
      sourceCode,
      languageId: langInfo.id,
      testCases: sampleTestCases,
    });

    const passedCount = results.filter(r => r.passed).length;

    res.json({
      results: results.map(r => ({
        input: r.input,
        expectedOutput: r.expectedOutput,
        actualOutput: r.actualOutput,
        passed: r.passed,
        executionTime: r.executionTime,
        memoryUsed: r.memoryUsed,
        error: r.error,
        statusDescription: r.statusDescription,
      })),
      passedCount,
      totalCount: sampleTestCases.length,
    });
  } catch (error) {
    logger.error('runAgainstSamples error', { error: error.message });
    res.status(500).json({ error: 'Failed to run code against test cases' });
  }
};

// ─── Submit Code for Grading (all test cases) ─────────────────
exports.submitCode = async (req, res) => {
  try {
    const { sessionId, questionId, sourceCode, language } = req.body;

    if (!sessionId || !questionId || !sourceCode || !language) {
      return res.status(400).json({
        error: 'sessionId, questionId, sourceCode, and language are required',
      });
    }

    const langInfo = judge0Service.getLanguageInfo(language);
    if (!langInfo) {
      return res.status(400).json({ error: `Unsupported language: ${language}` });
    }

    // Verify session exists and belongs to this user
    const session = await AssessmentSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    if (session.freelancer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (session.status !== 'in_progress') {
      return res.status(400).json({ error: 'Session is no longer active' });
    }

    // Get the question with all test cases
    const question = await Question.findById(questionId);
    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    // Grade against ALL test cases (visible + hidden)
    const gradeResult = await judge0Service.gradeSubmission({
      sourceCode,
      languageId: langInfo.id,
      testCases: question.testCases,
    });

    // Build submission record
    const submission = {
      question: questionId,
      code: sourceCode,
      language,
      languageId: langInfo.id,
      testCaseResults: gradeResult.results,
      passedCount: gradeResult.passedCount,
      totalCount: gradeResult.totalCount,
      score: gradeResult.score,
      statusDescription: gradeResult.statusDescription,
      executionTime: gradeResult.results.reduce((sum, r) => sum + (r.executionTime || 0), 0),
      memoryUsed: Math.max(...gradeResult.results.map(r => r.memoryUsed || 0)),
      submittedAt: new Date(),
    };

    // Check if there's already a submission for this question — replace it
    const existingIdx = session.submissions.findIndex(
      s => s.question.toString() === questionId
    );
    if (existingIdx >= 0) {
      session.submissions[existingIdx] = submission;
    } else {
      session.submissions.push(submission);
    }

    await session.save();

    // Return results (hide hidden test case details)
    const visibleResults = gradeResult.results.map(r => ({
      input: r.isHidden ? '[Hidden]' : r.input,
      expectedOutput: r.isHidden ? '[Hidden]' : r.expectedOutput,
      actualOutput: r.isHidden ? (r.passed ? '[Correct]' : '[Incorrect]') : r.actualOutput,
      passed: r.passed,
      isHidden: r.isHidden,
      executionTime: r.executionTime,
      error: r.isHidden ? '' : r.error,
    }));

    res.json({
      submission: {
        passedCount: gradeResult.passedCount,
        totalCount: gradeResult.totalCount,
        score: gradeResult.score,
        statusDescription: gradeResult.statusDescription,
      },
      results: visibleResults,
    });
  } catch (error) {
    logger.error('submitCode error', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to submit and grade code' });
  }
};

// ─── Get Supported Languages ──────────────────────────────────
exports.getLanguages = async (_req, res) => {
  try {
    const languages = judge0Service.getSupportedLanguages();
    res.json({ languages });
  } catch (error) {
    logger.error('getLanguages error', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch languages' });
  }
};

// ─── Get Starter Code for a Language ──────────────────────────
exports.getStarterCode = async (req, res) => {
  try {
    const { language } = req.params;
    const code = judge0Service.getStarterCode(language);
    const langInfo = judge0Service.getLanguageInfo(language);

    if (!langInfo) {
      return res.status(400).json({ error: `Unsupported language: ${language}` });
    }

    res.json({
      language,
      languageId: langInfo.id,
      monacoId: langInfo.monacoId,
      starterCode: code,
    });
  } catch (error) {
    logger.error('getStarterCode error', { error: error.message });
    res.status(500).json({ error: 'Failed to get starter code' });
  }
};

// ─── Judge0 Health Check ──────────────────────────────────────
exports.healthCheck = async (_req, res) => {
  try {
    const health = await judge0Service.healthCheck();
    res.json(health);
  } catch (error) {
    res.status(503).json({ healthy: false, error: error.message });
  }
};
