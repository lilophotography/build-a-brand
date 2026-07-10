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
  // Cheap query - admin_users is tiny. Wrapped in try/catch so missing table
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

  if (path === '/api/auth/request-code' && method === 'POST') return requestCode(request, env);
  if (path === '/api/auth/verify-code' && method === 'POST') return verifyCode(request, env);
  if (path === '/api/auth/signout' && method === 'POST') return signout(request, env);
  if (path === '/api/auth/me' && method === 'GET') return me(request, env);

  return json({ error: 'Not found' }, 404);
}

// ---------- Passwordless email-code login ----------
// Flow: request-code emails a 6-digit code (15 min TTL). verify-code checks it,
// creates the member row on first login, claims any pre-paid entitlement, and
// opens a 30-day session. Admins (email in admin_users) also get an admin_token
// back so the /admin panel opens from the same login. No passwords anywhere.

const CODE_TTL_SECONDS = 15 * 60;
const CODE_RESEND_THROTTLE_MS = 30 * 1000;
const MAX_CODE_ATTEMPTS = 5;

function generateCode() {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1000000;
  return String(n).padStart(6, '0');
}

// Only email codes to addresses we recognise: an existing member, a paid buyer
// whose entitlement is waiting, or an admin. Everyone else gets a silent ok so
// we never reveal who has an account.
async function isKnownEmail(env, email) {
  const u = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  if (u) return true;
  const pending = await env.SESSIONS.get(`pe:${email}`);
  if (pending) return true;
  try {
    const a = await env.DB.prepare('SELECT id FROM admin_users WHERE email = ?').bind(email).first();
    if (a) return true;
  } catch {}
  return false;
}

async function requestCode(request, env) {
  const body = await request.json().catch(() => ({}));
  const email = (body.email || '').trim().toLowerCase();
  if (!isValidEmail(email)) return json({ error: 'Please enter a valid email address.' }, 400);

  // Always answer the same way, whether or not we send anything.
  if (!(await isKnownEmail(env, email))) return json({ ok: true });

  // Light throttle: at most one code per email per 30 seconds.
  const existing = await env.SESSIONS.get(`authcode:${email}`, 'json');
  if (existing && existing.sentAt && (Date.now() - existing.sentAt) < CODE_RESEND_THROTTLE_MS) {
    return json({ ok: true });
  }

  const code = generateCode();
  await env.SESSIONS.put(
    `authcode:${email}`,
    JSON.stringify({ code, attempts: 0, sentAt: Date.now() }),
    { expirationTtl: CODE_TTL_SECONDS }
  );
  await sendCodeEmail(env, email, code);
  return json({ ok: true });
}

async function verifyCode(request, env) {
  const body = await request.json().catch(() => ({}));
  const email = (body.email || '').trim().toLowerCase();
  const code = (body.code || '').trim();
  if (!isValidEmail(email) || !/^\d{6}$/.test(code)) {
    return json({ error: 'Enter the 6-digit code we emailed you.' }, 400);
  }

  const record = await env.SESSIONS.get(`authcode:${email}`, 'json');
  if (!record) return json({ error: 'That code has expired. Request a new one.' }, 400);

  if (record.attempts >= MAX_CODE_ATTEMPTS) {
    await env.SESSIONS.delete(`authcode:${email}`);
    return json({ error: 'Too many tries. Request a new code.' }, 429);
  }

  if (code !== record.code) {
    record.attempts += 1;
    await env.SESSIONS.put(`authcode:${email}`, JSON.stringify(record), { expirationTtl: CODE_TTL_SECONDS });
    return json({ error: 'That code isn’t right. Try again.' }, 401);
  }

  // Correct: burn the code so it can't be reused.
  await env.SESSIONS.delete(`authcode:${email}`);

  // Find or create the member. Passwordless rows carry an empty password_hash.
  const row = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  let userId;
  if (row) {
    userId = row.id;
  } else {
    userId = uuid();
    await env.DB.prepare(
      'INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)'
    ).bind(userId, email, '').run();
  }

  // Apply any pre-purchased entitlement now that we have a user id.
  await claimPendingEntitlement(env, userId, email);

  const token = await createSession(env, userId);

  // Unified login: also open the admin panel when this email is an admin.
  let adminToken = null;
  try {
    const adminRow = await env.DB.prepare(
      'SELECT id FROM admin_users WHERE email = ?'
    ).bind(email).first();
    if (adminRow) adminToken = await mintAdminSession(env, adminRow.id);
  } catch {}

  return json({ ok: true, ...(adminToken ? { admin_token: adminToken } : {}) }, 200, { 'Set-Cookie': sessionCookie(token) });
}

async function sendCodeEmail(env, email, code) {
  if (!env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY missing - cannot email login code to', email);
    return;
  }
  const html = `<div style="font-family: Lato, Helvetica, Arial, sans-serif; color: #161616; max-width: 480px; margin: 0 auto; padding: 24px;">
<p style="font-size:11px;letter-spacing:0.3em;text-transform:uppercase;color:#AF493B;font-weight:700;margin:0 0 16px;">The Next Level Brand Experience</p>
<h1 style="font-family: 'Times New Roman', Times, serif; font-weight: 400; font-size: 26px; margin: 0 0 12px;">Your sign-in code</h1>
<p style="font-size:15px;line-height:1.6;margin:0 0 20px;color:#3A3A3A;">Enter this code to sign in. It expires in 15 minutes.</p>
<p style="font-family:'Times New Roman',Times,serif;font-size:40px;letter-spacing:0.18em;font-weight:400;margin:0 0 24px;color:#161616;">${code}</p>
<p style="font-size:13px;color:#6B6660;line-height:1.6;margin:0;">If you didn't ask to sign in, you can ignore this email.<br>Lisa</p>
</div>`;
  const text = `Your sign-in code is ${code}. It expires in 15 minutes. If you didn't ask to sign in, ignore this email.`;
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + env.RESEND_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'The Next Level Brand Experience <hello@email.lilobrandstudio.com>',
        to: [email],
        reply_to: 'lisa@photolilo.com',
        subject: `Your sign-in code: ${code}`,
        html,
        text,
      }),
    });
  } catch (err) {
    console.error('Login code email failed for', email, err.message);
  }
}

async function mintAdminSession(env, adminId) {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const token = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  await env.DB.prepare(
    'INSERT INTO admin_sessions (admin_id, token, expires_at) VALUES (?, ?, ?)'
  ).bind(adminId, token, expiresAt).run();
  return token;
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
