# Build a Brand — LiLo Photography & Branding

Lisa Lord's paid course product, replatformed from Next.js 15 + Clerk + Supabase
to a single Cloudflare Worker + D1 + KV + Browser Rendering. Lives on Lisa's
own Cloudflare account (`aed82726fec0768bcf83cb3f920ef5c9`), her own GitHub
repo (`lilophotography/build-a-brand`), her own Stripe.

## Stack

- **Cloudflare Worker** (`src/index.js`) — server-side rendered HTML, all routes
- **D1** (`build-a-brand-db`) — `users` + `brand_progress` + `stripe_events`
- **KV** (`SESSIONS`) — 30-day login sessions, pending-Stripe-entitlement claims, signed PDF tokens
- **Browser Rendering** — `/api/brand-guide` renders `/brand-guide/print` to PDF
- **Anthropic SDK** — `claude-sonnet-4-6` streamed via fetch (no SDK runtime)
- **Stripe** — direct REST, webhook signature verification (HMAC-SHA256)

No Next.js. No Clerk. No Supabase. No `next-on-pages`. No `@react-pdf/renderer`.

## File map

```
src/
  index.js     Worker entry + router + page-gating logic
  auth.js      PBKDF2-SHA256 password hashing, KV sessions, signup/signin/signout/me
  api.js       /api/chat (Anthropic stream), /api/progress, /api/profile, /api/brand-guide
  stripe.js    /api/stripe/checkout (3 prices), /api/stripe/webhook
  prompts.js   The 5 V system prompts (verbatim from Lisa) + per-user context injection
  pages.js     All HTML page renderers
  render.js    Layout primitives (head, nav, footer, escape, html-template tag)
public/
  styles.css   Brand tokens (Gilda Display + Montserrat + cream/dark/terracotta/gold)
  print.css    PDF page layout for /brand-guide/print
  app.js       Client-side: chat streaming, auth forms, checkout, downloads
  favicon.svg
migrations/
  0001_initial.sql   users + brand_progress + stripe_events
wrangler.toml
package.json
```

## Routes

### Public
- `GET /` — landing
- `GET /sign-in`, `GET /sign-up` — auth forms
- `GET /welcome?session=...` — Stripe success → signup with paid email pre-filled

### Authenticated (gated)
First-login flow: `/lisa` → `/onboarding` → `/dashboard`

- `GET /lisa` (one-time) — Lisa's welcome letter
- `GET /onboarding` (one-time) — first name, business name, website
- `GET /dashboard` — hero card + path of 5 V's + tier-aware right rail
- `GET /brand-builder/{vision|value|voice|visuals|visibility}` — chat session
- `GET /brand-guide` — compiled summaries + PDF download
- `GET /v-complete/{tool}` — completion celebration
- `GET /coaching` — tier-aware: $500=book, $250=upsell

### API
- `POST /api/auth/signup`, `signin`, `signout`; `GET /api/auth/me`
- `POST /api/chat` (streamed text)
- `GET /api/progress`, `POST /api/progress`
- `POST /api/profile`
- `GET /api/brand-guide` — PDF (renders `/brand-guide/print` via Browser Rendering)
- `POST /api/stripe/checkout` — body `{tier: 'course'|'coaching'|'upsell_call'}`
- `POST /api/stripe/webhook` — Stripe-signed, no auth

### Special
- `GET /brand-guide/print?t=<one-time-token>` — full HTML doc consumed by Browser Rendering

## Stripe products (Lisa's account, livemode)

| Tier | Product | Price ID | Amount |
|------|---|---|---|
| course | `prod_UQSno2B7bxzLCM` | `price_1TRbrdILMmwtGFlFcNoHpguJ` | $250 |
| coaching | `prod_UQSnZR85UsPKhg` | `price_1TRbrgILMmwtGFlF9sSCACmX` | $500 |
| upsell_call | `prod_UQWjn1Eru52zOk` | `price_1TRfg0ILMmwtGFlFHoUHqZrf` | $300 |

Webhook endpoint: `https://brand.photolilo.com/api/stripe/webhook` (already configured in Lisa's Stripe).

## First-time deploy (after Lisa adds D1:Edit to her API token)

```bash
# Set creds
export CLOUDFLARE_API_TOKEN="cfut_..."          # Lisa's, with D1:Edit added
export CLOUDFLARE_ACCOUNT_ID="aed82726fec0768bcf83cb3f920ef5c9"

# Create D1 database
npx wrangler d1 create build-a-brand-db
# Copy the printed database_id and paste into wrangler.toml

# Apply migrations
npm run db:migrate:remote

# Set secrets
npx wrangler secret put ANTHROPIC_API_KEY        # paste key
npx wrangler secret put STRIPE_SECRET_KEY        # paste key
npx wrangler secret put STRIPE_WEBHOOK_SECRET    # paste secret

# Deploy
python /c/Users/Admin/J\ Stein/tools/cf_guard.py --client lisa-lord
npm run deploy

# Custom domain (after photolilo.com nameservers propagate to Cloudflare)
# Uncomment the [[routes]] block in wrangler.toml and redeploy.
```

## Subsequent deploys

```bash
git push origin main           # pushes to lilophotography/build-a-brand
npm run deploy                 # to Lisa's CF account
```

## What was wrong with the old build

The original Next.js + `@cloudflare/next-on-pages` setup had two compounding
failures:

1. The GitHub Actions workflow ran `wrangler pages deploy .` from the bare
   repo root — no `npm install`, no `next build`, no `next-on-pages`. Every
   deploy "succeeded" green and shipped the static `index.html` "Coming soon"
   placeholder. There was never a real build error to debug.
2. `/api/brand-guide` had no `runtime = "edge"` export and used
   `@react-pdf/renderer` which can't run on Cloudflare's edge anyway. Even if
   the workflow had been right, the build would have failed on this route.

Plus React 19 + Next 15 + `next-on-pages` is a fragile stack with frequent
breakage on minor version bumps. Replatforming to a plain Worker eliminates
the entire adapter layer.

## Vendor accounts retired

These can be canceled once the new app is verified live:
- **Clerk** — replaced with `auth.js` (PBKDF2 + KV sessions)
- **Supabase** — replaced with D1 (Supabase tables had no real data)
