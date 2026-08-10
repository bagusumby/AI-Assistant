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
  const search = searchParams.get("search")?.trim(); // free-text search on question
  const botFilter = searchParams.get("botId"); // ai_bot_id, or "all"/null
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.max(1, parseInt(searchParams.get("limit") || "10", 10));

  let query = supabaseAdmin
    .from("unanswered_questions")
    .select(
      `id, question, bot_response, created_at, resolved_at, resolved_filename, resolved_answer, priority,
       session_id,
       user_id,
       ai_bot_id,
       ai_bots!unanswered_questions_ai_bot_id_fkey(id, name)`
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

  // Filter by search text (question, case-insensitive partial match)
  if (search) {
    query = query.ilike("question", `%${search}%`);
  }

  // Sort
  if (sortBy === "priority") {
    // Priority order: high > medium > low > null, then by date
    query = query.order("created_at", { ascending: false });
  } else {
    query = query.order("created_at", { ascending: false });
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

  let enriched = (data || []).map((r) => ({
    ...r,
    ai_bots: Array.isArray(r.ai_bots) ? r.ai_bots[0] ?? null : r.ai_bots,
    users: usersMap[r.user_id] || null,
  }));

  // Deduplicate: same user asking the same question at the same time (e.g. seeded/duplicated data)
  const seenDuplicates = new Set<string>();
  enriched = enriched.filter((r) => {
    const key = `${r.user_id}|${r.created_at}|${r.question}`;
    if (seenDuplicates.has(key)) return false;
    seenDuplicates.add(key);
    return true;
  });

  // Bot list computed before applying the bot filter (used to populate the "bot" filter dropdown)
  const botsMap = new Map<string, { id: string; name: string }>();
  for (const r of enriched) {
    if (r.ai_bots) botsMap.set(r.ai_bots.id, { id: r.ai_bots.id, name: r.ai_bots.name });
  }

  if (botFilter && botFilter !== "all") {
    enriched = enriched.filter((r) => r.ai_bots?.id === botFilter);
  }

  // Client-side priority sort (since Supabase can't sort nulls last with custom order easily)
  if (sortBy === "priority") {
    const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
    enriched = enriched.sort((a, b) => {
      const pa = a.priority ? priorityOrder[a.priority] ?? 3 : 3;
      const pb = b.priority ? priorityOrder[b.priority] ?? 3 : 3;
      if (pa !== pb) return pa - pb;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }

  const total = enriched.length;
  const from = (page - 1) * limit;
  const paged = enriched.slice(from, from + limit);

  return NextResponse.json({
    questions: paged,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    bots: Array.from(botsMap.values()),
  });
}

// PATCH: Set priority for a question
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
      .from("unanswered_questions")
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
