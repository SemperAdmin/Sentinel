/**
 * UI Components - Reusable UI utilities for toast notifications and overlays
 * Provides consistent UI patterns across the application
 */

import { ERROR_TOAST_DURATION_MS } from './constants.js';

/**
 * Toast notification manager
 */
export class ToastManager {
  constructor() {
    this.toastElement = null;
    this.messageElement = null;
    this.autoHideTimeout = null;
  }

  /**
   * Initialize toast elements
   * @private
   */
  init() {
    if (this.toastElement) return;

    this.toastElement = document.getElementById('error-toast');
    this.messageElement = document.getElementById('error-message');

    if (!this.toastElement || !this.messageElement) {
      console.warn('Toast elements not found in DOM');
    }
  }

  /**
   * Show error toast
   * @param {string} message - Error message to display
   * @param {number} [duration] - Duration in ms (optional)
   * @returns {void}
   */
  showError(message, duration = ERROR_TOAST_DURATION_MS) {
    this.init();

    if (!this.toastElement || !this.messageElement) return;

    this.messageElement.textContent = message;
    this.toastElement.classList.remove('hidden');

    // Clear existing timeout
    if (this.autoHideTimeout) {
      clearTimeout(this.autoHideTimeout);
    }

    // Auto-hide after duration
    this.autoHideTimeout = setTimeout(() => {
      this.hide();
    }, duration);
  }

  /**
   * Show success toast
   * @param {string} message - Success message to display
   * @param {number} [duration] - Duration in ms (optional)
   * @returns {void}
   */
  showSuccess(message, duration = ERROR_TOAST_DURATION_MS) {
    // For now, use the same error toast but could be extended
    this.showError(message, duration);
  }

  /**
   * Show info toast
   * @param {string} message - Info message to display
   * @param {number} [duration] - Duration in ms (optional)
   * @returns {void}
   */
  showInfo(message, duration = ERROR_TOAST_DURATION_MS) {
    // For now, use the same error toast but could be extended
    this.showError(message, duration);
  }

  /**
   * Hide toast
   * @returns {void}
   */
  hide() {
    this.init();

    if (this.autoHideTimeout) {
      clearTimeout(this.autoHideTimeout);
      this.autoHideTimeout = null;
    }

    if (this.toastElement) {
      this.toastElement.classList.add('hidden');
    }
  }
}

/**
 * Loading overlay manager
 */
export class LoadingOverlayManager {
  constructor() {
    this.overlayElement = null;
    this.messageElement = null;
  }

  /**
   * Initialize overlay elements
   * @private
   */
  init() {
    if (this.overlayElement) return;

    this.overlayElement = document.getElementById('loading-overlay');
    this.messageElement = this.overlayElement?.querySelector('p');

    if (!this.overlayElement) {
      console.warn('Loading overlay element not found in DOM');
    }
  }

  /**
   * Show loading overlay
   * @param {string} [message='Loading...'] - Loading message
   * @returns {void}
   */
  show(message = 'Loading...') {
    this.init();

    if (!this.overlayElement) return;

    if (this.messageElement) {
      this.messageElement.textContent = message;
    }

    this.overlayElement.classList.remove('hidden');
  }

  /**
   * Hide loading overlay
   * @returns {void}
   */
  hide() {
    this.init();

    if (this.overlayElement) {
      this.overlayElement.classList.add('hidden');
    }
  }

  /**
   * Check if loading overlay is visible
   * @returns {boolean}
   */
  isVisible() {
    this.init();
    return this.overlayElement && !this.overlayElement.classList.contains('hidden');
  }
}

/**
 * Create singleton instances
 */
export const toastManager = new ToastManager();
export const loadingOverlay = new LoadingOverlayManager();

/**
 * Utility functions
 */

/**
 * Escape HTML to prevent XSS attacks
 * @param {string} text - Text to escape
 * @returns {string} Escaped HTML
 */
export function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Create a confirmation dialog
 * @param {string} message - Confirmation message
 * @param {string} [title='Confirm'] - Dialog title
 * @returns {boolean} True if confirmed
 */
export function confirm(message, title = 'Confirm') {
  return window.confirm(message);
}

/**
 * Create a prompt dialog
 * @param {string} message - Prompt message
 * @param {string} [defaultValue=''] - Default input value
 * @returns {string|null} User input or null if cancelled
 */
export function prompt(message, defaultValue = '') {
  return window.prompt(message, defaultValue);
}

export default {
  ToastManager,
  LoadingOverlayManager,
  toastManager,
  loadingOverlay,
  escapeHtml,
  confirm,
  prompt
};
