/* Sends the report card by email via Resend.
   Lisa needs RESEND_API_KEY in .env.local. Domain photolilo.com must be verified
   inside Resend. Falls back gracefully if unconfigured. */

const RESEND_ENDPOINT = "https://api.resend.com/emails";
// touch: ensure dev server picks up updated RESEND_FROM_EMAIL env value

export type SendReportEmailResult =
  | { ok: true; id: string }
  | { ok: false; reason: "not_configured" | "send_failed"; detail?: string };

export async function sendReportEmail(args: {
  toEmail: string;
  url: string;
  reportMarkdown: string;
  tone: "big-sister" | "all-business";
  transcript?: Array<{ role: "user" | "assistant"; content: string }>;
  headlineRewrite?: string | null;
}): Promise<SendReportEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.RESEND_FROM_EMAIL || "Lisa <hi@photolilo.com>";
  if (!apiKey) {
    return { ok: false, reason: "not_configured" };
  }

  const subject = `Your Website Report Card for ${args.url.replace(/^https?:\/\//, "")}`;
  const html = renderReportHtml({
    url: args.url,
    reportMarkdown: args.reportMarkdown,
    tone: args.tone,
    transcript: args.transcript || [],
    headlineRewrite: args.headlineRewrite || null,
  });

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [args.toEmail],
        subject,
        html,
        reply_to: "lisa@photolilo.com", // replies go to Lisa's real Microsoft 365 inbox
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { ok: false, reason: "send_failed", detail: detail.slice(0, 200) };
    }
    const data = (await res.json()) as { id?: string };
    return { ok: true, id: data.id || "" };
  } catch (err) {
    return {
      ok: false,
      reason: "send_failed",
      detail: err instanceof Error ? err.message : "unknown",
    };
  }
}

