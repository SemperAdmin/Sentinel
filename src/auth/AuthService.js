/**
 * Authentication Service
 * Handles admin authentication and session management
 */

const AUTH_STORAGE_KEY = 'sentinel-auth-session';
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours

export class AuthService {
  constructor() {
    this.session = this.loadSession();
  }

  /**
   * Load session from localStorage
   * @returns {Object|null} Session object or null
   */
  loadSession() {
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      if (!stored) return null;

      const session = JSON.parse(stored);

      // Check if session is expired
      if (Date.now() > session.expiresAt) {
        this.clearSession();
        return null;
      }

      return session;
    } catch (error) {
      console.error('Failed to load session:', error);
      return null;
    }
  }

  /**
   * Save session to localStorage
   * @param {Object} session - Session data
   */
  saveSession(session) {
    try {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
      this.session = session;
    } catch (error) {
      console.error('Failed to save session:', error);
    }
  }

  /**
   * Clear session from localStorage
   */
  clearSession() {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    this.session = null;
  }

  /**
   * Authenticate user with password
   * @param {string} password - Admin password
   * @returns {Promise<{success: boolean, role: string, error?: string}>}
   */
  async login(password) {
    // Check against environment variable or fallback
    // In production, ADMIN_PASSWORD should be set as environment variable
    const adminPassword = import.meta.env.VITE_ADMIN_PASSWORD || 'admin123';

    if (password === adminPassword) {
      const session = {
        role: 'admin',
        authenticatedAt: Date.now(),
        expiresAt: Date.now() + SESSION_DURATION
      };

      this.saveSession(session);

      return {
        success: true,
        role: 'admin'
      };
    }

    return {
      success: false,
      error: 'Invalid password'
    };
  }

  /**
   * Log out current user
   */
  logout() {
    this.clearSession();
  }

  /**
   * Check if user is authenticated as admin
   * @returns {boolean}
   */
  isAdmin() {
    if (!this.session) return false;
    if (Date.now() > this.session.expiresAt) {
      this.clearSession();
      return false;
    }
    return this.session.role === 'admin';
  }

  /**
   * Check if user is authenticated (admin or public)
   * @returns {boolean}
   */
  isAuthenticated() {
    return this.isAdmin() || this.isPublicUser();
  }

  /**
   * Get current user role
   * @returns {string} 'admin', 'public', or 'guest'
   */
  getRole() {
    if (this.isAdmin()) return 'admin';
    return 'public';
  }

  /**
   * Public users are always authenticated (read-only access)
   * @returns {boolean}
   */
  isPublicUser() {
    return true; // Public access is always available
  }

  /**
   * Get session info
   * @returns {Object}
   */
  getSessionInfo() {
    return {
      role: this.getRole(),
      isAdmin: this.isAdmin(),
      isPublic: !this.isAdmin(),
      expiresAt: this.session?.expiresAt || null,
      timeRemaining: this.session ? this.session.expiresAt - Date.now() : null
    };
  }

  /**
   * Extend session duration
   */
  extendSession() {
    if (this.session && this.isAdmin()) {
      this.session.expiresAt = Date.now() + SESSION_DURATION;
      this.saveSession(this.session);
    }
  }
}

// Singleton instance
export const authService = new AuthService();

export default authService;
