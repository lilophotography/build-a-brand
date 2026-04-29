export const runtime = "edge";

import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature")!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return new Response("Webhook signature invalid", { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.CheckoutSession;
    const clerkId = session.metadata?.clerk_id;
    const email = session.customer_email;

    if (clerkId && email) {
      await supabaseAdmin
        .from("users")
        .upsert(
          {
            clerk_id: clerkId,
            email,
            has_access: true,
            stripe_customer_id: session.customer as string,
          },
          { onConflict: "clerk_id" }
        );
    }
  }

  return new Response("ok");
}
