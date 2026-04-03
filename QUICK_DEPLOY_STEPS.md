# Quick Deploy to Render - 5 Minutes

## Step-by-Step Instructions

### 1. Go to Render
Visit: https://render.com and sign up/login with GitHub

### 2. Create New Web Service
- Click **"New +"** → **"Web Service"**
- Connect your GitHub account
- Select repository: **Sahi0045/Frontend-assignment**
- Click **"Connect"**

### 3. Configure (Copy-Paste These)

**Name:** `finance-backend-api`

**Build Command:**
```
npm install && npx prisma generate && npm run build
```

**Start Command:**
```
npx prisma migrate deploy && npm run db:seed && npm start
```

**Plan:** Select **Free**

### 4. Add Environment Variables

Click **"Add Environment Variable"** for each:

```
NODE_ENV = production
PORT = 3000
DATABASE_URL = file:./prod.db
JWT_ACCESS_EXPIRY = 15m
JWT_REFRESH_EXPIRY = 7d
BCRYPT_ROUNDS = 12
RATE_LIMIT_WINDOW_MS = 900000
RATE_LIMIT_MAX = 100
AUTH_RATE_LIMIT_MAX = 10
CORS_ORIGIN = *
```

**For JWT secrets, generate random strings:**

Open terminal and run:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output and add:
```
JWT_ACCESS_SECRET = [paste the generated string]
```

Run the command again for a different string:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Add:
```
JWT_REFRESH_SECRET = [paste the second generated string]
```

### 5. Deploy
- Click **"Create Web Service"**
- Wait 3-5 minutes
- Your app will be live!

### 6. Get Your URL
You'll get a URL like: `https://finance-backend-api.onrender.com`

**Your Swagger docs:** `https://finance-backend-api.onrender.com/api/docs`

### 7. Test It
Visit: `https://your-url.onrender.com/health`

Should return:
```json
{
  "success": true,
  "message": "Finance Backend API is running"
}
```

### 8. Use in Submission Form
**Live Demo or API Documentation URL:**
```
https://finance-backend-api.onrender.com/api/docs
```

---

## Important Notes

⚠️ **First request takes 30-60 seconds** (free tier cold start)
✅ **Subsequent requests are fast**
✅ **Seed data is automatically loaded**
✅ **Test credentials work immediately**

---

**That's it! Your API is live!** 🎉
