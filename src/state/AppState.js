/**
 * AppState - Centralized state management for Sentinel
 * Manages application state and provides methods for state mutations
 */

class AppState {
  constructor() {
    this.state = {
      // Current view state
      currentView: 'dashboard', // dashboard, detail, ideas
      
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
      activeTab: 'overview', // overview, todo, notes
      
      // Form state
      showIdeaForm: false,
      editingIdea: null,
      autoRepoSync: false
      ,sortOrder: 'alphabetical'
    };
    
    this.listeners = new Set();
    this.initialized = false;
  }

  /**
   * Subscribe to state changes
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
   */
  notify() {
    this.listeners.forEach(listener => {
      try {
        listener(this.state);
      } catch (error) {
        console.error('Error in state listener:', error);
      }
    });
  }

  /**
   * Get current state
   */
  getState() {
    return { ...this.state };
  }

  /**
   * Set state (immutable update)
   */
  setState(updates) {
    const prevState = this.state;
    this.state = { ...this.state, ...updates };
    
    // Only notify if state actually changed
    if (JSON.stringify(prevState) !== JSON.stringify(this.state)) {
      this.notify();
    }
  }

  /**
   * Set current view
   */
  setView(view) {
    if (!['dashboard', 'detail', 'ideas'].includes(view)) {
      console.warn('Invalid view:', view);
      return;
    }
    
    this.setState({ 
      currentView: view,
      error: null 
    });
  }

  /**
   * Set current app for detail view
   */
  setCurrentApp(app) {
    this.setState({ 
      currentApp: app,
      currentAppError: null 
    });
  }

  /**
   * Set active tab in detail view
   */
  setActiveTab(tab) {
    if (!['overview', 'todo', 'notes'].includes(tab)) {
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
   */
  setPortfolio(portfolio) {
    // Filter out private repositories and eventcall-images
    const publicRepos = (portfolio || []).filter(app => !app.isPrivate && app.id !== 'eventcall-images');
    console.log(`Setting portfolio with ${publicRepos.length} public repositories (filtered from ${portfolio?.length || 0} total)`);
    
    this.setState({ 
      portfolio: publicRepos,
      portfolioLoading: false,
      portfolioError: null 
    });
  }

  /**
   * Update a single app in portfolio
   */
  updateApp(updatedApp) {
    const portfolio = this.state.portfolio.map(app => 
      app.id === updatedApp.id ? updatedApp : app
    );
    this.setState({ portfolio });
  }

  /**
   * Add new app to portfolio
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
    
    // Check pending todos
    if (app.pendingTodos > 5) healthScore += 1;
    
    // Determine health level
    if (healthScore >= 3) return 'critical';
    if (healthScore >= 1) return 'warning';
    return 'good';
  }

  /**
   * Get app by ID
   */
  getAppById(appId) {
    return this.state.portfolio.find(app => app.id === appId);
  }

  /**
   * Get idea by ID
   */
  getIdeaById(ideaId) {
    return this.state.ideas.find(idea => idea.id === ideaId);
  }

  /**
   * Reset state to initial values
   */
  reset() {
    this.state = {
      currentView: 'dashboard',
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
      editingIdea: null
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