// ============================================
// Activity Tracking Module
// Fire-and-forget logging — never blocks the response.
// ============================================

// Default action map — customize per app
const DEFAULT_ACTION_MAP = {
  'POST /api/auth/login': 'login',
  'POST /api/auth/register': 'registration',
  'POST /api/auth/logout': 'logout',
  'POST /api/chat': 'chat_message',
  'POST /api/sessions': 'session_created',
  'GET /api/sessions': 'sessions_viewed',
  'GET /api/progress': 'progress_viewed',
  'GET /api/reports': 'reports_viewed',
};

// Add app-specific mappings here
const APP_ACTION_MAP = {
  // Example for MI Practice App:
  // 'GET /api/paths': 'paths_viewed',
  // 'GET /api/memory': 'memory_viewed',
  // 'GET /api/community/feed': 'community_viewed',
  // 'POST /api/community/posts': 'post_created',
};

const ACTION_MAP = { ...DEFAULT_ACTION_MAP, ...APP_ACTION_MAP };

// Call this from index.js after handling API routes
// Use ctx.waitUntil() to make it non-blocking
export function logActivity(request, env, url, userId, ctx) {
  if (!userId) return; // Skip anonymous requests

  const method = request.method;
  const path = url.pathname;

  // Match against action map (exact match first, then pattern)
  let action = ACTION_MAP[`${method} ${path}`];
  if (!action) {
    // Try pattern matching (strip IDs from paths)
    const normalized = path.replace(/\/\d+/g, '/:id');
    action = ACTION_MAP[`${method} ${normalized}`] || `${method.toLowerCase()}_${path.replace(/^\/api\//, '').replace(/\//g, '_')}`;
  }

  // Skip logging admin routes and static assets
  if (path.startsWith('/admin/') || !path.startsWith('/api/')) return;

  const ip = request.headers.get('cf-connecting-ip') || '';

  const insertPromise = env.DB.prepare(
    'INSERT INTO activity_log (user_id, action, path, ip_address) VALUES (?, ?, ?, ?)'
  ).bind(userId, action, path, ip).run().catch(() => {
    // Silently fail — activity logging should never break the app
  });

  // Use waitUntil if available (Cloudflare Workers execution context)
  if (ctx && ctx.waitUntil) {
    ctx.waitUntil(insertPromise);
  }
}

// Update last_active on users table (call on login or significant actions)
export async function updateLastActive(env, userId) {
  await env.DB.prepare(
    "UPDATE users SET last_active = datetime('now') WHERE id = ?"
  ).bind(userId).run().catch(() => {});
}

// Cleanup old activity logs (call from admin API or cron trigger)
export async function cleanupActivityLog(env, daysOld = 90) {
  const result = await env.DB.prepare(
    "DELETE FROM activity_log WHERE created_at < datetime('now', ?)"
  ).bind(`-${daysOld} days`).run();
  return result.meta.changes || 0;
}
