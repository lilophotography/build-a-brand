// API routes (auth-required): chat stream, progress, profile, brand-guide PDF.

import { TOOL_ORDER, buildSystemPrompt } from './prompts.js';
import { getConfig } from './config.js';
import { journeyComplete, wordLabel } from './journey.js';

// ---------- Public dispatch ----------

export async function handleAPI(request, env, url, user) {
  const path = url.pathname;
  const method = request.method;

  if (path === '/api/chat' && method === 'POST') return chat(request, env, user);
  if (path === '/api/progress' && method === 'GET')  return progressGet(env, user);
  if (path === '/api/progress' && method === 'POST') return progressPost(request, env, user);
  if (path === '/api/progress/step' && method === 'POST') return progressStep(request, env, user);
  if (path === '/api/journey/craft' && method === 'POST') return journeyCraft(request, env, user);
  if (path === '/api/profile' && method === 'POST') return profileUpdate(request, env, user);
  if (path === '/api/brand-guide' && method === 'GET') return brandGuide(env, user, url);

  return json({ error: 'Not found' }, 404);
}

// ---------- /api/journey/craft ----------
// Two modes: "options" (returns a list for the user to pick from) and
// "summary" (returns a single polished paragraph the user reads then continues).
// Mode is determined by the preset's `mode` field. Result caches in
// step_progress[step_id].ai_options or .ai_summary.
//
// Body: { tool, step_id, regenerate?: boolean }
async function journeyCraft(request, env, user) {
  if (!user.has_access) return json({ error: 'No active access' }, 402);
  const body = await request.json().catch(() => ({}));
  const { tool, step_id, regenerate } = body || {};
  if (!tool || !step_id) return json({ error: 'Need tool + step_id' }, 400);

  const preset = CRAFT_PRESETS[step_id];
  if (!preset) return json({ error: 'No craft preset for ' + step_id }, 400);
  const mode = preset.mode === 'summary' ? 'summary' : 'options';

  const row = await env.DB.prepare(
    'SELECT step_progress FROM brand_progress WHERE user_id = ? AND tool = ?'
  ).bind(user.id, tool).first();
  let progress = {};
  try { progress = JSON.parse(row?.step_progress || '{}') || {}; } catch { progress = {}; }
  if (!progress.journey_responses) progress.journey_responses = {};

  const existing = progress.journey_responses[step_id];
  if (!regenerate) {
    if (mode === 'options' && existing?.ai_options?.length) {
      return json({ ok: true, mode, options: existing.ai_options, cached: true });
    }
    if (mode === 'summary' && existing?.ai_summary) {
      return json({ ok: true, mode, summary: existing.ai_summary, cached: true });
    }
  }

  // Gather source answers across ALL tools, not just the current one. Step ids
  // are globally unique, and later modules build on earlier ones (Voice reads
  // the mission from Vision and the ideal client from Value).
  const { results: allRows } = await env.DB.prepare(
    'SELECT tool, step_progress FROM brand_progress WHERE user_id = ?'
  ).bind(user.id).all();
  const merged = {};
  for (const r of (allRows || [])) {
    try {
      const sp = JSON.parse(r.step_progress || '{}') || {};
      Object.assign(merged, sp.journey_responses || {});
    } catch {}
  }
  Object.assign(merged, progress.journey_responses);

  const sourceMap = {};
  for (const sid of preset.sources) {
    sourceMap[sid] = merged[sid] || {};
  }
  const userMessage = preset.buildUserMessage(sourceMap);

  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) return json({ error: 'Missing Anthropic key' }, 500);

  const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: mode === 'summary' ? 800 : 1500,
      system: preset.systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });
  if (!aiRes.ok) {
    const errText = await aiRes.text().catch(() => '');
    console.error('Anthropic craft error', aiRes.status, errText);
    return json({ error: 'AI craft failed' }, 502);
  }
  const aiData = await aiRes.json().catch(() => ({}));
  const aiText = (aiData?.content || []).map((c) => c.text || '').join('').trim();

  let result;
  if (mode === 'options') {
    const options = parseCraftedOptions(aiText, preset.count || 6);
    if (!options.length) return json({ error: 'AI returned no options' }, 502);
    progress.journey_responses[step_id] = { ...existing, ai_options: options };
    result = { ok: true, mode, options };
  } else {
    const summary = aiText.replace(/^["']|["']$/g, '');
    if (!summary) return json({ error: 'AI returned no summary' }, 502);
    progress.journey_responses[step_id] = { ...existing, ai_summary: summary };
    result = { ok: true, mode, summary };
  }

  const stepJson = JSON.stringify(progress);
  if (row) {
    await env.DB.prepare(
      "UPDATE brand_progress SET step_progress = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE user_id = ? AND tool = ?"
    ).bind(stepJson, user.id, tool).run();
  } else {
    await env.DB.prepare(
      "INSERT INTO brand_progress (user_id, tool, completed, messages, summary, step_progress) VALUES (?, ?, 0, '[]', NULL, ?)"
    ).bind(user.id, tool, stepJson).run();
  }

  return json(result);
}

// Parse Claude's response into a list of {id, text} options.
// Accepts JSON array of strings, or numbered list ("1. text\n2. text\n").
function parseCraftedOptions(text, max = 10) {
  if (!text) return [];

  // Try JSON first.
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    try {
      const arr = JSON.parse(jsonMatch[0]);
      if (Array.isArray(arr) && arr.length) {
        return arr.slice(0, max).map((item, i) => {
          const t = typeof item === 'string' ? item : (item?.text || item?.phrase || item?.option || JSON.stringify(item));
          return { id: 'c' + i, text: String(t).trim() };
        }).filter(o => o.text);
      }
    } catch {}
  }

  // Fallback: numbered lines.
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const numbered = lines
    .map((l) => l.replace(/^\d+[\.\)]\s*/, '').replace(/^[-*]\s*/, '').trim())
    .filter(Boolean);
  return numbered.slice(0, max).map((t, i) => ({ id: 'c' + i, text: t }));
}

