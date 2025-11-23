/**
 * Result utility for consistent error handling
 * Provides a standardized way to return success/failure from async operations
 */

/**
 * Create a successful result
 * @template T
 * @param {T} data - The data to return
 * @returns {{success: true, data: T}}
 */
export const ok = (data) => ({
  success: true,
  data
});

/**
 * Create a failed result
 * @param {string | Error} error - The error message or Error object
 * @param {number} [code] - Optional error code
 * @returns {{success: false, error: string, code?: number}}
 */
export const err = (error, code) => ({
  success: false,
  error: error instanceof Error ? error.message : String(error),
  code
});

/**
 * Wrap an async function to return a Result type
 * @template T
 * @param {() => Promise<T>} fn - The async function to wrap
 * @returns {Promise<{success: true, data: T} | {success: false, error: string}>}
 */
export const wrapAsync = async (fn) => {
  try {
    const data = await fn();
    return ok(data);
  } catch (error) {
    return err(error);
  }
};

/**
 * Check if a result is successful
 * @param {{success: boolean}} result
 * @returns {boolean}
 */
export const isOk = (result) => result && result.success === true;

/**
 * Check if a result is a failure
 * @param {{success: boolean}} result
 * @returns {boolean}
 */
export const isErr = (result) => result && result.success === false;

/**
 * Unwrap a result, throwing if it's an error
 * @template T
 * @param {{success: boolean, data?: T, error?: string}} result
 * @returns {T}
 * @throws {Error}
 */
export const unwrap = (result) => {
  if (isOk(result)) {
    return result.data;
  }
  throw new Error(result.error || 'Unknown error');
};

/**
 * Unwrap a result, returning a default value if it's an error
 * @template T
 * @param {{success: boolean, data?: T}} result
 * @param {T} defaultValue
 * @returns {T}
 */
export const unwrapOr = (result, defaultValue) => {
  if (isOk(result)) {
    return result.data;
  }
  return defaultValue;
};
