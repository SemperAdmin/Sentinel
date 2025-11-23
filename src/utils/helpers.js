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
    
    'teams': `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6.5 1h3c.28 0 .5.22.5.5v3c0 .28-.22.5-.5.5h-3A.5.5 0 016.5 4.5v-3C6.5 1.22 6.72 1 7 1z" fill="#6264A7"/>
      <path d="M12 6.5v3c0 .28-.22.5-.5.5h-3a.5.5 0 01-.5-.5v-3c0-.28.22-.5.5-.5h3c.28 0 .5.22.5.5z" fill="#6264A7"/>
      <path d="M6.5 9.5h3c.28 0 .5.22.5.5v3c0 .28-.22.5-.5.5h-3a.5.5 0 01-.5-.5v-3c0-.28.22-.5.5-.5z" fill="#6264A7"/>
      <path d="M3 9.5v3c0 .28.22.5.5.5h3c.28 0 .5-.22.5-.5v-3c0-.28-.22-.5-.5-.5h-3c-.28 0-.5.22-.5.5z" fill="#6264A7"/>
    </svg>`,
    
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
    
    'sponsor': `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="8" cy="5" r="3" fill="#28a745" stroke="#28a745" stroke-width="1"/>
      <path d="M14 14v-1c0-1.5-1-3-3-3H5c-2 0-3 1.5-3 3v1" stroke="#28a745" stroke-width="1.5" fill="none"/>
      <path d="M11 3l1-1M5 3l-1-1" stroke="#28a745" stroke-width="1" stroke-linecap="round"/>
      <circle cx="7" cy="5" r="1" fill="white"/>
      <circle cx="9" cy="5" r="1" fill="white"/>
    </svg>`,
    
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