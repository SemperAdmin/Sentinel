/**
 * AdminLoginModal - Modal component for admin authentication
 */

import { authService } from '../../auth/AuthService.js';
import appState from '../../state/AppState.js';
import { toastManager } from '../../utils/uiComponents.js';

/**
 * Show admin login modal
 * @param {Function} onSuccess - Callback when login succeeds
 */
export function showAdminLoginModal(onSuccess = null) {
  const modalHTML = `
    <div class="admin-modal-overlay" id="admin-modal">
      <div class="admin-modal">
        <div class="admin-modal-header">
          <h3>Admin Login</h3>
          <button class="admin-modal-close" id="close-admin-modal">&times;</button>
        </div>
        <div class="admin-modal-body">
          <form id="admin-login-form">
            <div class="form-group">
              <label for="admin-password-input">Admin Password</label>
              <input
                type="password"
                id="admin-password-input"
                class="form-control"
                placeholder="Enter admin password"
                required
                autofocus
              />
            </div>
            <div class="admin-modal-actions">
              <button type="button" class="btn btn-secondary" id="cancel-admin-login">Cancel</button>
              <button type="submit" class="btn btn-primary">Login</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHTML);

  const modal = document.getElementById('admin-modal');
  const form = document.getElementById('admin-login-form');
  const closeBtn = document.getElementById('close-admin-modal');
  const cancelBtn = document.getElementById('cancel-admin-login');
  const passwordInput = document.getElementById('admin-password-input');

  const escapeHandler = (e) => {
    if (e.key === 'Escape') {
      closeModal();
    }
  };

  const closeModal = () => {
    document.removeEventListener('keydown', escapeHandler);
    modal.remove();
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const password = passwordInput.value;
    const result = await authService.login(password);

    if (result.success) {
      appState.setAuthentication('admin');
      toastManager.show('Successfully logged in as admin', 'success');
      closeModal();
      if (onSuccess) onSuccess();
    } else {
      toastManager.show(result.error || 'Invalid password', 'error');
      passwordInput.value = '';
      passwordInput.focus();
    }
  });

  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });

  document.addEventListener('keydown', escapeHandler);

  setTimeout(() => passwordInput.focus(), 100);
}

export default showAdminLoginModal;
