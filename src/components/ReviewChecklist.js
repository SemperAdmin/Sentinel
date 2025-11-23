import apiService from '../data/ApiService.js'
import { formatDate } from '../utils/helpers.js'
import { unwrapOr } from '../utils/result.js'

export class ReviewChecklist {
  constructor(app, initialReview, onComplete) {
    this.app = app
    this.review = initialReview || { id: `rev-${Date.now()}`, startedAt: new Date().toISOString(), completedAt: null, answers: {} }
    this.onComplete = onComplete
    this.element = null
    this.statusOptions = ['Pending','Pass','Fail','N/A']
    this.checklist = [
      {
        phase: 'Phase 1: Code and Architecture Review',
        subtitle: 'Internal quality, maintainability, and structure.',
        sections: [
          { title: 'A. Code Quality & Standards', items: [
            { id: '1A1', description: 'Style Consistency: Is the code compliant with established style guides?' },
            { id: '1A2', description: 'Readability: Is complex logic documented sufficiently?' },
            { id: '1A3', description: 'Naming Conventions: Are names meaningful and consistent?' },
            { id: '1A4', description: 'Error Handling: Are critical functions properly guarded?' },
            { id: '1A5', description: 'Unused/Dead Code: Any redundant files or imports?' }
          ]},
          { title: 'B. Architectural Review', items: [
            { id: '1B1', description: 'Separation of Concerns: Logic divided into distinct layers?' },
            { id: '1B2', description: 'Component Design: Small, reusable, single-purpose components?' },
            { id: '1B3', description: 'Data Modeling: Schemas normalized and indexed appropriately?' },
            { id: '1B4', description: 'API Design: Consistent endpoints and status codes?' },
            { id: '1B5', description: 'State Management: Efficient and appropriate approach?' }
          ]}
        ]
      },
      {
        phase: 'Phase 2: Infrastructure and Deployment Review',
        subtitle: 'Reliability, scalability, and ease of deployment/monitoring.',
        sections: [
          { title: 'A. Performance & Optimization', items: [
            { id: '2A1', description: 'Frontend Loading: Assets optimized and loaded efficiently?' },
            { id: '2A2', description: 'Network Overhead: Payloads small; no unnecessary transfer?' },
            { id: '2A3', description: 'Database Efficiency: Queries fast; no full scans?' },
            { id: '2A4', description: 'Caching Strategy: Appropriate caching layers in place?' }
          ]},
          { title: 'B. Deployment & Monitoring', items: [
            { id: '2B1', description: 'CI/CD Pipeline: Automated build/test/deploy available?' },
            { id: '2B2', description: 'Rollback Strategy: Documented and tested rollback?' },
            { id: '2B3', description: 'Logging: Errors and critical ops logged correctly?' },
            { id: '2B4', description: 'Monitoring & Alerting: Metrics collected; alerts configured?' }
          ]}
        ]
      },
      {
        phase: 'Phase 3: Quality Assurance and Security Review',
        subtitle: 'Correctness, stability, and integrity of the application.',
        sections: [
          { title: 'A. Testing', items: [
            { id: '3A1', description: 'Unit Tests: Critical logic covered?' },
            { id: '3A2', description: 'Integration Tests: Key interactions tested?' },
            { id: '3A3', description: 'UAT: Tested against acceptance criteria?' },
            { id: '3A4', description: 'Responsive Design: Functions correctly on various screens?' }
          ]},
          { title: 'B. Security', items: [
            { id: '3B1', description: 'Input Validation: Sanitized client and server?' },
            { id: '3B2', description: 'AuthZ/AuthN: Permissions enforced server-side?' },
            { id: '3B3', description: 'Data Security: HTTPS; encryption at rest where applicable?' },
            { id: '3B4', description: 'Dependencies: Up-to-date; vulnerabilities scanned?' },
            { id: '3B5', description: 'Secret Management: No secrets in code; env used?' }
          ]}
        ]
      }
    ]
  }

  render() {
    const existing = document.querySelector('.todo-dialog')
    if (existing) existing.remove()
    const dialog = document.createElement('div')
    dialog.className = 'todo-dialog'
    dialog.innerHTML = `
      <div class="dialog-overlay">
        <div class="dialog-content">
          <h3>Review Checklist — ${this.escape(this.app.id)}</h3>
          <div id="review-body"></div>
          <div class="dialog-actions" style="margin-top: 1rem;">
            <button class="btn btn-secondary" id="cancel-review">Cancel</button>
            <button class="btn btn-secondary" id="save-progress">Save Progress</button>
            <button class="btn btn-primary" id="complete-review">Complete Review</button>
          </div>
        </div>
      </div>`
    document.body.appendChild(dialog)
    this.element = dialog
    this.renderChecklist()
    this.attachEvents()
  }

