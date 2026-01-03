# Sentinel Deployment Guide

## Deploying to Render.com

### 1. Set Environment Variables

In your Render.com dashboard:

1. Go to your **Sentinel** service
2. Navigate to **Environment** tab
3. Click **Add Environment Variable**
4. Add the following variables:

#### Required Variables

| Key | Value | Description |
|-----|-------|-------------|
| `VITE_ADMIN_PASSWORD` | `your_secure_password` | Admin login password (keep this secret!) |

#### Optional Variables

| Key | Value | Description |
|-----|-------|-------------|
| `VITE_GITHUB_TOKEN` | `ghp_xxxxxxxxxxxx` | GitHub Personal Access Token (improves rate limits) |
| `VITE_API_BASE_URL` | Auto-set by Render | Base URL for API calls |

### 2. Getting a GitHub Token (Optional)

To avoid GitHub API rate limits:

1. Go to [GitHub Settings → Developer Settings → Personal Access Tokens](https://github.com/settings/tokens)
2. Click **Generate new token (classic)**
3. Give it a name: "Sentinel Portfolio Manager"
4. Select scopes:
   - `repo` (for private repos)
   - `read:user` (for user info)
5. Click **Generate token**
6. Copy the token and add it to Render environment variables

### 3. Deploy

After setting environment variables:

1. Render will automatically rebuild your app
2. OR manually trigger: **Manual Deploy → Deploy latest commit**
3. Wait for build to complete
4. Your app will be live at: `https://your-app-name.onrender.com`

### 4. First Login

1. Navigate to your deployed app
2. You'll see the login screen
3. Click **Admin Mode**
4. Enter the password you set in `VITE_ADMIN_PASSWORD`
5. You're in!

---

## Local Development

### 1. Clone Repository

```bash
git clone https://github.com/SemperAdmin/Sentinel.git
cd Sentinel
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Create .env File

Copy the example file:
```bash
cp .env.example .env
```

Edit `.env` and set your development password:
```env
VITE_ADMIN_PASSWORD=dev123
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

Default development password: `dev123`

### 5. Build for Production

```bash
npm run build
```

Preview production build:
```bash
npm run preview
```

---

## Security Notes

⚠️ **Important Security Considerations**

1. **Never commit `.env` to git** - It's in `.gitignore` by default
2. **Use strong passwords** - Don't use simple passwords like "admin123"
3. **Rotate credentials** - Change passwords periodically
4. **Frontend authentication** - Current implementation validates password in the browser
   - Password is visible in compiled JavaScript
   - Suitable for personal use/internal tools
   - For public apps, consider backend authentication

### Future Security Enhancements

For production public apps, consider:
- Moving authentication to backend API
- Implementing JWT tokens
- Adding rate limiting on login attempts
- Using OAuth providers (GitHub, Google, etc.)

---

## Troubleshooting

### Build Fails with "VITE_ADMIN_PASSWORD not set"

**Solution**: Add the environment variable in Render dashboard

### Can't login after deployment

**Possible causes**:
1. Wrong password (check Render environment variables)
2. Password not set (add `VITE_ADMIN_PASSWORD` variable)
3. Browser cache (clear cache and hard refresh)

### GitHub API rate limit errors

**Solution**: Add a GitHub Personal Access Token as `VITE_GITHUB_TOKEN`

---

## Environment Variable Reference

### Vite Environment Variables

Vite exposes environment variables to your client code with special handling:

- **`VITE_*` prefix**: Variables must start with `VITE_` to be accessible in browser
- **Access in code**: `import.meta.env.VITE_VARIABLE_NAME`
- **Build-time replacement**: Variables are statically replaced during build

### Example

```javascript
// In your code:
const password = import.meta.env.VITE_ADMIN_PASSWORD;

// At build time, this becomes:
const password = "your_actual_password";
```

---

## Continuous Deployment

Render.com automatically deploys when you push to your main branch:

```bash
git add .
git commit -m "Update feature"
git push origin main
```

Render will:
1. Detect the push
2. Pull latest code
3. Run `npm run build`
4. Deploy new version
5. Send you a notification

---

## Support

For issues or questions:
- GitHub Issues: [SemperAdmin/Sentinel/issues](https://github.com/SemperAdmin/Sentinel/issues)
- Documentation: Check README.md
