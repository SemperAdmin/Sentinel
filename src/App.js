/**
 * App.js - Main application orchestration for Sentinel
 * Coordinates all components, state management, and data operations
 */

import dataStore from './data/DataStore.js';
import apiService from './data/ApiService.js';
import appState from './state/AppState.js';
import { AppGrid } from './components/AppCard.js';
import { getLatestReviewDate } from './utils/helpers.js';
import { TabbedDetail } from './components/TabbedDetail.js';
import { IdeaForm } from './components/IdeaForm.js';
import { formatDate, calculateHealth, isValidGitHubUrl } from './utils/helpers.js';

class App {
  constructor() {
    this.appGrid = null;
    this.tabbedDetail = null;
    this.ideaForm = null;
    this.initialized = false;
    this.DEFAULT_GITHUB_USER = 'SemperAdmin';
  }

  /**
   * Clear all cache and refresh data
   */
  async clearAllCacheAndRefresh() {
    try {
      this.showLoading('Clearing cache and reloading...');
      
      // Use the comprehensive cache clearing method
      await window.clearAllCache({
        clearGitHub: true,
        clearLocalStorage: true,
        clearSessionStorage: true,
        reloadAfter: true
      });
      
    } catch (error) {
      console.error('Failed to clear cache and refresh:', error);
      this.hideLoading();
      alert('Failed to clear cache. Please try again or refresh the page manually.');
    }
  }

