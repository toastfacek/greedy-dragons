import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function PUT(request: NextRequest) {
  const { playerId, socialLink } = await request.json();

  if (!playerId || typeof playerId !== "string") {
    return NextResponse.json({ error: "Player ID required" }, { status: 400 });
  }

  // Validate and sanitize socialLink
  const trimmedLink = typeof socialLink === "string" ? socialLink.trim() : "";

  if (trimmedLink !== "") {
    if (trimmedLink.length > 512) {
      return NextResponse.json(
        { error: "URL too long (max 512 characters)" },
        { status: 400 }
      );
    }

    try {
      const parsed = new URL(trimmedLink);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        return NextResponse.json(
          { error: "Only http and https URLs are allowed" },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json(
        { error: "Invalid URL format" },
        { status: 400 }
      );
    }
  }

  const supabase = createServerClient();

  // Verify the player exists
  const { data: player, error: playerError } = await supabase
    .from("players")
    .select("id")
    .eq("id", playerId)
    .single();

  if (playerError || !player) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  // Check that the player is currently in the top 5
  const { data: topPlayers, error: topError } = await supabase
    .from("players")
    .select("id")
    .gt("gold_count", 0)
    .order("gold_count", { ascending: false })
    .limit(5);

  if (topError) {
    return NextResponse.json(
      { error: "Failed to verify ranking" },
      { status: 500 }
    );
  }

  const isTop5 = topPlayers?.some((p) => p.id === playerId) ?? false;
  if (!isTop5) {
    return NextResponse.json(
      { error: "Only top 5 players can set a social link" },
      { status: 403 }
    );
  }

  // Update the social link
  const { data: updated, error: updateError } = await supabase
    .from("players")
    .update({
      social_link: trimmedLink === "" ? null : trimmedLink,
      updated_at: new Date().toISOString(),
    })
    .eq("id", playerId)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to update social link" },
      { status: 500 }
    );
  }

  return NextResponse.json({ player: updated });
}
