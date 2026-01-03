# Sentinel Backend Implementation Plan

## 1. Application Architecture Analysis

### Current State
- **Frontend**: React (Vite) with `AppState` for state management.
- **Persistence**: 
  - `DataStore` uses `IndexedDB` for local storage of apps and ideas.
  - `server/index.js` acts as a proxy for GitHub API requests to avoid CORS and rate limiting issues, but does not store application state.
  - `auth-config.json` stores a hashed admin password for simple client-side gatekeeping.
- **Data Model**:
  - **App (Portfolio Item)**: Core entity containing metadata, GitHub stats, and nested collections.
  - **Todo**: Tasks associated with an App.
  - **Improvement**: Strategic improvements associated with an App.
  - **Idea**: Standalone product concepts.

### Required Backend Services
- **Database**: To replace IndexedDB and enable multi-user/multi-device access.
- **Authentication**: To replace the simple password hash and allow secure user management.
- **API**: To expose data and potentially proxy GitHub requests securely.
- **Edge Functions**: To handle GitHub API proxying (replacing the local Node server) and background jobs (e.g., scheduled repo syncing).

### Data Entities & Relationships
- **Users (Profiles)**
  - `id` (UUID, PK, FK to auth.users)
  - `email`
  - `role` (admin, viewer)
  - `created_at`

- **Apps**
  - `id` (UUID, PK)
  - `user_id` (UUID, FK to profiles) - *Owner/Creator*
  - `repo_url` (Text)
  - `name` (Text)
  - `platform` (Text)
  - `status` (Text)
  - `description` (Text)
  - `github_stats` (JSONB) - *Cache stars, forks, etc.*
  - `last_review_date` (Timestamp)
  - `next_review_date` (Timestamp)
  - `created_at` (Timestamp)

- **Todos**
  - `id` (UUID, PK)
  - `app_id` (UUID, FK to apps)
  - `title` (Text)
  - `description` (Text)
  - `priority` (Text)
  - `status` (Text)
  - `due_date` (Timestamp)
  - `created_at` (Timestamp)

- **Improvements**
  - `id` (UUID, PK)
  - `app_id` (UUID, FK to apps)
  - `title` (Text)
  - `description` (Text)
  - `effort` (Integer)
  - `impact` (Integer)
  - `status` (Text)
  - `created_at` (Timestamp)

- **Ideas**
  - `id` (UUID, PK)
  - `user_id` (UUID, FK to profiles)
  - `concept_name` (Text)
  - `problem_solved` (Text)
  - `target_audience` (Text)
  - `tech_stack` (Text)
  - `risk_rating` (Text)
  - `created_at` (Timestamp)

## 2. Supabase Implementation Plan

### Database Schema
```sql
-- Profiles linked to Auth
create table profiles (
  id uuid references auth.users not null primary key,
  email text,
  role text default 'viewer' check (role in ('admin', 'viewer')),
  created_at timestamptz default now()
);

-- Apps
create table apps (
  id uuid default gen_random_uuid() primary key,
  owner_id uuid references profiles(id),
  repo_url text,
  name text,
  platform text,
  status text,
  description text,
  github_stats jsonb default '{}'::jsonb,
  last_review_date timestamptz,
  next_review_date timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Todos
create table todos (
  id uuid default gen_random_uuid() primary key,
  app_id uuid references apps(id) on delete cascade,
  title text not null,
  description text,
  priority text check (priority in ('low', 'medium', 'high')),
  status text check (status in ('pending', 'in_progress', 'completed', 'archived')),
  due_date timestamptz,
  created_at timestamptz default now()
);

-- Improvements
create table improvements (
  id uuid default gen_random_uuid() primary key,
  app_id uuid references apps(id) on delete cascade,
  title text not null,
  description text,
  effort int check (effort between 1 and 5),
  impact int check (impact between 1 and 5),
  status text default 'pending',
  created_at timestamptz default now()
);

-- Ideas
create table ideas (
  id uuid default gen_random_uuid() primary key,
  owner_id uuid references profiles(id),
  concept_name text not null,
  problem_solved text,
  target_audience text,
  tech_stack text,
  risk_rating text check (risk_rating in ('Low', 'Medium', 'High')),
  created_at timestamptz default now()
);
```

### Security Policies (RLS)
- **Profiles**: Users can read all profiles (or just their own), admins can manage roles.
- **Apps/Todos/Improvements/Ideas**: 
  - `SELECT`: Authenticated users can read.
  - `INSERT/UPDATE/DELETE`: Only users with `role = 'admin'` or `owner_id = auth.uid()` can modify.

### Authentication
- **Primary**: Email/Password.
- **Secondary**: GitHub OAuth (highly relevant for this project since it integrates with GitHub).
- **Flow**:
  1. User signs in via Supabase Auth UI.
  2. `onAuthStateChange` hook updates local `AppState`.
  3. RLS policies automatically enforce access control.

### API & Edge Functions
- **Standard CRUD**: Use `supabase-js` client directly for Apps, Todos, Ideas.
- **GitHub Proxy**: Replace local `server/index.js` with a Supabase Edge Function `github-proxy`.
  - Securely stores `GITHUB_TOKEN` in Supabase Secrets.
  - Handles rate limiting and caching logic using Deno KV or just headers.

## 3. Development Roadmap

### Phase 1: Foundation (Week 1)
- [ ] Initialize Supabase project.
- [ ] Apply database schema.
- [ ] Configure Auth (Email + GitHub).
- [ ] Set up RLS policies.
- [ ] Create `SupabaseService.js` to wrap `supabase-js` client.

### Phase 2: Migration & Integration (Week 2)
- [ ] Create migration script to move data from `IndexedDB` (client-side) to Supabase.
- [ ] Update `DataStore.js` to switch from `IndexedDB` to `SupabaseService`.
- [ ] Update `AppState.js` to handle async auth states properly.

### Phase 3: Advanced Features (Week 3)
- [ ] Implement `github-proxy` Edge Function.
- [ ] Remove local `server/index.js` dependency.
- [ ] Implement Real-time subscriptions for collaborative updates (optional but ready).

### Phase 4: Hardening & Deployment (Week 4)
- [ ] Comprehensive testing of RLS policies.
- [ ] End-to-end testing of user flows.
- [ ] Update documentation.
- [ ] Deploy frontend to static host (Vercel/Netlify/GitHub Pages) with env vars.

## 4. Success Criteria

- **Security**: No sensitive keys in client code. RLS ensures users only access permitted data.
- **Scalability**: Database handles growth in apps/todos without client-side storage limits.
- **Functionality**: All current features (Portfolio, Ideas, Todos) work seamlessly with the new backend.
- **Maintainability**: Clear separation of concerns; no custom Node server to maintain for simple proxying.
