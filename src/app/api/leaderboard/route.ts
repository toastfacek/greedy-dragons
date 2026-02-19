import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function GET() {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("players")
    .select("id, display_name, gold_count")
    .gt("gold_count", 0)
    .order("gold_count", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: "Failed to fetch leaderboard" }, { status: 500 });
  }

  return NextResponse.json({ players: data });
}
