import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

function getFallbackMenus(roleSlug: string | undefined) {
  if (roleSlug === "admin") {
    return [
      { id: "1", label: "Chat", path: "/chat", icon: "chat", sort_order: 1 },
      { id: "2", label: "Upload", path: "/upload", icon: "upload", sort_order: 2 },
      { id: "3", label: "Manajemen User", path: "/admin/users", icon: "users", sort_order: 3 },
      { id: "4", label: "Manajemen Role", path: "/admin/roles", icon: "roles", sort_order: 4 },
      { id: "5", label: "Manajemen Bot", path: "/admin/bots", icon: "bots", sort_order: 5 },
    ];
  } else if (roleSlug === "user") {
    return [{ id: "1", label: "Chat", path: "/chat", icon: "chat", sort_order: 1 }];
  } else {
    // Manager fallback
    return [
      { id: "1", label: "Chat", path: "/chat", icon: "chat", sort_order: 1 },
      { id: "2", label: "Upload", path: "/upload", icon: "upload", sort_order: 2 },
    ];
  }
}

// GET - list menus for current user's role
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const roleSlug = session.user.role;
  const roleId = session.user.roleId ?? null;

  // If no roleId, always use fallback
  if (!roleId) {
    return NextResponse.json(getFallbackMenus(roleSlug));
  }

  // Get menu IDs for this role
  const { data: perms, error: permErr } = await supabaseAdmin
    .from("role_menu_permissions")
    .select("menu_id")
    .eq("role_id", roleId);

  if (permErr || !perms || perms.length === 0) {
    return NextResponse.json(getFallbackMenus(roleSlug));
  }

  const menuIds = perms.map((p: { menu_id: string }) => p.menu_id);

  const { data: menuData, error: menuErr } = await supabaseAdmin
    .from("menus")
    .select("id, label, path, icon, sort_order")
    .in("id", menuIds)
    .order("sort_order", { ascending: true });

  if (menuErr || !menuData || menuData.length === 0) {
    return NextResponse.json(getFallbackMenus(roleSlug));
  }

  return NextResponse.json(menuData);
}
