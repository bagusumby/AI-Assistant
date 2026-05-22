import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { v4 as uuid } from "uuid";
import db from "@/lib/db";

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
    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
    if (existing) {
      return NextResponse.json({ error: "Email sudah terdaftar" }, { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const id = uuid();

    db.prepare("INSERT INTO users (id, name, email, password) VALUES (?, ?, ?, ?)").run(
      id, name, email, hashedPassword
    );

    return NextResponse.json({ success: true, message: "Registrasi berhasil" });
  } catch (error) {
    return NextResponse.json({ error: "Gagal registrasi" }, { status: 500 });
  }
}
