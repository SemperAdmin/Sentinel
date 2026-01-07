/**
 * Error handling utilities for Sentinel
 * Provides error boundaries, recovery mechanisms, and centralized error logging
 */

/**
 * Error types for categorization
 */
export const ErrorType = {
  NETWORK: 'network',
  API: 'api',
  DATA: 'data',
  STORAGE: 'storage',
  RENDER: 'render',
  UNKNOWN: 'unknown'
};

/**
 * Error severity levels
 */
export const ErrorSeverity = {
  LOW: 'low',        // Informational, doesn't affect functionality
  MEDIUM: 'medium',  // Affects some functionality, has workaround
  HIGH: 'high',      // Affects major functionality
  CRITICAL: 'critical' // App is unusable
};

/**
 * Error context for tracking
 */
class ErrorContext {
  constructor(type, severity, message, originalError = null) {
    this.type = type;
    this.severity = severity;
    this.message = message;
    this.originalError = originalError;
    this.timestamp = new Date().toISOString();
    this.userAgent = navigator.userAgent;
    this.url = window.location.href;
  }

  toString() {
    return `[${this.severity.toUpperCase()}] ${this.type}: ${this.message}`;
  }

  toJSON() {
    return {
      type: this.type,
      severity: this.severity,
      message: this.message,
      stack: this.originalError?.stack,
      timestamp: this.timestamp,
      userAgent: this.userAgent,
      url: this.url
    };
  }
}

/**
 * Error handler class
 */
class ErrorHandler {
  constructor() {
    this.errors = [];
    this.maxErrors = 50; // Keep last 50 errors
    this.listeners = [];
  }

  /**
   * Log an error
   */
  logError(type, severity, message, originalError = null) {
    const errorContext = new ErrorContext(type, severity, message, originalError);

    // Add to error log
    this.errors.push(errorContext);

    // Trim old errors
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(-this.maxErrors);
    }

    // Log to console
    const consoleMethod = severity === ErrorSeverity.CRITICAL ? 'error' :
                         severity === ErrorSeverity.HIGH ? 'error' :
                         severity === ErrorSeverity.MEDIUM ? 'warn' : 'log';
    console[consoleMethod](errorContext.toString(), originalError);

    // Notify listeners
    this.notifyListeners(errorContext);

    return errorContext;
  }

  /**
   * Subscribe to error events
   */
  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  /**
   * Notify all listeners
   */
  notifyListeners(errorContext) {
    this.listeners.forEach(callback => {
      try {
        callback(errorContext);
      } catch (err) {
        console.error('Error in error listener:', err);
      }
    });
  }

  /**
   * Get recent errors
   */
  getRecentErrors(count = 10) {
    return this.errors.slice(-count);
  }

  /**
   * Get errors by type
   */
  getErrorsByType(type) {
    return this.errors.filter(e => e.type === type);
  }

  /**
   * Get errors by severity
   */
  getErrorsBySeverity(severity) {
    return this.errors.filter(e => e.severity === severity);
  }

  /**
   * Clear all errors
   */
  clearErrors() {
    this.errors = [];
  }

  /**
   * Export errors as JSON
   */
  exportErrors() {
    return JSON.stringify(this.errors.map(e => e.toJSON()), null, 2);
  }
}

// Create singleton instance
const errorHandler = new ErrorHandler();

/**
 * Wrap an async function with error handling
 */
export function withErrorHandler(fn, errorType = ErrorType.UNKNOWN) {
  return async function(...args) {
    try {
      return await fn(...args);
    } catch (error) {
      const severity = determineErrorSeverity(error);
      errorHandler.logError(errorType, severity, error.message, error);
      throw error; // Re-throw to allow caller to handle
    }
  };
}

/**
 * Wrap a component render function with error boundary
 */
export function withErrorBoundary(renderFn, fallbackFn) {
  return function(...args) {
    try {
      return renderFn(...args);
    } catch (error) {
      errorHandler.logError(ErrorType.RENDER, ErrorSeverity.MEDIUM, error.message, error);
      if (fallbackFn) {
        return fallbackFn(error);
      }
      return createErrorUI(error);
    }
  };
}

/**
 * User-friendly error messages mapping
 */
const USER_FRIENDLY_MESSAGES = {
  // Network errors
  'failed to fetch': 'Unable to connect to the server. Please check your internet connection.',
  'network error': 'Network connection lost. Please try again when you\'re back online.',
  'timeout': 'The request took too long. Please try again.',
  'cors': 'Access denied by the server. Please contact support if this persists.',

  // API errors
  '401': 'Your session has expired. Please log in again.',
  '403': 'You don\'t have permission to perform this action.',
  '404': 'The requested data could not be found.',
  '409': 'This data was modified by someone else. Please refresh and try again.',
  '429': 'Too many requests. Please wait a moment and try again.',
  '500': 'The server encountered an error. Please try again later.',
  '502': 'The server is temporarily unavailable. Please try again later.',
  '503': 'The service is currently undergoing maintenance. Please try again later.',

  // Storage errors
  'quota': 'Storage space is full. Please clear some cached data.',
  'indexeddb': 'Unable to save data locally. Please check your browser settings.',

  // Data errors
  'invalid json': 'The data received was corrupted. Please refresh and try again.',
  'parse error': 'Unable to process the data. Please refresh and try again.'
};

