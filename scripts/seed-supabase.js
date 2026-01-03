import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

// Load environment variables from .env
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Supabase credentials missing in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function mapAppToDB(app, ownerId) {
  return {
    id: app.id,
    owner_id: ownerId,
    repo_url: app.repoUrl,
    name: app.name || app.id,
    platform: app.platform,
    status: app.status,
    description: app.notes,
    github_stats: {
        stars: app.stars,
        forks: app.forks,
        issues: app.openIssues || 0,
        lastCommit: app.lastCommitDate
    },
    last_review_date: app.lastReviewDate,
    next_review_date: app.nextReviewDate,
    updated_at: new Date().toISOString()
  };
}

function mapTodoToDB(todo, appId) {
  let status = 'pending';
  if (todo.completed) {
    status = 'completed';
  } else if (todo.status) {
    const s = todo.status.toLowerCase();
    if (s === 'submitted') status = 'pending';
    else if (s === 'in progress') status = 'in_progress';
    else if (s === 'done' || s === 'complete') status = 'completed';
    else if (['pending', 'in_progress', 'completed', 'archived'].includes(s)) status = s;
  }

  return {
    id: todo.id,
    app_id: appId,
    title: todo.title,
    description: todo.description,
    priority: todo.priority || 'medium',
    status: status,
    due_date: todo.dueDate,
    created_at: todo.createdAt || new Date().toISOString(),
    // Extended fields for rich todo/improvement support
    source: todo.source || 'Manual',
    feedback_summary: todo.feedbackSummary || null,
    submitter_name: todo.submitterName || todo.submittedBy || null,
    submitter_email: todo.submitterEmail || null,
    effort_estimate: todo.effortEstimate || null,
    impact: typeof todo.impact === 'number' ? todo.impact : null,
    rejection_reason: todo.rejectionReason || null,
    completion_date: todo.completionDate || null
  };
}

function parseSimpleYaml(content) {
  const result = {};
  const lines = content.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    
    const colonIndex = trimmed.indexOf(':');
    if (colonIndex !== -1) {
      const key = trimmed.substring(0, colonIndex).trim();
      let value = trimmed.substring(colonIndex + 1).trim();
      
      // Basic type conversion
      if (value === 'true') value = true;
      else if (value === 'false') value = false;
      
      result[key] = value;
    }
  }
  return result;
}

function mapIdeaToDB(idea, userId) {
    return {
        id: idea.id,
        user_id: userId,
        concept_name: idea.conceptName,
        problem_solved: idea.problemSolved,
        target_audience: idea.targetAudience,
        tech_stack: idea.techStack,
        risk_rating: idea.riskRating,
        created_at: idea.dateCreated ? new Date(idea.dateCreated).toISOString() : new Date().toISOString()
    };
}

