const axios = require('axios');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Judge0 Service
 * Handles code compilation and execution via the Judge0 CE API.
 * Supports self-hosted Docker instance.
 *
 * Judge0 Language IDs (most common):
 *  63 → JavaScript (Node.js 12.14.0)
 *  71 → Python (3.8.1)
 *  62 → Java (OpenJDK 13.0.1)
 *  54 → C++ (GCC 9.2.0)
 *  51 → C# (Mono 6.6.0.161)
 *  72 → Ruby (2.7.0)
 *  73 → Rust (1.40.0)
 *  60 → Go (1.13.5)
 *  78 → Kotlin (1.3.70)
 *  74 → TypeScript (3.7.4)
 */

// ─── Language Mapping ──────────────────────────────────────────
const LANGUAGE_MAP = {
  javascript: { id: 63, name: 'JavaScript (Node.js)', monacoId: 'javascript' },
  python:     { id: 71, name: 'Python 3',             monacoId: 'python' },
  java:       { id: 62, name: 'Java',                 monacoId: 'java' },
  cpp:        { id: 54, name: 'C++ (GCC)',             monacoId: 'cpp' },
  csharp:     { id: 51, name: 'C#',                    monacoId: 'csharp' },
  ruby:       { id: 72, name: 'Ruby',                  monacoId: 'ruby' },
  rust:       { id: 73, name: 'Rust',                  monacoId: 'rust' },
  go:         { id: 60, name: 'Go',                    monacoId: 'go' },
  kotlin:     { id: 78, name: 'Kotlin',                monacoId: 'kotlin' },
  typescript: { id: 74, name: 'TypeScript',            monacoId: 'typescript' },
};

// ─── Default Starter Code per Language ─────────────────────────
const STARTER_CODE = {
  javascript: `// Read input from stdin
const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin });
const lines = [];
rl.on('line', (line) => lines.push(line));
rl.on('close', () => {
  // Your code here
  
});`,
  python: `import sys

def solve():
    # Read input
    line = input()
    # Your code here
    
    print(result)

solve()`,
  java: `import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        // Your code here
        
    }
}`,
  cpp: `#include <iostream>
#include <string>
using namespace std;

int main() {
    // Your code here
    
    return 0;
}`,
  typescript: `// Read input from stdin
const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin });
const lines: string[] = [];
rl.on('line', (line: string) => lines.push(line));
rl.on('close', () => {
  // Your code here
  
});`,
  python3: `import sys

def solve():
    line = input()
    # Your code here
    
    print(result)

solve()`,
};

// ─── Judge0 API Client ────────────────────────────────────────
const judge0Client = axios.create({
  baseURL: config.judge0ApiUrl || 'http://localhost:2358',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    ...(config.judge0ApiKey ? { 'X-Auth-Token': config.judge0ApiKey } : {}),
  },
});

/**
 * Execute code against a single input.
 * @param {Object} params
 * @param {string} params.sourceCode  - The code to run
 * @param {number} params.languageId  - Judge0 language ID
 * @param {string} params.stdin       - Standard input
 * @param {number} params.timeLimit   - Time limit in seconds (default: 5)
 * @param {number} params.memoryLimit - Memory limit in KB (default: 256000 = 256MB)
 * @returns {Object} { stdout, stderr, compile_output, status, time, memory }
 */
async function executeCode({ sourceCode, languageId, stdin = '', timeLimit = 5, memoryLimit = 256000 }) {
  try {
    // Submit code for execution (synchronous wait)
    const { data } = await judge0Client.post('/submissions?base64_encoded=false&wait=true', {
      source_code: sourceCode,
      language_id: languageId,
      stdin: stdin,
      cpu_time_limit: timeLimit,
      memory_limit: memoryLimit,
    });

    return {
      stdout: (data.stdout || '').trim(),
      stderr: (data.stderr || '').trim(),
      compileOutput: (data.compile_output || '').trim(),
      status: data.status,       // { id, description } — e.g. { id: 3, description: "Accepted" }
      time: data.time ? parseFloat(data.time) * 1000 : null,  // convert to ms
      memory: data.memory,       // KB
      token: data.token,
    };
  } catch (error) {
    logger.error('Judge0 execution error', {
      error: error.message,
      languageId,
      code: error.code,
    });

    // If Judge0 is unreachable, return a graceful error
    if (error.code === 'ECONNREFUSED') {
      return {
        stdout: '',
        stderr: 'Code execution service is not available. Please try again later.',
        compileOutput: '',
        status: { id: 0, description: 'Service Unavailable' },
        time: null,
        memory: null,
        token: null,
      };
    }

    throw error;
  }
}

