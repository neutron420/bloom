# Step-by-Step Guide: Making Meeting Links Publicly Accessible

## Method 1: Quick Testing with ngrok (Recommended for Testing)

### Step 1: Install ngrok

**Option A: Download from website**
1. Go to https://ngrok.com/download
2. Download ngrok for Windows
3. Extract `ngrok.exe` to a folder (e.g., `C:\ngrok`)
4. Open Command Prompt or PowerShell
5. Navigate to the ngrok folder: `cd C:\ngrok`

**Option B: Using npm (if you have Node.js)**
```bash
npm install -g ngrok
```

### Step 2: Create Backend .env File

1. Navigate to `apps/server` folder
2. Create a file named `.env` (if it doesn't exist)
3. Add these variables:

```env
# Database
DATABASE_URL=your_postgresql_connection_string

# JWT Secret
JWT_SECRET=your-secret-key-change-in-production

# Server Port
PORT=3001

# Frontend URL (will be set after ngrok)
FRONTEND_URL=http://localhost:3000

# Google OAuth (if using)
GOOGLE_CLIENT_ID=your_google_client_id

# MediaSoup (optional)
MEDIASOUP_LISTEN_IP=0.0.0.0
MEDIASOUP_ANNOUNCED_IP=your_public_ip
```

### Step 3: Create Frontend .env.local File

1. Navigate to `apps/web` folder
2. Create a file named `.env.local` (if it doesn't exist)
3. Add these variables:

```env
# Backend API URL
NEXT_PUBLIC_API_URL=http://localhost:3001

# Google OAuth Client ID (if using)
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id
```

### Step 4: Start Your Backend Server

1. Open a terminal/command prompt
2. Navigate to backend:
```bash
cd apps/server
npm run dev
```
3. Keep this terminal open - backend should be running on `http://localhost:3001`

### Step 5: Start Your Frontend Server

1. Open a NEW terminal/command prompt
2. Navigate to frontend:
```bash
cd apps/web
npm run dev
```
3. Keep this terminal open - frontend should be running on `http://localhost:3000`

### Step 6: Start ngrok to Expose Frontend

1. Open a NEW terminal/command prompt
2. Run ngrok:
```bash
ngrok http 3000
```

3. You'll see output like:
```
Forwarding  https://abc123-def456.ngrok-free.app -> http://localhost:3000
```

4. **Copy the HTTPS URL** (e.g., `https://abc123-def456.ngrok-free.app`)

### Step 7: Update Backend .env with ngrok URL

1. Go back to `apps/server/.env` file
2. Update `FRONTEND_URL`:
```env
FRONTEND_URL=https://abc123-def456.ngrok-free.app
```
(Replace with YOUR ngrok URL)

3. **Restart your backend server** (stop with Ctrl+C and run `npm run dev` again)

### Step 8: Test the Meeting Links

1. Open your frontend in browser: `http://localhost:3000`
2. Create a new meeting
3. Copy the meeting link - it should now show: `https://abc123-def456.ngrok-free.app/meet/[roomId]`
4. Share this link with anyone - they can access it from anywhere!

---

## Method 2: Production Deployment (For Real Use)

### Option A: Deploy to Vercel (Frontend) + Railway (Backend)

#### Frontend Deployment (Vercel)

1. **Push your code to GitHub**
   ```bash
   git add .
   git commit -m "Ready for deployment"
   git push origin main
   ```

2. **Go to https://vercel.com**
   - Sign up/login
   - Click "New Project"
   - Import your GitHub repository
   - Set root directory to `apps/web`
   - Add environment variables:
     ```
     NEXT_PUBLIC_API_URL=https://your-backend-url.railway.app
     NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id
     ```
   - Click "Deploy"

3. **Copy your Vercel URL** (e.g., `https://bloom.vercel.app`)

#### Backend Deployment (Railway)

1. **Go to https://railway.app**
   - Sign up/login
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository
   - Set root directory to `apps/server`

2. **Add Environment Variables:**
   ```
   DATABASE_URL=your_postgresql_url
   JWT_SECRET=your-secret-key
   FRONTEND_URL=https://bloom.vercel.app
   PORT=3001
   NODE_ENV=production
   ```

3. **Add PostgreSQL Database:**
   - Click "New" → "Database" → "PostgreSQL"
   - Railway will auto-create `DATABASE_URL`

4. **Deploy:**
   - Railway will auto-deploy
   - Copy your backend URL (e.g., `https://bloom-backend.railway.app`)

5. **Update Frontend Environment Variable:**
   - Go back to Vercel
   - Update `NEXT_PUBLIC_API_URL` to your Railway backend URL
   - Redeploy frontend

### Option B: Deploy to Render (Both Frontend & Backend)

#### Backend on Render

1. **Go to https://render.com**
   - Sign up/login
   - Click "New" → "Web Service"
   - Connect GitHub repository
   - Settings:
     - Name: `bloom-backend`
     - Root Directory: `apps/server`
     - Build Command: `npm install && npm run build`
     - Start Command: `npm start`
     - Environment: `Node`

2. **Add Environment Variables:**
   ```
   DATABASE_URL=your_postgresql_url
   JWT_SECRET=your-secret-key
   FRONTEND_URL=https://bloom-frontend.onrender.com
   PORT=3001
   NODE_ENV=production
   ```

3. **Add PostgreSQL Database:**
   - Click "New" → "PostgreSQL"
   - Copy the `DATABASE_URL` and add to backend env vars

#### Frontend on Render

1. **Click "New" → "Static Site"**
   - Connect GitHub repository
   - Root Directory: `apps/web`
   - Build Command: `npm install && npm run build`
   - Publish Directory: `.next`

2. **Add Environment Variables:**
   ```
   NEXT_PUBLIC_API_URL=https://bloom-backend.onrender.com
   NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id
   ```

3. **Update Backend FRONTEND_URL:**
   - Copy your frontend URL from Render
   - Update backend `FRONTEND_URL` environment variable

---

## Quick Checklist

### For ngrok (Testing):
- [ ] ngrok installed
- [ ] Backend `.env` file created with `FRONTEND_URL`
- [ ] Frontend `.env.local` file created with `NEXT_PUBLIC_API_URL`
- [ ] Backend running on port 3001
- [ ] Frontend running on port 3000
- [ ] ngrok running: `ngrok http 3000`
- [ ] Backend `.env` updated with ngrok URL
- [ ] Backend restarted

### For Production:
- [ ] Code pushed to GitHub
- [ ] Backend deployed (Railway/Render)
- [ ] Frontend deployed (Vercel/Render)
- [ ] Database connected
- [ ] Environment variables set
- [ ] Frontend URL updated in backend
- [ ] Test meeting link works

---

## Troubleshooting

### Meeting links still show localhost?
- Make sure backend `.env` has `FRONTEND_URL` set correctly
- Restart backend server after changing `.env`
- Check backend logs to see what URL it's using

### ngrok URL changes every time?
- Sign up for free ngrok account
- Get authtoken: https://dashboard.ngrok.com/get-started/your-authtoken
- Run: `ngrok config add-authtoken YOUR_TOKEN`
- Use: `ngrok http 3000 --domain=your-static-domain.ngrok-free.app`

### Can't access from other devices?
- Make sure you're using HTTPS ngrok URL (not HTTP)
- Check firewall isn't blocking connections
- Verify backend is accessible

---

## Notes

- **ngrok free tier**: URLs change on restart, limited connections
- **ngrok paid tier**: Static domains, more connections
- **Production**: Use proper hosting (Vercel/Railway) for stable URLs
- **HTTPS**: Always use HTTPS in production for security

