/**
 * UI Components - Reusable UI utilities for toast notifications and overlays
 * Provides consistent UI patterns across the application
 */

import { DEFAULT_TOAST_DURATION_MS } from './constants.js';

/**
 * Toast notification manager
 */
export class ToastManager {
  constructor() {
    this._toastElement = undefined;
    this._messageElement = undefined;
    this.autoHideTimeout = null;
  }

  /**
   * Lazy-load toast element
   * @returns {HTMLElement|null}
   */
  get toastElement() {
    if (this._toastElement === undefined) {
      this._toastElement = document.getElementById('error-toast');
      if (!this._toastElement) {
        console.warn('Toast element not found in DOM');
      }
    }
    return this._toastElement;
  }

  /**
   * Lazy-load message element
   * @returns {HTMLElement|null}
   */
  get messageElement() {
    if (this._messageElement === undefined) {
      this._messageElement = document.getElementById('error-message');
      if (!this._messageElement) {
        console.warn('Toast message element not found in DOM');
      }
    }
    return this._messageElement;
  }

  /**
   * Show toast with type
   * @param {string} message - Message to display
   * @param {'error'|'success'|'info'} type - Toast type
   * @param {number} [duration] - Duration in ms (optional)
   * @returns {void}
   * @private
   */
  show(message, type = 'error', duration = DEFAULT_TOAST_DURATION_MS) {
    if (!this.toastElement || !this.messageElement) return;

    this.messageElement.textContent = message;

    // Remove existing type classes
    this.toastElement.classList.remove('toast-error', 'toast-success', 'toast-info', 'hidden');

    // Add type-specific class
    this.toastElement.classList.add(`toast-${type}`);

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
   * Show error toast
   * @param {string} message - Error message to display
   * @param {number} [duration] - Duration in ms (optional)
   * @returns {void}
   */
  showError(message, duration = DEFAULT_TOAST_DURATION_MS) {
    this.show(message, 'error', duration);
  }

  /**
   * Show success toast
   * @param {string} message - Success message to display
   * @param {number} [duration] - Duration in ms (optional)
   * @returns {void}
   */
  showSuccess(message, duration = DEFAULT_TOAST_DURATION_MS) {
    this.show(message, 'success', duration);
  }

  /**
   * Show info toast
   * @param {string} message - Info message to display
   * @param {number} [duration] - Duration in ms (optional)
   * @returns {void}
   */
  showInfo(message, duration = DEFAULT_TOAST_DURATION_MS) {
    this.show(message, 'info', duration);
  }

  /**
   * Hide toast
   * @returns {void}
   */
  hide() {
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
    this._overlayElement = undefined;
    this._messageElement = undefined;
  }

  /**
   * Lazy-load overlay element
   * @returns {HTMLElement|null}
   */
  get overlayElement() {
    if (this._overlayElement === undefined) {
      this._overlayElement = document.getElementById('loading-overlay');
      if (!this._overlayElement) {
        console.warn('Loading overlay element not found in DOM');
      }
    }
    return this._overlayElement;
  }

  /**
   * Lazy-load message element
   * @returns {HTMLElement|null}
   */
  get messageElement() {
    if (this._messageElement === undefined) {
      const overlay = this.overlayElement;
      this._messageElement = overlay ? overlay.querySelector('p') : null;
    }
    return this._messageElement;
  }

  /**
   * Show loading overlay
   * @param {string} [message='Loading...'] - Loading message
   * @returns {void}
   */
  show(message = 'Loading...') {
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
    if (this.overlayElement) {
      this.overlayElement.classList.add('hidden');
    }
  }

  /**
   * Check if loading overlay is visible
   * @returns {boolean}
   */
  isVisible() {
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
