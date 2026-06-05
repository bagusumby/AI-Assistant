import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { role, roleType, botId } = session.user as {
    role?: string;
    roleType?: string;
    botId?: string;
  };

  if (role !== "admin" && roleType !== "manager") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let query = supabaseAdmin
    .from("feedback_reports")
    .select(
      `id, feedback_type, message, created_at,
       message_id,
       session_id,
       user_id,
       ai_bot_id,
       ai_bots!feedback_reports_ai_bot_id_fkey(id, name),
       chat_messages!feedback_reports_message_id_fkey(content)`
    )
    .order("created_at", { ascending: false });

  if (role !== "admin" && botId) {
    query = query.eq("ai_bot_id", botId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Enrich with user info via separate lookup
  const userIds = [...new Set((data || []).map((r) => r.user_id).filter(Boolean))];
  let usersMap: Record<string, { email: string; name: string }> = {};
  if (userIds.length > 0) {
    const { data: usersData } = await supabaseAdmin
      .from("users")
      .select("id, email, name")
      .in("id", userIds);
    if (usersData) {
      usersMap = Object.fromEntries(usersData.map((u) => [u.id, { email: u.email, name: u.name }]));
    }
  }

  const enriched = (data || []).map((r) => ({
    ...r,
    users: usersMap[r.user_id] || null,
  }));

  return NextResponse.json(enriched);
}
