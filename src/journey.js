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

const VOICE_WORDS = [
  // Warmth
  { id: 'warm', label: 'warm', group: 'Warmth' },
  { id: 'tender', label: 'tender', group: 'Warmth' },
  { id: 'nurturing', label: 'nurturing', group: 'Warmth' },
  { id: 'encouraging', label: 'encouraging', group: 'Warmth' },
  { id: 'sincere', label: 'sincere', group: 'Warmth' },
  { id: 'welcoming', label: 'welcoming', group: 'Warmth' },
  // Edge
  { id: 'direct', label: 'direct', group: 'Edge' },
  { id: 'gutsy', label: 'gutsy', group: 'Edge' },
  { id: 'contrarian', label: 'contrarian', group: 'Edge' },
  { id: 'sassy', label: 'sassy', group: 'Edge' },
  { id: 'irreverent', label: 'irreverent', group: 'Edge' },
  { id: 'bold-voice', label: 'bold', group: 'Edge' },
  // Polish
  { id: 'polished-voice', label: 'polished', group: 'Polish' },
  { id: 'editorial', label: 'editorial', group: 'Polish' },
  { id: 'minimal-voice', label: 'minimal', group: 'Polish' },
  { id: 'refined', label: 'refined', group: 'Polish' },
  { id: 'articulate', label: 'articulate', group: 'Polish' },
  // Play
  { id: 'playful-voice', label: 'playful', group: 'Play' },
  { id: 'witty', label: 'witty', group: 'Play' },
  { id: 'quirky', label: 'quirky', group: 'Play' },
  { id: 'fun', label: 'fun', group: 'Play' },
  { id: 'lighthearted', label: 'lighthearted', group: 'Play' },
  // Ground
  { id: 'grounded-voice', label: 'grounded', group: 'Ground' },
  { id: 'calm-voice', label: 'calm', group: 'Ground' },
  { id: 'steady', label: 'steady', group: 'Ground' },
  { id: 'wise', label: 'wise', group: 'Ground' },
  { id: 'thoughtful-voice', label: 'thoughtful', group: 'Ground' },
];

const VIBE_WORDS = [
  // Feel
  { id: 'calm-vibe', label: 'calm', group: 'Feel' },
  { id: 'cozy', label: 'cozy', group: 'Feel' },
  { id: 'homey', label: 'homey', group: 'Feel' },
  { id: 'warm-vibe', label: 'warm', group: 'Feel' },
  { id: 'airy', label: 'airy', group: 'Feel' },
  { id: 'moody', label: 'moody', group: 'Feel' },
  { id: 'dreamy', label: 'dreamy', group: 'Feel' },
  // Energy
  { id: 'fun-vibe', label: 'fun', group: 'Energy' },
  { id: 'playful-vibe', label: 'playful', group: 'Energy' },
  { id: 'vibrant', label: 'vibrant', group: 'Energy' },
  { id: 'bold-vibe', label: 'bold', group: 'Energy' },
  { id: 'quiet', label: 'quiet', group: 'Energy' },
  { id: 'chill', label: 'chill', group: 'Energy' },
  // Polish
  { id: 'professional', label: 'professional', group: 'Polish' },
  { id: 'luxe', label: 'luxe', group: 'Polish' },
  { id: 'editorial-vibe', label: 'editorial', group: 'Polish' },
  { id: 'clean', label: 'clean', group: 'Polish' },
  { id: 'minimal-vibe', label: 'minimal', group: 'Polish' },
  { id: 'elevated', label: 'elevated', group: 'Polish' },
  // Character
  { id: 'earthy', label: 'earthy', group: 'Character' },
  { id: 'coastal', label: 'coastal', group: 'Character' },
  { id: 'vintage', label: 'vintage', group: 'Character' },
  { id: 'modern-vibe', label: 'modern', group: 'Character' },
  { id: 'romantic', label: 'romantic', group: 'Character' },
  { id: 'edgy-vibe', label: 'edgy', group: 'Character' },
  { id: 'organic', label: 'organic', group: 'Character' },
  { id: 'timeless', label: 'timeless', group: 'Character' },
];

const PLATFORM_WORDS = [
  // Platforms
  { id: 'instagram', label: 'Instagram', group: 'Platforms' },
  { id: 'tiktok', label: 'TikTok', group: 'Platforms' },
  { id: 'linkedin', label: 'LinkedIn', group: 'Platforms' },
  { id: 'facebook', label: 'Facebook', group: 'Platforms' },
  { id: 'pinterest', label: 'Pinterest', group: 'Platforms' },
  { id: 'youtube', label: 'YouTube', group: 'Platforms' },
  // What you enjoy making
  { id: 'writing', label: 'writing', group: 'What you enjoy' },
  { id: 'video', label: 'video', group: 'What you enjoy' },
  { id: 'photos', label: 'photos', group: 'What you enjoy' },
  { id: 'speaking', label: 'speaking', group: 'What you enjoy' },
  { id: 'teaching', label: 'teaching', group: 'What you enjoy' },
  { id: 'community', label: 'community', group: 'What you enjoy' },
];

