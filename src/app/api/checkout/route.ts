import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createServerClient } from "@/lib/supabase";
import { randomUUID } from "crypto";

const isTestMode = !process.env.STRIPE_SECRET_KEY ||
  process.env.STRIPE_SECRET_KEY === "sk_test_...";

export async function POST(request: NextRequest) {
  const { playerId, quantity = 1 } = await request.json();

  if (!playerId) {
    return NextResponse.json({ error: "Player ID required" }, { status: 400 });
  }

  const goldQuantity = Math.max(1, Math.min(10000, Math.floor(quantity)));

  // Verify the player exists
  const supabase = createServerClient();
  const { data: player } = await supabase
    .from("players")
    .select("id, display_name")
    .eq("id", playerId)
    .single();

  if (!player) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  // Test mode: bypass Stripe and add gold directly
  if (isTestMode) {
    const sessionId = `test_session_${randomUUID()}`;

    const { error: txError } = await supabase.from("transactions").insert({
      player_id: playerId,
      gold_amount: goldQuantity,
      amount_cents: goldQuantity * 100,
      stripe_session_id: sessionId,
    });

    if (txError) {
      console.error("Failed to insert test transaction:", txError);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    const { error: updateError } = await supabase.rpc("increment_gold", {
      p_player_id: playerId,
      p_amount: goldQuantity,
    });

    if (updateError) {
      const { data: currentPlayer } = await supabase
        .from("players")
        .select("gold_count")
        .eq("id", playerId)
        .single();

      if (currentPlayer) {
        await supabase
          .from("players")
          .update({
            gold_count: currentPlayer.gold_count + goldQuantity,
            updated_at: new Date().toISOString(),
          })
          .eq("id", playerId);
      }
    }

    // Return updated player data directly (no redirect needed in test mode)
    const { data: updatedPlayer } = await supabase
      .from("players")
      .select("*")
      .eq("id", playerId)
      .single();

    return NextResponse.json({ success: true, player: updatedPlayer });
  }

  const session = await getStripe().checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: "Dragon Gold",
            description: `${goldQuantity} gold for ${player.display_name}'s hoard`,
          },
          unit_amount: 100, // $1.00 per gold
        },
        quantity: goldQuantity,
      },
    ],
    mode: "payment",
    success_url: `${appUrl}?success=true`,
    cancel_url: `${appUrl}?canceled=true`,
    metadata: {
      player_id: playerId,
      gold_quantity: goldQuantity.toString(),
    },
  });

  return NextResponse.json({ url: session.url });
}
