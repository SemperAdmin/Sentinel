/**
 * Helper utilities for Sentinel
 * Date formatting, health calculations, and other utility functions
 */

import { HEALTH_THRESHOLDS, HEALTH_COLORS } from './constants.js';

/**
 * Format date to readable string
 */
export function formatDate(dateString, options = {}) {
  if (!dateString) return 'Never';
  
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // Relative formatting
    if (options.relative) {
      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays} days ago`;
      if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
      if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
      return `${Math.floor(diffDays / 365)} years ago`;
    }
    
    // Standard formatting
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      ...options
    });
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Invalid date';
  }
}

/**
 * Calculate days between two dates
 */
export function daysBetween(date1, date2) {
  try {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const diffTime = Math.abs(d2 - d1);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  } catch (error) {
    console.error('Error calculating days between dates:', error);
    return 0;
  }
}

/**
 * Check if a date is overdue
 */
export function isOverdue(dateString) {
  if (!dateString) return false;
  try {
    return new Date(dateString) < new Date();
  } catch (error) {
    console.error('Error checking overdue date:', error);
    return false;
  }
}

/**
 * Calculate app health status
 */
export function calculateHealth(app) {
  if (!app) return 'warning';

  let healthScore = 0;
  const now = new Date();

  // Check last commit date
  if (app.lastCommitDate) {
    const daysSinceCommit = daysBetween(app.lastCommitDate, now);
    // Use HEALTH_THRESHOLDS for scoring
    if (daysSinceCommit > HEALTH_THRESHOLDS.STALE) healthScore += 3;
    else if (daysSinceCommit > HEALTH_THRESHOLDS.WARNING) healthScore += 2;
    else if (daysSinceCommit > HEALTH_THRESHOLDS.HEALTHY) healthScore += 1;
  } else {
    healthScore += 2; // Penalty for no commit data
  }

  // Check review status
  if (app.nextReviewDate) {
    const daysUntilReview = daysBetween(now, app.nextReviewDate);
    if (daysUntilReview < 0) healthScore += 3; // Overdue
    else if (daysUntilReview < 14) healthScore += 2; // Due soon
    else if (daysUntilReview < 30) healthScore += 1;
  } else {
    healthScore += 1; // Penalty for no review date
  }

  // Check pending todos - use actual count from todos array
  const pendingCount = getPendingTodosCount(app);
  if (pendingCount > 5) healthScore += 2;
  else if (pendingCount > 2) healthScore += 1;

  // Determine health level
  if (healthScore >= 6) return 'critical';
  if (healthScore >= 3) return 'warning';
  return 'good';
}

/**
 * Get health indicator color
 */
export function getHealthColor(health) {
  const colors = {
    good: HEALTH_COLORS.HEALTHY,
    warning: HEALTH_COLORS.WARNING,
    critical: HEALTH_COLORS.CRITICAL
  };
  return colors[health] || HEALTH_COLORS.UNKNOWN;
}

/**
 * Format repository URL for display
 */
export function formatRepoUrl(url) {
  if (!url) return 'No repository';
  
  try {
    const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (match) {
      return `${match[1]}/${match[2].replace(/\.git$/, '')}`;
    }
    return url;
  } catch (error) {
    console.error('Error formatting repo URL:', error);
    return url;
  }
}

/**
 * Generate unique ID
 */
export function generateId(prefix = 'item') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Slugify text for IDs/URLs
 */
export function slugify(text) {
  if (!text) return '';

  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

/**
 * Normalize app ID to lowercase kebab-case
 * This is the CANONICAL function for normalizing app IDs throughout the application.
 * Always use this when:
 * - Creating new app IDs from repo names
 * - Looking up apps by ID
 * - Fetching tasks/reviews for an app
 * - Saving tasks/reviews for an app
 *
 * @param {string} id - Raw app ID or repo name
 * @returns {string} Normalized lowercase kebab-case ID
 */
export function normalizeAppId(id) {
  if (!id) return '';

  return id
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')  // Replace any non-alphanumeric with dash
    .replace(/^-+/, '')           // Remove leading dashes
    .replace(/-+$/, '')           // Remove trailing dashes
    .replace(/-+/g, '-');         // Collapse multiple dashes
}

/**
 * Get the count of pending (incomplete) todos for an app
 * This replaces the static pendingTodos field which was never updated.
 * Use this instead of app.pendingTodos for accurate counts.
 *
 * @param {Object} app - App object with optional todos array
 * @returns {number} Count of incomplete todos
 */
export function getPendingTodosCount(app) {
  if (!app || !Array.isArray(app.todos)) {
    return 0;
  }
  return app.todos.filter(todo => !todo.completed).length;
}

/**
 * Get the count of pending (was draft) todos for an app
 * @param {Object} app - App object with optional todos array
 * @returns {number} Count of pending todos
 */
export function getPendingStatusTodosCount(app) {
  if (!app || !Array.isArray(app.todos)) {
    return 0;
  }
  return app.todos.filter(todo => !todo.completed && ['Draft', 'Pending'].includes(String(todo.status||''))).length;
}

/**
 * Get the count of active (non-pending) todos for an app
 * @param {Object} app - App object with optional todos array
 * @returns {number} Count of active todos
 */
export function getActiveTodosCount(app) {
  if (!app || !Array.isArray(app.todos)) {
    return 0;
  }
  return app.todos.filter(todo => !todo.completed && !['Draft', 'Pending'].includes(String(todo.status||''))).length;
}

/**
 * Calculate next quarterly review date
 */
export function calculateNextReviewDate(lastReviewDate = null) {
  const date = lastReviewDate ? new Date(lastReviewDate) : new Date();
  date.setMonth(date.getMonth() + 3);
  return date.toISOString().split('T')[0];
}

/**
 * Get SVG icon for task source
 */
export function getSourceIcon(source) {
  const sourceKey = slugify(String(source||'other').replace(/\([^)]*\)/g,'').trim());
  
  const icons = {
    'facebook': `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 8.049C16 3.604 12.418 0 8 0S0 3.604 0 8.049C0 12.038 2.925 15.258 6.75 15.949V10.373H4.718V8.049h2.032V6.275c0-2.009 1.195-3.118 3.027-3.118.883 0 1.802.158 1.802.158v1.98h-1.016c-.998 0-1.309.619-1.309 1.254v1.508h2.228l-.356 2.324H9.237v5.576C13.075 15.258 16 12.038 16 8.049z" fill="#1877F2"/>
    </svg>`,
    
    'instagram': `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1.5" y="1.5" width="13" height="13" rx="3" stroke="#E1306C" stroke-width="1.5"/>
      <circle cx="8" cy="8" r="3" stroke="#E1306C" stroke-width="1.5"/>
      <circle cx="12" cy="4" r="1" fill="#E1306C"/>
    </svg>`,
    
    'teams': `<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="none"><path fill="#5059C9" d="M10.765 6.875h3.616c.342 0 .619.276.619.617v3.288a2.272 2.272 0 01-2.274 2.27h-.01a2.272 2.272 0 01-2.274-2.27V7.199c0-.179.145-.323.323-.323zM13.21 6.225c.808 0 1.464-.655 1.464-1.462 0-.808-.656-1.463-1.465-1.463s-1.465.655-1.465 1.463c0 .807.656 1.462 1.465 1.462z"></path><path fill="#7B83EB" d="M8.651 6.225a2.114 2.114 0 002.117-2.112A2.114 2.114 0 008.65 2a2.114 2.114 0 00-2.116 2.112c0 1.167.947 2.113 2.116 2.113zM11.473 6.875h-5.97a.611.611 0 00-.596.625v3.75A3.669 3.669 0 008.488 15a3.669 3.669 0 003.582-3.75V7.5a.611.611 0 00-.597-.625z"></path><path fill="#000000" d="M8.814 6.875v5.255a.598.598 0 01-.596.595H5.193a3.951 3.951 0 01-.287-1.476V7.5a.61.61 0 01.597-.624h3.31z" opacity=".1"></path><path fill="#000000" d="M8.488 6.875v5.58a.6.6 0 01-.596.595H5.347a3.22 3.22 0 01-.267-.65 3.951 3.951 0 01-.172-1.15V7.498a.61.61 0 01.596-.624h2.985z" opacity=".2"></path><path fill="#000000" d="M8.488 6.875v4.93a.6.6 0 01-.596.595H5.08a3.951 3.951 0 01-.172-1.15V7.498a.61.61 0 01.596-.624h2.985z" opacity=".2"></path><path fill="#000000" d="M8.163 6.875v4.93a.6.6 0 01-.596.595H5.079a3.951 3.951 0 01-.172-1.15V7.498a.61.61 0 01.596-.624h2.66z" opacity=".2"></path><path fill="#000000" d="M8.814 5.195v1.024c-.055.003-.107.006-.163.006-.055 0-.107-.003-.163-.006A2.115 2.115 0 016.593 4.6h1.625a.598.598 0 01.596.594z" opacity=".1"></path><path fill="#000000" d="M8.488 5.52v.699a2.115 2.115 0 01-1.79-1.293h1.195a.598.598 0 01.595.594z" opacity=".2"></path><path fill="#000000" d="M8.488 5.52v.699a2.115 2.115 0 01-1.79-1.293h1.195a.598.598 0 01.595.594z" opacity=".2"></path><path fill="#000000" d="M8.163 5.52v.647a2.115 2.115 0 01-1.465-1.242h.87a.598.598 0 01.595.595z" opacity=".2"></path><path fill="url(#microsoft-teams-color-16__paint0_linear_2372_494)" d="M1.597 4.925h5.969c.33 0 .597.267.597.596v5.958a.596.596 0 01-.597.596h-5.97A.596.596 0 011 11.479V5.521c0-.33.267-.596.597-.596z"></path><path fill="#ffffff" d="M6.152 7.193H4.959v3.243h-.76V7.193H3.01v-.63h3.141v.63z"></path><defs><linearGradient id="microsoft-teams-color-16__paint0_linear_2372_494" x1="2.244" x2="6.906" y1="4.46" y2="12.548" gradientUnits="userSpaceOnUse"><stop stop-color="#5A62C3"></stop><stop offset=".5" stop-color="#4D55BD"></stop><stop offset="1" stop-color="#3940AB"></stop></linearGradient></defs></svg>`,
    
    'feedback-app': `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 1H2C1.4 1 1 1.4 1 2v8c0 .6.4 1 1 1h2v2c0 .4.5.7.8.4l2.4-2.4H14c.6 0 1-.4 1-1V2c0-.6-.4-1-1-1z" fill="#6c757d"/>
      <circle cx="5.5" cy="8.5" r="1" fill="white"/>
      <circle cx="8" cy="8.5" r="1" fill="white"/>
      <circle cx="10.5" cy="8.5" r="1" fill="white"/>
    </svg>`,
    
    'email': `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="3" width="14" height="10" rx="2" stroke="#17a2b8" stroke-width="1.5"/>
      <path d="M1 4l7 4 7-4M2 11l5-3 5 3" stroke="#17a2b8" stroke-width="1.5"/>
    </svg>`,
    
    'sponsor': `<svg fill="#28a745" height="16px" width="16px" version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 512 512" xml:space="preserve"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"><g><g><g><path d="M142.208,315.819l18.709-4.672c3.157-0.789,5.781-2.965,7.125-5.931c1.344-2.944,1.28-6.357-0.192-9.259 c-3.221-6.315-5.888-12.885-7.936-19.563c-0.619-2.069-1.877-3.904-3.563-5.248c-9.536-7.552-15.595-18.304-17.088-30.336 l-3.477-27.797c-1.557-12.395,2.091-25.045,9.984-34.709c1.749-2.155,2.603-4.885,2.368-7.637 c-0.384-4.587-0.64-8.853-0.64-12.011c0-13.675,2.24-25.963,6.699-36.501c1.451-3.477,0.981-7.488-1.28-10.517 c-2.261-3.029-6.037-4.736-9.707-4.245c-11.008,1.173-20.459,4.331-28.779,9.6c-47.616,1.557-53.227,27.072-53.227,46.293 c0,3.968,0.747,11.584,1.408,17.728c-1.856,1.109-3.563,2.496-5.035,4.16c-3.968,4.48-5.803,10.453-5.056,16.405l2.56,20.395 c0.917,7.467,5.739,13.589,12.864,16.491c2.581,12.971,8.811,25.579,17.579,35.499l-2.005,8.064l-35.84,8.96 C19.584,297.984,0,323.093,0,352.021c0,5.888,4.779,10.667,10.667,10.667h62.72c3.541,0,6.827-1.749,8.811-4.672 C96.597,336.896,117.909,321.899,142.208,315.819z"></path><path d="M364.629,336.533l-51.136-12.779l-3.499-13.973c13.483-13.973,22.848-32.555,26.133-51.733 c8.171-3.2,14.315-10.688,15.445-19.84l3.477-27.84c0.875-6.933-1.28-13.909-5.845-19.179c-2.069-2.368-4.565-4.309-7.317-5.717 l1.088-22.229l4.267-4.288c7.168-7.616,16.832-24,1.152-47.936c-11.157-17.045-29.931-25.685-55.808-25.685 c-9.877,0-32.469,0-53.888,13.973c-61.845,1.643-69.888,32.448-69.888,59.285c0,5.824,1.237,17.771,2.219,26.389 c-3.072,1.408-5.845,3.456-8.128,6.037c-4.672,5.291-6.827,12.331-5.952,19.307l3.477,27.819 c1.216,9.792,8.107,17.664,17.152,20.437c3.264,18.347,12.117,36.203,24.768,49.856l-3.819,15.253l-51.136,12.779 c-36.523,9.131-62.037,41.813-62.037,79.488c0,5.888,4.779,10.667,10.667,10.667h320c5.888,0,10.667-4.8,10.667-10.688 C426.667,378.325,401.152,345.664,364.629,336.533z"></path><path d="M464.341,290.965l-35.84-8.96l-1.771-7.083c9.344-10.155,15.936-23.211,18.56-36.779 c6.187-3.008,10.731-8.981,11.627-16.192l2.56-20.395c0.747-5.888-1.067-11.819-4.949-16.277 c-1.344-1.536-2.901-2.859-4.587-3.925l0.661-13.461l2.411-2.411c5.824-6.208,13.739-19.477,1.152-38.677 c-6.016-9.173-18.411-20.117-43.307-20.117c-10.112,0-19.029,1.365-27.264,4.203c-5.163,1.771-8.149,7.147-6.933,12.48 c3.691,16.021,0.619,31.317-8.875,44.267c-2.752,3.755-2.752,8.853-0.021,12.608c6.933,9.493,9.941,21.141,8.491,32.768 l-3.477,27.84c-1.387,11.2-6.869,21.483-15.445,28.928c-1.536,1.344-2.667,3.093-3.243,5.035 c-2.176,7.339-5.056,14.549-8.597,21.44c-1.493,2.901-1.579,6.315-0.235,9.28s3.989,5.163,7.125,5.931l17.429,4.352 c24.299,6.08,45.611,21.056,60.011,42.197c1.984,2.923,5.291,4.672,8.811,4.672h62.699c5.888,0,10.667-4.8,10.667-10.688 C512,323.072,492.416,297.984,464.341,290.965z"></path></g></g></g></g></svg>`,
    
    'policy': `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2" width="12" height="12" rx="1" stroke="#343a40" stroke-width="1.5"/>
      <path d="M5 6h6M5 9h4M5 12h6" stroke="#343a40" stroke-width="1.5"/>
    </svg>`,
    
    'other': `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="8" cy="8" r="6" stroke="#6c757d" stroke-width="1.5"/>
      <path d="M8 5v3M8 10v1" stroke="#6c757d" stroke-width="1.5"/>
    </svg>`
  };
  
  return icons[sourceKey] || icons['other'];
}

/**
 * Get the latest date between last commit and last review
 */
export function getLatestReviewDate(lastCommitDate = null, lastReviewDate = null) {
  if (!lastCommitDate && !lastReviewDate) return null;
  if (!lastCommitDate) return lastReviewDate;
  if (!lastReviewDate) return lastCommitDate;
  
  const commitDate = new Date(lastCommitDate);
  const reviewDate = new Date(lastReviewDate);
  
  return commitDate > reviewDate ? lastCommitDate : lastReviewDate;
}

/**
 * Parse GitHub repository URL
 */
export function parseGitHubUrl(url) {
  if (!url || typeof url !== 'string') {
    return null;
  }
  
  try {
    const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) {
      return null;
    }
    
    return {
      owner: match[1],
      repo: match[2].replace(/\.git$/, ''),
      fullName: `${match[1]}/${match[2].replace(/\.git$/, '')}`,
      apiUrl: `https://api.github.com/repos/${match[1]}/${match[2].replace(/\.git$/, '')}`
    };
  } catch (error) {
    console.error('Error parsing GitHub URL:', error);
    return null;
  }
}

