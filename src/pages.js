// Server-rendered HTML pages.

import { esc, page, publicNav, appNav, publicFooter, htmlResponse } from './render.js';
import { TOOL_META, TOOL_ORDER, TOOL_INTROS } from './prompts.js';
import { getVData, getCourseWelcomeLesson, getBonusModule, renderLessonBody } from './course.js';
import {
  getJourneySteps,
  getJourneyStep,
  nextJourneyStep,
  prevJourneyStep,
  journeyProgressPct,
  renderJourneyStepBody,
  visionDeliverables,
  valueDeliverables,
  journeyComplete,
  brandGuideEntries,
} from './journey.js';
import { nextOfficeHours, cadenceLabel } from './office-hours.js';

// ============================================================
// PUBLIC: Landing page
// ============================================================

export function renderLanding(user) {
  const isSignedIn = !!user;
  const main = `
<section class="hero">
  <p class="eyebrow" data-config="hero_eyebrow">The Next Level Brand Experience</p>
  <h1 class="hero__title"><span data-config="hero_title_line_1">A brand with purpose</span><br><em><span data-config="hero_title_line_2">is a brand with power.</span></em></h1>
  <p class="hero__lede" data-config="hero_lede">Five AI-guided sessions with Lisa's brand strategist. One downloadable Brand Guide. Strategic branding that drives revenue, not vibes.</p>
  <div class="hero__actions">
    ${isSignedIn
      ? `<a href="/dashboard" class="btn btn--primary" data-config="hero_cta_continue">Continue Building</a>`
      : `<a href="#pricing" class="btn btn--primary" data-config="hero_cta_primary">Get Started</a>
         <a href="/sign-in" class="btn btn--ghost" data-config="hero_cta_signin">Sign in</a>`}
  </div>
  <p class="hero__trust" data-config="hero_trust">A LiLo Brand Studio experience. Built for growing businesses ready to scale.</p>
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
      <img src="/img/lisa-portrait.jpg" alt="Lisa Lord, founder of LiLo Brand Studio" loading="lazy">
    </div>
    <div class="meet-lisa__body">
      <p class="eyebrow" data-config="meet_eyebrow">Meet your strategist</p>
      <h2 class="meet-lisa__title"><span data-config="meet_title_line_1">Hey, I'm Lisa.</span><br><em><span data-config="meet_title_line_2">My friends call me LiLo.</span></em></h2>
      <p class="meet-lisa__lede" data-config="meet_lede">My superpower is helping business owners feel confident in their branding so they can show up in their marketing and take their business to the next level. I've been doing this for 14 years.</p>
      <p class="meet-lisa__copy" data-config="meet_para_1">This experience is the framework I walk every 1:1 client through. The same Vision, Value, Voice, Visuals, and Visibility process. The same questions, the same prompts, the same direct feedback. Now in a format you can do on your time, at your pace, in your kitchen.</p>
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
  <h2 class="section-title section-title--inverse">Join the Experience</h2>
  <p class="pricing__lede">One price. Everything included. Lifetime access.</p>

  <div class="pricing__grid pricing__grid--single">
    <div class="price-card price-card--featured">
      <p class="price-card__tier">The Experience</p>
      <p class="price-card__amount"><span class="price-card__num">$297</span><span class="price-card__when">one-time</span></p>
      <p class="price-card__desc">The full Next Level Brand Experience, plus live monthly Office Hours with Lisa.</p>
      <ul class="price-card__list">
        <li>All 5 guided brand sessions</li>
        <li>20+ crafted brand deliverables</li>
        <li>Your downloadable Brand Guide PDF</li>
        <li>Monthly live Office Hours with Lisa</li>
        <li>Lifetime access, build at your own pace</li>
      </ul>
      ${isSignedIn
        ? `<a href="/dashboard" class="btn btn--ghost-light">Go to Dashboard</a>`
        : `<button class="btn btn--gold" data-checkout="course">Get Started for $297</button>`}
    </div>
  </div>
</section>

<section class="faq">
  <p class="eyebrow">Common questions</p>
  <h2 class="section-title">Before you buy.</h2>
  <div class="faq__list">
    <details class="faq__item">
      <summary>How long does the experience take?</summary>
      <p>Most people finish all 5 sessions across one or two focused weekends. Each session takes about an hour, and you can pause and come back anytime. Your progress saves automatically.</p>
    </details>
    <details class="faq__item">
      <summary>Is this self-paced or live?</summary>
      <p>Self-paced. Most people finish in a few focused sittings. And every month you can bring whatever you're working on to live Office Hours with me.</p>
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
      <summary>What are Office Hours?</summary>
      <p>Once a month I host a live session where you can bring your brand, your questions, and whatever you're stuck on, and get real help from me. Included with your purchase, same link every month.</p>
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
    title: 'The Next Level Brand Experience · LiLo Brand Studio',
    nav: publicNav(user),
    main: main + publicFooter(user),
    bodyClass: 'page-landing',
  }));
}

// ============================================================
// PUBLIC: Sign in / Sign up
// ============================================================

// Shared two-step passwordless form: email -> 6-digit code. app.js wires the
// [data-auth-code] form, toggling the two steps and calling request/verify.
function codeAuthForm({ email = '', readonly = false } = {}) {
  return `
    <form class="auth__form" data-auth-code novalidate>
      <div data-step="email">
        <label>Email
          <input type="email" name="email" autocomplete="email" required value="${esc(email)}" ${readonly ? 'readonly' : ''}>
        </label>
        <button type="submit" class="btn btn--primary btn--full">Email me a code</button>
      </div>
      <div data-step="code" hidden>
        <p class="auth__hint">We sent a 6-digit code to <strong data-email-echo>${esc(email)}</strong>. It's good for 15 minutes.</p>
        <label>Code
          <input type="text" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]*" placeholder="6-digit code">
        </label>
        <button type="submit" class="btn btn--primary btn--full">Sign in</button>
        <button type="button" class="auth__linkbtn" data-code-restart>Use a different email</button>
      </div>
      <p class="auth__error" data-auth-error hidden></p>
    </form>`;
}

export function renderSignIn({ email = '' } = {}) {
  const main = `
