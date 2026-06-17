import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import bcrypt from "bcryptjs";
import { v4 as uuid } from "uuid";

// POST - Seed admin user and manager users
export async function POST() {
  const usersToSeed = [
    {
      name: "Admin",
      email: "admin@mail.com",
      password: "Password@123",
      role: "admin",
      role_name: "admin",
    },
    {
      name: "TA Manager",
      email: "tamanager@mail.com",
      password: "@Asdasd123",
      role: "manager",
      role_name: "ta_manager",
    },
    {
      name: "IT Dev Manager",
      email: "itdevmanager@mail.com",
      password: "@Asdasd123",
      role: "manager",
      role_name: "it_dev_manager",
    },
    {
      name: "HC Manager",
      email: "hcmanager@mail.com",
      password: "@Asdasd123",
      role: "manager",
      role_name: "hc_manager",
    },
    {
      name: "Compliance Manager",
      email: "compliancemanager@mail.com",
      password: "@Asdasd123",
      role: "manager",
      role_name: "compliance_manager",
    },
  ];

  let added = 0;
  let errors = [];

  for (const u of usersToSeed) {
    // Check if user already exists
    const { data: existing } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("email", u.email)
      .single();

    if (!existing) {
      // Find role_id
      const { data: roleData } = await supabaseAdmin
        .from("roles")
        .select("id")
        .eq("name", u.role_name)
        .single();
        
      const hashedPassword = await bcrypt.hash(u.password, 10);
      
      const { error } = await supabaseAdmin.from("users").insert({
        id: uuid(),
        name: u.name,
        email: u.email,
        password: hashedPassword,
        role: u.role_name === "admin" ? "admin" : u.role_name,
        role_id: roleData ? roleData.id : null,
      });

      if (error) {
        errors.push({ email: u.email, error: error.message });
      } else {
        added++;
      }
    } else {
      // FIX Update existing role just in case they were migrated with `role='manager'`
      await supabaseAdmin.from("users").update({
        role: u.role_name === "admin" ? "admin" : u.role_name,
      }).eq("email", u.email);
    }
  }

  if (errors.length > 0) {
    return NextResponse.json({ message: `Seeded ${added} users with errors`, errors }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: `Berhasil menambahkan ${added} user baru.` });
}
