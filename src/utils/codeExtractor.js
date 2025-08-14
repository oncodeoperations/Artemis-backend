/**
 * Utility for extracting and processing code snippets for analysis
 */
class CodeExtractor {
  /**
   * Extract relevant code snippets and metadata from repository files
   * @param {Array} files - Array of file objects with content
   * @param {Object} repo - Repository metadata
   * @returns {Object} Extracted code data
   */
  extractRelevantCode(files, repo) {
    const codeSnippets = [];
    const fileAnalysis = {
      totalFiles: files.length,
      languages: new Set(),
      frameworks: new Set(),
      patterns: new Set(),
      complexity: 0
    };

    for (const file of files) {
      try {
        const snippet = this.processFile(file);
        if (snippet) {
          codeSnippets.push(snippet);
          
          // Update analysis metadata
          fileAnalysis.languages.add(snippet.language);
          snippet.frameworks.forEach(fw => fileAnalysis.frameworks.add(fw));
          snippet.patterns.forEach(pattern => fileAnalysis.patterns.add(pattern));
          fileAnalysis.complexity += snippet.complexity;
        }
      } catch (error) {
        console.warn(`Failed to process file ${file.path}:`, error.message);
      }
    }

    return {
      repoName: repo.name,
      repoDescription: repo.description || '',
      repoLanguage: repo.language || 'Unknown',
      repoStars: repo.stargazers_count || 0,
      repoForks: repo.forks_count || 0,
      repoSize: repo.size || 0,
      lastUpdated: repo.updated_at,
      codeSnippets,
      analysis: {
        totalFiles: fileAnalysis.totalFiles,
        languages: Array.from(fileAnalysis.languages),
        frameworks: Array.from(fileAnalysis.frameworks),
        patterns: Array.from(fileAnalysis.patterns),
        avgComplexity: fileAnalysis.complexity / Math.max(codeSnippets.length, 1)
      }
    };
  }

  /**
   * Process a single file and extract meaningful information
   * @param {Object} file - File object with path and content
   * @returns {Object|null} Processed file data or null if not relevant
   */
  processFile(file) {
    if (!file.content || file.content.trim().length === 0) {
      return null;
    }

    const language = this.detectLanguage(file.path);
    const content = this.cleanContent(file.content);
    
    // Skip if content is too small to be meaningful
    if (content.length < 50) {
      return null;
    }

    return {
      path: file.path,
      language,
      size: file.size,
      lineCount: content.split('\n').length,
      content: this.extractKeyParts(content, language),
      frameworks: this.detectFrameworks(content, language),
      patterns: this.detectPatterns(content, language),
      complexity: this.calculateComplexity(content, language),
      codeQuality: this.assessCodeQuality(content, language)
    };
  }

  /**
   * Detect programming language from file path
   * @param {string} filePath - Path to the file
   * @returns {string} Detected language
   */
  detectLanguage(filePath) {
    const extension = filePath.split('.').pop().toLowerCase();
    
    const languageMap = {
      'js': 'JavaScript',
      'jsx': 'JavaScript (React)',
      'ts': 'TypeScript',
      'tsx': 'TypeScript (React)',
      'py': 'Python',
      'java': 'Java',
      'cpp': 'C++',
      'c': 'C',
      'cc': 'C++',
      'cxx': 'C++',
      'cs': 'C#',
      'go': 'Go',
      'rs': 'Rust',
      'php': 'PHP',
      'rb': 'Ruby',
      'swift': 'Swift',
      'kt': 'Kotlin',
      'dart': 'Dart',
      'scala': 'Scala',
      'clj': 'Clojure',
      'hs': 'Haskell',
      'elm': 'Elm',
      'vue': 'Vue.js',
      'svelte': 'Svelte'
    };

    return languageMap[extension] || 'Unknown';
  }

  /**
   * Clean and format code content
   * @param {string} content - Raw file content
   * @returns {string} Cleaned content
   */
  cleanContent(content) {
    return content
      .replace(/\r\n/g, '\n')  // Normalize line endings
      .replace(/\t/g, '  ')    // Convert tabs to spaces
      .trim();
  }