/**
 * Get GitHub Pages URL from a repository URL
 * @param {string} repoUrl - GitHub repository URL
 * @returns {string|null} GitHub Pages URL or null
 */
export function getGitHubPagesUrl(repoUrl) {
  const parsed = parseGitHubUrl(repoUrl);
  return parsed ? `https://${parsed.owner.toLowerCase()}.github.io/${parsed.repo}/` : null;
}

/**
 * Format file size
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Debounce function
 */
export function debounce(func, wait, immediate = false) {
  let timeout;
  
  return function executedFunction(...args) {
    const later = () => {
      timeout = null;
      if (!immediate) func(...args);
    };
    
    const callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    
    if (callNow) func(...args);
  };
}

/**
 * Throttle function
 */
export function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Deep clone object
 */
export function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (obj instanceof Date) {
    return new Date(obj.getTime());
  }
  
  if (obj instanceof Array) {
    return obj.map(item => deepClone(item));
  }
  
  if (typeof obj === 'object') {
    const cloned = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = deepClone(obj[key]);
      }
    }
    return cloned;
  }
}

/**
 * Sanitize HTML to prevent XSS
 */
export function sanitizeHtml(html) {
  const div = document.createElement('div');
  div.textContent = html;
  return div.innerHTML;
}

/**
 * Capitalize first letter
 */
