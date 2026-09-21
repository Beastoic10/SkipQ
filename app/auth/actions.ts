"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getPostLoginPath, getCurrentUserContext } from "@/lib/auth/session";

export type AuthActionState = {
  error?: string;
  message?: string;
};


type SupabaseDiagnosticError = {
  name?: unknown;
  message?: unknown;
  code?: unknown;
  status?: unknown;
  details?: unknown;
  hint?: unknown;
};

function getErrorField(error: SupabaseDiagnosticError, field: keyof SupabaseDiagnosticError) {
  const value = error[field];
  return typeof value === "string" || typeof value === "number" ? value : undefined;
}

function logSupabaseOperation(operation: string, error: SupabaseDiagnosticError | null) {
  if (!error) {
    console.info("[signup diagnostics] Supabase operation succeeded", { operation });
    return;
  }

  console.error("[signup diagnostics] Supabase operation failed", {
    operation,
    name: getErrorField(error, "name"),
    message: getErrorField(error, "message"),
    code: getErrorField(error, "code"),
    status: getErrorField(error, "status"),
    details: getErrorField(error, "details"),
    hint: getErrorField(error, "hint"),
  });
}

function getSafeDiagnosticError(operation: string, error: SupabaseDiagnosticError) {
  const message = getErrorField(error, "message") ?? "Unknown Supabase error";
  const code = getErrorField(error, "code");
  const status = getErrorField(error, "status");
  const codeParts = [code ? `code ${code}` : null, status ? `status ${status}` : null].filter(Boolean);
  const suffix = codeParts.length ? ` (${codeParts.join(", ")})` : "";

  return `${operation} failed: ${message}${suffix}`;
}

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
  redirect(redirectTo ?? getPostLoginPath(context?.roles ?? [], context?.terminalAccount?.shop_id));
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
  logSupabaseOperation("supabase.auth.signUp", error);

  if (error) {
    return { error: getSafeDiagnosticError("supabase.auth.signUp", error) };
  }

  if (!data.user) {
    return { error: "Signup could not be completed. Please try again." };
  }

  if (!data.user.identities || data.user.identities.length === 0) {
    return { error: "An account already exists for this email. Try logging in instead." };
  }

  const admin = createAdminClient();
  const { error: profileError } = await admin
    .from("profiles")
    .upsert({ id: data.user.id }, { onConflict: "id" });
  logSupabaseOperation("admin.profiles.upsert", profileError);

  if (profileError) {
    if (getErrorField(profileError, "code") === "23503" || String(profileError.code) === "23503") {
      return { error: "An account already exists for this email. Try logging in instead." };
    }
    return { error: getSafeDiagnosticError("admin.profiles.upsert", profileError) };
  }

  const { data: customerRole, error: roleError } = await admin
    .from("roles")
    .select("id")
    .eq("name", "customer")
    .maybeSingle();
  logSupabaseOperation("admin.roles.lookup_customer", roleError);

  if (roleError) {
    return { error: getSafeDiagnosticError("admin.roles.lookup_customer", roleError) };
  }

  if (!customerRole) {
    const missingRoleError = {
      name: "MissingRoleError",
      message: "Customer role was not found.",
      code: "SKIPQ_CUSTOMER_ROLE_NOT_FOUND",
    };
    logSupabaseOperation("admin.roles.lookup_customer", missingRoleError);
    return { error: getSafeDiagnosticError("admin.roles.lookup_customer", missingRoleError) };
  }

  const { data: existingCustomerRole, error: existingRoleError } = await admin
    .from("user_roles")
    .select("id, is_active")
    .eq("user_id", data.user.id)
    .eq("role_id", customerRole.id)
    .maybeSingle();
  logSupabaseOperation("admin.user_roles.lookup_existing_customer", existingRoleError);

  if (existingRoleError) {
    return { error: getSafeDiagnosticError("admin.user_roles.lookup_existing_customer", existingRoleError) };
  }

  const userRoleOperation = existingCustomerRole ? "admin.user_roles.reactivate_customer" : "admin.user_roles.insert_customer";
  const { error: userRoleError } = existingCustomerRole
    ? await admin
        .from("user_roles")
        .update({ is_active: true })
        .eq("id", existingCustomerRole.id)
    : await admin
        .from("user_roles")
        .insert({ user_id: data.user.id, role_id: customerRole.id, is_active: true });
  logSupabaseOperation(userRoleOperation, userRoleError);

  if (userRoleError) {
    return { error: getSafeDiagnosticError(userRoleOperation, userRoleError) };
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
