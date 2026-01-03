import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

class SupabaseService {
  constructor() {
    this.client = null
    this.enabled = false
    
    if (SUPABASE_URL && SUPABASE_ANON_KEY && !SUPABASE_URL.includes('your_supabase_url')) {
      try {
        this.client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
        this.enabled = true
        console.log('Supabase initialized')
      } catch (error) {
        console.error('Failed to initialize Supabase client:', error)
      }
    } else {
      console.log('Supabase credentials missing or invalid. Running in local-only mode.')
    }
  }

  /**
   * Get all portfolio apps with their related data (todos, improvements)
   */
  async getPortfolio() {
    if (!this.enabled) return []

    try {
      // Fetch apps
      const { data: apps, error: appsError } = await this.client
        .from('apps')
        .select('*')
        .order('name')
      
      if (appsError) throw appsError

      if (!apps || apps.length === 0) return []

      // Fetch related data
      const appIds = apps.map(app => app.id)
      
      const { data: todos, error: todosError } = await this.client
        .from('todos')
        .select('*')
        .in('app_id', appIds)

      if (todosError) console.warn('Error fetching todos:', todosError)

      // Map data back to apps
      return apps.map(app => {
        // Map snake_case DB fields to camelCase JS objects if needed
        // For now, we assume the frontend can handle the data or we map it here
        // The current AppState expects camelCase.
        
        return {
          ...this._mapAppFromDB(app),
          todos: (todos || [])
            .filter(t => t.app_id === app.id)
            .map(t => this._mapTodoFromDB(t))
        }
      })

    } catch (error) {
      console.error('Supabase getPortfolio error:', error)
      throw error
    }
  }

  /**
   * Save an app and its nested collections
   * Handles full synchronization of todos and improvements (Add/Update/Delete)
   */
  async saveApp(app) {
    if (!this.enabled) return app

    try {
      // 1. Upsert App
      const dbApp = this._mapAppToDB(app)
      const { data: savedApp, error: appError } = await this.client
        .from('apps')
        .upsert(dbApp)
        .select()
        .single()

      if (appError) throw appError

      const appId = savedApp.id

      // 2. Handle Todos
      // We perform a "smart sync": 
      // - Upsert all todos currently in the app object
      // - Delete any todos in DB that are NOT in the app object
      
      if (app.todos && Array.isArray(app.todos)) {
        const currentTodoIds = app.todos.filter(t => t.id).map(t => t.id)
        
        // Delete removed todos
        if (currentTodoIds.length > 0) {
            await this.client
            .from('todos')
            .delete()
            .eq('app_id', appId)
            .not('id', 'in', `(${currentTodoIds.join(',')})`)
        } else {
            // If no todos in object, delete all for this app
            await this.client
            .from('todos')
            .delete()
            .eq('app_id', appId)
        }

        // Upsert current todos
        if (app.todos.length > 0) {
          const dbTodos = app.todos.map(t => ({
            ...this._mapTodoToDB(t),
            app_id: appId
          }))
          
          const { error: todoError } = await this.client
            .from('todos')
            .upsert(dbTodos)
          
          if (todoError) throw todoError
        }
      }

      return app // Return original app for state consistency

    } catch (error) {
      if (error.code === '42501') {
        console.warn('Supabase: Write access denied (anonymous user). Skipping save.')
        return app
      }
      console.error('Supabase saveApp error:', error)
      throw error
    }
  }

  async deleteApp(appId) {
    if (!this.enabled) return

    const { error } = await this.client
      .from('apps')
      .delete()
      .eq('id', appId)
    
    if (error) throw error
  }

  // Ideas Methods

  async getIdeas() {
    if (!this.enabled) return []

    const { data: ideas, error: ideasError } = await this.client
      .from('ideas')
      .select('*')
      .order('created_at', { ascending: false })

    if (ideasError) throw ideasError

    if (!ideas || ideas.length === 0) return []

    // Fetch feedback
    const ideaIds = ideas.map(i => i.id)
    const { data: feedback, error: feedbackError } = await this.client
        .from('idea_feedback')
        .select('*')
        .in('idea_id', ideaIds)
        .order('created_at', { ascending: true })

    if (feedbackError) console.warn('Error fetching feedback:', feedbackError)

    return ideas.map(idea => {
        const mappedIdea = this._mapIdeaFromDB(idea)
        mappedIdea.comments = (feedback || [])
            .filter(f => f.idea_id === idea.id)
            .map(this._mapFeedbackFromDB)
        return mappedIdea
    })
  }

  async saveIdea(idea) {
    if (!this.enabled) return idea

    const dbIdea = this._mapIdeaToDB(idea)
    const { error } = await this.client
      .from('ideas')
      .upsert(dbIdea)

    if (error) throw error
    return idea
  }

