const OpenAI = require('openai');
const logger = require('../utils/logger');

/**
 * Service for interacting with OpenAI API
 */
class AIService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    this.model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    this.maxTokens = 4000;
  }

  /**
   * Grade a developer based on their code and repositories
   * @param {string} prompt - The analysis prompt containing code and metadata
   * @returns {Object} Grading result with grade, reasoning, strengths, weaknesses, suggestions
   */
  async gradeDeveloper(prompt) {
    try {
      logger.info('Sending request to OpenAI for developer grading');
      
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt()
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: this.maxTokens,
        temperature: 0.2, // Low temperature for deterministic grading
        response_format: { type: "json_object" } // Force JSON response
      });

      const content = response.choices[0]?.message?.content;
      
      if (!content) {
        throw new Error('No response content from OpenAI');
      }

      // Parse the JSON response
      let result;
      try {
        result = JSON.parse(content);
      } catch (parseError) {
        logger.error('Failed to parse OpenAI response as JSON', { content });
        // Fallback: try to extract JSON from the response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          result = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('Invalid JSON response from OpenAI');
        }
      }

      // Validate the response structure
      const validatedResult = this.validateAndCleanResponse(result);
      
      logger.info('OpenAI analysis complete');
      return validatedResult;

    } catch (error) {
      logger.error('OpenAI API error in gradeDeveloper', { error: error.message });
      
      if (error.status === 429) {
        throw new Error('OpenAI API rate limit exceeded. Please try again later.');
      }
      
      if (error.status === 401) {
        throw new Error('OpenAI API authentication failed. Please check your API key.');
      }
      
      if (error.status === 413) {
        throw new Error('Request too large for OpenAI API. Try with fewer repositories.');
      }

      throw new Error(`OpenAI API error: ${error.message}`);
    }
  }

  /**
   * Generate recruiter-focused and engineer-focused insights
   * @param {string} prompt - Analysis prompt
   * @param {Object} scores - Calculated scores
   * @returns {Object} Complete insights with recruiter_summary and engineer_breakdown
   */
  async generateInsights(prompt, scores) {
    try {
      logger.info('Generating comprehensive insights from OpenAI');
      
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: this.getEnhancedSystemPrompt()
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: this.maxTokens,
        temperature: 0.2,
        response_format: { type: "json_object" }
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response content from OpenAI');
      }

      let result = JSON.parse(content);
      return this.validateAndEnhanceResponse(result, scores);

    } catch (error) {
      logger.error('OpenAI API error in generateInsights', { error: error.message });
      throw new Error(`OpenAI API error: ${error.message}`);
    }
  }

  /**
   * Get enhanced system prompt for comprehensive analysis
   * @returns {string} System prompt
   */
  getEnhancedSystemPrompt() {
    return `You are a senior engineering hiring consultant analyzing a developer's GitHub portfolio.

You will receive structured data about a developer's repositories including:
- Repository metadata (languages, stars, forks, activity dates)
- Code samples from their most significant files (including test files)
- Pre-computed metrics (test ratios, commit patterns, architecture signals)
- Numeric scores in 5 categories for context

Your job is to provide TWO complementary perspectives:

**RECRUITER PERSPECTIVE** — Written for non-technical hiring managers:
- What roles is this person suited for? Be specific (e.g., "Mid-level React/Node.js developer with growing backend skills")
- What are their working style signals? (consistent committer, project finisher, hobby coder, etc.)
- What are honest hiring risks? Frame constructively.
- Rate their portfolio readiness: are these projects presentable to employers?

**ENGINEER PERSPECTIVE** — Written for technical interviewers:
- What specific design patterns and architectural decisions do you see?
- How mature is their error handling, testing, and type safety?
- What complexity level are they operating at? (CRUD apps vs. service architecture vs. distributed systems vs. algorithm-heavy)
- What would you probe in a technical interview based on what you see?
- What are concrete improvement areas with actionable next steps?

RESPONSE FORMAT (JSON only, no additional text):
{
  "recruiter_summary": {
    "top_strengths": ["3-5 evidence-backed strengths relevant to hiring"],
    "risks_or_weaknesses": ["2-4 honest hiring concerns, framed constructively"],
    "recommended_role_level": "Specific role title with level, e.g. Mid-Level React/Node.js Developer",
    "portfolio_readiness": "One sentence: how presentable is this portfolio to employers?"
  },
  "engineer_breakdown": {
    "code_patterns": ["4-6 specific coding patterns and design patterns observed, with file references where possible"],
    "architecture_analysis": ["2-4 specific architectural decisions observed"],
    "testing_analysis": {
      "maturity": "None | Basic | Moderate | Comprehensive",
      "test_libraries_seen": ["Jest", "Mocha", etc.],
      "details": "Specific observations about test quality and coverage approach"
    },
    "complexity_insights": ["observations about code complexity level"],
    "commit_message_quality": "Good | Fair | Needs improvement",
    "notable_implementations": ["1-3 impressive or interesting code sections with specifics"],
    "improvement_areas": ["3-5 ranked, actionable suggestions — include anti-patterns or code smells you observed"],
    "interview_probes": ["2-3 technical questions you would ask based on their code"]
  }
}

CRITICAL RULES:
- Base EVERY observation on specific evidence from the provided code. Do not make generic statements.
- If you cannot determine something from the data, say "Insufficient data to assess" — do not guess.
- Do NOT assess years of experience — that is unknowable from code alone.
- Do NOT use the pre-computed scores to determine your qualitative analysis — form your own opinion from the code.
- Be honest but respectful. This analysis will be shown to the developer.`;
  }

  /**
   * Get the system prompt for the AI
   * @returns {string} System prompt
   */
  getSystemPrompt() {
    return `You are a senior engineering hiring consultant analyzing a developer's GitHub portfolio.

Analyze the provided code and repository data. Base every observation on specific evidence from the code.

RESPONSE FORMAT (JSON only):
{
  "grade": "Entry|Junior|Mid-Level|Senior|Expert",
  "reasoning": "2-3 sentence explanation based on specific code observations",
  "strengths": ["evidence-backed strength 1", "evidence-backed strength 2", "evidence-backed strength 3"],
  "weaknesses": ["specific weakness 1", "specific weakness 2", "specific weakness 3"],
  "suggestions": ["actionable suggestion 1", "actionable suggestion 2", "actionable suggestion 3"]
}

CRITICAL: If you cannot determine something, say so. Do not make generic statements.`;
  }

  /**
   * Validate and enhance AI response with scores
   * @param {Object} response - Raw AI response
   * @param {Object} scores - Calculated scores
   * @returns {Object} Enhanced response
   */
  validateAndEnhanceResponse(response, scores) {
    // Ensure recruiter_summary exists
    if (!response.recruiter_summary) {
      response.recruiter_summary = {
        top_strengths: response.strengths || ["Shows technical capability"],
        risks_or_weaknesses: response.weaknesses || ["Could benefit from more experience"],
        recommended_role_level: `${scores.overall_level} Developer`,
        portfolio_readiness: "Needs polish"
      };
    }
    if (!response.recruiter_summary.portfolio_readiness) {
      response.recruiter_summary.portfolio_readiness = "Needs polish";
    }

    // Ensure engineer_breakdown exists
    if (!response.engineer_breakdown) {
      response.engineer_breakdown = {
        code_patterns: response.strengths || [],
        architecture_analysis: [],
        testing_analysis: {
          maturity: "Basic",
          test_libraries_seen: [],
          details: "Insufficient data to assess"
        },
        complexity_insights: [],
        commit_message_quality: "Fair",
        notable_implementations: [],
        improvement_areas: response.suggestions || [],
        interview_probes: []
      };
    }
    // Ensure optional fields exist
    if (!response.engineer_breakdown.interview_probes) {
      response.engineer_breakdown.interview_probes = [];
    }
    if (!response.engineer_breakdown.notable_implementations) {
      response.engineer_breakdown.notable_implementations = [];
    }
    if (!response.engineer_breakdown.improvement_areas) {
      response.engineer_breakdown.improvement_areas = [];
    }
    // Normalize testing_analysis shape
    if (response.engineer_breakdown.testing_analysis && !response.engineer_breakdown.testing_analysis.maturity) {
      response.engineer_breakdown.testing_analysis.maturity = response.engineer_breakdown.testing_analysis.test_presence ? "Basic" : "None";
    }

    // Clean and validate arrays
    response.recruiter_summary.top_strengths = this.cleanArray(response.recruiter_summary.top_strengths, "Technical capability");
    response.recruiter_summary.risks_or_weaknesses = this.cleanArray(response.recruiter_summary.risks_or_weaknesses, "Limited experience");
    response.engineer_breakdown.code_patterns = this.cleanArray(response.engineer_breakdown.code_patterns, "Basic patterns");
    response.engineer_breakdown.architecture_analysis = this.cleanArray(response.engineer_breakdown.architecture_analysis, "Standard structure");
    response.engineer_breakdown.improvement_areas = this.cleanArray(response.engineer_breakdown.improvement_areas, "Continue building projects");
    response.engineer_breakdown.interview_probes = this.cleanArray(response.engineer_breakdown.interview_probes, "Discuss architecture decisions in main project");

    return response;
  }

  /**
   * Validate and clean the AI response
   * @param {Object} response - Raw response from OpenAI
   * @returns {Object} Validated and cleaned response
   */
  validateAndCleanResponse(response) {
    const validGrades = ['Entry', 'Junior', 'Mid-Level', 'Senior', 'Expert',
                         'Beginner', 'Intermediate', 'Advanced']; // accept legacy too
    
    // Ensure all required fields exist
    const result = {
      grade: response.grade || 'Mid-Level',
      reasoning: response.reasoning || 'Unable to generate detailed reasoning.',
      strengths: Array.isArray(response.strengths) ? response.strengths : [],
      weaknesses: Array.isArray(response.weaknesses) ? response.weaknesses : [],
      suggestions: Array.isArray(response.suggestions) ? response.suggestions : []
    };

    // Map legacy grades to new scale
    const gradeMap = { 'Beginner': 'Entry', 'Intermediate': 'Mid-Level', 'Advanced': 'Senior' };
    if (gradeMap[result.grade]) result.grade = gradeMap[result.grade];

    // Validate grade
    if (!['Entry', 'Junior', 'Mid-Level', 'Senior', 'Expert'].includes(result.grade)) {
      logger.warn('Invalid grade received from OpenAI, defaulting to Mid-Level', { receivedGrade: result.grade });
      result.grade = 'Mid-Level';
    }

    // Ensure arrays have at least one item and limit length
    result.strengths = this.cleanArray(result.strengths, 'demonstrates basic programming concepts');
    result.weaknesses = this.cleanArray(result.weaknesses, 'could benefit from more practice');
    result.suggestions = this.cleanArray(result.suggestions, 'continue building projects to improve skills');

    // Limit string lengths
    result.reasoning = this.limitString(result.reasoning, 500);

    return result;
  }

  /**
   * Clean and validate array fields
   * @param {Array} arr - Array to clean
   * @param {string} fallback - Fallback item if array is empty
   * @returns {Array} Cleaned array
   */
  cleanArray(arr, fallback) {
    if (!Array.isArray(arr) || arr.length === 0) {
      return [fallback];
    }

    // Filter out empty/invalid items and limit to 5 items
    const cleaned = arr
      .filter(item => typeof item === 'string' && item.trim().length > 0)
      .map(item => this.limitString(item.trim(), 200))
      .slice(0, 5);

    return cleaned.length > 0 ? cleaned : [fallback];
  }

  /**
   * Limit string length
   * @param {string} str - String to limit
   * @param {number} maxLength - Maximum length
   * @returns {string} Limited string
   */
  limitString(str, maxLength) {
    if (typeof str !== 'string') return '';
    return str.length > maxLength ? str.substring(0, maxLength - 3) + '...' : str;
  }

  /**
   * Estimate token count for a string (rough approximation)
   * @param {string} text - Text to count tokens for
   * @returns {number} Estimated token count
   */
  estimateTokens(text) {
    // Rough approximation: 1 token ≈ 4 characters for English text
    return Math.ceil(text.length / 4);
  }
}

module.exports = new AIService();
