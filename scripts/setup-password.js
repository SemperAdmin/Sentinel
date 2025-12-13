#!/usr/bin/env node

/**
 * Setup Admin Password Script
 *
 * This script generates a bcrypt hash of your admin password and saves it to auth-config.json
 * The hashed password is secure and cannot be reversed.
 *
 * Usage:
 *   Interactive:     node scripts/setup-password.js
 *   With argument:   node scripts/setup-password.js YOUR_PASSWORD
 *   With env var:    ADMIN_PASSWORD="your-password" node scripts/setup-password.js
 *
 * For CI/CD pipelines, set the ADMIN_PASSWORD environment variable as a secret.
 */

import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to config file
const CONFIG_PATH = path.join(__dirname, '..', 'public', 'auth-config.json');

// Number of bcrypt rounds (12 is recommended for security)
const SALT_ROUNDS = 12;

/**
 * Prompt for password input
 */
function promptPassword() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question('Enter admin password: ', (password) => {
      rl.close();
      resolve(password);
    });
  });
}

/**
 * Hash password with bcrypt
 */
async function hashPassword(password) {
  console.log('Hashing password with bcrypt (12 rounds)...');
  const hash = await bcrypt.hash(password, SALT_ROUNDS);
  return hash;
}

/**
 * Save hash to config file
 */
function saveConfig(hash) {
  const config = {
    adminPasswordHash: hash
  };

  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  console.log('✅ Password hash saved to auth-config.json');
}

/**
 * Main function
 */
async function main() {
  console.log('=== Admin Password Setup ===\n');

  // Get password from: 1) env var, 2) command line arg, 3) interactive prompt
  let password = process.env.ADMIN_PASSWORD || process.argv[2];

  if (!password) {
    // Only prompt if running interactively (not in CI/CD)
    if (process.stdin.isTTY) {
      password = await promptPassword();
    } else {
      console.error('❌ Error: ADMIN_PASSWORD environment variable not set');
      console.error('   Set it with: export ADMIN_PASSWORD="your-secure-password"');
      console.error('   Or run interactively: node scripts/setup-password.js');
      process.exit(1);
    }
  }

  if (!password || password.trim().length === 0) {
    console.error('❌ Error: Password cannot be empty');
    process.exit(1);
  }

  if (password.length < 8) {
    console.warn('⚠️  Warning: Password is less than 8 characters. Consider using a stronger password.');
  }

  // Hash the password
  const hash = await hashPassword(password);

  console.log('\nGenerated hash:');
  console.log(hash);
  console.log('');

  // Save to config file
  saveConfig(hash);

  console.log('\n✅ Setup complete!');
  console.log('You can now use this password to log in as admin.');
}

main().catch((error) => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
