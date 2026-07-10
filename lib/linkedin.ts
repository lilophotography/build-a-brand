/* Lightweight LinkedIn public-profile reader. LinkedIn aggressively blocks
   unauthenticated scraping, so we only pull what's available via Open Graph
   metadata (headline, profile photo, name). Anything richer than that requires
   a logged-in scrape (out of scope for v1). */

import * as cheerio from "cheerio";

export type LinkedInPublicProfile =
  | {
      ok: true;
      name: string;
      headline: string;
      photoUrl: string | null;
      description: string;
    }
  | { ok: false; reason: "blocked" | "fetch_failed" | "invalid_url" };

const TIMEOUT_MS = 10_000;

export async function fetchLinkedInPublicProfile(rawUrl: string): Promise<LinkedInPublicProfile> {
  let url = rawUrl.trim();
  if (!url) return { ok: false, reason: "invalid_url" };
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, reason: "invalid_url" };
  }
  if (!/linkedin\.com$/i.test(parsed.hostname.replace(/^www\./, ""))) {
    return { ok: false, reason: "invalid_url" };
  }

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const res = await fetch(parsed.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; LiLoReportCard/1.0; +https://photolilo.com/website-report-card)",
        Accept: "text/html",
      },
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (res.status === 403 || res.status === 999) {
      return { ok: false, reason: "blocked" };
    }
    if (!res.ok) return { ok: false, reason: "fetch_failed" };
    const html = await res.text();
    const $ = cheerio.load(html);

    const title =
      $('meta[property="og:title"]').attr("content") ||
      $("title").first().text() ||
      "";
    const description =
      $('meta[property="og:description"]').attr("content") ||
      $('meta[name="description"]').attr("content") ||
      "";
    const photoUrl = $('meta[property="og:image"]').attr("content") || null;

    // og:title on LinkedIn looks like "Lisa Jefferson | LinkedIn"
    const cleanedName = title.replace(/\s*[\|\-]\s*LinkedIn.*$/i, "").trim();
    const headline = description.split(/(?<=\.)\s/)[0] || description;

    return {
      ok: true,
      name: cleanedName,
      headline,
      photoUrl,
      description,
    };
  } catch {
    return { ok: false, reason: "fetch_failed" };
  }
}
