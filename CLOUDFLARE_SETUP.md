# Cloudflare Tunnel Setup Guide

## Step 1: Install Cloudflare Tunnel

Download from: https://github.com/cloudflare/cloudflared/releases

Or use Chocolatey (if installed):
```powershell
choco install cloudflared
```

Or download the Windows executable and add to PATH.

## Step 2: Login to Cloudflare

```powershell
cloudflared tunnel login
```

This will open a browser to authenticate with Cloudflare.

## Step 3: Create Tunnels

### For Frontend (port 3000):
```powershell
cloudflared tunnel --url http://localhost:3000
```

### For Backend (port 3001):
Open a NEW terminal:
```powershell
cloudflared tunnel --url http://localhost:3001
```

## Step 4: Get Your URLs

Each tunnel will show a URL like:
- Frontend: `https://random-words-1234.trycloudflare.com`
- Backend: `https://random-words-5678.trycloudflare.com`

## Step 5: Update Environment Files

**Backend `.env` (`apps/server/.env`):**
```env
FRONTEND_URL=https://your-frontend-cloudflare-url.trycloudflare.com
```

**Frontend `.env` (`apps/web/.env`):**
```env
NEXT_PUBLIC_API_URL=https://your-backend-cloudflare-url.trycloudflare.com
```

## Advantages:
- ✅ Free
- ✅ Multiple tunnels simultaneously
- ✅ More stable than ngrok free plan
- ✅ No port conflicts
- ✅ Works reliably

