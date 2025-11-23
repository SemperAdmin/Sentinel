/**
 * DataController - Handles all data loading and GitHub operations
 * Separates data concerns from UI orchestration
 */

import dataStore from '../data/DataStore.js';
import apiService from '../data/ApiService.js';
import { unwrapOr } from '../utils/result.js';
import { batchProcess } from '../utils/batchProcessor.js';
import errorHandler, { ErrorType, ErrorSeverity, RecoveryStrategies } from '../utils/errorHandler.js';
import {
  REVIEW_CYCLE_DAYS,
  GITHUB_API_DELAY_MS,
  MAX_CONCURRENT_API_REQUESTS,
  IMPROVEMENT_BUDGET_PERCENT,
  DEFAULT_GITHUB_USER
} from '../utils/constants.js';

/**
 * @typedef {Object} App
 * @property {string} id
 * @property {string} repoUrl
 * @property {string} platform
 * @property {string} status
 * @property {string|null} lastReviewDate
 * @property {string|null} nextReviewDate
 * @property {number} pendingTodos
 * @property {string} notes
 * @property {string|null} lastCommitDate
 * @property {string|null} latestTag
 * @property {number} stars
 * @property {string} language
 * @property {boolean} isPrivate
 * @property {boolean} archived
 * @property {Array} todos
 * @property {Array} improvements
 * @property {string} developerNotes
 * @property {number} improvementBudget
 * @property {string} currentSprint
 */

export class DataController {
  constructor() {
    this.defaultGitHubUser = DEFAULT_GITHUB_USER;
  }

  /**
   * Load initial portfolio data with triple-fallback strategy
   * @returns {Promise<App[]>}
   */
  async loadPortfolioData() {
    try {
      // Triple-fallback: repo JSON → local storage → fresh GitHub fetch
      const portfolio = await RecoveryStrategies.withFallback(
        // Primary: fetch from repo
        async () => {
          const portfolioResult = await apiService.fetchPortfolioOverview();
          const data = unwrapOr(portfolioResult, []);
          if (!Array.isArray(data) || data.length === 0) {
            throw new Error('No portfolio data in repo');
          }
          console.log('Loaded portfolio overview from repo JSON');
          // Save to local store
          for (const app of data) {
            await dataStore.saveApp(app);
          }
          return data;
        },
        // Fallback: load from local storage
        async () => {
          console.log('Falling back to local portfolio data');
          const localData = await dataStore.getPortfolio();
          if (!localData || localData.length === 0) {
            throw new Error('No local portfolio data available');
          }
          return localData;
        }
      ).catch(async (error) => {
        // Ultimate fallback: fetch fresh from GitHub
        errorHandler.logError(ErrorType.DATA, ErrorSeverity.HIGH, 'Failed to load portfolio from all sources', error);
        console.log('Attempting to fetch fresh data from GitHub...');
        return await this.fetchUserRepositories();
      });

      // Clean up private repos and excluded repos
      const filteredPortfolio = this.filterPortfolio(portfolio);

      // Save cleaned data
      if (filteredPortfolio.length !== portfolio.length) {
        for (const app of filteredPortfolio) {
          await dataStore.saveApp(app);
        }
      }

      return filteredPortfolio;
    } catch (error) {
      errorHandler.logError(ErrorType.DATA, ErrorSeverity.CRITICAL, 'Failed to load portfolio data', error);
      throw error;
    }
  }

  /**
   * Filter out private repos and excluded repos
   * @param {App[]} portfolio
   * @returns {App[]}
   */
  filterPortfolio(portfolio) {
    if (!portfolio || portfolio.length === 0) return [];

    const filtered = portfolio.filter(app => !app.isPrivate && app.id !== 'eventcall-images');
    const removedCount = portfolio.length - filtered.length;

    if (removedCount > 0) {
      console.log(`Filtered out ${removedCount} repositories (private or excluded)`);
    }

    return filtered;
  }

  /**
   * Fetch user repositories from GitHub
   * @returns {Promise<App[]>}
   */
  async fetchUserRepositories() {
    try {
      // Check if API key is configured
      let repos;
      if (!apiService.isApiKeyConfigured()) {
        repos = await apiService.fetchPublicReposForUser(this.defaultGitHubUser);
      } else {
        console.log('Fetching user repositories from GitHub...');
        try {
          repos = await apiService.fetchUserRepos();
        } catch (err) {
          console.warn('Authenticated repo fetch failed, falling back to public repos:', err);
          repos = await apiService.fetchPublicReposForUser(this.defaultGitHubUser);
        }
      }

      // Filter to only public repositories and exclude image/asset repos
      const publicRepos = repos.filter(repo => !repo.private && repo.name !== 'eventcall-images');
      console.log(`Filtering ${repos.length} total repos to ${publicRepos.length} public repos (excluded eventcall-images)`);

      // Convert GitHub repositories to app format
      const apps = publicRepos.map(repo => this.convertRepoToApp(repo));

      console.log(`Successfully fetched ${apps.length} repositories from GitHub`);
      return apps;
    } catch (error) {
      errorHandler.logError(ErrorType.API, ErrorSeverity.HIGH, 'Failed to fetch user repositories', error);
      console.error('Failed to fetch user repositories:', error);
      return [];
    }
  }

