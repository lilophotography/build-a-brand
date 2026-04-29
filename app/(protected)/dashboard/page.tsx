export const runtime = "edge";

﻿import { auth, currentUser } from "@clerk/nextjs/server";
import Link from "next/link";
import BrandQuestMap from "@/components/BrandQuestMap";
import { supabaseAdmin } from "@/lib/supabase";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const { userId } = await auth();
  const user = await currentUser();
  const firstName = user?.firstName || "there";
  const { welcome } = await searchParams;
  const isWelcome = welcome === "1";

  let progress = { vision: false, value: false, voice: false, visuals: false, visibility: false };
  if (userId) {
    const { data } = await supabaseAdmin
      .from("brand_progress")
      .select("tool, completed")
      .eq("user_id", userId);
    if (data) {
      (data as { tool: string; completed: boolean }[]).forEach((row) => {
        if (row.tool in progress) progress[row.tool as keyof typeof progress] = row.completed;
      });
    }
  }

  const completedCount = Object.values(progress).filter(Boolean).length;
  const pct = Math.round((completedCount / 5) * 100);

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      {/* Welcome banner (shown once after purchase) */}
      {isWelcome && (
        <div className="mb-10 rounded-lg bg-[#2B2B2B] px-8 py-6 flex items-start gap-5">
          <span className="text-2xl mt-0.5">🎉</span>
          <div>
            <h2
              className="text-xl font-light text-white mb-1"
              style={{ fontFamily: "Georgia, serif" }}
            >
              Welcome to Build a Brand, {firstName}.
            </h2>
            <p className="text-white/60 text-sm leading-relaxed">
              Your course access is confirmed. Start with Vision below and work through each
              workshop at your own pace. Everything you build saves automatically to your Brand Guide.
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-12">
        <p className="text-xs tracking-[0.25em] uppercase text-[#AF493B] mb-2">
          Welcome back, {firstName}
        </p>
        <h1
          className="text-4xl font-light text-[#2B2B2B] mb-3"
          style={{ fontFamily: "Georgia, serif" }}
        >
          Your Brand Journey
        </h1>
        <p className="text-[#6B6560]">
          {completedCount === 0
            ? "You're just getting started. Let's build something great."
            : completedCount === 5
            ? "Your brand foundation is complete. Time to bring it to life."
            : `${completedCount} of 5 foundations complete. Keep going. You're building momentum.`}
        </p>
      </div>

      {/* Progress bar */}
      <div className="mb-12">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-[#6B6560] tracking-wide">Brand Guide Progress</span>
          <span className="text-xs text-[#6B6560] font-medium">{pct}%</span>
        </div>
        <div className="h-1 bg-[#E8E0D6] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#C9A96E] rounded-full transition-all duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Brand Quest Map */}
      <BrandQuestMap progress={progress} />

      {/* Bottom CTA: coaching */}
      {completedCount >= 3 && (
        <div className="mt-16 border border-[#AF493B]/20 rounded-lg p-8 bg-[#AF493B]/5 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <p className="text-xs tracking-[0.2em] uppercase text-[#AF493B] mb-1">Ready to accelerate?</p>
            <h3 className="text-xl font-light text-[#2B2B2B]" style={{ fontFamily: "Georgia, serif" }}>
              Work with Lisa directly
            </h3>
            <p className="text-sm text-[#6B6560] mt-1">
              You&apos;ve built your foundation. Let&apos;s bring it to life together.
            </p>
          </div>
          <Link
            href="/coaching"
            className="shrink-0 px-6 py-3 bg-[#AF493B] text-white text-sm tracking-wide hover:bg-[#9D4134] transition-colors rounded-sm"
          >
            Book a Strategy Call
          </Link>
        </div>
      )}
    </div>
  );
}