/**
 * Get user-friendly message for an error
 */
export function getUserFriendlyMessage(error) {
  if (!error) return 'An unexpected error occurred.';

  const message = error.message?.toLowerCase() || '';
  const status = error.status?.toString() || '';

  // Check for status code matches first
  if (USER_FRIENDLY_MESSAGES[status]) {
    return USER_FRIENDLY_MESSAGES[status];
  }

  // Check for message pattern matches
  for (const [pattern, friendlyMessage] of Object.entries(USER_FRIENDLY_MESSAGES)) {
    if (message.includes(pattern)) {
      return friendlyMessage;
    }
  }

  // Return original message if no match found, but sanitized
  if (error.message && error.message.length < 200) {
    return error.message;
  }

  return 'An unexpected error occurred. Please try again.';
}

/**
 * Determine error severity based on error type and message
 */
function determineErrorSeverity(error) {
  if (!error) return ErrorSeverity.LOW;

  const message = error.message?.toLowerCase() || '';
  const status = error.status;

  // Critical errors
  if (message.includes('storage quota') || message.includes('out of memory')) {
    return ErrorSeverity.CRITICAL;
  }

  // High severity - network and auth issues
  if (message.includes('network') || message.includes('fetch failed') ||
      status === 401 || status === 403) {
    return ErrorSeverity.HIGH;
  }

  // Medium severity
  if (message.includes('not found') || message.includes('invalid') ||
      status === 404 || status === 409) {
    return ErrorSeverity.MEDIUM;
  }

  // Default to medium
  return ErrorSeverity.MEDIUM;
}

/**
 * Create error UI element
 */
function createErrorUI(error) {
  const friendlyMessage = getUserFriendlyMessage(error);
  const severity = determineErrorSeverity(error);

  const container = document.createElement('div');
  container.className = `error-boundary error-${severity}`;

  const icon = severity === ErrorSeverity.CRITICAL ? '🚨' :
               severity === ErrorSeverity.HIGH ? '⚠️' : 'ℹ️';

  const title = severity === ErrorSeverity.CRITICAL ? 'Critical Error' :
                severity === ErrorSeverity.HIGH ? 'Something went wrong' : 'Notice';

  container.innerHTML = `
    <h3 class="error-title">${icon} ${title}</h3>
    <p class="error-message">${escapeHtml(friendlyMessage)}</p>
    <div class="error-actions">
      <button class="btn btn-secondary error-retry-btn">Try Again</button>
      <button class="btn btn-primary error-reload-btn">Reload Page</button>
    </div>
  `;

  // Add event listeners
  const retryBtn = container.querySelector('.error-retry-btn');
  const reloadBtn = container.querySelector('.error-reload-btn');

  if (retryBtn) {
    retryBtn.addEventListener('click', () => {
      container.remove();
      window.dispatchEvent(new CustomEvent('error-retry'));
    });
  }

  if (reloadBtn) {
    reloadBtn.addEventListener('click', () => window.location.reload());
  }

  return container;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Recovery strategies for common errors
 */
export const RecoveryStrategies = {
  /**
   * Retry an operation with exponential backoff
   */
  async retry(fn, maxAttempts = 3, baseDelay = 1000) {
    let lastError;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (attempt < maxAttempts - 1) {
          const delay = baseDelay * Math.pow(2, attempt);
          console.log(`Retry attempt ${attempt + 1}/${maxAttempts} after ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    throw lastError;
  },

  /**
   * Fallback to alternative data source
   */
  async withFallback(primaryFn, fallbackFn) {
    try {
      return await primaryFn();
    } catch (primaryError) {
      console.warn('Primary operation failed, using fallback:', primaryError.message);
      try {
        return await fallbackFn();
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError.message);
        throw primaryError; // Throw original error
      }
    }
  },

  /**
   * Cache and return stale data on error
   */
  async withStaleCache(fn, cacheKey, cache = new Map()) {
    try {
      const result = await fn();
      cache.set(cacheKey, result);
      return result;
    } catch (error) {
      const cached = cache.get(cacheKey);
      if (cached) {
        console.warn('Operation failed, returning cached data:', error.message);
        return cached;
      }
      throw error;
    }
  }
};

export { errorHandler };
export default errorHandler;
