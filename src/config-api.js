// ============================================
// Config Admin API
// All routes require admin auth.
// Includes audit logging for all changes.
//
// Note: there is intentionally NO /admin/api/secrets/status route and no
// admin UI surface for Stripe/Anthropic keys. Worker secrets are configured
// exclusively via `wrangler secret put`. Surfacing them in any form (even as
// status dots) creates a UX path that invites operators to paste keys into
// a browser. Removed 2026-04-30.
// ============================================

import { authenticateAdmin, auditLog } from './admin-auth.js';
import { getDefaults, getConfig } from './config.js';

// Public endpoint — returns branding + copy only, no auth needed
export async function handlePublicConfig(env) {
  const config = await getConfig(env);
  return json({
    branding: config.branding || {},
    copy: config.copy || {},
  });
}

export async function handleConfigAPI(request, env, url) {
  // All config routes require admin auth
  const admin = await authenticateAdmin(request, env);
  if (!admin) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const method = request.method;
  const path = url.pathname;

  if (path === '/admin/api/config' && method === 'GET') return getConfigValues(env, url);
  if (path === '/admin/api/config' && method === 'PUT') return upsertConfig(request, env, admin);
  if (path === '/admin/api/config/reset' && method === 'POST') return resetConfig(request, env, admin);
  if (path === '/admin/api/config/defaults' && method === 'GET') return getDefaultValues();

  return json({ error: 'Not found' }, 404);
}

async function ensureTable(env) {
  try {
    await env.DB.prepare('SELECT 1 FROM app_config LIMIT 1').first();
  } catch {
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS app_config (
      key TEXT NOT NULL, value TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'general',
      updated_at TEXT DEFAULT (datetime('now')),
      updated_by TEXT DEFAULT '',
      PRIMARY KEY (category, key)
    )`).run();
    await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_config_category ON app_config(category)').run();
  }
}

// GET /admin/api/config?category=prompts
async function getConfigValues(env, url) {
  await ensureTable(env);
  const category = url.searchParams.get('category');

  let rows;
  if (category) {
    rows = await env.DB.prepare(
      'SELECT category, key, value, updated_at, updated_by FROM app_config WHERE category = ? ORDER BY key'
    ).bind(category).all();
  } else {
    rows = await env.DB.prepare(
      'SELECT category, key, value, updated_at, updated_by FROM app_config ORDER BY category, key'
    ).all();
  }

  const config = {};
  for (const row of rows.results) {
    if (!config[row.category]) config[row.category] = {};
    let parsedValue;
    try { parsedValue = JSON.parse(row.value); }
    catch { parsedValue = row.value; }
    config[row.category][row.key] = {
      value: parsedValue,
      updated_at: row.updated_at,
      updated_by: row.updated_by,
    };
  }

  return json({ config });
}

// PUT /admin/api/config — { items: [{ category, key, value }] }
async function upsertConfig(request, env, admin) {
  await ensureTable(env);
  const { items } = await request.json();

  if (!items || !Array.isArray(items) || items.length === 0) {
    return json({ error: 'items array is required' }, 400);
  }

  const validCategories = ['prompts', 'branding', 'copy', 'settings'];
  for (const item of items) {
    if (!item.category || !item.key || item.value === undefined) {
      return json({ error: 'Each item needs category, key, and value' }, 400);
    }
    if (!validCategories.includes(item.category)) {
      return json({ error: `Invalid category: ${item.category}` }, 400);
    }
  }

  const stmt = env.DB.prepare(
    `INSERT INTO app_config (category, key, value, updated_at, updated_by)
     VALUES (?, ?, ?, datetime('now'), ?)
     ON CONFLICT(category, key) DO UPDATE SET
       value = excluded.value,
       updated_at = excluded.updated_at,
       updated_by = excluded.updated_by`
  );

  const batch = items.map(item => {
    const val = typeof item.value === 'string' ? item.value : JSON.stringify(item.value);
    return stmt.bind(item.category, item.key, val, admin.email);
  });

  await env.DB.batch(batch);

  // Audit log
  const ip = request.headers.get('CF-Connecting-IP') || '';
  const summary = items.map(i => `${i.category}.${i.key}`).join(', ');
  await auditLog(env, admin.id, 'config_update', summary, ip);

  return json({ ok: true, saved: items.length });
}

// POST /admin/api/config/reset — { category, key } or { category, key: '*' }
async function resetConfig(request, env, admin) {
  const { category, key } = await request.json();

  if (!category) {
    return json({ error: 'category is required' }, 400);
  }

  const ip = request.headers.get('CF-Connecting-IP') || '';

  if (key === '*') {
    await env.DB.prepare('DELETE FROM app_config WHERE category = ?').bind(category).run();
    await auditLog(env, admin.id, 'config_reset', `Reset all: ${category}`, ip);
    return json({ ok: true, message: `All ${category} config reset to defaults` });
  }

  if (!key) {
    return json({ error: 'key is required (or use "*" to reset all in category)' }, 400);
  }

  await env.DB.prepare(
    'DELETE FROM app_config WHERE category = ? AND key = ?'
  ).bind(category, key).run();
  await auditLog(env, admin.id, 'config_reset', `${category}.${key}`, ip);

  return json({ ok: true, message: `${category}.${key} reset to default` });
}

// GET /admin/api/config/defaults
async function getDefaultValues() {
  return json({ defaults: getDefaults() });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
