// Course library — renders the imported ThriveCart "Build A Brand" lessons
// inside Lisa's app. Bundled at build time via tools/build_course_bundle.py.
//
// Routes:
//   /learn               -> index of all modules + lessons
//   /learn/<slug>        -> a single lesson (markdown body + YouTube embeds)
//
// Both are gated to paid users (called from index.js after authenticate()).
//
// The lesson body is markdown with `[VIDEO:<embed-url>]` placeholders for
// YouTube iframes. We convert the markdown to HTML with `marked` and replace
// the VIDEO markers with a responsive iframe wrapper.

import { marked } from 'marked';
import { COURSE } from './course-content.js';
import { esc, page, appNav, htmlResponse } from './render.js';

// Build a flat lesson lookup keyed by slug — for /learn/<slug>.
const LESSONS_BY_SLUG = (() => {
  const map = new Map();
  for (const m of COURSE.modules) {
    for (const l of m.lessons) {
      map.set(l.slug, { ...l, module: m });
    }
  }
  return map;
})();

// Replace [VIDEO:url] markers (with possibly markdown-escaped underscores)
// with a responsive iframe block. Done before marked() so they render outside
// of <p> wrappers cleanly.
function expandVideoMarkers(md) {
  // Markdown processing escapes '_' as '\_'; restore those inside VIDEO markers.
  return md.replace(/\[VIDEO:([^\]]+)\]/g, (_, url) => {
    const clean = url.replace(/\\_/g, '_');
    return `\n\n<div class="lesson-video"><iframe src="${esc(clean)}" allowfullscreen loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"></iframe></div>\n\n`;
  });
}

function renderLessonBody(md) {
  const expanded = expandVideoMarkers(md);
  return marked.parse(expanded, { gfm: true, breaks: false });
}

// ============================================================
// /learn — module + lesson index
// ============================================================
export function renderCourseIndex(user) {
  const moduleHtml = COURSE.modules.map(m => {
    const lessons = m.lessons.map(l => {
      const videoBadge = l.video_ids.length > 0 ? `<span class="learn-lesson__icon" aria-hidden="true">▶</span>` : '';
      return `<a href="/learn/${esc(l.slug)}" class="learn-lesson">
        ${videoBadge}
        <span class="learn-lesson__title">${esc(l.title)}</span>
      </a>`;
    }).join('');
    return `<section class="learn-module">
      <header class="learn-module__head">
        <span class="learn-module__num">${String(m.order).padStart(2, '0')}</span>
        <h2 class="learn-module__title">${esc(m.title)}</h2>
      </header>
      <div class="learn-module__lessons">${lessons}</div>
    </section>`;
  }).join('');

  const main = `
<div class="learn-page">
  <header class="learn-hero">
    <p class="eyebrow">Course Library</p>
    <h1 class="learn-hero__title">${esc(COURSE.course.title)}</h1>
    <p class="learn-hero__lede">${COURSE.modules.length} modules. ${LESSONS_BY_SLUG.size} lessons. Watch in any order, return any time.</p>
  </header>
  <div class="learn-modules">${moduleHtml}</div>
</div>
`;
  return htmlResponse(page({
    title: 'Course Library · Build a Brand',
    nav: appNav('/learn', user),
    main,
    bodyClass: 'page-learn',
  }));
}

// ============================================================
// /learn/<slug> — single lesson
// ============================================================
export function renderCourseLesson(user, slug) {
  const lesson = LESSONS_BY_SLUG.get(slug);
  if (!lesson) return null;

  const moduleLessons = lesson.module.lessons;
  const idx = moduleLessons.findIndex(l => l.slug === slug);
  const prev = idx > 0 ? moduleLessons[idx - 1] : null;
  const next = idx >= 0 && idx < moduleLessons.length - 1 ? moduleLessons[idx + 1] : null;

  const bodyHtml = renderLessonBody(lesson.body_md);

  const navPrev = prev
    ? `<a href="/learn/${esc(prev.slug)}" class="lesson-nav__link lesson-nav__link--prev">← ${esc(prev.title)}</a>`
    : `<a href="/learn" class="lesson-nav__link lesson-nav__link--prev">← Back to library</a>`;
  const navNext = next
    ? `<a href="/learn/${esc(next.slug)}" class="lesson-nav__link lesson-nav__link--next">${esc(next.title)} →</a>`
    : `<a href="/learn" class="lesson-nav__link lesson-nav__link--next">Library →</a>`;

  const main = `
<article class="lesson">
  <header class="lesson__head">
    <p class="eyebrow"><a href="/learn" class="lesson__module-link">${esc(lesson.module.title)}</a></p>
    <h1 class="lesson__title">${esc(lesson.title)}</h1>
  </header>
  <div class="lesson__body">${bodyHtml}</div>
  <nav class="lesson-nav">
    ${navPrev}
    ${navNext}
  </nav>
</article>
`;
  return htmlResponse(page({
    title: `${lesson.title} · Build a Brand`,
    nav: appNav('/learn', user),
    main,
    bodyClass: 'page-lesson',
  }));
}
