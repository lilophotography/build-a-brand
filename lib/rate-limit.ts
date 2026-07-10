import { supabaseAdmin } from "./supabase";

const WINDOW_HOURS = 24;
const MAX_REPORTS_PER_WINDOW = 2;

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; reason: "too_many_reports"; retryAfterHours: number };

export function getRequestIp(req: Request): string {
  const h = req.headers;
  const cf = h.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const real = h.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

export async function checkAndRecordReportAttempt(args: {
  ip: string;
  url?: string;
}): Promise<RateLimitResult> {
  const since = new Date(Date.now() - WINDOW_HOURS * 60 * 60 * 1000).toISOString();
  try {
    const { count, error } = await supabaseAdmin
      .from("report_card_requests")
      .select("id", { count: "exact", head: true })
      .eq("ip", args.ip)
      .gte("created_at", since);

    if (error) {
      // Fail open: if Supabase is down, do not block legit users.
      return { allowed: true };
    }
    if ((count ?? 0) >= MAX_REPORTS_PER_WINDOW) {
      return { allowed: false, reason: "too_many_reports", retryAfterHours: WINDOW_HOURS };
    }

    await supabaseAdmin.from("report_card_requests").insert({
      ip: args.ip,
      url: args.url || null,
    });
    return { allowed: true };
  } catch {
    return { allowed: true };
  }
}

export async function recordLead(args: {
  email?: string;
  url: string;
  tone: "big-sister" | "all-business";
  reportText?: string;
  socialHandles?: Record<string, string>;
  ip?: string;
  userAgent?: string;
}): Promise<void> {
  try {
    await supabaseAdmin.from("report_card_leads").insert({
      email: args.email || null,
      url: args.url,
      tone: args.tone,
      report_text: args.reportText || null,
      social_handles: args.socialHandles || {},
      ip: args.ip || null,
      user_agent: args.userAgent || null,
    });
  } catch {
    // Non-fatal; do not break the user experience over a logging failure.
  }
}
