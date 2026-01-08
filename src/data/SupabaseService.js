import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

class SupabaseService {
  constructor() {
    this.client = null
    this.enabled = false

    // Debug logging to help diagnose production issues
    const hasUrl = !!SUPABASE_URL
    const hasKey = !!SUPABASE_ANON_KEY
    const urlIsPlaceholder = SUPABASE_URL?.includes('your_supabase_url') || SUPABASE_URL?.includes('your-project')

    console.log(`Supabase config: URL=${hasUrl ? 'set' : 'missing'}, Key=${hasKey ? 'set' : 'missing'}, Placeholder=${urlIsPlaceholder}`)

    if (hasUrl && hasKey && !urlIsPlaceholder) {
      try {
        this.client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
        this.enabled = true
        console.log('Supabase initialized successfully')
      } catch (error) {
        console.error('Failed to initialize Supabase client:', error)
      }
    } else {
      const reasons = []
      if (!hasUrl) reasons.push('URL missing')
      if (!hasKey) reasons.push('Key missing')
      if (urlIsPlaceholder) reasons.push('URL is placeholder')
      console.log(`Supabase disabled: ${reasons.join(', ')}. Running in local-only mode.`)
    }
  }

  /**
   * Get all portfolio apps with their related data (todos, improvements)
   * Returns null if Supabase is empty (to signal fallback should be used)
   * Returns [] only on actual errors that should stop fallback
   */
  async getPortfolio() {
    if (!this.enabled) return null  // Return null to signal "use fallback"

    try {
      // Fetch apps
      const { data: apps, error: appsError } = await this.client
        .from('apps')
        .select('*')
        .order('name')

      if (appsError) throw appsError

      // Return null if empty to signal "Supabase has no data, use GitHub fallback"
      // This is different from returning [] which would mean "query succeeded but filtered to nothing"
      if (!apps || apps.length === 0) {
        console.log('Supabase: No apps found in database, signaling fallback to GitHub');
        return null;
      }

      console.log(`Supabase: Loaded ${apps.length} apps`)

      // Fetch related data
      const appIds = apps.map(app => app.id)
      console.log('Supabase: App IDs for todos query:', appIds)

      const { data: todos, error: todosError } = await this.client
        .from('todos')
        .select('*')
        .in('app_id', appIds)

      if (todosError) {
        console.error('Error fetching todos:', todosError)
        throw new Error(`Failed to fetch todos: ${todosError.message || todosError}`)
      }

      console.log(`Supabase: Loaded ${todos?.length || 0} total todos`)
      if (todos && todos.length > 0) {
        console.log('Supabase: Sample todo app_ids:', todos.slice(0, 5).map(t => t.app_id))
        // Debug: Log all unique app_ids in todos
        const uniqueAppIds = [...new Set(todos.map(t => t.app_id))];
        console.log('Supabase: Unique app_ids in todos table:', uniqueAppIds);
      }

      // Map data back to apps
      return apps.map(app => {
        const appTodos = (todos || [])
          .filter(t => t.app_id === app.id)
          .map(t => this._mapTodoFromDB(t))

        // Debug: Log todo assignment
        if (appTodos.length > 0) {
          console.log(`Supabase: App "${app.id}" (${app.name}) assigned ${appTodos.length} todos:`,
            appTodos.map(t => ({ id: t.id, title: t.title?.substring(0, 30) })));
        }

        return {
          ...this._mapAppFromDB(app),
          todos: appTodos
        }
      })

    } catch (error) {
      console.error('Supabase getPortfolio error:', error)
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      })
      // Return null to signal fallback instead of throwing
      // This allows the app to continue working even if Supabase has issues
      console.log('Supabase error occurred, signaling fallback to GitHub');
      return null;
    }
  }

  /**
   * Save an app and its nested collections
   * Handles full synchronization of todos and improvements (Add/Update/Delete)
   * Implements compensation pattern for rollback on partial failures
   */
  async saveApp(app) {
    if (!this.enabled) return app

    const appId = app.id
    let originalTodos = null
    let appWasNew = false

    try {
      // 1. Fetch original todos for potential rollback
      const { data: existingTodos, error: fetchError } = await this.client
        .from('todos')
        .select('*')
        .eq('app_id', appId)

      if (fetchError && fetchError.code !== 'PGRST116') {
        // PGRST116 = no rows found, which is fine
        console.warn('Could not fetch original todos for rollback:', fetchError)
      }
      originalTodos = existingTodos || []

      // 2. Check if app exists (for rollback decision)
      const { data: existingApp } = await this.client
        .from('apps')
        .select('id')
        .eq('id', appId)
        .limit(1)

      appWasNew = !existingApp || existingApp.length === 0

      // 3. Upsert App
      const dbApp = this._mapAppToDB(app)
      const { data: savedAppData, error: appError } = await this.client
        .from('apps')
        .upsert(dbApp)
        .select()
        .limit(1)

      if (appError) throw appError

      const savedApp = savedAppData?.[0]
      if (!savedApp) {
        throw new Error('App upsert returned no data')
      }

      // 4. Handle Todos with rollback on failure
      if (app.todos && Array.isArray(app.todos)) {
        try {
          const currentTodoIds = app.todos.filter(t => t.id).map(t => t.id)

          // Delete removed todos
          if (currentTodoIds.length > 0) {
            const { error: deleteError } = await this.client
              .from('todos')
              .delete()
              .eq('app_id', appId)
              .not('id', 'in', `(${currentTodoIds.join(',')})`)

            if (deleteError) throw deleteError
          } else {
            // If no todos in object, delete all for this app
            const { error: deleteAllError } = await this.client
              .from('todos')
              .delete()
              .eq('app_id', appId)

            if (deleteAllError) throw deleteAllError
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
        } catch (todoSyncError) {
          // Rollback: restore original todos
          console.error('Todo sync failed, attempting rollback:', todoSyncError)
          await this._rollbackTodos(appId, originalTodos)
          throw new Error(`Failed to sync todos (rollback attempted): ${todoSyncError.message}`)
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

  /**
   * Rollback todos to their original state
   * @private
   */
  async _rollbackTodos(appId, originalTodos) {
    try {
      // Delete all current todos for this app
      await this.client
        .from('todos')
        .delete()
        .eq('app_id', appId)

      // Restore original todos if any existed
      if (originalTodos && originalTodos.length > 0) {
        await this.client
          .from('todos')
          .insert(originalTodos)
      }
      console.log('Todo rollback successful')
    } catch (rollbackError) {
      console.error('Todo rollback failed:', rollbackError)
      // Don't throw - we're already in error handling
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

    if (feedbackError) {
      console.error('Error fetching feedback:', feedbackError)
      throw new Error(`Failed to fetch feedback: ${feedbackError.message || feedbackError}`)
    }

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
        .limit(1)

    if (error) throw error

    const insertedFeedback = data?.[0]
    if (!insertedFeedback) {
      throw new Error('Failed to insert feedback: no data returned')
    }
    return this._mapFeedbackFromDB(insertedFeedback)
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
      .limit(1)

    if (error) {
      console.warn('Error fetching profile:', error)
      return null
    }

    // Return first result or null if no profile found
    return data?.[0] || null
  }

  // Mappers
  // Convert JS CamelCase to DB snake_case and back

  _mapAppToDB(app) {
    return {
      id: app.id,
      repo_url: app.repoUrl,
      name: app.name || app.id, // Fallback
      platform: app.platform || 'Web',
      status: app.status || 'Active',
      description: app.notes || app.description || '', // 'notes' in JS maps to 'description' in DB
      github_stats: {
        stars: app.stars || 0,
        forks: app.forks || 0,
        issues: app.openIssues || 0,
        lastCommit: app.lastCommitDate,
        latestTag: app.latestTag,
        language: app.language
      },
      last_review_date: app.lastReviewDate,
      next_review_date: app.nextReviewDate,
      archived: app.archived || false,
      developer_notes: app.developerNotes || '',
      improvement_budget: app.improvementBudget || 20,
      current_sprint: app.currentSprint || '',
      // owner_id handled by RLS or default
    }
  }

  _mapAppFromDB(app) {
    return {
      id: app.id,
      repoUrl: app.repo_url,
      name: app.name,
      platform: app.platform || 'Web',
      status: app.status || 'Active',
      notes: app.description || '',
      description: app.description || '',  // Some components use 'description' instead of 'notes'
      stars: app.github_stats?.stars || 0,
      forks: app.github_stats?.forks || 0,
      openIssues: app.github_stats?.issues || 0,
      lastCommitDate: app.github_stats?.lastCommit || null,
      latestTag: app.github_stats?.latestTag || null,
      language: app.github_stats?.language || null,
      lastReviewDate: app.last_review_date,
      nextReviewDate: app.next_review_date,
      isPrivate: false,  // Only public apps are stored in Supabase
      archived: app.archived || false,
      developerNotes: app.developer_notes || '',
      improvementBudget: app.improvement_budget || 20,
      currentSprint: app.current_sprint || '',
      pendingTodos: 0,  // Will be calculated from todos array
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
