export const runtime = "edge";

import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Stripe from "stripe";

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ tier?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/#pricing");

  const { tier = "course" } = await searchParams;

  const user = await currentUser();
  const email = user?.emailAddresses[0]?.emailAddress;

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const priceId =
    tier === "coaching"
      ? process.env.NEXT_PUBLIC_PRICE_COURSE_COACHING!
      : process.env.NEXT_PUBLIC_PRICE_COURSE!;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{ price: priceId, quantity: 1 }],
    customer_email: email,
    metadata: { clerk_id: userId, tier },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/purchase-complete?session={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/#pricing`,
  });

  redirect(session.url!);
}
