import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: NextRequest) {
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

  const { searchParams } = new URL(req.url);
  const statusFilter = searchParams.get("status"); // "pending" | "resolved" | null (all)
  const priorityFilter = searchParams.get("priority"); // "high" | "medium" | "low" | null
  const sortBy = searchParams.get("sort") || "priority"; // "priority" | "date"

  let query = supabaseAdmin
    .from("feedback_reports")
    .select(
      `id, feedback_type, message, created_at, resolved_at, resolved_filename, resolved_answer, priority,
       message_id,
       session_id,
       user_id,
       ai_bot_id,
       ai_bots!feedback_reports_ai_bot_id_fkey(id, name),
       chat_messages!feedback_reports_message_id_fkey(content)`
    );

  // Filter by bot scope
  if (role !== "admin" && botId) {
    query = query.eq("ai_bot_id", botId);
  }

  // Filter by status
  if (statusFilter === "pending") {
    query = query.is("resolved_at", null);
  } else if (statusFilter === "resolved") {
    query = query.not("resolved_at", "is", null);
  }

  // Filter by priority
  if (priorityFilter === "unset") {
    query = query.is("priority", null);
  } else if (priorityFilter) {
    query = query.eq("priority", priorityFilter);
  }

  // Base sort by date
  query = query.order("created_at", { ascending: false });

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

  let enriched = (data || []).map((r) => ({
    ...r,
    users: usersMap[r.user_id] || null,
  }));

  // Client-side priority sort
  if (sortBy === "priority") {
    const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
    enriched = enriched.sort((a, b) => {
      const pa = a.priority ? priorityOrder[a.priority] ?? 3 : 3;
      const pb = b.priority ? priorityOrder[b.priority] ?? 3 : 3;
      if (pa !== pb) return pa - pb;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }

  return NextResponse.json(enriched);
}

// PATCH: Set priority for a feedback report
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { role, roleType } = session.user as {
    role?: string;
    roleType?: string;
  };

  if (role !== "admin" && roleType !== "manager") {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  try {
    const { id, priority } = await req.json();

    if (!id) {
      return NextResponse.json({ error: "ID diperlukan" }, { status: 400 });
    }

    const validPriorities = ["high", "medium", "low", null];
    if (!validPriorities.includes(priority)) {
      return NextResponse.json({ error: "Priority tidak valid (high/medium/low/null)" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("feedback_reports")
      .update({ priority })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
