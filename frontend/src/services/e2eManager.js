/**
 * E2E Manager
 * ────────────
 * Centralises all E2E key lifecycle:
 *   - initialise() on login/register → generate keys if missing, upload public key
 *   - encryptFor(conversationId, plaintext) → encrypted payload
 *   - decryptMsg(message, myUserId) → plaintext
 *   - getConversationKey(conversationId) → CryptoKey (cached)
 */

import api from './api';
import {
  generateKeyPair,
  encryptMessage,
  decryptMessage,
  getSharedKey,
  clearKeyCache,
  saveMyPrivateKey,
  loadMyPrivateKey,
  saveMyPublicKey,
  hasLocalKeyPair,
} from './encryption';

// conversationId → { sharedKey, otherUserPublicKey }
const convKeyCache = new Map();

// ─── Initialise (call after login / register) ─────────────────────────────────

export async function initE2E(userId) {
  try {
    if (hasLocalKeyPair(userId)) {
      console.log('🔑 E2E: Using existing key pair');
      return true;
    }

    console.log('🔑 E2E: Generating new key pair…');
    const { publicKeyB64, privateKeyB64 } = await generateKeyPair();

    // Persist locally
    saveMyPrivateKey(userId, privateKeyB64);
    saveMyPublicKey(userId,  publicKeyB64);

    // Upload public key to server
    await api.post('/auth/public-key', { publicKey: publicKeyB64 });

    console.log('🔑 E2E: Key pair generated and uploaded');
    return true;
  } catch (err) {
    console.error('E2E init failed:', err);
    return false;
  }
}

/** Call on logout to wipe in-memory key cache */
export function teardownE2E() {
  clearKeyCache();
  convKeyCache.clear();
}

// ─── Get shared key for a direct conversation ─────────────────────────────────

/**
 * Returns the AES-GCM shared key for a conversation.
 * For direct chats: derived from ECDH(myPriv, theirPub).
 * Result is cached.
 */
export async function getConvSharedKey(myUserId, otherUserId) {
  const cacheKey = `${myUserId}_${otherUserId}`;
  if (convKeyCache.has(cacheKey)) return convKeyCache.get(cacheKey);

  const myPrivateKeyB64 = loadMyPrivateKey(myUserId);
  if (!myPrivateKeyB64) throw new Error('No local private key — re-login required');

  // Fetch their public key from server
  let theirPublicKeyB64;
  try {
    const { data } = await api.get(`/users/${otherUserId}`);
    theirPublicKeyB64 = data.publicKey;
  } catch {
    throw new Error(`Could not fetch public key for user ${otherUserId}`);
  }

  if (!theirPublicKeyB64) {
    throw new Error('Recipient has no public key — they may need to re-login');
  }

  const sharedKey = await getSharedKey(myUserId, otherUserId, myPrivateKeyB64, theirPublicKeyB64);
  convKeyCache.set(cacheKey, sharedKey);
  return sharedKey;
}

// ─── Encrypt a message ────────────────────────────────────────────────────────

/**
 * Encrypt plaintext for a direct conversation.
 * Returns { encryptedContent, content } where:
 *   - encryptedContent = ciphertext (stored in DB, sent over wire)
 *   - content = original plaintext (kept for our own optimistic bubble display)
 *
 * If encryption fails (e.g. recipient has no key yet), falls back to plaintext.
 */
export async function encryptFor(myUserId, otherUserId, plaintext) {
  try {
    const sharedKey      = await getConvSharedKey(myUserId, otherUserId);
    const encryptedContent = await encryptMessage(sharedKey, plaintext);
    return {
      encryptedContent,
      content: '',          // server stores empty content, only ciphertext
      isEncrypted: true,
    };
  } catch (err) {
    console.warn('E2E encrypt failed, sending plaintext:', err.message);
    return {
      encryptedContent: '',
      content: plaintext,   // fallback: unencrypted
      isEncrypted: false,
    };
  }
}

// ─── Decrypt a message ────────────────────────────────────────────────────────

/**
 * Decrypt an incoming message.
 * Returns the plaintext string, or falls back to message.content if not encrypted.
 *
 * @param message     - The message object (must have encryptedContent + senderId)
 * @param myUserId    - The viewing user's ID
 * @param peerUserId  - The OTHER conversation participant's ID.
 *                      Pass this explicitly so own sent messages don't use
 *                      senderId === myUserId (which produces the wrong ECDH key).
 */
export async function decryptMsg(message, myUserId, peerUserId = null) {
  // Not encrypted or no ciphertext
  if (!message.encryptedContent) return message.content || '';

  try {
    // Bug fix: always use the conversation PEER, not the senderId.
    // For own sent messages senderId === myUserId → old code derived ECDH(myPriv, myPub)
    // which is NOT the shared secret. Using peerUserId fixes both own and received messages.
    const keyPartnerId =
      peerUserId ||
      message.senderId?._id?.toString() ||
      message.senderId?.toString();

    const sharedKey = await getConvSharedKey(myUserId, keyPartnerId);
    const plaintext = await decryptMessage(sharedKey, message.encryptedContent);
    return plaintext ?? message.content ?? '🔒 Could not decrypt';
  } catch (err) {
    console.warn('E2E decryptMsg error:', err.message);
    return message.content || '🔒 Encrypted message';
  }
}

// ─── Check if E2E is available for a conversation ────────────────────────────

export async function isE2EAvailable(myUserId, otherUserId) {
  try {
    if (!hasLocalKeyPair(myUserId)) return false;
    const { data } = await api.get(`/users/${otherUserId}`);
    return !!data.publicKey;
  } catch {
    return false;
  }
}
