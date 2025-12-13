/**
 * Development and debugging utilities for Sentinel
 * These functions are exposed to the global window object for console access
 */

import dataStore from '../data/DataStore.js';
import appState from '../state/AppState.js';

/**
 * Initialize all dev tools and attach them to the window object
 * @param {Object} options - Configuration options
 * @param {Object} options.apiService - API service instance
 * @param {Object} options.tabbedDetail - TabbedDetail component instance getter
 */
export function initDevTools(options = {}) {
  const { apiService, getTabbedDetail } = options;

  /**
   * Check API backend configuration status
   */
  window.checkApiBackend = () => {
    if (apiService) {
      console.log('apiService.isApiKeyConfigured():', apiService.isApiKeyConfigured());
    } else {
      console.log('API service not available');
    }
  };

  /**
   * Clear portfolio data and refresh from GitHub
   */
  window.clearPortfolioAndRefresh = async () => {
    console.log('Clearing portfolio data and refreshing...');
    try {
      appState.setPortfolio([]);
      await dataStore.clearAll();
      console.log('Data store cleared');
      location.reload();
    } catch (error) {
      console.error('Failed to refresh portfolio:', error);
    }
  };

  /**
   * Comprehensive cache clearing with options
   * @param {Object} options - Clear options
   * @param {boolean} options.clearGitHub - Clear GitHub cache
   * @param {boolean} options.clearLocalStorage - Clear localStorage
   * @param {boolean} options.clearSessionStorage - Clear sessionStorage
   * @param {boolean} options.reloadAfter - Reload page after clearing
   */
  window.clearAllCache = async (options = {}) => {
    console.log('Starting comprehensive cache clear...');

    try {
      const {
        clearGitHub = true,
        clearLocalStorage = true,
        clearSessionStorage = true,
        reloadAfter = true
      } = options;

      // Clear IndexedDB
      console.log('Clearing IndexedDB...');
      await dataStore.clearAll();

      // Clear app state
      console.log('Clearing app state...');
      appState.setPortfolio([]);

      // Clear localStorage if requested
      if (clearLocalStorage) {
        console.log('Clearing localStorage...');
        localStorage.clear();
      }

      // Clear sessionStorage if requested
      if (clearSessionStorage) {
        console.log('Clearing sessionStorage...');
        sessionStorage.clear();
      }

      // Clear GitHub cache if requested
      if (clearGitHub && apiService) {
        console.log('Clearing GitHub API cache...');
        window.__github_cache_bust = Date.now();
      }

      console.log('Cache cleared successfully!');

      if (reloadAfter) {
        console.log('Reloading application...');
        setTimeout(() => {
          location.reload();
        }, 100);
      }

    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  };

  /**
   * Emergency cache clear that works even if UI fails
   */
  window.emergencyCacheClear = () => {
    console.log('Emergency cache clear initiated...');

    // Clear all browser storage
    localStorage.clear();
    sessionStorage.clear();

    // Try to clear IndexedDB
    try {
      const deleteReq = indexedDB.deleteDatabase('APM-Portfolio-Manager');
      deleteReq.onsuccess = () => console.log('IndexedDB cleared');
      deleteReq.onerror = () => console.log('Could not clear IndexedDB');
    } catch (e) {
      console.log('IndexedDB clear failed:', e);
    }

    console.log('Emergency cache clear complete');
    console.log('Reloading page...');

    setTimeout(() => {
      location.reload();
    }, 500);
  };

  /**
   * Test todo functionality by adding a test todo to current app
   */
  window.testTodoFunctionality = () => {
    console.log('Testing todo functionality...');

    const currentState = appState.getState();
    if (currentState.currentApp) {
      console.log('Current app found:', currentState.currentApp.id);

      const testTodo = {
        id: 'test-' + Date.now(),
        title: 'Test Todo Item',
        description: 'This is a test todo to verify functionality',
        priority: 'high',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        completed: false,
        createdAt: new Date().toISOString()
      };

      if (!currentState.currentApp.todos) currentState.currentApp.todos = [];
      currentState.currentApp.todos.push(testTodo);

      dataStore.saveApp(currentState.currentApp).then(() => {
        console.log('Test todo added successfully!');
        appState.updateApp(currentState.currentApp);

        const tabbedDetail = getTabbedDetail ? getTabbedDetail() : null;
        if (tabbedDetail) {
          tabbedDetail.activeTab = 'todo';
          tabbedDetail.render();
        }
      }).catch(err => {
        console.error('Failed to save test todo:', err);
      });
    } else {
      console.log('No app currently selected. Please select an app first.');
    }
  };

  // Log available commands
  console.log('Dev tools initialized. Available commands:');
  console.log('  checkApiBackend() - Check API key status');
  console.log('  clearPortfolioAndRefresh() - Clear data and refresh from GitHub');
  console.log('  clearAllCache(options) - Comprehensive cache clearing');
  console.log('  emergencyCacheClear() - Emergency cache clear (works even if UI fails)');
  console.log('  testTodoFunctionality() - Test todo by adding a test item');
}

export default initDevTools;
