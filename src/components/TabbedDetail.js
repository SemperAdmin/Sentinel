/**
 * TabbedDetail Component - Tabbed interface for app detail view
 */

import { formatDate, calculateHealth, getHealthColor, getLatestReviewDate, SOURCE_OPTIONS, slugify } from '../utils/helpers.js';
import appState from '../state/AppState.js';

export class TabbedDetail {
  constructor(app, onNotesSave, onTabChange, onReviewComplete) {
    this.app = app;
    this.onNotesSave = onNotesSave;
    this.onTabChange = onTabChange;
    this.onReviewComplete = onReviewComplete;
    this.element = null;
    this.activeTab = 'overview';
  }

  /**
   * Clear completed todos
   */
  clearCompletedTodos() {
    if (!this.app.todos || this.app.todos.length === 0) return;
    
    const activeTodos = this.app.todos.filter(todo => !todo.completed);
    const completedCount = this.app.todos.length - activeTodos.length;
    
    if (completedCount === 0) {
      alert('No completed tasks to clear.');
      return;
    }
    
    if (confirm(`Clear ${completedCount} completed task${completedCount > 1 ? 's' : ''}?`)) {
      this.app.todos = activeTodos;
      
      if (this.onNotesSave) {
        this.onNotesSave(this.app);
      }
      (async () => {
        try {
          const apiModule = await import('../data/ApiService.js');
          const api = apiModule.default;
          await api.triggerSaveTasks(this.app.id, this.app.todos || []);
        } catch (_) {}
      })();
      
      this.activeTab = 'todo';
      this.render();
    }
  }

