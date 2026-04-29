// ============================================
// Admin API Routes
// All routes require admin auth (except Stripe webhook).
// Handles member management, payments, activity, stats.
// ============================================

import { authenticateAdmin } from './admin-auth.js';
import { handleStripeWebhook } from './admin-stripe.js';
import { cleanupActivityLog } from './admin-activity.js';

export async function handleAdminAPI(request, env, url) {
  // Stripe webhook — no admin auth, uses signature verification
  if (url.pathname === '/admin/api/stripe/webhook' && request.method === 'POST') {
    return handleStripeWebhook(request, env);
  }

  // All other admin routes require admin auth
  const admin = await authenticateAdmin(request, env);
  if (!admin) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const method = request.method;
  const path = url.pathname;

  // --- Members ---
  if (path === '/admin/api/members' && method === 'GET') return listMembers(env, url);
  if (path.match(/^\/admin\/api\/members\/\d+$/) && method === 'GET') return getMember(env, url);
  if (path.match(/^\/admin\/api\/members\/\d+$/) && method === 'PUT') return updateMember(request, env, url);
  if (path.match(/^\/admin\/api\/members\/\d+$/) && method === 'DELETE') return deactivateMember(env, url);
  if (path === '/admin/api/members/invite' && method === 'POST') return inviteMember(request, env);

  // --- Payments ---
  if (path.match(/^\/admin\/api\/members\/\d+\/payments$/) && method === 'GET') return getMemberPayments(env, url);
  if (path === '/admin/api/revenue' && method === 'GET') return getRevenue(env);

  // --- Activity ---
  if (path === '/admin/api/activity' && method === 'GET') return getActivity(env, url);
  if (path.match(/^\/admin\/api\/members\/\d+\/activity$/) && method === 'GET') return getMemberActivity(env, url);
  if (path === '/admin/api/activity/cleanup' && method === 'DELETE') return doCleanup(env);

  // --- Progress ---
  if (path.match(/^\/admin\/api\/members\/\d+\/progress$/) && method === 'GET') return getMemberProgress(env, url);

  // --- Dashboard Stats ---
  if (path === '/admin/api/stats' && method === 'GET') return getDashboardStats(env);

  return json({ error: 'Not found' }, 404);
}

// =====================
// MEMBER MANAGEMENT
// =====================

