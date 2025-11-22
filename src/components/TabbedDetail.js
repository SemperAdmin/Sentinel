/**
 * TabbedDetail Component - Tabbed interface for app detail view
 */

import { formatDate, calculateHealth, getHealthColor, getLatestReviewDate } from '../utils/helpers.js';

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
    
    return `
      <div id="overview-tab" class="tab-pane active">
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
          <h3>Repository Information</h3>
          <div class="status-grid">
            <div class="status-item">
              <label>Repository:</label>
              <span>${this.escapeHtml(this.app.repoUrl || 'Not linked')}</span>
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
      </div>
    `;
  }

  /**
   * Render todo tab with full todo management
   */
  renderTodoTab() {
    const todos = this.app.todos || [];
    const completedTodos = todos.filter(todo => todo.completed);
    const activeTodos = todos.filter(todo => !todo.completed);
    const budgetUsed = Math.min((completedTodos.length / Math.max(todos.length, 1)) * 100, 100);
    
    return `
      <div id="todo-tab" class="tab-pane">
        <div class="detail-section">
          <h3>To-Do Management</h3>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <span>Total Tasks: ${todos.length} (${activeTodos.length} active, ${completedTodos.length} completed)</span>
            <button class="btn btn-primary" id="add-todo-btn">+ Add New Task</button>
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
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render individual todo item
   */
  renderTodoItem(todo) {
    const priorityClass = todo.priority ? `priority-${todo.priority.toLowerCase()}` : '';
    const dueDateClass = todo.dueDate && new Date(todo.dueDate) < new Date() ? 'overdue' : '';
    
    return `
      <div class="todo-item ${todo.completed ? 'completed' : ''} ${dueDateClass}" data-todo-id="${todo.id}">
        <div class="todo-checkbox">
          <input type="checkbox" ${todo.completed ? 'checked' : ''} data-todo-id="${todo.id}">
        </div>
        <div class="todo-content">
          <div class="todo-title">${this.escapeHtml(todo.title)}</div>
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
  addTodo(title, description = '', priority = 'medium', dueDate = null) {
    const todo = {
      id: Date.now().toString(),
      title,
      description,
      priority,
      dueDate,
      completed: false,
      createdAt: new Date().toISOString()
    };
    
    if (!this.app.todos) this.app.todos = [];
    this.app.todos.push(todo);
    
    // Update the app and trigger re-render
    if (this.onNotesSave) {
      this.onNotesSave(this.app);
    }
    
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
      
      this.activeTab = 'todo';
      this.render();
    }
  }

  /**
   * Edit todo item (placeholder for future implementation)
   */
  editTodo(todoId) {
    console.log('Edit todo clicked:', todoId);
    alert('Edit functionality coming soon! For now, you can delete and re-add the task.');
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
    
    this.activeTab = 'todo';
    this.render();
  }

  /**
   * Show add todo dialog
   */
  showAddTodoDialog() {
    console.log('Opening add todo dialog...');
    const dialog = document.createElement('div');
    dialog.className = 'todo-dialog';
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
              <label>Priority</label>
              <select id="todo-priority">
                <option value="low">Low</option>
                <option value="medium" selected>Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div class="form-group">
              <label>Due Date</label>
              <input type="date" id="todo-due-date">
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
      const priority = dialog.querySelector('#todo-priority').value;
      const dueDate = dialog.querySelector('#todo-due-date').value;
      
      console.log('Adding todo:', { title, description, priority, dueDate });
      this.addTodo(title, description, priority, dueDate);
      document.body.removeChild(dialog);
    });
    
    // Handle cancel
    dialog.querySelector('#cancel-todo').addEventListener('click', () => {
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
      <div id="notes-tab" class="tab-pane">
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
    
    // Todo checkbox and action listeners (using event delegation)
    this.element.addEventListener('click', (e) => {
      // Todo checkbox
      if (e.target.matches('input[type="checkbox"][data-todo-id]')) {
        const todoId = e.target.dataset.todoId;
        this.toggleTodo(todoId);
      }
      
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
    });
    
    // Add improvement button
    const addImprovementBtn = this.element.querySelector('#add-improvement-btn');
    if (addImprovementBtn) {
      addImprovementBtn.addEventListener('click', () => {
        this.showAddImprovementDialog();
      });
    }
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
    console.log('Starting review checklist for:', this.app.id);
    alert(`Review checklist started for ${this.app.id}\n\nThis would typically open a detailed checklist with items like:\n- Code quality review\n- Security audit\n- Performance analysis\n- Dependency updates\n- Documentation review`);
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