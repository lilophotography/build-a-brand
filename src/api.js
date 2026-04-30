// API routes (auth-required): chat stream, progress, profile, brand-guide PDF.

import { TOOL_ORDER, buildSystemPrompt } from './prompts.js';
import { getConfig } from './config.js';

// ---------- Public dispatch ----------

export async function handleAPI(request, env, url, user) {
  const path = url.pathname;
  const method = request.method;

  if (path === '/api/chat' && method === 'POST') return chat(request, env, user);
  if (path === '/api/progress' && method === 'GET')  return progressGet(env, user);
  if (path === '/api/progress' && method === 'POST') return progressPost(request, env, user);
  if (path === '/api/progress/step' && method === 'POST') return progressStep(request, env, user);
  if (path === '/api/profile' && method === 'POST') return profileUpdate(request, env, user);
  if (path === '/api/brand-guide' && method === 'GET') return brandGuide(env, user);

  return json({ error: 'Not found' }, 404);
}

// ---------- /api/progress/step ----------
// Records a single step event for a (user, tool) pair into brand_progress.step_progress
// (a JSON column). Idempotent per video; first-write wins for timestamps.
//
// Accepted payloads:
//   { tool: 'vision', op: 'video', value: 'xyz123' }    → adds 'xyz123' to step_progress.videos_watched
//   { tool: 'vision', op: 'workbook' }                  → sets step_progress.workbook_downloaded_at = now
//   { tool: 'vision', op: 'chat_started' }              → sets step_progress.chat_started_at = now (if unset)
async function progressStep(request, env, user) {
  if (!user.has_access) return json({ error: 'No active access' }, 402);
  const body = await request.json().catch(() => ({}));
  const { tool, op, value } = body || {};
  const VALID_TOOLS = ['vision', 'value', 'voice', 'visuals', 'visibility'];
  if (!VALID_TOOLS.includes(tool)) return json({ error: 'Invalid tool' }, 400);
  if (!['video', 'workbook', 'chat_started'].includes(op)) return json({ error: 'Invalid op' }, 400);

  // Read existing row (or absent → {}). Auto-create the brand_progress row if missing.
  const row = await env.DB.prepare(
    'SELECT step_progress FROM brand_progress WHERE user_id = ? AND tool = ?'
  ).bind(user.id, tool).first();

  let progress = {};
  try { progress = JSON.parse(row?.step_progress || '{}') || {}; } catch { progress = {}; }
  if (!Array.isArray(progress.videos_watched)) progress.videos_watched = [];

  const now = new Date().toISOString();
  if (op === 'video') {
    if (!value || typeof value !== 'string') return json({ error: 'video op needs a string value' }, 400);
    if (!progress.videos_watched.includes(value)) progress.videos_watched.push(value);
  } else if (op === 'workbook') {
    if (!progress.workbook_downloaded_at) progress.workbook_downloaded_at = now;
  } else if (op === 'chat_started') {
    if (!progress.chat_started_at) progress.chat_started_at = now;
  }

  const stepJson = JSON.stringify(progress);
  if (row) {
    await env.DB.prepare(
      "UPDATE brand_progress SET step_progress = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE user_id = ? AND tool = ?"
    ).bind(stepJson, user.id, tool).run();
  } else {
    await env.DB.prepare(
      "INSERT INTO brand_progress (user_id, tool, completed, messages, summary, step_progress) VALUES (?, ?, 0, '[]', NULL, ?)"
    ).bind(user.id, tool, stepJson).run();
  }

  return json({ ok: true, step_progress: progress });
}

// ---------- /api/chat ----------
// Streams Claude responses as plain text. Client appends decoded chunks to the
// rendered transcript. We do NOT persist messages here — the client posts to
// /api/progress after each completed exchange.

async function chat(request, env, user) {
  if (!user.has_access) return json({ error: 'No active access. Please complete checkout first.' }, 402);

  const { messages, tool } = await request.json().catch(() => ({}));
  if (!tool || !TOOL_ORDER.includes(tool)) return json({ error: 'Invalid tool' }, 400);
  if (!Array.isArray(messages)) return json({ error: 'Bad messages' }, 400);

  // Load admin-editable config (prompts, model, max_tokens). Falls back to
  // hardcoded DEFAULTS when the app_config table is empty.
  const config = await getConfig(env);
  const systemPrompt = buildSystemPrompt(tool, user, config);
  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) return json({ error: 'Server misconfigured: missing Anthropic key' }, 500);

  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: config?.settings?.model || 'claude-sonnet-4-6',
      max_tokens: config?.settings?.max_tokens || 2048,
      stream: true,
      system: systemPrompt,
      messages: messages.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: String(m.content || ''),
      })),
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const errText = await upstream.text().catch(() => '');
    console.error('Anthropic error', upstream.status, errText);
    return json({ error: 'AI request failed' }, 502);
  }

  // Stream SSE -> plain text deltas to the client
  const { readable, writable } = new TransformStream();
  pipeAnthropicSSEToText(upstream.body, writable);

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