async function listMembers(env, url) {
  const params = url.searchParams;
  const search = params.get('search') || '';
  const tier = params.get('tier') || '';
  const status = params.get('status') || '';
  const sort = params.get('sort') || 'created_at';
  const page = parseInt(params.get('page') || '1');
  const limit = Math.min(parseInt(params.get('limit') || '25'), 100);
  const offset = (page - 1) * limit;

  // Build WHERE clause
  const conditions = [];
  const binds = [];

  if (search) {
    conditions.push("(u.email LIKE ? OR u.name LIKE ?)");
    binds.push(`%${search}%`, `%${search}%`);
  }
  if (tier) {
    conditions.push("u.tier = ?");
    binds.push(tier);
  }
  if (status) {
    conditions.push("u.status = ?");
    binds.push(status);
  } else {
    // Default: don't show deactivated
    conditions.push("u.status != 'deactivated'");
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  // Validate sort column
  const validSorts = ['created_at', 'name', 'email', 'last_active', 'tier'];
  const sortCol = validSorts.includes(sort) ? sort : 'created_at';
  const sortDir = sort === 'name' || sort === 'email' ? 'ASC' : 'DESC';

  // Count total
  const countQuery = `SELECT COUNT(*) as total FROM users u ${where}`;
  const countStmt = env.DB.prepare(countQuery);
  const countResult = await (binds.length ? countStmt.bind(...binds) : countStmt).first();

  // Fetch members with subscription data
  const query = `
    SELECT u.id, u.email, u.name, u.tier, u.status, u.role, u.created_at, u.last_active, u.notes,
           s.plan_name as sub_plan, s.amount_cents as sub_amount, s.status as sub_status,
           (SELECT COUNT(*) FROM activity_log a WHERE a.user_id = u.id AND a.action = 'login') as login_count,
           (SELECT SUM(p.amount_cents) FROM payments p WHERE p.user_id = u.id AND p.status = 'succeeded') as total_paid_cents
    FROM users u
    LEFT JOIN subscriptions s ON s.user_id = u.id AND s.status IN ('active', 'past_due')
    ${where}
    ORDER BY u.${sortCol} ${sortDir}
    LIMIT ? OFFSET ?
  `;

  const allBinds = [...binds, limit, offset];
  const result = await env.DB.prepare(query).bind(...allBinds).all();

  return json({
    members: result.results.map(m => ({
      id: m.id,
      email: m.email,
      name: m.name,
      tier: m.tier,
      status: m.status || 'active',
      role: m.role || 'member',
      created_at: m.created_at,
      last_active: m.last_active || null,
      notes: m.notes || '',
      subscription: m.sub_plan ? { plan_name: m.sub_plan, amount_cents: m.sub_amount || 0, status: m.sub_status } : null,
      total_paid_cents: m.total_paid_cents || 0,
      login_count: m.login_count || 0,
    })),
    total: countResult.total,
    page,
    pages: Math.ceil(countResult.total / limit),
  });
}

async function getMember(env, url) {
  const id = url.pathname.split('/').pop();

  const member = await env.DB.prepare(
    `SELECT u.*,
            (SELECT SUM(p.amount_cents) FROM payments p WHERE p.user_id = u.id AND p.status = 'succeeded') as total_paid_cents,
            (SELECT COUNT(*) FROM activity_log a WHERE a.user_id = u.id AND a.action = 'login') as login_count
     FROM users u WHERE u.id = ?`
  ).bind(id).first();

  if (!member) return json({ error: 'Member not found' }, 404);

  // Get active subscription
  const subscription = await env.DB.prepare(
    "SELECT * FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1"
  ).bind(id).first();

  return json({
    member: {
      id: member.id,
      email: member.email,
      name: member.name,
      tier: member.tier,
      status: member.status || 'active',
      role: member.role || 'member',
      created_at: member.created_at,
      last_active: member.last_active || null,
      notes: member.notes || '',
      stripe_customer_id: member.stripe_customer_id || '',
      total_paid_cents: member.total_paid_cents || 0,
      login_count: member.login_count || 0,
    },
    subscription: subscription || null,
  });
}

async function updateMember(request, env, url) {
  const id = url.pathname.split('/').pop();
  const updates = await request.json();

  // Only allow updating specific fields
  const allowed = ['tier', 'status', 'role', 'notes'];
  const sets = [];
  const binds = [];

  for (const field of allowed) {
    if (updates[field] !== undefined) {
      sets.push(`${field} = ?`);
      binds.push(updates[field]);
    }
  }

  if (sets.length === 0) return json({ error: 'No valid fields to update' }, 400);

  sets.push("updated_at = datetime('now')");
  binds.push(id);

  await env.DB.prepare(
    `UPDATE users SET ${sets.join(', ')} WHERE id = ?`
  ).bind(...binds).run();

  return json({ ok: true });
}

async function deactivateMember(env, url) {
  const id = url.pathname.split('/').pop();

  await env.DB.prepare(
    "UPDATE users SET status = 'deactivated', updated_at = datetime('now') WHERE id = ?"
  ).bind(id).run();

  // Invalidate their sessions
  await env.DB.prepare(
    'DELETE FROM sessions WHERE user_id = ?'
  ).bind(id).run();

  return json({ ok: true });
}

async function inviteMember(request, env) {
  const { email, name, tier } = await request.json();
  if (!email || !name) return json({ error: 'Email and name are required' }, 400);

  const existing = await env.DB.prepare(
    'SELECT id FROM users WHERE email = ?'
  ).bind(email.toLowerCase()).first();
  if (existing) return json({ error: 'User already exists' }, 409);

  // Generate a temporary password (admin gives it to the user)
  const tempPassword = generateTempPassword();
  const passwordHash = await hashPasswordSimple(tempPassword);

  const result = await env.DB.prepare(
    'INSERT INTO users (email, password_hash, name, tier) VALUES (?, ?, ?, ?)'
  ).bind(email.toLowerCase(), passwordHash, name, tier || 'free').run();

  return json({
    ok: true,
    user_id: result.meta.last_row_id,
    temp_password: tempPassword,
    message: 'Share this temporary password with the user. They should change it on first login.',
  });
}

// Simple password hash for invites (same as auth.js pattern)
async function hashPasswordSimple(password) {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = Array.from(salt, b => b.toString(16).padStart(2, '0')).join('');
  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const hash = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, keyMaterial, 256);
  const hashHex = Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
  return `${saltHex}:${hashHex}`;
}

function generateTempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let password = '';
  const array = new Uint8Array(12);
  crypto.getRandomValues(array);
  for (const byte of array) {
    password += chars[byte % chars.length];
  }
  return password;
}

// =====================
// PAYMENTS
// =====================

async function getMemberPayments(env, url) {
  const id = url.pathname.split('/')[4]; // /admin/api/members/:id/payments

  const payments = await env.DB.prepare(
    'SELECT * FROM payments WHERE user_id = ? ORDER BY paid_at DESC LIMIT 50'
  ).bind(id).all();

  return json({ payments: payments.results });
}

