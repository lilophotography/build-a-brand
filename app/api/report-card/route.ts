export const runtime = "edge";

import Anthropic from "@anthropic-ai/sdk";
import {
  buildInitialUserMessage,
  getReportCardPrompt,
  MAX_FOLLOWUP_USER_MESSAGES,
  REPORT_CARD_LINKS,
  type ReportTone,
} from "@/lib/report-card-prompt";
import { scrapeWebsite } from "@/lib/scrape";
import { captureSiteScreenshot, fetchScreenshotAsBase64 } from "@/lib/screenshot";
import {
  checkAndRecordReportAttempt,
  getRequestIp,
  recordLead,
} from "@/lib/rate-limit";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS_REPORT = 2048;
const MAX_TOKENS_FOLLOWUP = 1536;

type ChatMessage = { role: "user" | "assistant"; content: string };

type RequestBody = {
  url?: string;
  tone?: ReportTone;
  messages?: ChatMessage[];
  email?: string;
};

function jsonError(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
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

export async function POST(req: Request) {
  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return jsonError(400, { error: "invalid_json" });
  }

  const tone: ReportTone = body.tone === "all-business" ? "all-business" : "big-sister";
  const messages: ChatMessage[] = Array.isArray(body.messages) ? body.messages : [];
  const isInitialRequest = messages.length === 0;

  // Lock-down: count user messages after the initial scraped-content message.
  // The initial message is index 0. Anything beyond MAX_FOLLOWUP_USER_MESSAGES + 1 user
  // messages total triggers the closeout.
  const userMessageCount = messages.filter((m) => m.role === "user").length;
  if (userMessageCount > MAX_FOLLOWUP_USER_MESSAGES + 1) {
    return streamText(
      `Our chat is wrapping up here. Save this report (use the Email or Share buttons above), and let's keep the conversation going where it counts: a free consult call with Lisa.\n\n[Book your free call](${REPORT_CARD_LINKS.bookCall})\n\nShe'll help you take the suggestions you got today and turn them into a real plan for your brand.`
    );
  }

  if (isInitialRequest) {
    if (!body.url || typeof body.url !== "string") {
      return jsonError(400, { error: "missing_url" });
    }

    const ip = getRequestIp(req);
    const rate = await checkAndRecordReportAttempt({ ip, url: body.url });
    if (!rate.allowed) {
      return jsonError(429, {
        error: "rate_limited",
        message:
          "Looks like you've already pulled a Report Card recently. Try again tomorrow, or jump on a free call with Lisa to dig deeper.",
        bookCall: REPORT_CARD_LINKS.bookCall,
      });
    }

    const [scraped, screenshot] = await Promise.all([
      scrapeWebsite(body.url),
      captureSiteScreenshot(body.url).catch(() => ({ ok: false as const })),
    ]);
    if (!scraped.ok && scraped.reason === "fetch_failed") {
      return jsonError(422, {
        error: "fetch_failed",
        message:
          "I had trouble loading that website. Double-check the URL and try again, or paste your homepage copy directly.",
      });
    }
    if (!scraped.ok && scraped.reason === "thin_content") {
      return jsonError(422, {
        error: "thin_content",
        message:
          "Your site uses interactive content I can't read from the outside. Paste your homepage copy in the box that just appeared and I'll work with that.",
        partial: {
          title: scraped.title,
          description: scraped.description,
          headings: scraped.headings,
        },
      });
    }

    const userAgent = req.headers.get("user-agent") || undefined;
    void recordLead({
      email: body.email,
      url: scraped.finalUrl,
      tone,
      ip,
      userAgent,
    });

    const initialUserMessage = buildInitialUserMessage({
      url: scraped.finalUrl,
      scraped: {
        title: scraped.title,
        description: scraped.description,
        headings: scraped.headings,
        bodyText: scraped.bodyText,
        imageCount: scraped.imageCount,
        stockImageHits: scraped.stockImageHits,
        hasContactInfo: scraped.hasContactInfo,
        looksLocal: scraped.looksLocal,
        linkPaths: scraped.linkPaths,
      },
    });

    let screenshotImageBlock:
      | { type: "image"; source: { type: "base64"; media_type: "image/png" | "image/jpeg"; data: string } }
      | null = null;
    let screenshotUrlForClient: string | null = null;
    if (screenshot.ok && screenshot.imageUrl) {
      screenshotUrlForClient = screenshot.imageUrl;
      const bytes = await fetchScreenshotAsBase64(screenshot.imageUrl);
      if (bytes.ok) {
        screenshotImageBlock = {
          type: "image",
          source: {
            type: "base64",
            media_type: bytes.mediaType as "image/png" | "image/jpeg",
            data: bytes.data,
          },
        };
      }
    }

    const userContent = screenshotImageBlock
      ? [
          screenshotImageBlock,
          {
            type: "text" as const,
            text:
              "This is the live screenshot of their website above. Use it to evaluate Visual Identity (cohesion, photo quality, stock vs personal imagery, layout flow, professional polish). Combine it with the scraped text below for the full report.\n\n" +
              initialUserMessage,
          },
        ]
      : initialUserMessage;

    const stream = await client.messages.stream({
      model: MODEL,
      max_tokens: MAX_TOKENS_REPORT,
      system: getReportCardPrompt(tone),
      messages: [
        {
          role: "user",
          content: userContent as unknown as string,
        },
      ],
    });

    return streamClaude(stream, {
      "x-screenshot-url": screenshotUrlForClient || "",
    });
  }

  // Follow-up turn: continue the conversation as-is.
  const systemPrompt = getReportCardPrompt(tone);
  const stream = await client.messages.stream({
    model: MODEL,
    max_tokens: MAX_TOKENS_FOLLOWUP,
    system: systemPrompt,
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  });

  return streamClaude(stream);
}

function streamClaude(
  stream: ReturnType<Anthropic["messages"]["stream"]>,
  extraHeaders: Record<string, string> = {}
): Response {
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
      } catch (err) {
        const msg = err instanceof Error ? err.message : "stream_error";
        controller.enqueue(enc.encode(`\n\n[stream error: ${msg}]`));
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
      "Access-Control-Expose-Headers": "x-screenshot-url",
      ...extraHeaders,
    },
  });
}
