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
      <div class="login-container">
        <div class="login-welcome">
          <div class="login-welcome-header">
            <h1>SENTINEL</h1>
            <p class="login-welcome-subtitle">APP PORTFOLIO MANAGER</p>
            <h2 class="login-welcome-mode-title">Choose Access Mode</h2>
            <p class="login-welcome-mode-subtitle">Select how you want to use Sentinel</p>
          </div>

          <div class="mode-selection">
            <div class="mode-cards">
              <!-- Public Mode Card -->
              <div class="mode-card">
                <div class="mode-card-content">
                  <div class="mode-card-back">
                    <div class="mode-card-back-content">
                      <div class="mode-card-icon">👥</div>
                      <strong>PUBLIC MODE</strong>
                      <p>Click to continue as guest</p>
                    </div>
                  </div>
                  <div class="mode-card-front mode-card-front-public">
                    <div class="mode-card-decorations">
                      <div class="mode-circle"></div>
                      <div class="mode-circle" id="circle-right"></div>
                      <div class="mode-circle" id="circle-bottom"></div>
                    </div>
                    <div class="mode-card-front-content">
                      <span class="mode-badge">Guest Access</span>
                      <div class="mode-description">
                        <div class="mode-title">
                          <p><strong>PUBLIC MODE</strong></p>
                        </div>
                        <ul class="mode-features">
                          <li>Browse app portfolio</li>
                          <li>View app details & metrics</li>
                          <li>Submit improvement suggestions</li>
                          <li>Propose new app ideas</li>
                        </ul>
                        <button id="btn-select-public" class="mode-select-btn">
                          Continue as Guest →
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Admin Mode Card -->
              <div class="mode-card">
                <div class="mode-card-content">
                  <div class="mode-card-back">
                    <div class="mode-card-back-content">
                      <div class="mode-card-icon">🔐</div>
                      <strong>ADMIN MODE</strong>
                      <p>Login required for full access</p>
                    </div>
                  </div>
                  <div class="mode-card-front mode-card-front-admin">
                    <div class="mode-card-decorations">
                      <div class="mode-circle mode-circle-admin"></div>
                      <div class="mode-circle mode-circle-admin" id="circle-right"></div>
                      <div class="mode-circle mode-circle-admin" id="circle-bottom"></div>
                    </div>
                    <div class="mode-card-front-content">
                      <span class="mode-badge mode-badge-admin">Admin Access</span>
                      <div class="mode-description">
                        <div class="mode-title">
                          <p><strong>ADMIN MODE</strong></p>
                        </div>
                        <ul class="mode-features">
                          <li>Manage apps and tasks</li>
                          <li>Review feedback submissions</li>
                          <li>Edit developer notes</li>
                          <li>Archive applications</li>
                        </ul>
                        <button id="btn-select-admin" class="mode-select-btn mode-select-btn-admin">
                          Login Required →
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
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