<section class="auth">
  <div class="auth__panel">
    <p class="eyebrow">Welcome back</p>
    <h1 class="auth__title">Sign in</h1>
    <p class="auth__lede">Enter your email and we'll send you a code. No password to remember.</p>
    ${codeAuthForm({ email })}
    <p class="auth__alt">New here? <a href="/#pricing">Get started</a></p>
  </div>
</section>
`;
  return htmlResponse(page({ title: 'Sign in', nav: publicNav(null), main, bodyClass: 'page-auth' }));
}

export function renderSignUp({ email = '', preheading = null, lede = null } = {}) {
  const main = `
<section class="auth">
  <div class="auth__panel">
    ${preheading ? `<p class="eyebrow">${esc(preheading)}</p>` : `<p class="eyebrow">Get started</p>`}
    <h1 class="auth__title">${preheading ? `You're in.` : `Sign in`}</h1>
    <p class="auth__lede">${esc(lede || 'Enter your email and we\'ll send you a code. No password to remember.')}</p>
    ${codeAuthForm({ email })}
    <p class="auth__alt">Already started? <a href="/sign-in">Sign in</a></p>
  </div>
</section>
`;
  return htmlResponse(page({ title: 'Sign in', nav: publicNav(null), main, bodyClass: 'page-auth' }));
}

// ============================================================
// POST-STRIPE: Welcome (verifies the just-completed session)
// ============================================================

export function renderWelcomeAfterStripe({ email } = {}) {
  // No nav - this is a focused conversion moment.
  const main = `
<section class="auth">
  <div class="auth__panel">
    <div class="auth__success-pill">Payment confirmed</div>
    <h1 class="auth__title">You're in. Let's build your brand.</h1>
    <p class="auth__lede">Enter your email and we'll send a code to log you in. Use the same email you paid with, and your work saves to your Brand Guide.</p>
    ${codeAuthForm({ email: email || '', readonly: !!email })}
    <p class="auth__alt">Trouble? <a href="/sign-in">Sign in here</a>. Your purchase links automatically.</p>
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
      <p>Watch the quick orientation below, then we dive in.</p>
    </div>

    ${renderWelcomeVideoCard({ inline: true })}

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

