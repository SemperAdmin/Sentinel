/**
 * DataController - Handles all data loading and GitHub operations
 * Separates data concerns from UI orchestration
 */

import dataStore from '../data/DataStore.js';
import apiService from '../data/ApiService.js';
import { unwrapOr } from '../utils/result.js';
import { batchProcess } from '../utils/batchProcessor.js';
import errorHandler, { ErrorType, ErrorSeverity, RecoveryStrategies } from '../utils/errorHandler.js';
import { normalizeAppId } from '../utils/helpers.js';
import {
  REVIEW_CYCLE_DAYS,
  GITHUB_API_DELAY_MS,
  MAX_CONCURRENT_API_REQUESTS,
  IMPROVEMENT_BUDGET_PERCENT,
  DEFAULT_GITHUB_USER,
  EXCLUDED_REPO_NAMES
} from '../utils/constants.js';

/**
 * @typedef {import('../state/AppState.js').App} App
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
    let supabaseError = false;

    try {
      // Check if using Supabase backend
      if (dataStore.useSupabase) {
        console.log('Loading portfolio data from Supabase...');
        try {
          const supabaseData = await dataStore.getPortfolio();
          if (supabaseData && supabaseData.length > 0) {
            console.log(`Loaded ${supabaseData.length} apps from Supabase`);
            return this.filterPortfolio(supabaseData);
          }
          console.log('Supabase returned no data.');
        } catch (err) {
           console.error('Supabase load failed:', err);
           supabaseError = true;
        }
      }

      // If Supabase is enabled and returned empty (success), fall back to GitHub sources
      // This ensures the app works even if the Supabase database isn't populated yet
      if (dataStore.useSupabase && !supabaseError) {
          console.log('Supabase returned no data, falling back to GitHub sources...');
      }

      // Helper to save portfolio data to local store
      const saveToLocalStore = async (data) => {
        for (const app of data) {
          await dataStore.saveApp(app);
        }
        return data;
      };

      // Multi-fallback: backend proxy → direct raw GitHub → local storage → fresh GitHub API
      const portfolio = await RecoveryStrategies.withFallback(
        // Primary: fetch from repo via backend proxy
        async () => {
          const portfolioResult = await apiService.fetchPortfolioOverview();
          const data = unwrapOr(portfolioResult, []);
          if (!Array.isArray(data) || data.length === 0) {
            throw new Error('No portfolio data from backend proxy');
          }
          console.log('Loaded portfolio overview from backend proxy');
          return await saveToLocalStore(data);
        },
        // First fallback: try direct raw.githubusercontent.com (no backend needed)
        async () => {
          return await RecoveryStrategies.withFallback(
            async () => {
              console.log('Backend unavailable, trying direct GitHub raw content...');
              // Use apiService.managerRepo to match the configured repository
              const rawUrl = `https://raw.githubusercontent.com/${apiService.managerRepo}/main/data/portfolio/overview.json`;
              const response = await fetch(rawUrl);
              if (!response.ok) {
                throw new Error(`Direct GitHub fetch failed: ${response.status}`);
              }
              const data = await response.json();
              if (!Array.isArray(data) || data.length === 0) {
                throw new Error('No portfolio data from direct GitHub');
              }
              console.log(`Loaded ${data.length} apps from direct GitHub raw content`);
              return await saveToLocalStore(data);
            },
            // Second fallback: load from local storage
            async () => {
              console.log('Falling back to local portfolio data');
              const localData = await dataStore.getPortfolio();
              if (!localData || localData.length === 0) {
                throw new Error('No local portfolio data available');
              }
              return localData;
            }
          );
        }
      ).catch(async (error) => {
        // Ultimate fallback: fetch fresh from GitHub API
        errorHandler.logError(ErrorType.DATA, ErrorSeverity.HIGH, 'Failed to load portfolio from all sources', error);
        console.log('Attempting to fetch fresh data from GitHub API...');
        return await this.fetchUserRepositories();
      });

      // Clean up private repos and excluded repos
      const filteredPortfolio = this.filterPortfolio(portfolio);

      // If items were filtered out (e.g. from local storage), remove them from the data store
      if (filteredPortfolio.length !== portfolio.length) {
        const filteredIds = new Set(filteredPortfolio.map(app => app.id));
        for (const app of portfolio) {
          if (!filteredIds.has(app.id)) {
            console.log(`Removing filtered-out app "${app.id}" from data store.`);
            await dataStore.removeApp(app.id);
          }
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

    const filtered = portfolio.filter(app => !app.isPrivate && !EXCLUDED_REPO_NAMES.includes(app.id));
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
      // Always fetch public repos for the default user for the main portfolio view
      const repos = await apiService.fetchPublicReposForUser(this.defaultGitHubUser);

      // Filter to only public repositories and exclude image/asset repos
      const publicRepos = repos.filter(repo => !repo.private && !EXCLUDED_REPO_NAMES.includes(repo.name));
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
      id: normalizeAppId(repo.name),
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
      // If using Supabase, we don't need to fetch tasks from GitHub
      // We only fetch repo metadata
      const fetchTasks = !dataStore.useSupabase;

      const promises = [
        apiService.getComprehensiveRepoData(app.repoUrl)
      ];

      if (fetchTasks) {
        promises.push(apiService.fetchRepoTasks(app.id));
      }

      const [repoData, tasksResult] = await Promise.all(promises);

      // If fetch failed, throw error for proper failure tracking
      if (!repoData) {
        throw new Error(`Failed to fetch GitHub data for ${app.id}`);
      }

      // Logic to determine todos
      let todos = app.todos || [];
      if (fetchTasks && tasksResult && tasksResult.success) {
        todos = tasksResult.data;
      }

      // Update app with GitHub data
      const updatedApp = {
        ...app,
        lastCommitDate: repoData.lastCommitDate,
        latestTag: repoData.latestTag,
        description: repoData.description || app.description,
        nextReviewDate: this.calculateNextReviewDate(repoData.lastCommitDate, app.lastReviewDate),
        recentViews: repoData.recentViews,
        todos: todos
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
      if (dataStore.useSupabase) {
        console.log('Loading ideas from Supabase...');
        return await dataStore.getIdeas();
      }

      const localIdeas = await dataStore.getIdeas();

      // Try to fetch remote ideas
      try {
        const remoteIdeas = await apiService.fetchIdeasFromRepo();
        if (Array.isArray(remoteIdeas) && remoteIdeas.length > 0) {
          const merged = this.mergeIdeas(localIdeas || [], remoteIdeas);

          // Persist merged ideas to local storage for consistency
          // This ensures remote ideas are available offline
          const results = await Promise.allSettled(merged.map(idea => dataStore.saveIdea(idea)));
          const failedSaves = results.filter(r => r.status === 'rejected');
          if (failedSaves.length > 0) {
            console.warn(`${failedSaves.length} ideas failed to save to local storage.`, failedSaves);
          }

          return merged;
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
    const merged = [];

    // Process all remote ideas first (they are the source of truth)
    for (const ri of remoteIdeas) {
      const localIdea = byId.get(ri.id);
      const remoteComments = Array.isArray(ri.comments) ? ri.comments : [];
      const localComments = localIdea && Array.isArray(localIdea.comments) ? localIdea.comments : [];

      // Merge comments - combine and deduplicate by timestamp
      const mergedComments = this.mergeComments(localComments, remoteComments);

      merged.push({
        id: ri.id,
        conceptName: ri.conceptName || ri.id,
        problemSolved: ri.problemSolved || '',
        targetAudience: ri.targetAudience || '',
        techStack: ri.techStack || 'Web',
        riskRating: ri.riskRating || 'Medium',
        dateCreated: ri.dateCreated || new Date().toISOString(),
        initialFeatures: ri.initialFeatures || (localIdea?.initialFeatures || ''),
        submittedBy: ri.submittedBy || (localIdea?.submittedBy || ''),
        contactEmail: ri.contactEmail || (localIdea?.contactEmail || ''),
        status: ri.status || (localIdea?.status || null),
        implementedDate: ri.implementedDate || (localIdea?.implementedDate || null),
        comments: mergedComments
      });

      byId.delete(ri.id);
    }

    // Add any local-only ideas (not in remote)
    for (const [, localIdea] of byId) {
      merged.push(localIdea);
    }

    return merged;
  }

  /**
   * Merge local and remote comments, deduplicating by createdAt timestamp
   * @param {Array} localComments
   * @param {Array} remoteComments
   * @returns {Array}
   */
  mergeComments(localComments, remoteComments) {
    const seen = new Set();
    const merged = [];

    // Add remote comments first (source of truth)
    for (const comment of remoteComments) {
      const key = `${comment.createdAt}-${comment.author || 'Anonymous'}`;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(comment);
      }
    }

    // Add local comments that aren't already in remote
    for (const comment of localComments) {
      const key = `${comment.createdAt}-${comment.author || 'Anonymous'}`;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(comment);
      }
    }

    // Sort by date (oldest first)
    return merged.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  }
}

export default DataController;
