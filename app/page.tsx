import Link from "next/link";
import { getCurrentUserContext, getPostLoginPath } from "@/lib/auth/session";
import { LogoutButton } from "./auth/logout-button";

export default async function Home() {
  const context = await getCurrentUserContext();

  return (
    <main className="flex min-h-screen items-center justify-center bg-orange-50 px-4 py-12">
      <section className="w-full max-w-3xl rounded-3xl bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-700">SkipQ</p>
        <h1 className="mt-3 max-w-2xl text-4xl font-bold tracking-tight text-zinc-950">Cafeteria ordering without the queue.</h1>
        <p className="mt-4 max-w-2xl text-zinc-600">Supabase authentication, profile initialization, role resolution, and server-side route protection are now wired for the MVP foundation.</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          {context ? (
            <>
              <Link href={getPostLoginPath(context.roles, context.terminalAccount?.shop_id)} className="rounded-full bg-orange-600 px-5 py-3 text-center font-semibold text-white hover:bg-orange-700">Continue</Link>
              <LogoutButton />
            </>
          ) : (
            <>
              <Link href="/auth/login" className="rounded-full bg-orange-600 px-5 py-3 text-center font-semibold text-white hover:bg-orange-700">Log in</Link>
              <Link href="/auth/signup" className="rounded-full border border-orange-200 px-5 py-3 text-center font-semibold text-orange-700 hover:border-orange-300">Create customer account</Link>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
