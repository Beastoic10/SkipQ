import Link from "next/link";
import { requireCustomer } from "@/lib/auth/session";

export default async function CustomerHomePage() {
  const context = await requireCustomer();
  const displayName = context.profile?.display_name ?? context.email ?? "SkipQ customer";

  return (
    <main className="min-h-screen bg-orange-50 px-4 py-6 sm:px-6 lg:px-8">
      <section className="mx-auto flex max-w-5xl flex-col gap-6 rounded-[2rem] border border-orange-100 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-700">SkipQ Customer</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-zinc-950 sm:text-4xl">Welcome, {displayName}</h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-zinc-600">
              Start by choosing your university, then narrow the list to available cafeterias and shops.
            </p>
          </div>
        </div>

        <div className="rounded-3xl bg-orange-50 p-5 sm:p-6">
          <h2 className="text-xl font-semibold text-zinc-950">Ready to order?</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">Browse live cafeteria menus, check remaining stock, and explore available items.</p>
          <Link
            href="/customer/university"
            className="mt-5 inline-flex rounded-full bg-orange-600 px-5 py-3 font-semibold text-white transition hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-600 focus:ring-offset-2"
          >
            Select university
          </Link>
        </div>
      </section>
    </main>
  );
}
