import Link from "next/link";
import { LogoutButton } from "@/app/auth/logout-button";
import { requireShopStaff } from "@/lib/auth/session";

export default async function TerminalHomePage() {
  const context = await requireShopStaff();

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-white">
      <section className="mx-auto max-w-3xl rounded-3xl bg-white p-8 text-zinc-950 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-700">Terminal</p>
            <h1 className="mt-2 text-3xl font-bold">Shop terminal access verified</h1>
            <p className="mt-3 text-zinc-600">Terminal dashboard functionality is intentionally not implemented in this milestone.</p>
            <p className="mt-4 text-sm text-zinc-500">Authorized shop memberships: {context.shopMemberships.length}</p>
          </div>
          <LogoutButton />
        </div>
        <div className="mt-6 space-y-2">
          {context.shopMemberships.map((membership) => (
            <Link key={membership.id} href={`/terminal/${membership.shop_id}`} className="block rounded-2xl border border-zinc-200 px-4 py-3 text-sm font-medium text-zinc-700 hover:border-orange-300 hover:text-orange-700">
              Open protected shop route {membership.shop_id}
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
