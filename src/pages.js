// Server-rendered HTML pages.

import { esc, page, publicNav, appNav, publicFooter, htmlResponse } from './render.js';
import { TOOL_META, TOOL_ORDER, TOOL_INTROS } from './prompts.js';

// ============================================================
// PUBLIC: Landing page
// ============================================================

export function renderLanding(user) {
  const isSignedIn = !!user;
  const main = `
<section class="hero">
  <p class="eyebrow" data-config="hero_eyebrow">Build a Brand · The Course</p>
  <h1 class="hero__title"><span data-config="hero_title_line_1">A brand with purpose</span><br><em><span data-config="hero_title_line_2">is a brand with power.</span></em></h1>
  <p class="hero__lede" data-config="hero_lede">Five AI-guided sessions with Lisa's brand strategist. One downloadable Brand Guide. Strategic branding that drives revenue, not vibes.</p>
  <div class="hero__actions">
    ${isSignedIn
      ? `<a href="/dashboard" class="btn btn--primary" data-config="hero_cta_continue">Continue Building</a>`
      : `<a href="#pricing" class="btn btn--primary" data-config="hero_cta_primary">Get Started</a>
         <a href="/sign-in" class="btn btn--ghost" data-config="hero_cta_signin">Sign in</a>`}
  </div>
  <p class="hero__trust" data-config="hero_trust">A LiLo Photography &amp; Branding course. Built for growing businesses ready to scale.</p>
</section>

<section class="framework">
  <p class="eyebrow eyebrow--gold" data-config="framework_eyebrow">The Framework</p>
  <h2 class="section-title section-title--inverse" data-config="framework_title">The 5 V's of Brand Building</h2>
  <div class="framework__grid">
    ${TOOL_ORDER.map(k => {
      const m = TOOL_META[k];
      const desc = {
        vision: 'Uncover your mission, vision statement, and the values that will guide every business decision you make.',
        value: 'Discover what makes you irreplaceable: your unique skills, story, and the ideal client who needs exactly what you offer.',
        voice: 'Find the words that sound like you. Build messaging, an "I Help" statement, and copy that converts.',
        visuals: 'Define your brand vibe, color palette, logo direction, and fonts for a visual identity that stops the scroll.',
        visibility: 'Choose where to show up, what content to create, and exactly what photos you need to attract your people.',
      }[k];
      return `<div class="v-card">
        <span class="v-card__num">${m.num}</span>
        <h3 class="v-card__title">${esc(m.label)}</h3>
        <p class="v-card__desc" data-config="framework_${k}_desc">${esc(desc)}</p>
      </div>`;
    }).join('')}
  </div>
</section>

<section class="meet-lisa">
  <div class="meet-lisa__inner">
    <div class="meet-lisa__photo">
      <img src="/img/lisa-portrait.jpg" alt="Lisa Lord, founder of LiLo Photography & Branding" loading="lazy">
    </div>
    <div class="meet-lisa__body">
      <p class="eyebrow" data-config="meet_eyebrow">Meet your strategist</p>
      <h2 class="meet-lisa__title"><span data-config="meet_title_line_1">Hey, I'm Lisa.</span><br><em><span data-config="meet_title_line_2">My friends call me LiLo.</span></em></h2>
      <p class="meet-lisa__lede" data-config="meet_lede">My superpower is helping business owners feel confident in their branding so they can show up in their marketing and take their business to the next level. I've been doing this for 14 years.</p>
      <p class="meet-lisa__copy" data-config="meet_para_1">This course is the framework I walk every 1:1 client through. The same Vision, Value, Voice, Visuals, and Visibility process. The same questions, the same prompts, the same direct feedback. Now in a format you can do on your time, at your pace, in your kitchen.</p>
      <p class="meet-lisa__copy" data-config="meet_para_2">If you've been winging your brand and it's costing you clients, you're in the right place.</p>
      <p class="meet-lisa__sign">Lisa</p>
    </div>
  </div>
</section>

<section class="how">
  <h2 class="section-title" data-config="how_title">Your AI Brand Strategist, on call.</h2>
  <p class="how__lede" data-config="how_lede">Each session pairs Lisa's framework with a live AI conversation, so you don't just learn. You build. Every answer becomes part of your downloadable Brand Guide.</p>
  <div class="how__steps">
    <div class="how__step"><span class="how__num">1</span><h3 data-config="how_step_1_title">Work through each V</h3><p data-config="how_step_1_body">Answer guided questions with your personal AI brand strategist. Go deep or skip what you know.</p></div>
    <div class="how__step"><span class="how__num">2</span><h3 data-config="how_step_2_title">Watch your guide build</h3><p data-config="how_step_2_body">Every session generates polished deliverables: statements, copy, checklists. All saved to your Brand Guide.</p></div>
    <div class="how__step"><span class="how__num">3</span><h3 data-config="how_step_3_title">Launch with confidence</h3><p data-config="how_step_3_body">Download your complete Brand Guide as a PDF. Your brand foundation, done.</p></div>
  </div>
</section>

<section class="testimonials">
  <p class="eyebrow">Kind words from LiLo clients</p>
  <h2 class="section-title">She's done this for them.<br><em>She'll do it for you.</em></h2>
  <div class="testimonials__grid">
    <figure class="testimonial">
      <blockquote>"Lisa has helped my business tremendously! She helped us rebrand and WOW what a difference it has made. Her work has stimulated growth, increased sales and has helped us keep a competitive edge."</blockquote>
      <figcaption>Vicki<span> · On Mountain Time</span></figcaption>
    </figure>
    <figure class="testimonial">
      <blockquote>"Lisa did so much more than take high quality photos. She created branding for my new business that spoke to exactly who I am and what I am aiming to achieve."</blockquote>
      <figcaption>Annie<span> · Sawubona Ranch</span></figcaption>
    </figure>
    <figure class="testimonial">
      <blockquote>"She assured me that she would do all the work and that I would be along for an amazing ride. She was 100% right and I would do it all over again, many times over."</blockquote>
      <figcaption>Deme<span> · Deme Riley Coaching</span></figcaption>
    </figure>
  </div>
</section>

<section id="pricing" class="pricing">
  <p class="eyebrow eyebrow--gold">Pricing</p>
  <h2 class="section-title section-title--inverse">Choose your path</h2>
  <p class="pricing__lede">Both options give you lifetime access to all 5 sessions and your Brand Guide.</p>

  <div class="pricing__grid">
    <div class="price-card">
      <p class="price-card__tier">Course</p>
      <p class="price-card__amount"><span class="price-card__num">$250</span><span class="price-card__when">one-time</span></p>
      <p class="price-card__desc">Full access to all 5 AI brand-building sessions and your downloadable Brand Guide PDF.</p>
      <ul class="price-card__list">
        <li>5 AI-guided sessions</li>
        <li>Downloadable Brand Guide PDF</li>
        <li>Lifetime access</li>
        <li>Build at your own pace</li>
      </ul>
      ${isSignedIn
        ? `<a href="/dashboard" class="btn btn--ghost-light">Go to Dashboard</a>`
        : `<button class="btn btn--ghost-light" data-checkout="course">Get Started for $250</button>`}
    </div>

    <div class="price-card price-card--featured">
      <span class="price-card__badge">Most Popular</span>
      <p class="price-card__tier">Course + Strategy Call</p>
      <p class="price-card__amount"><span class="price-card__num">$500</span><span class="price-card__when">one-time</span></p>
      <p class="price-card__desc">Everything in the course plus a private 1-hour strategy call with Lisa to bring your brand to life.</p>
      <ul class="price-card__list">
        <li>Everything in Course</li>
        <li>1-hour 1:1 strategy call with Lisa</li>
        <li>Brand review + feedback</li>
        <li>Personalized action plan</li>
      </ul>
      ${isSignedIn
        ? `<a href="/dashboard" class="btn btn--gold">Go to Dashboard</a>`
        : `<button class="btn btn--gold" data-checkout="coaching">Get Started for $500</button>`}
    </div>
  </div>
</section>

<section class="faq">
  <p class="eyebrow">Common questions</p>
  <h2 class="section-title">Before you buy.</h2>
  <div class="faq__list">
    <details class="faq__item">
      <summary>How long does the course take?</summary>
      <p>Most people finish all 5 sessions across one or two focused weekends. Each session takes about an hour, and you can pause and come back anytime. Your progress saves automatically.</p>
    </details>
    <details class="faq__item">
      <summary>Is this self-paced or live?</summary>
      <p>Self-paced. You go through each session as a private conversation with my AI brand strategist, on your time. The $500 tier adds a real 1:1 hour with me to bring it all to life.</p>
    </details>
    <details class="faq__item">
      <summary>What if I get stuck?</summary>
      <p>The AI is trained to ask follow-ups, offer suggestions, and gently push you when you're hedging. You can also email me anytime at lisa@photolilo.com if something isn't clicking.</p>
    </details>
    <details class="faq__item">
      <summary>Do I keep access forever?</summary>
      <p>Yes. Lifetime access to all 5 sessions, your saved answers, and your downloadable Brand Guide PDF. Come back and refine as your business grows.</p>
    </details>
    <details class="faq__item">
      <summary>I bought the $250 course. Can I add the strategy call later?</summary>
      <p>Absolutely. Once you've finished a few sessions, you'll see an option to add a 1-hour 1:1 strategy call with me for $300. No pressure, no expiration.</p>
    </details>
    <details class="faq__item">
      <summary>Who is this for?</summary>
      <p>Service-based and creative business owners who already have something working but know their brand could be working harder. If you're just starting out and don't yet have customers, you'll get more from a few months of doing the work first, then coming back.</p>
    </details>
  </div>
</section>

<section class="cta">
  <h2 class="cta__title">Branding that means business.</h2>
  <p class="cta__lede">Stop guessing. Start building. Your brand is waiting.</p>
  <a href="${isSignedIn ? '/dashboard' : '#pricing'}" class="btn btn--white">${isSignedIn ? 'Go to My Brand' : 'Get Started Today'}</a>
</section>
`;
  return htmlResponse(page({
    title: 'Build a Brand · LiLo Photography & Branding',
    nav: publicNav(user),
    main: main + publicFooter(),
    bodyClass: 'page-landing',
  }));
}