// ---------- Craft presets ----------
// Each preset names the prior steps to read from and builds the user-message
// payload sent to Claude.
//
// Two modes:
//   - default ("options"): preset specifies `count` and returns a list of
//     options for the user to pick from. Used by ai-craft step kind.
//   - mode: 'summary': returns a single polished paragraph. Used by
//     ai-mirror step kind for reading back what we've heard so far.
const CRAFT_PRESETS = {
  'brag-bank-craft': {
    count: 8,
    sources: ['value-prep', 'value-background', 'value-strengths', 'value-results'],
    systemPrompt: `You are Lisa, a brand strategist who pulls a brand out of small business owners. The user has written raw answers about their background, skills, and outcomes. Your job is to distill those answers into a "brag bank": polished, copy-ready confidence phrases the user can paste into a bio, a pitch, a sales page, or use to start a sales call.

Rules:
- Write in the user's voice, first person.
- Each phrase is one sentence, max 18 words.
- Capture a specific strength, an earned credibility, or a real outcome. Not generic.
- Sound like a real person, not marketing copy. No buzzwords, no hedging, no em dashes.
- Fix any obvious typos or grammar mistakes from the user's input. Make it sharp.
- Each phrase should make the user feel a small jolt of confidence reading it.

Return exactly 8 phrases as a JSON array of strings. No commentary, no preamble. Example output:
["I have spent twelve years learning how brands actually work, not just how they look.", "My clients come back because I treat their business like it's mine.", ...]`,
    buildUserMessage(s) {
      const opener = s['value-prep']?.fields?.opener || '';
      const edu = s['value-background']?.fields?.education || '';
      const prof = s['value-background']?.fields?.professional || '';
      const life = s['value-background']?.fields?.life || '';
      const strengths = s['value-strengths']?.fields?.strengths || '';
      const compliments = s['value-strengths']?.fields?.compliments || '';
      const results = s['value-results']?.fields?.results || '';
      return `What I secretly know I am great at:
${opener || '(blank)'}

My education and training:
${edu || '(blank)'}

My professional experience:
${prof || '(blank)'}

Life experiences that shaped me:
${life || '(blank)'}

My specific skills:
${strengths || '(blank)'}

What people compliment me on:
${compliments || '(blank)'}

Real outcomes I have created:
${results || '(blank)'}

Now distill these into 8 brag bank phrases. Return as JSON array.`;
    },
  },

  'portrait-craft': {
    count: 4,
    sources: ['dream-intro', 'dream-demographics', 'dream-beliefs', 'dream-external', 'dream-internal', 'dream-where'],
    systemPrompt: `You are Lisa, a brand strategist who pulls a real person out of dream-customer answers. The user has written raw answers about their ideal client. Your job is to draft 4 ideal-client-portrait paragraphs they can paste into a brand guide or sales page.

Rules:
- Each portrait is 3 to 5 sentences. A real specific person.
- Use the user's own words and details. Don't invent new facts.
- One portrait reads cleanly demographics-first. One reads empathy-first (lead with how she feels). One reads contrast-shaped (looks successful but...). One reads structured (one sentence per dimension).
- Fix any obvious typos, sharpen vague language. No buzzwords. No em dashes.
- Each portrait should make the user say "yes, that's her."

Return exactly 4 portraits as a JSON array of strings. No commentary.`,
    buildUserMessage(s) {
      const excites = s['dream-intro']?.fields?.excites || '';
      const dem = s['dream-demographics']?.fields || {};
      const beliefs = s['dream-beliefs']?.fields?.beliefs || '';
      const external = s['dream-external']?.fields?.external || '';
      const internal = s['dream-internal']?.fields?.internal || '';
      const spaces = s['dream-where']?.fields?.spaces || '';
      return `Who excites me to work with: ${excites || '(blank)'}

Demographics:
- Age: ${dem.age || '(blank)'}
- Stage of life: ${dem.stage || '(blank)'}
- Location: ${dem.location || '(blank)'}
- Income: ${dem.income || '(blank)'}

Their beliefs and what they care about:
${beliefs || '(blank)'}

External (surface) problem they're trying to solve:
${external || '(blank)'}

Internal (under-the-surface) problem driving them:
${internal || '(blank)'}

Where they spend time:
${spaces || '(blank)'}

Now draft 4 portrait paragraphs as a JSON array.`;
    },
  },

  'mission-craft': {
    count: 10,
    sources: ['warmup-origin', 'mission-discovery', 'brand-reflection'],
    systemPrompt: `You are Lisa, a brand strategist. The user has answered questions about why they started, what they do, who they help, and how those people change. Your job is to write 10 candidate mission statements they could claim as their own.

Rules:
- One or two sentences each. First person.
- Use the user's actual specifics. Fix all typos and grammar. Sharpen vague language.
- Style guide, Lisa's own mission: "I partner with small business owners to create a compelling brand so they confidently stand out in the crowded world of online marketing without feeling overwhelmed."
- Vary the angles: direct, collaborative, pain-relief, transformation-led, permission-giving, tribe-shaped, hindsight-shaped, process-shaped, contrast-shaped, stripped-down.
- No buzzwords, no em dashes, no hedging. Plain confident English.
- Each should sound like a real person saying it out loud, not a corporate plaque.

Return exactly 10 mission statements as a JSON array of strings. No commentary.`,
    buildUserMessage(s) {
      const o = s['warmup-origin']?.fields || {};
      const m = s['mission-discovery']?.fields || {};
      const r = s['brand-reflection']?.fields || {};
      return `Why they started: ${o.why_started || '(blank)'}
What they were doing before: ${o.before || '(blank)'}
What they do: ${m.what || '(blank)'}
Who they help: ${m.who || '(blank)'}
How those people change: ${m.how || '(blank)'}
Their business's personality: ${r.personality || '(blank)'}
What they want customers to remember: ${r.memory || '(blank)'}

Write 10 mission statement candidates as a JSON array.`;
    },
  },

  'vision-craft': {
    count: 10,
    sources: ['vision-discovery', 'warmup-goals', 'vision-archetype', 'vision-words', 'mission-craft'],
    systemPrompt: `You are Lisa, a brand strategist. The user has locked in a mission statement and answered questions about the long-term impact they want to have. Your job is to write 10 candidate vision statements.

Rules:
- One sentence each. Big-picture, long-term, inspiring to the USER first.
- Style guide, Lisa's own vision: "For every small business owner to have a brand that they feel proud of and confident in, and to do so with encouragement and integrity."
- Use their actual impact language, archetype, and tapped words. Fix typos. Sharpen.
- Vary angles: for-every framing, a-world-where framing, raise-the-standard framing, liberation framing, legacy framing, stripped-down declaration.
- No buzzwords, no em dashes. Plain moving English, not grandiose.

Return exactly 10 vision statements as a JSON array of strings. No commentary.`,
    buildUserMessage(s) {
      const impact = s['vision-discovery']?.fields?.impact || '';
      const g = s['warmup-goals']?.fields || {};
      const archetype = (s['vision-archetype']?.selected || [])[0] || '';
      const words = (s['vision-words']?.selected || []).join(', ');
      const missionSel = (s['mission-craft']?.selected || [])[0];
      const mission = s['mission-craft']?.ai_options?.find((o) => o.id === missionSel)?.text || '';
      return `The impact they want to have: ${impact || '(blank)'}
Their long-term goal: ${g.long_term || '(blank)'}
What life looks like when it works: ${g.life || '(blank)'}
Their archetype: ${archetype || '(blank)'}
Words that orbit their vision: ${words || '(blank)'}
Their mission statement: ${mission || '(blank)'}

Write 10 vision statement candidates as a JSON array.`;
    },
  },

  // ---------- ai-mirror summaries ----------

  'value-mirror': {
    mode: 'summary',
    sources: ['value-prep', 'value-background', 'value-strengths', 'value-results'],
    systemPrompt: `You are Lisa, a brand strategist. The user just answered five questions about what makes them valuable: their background, their skills, what people compliment them on, and real outcomes they've created.

Your job is to write back a polished 3-to-5 sentence summary that reflects what you heard, in their voice, but tighter and more confident than they could write it themselves. Use their actual specifics. Fix any typos or grammar. No buzzwords, no em dashes, no hedging.

The tone is warm, direct, almost-impressed. The user should read this and feel slightly seen. Lead with the most striking thing about them, then bring in the rest.

Return ONLY the polished summary as plain text. No commentary, no headers, no quotes.`,
    buildUserMessage(s) {
      const opener = s['value-prep']?.fields?.opener || '';
      const edu = s['value-background']?.fields?.education || '';
      const prof = s['value-background']?.fields?.professional || '';
      const life = s['value-background']?.fields?.life || '';
      const strengths = s['value-strengths']?.fields?.strengths || '';
      const compliments = s['value-strengths']?.fields?.compliments || '';
      const results = s['value-results']?.fields?.results || '';
      return `Here's everything the user told me:

What they secretly know they are great at: ${opener || '(blank)'}
Education: ${edu || '(blank)'}
Professional: ${prof || '(blank)'}
Life experiences that shaped them: ${life || '(blank)'}
Their specific skills: ${strengths || '(blank)'}
What people compliment them on: ${compliments || '(blank)'}
Real outcomes from their work: ${results || '(blank)'}

Write a 3-to-5 sentence reflection summary.`;
    },
  },

  'dream-mirror': {
    mode: 'summary',
    sources: ['dream-intro', 'dream-demographics', 'dream-beliefs', 'dream-external', 'dream-internal', 'dream-where'],
    systemPrompt: `You are Lisa, a brand strategist. The user just answered seven questions about their ideal client: who excites them, demographics, beliefs, external problems, internal problems, where this person spends time.

Your job is to write back a polished 3-to-5 sentence "here's the person I'm seeing" summary. Synthesize their answers into a real human you can picture. In the user's voice but tighter. Fix typos. No buzzwords, no em dashes.

Tone: like Lisa describing a client she just understood for the first time. Specific. Empathetic. A little surprising. The user should read this and say "yes, that's her."

Return ONLY the polished summary as plain text. No commentary, no headers, no quotes.`,
    buildUserMessage(s) {
      const excites = s['dream-intro']?.fields?.excites || '';
      const dem = s['dream-demographics']?.fields || {};
      const beliefs = s['dream-beliefs']?.fields?.beliefs || '';
      const external = s['dream-external']?.fields?.external || '';
      const internal = s['dream-internal']?.fields?.internal || '';
      const spaces = s['dream-where']?.fields?.spaces || '';
      return `Here's what the user told me about her ideal client:

Who excites her to work with: ${excites || '(blank)'}
Age: ${dem.age || '(blank)'}, Stage: ${dem.stage || '(blank)'}, Location: ${dem.location || '(blank)'}, Income: ${dem.income || '(blank)'}
Their beliefs: ${beliefs || '(blank)'}
External problem: ${external || '(blank)'}
Internal problem: ${internal || '(blank)'}
Where they show up: ${spaces || '(blank)'}

Write a 3-to-5 sentence reflection summary.`;
    },
  },

  'warmup-mirror': {
    mode: 'summary',
    sources: ['warmup-origin', 'warmup-goals', 'warmup-stuck'],
    systemPrompt: `You are Lisa, a brand strategist. The user just answered seven warmup questions about themselves: why they started, what they did before, their short-term and long-term goals, what life looks like when this is working, the obstacle they keep hitting, and what feels just out of reach.

Your job is to write back a polished 3-to-5 sentence "here's what I'm hearing about you so far" reflection. Their voice, but tighter and more grounded. Fix typos. No buzzwords, no em dashes.

Tone: like a smart friend who just listened well. Warm, specific, slightly grounding. The user should feel seen.

Return ONLY the polished summary as plain text. No commentary, no headers, no quotes.`,
    buildUserMessage(s) {
      const o = s['warmup-origin']?.fields || {};
      const g = s['warmup-goals']?.fields || {};
      const st = s['warmup-stuck']?.fields || {};
      return `Why they started: ${o.why_started || '(blank)'}
What they were doing before: ${o.before || '(blank)'}
Short-term goal: ${g.short_term || '(blank)'}
Long-term goal: ${g.long_term || '(blank)'}
Life when it is working: ${g.life || '(blank)'}
The obstacle they keep hitting: ${st.obstacle || '(blank)'}
The gap they wish they could close: ${st.gap || '(blank)'}

Write a 3-to-5 sentence reflection summary.`;
    },
  },

  'mission-mirror': {
    mode: 'summary',
    sources: ['mission-discovery'],
    systemPrompt: `You are Lisa, a brand strategist. The user just answered three questions about their work: what they do, who they help, and how those people are different after working with them.

Your job is to write back a polished 2-to-3 sentence "here's the work I'm seeing" reflection. In their voice but tighter. Fix typos. No buzzwords, no em dashes.

Tone: confident, specific, makes them feel that they know what they do better than they realized. The user should read this and feel a small jolt of clarity.

Return ONLY the polished summary as plain text. No commentary, no headers, no quotes.`,
    buildUserMessage(s) {
      const m = s['mission-discovery']?.fields || {};
      return `What they do: ${m.what || '(blank)'}
Who they help: ${m.who || '(blank)'}
How those people change: ${m.how || '(blank)'}

Write a 2-to-3 sentence reflection summary.`;
    },
  },

  'mission-vision-mirror': {
    mode: 'summary',
    sources: ['mission-craft', 'vision-craft'],
    systemPrompt: `You are Lisa, a brand strategist. The user just locked in their mission statement and their vision statement. Your job is to write a short polished reflection that holds them side by side.

Write 2-to-3 sentences that:
- Acknowledge both statements as a working pair
- Name the connection between them (mission = the work, vision = the world they're building)
- Sound proud, not grandiose

Fix typos. No buzzwords, no em dashes. Return ONLY the reflection as plain text.`,
    buildUserMessage(s) {
      const missionSel = (s['mission-craft']?.selected || [])[0];
      const mission = s['mission-craft']?.ai_options?.find((o) => o.id === missionSel)?.text || '';
      const visionSel = (s['vision-craft']?.selected || [])[0];
      const vision = s['vision-craft']?.ai_options?.find((o) => o.id === visionSel)?.text || '';
      return `Their mission: ${mission || '(blank)'}
Their vision: ${vision || '(blank)'}

Write a 2-to-3 sentence reflection.`;
    },
  },

  'values-mirror': {
    mode: 'summary',
    sources: ['values-principles', 'values-tap'],
    systemPrompt: `You are Lisa, a brand strategist. The user just wrote out their non-negotiable business principles in plain language, then tapped a bunch of value words.

Your job is to write a polished 2-to-3 sentence reflection that names what you're seeing. Find the through-line. The combination of principles and words tells you something.

Tone: like a friend who has been listening. Specific. Not generic. Fix typos. No buzzwords, no em dashes.

Return ONLY the reflection as plain text.`,
    buildUserMessage(s) {
      const principles = s['values-principles']?.fields?.principles || '';
      const tapped = s['values-tap']?.selected || [];
      return `Their principles in plain language:
${principles || '(blank)'}

Words they tapped (${tapped.length} total): ${tapped.join(', ') || '(none)'}

Write a 2-to-3 sentence reflection. Find the through-line.`;
    },
  },

  // ---------- Voice module ----------

  'voice-mirror': {
    mode: 'summary',
    sources: ['voice-feel', 'voice-sliders', 'voice-words', 'mission-craft'],
    systemPrompt: `You are Lisa, a brand strategist. The user just described how they want their words to feel, set four tone sliders, and tapped voice words. Write back a 3-to-4 sentence "here's the voice I'm hearing" reflection.

Name the voice like a real thing: its warmth, its edge, where it sits between casual and formal. Ground it in their choices. Fix typos. No buzzwords, no em dashes. The user should read it out loud and say "that's me on a good day."

Return ONLY the reflection as plain text.`,
    buildUserMessage(s) {
      const f = s['voice-feel']?.fields || {};
      const v = s['voice-sliders']?.values || {};
      const dial = (val, left, right) => {
        const n = Number.isFinite(val) ? val : 50;
        if (n <= 35) return 'leans ' + left;
        if (n >= 65) return 'leans ' + right;
        return 'balanced between ' + left + ' and ' + right;
      };
      const words = (s['voice-words']?.selected || []).map((id) => wordLabel(id)).join(', ');
      const missionSel = (s['mission-craft']?.selected || [])[0];
      const mission = s['mission-craft']?.ai_options?.find((o) => o.id === missionSel)?.text || '';
      return `How they want readers to feel: ${f.feel || '(blank)'}
Three words for their voice: ${f.three_words || '(blank)'}
Tone dials: ${dial(v.formality, 'formal', 'casual')}; ${dial(v.edge, 'gentle', 'bold')}; ${dial(v.era, 'classic', 'modern')}; ${dial(v.volume, 'quiet', 'loud')}
Voice words they tapped: ${words || '(none)'}
Their mission: ${mission || '(blank)'}

Write a 3-to-4 sentence voice reflection.`;
    },
  },

  'ihelp-craft': {
    count: 10,
    sources: ['ihelp-discovery', 'mission-craft', 'usp-craft', 'dream-internal', 'voice-feel'],
    systemPrompt: `You are Lisa, a brand strategist. Write 10 candidate "I Help" statements for the user.

Lisa's formula: "I help ___ by doing ___" or "I help ___ because ___". Her own examples as the style bar: "I help business owners build brands that are beautiful and bankable." "I help people break through their out of date brand."

Rules:
- One sentence each, first person, under 20 words.
- Use the user's actual who / what / why. Fix typos. Sharpen.
- Vary the angles: by-doing, because, transformation, contrast, permission, hindsight.
- Punchy and sayable out loud at a dinner party. No buzzwords, no em dashes.

Return exactly 10 as a JSON array of strings. No commentary.`,
    buildUserMessage(s) {
      const d = s['ihelp-discovery']?.fields || {};
      const missionSel = (s['mission-craft']?.selected || [])[0];
      const mission = s['mission-craft']?.ai_options?.find((o) => o.id === missionSel)?.text || '';
      const uspSel = (s['usp-craft']?.selected || [])[0];
      const usp = s['usp-craft']?.ai_options?.find((o) => o.id === uspSel)?.text || '';
      const internal = s['dream-internal']?.fields?.internal || '';
      return `Who they help: ${d.who || '(blank)'}
What they do for them: ${d.doing || '(blank)'}
Why it matters: ${d.why || '(blank)'}
Their mission: ${mission || '(blank)'}
Their USP: ${usp || '(blank)'}
Their client's internal struggle: ${internal || '(blank)'}

Write 10 I Help statements as a JSON array.`;
    },
  },

  'language-craft': {
    count: 10,
    sources: ['language-discovery', 'voice-feel', 'voice-words', 'ihelp-craft'],
    systemPrompt: `You are Lisa, a brand strategist. Build the user a "common language bank": 10 short, catchy, copy-ready phrases in their voice. These get reused on their website, captions, emails, and sales calls so everything sounds aligned.

Style bar, Lisa's own bank: "Level Up. Your Face Makes You Money. Stand Out. Captivating. Confident."

Rules:
- Each phrase is 2 to 7 words. Punchy. Sayable.
- Build from the user's own phrases and their client's own words. Fix typos, keep their DNA.
- Mix types: a couple of rally cries, a couple of client-truth phrases, a couple of alliterated building blocks, a couple of quiet confident ones.
- Avoid every word on their jargon-to-avoid list. No buzzwords, no em dashes.

Return exactly 10 phrases as a JSON array of strings. No commentary.`,
    buildUserMessage(s) {
      const l = s['language-discovery']?.fields || {};
      const f = s['voice-feel']?.fields || {};
      const words = (s['voice-words']?.selected || []).map((id) => wordLabel(id)).join(', ');
      const ihelpSel = (s['ihelp-craft']?.selected || [])[0];
      const ihelp = s['ihelp-craft']?.ai_options?.find((o) => o.id === ihelpSel)?.text || '';
      return `Phrases they already use: ${l.phrases || '(blank)'}
Their client's own words about the problem: ${l.client_words || '(blank)'}
Jargon to avoid: ${l.jargon || '(none listed)'}
Their voice in three words: ${f.three_words || '(blank)'}
Voice words: ${words || '(none)'}
Their I Help statement: ${ihelp || '(blank)'}

Write 10 common-language phrases as a JSON array.`;
    },
  },

  'aboutme-craft': {
    count: 3,
    sources: ['aboutme-discovery', 'dream-internal', 'voice-feel', 'ihelp-craft'],
    systemPrompt: `You are Lisa, a brand strategist. Write 3 candidate About Me paragraphs using Lisa's flip-the-script rule: it is not really about the user, it is about the transformation. They once struggled with the same internal problems their ideal client has now; they found the other side; that is why they do this work.

Lisa's style bar for the flip: instead of "I grew up with a camera in my hand," say "When my grandma died I was so sad that I couldn't find a single picture of the two of us together. That is why I am passionate about family photos."

Rules:
- Each is one paragraph, 4 to 6 sentences, first person.
- Open with the struggle or the moment, not the credentials.
- Land on how this connects to what they do for clients now.
- Warm and human, not performative. Fix typos. No buzzwords, no em dashes.
- Vary the three: one moment-led, one struggle-led, one conviction-led.

Return exactly 3 paragraphs as a JSON array of strings. No commentary.`,
    buildUserMessage(s) {
      const a = s['aboutme-discovery']?.fields || {};
      const internal = s['dream-internal']?.fields?.internal || '';
      const feel = s['voice-feel']?.fields?.feel || '';
      return `Their old struggle (same as their client's): ${a.struggle || '(blank)'}
The turning point: ${a.turning || '(blank)'}
The other side, and how it connects to their work: ${a.thriving || '(blank)'}
Their ideal client's internal problem: ${internal || '(blank)'}
How they want readers to feel: ${feel || '(blank)'}

Write 3 About Me paragraphs as a JSON array.`;
    },
  },

  // ---------- Visuals module ----------

  'palette-craft': {
    count: 6,
    sources: ['colors-compass', 'colors-love', 'vibe-rank', 'vibe-words', 'visuals-inspiration'],
    systemPrompt: `You are Lisa, a brand strategist. Write 6 color palette DIRECTIONS for the user using Lisa's formula: 1 to 3 main colors, plus a dark neutral, a light neutral, and a metallic accent.

Rules:
- Plain color words, not hex codes. "Clay rust and deep olive, anchored by charcoal, softened with cream, with brushed gold accents."
- One sentence each, under 25 words.
- Honor their compass (warm or cool, neutral or colorful, dark or light) and the colors they said they love.
- Stay inside one color family per direction so everything complements.
- Vary the six: two close to exactly what they described, two adjacent surprises, one quieter, one braver.
- No em dashes.

Return exactly 6 directions as a JSON array of strings. No commentary.`,
    buildUserMessage(s) {
      const v = s['colors-compass']?.values || {};
      const dial = (val, left, right) => {
        const n = Number.isFinite(val) ? val : 50;
        if (n <= 35) return left;
        if (n >= 65) return right;
        return 'between ' + left + ' and ' + right;
      };
      const vibe = (s['vibe-rank']?.ranking || s['vibe-words']?.selected || []).slice(0, 6).map((id) => wordLabel(id)).join(', ');
      return `Compass: ${dial(v.temp, 'warm', 'cool')}, ${dial(v.saturation, 'neutral', 'colorful')}, ${dial(v.lightness, 'dark', 'light')}
Colors they love and why: ${s['colors-love']?.fields?.colors || '(blank)'}
Their brand vibe words: ${vibe || '(blank)'}
Brands whose look they love: ${s['visuals-inspiration']?.fields?.brands || '(blank)'}
How they want theirs to feel: ${s['visuals-inspiration']?.fields?.yours || '(blank)'}

Write 6 palette directions as a JSON array.`;
    },
  },

  'visuals-mirror': {
    mode: 'summary',
    sources: ['vibe-rank', 'vibe-words', 'visuals-inspiration', 'colors-love', 'palette-craft', 'logo-check', 'fonts-direction'],
    systemPrompt: `You are Lisa, a brand strategist. The user just defined their brand vibe, picked a color direction, ran a logo check, and chose a font direction. Write a 3-to-4 sentence "here's the visual identity I'm seeing" reflection that pulls it into one coherent picture.

Make it feel like a look they can see: how the vibe, colors, and type sit together. If their logo notes say it needs a refresh, name that plainly as the next step, not a failure. Fix typos. No buzzwords, no em dashes.

Return ONLY the reflection as plain text.`,
    buildUserMessage(s) {
      const vibe = (s['vibe-rank']?.ranking || s['vibe-words']?.selected || []).slice(0, 6).map((id) => wordLabel(id)).join(', ');
      const palSel = (s['palette-craft']?.selected || [])[0];
      const palette = s['palette-craft']?.ai_options?.find((o) => o.id === palSel)?.text || '';
      const fonts = (s['fonts-direction']?.selected || [])[0] || '';
      const logo = s['logo-check']?.fields || {};
      return `Brand vibe words: ${vibe || '(blank)'}
Color direction they picked: ${palette || '(blank)'}
Font direction id they picked: ${fonts || '(blank)'} (editorial-serif = serif titles + sans body; modern-sans = all sans; serif-script = serif + script accent; all-serif; sans-serif-flip = sans titles + serif body; not-sure)
Current logo: ${logo.current || '(blank)'}
Their logo check: ${logo.fit || '(blank)'}
How they want it all to feel: ${s['visuals-inspiration']?.fields?.yours || '(blank)'}

Write a 3-to-4 sentence visual identity reflection.`;
    },
  },

  // ---------- Visibility module ----------

  'platform-craft': {
    count: 5,
    sources: ['audience-where', 'enjoy-words', 'dream-where', 'portrait-craft'],
    systemPrompt: `You are Lisa, a brand strategist. Write 5 candidate platform strategies. Each names 2 to 3 platforms maximum and says what the user does there, matched to where their ideal client is AND what the user enjoys making. Consistency beats reach: never recommend a platform they would dread.

Rules:
- One sentence each, under 28 words. Concrete. "Instagram for daily presence, a biweekly newsletter you own, Pinterest on autopilot for search."
- Vary the five: one lean two-platform version, one that leans into their favorite format, one search-led, one owned-audience-led, one stretch option.
- No buzzwords, no em dashes.

Return exactly 5 strategies as a JSON array of strings. No commentary.`,
    buildUserMessage(s) {
      const enjoy = (s['enjoy-words']?.selected || []).map((id) => wordLabel(id)).join(', ');
      const portraitSel = (s['portrait-craft']?.selected || [])[0];
      const portrait = s['portrait-craft']?.ai_options?.find((o) => o.id === portraitSel)?.text || '';
      return `Where their ideal client hangs out: ${s['audience-where']?.fields?.where || '(blank)'}
Where they said their client spends time (from Value): ${s['dream-where']?.fields?.spaces || '(blank)'}
Platforms and formats the user enjoys: ${enjoy || '(none tapped)'}
Their ideal client portrait: ${portrait || '(blank)'}

Write 5 platform strategies as a JSON array.`;
    },
  },

  'pillars-craft': {
    count: 8,
    sources: ['pillars-discovery', 'mission-craft', 'usp-craft', 'ihelp-craft', 'dream-internal'],
    systemPrompt: `You are Lisa, a brand strategist. Write 8 candidate brand pillars: content buckets the user builds everything around so they never stare at a blank screen. Generic enough to hold months of content, specific enough to be unmistakably theirs.

Rules:
- Format each as "Pillar name: one-line description." Name is 1 to 4 words.
- Build from what they know, what their client wants to hear, and what they are excited to share.
- Mix: expertise pillars, client-transformation pillars, behind-the-scenes or personal pillars, and one point-of-view pillar (their contrarian take).
- No buzzwords, no em dashes.

Return exactly 8 as a JSON array of strings. No commentary.`,
    buildUserMessage(s) {
      const missionSel = (s['mission-craft']?.selected || [])[0];
      const mission = s['mission-craft']?.ai_options?.find((o) => o.id === missionSel)?.text || '';
      const internal = s['dream-internal']?.fields?.internal || '';
      return `What they know, what their client wants, what excites them: ${s['pillars-discovery']?.fields?.topics || '(blank)'}
Their mission: ${mission || '(blank)'}
Their client's internal struggle: ${internal || '(blank)'}

Write 8 brand pillars as a JSON array.`;
    },
  },

  'photo-list-craft': {
    count: 10,
    sources: ['photos-3p', 'vibe-rank', 'platform-craft'],
    systemPrompt: `You are Lisa, a brand photographer and strategist. Turn the user's 3 P's answers into 10 concrete, shootable images for their brand shoot list. Personalized photos beat stock every time.

Rules:
- Each is one specific shot a photographer could set up from the description alone. "Hands on the keyboard with the client's mood board blurred behind" not "working photos."
- Cover all three P's: people, process, product or service. Include at least one detail shot and one personality shot.
- Match their brand vibe.
- Under 18 words each. No buzzwords, no em dashes.

Return exactly 10 shots as a JSON array of strings. No commentary.`,
    buildUserMessage(s) {
      const p = s['photos-3p']?.fields || {};
      const vibe = (s['vibe-rank']?.ranking || []).slice(0, 6).map((id) => wordLabel(id)).join(', ');
      const platSel = (s['platform-craft']?.selected || [])[0];
      const platform = s['platform-craft']?.ai_options?.find((o) => o.id === platSel)?.text || '';
      return `PEOPLE shots they need: ${p.people || '(blank)'}
PROCESS shots they need: ${p.process || '(blank)'}
PRODUCT/SERVICE shots they need: ${p.product || '(blank)'}
Their brand vibe: ${vibe || '(blank)'}
Their platform strategy: ${platform || '(blank)'}

Write 10 concrete shots as a JSON array.`;
    },
  },

  'usp-craft': {
    count: 5,
    sources: ['mission-discovery', 'brag-bank-craft', 'dream-intro', 'dream-internal'],
    systemPrompt: `You are Lisa, a brand strategist. The user has finished their mission discovery, a brag bank of confidence phrases, and an ideal-client portrait. Your job is to write 5 candidate Unique Selling Proposition (USP) statements they could put on their homepage, headline, or pitch.

Rules:
- One sentence each. Under 22 words.
- Each USP names WHO they serve and what specific transformation or outcome they deliver, with one differentiating edge that no one else in the user's space typically claims.
- Lead with the assertion. No "we help" hedges. Active voice.
- Sound like the user's mission and brag bank, not generic marketing.
- No em dashes. No buzzwords (synergy, holistic, empowerment, journey). Plain English.
- The five candidates should differ in angle: one tight and direct, one warm and human, one bold and contrarian, one outcomes-led, one identity-led.

Return exactly 5 USP candidates as a JSON array of strings. No commentary.`,
    buildUserMessage(s) {
      const what = s['mission-discovery']?.fields?.what || '';
      const who = s['mission-discovery']?.fields?.who || '';
      const how = s['mission-discovery']?.fields?.how || '';
      const bragSel = s['brag-bank-craft']?.selected || [];
      const bragOpts = s['brag-bank-craft']?.ai_options || [];
      const bragPicked = bragSel.map((id) => bragOpts.find((o) => o.id === id)?.text).filter(Boolean);
      const excites = s['dream-intro']?.fields?.excites || '';
      const internal = s['dream-internal']?.fields?.internal || '';
      return `Mission discovery:
- What I do: ${what || '(blank)'}
- Who I help: ${who || '(blank)'}
- How they change: ${how || '(blank)'}

My brag bank (the confidence phrases I picked):
${bragPicked.length ? bragPicked.map((p, i) => `${i + 1}. ${p}`).join('\n') : '(none picked yet)'}

The type of client that excites me most:
${excites || '(blank)'}

What my ideal client feels internally:
${internal || '(blank)'}

Now write 5 USP candidates as a JSON array.`;
    },
  },
};

