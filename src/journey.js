// Journey: the new VIP-day step engine that replaces the video+workbook+chat
// model on the V pages. First ship: Vision only. Other V's still use the legacy
// renderBrandBuilder until they're decomposed too.
//
// Storage: brand_progress.step_progress JSON. We add a `journey_responses`
// object keyed by step id. /api/progress/step?op=journey_response writes to it.

import { esc } from './render.js';
import { TOOL_META } from './prompts.js';

// ---------------------------------------------------------------------------
// Step definitions per V. Each step has an id, kind, title, subtitle, and the
// kind-specific options (words to tap, fields to fill, items to rank, etc.)
// ---------------------------------------------------------------------------

export const VISION_STEPS = [
  {
    id: 'brand-personality',
    kind: 'wordcloud',
    title: 'Tap the words that feel like you.',
    subtitle: 'Pick as many or as few as you want. No wrong answers.',
    estimatedMinutes: 5,
    words: [
      { id: 'bold', label: 'bold', group: 'Energy' },
      { id: 'calm', label: 'calm', group: 'Energy' },
      { id: 'playful', label: 'playful', group: 'Energy' },
      { id: 'magnetic', label: 'magnetic', group: 'Energy' },
      { id: 'grounded', label: 'grounded', group: 'Energy' },
      { id: 'fierce', label: 'fierce', group: 'Energy' },
      { id: 'soft', label: 'soft', group: 'Energy' },
      { id: 'electric', label: 'electric', group: 'Energy' },
      { id: 'elegant', label: 'elegant', group: 'Style' },
      { id: 'edgy', label: 'edgy', group: 'Style' },
      { id: 'warm', label: 'warm', group: 'Style' },
      { id: 'minimal', label: 'minimal', group: 'Style' },
      { id: 'rich', label: 'rich', group: 'Style' },
      { id: 'lived-in', label: 'lived-in', group: 'Style' },
      { id: 'polished', label: 'polished', group: 'Style' },
      { id: 'raw', label: 'raw', group: 'Style' },
      { id: 'honest', label: 'honest', group: 'Voice' },
      { id: 'witty', label: 'witty', group: 'Voice' },
      { id: 'tender', label: 'tender', group: 'Voice' },
      { id: 'direct', label: 'direct', group: 'Voice' },
      { id: 'gutsy', label: 'gutsy', group: 'Voice' },
      { id: 'nurturing', label: 'nurturing', group: 'Voice' },
      { id: 'irreverent', label: 'irreverent', group: 'Voice' },
      { id: 'thoughtful', label: 'thoughtful', group: 'Voice' },
      { id: 'expert', label: 'expert', group: 'Posture' },
      { id: 'guide', label: 'guide', group: 'Posture' },
      { id: 'friend', label: 'friend', group: 'Posture' },
      { id: 'rebel', label: 'rebel', group: 'Posture' },
      { id: 'mentor', label: 'mentor', group: 'Posture' },
      { id: 'sister', label: 'sister', group: 'Posture' },
    ],
  },
  {
    id: 'mission-pieces',
    kind: 'fillblank',
    title: 'Three short answers.',
    subtitle: "What you do, who you do it for, how it changes them. One or two sentences each.",
    estimatedMinutes: 10,
    fields: [
      {
        id: 'what',
        label: 'What you actually do.',
        helpText: 'The verb. Skip the adjectives.',
        placeholder: 'I help people build brands that feel like them.',
        rows: 2,
      },
      {
        id: 'who',
        label: 'Who you do it for.',
        helpText: 'Be specific. Who are they before they meet you?',
        placeholder: 'Photographers and creatives stuck between hobby and business.',
        rows: 2,
      },
      {
        id: 'how',
        label: 'How they\'re different after you.',
        helpText: 'The transformation, not the deliverable.',
        placeholder: 'They walk away with a brand that feels obvious in hindsight.',
        rows: 3,
      },
    ],
  },
  {
    id: 'mission-pick',
    kind: 'pick-3',
    title: 'Pick the mission framing that hits.',
    subtitle: 'You can refine the wording later. Pick one for now, or write your own.',
    estimatedMinutes: 5,
    maxPicks: 1,
    options: [
      { id: 'm1', label: 'I help [audience] build [outcome] without [pain].', description: 'Direct, deployable.' },
      { id: 'm2', label: 'We make [transformation] feel inevitable for [audience].', description: 'Aspirational.' },
      { id: 'm3', label: '[Brand] exists so [audience] can finally [outcome].', description: 'Mission-driven.' },
      { id: 'm4', label: 'A [thing] for [audience] who want [outcome].', description: 'Product-shaped.' },
      { id: 'm5', label: 'I pull [outcome] out of [audience] and translate it into [thing].', description: 'Process-shaped.' },
      { id: 'm6', label: 'Helping [audience] stop [pain] and start [outcome].', description: 'Pain-relief.' },
      { id: 'm7', label: 'The [thing] that [audience] wishes they had years ago.', description: 'Hindsight.' },
      { id: 'm8', label: 'I make [hard thing] feel doable for [audience].', description: 'Permission.' },
      { id: 'm9', label: 'Branding for [audience] who refuse to look like everyone else.', description: 'Tribe.' },
      { id: 'm10', label: '[Outcome] starts with [thing], and [thing] starts here.', description: 'Sequence.' },
      { id: 'm11', label: 'We don\'t do [common thing]. We do [your thing].', description: 'Contrast.' },
      { id: 'm12', label: 'Write your own.', description: 'Pick this if none fit, refine later.' },
    ],
  },
  {
    id: 'values-rank',
    kind: 'rank',
    title: 'Drag your top values to the top.',
    subtitle: 'Drag to reorder. Use the arrows on phones.',
    estimatedMinutes: 8,
    items: [
      { id: 'honesty', label: 'Honesty', description: "Saying the true thing even when it's awkward." },
      { id: 'craft', label: 'Craft', description: "Caring how it's made, not just how it sells." },
      { id: 'warmth', label: 'Warmth', description: 'Treating people like people.' },
      { id: 'freedom', label: 'Freedom', description: 'Working on your own terms.' },
      { id: 'courage', label: 'Courage', description: 'Doing the scary thing first.' },
      { id: 'curiosity', label: 'Curiosity', description: 'Always learning, never bored.' },
      { id: 'joy', label: 'Joy', description: "It's allowed to feel good." },
      { id: 'service', label: 'Service', description: 'The work is for them.' },
      { id: 'rest', label: 'Rest', description: 'Sustainability over speed.' },
      { id: 'intention', label: 'Intention', description: 'Nothing accidental.' },
      { id: 'play', label: 'Play', description: 'Lightness even at high stakes.' },
      { id: 'rigor', label: 'Rigor', description: 'Hold the line on quality.' },
    ],
  },
  {
    id: 'summary',
    kind: 'summary',
    title: 'Your Vision, in your words.',
    subtitle: 'Saved. We\'ll fold it into your Brand Guide as you finish more sections.',
    estimatedMinutes: 2,
  },
];

