/**
 * ApiService - GitHub API integration with retry logic and error handling
 * Handles external API calls for repository metadata
 */

import { ok, err } from '../utils/result.js';
import { normalizeAppId } from '../utils/helpers.js';
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
    // Merge remote tasks to avoid overwriting existing entries
    let merged = Array.isArray(tasks) ? tasks.slice() : [];
    try {
      const remoteResult = await this.fetchRepoTasks(normalizedId);
      const remote = remoteResult.success ? (remoteResult.data || []) : [];
      const keyOf = (t) => (t && t.id ? String(t.id) : `${t?.title || ''}|${t?.dueDate || ''}`);
      const keys = new Set(merged.map(keyOf));
      const toAdd = remote.filter(rt => !keys.has(keyOf(rt)));
      merged = [...merged, ...toAdd];
      merged.sort((a,b) => String(a.id||'').localeCompare(String(b.id||'')));
    } catch (e) {
      console.warn('Could not merge remote tasks, proceeding with local tasks only:', e);
    }
    const body = {
      event_type: 'save_tasks',
      client_payload: {
        app_id: normalizedId,
        tasks_json: JSON.stringify(merged)
      }
    };
    const url = `${this.baseUrl}/repos/${this.managerRepo}/dispatches`;
    try {
      const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), mode: 'cors' });
      if (res && res.ok) return res;
      console.warn('Dispatch failed, falling back to direct contents API');
    } catch (err) {
      console.warn('Dispatch error, falling back to direct contents API:', err);
    }
    const fallback = await this.saveTasksViaContents(normalizedId, merged);
    return { ok: fallback };
  }

  async fetchRepoTasks(appId) {
    const normalizedId = normalizeAppId(appId);
    try {
      if (!this.managerRepo || !normalizedId) {
        return err('Manager repo or app ID not configured');
      }
      if (this.tasksCache.has(normalizedId)) {
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

  async fetchAppReviews(appId) {
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

  async saveAppReviews(appId, reviews) {
    const normalizedId = normalizeAppId(appId);
    try {
      const sha = await this.getReviewsSha(normalizedId);
      const url = `${this.baseUrl}/repos/${this.managerRepo}/contents/data/reviews/${normalizedId}/reviews.json`;
      const headers = {
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json'
      };
      const pretty = JSON.stringify(Array.isArray(reviews) ? reviews : [], null, 2) + "\n";
      const content = this.encodeBase64(pretty);
      const body = {
        message: `Update reviews for ${normalizedId}`,
        content,
        branch: 'main',
        sha: sha || undefined
      };
      const res = await fetch(url, { method: 'PUT', headers, body: JSON.stringify(body), mode: 'cors' });
      return !!(res && res.ok);
    } catch (err) {
      return false;
    }
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

  async saveTasksViaContents(appId, tasks) {
    const normalizedId = normalizeAppId(appId);
    try {
      const sha = await this.getFileSha(normalizedId);
      const url = `${this.baseUrl}/repos/${this.managerRepo}/contents/data/tasks/${normalizedId}/tasks.json`;
      const headers = {
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json'
      };
      const arr = Array.isArray(tasks) ? tasks.slice() : [];
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
      return !!(res && res.ok);
    } catch (err) {
      console.warn('Direct contents API save failed:', err);
      return false;
    }
  }

  toYaml(obj) {
    const lines = [];
    const write = (key, value, indent = '') => {
      if (value === null || value === undefined) return;
      if (typeof value === 'object' && !Array.isArray(value)) {
        lines.push(`${indent}${key}:`);
        Object.keys(value).forEach(k => write(k, value[k], indent + '  '));
      } else if (Array.isArray(value)) {
        lines.push(`${indent}${key}:`);
        value.forEach(v => {
          if (typeof v === 'object') {
            lines.push(`${indent}  -`);
            Object.keys(v).forEach(k => write(k, v[k], indent + '    '));
          } else {
            lines.push(`${indent}  - ${String(v)}`);
          }
        });
      } else {
        const s = String(value).replace(/\r?\n/g, ' ');
        lines.push(`${indent}${key}: ${s}`);
      }
    };
    Object.keys(obj).forEach(k => write(k, obj[k]));
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

  async saveIdeaYaml(idea) {
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
        comments: JSON.stringify(idea.comments || []),
      };
      const yaml = this.toYaml(payload);
      const content = this.encodeBase64(yaml);
      const body = {
        message: `Save idea ${idea.id} as YAML`,
        content,
        branch: 'main',
        sha: sha || undefined
      };
      const res = await fetch(url, { method: 'PUT', headers, body: JSON.stringify(body), mode: 'cors' });
      return !!(res && res.ok);
    } catch (err) {
      console.warn('Saving idea YAML failed:', err);
      return false;
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

  parseSimpleYaml(text) {
    const obj = {};
    const lines = String(text || '').split(/\r?\n/);
    for (const raw of lines) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const idx = line.indexOf(':');
      if (idx === -1) continue;
      const key = line.slice(0, idx).trim();
      let val = line.slice(idx + 1).trim();

      // Parse comments field as JSON array
      if (key === 'comments' && val.startsWith('[')) {
        try {
          val = JSON.parse(val);
        } catch (e) {
          val = [];
        }
      }

      obj[key] = val;
    }
    return obj;
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