export function renderDashboard(user, progressRows, config) {
  const progressByTool = Object.fromEntries((progressRows || []).map(r => [r.tool, r]));

  // For each V with a journey, "complete" means its deliverables actually
  // exist (journeyComplete), not that the user reached the last step or that
  // a stale completed flag is set. Legacy V's fall back to the completed flag.
  const sectionStatus = TOOL_ORDER.map((tool) => {
    const row = progressByTool[tool];
    let sp = {};
    try { sp = typeof row?.step_progress === 'string' ? JSON.parse(row.step_progress) : (row?.step_progress || {}); } catch {}
    const journey = getJourneySteps(tool);
    const responses = sp.journey_responses || {};
    if (journey) {
      const done = journey.filter(s => responses[s.id]).length;
      const total = journey.length;
      const isComplete = journeyComplete(tool, responses);
      const inProgress = done > 0 && !isComplete;
      return {
        tool,
        meta: TOOL_META[tool],
        done, total,
        isComplete, inProgress,
        hasJourney: true,
      };
    }
    return {
      tool,
      meta: TOOL_META[tool],
      done: row?.completed ? 1 : 0,
      total: 1,
      isComplete: !!row?.completed,
      inProgress: !!row && !row.completed,
      hasJourney: false,
    };
  });

  const completedCount = sectionStatus.filter(s => s.isComplete).length;
  const pct = Math.round((completedCount / 5) * 100);

  // Find the resume target. First V that has a journey and isn't complete,
  // else first V that isn't complete (legacy), else /brand-guide if all done.
  const resumeTarget = sectionStatus.find(s => !s.isComplete) || null;
  const greeting = user.first_name ? `Welcome back, ${esc(user.first_name)}` : 'Welcome back';
  const headline = pct === 0
    ? "Let's pull your brand out of you."
    : pct === 100
    ? "Your brand foundation is locked in."
    : `You're ${pct}% in.`;
  const subline = pct === 0
    ? "This isn't a course. It's a guided VIP day, in chunks you can come back to. We save your spot every step."
    : pct === 100
    ? "Time to download your Brand Guide and put it to work."
    : resumeTarget
      ? `Up next: ${esc(resumeTarget.meta.label)}.`
      : "Pick up where you left off below.";

  const resumeHref = resumeTarget ? `/brand-builder/${resumeTarget.tool}` : '/brand-guide';
  const resumeLabel = pct === 0 ? 'Begin' : pct === 100 ? 'See your Brand Guide' : 'Resume';

  const rightRail = officeHoursCard(config);

  // Section overview list. Tight. No video chips. No workbook chips.
  const sectionList = sectionStatus.map((s) => {
    const stateLabel = s.isComplete
      ? 'Complete'
      : s.inProgress
      ? 'In progress'
      : 'Not started';
    const stateClass = s.isComplete ? 'is-done' : s.inProgress ? 'is-progress' : 'is-pending';
    const ariaLabel = `${s.meta.label}: ${stateLabel}`;
    return `<li class="dash-section ${stateClass}">
      <a href="/brand-builder/${s.tool}" class="dash-section__link" aria-label="${esc(ariaLabel)}">
        <span class="dash-section__num">${s.meta.num}</span>
        <span class="dash-section__body">
          <span class="dash-section__label">${esc(s.meta.label)}</span>
          <span class="dash-section__state">${esc(stateLabel)}</span>
        </span>
        <span class="dash-section__chev" aria-hidden="true">${s.isComplete ? '✓' : '→'}</span>
      </a>
    </li>`;
  }).join('');

  const guideUnlocked = completedCount === 5;
  const guideRow = `<li class="dash-section dash-section--guide ${guideUnlocked ? 'is-done' : 'is-pending'}">
    <a href="${guideUnlocked ? '/brand-guide' : '#'}" class="dash-section__link" ${guideUnlocked ? '' : 'aria-disabled="true" tabindex="-1"'}>
      <span class="dash-section__num">★</span>
      <span class="dash-section__body">
        <span class="dash-section__label">Your Brand Guide</span>
        <span class="dash-section__state">${guideUnlocked ? 'Ready to download' : 'Unlocks after all 5 sections'}</span>
      </span>
      <span class="dash-section__chev" aria-hidden="true">${guideUnlocked ? '→' : ''}</span>
    </a>
  </li>`;

  // Helper to read journey_responses for a given tool, handling string vs object step_progress.
  const readResponses = (tool) => {
    const row = progressByTool[tool];
    try {
      return typeof row?.step_progress === 'string'
        ? (JSON.parse(row.step_progress)?.journey_responses || {})
        : (row?.step_progress?.journey_responses || {});
    } catch { return {}; }
  };

  // Pull Vision deliverables (mission, vision, values) and Value deliverables
  // (unique value, ideal client portrait, transformation). Empty until those
  // steps are finished. Once written, they appear on every dashboard load.
  const visionResponses = readResponses('vision');
  const valueResponses = readResponses('value');
  const vd = visionDeliverables(visionResponses);
  const vald = valueDeliverables(valueResponses);
  const valuesRanking = visionResponses['values-rank']?.ranking || visionResponses['values-tap']?.selected || [];
  const valueLabel = (id) => (id || '').replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());
  const topValues = valuesRanking.slice(0, 6);
  const anyDeliverable = vd.some((d) => d.complete) || vald.some((d) => d.complete);
  const deliverablesPanel = anyDeliverable ? `
  <aside class="dash-deliverables">
    <p class="dash-deliverables__label">Your brand so far</p>
    ${vd[0].complete && vd[0].value ? `<div class="dash-deliverable">
      <p class="dash-deliverable__label">${esc(vd[0].label)}</p>
      <p class="dash-deliverable__value">${esc(vd[0].value)}</p>
    </div>` : ''}
    ${vd[1].complete && vd[1].value ? `<div class="dash-deliverable">
      <p class="dash-deliverable__label">${esc(vd[1].label)}</p>
      <p class="dash-deliverable__value">${esc(vd[1].value)}</p>
    </div>` : ''}
    ${vd[2].complete && topValues.length ? `<div class="dash-deliverable">
      <p class="dash-deliverable__label">Core Values</p>
      <p class="dash-deliverable__value">${topValues.map((id) => esc(valueLabel(id))).join(' · ')}</p>
    </div>` : ''}
    ${vald[2] && vald[2].complete && vald[2].value ? `<div class="dash-deliverable">
      <p class="dash-deliverable__label">${esc(vald[2].label)}</p>
      <p class="dash-deliverable__value">${esc(vald[2].value)}</p>
    </div>` : ''}
    ${vald[0] && vald[0].complete && vald[0].items && vald[0].items.length ? `<div class="dash-deliverable">
      <p class="dash-deliverable__label">${esc(vald[0].label)} (${vald[0].items.length})</p>
      <ul class="dash-deliverable__list">${vald[0].items.slice(0, 3).map((b) => `<li>${esc(b)}</li>`).join('')}${vald[0].items.length > 3 ? `<li class="dash-deliverable__more">+${vald[0].items.length - 3} more</li>` : ''}</ul>
    </div>` : ''}
    ${vald[1] && vald[1].complete && vald[1].value ? `<div class="dash-deliverable">
      <p class="dash-deliverable__label">${esc(vald[1].label)}</p>
      <p class="dash-deliverable__value">${esc(vald[1].value)}</p>
    </div>` : ''}
    ${vald[3] && vald[3].complete ? `<div class="dash-deliverable">
      <p class="dash-deliverable__label">Customer Transformation</p>
      <p class="dash-deliverable__value dash-deliverable__value--pending">Saved. Open Value to review.</p>
    </div>` : ''}
  </aside>` : '';

  const main = `
<section class="dash dash--welcome">
  <div class="dash__welcome">
    <p class="dash__eyebrow">${greeting}</p>
    <h1 class="dash__headline">${esc(headline)}</h1>
    <p class="dash__sub">${subline}</p>

    <div class="dash__progress">
      <div class="dash__progress-bar"><span style="width:${pct}%"></span></div>
    </div>

    <div class="dash__cta-row">
      <a href="${resumeHref}" class="btn btn--primary btn--lg">${resumeLabel} →</a>
      ${pct > 0 && pct < 100 ? `<a href="/brand-guide" class="btn--quiet">Brand Guide so far →</a>` : ''}
    </div>

    ${deliverablesPanel}
  </div>

  <div class="dash__rail">${rightRail}</div>

  <div class="dash__sections">
    <p class="dash__sections-label">Sections</p>
    <ul class="dash-sections">
      ${sectionList}
      ${guideRow}
    </ul>
  </div>
</section>
`;
  return htmlResponse(page({ title: 'Your Brand Journey', nav: appNav('/dashboard', user), main, bodyClass: 'page-dashboard' }));
}

