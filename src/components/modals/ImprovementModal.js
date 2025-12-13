/**
 * ImprovementModal - Modal for public users to suggest improvements
 */

import { toastManager, escapeHtml } from '../../utils/uiComponents.js';

/**
 * Show public improvement suggestion dialog
 * @param {Object} app - App object for context
 * @param {Function} onSubmit - Callback when suggestion is submitted
 */
export function showImprovementModal(app, onSubmit) {
  // Remove any existing dialog
  const existingDialog = document.querySelector('.todo-dialog');
  if (existingDialog) existingDialog.remove();

  const dialog = document.createElement('div');
  dialog.className = 'todo-dialog';
  dialog.innerHTML = `
    <div class="dialog-overlay">
      <div class="dialog-content" style="max-width: 600px;">
        <h3>Suggest an Improvement</h3>
        <p style="color: var(--gray-600); margin-bottom: 1.5rem;">
          Have a suggestion for improving ${escapeHtml(app.name || app.id)}? Share your feedback below!
        </p>
        <form id="public-improvement-form">
          <div class="form-group">
            <label for="improvement-title">What would you like to improve? *</label>
            <input type="text" id="improvement-title" class="form-control"
                   placeholder="e.g., Add dark mode, Fix login bug, etc." required />
          </div>
          <div class="form-group">
            <label for="improvement-description">Describe the improvement or issue *</label>
            <textarea id="improvement-description" class="form-control" rows="4"
                      placeholder="Provide details about the problem or enhancement..." required></textarea>
          </div>
          <div class="form-group">
            <label for="improvement-email">Your Email (optional)</label>
            <input type="email" id="improvement-email" class="form-control"
                   placeholder="your.email@example.com" />
          </div>
          <div class="dialog-actions">
            <button type="button" class="btn btn-secondary" id="cancel-improvement">Cancel</button>
            <button type="submit" class="btn btn-success">Submit Suggestion</button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.body.appendChild(dialog);

  // Handle form submission
  dialog.querySelector('#public-improvement-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const title = dialog.querySelector('#improvement-title').value;
    const description = dialog.querySelector('#improvement-description').value;
    const email = dialog.querySelector('#improvement-email').value;

    // Create a todo with public submission marker
    const todo = {
      id: `todo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: title,
      description: description,
      priority: 'medium',
      status: 'public-submission',
      source: 'Public User Feedback',
      feedbackSummary: description,
      submittedBy: email || 'public',
      completed: false,
      createdAt: new Date().toISOString()
    };

    try {
      if (onSubmit) {
        await onSubmit(todo);
      }
      toastManager.show('Thank you! Your suggestion has been submitted.', 'success');
      document.body.removeChild(dialog);
    } catch (error) {
      console.error('Failed to submit improvement:', error);
      toastManager.show('Failed to submit suggestion. Please try again.', 'error');
    }
  });

  // Handle cancel
  dialog.querySelector('#cancel-improvement').addEventListener('click', () => {
    document.body.removeChild(dialog);
  });

  // Handle escape key
  const escapeHandler = (e) => {
    if (e.key === 'Escape') {
      document.removeEventListener('keydown', escapeHandler);
      if (dialog.parentNode) {
        document.body.removeChild(dialog);
      }
    }
  };
  document.addEventListener('keydown', escapeHandler);
}

export default showImprovementModal;
