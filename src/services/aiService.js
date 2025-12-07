const OpenAI = require('openai');

/**
 * Service for interacting with OpenAI API
 */
class AIService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    this.model = 'gpt-4o-mini'; // Use gpt-4o-mini for cost efficiency
    this.maxTokens = 4000;
  }

  /**
   * Grade a developer based on their code and repositories
   * @param {string} prompt - The analysis prompt containing code and metadata
   * @returns {Object} Grading result with grade, reasoning, strengths, weaknesses, suggestions
   */
  async gradeDeveloper(prompt) {
    try {
      console.log('🤖 Sending request to OpenAI...');
      
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
        temperature: 0.3, // Lower temperature for more consistent grading
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
        console.error('Failed to parse OpenAI response as JSON:', content);
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
      
      console.log('✅ OpenAI analysis complete');
      return validatedResult;

    } catch (error) {
      console.error('❌ OpenAI API error:', error);
      
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
      console.log('🤖 Generating comprehensive insights...');
      
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
        temperature: 0.3,
        response_format: { type: "json_object" }
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response content from OpenAI');
      }

      let result = JSON.parse(content);
      return this.validateAndEnhanceResponse(result, scores);

    } catch (error) {
      console.error('❌ OpenAI API error:', error);
      throw new Error(`OpenAI API error: ${error.message}`);
    }
  }

  /**
   * Get enhanced system prompt for comprehensive analysis
   * @returns {string} System prompt
   */
  getEnhancedSystemPrompt() {
    return `You are an expert senior software engineer and technical recruiter with 15+ years of experience.

Your task is to analyze GitHub developers and provide TWO types of insights:
1. RECRUITER SUMMARY - Non-technical, hiring-focused insights
2. ENGINEER BREAKDOWN - Deep technical analysis

RESPONSE FORMAT (JSON only, no additional text):
{
  "recruiter_summary": {
    "top_strengths": ["3-5 non-technical strengths for hiring"],
    "risks_or_weaknesses": ["2-4 hiring concerns or red flags"],
    "recommended_role_level": "e.g., Senior Full-Stack Engineer, Mid-Level Backend Developer",
    "activity_flag": "Active | Semi-active | Inactive",
    "tech_stack_summary": ["key technologies, frameworks"],
    "work_history_signals": ["observable patterns about work style"]
  },
  "engineer_breakdown": {
    "code_patterns": ["specific coding patterns observed"],
    "architecture_analysis": ["architecture insights"],
    "testing_analysis": {
      "test_presence": true|false,
      "test_libraries_seen": ["Jest", "Pytest", etc],
      "testing_patterns": ["unit tests", "integration tests", etc]
    },
    "complexity_insights": ["observations about code complexity"],
    "commit_message_quality": "Good - follows conventions | Fair | Needs improvement",
    "language_breakdown_insights": ["proficiency observations for each language"],
    "design_patterns_used": ["Factory", "Singleton", "MVC", etc],
    "code_smells": ["any anti-patterns or issues"],
    "best_practices": ["good practices observed"],
    "improvement_areas": ["specific actionable improvements"]
  }
}

RECRUITER SUMMARY GUIDELINES:
- Use non-technical language
- Focus on hiring signals (reliability, consistency, growth)
- Highlight red flags honestly but constructively
- Recommend appropriate role level based on evidence

ENGINEER BREAKDOWN GUIDELINES:
- Be technically specific
- Reference actual code patterns, not generic statements
- Identify design patterns by name
- Provide actionable technical feedback
- Note testing maturity and practices

Be honest, constructive, and specific. Base all observations on provided code examples.`;
  }

  /**
   * Get the system prompt for the AI
   * @returns {string} System prompt
   */
  getSystemPrompt() {
    return `You are an expert senior software engineer and technical interviewer with 15+ years of experience across multiple programming languages and frameworks.

Your task is to analyze GitHub developer profiles and provide accurate, constructive grading based on code quality, architecture, and best practices.

GRADING CRITERIA:
- **Beginner (0-2 years equivalent)**: Basic syntax, simple scripts, minimal structure, few best practices
- **Intermediate (2-5 years equivalent)**: Good structure, some patterns, error handling, readable code, basic testing
- **Advanced (5+ years equivalent)**: Excellent architecture, design patterns, comprehensive testing, documentation, performance optimization, complex problem-solving

ANALYSIS FOCUS:
1. Code structure and organization
2. Use of design patterns and best practices
3. Error handling and edge cases
4. Code readability and maintainability  
5. Testing and documentation quality
6. Project complexity and technical depth
7. Consistency across repositories
8. Modern language features and frameworks

RESPONSE FORMAT:
You must respond with valid JSON only, no additional text:

{
  "grade": "Beginner|Intermediate|Advanced",
  "reasoning": "2-3 sentence explanation of the grade decision",
  "strengths": ["strength1", "strength2", "strength3"],
  "weaknesses": ["weakness1", "weakness2", "weakness3"],
  "suggestions": ["suggestion1", "suggestion2", "suggestion3"]
}

Be honest but constructive. Focus on specific technical observations from the code provided.`;
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
        activity_flag: "Semi-active",
        tech_stack_summary: [],
        work_history_signals: []
      };
    }

    // Ensure engineer_breakdown exists
    if (!response.engineer_breakdown) {
      response.engineer_breakdown = {
        code_patterns: response.strengths || [],
        architecture_analysis: [],
        testing_analysis: {
          test_presence: false,
          test_libraries_seen: [],
          testing_patterns: []
        },
        complexity_insights: [],
        commit_message_quality: "Fair",
        language_breakdown_insights: [],
        design_patterns_used: [],
        code_smells: response.weaknesses || [],
        best_practices: [],
        improvement_areas: response.suggestions || []
      };
    }

    // Clean and validate arrays
    response.recruiter_summary.top_strengths = this.cleanArray(response.recruiter_summary.top_strengths, "Technical capability");
    response.recruiter_summary.risks_or_weaknesses = this.cleanArray(response.recruiter_summary.risks_or_weaknesses, "Limited experience");
    response.engineer_breakdown.code_patterns = this.cleanArray(response.engineer_breakdown.code_patterns, "Basic patterns");
    response.engineer_breakdown.architecture_analysis = this.cleanArray(response.engineer_breakdown.architecture_analysis, "Standard structure");

    return response;
  }

  /**
   * Validate and clean the AI response
   * @param {Object} response - Raw response from OpenAI
   * @returns {Object} Validated and cleaned response
   */
  validateAndCleanResponse(response) {
    const validGrades = ['Beginner', 'Intermediate', 'Advanced'];
    
    // Ensure all required fields exist
    const result = {
      grade: response.grade || 'Intermediate',
      reasoning: response.reasoning || 'Unable to generate detailed reasoning.',
      strengths: Array.isArray(response.strengths) ? response.strengths : [],
      weaknesses: Array.isArray(response.weaknesses) ? response.weaknesses : [],
      suggestions: Array.isArray(response.suggestions) ? response.suggestions : []
    };

    // Validate grade
    if (!validGrades.includes(result.grade)) {
      console.warn(`Invalid grade received: ${result.grade}, defaulting to Intermediate`);
      result.grade = 'Intermediate';
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
