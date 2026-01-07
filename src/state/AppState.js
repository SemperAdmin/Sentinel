/**
 * AppState - Centralized state management for Sentinel
 * Manages application state and provides methods for state mutations
 */
import { EXCLUDED_REPO_NAMES } from '../utils/constants.js'
import { getPendingTodosCount } from '../utils/helpers.js'

/**
 * @typedef {Object} App
 * @property {string} id - Unique identifier for the app
 * @property {string} repoUrl - GitHub repository URL
 * @property {string} platform - Platform (Web, iOS, Android, etc.)
 * @property {string} status - Status (Active, Archived, etc.)
 * @property {string|null} lastReviewDate - ISO date of last review
 * @property {string|null} nextReviewDate - ISO date of next scheduled review
 * @property {number} pendingTodos - Count of pending todos
 * @property {string} notes - Description or notes
 * @property {string|null} lastCommitDate - ISO date of last commit
 * @property {string|null} latestTag - Latest git tag
 * @property {number} stars - GitHub stars count
 * @property {string} language - Primary programming language
 * @property {boolean} isPrivate - Whether repo is private
 * @property {boolean} archived - Whether repo is archived
 * @property {Array<Todo>} todos - Array of todos
 * @property {string} developerNotes - Developer notes
 * @property {number} improvementBudget - Budget percentage for improvements
 * @property {string} currentSprint - Current sprint identifier
 */

/**
 * @typedef {Object} Todo
 * @property {string} id - Unique identifier
 * @property {string} title - Todo title
 * @property {string} description - Todo description
 * @property {string} priority - Priority level (low, medium, high)
 * @property {string|null} dueDate - ISO date string
 * @property {boolean} completed - Completion status
 * @property {string} createdAt - ISO date of creation
 * @property {string} status - Status (Draft, Active, Completed, Rejected)
 * @property {number} [effort] - Effort estimate (1-5)
 * @property {number} [impact] - Impact estimate (1-5)
 */

/**
 * @typedef {Object} Idea
 * @property {string} id - Unique identifier
 * @property {string} conceptName - Name of the idea
 * @property {string} problemSolved - Problem this idea solves
 * @property {string} targetAudience - Target audience
 * @property {string} techStack - Technology stack
 * @property {string} riskRating - Risk rating (Low, Medium, High)
 * @property {string} dateCreated - ISO date of creation
 */

/**
 * @typedef {Object} State
 * @property {'dashboard'|'detail'|'ideas'|'login'|'feedback'} currentView - Current view
 * @property {App[]} portfolio - Portfolio of apps
 * @property {boolean} portfolioLoading - Portfolio loading state
 * @property {string|null} portfolioError - Portfolio error message
 * @property {App|null} currentApp - Currently selected app
 * @property {boolean} currentAppLoading - Current app loading state
 * @property {string|null} currentAppError - Current app error message
 * @property {Idea[]} ideas - Array of ideas
 * @property {boolean} ideasLoading - Ideas loading state
 * @property {string|null} ideasError - Ideas error message
 * @property {boolean} loading - Global loading state
 * @property {string|null} error - Global error message
 * @property {'overview'|'todo'} activeTab - Active tab in detail view
 * @property {boolean} showIdeaForm - Whether idea form is shown
 * @property {Idea|null} editingIdea - Idea being edited
 * @property {boolean} autoRepoSync - Auto repo sync enabled
 * @property {'alphabetical'|'lastReviewed'|'nextReview'|'activeTodo'} sortOrder - Sort order
 * @property {boolean} isAuthenticated - Whether user is authenticated
 * @property {'admin'|'public'|'guest'} userRole - Current user role
 * @property {boolean} showLogin - Whether to show login screen
 */

/**
 * @callback StateListener
 * @param {State} state - Current state
 * @returns {void}
 */

class AppState {
  constructor() {
    this.state = {
      // Current view state
      currentView: 'login', // login, dashboard, detail, ideas, feedback

      // Portfolio data
      portfolio: [],
      portfolioLoading: false,
      portfolioError: null,

      // Current app detail
      currentApp: null,
      currentAppLoading: false,
      currentAppError: null,

      // Ideas data
      ideas: [],
      ideasLoading: false,
      ideasError: null,

      // UI state
      loading: false,
      error: null,

      // Active tab in detail view
      activeTab: 'overview', // overview, todo

      // Form state
      showIdeaForm: false,
      editingIdea: null,
      autoRepoSync: false,
      sortOrder: 'alphabetical',

      // Search and filter state
      searchQuery: '',
      filters: {
        platform: 'All',
        status: 'All',
        health: 'All'
      },

      // Authentication state
      isAuthenticated: false,
      userRole: 'guest', // admin, public, guest
      showLogin: true
    };

    this.listeners = new Set();
    this.initialized = false;

    // Race condition prevention
    this.isNotifying = false;
    this.pendingNotify = false;
    this.batchTimeout = null;
  }

