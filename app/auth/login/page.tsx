import { AuthForm } from "../auth-form";
import { login } from "../actions";
import Link from "next/link";

type LoginPageProps = {
  searchParams: Promise<{ message?: string; redirectTo?: string }>;
};

const messages: Record<string, string> = {
  "session-required": "Please sign in to continue.",
  unauthorized:
    "You don't have access to that page. Please sign in with an authorized account.",
  "signed-out": "You've been signed out.",
  "callback-error":
    "Something went wrong during sign-in. Please try again.",
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const message = params.message ? messages[params.message] : null;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#FAF9F6] px-4 py-12">
      <section className="w-full max-w-md space-y-6">
        {/* Brand */}
        <div className="text-center">
          <Link
            href="/"
            className="group inline-flex items-center gap-2.5 rounded-full focus:outline-none focus:ring-2 focus:ring-orange-600 focus:ring-offset-2"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-600 font-black text-white shadow-md shadow-orange-600/30 transition group-hover:scale-105">
              Q
            </div>
            <span className="text-2xl font-black tracking-tight text-zinc-950">
              Skip<span className="text-orange-600">Q</span>
            </span>
          </Link>
          <h1 className="mt-4 text-2xl font-black text-zinc-950">
            Welcome back
          </h1>
          <p className="mt-1 text-xs text-zinc-500">
            Sign in to order food or manage your counter queue.
          </p>
        </div>

        {message ? (
          <div className="rounded-2xl bg-white border border-zinc-200 px-4 py-3 text-center text-xs font-semibold text-zinc-700 shadow-sm">
            {message}
          </div>
        ) : null}

        <AuthForm mode="login" action={login} redirectTo={params.redirectTo} />
      </section>
    </main>
  );
}
