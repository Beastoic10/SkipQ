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
    <form
      action={formAction}
      className="space-y-4 rounded-3xl border border-zinc-200/80 bg-white p-6 shadow-sm sm:p-8"
    >
      {redirectTo ? (
        <input type="hidden" name="redirectTo" value={redirectTo} />
      ) : null}

      <div className="space-y-1">
        <label htmlFor="email" className="text-xs font-bold text-zinc-700">
          Email Address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="student@university.edu"
          className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-950 placeholder:text-zinc-400 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10"
        />
      </div>

      <div className="space-y-1">
        <label
          htmlFor="password"
          className="text-xs font-bold text-zinc-700"
        >
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete={isSignup ? "new-password" : "current-password"}
          required
          minLength={6}
          placeholder={isSignup ? "At least 6 characters" : "••••••••"}
          className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-950 placeholder:text-zinc-400 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10"
        />
      </div>

      {isSignup ? (
        <div className="space-y-1">
          <label
            htmlFor="confirmPassword"
            className="text-xs font-bold text-zinc-700"
          >
            Confirm Password
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            placeholder="••••••••"
            className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-950 placeholder:text-zinc-400 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10"
          />
        </div>
      ) : null}

      {state.error ? (
        <div
          role="alert"
          className="rounded-2xl bg-rose-50 border border-rose-100 p-3.5 text-xs font-medium text-rose-800"
        >
          {state.error}
        </div>
      ) : null}

      {state.message ? (
        <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-3.5 text-xs font-medium text-emerald-800">
          {state.message}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-orange-600 px-5 py-3.5 text-xs font-bold text-white shadow-md shadow-orange-600/20 transition hover:bg-orange-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending
          ? isSignup
            ? "Creating account…"
            : "Signing in…"
          : isSignup
          ? "Create Student Account"
          : "Sign In"}
      </button>

      <p className="text-center text-xs text-zinc-500 pt-2">
        {isSignup ? "Already have an account?" : "New to SkipQ?"}{" "}
        <Link
          href={isSignup ? "/auth/login" : "/auth/signup"}
          className="font-bold text-orange-600 hover:text-orange-700"
        >
          {isSignup ? "Sign In" : "Create Account"}
        </Link>
      </p>
    </form>
  );
}
