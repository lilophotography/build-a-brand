"use client";

import { SignUp } from "@clerk/nextjs";

export default function WelcomeSignUp({ email }: { email: string }) {
  return (
    <div className="min-h-screen bg-[#FAF7F2] flex flex-col items-center justify-center px-6 py-16">
      {/* Confirmation banner */}
      <div className="mb-8 text-center max-w-md">
        <div className="inline-flex items-center gap-2 bg-[#AF493B]/10 border border-[#AF493B]/30 rounded-full px-5 py-2 mb-6">
          <span className="text-[#AF493B] text-xs tracking-wide font-medium">
            ✓ Payment confirmed
          </span>
        </div>
        <h1
          className="text-3xl font-light text-[#2B2B2B] mb-3"
          style={{ fontFamily: "Georgia, serif" }}
        >
          You&apos;re in. Let&apos;s build your brand.
        </h1>
        <p className="text-[#6B6560] text-sm leading-relaxed">
          Create your account to access your course. Use the same email address
          you paid with to keep your access linked.
        </p>
      </div>

      <SignUp
        routing="hash"
        initialValues={{ emailAddress: email }}
        fallbackRedirectUrl="/dashboard?welcome=1"
      />
    </div>
  );
}
