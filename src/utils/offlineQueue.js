/**
 * OfflineQueue - Manages queued writes when offline
 * Persists queue to localStorage and retries when connectivity is restored
 */

const QUEUE_KEY = 'sentinel_offline_queue';
const MAX_RETRIES = 5;
const RETRY_DELAYS = [1000, 2000, 5000, 10000, 30000]; // Exponential backoff

class OfflineQueue {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
    this.listeners = new Set();
    this.loadFromStorage();
    this.setupConnectivityListener();
  }

  /**
   * Load queue from localStorage
   */
  loadFromStorage() {
    try {
      const stored = localStorage.getItem(QUEUE_KEY);
      if (stored) {
        this.queue = JSON.parse(stored);
        console.log(`Loaded ${this.queue.length} items from offline queue`);
      }
    } catch (error) {
      console.warn('Failed to load offline queue:', error);
      this.queue = [];
    }
  }

  /**
   * Save queue to localStorage
   */
  saveToStorage() {
    try {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(this.queue));
    } catch (error) {
      console.warn('Failed to save offline queue:', error);
    }
  }

  /**
   * Setup listener for online/offline events
   */
  setupConnectivityListener() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log('Connection restored, processing offline queue...');
        this.processQueue();
      });

      window.addEventListener('offline', () => {
        console.log('Connection lost, writes will be queued');
      });
    }
  }

  /**
   * Check if we're currently online
   */
  isOnline() {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  }

  /**
   * Add an operation to the queue
   * @param {Object} operation - The operation to queue
   * @param {string} operation.type - 'tasks' | 'reviews' | 'ideas'
   * @param {string} operation.appId - The app/resource ID
   * @param {any} operation.data - The data to save
   * @param {number} [operation.retries] - Current retry count
   */
  enqueue(operation) {
    const queuedOp = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...operation,
      retries: operation.retries || 0,
      queuedAt: new Date().toISOString()
    };

    this.queue.push(queuedOp);
    this.saveToStorage();
    this.notifyListeners('enqueue', queuedOp);

    console.log(`Queued ${operation.type} write for ${operation.appId}`);
    return queuedOp.id;
  }

  /**
   * Remove an operation from the queue
   * @param {string} id - The operation ID
   */
  dequeue(id) {
    const index = this.queue.findIndex(op => op.id === id);
    if (index !== -1) {
      const removed = this.queue.splice(index, 1)[0];
      this.saveToStorage();
      this.notifyListeners('dequeue', removed);
      return removed;
    }
    return null;
  }

  /**
   * Process the queue - attempt to sync all queued operations
   */
  async processQueue() {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    if (!this.isOnline()) {
      console.log('Still offline, skipping queue processing');
      return;
    }

    this.isProcessing = true;
    this.notifyListeners('processing-start', { count: this.queue.length });

    // Process queue in order (FIFO)
    const toProcess = [...this.queue];
    let successCount = 0;
    let failCount = 0;

    for (const operation of toProcess) {
      try {
        const success = await this.executeOperation(operation);

        if (success) {
          this.dequeue(operation.id);
          successCount++;
        } else {
          // Increment retry count
          operation.retries = (operation.retries || 0) + 1;

          if (operation.retries >= MAX_RETRIES) {
            console.error(`Max retries reached for ${operation.type}:${operation.appId}, removing from queue`);
            this.dequeue(operation.id);
            this.notifyListeners('max-retries', operation);
            failCount++;
          } else {
            this.saveToStorage();
            failCount++;
          }
        }
      } catch (error) {
        console.error(`Error processing queued operation:`, error);
        operation.retries = (operation.retries || 0) + 1;
        operation.lastError = error.message;

        // Check MAX_RETRIES to prevent infinite queue buildup
        if (operation.retries >= MAX_RETRIES) {
          console.error(`Max retries reached for ${operation.type}:${operation.appId}, removing from queue`);
          this.dequeue(operation.id);
          this.notifyListeners('max-retries', operation);
        } else {
          this.saveToStorage();
        }
        failCount++;
      }
    }

    this.isProcessing = false;
    this.notifyListeners('processing-complete', { successCount, failCount, remaining: this.queue.length });

    // If there are still items and we're online, schedule retry
    if (this.queue.length > 0 && this.isOnline()) {
      const minRetries = Math.min(...this.queue.map(op => op.retries || 0));
      const delay = RETRY_DELAYS[Math.min(minRetries, RETRY_DELAYS.length - 1)];
      console.log(`Scheduling retry in ${delay}ms for ${this.queue.length} remaining items`);
      setTimeout(() => this.processQueue(), delay);
    }
  }

  /**
   * Execute a single queued operation
   * @param {Object} operation - The operation to execute
   * @returns {Promise<boolean>} - Whether the operation succeeded
   */
  async executeOperation(operation) {
    // Dynamic import to avoid circular dependencies
    const apiModule = await import('../data/ApiService.js');
    const api = apiModule.default;

    // Pass skipQueue=true to prevent re-queuing during queue processing
    switch (operation.type) {
      case 'tasks':
        const taskResult = await api.saveTasksViaContents(operation.appId, operation.data, 0, true);
        return taskResult && taskResult.ok === true;

      case 'reviews':
        const reviewResult = await api.saveAppReviews(operation.appId, operation.data, 0, true);
        return reviewResult && reviewResult.ok === true;

      case 'ideas':
        const ideaResult = await api.saveIdeaYaml(operation.data, true);
        return ideaResult && ideaResult.ok === true;

      default:
        console.warn(`Unknown operation type: ${operation.type}`);
        return false;
    }
  }

  /**
   * Add a listener for queue events
   * @param {Function} callback - Function to call on events
   * @returns {Function} - Unsubscribe function
   */
  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Notify all listeners of an event
   * @param {string} event - Event name
   * @param {any} data - Event data
   */
  notifyListeners(event, data) {
    for (const listener of this.listeners) {
      try {
        listener(event, data);
      } catch (error) {
        console.error('Error in offline queue listener:', error);
      }
    }
  }

  /**
   * Get current queue status
   */
  getStatus() {
    return {
      count: this.queue.length,
      isProcessing: this.isProcessing,
      isOnline: this.isOnline(),
      items: this.queue.map(op => ({
        id: op.id,
        type: op.type,
        appId: op.appId,
        retries: op.retries,
        queuedAt: op.queuedAt
      }))
    };
  }

  /**
   * Clear all queued operations
   */
  clear() {
    this.queue = [];
    this.saveToStorage();
    this.notifyListeners('clear', null);
  }

  /**
   * Get pending count for a specific app
   * @param {string} appId - The app ID
   */
  getPendingCountForApp(appId) {
    return this.queue.filter(op => op.appId === appId).length;
  }
}

// Singleton instance
const offlineQueue = new OfflineQueue();

export default offlineQueue;
export { OfflineQueue };