  /**
   * Initialize the application
   */
  async init() {
    try {
      this.showLoading('Initializing application...');
      
      // Initialize data store with error handling
      try {
        await dataStore.init();
        console.log('DataStore initialized successfully');
      } catch (dbError) {
        console.warn('DataStore initialization failed, using fallback storage:', dbError);
        // Continue with fallback storage - don't fail the entire app
      }
      
      // Set up event listeners
      this.setupEventListeners();
      
      // Hydrate API key from Vite env
      try {
        const envToken = import.meta?.env?.VITE_GITHUB_API_KEY || '';
        if (envToken) {
          window.GITHUB_API_KEY = envToken;
        }
        const envTokenAlt = import.meta?.env?.VITE_GITHUB_API_KEY_ALT || '';
        if (envTokenAlt) {
          window.BACKUP_GITHUB_API_KEY = envTokenAlt;
        }
      } catch (e) {}

      // Subscribe to state changes
      this.subscribeToState();
      
      const valid = await apiService.validateToken();
      if (!valid) {
        window.GITHUB_API_KEY = '';
        apiService.refreshTokenFromEnv();
      }
      try {
        const rl = await apiService.getRateLimitStatus();
        if (rl && rl.resources && rl.resources.core) {
          const r = rl.resources.core;
          const resetAt = r.reset ? new Date(r.reset * 1000).toISOString() : null;
          console.log(`GitHub rate (core): ${r.remaining}/${r.limit} remaining${resetAt ? `, resets at ${resetAt}` : ''}`);
        }
      } catch (_) {}

      await this.loadInitialData();
      
      // Set initial view
      this.showView('dashboard');
      
      this.hideLoading();
      this.initialized = true;
      
      console.log('Sentinel initialized successfully');
      
      // Add debug helper to check API key
      window.checkGitHubApiKey = () => {
        console.log('window.GITHUB_API_KEY:', window.GITHUB_API_KEY);
        console.log('apiService.isApiKeyConfigured():', apiService.isApiKeyConfigured());
      };
      
      // Add debug helper to clear data and refresh
      window.clearPortfolioAndRefresh = async () => {
        console.log('Clearing portfolio data and refreshing...');
        try {
          // Clear app state first
          appState.setPortfolio([]);
          
          // Clear data store
          await dataStore.clearAll();
          console.log('Data store cleared');
          
          // Force a complete reload
          location.reload();
        } catch (error) {
          console.error('Failed to refresh portfolio:', error);
        }
      };

      // Add comprehensive cache clearing method
      window.clearAllCache = async (options = {}) => {
        console.log('🧹 Starting comprehensive cache clear...');
        
        try {
          const { 
            clearGitHub = true, 
            clearLocalStorage = true, 
            clearSessionStorage = true, 
            reloadAfter = true 
          } = options;
          
          // Clear IndexedDB
          console.log('📦 Clearing IndexedDB...');
          await dataStore.clearAll();
          
          // Clear app state
          console.log('🗑️ Clearing app state...');
          appState.setPortfolio([]);
          
          // Clear localStorage if requested
          if (clearLocalStorage) {
            console.log('💾 Clearing localStorage...');
            localStorage.clear();
          }
          
          // Clear sessionStorage if requested
          if (clearSessionStorage) {
            console.log('🔒 Clearing sessionStorage...');
            sessionStorage.clear();
          }
          
          // Clear GitHub cache if requested
          if (clearGitHub && apiService) {
            console.log('🐙 Clearing GitHub API cache...');
            // Force cache busting by adding timestamp to next API calls
            window.__github_cache_bust = Date.now();
          }
          
          console.log('✅ Cache cleared successfully!');
          
          if (reloadAfter) {
            console.log('🔄 Reloading application...');
            setTimeout(() => {
              location.reload();
            }, 100);
          }
          
        } catch (error) {
          console.error('❌ Failed to clear cache:', error);
        }
      };
      
      console.log('Type checkGitHubApiKey() in console to debug API key status');
      console.log('Type clearPortfolioAndRefresh() in console to clear data and refresh from GitHub');
      
      // Add emergency cache clear that works even if UI fails
      window.emergencyCacheClear = () => {
        console.log('🚨 Emergency cache clear initiated...');
        
        // Clear all browser storage
        localStorage.clear();
        sessionStorage.clear();
        
        // Try to clear IndexedDB
        try {
          const deleteReq = indexedDB.deleteDatabase('APM-Portfolio-Manager');
          deleteReq.onsuccess = () => console.log('✅ IndexedDB cleared');
          deleteReq.onerror = () => console.log('⚠️ Could not clear IndexedDB');
        } catch (e) {
          console.log('⚠️ IndexedDB clear failed:', e);
        }
        
        console.log('✅ Emergency cache clear complete');
        console.log('🔄 Reloading page...');
        
        setTimeout(() => {
          location.reload();
        }, 500);
      };

      // Add test functionality
      window.testTodoFunctionality = () => {
        console.log('🧪 Testing todo functionality...');
        
        // Get current app (assuming one is selected)
        const currentState = appState.getState();
        if (currentState.currentApp) {
          console.log('Current app found:', currentState.currentApp.id);
          
          // Add a test todo
          const testTodo = {
            id: 'test-' + Date.now(),
            title: 'Test Todo Item',
            description: 'This is a test todo to verify functionality',
            priority: 'high',
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 days from now
            completed: false,
            createdAt: new Date().toISOString()
          };
          
          if (!currentState.currentApp.todos) currentState.currentApp.todos = [];
          currentState.currentApp.todos.push(testTodo);
          
          // Save the updated app
          dataStore.saveApp(currentState.currentApp).then(() => {
            console.log('✅ Test todo added successfully!');
            appState.updateApp(currentState.currentApp);
            
            // Switch to todo tab if detail view is active
            if (this.tabbedDetail) {
              this.tabbedDetail.activeTab = 'todo';
              this.tabbedDetail.render();
            }
          }).catch(err => {
            console.error('❌ Failed to save test todo:', err);
          });
        } else {
          console.log('⚠️ No app currently selected. Please select an app first.');
        }
      };
      
      console.log('💡 If the UI is not working, type emergencyCacheClear() in console to force clear all data');
      console.log('🧪 To test todo functionality, select an app and type testTodoFunctionality() in console');
    } catch (error) {
      console.error('Failed to initialize application:', error);
      this.showError('Failed to initialize application. Please refresh the page.');
      this.hideLoading();
    }
  }

