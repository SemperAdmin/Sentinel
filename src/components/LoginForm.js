/**
 * LoginForm Component
 * Handles admin authentication UI with prominent mode selection
 */

import { authService } from '../auth/AuthService.js';
import { toastManager } from '../utils/uiComponents.js';

export class LoginForm {
  constructor() {
    this.onLoginSuccess = null;
    this.currentStep = 'mode-selection'; // 'mode-selection' or 'admin-password'
  }

  /**
   * Render login form
   * @returns {string} HTML string
   */
  render() {
    if (this.currentStep === 'mode-selection') {
      return this.renderModeSelection();
    } else if (this.currentStep === 'admin-password') {
      return this.renderAdminPasswordScreen();
    }
  }

  /**
   * Render mode selection screen (Step 1)
   * @returns {string} HTML string
   */
  renderModeSelection() {
    return `
      <div class="login-page">
        <div class="login-header-centered">
          <h1>SENTINEL</h1>
          <p class="subtitle">APP PORTFOLIO MANAGER</p>
          <h2>Choose Access Mode</h2>
        </div>

        <div class="login-cards-container">
          <!-- Public Mode Card -->
          <div class="login-mode-card">
            <div class="card-icon">👥</div>
            <h3>PUBLIC MODE</h3>
            <p class="card-description">Browse the portfolio and view app details without logging in</p>
            <ul class="card-features">
              <li>✓ Browse app portfolio</li>
              <li>✓ View app details & metrics</li>
              <li>✓ Submit improvement suggestions</li>
              <li>✓ Propose new app ideas</li>
            </ul>
            <button id="btn-select-public" class="mode-btn mode-btn-public">
              Continue as Guest
            </button>
          </div>

          <!-- Admin Mode Card -->
          <div class="login-mode-card">
            <div class="card-icon">🔐</div>
            <h3>ADMIN MODE</h3>
            <p class="card-description">Full management access with authentication required</p>
            <ul class="card-features">
              <li>✓ Manage apps and tasks</li>
              <li>✓ Review feedback submissions</li>
              <li>✓ Edit developer notes</li>
              <li>✓ Archive applications</li>
            </ul>
            <button id="btn-select-admin" class="mode-btn mode-btn-admin">
              Login Required
            </button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render admin password screen (Step 2)
   * @returns {string} HTML string
   */
  renderAdminPasswordScreen() {
    return `
      <div class="login-container">
        <div class="login-card">
          <div class="login-header">
            <h1>SENTINEL</h1>
            <p class="login-subtitle">ADMIN LOGIN</p>
          </div>

          <div class="mode-content active">
            <form id="admin-login-form" class="admin-form">
              <div class="form-group">
                <label for="admin-password">ADMIN PASSWORD</label>
                <input
                  type="password"
                  id="admin-password"
                  class="form-control"
                  placeholder="Enter admin password"
                  required
                  autocomplete="current-password"
                  autofocus
                />
              </div>

              <div class="form-actions">
                <button type="button" id="btn-back-to-mode" class="btn btn-secondary">
                  ← Back
                </button>
                <button type="submit" class="btn btn-primary">
                  LOGIN
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Attach event listeners
   */
  attachEvents() {
    if (this.currentStep === 'mode-selection') {
      this.attachModeSelectionEvents();
    } else if (this.currentStep === 'admin-password') {
      this.attachPasswordScreenEvents();
    }
  }

  /**
   * Attach events for mode selection screen
   */
  attachModeSelectionEvents() {
    // Public mode button
    const publicBtn = document.getElementById('btn-select-public');
    publicBtn?.addEventListener('click', async () => {
      // Save public session
      await authService.loginAsPublic();

      if (this.onLoginSuccess) {
        this.onLoginSuccess('public');
      }
    });

    // Admin mode button
    const adminBtn = document.getElementById('btn-select-admin');
    adminBtn?.addEventListener('click', () => {
      this.currentStep = 'admin-password';
      this.remount();
    });
  }

  /**
   * Attach events for password screen
   */
  attachPasswordScreenEvents() {
    // Back button
    const backBtn = document.getElementById('btn-back-to-mode');
    backBtn?.addEventListener('click', () => {
      this.currentStep = 'mode-selection';
      this.remount();
    });

    // Login form
    const loginForm = document.getElementById('admin-login-form');
    loginForm?.addEventListener('submit', async (e) => {
      await this.handleAdminLogin(e);
    });

    // Focus password field
    document.getElementById('admin-password')?.focus();
  }

  /**
   * Handle admin login form submission
   * @param {Event} event - Form submit event
   */
  async handleAdminLogin(event) {
    event.preventDefault();

    const passwordInput = document.getElementById('admin-password');
    const password = passwordInput.value.trim();

    if (!password) {
      toastManager.show('Please enter a password', 'error');
      return;
    }

    // Disable form during login
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'AUTHENTICATING...';

    try {
      const result = await authService.login(password);

      if (result.success) {
        toastManager.show('Login successful', 'success');
        if (this.onLoginSuccess) {
          this.onLoginSuccess(result.role);
        }
      } else {
        toastManager.show(result.error || 'Authentication failed', 'error');
        passwordInput.value = '';
        passwordInput.focus();
      }
    } catch (error) {
      console.error('Login error:', error);
      toastManager.show('An error occurred during login', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  }

  /**
   * Remount the component (used when switching steps)
   */
  remount() {
    if (this.container) {
      this.container.innerHTML = this.render();
      this.attachEvents();
    }
  }

  /**
   * Mount component to container
   * @param {HTMLElement} container - Container element
   * @param {Function} onSuccess - Callback on successful login
   */
  mount(container, onSuccess) {
    this.container = container;
    this.onLoginSuccess = onSuccess;
    this.currentStep = 'mode-selection';
    container.innerHTML = this.render();
    this.attachEvents();
  }

  /**
   * Unmount component
   */
  unmount() {
    this.onLoginSuccess = null;
    this.container = null;
  }
}

export default LoginForm;
