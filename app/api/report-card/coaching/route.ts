export const runtime = "edge";

import Anthropic from "@anthropic-ai/sdk";
import { getCoachingPrompt } from "@/lib/coaching-prompt";
import type { ReportTone } from "@/lib/report-card-prompt";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = "claude-sonnet-4-6";
const MAX_USER_MESSAGES = 6;

type ChatMessage = { role: "user" | "assistant"; content: string };

export async function POST(req: Request) {
  let body: { messages?: ChatMessage[]; tone?: ReportTone; focusArea?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400 });
  }
  const tone: ReportTone = body.tone === "all-business" ? "all-business" : "big-sister";
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const userCount = messages.filter((m) => m.role === "user").length;

  if (userCount > MAX_USER_MESSAGES) {
    return streamText(
      "We've been working hard! This is exactly the kind of momentum that takes off on a real call with Lisa. [Book your free consult here](https://lilophotography.hbportal.co/public/65abf3aff8ee2603601c6158) and let's keep going."
    );
  }

  // For the very first call, prefix the messages with a synthetic opener that
  // sets the focus area. Client passes focusArea on first request only.
  const conversation = [...messages];
  if (conversation.length === 1 && body.focusArea && conversation[0].role === "user") {
    conversation[0] = {
      role: "user",
      content: `I want to focus on this from my report card: ${body.focusArea}\n\n${conversation[0].content}`,
    };
  }

  const stream = await client.messages.stream({
    model: MODEL,
    max_tokens: 768,
    system: getCoachingPrompt(tone),
    messages: conversation,
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

function streamText(text: string): Response {
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(enc.encode(text));
      controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "Cache-Control": "no-cache",
    },
  });
}
