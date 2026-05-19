// Journey: the new VIP-day step engine that replaces the video+workbook+chat
// model on the V pages.
//
// Vision module (this file): Mission → Vision → Values, sourced from Lisa's
// actual workbook content (build-a-brand_workbook-module_1_vision.pdf).
// Three deliverables: a mission statement, a vision statement, and a defined
// set of values. ~1 hour of focused work with mirror checkpoints and narrowing
// rounds where each round's options are informed by prior answers.
//
// Storage: brand_progress.step_progress JSON. journey_responses[step_id] =
// the per-step response. /api/progress/step?op=journey_response writes here.

import { esc } from './render.js';
import { TOOL_META } from './prompts.js';

// ---------------------------------------------------------------------------
// Helpers used by step body renderers
// ---------------------------------------------------------------------------

// Replace [TOKEN] placeholders in a string with values pulled from prior
// journey responses. Tokens are looked up against `tokenMap`.
function applyTokens(text, tokenMap) {
  if (!text) return '';
  return text.replace(/\[([A-Z0-9_]+)\]/g, (_, key) => {
    const val = tokenMap[key];
    return val && val.trim() ? val.trim() : `[${key.toLowerCase().replace(/_/g, ' ')}]`;
  });
}

// Build a token map from journey_responses. Generic across tools so any
// step's templates can reference any prior answer.
function brandTokenMap(journeyResponses = {}) {
  const r = journeyResponses;
  // Vision tokens
  const what = r['mission-discovery']?.fields?.what || '';
  const who = r['mission-discovery']?.fields?.who || '';
  const how = r['mission-discovery']?.fields?.how || '';
  const visionImpact = r['vision-discovery']?.fields?.impact || '';
  const archetypeId = (r['vision-archetype']?.selected || [])[0];
  const archetype = VISION_ARCHETYPES.find((a) => a.id === archetypeId);

  // Value tokens
  const valueSkill = r['value-strengths']?.fields?.strengths || r['value-background']?.fields?.professional || '';
  const valuePraise = r['value-strengths']?.fields?.compliments || '';
  const valueBackground = r['value-background']?.fields?.life || r['value-background']?.fields?.professional || '';
  const valueAudience = r['mission-discovery']?.fields?.who || 'the people you serve';
  const ageRange = r['dream-demographics']?.fields?.age || '';
  const stage = r['dream-demographics']?.fields?.stage || '';
  const location = r['dream-demographics']?.fields?.location || '';
  const belief = r['dream-beliefs']?.fields?.beliefs || '';
  const external = r['dream-external']?.fields?.external || '';
  const internal = r['dream-internal']?.fields?.internal || '';
  const spaces = r['dream-where']?.fields?.spaces || '';

  return {
    WHAT: what,
    WHO: who,
    HOW: how,
    IMPACT: visionImpact,
    ARCHETYPE: archetype ? archetype.label.toLowerCase() : '',
    // Value
    SKILL: valueSkill,
    STRENGTH: valueSkill,
    PRAISE: valuePraise,
    BACKGROUND: valueBackground,
    AUDIENCE: valueAudience,
    INDUSTRY: 'your industry',
    QUALITY: 'integrity',
    TONE: 'honest',
    OUTCOME: how || 'get what they actually want',
    PROOF: valueBackground,
    COMMON: 'tactics',
    DIFFERENT: 'transformation',
    EXPERTISE: valueBackground,
    VALUE: 'the slow part',
    ROLE: 'craftsperson',
    BROADER_ROLE: 'guide',
    CRAFT: 'this',
    PROCESS: 'the listening',
    // Portrait
    NAME: 'your person',
    AGE_RANGE: ageRange || 'late thirties',
    STAGE: stage || 'mid-career',
    LOCATION: location || 'your town',
    BELIEF: belief || 'cares deeply about doing it right',
    EXTERNAL: external || 'the work feels invisible',
    INTERNAL: internal || 'they wonder if they are an impostor',
    GOAL: 'a brand that finally fits them',
    SPACES: spaces || 'Instagram and her favorite three podcasts',
  };
}

// Back-compat alias for the Vision-only label.
const visionTokenMap = brandTokenMap;

// ---------------------------------------------------------------------------
// Static content used by Vision step definitions
// ---------------------------------------------------------------------------

const VISION_ARCHETYPES = [
  { id: 'quiet-builder', label: 'The Quiet Builder', description: 'Steady, sustainable growth. Family first. Long game over short wins.' },
  { id: 'movement-starter', label: 'The Movement Starter', description: 'Change the game. Raise the standard. Lift the people coming up behind you.' },
  { id: 'pioneer', label: 'The Pioneer', description: 'First of its kind. Edge of the field. R&D for everyone else.' },
  { id: 'master-craftsman', label: 'The Master Craftsman', description: 'The best at the thing. Depth over scale. Quality over quantity.' },
  { id: 'translator', label: 'The Translator', description: 'Bridge experts and beginners. Make the hard thing accessible.' },
  { id: 'liberator', label: 'The Liberator', description: 'Set people free from a stuck pattern. Permission and possibility.' },
];

const VISION_WORDS = [
  // Stakes
  { id: 'legacy', label: 'legacy', group: 'Stakes' },
  { id: 'impact', label: 'impact', group: 'Stakes' },
  { id: 'change', label: 'change', group: 'Stakes' },
  { id: 'movement', label: 'movement', group: 'Stakes' },
  { id: 'standard', label: 'standard', group: 'Stakes' },
  // Reach
  { id: 'every', label: 'every', group: 'Reach' },
  { id: 'community', label: 'community', group: 'Reach' },
  { id: 'industry', label: 'industry', group: 'Reach' },
  { id: 'world', label: 'world', group: 'Reach' },
  { id: 'tribe', label: 'tribe', group: 'Reach' },
  // Depth
  { id: 'mastery', label: 'mastery', group: 'Depth' },
  { id: 'craft', label: 'craft', group: 'Depth' },
  { id: 'depth', label: 'depth', group: 'Depth' },
  { id: 'integrity', label: 'integrity', group: 'Depth' },
  { id: 'truth', label: 'truth', group: 'Depth' },
  // Care
  { id: 'confidence', label: 'confidence', group: 'Care' },
  { id: 'pride', label: 'pride', group: 'Care' },
  { id: 'freedom', label: 'freedom', group: 'Care' },
  { id: 'belonging', label: 'belonging', group: 'Care' },
  { id: 'permission', label: 'permission', group: 'Care' },
  { id: 'agency', label: 'agency', group: 'Care' },
  { id: 'joy', label: 'joy', group: 'Care' },
  { id: 'ease', label: 'ease', group: 'Care' },
  { id: 'clarity', label: 'clarity', group: 'Care' },
];

