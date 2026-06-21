# Adda Bug Fixes — Task Tracker

## Files Touched
- `frontend/src/services/socket.js` — Bug #9, Bug #1, Bug #4
- `frontend/src/store/chatStore.js` — Bug #2, Bug #4
- `frontend/src/services/encryption.js` — Bug #7
- `backend/src/gateway/chat.gateway.ts` — Bug #3, Bug #4, Bug #5, CORS
- `backend/src/redis/redis.service.ts` — Bug #8
- `backend/src/chat/chat.service.ts` — Bug #4 (return type)

## Tasks

### frontend/src/services/socket.js
- `[x]` Bug #9 — Fix `message:sent` handler to preserve sender's plaintext when server returns `content: ''`
- `[x]` Bug #1 — Move offline queue flush into `connect` handler (dead code at module level)
- `[x]` Bug #4 — Update `reaction:updated` handler to accept `serverReactions` array

### frontend/src/store/chatStore.js
- `[x]` Bug #2 — Fix `resolveOptimistic` index=0 false-negative (`tempId && 0` → use ternary)
- `[x]` Bug #4 — Update `updateReaction` to use server-provided reactions array when available

### frontend/src/services/encryption.js
- `[x]` Bug #7 — Fix `bufToB64` spread crash on large buffers → use a `for` loop

### backend/src/gateway/chat.gateway.ts
- `[x]` CORS — Lock origin to `FRONTEND_URL` env var (function-based, evaluated at request time)
- `[x]` Bug #3 — Scope `user:status` emits to conversation rooms, not all sockets (connect + disconnect + status:update)
- `[x]` Bug #4 — Emit full `reactions` array from `handleAddReaction` (use returned message from service)
- `[x]` Bug #5 — Add membership check to `conversation:join` handler

### backend/src/redis/redis.service.ts
- `[x]` Bug #8 — Replace blocking `KEYS` with cursor-based `SCAN` in `getTypingUsers`

### backend/src/chat/chat.service.ts
- `[x]` Bug #4 — Change `addReaction` return type from `void` to `Promise<MessageDocument>` and return updated message
