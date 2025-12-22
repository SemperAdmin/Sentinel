# Sentinel Full-Stack Developer Review

## Executive Summary

This document provides a comprehensive review of the Sentinel application's frontend-backend communication, data flow mechanisms, and identified issues that need to be addressed.

**Review Date:** December 22, 2025
**Reviewer:** Full-Stack Architecture Analysis

---

## 1. Architecture Overview

### Technology Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Vanilla JavaScript (ES6+ modules), HTML5, CSS3 |
| **Build Tool** | Vite 5.0 |
| **Backend** | Node.js HTTP Proxy Server |
| **Primary Data Storage** | GitHub API + JSON files in repository |
| **Local Persistence** | IndexedDB with Map-based fallback |
| **Caching** | LRU Cache (server-side, 100 items, 60s TTL) |

### Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         BROWSER (FRONTEND)                          │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────────────────┐   │
│  │   App.js    │───│  AppState   │───│    DataController.js    │   │
│  │ Orchestrator│   │ (Pub/Sub)   │   │  (Triple-Fallback)      │   │
│  └─────────────┘   └─────────────┘   └─────────────────────────┘   │
│                           │                      │                   │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              ApiService.js (GitHub API Wrapper)              │   │
│  │   - fetchPortfolioOverview()   - fetchRepoTasks()           │   │
│  │   - triggerSaveTasks()         - saveAppReviews()           │   │
│  │   - saveIdeaYaml()             - fetchIdeasFromRepo()       │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                           │                                         │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              DataStore.js (IndexedDB Wrapper)                │   │
│  │   - getPortfolio() / saveApp()                               │   │
│  │   - getIdeas() / saveIdea()                                  │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                              │ fetch('/api/*')
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    VITE DEV SERVER (port 5173)                      │
│                  Proxies /api/* to backend                          │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    NODE.JS BACKEND (port 4000)                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                     server/index.js                          │   │
│  │   - CORS headers injection                                   │   │
│  │   - LRU caching (GET requests, 60s TTL)                     │   │
│  │   - Token rotation for rate limiting                        │   │
│  │   - Rate limiting (10 mutations/min per IP)                 │   │
│  │   - Static file serving (SPA fallback)                      │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      GITHUB API (api.github.com)                     │
│                                                                      │
│  READ Operations:                                                    │
│  - GET /repos/{owner}/{repo}/contents/data/portfolio/overview.json  │
│  - GET /repos/{owner}/{repo}/contents/data/tasks/{app}/tasks.json   │
│  - GET /repos/{owner}/{repo}/contents/data/reviews/{app}/reviews.json│
│  - GET /repos/{owner}/{repo}/contents/data/ideas/*.yml              │
│                                                                      │
│  WRITE Operations:                                                   │
│  - PUT /repos/{owner}/{repo}/contents/data/* (Direct Contents API)  │
│  - POST /repos/{owner}/{repo}/dispatches (GitHub Actions trigger)   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. JSON Data Files Analysis

### 2.1 Portfolio Overview (`data/portfolio/overview.json`)

**Purpose:** Master list of all apps in the portfolio

**Schema:**
```json
{
  "id": "string (lowercase kebab-case)",
  "repoUrl": "https://github.com/{owner}/{repo}",
  "platform": "Web|iOS|Android|Cross-platform",
  "status": "Active|Archived",
  "lastReviewDate": "ISO date string | null",
  "nextReviewDate": "YYYY-MM-DD",
  "pendingTodos": "number",
  "notes": "string (description)",
  "lastCommitDate": "ISO datetime string",
  "latestTag": "string | null",
  "stars": "number",
  "language": "string | null",
  "isPrivate": "boolean",
  "archived": "boolean",
  "recentViews": "number",
  "uniqueViews": "number",
  "recentClones": "number",
  "uniqueClones": "number",
  "popularReferrers": "array",
  "popularPaths": "array"
}
```

**Current Issues:**
- ❌ `pendingTodos` is always `0` - never calculated from actual todos array
- ❌ `todos` and `improvements` arrays not persisted to overview.json (only in IndexedDB)
- ❌ `developerNotes` field missing from JSON but expected in App type

### 2.2 Tasks (`data/tasks/{app-id}/tasks.json`)

**Purpose:** Per-app task/todo items

**Schema:**
```json
{
  "id": "string (timestamp)",
  "title": "string",
  "description": "string",
  "priority": "low|medium|high",
  "dueDate": "ISO date string | null",
  "completed": "boolean",
  "createdAt": "ISO datetime string",
  "source": "Facebook|Instagram|Teams|Email|Sponsor|Policy|Other",
  "feedbackSummary": "string",
  "submittedBy": "string",
  "status": "Draft|Submitted|Approved|In Development|Complete|Rejected"
}
```

**Current Issues:**
- ⚠️ Case-sensitivity mismatch: Some folders use uppercase (`EventCall/`) while app IDs are lowercase (`eventcall`)
- ⚠️ Duplicate task folders exist (e.g., `EventCall/` and `eventcall/`)

### 2.3 Reviews (`data/reviews/{app-id}/reviews.json`)

**Purpose:** Quarterly review history per app

**Schema:**
```json
{
  "id": "string",
  "startedAt": "ISO datetime string",
  "completedAt": "ISO datetime string | null",
  "answers": {
    "questionId": {
      "status": "Pending|Pass|Fail|N/A",
      "notes": "string"
    }
  }
}
```

**Current Issues:**
- ⚠️ Many review files are empty arrays `[]`
- ⚠️ No validation that reviews are properly completed

### 2.4 Ideas (`data/ideas/*.yml`)

**Purpose:** Innovation ideas stored as YAML files

**Schema:**
```yaml
id: idea-{timestamp}-{uuid}
conceptName: string
problemSolved: string
targetAudience: string
techStack: Web|React Native|Flutter|iOS Native|Android Native
riskRating: Low|Medium|High
dateCreated: ISO datetime
initialFeatures: string
submittedBy: string
contactEmail: string
comments: JSON string of array
```

**Current Issues:**
- ⚠️ `comments` is stored as JSON string inside YAML (awkward serialization)
- ⚠️ Simple YAML parser doesn't handle multi-line values properly

---

## 3. Issues Identified

### 🔴 CRITICAL Issues

#### Issue #1: Data Synchronization Race Conditions
**Location:** `src/App.js:756-784`, `src/components/TabbedDetail.js:386-398`

**Problem:** Multiple async operations can update the same data simultaneously without coordination:
```javascript
// TabbedDetail.js - Fire-and-forget pattern
(async () => {
  try {
    const apiModule = await import('../data/ApiService.js');
    const api = apiModule.default;
    await api.triggerSaveTasks(appId, todos);
  } catch (_) {} // Errors silently swallowed!
})();
```

**Impact:**
- Tasks can be lost if two save operations overlap
- No feedback to user on save failure
- Silent failures make debugging difficult

---

#### Issue #2: SHA Conflict on Concurrent Writes
**Location:** `src/data/ApiService.js:349-373`

**Problem:** When saving to GitHub, the SHA is fetched before the write. If another process updates the file between fetch and write, the save fails:
```javascript
async saveTasksViaContents(appId, tasks) {
  const sha = await this.getFileSha(appId);  // Gets current SHA
  // ... time passes ...
  const res = await fetch(url, { method: 'PUT', ... sha: sha }); // May fail if file changed
}
```

**Impact:** Data loss when multiple users or tabs are editing simultaneously

---

#### Issue #3: Inconsistent App ID Normalization
**Location:** Multiple files

**Problem:** App IDs are generated inconsistently:

| Location | Method |
|----------|--------|
| `DataController.js:137` | `repo.name.toLowerCase().replace(/[^a-z0-9]/g, '-')` |
| `overview.json` | Lowercase kebab-case |
| `data/tasks/` folders | Mixed case (`EventCall/` vs `eventcall/`) |
| `ApiService.fetchRepoTasks` | Uses app ID as-is |

**Impact:**
- Tasks may not load if folder case doesn't match
- Duplicate data folders waste space
- Confusing for developers

---

#### Issue #4: Missing Error Handling on PUT Operations
**Location:** `src/data/ApiService.js:314-335`

**Problem:** Reviews save returns boolean without error details:
```javascript
async saveAppReviews(appId, reviews) {
  try {
    // ...
    const res = await fetch(url, { method: 'PUT', ... });
    return !!(res && res.ok);  // No error message returned
  } catch (err) {
    return false;  // User doesn't know why it failed
  }
}
```

**Impact:** Users can't diagnose or report save failures

---

### 🟠 HIGH Priority Issues

#### Issue #5: `pendingTodos` Never Updated
**Location:** `data/portfolio/overview.json`

**Problem:** All apps have `"pendingTodos": 0` even when they have active tasks

**Root Cause:** When tasks are saved, the overview.json is never updated with the new count

**Impact:** Dashboard statistics are always incorrect

---

#### Issue #6: Token Exposure in Client Bundle
**Location:** `src/data/ApiService.js:196-199`

**Problem:** PUT/POST requests to GitHub include auth headers that could expose the token pattern in network logs

**Recommendation:** All authenticated requests should go through the backend proxy

---

#### Issue #7: IndexedDB and Remote Data Divergence
**Location:** `src/controllers/DataController.js:33-66`

**Problem:** Triple-fallback strategy can cause stale data issues:
1. If repo JSON fails, local IndexedDB data is used
2. Local data may be outdated
3. No mechanism to detect or resolve conflicts

---

#### Issue #8: Review Date Calculation Logic Mismatch
**Location:** `src/utils/constants.js:7` vs `src/components/TabbedDetail.js:206`

**Problem:**
- Constants define `REVIEW_CYCLE_DAYS = 90`
- TabbedDetail UI says "60d from commit"
- Actual calculation uses `REVIEW_CYCLE_DAYS` (90 days)

**Impact:** User confusion about review schedule

---

### 🟡 MEDIUM Priority Issues

#### Issue #9: No Offline Write Queue
**Problem:** When offline, writes fail silently. There's no queue to retry when connection returns.

---

#### Issue #10: Cache Invalidation Gap
**Location:** `server/index.js:366-373`

**Problem:** LRU cache is only invalidated by TTL (60s). After a PUT operation, stale data may be returned to other clients.

---

#### Issue #11: YAML Parser Limitations
**Location:** `src/data/ApiService.js:566-589`

**Problem:** `parseSimpleYaml()` is a naive line-by-line parser that:
- Doesn't handle multi-line strings
- Doesn't handle nested objects
- Doesn't handle arrays properly (except comments hack)

---

#### Issue #12: Duplicate API Calls on Load
**Location:** `src/App.js:583-587`

**Problem:** Portfolio is fetched, then immediately checked again:
```javascript
const portfolio = await this.dataController.loadPortfolioData();
appState.setPortfolio(portfolio);

const overviewCheck = await apiService.fetchPortfolioOverview();  // Duplicate call!
```

---

#### Issue #13: Memory Leak in Event Listeners
**Location:** `src/components/TabbedDetail.js:629-648`

**Problem:** Click listener is only removed if `_boundElementClick` exists, but initial render may not set it:
```javascript
if (this._boundElementClick)
  this.element.removeEventListener('click', this._boundElementClick);
this._boundElementClick = (e) => { ... };
this.element.addEventListener('click', this._boundElementClick);
```

---

### 🔵 LOW Priority Issues

#### Issue #14: Console Logging in Production
**Problem:** Extensive `console.log` statements throughout the codebase will affect production performance.

---

#### Issue #15: Hardcoded Default User
**Location:** `src/utils/constants.js:82`

```javascript
export const DEFAULT_GITHUB_USER = 'SemperAdmin';
```

**Problem:** Not configurable without code changes

---

#### Issue #16: Inconsistent Date Formatting
**Problem:** Some dates use `toISOString().split('T')[0]`, others use full ISO strings, others use `toLocaleDateString()`.

---

## 4. Data Flow Issues Summary

### Push (Write) Operations

| Operation | Mechanism | Issues |
|-----------|-----------|--------|
| Save Tasks | PUT to `/contents/data/tasks/{app}/tasks.json` | SHA conflicts, no retry, silent failures |
| Save Reviews | PUT to `/contents/data/reviews/{app}/reviews.json` | Same as above |
| Save Ideas | PUT to `/contents/data/ideas/{id}.yml` | YAML serialization issues |
| Dispatch Actions | POST to `/dispatches` | Falls back to direct PUT on failure |

### Pull (Read) Operations

| Operation | Mechanism | Issues |
|-----------|-----------|--------|
| Load Portfolio | GET overview.json → IndexedDB → GitHub API | Triple fallback can serve stale data |
| Load Tasks | GET tasks.json with in-memory cache | Case-sensitivity issues |
| Load Reviews | GET reviews.json | No caching, frequent API calls |
| Load Ideas | List directory, fetch each YAML | N+1 query problem |

---

## 5. Recommended Fixes

### Immediate (Should Fix Now)

1. **Normalize App IDs consistently** - Always lowercase, always kebab-case
2. **Add error handling with user feedback** for all save operations
3. **Fix the `pendingTodos` calculation** or remove the field
4. **Correct the UI text** to match actual 90-day review cycle
5. **Remove duplicate task folders** (EventCall vs eventcall)

### Short-Term (Next Sprint)

1. **Implement optimistic locking** - Compare SHA before write, retry with merge on conflict
2. **Add offline queue** - Store writes in IndexedDB, sync when online
3. **Cache invalidation** - Invalidate specific cache keys after PUT operations
4. **Replace naive YAML parser** with proper library (js-yaml)

### Long-Term (Architecture)

1. **Consider Supabase migration** - Already planned per `data/tasks/sentinel/tasks.json`
2. **Implement WebSocket/SSE** for real-time sync
3. **Add versioning** to data structures
4. **Implement proper conflict resolution UI**

---

## 6. Files Requiring Changes

| File | Priority | Changes Needed |
|------|----------|----------------|
| `src/data/ApiService.js` | 🔴 Critical | Add error handling, retry logic, SHA conflict resolution |
| `src/controllers/DataController.js` | 🔴 Critical | Normalize app IDs, add conflict detection |
| `src/components/TabbedDetail.js` | 🟠 High | Fix fire-and-forget saves, add error feedback |
| `data/portfolio/overview.json` | 🟠 High | Either calculate pendingTodos or remove field |
| `src/utils/constants.js` | 🟡 Medium | Make DEFAULT_GITHUB_USER configurable |
| `server/index.js` | 🟡 Medium | Add cache invalidation on POST/PUT |
| `data/tasks/EventCall/` | 🟡 Medium | Rename to lowercase or merge with eventcall/ |

---

## 7. Testing Recommendations

1. **Add integration tests** for data sync operations
2. **Test offline scenarios** - What happens when GitHub API is unreachable?
3. **Test concurrent edits** - Open same app in two tabs, edit tasks
4. **Test case sensitivity** - Create tasks for apps with uppercase names
5. **Load testing** - What happens with 100+ apps in portfolio?

---

## Appendix: Code References

Key files analyzed:
- `src/App.js` (1161 lines) - Main orchestrator
- `src/data/ApiService.js` (666 lines) - GitHub API integration
- `src/controllers/DataController.js` (384 lines) - Data loading logic
- `src/data/DataStore.js` (396 lines) - IndexedDB wrapper
- `src/state/AppState.js` (700 lines) - State management
- `src/components/TabbedDetail.js` (824 lines) - Detail view component
- `server/index.js` (382 lines) - Backend proxy server
