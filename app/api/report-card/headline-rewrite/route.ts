export const runtime = "edge";

import Anthropic from "@anthropic-ai/sdk";
import { scrapeWebsite } from "@/lib/scrape";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are Lisa's AI brand strategist. Given a small business owner's website context (title, description, top headings), identify their PRIMARY hero headline and rewrite ONE stronger version of it.

PICKING THE HEADLINE:
- The user's website may have multiple competing headings. Pick the one that's clearly meant as the hero or primary brand promise.
- If individual heading texts look truncated (e.g., "Take your Brand from"), use the title and description to infer the full hero phrase, or stitch fragments together.
- If you genuinely cannot identify a hero headline (no h1, no useful title, no description), say so clearly instead of inventing one.

REWRITE GUIDELINES:
- Speak to a clearer ideal client
- Name the transformation, not the service
- Sound like Lisa's voice: warm, direct, "Get Seen. Make Money", "Stop treating your brand like a side hustle", "DIY to CEO"
- Short (10 to 14 words max)
- Never uses em dashes (use commas, colons, or split sentences)

Format your response in MARKDOWN exactly like this, no preamble:

**Their headline today:**
> [exact quote OR best reconstruction of their current hero headline]

**A stronger version:**
> [your rewrite]

**Why it works:**
[Two short sentences explaining what changed and why it matters for their messaging. Reference Lisa's brand voice work in passing if natural, but do not push.]`;

export async function POST(req: Request) {
  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400 });
  }
  if (!body.url || typeof body.url !== "string") {
    return new Response(JSON.stringify({ error: "missing_url" }), { status: 400 });
  }

  const scraped = await scrapeWebsite(body.url);
  const candidateHeadings = scraped.headings.filter((h) => h.length <= 200).slice(0, 8);
  if (candidateHeadings.length === 0 && !scraped.title && !scraped.description) {
    return new Response(
      JSON.stringify({
        error: "no_headline",
        message:
          "I couldn't pull enough copy from your site to work with. Try again, or paste your hero headline directly.",
      }),
      { status: 422 }
    );
  }

  const userMessage = `Here's everything I scraped from their site. Identify their primary hero headline (the main brand promise) and rewrite one stronger version.

Page title: ${scraped.title || "(none)"}
Meta description: ${scraped.description || "(none)"}

Top headings on the page (in DOM order, may include nav, hero, section titles all mixed together):
${candidateHeadings.length ? candidateHeadings.map((h, i) => `${i + 1}. ${h}`).join("\n") : "(no useful headings found)"}

Use the title and description to figure out what the hero is really meant to say if individual headings look truncated. If you can reasonably stitch fragments into the intended hero phrase, do that. Then rewrite.`;

  const stream = await client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const enc = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          if (
            chunk.type === "content_block_delta" &&
            chunk.delta.type === "text_delta"
          ) {
            controller.enqueue(enc.encode(chunk.delta.text));
          }
        }
      } catch {
        // ignore
      } finally {
        controller.close();
      }
    },
  });
  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "Cache-Control": "no-cache",
    },
  });
}