// Rough minutes-remaining estimate for the resume target (uses the journey
// step estimatedMinutes if available; falls back to a flat 20 for legacy V's).
function estimateMinutesForResume(section) {
  if (!section.hasJourney) return 20;
  const journey = getJourneySteps(section.tool);
  if (!journey) return 20;
  // Sum estimated minutes for incomplete steps, capped at 25 so it doesn't scare them.
  let total = 0;
  for (const step of journey) {
    total += step.estimatedMinutes || 5;
    if (total >= 25) return 25;
  }
  return total;
}

// Multi-step progress chips for a V station card on the dashboard.
// Surfaces {videos watched · workbook · chat · summary} compactly.
function renderStepChips(tool, row) {
  const vData = getVData(tool);
  const totalVideos = (vData?.lessons || []).filter(l => l.video_ids && l.video_ids.length > 0).length;
  let sp = {};
  try { sp = typeof row?.step_progress === 'string' ? JSON.parse(row.step_progress) : (row?.step_progress || {}); } catch {}
  const watched = Array.isArray(sp.videos_watched) ? sp.videos_watched.length : 0;
  const watchedCapped = Math.min(watched, totalVideos);
  const workbook = !!sp.workbook_downloaded_at;
  const chatStarted = !!sp.chat_started_at || (Array.isArray(safeJSONParse(row?.messages, [])) && safeJSONParse(row?.messages, []).length > 0);
  const summary = !!row?.completed;

  const chip = (filled, label) =>
    `<span class="step-chip ${filled ? 'is-done' : ''}"><span class="step-chip__dot" aria-hidden="true">${filled ? '✓' : '○'}</span>${label}</span>`;

  return `<div class="step-chips">
    ${totalVideos > 0
      ? `<span class="step-chip ${watchedCapped === totalVideos ? 'is-done' : watchedCapped > 0 ? 'is-progress' : ''}"><span class="step-chip__dot" aria-hidden="true">${watchedCapped === totalVideos ? '✓' : '▶'}</span>${watchedCapped}/${totalVideos} videos</span>`
      : ''}
    ${chip(workbook, 'workbook')}
    ${chip(chatStarted, 'chat')}
    ${chip(summary, 'summary')}
  </div>`;
}

// Course-wide welcome video block. Used at the top of the dashboard and
// inside the Lisa letter page. Same source video, replayable any time.
// `inline: true` skips the surrounding card chrome (used inside the letter).
function renderWelcomeVideoCard(opts = {}) {
  const lesson = getCourseWelcomeLesson();
  const videoId = lesson?.video_ids?.[0];
  if (!videoId) return '';
  const iframe = `<div class="welcome-video__frame">
    <iframe src="https://www.youtube.com/embed/${esc(videoId)}?rel=0"
      title="Welcome from Lisa"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      referrerpolicy="strict-origin-when-cross-origin"
      allowfullscreen></iframe>
  </div>`;
  if (opts.inline) return `<div class="welcome-video welcome-video--inline">${iframe}</div>`;
  return `<aside class="welcome-video">
    <div class="welcome-video__body">
      <p class="eyebrow">A note from Lisa</p>
      <h2 class="welcome-video__title">Watch first. Build second.</h2>
      <p class="welcome-video__lede">A 90-second orientation on how to make this experience work for you. Replay any time.</p>
    </div>
    ${iframe}
  </aside>`;
}

