#!/usr/bin/env node

/**
 * Test bcrypt password verification
 */

import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_PATH = path.join(__dirname, '..', 'public', 'auth-config.json');

async function testPassword() {
  console.log('=== Testing Bcrypt Authentication ===\n');

  // Read the config file
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  const hash = config.adminPasswordHash;

  console.log('Hash from config:', hash);
  console.log('');

  // Test the password
  const testPassword = 'TTrreewwqq11!!1';
  console.log('Testing password:', testPassword);

  const isValid = await bcrypt.compare(testPassword, hash);

  if (isValid) {
    console.log('✅ Password verification SUCCESSFUL!');
    console.log('Login should work in the app.');
  } else {
    console.log('❌ Password verification FAILED!');
    console.log('This password will NOT work for login.');
  }

  console.log('');

  // Test wrong password
  const wrongPassword = 'wrongpassword';
  console.log('Testing wrong password:', wrongPassword);

  const isWrong = await bcrypt.compare(wrongPassword, hash);

  if (!isWrong) {
    console.log('✅ Wrong password correctly rejected.');
  } else {
    console.log('❌ Wrong password incorrectly accepted!');
  }
}

testPassword().catch(console.error);
