/**
 * SearchFilter - Search functionality for filtering apps
 */

/**
 * Filter apps based on search query
 * Searches across: name, id, description, platform, status, language
 * @param {Array} apps - Array of apps to filter
 * @param {string} searchQuery - Search query string
 * @returns {Array} Filtered array of apps
 */
export function filterApps(apps, searchQuery = '') {
  if (!apps || !Array.isArray(apps)) return [];

  // Return all apps if no search query
  if (!searchQuery || !searchQuery.trim()) {
    return [...apps];
  }

  const query = searchQuery.toLowerCase().trim();

  return apps.filter(app => {
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

export default filterApps;
