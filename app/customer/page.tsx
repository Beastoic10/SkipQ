import { LogoutButton } from "@/app/auth/logout-button";
import { requireCustomer } from "@/lib/auth/session";

export default async function CustomerHomePage() {
  const context = await requireCustomer();

  return (
    <main className="min-h-screen bg-orange-50 p-6">
      <section className="mx-auto max-w-3xl rounded-3xl bg-white p-8 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-700">Customer</p>
            <h1 className="mt-2 text-3xl font-bold text-zinc-950">Welcome to SkipQ</h1>
            <p className="mt-3 text-zinc-600">Authentication is active. Ordering screens will be added in a later milestone.</p>
            <p className="mt-4 text-sm text-zinc-500">Signed in as {context.email ?? context.userId}</p>
          </div>
          <LogoutButton />
        </div>
      </section>
    </main>
  );
}
