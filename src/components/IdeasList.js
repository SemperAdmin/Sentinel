/**
 * IdeasList - Component for rendering and managing ideas list
 */

import { formatDate } from '../utils/helpers.js';
import { escapeHtml } from '../utils/uiComponents.js';
import appState from '../state/AppState.js';

/**
 * Render individual idea item
 * @param {Object} idea - Idea object to render
 * @returns {string} HTML string for the idea item
 */
export function renderIdeaItem(idea) {
  const riskColor = {
    'Low': '#28a745',
    'Medium': '#ffc107',
    'High': '#dc3545'
  }[idea.riskRating] || '#6c757d';

  const isAdmin = appState.getState().userRole === 'admin';
  const isPublicSubmission = idea.status === 'public-submission' || idea.submittedBy === 'public';

  return `
    <div class="idea-item ${isPublicSubmission ? 'public-submission' : ''}" data-idea-id="${idea.id}">
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <h4>${escapeHtml(idea.conceptName)}</h4>
        ${isPublicSubmission ? '<span style="background: var(--primary-blue); color: white; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">PUBLIC SUBMISSION</span>' : ''}
      </div>
      <p>${escapeHtml(idea.problemSolved ? idea.problemSolved.substring(0, 100) : '')}${idea.problemSolved && idea.problemSolved.length > 100 ? '...' : ''}</p>
      <div class="idea-meta">
        <span>👥 ${escapeHtml(idea.targetAudience)}</span>
        <span>🛠️ ${escapeHtml(idea.techStack)}</span>
        <span style="color: ${riskColor}">⚠️ ${idea.riskRating} Risk</span>
        <span>📅 ${formatDate(idea.dateCreated)}</span>
        ${idea.contactEmail ? `<span>📧 ${escapeHtml(idea.contactEmail)}</span>` : ''}
      </div>
      ${isAdmin ? `
        <div style="margin-top: 1rem;">
          <button class="btn btn-primary" style="margin-right: 0.5rem;" data-action="activate">
            Activate & Create Repo
          </button>
          <button class="btn btn-secondary" data-action="edit">
            Edit
          </button>
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * Render ideas list into a container
 * @param {Array} ideas - Array of idea objects
 * @param {HTMLElement} container - DOM element to render into
 * @param {Object} callbacks - Callback functions
 * @param {Function} callbacks.onView - Called when idea is clicked for viewing (all users)
 * @param {Function} callbacks.onEdit - Called when edit button is clicked (admin only)
 * @param {Function} callbacks.onActivate - Called when activate button is clicked (admin only)
 */
export function renderIdeasList(ideas, container, callbacks = {}) {
  if (!ideas || ideas.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 3rem; color: #6c757d;">
        <h3>No ideas yet</h3>
        <p>Start documenting your app concepts here.</p>
      </div>
    `;
    // Remove any existing listener marker
    delete container.dataset.listenerAttached;
    return;
  }

  container.innerHTML = ideas.map(idea => renderIdeaItem(idea)).join('');

  // Add click listeners for ALL users using event delegation
  if (!container.dataset.listenerAttached) {
    container.addEventListener('click', (e) => {
      const item = e.target.closest('.idea-item[data-idea-id]');
      if (!item) return;

      const ideaId = item.dataset.ideaId;
      const idea = appState.getIdeaById(ideaId);
      if (!idea) return;

      const isAdmin = appState.isAdmin();
      const button = e.target.closest('button[data-action]');

      if (button && isAdmin) {
        e.stopPropagation(); // Prevent item click handler
        const action = button.dataset.action;
        if (action === 'edit' && callbacks.onEdit) {
          callbacks.onEdit(idea);
        } else if (action === 'activate' && callbacks.onActivate) {
          callbacks.onActivate(idea.id);
        }
      } else if (callbacks.onView) {
        // Clicking on the item opens view modal for all users
        callbacks.onView(idea);
      }
    });
    container.dataset.listenerAttached = 'true';
  }
}

/**
 * IdeasList class for more complex use cases
 */
export class IdeasList {
  constructor(container, callbacks = {}) {
    this.container = container;
    this.callbacks = callbacks;
  }

  /**
   * Render ideas into the container
   * @param {Array} ideas - Array of ideas to render
   */
  render(ideas) {
    renderIdeasList(ideas, this.container, this.callbacks);
  }

  /**
   * Get empty state HTML
   * @returns {string} HTML for empty state
   */
  static getEmptyState() {
    return `
      <div style="text-align: center; padding: 3rem; color: #6c757d;">
        <h3>No ideas yet</h3>
        <p>Start documenting your app concepts here.</p>
      </div>
    `;
  }
}

export default IdeasList;
