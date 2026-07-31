import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import ConfigClient from "./ConfigClient";

export default async function ResponseConfigPage() {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.role !== "admin") redirect("/chat");

  return <ConfigClient />;
}
