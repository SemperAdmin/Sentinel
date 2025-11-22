/**
 * DataStore - Local persistence layer for Sentinel
 * Handles IndexedDB operations for app portfolio and ideas data
 */

import { openDB } from 'idb';

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
  }

  /**
   * Initialize the database and create object stores
   */
  async init() {
    if (this.initialized) return;

    try {
      this.db = await openDB(DB_NAME, DB_VERSION, {
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
      console.error('Failed to initialize DataStore:', error);
      console.log('Falling back to in-memory storage');
      this.usingFallback = true;
      this.initialized = true;
    }
  }





  /**
   * Get all portfolio apps
   */
  async getPortfolio() {
    if (!this.initialized) await this.init();
    
    if (this.usingFallback) {
      return Array.from(this.fallbackStorage.portfolio.values());
    }
    
    try {
      return await this.db.getAll(PORTFOLIO_STORE);
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
   * Delete an idea
   */
  async deleteIdea(id) {
    if (!this.initialized) await this.init();
    
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
        id: idea.conceptName.toLowerCase().replace(/\s+/g, '-'),
        repoUrl: repoUrl,
        platform: this.inferPlatform(idea.techStack),
        status: 'Active',
        lastReviewDate: new Date().toISOString().split('T')[0],
        nextReviewDate: this.calculateNextReviewDate(),
        pendingTodos: 0,
        notes: `Converted from idea: ${idea.conceptName}. Original problem: ${idea.problemSolved}`,
        lastCommitDate: null,
        latestTag: null
      };

      // Save app and delete idea
      await this.saveApp(newApp);
      await this.deleteIdea(ideaId);

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