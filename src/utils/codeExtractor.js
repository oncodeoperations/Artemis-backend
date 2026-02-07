const logger = require('./logger');

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
        logger.warn('Failed to process file from repository', { file: file.path, error: error.message });
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

  /**
   * Check if a file path is a source code file (not config, not test, not docs)
   * @param {string} filePath - File path
   * @returns {boolean}
   */
  isSourceCodeFile(filePath) {
    const codeExtensions = [
      '.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.cpp', '.c', '.cc', '.cxx',
      '.cs', '.go', '.rs', '.php', '.rb', '.swift', '.kt', '.dart', '.scala',
      '.clj', '.hs', '.elm', '.vue', '.svelte'
    ];
    const lower = filePath.toLowerCase();
    // Must have a code extension
    if (!codeExtensions.some(ext => lower.endsWith(ext))) return false;
    // Exclude configs, tests, generated
    const excludes = ['node_modules', 'dist/', 'build/', 'coverage/', '.git/', 'vendor/', '__pycache__'];
    if (excludes.some(p => lower.includes(p))) return false;
    return true;
  }

  /**
   * Check if a file path is a test file
   * @param {string} filePath - File path
   * @returns {boolean}
   */
  isTestFile(filePath) {
    const lower = filePath.toLowerCase();
    return lower.includes('test') || lower.includes('spec') || lower.includes('__tests__');
  }

  /**
   * Score README quality on a 0-5 scale based on content sections
   * @param {string} content - README content
   * @returns {number} Quality score 0-5
   */
  scoreReadmeQuality(content) {
    if (!content || content.length < 30) return 0;
    let score = 0;
    // Has a title (# heading)
    if (/^#\s+/m.test(content)) score += 1;
    // Has description (>100 chars of non-heading text)
    const nonHeading = content.replace(/^#+.*$/gm, '').trim();
    if (nonHeading.length > 100) score += 1;
    // Has installation or setup section
    if (/install|setup|getting started|quick start/i.test(content)) score += 1;
    // Has usage or example section
    if (/usage|example|how to|demo|api/i.test(content)) score += 1;
    // Has badges, screenshots, or links (polish signal)
    if (/\!\[|\[!\[|https?:\/\/.*\.(png|jpg|gif|svg)/i.test(content) || content.includes('badge')) score += 1;
    return score;
  }

  /**
   * Perform comprehensive repository analysis for scoring
   * Returns ratio-based metrics instead of booleans for gradient scoring.
   * @param {Array} files - Repository files
   * @param {Object} repo - Repository metadata
   * @returns {Object} Detailed analysis with ratio-based metrics for scoring
   */
  analyzeRepositoryForScoring(files, repo) {
    const analysis = {
      name: repo.name,
      description: repo.description,

      // ── Ratio-based code metrics (0.0 – 1.0) ──
      testFileRatio: 0,
      testFileCount: 0,
      sourceFileCount: 0,
      totalFileCount: files.length,
      errorHandlingDensity: 0,   // fraction of source files with try/catch/except
      modernSyntaxRatio: 0,      // fraction using const/let/arrow/async
      typeSafetyRatio: 0,        // fraction with TS or type annotations
      documentationDensity: 0,   // fraction with JSDoc/docstrings
      commentDensity: 0,         // fraction with any comments
      avgFileSize: 0,            // average lines per source file

      // ── Structure metrics ──
      uniqueFolderCount: 0,
      maxFolderDepth: 0,
      hasEntryPoint: false,      // src/ or lib/ or app/ or index file
      hasConfig: false,          // package.json, requirements.txt, etc.
      hasBuildScript: false,     // scripts.build in package.json or Makefile

      // ── README quality (0-5 gradient) ──
      readmeQuality: 0,
      readmeLength: 0,

      // ── CI/CD maturity (0-3 gradient) ──
      cicdMaturity: 0,           // 0=none, 1=basic workflow, 2=multi-step, 3=matrix/advanced
      cicdFiles: [],

      // ── Config & community signals ──
      hasLockfile: false,
      hasLintConfig: false,
      hasEnvConfig: false,
      hasGitignore: false,
      hasLicense: false,
      hasContributing: false,
      hasChangelog: false,

      // ── Complexity metrics ──
      avgComplexity: 0,          // average complexity score across source files

      // ── Additional data ──
      frameworks: [],
      patterns: [],
      languages: [],

      // ── Legacy compat (derived booleans for any old consumers) ──
      hasTests: false,
      hasCICD: false,
      hasDocumentation: false,
      hasGoodREADME: false,
      isComplete: false,
      hasGoodStructure: false,
      isWellStructured: false,
      hasConsistentStyle: false,
      hasCodeSmells: false,
      hasMVCPattern: false,
      hasModularStructure: false,
      hasSeparationOfConcerns: false,
      hasReusableComponents: false,
      hasServicesLayer: false,
      meaningfulCommitsRatio: 0
    };

    let filesWithErrorHandling = 0;
    let filesWithModernSyntax = 0;
    let filesWithTypeAnnotations = 0;
    let filesWithDocs = 0;
    let filesWithComments = 0;
    let totalSourceFiles = 0;
    let totalLines = 0;
    let testFiles = 0;
    let complexitySum = 0;
    let complexityCount = 0;

    const uniqueFolders = new Set();

    for (const file of files) {
      const filePath = file.path || '';
      const lower = filePath.toLowerCase();
      const content = file.content || '';

      // ── Track folder structure ──
      const parts = filePath.split('/');
      if (parts.length > 1) {
        uniqueFolders.add(parts[0]);
        analysis.maxFolderDepth = Math.max(analysis.maxFolderDepth, parts.length - 1);
      }

      // ── Detect test files ──
      if (this.isTestFile(filePath)) {
        testFiles++;
      }

      // ── CI/CD maturity (gradient) ──
      if (lower.includes('.github/workflows') || lower.includes('.gitlab-ci') ||
          lower.includes('circle') || lower.includes('travis') || lower.includes('jenkinsfile') ||
          lower.includes('dockerfile') || lower.includes('docker-compose')) {
        analysis.cicdFiles.push(filePath);
        // Detect maturity level from workflow content
        if (content.includes('matrix') || content.includes('strategy') || content.includes('stages')) {
          analysis.cicdMaturity = Math.max(analysis.cicdMaturity, 3);
        } else if (content.includes('jobs') || content.includes('steps') || content.includes('stage')) {
          analysis.cicdMaturity = Math.max(analysis.cicdMaturity, 2);
        } else {
          analysis.cicdMaturity = Math.max(analysis.cicdMaturity, 1);
        }
      }

      // ── README quality (gradient 0-5) ──
      if (lower === 'readme.md' || lower === 'readme' || lower === 'readme.rst') {
        analysis.readmeLength = content.length;
        analysis.readmeQuality = this.scoreReadmeQuality(content);
      }

      // ── Config & community file detection ──
      if (lower.includes('package-lock.json') || lower.includes('yarn.lock') ||
          lower.includes('pnpm-lock') || lower.includes('bun.lockb') ||
          lower.includes('gemfile.lock') || lower.includes('poetry.lock')) {
        analysis.hasLockfile = true;
      }
      if (lower.includes('.eslint') || lower.includes('.prettier') ||
          lower.includes('biome.json') || lower.includes('.flake8') ||
          lower.includes('pylint') || lower.includes('.rubocop')) {
        analysis.hasLintConfig = true;
      }
      if (lower.includes('.env.example') || lower.includes('.env.sample') ||
          lower.includes('config/') || lower.includes('.env.template')) {
        analysis.hasEnvConfig = true;
      }
      if (lower === '.gitignore') analysis.hasGitignore = true;
      if (lower === 'license' || lower === 'license.md' || lower === 'licence') analysis.hasLicense = true;
      if (lower.includes('contributing')) analysis.hasContributing = true;
      if (lower.includes('changelog') || lower.includes('history')) analysis.hasChangelog = true;

      // ── Entry point & config detection ──
      if (lower.includes('src/') || lower.includes('lib/') || lower.includes('app/') ||
          lower === 'index.js' || lower === 'index.ts' || lower === 'main.py') {
        analysis.hasEntryPoint = true;
      }
      if (lower === 'package.json' || lower === 'requirements.txt' || lower === 'pyproject.toml' ||
          lower === 'pom.xml' || lower === 'build.gradle' || lower === 'cargo.toml' ||
          lower === 'go.mod' || lower === 'gemfile') {
        analysis.hasConfig = true;
        // Check for build script in package.json
        if (lower === 'package.json' && (content.includes('"build"') || content.includes('"start"'))) {
          analysis.hasBuildScript = true;
        }
      }

      // ── Source code quality analysis (only real source files) ──
      if (this.isSourceCodeFile(filePath) && !this.isTestFile(filePath)) {
        totalSourceFiles++;
        const lineCount = content.split('\n').length;
        totalLines += lineCount;

        // Error handling density
        const errorPatterns = /try\s*[\{\(]|\.catch\s*\(|except\s|rescue\s|throw\s+new|raise\s|Error\(/;
        if (errorPatterns.test(content)) filesWithErrorHandling++;

        // Modern syntax (JS/TS/Python)
        const modernPatterns = /\bconst\s|\blet\s|=>\s*[\{\(]|\basync\s|\bawait\s|\bimport\s.*\bfrom\b|\bexport\s|\.\.\.[\w\[]|`\$\{|f["']/;
        if (modernPatterns.test(content)) filesWithModernSyntax++;

        // Type safety (TypeScript, typed hints, Go/Rust/Java are inherently typed)
        if (lower.endsWith('.ts') || lower.endsWith('.tsx') || lower.endsWith('.go') ||
            lower.endsWith('.rs') || lower.endsWith('.java') || lower.endsWith('.cs') ||
            lower.endsWith('.kt') || lower.endsWith('.swift') || lower.endsWith('.dart') ||
            content.includes(': string') || content.includes(': number') || content.includes(': boolean') ||
            content.includes('interface ') || content.includes('type ') || /def\s+\w+\(.*:/.test(content)) {
          filesWithTypeAnnotations++;
        }

        // Documentation (JSDoc, docstrings, etc.)
        if (content.includes('/**') || content.includes('"""') || content.includes("'''") ||
            content.includes('/// ') || content.includes('//! ')) {
          filesWithDocs++;
        }

        // Comments (any kind)
        if (content.includes('//') || content.includes('/*') || /^#[^!]/m.test(content)) {
          filesWithComments++;
        }

        // Complexity
        const snippet = this.processFile(file);
        if (snippet) {
          complexitySum += snippet.complexity;
          complexityCount++;
          analysis.frameworks.push(...snippet.frameworks);
          analysis.patterns.push(...snippet.patterns);
          if (!analysis.languages.includes(snippet.language)) {
            analysis.languages.push(snippet.language);
          }
        }
      }
    }

    // ── Calculate ratios ──
    analysis.testFileCount = testFiles;
    analysis.sourceFileCount = totalSourceFiles;
    analysis.testFileRatio = files.length > 0 ? testFiles / files.length : 0;
    analysis.errorHandlingDensity = totalSourceFiles > 0 ? filesWithErrorHandling / totalSourceFiles : 0;
    analysis.modernSyntaxRatio = totalSourceFiles > 0 ? filesWithModernSyntax / totalSourceFiles : 0;
    analysis.typeSafetyRatio = totalSourceFiles > 0 ? filesWithTypeAnnotations / totalSourceFiles : 0;
    analysis.documentationDensity = totalSourceFiles > 0 ? filesWithDocs / totalSourceFiles : 0;
    analysis.commentDensity = totalSourceFiles > 0 ? filesWithComments / totalSourceFiles : 0;
    analysis.avgFileSize = totalSourceFiles > 0 ? totalLines / totalSourceFiles : 0;
    analysis.uniqueFolderCount = uniqueFolders.size;
    analysis.avgComplexity = complexityCount > 0 ? complexitySum / complexityCount : 0;

    // ── Derive legacy booleans for backward compatibility ──
    analysis.hasTests = testFiles > 0;
    analysis.hasCICD = analysis.cicdMaturity > 0;
    analysis.hasDocumentation = analysis.documentationDensity > 0.1 || analysis.readmeLength > 100;
    analysis.hasGoodREADME = analysis.readmeQuality >= 3;
    analysis.hasGoodStructure = uniqueFolders.size >= 3;
    analysis.isWellStructured = uniqueFolders.size >= 3;
    analysis.isComplete = analysis.hasEntryPoint && analysis.hasConfig && files.length > 5;
    analysis.hasConsistentStyle = analysis.modernSyntaxRatio > 0.5 && analysis.commentDensity > 0.3;
    analysis.hasCodeSmells = files.filter(f => f.size > 100000).length > (files.length * 0.3);
    analysis.hasMVCPattern = files.some(f => {
      const p = f.path.toLowerCase();
      return (p.includes('/models/') || p.includes('/views/') || p.includes('/controllers/'));
    });
    analysis.hasModularStructure = files.some(f => {
      const p = f.path.toLowerCase();
      return p.includes('/components/') || p.includes('/modules/');
    });
    analysis.hasSeparationOfConcerns = files.some(f => {
      const p = f.path.toLowerCase();
      return p.includes('/services/') || p.includes('/utils/') || p.includes('/helpers/');
    });
    analysis.hasReusableComponents = files.some(f => {
      const p = f.path.toLowerCase();
      return p.includes('/components/') || p.includes('/shared/') || p.includes('/common/');
    });
    analysis.hasServicesLayer = files.some(f => f.path.toLowerCase().includes('/services/'));

    // ── Unique frameworks and patterns ──
    analysis.frameworks = [...new Set(analysis.frameworks)];
    analysis.patterns = [...new Set(analysis.patterns)];

    return analysis;
  }
}

module.exports = new CodeExtractor();
