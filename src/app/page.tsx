import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function Home() {
  const session = await auth();
  if (session) {
    if (session.user.role === "admin") {
      redirect("/admin");
    }
    if (session.user.roleType === "manager") {
      redirect("/reports/analysis");
    }
    redirect("/chat");
  }
  redirect("/login");
}
