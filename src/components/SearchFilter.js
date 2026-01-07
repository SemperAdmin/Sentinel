/**
 * SearchFilter - Search and filter functionality for apps
 */

/**
 * Filter apps based on search query and filters
 * Searches across: name, id, description, platform, status, language
 * @param {Array} apps - Array of apps to filter
 * @param {string} searchQuery - Search query string
 * @param {Object} filters - Filter object with platform, status, health
 * @returns {Array} Filtered array of apps
 */
export function filterApps(apps, searchQuery = '', filters = {}) {
  if (!apps || !Array.isArray(apps)) return [];

  let filtered = [...apps];

  // Apply platform filter
  if (filters.platform && filters.platform !== 'All') {
    filtered = filtered.filter(app => {
      const appPlatform = (app.platform || '').toLowerCase();
      const filterPlatform = filters.platform.toLowerCase();
      return appPlatform.includes(filterPlatform);
    });
  }

  // Apply status filter
  if (filters.status && filters.status !== 'All') {
    filtered = filtered.filter(app => {
      const appStatus = (app.status || '').toLowerCase();
      const filterStatus = filters.status.toLowerCase();
      return appStatus === filterStatus;
    });
  }

  // Apply health filter
  if (filters.health && filters.health !== 'All') {
    filtered = filtered.filter(app => {
      const health = calculateAppHealth(app);
      return health === filters.health.toLowerCase();
    });
  }

  // Apply search query if provided
  if (searchQuery && searchQuery.trim()) {
    const query = searchQuery.toLowerCase().trim();

    filtered = filtered.filter(app => {
      const id = (app.id || '').toLowerCase();
      const name = (app.name || app.id || '').toLowerCase();
      const description = (app.description || app.notes || '').toLowerCase();
      const platform = (app.platform || '').toLowerCase();
      const status = (app.status || '').toLowerCase();
      const language = (app.language || '').toLowerCase();

      // Check if query matches any field
      return id.includes(query) ||
             name.includes(query) ||
             description.includes(query) ||
             platform.includes(query) ||
             status.includes(query) ||
             language.includes(query);
    });
  }

  return filtered;
}

/**
 * Calculate app health based on various factors
 * @param {Object} app - App object
 * @returns {string} Health status: 'good', 'warning', 'critical'
 */
function calculateAppHealth(app) {
  let score = 0;
  const now = new Date();

  // Check days since last commit
  if (app.lastCommitDate) {
    const lastCommit = new Date(app.lastCommitDate);
    const daysSinceCommit = Math.floor((now - lastCommit) / (1000 * 60 * 60 * 24));
    if (daysSinceCommit > 90) score += 2;
    else if (daysSinceCommit > 60) score += 1;
  }

  // Check if review is overdue
  if (app.nextReviewDate) {
    const reviewDate = new Date(app.nextReviewDate);
    if (reviewDate < now) score += 2;
  }

  // Check active todos
  const activeTodos = (app.todos || []).filter(t => !t.completed).length;
  if (activeTodos > 5) score += 1;

  if (score >= 3) return 'critical';
  if (score >= 1) return 'warning';
  return 'good';
}

export default filterApps;
