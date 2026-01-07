/**
 * App.js - Main application orchestration for Sentinel
 * Coordinates all components, state management, and data operations
 */

/**
 * @typedef {import('./state/AppState.js').App} App
 * @typedef {import('./state/AppState.js').Idea} Idea
 * @typedef {import('./state/AppState.js').State} State
 */

import dataStore from './data/DataStore.js';
import apiService from './data/ApiService.js';
import appState from './state/AppState.js';
import { AppGrid } from './components/AppCard.js';
import { getLatestReviewDate, parseHashRoute, buildHashRoute } from './utils/helpers.js';
import { TabbedDetail } from './components/TabbedDetail.js';
import { IdeaForm } from './components/IdeaForm.js';
import { formatDate, calculateHealth } from './utils/helpers.js';
import { unwrapOr } from './utils/result.js';
import {
  REVIEW_CYCLE_DAYS,
  GITHUB_API_DELAY_MS,
  DEFAULT_TOAST_DURATION_MS,
  LOADING_DEBOUNCE_MS,
  DEFAULT_GITHUB_USER,
  IMPROVEMENT_BUDGET_PERCENT,
  MAX_CONCURRENT_API_REQUESTS,
  DEFAULT_FILTERS
} from './utils/constants.js';
import { batchProcess } from './utils/batchProcessor.js';
import errorHandler, { ErrorType, ErrorSeverity, RecoveryStrategies } from './utils/errorHandler.js';
import { LoadingStateManager } from './utils/loadingState.js';
import DataController from './controllers/DataController.js';
import { toastManager, loadingOverlay, escapeHtml } from './utils/uiComponents.js';
import { isValidGitHubUrl } from './utils/validation.js';
import { authService } from './auth/AuthService.js';
import LoginForm from './components/LoginForm.js';
import { showAdminLoginModal, showPublicIdeaModal, showIdeaDetailModal } from './components/modals/index.js';
import { renderIdeasList } from './components/IdeasList.js';
import { initDevTools } from './utils/devTools.js';
import { filterApps } from './components/SearchFilter.js';

class App {
  constructor() {
    this.appGrid = null;
    this.tabbedDetail = null;
    this.ideaForm = null;
    this.loginForm = null;
    this.searchTimeout = null;
    this.initialized = false;
    this.DEFAULT_GITHUB_USER = DEFAULT_GITHUB_USER;
    this.loadingManager = new LoadingStateManager();
    this.dataController = new DataController();
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

  async markIdeaAsInDev(ideaId) {
    try {
      const idea = appState.getIdeaById(ideaId);
      if (!idea) return;

      const updatedIdea = {
        ...idea,
        status: 'in_development'
      };

      await dataStore.saveIdea(updatedIdea);
      appState.updateIdea(updatedIdea);
      
      toastManager.showSuccess('Idea marked as in development');
    } catch (error) {
      console.error('Failed to update idea status:', error);
      if (error.code === '42501') {
        toastManager.showError('Permission denied. Run fix_ideas_rls.sql and ensure you are admin (see grant_admin.sql)');
      } else {
        toastManager.showError('Failed to update status');
      }
    }
  }

  /**
   * Reject an idea (admin only)
   */
  async rejectIdea(ideaId) {
    // Security check: Only admins can reject ideas
    if (!appState.isAdmin()) {
      toastManager.show('Admin access required', 'error');
      return;
    }

    try {
      const idea = appState.getIdeaById(ideaId);
      if (!idea) return;

      const updatedIdea = {
        ...idea,
        status: 'rejected'
      };

      await dataStore.saveIdea(updatedIdea);
      appState.updateIdea(updatedIdea);
      
      toastManager.showSuccess('Idea rejected');
    } catch (error) {
      console.error('Failed to reject idea:', error);
      if (error.code === '42501') {
        toastManager.showError('Permission denied. Run fix_ideas_rls.sql and ensure you are admin (see grant_admin.sql)');
      } else {
        toastManager.showError('Failed to reject idea');
      }
    }
  }

  /**
   * Initialize the application
   */
  async init() {
    try {
      this.showLoading('Initializing application...');

      // Subscribe to error handler
      errorHandler.subscribe((errorContext) => {
        if (errorContext.severity === ErrorSeverity.HIGH || errorContext.severity === ErrorSeverity.CRITICAL) {
          this.showError(errorContext.message);
        }
      });

      // Initialize data store with error handling and recovery
      try {
        await RecoveryStrategies.retry(
          () => dataStore.init(),
          2, // 2 retry attempts
          500 // 500ms base delay
        );
        console.log('DataStore initialized successfully');
      } catch (dbError) {
        errorHandler.logError(ErrorType.STORAGE, ErrorSeverity.MEDIUM, 'DataStore initialization failed', dbError);
        console.warn('DataStore initialization failed, using fallback storage:', dbError);
        // Continue with fallback storage - don't fail the entire app
      }

      // Set up event listeners
      this.setupEventListeners();

      // Subscribe to state changes
      this.subscribeToState();

      // Check authentication status
      const sessionInfo = authService.getSessionInfo();
      console.log('Session info:', sessionInfo);

      if (sessionInfo.isAdmin) {
        // User is authenticated as admin
        appState.setAuthentication('admin');
      } else if (sessionInfo.isPublic) {
        // User is authenticated as public user
        appState.setAuthentication('public');
      } else {
        // No session - auto-login as public user
        await authService.loginAsPublic();
        appState.setAuthentication('public');
      }

      // Check API health status only if not using Supabase or if explicitly needed
      // When using Supabase, we don't need the local proxy server for core functionality
      if (!dataStore.useSupabase) {
        try {
          const rl = await apiService.getRateLimitStatus();
          if (rl && rl.resources && rl.resources.core) {
            const r = rl.resources.core;
            const resetAt = r.reset ? new Date(r.reset * 1000).toISOString() : null;
            console.log(`GitHub rate (core): ${r.remaining}/${r.limit} remaining${resetAt ? `, resets at ${resetAt}` : ''}`);
          }
        } catch (_) {}

        try {
          const res = await fetch(`${apiService.baseUrl}/health`, { method: 'GET' });
          if (res.ok) {
            const healthInfo = await res.json();
            const rateLimit = healthInfo?.rateLimit;
            if (rateLimit) {
              console.log(`API token active=${healthInfo.hasToken}; core used=${rateLimit.used}; remaining=${rateLimit.remaining}/${rateLimit.limit}`);
            } else {
              console.log(`API token active=${healthInfo.hasToken}`);
            }
          }
        } catch (error) {
          // Silent fail for health check when not critical
        }
      }

      await this.loadInitialData();

      // Set initial view based on URL hash (supports deep linking)
      this.restoreViewFromHash();

      this.hideLoading();
      this.initialized = true;

      console.log('Sentinel initialized successfully');

      // Initialize dev tools (console commands for debugging)
      initDevTools({
        apiService,
        getTabbedDetail: () => this.tabbedDetail
      });
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

    // Force clear button (emergency reset)
    const forceClearBtn = document.getElementById('force-clear-btn');
    if (forceClearBtn) {
      forceClearBtn.addEventListener('click', () => {
        if (confirm('⚠️ This will completely reset the app. Are you sure?')) {
          localStorage.clear();
          sessionStorage.clear();
          indexedDB.deleteDatabase('APM-Portfolio-Manager');
          location.reload();
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

    // Platform filter
    const platformFilter = document.getElementById('platform-filter');
    if (platformFilter) {
      platformFilter.addEventListener('change', (e) => {
        appState.setFilters({ platform: e.target.value });
        this.updateDashboard(appState.getState());
      });
    }

    // Status filter
    const statusFilter = document.getElementById('status-filter');
    if (statusFilter) {
      statusFilter.addEventListener('change', (e) => {
        appState.setFilters({ status: e.target.value });
        this.updateDashboard(appState.getState());
      });
    }

    // Search input with debouncing
    const searchInput = document.getElementById('app-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => {
          appState.setSearchQuery(e.target.value);
        }, 200);
      });

      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          searchInput.value = '';
          appState.setSearchQuery('');
        }
      });
    }

