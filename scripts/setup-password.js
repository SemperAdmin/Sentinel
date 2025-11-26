#!/usr/bin/env node

/**
 * Setup Admin Password Script
 *
 * This script generates a bcrypt hash of your admin password and saves it to auth-config.json
 * The hashed password is secure and cannot be reversed.
 *
 * Usage:
 *   node scripts/setup-password.js
 *   node scripts/setup-password.js YOUR_PASSWORD
 */

import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to config file
const CONFIG_PATH = path.join(__dirname, '..', 'auth-config.json');

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

  // Get password from command line arg or prompt
  let password = process.argv[2];

  if (!password) {
    password = await promptPassword();
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
  console.log('\n⚠️  IMPORTANT: Keep auth-config.json secure and never commit it to git!');
}

main().catch((error) => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
