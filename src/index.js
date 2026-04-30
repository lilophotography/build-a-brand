// Build a Brand — Worker entry. Routes everything: pages, auth, API, stripe.

import { handleAuth, authenticate } from './auth.js';
import { handleAPI, consumePrintToken } from './api.js';
import { handleStripe } from './stripe.js';
import { handleAdminAuth } from './admin-auth.js';
import { handleAdminAPI } from './admin-api.js';
import { handleConfigAPI, handlePublicConfig } from './config-api.js';
import {
  renderLanding, renderSignIn, renderSignUp, renderWelcomeAfterStripe,
  renderLisaLetter, renderOnboarding, renderDashboard, renderBrandBuilder,
  renderBrandGuide, renderBrandGuidePrint, renderCoaching, renderVComplete,
} from './pages.js';
import { getVData, findVForLessonSlug } from './course.js';
import { TOOL_ORDER } from './prompts.js';
import { redirect, htmlResponse } from './render.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      // ---- Stripe webhook (UNAUTH, must run BEFORE any auth check) ----
      if (path === '/api/stripe/webhook') {
        return await handleStripe(request, env, url, null);
      }

      // ---- Public config endpoint (branding + copy only, no secrets) ----
      // Used by the landing page's config-loader script to apply admin edits live.
      if (path === '/api/config/public' && method === 'GET') {
        return await handlePublicConfig(env);
      }

      // ---- Admin API routes (must come BEFORE /api/* user-auth catch-all) ----
      // Each handler does its own admin-auth check; setup endpoint uses ADMIN_SETUP_KEY.
      if (path.startsWith('/admin/api/auth')) {
        return await handleAdminAuth(request, env, url);
      }
      if (path === '/admin/api/secrets/status' || path.startsWith('/admin/api/config')) {
        return await handleConfigAPI(request, env, url);
      }
      if (path.startsWith('/admin/api/')) {
        return await handleAdminAPI(request, env, url);
      }

      // ---- Auth API ----
      if (path.startsWith('/api/auth/')) {
        return await handleAuth(request, env, url);
      }

      // ---- Public Stripe checkout init (no auth required for course/coaching) ----
      if (path === '/api/stripe/checkout' && method === 'POST') {
        const user = await authenticate(request, env); // may be null for new buyers
        return await handleStripe(request, env, url, user);
      }

      // ---- Brand Guide print page (signed token only) ----
      if (path === '/brand-guide/print') {
        const token = url.searchParams.get('t');
        const userId = await consumePrintToken(env, token);
        if (!userId) return new Response('Forbidden', { status: 403 });
        const user = await env.DB.prepare('SELECT id, email, first_name, business_name FROM users WHERE id = ?').bind(userId).first();
        if (!user) return new Response('Forbidden', { status: 403 });
        const { results: progressRows } = await env.DB.prepare(
          'SELECT tool, completed, summary FROM brand_progress WHERE user_id = ?'
        ).bind(userId).all();
        return renderBrandGuidePrint(user, progressRows || []);
      }

      // ---- All other API routes are authenticated ----
      if (path.startsWith('/api/')) {
        const user = await authenticate(request, env);
        if (!user) return json({ error: 'Unauthorized' }, 401);
        return await handleAPI(request, env, url, user);
      }

      // ---- /welcome — post-Stripe success page ----
      if (path === '/welcome' && method === 'GET') {
        return await handleStripeWelcome(request, env, url);
      }

      // ---- Public pages ----
      if (path === '/' && method === 'GET') {
        const user = await authenticate(request, env);
        return renderLanding(user);
      }
      if (path === '/sign-in' && method === 'GET') {
        const user = await authenticate(request, env);
        if (user) return redirect(decideLandingPath(user));
        return renderSignIn();
      }
      if (path === '/sign-up' && method === 'GET') {
        const user = await authenticate(request, env);
        if (user) return redirect(decideLandingPath(user));
        return renderSignUp();
      }

      // ---- Authenticated pages ----
      if (
        path === '/lisa' || path === '/onboarding' || path === '/dashboard' ||
        path === '/brand-guide' || path === '/coaching' ||
        path.startsWith('/brand-builder/') || path.startsWith('/v-complete/') ||
        path === '/learn' || path.startsWith('/learn/')
      ) {
        const user = await authenticate(request, env);
        if (!user) return redirect('/sign-in');
        if (!user.has_access) return redirect('/#pricing');

        // Force the onboarding → welcome flow on first login.
        // Order: collect their name first, THEN Lisa's letter can greet them by name.
        if (!user.onboarded && path !== '/onboarding') return redirect('/onboarding');
        if (user.onboarded && !user.welcomed && path !== '/lisa') return redirect('/lisa');

        if (path === '/lisa') return renderLisaLetter(user);
        if (path === '/onboarding') return renderOnboarding(user);
        if (path === '/dashboard') {
          const { results } = await env.DB.prepare(
            'SELECT tool, completed, summary, messages, step_progress FROM brand_progress WHERE user_id = ?'
          ).bind(user.id).all();
          return renderDashboard(user, results || []);
        }
        if (path === '/coaching') return renderCoaching(user);
        if (path === '/brand-guide') {
          const { results } = await env.DB.prepare(
            'SELECT tool, completed, summary FROM brand_progress WHERE user_id = ?'
          ).bind(user.id).all();
          return renderBrandGuide(user, results || []);
        }
        if (path.startsWith('/brand-builder/')) {
          const tool = path.slice('/brand-builder/'.length);
          if (!TOOL_ORDER.includes(tool)) return redirect('/dashboard');
          const row = await env.DB.prepare(
            'SELECT tool, completed, summary, messages, step_progress FROM brand_progress WHERE user_id = ? AND tool = ?'
          ).bind(user.id, tool).first();
          let stepProgress = {};
          try { stepProgress = JSON.parse(row?.step_progress || '{}') || {}; } catch {}
          const vData = getVData(tool);
          return renderBrandBuilder(user, tool, row, vData, stepProgress);
        }
        if (path.startsWith('/v-complete/')) {
          const tool = path.slice('/v-complete/'.length);
          if (!TOOL_ORDER.includes(tool)) return redirect('/dashboard');
          const row = await env.DB.prepare(
            'SELECT summary FROM brand_progress WHERE user_id = ? AND tool = ?'
          ).bind(user.id, tool).first();
          return renderVComplete(user, tool, row?.summary || null);
        }
        // Legacy /learn routes — the library is gone. Redirect to the V page
        // a slug belongs to (with #lesson hash so the chip rail can auto-select).
        // Bare /learn just bounces to dashboard.
        if (path === '/learn') return redirect('/dashboard', 301);
        if (path.startsWith('/learn/')) {
          const slug = path.slice('/learn/'.length).replace(/\/$/, '');
          const v = findVForLessonSlug(slug);
          return redirect(v ? `/brand-builder/${v}#lesson=${encodeURIComponent(slug)}` : '/dashboard', 301);
        }
      }

      // ---- Static assets (CSS, client JS, images, favicon) ----
      return env.ASSETS.fetch(request);

    } catch (err) {
      console.error('Worker error:', err.message, err.stack);
      return htmlResponse(`<!doctype html><html><body style="font-family: system-ui; padding: 4rem; color: #2B2B2B;"><h1>Something went sideways</h1><p>We hit an unexpected error. Try again, or sign in fresh.</p></body></html>`, 500);
    }
  },
};

// Decide where to send a logged-in user who hits / or /sign-in / /sign-up.
function decideLandingPath(user) {
  if (!user.has_access) return '/#pricing';
  if (!user.onboarded) return '/onboarding';
  if (!user.welcomed) return '/lisa';
  return '/dashboard';
}

// Handle the post-Stripe /welcome?session=cs_... page.
// Verifies the session is paid and pulls the email so signup can pre-fill it.
async function handleStripeWelcome(request, env, url) {
  const sessionId = url.searchParams.get('session');
  const user = await authenticate(request, env);

  // Already signed in — webhook will (or already did) apply entitlement to them.
  if (user) return redirect('/lisa');

  if (!sessionId) return redirect('/');

  const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    headers: { Authorization: 'Bearer ' + env.STRIPE_SECRET_KEY },
  });
  if (!res.ok) return redirect('/');
  const session = await res.json();
  const paid = session.payment_status === 'paid' || session.payment_status === 'no_payment_required';
  if (!paid) return redirect('/#pricing');
  const email = (session.customer_email || session.customer_details?.email || '').toLowerCase() || '';

  return renderWelcomeAfterStripe({ email });
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
