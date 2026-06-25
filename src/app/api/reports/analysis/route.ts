import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

function getWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function countByUserId(rows: { user_id: string }[]) {
  const map: Record<string, number> = {};
  rows.forEach((r) => {
    if (r.user_id) map[r.user_id] = (map[r.user_id] || 0) + 1;
  });
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([userId, count]) => ({ userId, count }));
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { role, roleType, botId: sessionBotId } = session.user as {
    role?: string;
    roleType?: string;
    botId?: string;
  };

  if (role !== "admin" && roleType !== "manager") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const botIdParam = searchParams.get("botId");

  const fromDate = fromParam
    ? `${fromParam}T00:00:00.000Z`
    : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const toDate = toParam
    ? toParam.includes("T") ? toParam : `${toParam}T23:59:59.999Z`
    : new Date().toISOString();

  // Effective botId
  const effectiveBotId = role === "admin" ? (botIdParam || null) : (sessionBotId || null);

  // ── Summary counts ──────────────────────────────────────────────────────────
  const buildCountQuery = (table: string) => {
    let q = supabaseAdmin
      .from(table)
      .select("*", { count: "exact", head: true })
      .gte("created_at", fromDate)
      .lte("created_at", toDate);
    if (effectiveBotId) q = q.eq("ai_bot_id", effectiveBotId);
    return q;
  };

  const [sessionsCountRes, feedbackCountRes, unansweredCountRes] = await Promise.all([
    buildCountQuery("chat_sessions"),
    buildCountQuery("feedback_reports"),
    buildCountQuery("unanswered_questions"),
  ]);

  // ── Session IDs (for scoping messages to the bot) ────────────────────────────
  let sessionsQuery = supabaseAdmin
    .from("chat_sessions")
    .select("id")
    .gte("created_at", fromDate)
    .lte("created_at", toDate)
    .limit(5000);
  if (effectiveBotId) sessionsQuery = sessionsQuery.eq("ai_bot_id", effectiveBotId);
  const { data: sessionsData } = await sessionsQuery;
  const sessionIds = (sessionsData || []).map((s) => s.id as string);

  // ── User messages: source for traffic analysis + top questioners ─────────────
  // chat_messages has no ai_bot_id, so we scope via session IDs
  let messagesForTraffic: { user_id: string; created_at: string }[] = [];
  if (sessionIds.length > 0) {
    const chunkSize = 100;
    for (let i = 0; i < sessionIds.length; i += chunkSize) {
      const chunk = sessionIds.slice(i, i + chunkSize);
      const { data: msgs } = await supabaseAdmin
        .from("chat_messages")
        .select("user_id, created_at")
        .eq("role", "user")
        .in("session_id", chunk);
      if (msgs) messagesForTraffic.push(...(msgs as { user_id: string; created_at: string }[]));
    }
  } else if (role === "admin" && !effectiveBotId) {
    // Admin all-bots: directly query user messages in date range
    const { data: msgs } = await supabaseAdmin
      .from("chat_messages")
      .select("user_id, created_at")
      .eq("role", "user")
      .gte("created_at", fromDate)
      .lte("created_at", toDate)
      .limit(5000);
    if (msgs) messagesForTraffic = msgs as { user_id: string; created_at: string }[];
  }

  // ── Response metrics ─────────────────────────────────────────────────────────
  let metricsQuery = supabaseAdmin
    .from("response_metrics")
    .select("total_response_ms, first_token_ms, created_at")
    .gte("created_at", fromDate)
    .lte("created_at", toDate)
    .not("total_response_ms", "is", null)
    .limit(5000);
  if (effectiveBotId) metricsQuery = metricsQuery.eq("ai_bot_id", effectiveBotId);
  const { data: metricsData } = await metricsQuery;

  // ── Response metrics detail (for table view, newest first) ──────────────────
  let metricsDetailQuery = supabaseAdmin
    .from("response_metrics")
    .select("id, total_response_ms, first_token_ms, sources_count, was_unanswered, created_at")
    .gte("created_at", fromDate)
    .lte("created_at", toDate)
    .not("total_response_ms", "is", null)
    .order("created_at", { ascending: false })
    .limit(100);
  if (effectiveBotId) metricsDetailQuery = metricsDetailQuery.eq("ai_bot_id", effectiveBotId);
  const { data: metricsDetailData } = await metricsDetailQuery;

  // ── Feedback & unanswered user lists ─────────────────────────────────────────
  let fbUsersQuery = supabaseAdmin
    .from("feedback_reports")
    .select("user_id")
    .gte("created_at", fromDate)
    .lte("created_at", toDate)
    .limit(5000);
  if (effectiveBotId) fbUsersQuery = fbUsersQuery.eq("ai_bot_id", effectiveBotId);

  let unUsersQuery = supabaseAdmin
    .from("unanswered_questions")
    .select("user_id")
    .gte("created_at", fromDate)
    .lte("created_at", toDate)
    .limit(5000);
  if (effectiveBotId) unUsersQuery = unUsersQuery.eq("ai_bot_id", effectiveBotId);

  const [{ data: fbUsersData }, { data: unUsersData }] = await Promise.all([fbUsersQuery, unUsersQuery]);

  // ── Bot name ─────────────────────────────────────────────────────────────────
  let botName = "Semua Bot";
  if (effectiveBotId) {
    const { data: bot } = await supabaseAdmin
      .from("ai_bots")
      .select("name")
      .eq("id", effectiveBotId)
      .single();
    if (bot) botName = (bot as { name: string }).name;
  }

  // ── Top questioners: reuse messagesForTraffic ─────────────────────────────
  const topQuestionersRaw = countByUserId(messagesForTraffic);

  const topFeedbackRaw = countByUserId((fbUsersData || []) as { user_id: string }[]);
  const topUnansweredRaw = countByUserId((unUsersData || []) as { user_id: string }[]);

  // ── Enrich user info ─────────────────────────────────────────────────────────
  const allUserIds = [
    ...new Set([
      ...topQuestionersRaw.map((u) => u.userId),
      ...topFeedbackRaw.map((u) => u.userId),
      ...topUnansweredRaw.map((u) => u.userId),
    ]),
  ].filter(Boolean);

  let usersMap: Record<string, { name: string; email: string }> = {};
  if (allUserIds.length > 0) {
    const { data: usersData } = await supabaseAdmin
      .from("users")
      .select("id, name, email")
      .in("id", allUserIds);
    if (usersData) {
      usersMap = Object.fromEntries(
        (usersData as { id: string; name: string; email: string }[]).map((u) => [
          u.id,
          { name: u.name, email: u.email },
        ])
      );
    }
  }

  const enrichUsers = (raw: { userId: string; count: number }[]) =>
    raw.map(({ userId, count }) => ({
      userId,
      name: usersMap[userId]?.name || "-",
      email: usersMap[userId]?.email || "-",
      count,
    }));

  // ── Response time KPIs ───────────────────────────────────────────────────────
  const responseTimes = (metricsData || [])
    .map((m) => m.total_response_ms as number)
    .filter((v) => v > 0)
    .sort((a, b) => a - b);

  const avgResponseMs =
    responseTimes.length > 0
      ? Math.round(responseTimes.reduce((s, v) => s + v, 0) / responseTimes.length)
      : null;
  const p95ResponseMs =
    responseTimes.length > 0
      ? responseTimes[Math.floor(responseTimes.length * 0.95)] ?? null
      : null;

  // ── Response time series (daily avg + p95) ───────────────────────────────────
  const rtByDay: Record<string, number[]> = {};
  (metricsData || []).forEach((m) => {
    if (!m.total_response_ms) return;
    const day = (m.created_at as string).slice(0, 10);
    if (!rtByDay[day]) rtByDay[day] = [];
    rtByDay[day].push(m.total_response_ms as number);
  });
  const responseTimeSeries = Object.entries(rtByDay)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([label, vals]) => {
      const sorted = [...vals].sort((a, b) => a - b);
      return {
        label,
        avgMs: Math.round(sorted.reduce((s, v) => s + v, 0) / sorted.length),
        p95Ms: sorted[Math.floor(sorted.length * 0.95)] ?? null,
      };
    });

  // ── Traffic aggregations (based on user chat messages, not sessions) ─────────
  const hourlyMap: Record<number, number> = {};
  messagesForTraffic.forEach((m) => {
    const hour = new Date(m.created_at).getHours();
    hourlyMap[hour] = (hourlyMap[hour] || 0) + 1;
  });
  const hourlyTraffic = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    label: `${h}:00`,
    count: hourlyMap[h] || 0,
  }));

  const dailyMap: Record<string, number> = {};
  messagesForTraffic.forEach((m) => {
    const day = m.created_at.slice(0, 10);
    dailyMap[day] = (dailyMap[day] || 0) + 1;
  });
  const dailyTraffic = Object.entries(dailyMap)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([label, count]) => ({ label, count }));

  const weeklyMap: Record<string, number> = {};
  messagesForTraffic.forEach((m) => {
    const d = new Date(m.created_at);
    const key = `${d.getFullYear()}-W${String(getWeekNumber(d)).padStart(2, "0")}`;
    weeklyMap[key] = (weeklyMap[key] || 0) + 1;
  });
  const weeklyTraffic = Object.entries(weeklyMap)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([label, count]) => ({ label, count }));

  const monthlyMap: Record<string, number> = {};
  messagesForTraffic.forEach((m) => {
    const month = m.created_at.slice(0, 7);
    monthlyMap[month] = (monthlyMap[month] || 0) + 1;
  });
  const monthlyTraffic = Object.entries(monthlyMap)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([label, count]) => ({ label, count }));

  return NextResponse.json({
    summary: {
      totalMessages: messagesForTraffic.length,
      totalFeedback: feedbackCountRes.count || 0,
      totalUnanswered: unansweredCountRes.count || 0,
      avgResponseMs,
      p95ResponseMs,
    },
    responseTimeSeries,
    hourlyTraffic,
    dailyTraffic,
    weeklyTraffic,
    monthlyTraffic,
    topQuestioners: enrichUsers(topQuestionersRaw),
    topFeedbackUsers: enrichUsers(topFeedbackRaw),
    topUnansweredUsers: enrichUsers(topUnansweredRaw),
    responseTimeDetail: (metricsDetailData || []).map((m) => ({
      id: (m as { id: string }).id,
      created_at: m.created_at,
      total_response_ms: m.total_response_ms,
      first_token_ms: (m as { first_token_ms: number | null }).first_token_ms ?? null,
      sources_count: (m as { sources_count: number }).sources_count,
      was_unanswered: (m as { was_unanswered: boolean }).was_unanswered,
    })),
    botName,
    from: fromDate,
    to: toDate,
  });
}