// ---------- /api/progress/step ----------
// Records a single step event for a (user, tool) pair into brand_progress.step_progress
// (a JSON column). Idempotent per video; first-write wins for timestamps.
//
// Accepted payloads:
//   { tool: 'vision', op: 'video', value: 'xyz123' }                              → adds 'xyz123' to step_progress.videos_watched
//   { tool: 'vision', op: 'workbook' }                                            → sets step_progress.workbook_downloaded_at = now
//   { tool: 'vision', op: 'chat_started' }                                        → sets step_progress.chat_started_at = now (if unset)
//   { tool: 'vision', op: 'journey_response', value: { step_id, response } }      → sets step_progress.journey_responses[step_id] = response
async function progressStep(request, env, user) {
  if (!user.has_access) return json({ error: 'No active access' }, 402);
  const body = await request.json().catch(() => ({}));
  const { tool, op, value } = body || {};
  const VALID_TOOLS = ['vision', 'value', 'voice', 'visuals', 'visibility'];
  if (!VALID_TOOLS.includes(tool)) return json({ error: 'Invalid tool' }, 400);
  if (!['video', 'workbook', 'chat_started', 'journey_response'].includes(op)) return json({ error: 'Invalid op' }, 400);

  // Read existing row (or absent → {}). Auto-create the brand_progress row if missing.
  const row = await env.DB.prepare(
    'SELECT step_progress FROM brand_progress WHERE user_id = ? AND tool = ?'
  ).bind(user.id, tool).first();

  let progress = {};
  try { progress = JSON.parse(row?.step_progress || '{}') || {}; } catch { progress = {}; }
  if (!Array.isArray(progress.videos_watched)) progress.videos_watched = [];
  if (!progress.journey_responses || typeof progress.journey_responses !== 'object') progress.journey_responses = {};

  const now = new Date().toISOString();
  if (op === 'video') {
    if (!value || typeof value !== 'string') return json({ error: 'video op needs a string value' }, 400);
    if (!progress.videos_watched.includes(value)) progress.videos_watched.push(value);
  } else if (op === 'workbook') {
    if (!progress.workbook_downloaded_at) progress.workbook_downloaded_at = now;
  } else if (op === 'chat_started') {
    if (!progress.chat_started_at) progress.chat_started_at = now;
  } else if (op === 'journey_response') {
    if (!value || typeof value !== 'object') return json({ error: 'journey_response op needs object value' }, 400);
    const { step_id, response } = value;
    if (!step_id || typeof step_id !== 'string') return json({ error: 'journey_response needs step_id' }, 400);
    progress.journey_responses[step_id] = response || {};
    progress.journey_last_step_id = step_id;
    progress.journey_updated_at = now;
  }

  const stepJson = JSON.stringify(progress);

  // completed=1 only when the section's actual deliverables exist (mission,
  // vision, defined values, brag bank, portrait, USP, transformation). Merely
  // visiting the summary step no longer counts. Gates the Brand Guide and
  // coaching unlocks honestly.
  const isComplete = op === 'journey_response'
    && journeyComplete(tool, progress.journey_responses);

  if (row) {
    if (isComplete) {
      await env.DB.prepare(
        "UPDATE brand_progress SET step_progress = ?, completed = 1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE user_id = ? AND tool = ?"
      ).bind(stepJson, user.id, tool).run();
    } else {
      await env.DB.prepare(
        "UPDATE brand_progress SET step_progress = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE user_id = ? AND tool = ?"
      ).bind(stepJson, user.id, tool).run();
    }
  } else {
    await env.DB.prepare(
      "INSERT INTO brand_progress (user_id, tool, completed, messages, summary, step_progress) VALUES (?, ?, ?, '[]', NULL, ?)"
    ).bind(user.id, tool, isComplete ? 1 : 0, stepJson).run();
  }

  return json({ ok: true, step_progress: progress, completed: isComplete });
}

