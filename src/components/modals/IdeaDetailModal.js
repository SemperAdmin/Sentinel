/**
 * IdeaDetailModal - Modal for viewing idea details (all users)
 */

import { escapeHtml } from '../../utils/uiComponents.js';
import { formatDate } from '../../utils/helpers.js';
import appState from '../../state/AppState.js';

/**
 * Show idea detail modal (view-only for all users)
 * @param {Object} idea - Idea object to display
 * @param {Object} callbacks - Optional callbacks for admin actions
 * @param {Function} callbacks.onEdit - Called when edit button is clicked (admin only)
 * @param {Function} callbacks.onActivate - Called when activate button is clicked (admin only)
 */
export function showIdeaDetailModal(idea, callbacks = {}) {
  // Remove any existing dialog
  const existingDialog = document.querySelector('.idea-detail-dialog');
  if (existingDialog) existingDialog.remove();

  const isAdmin = appState.isAdmin();
  const isPublicSubmission = idea.status === 'public-submission' || idea.submittedBy === 'public';

  const riskColor = {
    'Low': '#28a745',
    'Medium': '#ffc107',
    'High': '#dc3545'
  }[idea.riskRating] || '#6c757d';

  const dialog = document.createElement('div');
  dialog.className = 'idea-detail-dialog todo-dialog';
  dialog.innerHTML = `
    <div class="dialog-overlay">
      <div class="dialog-content" style="max-width: 700px;">
        <div class="idea-detail-header">
          <div>
            <h3 style="margin: 0; display: flex; align-items: center; gap: 0.75rem;">
              ${escapeHtml(idea.conceptName)}
              ${isPublicSubmission ? '<span style="background: var(--primary-blue); color: white; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.7rem; font-weight: 600;">PUBLIC SUBMISSION</span>' : ''}
            </h3>
            <p style="color: var(--gray-500); margin: 0.5rem 0 0 0; font-size: 0.875rem;">
              Created ${formatDate(idea.dateCreated)}
              ${idea.contactEmail ? ` • ${escapeHtml(idea.contactEmail)}` : ''}
            </p>
          </div>
          <button class="dialog-close" id="close-idea-detail" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--gray-500);">&times;</button>
        </div>

        <div class="idea-detail-body" style="margin-top: 1.5rem;">
          <div class="idea-detail-section">
            <h4 style="color: var(--gray-600); font-size: 0.75rem; text-transform: uppercase; margin-bottom: 0.5rem;">Problem Solved</h4>
            <p style="margin: 0; line-height: 1.6;">${escapeHtml(idea.problemSolved || 'No description provided')}</p>
          </div>

          <div class="idea-detail-section" style="margin-top: 1.5rem;">
            <h4 style="color: var(--gray-600); font-size: 0.75rem; text-transform: uppercase; margin-bottom: 0.5rem;">Target Audience</h4>
            <p style="margin: 0;">${escapeHtml(idea.targetAudience || 'Not specified')}</p>
          </div>

          ${idea.initialFeatures ? `
          <div class="idea-detail-section" style="margin-top: 1.5rem;">
            <h4 style="color: var(--gray-600); font-size: 0.75rem; text-transform: uppercase; margin-bottom: 0.5rem;">Initial Features (MVP)</h4>
            <p style="margin: 0; line-height: 1.6; white-space: pre-wrap;">${escapeHtml(idea.initialFeatures)}</p>
          </div>
          ` : ''}

          <div class="idea-detail-meta" style="display: flex; gap: 1.5rem; margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid var(--gray-200); flex-wrap: wrap;">
            <div>
              <span style="color: var(--gray-500); font-size: 0.75rem; text-transform: uppercase;">Tech Stack</span>
              <p style="margin: 0.25rem 0 0 0; font-weight: 600;">${escapeHtml(idea.techStack || 'Not specified')}</p>
            </div>
            <div>
              <span style="color: var(--gray-500); font-size: 0.75rem; text-transform: uppercase;">Risk Rating</span>
              <p style="margin: 0.25rem 0 0 0; font-weight: 600; color: ${riskColor};">${escapeHtml(idea.riskRating || 'Not rated')}</p>
            </div>
            ${idea.submittedBy ? `
            <div>
              <span style="color: var(--gray-500); font-size: 0.75rem; text-transform: uppercase;">Submitted By</span>
              <p style="margin: 0.25rem 0 0 0; font-weight: 600;">${escapeHtml(idea.submittedBy)}</p>
            </div>
            ` : ''}
          </div>
        </div>

        <div class="dialog-actions" style="margin-top: 2rem; display: flex; justify-content: flex-end; gap: 0.75rem;">
          ${isAdmin ? `
            <button class="btn btn-primary" id="activate-idea-btn">
              Activate & Create Repo
            </button>
            <button class="btn btn-secondary" id="edit-idea-btn">
              Edit
            </button>
          ` : ''}
          <button class="btn btn-secondary" id="close-idea-btn">Close</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(dialog);

  // Handle close
  const closeModal = () => {
    if (dialog.parentNode) {
      document.body.removeChild(dialog);
    }
  };

  dialog.querySelector('#close-idea-detail')?.addEventListener('click', closeModal);
  dialog.querySelector('#close-idea-btn')?.addEventListener('click', closeModal);

  // Handle admin actions
  if (isAdmin) {
    dialog.querySelector('#edit-idea-btn')?.addEventListener('click', () => {
      closeModal();
      if (callbacks.onEdit) {
        callbacks.onEdit(idea);
      }
    });

    dialog.querySelector('#activate-idea-btn')?.addEventListener('click', () => {
      closeModal();
      if (callbacks.onActivate) {
        callbacks.onActivate(idea.id);
      }
    });
  }

  // Handle overlay click
  dialog.querySelector('.dialog-overlay')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
      closeModal();
    }
  });

  // Handle escape key
  const escapeHandler = (e) => {
    if (e.key === 'Escape') {
      document.removeEventListener('keydown', escapeHandler);
      closeModal();
    }
  };
  document.addEventListener('keydown', escapeHandler);
}

export default showIdeaDetailModal;
