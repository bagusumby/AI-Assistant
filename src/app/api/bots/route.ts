import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

// GET - List all chat-enabled bots (for user bot selection)
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: bots, error } = await supabaseAdmin
    .from("ai_bots")
    .select("id, name, slug, description, chat_enabled")
    .eq("chat_enabled", true)
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(bots || []);
}
