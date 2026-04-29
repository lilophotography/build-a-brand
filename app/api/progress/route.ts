export const runtime = "edge";

import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const { data } = await supabaseAdmin
    .from("brand_progress")
    .select("tool, completed, summary, messages")
    .eq("user_id", userId);

  return Response.json(data || []);
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const { tool, messages, completed, summary } = await req.json();

  await supabaseAdmin.from("brand_progress").upsert(
    { user_id: userId, tool, messages, completed: completed ?? false, summary },
    { onConflict: "user_id,tool" }
  );

  return new Response("ok");
}