function officeHoursCard(config) {
  const copy = config?.copy || {};
  const next = nextOfficeHours(copy);
  const when = copy.office_hours_schedule || `${next.label} · ${copy.office_hours_time || '12:00pm Mountain'}`;
  const today = next.isToday && !copy.office_hours_schedule;
  return `<aside class="rail-card rail-card--gold is-unlocked">
    <p class="rail-card__eyebrow">Included with your experience</p>
    <h3 class="rail-card__title">Monthly Office Hours with Lisa</h3>
    <p class="rail-card__desc">${today ? 'Today: ' : 'Next session: '}${esc(when)}.</p>
    <a href="/coaching" class="btn btn--gold-ghost btn--sm">${today ? 'Join today →' : 'See details →'}</a>
  </aside>`;
}

// ============================================================
// APP: Journey (the new VIP-day step engine)
// ============================================================
// Replaces the watch + workbook + chat layout for tools that have a journey
// definition. First ship: vision only. Other tools fall back to renderBrandBuilder.

export function renderJourney(user, tool, slug, journeyResponses) {
  const meta = TOOL_META[tool];
  const steps = getJourneySteps(tool);
  if (!steps) return null; // caller falls back to legacy
  const responses = journeyResponses || {};
  // If a slug was given and exists, render that step. Otherwise resume to the
  // first step without a saved response (so /brand-builder/vision lands them
  // wherever they left off).
  let step = getJourneyStep(tool, slug);
  if (!step) {
    step = steps.find((s) => !responses[s.id]) || steps[steps.length - 1];
  }
  const next = nextJourneyStep(tool, step.id);
  const prev = prevJourneyStep(tool, step.id);
  const idx = steps.findIndex((s) => s.id === step.id);
  const pct = journeyProgressPct(tool, journeyResponses || {});
  const savedResponse = (journeyResponses && journeyResponses[step.id]) || null;

  const body = renderJourneyStepBody(tool, step, savedResponse, responses);

  // The black appNav at the top already has the 5 V's as pill links, so the
  // separate cream v-stepnav was a duplicate. Removed by Lisa's request.
  const main = `
<div class="journey" data-tool="${esc(tool)}" data-step-id="${esc(step.id)}">

  <header class="journey__header">
    <div class="journey__crumbs">
      <p class="journey__eyebrow">${esc(meta.label)}${step.section ? ` <span class="journey__eyebrow-sub">· ${esc(step.section)}</span>` : ''}</p>
    </div>
    <div class="journey__progress">
      <div class="journey__progress-fill" style="width:${Math.round(((idx + 1) / steps.length) * 100)}%"></div>
    </div>
  </header>

  <section class="journey__step">
    <h1 class="journey__title">${esc(step.title)}</h1>
    ${step.subtitle ? `<p class="journey__subtitle">${esc(step.subtitle)}</p>` : ''}
    <div class="journey__body">${body}</div>
  </section>

  <footer class="journey__footer">
    ${prev ? `<a class="journey__back" href="/brand-builder/${tool}?s=${esc(prev.id)}">← Back</a>` : '<span></span>'}
    <button type="button" class="btn btn--primary journey__next" data-journey-next data-tool="${esc(tool)}" data-step-id="${esc(step.id)}" data-next-slug="${esc(next ? next.id : '')}">
      ${next ? 'Save & continue →' : 'Save & finish →'}
    </button>
  </footer>

  <p class="journey__exit-hint">You can come back any time. <a href="/dashboard">Save and exit</a> · <a href="/brand-builder/${tool}?legacy=1">Switch to legacy view</a></p>
</div>
`;

  return htmlResponse(page({
    title: `${meta.label} · ${step.title} · The Next Level Brand Experience`,
    nav: appNav(`/brand-builder/${tool}`, user),
    main,
    bodyClass: 'page-builder page-journey',
  }));
}

// ============================================================
// APP: Brand Builder (legacy: watch + workbook + chat)
// ============================================================

export function renderBrandBuilder(user, tool, progressRow, vData, stepProgress) {
  const meta = TOOL_META[tool];
  const intro = TOOL_INTROS[tool];
  const idx = TOOL_ORDER.indexOf(tool);
  const nextTool = TOOL_ORDER[idx + 1] || null;
  const prevTool = TOOL_ORDER[idx - 1] || null;
  const completed = !!progressRow?.completed;
  const summary = progressRow?.summary || '';
  const watched = new Set((stepProgress?.videos_watched) || []);
  const workbookDownloaded = !!stepProgress?.workbook_downloaded_at;

  const initialState = {
    tool,
    meta,
    nextTool,
    prevTool,
    intro,
    completed,
    messages: progressRow?.messages ? safeJSONParse(progressRow.messages, []) : [],
  };

  const watchSection = renderVWatch(tool, vData?.lessons || [], watched);
  const workbookSection = renderVWorkbook(tool, vData?.workbook, workbookDownloaded);
  const buildSection = renderVBuild(initialState, meta);
  const lockSection = renderVLockIn(meta, summary, nextTool, completed);

  // The black appNav at the top already has the 5 V's as pill links. The
  // separate cream v-stepnav was a duplicate. Removed by Lisa's request.
  const main = `
<div class="v-page" data-tool="${esc(tool)}">

  <header class="v-hero">
    <p class="eyebrow eyebrow--gold">Module ${meta.num} · ${esc(meta.label)}</p>
    <h1 class="v-hero__title">${esc(meta.tagline)}</h1>
    <p class="v-hero__lede">${esc(vDescription(tool))}</p>
  </header>

  ${watchSection}
  ${workbookSection}
  ${buildSection}
  ${lockSection}

  <nav class="v-page__nav">
    ${prevTool ? `<a class="link-quiet" href="/brand-builder/${prevTool}">← ${esc(TOOL_META[prevTool].label)}</a>` : '<span></span>'}
    ${nextTool ? `<a class="link-quiet" href="/brand-builder/${nextTool}">${esc(TOOL_META[nextTool].label)} →</a>` : '<a class="link-quiet" href="/brand-guide">Your Brand Guide →</a>'}
  </nav>
</div>
`;
  return htmlResponse(page({
    title: `${meta.label} · The Next Level Brand Experience`,
    nav: appNav(`/brand-builder/${tool}`, user),
    main,
    bodyClass: 'page-builder page-v',
  }));
}