async function pipeAnthropicSSEToText(sourceStream, writableStream) {
  const writer = writableStream.getWriter();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const reader = sourceStream.getReader();

  let buf = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });

      // SSE events are separated by blank lines
      let idx;
      while ((idx = buf.indexOf('\n\n')) !== -1) {
        const block = buf.slice(0, idx);
        buf = buf.slice(idx + 2);

        for (const line of block.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (!data || data === '[DONE]') continue;
          try {
            const ev = JSON.parse(data);
            if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') {
              await writer.write(encoder.encode(ev.delta.text));
            }
          } catch {
            // Ignore malformed event lines
          }
        }
      }
    }
  } catch (err) {
    console.error('SSE pipe error', err);
  } finally {
    try { await writer.close(); } catch {}
  }
}

// ---------- /api/progress ----------

async function progressGet(env, user) {
  const { results } = await env.DB.prepare(
    'SELECT tool, completed, summary, messages, step_progress, updated_at FROM brand_progress WHERE user_id = ?'
  ).bind(user.id).all();
  // Parse step_progress JSON for client convenience.
  const out = (results || []).map(r => {
    let sp = {};
    try { sp = JSON.parse(r.step_progress || '{}') || {}; } catch {}
    return { ...r, step_progress: sp };
  });
  return json(out);
}

async function progressPost(request, env, user) {
  const body = await request.json().catch(() => ({}));
  const { tool, messages, completed, summary } = body;
  if (!TOOL_ORDER.includes(tool)) return json({ error: 'Invalid tool' }, 400);

  const messagesStr = JSON.stringify(Array.isArray(messages) ? messages : []);
  const completedFlag = completed ? 1 : 0;
  const summaryVal = (typeof summary === 'string' && summary.trim()) ? summary.trim() : null;

  await env.DB.prepare(
    `INSERT INTO brand_progress (user_id, tool, messages, completed, summary, updated_at)
     VALUES (?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
     ON CONFLICT(user_id, tool) DO UPDATE SET
       messages = excluded.messages,
       completed = excluded.completed,
       summary = COALESCE(excluded.summary, brand_progress.summary),
       updated_at = excluded.updated_at`
  ).bind(user.id, tool, messagesStr, completedFlag, summaryVal).run();

  return json({ ok: true });
}

// ---------- /api/profile ----------
// Used by the onboarding form. Sets first_name, business_name, website, marks onboarded=1.
// Also used to mark welcomed=1 once they dismiss the Lisa letter page.

async function profileUpdate(request, env, user) {
  const body = await request.json().catch(() => ({}));
  const { first_name, business_name, website, mark_onboarded, mark_welcomed } = body;

  const sets = [];
  const binds = [];

  if (typeof first_name === 'string')   { sets.push('first_name = ?');    binds.push(first_name.trim() || null); }
  if (typeof business_name === 'string'){ sets.push('business_name = ?'); binds.push(business_name.trim() || null); }
  if (typeof website === 'string')      { sets.push('website = ?');       binds.push(normalizeUrl(website)); }
  if (mark_onboarded) sets.push('onboarded = 1');
  if (mark_welcomed)  sets.push('welcomed = 1');
  sets.push("last_active_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')");

  if (sets.length === 0) return json({ ok: true }); // nothing to do

  const sql = `UPDATE users SET ${sets.join(', ')} WHERE id = ?`;
  binds.push(user.id);
  await env.DB.prepare(sql).bind(...binds).run();

  return json({ ok: true });
}

function normalizeUrl(s) {
  const v = (s || '').trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  return `https://${v}`;
}

// ---------- /api/brand-guide ----------
// Renders the user's current Brand Guide as a PDF using Cloudflare Browser Rendering.
// We render one of OUR own pages (/brand-guide/print) inside a headless browser
// and capture as PDF. The print page is server-rendered, so the user's data is
// already inlined in the HTML when the browser visits it.

async function brandGuide(env, user) {
  if (!user.has_access) return json({ error: 'No active access' }, 402);

  // Cloudflare Browser Rendering: managed REST endpoint.
  // Docs: https://developers.cloudflare.com/browser-rendering/
  // We call the same Worker's print page with a one-time signed token so the
  // headless browser can render an authenticated page.
  const printToken = await mintPrintToken(env, user.id);
  const printUrl = `${env.APP_URL || 'https://brand.photolilo.com'}/brand-guide/print?t=${printToken}`;

  // The BROWSER binding's REST API: we POST a /pdf request with { url }
  const upstream = await env.BROWSER.fetch('https://browser.do/pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: printUrl,
      pdf: {
        format: 'A4',
        printBackground: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' },
      },
      gotoOptions: { waitUntil: 'networkidle0', timeout: 30000 },
    }),
  });

  if (!upstream.ok) {
    const errText = await upstream.text().catch(() => '');
    console.error('Browser Rendering error', upstream.status, errText);
    return json({ error: 'PDF generation failed' }, 502);
  }

  const pdf = await upstream.arrayBuffer();
  return new Response(pdf, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="Brand-Guide.pdf"',
      'Cache-Control': 'no-store',
    },
  });
}

// One-time signed token for the print page. Stored in KV with 60s TTL, single-use.
async function mintPrintToken(env, userId) {
  const token = crypto.randomUUID();
  await env.SESSIONS.put(`pt:${token}`, userId, { expirationTtl: 60 });
  return token;
}

export async function consumePrintToken(env, token) {
  if (!token) return null;
  const userId = await env.SESSIONS.get(`pt:${token}`);
  if (userId) await env.SESSIONS.delete(`pt:${token}`);
  return userId;
}

// ---------- Helpers ----------

function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}
