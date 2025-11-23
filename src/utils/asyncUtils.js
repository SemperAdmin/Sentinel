/**
 * Async utilities for standardized async/await patterns with error handling
 * Provides consistent patterns for async operations across the application
 */

import errorHandler, { ErrorType, ErrorSeverity } from './errorHandler.js';

/**
 * Wrap an async function with try-catch and error logging
 * @template T
 * @param {() => Promise<T>} asyncFn - Async function to wrap
 * @param {Object} [options] - Options
 * @param {ErrorType} [options.errorType] - Error type for logging
 * @param {ErrorSeverity} [options.severity] - Error severity
 * @param {string} [options.context] - Context description
 * @param {T} [options.fallback] - Fallback value on error
 * @param {boolean} [options.rethrow=true] - Whether to rethrow error
 * @returns {Promise<T|null>} Result or fallback/null
 */
export async function safeAsync(asyncFn, options = {}) {
  const {
    errorType = ErrorType.UNKNOWN,
    severity = ErrorSeverity.MEDIUM,
    context = 'Async operation',
    fallback = null,
    rethrow = true
  } = options;

  try {
    return await asyncFn();
  } catch (error) {
    errorHandler.logError(errorType, severity, `${context} failed`, error);

    if (rethrow) {
      throw error;
    }

    return fallback;
  }
}

/**
 * Execute multiple async operations in parallel with error handling
 * @template T
 * @param {Array<() => Promise<T>>} asyncFunctions - Array of async functions
 * @param {Object} [options] - Options
 * @param {boolean} [options.failFast=false] - Fail on first error
 * @param {ErrorType} [options.errorType] - Error type for logging
 * @returns {Promise<Array<{success: boolean, data?: T, error?: Error}>>} Results
 */
export async function parallelAsync(asyncFunctions, options = {}) {
  const {
    failFast = false,
    errorType = ErrorType.UNKNOWN
  } = options;

  if (failFast) {
    // Use Promise.all - fails on first error
    try {
      const results = await Promise.all(asyncFunctions.map(fn => fn()));
      return results.map(data => ({ success: true, data }));
    } catch (error) {
      errorHandler.logError(errorType, ErrorSeverity.HIGH, 'Parallel async failed fast', error);
      throw error;
    }
  } else {
    // Use Promise.allSettled - waits for all to complete
    const results = await Promise.allSettled(asyncFunctions.map(fn => fn()));

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return { success: true, data: result.value };
      } else {
        errorHandler.logError(
          errorType,
          ErrorSeverity.MEDIUM,
          `Parallel async operation ${index} failed`,
          result.reason
        );
        return { success: false, error: result.reason };
      }
    });
  }
}

/**
 * Execute async operations sequentially
 * @template T
 * @param {Array<() => Promise<T>>} asyncFunctions - Array of async functions
 * @param {Object} [options] - Options
 * @param {boolean} [options.stopOnError=false] - Stop on first error
 * @param {ErrorType} [options.errorType] - Error type for logging
 * @returns {Promise<Array<{success: boolean, data?: T, error?: Error}>>} Results
 */
export async function sequentialAsync(asyncFunctions, options = {}) {
  const {
    stopOnError = false,
    errorType = ErrorType.UNKNOWN
  } = options;

  const results = [];

  for (let i = 0; i < asyncFunctions.length; i++) {
    try {
      const data = await asyncFunctions[i]();
      results.push({ success: true, data });
    } catch (error) {
      errorHandler.logError(
        errorType,
        ErrorSeverity.MEDIUM,
        `Sequential async operation ${i} failed`,
        error
      );

      results.push({ success: false, error });

      if (stopOnError) {
        break;
      }
    }
  }

  return results;
}

/**
 * Retry an async operation with exponential backoff
 * @template T
 * @param {() => Promise<T>} asyncFn - Async function to retry
 * @param {Object} [options] - Options
 * @param {number} [options.maxAttempts=3] - Maximum retry attempts
 * @param {number} [options.baseDelay=1000] - Base delay in ms
 * @param {number} [options.maxDelay=10000] - Maximum delay in ms
 * @param {(error: Error, attempt: number) => boolean} [options.shouldRetry] - Custom retry logic
 * @param {ErrorType} [options.errorType] - Error type for logging
 * @returns {Promise<T>} Result
 */