const STEPS_BY_TOOL = {
  vision: VISION_STEPS,
  // value, voice, visuals, visibility: TODO in next session
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getJourneySteps(tool) {
  return STEPS_BY_TOOL[tool] || null;
}

export function getJourneyStep(tool, slug) {
  const steps = STEPS_BY_TOOL[tool];
  if (!steps) return null;
  return steps.find((s) => s.id === slug) || null;
}

export function nextJourneyStep(tool, slug) {
  const steps = STEPS_BY_TOOL[tool];
  if (!steps) return null;
  const idx = steps.findIndex((s) => s.id === slug);
  if (idx < 0 || idx >= steps.length - 1) return null;
  return steps[idx + 1];
}

export function prevJourneyStep(tool, slug) {
  const steps = STEPS_BY_TOOL[tool];
  if (!steps) return null;
  const idx = steps.findIndex((s) => s.id === slug);
  if (idx <= 0) return null;
  return steps[idx - 1];
}

export function journeyProgressPct(tool, journeyResponses) {
  const steps = STEPS_BY_TOOL[tool];
  if (!steps || steps.length === 0) return 0;
  const done = steps.filter((s) => journeyResponses && journeyResponses[s.id]).length;
  return Math.round((done / steps.length) * 100);
}

// ---------------------------------------------------------------------------
// Renderer for a single journey step page
// ---------------------------------------------------------------------------

export function renderJourneyStepBody(tool, step, savedResponse) {
  switch (step.kind) {
    case 'wordcloud':
      return renderWordCloud(step, savedResponse);
    case 'fillblank':
      return renderFillBlank(step, savedResponse);
    case 'pick-3':
      return renderPick3(step, savedResponse);
    case 'rank':
      return renderRank(step, savedResponse);
    case 'summary':
      return renderSummaryStep(tool, step);
    default:
      return `<p class="journey-error">Unknown step kind: ${esc(step.kind)}</p>`;
  }
}

function renderWordCloud(step, saved) {
  const selected = (saved && Array.isArray(saved.selected)) ? saved.selected : [];
  const groups = {};
  for (const w of step.words) {
    const g = w.group || 'All';
    (groups[g] ||= []).push(w);
  }
  const groupHtml = Object.entries(groups).map(([group, ws]) => {
    return `<div class="word-group">
      ${Object.keys(groups).length > 1 ? `<p class="word-group__label">${esc(group)}</p>` : ''}
      <div class="word-group__items">
        ${ws.map((w) => `<button type="button" class="word-chip ${selected.includes(w.id) ? 'is-selected' : ''}" data-word-id="${esc(w.id)}">${esc(w.label)}</button>`).join('')}
      </div>
    </div>`;
  }).join('');
  return `<div class="step-body" data-step-kind="wordcloud" data-step-id="${esc(step.id)}">
    <p class="step-body__hint">Tap any that resonate. Tap again to remove. <span class="step-body__count" data-count>${selected.length} picked</span></p>
    ${groupHtml}
  </div>`;
}

function renderFillBlank(step, saved) {
  const fields = (saved && saved.fields) ? saved.fields : {};
  return `<div class="step-body step-body--fillblank" data-step-kind="fillblank" data-step-id="${esc(step.id)}">
    ${step.fields.map((f) => `
      <div class="fill-field">
        <label class="fill-field__label" for="ff-${esc(f.id)}">${esc(f.label)}</label>
        ${f.helpText ? `<p class="fill-field__help">${esc(f.helpText)}</p>` : ''}
        <textarea id="ff-${esc(f.id)}" class="fill-field__input" data-field-id="${esc(f.id)}" rows="${f.rows || 3}" placeholder="${esc(f.placeholder || '')}">${esc(fields[f.id] || '')}</textarea>
      </div>
    `).join('')}
  </div>`;
}

function renderPick3(step, saved) {
  const selected = (saved && Array.isArray(saved.selected)) ? saved.selected : [];
  const max = step.maxPicks || 3;
  return `<div class="step-body step-body--pick3" data-step-kind="pick-3" data-step-id="${esc(step.id)}" data-max-picks="${max}">
    <p class="step-body__hint">Pick ${max}. <span class="step-body__count" data-count>${selected.length}/${max}</span></p>
    <div class="pick-grid">
      ${step.options.map((opt) => `
        <button type="button" class="pick-card ${selected.includes(opt.id) ? 'is-selected' : ''}" data-option-id="${esc(opt.id)}">
          <span class="pick-card__label">${esc(opt.label)}</span>
          ${opt.description ? `<span class="pick-card__desc">${esc(opt.description)}</span>` : ''}
          <span class="pick-card__check" aria-hidden="true">✓</span>
        </button>
      `).join('')}
    </div>
  </div>`;
}

function renderRank(step, saved) {
  const order = (saved && Array.isArray(saved.ranking)) ? saved.ranking : step.items.map((i) => i.id);
  const itemById = Object.fromEntries(step.items.map((i) => [i.id, i]));
  return `<div class="step-body step-body--rank" data-step-kind="rank" data-step-id="${esc(step.id)}">
    <p class="step-body__hint">Drag to reorder. Top of the list is your top pick.</p>
    <ul class="rank-list" data-rank-list>
      ${order.map((id, idx) => {
        const item = itemById[id];
        if (!item) return '';
        return `<li class="rank-item" data-item-id="${esc(id)}" draggable="true">
          <span class="rank-item__num" data-rank-num>${idx + 1}</span>
          <div class="rank-item__body">
            <p class="rank-item__label">${esc(item.label)}</p>
            ${item.description ? `<p class="rank-item__desc">${esc(item.description)}</p>` : ''}
          </div>
          <div class="rank-item__arrows">
            <button type="button" class="rank-item__arrow" data-rank-up aria-label="Move up">↑</button>
            <button type="button" class="rank-item__arrow" data-rank-down aria-label="Move down">↓</button>
          </div>
        </li>`;
      }).join('')}
    </ul>
  </div>`;
}

function renderSummaryStep(tool, step) {
  const meta = TOOL_META[tool] || { label: tool };
  return `<div class="step-body step-body--summary" data-step-kind="summary" data-step-id="${esc(step.id)}">
    <div class="summary-card">
      <p class="summary-card__eyebrow">${esc(meta.label)} saved</p>
      <p class="summary-card__body">Your answers are stored and will compile into your Brand Guide PDF as you finish more sections. You can come back and refine any answer any time.</p>
    </div>
  </div>`;
}
