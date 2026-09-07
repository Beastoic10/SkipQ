import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { AdminNav } from "./admin-nav";

export const metadata = {
  title: "SkipQ Admin Panel",
  description: "Administrative management and oversight for SkipQ campus dining network.",
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const context = await requireAdmin();
  const supabase = await createClient();

  // Fetch pending approval count for real-time badge in navigation
  const [pendingCafs, pendingShops] = await Promise.all([
    supabase.from("cafeterias").select("id", { count: "exact", head: true }).eq("approval_status", "PENDING"),
    supabase.from("shops").select("id", { count: "exact", head: true }).eq("approval_status", "PENDING"),
  ]);
  const pendingApprovalsCount = (pendingCafs.count ?? 0) + (pendingShops.count ?? 0);

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-900 antialiased">
      {/* Sidebar Navigation */}
      <AdminNav
        userEmail={context.email}
        pendingApprovalsCount={pendingApprovalsCount}
      />

      {/* Main Content Area */}
      <div className="flex min-h-screen flex-col md:pl-72">
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">
            {children}
          </div>
        </main>

        <footer className="border-t border-zinc-200 bg-white px-6 py-4 text-center text-xs text-zinc-600 md:text-left">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 sm:flex-row">
            <p>© {new Date().getFullYear()} SkipQ Campus Ordering Platform. Administrative Console.</p>
            <p className="text-[11px] text-zinc-600 font-mono">Role: admin • Session: verified</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
