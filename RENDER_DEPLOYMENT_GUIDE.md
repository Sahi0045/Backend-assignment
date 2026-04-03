# Render Deployment Guide
## Finance Backend API

This guide will help you deploy your Finance Backend API to Render.

---

## Prerequisites

1. A Render account (sign up at https://render.com - it's free)
2. Your GitHub repository pushed (already done: https://github.com/Sahi0045/Frontend-assignment.git)

---

## Deployment Steps

### Step 1: Sign Up / Log In to Render

1. Go to https://render.com
2. Click "Get Started" or "Sign In"
3. Sign up with GitHub (recommended) or email

### Step 2: Create a New Web Service

1. From your Render dashboard, click **"New +"** button
2. Select **"Web Service"**
3. Click **"Connect account"** to connect your GitHub
4. Find and select your repository: **Sahi0045/Frontend-assignment**
5. Click **"Connect"**

### Step 3: Configure Your Service

Fill in the following settings:

**Basic Settings:**
- **Name**: `finance-backend-api` (or any name you prefer)
- **Region**: Choose closest to you (e.g., Oregon, Frankfurt)
- **Branch**: `main`
- **Root Directory**: Leave blank
- **Runtime**: `Node`

**Build & Deploy Settings:**
- **Build Command**: 
  ```
  npm install && npx prisma generate && npm run build
  ```
- **Start Command**: 
  ```
  npx prisma migrate deploy && npm run db:seed && npm start
  ```

**Plan:**
- Select **"Free"** (this is sufficient for testing/evaluation)

### Step 4: Add Environment Variables

Scroll down to **"Environment Variables"** section and add these:

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `PORT` | `3000` |
| `DATABASE_URL` | `file:./prod.db` |
| `JWT_ACCESS_SECRET` | Generate a random 32+ character string |
| `JWT_REFRESH_SECRET` | Generate a different random 32+ character string |
| `JWT_ACCESS_EXPIRY` | `15m` |
| `JWT_REFRESH_EXPIRY` | `7d` |
| `BCRYPT_ROUNDS` | `12` |
| `RATE_LIMIT_WINDOW_MS` | `900000` |
| `RATE_LIMIT_MAX` | `100` |
| `AUTH_RATE_LIMIT_MAX` | `10` |
| `CORS_ORIGIN` | `*` |

**To generate secure secrets for JWT:**
```bash
# Run these commands in your terminal to generate random secrets
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Step 5: Deploy

1. Click **"Create Web Service"** at the bottom
2. Render will start building and deploying your app
3. Wait 3-5 minutes for the deployment to complete
4. You'll see logs in real-time

### Step 6: Get Your Live URL

Once deployed, you'll get a URL like:
```
https://finance-backend-api.onrender.com
```

Your Swagger documentation will be at:
```
https://finance-backend-api.onrender.com/api/docs
```

---

## Testing Your Deployment

### 1. Health Check
Visit: `https://your-app-name.onrender.com/health`

You should see:
```json
{
  "success": true,
  "message": "Finance Backend API is running",
  "timestamp": "2026-04-03T...",
  "environment": "production",
  "version": "1.0.0"
}
```

### 2. API Documentation
Visit: `https://your-app-name.onrender.com/api/docs`

You should see the Swagger UI with all your endpoints.

### 3. Test Login
Use Swagger UI or curl:
```bash
curl -X POST https://your-app-name.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@finance.local",
    "password": "Admin@123456"
  }'
```

---

## Important Notes

### Free Tier Limitations
- **Spins down after 15 minutes of inactivity**
- First request after spin-down takes 30-60 seconds (cold start)
- 750 hours/month free (sufficient for evaluation)
- SQLite database persists on disk

### Database Persistence
- SQLite file (`prod.db`) is stored on Render's disk
- Data persists between deploys
- Seed data is automatically loaded on first deploy

### Monitoring
- View logs in Render dashboard under "Logs" tab
- Monitor performance under "Metrics" tab

---

## Troubleshooting

### Build Fails
- Check that all dependencies are in `package.json`
- Verify build command is correct
- Check logs for specific error messages

### App Crashes on Start
- Verify all environment variables are set
- Check that JWT secrets are at least 32 characters
- Review logs for error details

### Database Issues
- Ensure `DATABASE_URL` is set to `file:./prod.db`
- Check that Prisma migrations ran successfully in logs
- Verify seed command completed

### Cold Starts (Slow First Request)
- This is normal for free tier
- App spins down after 15 minutes of inactivity
- First request wakes it up (30-60 seconds)
- Subsequent requests are fast

---

## Updating Your Deployment

When you push changes to GitHub:
1. Render automatically detects the push
2. Rebuilds and redeploys your app
3. Zero-downtime deployment

To manually redeploy:
1. Go to your service in Render dashboard
2. Click "Manual Deploy" → "Deploy latest commit"

---

## For Your Submission Form

Once deployed, use this for the submission form:

**Live Demo or API Documentation URL:**
```
https://your-app-name.onrender.com/api/docs

Note: Deployed on Render free tier. First request may take 30-60 seconds due to cold start.
Test credentials available in Swagger UI.
```

---

## Cost

**Free tier includes:**
- 750 hours/month
- Automatic SSL
- Custom domains
- Automatic deploys from GitHub
- More than enough for assignment evaluation

---

## Support

If you encounter issues:
1. Check Render logs in dashboard
2. Review this guide
3. Visit Render docs: https://render.com/docs
4. Check Render status: https://status.render.com

---

**Good luck with your deployment!** 🚀