// ---------- /api/chat ----------
// Streams Claude responses as plain text. Client appends decoded chunks to the
// rendered transcript. We do NOT persist messages here - the client posts to
// /api/progress after each completed exchange.

async function chat(request, env, user) {
  if (!user.has_access) return json({ error: 'No active access. Please complete checkout first.' }, 402);

  const { messages, tool } = await request.json().catch(() => ({}));
  if (!tool || !TOOL_ORDER.includes(tool)) return json({ error: 'Invalid tool' }, 400);
  if (!Array.isArray(messages)) return json({ error: 'Bad messages' }, 400);

  // Load admin-editable config (prompts, model, max_tokens). Falls back to
  // hardcoded DEFAULTS when the app_config table is empty.
  const config = await getConfig(env);
  const systemPrompt = buildSystemPrompt(tool, user, config);
  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) return json({ error: 'Server misconfigured: missing Anthropic key' }, 500);

  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: config?.settings?.model || 'claude-sonnet-4-6',
      max_tokens: config?.settings?.max_tokens || 2048,
      stream: true,
      system: systemPrompt,
      messages: messages.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: String(m.content || ''),
      })),
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const errText = await upstream.text().catch(() => '');
    console.error('Anthropic error', upstream.status, errText);
    return json({ error: 'AI request failed' }, 502);
  }

  // Stream SSE -> plain text deltas to the client
  const { readable, writable } = new TransformStream();
  pipeAnthropicSSEToText(upstream.body, writable);

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

