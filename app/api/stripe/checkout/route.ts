export const runtime = "edge";

import { auth, currentUser } from "@clerk/nextjs/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const user = await currentUser();
  const email = user?.emailAddresses[0]?.emailAddress;

  const { tier } = await req.json().catch(() => ({ tier: "course" }));
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

  return Response.json({ url: session.url });
}