  renderChecklist() {
    const container = this.element.querySelector('#review-body')
    const html = this.checklist.map((phase, pi) => {
      const sections = phase.sections.map((section, si) => {
        const items = section.items.map(item => {
          const ans = this.review.answers[item.id] || { status: 'Pending', notes: '' }
          const options = this.statusOptions.map(s => `<option ${ans.status===s?'selected':''}>${s}</option>`).join('')
          return `
            <div style="display:flex; align-items:center; gap:.5rem; padding:.5rem 0; border-bottom:1px solid #444;">
              <div style="flex:1;">${this.escape(item.description)}</div>
              <div style="width:160px;">
                <select data-item="${item.id}" class="review-status">${options}</select>
              </div>
              <div style="flex:1;">
                <input type="text" data-item="${item.id}" class="review-notes" value="${this.escape(ans.notes)}" placeholder="Notes..." />
              </div>
            </div>`
        }).join('')
        return `
          <div style="border:1px solid #444; margin:.75rem 0;">
            <div style="padding:.5rem; border-bottom:1px solid #444; font-weight:600;">${this.escape(section.title)}</div>
            <div style="padding:.5rem;">${items}</div>
          </div>`
      }).join('')
      return `
        <div style="margin-bottom:1rem;">
          <div style="background:#1c1c1c; color:#e0e0e0; padding:.5rem;">
            <div style="font-weight:700;">${this.escape(phase.phase)}</div>
            <div style="font-size:.85rem; color:#aaa;">${this.escape(phase.subtitle)}</div>
          </div>
          <div style="padding:.5rem;">${sections}</div>
        </div>`
    }).join('')
    container.innerHTML = html
  }

  attachEvents() {
    this.element.querySelectorAll('.review-status').forEach(sel => {
      sel.addEventListener('change', e => {
        const id = e.target.dataset.item
        const prev = this.review.answers[id] || { status: 'Pending', notes: '' }
        this.review.answers[id] = { ...prev, status: e.target.value }
        this.updateSummary()
      })
    })
    this.element.querySelectorAll('.review-notes').forEach(inp => {
      inp.addEventListener('input', e => {
        const id = e.target.dataset.item
        const prev = this.review.answers[id] || { status: 'Pending', notes: '' }
        this.review.answers[id] = { ...prev, notes: e.target.value }
      })
    })
    this.element.querySelector('#cancel-review').addEventListener('click', () => {
      document.body.removeChild(this.element)
    })
    this.element.querySelector('#save-progress').addEventListener('click', async () => {
      await this.save(false)
      const btn = this.element.querySelector('#save-progress')
      const original = btn.innerHTML
      btn.innerHTML = '✅ Saved'
      btn.disabled = true
      setTimeout(() => { btn.innerHTML = original; btn.disabled = false }, 1500)
    })
    this.element.querySelector('#complete-review').addEventListener('click', async () => {
      await this.save(true)
      document.body.removeChild(this.element)
      if (this.onComplete) this.onComplete(this.app.id)
    })
  }

  async save(complete) {
    if (complete) this.review.completedAt = new Date().toISOString()
    const allResult = await apiService.fetchAppReviews(this.app.id)
    const all = unwrapOr(allResult, [])
    const idx = all.findIndex(r => r.id === this.review.id)
    const next = [...all]
    if (idx >= 0) next[idx] = this.review
    else next.push(this.review)
    await apiService.saveAppReviews(this.app.id, next)
  }

  updateSummary() {
    const vals = Object.values(this.review.answers)
    const totals = { total: this.countItems(), pass: 0, fail: 0, na: 0, pending: 0 }
    vals.forEach(v => {
      if (v.status === 'Pass') totals.pass++
      else if (v.status === 'Fail') totals.fail++
      else if (v.status === 'N/A') totals.na++
      else totals.pending++
    })
    const comp = totals.total > 0 ? (((totals.pass + totals.fail + totals.na) / totals.total) * 100).toFixed(1) : '0.0'
    const el = this.element.querySelector('#review-summary')
    if (!el) return
    el.textContent = `Items: ${totals.total} · Completed: ${comp}% · Pass: ${totals.pass} · Fail: ${totals.fail} · Pending: ${totals.pending}`
  }

  countItems() {
    let c = 0
    this.checklist.forEach(p => p.sections.forEach(s => c += s.items.length))
    return c
  }

  escape(s) {
    const d = document.createElement('div')
    d.textContent = String(s || '')
    return d.innerHTML
  }
}