// ============================================================
// PUBLIC: Sign in / Sign up
// ============================================================

export function renderSignIn({ error, email = '' } = {}) {
  const main = `
<section class="auth">
  <div class="auth__panel">
    <p class="eyebrow">Welcome back</p>
    <h1 class="auth__title">Sign in</h1>
    <p class="auth__lede">Pick up where you left off.</p>
    ${error ? `<p class="auth__error">${esc(error)}</p>` : ''}
    <form class="auth__form" data-auth="signin">
      <label>Email
        <input type="email" name="email" autocomplete="email" required value="${esc(email)}">
      </label>
      <label>Password
        <input type="password" name="password" autocomplete="current-password" required minlength="8">
      </label>
      <button type="submit" class="btn btn--primary btn--full">Sign in</button>
    </form>
    <p class="auth__alt">New here? <a href="/#pricing">Get started</a></p>
  </div>
</section>
`;
  return htmlResponse(page({ title: 'Sign in', nav: publicNav(null), main, bodyClass: 'page-auth' }));
}

export function renderSignUp({ error, email = '', preheading = null, lede = null } = {}) {
  const main = `
<section class="auth">
  <div class="auth__panel">
    ${preheading ? `<p class="eyebrow">${esc(preheading)}</p>` : `<p class="eyebrow">Get started</p>`}
    <h1 class="auth__title">${preheading ? `You're in.` : `Create your account`}</h1>
    <p class="auth__lede">${esc(lede || 'It only takes a moment. Use the email you’d like your Brand Guide tied to.')}</p>
    ${error ? `<p class="auth__error">${esc(error)}</p>` : ''}
    <form class="auth__form" data-auth="signup">
      <label>Email
        <input type="email" name="email" autocomplete="email" required value="${esc(email)}">
      </label>
      <label>Password
        <input type="password" name="password" autocomplete="new-password" required minlength="8" placeholder="at least 8 characters">
      </label>
      <button type="submit" class="btn btn--primary btn--full">Create account</button>
    </form>
    <p class="auth__alt">Already have an account? <a href="/sign-in">Sign in</a></p>
  </div>
</section>
`;
  return htmlResponse(page({ title: 'Create your account', nav: publicNav(null), main, bodyClass: 'page-auth' }));
}

// ============================================================
// POST-STRIPE: Welcome (verifies the just-completed session)
// ============================================================

export function renderWelcomeAfterStripe({ email, error } = {}) {
  // No nav — this is a focused conversion moment.
  const main = `
<section class="auth">
  <div class="auth__panel">
    <div class="auth__success-pill">✓ Payment confirmed</div>
    <h1 class="auth__title">You're in. Let's build your brand.</h1>
    <p class="auth__lede">Create your account so your work saves to your Brand Guide. Use the same email you paid with.</p>
    ${error ? `<p class="auth__error">${esc(error)}</p>` : ''}
    <form class="auth__form" data-auth="signup">
      <label>Email
        <input type="email" name="email" autocomplete="email" required value="${esc(email || '')}" ${email ? 'readonly' : ''}>
      </label>
      <label>Password
        <input type="password" name="password" autocomplete="new-password" required minlength="8" placeholder="at least 8 characters">
      </label>
      <button type="submit" class="btn btn--primary btn--full">Create account &amp; continue</button>
    </form>
    <p class="auth__alt">Already have an account with us? <a href="/sign-in">Sign in</a>. Your purchase will be linked automatically.</p>
  </div>
</section>
`;
  return htmlResponse(page({ title: 'Welcome', nav: null, main, bodyClass: 'page-auth' }));
}

// ============================================================
// AUTH: Lisa's welcome letter (one-time)
// ============================================================

export function renderLisaLetter(user) {
  const name = user.first_name ? `, ${esc(user.first_name)}` : ' there';
  const main = `
<section class="lisa-letter">
  <div class="lisa-letter__photo">
    <img src="/img/lisa-portrait.jpg" alt="Lisa Lord" loading="lazy">
  </div>
  <div class="lisa-letter__body">
    <p class="eyebrow">A note from Lisa</p>
    <h1 class="lisa-letter__title">Hi${name}.<br>I'm so glad you're here.</h1>

    <div class="lisa-letter__copy">
      <p>What you're about to do isn't a course. It's a conversation. Five of them, actually. One for each pillar your brand needs to feel real and bring in the right people.</p>
      <p>You'll move through Vision, Value, Voice, Visuals, and Visibility with my AI brand strategist. She's trained on the same questions I'd ask if we were sitting across a coffee table. Take your time. Skip what doesn't fit. Go deep where it does. There's no wrong way to do this.</p>
      <p>By the end you'll have a Brand Guide PDF you can use as your north star for every decision. Pages, posts, photos, hires, prices. All of it gets easier when you know what your brand actually stands for.</p>
      <p>Let's build something you're proud of.</p>
    </div>

    <p class="lisa-letter__sign">Lisa</p>

    <form data-mark-welcomed class="lisa-letter__cta">
      <button type="submit" class="btn btn--primary">Take me to my dashboard →</button>
    </form>
  </div>
</section>
`;
  return htmlResponse(page({ title: 'Welcome', nav: null, main, bodyClass: 'page-letter' }));
}

// ============================================================
// AUTH: 3-question onboarding
// ============================================================

export function renderOnboarding(user) {
  const main = `
<section class="onboarding">
  <p class="eyebrow">Before we begin</p>
  <h1 class="onboarding__title">Tell me a little about you.</h1>
  <p class="onboarding__lede">Three quick questions. Your answers help me speak to you and your business throughout the journey. You can skip anything you'd rather come back to.</p>

  <form class="onboarding__form" data-onboarding>
    <label>What should I call you?
      <input type="text" name="first_name" autocomplete="given-name" required maxlength="60" placeholder="Your first name" value="${esc(user.first_name || '')}">
    </label>
    <label>What's the name of your business? <span class="onboarding__optional">optional</span>
      <input type="text" name="business_name" autocomplete="organization" maxlength="120" placeholder="If you have one already" value="${esc(user.business_name || '')}">
    </label>
    <label>Your website? <span class="onboarding__optional">optional</span>
      <input type="text" name="website" inputmode="url" maxlength="200" placeholder="https://yourbusiness.com" value="${esc(user.website || '')}">
    </label>
    <div class="onboarding__actions">
      <button type="submit" class="btn btn--primary">Take me to my dashboard →</button>
      <button type="button" class="btn btn--text" data-skip-onboarding>I'll add this later</button>
    </div>
  </form>
</section>
`;
  return htmlResponse(page({ title: 'Quick intro', nav: null, main, bodyClass: 'page-onboarding' }));
}

// ============================================================
// APP: Dashboard
// ============================================================

export function renderDashboard(user, progressRows) {
  const progressByTool = Object.fromEntries((progressRows || []).map(r => [r.tool, r]));
  const completedCount = TOOL_ORDER.filter(t => progressByTool[t]?.completed).length;
  const pct = Math.round((completedCount / 5) * 100);

  // Find the next V they should work on.
  const next = TOOL_ORDER.find(t => !progressByTool[t]?.completed) || 'visibility';
  const nextMeta = TOOL_META[next];
  const nextDoneOrInProgress = !!progressByTool[next];
  const nextButtonLabel = nextDoneOrInProgress ? `Continue: ${nextMeta.label} →` : `Begin: ${nextMeta.label} →`;
  const nextDesc = {
    vision: "We'll uncover your mission, vision, and the values that anchor every decision.",
    value: "We'll surface what makes you irreplaceable, and define your ideal client.",
    voice: "We'll build messaging that sounds like you and lands with the people you're meant to reach.",
    visuals: "We'll lock in your brand vibe, color palette, logo direction, and fonts.",
    visibility: "We'll choose your platforms, content type, and the photos you actually need.",
  }[next];

  const greeting = user.first_name ? `Welcome back, ${esc(user.first_name)}` : 'Welcome back';
  const subline = completedCount === 0
    ? "You're at the starting line. Let's build something great."
    : completedCount === 5
    ? "Your brand foundation is complete. Time to bring it to life."
    : `${completedCount} of 5 sessions done. Keep going. Momentum is everything.`;

  // Tier-aware right-rail card
  const isCoachingTier = user.tier === 'coaching' || user.has_call_credit;
  const rightRail = isCoachingTier ? coachingCard(user, completedCount) : upsellCard(completedCount);

  // The path / map of 5 V's
  const stations = TOOL_ORDER.map((tool, i) => {
    const meta = TOOL_META[tool];
    const row = progressByTool[tool];
    const done = !!row?.completed;
    const inProgress = !!row && !done;
    const prevDone = i === 0 || progressByTool[TOOL_ORDER[i - 1]]?.completed;
    const locked = !prevDone && !done && !inProgress;
    const state = done ? 'is-done' : inProgress ? 'is-progress' : locked ? 'is-locked' : 'is-active';
    const action = locked
      ? `<span class="station__lock">Complete ${TOOL_META[TOOL_ORDER[i - 1]].label} to unlock</span>`
      : done
      ? `<a href="/brand-builder/${tool}" class="station__action station__action--ghost">Revisit →</a>`
      : `<a href="/brand-builder/${tool}" class="station__action">${inProgress ? 'Continue →' : 'Start →'}</a>`;

    return `<article class="station ${state}">
      <div class="station__marker">
        ${done
          ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round"/></svg>`
          : `<span>${meta.num}</span>`}
      </div>
      <div class="station__body">
        <header>
          <h3 class="station__title">${esc(meta.label)}</h3>
          <p class="station__tag">${esc(meta.tagline)}</p>
        </header>
        ${row?.summary ? `<p class="station__preview">${esc(stripWhitespace(row.summary).slice(0, 180))}${row.summary.length > 180 ? '…' : ''}</p>` : ''}
      </div>
      <div class="station__action-wrap">${action}</div>
    </article>`;
  }).join('');

  const main = `
<section class="dash">
  <header class="dash__header">
    <p class="eyebrow">${greeting}</p>
    <h1 class="dash__title">Your Brand Journey</h1>
    <p class="dash__subline">${esc(subline)}</p>

    <div class="dash__progress">
      <div class="progress">
        <div class="progress__bar"><span style="width:${pct}%"></span></div>
        <p class="progress__meta"><strong>${completedCount}</strong> of 5 · ${pct}%</p>
      </div>
    </div>
  </header>

  <div class="dash__hero">
    <div class="hero-card">
      <p class="hero-card__eyebrow">${nextDoneOrInProgress ? 'Pick up where you left off' : 'Up next'}</p>
      <h2 class="hero-card__title">${esc(nextMeta.label)}</h2>
      <p class="hero-card__desc">${esc(nextDesc)}</p>
      <a href="/brand-builder/${next}" class="btn btn--primary btn--lg">${nextButtonLabel}</a>
    </div>
    ${rightRail}
  </div>

  <section class="path">
    <p class="eyebrow eyebrow--small">The path</p>
    <h2 class="path__title">All five sessions</h2>
    <div class="path__stations">${stations}</div>
  </section>
</section>
`;
  return htmlResponse(page({ title: 'Your Brand Journey', nav: appNav('/dashboard', user), main, bodyClass: 'page-dashboard' }));
}

function coachingCard(user, completedCount) {
  // $500 buyers and upsell-claimants. Unlocks at 3+ V's done.
  const unlocked = completedCount >= 3 && !user.call_booked_at;
  const booked = !!user.call_booked_at;
  return `<aside class="rail-card rail-card--gold ${unlocked ? 'is-unlocked' : ''}">
    <p class="rail-card__eyebrow">Your strategy call</p>
    ${booked
      ? `<h3 class="rail-card__title">You're booked.</h3>
         <p class="rail-card__desc">Lisa will see you at your scheduled time.</p>
         <a href="/coaching" class="btn btn--gold-ghost btn--sm">View details</a>`
      : unlocked
      ? `<h3 class="rail-card__title">Ready when you are.</h3>
         <p class="rail-card__desc">You've built a foundation. Let's bring it to life together.</p>
         <a href="/coaching" class="btn btn--gold btn--sm">Book your call →</a>`
      : `<h3 class="rail-card__title">Unlocks at 3 of 5.</h3>
         <p class="rail-card__desc">Your call with Lisa is included. We'll open it once your foundation is solid.</p>
         <p class="rail-card__lock">${3 - completedCount} more session${(3 - completedCount) === 1 ? '' : 's'} to unlock</p>`}
  </aside>`;
}

function upsellCard(completedCount) {
  // $250 buyers — offer to add the call for $300.
  if (completedCount < 3) {
    return `<aside class="rail-card">
      <p class="rail-card__eyebrow">Want to go deeper later?</p>
      <h3 class="rail-card__title">A 1:1 with Lisa</h3>
      <p class="rail-card__desc">Once you've built your foundation, you can add a private strategy call to put it into motion.</p>
      <p class="rail-card__lock">Available after 3 sessions</p>
    </aside>`;
  }
  return `<aside class="rail-card rail-card--terracotta">
    <p class="rail-card__eyebrow">Take it further</p>
    <h3 class="rail-card__title">Add a strategy call with Lisa</h3>
    <p class="rail-card__desc">A private 1-hour 1:1 to pressure-test your brand and map your next moves. <strong>$300 add-on.</strong></p>
    <button class="btn btn--primary btn--sm" data-checkout="upsell_call">Add a call →</button>
  </aside>`;
}

// ============================================================
// APP: Brand Builder (chat)
// ============================================================

export function renderBrandBuilder(user, tool, progressRow) {
  const meta = TOOL_META[tool];
  const intro = TOOL_INTROS[tool];
  const idx = TOOL_ORDER.indexOf(tool);
  const nextTool = TOOL_ORDER[idx + 1] || null;
  const prevTool = TOOL_ORDER[idx - 1] || null;
  const completed = !!progressRow?.completed;

  // We hydrate the chat state into a JSON blob the client app reads on load.
  const initialState = {
    tool,
    meta,
    nextTool,
    prevTool,
    intro,
    completed,
    messages: progressRow?.messages ? safeJSONParse(progressRow.messages, []) : [],
  };

  const main = `
<div class="builder">
  <header class="builder__header">
    <div>
      <p class="eyebrow"><span class="eyebrow__num">${meta.num}</span> ${esc(meta.label)}</p>
      <h1 class="builder__title">${esc(meta.tagline)}</h1>
    </div>
    <div class="builder__nav">
      ${prevTool ? `<a class="link-quiet" href="/brand-builder/${prevTool}">← ${esc(TOOL_META[prevTool].label)}</a>` : ''}
      ${nextTool ? `<a class="link-quiet" href="/brand-builder/${nextTool}">${esc(TOOL_META[nextTool].label)} →</a>` : ''}
    </div>
  </header>

  <div class="builder__shell">
    <div id="chat" class="chat" data-state='${esc(JSON.stringify(initialState))}'>
      <div class="chat__transcript" data-transcript></div>

      <div class="chat__ready-banner" data-ready-banner hidden>
        <p class="chat__ready-text">Looks like you've wrapped up <strong>${esc(meta.label)}</strong>. Lock it in and unlock the next session.</p>
        <button class="btn btn--gold btn--sm" data-mark-complete-ready>Lock in ${esc(meta.label)} →</button>
      </div>

      <div class="chat__input">
        <textarea data-input rows="2" placeholder="Type your answer… (Enter to send, Shift+Enter for a new line)"></textarea>
        <button class="btn btn--primary" data-send>Send</button>
      </div>
      <div class="chat__footer">
        <span class="chat__autosave" data-autosave>Your work saves automatically</span>
        <button class="chat__complete-link" data-mark-complete>I'm done with ${esc(meta.label)} for now →</button>
      </div>
    </div>
  </div>
</div>
`;
  return htmlResponse(page({
    title: `${meta.label} · Build a Brand`,
    nav: appNav(`/brand-builder/${tool}`, user),
    main,
    bodyClass: 'page-builder',
  }));
}

// ============================================================
// APP: Brand Guide (compiled summaries + download)
// ============================================================

export function renderBrandGuide(user, progressRows) {
  const byTool = Object.fromEntries((progressRows || []).map(r => [r.tool, r]));
  const completedCount = TOOL_ORDER.filter(t => byTool[t]?.completed).length;
  const allDone = completedCount === 5;

  const sections = TOOL_ORDER.map(t => {
    const m = TOOL_META[t];
    const row = byTool[t];
    const summary = row?.summary;
    const done = !!row?.completed;
    return `<section class="bg-section ${done ? 'is-done' : 'is-pending'}">
      <header class="bg-section__header">
        <span class="bg-section__num">${m.num}</span>
        <div>
          <h3 class="bg-section__title">${esc(m.label)}</h3>
          <p class="bg-section__tag">${esc(m.tagline)}</p>
        </div>
        <div class="bg-section__state">${done ? '✓ Complete' : `<a href="/brand-builder/${t}" class="link-quiet">Start →</a>`}</div>
      </header>
      <div class="bg-section__body">
        ${summary
          ? `<p class="bg-section__summary">${esc(summary)}</p>
             <a href="/brand-builder/${t}" class="link-quiet">Edit in session →</a>`
          : `<p class="bg-section__pending">Complete this session to see your ${esc(m.label)} summary here.</p>`}
      </div>
    </section>`;
  }).join('');

  const main = `
<section class="brand-guide">
  <header class="brand-guide__header">
    <p class="eyebrow">Your brand foundation</p>
    <h1 class="brand-guide__title">Brand Guide</h1>
    <p class="brand-guide__lede">Everything you've built across the 5 V's, compiled into your downloadable PDF.</p>
    <div class="progress progress--inline">
      <div class="progress__bar"><span style="width:${(completedCount / 5) * 100}%"></span></div>
      <p class="progress__meta">${completedCount} of 5 complete</p>
    </div>
  </header>

  <div class="brand-guide__cta ${allDone ? 'is-ready' : 'is-partial'}">
    ${allDone
      ? `<p class="eyebrow">Ready to download</p>
         <h2 class="brand-guide__cta-title">Your Brand Guide is complete.</h2>
         <p class="brand-guide__cta-desc">All 5 sessions done. Download your full Brand Guide PDF. Your brand foundation, locked in.</p>
         <button class="btn btn--gold" data-download-guide>Download Brand Guide PDF</button>`
      : `<h2 class="brand-guide__cta-title">${completedCount === 0
            ? 'Start your first session to begin building.'
            : `${5 - completedCount} session${(5 - completedCount) === 1 ? '' : 's'} left to unlock your full Brand Guide.`}</h2>
         <p class="brand-guide__cta-desc">You can download a partial guide with the sessions you've completed, or finish all 5 V's for the complete version.</p>
         <div class="brand-guide__cta-actions">
           ${completedCount > 0 ? `<button class="btn btn--ghost" data-download-guide>Download partial guide</button>` : ''}
           <a href="/dashboard" class="btn btn--primary">Continue building →</a>
         </div>`}
  </div>

  <div class="brand-guide__sections">${sections}</div>
</section>
`;
  return htmlResponse(page({
    title: 'Your Brand Guide',
    nav: appNav('/brand-guide', user),
    main,
    bodyClass: 'page-brand-guide',
  }));
}

// ============================================================
// APP: Coaching page (tier-aware)
// ============================================================

export function renderCoaching(user) {
  const isCoachingTier = user.tier === 'coaching' || user.has_call_credit;

  const main = isCoachingTier ? `
<section class="coaching">
  <p class="eyebrow">Work with Lisa</p>
  <h1 class="coaching__title">Your strategy call.</h1>
  <p class="coaching__lede">A private 1-hour conversation to pressure-test your brand, sharpen your direction, and map your next moves.</p>

  <div class="coaching__panel">
    <h2 class="coaching__panel-title">How to book</h2>
    <p>Send a note to <a href="mailto:lisa@photolilo.com">lisa@photolilo.com</a> with two or three time windows that work for you in the next two weeks. Lisa will confirm a time within one business day.</p>
    <p class="coaching__note">A direct booking link is on the way. For now this concierge step keeps things personal, and you'll get on Lisa's calendar fast.</p>

    <a class="btn btn--primary" href="mailto:lisa@photolilo.com?subject=Book%20my%20Build%20a%20Brand%20strategy%20call">Email Lisa to book</a>
  </div>
</section>
` : `
<section class="coaching">
  <p class="eyebrow">Take it further</p>
  <h1 class="coaching__title">Bring your brand to life with Lisa.</h1>
  <p class="coaching__lede">You've built the foundation. A 1-hour 1:1 with Lisa turns it into a plan you can actually execute.</p>

  <div class="coaching__panel coaching__panel--terracotta">
    <p class="coaching__panel-tier">Add a Strategy Call · $300</p>
    <ul class="coaching__list">
      <li>1-hour private 1:1 with Lisa</li>
      <li>Brand review and feedback</li>
      <li>Personalized action plan</li>
    </ul>
    <button class="btn btn--gold" data-checkout="upsell_call">Add a strategy call →</button>
  </div>
</section>
`;
  return htmlResponse(page({
    title: 'Coaching · Build a Brand',
    nav: appNav('/coaching', user),
    main,
    bodyClass: 'page-coaching',
  }));
}

// ============================================================
// APP: V completion celebration
// ============================================================

export function renderVComplete(user, tool, summary) {
  const meta = TOOL_META[tool];
  const idx = TOOL_ORDER.indexOf(tool);
  const nextTool = TOOL_ORDER[idx + 1];
  const isFinal = !nextTool;

  const main = `
<section class="vcomplete">
  <p class="eyebrow">${esc(meta.num)}</p>
  <h1 class="vcomplete__title">${esc(meta.label)}: locked in.</h1>
  ${summary
    ? `<div class="vcomplete__summary"><p class="vcomplete__summary-label">YOUR ${esc(meta.label.toUpperCase())} SUMMARY</p><div class="vcomplete__summary-body">${esc(summary)}</div></div>`
    : `<p class="vcomplete__lede">This session is marked complete. You can revisit and add more anytime.</p>`}

  <p class="vcomplete__line">Save this. It's the foundation for what comes next.</p>

  <div class="vcomplete__actions">
    ${isFinal
      ? `<a href="/brand-guide" class="btn btn--gold btn--lg">See your Brand Guide →</a>`
      : `<a href="/brand-builder/${nextTool}" class="btn btn--primary btn--lg">Next up: ${esc(TOOL_META[nextTool].label)} →</a>`}
    <a href="/dashboard" class="btn btn--ghost">Back to dashboard</a>
  </div>
</section>
`;
  return htmlResponse(page({
    title: `${meta.label} complete`,
    nav: appNav(`/brand-builder/${tool}`, user),
    main,
    bodyClass: 'page-vcomplete',
  }));
}

// ============================================================
// PRINT: PDF source page (consumed by Browser Rendering)
// Uses signed token instead of session cookie because headless browser
// won't have the user cookie. Renders one cover + 5 V pages.
// ============================================================

export function renderBrandGuidePrint(user, progressRows) {
  const byTool = Object.fromEntries((progressRows || []).map(r => [r.tool, r]));
  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const sectionPages = TOOL_ORDER.map(t => {
    const m = TOOL_META[t];
    const row = byTool[t];
    const summary = row?.summary?.trim();
    return `<section class="pdf-page pdf-section">
  <header class="pdf-section__header">
    <p class="pdf-section__num">${m.num}: The ${esc(m.label)}</p>
    <h2 class="pdf-section__title">${esc(m.label)}</h2>
    <p class="pdf-section__desc">${esc(m.tagline)}</p>
  </header>
  <div class="pdf-section__body">
    ${summary
      ? `<p class="pdf-section__label">YOUR ${esc(m.label.toUpperCase())} SUMMARY</p>
         <div class="pdf-section__summary">${esc(summary).replace(/\n/g, '<br>')}</div>`
      : `<div class="pdf-section__empty">This session hasn't been completed yet. Complete the ${esc(m.label)} session in your Brand Builder to unlock this page.</div>`}
  </div>
  <footer class="pdf-section__footer">
    <span>LiLo Photography &amp; Branding</span>
  </footer>
</section>`;
  }).join('');

  const fullDoc = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Brand Guide</title>
<link href="https://fonts.googleapis.com/css2?family=Gilda+Display&family=Montserrat:wght@300;400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/styles.css">
<link rel="stylesheet" href="/print.css">
</head>
<body class="page-print">
<section class="pdf-page pdf-cover">
  <p class="pdf-cover__eyebrow">Build a Brand · The Course</p>
  <h1 class="pdf-cover__title">Your Brand Guide</h1>
  <p class="pdf-cover__sub">${user.business_name ? esc(user.business_name) : 'Your brand foundation, captured.'}</p>
  <div class="pdf-cover__divider"></div>
  <p class="pdf-cover__meta">Generated ${esc(dateStr)} · LiLo Photography &amp; Branding</p>
</section>
${sectionPages}
</body>
</html>`;
  return htmlResponse(fullDoc);
}

// ============================================================
// Helpers
// ============================================================

function safeJSONParse(s, fallback) {
  try { return JSON.parse(s); } catch { return fallback; }
}

// Collapse all whitespace runs (incl. \n) to single spaces. Used to flatten
// AI summaries into single-line previews for dashboard cards.
function stripWhitespace(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}
