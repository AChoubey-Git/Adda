/**
 * Adda — End-to-End Encryption
 * ─────────────────────────────
 * Protocol:  ECDH P-256  key exchange  →  AES-GCM 256-bit  message encryption
 * Standard:  Web Crypto API (browser-native, zero dependencies)
 *
 * Flow (first message in a conversation):
 *  1. On register/login → generate ECDH key pair, upload public key to server
 *  2. Sender fetches recipient's public key from server
 *  3. ECDH derive → shared secret (never leaves either device)
 *  4. Each message encrypted with AES-GCM using shared secret + random IV
 *  5. Ciphertext + IV sent to server  (server stores only ciphertext, cannot read)
 *  6. Recipient derives same shared secret and decrypts locally
 *
 * Key storage:
 *  - Private key  → localStorage  (never sent anywhere)
 *  - Public key   → server  (used by other users to derive shared secret)
 *  - Shared keys  → in-memory cache  (re-derived when needed)
 */

const ECDH_ALGO  = { name: 'ECDH', namedCurve: 'P-256' };
const AES_ALGO   = { name: 'AES-GCM', length: 256 };
const KEY_PREFIX = 'adda_e2e_';

// In-memory cache: `${myUserId}_${theirUserId}` → CryptoKey
const sharedKeyCache = new Map();

// ─── Key Generation ───────────────────────────────────────────────────────────

/**
 * Generate a new ECDH P-256 key pair.
 * Returns { publicKeyB64, privateKeyB64 } for storage.
 */
export async function generateKeyPair() {
  const pair = await crypto.subtle.generateKey(ECDH_ALGO, true, ['deriveKey', 'deriveBits']);

  const [pubRaw, privRaw] = await Promise.all([
    crypto.subtle.exportKey('spki',  pair.publicKey),
    crypto.subtle.exportKey('pkcs8', pair.privateKey),
  ]);

  return {
    publicKeyB64:  bufToB64(pubRaw),
    privateKeyB64: bufToB64(privRaw),
  };
}

// ─── Key Import ───────────────────────────────────────────────────────────────

export async function importPublicKey(b64) {
  return crypto.subtle.importKey(
    'spki',
    b64ToBuf(b64),
    ECDH_ALGO,
    true,
    [], // public key has no usages in ECDH
  );
}

export async function importPrivateKey(b64) {
  return crypto.subtle.importKey(
    'pkcs8',
    b64ToBuf(b64),
    ECDH_ALGO,
    true,
    ['deriveKey', 'deriveBits'],
  );
}

// ─── Shared Secret Derivation ─────────────────────────────────────────────────

/**
 * Derive shared AES-GCM key from MY private key + THEIR public key.
 * Result is cached in memory — ECDH always produces the same secret for a pair.
 */
export async function getSharedKey(myUserId, theirUserId, myPrivateKeyB64, theirPublicKeyB64) {
  const cacheKey = `${myUserId}_${theirUserId}`;
  if (sharedKeyCache.has(cacheKey)) return sharedKeyCache.get(cacheKey);

  const myPrivate    = await importPrivateKey(myPrivateKeyB64);
  const theirPublic  = await importPublicKey(theirPublicKeyB64);

  const shared = await crypto.subtle.deriveKey(
    { name: 'ECDH', public: theirPublic },
    myPrivate,
    AES_ALGO,
    false,           // not extractable
    ['encrypt', 'decrypt'],
  );

  sharedKeyCache.set(cacheKey, shared);
  return shared;
}

/** Clear cache on logout */
export function clearKeyCache() {
  sharedKeyCache.clear();
}

// ─── Encrypt ──────────────────────────────────────────────────────────────────

/**
 * Encrypt a plaintext string.
 * Returns a single base64 string:  IV(12 bytes) + ciphertext
 * This makes it easy to store as one field and parse on decrypt.
 */
export async function encryptMessage(sharedKey, plaintext) {
  const iv      = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    sharedKey,
    encoded,
  );

  // Combine iv + ciphertext into one array
  const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.byteLength);

  return bufToB64(combined.buffer);
}

// ─── Decrypt ──────────────────────────────────────────────────────────────────

/**
 * Decrypt a combined base64 string (IV + ciphertext).
 * Returns plaintext string, or null if decryption fails.
 */
export async function decryptMessage(sharedKey, combinedB64) {
  try {
    const combined   = b64ToBuf(combinedB64);
    const iv         = combined.slice(0, 12);
    const ciphertext = combined.slice(12);

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(iv) },
      sharedKey,
      ciphertext,
    );

    return new TextDecoder().decode(decrypted);
  } catch (err) {
    console.error('E2E decrypt failed:', err.message);
    return null; // graceful fallback
  }
}

// ─── Local key storage ────────────────────────────────────────────────────────

export function saveMyPrivateKey(userId, privateKeyB64) {
  localStorage.setItem(`${KEY_PREFIX}priv_${userId}`, privateKeyB64);
}

export function loadMyPrivateKey(userId) {
  return localStorage.getItem(`${KEY_PREFIX}priv_${userId}`);
}

export function saveMyPublicKey(userId, publicKeyB64) {
  localStorage.setItem(`${KEY_PREFIX}pub_${userId}`, publicKeyB64);
}

export function loadMyPublicKey(userId) {
  return localStorage.getItem(`${KEY_PREFIX}pub_${userId}`);
}

/** True if this user already has a key pair on this device */
export function hasLocalKeyPair(userId) {
  return (
    !!localStorage.getItem(`${KEY_PREFIX}priv_${userId}`) &&
    !!localStorage.getItem(`${KEY_PREFIX}pub_${userId}`)
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Bug #7 fix: spread crashes with RangeError on buffers > ~65 KB (e.g. encrypted files)
function bufToB64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function b64ToBuf(b64) {
  const binary = atob(b64);
  const bytes  = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}