// One lookup across every word list so rank steps, mirrors, and deliverables
// can resolve any tapped word id to its display label.
const ALL_WORD_LISTS = [VALUE_WORDS, VISION_WORDS, VOICE_WORDS, VIBE_WORDS, PLATFORM_WORDS];
export function wordLabel(id) {
  for (const list of ALL_WORD_LISTS) {
    const hit = list.find((w) => w.id === id);
    if (hit) return hit.label;
  }
  return String(id || '').replace(/-/g, ' ');
}

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
    kind: 'ai-mirror',
    section: 'Get to know you',
    title: "Here's what I'm hearing about you so far.",
    subtitle: 'Read it slowly. If anything is off, hit Back. Otherwise, we go pull a brand out of all of this.',
    estimatedMinutes: 3,
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
    kind: 'ai-mirror',
    section: 'Mission',
    title: "Here's the work I'm seeing.",
    subtitle: "Read it back. If it lands, pick a framing next. If not, hit Back and edit your answers.",
    estimatedMinutes: 3,
  },
  {
    id: 'mission-craft',
    kind: 'ai-craft',
    section: 'Mission',
    title: 'Your mission statement candidates.',
    subtitle: "Ten polished mission statements crafted from everything you've told me, in your voice with the rough edges smoothed. Pick the one that hits. Whichever you pick is your mission statement.",
    estimatedMinutes: 6,
    maxPicks: 1,
    generateLabel: 'Write my mission options',
    generateHint: 'About 20 seconds. Ten different angles, one or two sentences each.',
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
    id: 'vision-craft',
    kind: 'ai-craft',
    section: 'Vision',
    title: 'Your vision statement candidates.',
    subtitle: "Ten vision statements woven from your impact, your archetype, your words, and your mission. Pick the one that inspires YOU first. Whichever you pick is your vision statement.",
    estimatedMinutes: 5,
    maxPicks: 1,
    generateLabel: 'Write my vision options',
    generateHint: 'About 20 seconds. Ten angles, one sentence each.',
  },
  {
    id: 'mission-vision-mirror',
    kind: 'ai-mirror',
    section: 'Vision',
    title: 'Mission and Vision, side by side.',
    subtitle: "Read the connection. Then we go pull out your values.",
    estimatedMinutes: 3,
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
    kind: 'ai-mirror',
    section: 'Values',
    title: "Here's the through-line I'm seeing.",
    subtitle: 'A reflection on what your principles + the words you tapped say about you. Pick your top values next.',
    estimatedMinutes: 3,
  },
  {
    id: 'values-rank',
    kind: 'rank',
    section: 'Values',
    title: 'Drag your top 6 to the top.',
    subtitle: 'Top of the list is most important. Three to six core values, top heavy.',
    estimatedMinutes: 6,
    itemsFrom: 'values-tap',
    supplement: ['integrity', 'honesty', 'kindness', 'craft', 'creativity', 'courage', 'service', 'freedom', 'family', 'joy', 'curiosity', 'rigor'],
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
    kind: 'ai-mirror',
    section: 'Your value',
    title: "Here's what I'm hearing about you.",
    subtitle: 'Read it slowly. This is what makes you irreplaceable, in cleaner language than you probably gave me.',
    estimatedMinutes: 3,
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
    kind: 'ai-mirror',
    section: 'Dream customer',
    title: "Here's the person I'm seeing.",
    subtitle: 'Read it slowly. Does it sound like the real person you have in mind? Hit Back if not.',
    estimatedMinutes: 3,
  },
  {
    id: 'portrait-craft',
    kind: 'ai-craft',
    section: 'Dream customer',
    title: 'Your ideal client portrait.',
    subtitle: "I'll craft 4 portrait paragraphs from different angles. Pick the one that feels most like the real person you have in mind. Whichever you pick is your portrait, no rewriting required.",
    estimatedMinutes: 6,
    maxPicks: 1,
    generateLabel: 'Craft my portrait options',
    generateHint: '~15 to 20 seconds. Four different angles, you pick one.',
  },

  // ----- Process C: USP (Unique Selling Proposition) -----
  {
    id: 'usp-craft',
    kind: 'ai-craft',
    section: 'Your USP',
    title: 'Your USP candidates.',
    subtitle: "Five Unique Selling Proposition candidates from different angles, synthesized from your mission, brag bank, and ideal client. Pick the one that hits hardest. Whichever you pick is your USP.",
    estimatedMinutes: 5,
    maxPicks: 1,
    generateLabel: 'Write my USP options',
    generateHint: '~20 seconds. Five different angles, one tight sentence each.',
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

// ===========================================================================
// VOICE module (Module Three): I Help statements, common language, About Me.
// Sourced from build-a-brand_workbook-module_3_voice.pdf + the Voice GPT.
// Deliverables: I Help Statement, Voice in three words, Common Language bank,
// About Me story.
// ===========================================================================

export const VOICE_STEPS = [
  {
    id: 'voice-feel',
    kind: 'fillblank',
    section: 'Your voice',
    title: 'How should your words make people feel?',
    subtitle: "Before we write anything, we set the target. Two quick answers.",
    estimatedMinutes: 5,
    fields: [
      {
        id: 'feel',
        label: 'When your ideal client reads your website or a post, how do you want them to FEEL?',
        placeholder: 'Like a friend just told her the truth and she can finally exhale.',
        rows: 3,
      },
      {
        id: 'three_words',
        label: 'What three words do you want people to use when they describe your voice?',
        placeholder: 'Warm, direct, encouraging.',
        rows: 1,
      },
    ],
  },
  {
    id: 'voice-sliders',
    kind: 'slider',
    section: 'Your voice',
    title: 'Where does your voice live?',
    subtitle: 'Four spectrums. Trust your gut, you can nudge them later.',
    estimatedMinutes: 4,
    sliders: [
      { id: 'formality', left: 'Formal', right: 'Casual' },
      { id: 'edge', left: 'Gentle', right: 'Bold' },
      { id: 'era', left: 'Classic', right: 'Modern' },
      { id: 'volume', left: 'Quiet', right: 'Loud' },
    ],
  },
  {
    id: 'voice-words',
    kind: 'wordcloud',
    section: 'Your voice',
    title: 'Tap the words that sound like you.',
    subtitle: "Aim for at least 6. This is how you talk when you're at your best.",
    estimatedMinutes: 5,
    words: VOICE_WORDS,
  },
  {
    id: 'voice-mirror',
    kind: 'ai-mirror',
    section: 'Your voice',
    title: "Here's the voice I'm hearing.",
    subtitle: 'Read it out loud. Does it sound like you on a good day?',
    estimatedMinutes: 3,
  },
  {
    id: 'ihelp-discovery',
    kind: 'fillblank',
    section: 'I Help statement',
    title: 'The I Help statement.',
    subtitle: "Lisa's formula: I help ___ by doing ___. Or: I help ___ because ___. This pulls your whole brand into one sentence.",
    estimatedMinutes: 6,
    fields: [
      { id: 'who', label: 'Who do you help?', helpText: 'You defined this person in Value. Say it plainly here.', placeholder: 'Solo women founders who are done DIYing their brand.', rows: 2 },
      { id: 'doing', label: 'What do you do for them?', placeholder: 'I build them a brand that finally matches the level of their work.', rows: 2 },
      { id: 'why', label: 'Why does it matter?', helpText: 'The because. The stakes.', placeholder: 'Because being good was never their problem. Being seen is.', rows: 2 },
    ],
    inspiration: {
      label: "Lisa's examples",
      text: '"I help business owners build brands that are beautiful and bankable." "I help people break through their out of date brand."',
    },
  },
  {
    id: 'ihelp-craft',
    kind: 'ai-craft',
    section: 'I Help statement',
    title: 'Your I Help candidates.',
    subtitle: 'Ten I Help statements built from your mission, your value, and your ideal client. Pick the one that hits. Whichever you pick is your I Help statement.',
    estimatedMinutes: 5,
    maxPicks: 1,
    generateLabel: 'Write my I Help options',
    generateHint: 'About 20 seconds. Ten angles, one sentence each.',
  },
  {
    id: 'language-discovery',
    kind: 'fillblank',
    section: 'Common language',
    title: 'The words you already use.',
    subtitle: 'Same language on your website, social, and marketing keeps everything aligned. Skip the jargon, keep it everyday.',
    estimatedMinutes: 6,
    fields: [
      { id: 'phrases', label: 'Words or phrases you use often when you talk about your business.', helpText: 'Catchy phrases, alliterated building blocks, things clients repeat back to you.', placeholder: 'Level up. Show up like you mean it. Beautiful and bankable.', rows: 3 },
      { id: 'client_words', label: 'Everyday words your ideal client uses about their problem.', helpText: 'Their words, not yours. How do they describe the struggle?', placeholder: '"My website is embarrassing." "I never know what to post." "I feel invisible."', rows: 3 },
      { id: 'jargon', label: 'Industry jargon you want to avoid.', placeholder: 'Synergy, holistic, brand equity, omnichannel.', rows: 2 },
    ],
    inspiration: {
      label: "Lisa's examples",
      text: '"Level Up. Your Face Makes You Money. Stand Out. Captivating. Confident."',
    },
  },
  {
    id: 'language-craft',
    kind: 'ai-craft',
    section: 'Common language',
    title: 'Your common language bank.',
    subtitle: "Ten short, catchy, copy-ready phrases in your voice. Pick 6. Use them everywhere: website, captions, emails, sales calls.",
    estimatedMinutes: 6,
    maxPicks: 6,
    generateLabel: 'Craft my language bank',
    generateHint: 'About 20 seconds. Short phrases with Level Up energy, in your voice.',
  },
  {
    id: 'aboutme-discovery',
    kind: 'fillblank',
    section: 'About Me',
    title: "Your About Me. It's not really about you.",
    subtitle: "Flip the script: you once struggled with the same internal problems your ideal client has now. Tell that story.",
    estimatedMinutes: 8,
    fields: [
      { id: 'struggle', label: 'What did you struggle with that your ideal client struggles with now?', helpText: 'Their internal problem, back when it was yours.', placeholder: 'I spent years undercharging because I could not explain what made me different.', rows: 3 },
      { id: 'turning', label: 'What was the turning point?', helpText: 'The moment, the decision, the thing that changed.', placeholder: 'A mentor asked me one question I could not answer, and I rebuilt everything around it.', rows: 3 },
      { id: 'thriving', label: 'What does the other side look like, and how does it connect to what you do now?', placeholder: 'Now I charge what the work is worth, and I help other women get there faster than I did.', rows: 3 },
    ],
    inspiration: {
      label: "Lisa's example of the flip",
      text: '"When my grandma died I was so sad that I couldn\'t find a single picture of the two of us together. That is why I am passionate about family photos and capturing memories that last forever."',
    },
  },
  {
    id: 'aboutme-craft',
    kind: 'ai-craft',
    section: 'About Me',
    title: 'Your About Me drafts.',
    subtitle: 'Three versions, each built on your story and aimed at your ideal client. Pick the one that feels most like you.',
    estimatedMinutes: 5,
    maxPicks: 1,
    generateLabel: 'Write my About Me options',
    generateHint: 'About 25 seconds. Three drafts, a short paragraph each.',
  },
  {
    id: 'summary',
    kind: 'mirror',
    section: 'Voice module',
    title: 'Your Voice: locked in.',
    subtitle: 'The words that sound like you, ready to deploy.',
    estimatedMinutes: 2,
    mirror: { kind: 'voice-summary' },
  },
];

// ===========================================================================
// VISUALS module (Module Four): vibe, colors, logo, fonts.
// Sourced from build-a-brand_workbook-_module_4_visuals_1.pdf + Visuals GPT.
// Deliverables: Brand Vibe words, Color Direction, Font Direction, Logo Notes.
// ===========================================================================

export const VISUALS_STEPS = [
  {
    id: 'visuals-confidence',
    kind: 'pick-3',
    section: 'Your visuals',
    title: 'First, honestly: how confident are you about visuals?',
    subtitle: 'No wrong answer. This tells me how much guidance to give.',
    estimatedMinutes: 2,
    maxPicks: 1,
    options: [
      { id: 'beginner', label: 'Complete beginner', description: 'Colors and fonts freeze me. Guide me all the way.' },
      { id: 'somewhat', label: 'Somewhat confident', description: 'I have opinions but I second-guess them.' },
      { id: 'confident', label: 'Totally confident', description: 'I know what I like. Help me sharpen it.' },
    ],
  },
  {
    id: 'vibe-words',
    kind: 'wordcloud',
    section: 'Brand vibe',
    title: 'Tap every word that fits the vibe you want.',
    subtitle: "Think about brands you love. How they look, feel, even smell. Now tap what YOURS should embody. Aim for at least 8.",
    estimatedMinutes: 5,
    words: VIBE_WORDS,
  },
  {
    id: 'vibe-rank',
    kind: 'rank',
    section: 'Brand vibe',
    title: 'Drag your top 6 vibe words to the top.',
    subtitle: "These become your brand vibe. Every visual decision gets checked against them.",
    estimatedMinutes: 5,
    itemsFrom: 'vibe-words',
    supplement: ['warm-vibe', 'clean', 'earthy', 'bold-vibe', 'timeless', 'playful-vibe', 'elevated', 'calm-vibe'],
  },
  {
    id: 'visuals-inspiration',
    kind: 'fillblank',
    section: 'Brand vibe',
    title: 'The brands you love looking at.',
    estimatedMinutes: 5,
    fields: [
      { id: 'brands', label: 'Brands whose look you love, and which elements grab you.', helpText: 'Any industry. The packaging, the colors, the fonts, the photos?', placeholder: "Aesop's shelves, Magnolia's warmth, my favorite coffee shop's hand-painted sign.", rows: 3 },
      { id: 'yours', label: 'How do you want YOUR brand to look and feel?', placeholder: 'Warm and earthy but still sharp. Like a linen shirt that fits perfectly.', rows: 3 },
    ],
  },
  {
    id: 'colors-compass',
    kind: 'slider',
    section: 'Brand colors',
    title: 'Your color compass.',
    subtitle: "Lisa's rule: don't overthink colors. They set a feeling, and they can evolve. Three quick calls.",
    estimatedMinutes: 3,
    sliders: [
      { id: 'temp', left: 'Warm', right: 'Cool' },
      { id: 'saturation', left: 'Neutral', right: 'Colorful' },
      { id: 'lightness', left: 'Dark', right: 'Light' },
    ],
  },
  {
    id: 'colors-love',
    kind: 'fillblank',
    section: 'Brand colors',
    title: 'Colors you actually love.',
    subtitle: "You'll wear these in photos and live with them on your website. Pick colors you like, not colors a trend likes.",
    estimatedMinutes: 4,
    fields: [
      { id: 'colors', label: 'Colors you are drawn to, and why.', placeholder: 'Rust and clay tones. Deep green. Cream instead of white. They feel like my house.', rows: 3 },
    ],
  },
  {
    id: 'palette-craft',
    kind: 'ai-craft',
    section: 'Brand colors',
    title: 'Your palette directions.',
    subtitle: "Six palette directions using Lisa's formula: 1 to 3 main colors, a dark neutral, a light neutral, and a metallic accent. Pick the one you'd wear.",
    estimatedMinutes: 5,
    maxPicks: 1,
    generateLabel: 'Craft my palette directions',
    generateHint: 'About 20 seconds. Six directions in plain words, no hex codes to stress over.',
  },
  {
    id: 'logo-check',
    kind: 'fillblank',
    section: 'Your logo',
    title: 'The logo check.',
    subtitle: "You don't need a complicated logo. You need one that passes four questions: easy to read, fits your voice, embodies your vibe, and doesn't need a facelift.",
    estimatedMinutes: 5,
    fields: [
      { id: 'current', label: 'Describe your current logo. Or write "none yet."', placeholder: 'A script wordmark from 2019 with a camera icon.', rows: 2 },
      { id: 'fit', label: 'Run the check: easy to read? Fits your voice? Embodies the vibe you just named? Needs a facelift?', helpText: 'Be honest. A pink script logo marketing to contractors is a disconnect.', placeholder: 'Readable, but the script feels off against "earthy and sharp." Probably needs a refresh.', rows: 3 },
    ],
  },
  {
    id: 'fonts-direction',
    kind: 'pick-3',
    section: 'Your fonts',
    title: 'Pick your font direction.',
    subtitle: "Lisa's structure: a title font with personality, a main font that is VERY easy to read, and an optional supporting font. Pick the trio that fits your vibe.",
    estimatedMinutes: 4,
    maxPicks: 1,
    options: [
      { id: 'editorial-serif', label: 'Editorial serif lead', description: 'Classic serif titles, clean sans body. Timeless, high-end, magazine energy.' },
      { id: 'modern-sans', label: 'Modern sans lead', description: 'Bold sans titles, lighter sans body. Clean, current, confident.' },
      { id: 'serif-script', label: 'Serif with script accent', description: 'Serif titles, sans body, script for small moments. Warm and personal.' },
      { id: 'all-serif', label: 'All serif', description: 'Serif titles and serif body. Literary, established, quiet luxury.' },
      { id: 'sans-serif-flip', label: 'Sans titles, serif body', description: 'Modern headline energy over a classic reading experience. Editorial flip.' },
      { id: 'not-sure', label: 'Not sure yet', description: 'Pick this and your Brand Guide will note font direction as an open decision.' },
    ],
  },
  {
    id: 'visuals-mirror',
    kind: 'ai-mirror',
    section: 'Your visuals',
    title: "Here's the visual identity I'm seeing.",
    subtitle: 'Vibe, color, and type, pulled together. Does it look like you?',
    estimatedMinutes: 3,
  },
  {
    id: 'summary',
    kind: 'mirror',
    section: 'Visuals module',
    title: 'Your Visuals: locked in.',
    subtitle: 'A look you can hand to any designer, or to Lisa.',
    estimatedMinutes: 2,
    mirror: { kind: 'visuals-summary' },
  },
];

// ===========================================================================
// VISIBILITY module (Module Five): platforms, anchor content, pillars, photos.
// Sourced from build-a-brand_workbook-_module_5_vehicle.pdf + Visibility GPT.
// Deliverables: Platform Strategy, Anchor Content, Brand Pillars, Photo
// Checklist, Content Cadence.
// ===========================================================================

export const VISIBILITY_STEPS = [
  {
    id: 'audience-where',
    kind: 'fillblank',
    section: 'Platforms',
    title: 'Where does your ideal client actually hang out?',
    subtitle: "Rough guide: Gen Z lives on TikTok. 25 to 45 lives on Instagram. Business owners live on LinkedIn. 50 plus lives on Facebook. People who want to learn go to YouTube.",
    estimatedMinutes: 4,
    fields: [
      { id: 'where', label: 'Where does your person spend time online, and what are they doing there?', placeholder: 'Instagram in the evenings for inspiration, one or two podcasts on school runs, a couple of newsletters she actually opens.', rows: 3 },
    ],
  },
  {
    id: 'enjoy-words',
    kind: 'wordcloud',
    section: 'Platforms',
    title: 'Tap the platforms and formats you actually enjoy.',
    subtitle: "Consistency beats reach. You will only show up on platforms you don't hate.",
    estimatedMinutes: 3,
    words: PLATFORM_WORDS,
  },
  {
    id: 'platform-craft',
    kind: 'ai-craft',
    section: 'Platforms',
    title: 'Your platform strategy options.',
    subtitle: "Five strategies matching where your person is with what you enjoy. Two to three platforms each, no more. Pick the one you'd actually follow.",
    estimatedMinutes: 5,
    maxPicks: 1,
    generateLabel: 'Write my platform options',
    generateHint: 'About 20 seconds. Five strategies, one sentence each.',
  },
  {
    id: 'anchor-pick',
    kind: 'pick-3',
    section: 'Anchor content',
    title: 'Pick your anchor content.',
    subtitle: "One piece of long-form content each week that you break into bite-sized pieces. Pick something you ENJOY, so you'll do it consistently.",
    estimatedMinutes: 3,
    maxPicks: 1,
    options: [
      { id: 'blog', label: 'Blog', description: 'You like writing. Great for SEO and your website.' },
      { id: 'newsletter', label: 'Email newsletter', description: 'You like writing to real people. You own the list.' },
      { id: 'podcast', label: 'Podcast', description: 'You like talking. Builds deep trust on commutes and school runs.' },
      { id: 'youtube', label: 'YouTube', description: 'You like being on camera. Searchable and evergreen.' },
      { id: 'none-yet', label: 'Not yet', description: 'Start with short-form only. Add an anchor when the rhythm is real.' },
    ],
  },
  {
    id: 'cadence',
    kind: 'fillblank',
    section: 'Rhythm',
    title: 'Find your rhythm.',
    subtitle: "A predictable pattern helps you show up when you aren't feeling creative. Lisa's example: Monday a quote, Wednesday a tip, Friday behind the scenes.",
    estimatedMinutes: 5,
    fields: [
      { id: 'often', label: 'How often can you realistically show up?', helpText: 'Be honest, not aspirational. Consistency beats volume.', placeholder: 'Three posts a week plus one newsletter.', rows: 2 },
      { id: 'rhythm', label: 'Sketch your cadence.', helpText: 'By content type, by day, or both.', placeholder: 'Monday tip, Wednesday client story, Friday behind the scenes. Newsletter every other Thursday.', rows: 3 },
    ],
  },
  {
    id: 'pillars-discovery',
    kind: 'fillblank',
    section: 'Brand pillars',
    title: 'What could you talk about forever?',
    subtitle: "Brand pillars are 3 to 6 buckets you build content around, so you never stare at a blank screen. Generic enough to last, specific enough to be yours.",
    estimatedMinutes: 5,
    fields: [
      { id: 'topics', label: 'What are you knowledgeable about, what does your ideal client want to hear about, and what are you excited to share?', placeholder: 'Brand strategy, pricing confidence, behind the scenes of shoots, mom-life-meets-business, before and afters.', rows: 4 },
    ],
  },
  {
    id: 'pillars-craft',
    kind: 'ai-craft',
    section: 'Brand pillars',
    title: 'Your brand pillar candidates.',
    subtitle: 'Eight pillar candidates built from your brand and your ideal client. Pick 4. Each one can hold months of content.',
    estimatedMinutes: 5,
    maxPicks: 4,
    generateLabel: 'Craft my pillar options',
    generateHint: 'About 20 seconds. Eight buckets with a one-line description each.',
  },
  {
    id: 'photos-3p',
    kind: 'fillblank',
    section: 'Photos',
    title: "The 3 P's of photos.",
    subtitle: "Personalized photos beat stock every time. People can tell stock from a mile away. Three quick lists.",
    estimatedMinutes: 6,
    fields: [
      { id: 'people', label: 'PEOPLE: what photos of the humans in your business do you need?', placeholder: 'Headshots, working-with-client shots, a real laugh, the "note to self" card shot.', rows: 2 },
      { id: 'process', label: 'PROCESS: what photos show how you do what you do?', placeholder: 'Camera in hand, mood boards on the table, the messy middle of a project.', rows: 2 },
      { id: 'product', label: 'PRODUCT or SERVICE: what photos showcase what you sell?', placeholder: 'Finished websites on screens, before and afters, deliverables in real hands.', rows: 2 },
    ],
  },
  {
    id: 'photo-list-craft',
    kind: 'ai-craft',
    section: 'Photos',
    title: 'Your photo checklist.',
    subtitle: "Ten concrete shots built from your answers. Pick the 6 that matter most. Hand this list to your photographer, or to Lisa.",
    estimatedMinutes: 5,
    maxPicks: 6,
    generateLabel: 'Build my shot list',
    generateHint: 'About 20 seconds. Ten specific, shootable images.',
  },
  {
    id: 'summary',
    kind: 'mirror',
    section: 'Visibility module',
    title: 'Your Visibility plan: locked in.',
    subtitle: 'Your Brand Guide is complete. Bring it to life, and bring your questions to monthly Office Hours with Lisa.',
    estimatedMinutes: 2,
    mirror: { kind: 'visibility-summary' },
  },
];

const STEPS_BY_TOOL = {
  vision: VISION_STEPS,
  value: VALUE_STEPS,
  voice: VOICE_STEPS,
  visuals: VISUALS_STEPS,
  visibility: VISIBILITY_STEPS,
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
  const mission = pickedOptionText(journeyResponses, 'mission-craft')
    || journeyResponses['mission-refine']?.fields?.mission_statement || '';
  const vision = pickedOptionText(journeyResponses, 'vision-craft')
    || journeyResponses['vision-refine']?.fields?.vision_statement || '';
  const valuesDefined = Object.values(journeyResponses['values-define']?.fields || {})
    .some((v) => v && String(v).trim());
  const valuesRanked = (journeyResponses['values-rank']?.ranking || []).length > 0;
  return [
    { key: 'mission', label: 'Mission Statement', value: mission, complete: !!mission },
    { key: 'vision', label: 'Vision Statement', value: vision, complete: !!vision },
    { key: 'values', label: 'Core Values', value: '', complete: valuesRanked && valuesDefined },
  ];
}

export function voiceDeliverables(journeyResponses = {}) {
  const ihelp = pickedOptionText(journeyResponses, 'ihelp-craft');
  const threeWords = String(journeyResponses['voice-feel']?.fields?.three_words || '').trim();
  const language = pickedOptionTexts(journeyResponses, 'language-craft');
  const aboutme = pickedOptionText(journeyResponses, 'aboutme-craft');
  return [
    { key: 'ihelp', label: 'I Help Statement', value: ihelp, complete: !!ihelp },
    { key: 'three_words', label: 'Your Voice in Three Words', value: threeWords, complete: !!threeWords },
    { key: 'language', label: 'Common Language', value: language.join(' · '), complete: language.length > 0, items: language },
    { key: 'aboutme', label: 'About Me', value: aboutme, complete: !!aboutme },
  ];
}

export function visualsDeliverables(journeyResponses = {}) {
  const ranked = (journeyResponses['vibe-rank']?.ranking || journeyResponses['vibe-words']?.selected || []).slice(0, 6);
  const vibe = ranked.map((id) => capitalize(wordLabel(id)));
  const palette = pickedOptionText(journeyResponses, 'palette-craft');
  const fonts = pickedStaticLabel('visuals', 'fonts-direction', journeyResponses);
  const logoNotes = String(journeyResponses['logo-check']?.fields?.fit || '').trim();
  return [
    { key: 'vibe', label: 'Brand Vibe', value: vibe.join(' · '), complete: vibe.length > 0, items: vibe },
    { key: 'palette', label: 'Color Direction', value: palette, complete: !!palette },
    { key: 'fonts', label: 'Font Direction', value: fonts, complete: !!fonts },
    { key: 'logo', label: 'Logo Notes', value: logoNotes, complete: !!logoNotes },
  ];
}

export function visibilityDeliverables(journeyResponses = {}) {
  const platform = pickedOptionText(journeyResponses, 'platform-craft');
  const anchor = pickedStaticLabel('visibility', 'anchor-pick', journeyResponses);
  const cadence = String(journeyResponses['cadence']?.fields?.rhythm || '').trim();
  const pillars = pickedOptionTexts(journeyResponses, 'pillars-craft');
  const photos = pickedOptionTexts(journeyResponses, 'photo-list-craft');
  return [
    { key: 'platform', label: 'Platform Strategy', value: platform, complete: !!platform },
    { key: 'anchor', label: 'Anchor Content', value: anchor, complete: !!anchor },
    { key: 'cadence', label: 'Content Cadence', value: cadence, complete: !!cadence },
    { key: 'pillars', label: 'Brand Pillars', value: pillars.join(' · '), complete: pillars.length > 0, items: pillars },
    { key: 'photos', label: 'Photo Checklist', value: photos.join(' · '), complete: photos.length > 0, items: photos },
  ];
}

// Structured Brand Guide content for a tool, built from journey deliverables.
// Returns an array of blocks or null when the tool has no journey data yet
// (callers fall back to the legacy chat summary).
//   { kind: 'statement', label, text }          one big serif statement
//   { kind: 'list', label, items: [text] }      rust-barred list (brag bank)
//   { kind: 'defs', label, items: [{label, text}] }  labeled sub-entries
export function brandGuideEntries(tool, journeyResponses = {}) {
  const r = journeyResponses;
  if (tool === 'vision') {
    const mission = pickedOptionText(r, 'mission-craft') || r['mission-refine']?.fields?.mission_statement || '';
    const vision = pickedOptionText(r, 'vision-craft') || r['vision-refine']?.fields?.vision_statement || '';
    const ranking = (r['values-rank']?.ranking || r['values-tap']?.selected || []).slice(0, 6);
    const defs = r['values-define']?.fields || {};
    const valuesById = Object.fromEntries(VALUE_WORDS.map((w) => [w.id, w.label]));
    const values = ranking
      .map((id) => ({ label: capitalize(valuesById[id] || id), text: String(defs['def_' + id] || '').trim() }))
      .filter((v) => v.label);
    const blocks = [];
    if (mission) blocks.push({ kind: 'statement', label: 'Mission Statement', text: mission });
    if (vision) blocks.push({ kind: 'statement', label: 'Vision Statement', text: vision });
    if (values.length) blocks.push({ kind: 'defs', label: 'Core Values', items: values });
    return blocks.length ? blocks : null;
  }
  if (tool === 'value') {
    const usp = pickedOptionText(r, 'usp-craft');
    const bragOpts = r['brag-bank-craft']?.ai_options || [];
    const brag = (r['brag-bank-craft']?.selected || [])
      .map((id) => bragOpts.find((o) => o.id === id)?.text)
      .filter(Boolean);
    const portrait = pickedOptionText(r, 'portrait-craft');
    const t = r['transformation']?.fields || {};
    const blocks = [];
    if (usp) blocks.push({ kind: 'statement', label: 'Unique Selling Proposition', text: usp });
    if (brag.length) blocks.push({ kind: 'list', label: 'Brag Bank', items: brag });
    if (portrait) blocks.push({ kind: 'statement', label: 'Ideal Client Portrait', text: portrait });
    const tr = [
      { label: 'What they experience', text: String(t.experience || '').trim() },
      { label: 'How they feel after', text: String(t.feel || '').trim() },
      { label: 'The tools that get them there', text: String(t.tools || '').trim() },
      { label: 'What they can do after', text: String(t.capable || '').trim() },
    ].filter((x) => x.text);
    if (tr.length) blocks.push({ kind: 'defs', label: 'Customer Transformation', items: tr });
    return blocks.length ? blocks : null;
  }
  if (tool === 'voice') {
    const d = voiceDeliverables(journeyResponses);
    const blocks = [];
    if (d[0].value) blocks.push({ kind: 'statement', label: 'I Help Statement', text: d[0].value });
    if (d[1].value) blocks.push({ kind: 'statement', label: 'Your Voice in Three Words', text: d[1].value });
    if (d[2].items?.length) blocks.push({ kind: 'list', label: 'Common Language', items: d[2].items });
    if (d[3].value) blocks.push({ kind: 'statement', label: 'About Me', text: d[3].value });
    return blocks.length ? blocks : null;
  }
  if (tool === 'visuals') {
    const d = visualsDeliverables(journeyResponses);
    const blocks = [];
    if (d[0].value) blocks.push({ kind: 'statement', label: 'Brand Vibe', text: d[0].value });
    if (d[1].value) blocks.push({ kind: 'statement', label: 'Color Direction', text: d[1].value });
    const defs = [
      { label: 'Font Direction', text: d[2].value },
      { label: 'Logo Notes', text: d[3].value },
    ].filter((x) => x.text);
    if (defs.length) blocks.push({ kind: 'defs', label: 'Type and Mark', items: defs });
    return blocks.length ? blocks : null;
  }
  if (tool === 'visibility') {
    const d = visibilityDeliverables(journeyResponses);
    const blocks = [];
    if (d[0].value) blocks.push({ kind: 'statement', label: 'Platform Strategy', text: d[0].value });
    const defs = [
      { label: 'Anchor Content', text: d[1].value },
      { label: 'Content Cadence', text: d[2].value },
    ].filter((x) => x.text);
    if (defs.length) blocks.push({ kind: 'defs', label: 'Your Rhythm', items: defs });
    if (d[3].items?.length) blocks.push({ kind: 'list', label: 'Brand Pillars', items: d[3].items });
    if (d[4].items?.length) blocks.push({ kind: 'list', label: 'Photo Checklist', items: d[4].items });
    return blocks.length ? blocks : null;
  }
  return null;
}

// A journey section is truly complete when its deliverables exist, not when
// the user has merely visited the last step. Used by the dashboard status and
// by the API when deciding whether to flip brand_progress.completed.
export function journeyComplete(tool, journeyResponses = {}) {
  if (tool === 'vision') {
    return visionDeliverables(journeyResponses).every((d) => d.complete);
  }
  if (tool === 'value') {
    return valueDeliverables(journeyResponses).every((d) => d.complete);
  }
  if (tool === 'voice') {
    // Three Words rides along with the others; the core three are required.
    const d = voiceDeliverables(journeyResponses);
    return !!(d[0].complete && d[2].complete && d[3].complete);
  }
  if (tool === 'visuals') {
    // Vibe, palette, and fonts are required. Logo notes are optional.
    const d = visualsDeliverables(journeyResponses);
    return !!(d[0].complete && d[1].complete && d[2].complete);
  }
  if (tool === 'visibility') {
    // Platform, pillars, and photo list are required. Anchor and cadence ride along.
    const d = visibilityDeliverables(journeyResponses);
    return !!(d[0].complete && d[3].complete && d[4].complete);
  }
  // Tools without a journey definition fall back to summary-step presence.
  return !!journeyResponses['summary'];
}

// Helper: get the text of the user's picked AI option for a given step.
function pickedOptionText(journeyResponses, stepId) {
  const sel = (journeyResponses[stepId]?.selected || [])[0];
  if (!sel) return '';
  return journeyResponses[stepId]?.ai_options?.find((o) => o.id === sel)?.text || '';
}

// All picked AI option texts for multi-pick craft steps (language bank, pillars, shot list).
function pickedOptionTexts(journeyResponses, stepId) {
  const opts = journeyResponses[stepId]?.ai_options || [];
  return (journeyResponses[stepId]?.selected || [])
    .map((id) => opts.find((o) => o.id === id)?.text)
    .filter(Boolean);
}

// Label of a picked STATIC option (pick-3 steps with hardcoded options).
function pickedStaticLabel(tool, stepId, journeyResponses) {
  const sel = (journeyResponses[stepId]?.selected || [])[0];
  if (!sel) return '';
  const step = getJourneyStep(tool, stepId);
  return step?.options?.find((o) => o.id === sel)?.label || '';
}

export function valueDeliverables(journeyResponses = {}) {
  const bragSel = journeyResponses['brag-bank-craft']?.selected || [];
  const bragOpts = journeyResponses['brag-bank-craft']?.ai_options || [];
  const bragPicked = bragSel.map((id) => bragOpts.find((o) => o.id === id)?.text).filter(Boolean);
  const portrait = pickedOptionText(journeyResponses, 'portrait-craft');
  const usp = pickedOptionText(journeyResponses, 'usp-craft');
  return [
    { key: 'brag_bank', label: 'Brag Bank', value: bragPicked.join(' · '), complete: bragPicked.length > 0, items: bragPicked },
    { key: 'portrait', label: 'Ideal Client Portrait', value: portrait, complete: !!portrait },
    { key: 'usp', label: 'Unique Selling Proposition', value: usp, complete: !!usp },
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
    case 'slider':
      return renderSlider(step, savedResponse);
    case 'mirror':
      return renderMirror(step, journeyResponses);
    case 'ai-mirror':
      return renderAiMirror(step, savedResponse);
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

function renderAiCraft(step, saved /*, journeyResponses */) {
  const cached = saved?.ai_options || [];
  const selected = saved?.selected || [];
  const maxPicks = step.maxPicks || 6;

  const optionsHtml = cached.length ? cached.map((o) => `
    <button type="button" class="ai-option ${selected.includes(o.id) ? 'is-selected' : ''}" data-option-id="${esc(o.id)}">
      <span class="ai-option__text">${esc(o.text)}</span>
      <span class="ai-option__check" aria-hidden="true">✓</span>
    </button>
  `).join('') : '';

  return `<div class="step-body step-body--ai-craft" data-step-kind="ai-craft" data-step-id="${esc(step.id)}" data-max-picks="${maxPicks}">
    <div class="ai-craft__action">
      ${cached.length ? `
        <p class="ai-craft__hint"><span class="step-body__count" data-count>${selected.length}/${maxPicks}</span> picked. Pick ${maxPicks} that feel like you. Tap one to toggle.</p>
        <div class="ai-options" data-ai-options>${optionsHtml}</div>
        <button type="button" class="btn--quiet ai-craft__regen" data-ai-generate>Regenerate options</button>
      ` : `
        <button type="button" class="btn btn--primary btn--lg ai-craft__generate" data-ai-generate>${esc(step.generateLabel || 'Craft these for me')}</button>
        <p class="ai-craft__hint">${esc(step.generateHint || 'I will turn your answers into polished options for you to pick from. This takes about 20 seconds.')}</p>
        <div class="ai-options" data-ai-options></div>
      `}
    </div>
  </div>`;
}

// ---------------------------------------------------------------------------
// ai-mirror: a "here's what I'm hearing" reflection step where the read-back
// is AI-polished (not a raw echo of the user's input). Server checks for a
// cached ai_summary; if missing, renders a loading state and the client JS
// auto-fetches /api/journey/craft to populate.
// ---------------------------------------------------------------------------

function renderAiMirror(step, saved) {
  const summary = saved?.ai_summary || '';
  const hasSummary = !!summary;

  return `<div class="step-body step-body--ai-mirror" data-step-kind="ai-mirror" data-step-id="${esc(step.id)}" data-has-summary="${hasSummary ? '1' : '0'}">
    <div class="mirror-card mirror-card--ai" data-ai-mirror-card>
      ${hasSummary
        ? `<p class="mirror-card__text">${esc(summary)}</p>`
        : `<p class="mirror-card__loading" data-ai-mirror-loading>
            <span class="mirror-card__spinner" aria-hidden="true"></span>
            Reading what you've told me so far...
          </p>`}
    </div>
    ${hasSummary ? `<button type="button" class="btn--quiet ai-mirror__regen" data-ai-generate>Reflect again</button>` : ''}
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
    const ranked = priorRank.length ? priorRank : priorTap;
    fields = ranked.slice(0, 6).map((id) => ({
      id: 'def_' + id,
      label: capitalize(wordLabel(id)),
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
    items = priorSel.map((id) => ({
      id,
      label: capitalize(wordLabel(id)),
      description: '',
    }));
    // Always surface enough items that the narrowing exercise is meaningful.
    // If the user tapped fewer than 8, supplement from the step's own
    // suggestion list (skipping ones they already picked).
    const MIN_RANK_ITEMS = 8;
    const supplement = step.supplement || [];
    if (items.length < MIN_RANK_ITEMS && supplement.length) {
      const have = new Set(items.map((i) => i.id));
      for (const id of supplement) {
        if (items.length >= MIN_RANK_ITEMS) break;
        if (have.has(id)) continue;
        items.push({
          id,
          label: capitalize(wordLabel(id)),
          description: 'Suggested. Drag below the line if it doesn\'t fit.',
        });
        have.add(id);
      }
    }
    // If still nothing (extreme edge case), use the suggestions alone.
    if (!items.length) {
      items = supplement.slice(0, 8).map((id) => ({ id, label: capitalize(wordLabel(id)) }));
    }
  }
  items = items || [];

  // Saved ranking first, then any items the ranking doesn't know about yet.
  // Without this, a user who saved a short ranking (3 taps) comes back and
  // only ever sees those 3, never the supplemented suggestions.
  let order = (saved && Array.isArray(saved.ranking)) ? [...saved.ranking] : items.map((i) => i.id);
  const inOrder = new Set(order);
  for (const item of items) {
    if (!inOrder.has(item.id)) order.push(item.id);
  }
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

// Slider: 1D spectra. Each slider stores 0 to 100 under values[slider.id].
// 50 is the neutral middle; the client reads positions on save.
function renderSlider(step, saved) {
  const values = saved?.values || {};
  return `<div class="step-body step-body--slider" data-step-kind="slider" data-step-id="${esc(step.id)}">
    <p class="step-body__hint">Drag each toward whichever side sounds more like you. The middle is a fine answer too.</p>
    ${(step.sliders || []).map((s) => {
      const v = Number.isFinite(values[s.id]) ? values[s.id] : 50;
      return `<div class="slider-row" data-slider-id="${esc(s.id)}">
        <div class="slider-row__labels">
          <span class="slider-row__left">${esc(s.left)}</span>
          <span class="slider-row__right">${esc(s.right)}</span>
        </div>
        <input type="range" class="slider-row__input" min="0" max="100" step="5" value="${v}" data-slider-input="${esc(s.id)}" aria-label="${esc(s.left)} to ${esc(s.right)}" />
      </div>`;
    }).join('')}
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
        <p class="mirror-row__value">${esc(value || '(blank. Go back to fill this in.)')}</p>
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
      : `<p class="mirror-row__value">(nothing tapped yet. Go back and tap some words.)</p>`;
  } else if (m.kind === 'vision-summary') {
    const mission = pickedOptionText(journeyResponses, 'mission-craft')
      || journeyResponses['mission-refine']?.fields?.mission_statement || '';
    const vision = pickedOptionText(journeyResponses, 'vision-craft')
      || journeyResponses['vision-refine']?.fields?.vision_statement || '';
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
    const portrait = pickedOptionText(journeyResponses, 'portrait-craft');
    const usp = pickedOptionText(journeyResponses, 'usp-craft');
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

  // Module lock-in summaries for Voice, Visuals, Visibility share one shape:
  // each deliverable as a mirror-section, lists as rust-barred items.
  const MODULE_SUMMARIES = {
    'voice-summary': voiceDeliverables,
    'visuals-summary': visualsDeliverables,
    'visibility-summary': visibilityDeliverables,
  };
  if (MODULE_SUMMARIES[m.kind]) {
    const dels = MODULE_SUMMARIES[m.kind](journeyResponses);
    bodyHtml = dels.map((d) => {
      if (d.items && d.items.length) {
        return `<div class="mirror-section">
          <p class="mirror-section__label">${esc(d.label)}</p>
          <ul class="mirror-list">${d.items.map((t) => `<li class="mirror-list__item">${esc(t)}</li>`).join('')}</ul>
        </div>`;
      }
      return `<div class="mirror-section">
        <p class="mirror-section__label">${esc(d.label)}</p>
        <p class="mirror-section__value">${d.value ? esc(d.value) : '<span class="mirror-row__value--muted">(blank)</span>'}</p>
      </div>`;
    }).join('');
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
