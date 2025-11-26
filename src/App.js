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
import { getLatestReviewDate } from './utils/helpers.js';
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
  MAX_CONCURRENT_API_REQUESTS
} from './utils/constants.js';
import { batchProcess } from './utils/batchProcessor.js';
import errorHandler, { ErrorType, ErrorSeverity, RecoveryStrategies } from './utils/errorHandler.js';
import { LoadingStateManager } from './utils/loadingState.js';
import DataController from './controllers/DataController.js';
import { toastManager, loadingOverlay, escapeHtml } from './utils/uiComponents.js';
import { isValidGitHubUrl } from './utils/validation.js';
import { authService } from './auth/AuthService.js';
import LoginForm from './components/LoginForm.js';

class App {
  constructor() {
    this.appGrid = null;
    this.tabbedDetail = null;
    this.ideaForm = null;
    this.loginForm = null;
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
        console.warn('Could not fetch API health status:', error);
      }

      await this.loadInitialData();

      // Set initial view
      this.showView('dashboard');

      this.hideLoading();
      this.initialized = true;

      console.log('Sentinel initialized successfully');
      
      window.checkApiBackend = () => {
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

    if (newIdeaBtn) {
      newIdeaBtn.style.display = isAdmin ? '' : 'none';
    }

    if (submitIdeaBtn) {
      submitIdeaBtn.style.display = isAdmin ? 'none' : '';
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
    // Create modal HTML
    const modalHTML = `
      <div class="admin-modal-overlay" id="admin-modal">
        <div class="admin-modal">
          <div class="admin-modal-header">
            <h3>Admin Login</h3>
            <button class="admin-modal-close" id="close-admin-modal">&times;</button>
          </div>
          <div class="admin-modal-body">
            <form id="admin-login-form">
              <div class="form-group">
                <label for="admin-password-input">Admin Password</label>
                <input
                  type="password"
                  id="admin-password-input"
                  class="form-control"
                  placeholder="Enter admin password"
                  required
                  autofocus
                />
              </div>
              <div class="admin-modal-actions">
                <button type="button" class="btn btn-secondary" id="cancel-admin-login">Cancel</button>
                <button type="submit" class="btn btn-primary">Login</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;

    // Add modal to body
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Get elements
    const modal = document.getElementById('admin-modal');
    const form = document.getElementById('admin-login-form');
    const closeBtn = document.getElementById('close-admin-modal');
    const cancelBtn = document.getElementById('cancel-admin-login');
    const passwordInput = document.getElementById('admin-password-input');

    // Escape key handler
    const escapeHandler = (e) => {
      if (e.key === 'Escape') {
        closeModal();
      }
    };

    // Close modal function - cleanup all listeners
    const closeModal = () => {
      document.removeEventListener('keydown', escapeHandler);
      modal.remove();
    };

    // Handle form submit
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const password = passwordInput.value;
      const result = await authService.login(password);

      if (result.success) {
        appState.setAuthentication('admin');
        toastManager.show('Successfully logged in as admin', 'success');
        closeModal();
      } else {
        toastManager.show(result.error || 'Invalid password', 'error');
        passwordInput.value = '';
        passwordInput.focus();
      }
    });

    // Close button
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    // Close on overlay click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });

    // Close on escape key
    document.addEventListener('keydown', escapeHandler);

    // Focus password input
    setTimeout(() => passwordInput.focus(), 100);
  }

  /**
   * Show public idea submission modal
   */
  showPublicIdeaSubmission() {
    const modalHTML = `
      <div class="admin-modal-overlay" id="public-idea-modal">
        <div class="admin-modal" style="max-width: 600px;">
          <div class="admin-modal-header">
            <h3>Submit App Idea</h3>
            <button class="admin-modal-close" id="close-public-idea">&times;</button>
          </div>
          <div class="admin-modal-body">
            <p style="color: var(--gray-600); margin-bottom: 1.5rem;">
              Have an idea for a new app? Submit your suggestion below and our team will review it!
            </p>
            <form id="public-idea-form">
              <div class="form-group">
                <label for="public-concept-name">App Name *</label>
                <input
                  type="text"
                  id="public-concept-name"
                  class="form-control"
                  placeholder="Enter app name"
                  required
                />
              </div>

              <div class="form-group">
                <label for="public-problem-solved">What problem does this solve? *</label>
                <textarea
                  id="public-problem-solved"
                  class="form-control"
                  placeholder="Describe the value this app would provide..."
                  rows="4"
                  required
                ></textarea>
              </div>

              <div class="form-group">
                <label for="public-target-audience">Who would use this? *</label>
                <input
                  type="text"
                  id="public-target-audience"
                  class="form-control"
                  placeholder="e.g., Marines, Veterans, General Public"
                  required
                />
              </div>

              <div class="form-group">
                <label for="public-contact-email">Your Email (optional)</label>
                <input
                  type="email"
                  id="public-contact-email"
                  class="form-control"
                  placeholder="contact@example.com"
                />
              </div>

              <div class="admin-modal-actions">
                <button type="button" class="btn btn-secondary" id="cancel-public-idea">Cancel</button>
                <button type="submit" class="btn btn-primary">Submit Idea</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    const modal = document.getElementById('public-idea-modal');
    const form = document.getElementById('public-idea-form');
    const closeBtn = document.getElementById('close-public-idea');
    const cancelBtn = document.getElementById('cancel-public-idea');

    const escapeHandler = (e) => {
      if (e.key === 'Escape') {
        closeModal();
      }
    };

    const closeModal = () => {
      document.removeEventListener('keydown', escapeHandler);
      modal.remove();
    };

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const idea = {
        id: `idea-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        conceptName: document.getElementById('public-concept-name').value,
        problemSolved: document.getElementById('public-problem-solved').value,
        targetAudience: document.getElementById('public-target-audience').value,
        contactEmail: document.getElementById('public-contact-email').value,
        techStack: 'To Be Determined',
        initialFeatures: 'To Be Determined',
        riskRating: 'Medium',
        dateCreated: new Date().toISOString(),
        status: 'public-submission',
        submittedBy: 'public'
      };

      try {
        await this.saveIdea(idea);
        toastManager.show('Thank you! Your idea has been submitted for review.', 'success');
        closeModal();
      } catch (error) {
        console.error('Failed to submit idea:', error);
        toastManager.show('Failed to submit idea. Please try again.', 'error');
      }
    });

    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });

    document.addEventListener('keydown', escapeHandler);

    setTimeout(() => document.getElementById('public-concept-name').focus(), 100);
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
          <label class="view-header-sort-label">
            <span>Sort by</span>
            <select id="sort-select" class="btn btn-secondary view-header-sort-select">
              <option value="alphabetical">Alphabetical</option>
              <option value="lastReviewed">Last Reviewed</option>
              <option value="nextReview">Next Review</option>
              <option value="activeTodo">Active To-Dos</option>
            </select>
          </label>
          <div class="view-actions">
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
        <div class="ideas-content">
          <div id="ideas-list" class="ideas-list"></div>

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

      // Debug: log the final portfolio
      console.log('Final portfolio being set:', portfolio.map(app => ({ id: app.id, name: app.id })));

      // Load ideas using DataController
      const ideas = await this.dataController.loadIdeas();
      appState.setIdeas(ideas);

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
    const result = await this.dataController.fetchGitHubDataForApps(apps, (updatedApp) => {
      appState.updateApp(updatedApp);
    });

    return result;
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
    if (!state) state = appState.getState();
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
      this.appGrid.render(apps);
    }
  }

  async hydrateTasksForApps(apps) {
    try {
      const updates = [];
      for (const app of apps) {
        const local = Array.isArray(app.todos) ? app.todos : [];
        const remoteResult = await apiService.fetchRepoTasks(app.id);
        const remote = unwrapOr(remoteResult, []);
        if (!Array.isArray(remote) || remote.length === 0) continue;
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
            const api = (await import('./data/ApiService.js')).default;
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
      const remoteResult = await apiService.fetchRepoTasks(app.id);
      const remote = unwrapOr(remoteResult, []);
      if (!Array.isArray(remote) || remote.length === 0) return;

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

    // Add click listeners to idea items (admin only)
    const isAdmin = appState.isAdmin();
    if (isAdmin) {
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

    const isAdmin = appState.getState().userRole === 'admin';
    const isPublicSubmission = idea.status === 'public-submission' || idea.submittedBy === 'public';

    return `
      <div class="idea-item ${isPublicSubmission ? 'public-submission' : ''}" data-idea-id="${idea.id}">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <h4>${escapeHtml(idea.conceptName)}</h4>
          ${isPublicSubmission ? '<span style="background: var(--primary-blue); color: white; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">PUBLIC SUBMISSION</span>' : ''}
        </div>
        <p>${escapeHtml(idea.problemSolved ? idea.problemSolved.substring(0, 100) : '')}${idea.problemSolved && idea.problemSolved.length > 100 ? '...' : ''}</p>
        <div class="idea-meta">
          <span>👥 ${escapeHtml(idea.targetAudience)}</span>
          <span>🛠️ ${escapeHtml(idea.techStack)}</span>
          <span style="color: ${riskColor}">⚠️ ${idea.riskRating} Risk</span>
          <span>📅 ${formatDate(idea.dateCreated)}</span>
          ${idea.contactEmail ? `<span>📧 ${escapeHtml(idea.contactEmail)}</span>` : ''}
        </div>
        ${isAdmin ? `
          <div style="margin-top: 1rem;">
            <button class="btn btn-primary" style="margin-right: 0.5rem;" onclick="event.stopPropagation(); app.activateIdea('${idea.id}')">
              Activate & Create Repo
            </button>
            <button class="btn btn-secondary" onclick="event.stopPropagation(); app.editIdea('${idea.id}')">
              Edit
            </button>
          </div>
        ` : ''}
      </div>
    `;
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
   * Activate idea (convert to app) - admin only
   */
  async activateIdea(ideaId) {
    // Security check: Only admins can activate ideas
    if (!appState.isAdmin()) {
      toastManager.show('Admin access required', 'error');
      return;
    }

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