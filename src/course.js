// Course data + lesson-body rendering for the V journey.
//
// The ThriveCart "Build A Brand" course is bundled at build time via
// tools/build_course_bundle.py into ./course-content.js. This module exposes
// small, opinionated helpers the V page (renderBrandBuilder in pages.js)
// composes against.
//
// V → ThriveCart module mapping is fixed (Lisa's framework: Vision, Value,
// Voice, Visuals, Visibility). Module 6 is the bonus aggregate and lives on
// the Brand Guide finale, not in any V.

import { marked } from 'marked';
import { COURSE } from './course-content.js';
import { esc } from './render.js';

// V tool → ThriveCart module.order (Module 1 = Vision, etc.)
const V_TO_MODULE_ORDER = {
  vision: 1,
  value: 2,
  voice: 3,
  visuals: 4,
  visibility: 5,
};

// The course's first lesson is a course-wide "Welcome" (3 YouTube videos
// covering the framework, custom GPTs, and how to use the AI tools). It
// belongs on /lisa + /dashboard as orientation, NOT inside the Vision V page.
const COURSE_WIDE_WELCOME_SLUG = 'welcome';

// ---------------- Public helpers ----------------

// Per-V data: the module's lessons (minus the course-wide welcome on Vision),
// the canonical workbook PDF, and any per-module bonus downloads.
export function getVData(tool) {
  const order = V_TO_MODULE_ORDER[tool];
  if (!order) return null;
  const module = COURSE.modules.find(m => m.order === order);
  if (!module) return null;
  const lessons = (tool === 'vision')
    ? module.lessons.filter(l => l.slug !== COURSE_WIDE_WELCOME_SLUG)
    : module.lessons;
  return {
    moduleTitle: module.title,
    moduleSlug: module.slug,
    workbook: module.workbook || null,
    bonusDownloads: module.bonus_downloads || [],
    lessons,
  };
}

// The course-wide Welcome lesson (3 YouTube videos). Used on /lisa + /dashboard.
export function getCourseWelcomeLesson() {
  const m1 = COURSE.modules.find(m => m.order === 1);
  return m1?.lessons.find(l => l.slug === COURSE_WIDE_WELCOME_SLUG) || null;
}

// Module 6 — the bonus aggregate (Complete Workbook, content templates,
// implementation checklists). Used by the Brand Guide finale.
export function getBonusModule() {
  return COURSE.modules.find(m => m.order === 6) || null;
}

// Which V does this lesson slug belong to? Used by the /learn/<slug> redirect
// in Phase 4 to send legacy URLs into the V page with a #lesson= hash.
export function findVForLessonSlug(slug) {
  for (const [tool, order] of Object.entries(V_TO_MODULE_ORDER)) {
    const module = COURSE.modules.find(m => m.order === order);
    if (module?.lessons.some(l => l.slug === slug)) return tool;
  }
  return null;
}

// Render a lesson's markdown body to safe HTML. [VIDEO:url] markers become
// responsive iframe wrappers. Used by the Brand Guide bonus section + as a
// utility if any V section ever wants to embed a lesson's full body.
export function renderLessonBody(md) {
  const expanded = (md || '').replace(/\[VIDEO:([^\]]+)\]/g, (_, url) => {
    const clean = url.replace(/\\_/g, '_');
    return `\n\n<div class="lesson-video"><iframe src="${esc(clean)}" allowfullscreen loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"></iframe></div>\n\n`;
  });
  return marked.parse(expanded, { gfm: true, breaks: false });
}

// Build a YouTube embed URL from a video ID (with the same params we always
// use). Used by the V page Watch section.
export function youtubeEmbedUrl(videoId) {
  return `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?rel=0`;
}
