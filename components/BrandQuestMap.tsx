"use client";

import Link from "next/link";

const STAGES = [
  {
    id: "vision",
    num: "01",
    title: "Vision",
    subtitle: "Mission · Vision Statement · Values",
    href: "/brand-builder/vision",
    desc: "The why behind everything you do.",
    unlockMsg: "Your foundation starts here.",
  },
  {
    id: "value",
    num: "02",
    title: "Value",
    subtitle: "Unique Value · Ideal Client · Transformation",
    href: "/brand-builder/value",
    desc: "What makes you irreplaceable.",
    unlockMsg: "Complete Vision to unlock.",
  },
  {
    id: "voice",
    num: "03",
    title: "Voice",
    subtitle: "Messaging · Taglines · About Me",
    href: "/brand-builder/voice",
    desc: "The words your clients need to hear.",
    unlockMsg: "Complete Value to unlock.",
  },
  {
    id: "visuals",
    num: "04",
    title: "Visuals",
    subtitle: "Colors · Logo · Fonts · Brand Vibe",
    href: "/brand-builder/visuals",
    desc: "A look that stops the scroll.",
    unlockMsg: "Complete Voice to unlock.",
  },
  {
    id: "visibility",
    num: "05",
    title: "Visibility",
    subtitle: "Platforms · Content · Photos",
    href: "/brand-builder/visibility",
    desc: "Where and how you show up.",
    unlockMsg: "Complete Visuals to unlock.",
  },
];

type Progress = Record<string, boolean>;

export default function BrandQuestMap({ progress }: { progress: Progress }) {
  return (
    <div className="grid gap-4">
      {STAGES.map((stage, i) => {
        const done = progress[stage.id];
        const prevDone = i === 0 || progress[STAGES[i - 1].id];
        const active = prevDone && !done;
        const locked = !prevDone && !done;

        return (
          <div
            key={stage.id}
            className={`group relative flex items-center gap-6 p-6 rounded-lg border transition-all duration-200 ${
              done
                ? "border-[#C9A96E]/40 bg-[#C9A96E]/5"
                : active
                ? "border-[#AF493B]/40 bg-white shadow-sm hover:shadow-md hover:border-[#AF493B]/60"
                : locked
                ? "border-[#E8E0D6] bg-[#FAF7F2] opacity-60"
                : "border-[#E8E0D6] bg-white"
            }`}
          >
            {/* Stage number / check */}
            <div
              className={`shrink-0 w-12 h-12 rounded-full flex items-center justify-center border-2 text-sm font-light transition-colors ${
                done
                  ? "border-[#C9A96E] bg-[#C9A96E] text-white"
                  : active
                  ? "border-[#AF493B] text-[#AF493B]"
                  : "border-[#E8E0D6] text-[#6B6560]"
              }`}
            >
              {done ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                stage.num
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-3 flex-wrap">
                <h3
                  className={`text-xl font-light ${done ? "text-[#6B6560]" : "text-[#2B2B2B]"}`}
                  style={{ fontFamily: "Georgia, serif" }}
                >
                  {stage.title}
                </h3>
                <span className="text-xs text-[#6B6560]">{stage.subtitle}</span>
              </div>
              <p className="text-sm text-[#6B6560] mt-0.5">
                {locked ? stage.unlockMsg : stage.desc}
              </p>
            </div>

            {/* Action */}
            <div className="shrink-0">
              {done ? (
                <Link
                  href={stage.href}
                  className="text-xs text-[#C9A96E] hover:text-[#AF493B] transition-colors"
                >
                  Revisit →
                </Link>
              ) : active ? (
                <Link
                  href={stage.href}
                  className="px-5 py-2.5 bg-[#AF493B] text-white text-xs tracking-wide hover:bg-[#9D4134] transition-colors rounded-sm"
                >
                  Start →
                </Link>
              ) : (
                <span className="text-xs text-[#E8E0D6]">Locked</span>
              )}
            </div>

            {/* Active glow */}
            {active && (
              <div className="absolute inset-0 rounded-lg ring-1 ring-[#AF493B]/20 pointer-events-none" />
            )}
          </div>
        );
      })}
    </div>
  );
}
