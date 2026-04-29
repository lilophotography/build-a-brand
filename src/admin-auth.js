// ============================================
// Admin Authentication Module
// Completely separate from user auth.
// Admin accounts live in admin_users table.
// Includes: rate limiting, audit logging, one-time setup.
// ============================================

export async function handleAdminAuth(request, env, url) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  if (request.method !== 'POST' && !(url.pathname === '/admin/api/auth/me' && request.method === 'GET')) {
    return json({ error: 'Method not allowed' }, 405);
  }

  if (url.pathname === '/admin/api/auth/me') return adminMe(request, env);
  if (url.pathname === '/admin/api/auth/login') return adminLogin(request, env);
  if (url.pathname === '/admin/api/auth/logout') return adminLogout(request, env);
  if (url.pathname === '/admin/api/auth/setup') return adminSetup(request, env);

  return json({ error: 'Not found' }, 404);
}

// =====================
// ONE-TIME SETUP
// =====================
// Creates the first admin account.
// Requires ADMIN_SETUP_KEY env var. Delete the key after first use.
async function adminSetup(request, env) {
  const { key, email, password, name } = await request.json();

  if (!env.ADMIN_SETUP_KEY || key !== env.ADMIN_SETUP_KEY) {
    return json({ error: 'Invalid setup key' }, 403);
  }

  if (!email || !password || !name) {
    return json({ error: 'Email, password, and name are required' }, 400);
  }

  const existing = await env.DB.prepare(
    'SELECT id FROM admin_users WHERE email = ?'
  ).bind(email.toLowerCase()).first();
  if (existing) {
    return json({ error: 'Admin account already exists' }, 409);
  }

  const passwordHash = await hashPassword(password);
  await env.DB.prepare(
    'INSERT INTO admin_users (email, password_hash, name) VALUES (?, ?, ?)'
  ).bind(email.toLowerCase(), passwordHash, name).run();

  return json({ ok: true, message: 'Admin account created. Delete ADMIN_SETUP_KEY from wrangler.toml now.' });
}

// =====================
// LOGIN (with rate limiting)
// =====================
async function adminLogin(request, env) {
  const { email, password } = await request.json();
  if (!email || !password) {
    return json({ error: 'Email and password are required' }, 400);
  }

  const emailLower = email.toLowerCase();
  const ip = request.headers.get('CF-Connecting-IP') || '';

  // Rate limiting: check failed attempts
  const locked = await checkRateLimit(env, emailLower);
  if (locked) {
    await auditLog(env, null, 'login_blocked', `Rate limited: ${emailLower}`, ip);
    return json({ error: 'Too many login attempts. Try again in 15 minutes.' }, 429);
  }

  const admin = await env.DB.prepare(
    'SELECT id, email, password_hash, name FROM admin_users WHERE email = ?'
  ).bind(emailLower).first();

  if (!admin) {
    await recordFailedAttempt(env, emailLower);
    await auditLog(env, null, 'login_failed', `Unknown email: ${emailLower}`, ip);
    return json({ error: 'Invalid credentials' }, 401);
  }

  const valid = await verifyPassword(password, admin.password_hash);
  if (!valid) {
    await recordFailedAttempt(env, emailLower);
    await auditLog(env, admin.id, 'login_failed', 'Wrong password', ip);
    return json({ error: 'Invalid credentials' }, 401);
  }

  // Success — clear rate limit and create session
  await clearRateLimit(env, emailLower);
  const token = await createAdminSession(admin.id, env);
  await auditLog(env, admin.id, 'login_success', '', ip);

  return json({ token, admin: { id: admin.id, email: admin.email, name: admin.name } });
}

// =====================
// LOGOUT
// =====================
async function adminLogout(request, env) {
  const token = getAdminToken(request);
  if (token) {
    await env.DB.prepare('DELETE FROM admin_sessions WHERE token = ?').bind(token).run();
  }
  return json({ ok: true });
}

// =====================
// SESSION CHECK
// =====================
async function adminMe(request, env) {
  const admin = await authenticateAdmin(request, env);
  if (!admin) return json({ error: 'Unauthorized' }, 401);
  return json({ admin });
}