    // New idea button (admin)
    const newIdeaBtn = document.getElementById('new-idea-btn');
    if (newIdeaBtn) {
      newIdeaBtn.addEventListener('click', () => {
        this.showIdeaForm();
      });
    }

    // Submit idea button (public users)
    const submitIdeaBtn = document.getElementById('submit-idea-btn');
    if (submitIdeaBtn) {
      submitIdeaBtn.addEventListener('click', () => {
        this.showPublicIdeaSubmission();
      });
    }

    // Error toast close button
    const closeErrorBtn = document.getElementById('close-error');
    if (closeErrorBtn) {
      closeErrorBtn.addEventListener('click', () => {
        this.hideError();
      });
    }

    // Auth button (Login/Logout toggle)
    const authBtn = document.getElementById('auth-btn');
    if (authBtn) {
      authBtn.addEventListener('click', () => {
        const currentRole = appState.getState().userRole;

        if (currentRole === 'admin') {
          // Logout from admin mode, return to public mode
          if (confirm('Logout from admin mode? You will return to public view.')) {
            authService.logout();
            authService.loginAsPublic();
            appState.setAuthentication('public');
          }
        } else {
          // Show login modal for admin access
          this.showAdminLoginModal();
        }
      });
    }

    // Global error handler
    window.addEventListener('error', (e) => {
      console.error('Global error:', e.error);
      this.showError('An unexpected error occurred. Please check the console for details.');
    });