function renderReportHtml(args: {
  url: string;
  reportMarkdown: string;
  tone: "big-sister" | "all-business";
  transcript: Array<{ role: "user" | "assistant"; content: string }>;
  headlineRewrite: string | null;
}): string {
  const reportBody = mdToInlineHtml(args.reportMarkdown);
  const services = "https://photolilo.com/services";
  const bookCall = "https://lilophotography.hbportal.co/public/65abf3aff8ee2603601c6158";

  // Build the transcript section. Each turn renders as a labeled block.
  const transcriptHtml =
    args.transcript.length > 0
      ? `
        <h2 style="font-family:Georgia,serif;font-size:24px;font-weight:400;margin:32px 0 14px;color:#000;">Our Conversation</h2>
        ${args.transcript
          .map((turn) => {
            const label = turn.role === "user" ? "You asked" : "Lisa said";
            const labelColor = turn.role === "user" ? "#000" : "#af493b";
            const content = turn.role === "user"
              ? `<p style="margin:0 0 14px;">${escapeHtml(turn.content)}</p>`
              : mdToInlineHtml(turn.content);
            return `
              <div style="margin:0 0 18px;padding:14px 16px;background:${turn.role === "user" ? "#fafafa" : "#fff"};border-left:3px solid ${labelColor};border-radius:4px;">
                <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:${labelColor};font-weight:700;font-family:Lato,Helvetica,sans-serif;">${label}</p>
                <div style="font-family:Lato,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#000;">${content}</div>
              </div>`;
          })
          .join("")}`
      : "";

  const rewriteHtml = args.headlineRewrite
    ? `
        <h2 style="font-family:Georgia,serif;font-size:24px;font-weight:400;margin:32px 0 14px;color:#000;">Your Headline Rewrite</h2>
        <div style="background:#000;color:#fff;padding:24px;border-radius:8px;font-family:Lato,Helvetica,sans-serif;font-size:14px;line-height:1.7;">${mdToInlineHtmlDark(args.headlineRewrite)}</div>`
    : "";

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Your Website Report Card</title></head>
<body style="margin:0;padding:0;background:#fafafa;font-family:Georgia,serif;color:#000;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fafafa;">
    <tr><td align="center" style="padding:32px 16px;">
      <table width="680" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:8px;overflow:hidden;max-width:680px;">
        <tr><td style="background:#af493b;height:8px;line-height:8px;font-size:0;">&nbsp;</td></tr>
        <tr><td style="padding:40px 40px 16px;">
          <p style="font-family:Lato,Helvetica,sans-serif;font-size:11px;letter-spacing:0.3em;text-transform:uppercase;color:#af493b;margin:0 0 12px;font-weight:700;">Your Report Card</p>
          <h1 style="font-family:Georgia,serif;font-size:30px;font-weight:400;margin:0 0 8px;color:#000;">Here's everything we worked through.</h1>
          <p style="font-family:Lato,Helvetica,sans-serif;font-size:14px;color:#747474;margin:0 0 24px;">Reviewing: <strong>${escapeHtml(args.url)}</strong></p>
          <div style="font-family:Lato,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:#000;">${reportBody}</div>
          ${transcriptHtml}
          ${rewriteHtml}
        </td></tr>
        <tr><td style="padding:0 40px 40px;">
          <hr style="border:0;border-top:1px solid #ededed;margin:24px 0;" />
          <p style="font-family:Lato,Helvetica,sans-serif;font-size:14px;color:#000;margin:0 0 16px;">
            Ready to take this further? You can see all of Lisa's offers at <a href="${services}" style="color:#af493b;">photolilo.com/services</a> or
            <a href="${bookCall}" style="color:#af493b;font-weight:700;">book a free consult call</a> with her.
          </p>
          <p style="font-family:Lato,Helvetica,sans-serif;font-size:12px;color:#747474;margin:24px 0 0;">
            With love,<br/>Lisa, LiLo Photography &amp; Branding
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function mdToInlineHtmlDark(md: string): string {
  // Same renderer but light-on-dark for the rewrite block embedded in the email.
  return mdToInlineHtml(md)
    .replace(/color:#000;/g, "color:#fff;")
    .replace(/color:#747474;/g, "color:#e8bb5c;")
    .replace(/border-bottom:1px solid #ededed;/g, "border-bottom:1px solid rgba(255,255,255,0.1);")
    .replace(/background:#000;color:#fff;/g, "background:rgba(255,255,255,0.08);color:#fff;");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* Minimal markdown to HTML for email rendering. Handles headings, bold, italic,
   links, lists, tables, blockquotes. Not a full md parser; good enough for our
   AI's output structure. */
function mdToInlineHtml(md: string): string {
  let html = escapeHtml(md);

  // Headings
  html = html.replace(/^### (.*)$/gm, '<h3 style="font-family:Georgia,serif;font-size:18px;font-weight:400;margin:20px 0 8px;color:#000;">$1</h3>');
  html = html.replace(/^## (.*)$/gm, '<h2 style="font-family:Georgia,serif;font-size:22px;font-weight:400;margin:24px 0 10px;color:#000;">$1</h2>');
  html = html.replace(/^# (.*)$/gm, '<h1 style="font-family:Georgia,serif;font-size:26px;font-weight:400;margin:24px 0 12px;color:#000;">$1</h1>');

  // Tables (simple GFM)
  html = html.replace(
    /(?:^\|.+\|$\n)+(?:^\|[\s\-:|]+\|$\n)(?:^\|.+\|$\n?)+/gm,
    (block) => {
      const lines = block.trim().split("\n");
      const headerCells = parseRow(lines[0]);
      const bodyRows = lines.slice(2).map(parseRow);
      const thead =
        "<thead><tr>" +
        headerCells
          .map(
            (c) =>
              `<th style="text-align:left;padding:10px 12px;background:#000;color:#fff;font-family:Lato,Helvetica,sans-serif;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;">${c}</th>`
          )
          .join("") +
        "</tr></thead>";
      const tbody =
        "<tbody>" +
        bodyRows
          .map(
            (row) =>
              "<tr>" +
              row
                .map(
                  (c) =>
                    `<td style="padding:10px 12px;border-bottom:1px solid #ededed;font-size:14px;">${c}</td>`
                )
                .join("") +
              "</tr>"
          )
          .join("") +
        "</tbody>";
      return `<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;width:100%;margin:14px 0;">${thead}${tbody}</table>`;
    }
  );

  // Blockquotes
  html = html.replace(
    /^&gt; (.*)$/gm,
    '<blockquote style="border-left:3px solid #e8bb5c;padding:4px 0 4px 14px;margin:14px 0;color:#747474;font-style:italic;">$1</blockquote>'
  );

  // Bold + italic
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/(^|\W)\*([^*]+)\*(\W|$)/g, "$1<em>$2</em>$3");

  // Links
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" style="color:#af493b;">$1</a>'
  );

  // Unordered lists
  html = html.replace(/(?:^- .+\n?)+/gm, (block) => {
    const items = block
      .trim()
      .split("\n")
      .map((line) => line.replace(/^- /, ""))
      .map((it) => `<li style="margin:6px 0;">${it}</li>`)
      .join("");
    return `<ul style="margin:10px 0 14px;padding-left:22px;">${items}</ul>`;
  });

  // Paragraphs (split on double newlines for any text not already wrapped)
  html = html
    .split(/\n{2,}/)
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return "";
      if (/^<(h\d|table|ul|ol|blockquote)/.test(trimmed)) return trimmed;
      return `<p style="margin:0 0 14px;">${trimmed.replace(/\n/g, "<br/>")}</p>`;
    })
    .join("\n");

  return html;
}

function parseRow(line: string): string[] {
  return line
    .split("|")
    .slice(1, -1)
    .map((c) => c.trim());
}
