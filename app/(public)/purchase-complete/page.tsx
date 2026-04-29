export const runtime = "edge";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase";

export default async function PurchaseCompletePage({
  searchParams,
}: {
  searchParams: Promise<{ session?: string }>;
}) {
  const { session: sessionId } = await searchParams;
  if (!sessionId) redirect("/#pricing");

  const { userId } = await auth();
  if (!userId) redirect(`/sign-in`);

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch {
    redirect("/#pricing");
  }

  if (session.payment_status !== "paid") redirect("/#pricing");

  await supabaseAdmin.from("users").upsert(
    {
      clerk_id: userId,
      email: session.customer_email ?? undefined,
      has_access: true,
      stripe_customer_id: session.customer as string,
    },
    { onConflict: "clerk_id" }
  );

  redirect("/dashboard?welcome=1");
}