async function pipeAnthropicSSEToText(sourceStream, writableStream) {
  const writer = writableStream.getWriter();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const reader = sourceStream.getReader();

  let buf = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });

      // SSE events are separated by blank lines
      let idx;
      while ((idx = buf.indexOf('\n\n')) !== -1) {
        const block = buf.slice(0, idx);
        buf = buf.slice(idx + 2);

        for (const line of block.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (!data || data === '[DONE]') continue;
          try {
            const ev = JSON.parse(data);
            if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') {
              await writer.write(encoder.encode(ev.delta.text));
            }
          } catch {
            // Ignore malformed event lines
          }
        }
      }
    }
  } catch (err) {
    console.error('SSE pipe error', err);
  } finally {
    try { await writer.close(); } catch {}
  }
}

// ---------- /api/progress ----------

async function progressGet(env, user) {
  const { results } = await env.DB.prepare(
    'SELECT tool, completed, summary, messages, step_progress, updated_at FROM brand_progress WHERE user_id = ?'
  ).bind(user.id).all();
  // Parse step_progress JSON for client convenience.
  const out = (results || []).map(r => {
    let sp = {};
    try { sp = JSON.parse(r.step_progress || '{}') || {}; } catch {}
    return { ...r, step_progress: sp };
  });
  return json(out);
}

