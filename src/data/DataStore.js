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

      // Initialize with sample data if empty
      await this.initializeSampleData();
      this.initialized = true;
      console.log('DataStore initialized successfully');
    } catch (error) {
      console.error('Failed to initialize DataStore:', error);
      throw new Error('Database initialization failed');
    }
  }

  /**
   * Initialize sample data if database is empty
   */
  async initializeSampleData() {
    try {
      const portfolioCount = await this.db.count(PORTFOLIO_STORE);
      const ideasCount = await this.db.count(IDEAS_STORE);

      if (portfolioCount === 0) {
        const sampleApps = [
          {
            id: 'workout-tracker',
            repoUrl: 'https://api.github.com/repos/user/workout-tracker',
            platform: 'iOS',
            status: 'Active',
            lastReviewDate: '2025-09-01',
            nextReviewDate: '2025-12-01',
            pendingTodos: 3,
            notes: 'Decided to use SwiftUI for all views. Need to refactor the workout history screen.',
            lastCommitDate: null,
            latestTag: null
          },
          {
            id: 'expense-manager',
            repoUrl: 'https://api.github.com/repos/user/expense-manager',
            platform: 'Web',
            status: 'Active',
            lastReviewDate: '2025-08-15',
            nextReviewDate: '2025-11-15',
            pendingTodos: 1,
            notes: 'React app with TypeScript. Performance optimization needed for large datasets.',
            lastCommitDate: null,
            latestTag: null
          },
          {
            id: 'habit-tracker',
            repoUrl: 'https://api.github.com/repos/user/habit-tracker',
            platform: 'Android',
            status: 'Active',
            lastReviewDate: '2025-07-20',
            nextReviewDate: '2025-10-20',
            pendingTodos: 5,
            notes: 'Kotlin app using Room database. Need to implement dark mode.',
            lastCommitDate: null,
            latestTag: null
          }
        ];

        for (const app of sampleApps) {
          await this.db.put(PORTFOLIO_STORE, app);
        }
      }

      if (ideasCount === 0) {
        const sampleIdeas = [
          {
            id: 'idea-1',
            conceptName: 'Smart Recipe Suggester',
            problemSolved: 'Helps users find recipes based on ingredients they already have at home, reducing food waste.',
            targetAudience: 'Home cooks and busy professionals who want to minimize grocery shopping.',
            initialFeatures: 'Ingredient scanner, recipe matching algorithm, dietary restrictions filter, shopping list generation.',
            techStack: 'React Native',
            riskRating: 'Medium',
            dateCreated: new Date().toISOString()
          },
          {
            id: 'idea-2',
            conceptName: 'Local Event Discovery',
            problemSolved: 'Connects users with local events and activities that match their interests and schedule.',
            targetAudience: 'Young professionals and students looking for social activities and networking opportunities.',
            initialFeatures: 'Event feed, interest matching, calendar integration, social sharing.',
            techStack: 'Flutter',
            riskRating: 'Low',
            dateCreated: new Date().toISOString()
          }
        ];

        for (const idea of sampleIdeas) {
          await this.db.put(IDEAS_STORE, idea);
        }
      }
    } catch (error) {
      console.error('Failed to initialize sample data:', error);
    }
  }

  /**
   * Get all portfolio apps
   */
  async getPortfolio() {
    if (!this.initialized) await this.init();
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
    try {
      await this.db.put(PORTFOLIO_STORE, app);
      return app;
    } catch (error) {
      console.error('Failed to save app:', error);
      throw new Error('Failed to save app data');
    }
  }

  /**
   * Delete an app
   */
  async deleteApp(id) {
    if (!this.initialized) await this.init();
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
   * Calculate next review date (3 months from now)
   */
  calculateNextReviewDate() {
    const now = new Date();
    now.setMonth(now.getMonth() + 3);
    return now.toISOString().split('T')[0];
  }

  /**
   * Clear all data (for testing/debugging)
   */
  async clearAll() {
    if (!this.initialized) await this.init();
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