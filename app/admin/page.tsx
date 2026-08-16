import { LogoutButton } from "@/app/auth/logout-button";
import { requireAdmin } from "@/lib/auth/session";

export default async function AdminHomePage() {
  const context = await requireAdmin();

  return (
    <main className="min-h-screen bg-zinc-50 p-6">
      <section className="mx-auto max-w-3xl rounded-3xl bg-white p-8 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-700">Admin</p>
            <h1 className="mt-2 text-3xl font-bold text-zinc-950">Admin access verified</h1>
            <p className="mt-3 text-zinc-600">Administrative dashboard functionality is intentionally not implemented in this milestone.</p>
            <p className="mt-4 text-sm text-zinc-500">Signed in as {context.email ?? context.userId}</p>
          </div>
          <LogoutButton />
        </div>
      </section>
    </main>
  );
}
