/**
 * DataStore - Local persistence layer for Sentinel
 * Handles IndexedDB operations for app portfolio and ideas data
 * Uses a lightweight native IndexedDB wrapper (no external idb dependency)
 * Can optionally switch to Supabase backend if configured
 */

import { normalizeAppId } from '../utils/helpers.js';
import { supabaseService } from './SupabaseService.js';

function openNativeDB(name, version, options = {}) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, version);
    req.onupgradeneeded = (event) => {
      try {
        if (options.upgrade) options.upgrade(req.result, event.oldVersion, event.newVersion, req.transaction);
      } catch (e) {
        console.error('Upgrade failed:', e);
        reject(e);
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      const wrapper = {
        get(store, key) {
          return new Promise((res, rej) => {
            const tx = db.transaction(store, 'readonly');
            const r = tx.objectStore(store).get(key);
            r.onsuccess = () => res(r.result);
            r.onerror = () => rej(r.error);
          });
        },
        getAll(store) {
          return new Promise((res, rej) => {
            const tx = db.transaction(store, 'readonly');
            const r = tx.objectStore(store).getAll();
            r.onsuccess = () => res(r.result || []);
            r.onerror = () => rej(r.error);
          });
        },
        put(store, value) {
          return new Promise((res, rej) => {
            const tx = db.transaction(store, 'readwrite');
            const r = tx.objectStore(store).put(value);
            r.onsuccess = () => res(value);
            r.onerror = () => rej(r.error);
          });
        },
        delete(store, key) {
          return new Promise((res, rej) => {
            const tx = db.transaction(store, 'readwrite');
            const r = tx.objectStore(store).delete(key);
            r.onsuccess = () => res(true);
            r.onerror = () => rej(r.error);
          });
        },
        transaction(storeNames, mode) {
          const tx = db.transaction(storeNames, mode);
          return {
            objectStore(name) { return tx.objectStore(name); },
            done: new Promise((res, rej) => {
              tx.oncomplete = () => res(true);
              tx.onerror = () => rej(tx.error);
              tx.onabort = () => rej(tx.error || new Error('Transaction aborted'));
            })
          };
        }
      };
      resolve(wrapper);
    };
    req.onerror = () => reject(req.error);
  });
}

const DB_NAME = 'APM-Portfolio-Manager';
const DB_VERSION = 1;
const PORTFOLIO_STORE = 'portfolio';
const IDEAS_STORE = 'ideas';

class DataStore {
  constructor() {
    this.db = null;
    this.initialized = false;
    this.fallbackStorage = {
      portfolio: new Map(),
      ideas: new Map()
    };
    this.usingFallback = false;
    this.useSupabase = false;
  }