export async function retryAsync(asyncFn, options = {}) {
  const {
    maxAttempts = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    shouldRetry = () => true,
    errorType = ErrorType.NETWORK
  } = options;

  let lastError;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await asyncFn();
    } catch (error) {
      lastError = error;

      const shouldContinue = attempt < maxAttempts - 1 && shouldRetry(error, attempt);

      if (!shouldContinue) {
        break;
      }

      const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);

      errorHandler.logError(
        errorType,
        ErrorSeverity.MEDIUM,
        `Retry attempt ${attempt + 1}/${maxAttempts} after ${delay}ms`,
        error
      );

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  errorHandler.logError(
    errorType,
    ErrorSeverity.HIGH,
    `All ${maxAttempts} retry attempts failed`,
    lastError
  );

  throw lastError;
}

/**
 * Execute async function with timeout
 * @template T
 * @param {() => Promise<T>} asyncFn - Async function
 * @param {number} timeoutMs - Timeout in milliseconds
 * @param {Object} [options] - Options
 * @param {string} [options.timeoutMessage] - Custom timeout message
 * @param {ErrorType} [options.errorType] - Error type for logging
 * @returns {Promise<T>} Result
 */
export async function withTimeout(asyncFn, timeoutMs, options = {}) {
  const {
    timeoutMessage = `Operation timed out after ${timeoutMs}ms`,
    errorType = ErrorType.NETWORK
  } = options;

  return Promise.race([
    asyncFn(),
    new Promise((_, reject) =>
      setTimeout(() => {
        const error = new Error(timeoutMessage);
        errorHandler.logError(errorType, ErrorSeverity.HIGH, timeoutMessage, error);
        reject(error);
      }, timeoutMs)
    )
  ]);
}

/**
 * Debounce an async function
 * @template T
 * @param {(...args: any[]) => Promise<T>} asyncFn - Async function to debounce
 * @param {number} delayMs - Debounce delay in milliseconds
 * @returns {(...args: any[]) => Promise<T>} Debounced function
 */
export function debounceAsync(asyncFn, delayMs) {
  let timeoutId;
  let pendingResolve;
  let pendingReject;

  return function(...args) {
    return new Promise((resolve, reject) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        if (pendingReject) {
          pendingReject(new Error('Debounced call cancelled'));
        }
      }

      pendingResolve = resolve;
      pendingReject = reject;

      timeoutId = setTimeout(async () => {
        try {
          const result = await asyncFn.apply(this, args);
          pendingResolve(result);
        } catch (error) {
          pendingReject(error);
        }
      }, delayMs);
    });
  };
}

/**
 * Throttle an async function, returning the last successful result during the cooldown.
 * Note: Calls made during the throttle period will return the last cached result without executing the function again.
 * @template T
 * @param {(...args: any[]) => Promise<T>} asyncFn - Async function to throttle
 * @param {number} limitMs - Throttle limit in milliseconds
 * @returns {(...args: any[]) => Promise<T|null>} Throttled function
 */
export function throttleAsync(asyncFn, limitMs) {
  let inThrottle = false;
  let lastResult = null;

  return async function(...args) {
    if (!inThrottle) {
      inThrottle = true;
      lastResult = await asyncFn.apply(this, args);

      setTimeout(() => {
        inThrottle = false;
      }, limitMs);

      return lastResult;
    }

    return lastResult;
  };
}

/**
 * Cache async function results with TTL
 * @template T
 * @param {(...args: any[]) => Promise<T>} asyncFn - Async function to cache
 * @param {Object} [options] - Options
 * @param {number} [options.ttlMs=60000] - Time to live in milliseconds
 * @param {(args: any[]) => string} [options.keyFn] - Custom cache key function
 * @returns {(...args: any[]) => Promise<T>} Cached function
 */
export function cacheAsync(asyncFn, options = {}) {
  const {
    ttlMs = 60000,
    keyFn = (args) => JSON.stringify(args)
  } = options;

  const cache = new Map();

  return async function(...args) {
    const key = keyFn(args);
    const cached = cache.get(key);

    if (cached && Date.now() - cached.timestamp < ttlMs) {
      return cached.value;
    }

    const value = await asyncFn.apply(this, args);

    cache.set(key, {
      value,
      timestamp: Date.now()
    });

    return value;
  };
}

export default {
  safeAsync,
  parallelAsync,
  sequentialAsync,
  retryAsync,
  withTimeout,
  debounceAsync,
  throttleAsync,
  cacheAsync
};