// What we'll do here - one sentence per V, written like a course teacher.
function vDescription(tool) {
  return ({
    vision: "Watch Lisa walk through Mission, Vision, and Values. Then sit down with your AI strategist and lock yours in.",
    value: "Discover what makes you irreplaceable and write a portrait of the person who needs exactly what you offer.",
    voice: 'Find the words that sound like you. Build "I Help" statements, common language, and an About Me that converts.',
    visuals: "Vibe, color palette, logo, fonts. Walk out with a visual identity that finally matches what you've built.",
    visibility: "Choose where to show up, what content to make, and exactly what photos you need to attract your people.",
  })[tool] || '';
}

// V page - Section 1: Watch
// Featured video player with chip-rail underneath. Each chip swaps the player.
// Public/app.js wires the click handler + POSTs /api/progress/step.
function renderVWatch(tool, lessons, watchedSet) {
  if (!lessons || lessons.length === 0) {
    return ''; // No videos for this V - section hides entirely.
  }
  // First-with-video becomes the initial featured lesson.
  const firstVideo = lessons.find(l => l.video_ids && l.video_ids.length > 0) || lessons[0];
  const featuredId = firstVideo.video_ids?.[0] || '';
  const chips = lessons.map((l, i) => {
    const vid = l.video_ids?.[0] || '';
    if (!vid) return ''; // Skip text-only lessons
    const watched = watchedSet.has(vid);
    const cls = `v-chip ${watched ? 'is-watched' : ''} ${l.slug === firstVideo.slug ? 'is-current' : ''}`.trim();
    return `<button type="button" class="${cls}" data-lesson-slug="${esc(l.slug)}" data-video-id="${esc(vid)}">
      <span class="v-chip__num">${String(i + 1).padStart(2, '0')}</span>
      <span class="v-chip__title">${esc(l.title)}</span>
      <span class="v-chip__check" aria-hidden="true">✓</span>
    </button>`;
  }).join('');

  return `
<section class="v-watch" data-section="watch">
  <header class="v-section__head">
    <p class="v-section__num">01</p>
    <h2 class="v-section__title">Watch</h2>
    <p class="v-section__lede">${esc(lessons.length)} video${lessons.length === 1 ? '' : 's'} from Lisa. Watch in any order.</p>
  </header>
  <div class="v-watch__player">
    <div class="v-watch__frame">
      <iframe data-video-frame
        src="https://www.youtube.com/embed/${esc(featuredId)}?rel=0"
        title="${esc(firstVideo.title)}"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerpolicy="strict-origin-when-cross-origin"
        allowfullscreen></iframe>
    </div>
    <p class="v-watch__caption" data-video-caption>${esc(firstVideo.title)}</p>
  </div>
  <div class="v-chip-rail" role="tablist" aria-label="${esc(TOOL_META[tool].label)} videos">${chips}</div>
</section>`;
}

// V page - Section 2: Workbook
function renderVWorkbook(tool, workbook, alreadyDownloaded) {
  if (!workbook || !workbook.url) return '';
  return `
<section class="v-workbook" data-section="workbook">
  <header class="v-section__head">
    <p class="v-section__num">02</p>
    <h2 class="v-section__title">Workbook</h2>
    <p class="v-section__lede">Download Lisa's PDF workbook. Fill it as you watch, or print and write by hand.</p>
  </header>
  <a class="v-workbook__card ${alreadyDownloaded ? 'is-done' : ''}"
     href="${esc(workbook.url)}"
     target="_blank"
     rel="noopener"
     data-workbook-link>
    
    <div class="v-workbook__body">
      <p class="v-workbook__title">${esc(workbook.title || 'Module Workbook')}</p>
      <p class="v-workbook__desc">${esc(workbook.description || 'PDF, fillable and printable')}</p>
    </div>
    <div class="v-workbook__cta">
      <span class="v-workbook__cta-text">${alreadyDownloaded ? 'Downloaded. Open again' : 'Download PDF'}</span>
      <span aria-hidden="true">↓</span>
    </div>
  </a>
</section>`;
}

// V page - Section 3: Build (the AI chat - preserved exactly from prior renderBrandBuilder)
function renderVBuild(initialState, meta) {
  return `
<section class="v-build" data-section="build">
  <header class="v-section__head">
    <p class="v-section__num">03</p>
    <h2 class="v-section__title">Build with your strategist</h2>
    <p class="v-section__lede">Now sit down with Lisa's AI brand strategist. Answer her questions, take your time. Your work saves as you go.</p>
  </header>
  <div class="v-build__shell">
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
</section>`;
}