async function progressPost(request, env, user) {
  const body = await request.json().catch(() => ({}));
  const { tool, messages, completed, summary } = body;
  if (!TOOL_ORDER.includes(tool)) return json({ error: 'Invalid tool' }, 400);

  const messagesStr = JSON.stringify(Array.isArray(messages) ? messages : []);
  const completedFlag = completed ? 1 : 0;
  const summaryVal = (typeof summary === 'string' && summary.trim()) ? summary.trim() : null;

  await env.DB.prepare(
    `INSERT INTO brand_progress (user_id, tool, messages, completed, summary, updated_at)
     VALUES (?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
     ON CONFLICT(user_id, tool) DO UPDATE SET
       messages = excluded.messages,
       completed = excluded.completed,
       summary = COALESCE(excluded.summary, brand_progress.summary),
       updated_at = excluded.updated_at`
  ).bind(user.id, tool, messagesStr, completedFlag, summaryVal).run();

  return json({ ok: true });
}

// ---------- /api/profile ----------
// Used by the onboarding form. Sets first_name, business_name, website, marks onboarded=1.
// Also used to mark welcomed=1 once they dismiss the Lisa letter page.

async function profileUpdate(request, env, user) {
  const body = await request.json().catch(() => ({}));
  const { first_name, business_name, website, mark_onboarded, mark_welcomed } = body;

  const sets = [];
  const binds = [];

  if (typeof first_name === 'string')   { sets.push('first_name = ?');    binds.push(first_name.trim() || null); }
  if (typeof business_name === 'string'){ sets.push('business_name = ?'); binds.push(business_name.trim() || null); }
  if (typeof website === 'string')      { sets.push('website = ?');       binds.push(normalizeUrl(website)); }
  if (mark_onboarded) sets.push('onboarded = 1');
  if (mark_welcomed)  sets.push('welcomed = 1');
  sets.push("last_active_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')");

  if (sets.length === 0) return json({ ok: true }); // nothing to do

  const sql = `UPDATE users SET ${sets.join(', ')} WHERE id = ?`;
  binds.push(user.id);
  await env.DB.prepare(sql).bind(...binds).run();

  return json({ ok: true });
}

