/**
 * PublicIdeaModal - Modal for public users to submit app ideas
 */

import { toastManager } from '../../utils/uiComponents.js';

/**
 * Show public idea submission modal
 * @param {Function} onSubmit - Callback when idea is submitted, receives idea object
 */
export function showPublicIdeaModal(onSubmit) {
  const modalHTML = `
    <div class="admin-modal-overlay" id="public-idea-modal">
      <div class="admin-modal" style="max-width: 600px;">
        <div class="admin-modal-header">
          <h3>Submit App Idea</h3>
          <button class="admin-modal-close" id="close-public-idea">&times;</button>
        </div>
        <div class="admin-modal-body">
          <p style="color: var(--gray-600); margin-bottom: 1.5rem;">
            Have an idea for a new app? Submit your suggestion below and our team will review it!
          </p>
          <form id="public-idea-form">
            <div class="form-group">
              <label for="public-concept-name">App Name *</label>
              <input
                type="text"
                id="public-concept-name"
                class="form-control"
                placeholder="Enter app name"
                required
              />
            </div>

            <div class="form-group">
              <label for="public-problem-solved">What problem does this solve? *</label>
              <textarea
                id="public-problem-solved"
                class="form-control"
                placeholder="Describe the value this app would provide..."
                rows="4"
                required
              ></textarea>
            </div>

            <div class="form-group">
              <label for="public-target-audience">Who would use this? *</label>
              <input
                type="text"
                id="public-target-audience"
                class="form-control"
                placeholder="e.g., Marines, Veterans, General Public"
                required
              />
            </div>

            <div class="form-group">
              <label for="public-submitter-name">Your Name *</label>
              <input
                type="text"
                id="public-submitter-name"
                class="form-control"
                placeholder="John Doe"
                required
              />
            </div>

            <div class="form-group">
              <label for="public-contact-email">Your Email *</label>
              <input
                type="email"
                id="public-contact-email"
                class="form-control"
                placeholder="contact@example.com"
                required
              />
            </div>

            <div class="admin-modal-actions">
              <button type="button" class="btn btn-secondary" id="cancel-public-idea">Cancel</button>
              <button type="submit" class="btn btn-primary">Submit Idea</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHTML);

  const modal = document.getElementById('public-idea-modal');
  const form = document.getElementById('public-idea-form');
  const closeBtn = document.getElementById('close-public-idea');
  const cancelBtn = document.getElementById('cancel-public-idea');

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

    const idea = {
      id: `idea-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      conceptName: document.getElementById('public-concept-name').value,
      problemSolved: document.getElementById('public-problem-solved').value,
      targetAudience: document.getElementById('public-target-audience').value,
      contactEmail: document.getElementById('public-contact-email').value,
      techStack: 'To Be Determined',
      initialFeatures: 'To Be Determined',
      riskRating: 'Medium',
      dateCreated: new Date().toISOString(),
      status: 'public-submission',
      submittedBy: document.getElementById('public-submitter-name').value
    };

    try {
      if (onSubmit) {
        await onSubmit(idea);
      }
      toastManager.show('Thank you! Your idea has been submitted for review.', 'success');
      closeModal();
    } catch (error) {
      console.error('Failed to submit idea:', error);
      toastManager.show('Failed to submit idea. Please try again.', 'error');
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

  setTimeout(() => document.getElementById('public-concept-name').focus(), 100);
}

export default showPublicIdeaModal;