  /**
   * Extract key parts of code (functions, classes, important logic)
   * @param {string} content - File content
   * @param {string} language - Programming language
   * @returns {string} Key code snippets
   */
  extractKeyParts(content, language) {
    const lines = content.split('\n');
    const keyLines = [];
    let inFunction = false;
    let braceCount = 0;
    let currentFunction = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      // Skip comments and empty lines for space efficiency
      if (trimmedLine === '' || trimmedLine.startsWith('//') || trimmedLine.startsWith('#')) {
        continue;
      }

      // Detect function/class/method definitions
      if (this.isFunctionOrClassDefinition(trimmedLine, language)) {
        inFunction = true;
        currentFunction = [line];
        braceCount = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
      } else if (inFunction) {
        currentFunction.push(line);
        braceCount += (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
        
        if (braceCount <= 0) {
          // Function ended, add it to key lines
          keyLines.push(...currentFunction);
          keyLines.push(''); // Add separator
          inFunction = false;
          currentFunction = [];
          braceCount = 0;
        }
      } else if (this.isImportantLine(trimmedLine, language)) {
        // Include imports, exports, and other important declarations
        keyLines.push(line);
      }

      // Limit total lines to stay within token limits
      if (keyLines.length > 100) {
        break;
      }
    }

    return keyLines.join('\n');
  }

