/**
 * IdeaDetailModal - Modal for viewing idea details (all users)
 */

import { escapeHtml } from '../../utils/uiComponents.js';
import { formatDate } from '../../utils/helpers.js';
import appState from '../../state/AppState.js';

/**
 * Render comments list HTML
 * @param {Array} comments - Array of comment objects
 * @returns {string} HTML string
 */
function renderComments(comments = []) {
  if (!comments || comments.length === 0) {
    return '<p style="color: var(--gray-500); font-style: italic; margin: 0;">No comments yet. Be the first to add feedback!</p>';
  }

  return comments.map(comment => `
    <div class="idea-comment" style="background: var(--gray-100); padding: 1rem; border-radius: 8px; margin-bottom: 0.75rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
        <span style="font-weight: 600; color: var(--gray-700);">${escapeHtml(comment.author || 'Anonymous')}</span>
        <span style="font-size: 0.75rem; color: var(--gray-500);">${formatDate(comment.createdAt)}</span>
      </div>
      <p style="margin: 0; line-height: 1.5; white-space: pre-wrap;">${escapeHtml(comment.text)}</p>
    </div>
  `).join('');
}

/**
 * Show idea detail modal (view-only for all users)
 * @param {Object} idea - Idea object to display
 * @param {Object} callbacks - Optional callbacks for actions
 * @param {Function} callbacks.onEdit - Called when edit button is clicked (admin only)
 * @param {Function} callbacks.onActivate - Called when activate button is clicked (admin only)
 * @param {Function} callbacks.onAddComment - Called when a comment is added (all users)
 */
export function showIdeaDetailModal(idea, callbacks = {}) {
  // Remove any existing dialog
  const existingDialog = document.querySelector('.idea-detail-dialog');
  if (existingDialog) existingDialog.remove();

  const isAdmin = appState.isAdmin();
  const isPublicSubmission = idea.status === 'public-submission' || idea.submittedBy === 'public';
  const comments = idea.comments || [];

  const riskColor = {
    'Low': '#28a745',
    'Medium': '#ffc107',
    'High': '#dc3545'
  }[idea.riskRating] || '#6c757d';

  const dialog = document.createElement('div');
  dialog.className = 'idea-detail-dialog todo-dialog';
  dialog.innerHTML = `
    <div class="dialog-overlay">
      <div class="dialog-content" style="max-width: 700px; max-height: 90vh; overflow-y: auto;">
        <div class="idea-detail-header">
          <div>
            <h3 style="margin: 0; display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
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

          <!-- Comments Section -->
          <div class="idea-comments-section" style="margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid var(--gray-200);">
            <h4 style="color: var(--gray-600); font-size: 0.75rem; text-transform: uppercase; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
              Feedback & Comments
              <span style="background: var(--gray-200); color: var(--gray-600); padding: 0.125rem 0.5rem; border-radius: 10px; font-size: 0.75rem;">${comments.length}</span>
            </h4>

            <div id="comments-list" style="max-height: 200px; overflow-y: auto; margin-bottom: 1rem;">
              ${renderComments(comments)}
            </div>

            <!-- Add Comment Form -->
            <div class="add-comment-form" style="margin-top: 1rem;">
              <div style="display: flex; gap: 0.5rem; margin-bottom: 0.75rem;">
                <input
                  type="text"
                  id="comment-author"
                  placeholder="Your name (optional)"
                  style="flex: 1; padding: 0.5rem; border: 1px solid var(--gray-300); border-radius: 4px; font-size: 0.875rem; background: var(--gray-50);"
                />
              </div>
              <textarea
                id="comment-text"
                placeholder="Add your feedback or suggestions..."
                rows="3"
                style="width: 100%; padding: 0.75rem; border: 1px solid var(--gray-300); border-radius: 4px; font-size: 0.875rem; resize: vertical; font-family: inherit; background: var(--gray-50);"
              ></textarea>
              <div style="display: flex; justify-content: flex-end; margin-top: 0.75rem;">
                <button class="btn btn-primary" id="submit-comment-btn" style="padding: 0.5rem 1rem;">
                  Add Comment
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="dialog-actions" style="margin-top: 2rem; display: flex; justify-content: flex-end; gap: 0.75rem; padding-top: 1rem; border-top: 1px solid var(--gray-200);">
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

  // Handle comment submission
  const submitCommentBtn = dialog.querySelector('#submit-comment-btn');
  const commentTextInput = dialog.querySelector('#comment-text');
  const commentAuthorInput = dialog.querySelector('#comment-author');

  if (submitCommentBtn && commentTextInput) {
    submitCommentBtn.addEventListener('click', async () => {
      const text = commentTextInput.value.trim();
      if (!text) {
        commentTextInput.focus();
        return;
      }

      const author = commentAuthorInput?.value.trim() || 'Anonymous';
      const comment = {
        id: Date.now().toString(),
        text,
        author,
        createdAt: new Date().toISOString()
      };

      // Disable button while saving
      submitCommentBtn.disabled = true;
      submitCommentBtn.textContent = 'Adding...';

      try {
        if (callbacks.onAddComment) {
          await callbacks.onAddComment(idea.id, comment);
        }

        // Update the comments list in the UI
        const commentsList = dialog.querySelector('#comments-list');
        const updatedComments = [...comments, comment];
        if (commentsList) {
          commentsList.innerHTML = renderComments(updatedComments);
          // Scroll to bottom to show new comment
          commentsList.scrollTop = commentsList.scrollHeight;
        }

        // Update the comment count
        const countBadge = dialog.querySelector('.idea-comments-section h4 span');
        if (countBadge) {
          countBadge.textContent = updatedComments.length.toString();
        }

        // Clear the form
        commentTextInput.value = '';
        commentAuthorInput.value = '';

        // Add to local comments array for subsequent renders
        comments.push(comment);
      } catch (error) {
        console.error('Failed to add comment:', error);
      } finally {
        submitCommentBtn.disabled = false;
        submitCommentBtn.textContent = 'Add Comment';
      }
    });

    // Handle Enter key in textarea (Ctrl+Enter to submit)
    commentTextInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        submitCommentBtn.click();
      }
    });
  }

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
