import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { CurrentUserContext, RoleName } from "./types";

const ROLE_PRIORITY: RoleName[] = ["admin", "shop_staff", "customer"];

export function getPostLoginPath(roles: RoleName[]) {
  const selectedRole = ROLE_PRIORITY.find((role) => roles.includes(role));

  if (selectedRole === "admin") return "/admin";
  if (selectedRole === "shop_staff") return "/terminal";
  return "/customer";
}

export async function getCurrentUserContext(): Promise<CurrentUserContext | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) return null;

  const userId = data.user.id;

  const [profileResult, rolesResult, membershipsResult] = await Promise.all([
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
  ]);

  if (profileResult.error || rolesResult.error || membershipsResult.error) {
    return {
      userId,
      email: data.user.email ?? null,
      profile: null,
      roles: [],
      shopMemberships: [],
    };
  }

  const roles = (rolesResult.data ?? [])
    .map((row) => {
      const role = row.roles as { name?: RoleName } | { name?: RoleName }[] | null;
      return Array.isArray(role) ? role[0]?.name : role?.name;
    })
    .filter((role): role is RoleName =>
      role === "customer" || role === "shop_staff" || role === "admin",
    );

  return {
    userId,
    email: data.user.email ?? null,
    profile: profileResult.data,
    roles,
    shopMemberships: membershipsResult.data ?? [],
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

export async function requireShopStaff(shopId?: string) {
  const context = await requireAuthenticatedUser();
  const isShopStaff = context.roles.includes("shop_staff");
  const hasShopMembership = shopId
    ? context.shopMemberships.some((membership) => membership.shop_id === shopId)
    : context.shopMemberships.length > 0;

  if (!isShopStaff || !hasShopMembership) {
    redirect("/auth/login?message=unauthorized");
  }

  return context;
}
