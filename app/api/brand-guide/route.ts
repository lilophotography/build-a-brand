import { auth } from "@clerk/nextjs/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { supabaseAdmin } from "@/lib/supabase";
import { BrandGuidePDF } from "@/lib/brand-guide-pdf";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const { data: progress } = await supabaseAdmin
    .from("brand_progress")
    .select("tool, completed, summary")
    .eq("user_id", userId);

  const date = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdf = await renderToBuffer(createElement(BrandGuidePDF, { progress: progress || [], date }) as any);

  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="Brand-Guide.pdf"',
    },
  });
}
