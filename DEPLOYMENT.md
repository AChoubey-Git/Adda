# Adda — Deployment Cheat Sheet

> Complete step-by-step guide to go live on **Railway + Vercel**.
> Do these steps **once**. After that, every `git push main` deploys automatically.

---

## Stack

| Layer | Service | Cost |
|---|---|---|
| Backend API + WebSocket | Railway | ~$5/month |
| Frontend (React SPA) | Vercel | Free |
| Database | MongoDB Atlas | Free M0 |
| Cache / Pub-Sub | Upstash Redis | Free tier |
| File uploads | Cloudinary | Free 25 GB |
| Desktop installers | GitHub Releases | Free |

---

## Step 1 — MongoDB Atlas

1. Go to [cloud.mongodb.com](https://cloud.mongodb.com) → Create account → **Create a FREE cluster (M0)**
2. **Database Access** → Add user: `adda-prod` with a strong password
3. **Network Access** → Add IP: `0.0.0.0/0` (allows Railway's dynamic IPs)
4. **Connect** → Drivers → copy the connection string:
   ```
   mongodb+srv://adda-prod:<password>@cluster0.xxxxx.mongodb.net/adda?retryWrites=true&w=majority
   ```
5. Save this as `MONGODB_URI`

---

## Step 2 — Upstash Redis

1. Go to [upstash.com](https://upstash.com) → Create account → **Create Database**
2. Choose region closest to your Railway region
3. Copy from the dashboard:
   - **Endpoint** → `REDIS_HOST`
   - **Port** → `REDIS_PORT` (usually `6379`)
   - **Password** → `REDIS_PASSWORD`

---

## Step 3 — Cloudinary

1. Go to [cloudinary.com](https://cloudinary.com) → Create free account
2. Dashboard shows:
   - **Cloud name** → `CLOUDINARY_CLOUD_NAME`
   - **API Key** → `CLOUDINARY_API_KEY`
   - **API Secret** → `CLOUDINARY_API_SECRET`

---

## Step 4 — Generate JWT Secrets

Run this **twice** (once for each secret) in any terminal:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Save the two outputs as `JWT_SECRET` and `JWT_REFRESH_SECRET`.

---

## Step 5 — Railway (Backend)

1. Go to [railway.app](https://railway.app) → **Sign in with GitHub**
2. **New Project** → **Deploy from a Docker Image**
3. Image URL: `ghcr.io/<your-github-username>/<your-repo-name>-backend:latest`
   - Example: `ghcr.io/aChoubey/adda-backend:latest`
4. Enable **"Auto-deploy on image update"** in service settings
5. Go to **Variables** tab and add:

```env
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://adda.vercel.app        # fill in after step 6
MONGODB_URI=mongodb+srv://...
REDIS_HOST=...
REDIS_PORT=6379
REDIS_PASSWORD=...
JWT_SECRET=<64-char hex>
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=<64-char hex>
JWT_REFRESH_EXPIRES_IN=7d
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

6. Go to **Settings → Tokens** → Create a **Project Token** → copy it as `RAILWAY_TOKEN`
7. Note your Railway service **public URL** (e.g. `adda-backend.up.railway.app`)

---

## Step 6 — Vercel (Frontend)

1. Go to [vercel.com](https://vercel.com) → **Sign in with GitHub**
2. **Add New Project** → Import your `adda` repo
3. Set **Root Directory** to `frontend`
4. Leave Framework as **Create React App** (auto-detected)
5. Go to **Settings → Environment Variables** → add:

```env
REACT_APP_API_URL=https://adda-backend.up.railway.app/api/v1
REACT_APP_SOCKET_URL=https://adda-backend.up.railway.app/chat
```

6. Deploy once manually → note your Vercel URL (e.g. `adda.vercel.app`)
7. Go back to Railway and update `FRONTEND_URL` to your Vercel URL
8. In Vercel → **Account Settings → Tokens** → create token → copy as `VERCEL_TOKEN`
9. From Vercel URL bar: `vercel.com/<org>/<project>` → copy `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID`
   (Or run `vercel link` locally to auto-generate `.vercel/project.json`)

---

## Step 7 — GitHub Secrets

Go to your repo → **Settings → Secrets and variables → Actions** → add all of these:

| Secret Name | Value |
|---|---|
| `RAILWAY_TOKEN` | From Railway project settings → Tokens |
| `VERCEL_TOKEN` | From Vercel account settings → Tokens |
| `VERCEL_ORG_ID` | From Vercel account settings → General |
| `VERCEL_PROJECT_ID` | From Vercel project settings → General |
| `REACT_APP_API_URL` | `https://your-railway-url.up.railway.app/api/v1` |
| `REACT_APP_SOCKET_URL` | `https://your-railway-url.up.railway.app/chat` |
| `MONGODB_URI` | Atlas connection string |
| `REDIS_HOST` | Upstash endpoint |
| `REDIS_PORT` | `6379` |
| `REDIS_PASSWORD` | Upstash password |
| `JWT_SECRET` | 64-char hex string |
| `JWT_REFRESH_SECRET` | 64-char hex string |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |

---

## Step 8 — First Deploy

```bash
git checkout main
git merge integrate_deployment
git push origin main
```

Watch the pipeline in **GitHub → Actions**:

```
backend-test  ──┐
frontend-test ──┤─→ docker-build ─→ deploy-backend  (Railway)
                │
                ├──────────────────→ deploy-frontend (Vercel)
                │
                └──────────────────→ electron-build ─→ release-electron (GitHub Release)
```

Total time: **~8–12 minutes**

---

## Verification Checklist

- [ ] Visit your Vercel URL → Adda loads with dark mode
- [ ] Register an account → JWT issued, redirected to chat
- [ ] Send a message to yourself → 🔒 badge, WebSocket connected
- [ ] Upload an image → Cloudinary URL in response, image visible
- [ ] Check Railway logs → no errors, health check `200 OK`
- [ ] Check GitHub Releases → `.exe`, `.dmg`, `.AppImage` attached
- [ ] Download and run the desktop app → connects to production

---

## Updating After First Deploy

Just push to `main` — the pipeline handles everything:

```bash
git push origin main
# → Railway redeployes backend (zero-downtime)
# → Vercel rebuilds and CDN-invalidates frontend
# → New GitHub Release created with updated desktop apps
```

---

## Custom Domain (optional)

1. **Vercel**: Settings → Domains → add `chat.yourdomain.com`
2. **Cloudflare**: Add CNAME → `chat` → `cname.vercel-dns.com` (proxied)
3. **Railway**: Settings → Networking → Custom domain → add `api.yourdomain.com`
4. Update `REACT_APP_API_URL` and `REACT_APP_SOCKET_URL` in Vercel + GitHub secrets
5. Update `FRONTEND_URL` in Railway variables
