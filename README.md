# 💬 Adda — আড্ডা

> **Where conversations come alive**

Adda (আড্ডা) is a Bengali word for lively, warm conversation among friends — and that's exactly what this app is. A production-grade, end-to-end encrypted real-time chat platform built with **NestJS**, **React**, **Electron**, **MongoDB**, **Redis**, and **Socket.io**.

---

## 🏗 Architecture

```
adda/
├── backend/                  # NestJS API + WebSocket server
│   └── src/
│       ├── auth/             # JWT auth, refresh tokens, guards
│       ├── users/            # Profiles, contacts, search
│       ├── chat/             # Conversations, messages, media
│       ├── gateway/          # Socket.io real-time gateway
│       ├── redis/            # Pub/Sub, presence, caching
│       └── encryption/       # E2E key management
│
├── frontend/                 # React 18 web app
│   └── src/
│       ├── components/
│       │   ├── auth/         # Login, register
│       │   └── chat/         # Sidebar, messages, modals, input
│       ├── store/            # Zustand (auth + chat state)
│       └── services/         # Axios, Socket.io, E2E crypto
│
└── electron/                 # Desktop app wrapper
    ├── main.js               # Window, notifications, IPC
    └── preload.js            # Secure context bridge
```

---

## 🚀 Quick Start

### Docker (recommended)
```bash
git clone <repo> adda && cd adda
cp backend/.env.example backend/.env
docker-compose up -d
```
Open **http://localhost:3000**

### Local Development
```bash
npm run install:all
cp backend/.env.example backend/.env
# Edit backend/.env with your MongoDB/Redis/JWT config
npm run dev
```

### Desktop App (Electron)
```bash
npm run dev:electron
```

---

## ✨ Features

| Feature | Status |
|---------|--------|
| JWT auth + refresh token rotation | ✅ |
| Real-time messaging (WebSocket) | ✅ |
| Message delivery & read receipts | ✅ |
| Typing indicators | ✅ |
| Group chats with admin roles | ✅ |
| Message reactions (emoji) | ✅ |
| Reply-to / quote messages | ✅ |
| Edit & delete messages | ✅ |
| Media sharing (images, documents) | ✅ |
| End-to-end encryption (ECDH + AES-GCM) | ✅ |
| Dark / Light mode | ✅ |
| Emoji picker | ✅ |
| Desktop notifications (Electron) | ✅ |
| Redis Pub/Sub for horizontal scaling | ✅ |
| Docker + CI/CD pipeline | ✅ |
| Electron packaging (Win/Mac/Linux) | ✅ |

---

## 🎨 Brand

- **Name:** Adda (আড্ডা)
- **Meaning:** Lively, informal conversation — a Kolkata cultural institution
- **Tagline:** *Where conversations come alive*
- **Primary colour:** `#f97316` (warm orange)
- **Accent:** `#fbbf24` (golden yellow)

---

## 🔌 WebSocket Events

### Client → Server
| Event | Description |
|-------|-------------|
| `message:send` | Send a message |
| `message:read` | Mark conversation as read |
| `message:delete` | Delete a message |
| `message:edit` | Edit a message |
| `typing:start` / `typing:stop` | Typing indicators |
| `reaction:add` | Add emoji reaction |
| `status:update` | Update online presence |

### Server → Client
| Event | Description |
|-------|-------------|
| `message:new` | New message received |
| `message:read` | Read receipt |
| `message:deleted` | Message was deleted |
| `message:edited` | Message was edited |
| `typing:start` / `typing:stop` | Someone is typing |
| `user:status` | Presence update |
| `reaction:updated` | Reaction changed |

---

## 🔐 E2E Encryption

Uses the **Web Crypto API** — all encryption happens client-side:

1. Client generates **ECDH P-256 key pair** on registration
2. **Public key** uploaded to server
3. On first message, client fetches recipient's public key
4. **Shared secret** derived via ECDH
5. Messages encrypted with **AES-GCM 256-bit** before sending
6. Server stores **only ciphertext** — it cannot read your messages

---

## 🚀 Deployment

### Recommended stack (free to start)
| Service | Purpose |
|---------|---------|
| Railway | Backend hosting |
| Vercel | Frontend hosting |
| MongoDB Atlas | Managed database |
| Upstash | Managed Redis |
| Cloudinary | File/image storage |
| Cloudflare | DNS + SSL + CDN |

### Desktop distribution
```bash
cd frontend
npm run dist:win    # Windows installer (.exe)
npm run dist:mac    # macOS disk image (.dmg)
npm run dist:linux  # Linux AppImage
```

---

## 🛠 Tech Stack

| Layer | Tech |
|-------|------|
| Backend | NestJS 10, TypeScript |
| Database | MongoDB 7 + Mongoose |
| Cache/PubSub | Redis 7 + ioredis |
| Real-time | Socket.io 4 |
| Auth | JWT + Passport + bcrypt |
| Frontend | React 18 |
| State | Zustand |
| Desktop | Electron 26 |
| Styling | CSS Modules |
| Encryption | Web Crypto API |
| DevOps | Docker, GitHub Actions |

---

## 📄 License

MIT — free to use in personal and commercial projects.

---

*আড্ডা — Built with ❤️ in Kolkata*