// Shared admin auth check — import this in other admin modules
export async function authenticateAdmin(request, env) {
  const token = getAdminToken(request);
  if (!token) return null;

  const session = await env.DB.prepare(
    "SELECT a.admin_id, au.email, au.name FROM admin_sessions a JOIN admin_users au ON a.admin_id = au.id WHERE a.token = ? AND a.expires_at > datetime('now')"
  ).bind(token).first();

  if (!session) return null;
  return { id: session.admin_id, email: session.email, name: session.name };
}

function getAdminToken(request) {
  const auth = request.headers.get('Authorization');
  if (auth && auth.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

async function createAdminSession(adminId, env) {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await env.DB.prepare(
    'INSERT INTO admin_sessions (admin_id, token, expires_at) VALUES (?, ?, ?)'
  ).bind(adminId, token, expiresAt).run();
  return token;
}

// =====================
// RATE LIMITING
// =====================

const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

async function checkRateLimit(env, email) {
  try {
    const row = await env.DB.prepare(
      'SELECT attempts, locked_until FROM login_attempts WHERE email = ?'
    ).bind(email).first();

    if (!row) return false;

    if (row.locked_until) {
      const lockedUntil = new Date(row.locked_until + 'Z');
      if (lockedUntil > new Date()) return true;
      await clearRateLimit(env, email);
      return false;
    }

    return false;
  } catch {
    return false;
  }
}

async function recordFailedAttempt(env, email) {
  try {
    const row = await env.DB.prepare(
      'SELECT attempts FROM login_attempts WHERE email = ?'
    ).bind(email).first();

    if (!row) {
      await env.DB.prepare(
        "INSERT INTO login_attempts (email, attempts, first_attempt) VALUES (?, 1, datetime('now'))"
      ).bind(email).run();
      return;
    }

    const newAttempts = row.attempts + 1;
    if (newAttempts >= MAX_ATTEMPTS) {
      await env.DB.prepare(
        `UPDATE login_attempts SET attempts = ?, locked_until = datetime('now', '+${LOCKOUT_MINUTES} minutes') WHERE email = ?`
      ).bind(newAttempts, email).run();
    } else {
      await env.DB.prepare(
        'UPDATE login_attempts SET attempts = ? WHERE email = ?'
      ).bind(newAttempts, email).run();
    }
  } catch {
    // Table doesn't exist — create it and record this attempt
    try {
      await env.DB.prepare(`CREATE TABLE IF NOT EXISTS login_attempts (
        email TEXT PRIMARY KEY, attempts INTEGER DEFAULT 0,
        first_attempt TEXT DEFAULT (datetime('now')), locked_until TEXT
      )`).run();
      await env.DB.prepare(
        "INSERT INTO login_attempts (email, attempts, first_attempt) VALUES (?, 1, datetime('now'))"
      ).bind(email).run();
    } catch {}
  }
}

async function clearRateLimit(env, email) {
  try {
    await env.DB.prepare('DELETE FROM login_attempts WHERE email = ?').bind(email).run();
  } catch {}
}

// =====================
// AUDIT LOGGING
// =====================

export async function auditLog(env, adminId, action, detail, ip) {
  try {
    await env.DB.prepare(
      'INSERT INTO admin_audit_log (admin_id, action, detail, ip_address) VALUES (?, ?, ?, ?)'
    ).bind(adminId, action, detail || '', ip || '').run();
  } catch {
    try {
      await env.DB.prepare(`CREATE TABLE IF NOT EXISTS admin_audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT, admin_id INTEGER,
        action TEXT NOT NULL, detail TEXT DEFAULT '',
        ip_address TEXT DEFAULT '', created_at TEXT DEFAULT (datetime('now'))
      )`).run();
      await env.DB.prepare(
        'INSERT INTO admin_audit_log (admin_id, action, detail, ip_address) VALUES (?, ?, ?, ?)'
      ).bind(adminId, action, detail || '', ip || '').run();
    } catch {}
  }
}

// =====================
// CRYPTO
// =====================

function generateToken() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = Array.from(salt, b => b.toString(16).padStart(2, '0')).join('');
  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const hash = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, keyMaterial, 256);
  const hashHex = Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
  return `${saltHex}:${hashHex}`;
}

async function verifyPassword(password, stored) {
  const [saltHex, storedHash] = stored.split(':');
  const salt = new Uint8Array(saltHex.match(/.{2}/g).map(h => parseInt(h, 16)));
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const hash = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, keyMaterial, 256);
  const hashHex = Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
  return hashHex === storedHash;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
