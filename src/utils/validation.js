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

/**
 * Validate app object from API response
 * @param {Object} app - App object to validate
 * @returns {{isValid: boolean, errors: string[]}}
 */
export function validateAppData(app) {
  const errors = [];

  if (!app || typeof app !== 'object') {
    return { isValid: false, errors: ['App data must be an object'] };
  }

  // Required fields
  if (!isNonEmptyString(app.id)) {
    errors.push('App must have a valid id');
  }

  if (!isNonEmptyString(app.repoUrl) && !isValidGitHubUrl(app.repoUrl)) {
    errors.push('App must have a valid GitHub repository URL');
  }

  // Optional but should be valid if present
  if (app.platform && !['Web', 'iOS', 'Android', 'Desktop', 'Cross-platform'].includes(app.platform)) {
    errors.push(`Invalid platform: ${app.platform}`);
  }

  if (app.status && !['Active', 'Archived', 'Deprecated'].includes(app.status)) {
    errors.push(`Invalid status: ${app.status}`);
  }

  if (app.lastCommitDate && isNaN(Date.parse(app.lastCommitDate))) {
    errors.push('Invalid lastCommitDate format');
  }

  if (app.nextReviewDate && isNaN(Date.parse(app.nextReviewDate))) {
    errors.push('Invalid nextReviewDate format');
  }

  if (app.todos && !Array.isArray(app.todos)) {
    errors.push('todos must be an array');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate portfolio array from API response
 * @param {Array} portfolio - Portfolio array to validate
 * @returns {{isValid: boolean, errors: string[], validApps: Array}}
 */
export function validatePortfolioData(portfolio) {
  const errors = [];
  const validApps = [];

  if (!Array.isArray(portfolio)) {
    return { isValid: false, errors: ['Portfolio data must be an array'], validApps: [] };
  }

  portfolio.forEach((app, index) => {
    const result = validateAppData(app);
    if (result.isValid) {
      validApps.push(app);
    } else {
      errors.push(`App at index ${index}: ${result.errors.join(', ')}`);
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    validApps // Return valid apps even if some are invalid
  };
}

/**
 * Validate tasks array from API response
 * @param {Array} tasks - Tasks array to validate
 * @returns {{isValid: boolean, errors: string[], validTasks: Array}}
 */
export function validateTasksData(tasks) {
  const errors = [];
  const validTasks = [];

  if (!Array.isArray(tasks)) {
    return { isValid: false, errors: ['Tasks data must be an array'], validTasks: [] };
  }

  tasks.forEach((task, index) => {
    if (isValidTodo(task)) {
      validTasks.push(task);
    } else {
      errors.push(`Task at index ${index} is invalid`);
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    validTasks
  };
}

/**
 * Validate ideas array from API response
 * @param {Array} ideas - Ideas array to validate
 * @returns {{isValid: boolean, errors: string[], validIdeas: Array}}
 */
export function validateIdeasData(ideas) {
  const errors = [];
  const validIdeas = [];

  if (!Array.isArray(ideas)) {
    return { isValid: false, errors: ['Ideas data must be an array'], validIdeas: [] };
  }

  ideas.forEach((idea, index) => {
    if (isValidIdea(idea)) {
      validIdeas.push(idea);
    } else {
      errors.push(`Idea at index ${index} is invalid`);
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
    validIdeas
  };
}

/**
 * Sanitize and validate app data, returning a clean version
 * @param {Object} app - Raw app data
 * @returns {Object} Sanitized app data with defaults
 */
export function sanitizeAppData(app) {
  if (!app || typeof app !== 'object') return null;

  return {
    id: String(app.id || '').toLowerCase().trim(),
    repoUrl: sanitizeGitHubUrl(app.repoUrl) || '',
    platform: app.platform || 'Web',
    status: app.status || 'Active',
    lastReviewDate: app.lastReviewDate || null,
    nextReviewDate: app.nextReviewDate || null,
    pendingTodos: typeof app.pendingTodos === 'number' ? app.pendingTodos : 0,
    notes: sanitizeString(app.notes || app.description || ''),
    description: sanitizeString(app.description || app.notes || ''),
    lastCommitDate: app.lastCommitDate || null,
    latestTag: app.latestTag || null,
    stars: typeof app.stars === 'number' ? app.stars : 0,
    language: app.language || null,
    isPrivate: Boolean(app.isPrivate),
    archived: Boolean(app.archived),
    todos: Array.isArray(app.todos) ? app.todos : [],
    improvements: Array.isArray(app.improvements) ? app.improvements : [],
    developerNotes: sanitizeString(app.developerNotes || '')
  };
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
  validationResult,
  validateAppData,
  validatePortfolioData,
  validateTasksData,
  validateIdeasData,
  sanitizeAppData
};
