/**
 * IdeaForm Component - Form for creating and editing app ideas
 */

import { generateId, slugify } from '../utils/helpers.js';

export class IdeaForm {
  constructor(onSave, onCancel, editingIdea = null) {
    this.onSave = onSave;
    this.onCancel = onCancel;
    this.editingIdea = editingIdea;
    this.element = null;
    this.formData = {};
  }

  /**
   * Render the form
   */
  render() {
    const container = document.createElement('div');
    container.className = 'idea-form-container';
    
    container.innerHTML = `
      <h3>${this.editingIdea ? 'Edit Idea' : 'Document New Concept'}</h3>
      <form id="idea-form" class="idea-form">
        <div class="form-group">
          <label for="concept-name">Concept Name *</label>
          <input 
            type="text" 
            id="concept-name" 
            name="conceptName"
            value="${this.escapeHtml(this.editingIdea?.conceptName || '')}"
            required 
            placeholder="Enter a descriptive name for your concept"
          >
        </div>
        
        <div class="form-group">
          <label for="problem-solved">Problem Solved *</label>
          <textarea 
            id="problem-solved" 
            name="problemSolved"
            required 
            placeholder="What value proposition does this idea offer? Describe the problem you're solving..."
            rows="3"
          >${this.escapeHtml(this.editingIdea?.problemSolved || '')}</textarea>
        </div>
        
        <div class="form-group">
          <label for="target-audience">Target Audience *</label>
          <input 
            type="text" 
            id="target-audience" 
            name="targetAudience"
            value="${this.escapeHtml(this.editingIdea?.targetAudience || '')}"
            required 
            placeholder="Who will use this app? (e.g., busy professionals, students, parents)"
          >
        </div>
        
        <div class="form-group">
          <label for="initial-features">Initial Feature Set (MVP) *</label>
          <textarea 
            id="initial-features" 
            name="initialFeatures"
            required 
            placeholder="Define the scope for the minimum viable product. What are the core features needed for launch?"
            rows="4"
          >${this.escapeHtml(this.editingIdea?.initialFeatures || '')}</textarea>
        </div>
        
        <div class="form-group">
          <label for="tech-stack">Technology Stack (Proposed) *</label>
          <select id="tech-stack" name="techStack" required>
            <option value="">Select Technology</option>
            <option value="React Native" ${this.editingIdea?.techStack === 'React Native' ? 'selected' : ''}>
              React Native
            </option>
            <option value="Flutter" ${this.editingIdea?.techStack === 'Flutter' ? 'selected' : ''}>
              Flutter
            </option>
            <option value="Web" ${this.editingIdea?.techStack === 'Web' ? 'selected' : ''}>
              Web (React/Vue/Angular)
            </option>
            <option value="iOS Native" ${this.editingIdea?.techStack === 'iOS Native' ? 'selected' : ''}>
              iOS Native (Swift)
            </option>
            <option value="Android Native" ${this.editingIdea?.techStack === 'Android Native' ? 'selected' : ''}>
              Android Native (Kotlin/Java)
            </option>
          </select>
        </div>
        
        <div class="form-group">
          <label for="risk-rating">Risk/Complexity Rating *</label>
          <select id="risk-rating" name="riskRating" required>
            <option value="">Select Rating</option>
            <option value="Low" ${this.editingIdea?.riskRating === 'Low' ? 'selected' : ''}>
              Low - Straightforward implementation
            </option>
            <option value="Medium" ${this.editingIdea?.riskRating === 'Medium' ? 'selected' : ''}>
              Medium - Some technical challenges
            </option>
            <option value="High" ${this.editingIdea?.riskRating === 'High' ? 'selected' : ''}>
              High - Complex or risky implementation
            </option>
          </select>
        </div>
        
        <div class="form-actions">
          <button type="button" class="btn btn-secondary" id="cancel-idea">
            Cancel
          </button>
          <button type="submit" class="btn btn-primary">
            ${this.editingIdea ? 'Update Idea' : 'Save Idea'}
          </button>
        </div>
      </form>
    `;
    
    this.element = container;
    this.attachEventListeners();
    
    return container;
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    if (!this.element) return;
    
    // Form submission
    const form = this.element.querySelector('#idea-form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSubmit();
    });
    
    // Cancel button
    const cancelBtn = this.element.querySelector('#cancel-idea');
    cancelBtn.addEventListener('click', () => {
      this.handleCancel();
    });
    
    // Auto-save functionality
    const inputs = this.element.querySelectorAll('input, textarea, select');
    inputs.forEach(input => {
      input.addEventListener('input', () => {
        this.validateField(input);
      });
      
      input.addEventListener('blur', () => {
        this.validateField(input);
      });
    });
    
