# Deploying to Render.com

This guide explains how to deploy the Sentinel App Manager to Render.com with proper environment variable configuration.

## Prerequisites

- A Render.com account
- This repository connected to Render

## Step 1: Create a Static Site on Render

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click "New +" → "Static Site"
3. Connect your GitHub repository
4. Configure the build settings:
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`

## Step 2: Set Environment Variables

⚠️ **CRITICAL**: You must set the admin password as an environment variable for authentication to work.

1. In your Render service dashboard, click **"Environment"** in the left sidebar
2. Click **"Add Environment Variable"**
3. Add the following:

   ```
   Key:   VITE_ADMIN_PASSWORD
   Value: YOUR_SECURE_PASSWORD_HERE
   ```

   ⚠️ Replace `YOUR_SECURE_PASSWORD_HERE` with your actual admin password.

4. Click **"Save Changes"**

### Optional Environment Variables

If you want to increase GitHub API rate limits:

```
Key:   VITE_GITHUB_TOKEN
Value: your_github_personal_access_token
```

## Step 3: Deploy

1. Click **"Manual Deploy"** → **"Deploy latest commit"**
2. Wait for the build to complete
3. Your app will be available at your Render URL

## Step 4: Test Admin Login

1. Open your deployed app
2. Click the **🔐 LOGIN** button in the header
3. Enter the password you set in `VITE_ADMIN_PASSWORD`
4. You should be logged in as admin

## How It Works

### Build-Time Variable Injection

Vite injects environment variables **at build time**, not runtime:

1. During build, Vite reads `VITE_ADMIN_PASSWORD` from Render's environment
2. All instances of `import.meta.env.VITE_ADMIN_PASSWORD` are replaced with the actual value
3. The password is embedded in the JavaScript bundle

### Security Note

⚠️ **Important**: This is client-side authentication. The password will be visible in the compiled JavaScript bundle to anyone who inspects the code.

This approach is suitable for:
- ✅ Personal projects
- ✅ Internal tools
- ✅ Portfolio managers
- ✅ Low-security admin panels

This approach is NOT suitable for:
- ❌ Public-facing applications with sensitive data
- ❌ Production applications requiring real security
- ❌ Multi-user systems

For production applications, implement proper backend authentication.

## Troubleshooting

### Login Shows "Admin password not configured"

**Problem**: The environment variable wasn't set correctly.

**Solution**:
1. Check Render Dashboard → Environment tab
2. Verify `VITE_ADMIN_PASSWORD` is listed
3. Trigger a **new deploy** after adding the variable
4. Check browser console for detailed error messages

### Password Not Working

**Problem**: The password was changed but the build wasn't updated.

**Solution**:
1. Update `VITE_ADMIN_PASSWORD` in Render Environment settings
2. **Trigger a new deploy** - environment changes require a rebuild
3. Clear browser cache and reload

### How to Change Password

1. Go to Render Dashboard → Your Service → Environment
2. Edit the `VITE_ADMIN_PASSWORD` value
3. Click "Save Changes"
4. **Important**: Trigger a new deploy for changes to take effect
5. The new password will be active after the build completes

## Local Development

For local development, use the `.env` file:

1. Create `.env` file in project root (if it doesn't exist)
2. Add: `VITE_ADMIN_PASSWORD=your_dev_password`
3. Start dev server: `npm run dev`
4. The `.env` file is git-ignored for security

## Build Command Reference

```bash
# Install dependencies
npm install

# Build for production
npm run build

# Preview production build locally
npm run preview
```

## Support

If you encounter issues:
1. Check browser console (F12) for error messages
2. Verify environment variables in Render Dashboard
3. Ensure you triggered a new deploy after adding variables
4. Review the error messages - they provide detailed setup instructions
