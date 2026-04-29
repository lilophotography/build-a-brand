export const runtime = "edge";

﻿import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import CheckoutButton from "@/components/CheckoutButton";

const FIVE_VS = [
  {
    num: "01",
    title: "Vision",
    desc: "Uncover your mission, vision statement, and the values that will guide every business decision you make.",
  },
  {
    num: "02",
    title: "Value",
    desc: "Discover what makes you irreplaceable: your unique skills, story, and the ideal client who needs exactly what you offer.",
  },
  {
    num: "03",
    title: "Voice",
    desc: "Find the words that sound like you. Build messaging, an 'I Help' statement, and copy that converts.",
  },
  {
    num: "04",
    title: "Visuals",
    desc: "Define your brand vibe, color palette, logo direction, and fonts for a visual identity that stops the scroll.",
  },
  {
    num: "05",
    title: "Visibility",
    desc: "Choose where to show up, what content to create, and exactly what photos you need to attract your people.",
  },
];

export default async function LandingPage() {
  const { userId } = await auth();
  const isSignedIn = !!userId;

  return (
    <div className="min-h-screen bg-[#FAF7F2]">
      {/* Nav */}
      <nav className="px-6 py-5 flex items-center justify-between max-w-7xl mx-auto">
        <span className="text-xs tracking-[0.3em] uppercase text-[#AF493B] font-medium">
          LiLo Photography &amp; Branding
        </span>
        <div className="flex items-center gap-6">
          {isSignedIn ? (
            <Link href="/dashboard" className="text-sm text-[#2B2B2B] hover:text-[#AF493B] transition-colors">
              My Brand
            </Link>
          ) : (
            <Link href="/sign-in" className="text-sm text-[#2B2B2B] hover:text-[#AF493B] transition-colors">
              Sign in
            </Link>
          )}
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-16 pb-24 text-center">
        <p className="text-xs tracking-[0.3em] uppercase text-[#AF493B] mb-6">
          Build a Brand · The Course
        </p>
        <h1
          className="text-5xl md:text-7xl font-light text-[#2B2B2B] leading-tight mb-8"
          style={{ fontFamily: "Georgia, serif" }}
        >
          A brand with purpose
          <br />
          <em className="text-[#AF493B]">is a brand with power.</em>
        </h1>
        <p className="text-lg text-[#6B6560] max-w-2xl mx-auto mb-12 leading-relaxed">
          Five AI-guided workshops. One downloadable Brand Guide. Everything you
          need to build a brand your ideal clients can&apos;t ignore.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          {isSignedIn ? (
            <Link href="/dashboard" className="px-8 py-4 bg-[#AF493B] text-white text-sm tracking-wide hover:bg-[#9D4134] transition-colors rounded-sm">
              Continue Building
            </Link>
          ) : (
            <>
              <Link href="/#pricing" className="px-8 py-4 bg-[#AF493B] text-white text-sm tracking-wide hover:bg-[#9D4134] transition-colors rounded-sm">
                Get Started
              </Link>
              <Link href="/sign-in" className="px-8 py-4 border border-[#2B2B2B]/20 text-[#2B2B2B] text-sm tracking-wide hover:border-[#2B2B2B]/50 transition-colors rounded-sm">
                Sign In
              </Link>
            </>
          )}
        </div>
      </section>

      {/* 5 V's */}
      <section className="bg-[#2B2B2B] py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs tracking-[0.3em] uppercase text-[#C9A96E] text-center mb-4">
            The Framework
          </p>
          <h2
            className="text-3xl md:text-4xl font-light text-white text-center mb-16"
            style={{ fontFamily: "Georgia, serif" }}
          >
            The 5 V&apos;s of Brand Building
          </h2>
          <div className="grid md:grid-cols-5 gap-8">
            {FIVE_VS.map((v) => (
              <div key={v.num} className="flex flex-col gap-3">
                <span className="text-[#C9A96E] text-xs tracking-[0.2em]">{v.num}</span>
                <h3 className="text-white text-xl font-light" style={{ fontFamily: "Georgia, serif" }}>
                  {v.title}
                </h3>
                <p className="text-white/50 text-sm leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-4xl mx-auto px-6 py-24 text-center">
        <h2
          className="text-3xl font-light text-[#2B2B2B] mb-4"
          style={{ fontFamily: "Georgia, serif" }}
        >
          Your AI Brand Strategist, on call
        </h2>
        <p className="text-[#6B6560] mb-16 max-w-xl mx-auto">
          Each workshop pairs a lesson with a live AI conversation, so you
          don&apos;t just learn, you build. Every answer becomes part of your
          downloadable Brand Guide.
        </p>
        <div className="grid md:grid-cols-3 gap-10 text-left">
          {[
            { step: "1", title: "Work through each V", body: "Answer guided questions with your personal AI brand strategist. Go deep or skip what you know." },
            { step: "2", title: "Watch your guide build", body: "Every session generates polished deliverables: statements, copy, checklists, all saved to your Brand Guide." },
            { step: "3", title: "Launch with confidence", body: "Download your complete Brand Guide as a PDF. Your brand foundation, done." },
          ].map((s) => (
            <div key={s.step} className="flex flex-col gap-3">
              <span className="w-8 h-8 rounded-full border border-[#AF493B] text-[#AF493B] text-sm flex items-center justify-center">
                {s.step}
              </span>
              <h3 className="text-[#2B2B2B] font-medium">{s.title}</h3>
              <p className="text-[#6B6560] text-sm leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 px-6 bg-[#2B2B2B]">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs tracking-[0.3em] uppercase text-[#C9A96E] text-center mb-4">
            Pricing
          </p>
          <h2
            className="text-3xl md:text-4xl font-light text-white text-center mb-4"
            style={{ fontFamily: "Georgia, serif" }}
          >
            Choose your path
          </h2>
          <p className="text-white/50 text-center mb-16 max-w-md mx-auto">
            Both options give you lifetime access to all 5 workshops and your Brand Guide.
          </p>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Course only */}
            <div className="border border-white/10 rounded-lg p-8 flex flex-col gap-6 bg-white/5">
              <div>
                <p className="text-xs tracking-[0.2em] uppercase text-[#C9A96E] mb-2">Course</p>
                <div className="flex items-baseline gap-2 mb-3">
                  <span className="text-4xl font-light text-white">$250</span>
                  <span className="text-white/40 text-sm">one-time</span>
                </div>
                <p className="text-white/60 text-sm leading-relaxed">
                  Full access to all 5 AI brand-building workshops and your downloadable Brand Guide PDF.
                </p>
              </div>
              <ul className="space-y-2 text-sm text-white/70 flex-1">
                {["5 AI-guided workshops", "Downloadable Brand Guide PDF", "Lifetime access", "Build at your own pace"].map(f => (
                  <li key={f} className="flex items-center gap-2">
                    <span className="text-[#C9A96E]">✓</span> {f}
                  </li>
                ))}
              </ul>
              {isSignedIn ? (
                <Link href="/dashboard" className="w-full py-3 border border-white/20 text-white text-sm text-center hover:bg-white/10 transition-colors rounded-sm">
                  Go to Dashboard
                </Link>
              ) : (
                <CheckoutButton
                  tier="course"
                  label="Get Started for $250"
                  className="w-full py-3 border border-white/20 text-white text-sm hover:bg-white/10 transition-colors rounded-sm disabled:opacity-50"
                />
              )}
            </div>

            {/* Course + Coaching */}
            <div className="border border-[#C9A96E]/40 rounded-lg p-8 flex flex-col gap-6 bg-[#C9A96E]/5 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-[#C9A96E] text-[#2B2B2B] text-xs font-medium tracking-wide rounded-full">
                Most Popular
              </div>
              <div>
                <p className="text-xs tracking-[0.2em] uppercase text-[#C9A96E] mb-2">Course + Strategy Call</p>
                <div className="flex items-baseline gap-2 mb-3">
                  <span className="text-4xl font-light text-white">$500</span>
                  <span className="text-white/40 text-sm">one-time</span>
                </div>
                <p className="text-white/60 text-sm leading-relaxed">
                  Everything in the course plus a private 1-hour strategy call with Lisa to bring your brand to life.
                </p>
              </div>
              <ul className="space-y-2 text-sm text-white/70 flex-1">
                {["Everything in Course", "1-hour 1:1 strategy call with Lisa", "Brand review + feedback", "Personalized action plan"].map(f => (
                  <li key={f} className="flex items-center gap-2">
                    <span className="text-[#C9A96E]">✓</span> {f}
                  </li>
                ))}
              </ul>
              {isSignedIn ? (
                <Link href="/dashboard" className="w-full py-3 bg-[#C9A96E] text-[#2B2B2B] text-sm font-medium text-center hover:bg-[#B89555] transition-colors rounded-sm">
                  Go to Dashboard
                </Link>
              ) : (
                <CheckoutButton
                  tier="coaching"
                  label="Get Started for $500"
                  className="w-full py-3 bg-[#C9A96E] text-[#2B2B2B] text-sm font-medium hover:bg-[#B89555] transition-colors rounded-sm disabled:opacity-50"
                />
              )}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[#AF493B] py-20 px-6 text-center">
        <h2
          className="text-3xl md:text-4xl font-light text-white mb-6"
          style={{ fontFamily: "Georgia, serif" }}
        >
          Branding that means business.
        </h2>
        <p className="text-white/80 mb-10 max-w-md mx-auto">
          Stop guessing. Start building. Your brand is waiting.
        </p>
        <Link
          href={isSignedIn ? "/dashboard" : "/#pricing"}
          className="inline-block px-10 py-4 bg-white text-[#AF493B] text-sm tracking-wide hover:bg-[#FAF7F2] transition-colors rounded-sm font-medium"
        >
          {isSignedIn ? "Go to My Brand" : "Get Started Today"}
        </Link>
      </section>

      {/* Footer */}
      <footer className="px-6 py-8 text-center">
        <p className="text-xs text-[#6B6560]">
          © {new Date().getFullYear()} LiLo Photography &amp; Branding · All rights reserved
        </p>
      </footer>
    </div>
  );
}