  /**
   * Check if a line contains a function or class definition
   * @param {string} line - Code line
   * @param {string} language - Programming language
   * @returns {boolean} True if line is a function/class definition
   */
  isFunctionOrClassDefinition(line, language) {
    const patterns = {
      'JavaScript': /^(function\s+\w+|const\s+\w+\s*=\s*\(|class\s+\w+|async\s+function)/,
      'TypeScript': /^(function\s+\w+|const\s+\w+\s*:\s*\(|class\s+\w+|interface\s+\w+|type\s+\w+|async\s+function)/,
      'Python': /^(def\s+\w+|class\s+\w+|async\s+def)/,
      'Java': /^(public|private|protected)?\s*(static\s+)?(void|int|String|\w+)\s+\w+\s*\(|^(public\s+)?class\s+\w+/,
      'C++': /^(int|void|bool|char|double|\w+)\s+\w+\s*\(|^class\s+\w+/,
      'C#': /^(public|private|protected)?\s*(static\s+)?(void|int|string|\w+)\s+\w+\s*\(|^(public\s+)?class\s+\w+/
    };

    const pattern = patterns[language] || patterns['JavaScript'];
    return pattern.test(line);
  }

  /**
   * Check if a line is important (imports, exports, etc.)
   * @param {string} line - Code line
   * @param {string} language - Programming language
   * @returns {boolean} True if line is important
   */
  isImportantLine(line, language) {
    const importPatterns = [
      /^import\s+/,
      /^export\s+/,
      /^from\s+.+\s+import/,
      /^require\s*\(/,
      /^module\.exports/,
      /^#include\s+/,
      /^using\s+/,
      /^package\s+/
    ];

    return importPatterns.some(pattern => pattern.test(line));
  }

  /**
   * Detect frameworks and libraries used
   * @param {string} content - File content
   * @param {string} language - Programming language
   * @returns {Array} Detected frameworks
   */
  detectFrameworks(content, language) {
    const frameworks = new Set();

    // JavaScript/TypeScript frameworks
    if (language.includes('JavaScript') || language.includes('TypeScript')) {
      const jsFrameworks = {
        'react': ['React', 'jsx', 'useState', 'useEffect', 'Component'],
        'vue': ['Vue', 'vue', '@vue'],
        'angular': ['Angular', '@angular', 'ngOnInit'],
        'express': ['express', 'app.get', 'app.post', 'req.', 'res.'],
        'node': ['require(', 'module.exports', 'process.env'],
        'next': ['Next', 'next/', 'getServerSideProps'],
        'svelte': ['Svelte', '.svelte'],
        'lodash': ['lodash', '_.' ],
        'axios': ['axios', '.get(', '.post('],
        'mongoose': ['mongoose', 'Schema', 'model(']
      };

      for (const [framework, keywords] of Object.entries(jsFrameworks)) {
        if (keywords.some(keyword => content.includes(keyword))) {
          frameworks.add(framework);
        }
      }
    }

    // Python frameworks
    if (language === 'Python') {
      const pythonFrameworks = {
        'django': ['django', 'Django', 'models.Model'],
        'flask': ['flask', 'Flask', '@app.route'],
        'fastapi': ['fastapi', 'FastAPI'],
        'pandas': ['pandas', 'pd.'],
        'numpy': ['numpy', 'np.'],
        'tensorflow': ['tensorflow', 'tf.'],
        'pytorch': ['torch', 'pytorch']
      };

      for (const [framework, keywords] of Object.entries(pythonFrameworks)) {
        if (keywords.some(keyword => content.includes(keyword))) {
          frameworks.add(framework);
        }
      }
    }

    return Array.from(frameworks);
  }

  /**
   * Detect coding patterns and practices
   * @param {string} content - File content
   * @param {string} language - Programming language
   * @returns {Array} Detected patterns
   */
  detectPatterns(content, language) {
    const patterns = new Set();

    // General patterns
    if (content.includes('try') && content.includes('catch')) {
      patterns.add('error-handling');
    }
    
    if (content.includes('test') || content.includes('describe') || content.includes('it(')) {
      patterns.add('testing');
    }

    if (content.includes('async') && content.includes('await')) {
      patterns.add('async-programming');
    }

    if (content.includes('class ') && content.includes('extends')) {
      patterns.add('inheritance');
    }

    if (content.includes('interface ') || content.includes('implements')) {
      patterns.add('interfaces');
    }

    // JavaScript/TypeScript specific
    if (language.includes('JavaScript') || language.includes('TypeScript')) {
      if (content.includes('.map(') || content.includes('.filter(') || content.includes('.reduce(')) {
        patterns.add('functional-programming');
      }
      
      if (content.includes('const ') && !content.includes('var ')) {
        patterns.add('modern-syntax');
      }

      if (content.includes('=>')) {
        patterns.add('arrow-functions');
      }
    }

    return Array.from(patterns);
  }

  /**
   * Calculate code complexity score
   * @param {string} content - File content
   * @param {string} language - Programming language
   * @returns {number} Complexity score (0-10)
   */
  calculateComplexity(content, language) {
    let score = 0;
    
    // Basic complexity indicators
    const conditions = (content.match(/if\s*\(|while\s*\(|for\s*\(|switch\s*\(/g) || []).length;
    const functions = (content.match(/function\s+\w+|def\s+\w+|\w+\s*=>\s*\{/g) || []).length;
    const classes = (content.match(/class\s+\w+/g) || []).length;
    const loops = (content.match(/for\s*\(|while\s*\(|\.map\(|\.forEach\(/g) || []).length;
    
    // Calculate base score
    score += Math.min(conditions * 0.5, 3);
    score += Math.min(functions * 0.3, 2);
    score += Math.min(classes * 0.4, 2);
    score += Math.min(loops * 0.3, 2);
    
    // Length bonus
    const lines = content.split('\n').length;
    if (lines > 100) score += 1;
    if (lines > 300) score += 1;
    
    return Math.min(Math.round(score), 10);
  }

  /**
   * Assess code quality indicators
   * @param {string} content - File content
   * @param {string} language - Programming language
   * @returns {Object} Code quality metrics
   */
  assessCodeQuality(content, language) {
    return {
      hasComments: content.includes('//') || content.includes('/*') || content.includes('#'),
      hasErrorHandling: content.includes('try') || content.includes('catch') || content.includes('except'),
      hasTests: content.includes('test') || content.includes('describe') || content.includes('assert'),
      usesModernSyntax: this.checkModernSyntax(content, language),
      hasTypeDefinitions: content.includes('interface') || content.includes('type ') || language.includes('TypeScript'),
      isWellStructured: this.checkStructure(content)
    };
  }

  /**
   * Check for modern syntax usage
   * @param {string} content - File content
   * @param {string} language - Programming language
   * @returns {boolean} True if modern syntax is used
   */
  checkModernSyntax(content, language) {
    if (language.includes('JavaScript') || language.includes('TypeScript')) {
      return content.includes('const ') || content.includes('let ') || content.includes('=>');
    }
    
    if (language === 'Python') {
      return content.includes('f"') || content.includes('with ') || content.includes('async def');
    }
    
    return true; // Default to true for other languages
  }

  /**
   * Check code structure quality
   * @param {string} content - File content
   * @returns {boolean} True if well structured
   */
  checkStructure(content) {
    const lines = content.split('\n');
    const nonEmptyLines = lines.filter(line => line.trim().length > 0);
    
    // Check for reasonable line length
    const longLines = nonEmptyLines.filter(line => line.length > 120);
    const longLineRatio = longLines.length / Math.max(nonEmptyLines.length, 1);
    
    // Check for proper indentation consistency
    const indentedLines = nonEmptyLines.filter(line => line.startsWith('  ') || line.startsWith('\t'));
    const hasConsistentIndentation = indentedLines.length > 0;
    
    return longLineRatio < 0.3 && hasConsistentIndentation;
  }
}

module.exports = new CodeExtractor();
