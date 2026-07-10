export const runtime = "edge";

import Anthropic from "@anthropic-ai/sdk";
import { fetchInstagramProfile, fetchInstagramPublicOG } from "@/lib/apify-instagram";
import { fetchLinkedInPublicProfile } from "@/lib/linkedin";
import {
  getInstagramPrompt,
  getLinkedInPrompt,
} from "@/lib/social-prompts";
import { fetchScreenshotAsBase64 } from "@/lib/screenshot";
import type { ReportTone } from "@/lib/report-card-prompt";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = "claude-sonnet-4-6";

type Body = {
  platform?: "instagram" | "linkedin";
  handle?: string; // for instagram
  url?: string; // for linkedin
  pastedBio?: string; // optional: user pastes bio/headline directly, used as fallback
  tone?: ReportTone;
};

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return jsonError(400, { error: "invalid_json" });
  }

  const tone: ReportTone = body.tone === "all-business" ? "all-business" : "big-sister";
  if (body.platform === "instagram") {
    return handleInstagram(body.handle || "", body.pastedBio || "", tone);
  }
  if (body.platform === "linkedin") {
    return handleLinkedIn(body.url || "", body.pastedBio || "", tone);
  }
  return jsonError(400, { error: "missing_platform" });
}

async function handleInstagram(handle: string, pastedBio: string, tone: ReportTone) {
  // If user pasted bio text, critique that directly without trying to scrape.
  if (pastedBio.trim()) {
    return streamPastedBio({
      platform: "Instagram",
      pastedBio: pastedBio.trim(),
      handle: handle.trim(),
      tone,
    });
  }
  if (!handle.trim()) {
    return jsonError(400, { error: "missing_handle", message: "Paste your Instagram handle (without the @) and I'll take a look." });
  }
  const profile = await fetchInstagramProfile(handle);
  if (!profile.ok) {
    if (profile.reason === "not_configured") {
      // Apify isn't set up. Try public Open Graph metadata as a free fallback.
      const og = await fetchInstagramPublicOG(handle);
      if (og.ok) {
        return streamPublicIgCritique({ og, tone });
      }
      return jsonError(422, {
        error: "ig_blocked_no_apify",
        message:
          "I couldn't read your Instagram profile from the public web (Instagram blocks server-side reads). Paste your IG bio in the box below and I'll critique that instead.",
      });
    }
    if (profile.reason === "private") {
      return jsonError(422, {
        error: "ig_private",
        message:
          "Your Instagram is private, so I can't see what visitors see. Switch to public temporarily, then try again.",
      });
    }
    if (profile.reason === "no_results") {
      return jsonError(422, {
        error: "ig_not_found",
        message: "I couldn't find that handle on Instagram. Double-check the spelling.",
      });
    }
    return jsonError(502, {
      error: "ig_fetch_failed",
      message: "Couldn't reach Instagram right now. Try again in a moment.",
    });
  }

  // Fetch profile pic + up to 6 grid images as base64 for Claude vision.
  const imageUrls = [
    profile.profilePicUrl,
    ...profile.latestPosts.map((p) => p.imageUrl).filter(Boolean),
  ]
    .filter((u): u is string => !!u)
    .slice(0, 7);

  const imageBlocks: Array<{
    type: "image";
    source: { type: "base64"; media_type: "image/png" | "image/jpeg"; data: string };
  }> = [];
  for (const u of imageUrls) {
    const b = await fetchScreenshotAsBase64(u);
    if (b.ok) {
      imageBlocks.push({
        type: "image",
        source: {
          type: "base64",
          media_type: b.mediaType as "image/png" | "image/jpeg",
          data: b.data,
        },
      });
    }
  }

  const promptText = `Here is what I scraped from their Instagram (@${profile.username}):

NAME: ${profile.fullName}
BIO: ${profile.biography || "(empty)"}
FOLLOWERS: ${profile.followers ?? "unknown"}
POSTS COUNT: ${profile.postsCount ?? "unknown"}
VERIFIED: ${profile.isVerified ? "yes" : "no"}

Recent post captions (in order, most recent first):
${profile.latestPosts.map((p, i) => `${i + 1}. ${p.caption || "(no caption)"}`).join("\n") || "(no captions visible)"}

The first image attached is their profile picture. The remaining images are their recent posts shown as a grid.

Please write the critique now.`;

  const userContent =
    imageBlocks.length > 0
      ? ([...imageBlocks, { type: "text" as const, text: promptText }] as unknown as string)
      : promptText;

  const stream = await client.messages.stream({
    model: MODEL,
    max_tokens: 1024,
    system: getInstagramPrompt(tone),
    messages: [{ role: "user", content: userContent }],
  });
  return streamClaude(stream);
}

