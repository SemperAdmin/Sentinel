/**
 * Application constants
 * Centralized location for all magic numbers and configuration values
 */

// Review cycle configuration
export const REVIEW_CYCLE_DAYS = 90; // Quarterly review interval
export const REVIEW_OVERDUE_WARNING_DAYS = 7; // Days before review to show warning

// GitHub API configuration
export const GITHUB_API_DELAY_MS = 1000; // Delay between sequential API calls
export const GITHUB_API_RETRY_ATTEMPTS = 3; // Number of retry attempts
export const GITHUB_API_RETRY_BASE_DELAY = 1000; // Base delay for exponential backoff (1s)
export const GITHUB_API_MAX_RETRY_DELAY = 30000; // Max retry delay (30s)
export const GITHUB_API_REQUEST_TIMEOUT = 15000; // Request timeout (15s)

// Cache configuration
export const CACHE_TTL_SECONDS = 60; // Default cache TTL
export const CACHE_BUST_PARAM = '__cache_bust'; // Cache busting parameter name

// Health status thresholds (days since last commit)
export const HEALTH_THRESHOLDS = {
  HEALTHY: 30,    // Green: Recently active (< 30 days)
  WARNING: 60,    // Yellow: Needs attention (30-60 days)
  STALE: 90,      // Red: Stale/inactive (> 90 days)
  CRITICAL: Infinity  // Red: Critical/overdue (> 60 days)
};

// Health status colors
export const HEALTH_COLORS = {
  HEALTHY: '#28a745',   // Green
  WARNING: '#ffc107',   // Yellow
  CRITICAL: '#dc3545',  // Red
  UNKNOWN: '#6c757d'    // Gray
};

// Task/Todo configuration
export const TODO_PRIORITY_LEVELS = ['P0', 'P1', 'P2'];
export const TODO_STATUS_VALUES = ['Pending', 'Submitted', 'Rejected', 'Complete'];
export const TODO_EFFORT_ESTIMATES = ['Small', 'Medium', 'Large'];

// Improvement budget (percentage of time allocated to improvements)
export const IMPROVEMENT_BUDGET_PERCENT = 20;

// UI configuration
export const DEFAULT_TOAST_DURATION_MS = 5000; // Auto-hide toasts after 5s
export const LOADING_DEBOUNCE_MS = 100; // Debounce loading states
export const AUTO_SAVE_DEBOUNCE_MS = 500; // Debounce auto-save operations

// Pagination and limits
export const DEFAULT_REPOS_PER_PAGE = 100;
export const MAX_CONCURRENT_API_REQUESTS = 3;

// Local storage keys
export const STORAGE_KEYS = {
  PORTFOLIO: 'apm-portfolio',
  IDEAS: 'apm-ideas',
  USER_PREFERENCES: 'apm-user-prefs'
};

// IndexedDB configuration
export const INDEXEDDB_NAME = 'APM-Portfolio-Manager';
export const INDEXEDDB_VERSION = 1;
export const INDEXEDDB_STORES = {
  PORTFOLIO: 'portfolio',
  IDEAS: 'ideas'
};

// Risk ratings for ideas
export const RISK_RATINGS = ['Low', 'Medium', 'High'];

// Tech stacks for ideas
export const TECH_STACKS = [
  'React Native',
  'Flutter',
  'Web',
  'iOS Native',
  'Android Native'
];

// Default values
export const DEFAULT_GITHUB_USER = 'SemperAdmin';
export const DEFAULT_MANAGER_REPO = 'SemperAdmin/Sentinel';
export const EXCLUDED_REPO_NAMES = ['eventcall-images'];

// Rate limiting
export const RATE_LIMIT_MUTATIONS_PER_MINUTE = 10;
export const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute

// Server configuration
export const DEFAULT_API_PORT = 4000;
export const DEFAULT_CACHE_TTL_SECONDS = 60;

export default {
  REVIEW_CYCLE_DAYS,
  REVIEW_OVERDUE_WARNING_DAYS,
  GITHUB_API_DELAY_MS,
  GITHUB_API_RETRY_ATTEMPTS,
  GITHUB_API_RETRY_BASE_DELAY,
  GITHUB_API_MAX_RETRY_DELAY,
  GITHUB_API_REQUEST_TIMEOUT,
  CACHE_TTL_SECONDS,
  HEALTH_THRESHOLDS,
  HEALTH_COLORS,
  TODO_PRIORITY_LEVELS,
  TODO_STATUS_VALUES,
  TODO_EFFORT_ESTIMATES,
  IMPROVEMENT_BUDGET_PERCENT,
  DEFAULT_TOAST_DURATION_MS,
  LOADING_DEBOUNCE_MS,
  AUTO_SAVE_DEBOUNCE_MS,
  DEFAULT_REPOS_PER_PAGE,
  MAX_CONCURRENT_API_REQUESTS,
  STORAGE_KEYS,
  INDEXEDDB_NAME,
  INDEXEDDB_VERSION,
  INDEXEDDB_STORES,
  RISK_RATINGS,
  TECH_STACKS,
  DEFAULT_GITHUB_USER,
  DEFAULT_MANAGER_REPO,
  EXCLUDED_REPO_NAMES,
  RATE_LIMIT_MUTATIONS_PER_MINUTE,
  RATE_LIMIT_WINDOW_MS,
  DEFAULT_API_PORT,
  DEFAULT_CACHE_TTL_SECONDS
};
