import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [usersRes, filesRes, chunksRes, sessionsRes, messagesRes] = await Promise.all([
    supabaseAdmin.from("users").select("*", { count: "exact", head: true }),
    supabaseAdmin.from("uploaded_files").select("*", { count: "exact", head: true }),
    supabaseAdmin.from("documents").select("*", { count: "exact", head: true }),
    supabaseAdmin.from("chat_sessions").select("*", { count: "exact", head: true }),
    supabaseAdmin.from("chat_messages").select("*", { count: "exact", head: true }),
  ]);

  return NextResponse.json({
    totalUsers: usersRes.count || 0,
    totalFiles: filesRes.count || 0,
    totalChunks: chunksRes.count || 0,
    totalSessions: sessionsRes.count || 0,
    totalMessages: messagesRes.count || 0,
  });
}
