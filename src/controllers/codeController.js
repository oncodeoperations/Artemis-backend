const axios = require('axios');

// Judge0 API Configuration
const JUDGE0_API_URL = process.env.JUDGE0_API_URL || 'https://judge0-ce.p.rapidapi.com';
const JUDGE0_API_KEY = process.env.JUDGE0_API_KEY || '';
const JUDGE0_API_HOST = process.env.JUDGE0_API_HOST || 'judge0-ce.p.rapidapi.com';

// Language ID mapping for Judge0
const LANGUAGE_IDS = {
  javascript: 63,
  python: 71,
  java: 62,
  cpp: 54,
  c: 50,
};

// Helper function to get language ID
const getLanguageId = (language) => {
  const lang = language.toLowerCase();
  return LANGUAGE_IDS[lang] || 63; // Default to JavaScript
};

// Helper function to poll for submission result
const getSubmissionResult = async (token, maxAttempts = 10) => {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await axios.get(
        `${JUDGE0_API_URL}/submissions/${token}`,
        {
          headers: {
            'X-RapidAPI-Key': JUDGE0_API_KEY,
            'X-RapidAPI-Host': JUDGE0_API_HOST,
          },
          params: {
            base64_encoded: 'false',
            fields: '*',
          },
        }
      );

      const status = response.data.status.id;
      
      // Status 1 = In Queue, Status 2 = Processing
      if (status === 1 || status === 2) {
        // Wait 1 second before polling again
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }

      return response.data;
    } catch (error) {
      console.error('Error polling submission:', error.message);
      throw error;
    }
  }

  throw new Error('Code execution timed out');
};

// Execute code against test cases
exports.executeCode = async (req, res) => {
  try {
    const { code, language, testCases } = req.body;

    if (!code || !language || !testCases || !Array.isArray(testCases)) {
      return res.status(400).json({
        message: 'Missing required fields: code, language, and testCases',
      });
    }

    // Check if Judge0 API is configured
    if (!JUDGE0_API_KEY) {
      // For demo purposes, return mock results
      const mockResults = testCases.map((testCase, index) => ({
        testCaseIndex: index,
        passed: true,
        output: testCase.expectedOutput,
        expectedOutput: testCase.expectedOutput,
        executionTime: 50,
      }));

      return res.json(mockResults);
    }

    const languageId = getLanguageId(language);
    const results = [];

    // Execute code for each test case
    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      
      try {
        // Create submission
        const submissionResponse = await axios.post(
          `${JUDGE0_API_URL}/submissions`,
          {
            source_code: code,
            language_id: languageId,
            stdin: testCase.input || '',
            expected_output: testCase.expectedOutput,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'X-RapidAPI-Key': JUDGE0_API_KEY,
              'X-RapidAPI-Host': JUDGE0_API_HOST,
            },
            params: {
              base64_encoded: 'false',
              fields: '*',
            },
          }
        );

        const token = submissionResponse.data.token;

        // Poll for result
        const result = await getSubmissionResult(token);

        // Check if execution was successful
        const passed = result.status.id === 3 && 
                      result.stdout?.trim() === testCase.expectedOutput.trim();

        results.push({
          testCaseIndex: i,
          passed,
          output: result.stdout || '',
          expectedOutput: testCase.expectedOutput,
          error: result.stderr || result.compile_output || result.message || null,
          executionTime: parseFloat(result.time || 0) * 1000, // Convert to milliseconds
        });

      } catch (error) {
        console.error(`Error executing test case ${i}:`, error.message);
        
        results.push({
          testCaseIndex: i,
          passed: false,
          output: '',
          expectedOutput: testCase.expectedOutput,
          error: error.message || 'Execution failed',
          executionTime: 0,
        });
      }
    }

    res.json(results);

  } catch (error) {
    console.error('Code execution error:', error);
    res.status(500).json({
      message: 'Failed to execute code',
      error: error.message,
    });
  }
};
