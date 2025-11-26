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
    // ⚠️ SECURITY WARNING: This is client-side authentication.
    // The VITE_ADMIN_PASSWORD will be embedded in the production JavaScript bundle
    // and will be visible to the public. This method is only suitable for
    // personal or internal-only applications. For public-facing apps,
    // authentication should be handled by a backend service.

    // Password from Render.com environment variable
    // Set this in Render Dashboard: Environment → Environment Variables
    // Key: VITE_ADMIN_PASSWORD
    // Value: your_secure_password

    // Try multiple ways to get the admin password (in priority order)
    let adminPassword;

    // 1. Runtime config (production - set in public/config.js)
    if (window.APP_CONFIG?.ADMIN_PASSWORD && window.APP_CONFIG.ADMIN_PASSWORD !== '${ADMIN_PASSWORD}') {
      adminPassword = window.APP_CONFIG.ADMIN_PASSWORD;
      console.log('Password loaded from runtime config (window.APP_CONFIG)');
    }

    // 2. Vite environment variable (development - from .env file)
    else if (import.meta.env?.VITE_ADMIN_PASSWORD) {
      adminPassword = import.meta.env.VITE_ADMIN_PASSWORD;
      console.log('Password loaded from Vite environment (import.meta.env)');
    }

    // 3. Window object fallback
    else if (window.ADMIN_PASSWORD) {
      adminPassword = window.ADMIN_PASSWORD;
      console.log('Password loaded from window.ADMIN_PASSWORD');
    }

    // Require password to be set
    if (!adminPassword) {
      console.error('Admin password not configured!');
      console.error('For development: Set VITE_ADMIN_PASSWORD in .env file');
      console.error('For production: Edit public/config.js and set ADMIN_PASSWORD');
      return {
        success: false,
        error: 'Authentication not configured. Please contact administrator.'
      };
    }

    console.log('Comparing passwords... (lengths)', password.length, adminPassword.length);

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
   * Set user as public (guest) user
   * @returns {Promise<{success: boolean, role: string}>}
   */
  async loginAsPublic() {
    const session = {
      role: 'public',
      authenticatedAt: Date.now(),
      expiresAt: Date.now() + SESSION_DURATION
    };

    this.saveSession(session);

    return {
      success: true,
      role: 'public'
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
   * Check if user is authenticated as public user
   * @returns {boolean}
   */
  isPublicUser() {
    if (!this.session) return false;
    if (Date.now() > this.session.expiresAt) {
      this.clearSession();
      return false;
    }
    return this.session.role === 'public';
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
    if (this.isPublicUser()) return 'public';
    return 'guest';
  }

  /**
   * Get session info
   * @returns {Object}
   */
  getSessionInfo() {
    return {
      role: this.getRole(),
      isAdmin: this.isAdmin(),
      isPublic: this.isPublicUser(),
      isGuest: !this.isAuthenticated(),
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