const VALUE_WORDS = [
  // Strength
  { id: 'integrity', label: 'integrity', group: 'Strength' },
  { id: 'honesty', label: 'honesty', group: 'Strength' },
  { id: 'courage', label: 'courage', group: 'Strength' },
  { id: 'resilience', label: 'resilience', group: 'Strength' },
  { id: 'discipline', label: 'discipline', group: 'Strength' },
  { id: 'rigor', label: 'rigor', group: 'Strength' },
  { id: 'consistency', label: 'consistency', group: 'Strength' },
  // Posture
  { id: 'confidence', label: 'confidence', group: 'Posture' },
  { id: 'humility', label: 'humility', group: 'Posture' },
  { id: 'curiosity', label: 'curiosity', group: 'Posture' },
  { id: 'openness', label: 'openness', group: 'Posture' },
  { id: 'directness', label: 'directness', group: 'Posture' },
  { id: 'patience', label: 'patience', group: 'Posture' },
  { id: 'playfulness', label: 'playfulness', group: 'Posture' },
  // Care
  { id: 'kindness', label: 'kindness', group: 'Care' },
  { id: 'warmth', label: 'warmth', group: 'Care' },
  { id: 'generosity', label: 'generosity', group: 'Care' },
  { id: 'service', label: 'service', group: 'Care' },
  { id: 'encouragement', label: 'encouragement', group: 'Care' },
  { id: 'empathy', label: 'empathy', group: 'Care' },
  { id: 'inclusion', label: 'inclusion', group: 'Care' },
  // Standards
  { id: 'craft', label: 'craft', group: 'Standards' },
  { id: 'creativity', label: 'creativity', group: 'Standards' },
  { id: 'organization', label: 'organization', group: 'Standards' },
  { id: 'precision', label: 'precision', group: 'Standards' },
  { id: 'beauty', label: 'beauty', group: 'Standards' },
  { id: 'simplicity', label: 'simplicity', group: 'Standards' },
  { id: 'originality', label: 'originality', group: 'Standards' },
  // Energy
  { id: 'fun', label: 'fun', group: 'Energy' },
  { id: 'excitement', label: 'excitement', group: 'Energy' },
  { id: 'inspiration', label: 'inspiration', group: 'Energy' },
  { id: 'momentum', label: 'momentum', group: 'Energy' },
  { id: 'rest', label: 'rest', group: 'Energy' },
  { id: 'flow', label: 'flow', group: 'Energy' },
  // Stewardship
  { id: 'freedom', label: 'freedom', group: 'Stewardship' },
  { id: 'autonomy', label: 'autonomy', group: 'Stewardship' },
  { id: 'sustainability', label: 'sustainability', group: 'Stewardship' },
  { id: 'stewardship', label: 'stewardship', group: 'Stewardship' },
  { id: 'community', label: 'community', group: 'Stewardship' },
  { id: 'family', label: 'family', group: 'Stewardship' },
  { id: 'faith', label: 'faith', group: 'Stewardship' },
];

const MISSION_TEMPLATES = [
  { id: 'm1', text: 'I [WHAT] for [WHO] resulting in [HOW].', description: "Lisa's classic framing." },
  { id: 'm2', text: 'I help [WHO] [HOW] without [PAIN].', description: 'Direct, deployable.' },
  { id: 'm3', text: 'I partner with [WHO] to [WHAT] so they can [HOW].', description: 'Collaborative, premium.' },
  { id: 'm4', text: '[WHAT] for [WHO] who refuse to settle.', description: 'Tribe-shaped.' },
  { id: 'm5', text: 'I make [WHAT] feel doable for [WHO].', description: 'Permission framing.' },
  { id: 'm6', text: 'I pull [HOW] out of [WHO] and translate it into [WHAT].', description: 'Process framing, very LiLo.' },
  { id: 'm7', text: 'Helping [WHO] stop [PAIN] and start [HOW].', description: 'Pain-relief framing.' },
  { id: 'm8', text: 'The [WHAT] that [WHO] wishes they had years ago.', description: 'Hindsight framing.' },
  { id: 'm9', text: 'I work with [WHO] to build [HOW] on their own terms.', description: 'Autonomy framing.' },
  { id: 'm10', text: 'For [WHO] who are ready to stop [PAIN] and finally [HOW].', description: 'Threshold framing.' },
];

const VALUE_TEMPLATES = [
  { id: 'uv1', text: 'I [SKILL] for [AUDIENCE] in a way no one else in this space does.', description: 'Differentiator framing.' },
  { id: 'uv2', text: 'My superpower is [STRENGTH], built from [BACKGROUND].', description: 'Origin framing.' },
  { id: 'uv3', text: 'I bring [QUALITY] to [INDUSTRY] in a way that feels [TONE].', description: 'Tone-shaped framing.' },
  { id: 'uv4', text: 'I help [AUDIENCE] [OUTCOME] because I have actually [PROOF].', description: 'Earned-credibility framing.' },
  { id: 'uv5', text: 'Other [INDUSTRY] folks focus on [COMMON]. I focus on [DIFFERENT].', description: 'Contrast framing.' },
  { id: 'uv6', text: 'What my clients keep telling me: I [PRAISE].', description: 'Testimonial-shaped framing.' },
  { id: 'uv7', text: 'Years of [EXPERTISE] plus my own [BACKGROUND] equals something most folks in [INDUSTRY] do not have.', description: 'Equation framing.' },
  { id: 'uv8', text: 'I refuse to skip [VALUE], even when it would be faster not to.', description: 'Principle framing.' },
  { id: 'uv9', text: 'I am not just a [ROLE]. I am [BROADER_ROLE] who happens to use [CRAFT].', description: 'Identity-shift framing.' },
  { id: 'uv10', text: 'The thing I do that everyone else skips: [PROCESS].', description: 'Process framing.' },
];

const PORTRAIT_TEMPLATES = [
  { id: 'p1', text: 'My person is around [AGE_RANGE], [STAGE], in [LOCATION]. She [BELIEF]. She struggles with [EXTERNAL], and underneath that, [INTERNAL]. What she really wants is [GOAL].', description: 'Classic portrait, demographics-first.' },
  { id: 'p2', text: 'Picture her in her [AGE_RANGE], [STAGE]. More days than not, she feels [INTERNAL]. On the surface she is dealing with [EXTERNAL]. Underneath, she wants [GOAL]. She spends time on [SPACES].', description: 'Empathy-first portrait.' },
  { id: 'p3', text: 'From the outside she looks successful. But [INTERNAL]. She is ready to chase [GOAL], but [EXTERNAL] keeps getting in the way. She finds people like me on [SPACES].', description: 'Success-mask portrait.' },
  { id: 'p4', text: 'My ideal client is a [STAGE] in [LOCATION], around [AGE_RANGE]. She [BELIEF]. Her biggest external problem: [EXTERNAL]. Her biggest internal block: [INTERNAL]. When she finds me, she is looking for [GOAL].', description: 'Structured portrait.' },
  { id: 'p5', text: 'Write your own from scratch.', description: 'Skip the template and write a portrait in your own words.' },
];

const VISION_TEMPLATES = [
  { id: 'v1', text: 'For every [WHO] to [IMPACT], with [WORD1] and [WORD2].', description: 'Lisa-shaped framing.' },
  { id: 'v2', text: 'A world where [WHO] feel [WORD1] about [WORD2].', description: 'Movement framing.' },
  { id: 'v3', text: 'To raise the standard of [WHAT] so [WHO] can [IMPACT].', description: 'Industry framing.' },
  { id: 'v4', text: '[WHO] who [HOW], at scale.', description: 'Reach framing.' },
  { id: 'v5', text: 'The [ARCHETYPE] of [WHAT]: [WORD1], [WORD2], [WORD3].', description: 'Archetype framing.' },
  { id: 'v6', text: '[IMPACT]. That is the work.', description: 'Stripped down.' },
  { id: 'v7', text: 'Building a world where [WHO] no longer have to [PAIN].', description: 'Liberation framing.' },
  { id: 'v8', text: 'A future where [WORD1] is the rule, not the exception, for [WHO].', description: 'Standard-setting framing.' },
  { id: 'v9', text: 'Every [WHO] equipped to [HOW] without losing themselves in the process.', description: 'Integrity framing.' },
  { id: 'v10', text: 'The [ARCHETYPE] who shows [WHO] that [WORD1] and [WORD2] can coexist.', description: 'Personal-narrative framing.' },
];

// ---------------------------------------------------------------------------
// Vision step definitions (Module One: Mission, Vision, Values)
// Three sub-processes, mirror checkpoints, narrowing rounds.
// ---------------------------------------------------------------------------