function normalizeUrl(s) {
  const v = (s || '').trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  return `https://${v}`;
}

// ---------- /api/brand-guide ----------
// Renders the user's current Brand Guide as a PDF using Cloudflare Browser Rendering.
// We render one of OUR own pages (/brand-guide/print) inside a headless browser
// and capture as PDF. The print page is server-rendered, so the user's data is
// already inlined in the HTML when the browser visits it.

async function brandGuide(env, user, url) {
  if (!user.has_access) return json({ error: 'No active access' }, 402);

  // Cloudflare Browser Rendering: managed REST endpoint.
  // Docs: https://developers.cloudflare.com/browser-rendering/
  // We call the same Worker's print page with a one-time signed token so the
  // headless browser can render an authenticated page.
  const printToken = await mintPrintToken(env, user.id);
  // Use the origin the user actually hit. APP_URL points at a custom domain
  // that was never attached, so the headless browser could not reach it.
  const origin = url ? url.origin : (env.APP_URL || 'https://build-a-brand-app.lilophotography.workers.dev');
  const printUrl = `${origin}/brand-guide/print?t=${printToken}`;

  // The BROWSER binding's REST API: we POST a /pdf request with { url }
  const upstream = await env.BROWSER.fetch('https://browser.do/pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: printUrl,
      pdf: {
        format: 'A4',
        printBackground: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' },
      },
      gotoOptions: { waitUntil: 'networkidle0', timeout: 30000 },
    }),
  });

  if (!upstream.ok) {
    const errText = await upstream.text().catch(() => '');
    console.error('Browser Rendering error', upstream.status, errText);
    return json({ error: 'PDF generation failed' }, 502);
  }

  const pdf = await upstream.arrayBuffer();
  return new Response(pdf, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="Next-Level-Brand-Guide.pdf"',
      'Cache-Control': 'no-store',
    },
  });
}

// One-time signed token for the print page. Stored in KV with 60s TTL, single-use.
async function mintPrintToken(env, userId) {
  const token = crypto.randomUUID();
  await env.SESSIONS.put(`pt:${token}`, userId, { expirationTtl: 60 });
  return token;
}

export async function consumePrintToken(env, token) {
  if (!token) return null;
  const userId = await env.SESSIONS.get(`pt:${token}`);
  if (userId) await env.SESSIONS.delete(`pt:${token}`);
  return userId;
}

// ---------- Helpers ----------

function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}
