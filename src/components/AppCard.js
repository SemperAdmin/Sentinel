/**
 * AppCard Component - Displays individual app information in a card format
 */

import { formatDate, calculateHealth, getHealthColor, getLatestReviewDate, getPendingTodosCount, getPendingStatusTodosCount, getActiveTodosCount, parseGitHubUrl } from '../utils/helpers.js';

export class AppCard {
  constructor(app, onClick) {
    this.app = app;
    this.onClick = onClick;
    this.element = null;
  }

  /**
   * Get the live app URL from the repo URL
   * Converts GitHub repo URL to GitHub Pages URL
   */
  getAppUrl() {
    const parsed = parseGitHubUrl(this.app.repoUrl);
    if (parsed) {
      return `https://${parsed.owner.toLowerCase()}.github.io/${parsed.repo}/`;
    }
    return null;
  }

  /**
   * Create the card element
   */
  render() {
    const health = calculateHealth(this.app);
    const healthColor = getHealthColor(health);
    const lastReviewedDate = getLatestReviewDate(this.app.lastCommitDate, this.app.lastReviewDate);
    const pendingStatusTodos = getPendingStatusTodosCount(this.app);
    const activeTodos = getActiveTodosCount(this.app);
    const appUrl = this.getAppUrl();

    const card = document.createElement('div');
    card.className = 'app-card';
    card.onclick = () => this.onClick(this.app);

    const description = this.app.description || this.app.notes || '';
    const truncatedDesc = description.length > 100
      ? description.substring(0, 100) + '...'
      : description;

    // Format pending todos
    const pendingDisplay = pendingStatusTodos > 0
      ? `<span style="font-weight: 600;">${pendingStatusTodos}</span>`
      : '<span style="color: #6c757d;">0</span>';

    // Format active todos with color coding
    const activeDisplay = activeTodos > 0
      ? `<span style="color: ${activeTodos > 5 ? '#dc3545' : activeTodos > 2 ? '#ffc107' : '#28a745'}; font-weight: 600;">${activeTodos}</span>`
      : '<span style="color: #6c757d;">0</span>';

    // Create the open app link HTML (only if appUrl exists)
    const openAppLink = appUrl ? `
      <a href="${this.escapeHtml(appUrl)}"
         target="_blank"
         rel="noopener noreferrer"
         class="app-card-open-link"
         title="Open ${this.escapeHtml(this.app.id)}">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
          <polyline points="15 3 21 3 21 9"></polyline>
          <line x1="10" y1="14" x2="21" y2="3"></line>
        </svg>
      </a>
    ` : '';

    card.innerHTML = `
      <div class="app-card-header">
        <h3 class="app-card-title">
          <span class="health-indicator" style="background-color: ${healthColor}"></span>
          ${this.escapeHtml(this.app.id)}
        </h3>
        <div class="app-card-header-actions">
          ${openAppLink}
          <span class="app-card-platform">${this.escapeHtml(this.app.platform)}</span>
        </div>
      </div>

      ${truncatedDesc ? `<p class="app-card-description">${this.escapeHtml(truncatedDesc)}</p>` : ''}

      <div class="app-card-metrics">
        <div class="metric-item">
          <span class="metric-label">Last Reviewed:</span>
          <span class="metric-value">${formatDate(lastReviewedDate, { relative: true })}</span>
        </div>

        <div class="metric-item">
          <span class="metric-label">Next Review:</span>
          <span class="metric-value">
            ${this.formatReviewDate(this.app.nextReviewDate)}
          </span>
        </div>

        <div class="metric-item">
          <span class="metric-label">Pending Tasks:</span>
          <span class="metric-value">${pendingDisplay}</span>
        </div>

        <div class="metric-item">
          <span class="metric-label">Active Tasks:</span>
          <span class="metric-value">${activeDisplay}</span>
        </div>
      </div>

      <button class="btn btn-primary" style="width: 100%; margin-top: 1rem;">
        View App
      </button>
    `;

    // Attach event listener to prevent card click when clicking open link
    const openLink = card.querySelector('.app-card-open-link');
    if (openLink) {
      openLink.addEventListener('click', (event) => {
        event.stopPropagation();
      });
    }

    this.element = card;
    return card;
  }

  /**
   * Format review date with overdue indicator
   */
  formatReviewDate(dateString) {
    if (!dateString) return 'Not scheduled';
    
    const reviewDate = new Date(dateString);
    const now = new Date();
    const daysUntil = Math.ceil((reviewDate - now) / (1000 * 60 * 60 * 24));
    
    if (daysUntil < 0) {
      return `<span style="color: #dc3545; font-weight: 600;">Overdue (${Math.abs(daysUntil)} days)</span>`;
    } else if (daysUntil <= 14) {
      return `<span style="color: #ffc107; font-weight: 600;">Due soon (${daysUntil} days)</span>`;
    } else {
      return formatDate(dateString);
    }
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

  /**
   * Update card with new app data
   */
  update(app) {
    this.app = app;
    if (this.element) {
      const newElement = this.render();
      this.element.replaceWith(newElement);
      this.element = newElement;
    }
  }

  /**
   * Remove the card from DOM
   */
  destroy() {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }
}

/**
 * AppGrid Component - Container for app cards
 */
export class AppGrid {
  constructor(container, onAppClick) {
    this.container = container;
    this.onAppClick = onAppClick;
    this.cards = new Map();
  }

  /**
   * Render apps in the grid
   */
  render(apps) {
    // Clear existing cards
    this.clear();
    
    if (!apps || apps.length === 0) {
      this.showEmptyState();
      return;
    }
    
    // Create cards for each app
    apps.forEach(app => {
      const card = new AppCard(app, this.onAppClick);
      const cardElement = card.render();
      this.container.appendChild(cardElement);
      this.cards.set(app.id, card);
    });
  }

  /**
   * Update a single app card
   */
  updateApp(app) {
    const card = this.cards.get(app.id);
    if (card) {
      card.update(app);
    }
  }

  /**
   * Add new app card
   */
  addApp(app) {
    const card = new AppCard(app, this.onAppClick);
    const cardElement = card.render();
    this.container.appendChild(cardElement);
    this.cards.set(app.id, card);
  }

  /**
   * Remove app card
   */
  removeApp(appId) {
    const card = this.cards.get(appId);
    if (card) {
      card.destroy();
      this.cards.delete(appId);
    }
  }

  /**
   * Show empty state
   */
  showEmptyState() {
    this.container.innerHTML = `
      <div style="text-align: center; padding: 3rem; color: #6c757d;">
        <h3>No apps in portfolio</h3>
        <p>Start by adding some apps or creating new ideas.</p>
      </div>
    `;
  }

  /**
   * Clear all cards
   */
  clear() {
    this.cards.forEach(card => card.destroy());
    this.cards.clear();
    this.container.innerHTML = '';
  }
}