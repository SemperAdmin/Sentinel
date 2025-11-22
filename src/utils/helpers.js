/**
 * Helper utilities for Sentinel
 * Date formatting, health calculations, and other utility functions
 */

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
    if (daysSinceCommit > 90) healthScore += 3;
    else if (daysSinceCommit > 60) healthScore += 2;
    else if (daysSinceCommit > 30) healthScore += 1;
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
  
  // Check pending todos
  if (app.pendingTodos > 5) healthScore += 2;
  else if (app.pendingTodos > 2) healthScore += 1;
  
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
    good: '#28a745',      // Green
    warning: '#ffc107',   // Orange
    critical: '#dc3545'   // Red
  };
  return colors[health] || colors.warning;
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
 * Calculate next quarterly review date
 */
export function calculateNextReviewDate(lastReviewDate = null) {
  const date = lastReviewDate ? new Date(lastReviewDate) : new Date();
  date.setMonth(date.getMonth() + 3);
  return date.toISOString().split('T')[0];
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
 * Validate GitHub repository URL
 */
export function isValidGitHubUrl(url) {
  if (!url || typeof url !== 'string') {
    return false;
  }
  
  const githubPattern = /^https?:\/\/github\.com\/[a-zA-Z0-9-_.]+\/[a-zA-Z0-9-_.]+\/?$/;
  return githubPattern.test(url);
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