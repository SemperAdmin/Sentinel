/**
 * Sentinel App Type Definitions
 *
 * These types provide TypeScript support for the Sentinel portfolio management app.
 * They can be used via JSDoc annotations in JavaScript files or directly in TypeScript files.
 */

// ============================================================================
// Core Data Types
// ============================================================================

/**
 * Represents an application in the portfolio
 */
export interface App {
  /** Unique identifier (usually repository name) */
  id: string;
  /** Display name (defaults to id if not set) */
  name?: string;
  /** GitHub repository URL */
  repoUrl: string;
  /** Platform (Web, iOS Native, Android Native, Cross-Platform) */
  platform: string;
  /** Status (Active, Archived) */
  status: string;
  /** ISO date of last review */
  lastReviewDate: string | null;
  /** ISO date of next scheduled review */
  nextReviewDate: string | null;
  /** Count of pending todos */
  pendingTodos: number;
  /** Description or notes */
  notes: string;
  /** Description alias */
  description?: string;
  /** ISO date of last commit */
  lastCommitDate: string | null;
  /** Latest git tag */
  latestTag: string | null;
  /** GitHub stars count */
  stars: number;
  /** Primary programming language */
  language: string;
  /** Whether repo is private */
  isPrivate: boolean;
  /** Whether repo is archived */
  archived: boolean;
  /** Array of todos */
  todos: Todo[];
  /** Array of improvements */
  improvements: Improvement[];
  /** Developer notes */
  developerNotes: string;
  /** Budget percentage for improvements */
  improvementBudget: number;
  /** Current sprint identifier */
  currentSprint: string;
  /** Open issues count */
  openIssues?: number;
}

/**
 * Represents a todo/task item
 */
export interface Todo {
  /** Unique identifier */
  id: string;
  /** Todo title */
  title: string;
  /** Todo description */
  description: string;
  /** Priority level */
  priority: 'low' | 'medium' | 'high';
  /** ISO date string */
  dueDate: string | null;
  /** Completion status */
  completed: boolean;
  /** ISO date of creation */
  createdAt: string;
  /** Status (Draft, Submitted, Review, Approved, In Development, Complete, Rejected) */
  status: TodoStatus;
  /** Source of the todo */
  source?: string;
  /** User feedback summary */
  feedbackSummary?: string;
  /** Who submitted the todo */
  submittedBy?: string;
  /** Effort estimate */
  effortEstimate?: 'Small' | 'Medium' | 'Large' | null;
  /** Completion date */
  completionDate?: string | null;
  /** Reason for rejection */
  rejectionReason?: string;
}

export type TodoStatus =
  | 'Draft'
  | 'Submitted'
  | 'Review'
  | 'Approved'
  | 'In Development'
  | 'Complete'
  | 'Rejected'
  | 'public-submission';

/**
 * Represents an improvement suggestion
 */
export interface Improvement {
  /** Unique identifier */
  id: string;
  /** Improvement title */
  title: string;
  /** Improvement description */
  description: string;
  /** Effort estimate (1-5) */
  effort: number;
  /** Impact estimate (1-5) */
  impact: number;
  /** Status */
  status: 'Pending' | 'In Progress' | 'Completed';
}

/**
 * Represents an idea in the incubation pipeline
 */
export interface Idea {
  /** Unique identifier */
  id: string;
  /** Name of the idea */
  conceptName: string;
  /** Problem this idea solves */
  problemSolved: string;
  /** Target audience */
  targetAudience: string;
  /** Technology stack */
  techStack: string;
  /** Risk rating */
  riskRating: 'Low' | 'Medium' | 'High';
  /** ISO date of creation */
  dateCreated: string;
  /** Contact email for public submissions */
  contactEmail?: string;
  /** Status for tracking */
  status?: string;
  /** Who submitted the idea */
  submittedBy?: string;
}

// ============================================================================
// State Management Types
// ============================================================================

/**
 * Available views in the application
 */
export type ViewType = 'dashboard' | 'detail' | 'ideas' | 'login' | 'feedback';

/**
 * User roles
 */
export type UserRole = 'admin' | 'public' | 'guest';

/**
 * Tab types in detail view
 */
export type TabType = 'overview' | 'todo';

/**
 * Sort order options
 */
export type SortOrder = 'alphabetical' | 'lastReviewed' | 'nextReview' | 'activeTodo';

/**
 * Health status types
 */
export type HealthStatus = 'healthy' | 'needs-attention' | 'stale' | 'good' | 'warning' | 'critical';

/**
 * Filter options state
 */
export interface FilterState {
  platform: string;
  status: string;
  health: string;
}

/**
 * Application state
 */
export interface State {
  /** Current view */
  currentView: ViewType;
  /** Portfolio of apps */
  portfolio: App[];
  /** Portfolio loading state */
  portfolioLoading: boolean;
  /** Portfolio error message */
  portfolioError: string | null;
  /** Currently selected app */
  currentApp: App | null;
  /** Current app loading state */
  currentAppLoading: boolean;
  /** Current app error message */
  currentAppError: string | null;
  /** Array of ideas */
  ideas: Idea[];
  /** Ideas loading state */
  ideasLoading: boolean;
  /** Ideas error message */
  ideasError: string | null;
  /** Global loading state */
  loading: boolean;
  /** Global error message */
  error: string | null;
  /** Active tab in detail view */
  activeTab: TabType;
  /** Whether idea form is shown */
  showIdeaForm: boolean;
  /** Idea being edited */
  editingIdea: Idea | null;
  /** Auto repo sync enabled */
  autoRepoSync: boolean;
  /** Sort order */
  sortOrder: SortOrder;
  /** Search query */
  searchQuery: string;
  /** Filter state */
  filters: FilterState;
  /** Whether user is authenticated */
  isAuthenticated: boolean;
  /** Current user role */
  userRole: UserRole;
  /** Whether to show login screen */
  showLogin: boolean;
}

/**
 * State listener callback
 */
export type StateListener = (state: State) => void;

// ============================================================================
// API and Data Types
// ============================================================================

/**
 * GitHub repository data from API
 */
export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  private: boolean;
  archived: boolean;
  language: string | null;
  stargazers_count: number;
  open_issues_count: number;
  pushed_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * GitHub commit data
 */
export interface GitHubCommit {
  sha: string;
  commit: {
    message: string;
    author: {
      name: string;
      email: string;
      date: string;
    };
  };
  html_url: string;
}

/**
 * GitHub tag data
 */
export interface GitHubTag {
  name: string;
  zipball_url: string;
  tarball_url: string;
  commit: {
    sha: string;
    url: string;
  };
}

/**
 * Result type for error handling
 */
export interface Result<T, E = Error> {
  success: boolean;
  data?: T;
  error?: E;
}

// ============================================================================
// Component Props Types
// ============================================================================

/**
 * Callbacks for IdeasList component
 */
export interface IdeasListCallbacks {
  /** Called when idea is clicked for editing */
  onEdit?: (idea: Idea) => void;
  /** Called when activate button is clicked */
  onActivate?: (ideaId: string) => void;
}

/**
 * Filter change payload
 */
export interface FilterChangePayload {
  searchQuery?: string;
  filters?: Partial<FilterState>;
}

/**
 * Toast notification types
 */
export type ToastType = 'error' | 'success' | 'info';

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Makes all properties of T optional recursively
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Extract keys of T that have values assignable to V
 */
export type KeysOfType<T, V> = {
  [K in keyof T]: T[K] extends V ? K : never;
}[keyof T];
