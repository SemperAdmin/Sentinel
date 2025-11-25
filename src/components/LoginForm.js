/**
 * LoginForm Component
 * Handles admin authentication UI
 */

import { authService } from '../auth/AuthService.js';
import { showToast } from '../utils/uiComponents.js';

export class LoginForm {
  constructor() {
    this.onLoginSuccess = null;
  }

  /**
   * Render login form
   * @returns {string} HTML string
   */
  render() {
    return `
      <div class="login-container">
        <div class="login-card">
          <div class="login-header">
            <h1>SENTINEL</h1>
            <p class="login-subtitle">APP PORTFOLIO MANAGER</p>
          </div>

          <div class="login-mode-toggle">
            <button id="btn-public-mode" class="mode-btn active" data-mode="public">
              PUBLIC MODE
            </button>
            <button id="btn-admin-mode" class="mode-btn" data-mode="admin">
              ADMIN MODE
            </button>
          </div>

          <div id="public-mode-content" class="mode-content active">
            <div class="public-info">
              <h2>PUBLIC ACCESS</h2>
              <p>Browse apps and submit suggestions</p>
              <ul class="feature-list">
                <li>View all active applications</li>
                <li>Submit improvement suggestions</li>
                <li>Propose new app ideas</li>
                <li>View app metrics and health status</li>
              </ul>
              <button id="btn-continue-public" class="btn-primary">
                CONTINUE AS PUBLIC USER
              </button>
            </div>
          </div>

          <div id="admin-mode-content" class="mode-content">
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
                />
              </div>
              <button type="submit" class="btn-primary">
                LOGIN AS ADMIN
              </button>
            </form>
            <div class="admin-info">
              <p class="info-text">Admin access required for:</p>
              <ul class="feature-list">
                <li>Managing apps and tasks</li>
                <li>Reviewing feedback submissions</li>
                <li>Editing developer notes</li>
                <li>Archiving applications</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Attach event listeners
   */
  attachEvents() {
    // Mode toggle buttons
    const publicModeBtn = document.getElementById('btn-public-mode');
    const adminModeBtn = document.getElementById('btn-admin-mode');
    const publicContent = document.getElementById('public-mode-content');
    const adminContent = document.getElementById('admin-mode-content');

    publicModeBtn?.addEventListener('click', () => {
      publicModeBtn.classList.add('active');
      adminModeBtn.classList.remove('active');
      publicContent.classList.add('active');
      adminContent.classList.remove('active');
    });

    adminModeBtn?.addEventListener('click', () => {
      adminModeBtn.classList.add('active');
      publicModeBtn.classList.remove('active');
      adminContent.classList.add('active');
      publicContent.classList.remove('active');
    });

    // Public mode continue button
    const continuePublicBtn = document.getElementById('btn-continue-public');
    continuePublicBtn?.addEventListener('click', () => {
      if (this.onLoginSuccess) {
        this.onLoginSuccess('public');
      }
    });

    // Admin login form
    const loginForm = document.getElementById('admin-login-form');
    loginForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleAdminLogin(e);
    });

    // Focus password field when admin mode is selected
    adminModeBtn?.addEventListener('click', () => {
      setTimeout(() => {
        document.getElementById('admin-password')?.focus();
      }, 100);
    });
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
      showToast('Please enter a password', 'error');
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
        showToast('Login successful', 'success');
        if (this.onLoginSuccess) {
          this.onLoginSuccess(result.role);
        }
      } else {
        showToast(result.error || 'Authentication failed', 'error');
        passwordInput.value = '';
        passwordInput.focus();
      }
    } catch (error) {
      console.error('Login error:', error);
      showToast('An error occurred during login', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  }

  /**
   * Mount component to container
   * @param {HTMLElement} container - Container element
   * @param {Function} onSuccess - Callback on successful login
   */
  mount(container, onSuccess) {
    this.onLoginSuccess = onSuccess;
    container.innerHTML = this.render();
    this.attachEvents();

    // Auto-focus password field if admin mode is default
    // or focus public button if public mode is default
    const publicModeBtn = document.getElementById('btn-public-mode');
    if (publicModeBtn?.classList.contains('active')) {
      document.getElementById('btn-continue-public')?.focus();
    }
  }

  /**
   * Unmount component
   */
  unmount() {
    this.onLoginSuccess = null;
  }
}

export default LoginForm;
