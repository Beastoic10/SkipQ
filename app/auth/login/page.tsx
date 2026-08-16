import { AuthForm } from "../auth-form";
import { login } from "../actions";

type LoginPageProps = {
  searchParams: Promise<{ message?: string; redirectTo?: string }>;
};

const messages: Record<string, string> = {
  "session-required": "Please log in to continue.",
  unauthorized: "You are not authorized for that area. Sign in with an authorized account.",
  "signed-out": "You have been signed out.",
  "callback-error": "Authentication callback failed. Please try logging in again.",
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const message = params.message ? messages[params.message] : null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-orange-50 px-4 py-12">
      <section className="w-full max-w-md space-y-6">
        <div className="space-y-2 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-700">SkipQ</p>
          <h1 className="text-3xl font-bold text-zinc-950">Log in</h1>
          <p className="text-sm text-zinc-600">Use your Supabase Auth email and password to continue.</p>
        </div>
        {message ? <p className="rounded-2xl bg-white px-4 py-3 text-center text-sm text-zinc-700 shadow-sm">{message}</p> : null}
        <AuthForm mode="login" action={login} redirectTo={params.redirectTo} />
      </section>
    </main>
  );
}
