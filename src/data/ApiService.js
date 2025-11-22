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
  }

  /**
   * Fetch repository data with exponential backoff retry logic
   */
  async fetchRepoData(repoUrl) {
    if (!repoUrl || !repoUrl.includes('github.com')) {
      console.warn('Invalid GitHub repository URL:', repoUrl);
      return this.getFallbackData();
    }

    // Extract owner and repo from URL
    const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) {
      console.warn('Could not parse GitHub repository URL:', repoUrl);
      return this.getFallbackData();
    }

    const [, owner, repo] = match;
    const cleanRepo = repo.replace(/\.git$/, ''); // Remove .git suffix if present

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
   * Make API request with exponential backoff retry logic
   */
  async fetchWithRetry(endpoint, params = {}) {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    
    // Add query parameters
    Object.keys(params).forEach(key => {
      url.searchParams.append(key, params[key]);
    });

    let lastError;
    
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
          return this.getFallbackData();
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
    
    console.error('All API attempts failed, returning fallback data');
    return this.getFallbackData();
  }

  /**
   * Make actual API request with proper headers
   */
  async makeApiRequest(url) {
    const headers = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'APM-Portfolio-Manager/1.0'
    };

    // Add authentication if API key is provided
    if (window.GITHUB_API_KEY && window.GITHUB_API_KEY !== 'YOUR_API_KEY_HERE') {
      headers['Authorization'] = `token ${window.GITHUB_API_KEY}`;
    }

    return fetch(url, {
      method: 'GET',
      headers: headers,
      mode: 'cors'
    });
  }

  /**
   * Get comprehensive repository data including commits and tags
   */
  async getComprehensiveRepoData(repoUrl) {
    try {
      const repoData = await this.fetchRepoData(repoUrl);
      
      // If we got fallback data, return it immediately
      if (repoData.isFallback) {
        return repoData;
      }

      // Fetch additional data in parallel
      const [commits, tags] = await Promise.allSettled([
        this.fetchLastCommit(repoData.owner.login, repoData.name),
        this.fetchLatestTag(repoData.owner.login, repoData.name)
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
        isFallback: false
      };

      return result;
    } catch (error) {
      console.error('Failed to get comprehensive repo data:', error);
      return this.getFallbackData();
    }
  }

  /**
   * Get fallback data when API fails
   */
  getFallbackData() {
    return {
      id: 'unknown-repo',
      name: 'Unknown Repository',
      fullName: 'user/unknown-repo',
      description: 'Repository data unavailable - API access failed or repo not found',
      lastCommitDate: null,
      latestTag: null,
      stars: 0,
      language: 'Unknown',
      isPrivate: false,
      archived: false,
      updatedAt: null,
      url: '#',
      isFallback: true
    };
  }

  /**
   * Check if API key is configured
   */
  isApiKeyConfigured() {
    return window.GITHUB_API_KEY && window.GITHUB_API_KEY !== 'YOUR_API_KEY_HERE';
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