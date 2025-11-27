# Authentication Setup Guide

This app uses **bcrypt-hashed passwords** stored in a local JSON file for admin authentication. This is more secure than environment variables because:

✅ Password is hashed with bcrypt (12 rounds) - cannot be reversed
✅ Hash is stored locally - not embedded in the JavaScript bundle
✅ No dependency on environment variables or build-time injection
✅ Easy to change password without rebuilding the app

## Initial Setup

### Step 1: Set Your Admin Password

Run the setup script to hash your password:

```bash
npm run setup-password
```

Or directly:

```bash
node scripts/setup-password.js
```

The script will:
1. Prompt you to enter your desired admin password
2. Hash it with bcrypt (12 rounds)
3. Save the hash to `auth-config.json`

**Example:**
```bash
$ npm run setup-password

=== Admin Password Setup ===

Enter admin password: ********
Hashing password with bcrypt (12 rounds)...

Generated hash:
$2b$12$AGUa58gwHlKmSX.ctIGKcOjxmpSSd.PeX2XFsD5fXCuZnOXEQyFEu

✅ Password hash saved to auth-config.json

✅ Setup complete!
You can now use this password to log in as admin.
```

### Step 2: Verify Configuration

Check that `auth-config.json` was created:

```bash
cat auth-config.json
```

You should see:
```json
{
  "adminPasswordHash": "$2b$12$..."
}
```

### Step 3: Deploy

The `auth-config.json` file must be deployed with your app.

**For Render.com:**
1. Copy `auth-config.json` to your repository
2. **Important:** Add it to your git repository (it's git-ignored by default for security)
3. Deploy normally with `npm run build`

**For GitHub Pages:**
1. Copy `auth-config.json` to the `public/` directory (Vite will copy it to dist/)
2. Deploy with `npm run deploy`

**For other hosting:**
- Ensure `auth-config.json` is served at the root URL (`/auth-config.json`)
- The file must be accessible via HTTP fetch

## How It Works

### Login Flow

1. User clicks **🔐 LOGIN** button
2. Enters password in modal
3. `AuthService.login()` fetches `/auth-config.json`
4. Password is verified against the bcrypt hash using `bcrypt.compare()`
5. If valid, admin session is created (24 hours)

### Security

**✅ Secure:**
- Password is never stored in plain text
- Bcrypt hash cannot be reversed (one-way function)
- 12 rounds of bcrypt provides strong security against brute force

**⚠️ Limitations:**
- This is still **client-side authentication**
- Anyone can read `auth-config.json` (they'll see the hash, not the password)
- The hash is public but secure (bcrypt is designed for this)
- For production apps with sensitive data, use proper backend authentication

**Suitable for:**
- ✅ Personal projects
- ✅ Internal tools
- ✅ Portfolio managers
- ✅ Low-security admin panels

**NOT suitable for:**
- ❌ Production apps with sensitive user data
- ❌ Multi-user systems
- ❌ Apps requiring audit logs
- ❌ Apps with strict compliance requirements

## Changing Your Password

To change the admin password:

```bash
npm run setup-password
# Enter new password
```

The script will overwrite the existing hash in `auth-config.json`.

**For production:**
1. Run the script locally
2. Copy the new `auth-config.json` to your server
3. Restart/redeploy (no rebuild needed!)

## Troubleshooting

### Error: "Authentication configuration not found"

**Cause:** `auth-config.json` is missing or not accessible

**Solution:**
1. Run `npm run setup-password` to create it
2. Ensure the file is deployed with your app
3. Check that it's accessible at `/auth-config.json`

### Error: "Admin password not configured"

**Cause:** The hash in `auth-config.json` is still the dummy value

**Solution:**
1. Run `npm run setup-password`
2. Enter your password
3. Redeploy the app with the updated file

### Password not working

**Cause:** Hash doesn't match or file is outdated

**Solution:**
1. Run `npm run setup-password` again
2. Re-enter your password
3. Verify the hash was updated in `auth-config.json`
4. Redeploy

### Browser console shows 404 for auth-config.json

**Cause:** File not deployed or in wrong location

**Solution:**
1. Ensure `auth-config.json` is in the root of your deployed site
2. For Vite, you can place it in the `public/` directory
3. It should be accessible at: `https://your-site.com/auth-config.json`

## File Structure

```
sentinel/
├── auth-config.json              # Your hashed password (git-ignored)
├── auth-config.example.json      # Example file (committed to git)
├── scripts/
│   └── setup-password.js         # Password hashing script
└── src/
    └── auth/
        └── AuthService.js        # Handles authentication
```

## Git and Version Control

**Important:** `auth-config.json` is **git-ignored** by default for security.

If you need to deploy it:
1. **Option A:** Copy manually to server after deployment
2. **Option B:** Force-add it: `git add -f auth-config.json` (⚠️ not recommended for public repos)
3. **Option C:** Place it in `public/` directory (Vite will include it in build)

**Best practice:**
- Keep `auth-config.json` out of git for private repos
- For Render.com or similar, copy the file separately or use option C

## Security Best Practices

1. **Use a strong password:**
   - At least 12 characters
   - Mix of uppercase, lowercase, numbers, symbols
   - Don't reuse passwords from other services

2. **Keep auth-config.json secure:**
   - Don't commit to public repositories
   - Use different passwords for dev/production
   - Rotate passwords periodically

3. **Monitor access:**
   - Check browser console for failed login attempts
   - Clear sessions when done: click **🚪 LOGOUT**

4. **Consider backend auth for production:**
   - This is client-side only
   - For sensitive apps, implement proper backend authentication
   - Use OAuth, JWT, or session-based auth with a server

## Advanced: Manual Password Hash

If you prefer to generate the hash manually:

```javascript
const bcrypt = require('bcryptjs');

bcrypt.hash('your-password', 12, (err, hash) => {
  console.log(hash);
  // Copy this hash to auth-config.json
});
```

Or use the Node.js REPL:

```bash
node
> const bcrypt = require('bcryptjs');
> bcrypt.hash('your-password', 12).then(console.log);
```

## Support

If you encounter issues:
1. Check browser console (F12) for detailed error messages
2. Verify `auth-config.json` exists and is accessible
3. Try running `npm run setup-password` again
4. Check the authentication flow in the console logs
