import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createServerClient } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  let event;
  try {
    event = getStripe().webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Webhook signature verification failed:", message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const playerId = session.metadata?.player_id;
    const goldQuantity = parseInt(session.metadata?.gold_quantity || "1", 10);

    if (!playerId) {
      console.error("No player_id in session metadata");
      return NextResponse.json({ error: "Missing player ID" }, { status: 400 });
    }

    const supabase = createServerClient();

    // Insert transaction record
    const { error: txError } = await supabase.from("transactions").insert({
      player_id: playerId,
      gold_amount: goldQuantity,
      amount_cents: session.amount_total || goldQuantity * 100,
      stripe_session_id: session.id,
    });

    if (txError) {
      // Duplicate session ID means we already processed this
      if (txError.code === "23505") {
        return NextResponse.json({ received: true });
      }
      console.error("Failed to insert transaction:", txError);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    // Increment player's gold count
    const { error: updateError } = await supabase.rpc("increment_gold", {
      p_player_id: playerId,
      p_amount: goldQuantity,
    });

    // Fallback if RPC doesn't exist: read-then-write
    if (updateError) {
      const { data: player } = await supabase
        .from("players")
        .select("gold_count")
        .eq("id", playerId)
        .single();

      if (player) {
        await supabase
          .from("players")
          .update({
            gold_count: player.gold_count + goldQuantity,
            updated_at: new Date().toISOString(),
          })
          .eq("id", playerId);
      }
    }
  }

  return NextResponse.json({ received: true });
}
