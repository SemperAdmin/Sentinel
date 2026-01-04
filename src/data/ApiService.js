/**
 * ApiService - GitHub API integration with retry logic and error handling
 * Handles external API calls for repository metadata
 */

import { ok, err } from '../utils/result.js';
import { normalizeAppId } from '../utils/helpers.js';
import offlineQueue from '../utils/offlineQueue.js';
import {
  GITHUB_API_RETRY_ATTEMPTS,
  GITHUB_API_RETRY_BASE_DELAY,
  GITHUB_API_MAX_RETRY_DELAY,
  GITHUB_API_REQUEST_TIMEOUT,
  DEFAULT_MANAGER_REPO,
  DEFAULT_REPOS_PER_PAGE
} from '../utils/constants.js';

class ApiService {
  constructor() {
    const envBase = import.meta?.env?.VITE_API_BASE_URL || '';
    const host = typeof window !== 'undefined' ? window.location.hostname : '';
    let base = envBase || '/api';
    if (!envBase && host.endsWith('github.io')) {
      base = 'https://sentinel-bfhj.onrender.com/api';
    }
    this.baseUrl = base;
    this.retryAttempts = GITHUB_API_RETRY_ATTEMPTS;
    this.retryDelay = GITHUB_API_RETRY_BASE_DELAY;
    this.maxDelay = GITHUB_API_MAX_RETRY_DELAY;
    this.requestTimeout = GITHUB_API_REQUEST_TIMEOUT;
    this.managerRepo = window.MANAGER_REPO_FULL_NAME || DEFAULT_MANAGER_REPO;
    this.tasksCache = new Map();
    // SHA cache for optimistic locking - stores {sha, fetchedAt} for each file
    this.shaCache = new Map();
    // Maximum number of conflict retries
    this.maxConflictRetries = 3;
  }

  /**
   * Store SHA in cache when fetching a file
   */
  cacheSha(fileKey, sha) {
    this.shaCache.set(fileKey, {
      sha,
      fetchedAt: Date.now()
    });
  }

  /**
   * Get cached SHA for a file
   */
  getCachedSha(fileKey) {
    const cached = this.shaCache.get(fileKey);
    return cached ? cached.sha : null;
  }

  /**
   * Clear cached SHA (e.g., after successful write)
   */
  clearCachedSha(fileKey) {
    this.shaCache.delete(fileKey);
  }

  /**
   * Check if a response indicates a SHA conflict (409 Conflict)
   */
  isConflictError(response) {
    return response && response.status === 409;
  }

  /**
   * Check if we're currently online
   */
  isOnline() {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  }

  /**
   * Queue an operation for later retry when offline
   */
  queueForRetry(type, appId, data) {
    offlineQueue.enqueue({ type, appId, data });
  }

  /**
   * Fetch repository data with exponential backoff retry logic
   */
  async fetchRepoData(repoUrl) {
    console.log('Fetching repository data for:', repoUrl);
    
    if (!repoUrl || !repoUrl.includes('github.com')) {
      console.warn('Invalid GitHub repository URL:', repoUrl);
      throw new Error('Invalid GitHub repository URL: ' + repoUrl);
    }

    // Extract owner and repo from URL
    const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) {
      console.warn('Could not parse GitHub repository URL:', repoUrl);
      throw new Error('Could not parse GitHub repository URL: ' + repoUrl);
    }

    const [, owner, repo] = match;
    const cleanRepo = repo.replace(/\.git$/, ''); // Remove .git suffix if present

