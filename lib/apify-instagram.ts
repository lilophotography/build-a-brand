/* Apify Instagram Profile Scraper integration via raw fetch (Edge runtime safe).
   Lisa needs APIFY_TOKEN in .env.local for the full version. Cost is roughly
   $0.0005 per profile. Without a token, we fall back to public Open Graph
   metadata which gives us bio snippet + profile pic + follower count for a
   basic critique. */

import * as cheerio from "cheerio";

const APIFY_ACTOR = "apify~instagram-profile-scraper";
const APIFY_ENDPOINT = `https://api.apify.com/v2/acts/${APIFY_ACTOR}/run-sync-get-dataset-items`;

export type IgPublicOG = {
  ok: boolean;
  username: string;
  fullName?: string;
  bioSnippet?: string;
  profilePicUrl?: string | null;
  followers?: string | null;
  following?: string | null;
  postsCount?: string | null;
  reason?: "fetch_failed" | "blocked";
};

/* Fetch what's publicly available from Instagram's HTML shell: Open Graph
   metadata plus whatever embedded JSON they leak. Works without any auth or
   third-party service. Limited to bio snippet, profile pic, and basic counts;
   does NOT include grid posts or full bio. */
export async function fetchInstagramPublicOG(handle: string): Promise<IgPublicOG> {
  const username = handle.replace(/^@/, "").trim().toLowerCase();
  if (!username) return { ok: false, username: "", reason: "fetch_failed" };

  const url = `https://www.instagram.com/${encodeURIComponent(username)}/`;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12_000);
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (res.status === 404) return { ok: false, username, reason: "fetch_failed" };
    if (!res.ok) return { ok: false, username, reason: "blocked" };

    const html = await res.text();
    const $ = cheerio.load(html);

    const ogTitle = $('meta[property="og:title"]').attr("content") || "";
    const ogDescription = $('meta[property="og:description"]').attr("content") || "";
    const ogImage = $('meta[property="og:image"]').attr("content") || null;

    // Description format Instagram uses for public profiles, when present:
    // "1,234 Followers, 567 Following, 890 Posts - See Instagram photos and videos from FullName (@handle)"
    // Or the bio text directly. We pull both.
    const followersMatch = ogDescription.match(/([\d.,KM]+)\s+Followers/i);
    const followingMatch = ogDescription.match(/([\d.,KM]+)\s+Following/i);
    const postsMatch = ogDescription.match(/([\d.,KM]+)\s+Posts/i);

    // Pull a bio snippet: text after the dash, OR the part that doesn't look like the stats block.
    const dashIdx = ogDescription.indexOf(" - ");
    const bioSnippet = dashIdx > 0 ? ogDescription.slice(dashIdx + 3).trim() : ogDescription.trim();

    // og:title looks like "FullName (@handle) • Instagram photos and videos"
    const fullNameMatch = ogTitle.match(/^(.*?)\s*\(@/);
    const fullName = fullNameMatch ? fullNameMatch[1].trim() : "";

    if (!ogTitle && !ogDescription && !ogImage) {
      return { ok: false, username, reason: "blocked" };
    }

    return {
      ok: true,
      username,
      fullName,
      bioSnippet,
      profilePicUrl: ogImage,
      followers: followersMatch?.[1] ?? null,
      following: followingMatch?.[1] ?? null,
      postsCount: postsMatch?.[1] ?? null,
    };
  } catch {
    return { ok: false, username, reason: "fetch_failed" };
  }
}

export type IgProfileResult =
  | {
      ok: true;
      username: string;
      fullName: string;
      biography: string;
      profilePicUrl: string | null;
      followers: number | null;
      following: number | null;
      postsCount: number | null;
      isVerified: boolean;
      isPrivate: boolean;
      latestPosts: Array<{ imageUrl: string | null; caption: string }>;
    }
  | { ok: false; reason: "not_configured" | "fetch_failed" | "no_results" | "private" };

export async function fetchInstagramProfile(handle: string): Promise<IgProfileResult> {
  const token = process.env.APIFY_TOKEN;
  if (!token) return { ok: false, reason: "not_configured" };

  const username = handle.replace(/^@/, "").trim().toLowerCase();
  if (!username) return { ok: false, reason: "fetch_failed" };

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 60_000);
  try {
    const res = await fetch(`${APIFY_ENDPOINT}?token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        usernames: [username],
        resultsLimit: 9,
      }),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) return { ok: false, reason: "fetch_failed" };

    const data = (await res.json()) as Array<{
      username?: string;
      fullName?: string;
      biography?: string;
      profilePicUrl?: string;
      profilePicUrlHD?: string;
      followersCount?: number;
      followsCount?: number;
      postsCount?: number;
      verified?: boolean;
      private?: boolean;
      latestPosts?: Array<{ displayUrl?: string; caption?: string }>;
    }>;
    const profile = data[0];
    if (!profile) return { ok: false, reason: "no_results" };
    if (profile.private) return { ok: false, reason: "private" };

    return {
      ok: true,
      username: profile.username || username,
      fullName: profile.fullName || "",
      biography: profile.biography || "",
      profilePicUrl: profile.profilePicUrlHD || profile.profilePicUrl || null,
      followers: profile.followersCount ?? null,
      following: profile.followsCount ?? null,
      postsCount: profile.postsCount ?? null,
      isVerified: !!profile.verified,
      isPrivate: !!profile.private,
      latestPosts: (profile.latestPosts || []).slice(0, 9).map((p) => ({
        imageUrl: p.displayUrl || null,
        caption: (p.caption || "").slice(0, 240),
      })),
    };
  } catch {
    return { ok: false, reason: "fetch_failed" };
  }
}