export const VISION_STEPS = [
  // ===== Personal warmup =====
  // The whole reason they're here is because they don't know their brand yet.
  // Asking them about their brand on Step 1 presupposes the answer. We start
  // with THEM: their story, their goals, what's standing in their way. The
  // brand falls out of those answers later. (Per Lisa's direction.)
  {
    id: 'warmup-origin',
    kind: 'fillblank',
    section: 'Get to know you',
    title: "First, let's talk about you.",
    subtitle: "No wrong answers. Skip any that don't land. We're not here to extract a brand from you yet, just to listen.",
    estimatedMinutes: 6,
    fields: [
      {
        id: 'why_started',
        label: 'Why did you start this business?',
        helpText: 'The moment, the pull, the thing that pushed you. You can be specific or scenic.',
        placeholder: "I was burned out at my agency job and realized the people I loved working with most were the small business owners no one took seriously.",
        rows: 4,
      },
      {
        id: 'before',
        label: 'What were you doing before this?',
        helpText: "Where this work fits in your life. The backstory.",
        placeholder: 'Twelve years as a wedding photographer. A degree in marketing I never used. Two kids and a stack of half-finished branding for friends.',
        rows: 3,
      },
    ],
  },
  {
    id: 'warmup-goals',
    kind: 'fillblank',
    section: 'Get to know you',
    title: 'Now your goals.',
    subtitle: 'Short-term, long-term, and what your life looks like when this is working. We come back to these threads everywhere.',
    estimatedMinutes: 8,
    fields: [
      {
        id: 'short_term',
        label: 'What are your short-term goals? (Next 6 to 12 months.)',
        helpText: 'The thing you\'re trying to make happen right now.',
        placeholder: 'Book 10 brand clients at $5k+ this year. Stop saying yes to wedding work.',
        rows: 3,
      },
      {
        id: 'long_term',
        label: 'What are your long-term goals? (3 to 5 years out.)',
        helpText: "Where do you want this to go? Don't be modest, be specific.",
        placeholder: 'A studio with two photographers and a brand strategist. Run a yearly retreat. Be the photography brand creatives quietly compete to work with.',
        rows: 3,
      },
      {
        id: 'life',
        label: 'What does your life look like when this is working?',
        helpText: "Beyond the numbers. The actual rhythm of your day.",
        placeholder: 'I work three days, take Friday for my own art, and I never have to dread a Monday again.',
        rows: 3,
      },
    ],
  },
  {
    id: 'warmup-stuck',
    kind: 'fillblank',
    section: 'Get to know you',
    title: "What's standing in your way?",
    subtitle: "The obstacle, the fear, the thing you keep bumping into. We pay attention to this.",
    estimatedMinutes: 5,
    fields: [
      {
        id: 'obstacle',
        label: 'What\'s the thing you keep bumping into that you can\'t seem to solve?',
        helpText: "Be honest. This stays between you and the page.",
        placeholder: "I don't know how to talk about my work without sounding like everyone else.",
        rows: 3,
      },
      {
        id: 'gap',
        label: "What do you wish you knew, or what feels just out of reach?",
        helpText: 'The skill, the framework, the clarity, the permission. Something is missing.',
        placeholder: 'I want to know what makes me different in plain language so I can stop apologizing for my prices.',
        rows: 3,
      },
    ],
  },
  {
    id: 'warmup-mirror',
    kind: 'mirror',
    section: 'Get to know you',
    title: 'Here\'s what I\'m hearing about you so far.',
    subtitle: 'Read it slowly. If anything\'s off, hit Back. Otherwise, we go pull a brand out of all of this.',
    estimatedMinutes: 2,
    mirror: {
      template: [
        { label: 'Why you started:', from: 'warmup-origin.fields.why_started' },
        { label: 'Where this fits in your life:', from: 'warmup-origin.fields.before' },
        { label: 'Short-term goal:', from: 'warmup-goals.fields.short_term' },
        { label: 'Long-term goal:', from: 'warmup-goals.fields.long_term' },
        { label: 'What life looks like when this works:', from: 'warmup-goals.fields.life' },
        { label: 'The thing in your way:', from: 'warmup-stuck.fields.obstacle' },
      ],
    },
  },
  {
    id: 'brand-reflection',
    kind: 'fillblank',
    section: 'Brand reflection',
    title: "Now a few softer questions, to bridge into the brand work.",
    subtitle: "Skip any that don't land. The brand will fall out of these answers, you don't have to know them perfectly.",
    estimatedMinutes: 6,
    fields: [
      {
        id: 'personality',
        label: "If your business were a person, how would you describe their personality?",
        helpText: "If they walked into a room, what would people feel?",
        placeholder: 'Warm but no-nonsense. The friend who tells you the truth and helps you fix it.',
        rows: 2,
      },
      {
        id: 'memory',
        label: 'What do you want your customers to remember most after working with you?',
        helpText: "The one thing you want them to walk away saying about you.",
        placeholder: "That she actually got me, not just my project.",
        rows: 2,
      },
      {
        id: 'role-models',
        label: "Who are some businesses or people you admire?",
        helpText: 'Inside or outside your industry. Doesn\'t have to be famous.',
        placeholder: 'Glossier for warmth, Patagonia for guts, my grandmother for taste.',
        rows: 2,
      },
    ],
  },

  // ===== Process A: Mission Statement =====
  {
    id: 'mission-discovery',
    kind: 'fillblank',
    section: 'Mission',
    title: 'Now the work itself.',
    subtitle: "Three short answers about what you do. We've already covered the why, so this is about the what, who, and how.",
    estimatedMinutes: 8,
    fields: [
      {
        id: 'what',
        label: 'What problem do you solve, or what do you do?',
        helpText: 'The verb. Skip the adjectives. Be specific.',
        placeholder: 'I help photographers turn their craft into a confident brand.',
        rows: 2,
      },
      {
        id: 'who',
        label: 'Who do you help?',
        helpText: "General overview is fine here, you'll get specific in the Value section later.",
        placeholder: 'Photographers and creatives stuck between hobby and full-time business.',
        rows: 2,
      },
      {
        id: 'how',
        label: 'How are they different after you?',
        helpText: 'The transformation, not the deliverable. The feeling, the change.',
        placeholder: 'They walk away with a brand that feels obvious in hindsight, and a clear voice they can deploy anywhere.',
        rows: 2,
      },
    ],
    inspiration: {
      label: "Lisa's example",
      text: '"I partner with small business owners to create a compelling brand so they confidently stand out in the crowded world of online marketing without feeling overwhelmed."',
    },
  },
  {
    id: 'mission-mirror',
    kind: 'mirror',
    section: 'Mission',
    title: "Here's what I'm hearing.",
    subtitle: "Read it back. If anything's off, hit Back and edit. Otherwise let's pick a framing.",
    estimatedMinutes: 2,
    mirror: {
      sourceStep: 'mission-discovery',
      template: [
        { label: 'You do this:', from: 'fields.what' },
        { label: 'For these people:', from: 'fields.who' },
        { label: 'And this is how they change:', from: 'fields.how' },
      ],
    },
  },
  {
    id: 'mission-pick',
    kind: 'pick-3',
    section: 'Mission',
    title: 'Pick the framing that hits.',
    subtitle: "Each one uses your own words. You'll edit the wording on the next step.",
    estimatedMinutes: 4,
    maxPicks: 1,
    optionsFromTemplates: 'mission',
  },
  {
    id: 'mission-refine',
    kind: 'fillblank',
    section: 'Mission',
    title: 'Make it yours.',
    subtitle: 'Replace the [brackets]. Move words around. It should sound like you, not a template.',
    estimatedMinutes: 6,
    fields: [
      {
        id: 'mission_statement',
        label: 'Your mission statement.',
        helpText: 'One or two sentences. Try saying it out loud. Does it sound like you?',
        placeholder: '',
        rows: 4,
        prefillFrom: { tool: 'vision', step: 'mission-pick', kind: 'template' },
      },
    ],
    inspiration: {
      label: "Lisa's mission",
      text: '"I partner with small business owners to create a compelling brand so they confidently stand out in the crowded world of online marketing without feeling overwhelmed."',
    },
  },

  // ===== Process B: Vision Statement =====
  {
    id: 'vision-discovery',
    kind: 'fillblank',
    section: 'Vision',
    title: 'Now zoom out. The impact you want to have.',
    subtitle: "We've already talked about your goals and what life looks like when this works. Now the bigger why: the world you want to help build.",
    estimatedMinutes: 6,
    fields: [
      {
        id: 'impact',
        label: 'What impact do you want to have on customers, community, or the world?',
        helpText: 'It can be lofty. It should inspire YOU first.',
        placeholder: 'For every photographer to feel as confident in their identity as they are in their craft.',
        rows: 4,
      },
    ],
    inspiration: {
      label: "Lisa's vision",
      text: '"For every small business owner to have a brand that they feel proud of and confident in, and to do so with encouragement and integrity."',
    },
  },
  {
    id: 'vision-archetype',
    kind: 'pick-3',
    section: 'Vision',
    title: 'Which archetype is closest?',
    subtitle: "Don't overthink it. Pick the one that feels most like you on a Tuesday morning.",
    estimatedMinutes: 3,
    maxPicks: 1,
    options: VISION_ARCHETYPES.map((a) => ({
      id: a.id, label: a.label, description: a.description,
    })),
  },
  {
    id: 'vision-words',
    kind: 'wordcloud',
    section: 'Vision',
    title: 'Tap the words that orbit your vision.',
    subtitle: "These shape the language we'll use to write it. Tap as many as resonate.",
    estimatedMinutes: 4,
    words: VISION_WORDS,
  },
  {
    id: 'vision-pick',
    kind: 'pick-3',
    section: 'Vision',
    title: 'Pick a framing for your vision.',
    subtitle: 'Each one folds in your archetype, your words, and your mission.',
    estimatedMinutes: 3,
    maxPicks: 1,
    optionsFromTemplates: 'vision',
  },
  {
    id: 'vision-refine',
    kind: 'fillblank',
    section: 'Vision',
    title: 'Make it yours.',
    subtitle: 'Replace any [brackets]. Trust the bigger feel of it, not perfection.',
    estimatedMinutes: 5,
    fields: [
      {
        id: 'vision_statement',
        label: 'Your vision statement.',
        helpText: 'One sentence. Inspires YOU first, your audience second.',
        placeholder: '',
        rows: 4,
        prefillFrom: { tool: 'vision', step: 'vision-pick', kind: 'template' },
      },
    ],
  },
  {
    id: 'mission-vision-mirror',
    kind: 'mirror',
    section: 'Vision',
    title: 'Mission and Vision, side by side.',
    subtitle: "Read them. Do they sit well together? You can still go back and refine.",
    estimatedMinutes: 2,
    mirror: {
      template: [
        { label: 'Mission (the work):', from: 'mission-refine.fields.mission_statement' },
        { label: 'Vision (the world you want):', from: 'vision-refine.fields.vision_statement' },
      ],
    },
  },

  // ===== Process C: Values =====
  {
    id: 'values-principles',
    kind: 'fillblank',
    section: 'Values',
    title: 'Before we pick words, write the principles.',
    subtitle: "What you actually believe, in plain language. We'll find words to match later.",
    estimatedMinutes: 6,
    fields: [
      {
        id: 'principles',
        label: 'What personal principles guide your behavior in your business?',
        helpText: "The non-negotiables. The things you'd lose a client over.",
        placeholder: "I won't work with people who treat my team badly. I always tell the truth even when it costs me a sale. I never copy another brand's voice.",
        rows: 5,
      },
    ],
  },
  {
    id: 'values-tap',
    kind: 'wordcloud',
    section: 'Values',
    title: 'Now tap every value word that resonates.',
    subtitle: "Aim for at least 8. Don't filter. Pick everything that feels even a little bit like you. We'll narrow next.",
    estimatedMinutes: 6,
    words: VALUE_WORDS,
  },
  {
    id: 'values-mirror',
    kind: 'mirror',
    section: 'Values',
    title: "Here's what's resonating.",
    subtitle: 'Does this list feel like you? Hit Back to add or remove. Otherwise pick your top values.',
    estimatedMinutes: 2,
    mirror: {
      sourceStep: 'values-tap',
      kind: 'wordcloud-list',
    },
  },
  {
    id: 'values-rank',
    kind: 'rank',
    section: 'Values',
    title: 'Drag your top 6 to the top.',
    subtitle: "Top of the list is most important. Lisa's GPT says 3 to 6 core values, top heavy.",
    estimatedMinutes: 6,
    itemsFrom: 'values-tap',
  },
  {
    id: 'values-define',
    kind: 'fillblank',
    section: 'Values',
    title: 'Define your top values.',
    subtitle: "A value without a definition is a poster on a wall. Tell me what each one looks like in your daily business.",
    estimatedMinutes: 14,
    fieldsFrom: 'values-rank',
    fieldHelp: 'How does this show up in a real moment? Examples of behavior, not vibes.',
  },

  // ===== Lock-in =====
  {
    id: 'summary',
    kind: 'mirror',
    section: 'Vision module',
    title: 'Your Vision module: locked in.',
    subtitle: 'Mission. Vision. Values. The foundation for everything else.',
    estimatedMinutes: 2,
    mirror: {
      kind: 'vision-summary',
    },
  },
];

