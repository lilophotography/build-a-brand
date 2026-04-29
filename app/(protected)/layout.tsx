export const runtime = "edge";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import AppNav from "@/components/AppNav";
import { supabaseAdmin } from "@/lib/supabase";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const result = await supabaseAdmin
    .from("users")
    .select("has_access")
    .eq("clerk_id", userId)
    .single();
  const data = result.data as { has_access: boolean } | null;

  if (!data?.has_access) redirect("/#pricing");

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF7F2]">
      <AppNav />
      <main className="flex-1">{children}</main>
    </div>
  );
}
