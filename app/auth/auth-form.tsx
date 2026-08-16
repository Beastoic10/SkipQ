"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { AuthActionState } from "./actions";

type AuthFormProps = {
  mode: "login" | "signup";
  action: (previousState: AuthActionState, formData: FormData) => Promise<AuthActionState>;
  redirectTo?: string;
};

const initialState: AuthActionState = {};

export function AuthForm({ mode, action, redirectTo }: AuthFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const isSignup = mode === "signup";

  return (
    <form action={formAction} className="space-y-4 rounded-3xl border border-orange-100 bg-white p-6 shadow-sm">
      {redirectTo ? <input type="hidden" name="redirectTo" value={redirectTo} /> : null}
      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium text-zinc-800">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-zinc-950 outline-none focus:border-orange-500" />
      </div>
      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-medium text-zinc-800">Password</label>
        <input id="password" name="password" type="password" autoComplete={isSignup ? "new-password" : "current-password"} required minLength={6} className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-zinc-950 outline-none focus:border-orange-500" />
      </div>
      {isSignup ? (
        <div className="space-y-2">
          <label htmlFor="confirmPassword" className="text-sm font-medium text-zinc-800">Confirm password</label>
          <input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required minLength={6} className="w-full rounded-2xl border border-zinc-200 px-4 py-3 text-zinc-950 outline-none focus:border-orange-500" />
        </div>
      ) : null}
      {state.error ? <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</p> : null}
      {state.message ? <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{state.message}</p> : null}
      <button type="submit" disabled={pending} className="w-full rounded-full bg-orange-600 px-5 py-3 font-semibold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-70">
        {pending ? "Please wait…" : isSignup ? "Create customer account" : "Log in"}
      </button>
      <p className="text-center text-sm text-zinc-600">
        {isSignup ? "Already have an account?" : "Need a customer account?"}{" "}
        <Link href={isSignup ? "/auth/login" : "/auth/signup"} className="font-semibold text-orange-700 hover:text-orange-800">
          {isSignup ? "Log in" : "Sign up"}
        </Link>
      </p>
    </form>
  );
}