// V page - Section 4: Lock it in (only renders when summary exists)
function renderVLockIn(meta, summary, nextTool, completed) {
  if (!completed && !summary) return '';
  const nextHref = nextTool ? `/brand-builder/${nextTool}` : '/brand-guide';
  const nextLabel = nextTool ? `Continue to ${TOOL_META[nextTool].label}` : 'See your Brand Guide';
  return `
<section class="v-lock-in" data-section="lock-in">
  <header class="v-section__head">
    <p class="v-section__num">04</p>
    <h2 class="v-section__title">${esc(meta.label)}: locked in</h2>
    <p class="v-section__lede">Save this. It's the foundation for what comes next.</p>
  </header>
  ${summary ? `<div class="v-lock-in__summary">${esc(summary).replace(/\n\n/g, '</p><p>').replace(/^/, '<p>').replace(/$/, '</p>')}</div>` : ''}
  <a href="${nextHref}" class="btn btn--gold v-lock-in__next">${esc(nextLabel)} →</a>
</section>`;
}

// ============================================================
// APP: Brand Guide (compiled summaries + download)
// ============================================================

// Render structured Brand Guide blocks. mode 'web' | 'print' picks class prefixes.
function renderGuideBlocks(blocks, mode) {
  const p = mode === 'print' ? 'pdf' : 'bg';
  return blocks.map((b) => {
    if (b.kind === 'statement') {
      return `<div class="${p}-entry">
        <p class="${p}-entry__label">${esc(b.label)}</p>
        <p class="${p}-entry__statement">${esc(b.text)}</p>
      </div>`;
    }
    if (b.kind === 'list') {
      return `<div class="${p}-entry">
        <p class="${p}-entry__label">${esc(b.label)}</p>
        <ul class="${p}-entry__list">${b.items.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
      </div>`;
    }
    if (b.kind === 'defs') {
      return `<div class="${p}-entry">
        <p class="${p}-entry__label">${esc(b.label)}</p>
        ${b.items.map((it) => `<div class="${p}-entry__def">
          <p class="${p}-entry__def-label">${esc(it.label)}</p>
          ${it.text ? `<p class="${p}-entry__def-text">${esc(it.text)}</p>` : ''}
        </div>`).join('')}
      </div>`;
    }
    return '';
  }).join('');
}

function rowResponses(row) {
  try {
    const sp = typeof row?.step_progress === 'string' ? JSON.parse(row.step_progress) : (row?.step_progress || {});
    return sp?.journey_responses || {};
  } catch { return {}; }
}

