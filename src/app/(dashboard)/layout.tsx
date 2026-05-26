import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Sidebar } from "@/components/ui/Sidebar";
import { PendingActionProvider } from "@/lib/PendingActionContext";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <PendingActionProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar user={{ ...session.user!, role: session.user.role }} />
        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
    </PendingActionProvider>
  );
}
