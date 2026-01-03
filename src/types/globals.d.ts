/**
 * Global Type Definitions
 *
 * Extends the Window interface and provides global type definitions
 * for the Sentinel application.
 */

import type { App, Idea, State } from './index';

// ============================================================================
// Window Extensions
// ============================================================================

declare global {
  interface Window {
    /**
     * IndexedDB database instance
     */
    sentinelDB?: IDBDatabase;

    /**
     * Debug utilities exposed on window for development
     */
    clearPortfolioAndRefresh?: () => Promise<void>;
    emergencyCacheClear?: () => Promise<void>;
    deletePortfolioCache?: () => Promise<void>;
    reloadWithFreshData?: () => void;

    /**
     * bcrypt library loaded from CDN
     */
    dcodeIO?: {
      bcrypt: {
        compare(
          password: string,
          hash: string,
          callback: (err: Error | null, result: boolean) => void
        ): void;
        compareSync(password: string, hash: string): boolean;
        hash(
          password: string,
          salt: number | string,
          callback: (err: Error | null, hash: string) => void
        ): void;
        hashSync(password: string, salt: number | string): string;
        genSaltSync(rounds?: number): string;
      };
    };
  }
}

// ============================================================================
// IndexedDB Store Types
// ============================================================================

/**
 * IndexedDB store names
 */
export type StoreName = 'portfolio' | 'ideas' | 'settings' | 'cache';

/**
 * Portfolio entry in IndexedDB
 */
export interface PortfolioEntry {
  id: string;
  data: App;
  updatedAt: string;
}

/**
 * Idea entry in IndexedDB
 */
export interface IdeaEntry {
  id: string;
  data: Idea;
  updatedAt: string;
}

/**
 * Cache entry in IndexedDB
 */
export interface CacheEntry {
  key: string;
  data: unknown;
  expiresAt: number;
  createdAt: string;
}

/**
 * Settings entry in IndexedDB
 */
export interface SettingsEntry {
  key: string;
  value: unknown;
}

// ============================================================================
// Event Types
// ============================================================================

/**
 * Custom event map for Sentinel app
 */
export interface SentinelEventMap {
  'state-change': CustomEvent<{ state: State }>;
  'app-selected': CustomEvent<{ app: App }>;
  'idea-submitted': CustomEvent<{ idea: Idea }>;
  'auth-change': CustomEvent<{ isAuthenticated: boolean; role: string }>;
}

// ============================================================================
// DOM Element Extensions
// ============================================================================

/**
 * Dataset properties for idea items
 */
export interface IdeaItemDataset extends DOMStringMap {
  ideaId: string;
}

/**
 * Dataset properties for app cards
 */
export interface AppCardDataset extends DOMStringMap {
  appId: string;
}

/**
 * Dataset properties for action buttons
 */
export interface ActionButtonDataset extends DOMStringMap {
  action: 'edit' | 'activate' | 'delete' | 'archive';
}

// ============================================================================
// Module Declarations
// ============================================================================

/**
 * Declare JSON imports
 */
declare module '*.json' {
  const value: unknown;
  export default value;
}

/**
 * Declare CSS imports for Vite
 */
declare module '*.css' {
  const content: string;
  export default content;
}

// Ensure this is treated as a module
export {};
