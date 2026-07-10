import * as cheerio from "cheerio";

export type ScrapeResult = {
  ok: boolean;
  reason?: "fetch_failed" | "thin_content" | "blocked";
  url: string;
  finalUrl: string;
  title: string;
  description: string;
  headings: string[];
  bodyText: string;
  imageCount: number;
  stockImageHits: string[];
  hasContactInfo: boolean;
  looksLocal: boolean;
  linkPaths: string[];
};

const MAX_BODY_CHARS = 8000;
const MIN_USEFUL_CHARS = 500;
const FETCH_TIMEOUT_MS = 12_000;

const STOCK_DOMAINS = [
  "unsplash.com",
  "pexels.com",
  "shutterstock.com",
  "istockphoto.com",
  "gettyimages",
  "adobe.stock",
  "depositphotos",
  "dreamstime",
];

const PHONE_RE = /(?:\+?\d[\s\-.]?){9,}\d/;
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const ZIP_RE = /\b\d{5}(?:-\d{4})?\b/;
const STATE_RE = /\b(?:AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\b/;

export function normalizeUrl(input: string): string | null {
  let raw = (input || "").trim();
  if (!raw) return null;
  if (!/^https?:\/\//i.test(raw)) raw = "https://" + raw;
  try {
    const u = new URL(raw);
    if (!u.hostname.includes(".")) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export async function scrapeWebsite(rawUrl: string): Promise<ScrapeResult> {
  const url = normalizeUrl(rawUrl);
  const empty: ScrapeResult = {
    ok: false,
    url: rawUrl,
    finalUrl: rawUrl,
    title: "",
    description: "",
    headings: [],
    bodyText: "",
    imageCount: 0,
    stockImageHits: [],
    hasContactInfo: false,
    looksLocal: false,
    linkPaths: [],
  };
  if (!url) return { ...empty, reason: "fetch_failed" };

  let html = "";
  let finalUrl = url;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; LiLoReportCard/1.0; +https://photolilo.com/website-report-card)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: ctrl.signal,
      redirect: "follow",
    });
    clearTimeout(t);
    finalUrl = res.url || url;
    if (!res.ok) {
      return { ...empty, finalUrl, reason: res.status === 403 ? "blocked" : "fetch_failed" };
    }
    html = await res.text();
  } catch {
    return { ...empty, finalUrl, reason: "fetch_failed" };
  }

  const $ = cheerio.load(html);

  const title = ($("title").first().text() || "").trim();
  const description =
    ($('meta[name="description"]').attr("content") ||
      $('meta[property="og:description"]').attr("content") ||
      "").trim();

  const headings: string[] = [];
  $("h1, h2, h3").each((_: number, el: cheerio.Element) => {
    const txt = $(el).text().replace(/\s+/g, " ").trim();
    if (txt && txt.length < 220) headings.push(txt);
  });

  $("script, style, noscript, svg").remove();
  const bodyRaw = $("body").text() || $.root().text();
  const bodyText = bodyRaw.replace(/\s+/g, " ").trim().slice(0, MAX_BODY_CHARS);

  const imgs = $("img");
  const imageCount = imgs.length;
  const stockHitsSet = new Set<string>();
  imgs.each((_: number, el: cheerio.Element) => {
    const src = ($(el).attr("src") || "").toLowerCase();
    const alt = ($(el).attr("alt") || "").toLowerCase();
    for (const d of STOCK_DOMAINS) {
      if (src.includes(d)) stockHitsSet.add(d);
    }
    if (/\bstock photo|stock image\b/.test(alt)) stockHitsSet.add("alt-text");
  });
  const stockImageHits = Array.from(stockHitsSet);

  const fullText = `${title} ${description} ${bodyText}`;
  const hasContactInfo = PHONE_RE.test(fullText) || EMAIL_RE.test(fullText);
  const looksLocal =
    STATE_RE.test(fullText) || ZIP_RE.test(fullText) || /\b(?:serving|based in|located in|near)\b/i.test(fullText);

  const linkPathsSet = new Set<string>();
  $("a[href]").each((_: number, el: cheerio.Element) => {
    const href = $(el).attr("href") || "";
    try {
      if (href.startsWith("/") && href.length < 60) linkPathsSet.add(href);
      else {
        const u = new URL(href, finalUrl);
        if (u.hostname === new URL(finalUrl).hostname && u.pathname.length < 60) {
          linkPathsSet.add(u.pathname);
        }
      }
    } catch {
      // ignore bad hrefs
    }
  });
  const linkPaths = Array.from(linkPathsSet);

  if (bodyText.length < MIN_USEFUL_CHARS) {
    return {
      ok: false,
      reason: "thin_content",
      url: rawUrl,
      finalUrl,
      title,
      description,
      headings,
      bodyText,
      imageCount,
      stockImageHits,
      hasContactInfo,
      looksLocal,
      linkPaths,
    };
  }

  return {
    ok: true,
    url: rawUrl,
    finalUrl,
    title,
    description,
    headings,
    bodyText,
    imageCount,
    stockImageHits,
    hasContactInfo,
    looksLocal,
    linkPaths,
  };
}
