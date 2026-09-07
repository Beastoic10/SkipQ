import Link from "next/link";
import { getCurrentUserContext, getPostLoginPath } from "@/lib/auth/session";
import { LogoutButton } from "./auth/logout-button";

export default async function Home() {
  const context = await getCurrentUserContext();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#FAF9F6] px-4 py-16 selection:bg-orange-500 selection:text-white">
      {/* Brand mark & Hero Title */}
      <div className="mb-10 text-center max-w-xl">
        <div className="inline-flex items-center gap-2.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-600 font-black text-white shadow-lg shadow-orange-600/30">
            Q
          </div>
          <span className="text-3xl font-black tracking-tight text-zinc-950">
            Skip<span className="text-orange-600">Q</span>
          </span>
        </div>

        <h1 className="mt-5 text-4xl font-black tracking-tight text-zinc-950 sm:text-5xl">
          Skip the queue. <br />
          <span className="text-orange-600">Pick up hot meals.</span>
        </h1>
        <p className="mt-3 text-base leading-7 text-zinc-600">
          Order ahead from your campus cafeterias. Choose what you want, pay at collection, and never stand in line again.
        </p>
      </div>

      {context ? (
        /* ── Authenticated state ──────────────────────────────────── */
        <div className="w-full max-w-sm space-y-4 rounded-3xl border border-zinc-200/80 bg-white p-6 shadow-sm text-center">
          <div className="text-xs font-bold uppercase tracking-wider text-orange-600">
            Active Session
          </div>
          <p className="text-sm font-bold text-zinc-900">
            Signed in as <span className="text-orange-700">{context.profile?.display_name ?? context.email}</span>
          </p>
          <Link
            href={getPostLoginPath(
              context.roles,
              context.terminalAccount?.shop_id
            )}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-orange-600 px-6 py-3.5 text-sm font-bold text-white shadow-md shadow-orange-600/20 transition hover:bg-orange-700 active:scale-95"
          >
            <span>Continue to App</span>
            <span>→</span>
          </Link>
          <div className="flex justify-center pt-1">
            <LogoutButton />
          </div>
        </div>
      ) : (
        /* ── Role Selection Cards ─────────────────────────────────── */
        <div className="w-full max-w-xl space-y-4">
          {/* Student Card */}
          <div className="rounded-3xl border-2 border-orange-500/30 bg-white p-6 shadow-sm hover:shadow-md transition">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-2xl text-orange-600">
                  🎓
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-black text-zinc-950">Student Ordering</h2>
                    <span className="inline-flex rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-bold text-orange-700 border border-orange-100">
                      Primary
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-zinc-500">
                    Browse campus menus, place order with cash on pickup, and collect with a digital QR code.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 flex items-center gap-3">
              <Link
                href="/auth/login"
                className="inline-flex items-center justify-center rounded-full bg-orange-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm shadow-orange-600/20 hover:bg-orange-700 active:scale-95 transition"
              >
                Sign In
              </Link>
              <Link
                href="/auth/signup"
                className="inline-flex items-center justify-center rounded-full border border-zinc-200 px-5 py-2.5 text-xs font-bold text-zinc-700 hover:bg-zinc-50 transition"
              >
                Create Student Account
              </Link>
            </div>
          </div>

          {/* Terminal / Counter Staff Card */}
          <div className="rounded-3xl border border-zinc-200/80 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-zinc-100 text-2xl text-zinc-700">
                  🖥️
                </div>
                <div>
                  <h2 className="text-base font-black text-zinc-950">Counter Terminal</h2>
                  <p className="mt-1 text-xs leading-5 text-zinc-500">
                    Cafeteria staff kiosk. Live order stream, QR scanner, and queue management.
                  </p>
                </div>
              </div>

              <Link
                href="/auth/login"
                className="shrink-0 inline-flex items-center rounded-full border border-zinc-200 px-4 py-2 text-xs font-bold text-zinc-700 hover:bg-zinc-50 transition"
              >
                Staff Login
              </Link>
            </div>
          </div>

          {/* Admin link */}
          <div className="flex items-center justify-center py-2 text-center text-xs text-zinc-400">
            <span>Administrator?</span>
            <Link
              href="/auth/login"
              className="ml-1.5 font-bold text-zinc-600 underline hover:text-zinc-900"
            >
              Admin Sign In
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}
