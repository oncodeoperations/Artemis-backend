const OpenAI = require('openai');
const logger = require('../utils/logger');

/**
 * AssessmentEngine
 * ────────────────
 * AI-powered skill assessment engine that:
 *   1. Generates an adaptive opening question for any profession/role.
 *   2. Evaluates each answer and generates the next question.
 *   3. Produces a final score + breakdown + summary after all questions.
 *
 * Uses GPT-4o-mini with JSON mode for deterministic, parseable responses.
 */
class AssessmentEngine {
  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.model = 'gpt-4o-mini';
  }

  // ─── 1. Generate the First Question ─────────────────────────

  /**
   * Kick off an assessment — returns the first question message.
   * @param {Object} opts
   * @param {string} opts.profession       e.g. "Software Engineering"
   * @param {string} opts.role             e.g. "Backend Developer"
   * @param {string[]} opts.skills         e.g. ["Node.js","SQL"]
   * @param {string} opts.difficulty       beginner | intermediate | advanced
   * @param {number} opts.totalQuestions   how many Qs this session will have
   * @returns {Promise<{ question: string, hint?: string }>}
   */
  async generateFirstQuestion({ profession, role, skills, difficulty, totalQuestions }) {
    const systemPrompt = this._buildAssessorSystemPrompt({
      profession,
      role,
      skills,
      difficulty,
      totalQuestions,
    });

    const userPrompt = `Generate the FIRST question (question 1 of ${totalQuestions}) for this assessment.

Start with a question that gauges the candidate's foundational knowledge of their stated skills.
For Software Engineering candidates, you may include a small code snippet or ask them to write pseudocode.
For other professions, ask a practical scenario question.

Respond in JSON:
{
  "question": "<the question text — may include markdown code blocks for devs>",
  "hint": "<optional one-line hint, or empty string>"
}`;

    return this._chatJSON(systemPrompt, userPrompt);
  }

  // ─── 2. Evaluate Answer & Generate Next Question ────────────

  /**
   * Evaluate the candidate's answer, then produce the next question (adaptive).
   * @param {Object} opts
   * @param {string} opts.profession
   * @param {string} opts.role
   * @param {string[]} opts.skills
   * @param {string} opts.difficulty
   * @param {number} opts.totalQuestions
   * @param {number} opts.currentIndex           1-indexed current Q number
   * @param {Array}  opts.conversationHistory     [{role:'ai'|'user', content}]
   * @returns {Promise<{ evaluation: string, score: number, nextQuestion: string, hint?: string }>}
   */
  async evaluateAndNextQuestion({
    profession,
    role,
    skills,
    difficulty,
    totalQuestions,
    currentIndex,
    conversationHistory,
  }) {
    const systemPrompt = this._buildAssessorSystemPrompt({
      profession,
      role,
      skills,
      difficulty,
      totalQuestions,
    });

    // Build the OpenAI messages array from conversation history
    const messages = [{ role: 'system', content: systemPrompt }];

    for (const msg of conversationHistory) {
      messages.push({
        role: msg.role === 'ai' ? 'assistant' : 'user',
        content: msg.content,
      });
    }

    const nextQNum = currentIndex + 1;
    const isLast = nextQNum > totalQuestions;

    const evalPrompt = isLast
      ? `The candidate just answered question ${currentIndex} (the last question).
Evaluate their answer, give a score from 0-10, and provide brief feedback.

Respond in JSON:
{
  "evaluation": "<brief evaluation of their answer>",
  "score": <0-10>,
  "nextQuestion": "",
  "hint": ""
}`
      : `The candidate just answered question ${currentIndex} of ${totalQuestions}.
Evaluate their answer, give a score from 0-10.
Then generate question ${nextQNum} of ${totalQuestions}.
Adapt the difficulty based on how well they answered — if they did well, make it harder; if they struggled, keep it at the same level or make it slightly easier.

Respond in JSON:
{
  "evaluation": "<brief evaluation of their answer>",
  "score": <0-10>,
  "nextQuestion": "<question ${nextQNum} text — may include code blocks for devs>",
  "hint": "<optional one-line hint, or empty string>"
}`;

    messages.push({ role: 'user', content: evalPrompt });

    return this._chatJSONRaw(messages);
  }

  // ─── 3. Generate Final Score & Summary ──────────────────────

  /**
   * After all questions are answered, produce the final assessment report.
   * @param {Object} opts
   * @param {string} opts.profession
   * @param {string} opts.role
   * @param {string[]} opts.skills
   * @param {string} opts.difficulty
   * @param {number} opts.totalQuestions
   * @param {Array}  opts.conversationHistory  full conversation
   * @param {number[]} opts.questionScores     per-question scores (0-10)
   * @returns {Promise<{ score: number, breakdown: Object, summary: string, strengths: string[], weaknesses: string[] }>}
   */
  async generateFinalReport({
    profession,
    role,
    skills,
    difficulty,
    totalQuestions,
    conversationHistory,
    questionScores,
  }) {
    const systemPrompt = this._buildAssessorSystemPrompt({
      profession,
      role,
      skills,
      difficulty,
      totalQuestions,
    });

    const messages = [{ role: 'system', content: systemPrompt }];

    for (const msg of conversationHistory) {
      messages.push({
        role: msg.role === 'ai' ? 'assistant' : 'user',
        content: msg.content,
      });
    }

    const avg = questionScores.length
      ? questionScores.reduce((a, b) => a + b, 0) / questionScores.length
      : 0;

    messages.push({
      role: 'user',
      content: `The assessment is now complete.
The candidate answered ${totalQuestions} questions.
Per-question scores (0-10): ${JSON.stringify(questionScores)}
Raw average: ${avg.toFixed(1)}/10

Now produce the FINAL assessment report as JSON:
{
  "score": <overall score 0-100>,
  "breakdown": {
    "<Category 1>": <0-100>,
    "<Category 2>": <0-100>
  },
  "summary": "<2-4 sentence professional summary of the candidate's performance>",
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "weaknesses": ["weakness 1", "weakness 2"]
}

BREAKDOWN categories should be relevant to the profession. Examples:
- Software Engineering: "Problem Solving", "Code Quality", "System Design", "Communication"
- Marketing: "Strategy", "Analytics", "Creativity", "Campaign Planning"
- Design: "Visual Design", "UX Thinking", "Tools Proficiency", "Communication"
- General: "Domain Knowledge", "Problem Solving", "Communication", "Critical Thinking"

The overall score should be a holistic evaluation (not just the average) — consider depth of answers, consistency, and improvement over the session.`,
    });

    return this._chatJSONRaw(messages);
  }

  // ─── Private helpers ────────────────────────────────────────

  /**
   * Build the system prompt that defines the assessor persona.
   */
  _buildAssessorSystemPrompt({ profession, role, skills, difficulty, totalQuestions }) {
    const skillsList = skills.length ? skills.join(', ') : 'general skills';

    return `You are an expert ${profession} interviewer and skill assessor.
You are conducting a ${difficulty}-level assessment for a candidate applying as a "${role || profession} professional".
The candidate claims expertise in: ${skillsList}.
The assessment has ${totalQuestions} questions total.

RULES:
1. Ask ONE question at a time.
2. Questions should be practical and scenario-based — not trivia.
3. For Software Engineering candidates, include code snippets, debugging tasks, or architecture questions as appropriate.
4. For other professions, use realistic workplace scenarios, case studies, or practical problems.
5. Adapt difficulty based on previous answers (if they do well, go harder; if they struggle, stay steady).
6. Score each answer 0-10 honestly. Be fair but rigorous.
7. Keep evaluations concise (1-2 sentences).
8. Do NOT reveal the scoring rubric to the candidate.
9. Always respond in valid JSON only — no markdown wrapping, no extra text.`;
  }

  /**
   * Send a system + user prompt and parse JSON response.
   */
  async _chatJSON(systemPrompt, userPrompt) {
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];
    return this._chatJSONRaw(messages);
  }

  /**
   * Send raw messages array and parse JSON response.
   */
  async _chatJSONRaw(messages) {
    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages,
        max_tokens: 2000,
        temperature: 0.5,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error('Empty response from OpenAI');

      return JSON.parse(content);
    } catch (error) {
      logger.error('AssessmentEngine OpenAI error', { error: error.message });

      if (error.status === 429) {
        throw new Error('Rate limit exceeded — please try again shortly.');
      }
      if (error.status === 401) {
        throw new Error('OpenAI authentication failed.');
      }

      throw new Error(`Assessment AI error: ${error.message}`);
    }
  }
}

module.exports = new AssessmentEngine();
