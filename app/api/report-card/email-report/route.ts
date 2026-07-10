export const runtime = "edge";

import { sendReportEmail } from "@/lib/email-report";
import { recordLead } from "@/lib/rate-limit";

export async function POST(req: Request) {
  let body: {
    email?: string;
    url?: string;
    reportMarkdown?: string;
    tone?: "big-sister" | "all-business";
    transcript?: Array<{ role: "user" | "assistant"; content: string }>;
    headlineRewrite?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400 });
  }

  const email = (body.email || "").trim();
  const url = (body.url || "").trim();
  const reportMarkdown = body.reportMarkdown || "";
  const tone = body.tone === "all-business" ? "all-business" : "big-sister";
  const transcript = Array.isArray(body.transcript) ? body.transcript : [];
  const headlineRewrite = body.headlineRewrite || null;

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return new Response(
      JSON.stringify({ error: "invalid_email", message: "Please enter a valid email address." }),
      { status: 400 }
    );
  }
  if (!url || !reportMarkdown) {
    return new Response(JSON.stringify({ error: "missing_fields" }), { status: 400 });
  }

  void recordLead({
    email,
    url,
    tone,
    reportText: reportMarkdown,
  });

  const result = await sendReportEmail({
    toEmail: email,
    url,
    reportMarkdown,
    tone,
    transcript,
    headlineRewrite,
  });

  if (!result.ok) {
    if (result.reason === "not_configured") {
      return new Response(
        JSON.stringify({
          ok: true,
          warning: "email_not_configured",
          message:
            "Got it! Lisa will follow up via email shortly. (Heads up: live email delivery isn't fully wired yet, but your details are saved.)",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    return new Response(
      JSON.stringify({
        error: "send_failed",
        message: "Couldn't send the email right now. Try again, or copy your report from the page.",
      }),
      { status: 502 }
    );
  }

  return new Response(JSON.stringify({ ok: true, id: result.id }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