async function seed() {
  console.log('🌱 Starting seed process...');

  // 1. Authenticate as a seed user to bypass RLS
  // NOTE: We are relying on the "seed_policy.sql" to be applied, which allows anon inserts.
  // This avoids issues with email verification or auth settings during setup.
  
  // const email = `seed-${Date.now()}@example.com`;
  // const password = 'temp-seed-password-123';
  // ... (auth code commented out or removed)
  
  const userId = null; // No user ID needed if we use anon policy, OR we can just pass null.
                       // But wait, if we pass null, 'owner_id' will be null.
                       // If we want 'owner_id' to be set, we might need a user.
                       // BUT, for the portfolio, maybe it's fine if owner_id is null for now?
                       // Or we can set it to a placeholder UUID if the schema allows?
                       // Schema: owner_id uuid references profiles(id).
                       // If we set it to null, it works (nullable).
                       // If we want it to be owned by someone, they need to exist in profiles.
                       
  console.log('ℹ️  Proceeding with Anonymous Seed (ensure seed_policy.sql is applied)...');

   // 2. Verify Policy
   try {
     const testId = `test-${Date.now()}`;
     const { error: testError } = await supabase.from('apps').insert({
        id: testId,
        name: 'Policy Check',
        status: 'Active'
     });
     
     if (testError) {
         if (testError.message.includes('row-level security')) {
             console.error('\n🔴 CRITICAL ERROR: Row-Level Security Policy Violation');
             console.error('The database is blocking anonymous inserts.');
             console.error('👉 PLEASE RUN the content of "supabase/seed_policy.sql" in your Supabase SQL Editor.');
             console.error('   This temporarily allows the seed script to write data.\n');
             process.exit(1);
         }
         // If it's not RLS, maybe it's the ID type issue (UUID vs Text)
         if (testError.code === '22P02') {
             console.error('\n🔴 CRITICAL ERROR: Database Schema Mismatch');
             console.error('The "id" column is expecting UUIDs, but we are sending text.');
             console.error('👉 PLEASE RUN the content of "supabase/change_ids_to_text.sql" in your Supabase SQL Editor.\n');
             process.exit(1);
         }
         console.warn('⚠️ Test insert failed:', testError.message);
     } else {
         console.log('✅ Write policy verification passed.');
         // Clean up test row
         await supabase.from('apps').delete().eq('id', testId);
     }
   } catch (e) {
       console.warn('⚠️ Verification step error:', e);
   }

   // 3. Read local data
  const dataDir = path.join(__dirname, '..', 'data');
  const overviewPath = path.join(dataDir, 'portfolio', 'overview.json');
  
  if (!fs.existsSync(overviewPath)) {
    console.error('❌ No data found at', overviewPath);
    return;
  }

  const rawData = fs.readFileSync(overviewPath, 'utf-8');
  const portfolio = JSON.parse(rawData);

  console.log(`Found ${portfolio.length} apps to seed.`);

  // Find task directories
  const tasksDir = path.join(dataDir, 'tasks');
  let taskFolders = [];
  if (fs.existsSync(tasksDir)) {
    taskFolders = fs.readdirSync(tasksDir);
  }

  for (const app of portfolio) {
    console.log(`Processing App: ${app.id}...`);
    
    // 3. Upsert App with owner_id
    const dbApp = mapAppToDB(app, userId);
    // Use INSERT instead of UPSERT to avoid RLS Select permission issues during anonymous seed
    // If you need to update, you must be authenticated as admin/owner
    const { error: appError } = await supabase.from('apps').insert(dbApp);
    
    if (appError) {
        if (appError.code === '23505') { // unique_violation
             console.log(`   ⚠️ App ${app.id} already exists, skipping...`);
             continue; // Skip to next app (or we could try to update if we had permissions)
        }
        if (appError.code === '22P02') { 
             console.error(`❌ Failed to insert App ${app.id}: ID format mismatch (DB expects UUID).`);
             console.error('👉 ACTION REQUIRED: Run the provided migration "supabase/change_ids_to_text.sql" in Supabase SQL Editor.');
             return; 
        }
        console.error(`❌ Error inserting App ${app.id}:`, appError.message);
        continue;
    }
    
    // 4. Find and Upsert Todos
    // Try to find matching folder (case insensitive)
    const taskFolder = taskFolders.find(f => f.toLowerCase() === app.id.toLowerCase());
    if (taskFolder) {
        const taskFile = path.join(tasksDir, taskFolder, 'tasks.json');
        if (fs.existsSync(taskFile)) {
            const tasksRaw = fs.readFileSync(taskFile, 'utf-8');
            try {
                const tasks = JSON.parse(tasksRaw);
                if (Array.isArray(tasks) && tasks.length > 0) {
                    const dbTodos = tasks.map(t => mapTodoToDB(t, app.id));
                    // Use INSERT instead of UPSERT
                    const { error: todoError } = await supabase.from('todos').insert(dbTodos);
                    if (todoError) {
                        if (todoError.code === '23505') {
                            console.log(`   ⚠️ Some todos for ${app.id} already exist.`);
                        } else if (todoError.code === '22P02') {
                             console.error(`❌ Failed to insert Todos for ${app.id}: ID format mismatch.`);
                             console.error('👉 ACTION REQUIRED: Run the provided migration "supabase/change_ids_to_text.sql"');
                             return;
                         }
                        console.error(`   ⚠️ Error inserting todos for ${app.id}:`, todoError.message);
                    } else {
                        console.log(`   ✅ Seeded ${tasks.length} todos`);
                    }
                }
            } catch (e) {
                console.error(`   ⚠️ Failed to parse tasks for ${app.id}:`, e.message);
            }
        }
    }

    // 5. Find and Upsert Reviews/Improvements (Not implemented yet as review structure varies)
    // But we can add it later if needed.
    
    console.log(`✅ Seeded App ${app.id}`);
  }

  // 6. Seed Ideas
  console.log('💡 Seeding Ideas...');
  const ideasDir = path.join(dataDir, 'ideas');
  if (fs.existsSync(ideasDir)) {
      const ideaFiles = fs.readdirSync(ideasDir).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));
      
      for (const file of ideaFiles) {
          const content = fs.readFileSync(path.join(ideasDir, file), 'utf-8');
          const idea = parseSimpleYaml(content);
          
          if (idea && idea.id) {
              const dbIdea = mapIdeaToDB(idea, userId);
              const { error } = await supabase.from('ideas').insert(dbIdea);
              
              if (error) {
                  if (error.code === '23505') console.log(`   ⚠️ Idea ${idea.id} already exists.`);
                  else console.error(`   ❌ Failed to insert idea ${idea.id}:`, error.message);
              } else {
                  console.log(`   ✅ Seeded idea: ${idea.conceptName}`);
              }
          }
      }
  }
  
  console.log('✨ Seed process complete.');
  console.log('Note: You can delete the temporary seed user from Supabase Auth dashboard if desired.');
}

seed();
