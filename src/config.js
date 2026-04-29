// ============================================
// App Configuration — Build a Brand (Lisa Lord)
// Loads config from D1 app_config table, merges over hardcoded defaults.
// Auto-creates app_config on first read.
// Empty config table = app behaves exactly as before (defaults rule).
//
// Customized for lilo-brand-app:
//   - prompts: the 5 V system prompts (Lisa's IP — imported verbatim)
//   - branding: real LiLo color tokens from public/styles.css :root
//   - copy: hero + framework + testimonial copy from pages.js renderLanding()
//   - settings: Anthropic model + token limits used by the chat handler
// ============================================

import { SYSTEM_PROMPTS } from './prompts.js';

// ============================================
// DEFAULTS — Lisa's current values (do not edit casually)
// ============================================
const DEFAULTS = {
  prompts: {
    // The 5 V system prompts. Lisa's voice + framework. Editable in /admin so
    // she can tune wording without a code deploy.
    vision: SYSTEM_PROMPTS.vision,
    value: SYSTEM_PROMPTS.value,
    voice: SYSTEM_PROMPTS.voice,
    visuals: SYSTEM_PROMPTS.visuals,
    visibility: SYSTEM_PROMPTS.visibility,
  },
  branding: {
    app_name: 'Build a Brand',
    tagline: 'A brand with purpose is a brand with power.',
    // LiLo palette — keys map to CSS custom property names in styles.css :root.
    // The landing page config loader sets `--{key}` from these values.
    cream: '#FAF7F2',
    cream_deep: '#F0EBE3',
    ink: '#2B2B2B',
    ink_soft: '#6B6560',
    terracotta: '#AF493B',
    terracotta_d: '#9D4134',
    gold: '#C9A96E',
    gold_d: '#B89555',
    serif: "'Gilda Display', Georgia, 'Times New Roman', serif",
    sans: "'Montserrat', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    logo_url: '',
  },
  copy: {
    // Hero (renderLanding hero section)
    hero_eyebrow: 'Build a Brand · The Course',
    hero_title_line_1: 'A brand with purpose',
    hero_title_line_2: 'is a brand with power.',
    hero_lede: "Five AI-guided sessions with Lisa's brand strategist. One downloadable Brand Guide. Strategic branding that drives revenue, not vibes.",
    hero_cta_primary: 'Get Started',
    hero_cta_signin: 'Sign in',
    hero_cta_continue: 'Continue Building',
    hero_trust: 'A LiLo Photography & Branding course. Built for growing businesses ready to scale.',
    // Framework section
    framework_eyebrow: 'The Framework',
    framework_title: "The 5 V's of Brand Building",
    framework_vision_desc: 'Uncover your mission, vision statement, and the values that will guide every business decision you make.',
    framework_value_desc: 'Discover what makes you irreplaceable: your unique skills, story, and the ideal client who needs exactly what you offer.',
    framework_voice_desc: 'Find the words that sound like you. Build messaging, an "I Help" statement, and copy that converts.',
    framework_visuals_desc: 'Define your brand vibe, color palette, logo direction, and fonts for a visual identity that stops the scroll.',
    framework_visibility_desc: 'Choose where to show up, what content to create, and exactly what photos you need to attract your people.',
    // Meet Lisa section
    meet_eyebrow: 'Meet your strategist',
    meet_title_line_1: "Hey, I'm Lisa.",
    meet_title_line_2: 'My friends call me LiLo.',
    meet_lede: "My superpower is helping business owners feel confident in their branding so they can show up in their marketing and take their business to the next level. I've been doing this for 14 years.",
    meet_para_1: 'This course is the framework I walk every 1:1 client through. The same Vision, Value, Voice, Visuals, and Visibility process. The same questions, the same prompts, the same direct feedback. Now in a format you can do on your time, at your pace, in your kitchen.',
    meet_para_2: "If you've been winging your brand and it's costing you clients, you're in the right place.",
    // How section
    how_title: 'Your AI Brand Strategist, on call.',
    how_lede: "Each session pairs Lisa's framework with a live AI conversation, so you don't just learn. You build. Every answer becomes part of your downloadable Brand Guide.",
    how_step_1_title: 'Work through each V',
    how_step_1_body: 'Answer guided questions with your personal AI brand strategist. Go deep or skip what you know.',
    how_step_2_title: 'Watch your guide build',
    how_step_2_body: 'Every session generates polished deliverables: statements, copy, checklists. All saved to your Brand Guide.',
    how_step_3_title: 'Launch with confidence',
    how_step_3_body: 'Download your complete Brand Guide as a PDF. Your brand foundation, done.',
    // Auth + nav buttons
    signin_button: 'Sign in',
    signup_button: 'Create Account',
  },
  settings: {
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    max_history: 30,
  },
  stripe: {
    public_key: '',
    pricing_table_id: '',
  },
};

// ============================================
// getConfig: load D1 overrides + merge over DEFAULTS
// ============================================
export async function getConfig(env) {
  try {
    const rows = await env.DB.prepare(
      'SELECT category, key, value FROM app_config'
    ).all();

    const config = JSON.parse(JSON.stringify(DEFAULTS));

    for (const row of rows.results) {
      if (!config[row.category]) config[row.category] = {};
      try {
        config[row.category][row.key] = JSON.parse(row.value);
      } catch {
        config[row.category][row.key] = row.value;
      }
    }

    return config;
  } catch (err) {
    if (err.message && err.message.includes('no such table')) {
      try {
        await env.DB.prepare(`CREATE TABLE IF NOT EXISTS app_config (
          key TEXT NOT NULL, value TEXT NOT NULL,
          category TEXT NOT NULL DEFAULT 'general',
          updated_at TEXT DEFAULT (datetime('now')),
          updated_by TEXT DEFAULT '',
          PRIMARY KEY (category, key)
        )`).run();
        await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_config_category ON app_config(category)').run();
      } catch (createErr) {
        console.error('Failed to auto-create app_config:', createErr.message);
      }
    } else {
      console.error('getConfig error:', err.message);
    }
    return JSON.parse(JSON.stringify(DEFAULTS));
  }
}

export function getDefaults() {
  return JSON.parse(JSON.stringify(DEFAULTS));
}

export function injectMemoryVars(prompt, memory = {}) {
  return prompt.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return memory[key] !== undefined ? memory[key] : match;
  });
}

export { DEFAULTS };