    // Handle browser back/forward buttons
    window.addEventListener('popstate', (e) => {
      const { view, appId, tab } = parseHashRoute(window.location.hash);

      if (view === 'detail') {
        if (appId) {
          const app = appState.getAppById(appId);
          if (app) {
            appState.setCurrentApp(app);
            appState.setActiveTab(tab || 'overview');
            this.showView('detail', false);
            return;
          }
        }
        // No app ID or app not found - go to dashboard
        this.showView('dashboard', false);
      } else {
        this.showView(view || 'dashboard', false);
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

    // Update login/logout button text and behavior
    const authBtn = document.getElementById('auth-btn');
    if (authBtn) {
      if (state.userRole === 'admin') {
        authBtn.textContent = '🚪 LOGOUT';
        authBtn.title = 'Logout from admin mode';
      } else {
        authBtn.textContent = '🔐 LOGIN';
        authBtn.title = 'Login as admin';
      }
    }

    // Show/hide admin-only elements
    const isAdmin = state.userRole === 'admin';
    const newIdeaBtn = document.getElementById('new-idea-btn');
    const submitIdeaBtn = document.getElementById('submit-idea-btn');
    const adminToolsDropdown = document.getElementById('admin-tools-dropdown');

    if (newIdeaBtn) {
      newIdeaBtn.style.display = isAdmin ? '' : 'none';
    }

    if (submitIdeaBtn) {
      submitIdeaBtn.style.display = isAdmin ? 'none' : '';
    }

    if (adminToolsDropdown) {
      adminToolsDropdown.style.display = isAdmin ? '' : 'none';
    }

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
   * Show admin login modal
   */
  showAdminLoginModal() {
    showAdminLoginModal();
  }

  /**
   * Show public idea submission modal
   */
  showPublicIdeaSubmission() {
    showPublicIdeaModal((idea) => this.saveIdea(idea));
  }

  /**
   * Get the full main content HTML with all views
   * @returns {string} HTML string
   */
  getMainContentHTML() {
    return `
      <div id="dashboard-view" class="view active">
        <div class="view-header">
          <h2>PORTFOLIO OVERVIEW</h2>
          <div class="view-header-controls">
            <div class="search-box-inline">
              <input type="text" id="app-search" class="search-input-inline" placeholder="Search apps..." autocomplete="off" />
            </div>
            <label class="sort-label">
              <span>Sort</span>
              <select id="sort-select" class="btn btn-secondary sort-select">
                <option value="alphabetical">A-Z</option>
                <option value="lastReviewed">Last Reviewed</option>
                <option value="nextReview">Next Review</option>
                <option value="activeTodo">Active To-Dos</option>
              </select>
            </label>
            <button class="btn btn-primary" id="refresh-portfolio">REFRESH</button>
          </div>
        </div>
        <div id="app-grid" class="app-grid"></div>
      </div>

      <div id="detail-view" class="view">
        <div class="view-header">
          <button class="btn btn-secondary" id="back-to-dashboard">← BACK</button>
          <h2 id="detail-app-name">APP DETAILS</h2>
        </div>
        <div class="detail-content">
          <div class="tab-nav">
            <button class="tab-btn active" data-tab="overview">OVERVIEW & SYSTEM CHECKS</button>
            <button class="tab-btn" data-tab="todo">TO-DO & IMPROVEMENTS</button>
          </div>

          <div class="tab-content">
            <div id="overview-tab" class="tab-pane active">
              <div class="detail-section">
                <h3>QUARTERLY REVIEW SCHEDULE</h3>
                <div class="review-info">
                  <div class="info-item">
                    <label>LAST REVIEW:</label>
                    <span id="last-review-date">-</span>
                  </div>
                  <div class="info-item">
                    <label>NEXT DUE (60d from commit):</label>
                    <span id="next-review-date">-</span>
                  </div>
                </div>
                <button class="btn btn-primary" id="start-review-checklist">▶ START REVIEW CHECKLIST</button>
                <button class="btn btn-secondary btn-mark-reviewed" id="mark-as-reviewed">✓ MARK AS REVIEWED</button>
              </div>

              <div class="detail-section">
                <h3>TECHNICAL STATUS</h3>
                <div class="status-grid">
                  <div class="status-item">
                    <label>COMPATIBILITY STATUS:</label>
                    <span id="compatibility-status" class="status-badge">-</span>
                  </div>
                  <div class="status-item">
                    <label>DEPENDENCY AUDIT:</label>
                    <span id="dependency-status" class="status-badge">-</span>
                  </div>
                </div>
              </div>
            </div>

            <div id="todo-tab" class="tab-pane">
              <div class="detail-section">
                <h3>IMPROVEMENT BUDGET TRACKER</h3>
                <div class="budget-info">
                  <div class="budget-bar">
                    <div class="budget-fill" id="budget-fill"></div>
                  </div>
                  <span id="budget-text">0% OF 20% BUDGET USED</span>
                </div>
              </div>

              <div class="detail-section">
                <h3>OPEN TASKS</h3>
                <div id="task-list" class="task-list"></div>
                <button class="btn btn-secondary" id="view-external-tracker">🔗 VIEW EXTERNAL TASK TRACKER</button>
              </div>
            </div>

            <div id="notes-tab" class="tab-pane">
              <div class="detail-section">
                <h3>DEVELOPER NOTES</h3>
                <textarea id="developer-notes" class="notes-textarea" placeholder="ADD YOUR DEVELOPMENT NOTES HERE..."></textarea>
                <button class="btn btn-primary" id="save-notes">💾 SAVE NOTES</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div id="ideas-view" class="view">
        <div class="view-header">
          <h2>Innovation Lab</h2>
          <button class="btn btn-primary" id="new-idea-btn">+ NEW IDEA</button>
          <button class="btn btn-success" id="submit-idea-btn" style="display: none;">💡 SUBMIT IDEA</button>
        </div>
        <div class="ideas-content" style="display: block;">
          <div class="ideas-section">
            <h3 class="section-title" style="color: #ffc107; border-bottom: 2px solid #ffc107; padding-bottom: 0.5rem; margin-bottom: 1rem;">
              📋 Pending Review
              <span id="pending-count" style="font-size: 0.875rem; font-weight: normal; color: #888;"></span>
            </h3>
            <div id="ideas-list-pending" class="ideas-list"></div>
          </div>

          <div class="ideas-section" style="margin-top: 2rem;">
            <h3 class="section-title" style="color: #17a2b8; border-bottom: 2px solid #17a2b8; padding-bottom: 0.5rem; margin-bottom: 1rem;">
              ⚡ In Development
              <span id="in-development-count" style="font-size: 0.875rem; font-weight: normal; color: #888;"></span>
            </h3>
            <div id="ideas-list-in-development" class="ideas-list"></div>
          </div>

          <div class="ideas-section" style="margin-top: 2rem;">
            <h3 class="section-title" style="color: #28a745; border-bottom: 2px solid #28a745; padding-bottom: 0.5rem; margin-bottom: 1rem;">
              ✓ Implemented
              <span id="completed-count" style="font-size: 0.875rem; font-weight: normal; color: #888;"></span>
            </h3>
            <div id="ideas-list-completed" class="ideas-list"></div>
          </div>

          <div class="ideas-section" style="margin-top: 2rem;">
            <h3 class="section-title" style="color: #dc3545; border-bottom: 2px solid #dc3545; padding-bottom: 0.5rem; margin-bottom: 1rem;">
              ✕ Rejected
              <span id="rejected-count" style="font-size: 0.875rem; font-weight: normal; color: #888;"></span>
            </h3>
            <div id="ideas-list-rejected" class="ideas-list"></div>
          </div>
          <div id="idea-form-container" class="idea-form-container hidden">
            <h3>DOCUMENT NEW CONCEPT</h3>
            <form id="idea-form" class="idea-form">
              <div class="form-group">
                <label for="concept-name">CONCEPT NAME *</label>
                <input type="text" id="concept-name" required>
              </div>

              <div class="form-group">
                <label for="problem-solved">PROBLEM SOLVED *</label>
                <textarea id="problem-solved" required placeholder="WHAT VALUE PROPOSITION DOES THIS IDEA OFFER?"></textarea>
              </div>

              <div class="form-group">
                <label for="target-audience">TARGET AUDIENCE *</label>
                <input type="text" id="target-audience" required>
              </div>

              <div class="form-group">
                <label for="initial-features">INITIAL FEATURE SET (MVP) *</label>
                <textarea id="initial-features" required placeholder="DEFINE THE SCOPE FOR THE MINIMUM VIABLE PRODUCT"></textarea>
              </div>

              <div class="form-group">
                <label for="tech-stack">TECHNOLOGY STACK (PROPOSED) *</label>
                <select id="tech-stack" required>
                  <option value="">SELECT TECHNOLOGY</option>
                  <option value="React Native">REACT NATIVE</option>
                  <option value="Flutter">FLUTTER</option>
                  <option value="Web">WEB</option>
                  <option value="iOS Native">IOS NATIVE</option>
                  <option value="Android Native">ANDROID NATIVE</option>
                </select>
              </div>

              <div class="form-group">
                <label for="risk-rating">RISK/COMPLEXITY RATING *</label>
                <select id="risk-rating" required>
                  <option value="">SELECT RATING</option>
                  <option value="Low">LOW</option>
                  <option value="Medium">MEDIUM</option>
                  <option value="High">HIGH</option>
                </select>
              </div>

              <div class="form-actions">
                <button type="button" class="btn btn-secondary" id="cancel-idea">CANCEL</button>
                <button type="submit" class="btn btn-primary">SAVE IDEA</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Load initial data from data store and GitHub API
   * @returns {Promise<void>}
   */
  async loadInitialData() {
    try {
      // Load portfolio using DataController
      const portfolio = await this.dataController.loadPortfolioData();

      appState.setPortfolio(portfolio);

      // Debug: log the final portfolio with task counts
      console.log('Initial portfolio loaded:', portfolio.map(app => ({
        id: app.id,
        todosCount: app.todos?.length || 0
      })));

      // Hydrate tasks from backend (sequential to avoid race conditions)
      await this.hydrateTasksForApps(portfolio);

      // Hydrate metadata from backend (sequential to avoid race conditions)
      await this.hydrateMetadataForApps(portfolio);

      // Force a dashboard re-render after all hydration is complete
      // This ensures task counts are displayed correctly even if state updates
      // occurred during async hydration
      const currentState = appState.getState();
      if (currentState.currentView === 'dashboard') {
        console.log('Forcing dashboard re-render after hydration');
        this.updateDashboard(currentState);
      }

      // Load ideas using DataController
      const ideas = await this.dataController.loadIdeas();
      appState.setIdeas(ideas);

      // If using Supabase, we don't need to check for overview JSON or hit GitHub API
      if (dataStore.useSupabase) {
        console.log('Using Supabase backend, skipping GitHub API checks.');
        return;
      }

      // If overview JSON is present, skip live GitHub calls
      const overviewCheck = await apiService.fetchPortfolioOverview();
      const hasOverview = unwrapOr(overviewCheck, []).length > 0;
      if (!hasOverview) {
        this.fetchGitHubDataForApps(portfolio);
      }
    } catch (error) {
      errorHandler.logError(ErrorType.DATA, ErrorSeverity.CRITICAL, 'Failed to load initial data', error);
      console.error('Failed to load initial data:', error);
      appState.setError('Failed to load portfolio data');
    }
  }

  /**
   * Fetch user's repositories from GitHub API
   * Delegates to DataController
   * @returns {Promise<App[]>} Array of apps from GitHub
   */
  async fetchUserRepositories() {
    return await this.dataController.fetchUserRepositories();
  }

  /**
   * Calculate next review date based on review cycle from the latest date
   * Delegates to DataController
   * @param {string|null} lastCommitDate - ISO date of last commit
   * @param {string|null} lastReviewDate - ISO date of last review
   * @returns {string} ISO date string for next review
   */
  calculateNextReviewDate(lastCommitDate = null, lastReviewDate = null) {
    return this.dataController.calculateNextReviewDate(lastCommitDate, lastReviewDate);
  }

  /**
   * Mark app as reviewed - updates last review date and calculates next review
   * @param {string} appId - App identifier
   * @returns {Promise<void>}
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

      // Sync metadata to backend (async, don't block)
      apiService.saveAppMetadata(appId, updatedApp).catch(err => {
        console.warn('Metadata sync failed (queued for retry):', err);
      });

      // Refresh the current view
      this.updateDashboard();

    } catch (error) {
      console.error('Failed to mark app as reviewed:', error);
    }
  }

  /**
   * Fetch GitHub data for all apps using batch processing with concurrency control
   * Delegates to DataController
   */
  async fetchGitHubDataForApps(apps) {
    if (!apps || apps.length === 0) return;

    // Delegate to DataController with state update callback
    const result = await this.dataController.fetchGitHubDataForApps(apps, async (updatedApp) => {
      appState.updateApp(updatedApp);
      
      // Persist the updated data (GitHub stats, etc.) to the backend
      try {
        await dataStore.saveApp(updatedApp);
      } catch (err) {
        console.warn(`Failed to save synced data for ${updatedApp.id}:`, err);
      }
    });

    return result;
  }

  /**
   * Show specific view with optional deep linking support
   * @param {string} view - View name ('dashboard', 'detail', 'ideas')
   * @param {boolean} pushState - Whether to push to browser history
   */
  showView(view, pushState = true) {
    console.log(`showView called with view: ${view}`);
    appState.setView(view);

    if (pushState) {
      // Build hash with app ID and tab for detail view
      const state = appState.getState();
      let hash;

      if (view === 'detail' && state.currentApp) {
        hash = buildHashRoute(view, state.currentApp.id, state.activeTab);
      } else {
        hash = buildHashRoute(view);
      }

      history.pushState({ view }, '', hash);
    }
  }

  /**
   * Restore view from URL hash (for deep linking and page refresh)
   */
  restoreViewFromHash() {
    const { view, appId, tab } = parseHashRoute(window.location.hash);

    if (view === 'detail') {
      if (appId) {
        const app = appState.getAppById(appId);
        if (app) {
          console.log(`Deep link: Restoring detail view for app "${appId}", tab "${tab || 'overview'}"`);
          appState.setCurrentApp(app);
          appState.setActiveTab(tab || 'overview');
          this.showView('detail');
          return;
        } else {
          console.warn(`Deep link: App "${appId}" not found, falling back to dashboard`);
        }
      } else {
        // Old URL format #detail without app ID - fall back to dashboard
        console.warn('Deep link: #detail without app ID, falling back to dashboard');
      }
      this.showView('dashboard');
      return;
    }

    // Default to dashboard or use the view from hash
    this.showView(view || 'dashboard');
  }

  /**
   * Update URL hash when tab changes (called from TabbedDetail)
   * @param {string} tab - The new active tab
   */
  updateUrlForTab(tab) {
    const state = appState.getState();
    if (state.currentView === 'detail' && state.currentApp) {
      const hash = buildHashRoute('detail', state.currentApp.id, tab);
      history.replaceState({ view: 'detail' }, '', hash);
    }
  }

  /**
   * Update dashboard view
   */
  updateDashboard(state) {
    if (!state) state = appState.getState();
    const appGrid = document.getElementById('app-grid');
    if (!appGrid) return;

    if (!this.appGrid) {
      this.appGrid = new AppGrid(appGrid, (app) => {
        this.showAppDetail(app);
      });
    }

    // Sync search input with state
    const searchInput = document.getElementById('app-search');
    if (searchInput && searchInput.value !== (state.searchQuery || '')) {
      searchInput.value = state.searchQuery || '';
    }

    // Debug: log what's being rendered
    console.log('Rendering dashboard with portfolio:', state.portfolio?.map(app => app.id));

    // Handle empty portfolio state with skeleton loading
    if (!state.portfolio || state.portfolio.length === 0) {
      // Show skeleton cards instead of spinner
      const skeletonCard = `
        <div class="skeleton-card">
          <div class="skeleton-header">
            <div class="skeleton skeleton-title"></div>
            <div class="skeleton skeleton-badge"></div>
          </div>
          <div class="skeleton skeleton-text long"></div>
          <div class="skeleton skeleton-text medium"></div>
          <div class="skeleton-metrics">
            <div class="skeleton-metric">
              <div class="skeleton skeleton-metric-label"></div>
              <div class="skeleton skeleton-metric-value"></div>
            </div>
            <div class="skeleton-metric">
              <div class="skeleton skeleton-metric-label"></div>
              <div class="skeleton skeleton-metric-value"></div>
            </div>
          </div>
          <div class="skeleton skeleton-button"></div>
        </div>
      `;
      // Show 6 skeleton cards
      appGrid.innerHTML = skeletonCard.repeat(6);
    } else {
      // Apply search and filters (searches name, platform, status, language)
      const searchQuery = state.searchQuery || '';
      // Ensure filters always has default values to prevent filtering issues
      const filters = {
        ...DEFAULT_FILTERS,
        ...(state.filters || {})
      };
      const filteredApps = filterApps(state.portfolio, searchQuery, filters);

      // Sort filtered apps
      const order = state.sortOrder || 'alphabetical';
      const apps = [...filteredApps];
      const byAlpha = (a,b) => String(a.id).localeCompare(String(b.id));
      const toDate = (s) => s ? new Date(s) : null;
      const lastRev = (app) => getLatestReviewDate(app.lastCommitDate, app.lastReviewDate);
      const nextRev = (app) => toDate(app.nextReviewDate) || new Date(8640000000000000);
      const activeCount = (app) => (Array.isArray(app.todos)? app.todos:[])
        .filter(t => {
          const s = String(t.status||'');
          return !t.completed && s !== 'Rejected';
        }).length;
      if (order === 'alphabetical') apps.sort(byAlpha);
      else if (order === 'lastReviewed') apps.sort((a,b) => {
        const ad = toDate(lastRev(a)) || new Date(0);
        const bd = toDate(lastRev(b)) || new Date(0);
        return bd - ad;
      });
      else if (order === 'nextReview') apps.sort((a,b) => nextRev(a) - nextRev(b));
      else if (order === 'activeTodo') apps.sort((a,b) => activeCount(b) - activeCount(a));

      // Render filtered and sorted apps
      if (apps.length === 0) {
        const hasFilters = filters.platform !== 'All' || filters.status !== 'All' || filters.health !== 'All';
        const hasSearch = searchQuery.trim().length > 0;
        appGrid.innerHTML = `
          <div class="empty-state">
            <h3>No matching apps</h3>
            <p>${hasFilters ? 'Try adjusting your filters' : hasSearch ? 'Try a different search term' : 'No apps found'}</p>
            <button class="btn btn-secondary" id="clear-filters-btn">Clear Filters</button>
          </div>
        `;
        const clearBtn = appGrid.querySelector('#clear-filters-btn');
        if (clearBtn) {
          clearBtn.addEventListener('click', () => {
            appState.clearSearchAndFilters();
            const searchInput = document.getElementById('app-search');
            const platformFilter = document.getElementById('platform-filter');
            const statusFilter = document.getElementById('status-filter');
            if (searchInput) searchInput.value = '';
            if (platformFilter) platformFilter.value = 'All';
            if (statusFilter) statusFilter.value = 'All';
          });
        }
      } else {
        this.appGrid.render(apps);
      }
    }
  }

  async hydrateTasksForApps(apps) {
    // If using Supabase, tasks are already loaded with the portfolio
    if (dataStore.useSupabase) {
      console.log('hydrateTasksForApps: Skipping - using Supabase backend');
      return;
    }

    console.log(`hydrateTasksForApps: Hydrating tasks for ${apps.length} apps from API`);

    try {
      const updates = [];
      for (const app of apps) {
        const local = Array.isArray(app.todos) ? app.todos : [];
        const remoteResult = await apiService.fetchRepoTasks(app.id, true); // bypass cache
        const remote = unwrapOr(remoteResult, []);

        // If remote has data, use it as source of truth
        // This ensures deleted tasks don't reappear (including when all are deleted)
        if (Array.isArray(remote)) {
          // Check if local and remote are different
          const keyOf = (t) => (t.id ? String(t.id) : `${t.title || ''}|${t.dueDate || ''}`);
          const localKeys = new Set(local.map(keyOf));
          const remoteKeys = new Set(remote.map(keyOf));

          // Check if there are differences
          const hasDiff = local.length !== remote.length ||
            [...localKeys].some(k => !remoteKeys.has(k)) ||
            [...remoteKeys].some(k => !localKeys.has(k));

          if (hasDiff) {
            console.log(`hydrateTasksForApps: App "${app.id}" updated from ${local.length} to ${remote.length} tasks`);
            // Remote is source of truth - use remote tasks
            const updatedApp = { ...app, todos: remote };
            await dataStore.saveApp(updatedApp);
            updates.push(updatedApp);
          }
        }
      }

      if (updates.length > 0) {
        console.log(`hydrateTasksForApps: Applying ${updates.length} updates`);
        this.applyPortfolioUpdates(updates, `Hydrated tasks for ${updates.length} apps from backend`);
      } else {
        console.log('hydrateTasksForApps: No updates needed');
      }
    } catch (error) {
      console.error('hydrateTasksForApps: Error during hydration:', error);
    }
  }

  /**
   * Hydrate app metadata from backend for all apps
   * Fetches metadata.json for each app and merges with local data (parallelized)
   */
  async hydrateMetadataForApps(apps) {
    // If using Supabase, metadata is already loaded
    if (dataStore.useSupabase) return;
    try {
      // Fetch all metadata in parallel for better performance
      const results = await Promise.all(apps.map(async (app) => {
        try {
          const metadataResult = await apiService.fetchAppMetadata(app.id);
          const metadata = unwrapOr(metadataResult, null);
          if (!metadata) return null;

          // Merge: remote metadata fills in missing local fields
          const updatedApp = {
            ...app,
            description: app.description || metadata.description || '',
            notes: app.notes || metadata.notes || '',
            platform: app.platform || metadata.platform || 'Web',
            lastReviewDate: metadata.lastReviewDate || app.lastReviewDate,
            nextReviewDate: metadata.nextReviewDate || app.nextReviewDate,
            reviewCycle: metadata.reviewCycle || app.reviewCycle || 90
          };

          // Check if any metadata field actually changed
          const hasChanges =
            updatedApp.description !== app.description ||
            updatedApp.notes !== app.notes ||
            updatedApp.platform !== app.platform ||
            updatedApp.lastReviewDate !== app.lastReviewDate ||
            updatedApp.nextReviewDate !== app.nextReviewDate ||
            updatedApp.reviewCycle !== app.reviewCycle;

          if (hasChanges) {
            await dataStore.saveApp(updatedApp);
            return updatedApp;
          }
          return null;
        } catch (_) {
          return null;
        }
      }));

      const updates = results.filter(Boolean);

      if (updates.length > 0) {
        this.applyPortfolioUpdates(updates, `Hydrated metadata for ${updates.length} apps from backend`);
      }
    } catch (err) {
      console.warn('Failed to hydrate metadata:', err);
    }
  }

  /**
   * Helper to apply portfolio updates and refresh dashboard
   * @param {Array} updates - Array of updated app objects
   * @param {string} logMessage - Message to log on success
   */
  applyPortfolioUpdates(updates, logMessage = '') {
    const state = appState.getState();
    const mergedPortfolio = state.portfolio.map(a => {
      const u = updates.find(x => x.id === a.id);
      return u ? u : a;
    });

    // Log the updates being applied
    console.log(`Applying ${updates.length} portfolio updates:`, updates.map(u => ({
      id: u.id,
      todosCount: u.todos?.length || 0
    })));

    appState.setPortfolio(mergedPortfolio);
    const order = state.sortOrder || 'alphabetical';

    // Only update dashboard if it's the current view
    if (state.currentView === 'dashboard') {
      this.updateDashboard({ ...state, portfolio: mergedPortfolio, sortOrder: order });
    }

    if (logMessage) console.log(logMessage);
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
            const api = (await import('./data/ApiService.js')).default;
            const appId = state.currentApp.id;
            const tasks = updatedApp.todos || state.currentApp.todos || [];
            await api.triggerSaveTasks(appId, tasks);
          } catch (err) {}
        },
        (tab) => {
          appState.setActiveTab(tab);
          this.updateUrlForTab(tab);
        },
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
    if (dataStore.useSupabase) {
      console.log('hydrateTasksFromRepo: Skipping - using Supabase backend');
      return;
    }

    try {
      if (!app) return;
      console.log(`hydrateTasksFromRepo: Fetching tasks for "${app.id}"`);

      const remoteResult = await apiService.fetchRepoTasks(app.id, true); // bypass cache
      const remote = unwrapOr(remoteResult, []);

      // Remote is source of truth when available
      if (!Array.isArray(remote)) {
        console.log(`hydrateTasksFromRepo: No remote tasks found for "${app.id}"`);
        return;
      }

      const local = Array.isArray(app.todos) ? app.todos : [];
      const keyOf = (t) => (t.id ? String(t.id) : `${t.title || ''}|${t.dueDate || ''}`);
      const localKeys = new Set(local.map(keyOf));
      const remoteKeys = new Set(remote.map(keyOf));

      // Check if there are differences
      const hasDiff = local.length !== remote.length ||
        [...localKeys].some(k => !remoteKeys.has(k)) ||
        [...remoteKeys].some(k => !localKeys.has(k));

      if (!hasDiff) {
        console.log(`hydrateTasksFromRepo: No changes for "${app.id}" (${local.length} tasks)`);
        return;
      }

      console.log(`hydrateTasksFromRepo: Updating "${app.id}" from ${local.length} to ${remote.length} tasks`);

      // Use remote as source of truth
      const updatedApp = { ...app, todos: remote };
      await dataStore.saveApp(updatedApp);
      appState.updateApp(updatedApp);
      if (this.tabbedDetail) this.tabbedDetail.update(updatedApp);
    } catch (error) {
      console.error(`hydrateTasksFromRepo: Error for "${app?.id}":`, error);
    }
  }

  /**
   * Update ideas view
   */
  updateIdeasView(state) {
    const pendingList = document.getElementById('ideas-list-pending');
    const inDevelopmentList = document.getElementById('ideas-list-in-development');
    const completedList = document.getElementById('ideas-list-completed');
    const rejectedList = document.getElementById('ideas-list-rejected');

    const pendingCount = document.getElementById('pending-count');
    const inDevelopmentCount = document.getElementById('in-development-count');
    const completedCount = document.getElementById('completed-count');
    const rejectedCount = document.getElementById('rejected-count');

    // Get section containers
    const pendingSection = pendingList?.closest('.ideas-section');
    const inDevSection = inDevelopmentList?.closest('.ideas-section');
    const completedSection = completedList?.closest('.ideas-section');
    const rejectedSection = rejectedList?.closest('.ideas-section');

    if (!pendingList || !completedList) return;

    // Split ideas into categories
    const allIdeas = state.ideas || [];

    // Pending: No status or explicitly 'pending' or 'public-submission'
    const pending = allIdeas.filter(idea => !idea.status || idea.status === 'pending' || idea.status === 'public-submission');

    // In Development
    const inDevelopment = allIdeas.filter(idea => idea.status === 'in_development');

    // Completed: 'created' or 'implemented'
    const completed = allIdeas.filter(idea => idea.status === 'created' || idea.status === 'implemented');

    // Rejected
    const rejected = allIdeas.filter(idea => idea.status === 'rejected');

    // Update counts
    if (pendingCount) pendingCount.textContent = pending.length > 0 ? `(${pending.length})` : '';
    if (inDevelopmentCount) inDevelopmentCount.textContent = inDevelopment.length > 0 ? `(${inDevelopment.length})` : '';
    if (completedCount) completedCount.textContent = completed.length > 0 ? `(${completed.length})` : '';
    if (rejectedCount) rejectedCount.textContent = rejected.length > 0 ? `(${rejected.length})` : '';

    const callbacks = {
      onView: (idea) => this.showIdeaDetail(idea),
      onEdit: (idea) => this.editIdea(idea.id),
      onMarkCreated: (ideaId) => this.markIdeaCreated(ideaId),
      onMarkInDev: (ideaId) => this.markIdeaAsInDev(ideaId)
    };

    // Render pending ideas (always show - primary section)
    if (pending.length === 0) {
      pendingList.innerHTML = `
        <div style="text-align: center; padding: 2rem; color: #6c757d;">
          <p>No pending ideas. All caught up!</p>
        </div>
      `;
      delete pendingList.dataset.listenerAttached;
    } else {
      renderIdeasList(pending, pendingList, callbacks);
    }

    // Render in-development ideas (hide section if empty)
    if (inDevelopmentList && inDevSection) {
      if (inDevelopment.length === 0) {
        inDevSection.style.display = 'none';
        delete inDevelopmentList.dataset.listenerAttached;
      } else {
        inDevSection.style.display = '';
        renderIdeasList(inDevelopment, inDevelopmentList, callbacks);
      }
    }

    // Render completed ideas (hide section if empty)
    if (completedSection) {
      if (completed.length === 0) {
        completedSection.style.display = 'none';
        delete completedList.dataset.listenerAttached;
      } else {
        completedSection.style.display = '';
        renderIdeasList(completed, completedList, callbacks);
      }
    }

    // Render rejected ideas (hide section if empty)
    if (rejectedList && rejectedSection) {
      if (rejected.length === 0) {
        rejectedSection.style.display = 'none';
        delete rejectedList.dataset.listenerAttached;
      } else {
        rejectedSection.style.display = '';
        renderIdeasList(rejected, rejectedList, callbacks);
      }
    }

    // Handle idea form
    const formContainer = document.getElementById('idea-form-container');
    if (formContainer) formContainer.classList.add('hidden');

    if (state.showIdeaForm) {
      if (!this.ideaForm) {
        this.ideaForm = new IdeaForm(
          (idea) => this.saveIdea(idea),
          () => this.hideIdeaForm(),
          state.editingIdea
        );
        document.body.appendChild(this.ideaForm.render());
      }
    } else {
      if (this.ideaForm) {
        this.ideaForm.destroy();
        this.ideaForm = null;
      }
    }
  }

  /**
   * Show app detail view
   * @param {App} app - App to display
   * @returns {void}
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
   * @param {string} appId - App identifier
   * @param {string} notes - Developer notes
   * @returns {Promise<void>}
   */
  async saveDeveloperNotes(appId, notesText) {
    try {
      const app = appState.getAppById(appId);
      if (app) {
        // Use 'notes' as the single source of truth (synced to backend)
        const updatedApp = { ...app, notes: notesText };
        await dataStore.saveApp(updatedApp);
        appState.updateApp(updatedApp);

        // Sync metadata to backend (async, don't block)
        apiService.saveAppMetadata(appId, updatedApp).catch(err => {
          console.warn('Metadata sync failed (queued for retry):', err);
        });
      }
    } catch (error) {
      console.error('Failed to save notes:', error);
      appState.setError('Failed to save notes');
    }
  }

  /**
   * Save all app data (todos, improvements, notes, etc.)
   * @param {string} appId - App identifier
   * @param {Partial<App>} updatedAppData - Updated app data
   * @returns {Promise<void>}
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

        // Sync metadata to backend (async, don't block)
        apiService.saveAppMetadata(appId, updatedApp).catch(err => {
          console.warn('Metadata sync failed (queued for retry):', err);
        });
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
   * Edit existing idea (admin only)
   */
  editIdea(ideaId) {
    // Security check: Only admins can edit ideas
    if (!appState.isAdmin()) {
      toastManager.show('Admin access required', 'error');
      return;
    }

    const idea = appState.getIdeaById(ideaId);
    if (idea) {
      this.showIdeaForm(idea);
    }
  }

  /**
   * Show idea detail modal (all users)
   */
  showIdeaDetail(idea) {
    showIdeaDetailModal(idea, {
      onEdit: (idea) => this.editIdea(idea.id),
      onMarkCreated: (ideaId) => this.markIdeaCreated(ideaId),
      onMarkInDev: (ideaId) => this.markIdeaAsInDev(ideaId),
      onReject: (ideaId) => this.rejectIdea(ideaId),
      onAddComment: (ideaId, comment) => this.addCommentToIdea(ideaId, comment)
    });
  }

  /**
   * Add a comment to an idea (all users)
   */
  async addCommentToIdea(ideaId, comment) {
    try {
      const idea = appState.getIdeaById(ideaId);
      if (!idea) {
        console.error('Idea not found:', ideaId);
        return;
      }

      // Save to data store (handles both Supabase and Local)
      // If Supabase is used, this saves to idea_feedback table
      // If local, it updates the idea object
      const savedComment = await dataStore.addIdeaFeedback(ideaId, comment);
      
      // Update local state with the returned comment (which might have DB ID)
      const commentToAdd = savedComment || comment;

      const updatedIdea = {
        ...idea,
        comments: [...(idea.comments || []), commentToAdd]
      };
      
      appState.updateIdea(updatedIdea);

      // Try to save to YAML (backend) - legacy, keep if not using Supabase
      if (!dataStore.useSupabase) {
          try {
            const api = (await import('./data/ApiService.js')).default;
            await api.saveIdeaYaml(updatedIdea);
          } catch (err) {
            console.warn('Failed to sync comment to backend:', err);
          }
      }

      console.log(`Comment added to idea ${ideaId}`);
    } catch (error) {
      console.error('Failed to add comment:', error);
      throw error;
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
      toastManager.showSuccess('Idea saved successfully');
    } catch (error) {
      console.error('Failed to save idea:', error);
      if (error.code === '42501') {
        toastManager.showError('Permission denied. Run fix_ideas_rls.sql to fix admin permissions.');
      } else {
        appState.setError('Failed to save idea');
      }
    }
  }

  /**
   * Mark idea as created (archived) - admin only
   */
  async markIdeaCreated(ideaId) {
    // Security check: Only admins can mark ideas as created
    if (!appState.isAdmin()) {
      toastManager.show('Admin access required', 'error');
      return;
    }

    try {
      const idea = appState.getIdeaById(ideaId);
      if (!idea) {
        console.error('Idea not found:', ideaId);
        return;
      }

      // Update the idea status to 'implemented' (created)
      const updatedIdea = {
        ...idea,
        status: 'implemented',
        implementedDate: new Date().toISOString()
      };

      // Save to local storage
      await dataStore.saveIdea(updatedIdea);
      appState.updateIdea(updatedIdea);

      // Sync to GitHub
      try {
        await apiService.saveIdeaYaml(updatedIdea);
      } catch (error) {
        console.warn('Failed to sync idea to GitHub:', error);
      }

      toastManager.show(`"${idea.conceptName}" marked as created!`, 'success');
    } catch (error) {
      console.error('Failed to mark idea as created:', error);
      appState.setError('Failed to mark idea as created');
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

      // Hydrate tasks from backend (sequential to avoid race conditions)
      await this.hydrateTasksForApps(portfolio);

      // Hydrate metadata from backend (sequential to avoid race conditions)
      await this.hydrateMetadataForApps(portfolio);

      appState.setLoading(false, 'portfolioLoading');
    } catch (error) {
      console.error('Failed to refresh portfolio:', error);
      appState.setError('Failed to refresh portfolio', 'portfolioError');
      appState.setLoading(false, 'portfolioLoading');
    }
  }

  /**
   * Show loading overlay
   * @param {string} [message='Loading...'] - Loading message
   * @returns {void}
   */
  showLoading(message = 'Loading...') {
    loadingOverlay.show(message);
  }

  /**
   * Hide loading overlay
   * @returns {void}
   */
  hideLoading() {
    loadingOverlay.hide();
  }

  /**
   * Show error message
   * @param {string} message - Error message
   * @returns {void}
   */
  showError(message) {
    toastManager.showError(message);
  }

  /**
   * Hide error message
   * @returns {void}
   */
  hideError() {
    toastManager.hide();
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