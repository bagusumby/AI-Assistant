import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import bcrypt from "bcryptjs";
import { v4 as uuid } from "uuid";

// GET - List all users with roles
export async function GET() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: users, error } = await supabaseAdmin
    .from("users")
    .select("id, name, email, role, role_id, created_at, roles(id, name, label, type)")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Also return all roles for the dropdown
  const { data: roles } = await supabaseAdmin
    .from("roles")
    .select("id, name, label, type")
    .order("type", { ascending: true });

  return NextResponse.json({ users: users || [], roles: roles || [] });
}

// POST - Create user
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, email, password, role } = await req.json();

  if (!name || !email || !password) {
    return NextResponse.json({ error: "Semua field wajib diisi" }, { status: 400 });
  }

  if (password.length < 6) {
    return NextResponse.json({ error: "Password minimal 6 karakter" }, { status: 400 });
  }

  // Check existing
  const { data: existing } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("email", email)
    .single();

  if (existing) {
    return NextResponse.json({ error: "Email sudah terdaftar" }, { status: 409 });
  }

  // Get role_id from roles table
  const roleSlug = role || "user";
  const { data: roleData } = await supabaseAdmin
    .from("roles")
    .select("id")
    .eq("name", roleSlug)
    .single();

  const hashedPassword = await bcrypt.hash(password, 10);

  const { error } = await supabaseAdmin.from("users").insert({
    id: uuid(),
    name,
    email,
    password: hashedPassword,
    role: roleSlug,
    role_id: roleData?.id ?? null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// PUT - Update user
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, name, email, password, role } = await req.json();

  if (!id || !name || !email) {
    return NextResponse.json({ error: "Field wajib tidak lengkap" }, { status: 400 });
  }

  // Check email uniqueness (exclude current user)
  const { data: existing } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("email", email)
    .neq("id", id)
    .single();

  if (existing) {
    return NextResponse.json({ error: "Email sudah digunakan user lain" }, { status: 409 });
  }

  // Get role_id from roles table
  const roleSlug = role || "user";
  const { data: roleData } = await supabaseAdmin
    .from("roles")
    .select("id")
    .eq("name", roleSlug)
    .single();

  const updateData: Record<string, unknown> = {
    name,
    email,
    role: roleSlug,
    role_id: roleData?.id ?? null,
  };

  if (password && password.length >= 6) {
    updateData.password = await bcrypt.hash(password, 10);
  }

  const { error } = await supabaseAdmin
    .from("users")
    .update(updateData)
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// DELETE - Delete user
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("id");

  if (!userId) {
    return NextResponse.json({ error: "User ID required" }, { status: 400 });
  }

  // Prevent self-deletion
  if (userId === session.user.id) {
    return NextResponse.json({ error: "Tidak bisa menghapus akun sendiri" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("users")
    .delete()
    .eq("id", userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