  /**
   * Convert GitHub repo to App format
   * @param {Object} repo - GitHub repository object
   * @returns {App}
   */
  convertRepoToApp(repo) {
    return {
      id: repo.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      repoUrl: repo.html_url,
      platform: 'Web',
      status: 'Active',
      lastReviewDate: null,
      nextReviewDate: this.calculateNextReviewDate(repo.updated_at, null),
      pendingTodos: 0,
      notes: repo.description || 'No description available',
      lastCommitDate: repo.updated_at,
      latestTag: null,
      stars: repo.stargazers_count,
      language: repo.language,
      isPrivate: repo.private,
      archived: repo.archived,
      todos: [],
      improvements: [],
      developerNotes: '',
      improvementBudget: IMPROVEMENT_BUDGET_PERCENT,
      currentSprint: 'Q1 2025'
    };
  }

  /**
   * Calculate next review date based on review cycle
   * @param {string|null} lastCommitDate
   * @param {string|null} lastReviewDate
   * @returns {string} ISO date string
   */
  calculateNextReviewDate(lastCommitDate = null, lastReviewDate = null) {
    const reviewDate = new Date();

    // Determine the latest date between last commit and last review
    let baseDate = null;
    if (lastCommitDate && lastReviewDate) {
      const commitDate = new Date(lastCommitDate);
      const reviewDateObj = new Date(lastReviewDate);
      baseDate = commitDate > reviewDateObj ? lastCommitDate : lastReviewDate;
    } else if (lastCommitDate) {
      baseDate = lastCommitDate;
    } else if (lastReviewDate) {
      baseDate = lastReviewDate;
    }

    if (baseDate) {
      reviewDate.setTime(new Date(baseDate).getTime());
      reviewDate.setDate(reviewDate.getDate() + REVIEW_CYCLE_DAYS);
    } else {
      reviewDate.setDate(reviewDate.getDate() + REVIEW_CYCLE_DAYS);
    }

    return reviewDate.toISOString().split('T')[0];
  }

  /**
   * Fetch GitHub data for apps using batch processing
   * @param {App[]} apps
   * @param {Function} onUpdate - Callback for each updated app
   * @returns {Promise<{success: number, errors: number}>}
   */
  async fetchGitHubDataForApps(apps, onUpdate) {
    if (!apps || apps.length === 0) {
      return { success: 0, errors: 0 };
    }

    // Check if API backend is configured
    if (!apiService.isApiKeyConfigured()) {
      console.warn('API backend not configured. Cannot fetch live data.');
      return { success: 0, errors: 0 };
    }

    console.log('Fetching GitHub data using batch processing...');

    // Filter to only public repos with valid URLs
    const shouldProcess = (app) => {
      return !app.isPrivate && app.repoUrl && this.isValidGitHubUrl(app.repoUrl);
    };

    // Process function for each app
    const processApp = async (app) => {
      const repoData = await apiService.getComprehensiveRepoData(app.repoUrl);

      // Update app with GitHub data
      const updatedApp = {
        ...app,
        lastCommitDate: repoData.lastCommitDate,
        latestTag: repoData.latestTag,
        description: repoData.description || app.description,
        nextReviewDate: this.calculateNextReviewDate(repoData.lastCommitDate, app.lastReviewDate)
      };

      // Save to data store
      await dataStore.saveApp(updatedApp);

      // Notify callback
      if (onUpdate) {
        onUpdate(updatedApp);
      }

      return updatedApp;
    };

    // Batch process with concurrency control
    const results = await batchProcess(apps, processApp, {
      concurrency: MAX_CONCURRENT_API_REQUESTS,
      delayMs: GITHUB_API_DELAY_MS / 2,
      shouldProcess
    });

    const successCount = results.filter(r => !r.error).length;
    const errorCount = results.filter(r => r.error).length;

    console.log(`GitHub data fetch complete: ${successCount} apps updated, ${errorCount} errors`);

    // Log errors
    results.filter(r => r.error).forEach(({ item, error }) => {
      errorHandler.logError(ErrorType.API, ErrorSeverity.MEDIUM, `Failed to fetch data for ${item?.id}`, error);
    });

    return { success: successCount, errors: errorCount };
  }

  /**
   * Validate GitHub URL
   * @param {string} url
   * @returns {boolean}
   */
  isValidGitHubUrl(url) {
    if (!url || typeof url !== 'string') return false;
    return url.includes('github.com') && (url.startsWith('http://') || url.startsWith('https://'));
  }

  /**
   * Load ideas from local and remote sources
   * @returns {Promise<Array>}
   */
  async loadIdeas() {
    try {
      const localIdeas = await dataStore.getIdeas();

      // Try to fetch remote ideas
      try {
        const remoteIdeas = await apiService.fetchIdeasFromRepo();
        if (Array.isArray(remoteIdeas) && remoteIdeas.length > 0) {
          return this.mergeIdeas(localIdeas || [], remoteIdeas);
        }
      } catch (err) {
        console.warn('Failed to fetch remote ideas:', err);
      }

      return localIdeas || [];
    } catch (error) {
      errorHandler.logError(ErrorType.DATA, ErrorSeverity.LOW, 'Failed to load ideas', error);
      return [];
    }
  }

  /**
   * Merge local and remote ideas
   * @param {Array} localIdeas
   * @param {Array} remoteIdeas
   * @returns {Array}
   */
  mergeIdeas(localIdeas, remoteIdeas) {
    const byId = new Map(localIdeas.map(i => [i.id, i]));
    const merged = [...localIdeas];

    for (const ri of remoteIdeas) {
      if (!byId.has(ri.id)) {
        merged.push({
          id: ri.id,
          conceptName: ri.conceptName || ri.id,
          problemSolved: ri.problemSolved || '',
          targetAudience: ri.targetAudience || '',
          techStack: ri.techStack || 'Web',
          riskRating: ri.riskRating || 'Medium',
          dateCreated: ri.dateCreated || new Date().toISOString()
        });
      }
    }

    return merged;
  }
}

export default DataController;
