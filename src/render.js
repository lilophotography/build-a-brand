// Shared HTML primitives: <head>, nav, footer, escape helpers.

export function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function html(strings, ...values) {
  // Tagged template — values are NOT auto-escaped. Caller must call esc() on
  // any user-provided value. Keeps performance + flexibility for embedding raw
  // server-built fragments.
  let out = '';
  for (let i = 0; i < strings.length; i++) {
    out += strings[i];
    if (i < values.length) {
      const v = values[i];
      out += Array.isArray(v) ? v.join('') : (v ?? '');
    }
  }
  return out;
}

// HTML response helper
export function htmlResponse(body, status = 200, extraHeaders = {}) {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extraHeaders,
    },
  });
}

export function redirect(location, status = 302, extraHeaders = {}) {
  return new Response(null, { status, headers: { Location: location, ...extraHeaders } });
}

// Common <head> markup. Title is page-specific.
export function head(title, opts = {}) {
  const desc = opts.description || 'Build a Brand: a guided journey through Vision, Value, Voice, Visuals, and Visibility, with your AI brand strategist.';
  return `<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="${esc(desc)}">
<title>${esc(title)}</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Gilda+Display&family=Montserrat:wght@300;400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/styles.css">`;
}

// Public marketing nav (landing only). For the in-app nav we use AppNav.
export function publicNav(currentUser) {
  const right = currentUser
    ? `<a href="/dashboard" class="nav-link">My Brand</a>`
    : `<a href="/sign-in" class="nav-link">Sign in</a>`;
  return `<nav class="nav nav--public">
  <div class="nav__inner">
    <a href="/" class="brandmark">LiLo Photography &amp; Branding</a>
    <div class="nav__right">${right}</div>
  </div>
</nav>`;
}

// In-app nav for authenticated paid users.
export function appNav(currentPath, user) {
  const items = [
    { href: '/brand-builder/vision',     label: 'Vision',     num: '1' },
    { href: '/brand-builder/value',      label: 'Value',      num: '2' },
    { href: '/brand-builder/voice',      label: 'Voice',      num: '3' },
    { href: '/brand-builder/visuals',    label: 'Visuals',    num: '4' },
    { href: '/brand-builder/visibility', label: 'Visibility', num: '5' },
  ];
  const links = items.map(i => {
    const active = currentPath.startsWith(i.href);
    return `<a href="${i.href}" class="appnav__step ${active ? 'is-active' : ''}">
      <span class="appnav__num">${i.num}</span>${esc(i.label)}
    </a>`;
  }).join('');
  return `<nav class="appnav">
  <div class="appnav__inner">
    <a href="/dashboard" class="appnav__home">
      <span class="appnav__brand">LILO</span>
      <span class="appnav__sep">·</span>
      <span class="appnav__title">Build a Brand</span>
    </a>
    <div class="appnav__steps">${links}</div>
    <div class="appnav__right">
      <a href="/brand-guide" class="appnav__guide">Brand Guide</a>
      <form method="POST" action="/api/auth/signout" data-signout class="appnav__signout">
        <button type="submit" class="appnav__signout-btn" title="Sign out">
          <span class="appnav__name">${esc(user?.first_name || 'You')}</span>
          <span class="appnav__signout-label">Sign out</span>
          <svg class="appnav__chev" width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M3 4.5l3 3 3-3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </form>
    </div>
  </div>
</nav>`;
}

// `user` is optional. When the caller passes a logged-in user with `is_admin`
// true, we render an explicit "Admin" link in the footer. Non-admins (and
// logged-out visitors) see no admin entry point in the markup at all.
export function publicFooter(user) {
  const year = new Date().getUTCFullYear();
  const adminLink = user && user.is_admin
    ? `<a href="/admin" class="footer__admin">Admin →</a>`
    : '';
  return `<footer class="footer">
  <div class="footer__inner">
    <div class="footer__col">
      <p class="footer__brand">LiLo Photography &amp; Branding</p>
      <p class="footer__tag">Strategic branding, websites, and brand photography for growing businesses.</p>
    </div>
    <div class="footer__col">
      <p class="footer__heading">Build a Brand</p>
      <a href="#pricing">Pricing</a>
      <a href="/sign-in">Sign in</a>
      <a href="mailto:lisa@photolilo.com">Email Lisa</a>
    </div>
    <div class="footer__col">
      <p class="footer__heading">More from Lisa</p>
      <a href="https://photolilo.com/" target="_blank" rel="noopener">photolilo.com</a>
      <a href="https://photolilo.com/branding-photography" target="_blank" rel="noopener">Brand Photography</a>
      <a href="https://photolilo.com/contact" target="_blank" rel="noopener">Contact</a>
    </div>
  </div>
  <div class="footer__bottom">
    <p>© ${year} LiLo Photography &amp; Branding. All rights reserved.${adminLink ? ' ' + adminLink : ''}</p>
  </div>
</footer>`;
}

// Standard page wrap. Pass nav (string) or null. main is a string of HTML.
export function page({ title, nav, main, scripts = '', bodyClass = '' }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
${head(title)}
</head>
<body class="${esc(bodyClass)}">
${nav || ''}
<main class="main">
${main}
</main>
${scripts}
<script src="/app.js" defer></script>
<script>
// Live admin config: replaces text on [data-config] elements + sets brand
// CSS vars from app_config (cream, terracotta, etc.). Empty config = no-op.
fetch('/api/config/public').then(r => r.json()).then(cfg => {
  if (cfg && cfg.copy) {
    document.querySelectorAll('[data-config]').forEach(el => {
      const key = el.getAttribute('data-config');
      const val = cfg.copy[key];
      if (val !== undefined && val !== null && val !== '') el.textContent = val;
    });
  }
  if (cfg && cfg.branding) {
    const root = document.documentElement.style;
    for (const [k, v] of Object.entries(cfg.branding)) {
      if (typeof v !== 'string' || !v) continue;
      // Skip non-color/font keys; map snake_case to CSS var names
      if (k === 'app_name' || k === 'tagline' || k === 'logo_url') continue;
      root.setProperty('--' + k.replace(/_/g, '-'), v);
    }
    if (cfg.branding.app_name) document.title = cfg.branding.app_name + ' · LiLo Photography & Branding';
  }
}).catch(() => {});
</script>
</body>
</html>`;
}