    // Character counters for textareas
    const textareas = this.element.querySelectorAll('textarea');
    textareas.forEach(textarea => {
      this.addCharacterCounter(textarea);
    });
  }

  /**
   * Handle form submission
   */
  handleSubmit() {
    const formData = this.collectFormData();
    
    if (!this.validateForm(formData)) {
      return;
    }
    
    // Create or update idea object
    const idea = this.editingIdea 
      ? { ...this.editingIdea, ...formData }
      : {
          ...formData,
          id: generateId('idea'),
          dateCreated: new Date().toISOString()
        };
    
    if (this.onSave) {
      this.onSave(idea);
    }
  }

  /**
   * Handle form cancellation
   */
  handleCancel() {
    if (this.onCancel) {
      this.onCancel();
    }
  }

  /**
   * Collect form data
   */
  collectFormData() {
    const form = this.element.querySelector('#idea-form');
    const formData = new FormData(form);
    
    return {
      conceptName: formData.get('conceptName').trim(),
      problemSolved: formData.get('problemSolved').trim(),
      targetAudience: formData.get('targetAudience').trim(),
      initialFeatures: formData.get('initialFeatures').trim(),
      techStack: formData.get('techStack'),
      riskRating: formData.get('riskRating')
    };
  }

  /**
   * Validate form data
   */
  validateForm(formData) {
    const errors = [];
    
    // Required field validation
    Object.keys(formData).forEach(key => {
      if (!formData[key]) {
        errors.push(`${this.getFieldLabel(key)} is required`);
      }
    });
    
    // Length validation
    if (formData.conceptName && formData.conceptName.length < 3) {
      errors.push('Concept name must be at least 3 characters');
    }
    
    if (formData.conceptName && formData.conceptName.length > 100) {
      errors.push('Concept name must not exceed 100 characters');
    }
    
    if (formData.problemSolved && formData.problemSolved.length < 10) {
      errors.push('Problem description must be at least 10 characters');
    }
    
    if (formData.initialFeatures && formData.initialFeatures.length < 10) {
      errors.push('Feature description must be at least 10 characters');
    }
    
    // Display errors if any
    if (errors.length > 0) {
      this.displayErrors(errors);
      return false;
    }
    
    return true;
  }

  /**
   * Validate individual field
   */
  validateField(field) {
    const value = field.value.trim();
    const fieldName = field.name;
    const errorElement = field.parentNode.querySelector('.field-error');
    
    // Remove previous error
    if (errorElement) {
      errorElement.remove();
    }
    
    field.classList.remove('field-invalid');
    
    // Validation rules
    let error = null;
    
    if (!value && field.hasAttribute('required')) {
      error = `${this.getFieldLabel(fieldName)} is required`;
    } else if (fieldName === 'conceptName') {
      if (value.length < 3) error = 'Must be at least 3 characters';
      if (value.length > 100) error = 'Must not exceed 100 characters';
    } else if (fieldName === 'problemSolved' || fieldName === 'initialFeatures') {
      if (value.length < 10) error = 'Must be at least 10 characters';
    }
    
    // Display error if any
    if (error) {
      field.classList.add('field-invalid');
      const errorDiv = document.createElement('div');
      errorDiv.className = 'field-error';
      errorDiv.style.color = '#dc3545';
      errorDiv.style.fontSize = '0.875rem';
      errorDiv.style.marginTop = '0.25rem';
      errorDiv.textContent = error;
      field.parentNode.appendChild(errorDiv);
      
      return false;
    }
    
    return true;
  }

  /**
   * Display form errors
   */
  displayErrors(errors) {
    // Remove previous error summary
    const existingSummary = this.element.querySelector('.error-summary');
    if (existingSummary) {
      existingSummary.remove();
    }
    
    const errorSummary = document.createElement('div');
    errorSummary.className = 'error-summary';
    errorSummary.style.backgroundColor = '#f8d7da';
    errorSummary.style.border = '1px solid #f5c6cb';
    errorSummary.style.color = '#721c24';
    errorSummary.style.padding = '1rem';
    errorSummary.style.borderRadius = '4px';
    errorSummary.style.marginBottom = '1rem';
    
    errorSummary.innerHTML = `
      <strong>Please fix the following errors:</strong>
      <ul style="margin-top: 0.5rem; margin-bottom: 0;">
        ${errors.map(error => `<li>${this.escapeHtml(error)}</li>`).join('')}
      </ul>
    `;
    
    const form = this.element.querySelector('#idea-form');
    form.insertBefore(errorSummary, form.firstChild);
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      if (errorSummary.parentNode) {
        errorSummary.remove();
      }
    }, 5000);
  }

  /**
   * Add character counter to textarea
   */
  addCharacterCounter(textarea) {
    const counter = document.createElement('div');
    counter.className = 'character-counter';
    counter.style.textAlign = 'right';
    counter.style.fontSize = '0.875rem';
    counter.style.color = '#6c757d';
    counter.style.marginTop = '0.25rem';
    
    const updateCounter = () => {
      const length = textarea.value.length;
      counter.textContent = `${length} characters`;
      
      // Warn if too long
      if (length > 500) {
        counter.style.color = '#dc3545';
      } else if (length > 300) {
        counter.style.color = '#ffc107';
      } else {
        counter.style.color = '#6c757d';
      }
    };
    
    textarea.addEventListener('input', updateCounter);
    updateCounter(); // Initial update
    
    textarea.parentNode.appendChild(counter);
  }

  /**
   * Get field label
   */
  getFieldLabel(fieldName) {
    const labels = {
      conceptName: 'Concept Name',
      problemSolved: 'Problem Solved',
      targetAudience: 'Target Audience',
      initialFeatures: 'Initial Features',
      techStack: 'Technology Stack',
      riskRating: 'Risk Rating'
    };
    
    return labels[fieldName] || fieldName;
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
   * Get form data
   */
  getFormData() {
    return this.collectFormData();
  }

  /**
   * Set form data
   */
  setFormData(data) {
    Object.keys(data).forEach(key => {
      const field = this.element.querySelector(`[name="${key}"]`);
      if (field) {
        field.value = data[key];
        this.validateField(field);
      }
    });
  }

  /**
   * Validate entire form
   */
  validate() {
    const formData = this.collectFormData();
    return this.validateForm(formData);
  }

  /**
   * Reset form
   */
  reset() {
    const form = this.element.querySelector('#idea-form');
    form.reset();
    
    // Clear errors
    const errors = this.element.querySelectorAll('.field-error, .error-summary');
    errors.forEach(error => error.remove());
    
    const invalidFields = this.element.querySelectorAll('.field-invalid');
    invalidFields.forEach(field => field.classList.remove('field-invalid'));
  }

  /**
   * Destroy the form
   */
  destroy() {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }
}