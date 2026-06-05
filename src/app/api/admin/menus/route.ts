import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { v4 as uuid } from "uuid";

const DEFAULT_MENUS = [
  { label: "Chat", path: "/chat", icon: "chat", sort_order: 1 },
  { label: "Upload", path: "/upload", icon: "upload", sort_order: 2 },
  { label: "Laporan Feedback", path: "/reports/feedback", icon: "feedback", sort_order: 3 },
  { label: "Pertanyaan Tak Terjawab", path: "/reports/unanswered", icon: "unanswered", sort_order: 4 },
  { label: "Manajemen User", path: "/admin/users", icon: "users", sort_order: 5 },
  { label: "Manajemen Role", path: "/admin/roles", icon: "roles", sort_order: 6 },
  { label: "Manajemen Bot", path: "/admin/bots", icon: "bots", sort_order: 7 },
];

// GET - List all menus (auto-seed defaults if empty)
export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("menus")
    .select("id, label, path, icon, sort_order, created_at")
    .order("sort_order", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data || data.length === 0) {
    // Auto-seed default menus so FK constraints work for permissions
    const toInsert = DEFAULT_MENUS.map((m) => ({ id: uuid(), ...m }));
    const { data: seeded, error: seedErr } = await supabaseAdmin
      .from("menus")
      .insert(toInsert)
      .select("id, label, path, icon, sort_order, created_at");
    if (seedErr) {
      // Table may not exist yet — return in-memory defaults with stable IDs
      return NextResponse.json(toInsert);
    }
    return NextResponse.json(seeded || toInsert);
  }

  return NextResponse.json(data);
}

// POST - Create new menu
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { label, path, icon, sort_order } = await req.json();

  if (!label || !path) {
    return NextResponse.json({ error: "label dan path wajib diisi" }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("menus").insert({
    id: uuid(),
    label,
    path,
    icon: icon || "default",
    sort_order: sort_order ?? 99,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
