/**
 * Validation utilities for input validation and data sanitization
 * Provides consistent validation patterns across the application
 */

/**
 * Validate GitHub repository URL
 * @param {string} url - URL to validate
 * @returns {boolean} True if valid GitHub URL
 */
export function isValidGitHubUrl(url) {
  if (!url || typeof url !== 'string') return false;

  const githubPattern = /^https?:\/\/github\.com\/[a-zA-Z0-9-_.]+\/[a-zA-Z0-9-_.]+\/?$/;
  return githubPattern.test(url);
}

/**
 * Validate email address
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid email
 */
export function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate URL
 * @param {string} url - URL to validate
 * @returns {boolean} True if valid URL
 */
export function isValidUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate ISO date string
 * @param {string} dateString - Date string to validate
 * @returns {boolean} True if valid ISO date
 */
export function isValidISODate(dateString) {
  if (!dateString || typeof dateString !== 'string') return false;
  const isoDateRegex = /^(\d{4})-(\d{2})-(\d{2})$/;
  const match = dateString.match(isoDateRegex);
  if (!match) return false;

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);

  // Create a date in UTC to avoid timezone issues
  const date = new Date(Date.UTC(year, month - 1, day));

  // Check if the constructed date matches the input parts
  return date.getUTCFullYear() === year &&
         date.getUTCMonth() === month - 1 &&
         date.getUTCDate() === day;
}

/**
 * Validate non-empty string
 * @param {string} str - String to validate
 * @param {number} [minLength=1] - Minimum length
 * @param {number} [maxLength=Infinity] - Maximum length
 * @returns {boolean} True if valid non-empty string
 */
export function isNonEmptyString(str, minLength = 1, maxLength = Infinity) {
  if (!str || typeof str !== 'string') return false;
  const trimmed = str.trim();
  return trimmed.length >= minLength && trimmed.length <= maxLength;
}

/**
 * Validate number in range
 * @param {number} num - Number to validate
 * @param {number} [min=-Infinity] - Minimum value
 * @param {number} [max=Infinity] - Maximum value
 * @returns {boolean} True if valid number in range
 */
export function isNumberInRange(num, min = -Infinity, max = Infinity) {
  if (typeof num !== 'number' || isNaN(num)) return false;
  return num >= min && num <= max;
}

/**
 * Validate array with minimum length
 * @param {Array} arr - Array to validate
 * @param {number} [minLength=0] - Minimum length
 * @returns {boolean} True if valid array
 */
export function isValidArray(arr, minLength = 0) {
  return Array.isArray(arr) && arr.length >= minLength;
}

/**
 * Validate object with required keys
 * @param {Object} obj - Object to validate
 * @param {string[]} requiredKeys - Required keys
 * @returns {boolean} True if object has all required keys
 */
export function hasRequiredKeys(obj, requiredKeys) {
  if (!obj || typeof obj !== 'object') return false;
  return requiredKeys.every(key => key in obj);
}

/**
 * Sanitize string by removing HTML tags
 * @param {string} str - String to sanitize
 * @returns {string} Sanitized string
 */
export function sanitizeString(str) {
  if (!str || typeof str !== 'string') return '';
  const temp = document.createElement('div');
  temp.innerHTML = str;
  return (temp.textContent || temp.innerText || '').trim();
}

/**
 * Sanitize GitHub URL
 * @param {string} url - URL to sanitize
 * @returns {string|null} Sanitized URL or null if invalid
 */
export function sanitizeGitHubUrl(url) {
  if (!isValidGitHubUrl(url)) return null;

  // Ensure https
  let sanitized = url.trim();
  if (sanitized.startsWith('http://')) {
    sanitized = sanitized.replace('http://', 'https://');
  }

  // Remove trailing slash
  if (sanitized.endsWith('/')) {
    sanitized = sanitized.slice(0, -1);
  }

  return sanitized;
}

/**
 * Validate app ID format
 * @param {string} id - App ID to validate
 * @returns {boolean} True if valid app ID
 */
export function isValidAppId(id) {
  if (!id || typeof id !== 'string') return false;
  // App IDs should be lowercase alphanumeric with hyphens
  const idRegex = /^[a-z0-9-]+$/;
  return idRegex.test(id) && id.length > 0 && id.length <= 100;
}

/**
 * Validate todo object
 * @param {Object} todo - Todo object to validate
 * @returns {boolean} True if valid todo
 */
export function isValidTodo(todo) {
  if (!todo || typeof todo !== 'object') return false;

  const hasRequiredFields = hasRequiredKeys(todo, ['id', 'title']);
  if (!hasRequiredFields) return false;

  // Validate types
  if (!isNonEmptyString(todo.id)) return false;
  if (!isNonEmptyString(todo.title)) return false;

  // Validate optional fields if present
  if (todo.priority && !['low', 'medium', 'high'].includes(todo.priority)) return false;
  if (todo.dueDate && !isValidISODate(todo.dueDate)) return false;
  if (todo.completed !== undefined && typeof todo.completed !== 'boolean') return false;

  return true;
}

/**
 * Validate idea object
 * @param {Object} idea - Idea object to validate
 * @returns {boolean} True if valid idea
 */
export function isValidIdea(idea) {
  if (!idea || typeof idea !== 'object') return false;

  const hasRequiredFields = hasRequiredKeys(idea, ['id', 'conceptName']);
  if (!hasRequiredFields) return false;

  // Validate types
  if (!isNonEmptyString(idea.id)) return false;
  if (!isNonEmptyString(idea.conceptName)) return false;

  // Validate optional fields if present
  if (idea.riskRating && !['Low', 'Medium', 'High'].includes(idea.riskRating)) return false;

  return true;
}

/**
 * Create validation result object
 * @param {boolean} isValid - Whether validation passed
 * @param {string} [error] - Error message if validation failed
 * @returns {{isValid: boolean, error?: string}}
 */
export function validationResult(isValid, error) {
  return isValid ? { isValid: true } : { isValid: false, error };
}

export default {
  isValidGitHubUrl,
  isValidEmail,
  isValidUrl,
  isValidISODate,
  isNonEmptyString,
  isNumberInRange,
  isValidArray,
  hasRequiredKeys,
  sanitizeString,
  sanitizeGitHubUrl,
  isValidAppId,
  isValidTodo,
  isValidIdea,
  validationResult
};