export function renderBrandGuide(user, progressRows) {
  const byTool = Object.fromEntries((progressRows || []).map(r => [r.tool, r]));
  const statuses = TOOL_ORDER.map(t => {
    const row = byTool[t];
    const responses = rowResponses(row);
    const hasJourney = !!getJourneySteps(t);
    return { t, row, responses, done: hasJourney ? journeyComplete(t, responses) : !!row?.completed };
  });
  const completedCount = statuses.filter(s => s.done).length;
  const allDone = completedCount === 5;

  const sections = statuses.map(({ t, row, responses, done }) => {
    const m = TOOL_META[t];
    const blocks = brandGuideEntries(t, responses);
    const summary = row?.summary;
    return `<section class="bg-section ${done ? 'is-done' : 'is-pending'}">
      <header class="bg-section__header">
        <span class="bg-section__num">${m.num}</span>
        <div>
          <h3 class="bg-section__title">${esc(m.label)}</h3>
          <p class="bg-section__tag">${esc(m.tagline)}</p>
        </div>
        <div class="bg-section__state">${done ? 'Complete' : `<a href="/brand-builder/${t}" class="link-quiet">Continue ${esc(m.label)} →</a>`}</div>
      </header>
      <div class="bg-section__body">
        ${blocks
          ? renderGuideBlocks(blocks, 'web') + `<a href="/brand-builder/${t}" class="link-quiet">Revisit ${esc(m.label)} →</a>`
          : summary
          ? `<p class="bg-section__summary">${esc(summary)}</p>
             <a href="/brand-builder/${t}" class="link-quiet">Revisit ${esc(m.label)} →</a>`
          : `<p class="bg-section__pending">Open <a href="/brand-builder/${t}">${esc(m.label)}</a> and work through the experience. Your deliverables compile here as you go.</p>`}
      </div>
    </section>`;
  }).join('');

  // Bonus section - Module 6 of the ThriveCart course (Tools, Downloads, Templates).
  // Built from the manifest's bonus module: lists the workbook + every bonus
  // download Lisa packed in. Always visible (not gated) so users can grab the
  // resources even mid-journey.
  const bonusModule = getBonusModule();
  const bonusDownloads = bonusModule
    ? [bonusModule.workbook, ...(bonusModule.bonus_downloads || [])].filter(Boolean)
    : [];
  const bonusSection = bonusDownloads.length === 0 ? '' : `
<section class="bg-bonus">
  <header class="bg-bonus__header">
    <p class="eyebrow eyebrow--gold">Bonus</p>
    <h2 class="bg-bonus__title">${esc(bonusModule?.title || 'Tools, Downloads, Templates')}</h2>
    <p class="bg-bonus__lede">Everything Lisa packs into the experience: workbooks, content templates, planners, implementation checklists. Yours forever.</p>
  </header>
  <div class="bg-bonus__grid">
    ${bonusDownloads.map(d => `<a class="bg-bonus__card" href="${esc(d.url)}" target="_blank" rel="noopener">
      
      <span class="bg-bonus__body">
        <span class="bg-bonus__name">${esc(d.title || 'Download')}</span>
        <span class="bg-bonus__desc">${esc(d.description || 'PDF download')}</span>
      </span>
      <span class="bg-bonus__cta">Download ↓</span>
    </a>`).join('')}
  </div>
</section>`;

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
         <p class="brand-guide__cta-desc">All 5 sections done. Download your full Brand Guide PDF. Your brand foundation, locked in.</p>
         <button class="btn btn--gold" data-download-guide>Download Brand Guide PDF</button>`
      : `<h2 class="brand-guide__cta-title">${completedCount === 0
            ? 'Start your first section to begin building.'
            : `${5 - completedCount} section${(5 - completedCount) === 1 ? '' : 's'} left to unlock your full Brand Guide.`}</h2>
         <p class="brand-guide__cta-desc">You can download a partial guide with the sections you've completed, or finish all 5 V's for the complete version.</p>
         <div class="brand-guide__cta-actions">
           ${completedCount > 0 ? `<button class="btn btn--ghost" data-download-guide>Download partial guide</button>` : ''}
           <a href="/dashboard" class="btn btn--primary">Continue building →</a>
         </div>`}
  </div>

  <div class="brand-guide__sections">${sections}</div>

  ${bonusSection}
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

export function renderCoaching(user, config) {
  const copy = config?.copy || {};
  const next = nextOfficeHours(copy);
  const schedule = copy.office_hours_schedule || `${next.label} · ${copy.office_hours_time || '12:00pm Mountain'}`;
  const cadence = cadenceLabel(copy);
  const link = copy.office_hours_link || '';
  const desc = copy.office_hours_desc || "Bring your brand, your questions, and whatever you're stuck on. Live, unscripted, and included with your experience.";

  const main = `
<section class="coaching">
  <p class="eyebrow">Included with your experience</p>
  <h1 class="coaching__title">${esc(copy.office_hours_title || 'Monthly Office Hours with Lisa.')}</h1>
  <p class="coaching__lede">${esc(desc)}</p>

  <div class="coaching__panel">
    <h2 class="coaching__panel-title">${next.isToday && !copy.office_hours_schedule ? 'Today.' : 'Next session'}</h2>
    <p class="coaching__schedule">${esc(schedule)}</p>
    <p class="coaching__cadence">${esc(cadence)}.${link ? ' Same link every month.' : ''}</p>
    ${link
      ? `<a class="btn btn--primary" href="${esc(link)}" target="_blank" rel="noopener">Join the session</a>`
      : `<p class="coaching__note">The join link lands in your inbox before each session. Questions in the meantime? <a href="mailto:lisa@photolilo.com">Email Lisa</a>.</p>`}
  </div>
</section>
`;
  return htmlResponse(page({
    title: 'Office Hours · The Next Level Brand Experience',
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
    const blocks = brandGuideEntries(t, rowResponses(row));
    const body = blocks
      ? renderGuideBlocks(blocks, 'print')
      : summary
      ? `<p class="pdf-section__label">YOUR ${esc(m.label.toUpperCase())} SUMMARY</p>
         <div class="pdf-section__summary">${esc(summary).replace(/\n/g, '<br>')}</div>`
      : `<div class="pdf-section__empty">This section is still open. Work through ${esc(m.label)} in your experience to fill this page.</div>`;
    return `<section class="pdf-page pdf-section">
  <header class="pdf-section__header">
    <p class="pdf-section__num">${m.num}: The ${esc(m.label)}</p>
    <h2 class="pdf-section__title">${esc(m.label)}</h2>
    <p class="pdf-section__desc">${esc(m.tagline)}</p>
  </header>
  <div class="pdf-section__body">
    ${body}
  </div>
  <footer class="pdf-section__footer">
    <span>LiLo Brand Studio · The Next Level Brand Experience</span>
  </footer>
</section>`;
  }).join('');

  const fullDoc = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Brand Guide</title>
<link href="https://fonts.googleapis.com/css2?family=Lato:wght@300;400;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/styles.css">
<link rel="stylesheet" href="/print.css">
</head>
<body class="page-print">
<section class="pdf-page pdf-cover">
  <img class="pdf-cover__mark" src="/img/stamp-transparent.png" alt="LiLo Brand Studio" />
  <p class="pdf-cover__eyebrow">The Next Level Brand Experience</p>
  <h1 class="pdf-cover__title">Your Brand Guide</h1>
  <p class="pdf-cover__sub">${user.business_name ? esc(user.business_name) : 'Your brand foundation, captured.'}</p>
  <div class="pdf-cover__divider"></div>
  <p class="pdf-cover__meta">Generated ${esc(dateStr)} · LiLo Brand Studio</p>
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
