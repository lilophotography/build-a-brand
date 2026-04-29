export const runtime = "edge";

import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase";
import DownloadButton from "./DownloadButton";

const V_META = [
  { key: "vision", num: "01", title: "Vision", desc: "Mission, vision statement, and brand values." },
  { key: "value", num: "02", title: "Value", desc: "Your story, unique skills, and ideal client profile." },
  { key: "voice", num: "03", title: "Voice", desc: "Messaging, 'I Help' statement, and copy that converts." },
  { key: "visuals", num: "04", title: "Visuals", desc: "Brand vibe, color palette, logo direction, and typography." },
  { key: "visibility", num: "05", title: "Visibility", desc: "Where to show up, what to create, and how to attract clients." },
];

export default async function BrandGuidePage() {
  const { userId } = await auth();

  let progress: { tool: string; completed: boolean; summary?: string }[] = [];

  if (userId && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const { data } = await supabaseAdmin
      .from("brand_progress")
      .select("tool, completed, summary")
      .eq("user_id", userId);
    progress = data || [];
  }

  const progressMap = Object.fromEntries(progress.map((p) => [p.tool, p]));
  const completedCount = V_META.filter((v) => progressMap[v.key]?.completed).length;
  const allDone = completedCount === 5;

  return (
    <div className="max-w-4xl mx-auto px-6 py-16">
      {/* Header */}
      <div className="mb-12">
        <p className="text-xs tracking-[0.3em] uppercase text-[#AF493B] mb-3">
          Your Brand Foundation
        </p>
        <h1
          className="text-4xl font-light text-[#2B2B2B] mb-4"
          style={{ fontFamily: "Georgia, serif" }}
        >
          Brand Guide
        </h1>
        <p className="text-[#6B6560] max-w-xl">
          Everything you&apos;ve built across the 5 V&apos;s, compiled into your
          downloadable Brand Guide PDF.
        </p>

        {/* Progress bar */}
        <div className="mt-6 flex items-center gap-4">
          <div className="flex-1 h-1 bg-[#2B2B2B]/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#C9A96E] rounded-full transition-all"
              style={{ width: `${(completedCount / 5) * 100}%` }}
            />
          </div>
          <span className="text-sm text-[#6B6560] whitespace-nowrap">
            {completedCount} / 5 complete
          </span>
        </div>
      </div>

      {/* Download CTA */}
      <div
        className={`mb-12 p-8 rounded-lg border ${
          allDone
            ? "border-[#C9A96E]/40 bg-[#C9A96E]/5"
            : "border-[#2B2B2B]/10 bg-[#2B2B2B]/3"
        }`}
      >
        {allDone ? (
          <>
            <p className="text-xs tracking-[0.3em] uppercase text-[#AF493B] mb-2">
              Ready to Download
            </p>
            <h2
              className="text-2xl font-light text-[#2B2B2B] mb-3"
              style={{ fontFamily: "Georgia, serif" }}
            >
              Your Brand Guide is complete.
            </h2>
            <p className="text-[#6B6560] text-sm mb-6">
              All 5 workshops done. Download your full Brand Guide PDF. Your
              brand foundation, done.
            </p>
            <DownloadButton />
          </>
        ) : (
          <>
            <h2
              className="text-xl font-light text-[#2B2B2B] mb-2"
              style={{ fontFamily: "Georgia, serif" }}
            >
              {completedCount === 0
                ? "Start your first workshop to begin building."
                : `${5 - completedCount} workshop${5 - completedCount > 1 ? "s" : ""} left to unlock your full Brand Guide.`}
            </h2>
            <p className="text-[#6B6560] text-sm mb-4">
              You can download a partial guide with your completed sections, or
              finish all 5 V&apos;s for the complete version.
            </p>
            <div className="flex gap-3">
              {completedCount > 0 && <DownloadButton partial />}
              <Link
                href="/dashboard"
                className="px-6 py-3 bg-[#AF493B] text-white text-sm hover:bg-[#9D4134] transition-colors rounded-sm"
              >
                Continue Building →
              </Link>
            </div>
          </>
        )}
      </div>

      {/* V Sections Preview */}
      <div className="space-y-6">
        {V_META.map((v) => {
          const item = progressMap[v.key];
          const done = item?.completed;
          const summary = item?.summary;

          return (
            <div
              key={v.key}
              className={`border rounded-lg overflow-hidden ${
                done ? "border-[#2B2B2B]/15" : "border-[#2B2B2B]/8 opacity-60"
              }`}
            >
              {/* Section header */}
              <div className="bg-[#2B2B2B] px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-[#C9A96E] text-xs tracking-[0.2em]">
                    {v.num}
                  </span>
                  <div>
                    <h3
                      className="text-white font-light"
                      style={{ fontFamily: "Georgia, serif" }}
                    >
                      {v.title}
                    </h3>
                    <p className="text-white/40 text-xs mt-0.5">{v.desc}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {done ? (
                    <span className="text-[#C9A96E] text-xs tracking-wide">
                      ✓ Complete
                    </span>
                  ) : (
                    <Link
                      href={`/brand-builder/${v.key}`}
                      className="text-xs text-white/50 hover:text-white transition-colors"
                    >
                      Start →
                    </Link>
                  )}
                </div>
              </div>

              {/* Summary content */}
              {summary ? (
                <div className="px-6 py-5 bg-white">
                  <p className="text-[#2B2B2B] text-sm leading-relaxed whitespace-pre-wrap line-clamp-6">
                    {summary}
                  </p>
                  <Link
                    href={`/brand-builder/${v.key}`}
                    className="inline-block mt-3 text-xs text-[#AF493B] hover:text-[#9D4134] transition-colors"
                  >
                    Edit in workshop →
                  </Link>
                </div>
              ) : (
                <div className="px-6 py-5 bg-white">
                  <p className="text-[#6B6560] text-sm italic">
                    Complete this workshop to see your {v.title} summary here.
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Coaching upsell */}
      <div className="mt-16 p-8 bg-[#AF493B] rounded-lg text-center">
        <p className="text-xs tracking-[0.3em] uppercase text-white/60 mb-3">
          Ready to go deeper?
        </p>
        <h2
          className="text-2xl font-light text-white mb-3"
          style={{ fontFamily: "Georgia, serif" }}
        >
          Bring your brand to life with Lisa.
        </h2>
        <p className="text-white/80 text-sm mb-6 max-w-sm mx-auto">
          You&apos;ve built the foundation. A strategy call turns it into a plan
          you can actually execute.
        </p>
        <Link
          href="/coaching"
          className="inline-block px-8 py-3 bg-white text-[#AF493B] text-sm font-medium hover:bg-[#FAF7F2] transition-colors rounded-sm"
        >
          Book a Strategy Call
        </Link>
      </div>
    </div>
  );
}
