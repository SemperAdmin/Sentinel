/**
 * Sync Portfolio to Supabase
 *
 * This script syncs the portfolio data from the local JSON files to Supabase.
 * It's designed to run on a schedule via GitHub Actions.
 *
 * Requires:
 * - SUPABASE_URL: The Supabase project URL
 * - SUPABASE_SERVICE_KEY: The Supabase service role key (has write permissions)
 */

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing environment variables:');
  if (!SUPABASE_URL) console.error('   - SUPABASE_URL');
  if (!SUPABASE_SERVICE_KEY) console.error('   - SUPABASE_SERVICE_KEY');
  console.error('\nPlease set these in GitHub Secrets.');
  process.exit(1);
}

// Use service role key for full write access (bypasses RLS)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/**
 * Map app from local JSON format to Supabase DB format
 */
function mapAppToDB(app) {
  return {
    id: app.id,
    repo_url: app.repoUrl,
    name: app.name || app.id,
    platform: app.platform,
    status: app.status || 'Active',
    description: app.notes || app.description,
    github_stats: {
      stars: app.stars || 0,
      forks: app.forks || 0,
      issues: app.openIssues || 0,
      lastCommit: app.lastCommitDate,
      language: app.language,
      archived: app.archived || false
    },
    last_review_date: app.lastReviewDate,
    next_review_date: app.nextReviewDate,
    updated_at: new Date().toISOString()
  };
}

/**
 * Map todo from local JSON format to Supabase DB format
 */
function mapTodoToDB(todo, appId) {
  let status = 'pending';
  if (todo.completed) {
    status = 'completed';
  } else if (todo.status) {
    const s = todo.status.toLowerCase();
    if (s === 'submitted') status = 'pending';
    else if (s === 'in progress' || s === 'in_progress') status = 'in_progress';
    else if (s === 'done' || s === 'complete' || s === 'completed') status = 'completed';
    else if (['pending', 'in_progress', 'completed', 'archived'].includes(s)) status = s;
  }

  return {
    id: todo.id,
    app_id: appId,
    title: todo.title,
    description: todo.description,
    priority: todo.priority || 'medium',
    status: status,
    due_date: todo.dueDate || null,
    created_at: todo.createdAt || new Date().toISOString(),
    source: todo.source || 'GitHub',
    feedback_summary: todo.feedbackSummary || null,
    submitter_name: todo.submitterName || todo.submittedBy || null,
    submitter_email: todo.submitterEmail || null,
    effort_estimate: todo.effortEstimate || null,
    impact: typeof todo.impact === 'number' ? todo.impact : null
  };
}

async function syncPortfolio() {
  console.log('🔄 Starting Supabase sync...\n');

  const dataDir = path.join(__dirname, '..', 'data');
  const overviewPath = path.join(dataDir, 'portfolio', 'overview.json');

  // Check if overview file exists
  if (!fs.existsSync(overviewPath)) {
    console.error('❌ Portfolio overview not found:', overviewPath);
    process.exit(1);
  }

  // Read portfolio data
  const rawData = fs.readFileSync(overviewPath, 'utf-8');
  const portfolio = JSON.parse(rawData);

  console.log(`📦 Found ${portfolio.length} apps to sync.\n`);

  // Track results
  let appsUpserted = 0;
  let appsFailed = 0;
  let todosUpserted = 0;

  // Find task directories
  const tasksDir = path.join(dataDir, 'tasks');
  const taskFolders = fs.existsSync(tasksDir) ? fs.readdirSync(tasksDir) : [];

  for (const app of portfolio) {
    process.stdout.write(`Syncing ${app.id}... `);

    try {
      // Upsert the app
      const dbApp = mapAppToDB(app);
      const { error: appError } = await supabase
        .from('apps')
        .upsert(dbApp, { onConflict: 'id' });

      if (appError) {
        console.log(`❌ ${appError.message}`);
        appsFailed++;
        continue;
      }

      appsUpserted++;

      // Find and sync tasks
      const taskFolder = taskFolders.find(f => f.toLowerCase() === app.id.toLowerCase());
      if (taskFolder) {
        const taskFile = path.join(tasksDir, taskFolder, 'tasks.json');
        if (fs.existsSync(taskFile)) {
          try {
            const tasksRaw = fs.readFileSync(taskFile, 'utf-8');
            const tasks = JSON.parse(tasksRaw);

            if (Array.isArray(tasks) && tasks.length > 0) {
              const dbTodos = tasks.map(t => mapTodoToDB(t, app.id));

              const { error: todoError } = await supabase
                .from('todos')
                .upsert(dbTodos, { onConflict: 'id' });

              if (todoError) {
                console.log(`✅ (todos failed: ${todoError.message})`);
              } else {
                todosUpserted += tasks.length;
                console.log(`✅ (${tasks.length} todos)`);
              }
            } else {
              console.log('✅');
            }
          } catch (e) {
            console.log(`✅ (tasks parse error: ${e.message})`);
          }
        } else {
          console.log('✅');
        }
      } else {
        console.log('✅');
      }
    } catch (err) {
      console.log(`❌ ${err.message}`);
      appsFailed++;
    }
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Sync Summary:');
  console.log(`   Apps synced: ${appsUpserted}`);
  console.log(`   Apps failed: ${appsFailed}`);
  console.log(`   Todos synced: ${todosUpserted}`);
  console.log('='.repeat(50));

  if (appsFailed > 0) {
    console.log('\n⚠️  Some apps failed to sync. Check the logs above.');
    process.exit(1);
  }

  console.log('\n✨ Sync complete!');
}

syncPortfolio();
