import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  const { displayName, playerId } = await request.json();

  if (!displayName || typeof displayName !== "string") {
    return NextResponse.json({ error: "Display name required" }, { status: 400 });
  }

  const trimmed = displayName.trim().slice(0, 20);
  if (trimmed.length === 0) {
    return NextResponse.json({ error: "Display name cannot be empty" }, { status: 400 });
  }

  const supabase = createServerClient();

  // If playerId provided, fetch existing player
  if (playerId) {
    const { data: existing } = await supabase
      .from("players")
      .select("*")
      .eq("id", playerId)
      .single();

    if (existing) {
      return NextResponse.json({ player: existing });
    }
  }

  // Create new player
  const { data, error } = await supabase
    .from("players")
    .insert({ display_name: trimmed })
    .select()
    .single();

  if (error) {
    console.error("Failed to create player:", error);
    return NextResponse.json({ error: "Failed to create player" }, { status: 500 });
  }

  return NextResponse.json({ player: data });
}

export async function GET(request: NextRequest) {
  const playerId = request.nextUrl.searchParams.get("id");
  if (!playerId) {
    return NextResponse.json({ error: "Player ID required" }, { status: 400 });
  }

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("players")
    .select("*")
    .eq("id", playerId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  return NextResponse.json({ player: data });
}