// ===========================================================================
// VALUE module: You-Are-Your-Brand, Dream Customer, Transformation
// Sourced from build-a-brand_workbook-_module_2_value.pdf + the Value GPT
// system prompt. Three deliverables: Unique Value Statement, Ideal Client
// Portrait, Customer Transformation grid.
// ===========================================================================

export const VALUE_STEPS = [
  // ----- Process A: You Are Your Brand -----
  {
    id: 'value-prep',
    kind: 'fillblank',
    section: 'Your value',
    title: "Time to brag. We need this on paper.",
    subtitle: "You are your brand. The more you can see your own value, the easier everything else gets, pricing, messaging, all of it. Don't be modest. Lisa's framework: write 25 to 50 things over the next few steps.",
    estimatedMinutes: 5,
    fields: [
      {
        id: 'opener',
        label: 'Take a breath. Then answer: what do you secretly know you are great at, that most people overlook?',
        helpText: "The thing you'd say only after a glass of wine. Say it sober here.",
        placeholder: "I can read a room in 30 seconds and tell you exactly what a brand is missing.",
        rows: 4,
      },
    ],
  },
  {
    id: 'value-background',
    kind: 'fillblank',
    section: 'Your value',
    title: 'Your background.',
    subtitle: 'Education, professional history, life experiences. All of it counts.',
    estimatedMinutes: 8,
    fields: [
      {
        id: 'education',
        label: 'Formal education, certifications, training.',
        helpText: 'Degrees, courses, mentorships. Even the ones you dismiss.',
        placeholder: 'BA in Marketing, certified brand strategist with XYZ, two years of mentorship under [name].',
        rows: 3,
      },
      {
        id: 'professional',
        label: 'Professional experiences that shaped you.',
        helpText: 'Jobs, freelance, side projects. The work that taught you the most.',
        placeholder: '12 years as an in-house designer, then 5 years on my own. Worked with both Fortune 500s and solo coaches.',
        rows: 3,
      },
      {
        id: 'life',
        label: 'Life experiences that shaped you.',
        helpText: 'The non-work stuff. Where you grew up, what you survived, what you raised.',
        placeholder: 'Raised three kids while building this. Watched my mom run a small business with no help. Lived in three countries before I was 20.',
        rows: 3,
      },
    ],
  },
  {
    id: 'value-strengths',
    kind: 'fillblank',
    section: 'Your value',
    title: 'Your strengths, in your own words and theirs.',
    subtitle: "Two angles: what you know about yourself, and what other people keep telling you. Lisa's challenge: ask your partner or best friend if you get stuck.",
    estimatedMinutes: 8,
    fields: [
      {
        id: 'strengths',
        label: 'Specific knowledge and skills that contribute to your value.',
        helpText: "Not vague. Specific things you can do that not everyone can.",
        placeholder: "I can write a brand voice doc that the client's whole team actually uses. I can shoot brand and lifestyle in the same day without losing consistency.",
        rows: 4,
      },
      {
        id: 'compliments',
        label: 'What do people often tell you you are particularly good at?',
        helpText: 'Compliments you have gotten more than once. Skip false modesty.',
        placeholder: "That I make complicated things feel simple. That I get to the heart of a brand faster than anyone they've worked with.",
        rows: 4,
      },
    ],
  },
  {
    id: 'value-results',
    kind: 'fillblank',
    section: 'Your value',
    title: 'Real outcomes you have created.',
    subtitle: 'Tangible or intangible, for clients or friends or yourself. Receipts.',
    estimatedMinutes: 6,
    fields: [
      {
        id: 'results',
        label: 'Things that changed because of your work.',
        helpText: 'Numbers if you have them. Stories if you do not. Both are fine.',
        placeholder: 'A client tripled her rates after our session. Another finally felt confident enough to show up on Instagram. A third said it was the first branding work that ever felt like her.',
        rows: 6,
      },
    ],
  },
  {
    id: 'value-mirror',
    kind: 'mirror',
    section: 'Your value',
    title: "Here is what makes you irreplaceable.",
    subtitle: 'Read it. Feel the weight of it. We will turn this into one clean statement next.',
    estimatedMinutes: 2,
    mirror: {
      template: [
        { label: 'What you secretly know you are great at:', from: 'value-prep.fields.opener' },
        { label: 'Background that shaped you:', from: 'value-background.fields.life' },
        { label: 'Specific skills:', from: 'value-strengths.fields.strengths' },
        { label: 'What people keep telling you:', from: 'value-strengths.fields.compliments' },
        { label: 'Real outcomes from your work:', from: 'value-results.fields.results' },
      ],
    },
  },
  {
    id: 'brag-bank-craft',
    kind: 'ai-craft',
    section: 'Your value',
    title: 'Your brag bank.',
    subtitle: "I'll take everything you just told me and craft 8 polished, copy-ready phrases for you. Pick the 6 that feel most like you. Paste them in bios, sales pages, sales conversations.",
    estimatedMinutes: 10,
    maxPicks: 6,
    generateLabel: 'Craft my brag bank',
    generateHint: '~15 to 30 seconds. I distill your raw answers into 8 polished phrases.',
    sourceFields: [
      { label: 'What you secretly know you are great at:', from: 'value-prep.fields.opener' },
      { label: 'Life experiences that shaped you:', from: 'value-background.fields.life' },
      { label: 'Specific skills:', from: 'value-strengths.fields.strengths' },
      { label: 'What people compliment you on:', from: 'value-strengths.fields.compliments' },
      { label: 'Real outcomes:', from: 'value-results.fields.results' },
    ],
  },

  // ----- Process B: Dream Customer -----
  {
    id: 'dream-intro',
    kind: 'fillblank',
    section: 'Dream customer',
    title: "Now we find your people.",
    subtitle: "Don't worry about being realistic yet. Think about who you'd be thrilled to work with every week.",
    estimatedMinutes: 5,
    fields: [
      {
        id: 'excites',
        label: 'What type of person or business excites you most to work with?',
        helpText: 'Be specific. The energy, the kind of work, the kind of person.',
        placeholder: "Solo women founders in their 30s and 40s, doing meaningful work, just starting to take themselves seriously as a brand.",
        rows: 4,
      },
    ],
  },
  {
    id: 'dream-demographics',
    kind: 'fillblank',
    section: 'Dream customer',
    title: 'The boring-but-useful demographics.',
    subtitle: "Lisa's framework: age, stage, location, income. Quick answers, you'll use these in marketing later.",
    estimatedMinutes: 5,
    fields: [
      { id: 'age', label: 'Age range.', placeholder: '32 to 48', rows: 1 },
      { id: 'stage', label: 'Stage or phase of life.', helpText: 'Single, partnered, parenting, empty-nesting, career-shifting, etc.', placeholder: 'Mid-career, partnered, often with young kids.', rows: 2 },
      { id: 'location', label: 'Location.', helpText: 'Geography, climate, city size. Or "anywhere online" if it does not matter.', placeholder: 'US-based, often suburban or small-town. Anywhere online.', rows: 1 },
      { id: 'income', label: 'Income level.', helpText: 'What can they afford to invest with you? Be honest.', placeholder: 'Household $120k+, business revenue $50k to $300k.', rows: 1 },
    ],
  },
  {
    id: 'dream-beliefs',
    kind: 'fillblank',
    section: 'Dream customer',
    title: 'What do they believe? What do they value?',
    subtitle: "The stuff under the demographics. This is the bridge to good marketing copy.",
    estimatedMinutes: 5,
    fields: [
      {
        id: 'beliefs',
        label: 'Their core beliefs, passions, and what they care about.',
        helpText: 'Politics aside, what do they prioritize? What matters to them in a working relationship?',
        placeholder: 'They believe in slow, intentional growth. They value craftsmanship over hustle. They want to be treated like an adult, not a project.',
        rows: 5,
      },
    ],
  },
  {
    id: 'dream-external',
    kind: 'fillblank',
    section: 'Dream customer',
    title: 'What problem are they openly trying to solve?',
    subtitle: "The surface stuff. The thing they'd say out loud at a networking event.",
    estimatedMinutes: 5,
    fields: [
      {
        id: 'external',
        label: 'External problems.',
        helpText: "Lisa's example: their brand isn't clear, their website doesn't convert, their pricing feels off.",
        placeholder: 'They don\'t have a clear brand. Their website looks like everyone else\'s. They keep getting low-budget inquiries.',
        rows: 5,
      },
    ],
  },
  {
    id: 'dream-internal',
    kind: 'fillblank',
    section: 'Dream customer',
    title: "Now the hard part. What's under the surface?",
    subtitle: "The feeling driving the problem. This is where the magic is. Dig deep.",
    estimatedMinutes: 6,
    fields: [
      {
        id: 'internal',
        label: 'Internal problems.',
        helpText: "Lisa's example: they feel invisible, overshadowed, insecure. 'Don't look at my website, it's a mess.'",
        placeholder: 'They feel invisible. They feel like an impostor. They are tired of apologizing for their prices. They wonder if they will ever feel ready.',
        rows: 5,
      },
    ],
  },
  {
    id: 'dream-where',
    kind: 'fillblank',
    section: 'Dream customer',
    title: 'Where do they show up?',
    subtitle: 'The spaces, online and off, where they live. So we can find them.',
    estimatedMinutes: 4,
    fields: [
      {
        id: 'spaces',
        label: 'Online and offline spaces, plus why those spaces appeal to them.',
        helpText: 'Platforms, podcasts, events, communities. Pair each with why.',
        placeholder: 'Instagram for inspiration, Substack for the thinking they\'re hungry for, in-person retreats once a year because they need a break from screens.',
        rows: 4,
      },
    ],
  },
  {
    id: 'dream-mirror',
    kind: 'mirror',
    section: 'Dream customer',
    title: 'Your person, in your own words.',
    subtitle: 'Read this slowly. Does it sound like the real person you have in mind? Hit Back to refine if not.',
    estimatedMinutes: 2,
    mirror: {
      template: [
        { label: 'The type that excites you:', from: 'dream-intro.fields.excites' },
        { label: 'Age range:', from: 'dream-demographics.fields.age' },
        { label: 'Stage of life:', from: 'dream-demographics.fields.stage' },
        { label: 'Their core beliefs:', from: 'dream-beliefs.fields.beliefs' },
        { label: 'Their external problem:', from: 'dream-external.fields.external' },
        { label: 'Their internal problem:', from: 'dream-internal.fields.internal' },
        { label: 'Where you find them:', from: 'dream-where.fields.spaces' },
      ],
    },
  },
  {
    id: 'portrait-craft',
    kind: 'ai-craft',
    section: 'Dream customer',
    title: 'Your ideal client portrait.',
    subtitle: "I'll craft 4 portrait versions from your dream-customer answers. Pick the one that feels most like the real person you have in mind. You can refine on the next step.",
    estimatedMinutes: 6,
    maxPicks: 1,
    generateLabel: 'Craft my portrait options',
    generateHint: '~15 to 20 seconds. I weave your demographics, beliefs, and problem answers into 4 portrait drafts.',
    sourceFields: [
      { label: 'Who excites you:', from: 'dream-intro.fields.excites' },
      { label: 'Demographics (age + stage + location):', from: 'dream-demographics.fields.stage' },
      { label: 'Their beliefs:', from: 'dream-beliefs.fields.beliefs' },
      { label: 'External problem:', from: 'dream-external.fields.external' },
      { label: 'Internal problem:', from: 'dream-internal.fields.internal' },
      { label: 'Where you find them:', from: 'dream-where.fields.spaces' },
    ],
  },
  {
    id: 'portrait-refine',
    kind: 'fillblank',
    section: 'Dream customer',
    title: 'Now make the portrait yours.',
    subtitle: 'Edit the wording. Add a sentence if you need.',
    estimatedMinutes: 6,
    fields: [
      {
        id: 'portrait',
        label: 'Your ideal client portrait.',
        helpText: "Imagine her, sit with her for a minute, and adjust until she feels real.",
        placeholder: '',
        rows: 8,
        prefillFrom: { tool: 'value', step: 'portrait-craft', kind: 'ai-selected' },
      },
    ],
  },

  // ----- Process C: USP (Unique Selling Proposition) -----
  {
    id: 'usp-craft',
    kind: 'ai-craft',
    section: 'Your USP',
    title: 'Your USP candidates.',
    subtitle: "I'll write 5 unique-selling-proposition candidates from your mission, brag bank, and ideal client. Pick the one that hits hardest. You refine the wording next.",
    estimatedMinutes: 5,
    maxPicks: 1,
    generateLabel: 'Write my USP options',
    generateHint: '~20 seconds. Five different angles, one tight directional sentence each.',
    sourceFields: [
      { label: 'What you do:', from: 'mission-discovery.fields.what' },
      { label: 'Who you help:', from: 'mission-discovery.fields.who' },
      { label: 'How they change:', from: 'mission-discovery.fields.how' },
      { label: 'The client that excites you:', from: 'dream-intro.fields.excites' },
      { label: "Their internal struggle:", from: 'dream-internal.fields.internal' },
    ],
  },
  {
    id: 'usp-refine',
    kind: 'fillblank',
    section: 'Your USP',
    title: 'Make your USP yours.',
    subtitle: 'Edit the wording. This goes on your homepage, your bio, and your sales calls.',
    estimatedMinutes: 5,
    fields: [
      {
        id: 'usp',
        label: 'Your Unique Selling Proposition.',
        helpText: 'One sentence, under 22 words. Lead with the assertion. Active voice. No hedges.',
        placeholder: '',
        rows: 4,
        prefillFrom: { tool: 'value', step: 'usp-craft', kind: 'ai-selected' },
      },
    ],
  },

  // ----- Process D: Customer Transformation -----
  {
    id: 'transformation',
    kind: 'fillblank',
    section: 'Transformation',
    title: 'The before, the after, the how.',
    subtitle: "Lisa's transformation grid. Four short answers. We use this on your website and sales pages.",
    estimatedMinutes: 10,
    fields: [
      {
        id: 'experience',
        label: 'What will they experience as a result of working with you?',
        helpText: 'The during. The texture of the work itself.',
        placeholder: 'Long conversations that feel like therapy more than strategy. A finished brand they can actually use the next day. A few hard truths they needed to hear.',
        rows: 3,
      },
      {
        id: 'feel',
        label: 'How will they feel after they work with you?',
        helpText: 'The emotional after. Be specific.',
        placeholder: 'Seen. Confident. Like they finally have language for what they always knew was true.',
        rows: 3,
      },
      {
        id: 'tools',
        label: 'What tools or processes do you use to help them get there?',
        helpText: "Your signature method. The thing other people don't do.",
        placeholder: 'The Pull, the Mirror, the Refine. A custom voice doc. Two rounds of "say it out loud."',
        rows: 3,
      },
      {
        id: 'capable',
        label: 'What will they be able to do after working with you?',
        helpText: 'The capability shift. What unlocks.',
        placeholder: 'Pitch their work without apologizing. Charge their full rate without flinching. Show up consistently because they finally sound like themselves.',
        rows: 3,
      },
    ],
  },
  {
    id: 'summary',
    kind: 'mirror',
    section: 'Value module',
    title: 'Your Value module: locked in.',
    subtitle: 'Unique value, ideal client, the transformation you create. Three deliverables you can deploy.',
    estimatedMinutes: 2,
    mirror: {
      kind: 'value-summary',
    },
  },
];