  /**
   * Initialize the database and create object stores
   */
  async init() {
    if (this.initialized) return;

    // Check if Supabase is enabled
    if (supabaseService.enabled) {
      this.useSupabase = true;
      this.initialized = true;
      console.log('DataStore using Supabase backend');
      return;
    }

    try {
      if (typeof indexedDB === 'undefined' || !indexedDB) {
        this.usingFallback = true;
        this.initialized = true;
        console.warn('IndexedDB unavailable, using fallback storage');
        return;
      }

      this.db = await openNativeDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
          // Create portfolio store
          if (!db.objectStoreNames.contains(PORTFOLIO_STORE)) {
            const portfolioStore = db.createObjectStore(PORTFOLIO_STORE, { keyPath: 'id' });
            portfolioStore.createIndex('status', 'status');
            portfolioStore.createIndex('nextReviewDate', 'nextReviewDate');
          }

          // Create ideas store
          if (!db.objectStoreNames.contains(IDEAS_STORE)) {
            const ideasStore = db.createObjectStore(IDEAS_STORE, { keyPath: 'id' });
            ideasStore.createIndex('dateCreated', 'dateCreated');
            ideasStore.createIndex('riskRating', 'riskRating');
          }
        }
      });

      this.initialized = true;
      console.log('DataStore initialized successfully');
    } catch (error) {
      console.warn('Failed to initialize DataStore, using fallback storage:', error);
      this.usingFallback = true;
      this.initialized = true;
    }
  }





  /**
   * Get all portfolio apps
   * Returns null if no data is available (signals fallback should be used)
   */
  async getPortfolio() {
    if (!this.initialized) await this.init();

    if (this.useSupabase) {
      const supabaseData = await supabaseService.getPortfolio();
      // If Supabase returns null, it means "empty database, use fallback"
      // If Supabase returns [], it means "actual empty result after filters"
      if (supabaseData === null) {
        console.log('DataStore: Supabase returned null, signaling GitHub fallback needed');
        return null;
      }
      return supabaseData;
    }

    if (this.usingFallback) {
      const data = Array.from(this.fallbackStorage.portfolio.values());
      return data.length > 0 ? data : null;
    }

    try {
      const data = await this.db.getAll(PORTFOLIO_STORE);
      return data && data.length > 0 ? data : null;
    } catch (error) {
      console.error('Failed to get portfolio:', error);
      throw new Error('Failed to retrieve portfolio data');
    }
  }

  /**
   * Get a single app by ID
   */
  async getApp(id) {
    if (!this.initialized) await this.init();
    
    if (this.useSupabase) {
      // getPortfolio already fetches full objects, but if we need single fetch:
      // For now, rely on getPortfolio being the main entry or implement getApp in SupabaseService
      // Or filter from getPortfolio if not implemented
      const portfolio = await supabaseService.getPortfolio();
      return portfolio.find(app => app.id === id);
    }

    if (this.usingFallback) {
      return this.fallbackStorage.portfolio.get(id);
    }
    
    try {
      return await this.db.get(PORTFOLIO_STORE, id);
    } catch (error) {
      console.error('Failed to get app:', error);
      throw new Error('Failed to retrieve app data');
    }
  }

  /**
   * Save or update an app
   */
  async saveApp(app) {
    if (!this.initialized) await this.init();
    
    if (this.useSupabase) {
      return await supabaseService.saveApp(app);
    }

    if (this.usingFallback) {
      this.fallbackStorage.portfolio.set(app.id, app);
      return app;
    }
    
    try {
      await this.db.put(PORTFOLIO_STORE, app);
      return app;
    } catch (error) {
      console.error('Failed to save app:', error);
      throw new Error('Failed to save app data');
    }
  }

  /**
   * Remove an app by ID
   */
  async removeApp(appId) {
    if (!this.initialized) await this.init();
    
    if (this.useSupabase) {
      await supabaseService.deleteApp(appId);
      return true;
    }

    if (this.usingFallback) {
      this.fallbackStorage.portfolio.delete(appId);
      return true;
    }
    
    try {
      await this.db.delete(PORTFOLIO_STORE, appId);
      return true;
    } catch (error) {
      console.error('Failed to remove app:', error);
      throw new Error('Failed to remove app data');
    }
  }

  /**
   * Delete an app
   */
  async deleteApp(id) {
    if (!this.initialized) await this.init();
    
    if (this.useSupabase) {
      await supabaseService.deleteApp(id);
      return;
    }

    if (this.usingFallback) {
      this.fallbackStorage.portfolio.delete(id);
      return;
    }
    
    try {
      await this.db.delete(PORTFOLIO_STORE, id);
    } catch (error) {
      console.error('Failed to delete app:', error);
      throw new Error('Failed to delete app');
    }
  }

  /**
   * Get all ideas
   */
  async getIdeas() {
    if (!this.initialized) await this.init();
    
    if (this.useSupabase) {
      return await supabaseService.getIdeas();
    }

    if (this.usingFallback) {
      return Array.from(this.fallbackStorage.ideas.values());
    }
    
    try {
      return await this.db.getAll(IDEAS_STORE);
    } catch (error) {
      console.error('Failed to get ideas:', error);
      throw new Error('Failed to retrieve ideas data');
    }
  }

  /**
   * Get a single idea by ID
   */
  async getIdea(id) {
    if (!this.initialized) await this.init();
    
    if (this.useSupabase) {
      const ideas = await supabaseService.getIdeas();
      return ideas.find(i => i.id === id);
    }

    if (this.usingFallback) {
      return this.fallbackStorage.ideas.get(id);
    }
    
    try {
      return await this.db.get(IDEAS_STORE, id);
    } catch (error) {
      console.error('Failed to get idea:', error);
      throw new Error('Failed to retrieve idea data');
    }
  }

  /**
   * Save or update an idea
   */
  async saveIdea(idea) {
    if (!this.initialized) await this.init();
    
    if (this.useSupabase) {
      return await supabaseService.saveIdea(idea);
    }

    if (this.usingFallback) {
      this.fallbackStorage.ideas.set(idea.id, idea);
      return idea;
    }
    
    try {
      await this.db.put(IDEAS_STORE, idea);
      return idea;
    } catch (error) {
      console.error('Failed to save idea:', error);
      throw new Error('Failed to save idea data');
    }
  }

  /**
   * Add feedback to an idea
   */
  async addIdeaFeedback(ideaId, feedback) {
    if (!this.initialized) await this.init();

    if (this.useSupabase) {
        return await supabaseService.addIdeaFeedback(ideaId, feedback);
    }

    // For local storage, we just update the idea object with comments array
    const idea = await this.getIdea(ideaId);
    if (!idea) throw new Error('Idea not found');

    const updatedIdea = {
        ...idea,
        comments: [...(idea.comments || []), feedback]
    };

    await this.saveIdea(updatedIdea);
    return feedback;
  }

  /**
   * Delete an idea
   */
  async deleteIdea(id) {
    if (!this.initialized) await this.init();
    
    if (this.useSupabase) {
      await supabaseService.deleteIdea(id);
      return;
    }

    if (this.usingFallback) {
      this.fallbackStorage.ideas.delete(id);
      return;
    }
    
    try {
      await this.db.delete(IDEAS_STORE, id);
    } catch (error) {
      console.error('Failed to delete idea:', error);
      throw new Error('Failed to delete idea');
    }
  }

  /**
   * Convert idea to app (move from ideas to portfolio)
   */
  async activateIdea(ideaId, repoUrl) {
    if (!this.initialized) await this.init();
    try {
      const idea = await this.getIdea(ideaId);
      if (!idea) {
        throw new Error('Idea not found');
      }

      // Create new app from idea
      const newApp = {
        id: normalizeAppId(idea.conceptName),
        repoUrl: repoUrl,
        platform: this.inferPlatform(idea.techStack),
        status: 'Active',
        lastReviewDate: null,
        nextReviewDate: this.calculateNextReviewDate(),
        pendingTodos: 0,
        notes: `Converted from idea: ${idea.conceptName}. Original problem: ${idea.problemSolved}`,
        lastCommitDate: null,
        latestTag: null
      };

      // Save app and delete idea
      await this.saveApp(newApp);
      
      // If using Supabase, mark as implemented instead of deleting
      if (this.useSupabase) {
          const updatedIdea = {
              ...idea,
              status: 'implemented'
          };
          await this.saveIdea(updatedIdea);
      } else {
          await this.deleteIdea(ideaId);
      }

      return newApp;
    } catch (error) {
      console.error('Failed to activate idea:', error);
      throw new Error('Failed to activate idea');
    }
  }

  /**
   * Infer platform from tech stack
   */
  inferPlatform(techStack) {
    const platformMap = {
      'React Native': 'Cross-platform',
      'Flutter': 'Cross-platform',
      'Web': 'Web',
      'iOS Native': 'iOS',
      'Android Native': 'Android'
    };
    return platformMap[techStack] || 'Unknown';
  }

  /**
   * Calculate next review date (60 days from last commit, or today if no commit)
   */
  calculateNextReviewDate(lastCommitDate = null) {
    const reviewDate = new Date();
    
    if (lastCommitDate) {
      // If we have a last commit date, set review to 60 days after that
      reviewDate.setTime(new Date(lastCommitDate).getTime());
      reviewDate.setDate(reviewDate.getDate() + 60);
    } else {
      // If no commit date, default to 60 days from now
      reviewDate.setDate(reviewDate.getDate() + 60);
    }
    
    return reviewDate.toISOString().split('T')[0];
  }

  /**
   * Clear all data (for testing/debugging)
   */
  async clearAll() {
    if (!this.initialized) await this.init();
    
    if (this.usingFallback) {
      this.fallbackStorage.portfolio.clear();
      this.fallbackStorage.ideas.clear();
      return;
    }
    
    try {
      const tx = this.db.transaction([PORTFOLIO_STORE, IDEAS_STORE], 'readwrite');
      await tx.objectStore(PORTFOLIO_STORE).clear();
      await tx.objectStore(IDEAS_STORE).clear();
      await tx.done;
    } catch (error) {
      console.error('Failed to clear data:', error);
      throw new Error('Failed to clear data');
    }
  }
}

// Create and export singleton instance
const dataStore = new DataStore();
export default dataStore;