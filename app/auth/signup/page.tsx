import { AuthForm } from "../auth-form";
import { signup } from "../actions";

export default function SignupPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-orange-50 px-4 py-12">
      <section className="w-full max-w-md space-y-6">
        <div className="space-y-2 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-700">SkipQ</p>
          <h1 className="text-3xl font-bold text-zinc-950">Create customer account</h1>
          <p className="text-sm text-zinc-600">Signup always creates a customer account. Admin and shop staff roles are assigned separately by trusted operators.</p>
        </div>
        <AuthForm mode="signup" action={signup} />
      </section>
    </main>
  );
}