  /**
   * Set up event listeners for UI elements
   */
  setupEventListeners() {
    // Navigation buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const view = e.target.dataset.view;
        if (view) {
          this.showView(view);
        }
      });
    });

    // Clear cache button
    const clearCacheBtn = document.getElementById('clear-cache-btn');
    if (clearCacheBtn) {
      clearCacheBtn.addEventListener('click', async () => {
        if (confirm('Clear all cached data and reload from GitHub? This will refresh all app data.')) {
          await this.clearAllCacheAndRefresh();
        }
      });
    }

    // Back button in detail view
    const backBtn = document.getElementById('back-to-dashboard');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        this.showView('dashboard');
      });
    }

    // Refresh button
    const refreshBtn = document.getElementById('refresh-portfolio');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        this.refreshPortfolio();
      });
    }

    const sortSelect = document.getElementById('sort-select');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        appState.setSortOrder(e.target.value);
        const state = appState.getState();
        this.updateDashboard(state);
      });
    }

    // New idea button
    const newIdeaBtn = document.getElementById('new-idea-btn');
    if (newIdeaBtn) {
      newIdeaBtn.addEventListener('click', () => {
        this.showIdeaForm();
      });
    }

    // Error toast close button
    const closeErrorBtn = document.getElementById('close-error');
    if (closeErrorBtn) {
      closeErrorBtn.addEventListener('click', () => {
        this.hideError();
      });
    }

    // Global error handler
    window.addEventListener('error', (e) => {
      console.error('Global error:', e.error);
      this.showError('An unexpected error occurred. Please check the console for details.');
    });

    // Handle browser back/forward buttons
    window.addEventListener('popstate', (e) => {
      if (e.state && e.state.view) {
        this.showView(e.state.view, false); // Don't push state again
      }
    });
  }

  /**
   * Subscribe to application state changes
   */
  subscribeToState() {
    appState.subscribe((state) => {
      this.handleStateChange(state);
    });
  }

  /**
   * Handle state changes and update UI accordingly
   */
  handleStateChange(state) {
    console.log(`handleStateChange called with view: ${state.currentView}`);
    // Update navigation active states
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === state.currentView);
    });

    // Show/hide views
    document.querySelectorAll('.view').forEach(view => {
      view.classList.toggle('active', view.id === `${state.currentView}-view`);
    });

    // Handle loading states
    if (state.loading) {
      this.showLoading();
    } else {
      this.hideLoading();
    }

    // Handle errors
    if (state.error) {
      this.showError(state.error);
    }

    // Update specific views based on state
    switch (state.currentView) {
      case 'dashboard':
        this.updateDashboard(state);
        break;
      case 'detail':
        this.updateDetailView(state);
        break;
      case 'ideas':
        this.updateIdeasView(state);
        break;
    }
  }

  /**
   * Load initial data from data store and GitHub API
   */
  async loadInitialData() {
    try {
      // Prefer scheduled overview JSON generated by workflow
      let portfolio = await (await import('./data/ApiService.js')).default.fetchPortfolioOverview();
      if (Array.isArray(portfolio) && portfolio.length > 0) {
        console.log('Loaded portfolio overview from repo JSON');
        for (const app of portfolio) {
          await dataStore.saveApp(app);
        }
      } else {
        // Fallback: load existing local portfolio
        portfolio = await dataStore.getPortfolio();
      }
      
      // Clean up any private repositories and image repos from existing data
      if (portfolio && portfolio.length > 0) {
        const filteredApps = portfolio.filter(app => !app.isPrivate && app.id !== 'eventcall-images');
        const removedCount = portfolio.length - filteredApps.length;
        if (removedCount > 0) {
          console.log(`Removing ${removedCount} repositories (private or eventcall-images) from existing data`);
          
          // Specifically remove eventcall-images if it exists
          const hasEventCallImages = portfolio.some(app => app.id === 'eventcall-images');
          if (hasEventCallImages) {
            console.log('Removing eventcall-images from data store...');
            await dataStore.removeApp('eventcall-images');
          }
          
          // Save cleaned data back to store
          for (const app of filteredApps) {
            await dataStore.saveApp(app);
          }
          portfolio = filteredApps;
        }
      }
      
      // If still no data, fetch from GitHub (bootstrap only)
      if (!portfolio || portfolio.length === 0) {
        console.log('No portfolio data found, fetching from GitHub...');
        portfolio = await this.fetchUserRepositories();
        
        // Save the fetched repositories to the database
        for (const app of portfolio) {
          await dataStore.saveApp(app);
        }
      } else {
        // Even if we have existing data, let's verify it doesn't contain eventcall-images
        const hasEventCallImages = portfolio.some(app => app.id === 'eventcall-images');
        if (hasEventCallImages) {
          console.log('Found eventcall-images in existing data, removing...');
          portfolio = portfolio.filter(app => app.id !== 'eventcall-images');
          // Clear and reload to ensure clean state
          await dataStore.clearAll();
          portfolio = await this.fetchUserRepositories();
          for (const app of portfolio) {
            await dataStore.saveApp(app);
          }
        }
      }
      
      appState.setPortfolio(portfolio);
      
      // Debug: log the final portfolio
      console.log('Final portfolio being set:', portfolio.map(app => ({ id: app.id, name: app.id })));

      // Load ideas
      const ideas = await dataStore.getIdeas();
      appState.setIdeas(ideas);
      try {
        const api = (await import('./data/ApiService.js')).default;
        const remoteIdeas = await api.fetchIdeasFromRepo();
        if (Array.isArray(remoteIdeas) && remoteIdeas.length > 0) {
          const byId = new Map((ideas||[]).map(i => [i.id, i]));
          const merged = [...(ideas||[])];
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
          appState.setIdeas(merged);
        }
      } catch (_) {}

      // If overview JSON is present, skip live GitHub calls
      const hasOverview = Array.isArray(await (await import('./data/ApiService.js')).default.fetchPortfolioOverview());
      if (!hasOverview) {
        this.fetchGitHubDataForApps(portfolio);
      }
    } catch (error) {
      console.error('Failed to load initial data:', error);
      appState.setError('Failed to load portfolio data');
    }
  }

  /**
   * Fetch user's repositories from GitHub API
   */
  async fetchUserRepositories() {
    try {
      // Check if API key is configured
      let repos;
      if (!apiService.isApiKeyConfigured()) {
        repos = await apiService.fetchPublicReposForUser(this.DEFAULT_GITHUB_USER);
      } else {
        console.log('Fetching user repositories from GitHub...');
        try {
          repos = await apiService.fetchUserRepos();
        } catch (err) {
          console.warn('Authenticated repo fetch failed, falling back to public repos:', err);
          repos = await apiService.fetchPublicReposForUser(this.DEFAULT_GITHUB_USER);
        }
      }
      
      // Filter to only public repositories and exclude image/asset repos
      const publicRepos = repos.filter(repo => !repo.private && repo.name !== 'eventcall-images');
      console.log(`Filtering ${repos.length} total repos to ${publicRepos.length} public repos (excluded eventcall-images)`);
      
      // Convert GitHub repositories to app format
      const apps = publicRepos.map(repo => ({
        id: repo.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        repoUrl: repo.html_url,
        platform: 'Web', // Default to Web since your apps are web-based
        status: 'Active',
        lastReviewDate: null,
        nextReviewDate: this.calculateNextReviewDate(repo.updated_at, null),
        pendingTodos: 0,
        notes: repo.description || 'No description available',
        lastCommitDate: repo.updated_at,
        latestTag: null, // Will be fetched later
        stars: repo.stargazers_count,
        language: repo.language,
        isPrivate: repo.private,
        archived: repo.archived,
        // New fields for todos, improvements, and developer notes
        todos: [],
        improvements: [],
        developerNotes: '',
        improvementBudget: 20, // 20% budget for improvements
        currentSprint: 'Q1 2025'
      }));
      
      console.log(`Successfully fetched ${apps.length} repositories from GitHub`);
      return apps;
    } catch (error) {
      console.error('Failed to fetch user repositories, attempting public fallback:', error);
      try {
        const repos = await apiService.fetchPublicReposForUser(this.DEFAULT_GITHUB_USER);
        const publicRepos = repos.filter(repo => !repo.private && repo.name !== 'eventcall-images');
        const apps = publicRepos.map(repo => ({
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
          improvementBudget: 20,
          currentSprint: 'Q1 2025'
        }));
        console.log(`Fallback fetched ${apps.length} repositories from GitHub`);
        return apps;
      } catch (fallbackErr) {
        console.error('Public fallback also failed:', fallbackErr);
        // Provide a minimal placeholder so the UI is not empty
        return [];
      }
    }
  }

  /**
   * Calculate next review date (60 days from the latest date - either last commit or last review)
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
      // If we have a base date, set review to 60 days after that
      reviewDate.setTime(new Date(baseDate).getTime());
      reviewDate.setDate(reviewDate.getDate() + 60);
    } else {
      // If no base date, default to 60 days from now
      reviewDate.setDate(reviewDate.getDate() + 60);
    }
    
    return reviewDate.toISOString().split('T')[0];
  }

  /**
   * Mark app as reviewed - updates last review date and calculates next review
   */
  async markAppAsReviewed(appId) {
    try {
      const app = appState.getAppById(appId);
      if (!app) {
        console.error('App not found:', appId);
        return;
      }

      const today = new Date().toISOString().split('T')[0];
      const updatedApp = {
        ...app,
        lastReviewDate: today,
        nextReviewDate: this.calculateNextReviewDate(app.lastCommitDate, today)
      };

      await dataStore.saveApp(updatedApp);
      appState.updateApp(updatedApp);
      
      console.log(`App ${appId} marked as reviewed. Next review: ${updatedApp.nextReviewDate}`);
      
      // Refresh the current view
      this.updateDashboard();
      
    } catch (error) {
      console.error('Failed to mark app as reviewed:', error);
    }
  }

  /**
   * Fetch GitHub data for all apps (with rate limiting consideration)
   */
  async fetchGitHubDataForApps(apps) {
    if (!apps || apps.length === 0) return;

    // Wait a bit to ensure window.GITHUB_API_KEY is available
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Check if API key is configured
    console.log('Checking if GitHub API key is configured...');
    if (!apiService.isApiKeyConfigured()) {
      console.warn('GitHub API key not configured. Cannot fetch live data.');
      return;
    }
    console.log('GitHub API key is configured. Proceeding with API calls.');

    // Fetch data with delays to avoid rate limiting
    for (let i = 0; i < apps.length; i++) {
      const app = apps[i];
      // Skip private repositories
      if (app.isPrivate) {
        console.log(`Skipping private repository: ${app.id}`);
        continue;
      }
      if (app.repoUrl && isValidGitHubUrl(app.repoUrl)) {
        try {
          // Add delay between requests (1 second)
          if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }

          const repoData = await apiService.getComprehensiveRepoData(app.repoUrl);
          
          // Update app with GitHub data and recalculate review date based on last commit
          const updatedApp = {
            ...app,
            lastCommitDate: repoData.lastCommitDate,
            latestTag: repoData.latestTag,
            description: repoData.description || app.description,
            nextReviewDate: this.calculateNextReviewDate(repoData.lastCommitDate, app.lastReviewDate)
          };

          // Save to data store and update state
          await dataStore.saveApp(updatedApp);
          appState.updateApp(updatedApp);
        } catch (error) {
          console.error(`Failed to fetch GitHub data for ${app.id}:`, error);
          // Continue with other apps even if one fails
          // Don't let API failures break the entire app
          console.log(`Skipping GitHub data update for ${app.id}, using existing data`);
        }
      }
    }
  }

  /**
   * Show specific view
   */
  showView(view, pushState = true) {
    console.log(`showView called with view: ${view}`);
    appState.setView(view);
    
    if (pushState) {
      history.pushState({ view }, '', `#${view}`);
    }
  }

  /**
   * Update dashboard view
   */
  updateDashboard(state) {
    const appGrid = document.getElementById('app-grid');
    if (!appGrid) return;

    if (!this.appGrid) {
      this.appGrid = new AppGrid(appGrid, (app) => {
        this.showAppDetail(app);
      });
    }

    // Debug: log what's being rendered
    console.log('Rendering dashboard with portfolio:', state.portfolio?.map(app => app.id));

    // Handle empty portfolio state
    if (!state.portfolio || state.portfolio.length === 0) {
      appGrid.innerHTML = `
        <div class="empty-state">
          <h3>No repositories found</h3>
          <p>Fetching your GitHub repositories...</p>
          <div class="loading-spinner"></div>
        </div>
      `;
    } else {
      const order = state.sortOrder || 'alphabetical';
      const apps = [...state.portfolio];
      const byAlpha = (a,b) => String(a.id).localeCompare(String(b.id));
      const toDate = (s) => s ? new Date(s) : null;
      const lastRev = (app) => getLatestReviewDate(app.lastCommitDate, app.lastReviewDate);
      const nextRev = (app) => toDate(app.nextReviewDate) || new Date(8640000000000000);
      const activeCount = (app) => (Array.isArray(app.todos)? app.todos:[])
        .filter(t => {
          const s = String(t.status||'');
          return !t.completed && s !== 'Draft' && s !== 'Rejected';
        }).length;
      if (order === 'alphabetical') apps.sort(byAlpha);
      else if (order === 'lastReviewed') apps.sort((a,b) => {
        const ad = toDate(lastRev(a)) || new Date(0);
        const bd = toDate(lastRev(b)) || new Date(0);
        return bd - ad;
      });
      else if (order === 'nextReview') apps.sort((a,b) => nextRev(a) - nextRev(b));
      else if (order === 'activeTodo') apps.sort((a,b) => activeCount(b) - activeCount(a));
      this.appGrid.render(apps);
    }
  }

  async hydrateTasksForApps(apps) {
    try {
      const updates = [];
      for (const app of apps) {
        const local = Array.isArray(app.todos) ? app.todos : [];
        const remote = await apiService.fetchRepoTasks(app.id);
        if (!remote || !Array.isArray(remote) || remote.length === 0) continue;
        const keyOf = (t) => (t.id ? String(t.id) : `${t.title || ''}|${t.dueDate || ''}`);
        const existingKeys = new Set(local.map(keyOf));
        const toAdd = remote.filter((rt) => !existingKeys.has(keyOf(rt)));
        if (toAdd.length === 0) continue;
        const merged = [...local, ...toAdd];
        const updatedApp = { ...app, todos: merged };
        await dataStore.saveApp(updatedApp);
        updates.push(updatedApp);
      }
      if (updates.length > 0) {
        const state = appState.getState();
        const mergedPortfolio = state.portfolio.map(a => {
          const u = updates.find(x => x.id === a.id);
          return u ? u : a;
        });
        appState.setPortfolio(mergedPortfolio);
        const order = state.sortOrder || 'alphabetical';
        this.updateDashboard({ ...state, portfolio: mergedPortfolio, sortOrder: order });
      }
    } catch (_) {}
  }

  /**
   * Update detail view
   */
  updateDetailView(state) {
    const detailContent = document.querySelector('.detail-content');
    if (!detailContent || !state.currentApp) return;

    // Update app name in header
    const appNameElement = document.getElementById('detail-app-name');
    if (appNameElement) {
      appNameElement.textContent = state.currentApp.id;
    }

    if (!this.tabbedDetail) {
      console.log('Creating new TabbedDetail component...');
      this.tabbedDetail = new TabbedDetail(
        state.currentApp,
        async (updatedApp) => {
          await this.saveAppData(state.currentApp.id, updatedApp);
          try {
            const api = new (await import('./data/ApiService.js')).default();
            const appId = state.currentApp.id;
            const tasks = updatedApp.todos || state.currentApp.todos || [];
            await api.triggerSaveTasks(appId, tasks);
          } catch (err) {}
        },
        (tab) => appState.setActiveTab(tab),
        (appId) => this.markAppAsReviewed(appId)
      );
      console.log('Rendering TabbedDetail component...');
      this.tabbedDetail.render();
    } else {
      console.log('Updating existing TabbedDetail component...');
      this.tabbedDetail.update(state.currentApp);
    }

    // Set active tab
    if (this.tabbedDetail.activeTab !== state.activeTab) {
      this.tabbedDetail.switchTab(state.activeTab);
    }

    this.hydrateTasksFromRepo(state.currentApp);
  }

  async hydrateTasksFromRepo(app) {
    try {
      if (!app) return;
      const remote = await apiService.fetchRepoTasks(app.id);
      if (!remote || !Array.isArray(remote) || remote.length === 0) return;

      const local = Array.isArray(app.todos) ? app.todos : [];
      const keyOf = (t) => (t.id ? String(t.id) : `${t.title || ''}|${t.dueDate || ''}`);
      const existingKeys = new Set(local.map(keyOf));
      const toAdd = remote.filter((rt) => !existingKeys.has(keyOf(rt)));

      if (toAdd.length === 0) return;

      const merged = [...local, ...toAdd];
      const updatedApp = { ...app, todos: merged };
      await dataStore.saveApp(updatedApp);
      appState.updateApp(updatedApp);
      if (this.tabbedDetail) this.tabbedDetail.update(updatedApp);
    } catch (_) {}
  }

  /**
   * Update ideas view
   */
  updateIdeasView(state) {
    const ideasList = document.getElementById('ideas-list');
    if (!ideasList) return;

    // Render ideas list
    this.renderIdeasList(state.ideas, ideasList);

    // Handle idea form
    const formContainer = document.getElementById('idea-form-container');
    if (state.showIdeaForm) {
      if (!this.ideaForm) {
        this.ideaForm = new IdeaForm(
          (idea) => this.saveIdea(idea),
          () => this.hideIdeaForm(),
          state.editingIdea
        );
        formContainer.innerHTML = '';
        formContainer.appendChild(this.ideaForm.render());
      }
      formContainer.classList.remove('hidden');
    } else {
      formContainer.classList.add('hidden');
      if (this.ideaForm) {
        this.ideaForm.destroy();
        this.ideaForm = null;
      }
    }
  }

  /**
   * Render ideas list
   */
  renderIdeasList(ideas, container) {
    if (!ideas || ideas.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 3rem; color: #6c757d;">
          <h3>No ideas yet</h3>
          <p>Start documenting your app concepts here.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = ideas.map(idea => this.renderIdeaItem(idea)).join('');

    // Add click listeners to idea items
    container.querySelectorAll('.idea-item').forEach(item => {
      item.addEventListener('click', () => {
        const ideaId = item.dataset.ideaId;
        const idea = appState.getIdeaById(ideaId);
        if (idea) {
          this.editIdea(idea);
        }
      });
    });
  }

  /**
   * Render individual idea item
   */
  renderIdeaItem(idea) {
    const riskColor = {
      'Low': '#28a745',
      'Medium': '#ffc107',
      'High': '#dc3545'
    }[idea.riskRating] || '#6c757d';

    return `
      <div class="idea-item" data-idea-id="${idea.id}">
        <h4>${this.escapeHtml(idea.conceptName)}</h4>
        <p>${this.escapeHtml(idea.problemSolved ? idea.problemSolved.substring(0, 100) : '')}${idea.problemSolved && idea.problemSolved.length > 100 ? '...' : ''}</p>
        <div class="idea-meta">
          <span>👥 ${this.escapeHtml(idea.targetAudience)}</span>
          <span>🛠️ ${this.escapeHtml(idea.techStack)}</span>
          <span style="color: ${riskColor}">⚠️ ${idea.riskRating} Risk</span>
          <span>📅 ${formatDate(idea.dateCreated)}</span>
        </div>
        <div style="margin-top: 1rem;">
          <button class="btn btn-primary" style="margin-right: 0.5rem;" onclick="event.stopPropagation(); app.activateIdea('${idea.id}')">
            Activate & Create Repo
          </button>
          <button class="btn btn-secondary" onclick="event.stopPropagation(); app.editIdea('${idea.id}')">
            Edit
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Show app detail view
   */
  showAppDetail(app) {
    console.log('🎯 APP CLICKED:', app.id);
    console.log('🎯 Switching to detail view for:', app.id);
    appState.setCurrentApp(app);
    appState.setActiveTab('overview');
    this.showView('detail');
  }

  /**
   * Save developer notes
   */
  async saveDeveloperNotes(appId, notes) {
    try {
      const app = appState.getAppById(appId);
      if (app) {
        const updatedApp = { ...app, developerNotes: notes };
        await dataStore.saveApp(updatedApp);
        appState.updateApp(updatedApp);
      }
    } catch (error) {
      console.error('Failed to save notes:', error);
      appState.setError('Failed to save notes');
    }
  }

  /**
   * Save all app data (todos, improvements, notes, etc.)
   */
  async saveAppData(appId, updatedAppData) {
    try {
      console.log('Saving app data for:', appId);
      const app = appState.getAppById(appId);
      if (app) {
        const updatedApp = { 
          ...app, 
          ...updatedAppData,
          id: appId // Ensure ID stays the same
        };
        await dataStore.saveApp(updatedApp);
        appState.updateApp(updatedApp);
        console.log('App data saved successfully for:', appId);
      }
    } catch (error) {
      console.error('Failed to save app data:', error);
      appState.setError('Failed to save app data');
    }
  }

  /**
   * Show idea form
   */
  showIdeaForm(idea = null) {
    appState.setShowIdeaForm(true, idea);
  }

  /**
   * Hide idea form
   */
  hideIdeaForm() {
    appState.setShowIdeaForm(false);
  }

  /**
   * Edit existing idea
   */
  editIdea(ideaId) {
    const idea = appState.getIdeaById(ideaId);
    if (idea) {
      this.showIdeaForm(idea);
    }
  }

  /**
   * Save idea (create or update)
   */
  async saveIdea(idea) {
    try {
      await dataStore.saveIdea(idea);
      
      if (appState.getIdeaById(idea.id)) {
        appState.updateIdea(idea);
      } else {
        appState.addIdea(idea);
      }
      try {
        const api = (await import('./data/ApiService.js')).default;
        await api.saveIdeaYaml(idea);
} catch (err) { console.warn('Failed to save idea to YAML:', err); }
      
      this.hideIdeaForm();
    } catch (error) {
      console.error('Failed to save idea:', error);
      appState.setError('Failed to save idea');
    }
  }

  /**
   * Activate idea (convert to app)
   */
  async activateIdea(ideaId) {
    const repoUrl = prompt('Enter GitHub repository URL for this app:');
    if (!repoUrl || !isValidGitHubUrl(repoUrl)) {
      alert('Please enter a valid GitHub repository URL');
      return;
    }

    try {
      const newApp = await dataStore.activateIdea(ideaId, repoUrl);
      appState.removeIdea(ideaId);
      appState.addApp(newApp);
      try {
        const api = (await import('./data/ApiService.js')).default;
        const idea = {
          id: ideaId,
          conceptName: newApp.id,
          problemSolved: newApp.notes || '',
          techStack: newApp.platform || 'Web',
          riskRating: 'Medium',
          targetAudience: 'Unknown',
          dateCreated: new Date().toISOString()
        };
        await api.saveIdeaYaml(idea);
      } catch (_) {}
      
      // Fetch GitHub data for the new app
      this.fetchGitHubDataForApps([newApp]);
      
      alert(`Idea activated successfully! App "${newApp.id}" added to portfolio.`);
    } catch (error) {
      console.error('Failed to activate idea:', error);
      appState.setError('Failed to activate idea');
    }
  }

  /**
   * Refresh portfolio data
   */
  async refreshPortfolio() {
    try {
      appState.setLoading(true, 'portfolioLoading');
      
      const portfolio = await dataStore.getPortfolio();
      appState.setPortfolio(portfolio);
      
      // Refresh GitHub data
      this.fetchGitHubDataForApps(portfolio);
      
      appState.setLoading(false, 'portfolioLoading');
    } catch (error) {
      console.error('Failed to refresh portfolio:', error);
      appState.setError('Failed to refresh portfolio', 'portfolioError');
      appState.setLoading(false, 'portfolioLoading');
    }
  }

  /**
   * Show loading overlay
   */
  showLoading(message = 'Loading...') {
    const overlay = document.getElementById('loading-overlay');
    const messageElement = overlay.querySelector('p');
    if (messageElement) {
      messageElement.textContent = message;
    }
    overlay.classList.remove('hidden');
  }

  /**
   * Hide loading overlay
   */
  hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    overlay.classList.add('hidden');
  }

  /**
   * Show error message
   */
  showError(message) {
    const errorToast = document.getElementById('error-toast');
    const errorMessage = document.getElementById('error-message');
    
    if (errorMessage) {
      errorMessage.textContent = message;
    }
    
    errorToast.classList.remove('hidden');
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      this.hideError();
    }, 5000);
  }

  /**
   * Hide error message
   */
  hideError() {
    const errorToast = document.getElementById('error-toast');
    errorToast.classList.add('hidden');
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Create and initialize the app
const app = new App();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    app.init();
  });
} else {
  app.init();
}

// Make app globally available for component callbacks
window.app = app;

export default app;