async function getRevenue(env) {
  // MRR from active subscriptions
  const mrr = await env.DB.prepare(
    "SELECT SUM(amount_cents) as mrr FROM subscriptions WHERE status = 'active' AND interval_type = 'month'"
  ).first();

  // Total revenue all time
  const total = await env.DB.prepare(
    "SELECT SUM(amount_cents) as total FROM payments WHERE status = 'succeeded'"
  ).first();

  // Revenue by month (last 6 months)
  const monthly = await env.DB.prepare(
    `SELECT strftime('%Y-%m', paid_at) as month, SUM(amount_cents) as total
     FROM payments WHERE status = 'succeeded' AND paid_at > datetime('now', '-6 months')
     GROUP BY strftime('%Y-%m', paid_at) ORDER BY month DESC`
  ).all();

  // Paying members
  const paying = await env.DB.prepare(
    `SELECT u.id, u.name, u.email, s.amount_cents, s.plan_name
     FROM users u JOIN subscriptions s ON s.user_id = u.id
     WHERE s.status = 'active' ORDER BY s.amount_cents DESC`
  ).all();

  return json({
    mrr_cents: mrr?.mrr || 0,
    total_revenue_cents: total?.total || 0,
    monthly: monthly.results,
    paying_members: paying.results,
  });
}

// =====================
// ACTIVITY
// =====================

async function getActivity(env, url) {
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
  const offset = (page - 1) * limit;

  const result = await env.DB.prepare(
    `SELECT a.*, u.name as user_name, u.email as user_email
     FROM activity_log a
     LEFT JOIN users u ON a.user_id = u.id
     ORDER BY a.created_at DESC
     LIMIT ? OFFSET ?`
  ).bind(limit, offset).all();

  return json({ activity: result.results, page });
}

async function getMemberActivity(env, url) {
  const id = url.pathname.split('/')[4]; // /admin/api/members/:id/activity

  const result = await env.DB.prepare(
    'SELECT * FROM activity_log WHERE user_id = ? ORDER BY created_at DESC LIMIT 100'
  ).bind(id).all();

  return json({ activity: result.results });
}

async function doCleanup(env) {
  const deleted = await cleanupActivityLog(env, 90);
  return json({ ok: true, deleted });
}

// =====================
// PROGRESS (App-Specific)
// =====================

async function getMemberProgress(env, url) {
  const id = url.pathname.split('/')[4]; // /admin/api/members/:id/progress
  const progress = await getProgressForUser(env, parseInt(id));
  return json({ progress });
}

// ============================================
// CUSTOMIZE THIS FUNCTION FOR EACH APP
// ============================================
// This is the adapter — implement it based on
// what the app tracks. Examples in progress-adapters.md.
// ============================================
async function getProgressForUser(env, userId) {
  // Default: return empty. Replace with app-specific queries.
  // See references/progress-adapters.md for examples.
  return {
    message: 'Progress adapter not configured. See admin-api.js getProgressForUser().',
  };
}

// =====================
// DASHBOARD STATS
// =====================

async function getDashboardStats(env) {
  const total = await env.DB.prepare(
    "SELECT COUNT(*) as c FROM users WHERE status != 'deactivated'"
  ).first();

  const active7d = await env.DB.prepare(
    "SELECT COUNT(DISTINCT user_id) as c FROM activity_log WHERE created_at > datetime('now', '-7 days')"
  ).first();

  const active30d = await env.DB.prepare(
    "SELECT COUNT(DISTINCT user_id) as c FROM activity_log WHERE created_at > datetime('now', '-30 days')"
  ).first();

  const newThisMonth = await env.DB.prepare(
    "SELECT COUNT(*) as c FROM users WHERE created_at > datetime('now', 'start of month') AND status != 'deactivated'"
  ).first();

  const mrr = await env.DB.prepare(
    "SELECT SUM(amount_cents) as mrr FROM subscriptions WHERE status = 'active' AND interval_type = 'month'"
  ).first();

  const tiers = await env.DB.prepare(
    "SELECT tier, COUNT(*) as count FROM users WHERE status != 'deactivated' GROUP BY tier"
  ).all();

  const tierBreakdown = {};
  for (const row of tiers.results) {
    tierBreakdown[row.tier] = row.count;
  }

  // Daily active users (last 14 days)
  const daily = await env.DB.prepare(
    `SELECT date(created_at) as date, COUNT(DISTINCT user_id) as count
     FROM activity_log
     WHERE created_at > datetime('now', '-14 days')
     GROUP BY date(created_at)
     ORDER BY date DESC`
  ).all();

  return json({
    total_users: total?.c || 0,
    active_last_7d: active7d?.c || 0,
    active_last_30d: active30d?.c || 0,
    new_this_month: newThisMonth?.c || 0,
    mrr_cents: mrr?.mrr || 0,
    tier_breakdown: tierBreakdown,
    daily_active: daily.results,
  });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
