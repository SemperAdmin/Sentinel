/**
 * TodoDialog - Modal dialogs for todo management
 */

import { SOURCE_OPTIONS } from '../../utils/helpers.js';
import { escapeHtml } from '../../utils/uiComponents.js';
import appState from '../../state/AppState.js';

/**
 * Show add todo dialog (admin only)
 * @param {Function} onSubmit - Callback when todo is submitted
 */
export function showAddTodoDialog(onSubmit) {
  // Security check: Only admins can add todos
  if (!appState.isAdmin()) {
    return;
  }

  // Remove any existing dialog
  const existingDialog = document.querySelector('.todo-dialog');
  if (existingDialog) existingDialog.remove();

  console.log('Opening add todo dialog...');
  const dialog = document.createElement('div');
  dialog.className = 'todo-dialog';

  const sourceOptionsHtml = SOURCE_OPTIONS.map(s =>
    `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`
  ).join('');

  dialog.innerHTML = `
    <div class="dialog-overlay">
      <div class="dialog-content">
        <h3>Add New Task</h3>
        <form id="add-todo-form">
          <div class="form-group">
            <label>Title *</label>
            <input type="text" id="todo-title" required>
          </div>
          <div class="form-group">
            <label>Description</label>
            <textarea id="todo-description" rows="3"></textarea>
          </div>
          <div class="form-group">
            <label>Source</label>
            <select id="todo-source">${sourceOptionsHtml}</select>
          </div>
          <div class="form-group">
            <label>User Feedback Summary</label>
            <textarea id="todo-feedback-summary" rows="3" placeholder="Summary of feedback"></textarea>
          </div>
          <div class="form-group">
            <label>Submitted By</label>
            <input type="text" id="todo-submitted-by">
          </div>
          <div class="dialog-actions">
            <button type="button" class="btn btn-secondary" id="cancel-todo">Cancel</button>
            <button type="submit" class="btn btn-primary">Add Task</button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.body.appendChild(dialog);
  console.log('Dialog added to DOM');

  // Handle form submission
  dialog.querySelector('#add-todo-form').addEventListener('submit', (e) => {
    e.preventDefault();
    console.log('Form submitted');

    const todoData = {
      title: dialog.querySelector('#todo-title').value,
      description: dialog.querySelector('#todo-description').value,
      priority: 'medium',
      dueDate: null,
      source: dialog.querySelector('#todo-source').value,
      feedbackSummary: dialog.querySelector('#todo-feedback-summary').value,
      submittedBy: dialog.querySelector('#todo-submitted-by').value || '',
      status: 'Draft'
    };

    console.log('Adding todo:', todoData);
    if (onSubmit) {
      onSubmit(todoData);
    }
    document.body.removeChild(dialog);
  });

  // Handle cancel
  dialog.querySelector('#cancel-todo').addEventListener('click', () => {
    document.body.removeChild(dialog);
  });
}

/**
 * Show edit todo dialog (admin only)
 * @param {Object} todo - Todo object to edit
 * @param {Function} onSubmit - Callback when todo is updated
 */
export function showEditTodoDialog(todo, onSubmit) {
  // Security check: Only admins can edit todos
  if (!appState.isAdmin()) {
    return;
  }

  // Remove any existing dialog
  const existingDialog = document.querySelector('.todo-dialog');
  if (existingDialog) existingDialog.remove();

  const dialog = document.createElement('div');
  dialog.className = 'todo-dialog';

  const sourceOptionsHtml = SOURCE_OPTIONS.map(s =>
    `<option value="${escapeHtml(s)}" ${todo.source === s ? 'selected' : ''}>${escapeHtml(s)}</option>`
  ).join('');

  const priorityOptionsHtml = ['low', 'medium', 'high'].map(p =>
    `<option value="${p}" ${String(todo.priority || 'medium') === p ? 'selected' : ''}>${p.charAt(0).toUpperCase() + p.slice(1)}</option>`
  ).join('');

  const effortOptionsHtml = ['Small', 'Medium', 'Large'].map(e =>
    `<option value="${e}" ${String(todo.effortEstimate || '') === e ? 'selected' : ''}>${e}</option>`
  ).join('');

  const statusOptionsHtml = ['Draft', 'Submitted', 'Review', 'Approved', 'In Development', 'Complete', 'Rejected']
    .map(s => `<option ${String(todo.status || 'Draft') === s ? 'selected' : ''}>${s}</option>`).join('');

  dialog.innerHTML = `
    <div class="dialog-overlay">
      <div class="dialog-content">
        <h3>Edit Task</h3>
        <form id="edit-todo-form">
          <h4>Task Definition</h4>
          <div class="form-group">
            <label>Title *</label>
            <input type="text" id="todo-title" required value="${escapeHtml(todo.title || '')}">
          </div>
          <div class="form-group">
            <label>Description</label>
            <textarea id="todo-description" rows="3">${escapeHtml(todo.description || '')}</textarea>
          </div>

          <h4>Task Management & Triage</h4>
          <div class="form-group">
            <label>Priority</label>
            <select id="todo-priority">${priorityOptionsHtml}</select>
          </div>
          <div class="form-group">
            <label>Due Date</label>
            <input type="date" id="todo-due-date" value="${todo.dueDate || ''}">
          </div>
          <div class="form-group">
            <label>Effort Estimate</label>
            <select id="todo-effort-estimate">${effortOptionsHtml}</select>
          </div>

          <h4>Task Origin & Context</h4>
          <div class="form-group">
            <label>Source</label>
            <select id="todo-source">${sourceOptionsHtml}</select>
          </div>
          <div class="form-group">
            <label>User Feedback Summary</label>
            <textarea id="todo-feedback-summary" rows="3" placeholder="Summary of feedback">${escapeHtml(todo.feedbackSummary || '')}</textarea>
          </div>
          <div class="form-group">
            <label>Submitted By</label>
            <input type="text" id="todo-submitted-by" value="${escapeHtml(todo.submittedBy || '')}">
          </div>

          <h4>Workflow & Completion</h4>
          <div class="form-group">
            <label>Status</label>
            <select id="todo-status">${statusOptionsHtml}</select>
          </div>
          <div class="form-group" id="rejection-group" style="${String(todo.status || 'Draft') === 'Rejected' ? '' : 'display:none'}">
            <label>Reason for Rejection</label>
            <textarea id="todo-rejection-reason" rows="2" placeholder="If status is Rejected">${escapeHtml(todo.rejectionReason || '')}</textarea>
          </div>
          <div class="form-group" id="completion-group" style="${String(todo.status || 'Draft') === 'Complete' ? '' : 'display:none'}">
            <label>Completion Date</label>
            <input type="date" id="todo-completion-date" value="${todo.completionDate || ''}" ${String(todo.status || 'Draft') === 'Complete' ? '' : 'disabled'}>
          </div>

          <div class="dialog-actions">
            <button type="button" class="btn btn-secondary" id="cancel-todo">Cancel</button>
            <button type="submit" class="btn btn-primary">Save Changes</button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.body.appendChild(dialog);

  const form = dialog.querySelector('#edit-todo-form');
  const statusEl = dialog.querySelector('#todo-status');
  const rejectionGroup = dialog.querySelector('#rejection-group');
  const completionGroup = dialog.querySelector('#completion-group');
  const completionInput = dialog.querySelector('#todo-completion-date');

  const syncWorkflow = () => {
    const v = statusEl.value;
    rejectionGroup.style.display = v === 'Rejected' ? '' : 'none';
    if (v === 'Complete') {
      completionGroup.style.display = '';
      completionInput.disabled = false;
    } else {
      completionGroup.style.display = 'none';
      completionInput.disabled = true;
    }
  };

  statusEl.addEventListener('change', syncWorkflow);
  syncWorkflow();

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const status = dialog.querySelector('#todo-status').value;
    const updatedTodo = {
      ...todo,
      title: dialog.querySelector('#todo-title').value,
      description: dialog.querySelector('#todo-description').value,
      source: dialog.querySelector('#todo-source').value,
      feedbackSummary: dialog.querySelector('#todo-feedback-summary').value,
      submittedBy: dialog.querySelector('#todo-submitted-by').value || '',
      priority: dialog.querySelector('#todo-priority').value,
      dueDate: dialog.querySelector('#todo-due-date').value || null,
      effortEstimate: dialog.querySelector('#todo-effort-estimate').value || null,
      completionDate: status === 'Complete' ? dialog.querySelector('#todo-completion-date').value : null,
      rejectionReason: status === 'Rejected' ? dialog.querySelector('#todo-rejection-reason').value : '',
      status,
      completed: status === 'Complete'
    };

    if (onSubmit) {
      onSubmit(updatedTodo);
    }
    document.body.removeChild(dialog);
  });

  dialog.querySelector('#cancel-todo').addEventListener('click', () => {
    document.body.removeChild(dialog);
  });
}

export default {
  showAddTodoDialog,
  showEditTodoDialog
};