async function handleLinkedIn(url: string, pastedBio: string, tone: ReportTone) {
  // If user pasted headline/bio text, critique that directly.
  if (pastedBio.trim()) {
    return streamPastedBio({
      platform: "LinkedIn",
      pastedBio: pastedBio.trim(),
      handle: url.trim(),
      tone,
    });
  }
  if (!url.trim()) {
    return jsonError(400, {
      error: "missing_url",
      message: "Paste your LinkedIn profile URL and I'll take a quick look.",
    });
  }
  const profile = await fetchLinkedInPublicProfile(url);
  if (!profile.ok) {
    if (profile.reason === "blocked" || profile.reason === "fetch_failed") {
      return jsonError(422, {
        error: "li_blocked",
        message:
          "LinkedIn blocks profile views from outside the platform. Paste your headline and the first paragraph of your About section in the text box below, and I'll critique those instead.",
      });
    }
    if (profile.reason === "invalid_url") {
      return jsonError(400, {
        error: "li_invalid_url",
        message: "That doesn't look like a LinkedIn URL. Try linkedin.com/in/yourname.",
      });
    }
    return jsonError(502, {
      error: "li_fetch_failed",
      message: "Couldn't reach LinkedIn right now. Paste your headline and About copy in the text box below and I'll work with those.",
    });
  }

  const promptText = `Here is what I could see on their public LinkedIn:

NAME: ${profile.name || "(unknown)"}
HEADLINE: ${profile.headline || "(empty)"}
ABOUT (first paragraph if visible): ${profile.description || "(not visible to public viewers)"}
HAS PROFILE PHOTO: ${profile.photoUrl ? "yes" : "no"}

Please write the critique now.`;

  const stream = await client.messages.stream({
    model: MODEL,
    max_tokens: 1024,
    system: getLinkedInPrompt(tone),
    messages: [{ role: "user", content: promptText }],
  });
  return streamClaude(stream);
}

/* Critique an Instagram profile using only the public Open Graph metadata
   (bio snippet, profile pic, follower count). No Apify required. Limited to
   bio + profile photo categories; can't see grid/posts. */
async function streamPublicIgCritique(args: {
  og: import("@/lib/apify-instagram").IgPublicOG;
  tone: ReportTone;
}) {
  if (!args.og.ok) {
    return jsonError(502, {
      error: "ig_fetch_failed",
      message: "Couldn't reach Instagram. Try again in a moment.",
    });
  }

  const imageBlocks: Array<{
    type: "image";
    source: { type: "base64"; media_type: "image/png" | "image/jpeg"; data: string };
  }> = [];
  if (args.og.profilePicUrl) {
    const b = await fetchScreenshotAsBase64(args.og.profilePicUrl);
    if (b.ok) {
      imageBlocks.push({
        type: "image",
        source: {
          type: "base64",
          media_type: b.mediaType as "image/png" | "image/jpeg",
          data: b.data,
        },
      });
    }
  }

  const promptText = `Here's what I could pull from the public Instagram profile (@${args.og.username}):

NAME: ${args.og.fullName || "(unknown)"}
BIO SNIPPET (first ~150 chars only, public Open Graph):
${args.og.bioSnippet || "(empty)"}

FOLLOWERS: ${args.og.followers ?? "unknown"}
POSTS COUNT: ${args.og.postsCount ?? "unknown"}

The first attached image (if present) is their profile picture.

Important: I can't see their grid or recent post images from a public fetch. Critique what you DO have:
- Bio Clarity (using the bio snippet)
- Profile Photo (using the image)
- Brand-name signal (using their full name + handle)

Skip Visual Cohesion, Content Mix, and Brand Match-for-grid. Be honest that this is a partial critique because I can only see what Instagram shows publicly.`;

  const userContent =
    imageBlocks.length > 0
      ? ([...imageBlocks, { type: "text" as const, text: promptText }] as unknown as string)
      : promptText;

  const stream = await client.messages.stream({
    model: MODEL,
    max_tokens: 1024,
    system: getInstagramPrompt(args.tone),
    messages: [{ role: "user", content: userContent }],
  });
  return streamClaude(stream);
}

/* Critique pasted bio/headline text directly without scraping.
   Used as a fallback when scraping fails (LinkedIn always, Instagram without
   Apify), and as a primary path when the user wants to just paste copy. */
async function streamPastedBio(args: {
  platform: "Instagram" | "LinkedIn";
  pastedBio: string;
  handle: string;
  tone: ReportTone;
}) {
  const isInstagram = args.platform === "Instagram";
  const platformPrompt = isInstagram
    ? `${getInstagramPrompt(args.tone)}\n\nNOTE: You only have the user's pasted bio text. You CANNOT see their grid, post photos, follower count, or recent captions. Skip categories that require visuals (Visual Cohesion, Content Mix, Brand Match for visuals). Focus on Bio Clarity and what the bio reveals about their Voice and Value. Be honest that this is a partial critique.`
    : `${getLinkedInPrompt(args.tone)}\n\nNOTE: The user pasted their headline and possibly About copy. Critique what they gave you, focused on Headline Strength and About Opening. Skip Profile Photo if not described.`;

  const userMessage = `Here is what they pasted from their ${args.platform}${args.handle ? ` (${args.handle})` : ""}:

${args.pastedBio}

Please write the critique.`;

  const stream = await client.messages.stream({
    model: MODEL,
    max_tokens: 1024,
    system: platformPrompt,
    messages: [{ role: "user", content: userMessage }],
  });
  return streamClaude(stream);
}

function streamClaude(stream: ReturnType<Anthropic["messages"]["stream"]>): Response {
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

function jsonError(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
