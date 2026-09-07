import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { CurrentUserContext, RoleName } from "./types";

const ROLE_PRIORITY: RoleName[] = ["admin", "terminal", "shop_staff", "customer"];

export function getPostLoginPath(roles: RoleName[], shopId?: string | null) {
  const selectedRole = ROLE_PRIORITY.find((role) => roles.includes(role));

  if (selectedRole === "admin") return "/admin";
  if (selectedRole === "terminal" || selectedRole === "shop_staff") {
    return shopId ? `/terminal/${shopId}` : "/terminal";
  }
  return "/customer";
}

export async function getCurrentUserContext(): Promise<CurrentUserContext | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) return null;

  const userId = data.user.id;

  const [profileResult, rolesResult, membershipsResult, terminalResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, display_name, phone, avatar_url, is_active")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("user_roles")
      .select("roles!inner(name)")
      .eq("user_id", userId)
      .eq("is_active", true),
    supabase
      .from("shop_staff_memberships")
      .select("id, shop_id, user_id, is_active")
      .eq("user_id", userId)
      .eq("is_active", true),
    supabase
      .from("terminal_accounts")
      .select("id, auth_user_id, shop_id, display_name, is_active")
      .eq("auth_user_id", userId)
      .eq("is_active", true)
      .maybeSingle(),
  ]);

  if (profileResult.error || rolesResult.error) {
    return {
      userId,
      email: data.user.email ?? null,
      profile: null,
      roles: [],
      shopMemberships: [],
      terminalAccount: null,
    };
  }

  const roles = (rolesResult.data ?? [])
    .map((row) => {
      const role = row.roles as { name?: RoleName } | { name?: RoleName }[] | null;
      return Array.isArray(role) ? role[0]?.name : role?.name;
    })
    .filter((role): role is RoleName =>
      role === "customer" || role === "shop_staff" || role === "terminal" || role === "admin",
    );

  const terminalAccount = terminalResult.data ?? null;

  return {
    userId,
    email: data.user.email ?? null,
    profile: profileResult.data,
    roles,
    shopMemberships: membershipsResult.data ?? [],
    terminalAccount,
  };
}

export async function requireAuthenticatedUser() {
  const context = await getCurrentUserContext();
  if (!context) redirect("/auth/login?message=session-required");
  return context;
}

export async function requireCustomer() {
  const context = await requireAuthenticatedUser();
  if (!context.roles.includes("customer")) redirect("/auth/login?message=unauthorized");
  return context;
}

export async function requireAdmin() {
  const context = await requireAuthenticatedUser();
  if (!context.roles.includes("admin")) redirect("/auth/login?message=unauthorized");
  return context;
}

export async function requireTerminalAccount() {
  const context = await requireAuthenticatedUser();
  const isTerminal = context.roles.includes("terminal");

  const shopId = context.terminalAccount?.shop_id ?? null;

  if (!isTerminal || !shopId) {
    redirect("/auth/login?message=unauthorized");
  }

  return {
    ...context,
    shopId,
    terminalAccount: context.terminalAccount,
  };
}

export async function requireTerminalShop(requestedShopId?: string) {
  const context = await requireTerminalAccount();

  if (requestedShopId && requestedShopId !== context.shopId) {
    redirect(`/terminal/${context.shopId}`);
  }

  return context;
}

export async function requireShopStaff(shopId?: string) {
  return requireTerminalShop(shopId);
}
