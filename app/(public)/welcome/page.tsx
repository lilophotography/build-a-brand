export const runtime = "edge";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Stripe from "stripe";
import WelcomeSignUp from "./WelcomeSignUp";

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ session?: string }>;
}) {
  const { session: sessionId } = await searchParams;

  if (!sessionId) redirect("/");

  // If already signed in, skip account creation
  const { userId } = await auth();
  if (userId) redirect("/dashboard?welcome=1");

  // Verify the Stripe payment
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  let email = "";
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== "paid") redirect("/?canceled=1");
    email = session.customer_email ?? "";
  } catch {
    redirect("/");
  }

  return <WelcomeSignUp email={email} />;
}
