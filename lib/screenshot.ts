/* Site screenshot service. Defaults to Microlink's free public endpoint
   (no API key needed for ~50 requests/day). If MICROLINK_API_KEY or URLBOX_KEY
   is set later, swap providers without touching call sites. */

const MICROLINK_PUBLIC = "https://api.microlink.io/";

export type SiteScreenshot = {
  ok: boolean;
  imageUrl?: string;
  width?: number;
  height?: number;
  reason?: "fetch_failed" | "no_image" | "timeout";
};

const TIMEOUT_MS = 15_000;

export async function captureSiteScreenshot(siteUrl: string): Promise<SiteScreenshot> {
  const params = new URLSearchParams({
    url: siteUrl,
    screenshot: "true",
    meta: "false",
    "viewport.width": "1280",
    "viewport.height": "800",
    waitUntil: "domcontentloaded",
  });
  const apiKey = process.env.MICROLINK_API_KEY;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (apiKey) headers["x-api-key"] = apiKey;

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const res = await fetch(`${MICROLINK_PUBLIC}?${params.toString()}`, {
      headers,
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) {
      return { ok: false, reason: "fetch_failed" };
    }
    const data = (await res.json()) as {
      status?: string;
      data?: { screenshot?: { url?: string; width?: number; height?: number } };
    };
    const imageUrl = data.data?.screenshot?.url;
    if (!imageUrl) {
      return { ok: false, reason: "no_image" };
    }
    return {
      ok: true,
      imageUrl,
      width: data.data?.screenshot?.width,
      height: data.data?.screenshot?.height,
    };
  } catch (err) {
    const reason = (err as Error)?.name === "AbortError" ? "timeout" : "fetch_failed";
    return { ok: false, reason };
  }
}

/* Fetch the screenshot bytes and base64 encode for inline use as an image
   block in the Anthropic API. Keeps the screenshot URL out of the LLM payload. */
export async function fetchScreenshotAsBase64(
  imageUrl: string
): Promise<{ ok: true; mediaType: string; data: string } | { ok: false }> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const res = await fetch(imageUrl, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return { ok: false };
    const ct = res.headers.get("content-type") || "image/png";
    const ab = await res.arrayBuffer();
    const bytes = new Uint8Array(ab);
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    const data = btoa(binary);
    return { ok: true, mediaType: ct.includes("jpeg") ? "image/jpeg" : "image/png", data };
  } catch {
    return { ok: false };
  }
}
