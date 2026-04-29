// ============================================
// Stripe Webhook Handler
// Receives events from Stripe, updates member
// subscriptions and payment records.
// Uses Web Crypto API (no Node.js needed).
// ============================================

export async function handleStripeWebhook(request, env) {
  // Verify Stripe signature
  const signature = request.headers.get('stripe-signature');
  if (!signature || !env.STRIPE_WEBHOOK_SECRET) {
    return json({ error: 'Missing signature or webhook secret' }, 400);
  }

  const body = await request.text();

  const verified = await verifyStripeSignature(body, signature, env.STRIPE_WEBHOOK_SECRET);
  if (!verified) {
    return json({ error: 'Invalid signature' }, 401);
  }

  const event = JSON.parse(body);

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object, env);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object, env);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object, env);
        break;
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object, env);
        break;
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object, env);
        break;
      default:
        // Unhandled event type — log and move on
        break;
    }
  } catch (err) {
    // Log error but return 200 so Stripe doesn't retry
    console.error(`Webhook error for ${event.type}:`, err.message);
  }

  return json({ received: true });
}

// --- Event Handlers ---

async function handleCheckoutCompleted(session, env) {
  const email = session.customer_email || session.customer_details?.email;
  if (!email) return;

  // Find user by email
  const user = await env.DB.prepare(
    'SELECT id FROM users WHERE email = ?'
  ).bind(email.toLowerCase()).first();

  if (!user) {
    // Payment for unknown user — log for admin review
    await env.DB.prepare(
      "INSERT INTO activity_log (user_id, action, path, metadata) VALUES (NULL, 'payment_unmatched', '/stripe/webhook', ?)"
    ).bind(JSON.stringify({ email, session_id: session.id })).run();
    return;
  }

  // Store Stripe customer ID
  if (session.customer) {
    await env.DB.prepare(
      'UPDATE users SET stripe_customer_id = ? WHERE id = ?'
    ).bind(session.customer, user.id).run();
  }

  if (session.mode === 'subscription' && session.subscription) {
    // Create subscription record
    await env.DB.prepare(
      `INSERT INTO subscriptions (user_id, stripe_subscription_id, stripe_customer_id, plan_name, status)
       VALUES (?, ?, ?, 'paid', 'active')
       ON CONFLICT(stripe_subscription_id) DO UPDATE SET status = 'active', updated_at = datetime('now')`
    ).bind(user.id, session.subscription, session.customer || '').run();

    // Upgrade tier
    await env.DB.prepare(
      "UPDATE users SET tier = 'paid' WHERE id = ?"
    ).bind(user.id).run();
  }

  if (session.mode === 'payment') {
    // One-time payment
    await env.DB.prepare(
      `INSERT INTO payments (user_id, stripe_payment_id, amount_cents, currency, status)
       VALUES (?, ?, ?, ?, 'succeeded')`
    ).bind(user.id, session.payment_intent || session.id, session.amount_total || 0, session.currency || 'usd').run();
  }
}

async function handleSubscriptionUpdated(subscription, env) {
  const sub = await env.DB.prepare(
    'SELECT id, user_id FROM subscriptions WHERE stripe_subscription_id = ?'
  ).bind(subscription.id).first();

  if (!sub) return;

  const amountCents = subscription.items?.data?.[0]?.price?.unit_amount || 0;
  const interval = subscription.items?.data?.[0]?.price?.recurring?.interval || 'month';

  await env.DB.prepare(
    `UPDATE subscriptions SET
      status = ?,
      amount_cents = ?,
      interval_type = ?,
      current_period_start = ?,
      current_period_end = ?,
      updated_at = datetime('now')
     WHERE stripe_subscription_id = ?`
  ).bind(
    subscription.status,
    amountCents,
    interval,
    new Date(subscription.current_period_start * 1000).toISOString(),
    new Date(subscription.current_period_end * 1000).toISOString(),
    subscription.id
  ).run();

  // Update user tier based on subscription status
  if (['past_due', 'unpaid', 'incomplete_expired'].includes(subscription.status)) {
    await env.DB.prepare(
      "UPDATE users SET tier = 'free' WHERE id = ?"
    ).bind(sub.user_id).run();
  } else if (subscription.status === 'active') {
    await env.DB.prepare(
      "UPDATE users SET tier = 'paid' WHERE id = ?"
    ).bind(sub.user_id).run();
  }
}

async function handleSubscriptionDeleted(subscription, env) {
  const sub = await env.DB.prepare(
    'SELECT id, user_id FROM subscriptions WHERE stripe_subscription_id = ?'
  ).bind(subscription.id).first();

  if (!sub) return;

  await env.DB.prepare(
    "UPDATE subscriptions SET status = 'canceled', canceled_at = datetime('now'), updated_at = datetime('now') WHERE stripe_subscription_id = ?"
  ).bind(subscription.id).run();

  // Downgrade to free (user can still log in)
  await env.DB.prepare(
    "UPDATE users SET tier = 'free' WHERE id = ?"
  ).bind(sub.user_id).run();
}

async function handlePaymentSucceeded(invoice, env) {
  const customerId = invoice.customer;
  if (!customerId) return;

  const user = await env.DB.prepare(
    'SELECT id FROM users WHERE stripe_customer_id = ?'
  ).bind(customerId).first();

  if (!user) return;

  await env.DB.prepare(
    `INSERT OR IGNORE INTO payments (user_id, stripe_payment_id, amount_cents, currency, status, paid_at)
     VALUES (?, ?, ?, ?, 'succeeded', ?)`
  ).bind(
    user.id,
    invoice.payment_intent || invoice.id,
    invoice.amount_paid || 0,
    invoice.currency || 'usd',
    new Date(invoice.status_transitions?.paid_at * 1000 || Date.now()).toISOString()
  ).run();
}

async function handlePaymentFailed(invoice, env) {
  const customerId = invoice.customer;
  if (!customerId) return;

  const user = await env.DB.prepare(
    'SELECT id FROM users WHERE stripe_customer_id = ?'
  ).bind(customerId).first();

  await env.DB.prepare(
    "INSERT INTO activity_log (user_id, action, path, metadata) VALUES (?, 'payment_failed', '/stripe/webhook', ?)"
  ).bind(user?.id || null, JSON.stringify({ invoice_id: invoice.id, customer: customerId })).run();
}

// --- Stripe Signature Verification (Web Crypto API) ---

async function verifyStripeSignature(payload, header, secret) {
  const parts = header.split(',').reduce((acc, part) => {
    const [key, value] = part.split('=');
    acc[key.trim()] = value;
    return acc;
  }, {});

  const timestamp = parts.t;
  const signature = parts.v1;

  if (!timestamp || !signature) return false;

  // Reject if timestamp is older than 5 minutes
  const age = Math.abs(Date.now() / 1000 - parseInt(timestamp));
  if (age > 300) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(signedPayload));
  const computed = Array.from(new Uint8Array(mac), b => b.toString(16).padStart(2, '0')).join('');

  return computed === signature;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
