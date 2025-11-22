/**
 * TabbedDetail Component - Tabbed interface for app detail view
 */

import { formatDate, calculateHealth, getHealthColor } from '../utils/helpers.js';

export class TabbedDetail {
  constructor(app, onNotesSave, onTabChange) {
    this.app = app;
    this.onNotesSave = onNotesSave;
    this.onTabChange = onTabChange;
    this.element = null;
    this.activeTab = 'overview';
  }

  /**
   * Render the tabbed detail component
   */
  render() {
    const container = document.createElement('div');
    container.className = 'tabbed-detail';
    
    container.innerHTML = `
      <!-- Tab Navigation -->
      <div class="tab-nav">
        <button class="tab-btn ${this.activeTab === 'overview' ? 'active' : ''}" data-tab="overview">
          Overview & System Checks
        </button>
        <button class="tab-btn ${this.activeTab === 'todo' ? 'active' : ''}" data-tab="todo">
          To-Do & Improvements
        </button>
        <button class="tab-btn ${this.activeTab === 'notes' ? 'active' : ''}" data-tab="notes">
          Developer Notes
        </button>
      </div>
      
      <!-- Tab Content -->
      <div class="tab-content">
        ${this.renderTabContent()}
      </div>
    `;
    
    this.element = container;
    this.attachEventListeners();
    
    return container;
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
              <label>Next Due:</label>
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
              <label>Last Commit:</label>
              <span>${formatDate(this.app.lastCommitDate, { relative: true }) || 'Unknown'}</span>
            </div>
            <div class="status-item">
              <label>Latest Version:</label>
              <span>${this.escapeHtml(this.app.latestTag || 'None')}</span>
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
   * Render todo tab
   */
  renderTodoTab() {
    const budgetUsed = Math.min(((this.app.pendingTodos || 0) / 4) * 100, 100); // Simulate 20% budget = 4 tasks
    
    return `
      <div id="todo-tab" class="tab-pane">
        <div class="detail-section">
          <h3>Improvement Budget Tracker</h3>
          <div class="budget-info">
            <div class="budget-bar">
              <div class="budget-fill" style="width: ${budgetUsed}%"></div>
            </div>
            <span id="budget-text">${Math.round(budgetUsed)}% of 20% budget used</span>
          </div>
          <p style="color: #6c757d; font-size: 0.875rem; margin-top: 0.5rem;">
            This sprint's allocation for technical debt and maintenance improvements
          </p>
        </div>
        
        <div class="detail-section">
          <h3>Open Tasks</h3>
          <div id="task-list" class="task-list">
            ${this.renderTaskList()}
          </div>
          <button class="btn btn-secondary" id="view-external-tracker" style="margin-top: 1rem;">
            🔗 View External Task Tracker
          </button>
        </div>
        
        <div class="detail-section">
          <h3>Quick Actions</h3>
          <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
            <button class="btn btn-secondary">Add New Task</button>
            <button class="btn btn-secondary">Mark All Complete</button>
            <button class="btn btn-secondary">Export Tasks</button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render task list (simulated)
   */
  renderTaskList() {
    const tasks = this.generateSimulatedTasks();
    
    if (tasks.length === 0) {
      return '<p style="color: #6c757d; text-align: center; padding: 2rem;">No tasks found</p>';
    }
    
    return tasks.map(task => `
      <div class="task-item">
        <div>
          <span class="task-priority priority-${task.priority.toLowerCase()}">${task.priority}</span>
          <strong>${this.escapeHtml(task.title)}</strong>
        </div>
        <div>
          <span class="task-tag">${this.escapeHtml(task.tag)}</span>
        </div>
      </div>
    `).join('');
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
   * Render notes tab
   */
  renderNotesTab() {
    return `
      <div id="notes-tab" class="tab-pane">
        <div class="detail-section">
          <h3>Developer Notes</h3>
          <textarea 
            id="developer-notes" 
            class="notes-textarea" 
            placeholder="Add your development notes here... Use this space to document decisions, technical considerations, and future plans.">${this.escapeHtml(this.app.notes || '')}</textarea>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1rem;">
            <span style="color: #6c757d; font-size: 0.875rem;">
              ${this.app.notes ? this.app.notes.length : 0} characters
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
   * Attach event listeners
   */
  attachEventListeners() {
    if (!this.element) return;
    
    // Tab navigation
    const tabButtons = this.element.querySelectorAll('.tab-btn');
    tabButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const tab = e.target.dataset.tab;
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
  }

  /**
   * Switch active tab
   */
  switchTab(tab) {
    this.activeTab = tab;
    
    // Update tab button states
    const tabButtons = this.element.querySelectorAll('.tab-btn');
    tabButtons.forEach(button => {
      button.classList.toggle('active', button.dataset.tab === tab);
    });
    
    // Update tab content
    const tabContent = this.element.querySelector('.tab-content');
    tabContent.innerHTML = this.renderTabContent();
    
    // Re-attach event listeners for new content
    this.attachEventListeners();
    
    // Notify parent of tab change
    if (this.onTabChange) {
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
      this.onNotesSave(notes);
      
      // Show feedback
      const button = this.element.querySelector('#save-notes');
      const originalText = button.innerHTML;
      button.innerHTML = '✅ Saved!';
      button.disabled = true;
      
      setTimeout(() => {
        button.innerHTML = originalText;
        button.disabled = false;
      }, 2000);
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