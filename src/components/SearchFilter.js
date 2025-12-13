/**
 * SearchFilter Component - Search and filter functionality for the dashboard
 */

import appState from '../state/AppState.js';
import { calculateHealth } from '../utils/helpers.js';

/**
 * Available filter options
 */
export const FILTER_OPTIONS = {
  platform: ['All', 'Web', 'iOS Native', 'Android Native', 'Cross-Platform'],
  status: ['All', 'Active', 'Archived'],
  health: ['All', 'Healthy', 'Needs Attention', 'Stale']
};

/**
 * SearchFilter class for managing search and filter UI
 */
export class SearchFilter {
  constructor(container, onFilterChange) {
    this.container = container;
    this.onFilterChange = onFilterChange;
    this.searchTimeout = null;
  }

  /**
   * Render the search and filter UI
   */
  render() {
    const state = appState.getState();
    const { searchQuery = '', filters = {} } = state;

    this.container.innerHTML = `
      <div class="search-filter-container">
        <div class="search-box">
          <input
            type="text"
            id="app-search"
            class="search-input"
            placeholder="Search apps..."
            value="${this.escapeHtml(searchQuery)}"
            autocomplete="off"
          />
          <span class="search-icon">&#128269;</span>
          ${searchQuery ? '<button class="search-clear" id="clear-search" title="Clear search">&times;</button>' : ''}
        </div>

        <div class="filter-controls">
          <div class="filter-group">
            <label for="filter-platform">Platform</label>
            <select id="filter-platform" class="filter-select">
              ${FILTER_OPTIONS.platform.map(opt =>
                `<option value="${opt}" ${filters.platform === opt ? 'selected' : ''}>${opt}</option>`
              ).join('')}
            </select>
          </div>

          <div class="filter-group">
            <label for="filter-status">Status</label>
            <select id="filter-status" class="filter-select">
              ${FILTER_OPTIONS.status.map(opt =>
                `<option value="${opt}" ${filters.status === opt ? 'selected' : ''}>${opt}</option>`
              ).join('')}
            </select>
          </div>

          <div class="filter-group">
            <label for="filter-health">Health</label>
            <select id="filter-health" class="filter-select">
              ${FILTER_OPTIONS.health.map(opt =>
                `<option value="${opt}" ${filters.health === opt ? 'selected' : ''}>${opt}</option>`
              ).join('')}
            </select>
          </div>

          ${this.hasActiveFilters(searchQuery, filters) ?
            '<button class="btn btn-secondary btn-sm" id="clear-filters">Clear All</button>' : ''}
        </div>

        <div class="filter-results" id="filter-results"></div>
      </div>
    `;

    this.attachEventListeners();
  }

  /**
   * Check if any filters are active
   */
  hasActiveFilters(searchQuery, filters) {
    return searchQuery ||
           (filters.platform && filters.platform !== 'All') ||
           (filters.status && filters.status !== 'All') ||
           (filters.health && filters.health !== 'All');
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    const searchInput = this.container.querySelector('#app-search');
    const clearSearchBtn = this.container.querySelector('#clear-search');
    const platformFilter = this.container.querySelector('#filter-platform');
    const statusFilter = this.container.querySelector('#filter-status');
    const healthFilter = this.container.querySelector('#filter-health');
    const clearFiltersBtn = this.container.querySelector('#clear-filters');

    // Search input with debouncing
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => {
          this.onFilterChange({ searchQuery: e.target.value });
        }, 200);
      });

      // Handle Enter key
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          searchInput.value = '';
          this.onFilterChange({ searchQuery: '' });
        }
      });
    }

    // Clear search button
    if (clearSearchBtn) {
      clearSearchBtn.addEventListener('click', () => {
        this.onFilterChange({ searchQuery: '' });
      });
    }

    // Platform filter
    if (platformFilter) {
      platformFilter.addEventListener('change', (e) => {
        this.onFilterChange({ filters: { platform: e.target.value } });
      });
    }

    // Status filter
    if (statusFilter) {
      statusFilter.addEventListener('change', (e) => {
        this.onFilterChange({ filters: { status: e.target.value } });
      });
    }

    // Health filter
    if (healthFilter) {
      healthFilter.addEventListener('change', (e) => {
        this.onFilterChange({ filters: { health: e.target.value } });
      });
    }

    // Clear all filters
    if (clearFiltersBtn) {
      clearFiltersBtn.addEventListener('click', () => {
        this.onFilterChange({
          searchQuery: '',
          filters: { platform: 'All', status: 'All', health: 'All' }
        });
      });
    }
  }

  /**
   * Update result count display
   */
  updateResultCount(filtered, total) {
    const resultsEl = this.container.querySelector('#filter-results');
    if (resultsEl) {
      if (filtered === total) {
        resultsEl.textContent = `${total} apps`;
      } else {
        resultsEl.textContent = `Showing ${filtered} of ${total} apps`;
      }
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
}

/**
 * Filter apps based on search query and filters
 * @param {Array} apps - Array of apps to filter
 * @param {string} searchQuery - Search query string
 * @param {Object} filters - Filter options
 * @returns {Array} Filtered array of apps
 */
export function filterApps(apps, searchQuery = '', filters = {}) {
  if (!apps || !Array.isArray(apps)) return [];

  let filtered = [...apps];

  // Apply search query
  if (searchQuery && searchQuery.trim()) {
    const query = searchQuery.toLowerCase().trim();
    filtered = filtered.filter(app => {
      const id = (app.id || '').toLowerCase();
      const name = (app.name || app.id || '').toLowerCase();
      const description = (app.description || app.notes || '').toLowerCase();
      const platform = (app.platform || '').toLowerCase();
      const language = (app.language || '').toLowerCase();

      return id.includes(query) ||
             name.includes(query) ||
             description.includes(query) ||
             platform.includes(query) ||
             language.includes(query);
    });
  }

  // Apply platform filter
  if (filters.platform && filters.platform !== 'All') {
    filtered = filtered.filter(app => {
      const appPlatform = (app.platform || '').toLowerCase();
      const filterPlatform = filters.platform.toLowerCase();
      return appPlatform.includes(filterPlatform) ||
             filterPlatform.includes(appPlatform);
    });
  }

  // Apply status filter
  if (filters.status && filters.status !== 'All') {
    filtered = filtered.filter(app => {
      if (filters.status === 'Active') {
        return !app.archived && app.status !== 'Archived';
      } else if (filters.status === 'Archived') {
        return app.archived || app.status === 'Archived';
      }
      return true;
    });
  }

  // Apply health filter
  if (filters.health && filters.health !== 'All') {
    filtered = filtered.filter(app => {
      const health = calculateHealth(app);
      if (filters.health === 'Healthy') {
        return health === 'healthy';
      } else if (filters.health === 'Needs Attention') {
        return health === 'needs-attention';
      } else if (filters.health === 'Stale') {
        return health === 'stale';
      }
      return true;
    });
  }

  return filtered;
}

export default SearchFilter;