const STEPS_BY_TOOL = {
  vision: VISION_STEPS,
  value: VALUE_STEPS,
  // voice, visuals, visibility: TODO in next ships
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

// Per-deliverable progress for the dashboard breakdown.
export function visionDeliverables(journeyResponses = {}) {
  return [
    { key: 'mission', label: 'Mission Statement', value: journeyResponses['mission-refine']?.fields?.mission_statement || '', complete: !!journeyResponses['mission-refine'] },
    { key: 'vision', label: 'Vision Statement', value: journeyResponses['vision-refine']?.fields?.vision_statement || '', complete: !!journeyResponses['vision-refine'] },
    { key: 'values', label: 'Core Values', value: '', complete: !!journeyResponses['values-define'] },
  ];
}

export function valueDeliverables(journeyResponses = {}) {
  const bragSel = journeyResponses['brag-bank-craft']?.selected || [];
  const bragOpts = journeyResponses['brag-bank-craft']?.ai_options || [];
  const bragPicked = bragSel.map((id) => bragOpts.find((o) => o.id === id)?.text).filter(Boolean);
  return [
    { key: 'brag_bank', label: 'Brag Bank', value: bragPicked.join(' · '), complete: !!journeyResponses['brag-bank-craft'] && bragSel.length > 0, items: bragPicked },
    { key: 'portrait', label: 'Ideal Client Portrait', value: journeyResponses['portrait-refine']?.fields?.portrait || '', complete: !!journeyResponses['portrait-refine'] },
    { key: 'usp', label: 'Unique Selling Proposition', value: journeyResponses['usp-refine']?.fields?.usp || '', complete: !!journeyResponses['usp-refine'] },
    { key: 'transformation', label: 'Customer Transformation', value: '', complete: !!journeyResponses['transformation'] },
  ];
}

// ---------------------------------------------------------------------------
// Renderer for a single journey step body
// ---------------------------------------------------------------------------

export function renderJourneyStepBody(tool, step, savedResponse, journeyResponses = {}) {
  switch (step.kind) {
    case 'wordcloud':
      return renderWordCloud(step, savedResponse);
    case 'fillblank':
      return renderFillBlank(step, savedResponse, journeyResponses);
    case 'pick-3':
      return renderPick3(step, savedResponse, journeyResponses);
    case 'rank':
      return renderRank(step, savedResponse, journeyResponses);
    case 'mirror':
      return renderMirror(step, journeyResponses);
    case 'ai-craft':
      return renderAiCraft(step, savedResponse, journeyResponses);
    case 'summary':
      return renderSummaryStep(tool, step);
    default:
      return `<p class="journey-error">Unknown step kind: ${esc(step.kind)}</p>`;
  }
}

// ---------------------------------------------------------------------------
// ai-craft: shows the user's raw source answers, a "Generate options" button,
// and once generated, the AI-crafted options as pickable cards. The generation
// happens server-side via /api/journey/craft and the options cache in
// journey_responses[step_id].ai_options so they don't regenerate on reload.
// ---------------------------------------------------------------------------

function renderAiCraft(step, saved, journeyResponses) {
  const cached = saved?.ai_options || [];
  const selected = saved?.selected || [];
  const maxPicks = step.maxPicks || 6;

  // Build a short read-back of the source answers so the user sees what we're working from.
  const sourceFields = (step.sourceFields || []).map((s) => {
    const path = s.from.split('.');
    let cur = journeyResponses[path[0]] || {};
    for (const k of path.slice(1)) cur = cur ? cur[k] : null;
    const val = typeof cur === 'string' ? cur : '';
    return `<div class="ai-craft-source">
      <p class="ai-craft-source__label">${esc(s.label)}</p>
      <p class="ai-craft-source__value">${esc(val || '(blank)')}</p>
    </div>`;
  }).join('');

  const optionsHtml = cached.length ? cached.map((o) => `
    <button type="button" class="ai-option ${selected.includes(o.id) ? 'is-selected' : ''}" data-option-id="${esc(o.id)}">
      <span class="ai-option__text">${esc(o.text)}</span>
      <span class="ai-option__check" aria-hidden="true">✓</span>
    </button>
  `).join('') : '';

  return `<div class="step-body step-body--ai-craft" data-step-kind="ai-craft" data-step-id="${esc(step.id)}" data-max-picks="${maxPicks}">
    <div class="ai-craft__sources">
      <p class="ai-craft__sources-label">What I'm working from</p>
      <details class="ai-craft__details">
        <summary>Show your raw answers</summary>
        ${sourceFields}
      </details>
    </div>

    <div class="ai-craft__action">
      ${cached.length ? `
        <p class="ai-craft__hint"><span class="step-body__count" data-count>${selected.length}/${maxPicks}</span> picked. Pick ${maxPicks} that feel like you. Tap one to toggle.</p>
        <div class="ai-options" data-ai-options>${optionsHtml}</div>
        <button type="button" class="btn--quiet ai-craft__regen" data-ai-generate>Regenerate options</button>
      ` : `
        <button type="button" class="btn btn--primary btn--lg ai-craft__generate" data-ai-generate>${esc(step.generateLabel || 'Craft these for me')}</button>
        <p class="ai-craft__hint">${esc(step.generateHint || 'This takes 15 to 30 seconds. I will pull from your answers above and craft polished options for you to pick from.')}</p>
        <div class="ai-options" data-ai-options></div>
      `}
    </div>
  </div>`;
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

function renderFillBlank(step, saved, journeyResponses) {
  const fieldVals = (saved && saved.fields) ? saved.fields : {};
  const tokens = visionTokenMap(journeyResponses);

  // Compose fields. Either static (step.fields) or derived from a prior step
  // (step.fieldsFrom = a prior step id whose ranked items become fields).
  let fields = step.fields || [];
  if (step.fieldsFrom) {
    // Pull top 5 ranked items from `values-rank` and turn them into fields.
    const priorRank = journeyResponses[step.fieldsFrom]?.ranking || [];
    const priorTap = journeyResponses['values-tap']?.selected || [];
    const valuesById = Object.fromEntries(VALUE_WORDS.map((w) => [w.id, w.label]));
    const ranked = priorRank.length ? priorRank : priorTap;
    fields = ranked.slice(0, 6).map((id) => ({
      id: 'def_' + id,
      label: capitalize(valuesById[id] || id),
      helpText: step.fieldHelp || 'Define what this looks like in your work.',
      placeholder: '',
      rows: 2,
    }));
  }

  const inspiration = step.inspiration ? `<aside class="step-inspiration">
    <p class="step-inspiration__label">${esc(step.inspiration.label)}</p>
    <p class="step-inspiration__text">${esc(step.inspiration.text)}</p>
  </aside>` : '';

  const fieldsHtml = fields.map((f) => {
    let initial = fieldVals[f.id] || '';
    // Pre-fill from a prior pick (e.g., the chosen mission template with [tokens] applied).
    if (!initial && f.prefillFrom) {
      const pf = f.prefillFrom;
      const pfStep = journeyResponses[pf.step];
      if (pf.kind === 'template' && pfStep) {
        const pickedId = (pfStep.selected || [])[0];
        if (pickedId) {
          let tmpl = null;
          if (pf.step === 'mission-pick') tmpl = MISSION_TEMPLATES.find((t) => t.id === pickedId);
          else if (pf.step === 'vision-pick') tmpl = VISION_TEMPLATES.find((t) => t.id === pickedId);
          if (tmpl) {
            // Inject extra vision-pick tokens (PAIN, WORD1-3) loosely when not present.
            initial = applyTokens(applyVisionExtraTokens(tmpl.text, journeyResponses), tokens);
          }
        }
      } else if (pf.kind === 'ai-selected' && pfStep) {
        // Pre-fill with the user's selected AI-crafted option text.
        const pickedId = (pfStep.selected || [])[0];
        const options = pfStep.ai_options || [];
        const picked = options.find((o) => o.id === pickedId);
        if (picked) initial = picked.text;
      }
    }
    return `<div class="fill-field">
      <label class="fill-field__label" for="ff-${esc(f.id)}">${esc(f.label)}</label>
      ${f.helpText ? `<p class="fill-field__help">${esc(f.helpText)}</p>` : ''}
      <textarea id="ff-${esc(f.id)}" class="fill-field__input" data-field-id="${esc(f.id)}" rows="${f.rows || 3}" placeholder="${esc(f.placeholder || '')}">${esc(initial)}</textarea>
    </div>`;
  }).join('');

  return `<div class="step-body step-body--fillblank" data-step-kind="fillblank" data-step-id="${esc(step.id)}">
    ${fieldsHtml}
    ${inspiration}
  </div>`;
}

function renderPick3(step, saved, journeyResponses) {
  const selected = (saved && Array.isArray(saved.selected)) ? saved.selected : [];
  const max = step.maxPicks || 3;
  const tokens = visionTokenMap(journeyResponses);

  // Compose options. Static or derived from a template family.
  let options = step.options || [];
  if (step.optionsFromTemplates === 'mission') {
    options = MISSION_TEMPLATES.map((t) => ({
      id: t.id,
      label: applyTokens(t.text, tokens),
      description: t.description,
    }));
  } else if (step.optionsFromTemplates === 'vision') {
    options = VISION_TEMPLATES.map((t) => ({
      id: t.id,
      label: applyTokens(applyVisionExtraTokens(t.text, journeyResponses), tokens),
      description: t.description,
    }));
  } else if (step.optionsFromTemplates === 'unique-value') {
    options = VALUE_TEMPLATES.map((t) => ({
      id: t.id,
      label: applyTokens(t.text, tokens),
      description: t.description,
    }));
  } else if (step.optionsFromTemplates === 'portrait') {
    options = PORTRAIT_TEMPLATES.map((t) => ({
      id: t.id,
      label: applyTokens(t.text, tokens),
      description: t.description,
    }));
  }

  return `<div class="step-body step-body--pick3" data-step-kind="pick-3" data-step-id="${esc(step.id)}" data-max-picks="${max}">
    <p class="step-body__hint">Pick ${max}. <span class="step-body__count" data-count>${selected.length}/${max}</span></p>
    <div class="pick-grid">
      ${options.map((opt) => `
        <button type="button" class="pick-card ${selected.includes(opt.id) ? 'is-selected' : ''}" data-option-id="${esc(opt.id)}">
          <span class="pick-card__label">${esc(opt.label)}</span>
          ${opt.description ? `<span class="pick-card__desc">${esc(opt.description)}</span>` : ''}
          <span class="pick-card__check" aria-hidden="true">✓</span>
        </button>
      `).join('')}
    </div>
  </div>`;
}

// Vision-specific tokens (WORD1, WORD2, WORD3, PAIN) pulled from prior steps.
function applyVisionExtraTokens(text, journeyResponses = {}) {
  if (!text) return '';
  const visionWords = (journeyResponses['vision-words']?.selected || [])
    .map((id) => VISION_WORDS.find((w) => w.id === id)?.label || '')
    .filter(Boolean);
  const map = {
    WORD1: visionWords[0] || 'meaning',
    WORD2: visionWords[1] || 'integrity',
    WORD3: visionWords[2] || 'craft',
    PAIN: 'overwhelm',
  };
  return text.replace(/\[(WORD1|WORD2|WORD3|PAIN)\]/g, (_, k) => map[k]);
}

function renderRank(step, saved, journeyResponses) {
  // Items can be static or pulled from a prior wordcloud's selections.
  let items = step.items;
  if (!items && step.itemsFrom) {
    const priorSel = journeyResponses[step.itemsFrom]?.selected || [];
    const valuesById = Object.fromEntries(VALUE_WORDS.map((w) => [w.id, w.label]));
    items = priorSel.map((id) => ({
      id,
      label: capitalize(valuesById[id] || id),
      description: '',
    }));
    // Always surface 6 to 10 items at the rank step so the narrowing exercise
    // is meaningful. If the user tapped fewer than 6, supplement with common
    // defaults (skipping ones they already picked) until we hit at least 8.
    const MIN_RANK_ITEMS = 8;
    if (items.length < MIN_RANK_ITEMS) {
      const have = new Set(items.map((i) => i.id));
      const defaults = ['integrity', 'honesty', 'kindness', 'craft', 'creativity', 'courage', 'service', 'freedom', 'family', 'joy', 'curiosity', 'rigor'];
      for (const id of defaults) {
        if (items.length >= MIN_RANK_ITEMS) break;
        if (have.has(id)) continue;
        items.push({
          id,
          label: capitalize(valuesById[id] || id),
          description: 'Suggested. Drag below the line if it doesn\'t fit.',
        });
        have.add(id);
      }
    }
    // If still nothing (extreme edge case), use the first 8 known values.
    if (!items.length) {
      items = VALUE_WORDS.slice(0, 8).map((w) => ({ id: w.id, label: capitalize(w.label) }));
    }
  }
  items = items || [];

  const order = (saved && Array.isArray(saved.ranking)) ? saved.ranking : items.map((i) => i.id);
  const itemById = Object.fromEntries(items.map((i) => [i.id, i]));
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

// Mirror: read-only step that reflects prior answers back to the user with a
// continue button. Multiple shapes:
//   - template: list of { label, from } pulling from prior steps
//   - kind: 'wordcloud-list' rendering selections from one prior step as chips
//   - kind: 'vision-summary' rendering mission, vision, and values together
function renderMirror(step, journeyResponses = {}) {
  const m = step.mirror || {};
  let bodyHtml = '';

  if (m.template) {
    bodyHtml = m.template.map((row) => {
      const value = readByPath(row.from, step, journeyResponses);
      return `<div class="mirror-row">
        <p class="mirror-row__label">${esc(row.label)}</p>
        <p class="mirror-row__value">${esc(value || '(blank — go back to fill this in)')}</p>
      </div>`;
    }).join('');
  } else if (m.kind === 'wordcloud-list') {
    const src = m.sourceStep ? journeyResponses[m.sourceStep] : null;
    const ids = (src?.selected || []);
    const labels = ids.map((id) => {
      const w = VALUE_WORDS.find((x) => x.id === id) || VISION_WORDS.find((x) => x.id === id);
      return w?.label || id;
    });
    bodyHtml = labels.length
      ? `<div class="mirror-chips">${labels.map((l) => `<span class="mirror-chip">${esc(l)}</span>`).join('')}</div>`
      : `<p class="mirror-row__value">(nothing tapped yet — go back and tap some words)</p>`;
  } else if (m.kind === 'vision-summary') {
    const mission = journeyResponses['mission-refine']?.fields?.mission_statement || '';
    const vision = journeyResponses['vision-refine']?.fields?.vision_statement || '';
    const definitions = journeyResponses['values-define']?.fields || {};
    const ranking = journeyResponses['values-rank']?.ranking || journeyResponses['values-tap']?.selected || [];
    const valuesById = Object.fromEntries(VALUE_WORDS.map((w) => [w.id, w.label]));
    const topValues = ranking.slice(0, 6);
    const valueRows = topValues.map((id) => {
      const def = definitions['def_' + id] || '';
      return `<div class="mirror-row">
        <p class="mirror-row__label">${esc(capitalize(valuesById[id] || id))}</p>
        ${def ? `<p class="mirror-row__value">${esc(def)}</p>` : `<p class="mirror-row__value mirror-row__value--muted">(no definition yet)</p>`}
      </div>`;
    }).join('');
    bodyHtml = `
      <div class="mirror-section">
        <p class="mirror-section__label">Mission Statement</p>
        <p class="mirror-section__value">${esc(mission || '(blank)')}</p>
      </div>
      <div class="mirror-section">
        <p class="mirror-section__label">Vision Statement</p>
        <p class="mirror-section__value">${esc(vision || '(blank)')}</p>
      </div>
      <div class="mirror-section">
        <p class="mirror-section__label">Core Values</p>
        ${valueRows || '<p class="mirror-row__value mirror-row__value--muted">(no values defined yet)</p>'}
      </div>
    `;
  } else if (m.kind === 'value-summary') {
    const bragSel = journeyResponses['brag-bank-craft']?.selected || [];
    const bragOpts = journeyResponses['brag-bank-craft']?.ai_options || [];
    const bragPicked = bragSel.map((id) => bragOpts.find((o) => o.id === id)?.text).filter(Boolean);
    const portrait = journeyResponses['portrait-refine']?.fields?.portrait || '';
    const usp = journeyResponses['usp-refine']?.fields?.usp || '';
    const t = journeyResponses['transformation']?.fields || {};
    bodyHtml = `
      <div class="mirror-section">
        <p class="mirror-section__label">Your USP</p>
        <p class="mirror-section__value">${esc(usp || '(blank)')}</p>
      </div>
      <div class="mirror-section">
        <p class="mirror-section__label">Brag Bank</p>
        ${bragPicked.length ? `<ul class="mirror-list">${bragPicked.map((b) => `<li class="mirror-list__item">${esc(b)}</li>`).join('')}</ul>` : '<p class="mirror-row__value mirror-row__value--muted">(no phrases picked yet)</p>'}
      </div>
      <div class="mirror-section">
        <p class="mirror-section__label">Ideal Client Portrait</p>
        <p class="mirror-section__value">${esc(portrait || '(blank)')}</p>
      </div>
      <div class="mirror-section">
        <p class="mirror-section__label">Customer Transformation</p>
        <div class="mirror-row">
          <p class="mirror-row__label">During:</p>
          <p class="mirror-row__value">${esc(t.experience || '(blank)')}</p>
        </div>
        <div class="mirror-row">
          <p class="mirror-row__label">After they feel:</p>
          <p class="mirror-row__value">${esc(t.feel || '(blank)')}</p>
        </div>
        <div class="mirror-row">
          <p class="mirror-row__label">Tools you use:</p>
          <p class="mirror-row__value">${esc(t.tools || '(blank)')}</p>
        </div>
        <div class="mirror-row">
          <p class="mirror-row__label">What they can do after:</p>
          <p class="mirror-row__value">${esc(t.capable || '(blank)')}</p>
        </div>
      </div>
    `;
  }

  return `<div class="step-body step-body--mirror" data-step-kind="mirror" data-step-id="${esc(step.id)}">
    <div class="mirror-card">
      ${bodyHtml}
    </div>
  </div>`;
}

function renderSummaryStep(tool, step) {
  const meta = TOOL_META[tool] || { label: tool };
  return `<div class="step-body step-body--summary" data-step-kind="summary" data-step-id="${esc(step.id)}">
    <div class="summary-card">
      <p class="summary-card__eyebrow">${esc(meta.label)} saved</p>
      <p class="summary-card__body">Your answers compile into your Brand Guide as you finish more sections.</p>
    </div>
  </div>`;
}

// Read a value from journey_responses by dotted path.
// Path format: "<step_id>.<field>.<sub>". The first segment is the step id.
function readByPath(path, step, journeyResponses) {
  if (!path) return '';
  const parts = path.split('.');
  const stepId = parts.length > 1 ? parts[0] : (step.mirror?.sourceStep || step.id);
  const tail = parts.length > 1 ? parts.slice(1) : parts;
  let cur = journeyResponses[stepId] || {};
  for (const k of tail) {
    if (cur == null) return '';
    cur = cur[k];
  }
  return typeof cur === 'string' ? cur : '';
}

function capitalize(s) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}
