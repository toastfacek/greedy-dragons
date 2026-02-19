import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createServerClient } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  const { playerId, quantity = 1 } = await request.json();

  if (!playerId) {
    return NextResponse.json({ error: "Player ID required" }, { status: 400 });
  }

  const goldQuantity = Math.max(1, Math.min(100, Math.floor(quantity)));

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
