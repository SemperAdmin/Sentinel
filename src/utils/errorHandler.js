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
 * Determine error severity based on error type and message
 */
function determineErrorSeverity(error) {
  if (!error) return ErrorSeverity.LOW;

  const message = error.message?.toLowerCase() || '';

  // Critical errors
  if (message.includes('storage quota') || message.includes('out of memory')) {
    return ErrorSeverity.CRITICAL;
  }

  // High severity
  if (message.includes('network') || message.includes('fetch failed')) {
    return ErrorSeverity.HIGH;
  }

  // Medium severity
  if (message.includes('not found') || message.includes('invalid')) {
    return ErrorSeverity.MEDIUM;
  }

  // Default to medium
  return ErrorSeverity.MEDIUM;
}

/**
 * Create error UI element
 */
function createErrorUI(error) {
  const container = document.createElement('div');
  container.className = 'error-boundary';
  container.style.cssText = `
    padding: 1rem;
    margin: 1rem 0;
    background: #ffe6e6;
    border: 2px solid #ff4444;
    border-radius: 4px;
    color: #cc0000;
  `;

  container.innerHTML = `
    <h3 style="margin: 0 0 0.5rem 0;">⚠️ Something went wrong</h3>
    <p style="margin: 0 0 0.5rem 0;">${escapeHtml(error.message || 'An unexpected error occurred')}</p>
  `;

  const reloadButton = document.createElement('button');
  reloadButton.textContent = 'Reload Page';
  reloadButton.style.cssText = `
    padding: 0.5rem 1rem;
    background: #ff4444;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  `;
  reloadButton.addEventListener('click', () => window.location.reload());
  container.appendChild(reloadButton);

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
