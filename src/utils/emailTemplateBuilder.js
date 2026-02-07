const fs = require('fs');
const path = require('path');
const logger = require('./logger');

/**
 * Email Template Builder
 * Reads HTML templates from disk, injects data into the base layout,
 * and replaces all {{variable}} placeholders.
 *
 * Supports simple Mustache-like conditionals:
 *   {{#variable}} ... {{/variable}}   — render block if variable is truthy
 *   {{^variable}} ... {{/variable}}   — render block if variable is falsy
 */

const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');

// In-memory cache for templates (loaded once per process)
const templateCache = new Map();

/**
 * Load a template file from disk (with caching)
 * @param {string} name - Template filename without extension
 * @returns {string} Raw HTML string
 */
function loadTemplate(name) {
  if (templateCache.has(name)) {
    return templateCache.get(name);
  }

  const filePath = path.join(TEMPLATES_DIR, `${name}.html`);

  if (!fs.existsSync(filePath)) {
    logger.error(`Email template not found: ${filePath}`);
    throw new Error(`Email template "${name}" not found`);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  templateCache.set(name, content);
  return content;
}

/**
 * Process conditional blocks in a template
 *
 * Truthy blocks: {{#key}} content {{/key}}
 *   - Rendered if data[key] is truthy and non-empty
 *
 * Falsy blocks:  {{^key}} content {{/key}}
 *   - Rendered if data[key] is falsy or missing
 *
 * @param {string} html - Template HTML
 * @param {Object} data - Template data
 * @returns {string} Processed HTML
 */
function processConditionals(html, data) {
  // Truthy sections: {{#key}} ... {{/key}}
  html = html.replace(
    /\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g,
    (_, key, content) => {
      const value = data[key];
      if (value && value !== '' && value !== false && value !== null && value !== undefined) {
        return content;
      }
      return '';
    }
  );

  // Falsy sections: {{^key}} ... {{/key}}
  html = html.replace(
    /\{\{\^(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g,
    (_, key, content) => {
      const value = data[key];
      if (!value || value === '' || value === false || value === null || value === undefined) {
        return content;
      }
      return '';
    }
  );

  return html;
}

/**
 * Replace all {{variable}} placeholders with data values
 * Unmatched placeholders are replaced with empty string
 *
 * @param {string} html - Template HTML
 * @param {Object} data - Key-value pairs
 * @returns {string} Final HTML
 */
function replacePlaceholders(html, data) {
  return html.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    if (data.hasOwnProperty(key)) {
      const value = data[key];
      // Escape HTML entities in user-provided values to prevent XSS
      if (typeof value === 'string') {
        return escapeHtml(value);
      }
      return value != null ? String(value) : '';
    }
    return '';
  });
}

/**
 * Escape HTML special characters
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  const entities = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return str.replace(/[&<>"']/g, (char) => entities[char]);
}

/**
 * Build a complete email from a named template + data
 *
 * 1. Loads the specific template (e.g. contractInvitation.html)
 * 2. Processes conditionals in the template content
 * 3. Replaces placeholders in the template content
 * 4. Loads the base layout (baseLayout.html)
 * 5. Injects the processed content into {{content}}
 * 6. Replaces remaining global placeholders (year, frontendUrl)
 *
 * @param {string} templateName - Name of the template (without .html)
 * @param {Object} data - Data to inject into the template
 * @returns {string} Complete HTML email ready to send
 */
function buildEmailTemplate(templateName, data = {}) {
  try {
    // 1. Load the specific template
    const templateContent = loadTemplate(templateName);

    // 2. Process conditionals in template content
    let processedContent = processConditionals(templateContent, data);

    // 3. Replace placeholders in content
    processedContent = replacePlaceholders(processedContent, data);

    // 4. Load base layout
    const baseLayout = loadTemplate('baseLayout');

    // 5. Inject content into base layout
    let finalHtml = baseLayout.replace('{{content}}', processedContent);

    // 6. Replace global placeholders
    const globalData = {
      year: new Date().getFullYear(),
      frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
      ...data,
    };
    finalHtml = replacePlaceholders(finalHtml, globalData);

    return finalHtml;
  } catch (error) {
    logger.error(`Failed to build email template "${templateName}":`, error);

    // Fallback: return a minimal plain HTML email
    return `
      <html>
        <body style="font-family: sans-serif; padding: 40px; color: #333;">
          <h2>Escon Notification</h2>
          <p>You have a new notification regarding <strong>${escapeHtml(data.contractName || 'your contract')}</strong>.</p>
          ${data.actionUrl ? `<p><a href="${escapeHtml(data.actionUrl)}">View details</a></p>` : ''}
        </body>
      </html>
    `;
  }
}

/**
 * Clear template cache (useful for development hot-reload)
 */
function clearTemplateCache() {
  templateCache.clear();
  logger.info('Email template cache cleared');
}

module.exports = {
  buildEmailTemplate,
  clearTemplateCache,
};
