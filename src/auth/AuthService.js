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
    // ⚠️ SECURITY NOTE: This uses bcrypt-hashed password stored in auth-config.json
    // The hash is secure and cannot be reversed, but this is still client-side auth.
    // For production apps with sensitive data, use proper backend authentication.

    try {
      // Fetch the auth configuration file
      console.log('Loading authentication configuration...');
      // Use BASE_URL from Vite to handle different base paths (GitHub Pages vs root)
      const baseUrl = import.meta.env.BASE_URL || '/';
      const configPath = `${baseUrl}auth-config.json`;
      console.log('Fetching auth config from:', configPath);
      const response = await fetch(configPath);

      if (!response.ok) {
        console.error('❌ Failed to load auth-config.json:', response.status);
        return {
          success: false,
          error: 'Authentication configuration not found. Please run: node scripts/setup-password.js'
        };
      }

      const config = await response.json();
      const adminPasswordHash = config.adminPasswordHash;

      if (!adminPasswordHash || adminPasswordHash.includes('dummyHash')) {
        console.error('❌ Admin password not configured!');
        console.error('');
        console.error('To set up your admin password:');
        console.error('  1. Run: node scripts/setup-password.js');
        console.error('  2. Enter your desired password');
        console.error('  3. The script will hash it with bcrypt and save to auth-config.json');
        console.error('');
        return {
          success: false,
          error: 'Admin password not configured. Run: node scripts/setup-password.js'
        };
      }

      // Dynamically import bcryptjs for password verification
      console.log('Verifying password with bcrypt...');
      const bcrypt = await import('bcryptjs');

      // Verify the password against the hash
      const isValid = await bcrypt.default.compare(password, adminPasswordHash);

      if (isValid) {
        console.log('✅ Password verified successfully');

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
      } else {
        console.log('❌ Invalid password');
        return {
          success: false,
          error: 'Invalid password'
        };
      }
    } catch (error) {
      console.error('❌ Authentication error:', error);
      return {
        success: false,
        error: 'Authentication failed. Check console for details.'
      };
    }
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
