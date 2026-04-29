export const runtime = "edge";

import { SignUp } from "@clerk/nextjs";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ tier?: string }>;
}) {
  const { tier } = await searchParams;
  const redirectUrl = tier ? `/checkout?tier=${tier}` : "/dashboard";

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#FAF7F2]">
      <div className="flex flex-col items-center gap-6">
        <div className="text-center">
          <p className="text-xs tracking-[0.25em] uppercase text-[#AF493B] mb-2">
            LiLo Photography &amp; Branding
          </p>
          <h1 className="text-3xl font-light" style={{ fontFamily: "Georgia, serif" }}>
            Create your account
          </h1>
          {tier && (
            <p className="text-sm text-[#6B6560] mt-2">
              One step before checkout. Takes 30 seconds.
            </p>
          )}
        </div>
        <SignUp forceRedirectUrl={redirectUrl} />
      </div>
    </main>
  );
}