export function capitalize(str) {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text, maxLength = 100) {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
}

export const SOURCE_OPTIONS = [
  'Facebook',
  'Instagram',
  'Teams',
  'Feedback (app)',
  'Email',
  'Sponsor',
  'Policy',
  'Other'
];

/**
 * Get platform icon class (for future use)
 */
export function getPlatformIcon(platform) {
  const icons = {
    'iOS': '🍎',
    'Android': '🤖',
    'Web': '🌐',
    'Cross-platform': '📱',
    'React Native': '⚛️',
    'Flutter': '🦋'
  };

  return icons[platform] || '📱';
}

/**
 * Parse URL hash route for deep linking
 * Supports formats:
 *   #dashboard
 *   #detail/app-id
 *   #detail/app-id/tab
 * @param {string} hash - The URL hash (e.g., '#detail/my-app/overview')
 * @returns {{ view: string, appId: string|null, tab: string|null }}
 */
export function parseHashRoute(hash) {
  // Remove leading # if present
  const cleanHash = hash.startsWith('#') ? hash.slice(1) : hash;

  // Split by /
  const parts = cleanHash.split('/').filter(p => p.length > 0);

  if (parts.length === 0) {
    return { view: 'dashboard', appId: null, tab: null };
  }

  const view = parts[0];
  const appId = parts[1] || null;
  const tab = parts[2] || null;

  return { view, appId, tab };
}

/**
 * Build URL hash for deep linking
 * @param {string} view - The view name (e.g., 'detail', 'dashboard')
 * @param {string|null} appId - Optional app ID for detail view
 * @param {string|null} tab - Optional tab name for detail view
 * @returns {string} The hash string (e.g., '#detail/my-app/overview')
 */
export function buildHashRoute(view, appId = null, tab = null) {
  let hash = `#${view}`;

  if (appId) {
    hash += `/${appId}`;
    if (tab) {
      hash += `/${tab}`;
    }
  }

  return hash;
}