  /**
   * Subscribe to state changes
   * @param {StateListener} listener - Callback function to invoke on state changes
   * @returns {Function} Unsubscribe function
   */
  subscribe(listener) {
    this.listeners.add(listener);

    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all listeners of state changes
   * Prevents re-entrant notifications to avoid race conditions
   * @returns {void}
   */
  notify() {
    // Prevent re-entrant notifications
    if (this.isNotifying) {
      this.pendingNotify = true;
      return;
    }

    this.isNotifying = true;

    try {
      this.listeners.forEach(listener => {
        try {
          listener(this.state);
        } catch (error) {
          console.error('Error in state listener:', error);
        }
      });
    } finally {
      this.isNotifying = false;

      // If a notification was requested during processing, trigger it now
      if (this.pendingNotify) {
        this.pendingNotify = false;
        this.notify();
      }
    }
  }

  /**
   * Get current state
   * @returns {State} Copy of current state
   */
  getState() {
    return { ...this.state };
  }

  /**
   * Set state (immutable update)
   * @param {Partial<State>} updates - State updates to apply
   * @param {boolean} [batch=false] - Whether to batch this update
   * @returns {void}
   */
  setState(updates, batch = false) {
    const prevState = this.state;
    this.state = { ...this.state, ...updates };

    // Check if state actually changed using shallow comparison for performance
    const hasChanged = this.hasStateChanged(prevState, this.state, updates);

    if (hasChanged) {
      if (batch) {
        this.scheduleBatchedNotify();
      } else {
        this.notify();
      }
    }
  }

  /**
   * Check if state has changed using shallow comparison on updated keys
   * More efficient than JSON.stringify for simple updates
   * @param {State} prevState - Previous state
   * @param {State} newState - New state
   * @param {Partial<State>} updates - Keys that were updated
   * @returns {boolean} True if state changed
   * @private
   */
  hasStateChanged(prevState, newState, updates) {
    // For array and object updates, use JSON comparison
    for (const key in updates) {
      const prevValue = prevState[key];
      const newValue = newState[key];

      // For arrays and objects, use JSON comparison
      if (Array.isArray(newValue) || (typeof newValue === 'object' && newValue !== null)) {
        if (JSON.stringify(prevValue) !== JSON.stringify(newValue)) {
          return true;
        }
      } else {
        // For primitives, use direct comparison
        if (prevValue !== newValue) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Schedule a batched notification (debounced)
   * Prevents excessive re-renders from rapid state updates
   * @private
   */
  scheduleBatchedNotify() {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
    }

    this.batchTimeout = setTimeout(() => {
      this.batchTimeout = null;
      this.notify();
    }, 0); // Execute on next tick
  }

  /**
   * Set current view
   * @param {'dashboard'|'detail'|'ideas'|'login'|'feedback'} view - View to display
   * @returns {void}
   */
  setView(view) {
    if (!['dashboard', 'detail', 'ideas', 'login', 'feedback'].includes(view)) {
      console.warn('Invalid view:', view);
      return;
    }

    this.setState({
      currentView: view,
      error: null
    });
  }

  /**
   * Set authentication state
   * @param {'admin'|'public'|'guest'} role - User role
   * @returns {void}
   */
  setAuthentication(role) {
    const validRoles = ['admin', 'public', 'guest'];
    if (!validRoles.includes(role)) {
      console.warn('Invalid role:', role);
      return;
    }

    this.setState({
      isAuthenticated: role !== 'guest',
      userRole: role,
      showLogin: role === 'guest',
      currentView: role === 'guest' ? 'login' : 'dashboard'
    });
  }

  /**
   * Log out user
   * @returns {void}
   */
  logout() {
    this.setState({
      isAuthenticated: false,
      userRole: 'guest',
      showLogin: true,
      currentView: 'login',
      currentApp: null
    });
  }

  /**
   * Check if current user is admin
   * @returns {boolean}
   */
  isAdmin() {
    return this.state.userRole === 'admin';
  }

  /**
   * Check if current user is public
   * @returns {boolean}
   */
  isPublic() {
    return this.state.userRole === 'public';
  }

  /**
   * Set current app for detail view
   * @param {App|null} app - App to display in detail view
   * @returns {void}
   */
  setCurrentApp(app) {
    this.setState({
      currentApp: app,
      currentAppError: null
    });
  }

  /**
   * Set active tab in detail view
   * @param {'overview'|'todo'} tab - Tab to display
   * @returns {void}
   */
  setActiveTab(tab) {
    if (!['overview', 'todo'].includes(tab)) {
      console.warn('Invalid tab:', tab);
      return;
    }

    this.setState({ activeTab: tab });
  }

  setAutoRepoSync(enabled) {
    this.setState({ autoRepoSync: !!enabled });
  }

  setSortOrder(order) {
    const allowed = ['alphabetical','lastReviewed','nextReview','activeTodo'];
    this.setState({ sortOrder: allowed.includes(order) ? order : 'alphabetical' });
  }

  /**
   * Set search query
   * @param {string} query - Search query string
   */
  setSearchQuery(query) {
    this.setState({ searchQuery: query || '' });
  }

  /**
   * Set filters
   * @param {Object} filters - Filter object with platform, status, health
   */
  setFilters(filters) {
    const currentFilters = this.state.filters || {};
    this.setState({
      filters: { ...currentFilters, ...filters }
    });
  }

  /**
   * Clear all search and filters
   */
  clearSearchAndFilters() {
    this.setState({
      searchQuery: '',
      filters: {
        platform: 'All',
        status: 'All',
        health: 'All'
      }
    });
  }

  /**
   * Set loading state
   */
  setLoading(loading, specificKey = null) {
    if (specificKey) {
      this.setState({ [specificKey]: loading });
    } else {
      this.setState({ loading });
    }
  }

  /**
   * Set error state
   */
  setError(error, specificKey = null) {
    if (specificKey) {
      this.setState({ [specificKey]: error });
    } else {
      this.setState({ error });
    }
    
    // Auto-clear error after 5 seconds
    setTimeout(() => {
      if (specificKey) {
        this.setState({ [specificKey]: null });
      } else {
        this.setState({ error: null });
      }
    }, 5000);
  }

  /**
   * Clear error
   */
  clearError(specificKey = null) {
    if (specificKey) {
      this.setState({ [specificKey]: null });
    } else {
      this.setState({ error: null });
    }
  }

  /**
   * Set portfolio data - filter to only public repositories
   * @param {App[]} portfolio - Array of apps
   * @returns {void}
   */
  setPortfolio(portfolio) {
    const publicRepos = (portfolio || []).filter(app => !app.isPrivate && !EXCLUDED_REPO_NAMES.includes(app.id));
    console.log(`Setting portfolio with ${publicRepos.length} public repositories (filtered from ${portfolio?.length || 0} total)`);
    this.setState({ portfolio: publicRepos, portfolioLoading: false, portfolioError: null });
  }

  /**
   * Update a single app in portfolio
   * @param {App} updatedApp - Updated app data
   * @returns {void}
   */
  updateApp(updatedApp) {
    const portfolio = this.state.portfolio.map(app =>
      app.id === updatedApp.id ? updatedApp : app
    );
    this.setState({ portfolio });
  }

  /**
   * Add new app to portfolio
   * @param {App} newApp - New app to add
   * @returns {void}
   */
  addApp(newApp) {
    const portfolio = [...this.state.portfolio, newApp];
    this.setState({ portfolio });
  }

  /**
   * Remove app from portfolio
   */
  removeApp(appId) {
    const portfolio = this.state.portfolio.filter(app => app.id !== appId);
    this.setState({ portfolio });
  }

  /**
   * Set ideas data
   */
  setIdeas(ideas) {
    this.setState({ 
      ideas: ideas || [],
      ideasLoading: false,
      ideasError: null 
    });
  }

  /**
   * Add new idea
   */
  addIdea(newIdea) {
    const ideas = [...this.state.ideas, newIdea];
    this.setState({ ideas });
  }

  /**
   * Update existing idea
   */
  updateIdea(updatedIdea) {
    const ideas = this.state.ideas.map(idea => 
      idea.id === updatedIdea.id ? updatedIdea : idea
    );
    this.setState({ ideas });
  }

  /**
   * Remove idea
   */
  removeIdea(ideaId) {
    const ideas = this.state.ideas.filter(idea => idea.id !== ideaId);
    this.setState({ ideas });
  }

  /**
   * Show/hide idea form
   */
  setShowIdeaForm(show, editingIdea = null) {
    this.setState({ 
      showIdeaForm: show,
      editingIdea: editingIdea 
    });
  }

  /**
   * Get computed properties
   */
  getComputed() {
    const { portfolio, ideas } = this.state;
    
    return {
      // Portfolio stats
      totalApps: portfolio.length,
      activeApps: portfolio.filter(app => app.status === 'Active').length,
      archivedApps: portfolio.filter(app => app.status === 'Archived').length,
      
      // Review stats
      overdueReviews: portfolio.filter(app => {
        if (!app.nextReviewDate) return false;
        return new Date(app.nextReviewDate) < new Date();
      }).length,
      
      // Health stats
      healthyApps: portfolio.filter(app => this.calculateHealth(app) === 'good').length,
      warningApps: portfolio.filter(app => this.calculateHealth(app) === 'warning').length,
      criticalApps: portfolio.filter(app => this.calculateHealth(app) === 'critical').length,
      
      // Ideas stats
      totalIdeas: ideas.length,
      lowRiskIdeas: ideas.filter(idea => idea.riskRating === 'Low').length,
      mediumRiskIdeas: ideas.filter(idea => idea.riskRating === 'Medium').length,
      highRiskIdeas: ideas.filter(idea => idea.riskRating === 'High').length
    };
  }

  /**
   * Calculate app health based on last commit and review dates
   */
  calculateHealth(app) {
    if (!app.lastCommitDate && !app.nextReviewDate) {
      return 'warning';
    }
    
    let healthScore = 0;
    
    // Check last commit date (if available)
    if (app.lastCommitDate) {
      const daysSinceCommit = Math.floor(
        (new Date() - new Date(app.lastCommitDate)) / (1000 * 60 * 60 * 24)
      );
      
      if (daysSinceCommit > 90) healthScore += 2;
      else if (daysSinceCommit > 60) healthScore += 1;
    }
    
    // Check review status
    if (app.nextReviewDate) {
      const daysUntilReview = Math.floor(
        (new Date(app.nextReviewDate) - new Date()) / (1000 * 60 * 60 * 24)
      );
      
      if (daysUntilReview < 0) healthScore += 2; // Overdue
      else if (daysUntilReview < 14) healthScore += 1; // Due soon
    }
    
    // Check pending todos - use actual count from todos array
    const pendingCount = getPendingTodosCount(app);
    if (pendingCount > 5) healthScore += 1;

    // Determine health level
    if (healthScore >= 3) return 'critical';
    if (healthScore >= 1) return 'warning';
    return 'good';
  }

  /**
   * Get app by ID
   * @param {string} appId - App identifier
   * @returns {App|undefined} App if found, undefined otherwise
   */
  getAppById(appId) {
    return this.state.portfolio.find(app => app.id === appId);
  }

  /**
   * Get idea by ID
   * @param {string} ideaId - Idea identifier
   * @returns {Idea|undefined} Idea if found, undefined otherwise
   */
  getIdeaById(ideaId) {
    return this.state.ideas.find(idea => idea.id === ideaId);
  }

  /**
   * Batch multiple state updates together
   * Useful for updating multiple pieces of state without triggering multiple renders
   * @param {Function} updateFn - Function that performs multiple setState calls
   * @returns {void}
   */
  batchUpdates(updateFn) {
    // Temporarily prevent notifications, but keep track if one is needed
    const originalNotify = this.notify;
    let needsNotify = false;
    this.notify = () => {
      needsNotify = true;
    };

    try {
      updateFn();
    } finally {
      // Restore the original notify function
      this.notify = originalNotify;

      // If any of the updates triggered a notification, trigger a single one now
      if (needsNotify) {
        this.notify();
      }
    }
  }

  /**
   * Reset state to initial values
   * @returns {void}
   */
  reset() {
    // Clear any pending batch timeout
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }

    this.state = {
      currentView: 'login',
      portfolio: [],
      portfolioLoading: false,
      portfolioError: null,
      currentApp: null,
      currentAppLoading: false,
      currentAppError: null,
      ideas: [],
      ideasLoading: false,
      ideasError: null,
      loading: false,
      error: null,
      activeTab: 'overview',
      showIdeaForm: false,
      editingIdea: null,
      autoRepoSync: false,
      sortOrder: 'alphabetical',
      searchQuery: '',
      filters: {
        platform: 'All',
        status: 'All',
        health: 'All'
      },
      isAuthenticated: false,
      userRole: 'guest',
      showLogin: true
    };
    this.notify();
  }

  /**
   * Debug utility to log current state
   */
  debug() {
    console.log('Current AppState:', this.state);
    console.log('Computed stats:', this.getComputed());
  }
}

// Create and export singleton instance
const appState = new AppState();
export default appState;