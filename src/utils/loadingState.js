/**
 * Loading state management utility
 * Provides loading indicators for individual components
 */

/**
 * Create a loading spinner element
 * @param {string} [size='medium'] - Size of spinner (small, medium, large)
 * @returns {HTMLElement}
 */
export function createLoadingSpinner(size = 'medium') {
  const spinner = document.createElement('div');
  spinner.className = `loading-spinner loading-spinner-${size}`;

  const sizeMap = {
    small: '16px',
    medium: '32px',
    large: '48px'
  };

  spinner.style.cssText = `
    display: inline-block;
    width: ${sizeMap[size] || sizeMap.medium};
    height: ${sizeMap[size] || sizeMap.medium};
    border: 3px solid rgba(160, 0, 0, 0.2);
    border-top-color: #a00000;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  `;

  return spinner;
}

/**
 * Create a skeleton loader element
 * @param {Object} options - Skeleton options
 * @param {string} [options.width] - Width of skeleton
 * @param {string} [options.height] - Height of skeleton
 * @param {string} [options.borderRadius] - Border radius
 * @returns {HTMLElement}
 */
export function createSkeleton(options = {}) {
  const {
    width = '100%',
    height = '20px',
    borderRadius = '4px'
  } = options;

  const skeleton = document.createElement('div');
  skeleton.className = 'skeleton-loader';
  skeleton.style.cssText = `
    width: ${width};
    height: ${height};
    border-radius: ${borderRadius};
    background: linear-gradient(90deg, #1c1c1c 25%, #2a2a2a 50%, #1c1c1c 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s ease-in-out infinite;
  `;

  return skeleton;
}

/**
 * Create a loading overlay for a container
 * @param {string} [message] - Optional loading message
 * @returns {HTMLElement}
 */
export function createLoadingOverlay(message = 'Loading...') {
  const overlay = document.createElement('div');
  overlay.className = 'component-loading-overlay';
  overlay.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 10;
    border-radius: inherit;
  `;

  const spinner = createLoadingSpinner('medium');
  overlay.appendChild(spinner);

  if (message) {
    const messageEl = document.createElement('p');
    messageEl.textContent = message;
    messageEl.style.cssText = `
      margin-top: 1rem;
      color: #e0e0e0;
      font-size: 0.9rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    `;
    overlay.appendChild(messageEl);
  }

  return overlay;
}

/**
 * Add loading state to an element
 * @param {HTMLElement} element - Element to add loading state to
 * @param {string} [message] - Optional loading message
 * @returns {Function} - Function to remove loading state
 */
export function addLoadingState(element, message) {
  if (!element) return () => {};

  // Make element position relative if not already positioned
  const originalPosition = element.style.position;
  if (!originalPosition || originalPosition === 'static') {
    element.style.position = 'relative';
  }

  const overlay = createLoadingOverlay(message);
  element.appendChild(overlay);

  // Return cleanup function
  return () => {
    if (overlay.parentElement) {
      overlay.parentElement.removeChild(overlay);
    }
    if (originalPosition) {
      element.style.position = originalPosition;
    }
  };
}

/**
 * Loading state manager for tracking multiple loading states
 */
export class LoadingStateManager {
  constructor() {
    this.states = new Map();
  }

  /**
   * Start loading for a key
   */
  start(key, element, message) {
    if (this.states.has(key)) {
      this.stop(key); // Remove existing
    }

    const cleanup = addLoadingState(element, message);
    this.states.set(key, cleanup);
  }

  /**
   * Stop loading for a key
   */
  stop(key) {
    if (this.states.has(key)) {
      const cleanup = this.states.get(key);
      cleanup();
      this.states.delete(key);
    }
  }

  /**
   * Check if loading for a key
   */
  isLoading(key) {
    return this.states.has(key);
  }

  /**
   * Stop all loading states
   */
  stopAll() {
    this.states.forEach(cleanup => cleanup());
    this.states.clear();
  }
}

// Add CSS animations to page
function addAnimationStyles() {
  if (document.getElementById('loading-state-styles')) return;

  const style = document.createElement('style');
  style.id = 'loading-state-styles';
  style.textContent = `
    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    .skeleton-loader {
      animation: shimmer 1.5s ease-in-out infinite;
    }
  `;
  document.head.appendChild(style);
}

// Initialize styles on module load
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addAnimationStyles);
  } else {
    addAnimationStyles();
  }
}

export default {
  createLoadingSpinner,
  createSkeleton,
  createLoadingOverlay,
  addLoadingState,
  LoadingStateManager
};
