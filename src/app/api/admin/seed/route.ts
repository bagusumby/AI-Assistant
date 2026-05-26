import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import bcrypt from "bcryptjs";
import { v4 as uuid } from "uuid";

// POST - Seed admin user (run once)
export async function POST() {
  const adminEmail = "admin@mail.com";
  const adminPassword = "Password@123";
  const adminName = "Admin";

  // Check if admin already exists
  const { data: existing } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("email", adminEmail)
    .single();

  if (existing) {
    return NextResponse.json({ message: "Admin sudah ada", exists: true });
  }

  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  const { error } = await supabaseAdmin.from("users").insert({
    id: uuid(),
    name: adminName,
    email: adminEmail,
    password: hashedPassword,
    role: "admin",
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: "Admin berhasil dibuat" });
}