  async addIdeaFeedback(ideaId, feedback) {
    if (!this.enabled) return null
    
    const dbFeedback = {
        idea_id: ideaId,
        author: feedback.author,
        email: feedback.email,
        text: feedback.text,
        created_at: feedback.createdAt || new Date().toISOString()
    }

    const { data, error } = await this.client
        .from('idea_feedback')
        .insert(dbFeedback)
        .select()
        .single()

    if (error) throw error
    return this._mapFeedbackFromDB(data)
  }

  async deleteIdea(id) {
    if (!this.enabled) return

    const { error } = await this.client
      .from('ideas')
      .delete()
      .eq('id', id)
    
    if (error) throw error
  }

  // Auth Methods

  async signIn(email, password) {
    if (!this.enabled) return { error: { message: 'Supabase not enabled' } }
    
    const { data, error } = await this.client.auth.signInWithPassword({
      email,
      password
    })
    
    if (error) return { error }
    return { data }
  }

  async signOut() {
    if (!this.enabled) return { error: null }
    return await this.client.auth.signOut()
  }

  async getCurrentUser() {
    if (!this.enabled) return null
    const { data: { user } } = await this.client.auth.getUser()
    return user
  }

  async getUserProfile(userId) {
    if (!this.enabled) return null
    
    const { data, error } = await this.client
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
      
    if (error) {
      console.warn('Error fetching profile:', error)
      return null
    }
    return data
  }

  // Mappers
  // Convert JS CamelCase to DB snake_case and back

  _mapAppToDB(app) {
    return {
      id: app.id,
      repo_url: app.repoUrl,
      name: app.name || app.id, // Fallback
      platform: app.platform,
      status: app.status,
      description: app.notes, // 'notes' in JS maps to 'description' in DB
      github_stats: {
        stars: app.stars,
        forks: app.forks,
        issues: app.openIssues,
        lastCommit: app.lastCommitDate
      },
      last_review_date: app.lastReviewDate,
      next_review_date: app.nextReviewDate,
      // owner_id handled by RLS or default
    }
  }

  _mapAppFromDB(app) {
    return {
      id: app.id,
      repoUrl: app.repo_url,
      name: app.name,
      platform: app.platform,
      status: app.status,
      notes: app.description,
      stars: app.github_stats?.stars || 0,
      forks: app.github_stats?.forks || 0,
      openIssues: app.github_stats?.issues || 0,
      lastCommitDate: app.github_stats?.lastCommit || null,
      lastReviewDate: app.last_review_date,
      nextReviewDate: app.next_review_date,
      todos: [], // populated separately
    }
  }

  _mapTodoToDB(todo) {
    return {
      id: todo.id,
      title: todo.title,
      description: todo.description,
      priority: todo.priority || 'medium',
      status: todo.status || 'pending',
      due_date: todo.dueDate,
      effort: todo.effort || null,
      impact: todo.impact || null,
      created_at: todo.createdAt || new Date().toISOString(),
      // New fields for rich todo/improvement support
      source: todo.source || null,
      feedback_summary: todo.feedbackSummary || null,
      submitter_name: todo.submitterName || null,
      submitter_email: todo.submitterEmail || null,
      effort_estimate: todo.effortEstimate || null,
      rejection_reason: todo.rejectionReason || null,
      completion_date: todo.completionDate || null
    }
  }

  _mapTodoFromDB(todo) {
    return {
      id: todo.id,
      title: todo.title,
      description: todo.description,
      priority: todo.priority,
      status: todo.status,
      dueDate: todo.due_date,
      completed: todo.status === 'completed' || todo.status === 'Complete',
      effort: todo.effort,
      impact: todo.impact,
      createdAt: todo.created_at,
      // New fields
      source: todo.source,
      feedbackSummary: todo.feedback_summary,
      submitterName: todo.submitter_name,
      submitterEmail: todo.submitter_email,
      effortEstimate: todo.effort_estimate,
      rejectionReason: todo.rejection_reason,
      completionDate: todo.completion_date
    }
  }

  _mapIdeaFromDB(idea) {
    return {
      id: idea.id,
      conceptName: idea.concept_name,
      problemSolved: idea.problem_solved,
      targetAudience: idea.target_audience,
      techStack: idea.tech_stack,
      riskRating: idea.risk_rating,
      dateCreated: idea.created_at,
      status: idea.status || 'pending',
      submittedBy: idea.user_id ? 'admin' : 'public' // Basic inference
    }
  }

  _mapIdeaToDB(idea) {
    return {
      id: idea.id,
      concept_name: idea.conceptName,
      problem_solved: idea.problemSolved,
      target_audience: idea.targetAudience,
      tech_stack: idea.techStack,
      risk_rating: idea.riskRating,
      status: idea.status || 'pending',
      created_at: idea.dateCreated
    }
  }

  _mapFeedbackFromDB(f) {
    return {
        id: f.id,
        text: f.text,
        author: f.author,
        email: f.email,
        createdAt: f.created_at
    }
  }
}

export const supabaseService = new SupabaseService()