/**
 * Execute code against multiple test cases.
 * Returns an array of results — one per test case.
 */
async function executeAgainstTestCases({ sourceCode, languageId, testCases, timeLimit = 5, memoryLimit = 256000 }) {
  const results = [];

  for (const testCase of testCases) {
    const result = await executeCode({
      sourceCode,
      languageId,
      stdin: testCase.input,
      timeLimit,
      memoryLimit,
    });

    const expectedTrimmed = (testCase.expectedOutput || '').trim();
    const actualTrimmed = (result.stdout || '').trim();

    results.push({
      testCaseId: testCase._id,
      input: testCase.input,
      expectedOutput: testCase.expectedOutput,
      actualOutput: result.stdout,
      passed: result.status?.id === 3 && actualTrimmed === expectedTrimmed,
      isHidden: testCase.isHidden || false,
      executionTime: result.time,
      memoryUsed: result.memory,
      error: result.stderr || result.compileOutput || '',
      statusDescription: result.status?.description || 'Unknown',
    });
  }

  return results;
}

/**
 * Run code with custom stdin (for "Run Code" without grading).
 */
async function runCode({ sourceCode, languageId, stdin = '' }) {
  return executeCode({ sourceCode, languageId, stdin });
}

/**
 * Grade a submission: run against all test cases and return a score.
 */
async function gradeSubmission({ sourceCode, languageId, testCases, timeLimit = 5 }) {
  const results = await executeAgainstTestCases({
    sourceCode,
    languageId,
    testCases,
    timeLimit,
  });

  const passedCount = results.filter(r => r.passed).length;
  const totalCount = results.length;
  const score = totalCount > 0 ? Math.round((passedCount / totalCount) * 100) : 0;

  // Determine overall status
  let statusDescription = 'Accepted';
  if (passedCount === 0) {
    const hasCompileError = results.some(r => r.error && r.statusDescription === 'Compilation Error');
    const hasRuntimeError = results.some(r => r.statusDescription === 'Runtime Error (NZEC)');
    const hasTLE = results.some(r => r.statusDescription === 'Time Limit Exceeded');

    if (hasCompileError) statusDescription = 'Compilation Error';
    else if (hasRuntimeError) statusDescription = 'Runtime Error';
    else if (hasTLE) statusDescription = 'Time Limit Exceeded';
    else statusDescription = 'Wrong Answer';
  } else if (passedCount < totalCount) {
    statusDescription = 'Partially Accepted';
  }

  return {
    results,
    passedCount,
    totalCount,
    score,
    statusDescription,
  };
}

/**
 * Check if Judge0 service is available.
 */
async function healthCheck() {
  try {
    const { data } = await judge0Client.get('/about');
    return { healthy: true, version: data.version, languages: data.source_code?.length };
  } catch (error) {
    return { healthy: false, error: error.message };
  }
}

/**
 * Get list of supported languages from Judge0.
 */
async function getLanguages() {
  try {
    const { data } = await judge0Client.get('/languages');
    return data;
  } catch (error) {
    logger.error('Failed to fetch Judge0 languages', { error: error.message });
    // Return our hardcoded map as fallback
    return Object.entries(LANGUAGE_MAP).map(([key, val]) => ({
      id: val.id,
      name: val.name,
    }));
  }
}

/**
 * Get language info by key.
 */
function getLanguageInfo(languageKey) {
  return LANGUAGE_MAP[languageKey] || null;
}

/**
 * Get starter code for a language.
 */
function getStarterCode(languageKey) {
  return STARTER_CODE[languageKey] || `// Write your ${languageKey} code here\n`;
}

/**
 * Get all supported language keys.
 */
function getSupportedLanguages() {
  return Object.entries(LANGUAGE_MAP).map(([key, val]) => ({
    key,
    id: val.id,
    name: val.name,
    monacoId: val.monacoId,
  }));
}

module.exports = {
  executeCode,
  executeAgainstTestCases,
  runCode,
  gradeSubmission,
  healthCheck,
  getLanguages,
  getLanguageInfo,
  getStarterCode,
  getSupportedLanguages,
  LANGUAGE_MAP,
  STARTER_CODE,
};
