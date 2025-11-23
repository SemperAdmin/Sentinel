/**
 * Batch processor utility for handling concurrent API requests with rate limiting
 * Allows multiple requests to run in parallel while respecting rate limits
 */

import { MAX_CONCURRENT_API_REQUESTS, GITHUB_API_DELAY_MS } from './constants.js';

/**
 * Process items in batches with concurrency control
 * @template T, R
 * @param {T[]} items - Array of items to process
 * @param {(item: T) => Promise<R>} processFn - Function to process each item
 * @param {Object} options - Processing options
 * @param {number} [options.concurrency] - Max concurrent operations
 * @param {number} [options.delayMs] - Delay between batches in milliseconds
 * @param {(item: T) => boolean} [options.shouldProcess] - Optional filter function
 * @returns {Promise<Array<{item: T, result?: R, error?: Error}>>}
 */
export async function batchProcess(items, processFn, options = {}) {
  const {
    concurrency = MAX_CONCURRENT_API_REQUESTS,
    delayMs = GITHUB_API_DELAY_MS,
    shouldProcess = () => true
  } = options;

  const results = [];
  const filteredItems = items.filter(shouldProcess);

  // Split into chunks based on concurrency
  const chunks = [];
  for (let i = 0; i < filteredItems.length; i += concurrency) {
    chunks.push(filteredItems.slice(i, i + concurrency));
  }

  console.log(`Processing ${filteredItems.length} items in ${chunks.length} batches (concurrency: ${concurrency})`);

  // Process each chunk
  for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
    const chunk = chunks[chunkIndex];

    console.log(`Processing batch ${chunkIndex + 1}/${chunks.length} (${chunk.length} items)`);

    // Process all items in chunk concurrently
    const chunkPromises = chunk.map(async (item) => {
      try {
        const result = await processFn(item);
        return { item, result, error: null };
      } catch (error) {
        console.error(`Error processing item:`, error);
        return { item, result: null, error };
      }
    });

    // Wait for all promises in chunk to complete
    const chunkResults = await Promise.allSettled(chunkPromises);

    // Extract results
    chunkResults.forEach((promiseResult) => {
      if (promiseResult.status === 'fulfilled') {
        results.push(promiseResult.value);
      } else {
        results.push({
          item: null,
          result: null,
          error: promiseResult.reason
        });
      }
    });

    // Add delay between chunks (except after last chunk)
    if (chunkIndex < chunks.length - 1 && delayMs > 0) {
      console.log(`Waiting ${delayMs}ms before next batch...`);
      await delay(delayMs);
    }
  }

  const successCount = results.filter(r => !r.error).length;
  const errorCount = results.filter(r => r.error).length;

  console.log(`Batch processing complete: ${successCount} succeeded, ${errorCount} failed`);

  return results;
}

/**
 * Process items with retry logic
 * @template T, R
 * @param {T[]} items - Array of items to process
 * @param {(item: T) => Promise<R>} processFn - Function to process each item
 * @param {Object} options - Processing options
 * @param {number} [options.maxRetries] - Max retry attempts per item
 * @param {number} [options.retryDelay] - Delay between retries
 * @returns {Promise<Array<{item: T, result?: R, error?: Error, retries: number}>>}
 */
export async function batchProcessWithRetry(items, processFn, options = {}) {
  const {
    maxRetries = 2,
    retryDelay = 1000,
    ...batchOptions
  } = options;

  const processWithRetry = async (item) => {
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await processFn(item);
      } catch (error) {
        lastError = error;
        if (attempt < maxRetries) {
          console.log(`Retry ${attempt + 1}/${maxRetries} for item after error:`, error.message);
          await delay(retryDelay * Math.pow(2, attempt)); // Exponential backoff
        }
      }
    }
    throw lastError;
  };

  return batchProcess(items, processWithRetry, batchOptions);
}

/**
 * Delay utility
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a rate-limited version of a function
 * @template T
 * @param {(...args: any[]) => Promise<T>} fn - Function to rate limit
 * @param {number} minDelayMs - Minimum delay between calls
 * @returns {(...args: any[]) => Promise<T>}
 */
export function rateLimit(fn, minDelayMs) {
  let lastCallTime = 0;

  return async function(...args) {
    const now = Date.now();
    const timeSinceLastCall = now - lastCallTime;

    if (timeSinceLastCall < minDelayMs) {
      const waitTime = minDelayMs - timeSinceLastCall;
      await delay(waitTime);
    }

    lastCallTime = Date.now();
    return fn(...args);
  };
}

export default {
  batchProcess,
  batchProcessWithRetry,
  rateLimit
};
