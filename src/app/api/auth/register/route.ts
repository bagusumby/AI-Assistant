import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { v4 as uuid } from "uuid";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const { name, email, password } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: "Semua field wajib diisi" }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "Password minimal 6 karakter" }, { status: 400 });
    }

    // Check existing user
    const { data: existing } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("email", email)
      .single();

    if (existing) {
      return NextResponse.json({ error: "Email sudah terdaftar" }, { status: 409 });
    }

    // Get 'user' role id
    const { data: userRole } = await supabaseAdmin
      .from("roles")
      .select("id")
      .eq("name", "user")
      .single();

    const hashedPassword = await bcrypt.hash(password, 10);
    const id = uuid();

    const { error } = await supabaseAdmin.from("users").insert({
      id,
      name,
      email,
      password: hashedPassword,
      role: "user",
      role_id: userRole?.id ?? null,
    });

    if (error) {
      return NextResponse.json({ error: "Gagal registrasi: " + error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Registrasi berhasil" });
  } catch {
    return NextResponse.json({ error: "Gagal registrasi" }, { status: 500 });
  }
}
