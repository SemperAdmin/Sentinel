/**
 * Authentication Service
 * Handles admin authentication and session management
 */

import dataStore from '../data/DataStore.js';
import { supabaseService } from '../data/SupabaseService.js';
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
  async clearSession() {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    this.session = null;
    if (dataStore.useSupabase) {
        await supabaseService.signOut();
    }
  }

  /**
   * Authenticate user with Supabase
   * @param {string} email
   * @param {string} password
   */
  async loginWithSupabase(email, password) {
    try {
        const { data, error } = await supabaseService.signIn(email, password);
        
        if (error) {
            return {
                success: false,
                error: error.message || 'Authentication failed'
            };
        }

        const user = data.user;
        if (!user) {
            return {
                success: false,
                error: 'No user returned'
            };
        }

        // Check profile role
        const profile = await supabaseService.getUserProfile(user.id);
        
        if (!profile || profile.role !== 'admin') {
            await supabaseService.signOut();
            return {
                success: false,
                error: 'Unauthorized: Admin access required'
            };
        }

        // Create local session to maintain compatibility with existing app
        const session = {
            role: 'admin',
            authenticatedAt: Date.now(),
            expiresAt: Date.now() + SESSION_DURATION,
            source: 'supabase',
            userId: user.id,
            email: user.email
        };

        this.saveSession(session);

        return {
            success: true,
            role: 'admin'
        };

    } catch (err) {
        console.error('Supabase login error:', err);
        return {
            success: false,
            error: 'Login error occurred'
        };
    }
  }

  /**
   * Authenticate user with password
   * @param {string} password - Admin password
   * @returns {Promise<{success: boolean, role: string, error?: string}>}
   */
  async login(password) {
    if (dataStore.useSupabase) {
      // Fetch admin password from app_config table
      const { data, error } = await supabaseService.client
        .from('app_config')
        .select('value')
        .eq('key', 'admin_password')
        .single();

      if (error) {
        console.error('Error fetching admin password:', error);
        // Fallback to default if table doesn't exist or error (or handle securely)
        // For now, if we can't verify against DB, we fail safely unless it's a known error
        return {
          success: false,
          error: 'Authentication verification failed'
        };
      }

      if (data && data.value === password) {
        const session = {
          role: 'admin',
          authenticatedAt: Date.now(),
          expiresAt: Date.now() + SESSION_DURATION,
          source: 'supabase_config'
        };
        this.saveSession(session);
        return { success: true, role: 'admin' };
      } else {
        return { success: false, error: 'Invalid password' };
      }
    }
    // ⚠️ SECURITY NOTE: This uses bcrypt-hashed password stored in auth-config.json
    // The hash is secure and cannot be reversed, but this is still client-side auth.
    // For production apps with sensitive data, use proper backend authentication.

    try {
      // Fetch the auth configuration file
      console.log('Loading authentication configuration...');

      // Use Vite's BASE_URL which is always available at build time
      // This is set in vite.config.js based on VITE_BASE_PATH env var or defaults to '/Sentinel/'
      // Use optional chaining for safety in edge cases where import.meta.env might be undefined
      const baseUrl = import.meta?.env?.BASE_URL || '/';
      const configPath = `${baseUrl}auth-config.json`;
      console.log('Fetching auth config from:', configPath);

      let response = await fetch(configPath);

      // Fallback: if fetch fails, try alternative paths for different deployment scenarios
      if (!response.ok) {
        console.log('Primary path failed, trying fallback paths...');
        const fallbackPaths = [
          '/auth-config.json',           // Root path
          './auth-config.json',          // Relative path
          '/Sentinel/auth-config.json'   // Explicit GitHub Pages path
        ].filter(p => p !== configPath); // Don't retry the same path

        for (const fallbackPath of fallbackPaths) {
          console.log('Trying fallback path:', fallbackPath);
          const fallbackResponse = await fetch(fallbackPath);
          if (fallbackResponse.ok) {
            response = fallbackResponse;
            console.log('✅ Found auth-config.json at:', fallbackPath);
            break;
          }
        }
      }

      if (!response.ok) {
        console.error('❌ Failed to load auth-config.json from any path. Status:', response.status);
        console.error('Tried paths:', [configPath, '/auth-config.json', './auth-config.json', '/Sentinel/auth-config.json']);
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
