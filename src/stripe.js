// Stripe: checkout sessions for 3 prices + webhook handler.
//
// Three product flows:
//   tier=course           -> $250 course only           (price_course)
//   tier=coaching         -> $500 course + strategy call (price_course_coaching)
//   tier=upsell_call      -> $300 add-on call (only after course-only purchase)
//
// On checkout.session.completed:
//   - course        -> users.has_access=1, tier='course'
//   - coaching      -> users.has_access=1, tier='coaching', has_call_credit=1
//   - upsell_call   -> users.has_call_credit=1   (does NOT change tier)

const STRIPE_BASE = 'https://api.stripe.com/v1';

export async function handleStripe(request, env, url, user) {
  const path = url.pathname;
  const method = request.method;

  if (path === '/api/stripe/checkout' && method === 'POST') return checkout(request, env, user);
  if (path === '/api/stripe/webhook' && method === 'POST') return webhook(request, env);

  return json({ error: 'Not found' }, 404);
}

// ---------- Checkout ----------

async function checkout(request, env, user) {
  const { tier } = await request.json().catch(() => ({ tier: 'course' }));

  let priceId, label;
  if (tier === 'coaching') {
    priceId = env.STRIPE_PRICE_COURSE_COACHING;
    label = 'Course + Strategy Call';
  } else if (tier === 'upsell_call') {
    if (!user) return json({ error: 'Sign in to add a strategy call.' }, 401);
    priceId = env.STRIPE_PRICE_UPSELL_CALL;
    label = 'Add a Strategy Call';
  } else {
    priceId = env.STRIPE_PRICE_COURSE;
    label = 'Build a Brand: The Course';
  }

  if (!priceId) return json({ error: 'Pricing not configured' }, 500);

  const appUrl = env.APP_URL || 'https://brand.photolilo.com';
  const params = new URLSearchParams();
  params.append('mode', 'payment');
  params.append('line_items[0][price]', priceId);
  params.append('line_items[0][quantity]', '1');
  params.append('success_url', `${appUrl}/welcome?session={CHECKOUT_SESSION_ID}`);
  params.append('cancel_url', `${appUrl}/#pricing`);
  params.append('metadata[tier]', tier || 'course');
  if (user?.email) params.append('customer_email', user.email);
  if (user?.id) params.append('metadata[user_id]', user.id);

  const res = await fetch(`${STRIPE_BASE}/checkout/sessions`, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + env.STRIPE_SECRET_KEY,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('Stripe checkout error', res.status, text);
    return json({ error: 'Checkout failed' }, 502);
  }

  const session = await res.json();
  return json({ url: session.url, id: session.id, label });
}

// ---------- Webhook ----------
// Stripe signs raw body bytes with the webhook secret. We verify HMAC-SHA256.
// On checkout.session.completed we either bind the session to an existing
// user (by metadata.user_id), or stash the paid email so /welcome can claim it.

async function webhook(request, env) {
  const sig = request.headers.get('stripe-signature') || '';
  const rawBody = await request.text();

  const ok = await verifyStripeSignature(rawBody, sig, env.STRIPE_WEBHOOK_SECRET);
  if (!ok) return new Response('Bad signature', { status: 400 });

  let event;
  try { event = JSON.parse(rawBody); } catch { return new Response('Bad payload', { status: 400 }); }

  // Idempotency: ignore duplicate event IDs we've already processed.
  const dupe = await env.DB.prepare('SELECT id FROM stripe_events WHERE id = ?').bind(event.id).first();
  if (dupe) return new Response('ok', { status: 200 });

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const tier = session.metadata?.tier || 'course';
    const userIdMeta = session.metadata?.user_id || null;
    const customerId = session.customer || null;
    const email = (session.customer_email || session.customer_details?.email || '').toLowerCase() || null;

    let appliedTo = null;

    if (userIdMeta) {
      // Logged-in upsell or signed-in checkout
      appliedTo = userIdMeta;
      await applyEntitlement(env, userIdMeta, tier, customerId);
    } else if (email) {
      // Anonymous purchase. Try to find existing user by email.
      const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
      if (existing) {
        appliedTo = existing.id;
        await applyEntitlement(env, existing.id, tier, customerId);
      } else {
        // No user yet. Stash the entitlement under the paid email; /welcome
        // will claim it the moment they finish signing up.
        const pending = JSON.stringify({ tier, customerId, sessionId: session.id });
        await env.SESSIONS.put(`pe:${email}`, pending, { expirationTtl: 60 * 60 * 24 * 30 });
      }
    }

    await env.DB.prepare(
      `INSERT OR IGNORE INTO stripe_events (id, type, user_id, raw) VALUES (?, ?, ?, ?)`
    ).bind(event.id, event.type, appliedTo, rawBody).run();
  }

  return new Response('ok', { status: 200 });
}

async function applyEntitlement(env, userId, tier, customerId) {
  if (tier === 'upsell_call') {
    await env.DB.prepare(
      `UPDATE users SET has_call_credit = 1, stripe_customer_id = COALESCE(?, stripe_customer_id) WHERE id = ?`
    ).bind(customerId, userId).run();
  } else if (tier === 'coaching') {
    await env.DB.prepare(
      `UPDATE users SET has_access = 1, tier = 'coaching', has_call_credit = 1,
                        stripe_customer_id = COALESCE(?, stripe_customer_id)
       WHERE id = ?`
    ).bind(customerId, userId).run();
  } else {
    await env.DB.prepare(
      `UPDATE users SET has_access = 1,
                        tier = COALESCE(NULLIF(tier, ''), 'course'),
                        stripe_customer_id = COALESCE(?, stripe_customer_id)
       WHERE id = ?`
    ).bind(customerId, userId).run();
  }
}

// Claim a pre-purchased entitlement at signup time.
// Called from auth signup after we create the user row.
export async function claimPendingEntitlement(env, userId, email) {
  const key = `pe:${email.toLowerCase()}`;
  const raw = await env.SESSIONS.get(key);
  if (!raw) return false;
  let pending;
  try { pending = JSON.parse(raw); } catch { return false; }
  await applyEntitlement(env, userId, pending.tier || 'course', pending.customerId);
  await env.SESSIONS.delete(key);
  return true;
}

// ---------- Webhook signature verification ----------
// Stripe header format: "t=NUM,v1=HEX"
async function verifyStripeSignature(payload, header, secret) {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(header.split(',').map(s => {
    const i = s.indexOf('=');
    return [s.slice(0, i), s.slice(i + 1)];
  }));
  const t = parts.t;
  const v1 = parts.v1;
  if (!t || !v1) return false;

  const signedPayload = `${t}.${payload}`;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(signedPayload));
  const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');

  return constantTimeEqualHex(hex, v1);
}

function constantTimeEqualHex(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
