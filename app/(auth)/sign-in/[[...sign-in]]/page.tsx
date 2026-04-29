export const runtime = "edge";

import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#FAF7F2]">
      <div className="flex flex-col items-center gap-6">
        <div className="text-center">
          <p className="text-xs tracking-[0.25em] uppercase text-[#C9A96E] mb-2">LiLo Photography &amp; Branding</p>
          <h1 className="text-3xl font-light" style={{ fontFamily: "Georgia, serif" }}>
            Welcome back
          </h1>
        </div>
        <SignIn />
      </div>
    </main>
  );
}
