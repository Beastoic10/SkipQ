"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getPostLoginPath, getCurrentUserContext } from "@/lib/auth/session";

export type AuthActionState = {
  error?: string;
  message?: string;
};

function sanitizeRedirectPath(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return null;
  }

  return value;
}

function getCredentials(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  return { email, password };
}

function getOrigin() {
  const appUrl = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (!appUrl) return "http://localhost:3000";
  return appUrl.startsWith("http") ? appUrl : `https://${appUrl}`;
}

function getSafeAuthError(message?: string) {
  const normalized = message?.toLowerCase() ?? "";

  if (normalized.includes("email not confirmed")) return "Please confirm your email before signing in.";
  if (normalized.includes("invalid login credentials")) return "Invalid email or password.";
  if (normalized.includes("already registered") || normalized.includes("already exists")) {
    return "An account already exists for this email. Try logging in instead.";
  }

  return "Authentication failed. Please check your details and try again.";
}

function getAuthErrorDiagnostics(error: { message?: string; status?: number; code?: string }) {
  return {
    message: error.message ?? "Unknown Supabase Auth error",
    status: error.status ?? null,
    code: error.code ?? null,
  };
}

function getSignupAuthErrorMessage(error: { message?: string; status?: number; code?: string }) {
  const diagnostics = getAuthErrorDiagnostics(error);

  if (process.env.NODE_ENV !== "production") {
    console.error("Supabase signup error", diagnostics);
    return diagnostics.message;
  }

  return getSafeAuthError(error.message);
}

export async function login(_previousState: AuthActionState, formData: FormData) {
  const supabase = await createClient();
  const { email, password } = getCredentials(formData);
  const redirectTo = sanitizeRedirectPath(formData.get("redirectTo"));

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: getSafeAuthError(error.message) };
  }

  const context = await getCurrentUserContext();
  redirect(redirectTo ?? getPostLoginPath(context?.roles ?? []));
}

export async function signup(_previousState: AuthActionState, formData: FormData) {
  const supabase = await createClient();
  const { email, password } = getCredentials(formData);
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!email || !password || !confirmPassword) {
    return { error: "Email, password, and password confirmation are required." };
  }

  if (password !== confirmPassword) {
    return { error: "Passwords do not match." };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${getOrigin()}/auth/callback`,
    },
  });

  if (error) {
    return { error: getSignupAuthErrorMessage(error) };
  }

  if (!data.user) {
    return { error: "Signup could not be completed. Please try again." };
  }

  const admin = createAdminClient();
  const { error: profileError } = await admin
    .from("profiles")
    .upsert({ id: data.user.id }, { onConflict: "id" });

  if (profileError) {
    return { error: "Account created, but profile setup failed. Please contact support." };
  }

  const { data: customerRole, error: roleError } = await admin
    .from("roles")
    .select("id")
    .eq("name", "customer")
    .maybeSingle();

  if (roleError || !customerRole) {
    return { error: "Account created, but role setup failed. Please contact support." };
  }

  const { data: existingCustomerRole, error: existingRoleError } = await admin
    .from("user_roles")
    .select("id, is_active")
    .eq("user_id", data.user.id)
    .eq("role_id", customerRole.id)
    .maybeSingle();

  if (existingRoleError) {
    return { error: "Account created, but customer role setup failed. Please contact support." };
  }

  const { error: userRoleError } = existingCustomerRole
    ? await admin
        .from("user_roles")
        .update({ is_active: true })
        .eq("id", existingCustomerRole.id)
    : await admin
        .from("user_roles")
        .insert({ user_id: data.user.id, role_id: customerRole.id, is_active: true });

  if (userRoleError) {
    return { error: "Account created, but customer role setup failed. Please contact support." };
  }

  if (!data.session) {
    return { message: "Account created. Please confirm your email, then log in." };
  }

  redirect("/customer");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/auth/login?message=signed-out");
}
