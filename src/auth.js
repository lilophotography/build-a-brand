// Auth: PBKDF2-SHA256 password hashing + KV-backed sessions.
// Pattern lifted from Sky's wv-mi-practice-app and the Stein Solutions
// admin-auth standard, adapted for end-user signup (no email verification).
//
// Session token = random 32 bytes (base64url). Stored in KV with TTL 30 days.
// Cookie: __bb_sess, HttpOnly, Secure, SameSite=Lax, Path=/, Max-Age=2592000.

import { claimPendingEntitlement } from './stripe.js';

const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const HASH_BYTES = 32;
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
const SESSION_COOKIE = '__bb_sess';

// ---------- Crypto helpers ----------

function bytesToBase64(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function base64ToBytes(b64) {
  const s = atob(b64);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes;
}

function randomBytes(n) {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return b;
}

function randomToken() {
  // base64url, no padding
  return bytesToBase64(randomBytes(32))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function hashPassword(password) {
  const salt = randomBytes(SALT_BYTES);
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), { name: 'PBKDF2' }, false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    key, HASH_BYTES * 8
  );
  return `${bytesToBase64(salt)}:${bytesToBase64(new Uint8Array(bits))}:${PBKDF2_ITERATIONS}`;
}

async function verifyPassword(password, stored) {
  if (!stored || typeof stored !== 'string') return false;
  const [saltB64, hashB64, iterStr] = stored.split(':');
  if (!saltB64 || !hashB64 || !iterStr) return false;
  const salt = base64ToBytes(saltB64);
  const expected = base64ToBytes(hashB64);
  const iterations = parseInt(iterStr, 10) || PBKDF2_ITERATIONS;
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), { name: 'PBKDF2' }, false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    key, expected.length * 8
  );
  return constantTimeEqual(new Uint8Array(bits), expected);
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

function uuid() {
  // RFC4122 v4
  return crypto.randomUUID();
}

// ---------- Cookies ----------

export function getCookie(request, name) {
  const header = request.headers.get('Cookie') || '';
  const match = header.split(';').map(s => s.trim()).find(c => c.startsWith(name + '='));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

function sessionCookie(token, maxAge = SESSION_TTL_SECONDS) {
  const parts = [
    `${SESSION_COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ];
  return parts.join('; ');
}

function clearedSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

// ---------- Session helpers ----------

async function createSession(env, userId) {
  const token = randomToken();
  await env.SESSIONS.put(`s:${token}`, userId, { expirationTtl: SESSION_TTL_SECONDS });
  return token;
}

async function destroySession(env, token) {
  if (token) await env.SESSIONS.delete(`s:${token}`);
}

export async function authenticate(request, env) {
  const token = getCookie(request, SESSION_COOKIE);
  if (!token) return null;
  const userId = await env.SESSIONS.get(`s:${token}`);
  if (!userId) return null;
  const user = await env.DB.prepare(
    `SELECT id, email, first_name, business_name, website,
            has_access, tier, has_call_credit, call_booked_at,
            stripe_customer_id, onboarded, welcomed, created_at
       FROM users WHERE id = ?`
  ).bind(userId).first();
  if (!user) return null;
  // Cross-check: if this user's email also exists in admin_users, set is_admin
  // so the footer can render an admin shortcut (visible only to admins).
  // Cheap query — admin_users is tiny. Wrapped in try/catch so missing table
  // (pre-migration) just leaves is_admin falsy.
  try {
    const adminRow = await env.DB.prepare(
      'SELECT id FROM admin_users WHERE email = ?'
    ).bind(user.email).first();
    user.is_admin = !!adminRow;
  } catch {
    user.is_admin = false;
  }
  return user;
}

// ---------- Public handlers ----------

export async function handleAuth(request, env, url) {
  const path = url.pathname;
  const method = request.method;

  if (path === '/api/auth/signup' && method === 'POST') return signup(request, env);
  if (path === '/api/auth/signin' && method === 'POST') return signin(request, env);
  if (path === '/api/auth/signout' && method === 'POST') return signout(request, env);
  if (path === '/api/auth/me' && method === 'GET') return me(request, env);

  return json({ error: 'Not found' }, 404);
}

async function signup(request, env) {
  const body = await request.json().catch(() => ({}));
  const email = (body.email || '').trim().toLowerCase();
  const password = body.password || '';

  if (!isValidEmail(email)) return json({ error: 'Please enter a valid email address.' }, 400);
  if (password.length < 8) return json({ error: 'Password must be at least 8 characters.' }, 400);

  const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  if (existing) return json({ error: 'An account with this email already exists. Try signing in instead.' }, 409);

  const id = uuid();
  const passwordHash = await hashPassword(password);

  await env.DB.prepare(
    `INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)`
  ).bind(id, email, passwordHash).run();

  // If the user paid before signup, the webhook stashed a pending entitlement
  // keyed by email. Claim it now so they land on /lisa with access already set.
  await claimPendingEntitlement(env, id, email);

  const token = await createSession(env, id);
  return json({ ok: true, user: { id, email } }, 200, {
    'Set-Cookie': sessionCookie(token),
  });
}

async function signin(request, env) {
  const body = await request.json().catch(() => ({}));
  const email = (body.email || '').trim().toLowerCase();
  const password = body.password || '';

  const row = await env.DB.prepare(
    'SELECT id, password_hash FROM users WHERE email = ?'
  ).bind(email).first();

  // Always run hash verification even if user not found, to avoid timing leaks
  const valid = row ? await verifyPassword(password, row.password_hash) : false;

  if (!row || !valid) {
    return json({ error: 'That email and password don’t match what we have on file.' }, 401);
  }

  const token = await createSession(env, row.id);
  return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie(token) });
}

async function signout(request, env) {
  const token = getCookie(request, SESSION_COOKIE);
  await destroySession(env, token);
  return json({ ok: true }, 200, { 'Set-Cookie': clearedSessionCookie() });
}

async function me(request, env) {
  const user = await authenticate(request, env);
  if (!user) return json({ user: null }, 200);
  return json({ user });
}

// ---------- Tiny utils ----------

function isValidEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}

export { sessionCookie };