  /**
   * Export todos to JSON/CSV
   */
  exportTodos() {
    const todos = this.app.todos || [];
    
    if (todos.length === 0) {
      alert('No tasks to export.');
      return;
    }
    
    const exportData = {
      app: this.app.id,
      exportDate: new Date().toISOString(),
      todos: todos.map(todo => ({
        title: todo.title,
        description: todo.description,
        priority: todo.priority,
        dueDate: todo.dueDate,
        completed: todo.completed,
        createdAt: todo.createdAt
      }))
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `${this.app.id}-todos-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
  }

  /**
   * Render the tabbed detail component
   */
  render() {
    console.log('Rendering TabbedDetail component...');
    
    // Get the existing tab content container
    const tabContent = document.querySelector('.tab-content');
    if (!tabContent) {
      console.error('Tab content container not found');
      return null;
    }
    
    // Update the tab content
    tabContent.innerHTML = this.renderTabContent();
    
    // Update tab button states
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(button => {
      button.classList.toggle('active', button.dataset.tab === this.activeTab);
    });
    
    // Attach event listeners to existing tab buttons
    this.element = tabContent;
    console.log('Attaching event listeners...');
    this.attachEventListeners();
    
    return tabContent;
  }

  /**
   * Render tab content based on active tab
   */
  renderTabContent() {
    switch (this.activeTab) {
      case 'overview':
        return this.renderOverviewTab();
      case 'todo':
        return this.renderTodoTab();
      case 'notes':
        return this.renderNotesTab();
      default:
        return this.renderOverviewTab();
    }
  }

  /**
   * Render overview tab
   */
  renderOverviewTab() {
    const health = calculateHealth(this.app);
    const healthColor = getHealthColor(health);
    const isOverdue = this.app.nextReviewDate && new Date(this.app.nextReviewDate) < new Date();
    const lastReviewedDate = getLatestReviewDate(this.app.lastCommitDate, this.app.lastReviewDate);
    const appUrl = this.getAppUrl(this.app.repoUrl);
    
    return `
      <div id="overview-tab" class="tab-pane active">
        <div class="detail-section">
          <h3>Repository Information</h3>
          <div class="status-grid">
            <div class="status-item">
              <label>Repository:</label>
              <span>${this.app.repoUrl ? `<a href="${this.app.repoUrl}" target="_blank" rel="noopener noreferrer">${this.escapeHtml(this.app.repoUrl)}</a>` : 'Not linked'}</span>
            </div>
            <div class="status-item">
              <label>App URL:</label>
              <span>${appUrl ? `<a href="${appUrl}" target="_blank" rel="noopener noreferrer">${this.escapeHtml(appUrl)}</a>` : 'Not available'}</span>
            </div>
            <div class="status-item">
              <label>Description:</label>
              <span>${this.escapeHtml(this.app.description || this.app.notes || 'No description available')}</span>
            </div>
            <div class="status-item">
              <label>Status:</label>
              <span class="status-badge ${this.app.status === 'Active' ? 'status-good' : 'status-warning'}">
                ${this.app.status}
              </span>
            </div>
            <div class="status-item">
              <label>Pending Tasks:</label>
              <span>${this.app.pendingTodos || 0}</span>
            </div>
          </div>
        </div>
        
        <div class="detail-section">
          <h3>Technical Status</h3>
          <div class="status-grid">
            <div class="status-item">
              <label>Health Status:</label>
              <span class="status-badge" style="background-color: ${healthColor}; color: white;">
                ${health.toUpperCase()}
              </span>
            </div>
            <div class="status-item">
              <label>Last Reviewed:</label>
              <span>${formatDate(lastReviewedDate, { relative: true }) || 'Never'}</span>
            </div>
            <div class="status-item">
              <label>Recent Activity:</label>
              <span>${this.app.recentViews || 0} views · ${this.app.recentClones || 0} clones (14d)</span>
            </div>
            <div class="status-item">
              <label>Platform:</label>
              <span>${this.escapeHtml(this.app.platform)}</span>
            </div>
          </div>
        </div>
        
        <div class="detail-section">
          <h3>Quarterly Review Schedule</h3>
          <div class="review-info">
            <div class="info-item">
              <label>Last Review:</label>
              <span>${formatDate(this.app.lastReviewDate) || 'Never'}</span>
            </div>
            <div class="info-item">
              <label>Next Due (60d from latest):</label>
              <span style="color: ${isOverdue ? '#dc3545' : 'inherit'}; font-weight: ${isOverdue ? '600' : 'normal'}">
                ${formatDate(this.app.nextReviewDate) || 'Not scheduled'}
                ${isOverdue ? ' (OVERDUE)' : ''}
              </span>
            </div>
          </div>
          <button class="btn btn-primary" id="start-review-checklist" style="margin-top: 1rem;">
            ▶ Start Review Checklist
          </button>
        </div>

        <div class="detail-section">
          <h3>Past Reviews</h3>
          <div id="past-reviews" style="color:#6c757d;">Loading...</div>
        </div>
      </div>
    `;
  }

  /**
   * Render todo tab with full todo management
   */
  renderTodoTab() {
    const todos = this.app.todos || [];
    const completedTodos = todos.filter(todo => todo.completed);
    const pendingTodos = todos.filter(todo => !todo.completed && String(todo.status||'') === 'Draft');
    const activeTodos = todos.filter(todo => !todo.completed && String(todo.status||'') !== 'Draft');
    
    return `
      <div id="todo-tab" class="tab-pane active">
        <div class="detail-section">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h3>To-Do Dashboard</h3>
            <button class="btn btn-primary" id="add-todo-btn">+ Add New Task</button>
          </div>
          <div style="display: grid; grid-template-columns: repeat(4, minmax(160px, 1fr)); gap: 1rem;">
            <div class="app-card">
              <div class="app-card-header"><h4 class="app-card-title">Total</h4></div>
              <div style="font-size: 1.8rem; font-weight: 700;">${todos.length}</div>
              <div style="color: #888; font-size: 0.8rem; margin-top: 0.25rem;">All tasks</div>
            </div>
            <div class="app-card">
              <div class="app-card-header"><h4 class="app-card-title">Active</h4></div>
              <div style="font-size: 1.8rem; font-weight: 700;">${activeTodos.length}</div>
              <div style="color: #888; font-size: 0.8rem; margin-top: 0.25rem;">In progress</div>
            </div>
            <div class="app-card">
              <div class="app-card-header"><h4 class="app-card-title">Completed</h4></div>
              <div style="font-size: 1.8rem; font-weight: 700;">${completedTodos.length}</div>
              <div style="color: #888; font-size: 0.8rem; margin-top: 0.25rem;">Finished</div>
            </div>
            <div class="app-card">
              <div class="app-card-header"><h4 class="app-card-title">Overdue</h4></div>
              <div style="font-size: 1.8rem; font-weight: 700;">${activeTodos.filter(t => t.dueDate && new Date(t.dueDate) < new Date()).length}</div>
              <div style="color: #888; font-size: 0.8rem; margin-top: 0.25rem;">Past due</div>
            </div>
          </div>
        </div>
        

        <div class="detail-section">
          <h3>Pending Tasks</h3>
          <div id="pending-todos" class="todo-list">
            ${pendingTodos.length > 0 ? pendingTodos.map(todo => this.renderTodoItem(todo)).join('') : '<p style="color: #6c757d;">No pending tasks</p>'}
          </div>
        </div>

        <div class="detail-section">
          <h3>Active Tasks</h3>
          <div id="active-todos" class="todo-list">
            ${activeTodos.length > 0 ? activeTodos.map(todo => this.renderTodoItem(todo)).join('') : '<p style="color: #6c757d;">No active tasks</p>'}
          </div>
        </div>

        <div class="detail-section">
          <h3>Completed Tasks</h3>
          <div id="completed-todos" class="todo-list completed">
            ${completedTodos.length > 0 ? completedTodos.map(todo => this.renderTodoItem(todo)).join('') : '<p style="color: #6c757d;">No completed tasks</p>'}
          </div>
        </div>

        <div class="detail-section">
          <h3>Quick Actions</h3>
          <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
            <button class="btn btn-secondary" id="clear-completed-btn">Clear Completed</button>
            <button class="btn btn-secondary" id="export-todos-btn">Export Tasks</button>
            <button class="btn btn-secondary" id="save-tasks-repo-btn">💾 Save Tasks to Repo</button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render individual todo item
   */
  renderTodoItem(todo) {
    const priorityClass = todo.priority ? `priority-${String(todo.priority).toLowerCase()}` : '';
    const dueDateClass = todo.dueDate && new Date(todo.dueDate) < new Date() ? 'overdue' : '';
    const sourceKey = slugify(String(todo.source||'other').replace(/\([^)]*\)/g,'').trim());
    const sourceClass = sourceKey ? `source-${sourceKey}` : 'source-other';
    const pr = String(todo.priority||'medium').toLowerCase();
    const prIcon = pr === 'high' ? '🔴' : (pr === 'medium' ? '🟠' : '🟢');
    const bgMap = {
      'facebook': 'rgba(24, 119, 242, 0.08)',
      'instagram': 'rgba(225, 48, 108, 0.10)',
      'teams': 'rgba(98, 100, 167, 0.08)',
      'feedback-app': 'rgba(108, 117, 125, 0.10)',
      'email': 'rgba(23, 162, 184, 0.10)',
      'sponsor': 'rgba(40, 167, 69, 0.10)',
      'policy': 'rgba(52, 58, 64, 0.08)',
      'other': 'var(--gray-100)'
    };
    const borderMap = { 'low': '#28a745', 'medium': '#ffc107', 'high': '#dc3545' };
    const bgColor = bgMap[sourceKey] || bgMap['other'];
    const borderColor = borderMap[pr] || borderMap['medium'];
    const styleStr = `background-color: ${bgColor}; border: 4px solid ${borderColor}; padding: 4px 12px;`;
    
    return `
      <div class="todo-item ${todo.completed ? 'completed' : ''} ${dueDateClass} ${priorityClass} ${sourceClass}" data-todo-id="${todo.id}" style="${styleStr}">
        <div class="todo-content">
          <div class="todo-title">${prIcon} ${this.escapeHtml(todo.title)}</div>
          
          ${todo.description ? `<div class="todo-description">${this.escapeHtml(todo.description)}</div>` : ''}
          ${todo.dueDate ? `<div class="todo-due">Due: ${formatDate(todo.dueDate)}</div>` : ''}
        </div>
        <div class="todo-actions">
          <button class="btn-icon" data-action="edit" data-todo-id="${todo.id}">✏️</button>
          <button class="btn-icon" data-action="delete" data-todo-id="${todo.id}">🗑️</button>
        </div>
      </div>
    `;
  }

  /**
   * Add new todo item
   */
  addTodo(title, description = '', priority = 'medium', dueDate = null, extra = {}) {
    const todo = {
      id: Date.now().toString(),
      title,
      description,
      priority,
      dueDate,
      completed: false,
      createdAt: new Date().toISOString(),
      ...extra
    };
    
    if (!this.app.todos) this.app.todos = [];
    this.app.todos.push(todo);
    
    // Update the app and trigger re-render
    if (this.onNotesSave) {
      this.onNotesSave(this.app);
    }
    (async () => {
      try {
        const apiModule = await import('../data/ApiService.js');
        const api = apiModule.default;
        await api.triggerSaveTasks(this.app.id, this.app.todos || []);
      } catch (_) {}
    })();
    
    // Re-render the todo tab
    this.activeTab = 'todo';
    this.render();
  }

  /**
   * Toggle todo completion status
   */
  toggleTodo(todoId) {
    if (!this.app.todos) return;
    
    const todo = this.app.todos.find(t => t.id === todoId);
    if (todo) {
      todo.completed = !todo.completed;
      
      if (this.onNotesSave) {
        this.onNotesSave(this.app);
      }
      (async () => {
        try {
          const apiModule = await import('../data/ApiService.js');
          const api = apiModule.default;
          await api.triggerSaveTasks(this.app.id, this.app.todos || []);
        } catch (_) {}
      })();
      
      this.activeTab = 'todo';
      this.render();
    }
  }

  /**
   * Edit todo item (placeholder for future implementation)
   */
  editTodo(todoId) {
    if (!this.app.todos) return;
    const todo = this.app.todos.find(t => t.id === todoId);
    if (!todo) return;
    this.showEditTodoDialog(todo);
  }

  /**
   * Delete todo item
   */
  deleteTodo(todoId) {
    if (!this.app.todos) return;
    
    this.app.todos = this.app.todos.filter(t => t.id !== todoId);
    
    if (this.onNotesSave) {
      this.onNotesSave(this.app);
    }
    (async () => {
      try {
        const apiModule = await import('../data/ApiService.js');
        const api = apiModule.default;
        await api.triggerSaveTasks(this.app.id, this.app.todos || []);
      } catch (_) {}
    })();
    
    this.activeTab = 'todo';
    this.render();
  }

  showEditTodoDialog(todo) {
    const existingDialog = document.querySelector('.todo-dialog');
    if (existingDialog) existingDialog.remove();
    const dialog = document.createElement('div');
    dialog.className = 'todo-dialog';
    const sourceOptionsHtml = SOURCE_OPTIONS.map(s => `<option value="${this.escapeHtml(s)}" ${todo.source === s ? 'selected' : ''}>${this.escapeHtml(s)}</option>`).join('');
    const priorityOptionsHtml = ['low','medium','high'].map(p => `<option value="${p}" ${String(todo.priority||'medium')===p?'selected':''}>${p.charAt(0).toUpperCase()+p.slice(1)}</option>`).join('');
    const effortOptionsHtml = ['Small','Medium','Large'].map(e => `<option value="${e}" ${String(todo.effortEstimate||'')===e?'selected':''}>${e}</option>`).join('');
    const statusOptionsHtml = ['Draft','Submitted','Review','Approved','In Development','Complete','Rejected']
      .map(s => `<option ${String(todo.status||'Draft')===s?'selected':''}>${s}</option>`).join('');
    dialog.innerHTML = `
      <div class="dialog-overlay">
        <div class="dialog-content">
          <h3>Edit Task</h3>
          <form id="edit-todo-form">
            <h4>Task Definition</h4>
            <div class="form-group">
              <label>Title *</label>
              <input type="text" id="todo-title" required value="${this.escapeHtml(todo.title || '')}">
            </div>
            <div class="form-group">
              <label>Description</label>
              <textarea id="todo-description" rows="3">${this.escapeHtml(todo.description || '')}</textarea>
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
              <textarea id="todo-feedback-summary" rows="3" placeholder="Summary of feedback">${this.escapeHtml(todo.feedbackSummary || '')}</textarea>
            </div>
            <div class="form-group">
              <label>Submitted By</label>
              <input type="text" id="todo-submitted-by" value="${this.escapeHtml(todo.submittedBy || '')}">
            </div>

            <h4>Workflow & Completion</h4>
            <div class="form-group">
              <label>Status</label>
              <select id="todo-status">${statusOptionsHtml}</select>
            </div>
            <div class="form-group" id="rejection-group" style="${String(todo.status||'Draft')==='Rejected' ? '' : 'display:none'}">
              <label>Reason for Rejection</label>
              <textarea id="todo-rejection-reason" rows="2" placeholder="If status is Rejected">${this.escapeHtml(todo.rejectionReason || '')}</textarea>
            </div>
            <div class="form-group" id="completion-group" style="${String(todo.status||'Draft')==='Complete' ? '' : 'display:none'}">
              <label>Completion Date</label>
              <input type="date" id="todo-completion-date" value="${todo.completionDate || ''}" ${String(todo.status||'Draft')==='Complete' ? '' : 'disabled'}>
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
      if (v === 'Rejected') {
        rejectionGroup.style.display = '';
      } else {
        rejectionGroup.style.display = 'none';
      }
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
      const title = dialog.querySelector('#todo-title').value;
      const description = dialog.querySelector('#todo-description').value;
      const source = dialog.querySelector('#todo-source').value;
      const feedbackSummary = dialog.querySelector('#todo-feedback-summary').value;
      const submittedBy = dialog.querySelector('#todo-submitted-by').value || '';
      const priority = dialog.querySelector('#todo-priority').value;
      const dueDate = dialog.querySelector('#todo-due-date').value || null;
      const effortEstimate = dialog.querySelector('#todo-effort-estimate').value || null;
      const completionDate = dialog.querySelector('#todo-completion-date').value || null;
      const rejectionReason = dialog.querySelector('#todo-rejection-reason').value || '';
      const status = dialog.querySelector('#todo-status').value;
      const completed = status === 'Complete' ? true : false;
      const updated = { 
        ...todo, 
        title, 
        description, 
        source, 
        feedbackSummary, 
        submittedBy, 
        priority, 
        dueDate, 
        effortEstimate, 
        completionDate: status === 'Complete' ? completionDate : null, 
        rejectionReason: status === 'Rejected' ? rejectionReason : '', 
        status, 
        completed 
      };
      this.app.todos = this.app.todos.map(t => t.id === todo.id ? updated : t);
      if (this.onNotesSave) this.onNotesSave(this.app);
      (async () => {
        try {
          const apiModule = await import('../data/ApiService.js');
          const api = apiModule.default;
          await api.triggerSaveTasks(this.app.id, this.app.todos || []);
        } catch (_) {}
      })();
      this.activeTab = 'todo';
      this.render();
      document.body.removeChild(dialog);
    });

    dialog.querySelector('#cancel-todo').addEventListener('click', () => {
      document.body.removeChild(dialog);
    });

    
  }

  /**
   * Show add todo dialog
   */
  showAddTodoDialog() {
    const existingDialog = document.querySelector('.todo-dialog');
    if (existingDialog) existingDialog.remove();
    console.log('Opening add todo dialog...');
    const dialog = document.createElement('div');
    dialog.className = 'todo-dialog';
    const sourceOptionsHtml = SOURCE_OPTIONS.map(s => `<option value="${this.escapeHtml(s)}">${this.escapeHtml(s)}</option>`).join('');
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
      const title = dialog.querySelector('#todo-title').value;
      const description = dialog.querySelector('#todo-description').value;
      const priority = 'medium';
      const dueDate = null;
      const effortEstimate = null;
      const source = dialog.querySelector('#todo-source').value;
      const completionDate = null;
      const feedbackSummary = dialog.querySelector('#todo-feedback-summary').value;
      const submittedBy = dialog.querySelector('#todo-submitted-by').value || '';
      const rejectionReason = '';
      const status = 'Draft';
      
      console.log('Adding todo:', { title, description, source, feedbackSummary, status });
      this.addTodo(title, description, priority, dueDate, { source, feedbackSummary, submittedBy, status });
      document.body.removeChild(dialog);
    });
    
    // Handle cancel
    dialog.querySelector('#cancel-todo').addEventListener('click', () => {
      document.body.removeChild(dialog);
    });
    
    
  }

  /**
   * Generate simulated tasks
   */
  generateSimulatedTasks() {
    const taskCount = Math.min(this.app.pendingTodos || 0, 5);
    const tasks = [];
    
    const taskTemplates = [
      { title: 'Update dependencies to latest versions', tag: 'Tech Debt', priority: 'P1' },
      { title: 'Fix performance issues in main screen', tag: 'Bug', priority: 'P0' },
      { title: 'Add unit tests for authentication module', tag: 'Testing', priority: 'P2' },
      { title: 'Refactor legacy code in data layer', tag: 'Tech Debt', priority: 'P1' },
      { title: 'Update app icon and splash screen', tag: 'UI/UX', priority: 'P2' },
      { title: 'Implement dark mode support', tag: 'Feature', priority: 'P1' },
      { title: 'Optimize database queries', tag: 'Performance', priority: 'P0' },
      { title: 'Add error logging and analytics', tag: 'Monitoring', priority: 'P2' }
    ];
    
    for (let i = 0; i < taskCount; i++) {
      const template = taskTemplates[i % taskTemplates.length];
      tasks.push({
        ...template,
        id: `task-${i}`,
        title: `${template.title} - ${this.app.id}`
      });
    }
    
    return tasks;
  }

  /**
   * Render notes tab with improvements and developer notes
   */
  renderNotesTab() {
    const improvements = this.app.improvements || [];
    const developerNotes = this.app.developerNotes || '';
    
    return `
      <div id="notes-tab" class="tab-pane active">
        <div class="detail-section">
          <h3>Improvement Tracker</h3>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <span>Improvement Budget: ${this.app.improvementBudget || 20}%</span>
            <button class="btn btn-primary" id="add-improvement-btn">+ Add Improvement</button>
          </div>
          <div id="improvements-list" class="improvements-list">
            ${improvements.length > 0 ? improvements.map(imp => this.renderImprovementItem(imp)).join('') : '<p style="color: #6c757d;">No improvements tracked</p>'}
          </div>
        </div>
        
        <div class="detail-section">
          <h3>Developer Notes</h3>
          <textarea 
            id="developer-notes" 
            class="notes-textarea" 
            placeholder="Add your development notes here... Use this space to document decisions, technical considerations, and future plans.">${this.escapeHtml(developerNotes)}</textarea>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1rem;">
            <span style="color: #6c757d; font-size: 0.875rem;">
              ${developerNotes.length} characters
            </span>
            <button class="btn btn-primary" id="save-notes">
              💾 Save Notes
            </button>
          </div>
        </div>
        
        <div class="detail-section">
          <h3>Quick Templates</h3>
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <button class="btn btn-secondary" data-template="decision">Decision Template</button>
            <button class="btn btn-secondary" data-template="technical">Technical Notes</button>
            <button class="btn btn-secondary" data-template="todo">Future TODO</button>
            <button class="btn btn-secondary" data-template="bug">Bug Report</button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render improvement item
   */
  renderImprovementItem(improvement) {
    const statusClass = improvement.status ? `status-${improvement.status.toLowerCase()}` : '';
    const effortClass = improvement.effort ? `effort-${improvement.effort.toLowerCase()}` : '';
    const isConverted = improvement.status === 'converted-to-todo';
    
    return `
      <div class="improvement-item ${statusClass} ${effortClass} ${isConverted ? 'converted' : ''}" data-improvement-id="${improvement.id}">
        <div class="improvement-header">
          <div class="improvement-title">${this.escapeHtml(improvement.title)} ${isConverted ? '✅' : ''}</div>
          <div class="improvement-badges">
            <span class="badge effort">${improvement.effort || 'Medium'}</span>
            <span class="badge status">${improvement.status === 'converted-to-todo' ? 'Converted to Todo' : (improvement.status || 'Planned')}</span>
          </div>
        </div>
        ${improvement.description ? `<div class="improvement-description">${this.escapeHtml(improvement.description)}</div>` : ''}
        <div class="improvement-actions">
          ${!isConverted ? `<button class="btn-icon" data-action="convert-to-todo" data-improvement-id="${improvement.id}" title="Convert to Todo">➕</button>` : ''}
          ${!isConverted ? `<button class="btn-icon" data-action="edit-improvement" data-improvement-id="${improvement.id}">✏️</button>` : ''}
          <button class="btn-icon" data-action="delete-improvement" data-improvement-id="${improvement.id}">🗑️</button>
        </div>
      </div>
    `;
  }

  /**
   * Add new improvement
   */
  addImprovement(title, description = '', effort = 'Medium', status = 'Planned') {
    const improvement = {
      id: Date.now().toString(),
      title,
      description,
      effort,
      status,
      createdAt: new Date().toISOString()
    };
    
    if (!this.app.improvements) this.app.improvements = [];
    this.app.improvements.push(improvement);
    
    if (this.onNotesSave) {
      this.onNotesSave(this.app);
    }
    
    this.activeTab = 'notes';
    this.render();
  }

  /**
   * Edit improvement (placeholder for future implementation)
   */
  editImprovement(improvementId) {
    console.log('Edit improvement clicked:', improvementId);
    alert('Edit improvement functionality coming soon! For now, you can delete and re-add the improvement.');
  }

  /**
   * Delete improvement
   */
  deleteImprovement(improvementId) {
    if (!this.app.improvements) return;
    
    this.app.improvements = this.app.improvements.filter(imp => imp.id !== improvementId);
    
    if (this.onNotesSave) {
      this.onNotesSave(this.app);
    }
    
    this.activeTab = 'notes';
    this.render();
  }

  /**
   * Convert improvement to todo
   */
  convertImprovementToTodo(improvementId) {
    if (!this.app.improvements) return;
    
    const improvement = this.app.improvements.find(imp => imp.id === improvementId);
    if (!improvement) return;
    
    // Confirm conversion
    if (!confirm(`Convert improvement "${improvement.title}" to a todo task?`)) {
      return;
    }
    
    // Create todo from improvement
    const todo = {
      id: Date.now().toString(),
      title: improvement.title,
      description: improvement.description || '',
      priority: this.mapEffortToPriority(improvement.effort),
      dueDate: null,
      completed: false,
      createdAt: new Date().toISOString(),
      source: 'improvement',
      sourceId: improvementId
    };
    
    // Add todo to the list
    if (!this.app.todos) this.app.todos = [];
    this.app.todos.push(todo);
    
    // Update improvement status to indicate it's been converted
    improvement.status = 'converted-to-todo';
    
    if (this.onNotesSave) {
      this.onNotesSave(this.app);
    }
    
    // Switch to todo tab to show the new todo
    this.activeTab = 'todo';
    this.render();
    
    console.log(`Converted improvement "${improvement.title}" to todo`);
  }

  /**
   * Map effort level to priority
   */
  mapEffortToPriority(effort) {
    const effortPriorityMap = {
      'low': 'low',
      'medium': 'medium', 
      'high': 'high'
    };
    return effortPriorityMap[effort] || 'medium';
  }

  /**
   * Show add improvement dialog
   */
  showAddImprovementDialog() {
    console.log('Opening add improvement dialog...');
    const dialog = document.createElement('div');
    dialog.className = 'todo-dialog';
    dialog.innerHTML = `
      <div class="dialog-overlay">
        <div class="dialog-content">
          <h3>Add New Improvement</h3>
          <form id="add-improvement-form">
            <div class="form-group">
              <label>Title *</label>
              <input type="text" id="improvement-title" required>
            </div>
            <div class="form-group">
              <label>Description</label>
              <textarea id="improvement-description" rows="3"></textarea>
            </div>
            <div class="form-group">
              <label>Effort Level</label>
              <select id="improvement-effort">
                <option value="Low">Low</option>
                <option value="Medium" selected>Medium</option>
                <option value="High">High</option>
              </select>
            </div>
            <div class="form-group">
              <label>Status</label>
              <select id="improvement-status">
                <option value="Planned" selected>Planned</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="On Hold">On Hold</option>
              </select>
            </div>
            <div class="dialog-actions">
              <button type="button" class="btn btn-secondary" id="cancel-improvement">Cancel</button>
              <button type="submit" class="btn btn-primary">Add Improvement</button>
            </div>
          </form>
        </div>
      </div>
    `;
    
    document.body.appendChild(dialog);
    console.log('Improvement dialog added to DOM');
    
    // Handle form submission
    dialog.querySelector('#add-improvement-form').addEventListener('submit', (e) => {
      e.preventDefault();
      console.log('Improvement form submitted');
      const title = dialog.querySelector('#improvement-title').value;
      const description = dialog.querySelector('#improvement-description').value;
      const effort = dialog.querySelector('#improvement-effort').value;
      const status = dialog.querySelector('#improvement-status').value;
      
      console.log('Adding improvement:', { title, description, effort, status });
      this.addImprovement(title, description, effort, status);
      document.body.removeChild(dialog);
    });
    
    // Handle cancel
    dialog.querySelector('#cancel-improvement').addEventListener('click', () => {
      document.body.removeChild(dialog);
    });
    
    // Handle overlay click
    dialog.querySelector('.dialog-overlay').addEventListener('click', (e) => {
      if (e.target === dialog.querySelector('.dialog-overlay')) {
        document.body.removeChild(dialog);
      }
    });
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    if (!this.element) return;
    
    console.log('Attaching tab event listeners...');
    // Tab navigation - look for tab buttons in the entire document since they're in the HTML template
    const tabButtons = document.querySelectorAll('.tab-btn');
    console.log(`Found ${tabButtons.length} tab buttons`);
    tabButtons.forEach(button => {
      console.log(`Adding click listener to tab button: ${button.dataset.tab}`);
      button.addEventListener('click', (e) => {
        const tab = e.target.dataset.tab;
        console.log(`Tab clicked: ${tab}`);
        this.switchTab(tab);
      });
    });
    
    // Action buttons
    const startReviewBtn = this.element.querySelector('#start-review-checklist');
    if (startReviewBtn) {
      startReviewBtn.addEventListener('click', () => {
        this.startReviewChecklist();
      });
    }
    
    const markReviewedBtn = this.element.querySelector('#mark-as-reviewed');
    if (markReviewedBtn) {
      markReviewedBtn.addEventListener('click', () => {
        this.markAsReviewed();
      });
    }
    
    const viewTrackerBtn = this.element.querySelector('#view-external-tracker');
    if (viewTrackerBtn) {
      viewTrackerBtn.addEventListener('click', () => {
        this.viewExternalTracker();
      });
    }
    
    const saveNotesBtn = this.element.querySelector('#save-notes');
    if (saveNotesBtn) {
      saveNotesBtn.addEventListener('click', () => {
        this.saveNotes();
      });
    }
    
    // Template buttons
    const templateButtons = this.element.querySelectorAll('[data-template]');
    templateButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const template = e.target.dataset.template;
        this.insertTemplate(template);
      });
    });
    
    // Todo management buttons
    const addTodoBtn = this.element.querySelector('#add-todo-btn');
    if (addTodoBtn) {
      addTodoBtn.addEventListener('click', () => {
        this.showAddTodoDialog();
      });
    }
    
    const clearCompletedBtn = this.element.querySelector('#clear-completed-btn');
    if (clearCompletedBtn) {
      clearCompletedBtn.addEventListener('click', () => {
        this.clearCompletedTodos();
      });
    }
    
    const exportTodosBtn = this.element.querySelector('#export-todos-btn');
    if (exportTodosBtn) {
      exportTodosBtn.addEventListener('click', () => {
        this.exportTodos();
      });
    }

    const saveTasksRepoBtn = this.element.querySelector('#save-tasks-repo-btn');
    if (saveTasksRepoBtn) {
      saveTasksRepoBtn.addEventListener('click', async () => {
        try {
          const apiModule = await import('../data/ApiService.js');
          const api = apiModule.default;
          const res = await api.triggerSaveTasks(this.app.id, this.app.todos || []);
          const original = saveTasksRepoBtn.innerHTML;
          if (res && res.ok) {
            saveTasksRepoBtn.innerHTML = '✅ Saved to Repo';
          } else {
            saveTasksRepoBtn.innerHTML = '⚠️ Save Failed';
          }
          saveTasksRepoBtn.disabled = true;
          setTimeout(() => {
            saveTasksRepoBtn.innerHTML = original;
            saveTasksRepoBtn.disabled = false;
          }, 2000);
        } catch (err) {
          const original = saveTasksRepoBtn.innerHTML;
          saveTasksRepoBtn.innerHTML = '⚠️ Save Error';
          saveTasksRepoBtn.disabled = true;
          setTimeout(() => {
            saveTasksRepoBtn.innerHTML = original;
            saveTasksRepoBtn.disabled = false;
          }, 2000);
          console.warn('Error dispatching save_tasks workflow:', err);
        }
      });
    }

    
    // Removed Work Management and Improvement listeners as those sections were removed
    
    if (this._boundElementClick) this.element.removeEventListener('click', this._boundElementClick);
    this._boundElementClick = (e) => {
      // Todo action buttons
      if (e.target.matches('[data-action="edit"][data-todo-id]')) {
        const todoId = e.target.dataset.todoId;
        this.editTodo(todoId);
      }
      
      if (e.target.matches('[data-action="delete"][data-todo-id]')) {
        const todoId = e.target.dataset.todoId;
        if (confirm('Delete this task?')) {
          this.deleteTodo(todoId);
        }
      }
      
      // Improvement action buttons
      if (e.target.matches('[data-action="edit-improvement"][data-improvement-id]')) {
        const improvementId = e.target.dataset.improvementId;
        this.editImprovement(improvementId);
      }
      
      if (e.target.matches('[data-action="delete-improvement"][data-improvement-id]')) {
        const improvementId = e.target.dataset.improvementId;
        if (confirm('Delete this improvement?')) {
          this.deleteImprovement(improvementId);
        }
      }
      
      if (e.target.matches('[data-action="convert-to-todo"][data-improvement-id]')) {
        const improvementId = e.target.dataset.improvementId;
        this.convertImprovementToTodo(improvementId);
      }
      // Related task deletion removed with section
    };
    this.element.addEventListener('click', this._boundElementClick);
    
    // Add improvement button
    const addImprovementBtn = this.element.querySelector('#add-improvement-btn');
    if (addImprovementBtn) {
      addImprovementBtn.addEventListener('click', () => {
        this.showAddImprovementDialog();
      });
    }

    this.loadPastReviews();
  }

  /**
   * Switch active tab
   */
  switchTab(tab) {
    console.log(`Switching tab from ${this.activeTab} to ${tab}`);
    this.activeTab = tab;
    
    // Update tab button states - look in entire document since buttons are in HTML template
    const tabButtons = document.querySelectorAll('.tab-btn');
    console.log(`Found ${tabButtons.length} tab buttons to update`);
    tabButtons.forEach(button => {
      const isActive = button.dataset.tab === tab;
      console.log(`Setting button ${button.dataset.tab} to ${isActive ? 'active' : 'inactive'}`);
      button.classList.toggle('active', isActive);
    });
    
    // Update tab content
    const tabContent = this.element; // this.element is already the tab-content div
    console.log('Updating tab content');
    tabContent.innerHTML = this.renderTabContent();
    
    // Re-attach event listeners for new content
    console.log('Re-attaching event listeners for new content');
    this.attachEventListeners();
    
    // Notify parent of tab change
    if (this.onTabChange) {
      console.log('Notifying parent of tab change');
      this.onTabChange(tab);
    }
  }

  /**
   * Start review checklist
   */
  startReviewChecklist() {
    (async () => {
      const mod = await import('./ReviewChecklist.js');
      const reviews = await (await import('../data/ApiService.js')).default.fetchAppReviews(this.app.id);
      let current = null;
      if (Array.isArray(reviews) && reviews.length > 0) {
        const last = reviews[reviews.length - 1];
        if (!last.completedAt) current = last;
      }
      const checklist = new mod.ReviewChecklist(this.app, current, (appId) => {
        if (this.onReviewComplete) this.onReviewComplete(appId);
        this.loadPastReviews();
      });
      checklist.render();
    })();
  }

  async loadPastReviews() {
    try {
      const api = (await import('../data/ApiService.js')).default;
      const arr = await api.fetchAppReviews(this.app.id);
      const el = this.element.querySelector('#past-reviews');
      if (!el) return;
      if (!arr || arr.length === 0) {
        el.textContent = 'No past reviews';
        return;
      }
      const html = arr.map(r => {
        const done = !!r.completedAt;
        const comp = (() => {
          const answers = r.answers || {};
          const vals = Object.values(answers);
          const total = vals.length || 0;
          const finished = vals.filter(v => v && v.status && v.status !== 'Pending').length;
          return total > 0 ? Math.round((finished/total)*100) : 0;
        })();
        return `<div data-review-id="${this.escapeHtml(r.id)}" style="display:flex; justify-content:space-between; align-items:center; border:1px solid #444; padding:.5rem; margin:.25rem 0;">
          <span>ID: ${this.escapeHtml(r.id)} · Started: ${r.startedAt ? new Date(r.startedAt).toLocaleDateString() : '-'}</span>
          <span style="display:flex; align-items:center; gap:.5rem;">
            ${done ? 'Completed' : 'In Progress'} · ${comp}%
            <button class="btn btn-secondary" data-action="open-review" data-review-id="${this.escapeHtml(r.id)}">Open</button>
          </span>
        </div>`;
      }).join('');
      el.innerHTML = html;
      el.addEventListener('click', async (e) => {
        const btn = e.target.closest('[data-action="open-review"][data-review-id]');
        if (!btn) return;
        const id = btn.getAttribute('data-review-id');
        const api2 = (await import('../data/ApiService.js')).default;
        const list = await api2.fetchAppReviews(this.app.id);
        const review = Array.isArray(list) ? list.find(x => x && x.id === id) : null;
        const mod = await import('./ReviewChecklist.js');
        const checklist = new mod.ReviewChecklist(this.app, review, (appId) => {
          if (this.onReviewComplete) this.onReviewComplete(appId);
          this.loadPastReviews();
        });
        checklist.render();
      });
    } catch (_) {}
  }

  /**
   * Mark app as reviewed
   */
  markAsReviewed() {
    console.log('Marking app as reviewed:', this.app.id);
    
    if (confirm(`Mark ${this.app.name} as reviewed?\n\nThis will update the last review date to today and set the next review for 60 days from the last commit.`)) {
      // Call the parent app's markAsReviewed method
      if (this.onReviewComplete) {
        this.onReviewComplete(this.app.id);
      } else {
        console.warn('No onReviewComplete callback provided');
        alert('Review functionality not properly configured. Please refresh the page.');
      }
    }
  }

  /**
   * View external task tracker
   */
  viewExternalTracker() {
    console.log('Opening external task tracker for:', this.app.id);
    alert(`Opening external task tracker for ${this.app.id}\n\nThis would typically open your preferred task management tool (Jira, Trello, GitHub Issues, etc.)`);
  }

  /**
   * Save notes
   */
  saveNotes() {
    const notesTextarea = this.element.querySelector('#developer-notes');
    if (notesTextarea && this.onNotesSave) {
      const notes = notesTextarea.value;
      console.log('Saving developer notes:', notes);
      const updatedApp = { ...this.app, developerNotes: notes };
      this.onNotesSave(updatedApp);
      
      // Show feedback
      const button = this.element.querySelector('#save-notes');
      const originalText = button.innerHTML;
      button.innerHTML = '✅ Saved!';
      button.disabled = true;
      
      setTimeout(() => {
        button.innerHTML = originalText;
        button.disabled = false;
      }, 2000);
    } else {
      console.error('Cannot save notes: textarea or callback not found');
    }
  }

  /**
   * Insert template into notes
   */
  insertTemplate(template) {
    const notesTextarea = this.element.querySelector('#developer-notes');
    if (!notesTextarea) return;
    
    const templates = {
      decision: `## Decision Made\n\n**Date:** ${new Date().toLocaleDateString()}\n\n**Context:** \n[Describe the situation that required a decision]\n\n**Decision:** \n[What was decided]\n\n**Rationale:** \n[Why this decision was made]\n\n**Impact:** \n[Expected consequences and next steps]\n\n---\n\n`,
      
      technical: `## Technical Notes\n\n**Component:** \n[Which part of the system]\n\n**Implementation Details:** \n[Technical details about the implementation]\n\n**Considerations:** \n[Important technical considerations]\n\n**Potential Issues:** \n[Any known limitations or potential problems]\n\n---\n\n`,
      
      todo: `## TODO\n\n- [ ] Task 1\n- [ ] Task 2\n- [ ] Task 3\n\n**Priority:** Medium\n**Estimated Effort:** \n**Dependencies:** \n\n---\n\n`,
      
      bug: `## Bug Report\n\n**Date:** ${new Date().toLocaleDateString()}\n\n**Description:** \n[Describe the bug]\n\n**Steps to Reproduce:** \n1. Step 1\n2. Step 2\n3. Step 3\n\n**Expected Behavior:** \n[What should happen]\n\n**Actual Behavior:** \n[What actually happens]\n\n**Severity:** Medium\n**Status:** Open\n\n---\n\n`
    };
    
    const templateText = templates[template] || '';
    const cursorPos = notesTextarea.selectionStart;
    const textBefore = notesTextarea.value.substring(0, cursorPos);
    const textAfter = notesTextarea.value.substring(cursorPos);
    
    notesTextarea.value = textBefore + templateText + textAfter;
    notesTextarea.focus();
    
    // Set cursor position after template
    const newCursorPos = cursorPos + templateText.length;
    notesTextarea.setSelectionRange(newCursorPos, newCursorPos);
    
    // Trigger input event to update character count
    notesTextarea.dispatchEvent(new Event('input'));
  }

  /**
   * Escape HTML
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  getAppUrl(repoUrl) {
    if (!repoUrl || typeof repoUrl !== 'string') return '';
    const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) return '';
    const owner = match[1];
    const repo = match[2].replace(/\.git$/, '');
    if (repo.toLowerCase() === `${owner.toLowerCase()}.github.io`) return `https://${owner}.github.io/`;
    return `https://${owner}.github.io/${repo}/`;
  }
  /**
   * Update with new app data
   */
  update(app) {
    this.app = app;
    if (this.element) {
      const newElement = this.render();
      this.element.replaceWith(newElement);
      this.element = newElement;
    }
  }

  /**
   * Destroy the component
   */
  destroy() {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }
}