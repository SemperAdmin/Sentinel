# Deploying to Render.com

This guide explains how to deploy the Sentinel App Manager to Render.com with bcrypt-hashed password authentication.

## Prerequisites

- A Render.com account
- This repository connected to Render

## Authentication Overview

**NEW:** This app uses **bcrypt-hashed passwords** stored in `auth-config.json`.

✅ **No environment variables needed!**
✅ Password is hashed (cannot be reversed)
✅ Easy to change without rebuilding

## Step 1: Create a Static Site on Render

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click "New +" → "Static Site"
3. Connect your GitHub repository
4. Configure the build settings:
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`

## Step 2: Deploy

1. Click **"Manual Deploy"** → **"Deploy latest commit"**
2. Wait for the build to complete
3. Your app will be available at your Render URL

**That's it!** No environment variables to configure.

## Step 3: Test Admin Login

1. Open your deployed app
2. Click the **🔐 LOGIN** button in the header
3. Enter password: `TTrreewwqq11!!1`
4. You should be logged in as admin ✅

## How It Works

### Bcrypt Authentication

1. Your password is hashed with bcrypt (12 rounds)
2. Hash is stored in `public/auth-config.json`
3. During login, app fetches `/auth-config.json`
4. Password is verified using `bcrypt.compare()`

### Security

✅ **Secure:**
- Password never stored in plain text
- Bcrypt hash cannot be reversed
- 12 rounds = strong protection against brute force
- Hash is public but secure (bcrypt is designed for this)

⚠️ **Limitation:**
- This is still client-side authentication
- Suitable for personal/internal tools
- For production apps with sensitive data, use backend authentication

## Changing Your Password

### Option 1: Run Setup Script Locally

```bash
npm run setup-password
# Enter new password
# Commit and push public/auth-config.json
# Redeploy
```

### Option 2: Manual Hash Generation

```bash
node
> const bcrypt = require('bcryptjs');
> bcrypt.hash('your-new-password', 12).then(console.log);
# Copy hash to public/auth-config.json
# Commit and push
# Redeploy
```

## Troubleshooting

### Error: "Authentication configuration not found"

**Cause:** `auth-config.json` not accessible

**Solution:**
1. Check that `public/auth-config.json` exists
2. Trigger a new deploy
3. Verify file is accessible at: `https://your-site.com/auth-config.json`

### Error: "Admin password not configured"

**Cause:** Hash in config is still dummy value

**Solution:**
1. Run `npm run setup-password` locally
2. Commit `public/auth-config.json`
3. Push and redeploy

### Password not working

**Cause:** Hash doesn't match your password

**Solution:**
1. Test locally: `node scripts/test-auth.js`
2. If test fails, run `npm run setup-password` again
3. Commit and redeploy

### Can't access /auth-config.json

**Cause:** File not being served by Render

**Solution:**
1. Ensure `public/auth-config.json` exists in repo
2. Vite automatically copies `public/` to `dist/` during build
3. File should be at: `https://your-site.com/auth-config.json`

## File Structure

```
sentinel/
├── public/
│   └── auth-config.json          # Deployed hash (in git)
├── scripts/
│   ├── setup-password.js         # Hash password script
│   └── test-auth.js              # Test verification
└── src/
    └── auth/
        └── AuthService.js        # Handles authentication
```

## Security Best Practices

1. **Use a strong password:**
   - At least 12 characters
   - Mix of uppercase, lowercase, numbers, symbols
   - Don't reuse passwords

2. **Rotate passwords periodically:**
   - Run `npm run setup-password`
   - Commit and redeploy

3. **Monitor access:**
   - Check browser console for failed attempts
   - Logout when done: **🚪 LOGOUT**

4. **For production apps:**
   - Consider backend authentication
   - Use OAuth, JWT, or session-based auth
   - Implement rate limiting
   - Add audit logging

## Differences from Environment Variables

### Old Method (Environment Variables):
❌ Password embedded in JavaScript bundle
❌ Visible in compiled code
❌ Required rebuild to change
❌ Different setup for dev/production

### New Method (Bcrypt + JSON):
✅ Hash stored in separate JSON file
✅ Cannot be reversed
✅ No rebuild needed to change
✅ Same setup everywhere
✅ More secure

## Testing Before Deploy

Test authentication locally:

```bash
# Test password verification
node scripts/test-auth.js

# Should show:
# ✅ Password verification SUCCESSFUL!
# ✅ Wrong password correctly rejected.
```

## Support

If you encounter issues:
1. Check browser console (F12) for detailed errors
2. Test locally: `node scripts/test-auth.js`
3. Verify `public/auth-config.json` exists
4. Check file is accessible at `/auth-config.json`
5. See `AUTH_SETUP.md` for complete documentation

## Quick Reference

**Current Password:** `TTrreewwqq11!!1`

**Change Password:**
```bash
npm run setup-password
git add public/auth-config.json
git commit -m "Update admin password"
git push
# Trigger redeploy on Render
```

**Test Password:**
```bash
node scripts/test-auth.js
```

**Build Locally:**
```bash
npm run build
npm run preview
```
