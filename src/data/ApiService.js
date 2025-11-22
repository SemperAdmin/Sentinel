/**
 * ApiService - GitHub API integration with retry logic and error handling
 * Handles external API calls for repository metadata
 */

class ApiService {
  constructor() {
    this.baseUrl = 'https://api.github.com';
    this.retryAttempts = 3;
    this.retryDelay = 1000; // Start with 1 second
    this.maxDelay = 30000; // Max 30 seconds
    
    this.githubToken = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_GITHUB_API_KEY) 
      || (typeof window !== 'undefined' ? window.GITHUB_API_KEY : '') 
      || '';
    this.managerRepo = window.MANAGER_REPO_FULL_NAME || '';
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
    const url = new URL(`${this.baseUrl}${endpoint}`);
    
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
  async makeApiRequest(url) {
    const headers = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Sentinel-App-Portfolio-Manager/1.0'
    };

    // Add authentication if API key is provided
    if (this.githubToken) {
      headers['Authorization'] = `Bearer ${this.githubToken}`;
      console.log('Using GitHub API token for authentication');
    } else {
      console.log('No GitHub API token configured, using unauthenticated requests');
    }

    return fetch(url, {
      method: 'GET',
      headers: headers,
      mode: 'cors'
    });
  }

  /**
   * Trigger repository_dispatch to save tasks via GitHub Actions
   */
  async triggerSaveTasks(appId, tasks) {
    if (!this.managerRepo) {
      console.warn('Manager repository not configured (window.MANAGER_REPO_FULL_NAME)');
      return { ok: false, error: 'Manager repo not configured' };
    }
    const headers = {
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'Sentinel-App-Portfolio-Manager/1.0',
      'Authorization': this.githubToken ? `Bearer ${this.githubToken}` : undefined,
      'Content-Type': 'application/json'
    };
    const body = {
      event_type: 'save_tasks',
      client_payload: {
        app_id: appId,
        tasks_json: JSON.stringify(tasks || [])
      }
    };
    const url = `https://api.github.com/repos/${this.managerRepo}/dispatches`;
    try {
      const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), mode: 'cors' });
      if (res && res.ok) return res;
      console.warn('Dispatch failed, falling back to direct contents API');
    } catch (err) {
      console.warn('Dispatch error, falling back to direct contents API:', err);
    }
    const fallback = await this.saveTasksViaContents(appId, tasks || []);
    return { ok: fallback };
  }

  async fetchRepoTasks(appId) {
    if (!this.managerRepo || !appId) {
      return null;
    }
    if (this.tasksCache.has(appId)) {
      return this.tasksCache.get(appId);
    }
    const url = `https://api.github.com/repos/${this.managerRepo}/contents/data/tasks/${appId}/tasks.json?ref=main`;
    const res = await this.makeApiRequest(url);
    if (!res || !res.ok) {
      return null;
    }
    const data = await res.json();
    const content = typeof atob !== 'undefined' ? atob(data.content) : Buffer.from(data.content, 'base64').toString('utf-8');
    try {
      const parsed = JSON.parse(content);
      const tasks = Array.isArray(parsed) ? parsed : [];
      this.tasksCache.set(appId, tasks);
      return tasks;
    } catch (_) {
      return null;
    }
  }

  encodeBase64(text) {
    try {
      return btoa(unescape(encodeURIComponent(text)));
    } catch (_) {
      return Buffer.from(text, 'utf-8').toString('base64');
    }
  }

  async getFileSha(appId) {
    try {
      const url = `https://api.github.com/repos/${this.managerRepo}/contents/data/tasks/${appId}/tasks.json?ref=main`;
      const res = await this.makeApiRequest(url);
      if (!res || !res.ok) return null;
      const data = await res.json();
      return data.sha || null;
    } catch (_) {
      return null;
    }
  }

  async saveTasksViaContents(appId, tasks) {
    try {
      const sha = await this.getFileSha(appId);
      const url = `https://api.github.com/repos/${this.managerRepo}/contents/data/tasks/${appId}/tasks.json`;
      const headers = {
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'Sentinel-App-Portfolio-Manager/1.0',
        'Authorization': this.githubToken ? `Bearer ${this.githubToken}` : undefined,
        'Content-Type': 'application/json'
      };
      const arr = Array.isArray(tasks) ? tasks.slice() : [];
      arr.sort((a,b) => String(a.id||'').localeCompare(String(b.id||'')));
      const pretty = JSON.stringify(arr, null, 2) + "\n";
      const content = this.encodeBase64(pretty);
      const body = {
        message: `Save tasks for ${appId} (direct contents API)`,
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
        recentViews: views.status === 'fulfilled' ? views.value.count || 0 : 0,
        recentClones: clones.status === 'fulfilled' ? clones.value.count || 0 : 0,
        uniqueViews: views.status === 'fulfilled' ? views.value.uniques || 0 : 0,
        uniqueClones: clones.status === 'fulfilled' ? clones.value.uniques || 0 : 0,
        isFallback: false
      };

      return result;
    } catch (error) {
      console.error('Failed to get comprehensive repo data:', error);
      return this.getFallbackData();
    }
  }



  /**
   * Fetch all public user repositories
   */
  async fetchUserRepos() {
    console.log('Fetching public user repositories from GitHub...');
    
    // Fetch only public repositories
    const repos = await this.fetchWithRetry('/user/repos', { 
      per_page: 100, 
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
      per_page: 100,
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
    const configured = !!this.githubToken && this.githubToken !== 'YOUR_API_KEY_HERE';
    console.log('API key configured (env/window):', configured);
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
      apiUrl: `https://api.github.com/repos/${match[1]}/${match[2].replace(/\.git$/, '')}`
    };
  }
}

// Create and export singleton instance
const apiService = new ApiService();
export default apiService;