    console.log(`Extracted owner: ${owner}, repo: ${cleanRepo}`);
    return this.fetchWithRetry(`/repos/${owner}/${cleanRepo}`);
  }

  /**
   * Fetch repository commits to get last commit date
   */
  async fetchLastCommit(owner, repo) {
    return this.fetchWithRetry(`/repos/${owner}/${repo}/commits`, { per_page: 1 });
  }

  /**
   * Fetch repository tags to get latest tag
   */
  async fetchLatestTag(owner, repo) {
    return this.fetchWithRetry(`/repos/${owner}/${repo}/tags`, { per_page: 1 });
  }

  /**
   * Fetch repository traffic views (last 14 days)
   */
  async fetchTrafficViews(owner, repo) {
    console.log(`Fetching traffic views for ${owner}/${repo}`);
    return this.fetchWithRetry(`/repos/${owner}/${repo}/traffic/views`, { per: 'day' });
  }

  /**
   * Fetch repository traffic clones (last 14 days)
   */
  async fetchTrafficClones(owner, repo) {
    console.log(`Fetching traffic clones for ${owner}/${repo}`);
    return this.fetchWithRetry(`/repos/${owner}/${repo}/traffic/clones`, { per: 'day' });
  }

  /**
   * Make API request with exponential backoff retry logic
   */
  async fetchWithRetry(endpoint, params = {}) {
    let full = `${this.baseUrl}${endpoint}`;
    if (full.startsWith('/')) {
      full = `${window.location.origin}${full}`;
    }
    const url = new URL(full);
    
    // Add query parameters
    Object.keys(params).forEach(key => {
      url.searchParams.append(key, params[key]);
    });

    let lastError;
    
    console.log(`Making GitHub API call to: ${endpoint}`);
    
    for (let attempt = 0; attempt < this.retryAttempts; attempt++) {
      try {
        console.log(`API attempt ${attempt + 1} for ${endpoint}`);
        
        const response = await this.makeApiRequest(url.toString());
        
        if (response.ok) {
          const data = await response.json();
          console.log(`API success for ${endpoint}`);
          return data;
        }
        
        // Handle rate limiting
        if (response.status === 403 && response.headers.get('X-RateLimit-Remaining') === '0') {
          const resetTime = response.headers.get('X-RateLimit-Reset');
          const waitTime = resetTime ? (parseInt(resetTime) * 1000) - Date.now() : 60000;
          console.log(`Rate limited, waiting ${waitTime}ms`);
          await this.delay(Math.min(waitTime, this.maxDelay));
          continue;
        }
        
        // Handle not found
        if (response.status === 404) {
          console.warn(`Repository not found: ${endpoint}`);
          throw new Error(`Repository not found: ${endpoint}`);
        }
        
        // Handle other errors
        const errorData = await response.text();
        console.error(`API error ${response.status}:`, errorData);
        lastError = new Error(`GitHub API error: ${response.status}`);
        
      } catch (error) {
        console.error(`API request failed (attempt ${attempt + 1}):`, error);
        lastError = error;
      }
      
      // Wait before retry with exponential backoff
      if (attempt < this.retryAttempts - 1) {
        const delayTime = this.retryDelay * Math.pow(2, attempt);
        console.log(`Retrying after ${delayTime}ms`);
        await this.delay(Math.min(delayTime, this.maxDelay));
      }
    }
    
    console.error('All API attempts failed');
    throw lastError || new Error('Failed to fetch data from GitHub API');
  }

  /**
   * Make actual API request with proper headers
   */
  async makeApiRequest(url, attemptedRotation = false) {
    const headers = {
      'Accept': 'application/vnd.github.v3+json',
      'X-GitHub-Api-Version': '2022-11-28'
    };

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), this.requestTimeout) : null;
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers,
        mode: 'cors',
        signal: controller ? controller.signal : undefined
      });
      const remaining = res.headers.get('X-RateLimit-Remaining');
      const limit = res.headers.get('X-RateLimit-Limit');
      const reset = res.headers.get('X-RateLimit-Reset');
      if (remaining && limit) {
        const resetMs = reset ? parseInt(reset, 10) * 1000 : null;
        const resetAt = resetMs ? new Date(resetMs).toISOString() : null;
        console.log(`GitHub rate: ${remaining}/${limit} remaining${resetAt ? `, resets at ${resetAt}` : ''}`);
      }
      return res;
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  /**
   * Trigger repository_dispatch to save tasks via GitHub Actions
   */
  async triggerSaveTasks(appId, tasks) {
    const normalizedId = normalizeAppId(appId);
    if (!this.managerRepo) {
      console.warn('Manager repository not configured (window.MANAGER_REPO_FULL_NAME)');
      return { ok: false, error: 'Manager repo not configured' };
    }
    const headers = {
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json'
    };
    // Use local tasks as source of truth - don't merge with remote
    // This ensures deletions are properly saved
    const tasksToSave = Array.isArray(tasks) ? tasks.slice() : [];
    tasksToSave.sort((a, b) => String(a.id || '').localeCompare(String(b.id || '')));

    const body = {
      event_type: 'save_tasks',
      client_payload: {
        app_id: normalizedId,
        tasks_json: JSON.stringify(tasksToSave)
      }
    };
    const url = `${this.baseUrl}/repos/${this.managerRepo}/dispatches`;
    try {
      const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), mode: 'cors' });
      if (res && res.ok) return { ok: true };
      console.warn('Dispatch failed, falling back to direct contents API');
    } catch (err) {
      console.warn('Dispatch error, falling back to direct contents API:', err);
    }
    // saveTasksViaContents returns { ok: boolean, conflict?: boolean, message?: string }
    return await this.saveTasksViaContents(normalizedId, tasksToSave);
  }

  async fetchRepoTasks(appId, bypassCache = false) {
    const normalizedId = normalizeAppId(appId);
    try {
      if (!this.managerRepo || !normalizedId) {
        return err('Manager repo or app ID not configured');
      }
      if (!bypassCache && this.tasksCache.has(normalizedId)) {
        return ok(this.tasksCache.get(normalizedId));
      }
      const url = `${this.baseUrl}/repos/${this.managerRepo}/contents/data/tasks/${normalizedId}/tasks.json?ref=main`;
      const res = await this.makeApiRequest(url);
      if (!res || !res.ok) {
        return err('Failed to fetch tasks', res?.status);
      }
      const data = await res.json();
      const content = typeof atob !== 'undefined' ? atob(data.content) : Buffer.from(data.content, 'base64').toString('utf-8');
      const parsed = JSON.parse(content);
      const tasks = Array.isArray(parsed) ? parsed : [];
      this.tasksCache.set(normalizedId, tasks);
      // Cache SHA for optimistic locking
      if (data.sha) {
        this.cacheSha(`tasks:${normalizedId}`, data.sha);
      }
      return ok(tasks);
    } catch (error) {
      return err(error);
    }
  }

  encodeBase64(text) {
    try {
      return btoa(unescape(encodeURIComponent(text)));
    } catch (_) {
      return Buffer.from(text, 'utf-8').toString('base64');
    }
  }

  async fetchPortfolioOverview() {
    try {
      const url = `${this.baseUrl}/repos/${this.managerRepo}/contents/data/portfolio/overview.json?ref=main`;
      const res = await this.makeApiRequest(url);
      if (!res || !res.ok) {
        return err('Failed to fetch portfolio overview', res?.status);
      }
      const data = await res.json();
      const content = typeof atob !== 'undefined' ? atob(data.content) : Buffer.from(data.content, 'base64').toString('utf-8');
      const parsed = JSON.parse(content);

      if (!Array.isArray(parsed)) {
        return err('Invalid portfolio data format');
      }

      return ok(parsed);
    } catch (error) {
      return err(error);
    }
  }

  async fetchAppReviews(appId, bypassCache = false) {
    const normalizedId = normalizeAppId(appId);
    try {
      const url = `${this.baseUrl}/repos/${this.managerRepo}/contents/data/reviews/${normalizedId}/reviews.json?ref=main`;
      const res = await this.makeApiRequest(url);
      if (!res || !res.ok) {
        return err('Failed to fetch reviews', res?.status);
      }
      const data = await res.json();
      const content = typeof atob !== 'undefined' ? atob(data.content) : Buffer.from(data.content, 'base64').toString('utf-8');
      const parsed = JSON.parse(content);
      const reviews = Array.isArray(parsed) ? parsed : [];
      // Cache SHA for optimistic locking
      if (data.sha) {
        this.cacheSha(`reviews:${normalizedId}`, data.sha);
      }
      return ok(reviews);
    } catch (error) {
      return err(error);
    }
  }

  async getReviewsSha(appId) {
    const normalizedId = normalizeAppId(appId);
    try {
      const url = `${this.baseUrl}/repos/${this.managerRepo}/contents/data/reviews/${normalizedId}/reviews.json?ref=main`;
      const res = await this.makeApiRequest(url);
      if (!res || !res.ok) return null;
      const data = await res.json();
      return data.sha || null;
    } catch (_) {
      return null;
    }
  }

  async saveAppReviews(appId, reviews, retryCount = 0, skipQueue = false) {
    const normalizedId = normalizeAppId(appId);
    const fileKey = `reviews:${normalizedId}`;
    const reviewsArr = Array.isArray(reviews) ? reviews : [];

    // Check if offline - queue for later
    if (!this.isOnline() && !skipQueue) {
      console.log(`Offline: queuing reviews save for ${normalizedId}`);
      this.queueForRetry('reviews', normalizedId, reviewsArr);
      return { ok: false, queued: true, message: 'Changes saved locally. Will sync when online.' };
    }

    try {
      // Use cached SHA for optimistic locking, fallback to fresh fetch
      let sha = this.getCachedSha(fileKey);
      if (!sha) {
        sha = await this.getReviewsSha(normalizedId);
      }

      const url = `${this.baseUrl}/repos/${this.managerRepo}/contents/data/reviews/${normalizedId}/reviews.json`;
      const headers = {
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json'
      };
      const pretty = JSON.stringify(reviewsArr, null, 2) + "\n";
      const content = this.encodeBase64(pretty);
      const body = {
        message: `Update reviews for ${normalizedId}`,
        content,
        branch: 'main',
        sha: sha || undefined
      };
      const res = await fetch(url, { method: 'PUT', headers, body: JSON.stringify(body), mode: 'cors' });

      // Handle 409 Conflict - SHA mismatch
      if (this.isConflictError(res)) {
        console.warn(`SHA conflict detected for ${fileKey}, attempt ${retryCount + 1}`);

        if (retryCount >= this.maxConflictRetries) {
          console.error(`Max conflict retries (${this.maxConflictRetries}) reached for ${fileKey}`);
          return { ok: false, conflict: true, message: 'File was modified by another user. Please refresh and try again.' };
        }

        // Clear stale SHA and refetch
        this.clearCachedSha(fileKey);

        // Fetch latest version
        const remoteResult = await this.fetchAppReviews(normalizedId, true);
        if (!remoteResult.success) {
          return { ok: false, conflict: true, message: 'Failed to fetch latest version for merge.' };
        }

        // Merge reviews by ID
        const remote = remoteResult.data || [];
        const merged = this.mergeReviews(reviewsArr, remote);

        // Retry with merged data
        await this.delay(500 * (retryCount + 1));
        return this.saveAppReviews(normalizedId, merged, retryCount + 1, skipQueue);
      }

      if (res && res.ok) {
        // Update SHA cache with new SHA from response
        try {
          const responseData = await res.json();
          if (responseData.content && responseData.content.sha) {
            this.cacheSha(fileKey, responseData.content.sha);
          }
        } catch (_) {
          this.clearCachedSha(fileKey);
        }
        return { ok: true };
      }

      // Network error or other failure - queue for retry
      if (!skipQueue) {
        console.log(`Save failed, queuing reviews for ${normalizedId}`);
        this.queueForRetry('reviews', normalizedId, reviewsArr);
        return { ok: false, queued: true, message: 'Save failed. Changes queued for retry.' };
      }

      return { ok: false };
    } catch (err) {
      console.warn('Save reviews failed:', err);
      // Queue on network errors
      if (!skipQueue && (err.name === 'TypeError' || err.message.includes('network') || err.message.includes('fetch'))) {
        this.queueForRetry('reviews', normalizedId, reviewsArr);
        return { ok: false, queued: true, message: 'Network error. Changes queued for retry.' };
      }
      return { ok: false, error: err.message };
    }
  }

  /**
   * Merge local reviews with remote reviews, preserving local changes
   */
  mergeReviews(localReviews, remoteReviews) {
    const localById = new Map();
    const localArr = Array.isArray(localReviews) ? localReviews : [];
    const remoteArr = Array.isArray(remoteReviews) ? remoteReviews : [];

    for (const review of localArr) {
      if (review && review.id) {
        localById.set(String(review.id), review);
      }
    }

    for (const remoteReview of remoteArr) {
      if (remoteReview && remoteReview.id) {
        const id = String(remoteReview.id);
        if (!localById.has(id)) {
          localById.set(id, remoteReview);
        }
      }
    }

    return Array.from(localById.values()).sort((a, b) =>
      String(a.startedAt || '').localeCompare(String(b.startedAt || ''))
    );
  }

  async getFileSha(appId) {
    const normalizedId = normalizeAppId(appId);
    try {
      const url = `${this.baseUrl}/repos/${this.managerRepo}/contents/data/tasks/${normalizedId}/tasks.json?ref=main`;
      const res = await this.makeApiRequest(url);
      if (!res || !res.ok) return null;
      const data = await res.json();
      return data.sha || null;
    } catch (_) {
      return null;
    }
  }

  async saveTasksViaContents(appId, tasks, retryCount = 0, skipQueue = false) {
    const normalizedId = normalizeAppId(appId);
    const fileKey = `tasks:${normalizedId}`;
    const arr = Array.isArray(tasks) ? tasks.slice() : [];

    // Check if offline - queue for later
    if (!this.isOnline() && !skipQueue) {
      console.log(`Offline: queuing tasks save for ${normalizedId}`);
      this.queueForRetry('tasks', normalizedId, arr);
      return { ok: false, queued: true, message: 'Changes saved locally. Will sync when online.' };
    }

    try {
      // Use cached SHA for optimistic locking, fallback to fresh fetch
      let sha = this.getCachedSha(fileKey);
      if (!sha) {
        sha = await this.getFileSha(normalizedId);
      }

      const url = `${this.baseUrl}/repos/${this.managerRepo}/contents/data/tasks/${normalizedId}/tasks.json`;
      const headers = {
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json'
      };
      arr.sort((a,b) => String(a.id||'').localeCompare(String(b.id||'')));
      const pretty = JSON.stringify(arr, null, 2) + "\n";
      const content = this.encodeBase64(pretty);
      const body = {
        message: `Save tasks for ${normalizedId} (direct contents API)`,
        content,
        branch: 'main',
        sha: sha || undefined
      };
      const res = await fetch(url, { method: 'PUT', headers, body: JSON.stringify(body), mode: 'cors' });

      // Handle 409 Conflict - SHA mismatch (someone else modified the file)
      if (this.isConflictError(res)) {
        console.warn(`SHA conflict detected for ${fileKey}, attempt ${retryCount + 1}`);

        if (retryCount >= this.maxConflictRetries) {
          console.error(`Max conflict retries (${this.maxConflictRetries}) reached for ${fileKey}`);
          return { ok: false, conflict: true, message: 'File was modified by another user. Please refresh and try again.' };
        }

        // Clear stale SHA and refetch with merge
        this.clearCachedSha(fileKey);
        this.tasksCache.delete(normalizedId);

        // Fetch latest version
        const remoteResult = await this.fetchRepoTasks(normalizedId, true);
        if (!remoteResult.success) {
          return { ok: false, conflict: true, message: 'Failed to fetch latest version for merge.' };
        }

        // Merge: keep local changes, add any remote-only items
        const remote = remoteResult.data || [];
        const merged = this.mergeTasks(arr, remote);

        // Retry with merged data and new SHA
        await this.delay(500 * (retryCount + 1)); // Backoff
        return this.saveTasksViaContents(normalizedId, merged, retryCount + 1, skipQueue);
      }

      if (res && res.ok) {
        // Update SHA cache with new SHA from response
        try {
          const responseData = await res.json();
          if (responseData.content && responseData.content.sha) {
            this.cacheSha(fileKey, responseData.content.sha);
          }
        } catch (_) {
          // Clear cache if we can't get new SHA
          this.clearCachedSha(fileKey);
        }
        this.tasksCache.delete(normalizedId); // Invalidate task cache
        return { ok: true };
      }

      // Network error or other failure - queue for retry if not already queued
      if (!skipQueue) {
        console.log(`Save failed, queuing tasks for ${normalizedId}`);
        this.queueForRetry('tasks', normalizedId, arr);
        return { ok: false, queued: true, message: 'Save failed. Changes queued for retry.' };
      }

      return { ok: false };
    } catch (err) {
      console.warn('Direct contents API save failed:', err);
      // Queue on network errors
      if (!skipQueue && (err.name === 'TypeError' || err.message.includes('network') || err.message.includes('fetch'))) {
        this.queueForRetry('tasks', normalizedId, arr);
        return { ok: false, queued: true, message: 'Network error. Changes queued for retry.' };
      }
      return { ok: false, error: err.message };
    }
  }

  /**
   * Merge local tasks with remote tasks, preserving local changes
   * and adding any remote-only items
   */
  mergeTasks(localTasks, remoteTasks) {
    const localById = new Map();
    const localArr = Array.isArray(localTasks) ? localTasks : [];
    const remoteArr = Array.isArray(remoteTasks) ? remoteTasks : [];

    // Index local tasks by ID
    for (const task of localArr) {
      if (task && task.id) {
        localById.set(String(task.id), task);
      }
    }

    // Add remote-only tasks (tasks that exist remotely but not locally)
    for (const remoteTask of remoteArr) {
      if (remoteTask && remoteTask.id) {
        const id = String(remoteTask.id);
        if (!localById.has(id)) {
          localById.set(id, remoteTask);
        }
        // Local version takes precedence for existing tasks
      }
    }

    // Return merged array sorted by ID
    return Array.from(localById.values()).sort((a, b) =>
      String(a.id || '').localeCompare(String(b.id || ''))
    );
  }

  // ==================== APP METADATA SYNC ====================

  /**
   * Get SHA for app metadata file
   * @param {string} appId - App identifier
   * @returns {Promise<string|null>} - SHA or null if not found
   */
  async getAppMetadataSha(appId) {
    const normalizedId = normalizeAppId(appId);
    try {
      const url = `${this.baseUrl}/repos/${this.managerRepo}/contents/data/apps/${normalizedId}/metadata.json?ref=main`;
      const res = await this.makeApiRequest(url);
      if (!res || !res.ok) return null;
      const data = await res.json();
      return data.sha || null;
    } catch (_) {
      return null;
    }
  }

  /**
   * Fetch app metadata from backend
   * @param {string} appId - App identifier
   * @returns {Promise<Result>} - Result with metadata object or error
   */
  async fetchAppMetadata(appId) {
    const normalizedId = normalizeAppId(appId);
    try {
      if (!this.managerRepo || !normalizedId) {
        return err('Manager repo or app ID not configured');
      }
      const url = `${this.baseUrl}/repos/${this.managerRepo}/contents/data/apps/${normalizedId}/metadata.json?ref=main`;
      const res = await this.makeApiRequest(url);
      if (!res || !res.ok) {
        // 404 is expected for apps without metadata file yet
        if (res?.status === 404) {
          return ok(null);
        }
        return err('Failed to fetch app metadata', res?.status);
      }
      const data = await res.json();
      const content = typeof atob !== 'undefined' ? atob(data.content) : Buffer.from(data.content, 'base64').toString('utf-8');
      const parsed = JSON.parse(content);
      // Cache SHA for optimistic locking
      if (data.sha) {
        this.cacheSha(`metadata:${normalizedId}`, data.sha);
      }
      return ok(parsed);
    } catch (error) {
      return err(error);
    }
  }

  /**
   * Save app metadata to backend
   * @param {string} appId - App identifier
   * @param {Object} metadata - Metadata object to save
   * @param {number} retryCount - Current retry count for conflict resolution
   * @param {boolean} skipQueue - Skip offline queue (used during queue processing)
   * @returns {Promise<Object>} - Result object { ok, conflict?, queued?, message? }
   */
  async saveAppMetadata(appId, metadata, retryCount = 0, skipQueue = false) {
    const normalizedId = normalizeAppId(appId);
    const fileKey = `metadata:${normalizedId}`;

    // Extract only the fields we want to persist
    const metadataToSave = {
      id: normalizedId,
      description: metadata.description || '',
      notes: metadata.notes || '',
      platform: metadata.platform || 'Web',
      lastReviewDate: metadata.lastReviewDate || null,
      nextReviewDate: metadata.nextReviewDate || null,
      reviewCycle: metadata.reviewCycle || 90,
      updatedAt: new Date().toISOString()
    };

    // Check if offline - queue for later
    if (!this.isOnline() && !skipQueue) {
      console.log(`Offline: queuing metadata save for ${normalizedId}`);
      this.queueForRetry('metadata', normalizedId, metadataToSave);
      return { ok: false, queued: true, message: 'Changes saved locally. Will sync when online.' };
    }

    try {
      // Use cached SHA for optimistic locking, fallback to fresh fetch
      let sha = this.getCachedSha(fileKey);
      if (!sha) {
        sha = await this.getAppMetadataSha(normalizedId);
      }

      const url = `${this.baseUrl}/repos/${this.managerRepo}/contents/data/apps/${normalizedId}/metadata.json`;
      const headers = {
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json'
      };
      const pretty = JSON.stringify(metadataToSave, null, 2) + "\n";
      const content = this.encodeBase64(pretty);
      const body = {
        message: `Update metadata for ${normalizedId}`,
        content,
        branch: 'main',
        sha: sha || undefined
      };
      const res = await fetch(url, { method: 'PUT', headers, body: JSON.stringify(body), mode: 'cors' });

      // Handle 409 Conflict - SHA mismatch
      if (this.isConflictError(res)) {
        console.warn(`SHA conflict detected for ${fileKey}, attempt ${retryCount + 1}`);

        if (retryCount >= this.maxConflictRetries) {
          console.error(`Max conflict retries (${this.maxConflictRetries}) reached for ${fileKey}`);
          return { ok: false, conflict: true, message: 'File was modified. Please refresh and try again.' };
        }

        // Clear stale SHA and refetch
        this.clearCachedSha(fileKey);

        // Fetch latest version and merge (local takes precedence)
        const remoteResult = await this.fetchAppMetadata(normalizedId);
        if (!remoteResult.success) {
          return { ok: false, conflict: true, message: 'Failed to fetch latest version for merge.' };
        }

        // Merge: local values take precedence, remote fills gaps
        const remote = remoteResult.data || {};
        const merged = { ...remote, ...metadataToSave };

        // Retry with merged data
        await this.delay(500 * (retryCount + 1));
        return this.saveAppMetadata(normalizedId, merged, retryCount + 1, skipQueue);
      }

      if (res && res.ok) {
        // Update SHA cache with new SHA from response
        try {
          const responseData = await res.json();
          if (responseData.content && responseData.content.sha) {
            this.cacheSha(fileKey, responseData.content.sha);
          }
        } catch (_) {
          this.clearCachedSha(fileKey);
        }
        return { ok: true };
      }

      // Network error or other failure - queue for retry
      if (!skipQueue) {
        console.log(`Save failed, queuing metadata for ${normalizedId}`);
        this.queueForRetry('metadata', normalizedId, metadataToSave);
        return { ok: false, queued: true, message: 'Save failed. Changes queued for retry.' };
      }

      return { ok: false };
    } catch (err) {
      console.warn('Save metadata failed:', err);
      // Queue on network errors
      if (!skipQueue && (err.name === 'TypeError' || err.message.includes('network') || err.message.includes('fetch'))) {
        this.queueForRetry('metadata', normalizedId, metadataToSave);
        return { ok: false, queued: true, message: 'Network error. Changes queued for retry.' };
      }
      return { ok: false, error: err.message };
    }
  }

  // ==================== YAML UTILITIES ====================

  /**
   * Convert object to YAML string (simple flat objects only)
   * Preserves multi-line strings using YAML literal block scalar (|)
   * @param {Object} obj - Object to serialize
   * @returns {string} - YAML string
   */
  toYaml(obj) {
    const lines = [];
    for (const [key, value] of Object.entries(obj)) {
      if (value === null || value === undefined) continue;

      if (typeof value === 'string') {
        // Check if string contains newlines
        if (value.includes('\n') || value.includes('\r')) {
          // Use literal block scalar (|) to preserve multi-line content
          const indentedLines = value
            .replace(/\r\n/g, '\n')
            .split('\n')
            .map(line => `  ${line}`)
            .join('\n');
          lines.push(`${key}: |\n${indentedLines}`);
        } else {
          lines.push(`${key}: ${value}`);
        }
      } else if (typeof value === 'object') {
        lines.push(`${key}: ${JSON.stringify(value)}`);
      } else {
        lines.push(`${key}: ${value}`);
      }
    }
    return lines.join('\n') + '\n';
  }

  async getIdeaSha(ideaId) {
    try {
      const url = `${this.baseUrl}/repos/${this.managerRepo}/contents/data/ideas/${ideaId}.yml?ref=main`;
      const res = await this.makeApiRequest(url);
      if (!res || !res.ok) return null;
      const data = await res.json();
      return data.sha || null;
    } catch (_) {
      return null;
    }
  }

  async saveIdeaYaml(idea, skipQueue = false) {
    // Check if offline - queue for later
    if (!this.isOnline() && !skipQueue) {
      console.log(`Offline: queuing idea save for ${idea.id}`);
      this.queueForRetry('ideas', idea.id, idea);
      return { ok: false, queued: true, message: 'Changes saved locally. Will sync when online.' };
    }

    try {
      const sha = await this.getIdeaSha(idea.id);
      const url = `${this.baseUrl}/repos/${this.managerRepo}/contents/data/ideas/${idea.id}.yml`;
      const headers = {
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json'
      };
      const payload = {
        id: idea.id,
        conceptName: idea.conceptName || idea.title || '',
        problemSolved: idea.problemSolved || '',
        targetAudience: idea.targetAudience || '',
        techStack: idea.techStack || '',
        riskRating: idea.riskRating || '',
        dateCreated: idea.dateCreated || new Date().toISOString(),
        initialFeatures: idea.initialFeatures || '',
        submittedBy: idea.submittedBy || '',
        contactEmail: idea.contactEmail || '',
        status: idea.status || null,
        implementedDate: idea.implementedDate || idea.createdDate || null,
        comments: JSON.stringify(idea.comments || []),
      };
      const yamlContent = this.toYaml(payload);
      const content = this.encodeBase64(yamlContent);
      const body = {
        message: `Save idea ${idea.id} as YAML`,
        content,
        branch: 'main',
        sha: sha || undefined
      };
      const res = await fetch(url, { method: 'PUT', headers, body: JSON.stringify(body), mode: 'cors' });

      if (res && res.ok) {
        return { ok: true };
      }

      // Network error or other failure - queue for retry
      if (!skipQueue) {
        console.log(`Save failed, queuing idea for ${idea.id}`);
        this.queueForRetry('ideas', idea.id, idea);
        return { ok: false, queued: true, message: 'Save failed. Changes queued for retry.' };
      }

      return { ok: false };
    } catch (err) {
      console.warn('Saving idea YAML failed:', err);
      // Queue on network errors
      if (!skipQueue && (err.name === 'TypeError' || err.message.includes('network') || err.message.includes('fetch'))) {
        this.queueForRetry('ideas', idea.id, idea);
        return { ok: false, queued: true, message: 'Network error. Changes queued for retry.' };
      }
      return { ok: false, error: err.message };
    }
  }

  /**
   * Get comprehensive repository data including commits and tags
   */
  async getComprehensiveRepoData(repoUrl) {
    console.log('Getting comprehensive data for:', repoUrl);
    try {
      const repoData = await this.fetchRepoData(repoUrl);
      
      // If we got fallback data, return it immediately
      if (repoData.isFallback) {
        console.log('Using fallback data for:', repoUrl);
        return repoData;
      }
      
      console.log('Fetched repository data:', repoData.name);

      // Fetch additional data in parallel
      const [commits, tags, views, clones] = await Promise.allSettled([
        this.fetchLastCommit(repoData.owner.login, repoData.name),
        this.fetchLatestTag(repoData.owner.login, repoData.name),
        this.fetchTrafficViews(repoData.owner.login, repoData.name),
        this.fetchTrafficClones(repoData.owner.login, repoData.name)
      ]);

      // Extract relevant data
      const result = {
        id: repoData.full_name.replace('/', '-'),
        name: repoData.name,
        fullName: repoData.full_name,
        description: repoData.description,
        lastCommitDate: commits.status === 'fulfilled' && commits.value[0] 
          ? commits.value[0].commit.author.date 
          : null,
        latestTag: tags.status === 'fulfilled' && tags.value[0] 
          ? tags.value[0].name 
          : null,
        stars: repoData.stargazers_count,
        language: repoData.language,
        isPrivate: repoData.private,
        archived: repoData.archived,
        updatedAt: repoData.updated_at,
        url: repoData.html_url,
        recentViews: views.status === 'fulfilled' && views.value ? views.value.count || 0 : 0,
        recentClones: clones.status === 'fulfilled' && clones.value ? clones.value.count || 0 : 0,
        uniqueViews: views.status === 'fulfilled' && views.value ? views.value.uniques || 0 : 0,
        uniqueClones: clones.status === 'fulfilled' ? clones.value.uniques || 0 : 0,
        isFallback: false
      };

      return result;
    } catch (error) {
      console.error('Failed to get comprehensive repo data:', error);
      return null;
    }
  }



  /**
   * Fetch all public user repositories
   */
  async fetchUserRepos() {
    console.log('Fetching public user repositories from GitHub...');

    // Fetch only public repositories
    const repos = await this.fetchWithRetry('/user/repos', {
      per_page: DEFAULT_REPOS_PER_PAGE,
      sort: 'updated',
      direction: 'desc',
      visibility: 'public'  // Only fetch public repositories
    });

    console.log(`Found ${repos.length} public repositories`);
    return repos;
  }
  /**
   * Fetch public repositories for a given username (no auth required)
   */
  async fetchPublicReposForUser(username) {
    console.log(`Fetching public repositories for user: ${username}`);
    const repos = await this.fetchWithRetry(`/users/${username}/repos`, {
      per_page: DEFAULT_REPOS_PER_PAGE,
      sort: 'updated',
      direction: 'desc'
    });
    console.log(`Found ${repos.length} public repositories for ${username}`);
    return repos;
  }

  /**
   * Check if API key is configured
   */
  isApiKeyConfigured() {
    const url = this.baseUrl || '';
    const onGhPages = typeof window !== 'undefined' ? window.location.hostname.endsWith('github.io') : false;
    const configured = url.startsWith('http') || (!onGhPages && url.startsWith('/'));
    console.log('API backend configured:', configured);
    return configured;
  }

  /**
   * Get API rate limit status
   */
  async getRateLimitStatus() {
    try {
      const response = await this.makeApiRequest(`${this.baseUrl}/rate_limit`);
      if (response.ok) {
        return await response.json();
      }
      return null;
    } catch (error) {
      console.error('Failed to get rate limit status:', error);
      return null;
    }
  }

  /**
   * Parse simple YAML string to object (inline implementation)
   * Handles flat key-value YAML and literal block scalars (|) without external dependencies
   * @param {string} text - YAML string to parse
   * @returns {Object} - Parsed object
   */
  parseSimpleYaml(text) {
    try {
      const obj = {};
      const lines = String(text || '').split(/\r?\n/);
      let currentKey = null;
      let multiLineValue = [];
      let inMultiLine = false;

      for (let i = 0; i < lines.length; i++) {
        const raw = lines[i];
        const trimmed = raw.trim();

        // Skip empty lines and comments (unless in multi-line mode)
        if (!inMultiLine && (!trimmed || trimmed.startsWith('#'))) continue;

        // Check if this is an indented line (part of multi-line value)
        if (inMultiLine) {
          // Check if line is indented (part of multi-line block)
          if (raw.startsWith('  ') || raw.startsWith('\t')) {
            // Remove the 2-space indent and add to multi-line value
            multiLineValue.push(raw.slice(2));
            continue;
          } else if (trimmed === '') {
            // Empty line in multi-line block
            multiLineValue.push('');
            continue;
          } else {
            // Non-indented line means end of multi-line block
            obj[currentKey] = multiLineValue.join('\n');
            inMultiLine = false;
            currentKey = null;
            multiLineValue = [];
            // Fall through to process this line as a new key
          }
        }

        const idx = trimmed.indexOf(':');
        if (idx === -1) continue;

        const key = trimmed.slice(0, idx).trim();
        let val = trimmed.slice(idx + 1).trim();

        // Check for literal block scalar indicator
        if (val === '|' || val === '|-' || val === '|+') {
          inMultiLine = true;
          currentKey = key;
          multiLineValue = [];
          continue;
        }

        // Handle quoted strings
        if ((val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }

        // Handle booleans
        if (val === 'true') val = true;
        else if (val === 'false') val = false;
        // Handle null
        else if (val === 'null' || val === '~' || val === '') val = null;
        // Handle numbers
        else if (/^-?\d+$/.test(val)) val = parseInt(val, 10);
        else if (/^-?\d+\.\d+$/.test(val)) val = parseFloat(val);
        // Handle JSON arrays/objects embedded in YAML
        else if ((val.startsWith('[') && val.endsWith(']')) ||
                 (val.startsWith('{') && val.endsWith('}'))) {
          try {
            val = JSON.parse(val);
          } catch (_) {
            // Keep as string if JSON parse fails
          }
        }

        obj[key] = val;
      }

      // Handle case where file ends while still in multi-line mode
      if (inMultiLine && currentKey) {
        obj[currentKey] = multiLineValue.join('\n');
      }

      // Handle special case: comments field that's stored as JSON string
      if (obj.comments && typeof obj.comments === 'string') {
        try {
          obj.comments = JSON.parse(obj.comments);
        } catch (_) {
          obj.comments = [];
        }
      }

      return obj;
    } catch (error) {
      console.error('Error parsing YAML:', error);
      return {};
    }
  }

  async listIdeaFiles() {
    try {
      const url = `${this.baseUrl}/repos/${this.managerRepo}/contents/data/ideas?ref=main`;
      const res = await this.makeApiRequest(url);
      if (!res || !res.ok) return [];
      const arr = await res.json();
      return Array.isArray(arr) ? arr.filter(f => /\.ya?ml$/i.test(f.name)) : [];
    } catch (_) {
      return [];
    }
  }

  async fetchIdeaYamlByPath(path) {
    try {
      const url = `${this.baseUrl}/repos/${this.managerRepo}/contents/${path}?ref=main`;
      const res = await this.makeApiRequest(url);
      if (!res || !res.ok) return null;
      const data = await res.json();
      const content = typeof atob !== 'undefined' ? atob(data.content) : Buffer.from(data.content, 'base64').toString('utf-8');
      return this.parseSimpleYaml(content);
    } catch (_) {
      return null;
    }
  }

  async fetchIdeasFromRepo() {
    if (!this.managerRepo) return [];
    const files = await this.listIdeaFiles();
    const results = [];
    for (const f of files) {
      const idea = await this.fetchIdeaYamlByPath(`data/ideas/${f.name}`);
      if (idea && idea.id) results.push(idea);
    }
    return results;
  }

  /**
   * Delay utility function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Validate GitHub repository URL format
   */
  validateRepoUrl(url) {
    if (!url || typeof url !== 'string') {
      return false;
    }

    // Check for basic GitHub URL format
    const githubPattern = /^https?:\/\/github\.com\/[a-zA-Z0-9-_.]+\/[a-zA-Z0-9-_.]+\/?$/;
    return githubPattern.test(url);
  }

  /**
   * Extract repository information from URL
   */
  extractRepoInfo(url) {
    if (!this.validateRepoUrl(url)) {
      return null;
    }

    const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) {
      return null;
    }

    return {
      owner: match[1],
      repo: match[2].replace(/\.git$/, ''),
      apiUrl: `${this.baseUrl}/repos/${match[1]}/${match[2].replace(/\.git$/, '')}`
    };
  }
}

// Create and export singleton instance
const apiService = new ApiService();
export default apiService;