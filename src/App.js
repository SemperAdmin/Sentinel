/**
 * App.js - Main application orchestration for Sentinel
 * Coordinates all components, state management, and data operations
 */

import dataStore from './data/DataStore.js';
import apiService from './data/ApiService.js';
import appState from './state/AppState.js';
import { AppGrid } from './components/AppCard.js';
import { TabbedDetail } from './components/TabbedDetail.js';
import { IdeaForm } from './components/IdeaForm.js';
import { formatDate, calculateHealth, isValidGitHubUrl } from './utils/helpers.js';

class App {
  constructor() {
    this.appGrid = null;
    this.tabbedDetail = null;
    this.ideaForm = null;
    this.initialized = false;
  }

  /**
   * Initialize the application
   */
  async init() {
    try {
      this.showLoading('Initializing application...');
      
      // Initialize data store
      await dataStore.init();
      
      // Set up event listeners
      this.setupEventListeners();
      
      // Subscribe to state changes
      this.subscribeToState();
      
      // Load initial data
      await this.loadInitialData();
      
      // Set initial view
      this.showView('dashboard');
      
      this.hideLoading();
      this.initialized = true;
      
      console.log('Sentinel initialized successfully');
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
      // Load portfolio
      const portfolio = await dataStore.getPortfolio();
      appState.setPortfolio(portfolio);

      // Load ideas
      const ideas = await dataStore.getIdeas();
      appState.setIdeas(ideas);

      // Fetch GitHub data for apps (in background)
      this.fetchGitHubDataForApps(portfolio);
    } catch (error) {
      console.error('Failed to load initial data:', error);
      appState.setError('Failed to load portfolio data');
    }
  }

  /**
   * Fetch GitHub data for all apps (with rate limiting consideration)
   */
  async fetchGitHubDataForApps(apps) {
    if (!apps || apps.length === 0) return;

    // Check if API key is configured
    if (!apiService.isApiKeyConfigured()) {
      console.warn('GitHub API key not configured. Using fallback data.');
      return;
    }

    // Fetch data with delays to avoid rate limiting
    for (let i = 0; i < apps.length; i++) {
      const app = apps[i];
      if (app.repoUrl && isValidGitHubUrl(app.repoUrl)) {
        try {
          // Add delay between requests (1 second)
          if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }

          const repoData = await apiService.getComprehensiveRepoData(app.repoUrl);
          
          // Update app with GitHub data
          const updatedApp = {
            ...app,
            lastCommitDate: repoData.lastCommitDate,
            latestTag: repoData.latestTag,
            description: repoData.description || app.description
          };

          // Save to data store and update state
          await dataStore.saveApp(updatedApp);
          appState.updateApp(updatedApp);
        } catch (error) {
          console.error(`Failed to fetch GitHub data for ${app.id}:`, error);
          // Continue with other apps even if one fails
        }
      }
    }
  }

  /**
   * Show specific view
   */
  showView(view, pushState = true) {
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

    this.appGrid.render(state.portfolio);
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
      this.tabbedDetail = new TabbedDetail(
        state.currentApp,
        (notes) => this.saveDeveloperNotes(state.currentApp.id, notes),
        (tab) => appState.setActiveTab(tab)
      );
      detailContent.innerHTML = '';
      detailContent.appendChild(this.tabbedDetail.render());
    } else {
      this.tabbedDetail.update(state.currentApp);
    }

    // Set active tab
    if (this.tabbedDetail.activeTab !== state.activeTab) {
      this.tabbedDetail.switchTab(state.activeTab);
    }
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
        <p>${this.escapeHtml(idea.problemSolved.substring(0, 100))}${idea.problemSolved.length > 100 ? '...' : ''}</p>
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
        const updatedApp = { ...app, notes };
        await dataStore.saveApp(updatedApp);
        appState.updateApp(updatedApp);
      }
    } catch (error) {
      console.error('Failed to save notes:', error);
      appState.setError('Failed to save notes');
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