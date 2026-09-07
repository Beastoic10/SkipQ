import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/session";
import type {
  AdminStats,
  AdminRecentOrder,
  AdminUniversity,
  AdminCafeteria,
  AdminShop,
  AdminTerminalAccount,
  AdminMenuItem,
  AdminApprovalItem,
} from "./types";

export async function getAdminDashboardStats(): Promise<AdminStats> {
  await requireAdmin();
  const supabase = await createClient();

  const [
    universitiesRes,
    cafeteriasRes,
    shopsRes,
    activeShopsRes,
    terminalsRes,
    activeTerminalsRes,
    menuItemsRes,
    ordersCountRes,
    pendingCafeteriasRes,
    pendingShopsRes,
    recentOrdersRes,
  ] = await Promise.all([
    supabase.from("universities").select("id", { count: "exact", head: true }),
    supabase.from("cafeterias").select("id", { count: "exact", head: true }),
    supabase.from("shops").select("id", { count: "exact", head: true }),
    supabase.from("shops").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("terminal_accounts").select("id", { count: "exact", head: true }),
    supabase.from("terminal_accounts").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("menu_items").select("id", { count: "exact", head: true }),
    supabase.from("orders").select("id", { count: "exact", head: true }),
    supabase.from("cafeterias").select("id", { count: "exact", head: true }).eq("approval_status", "PENDING"),
    supabase.from("shops").select("id", { count: "exact", head: true }).eq("approval_status", "PENDING"),
    supabase
      .from("orders")
      .select(`
        id,
        order_number,
        order_code,
        status,
        payment_method,
        total_amount,
        currency,
        created_at,
        shops (
          name,
          cafeterias (
            name
          )
        )
      `)
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  type OrderRow = {
    id: string;
    order_number: string;
    order_code: string | null;
    status: AdminRecentOrder["status"];
    payment_method: AdminRecentOrder["payment_method"];
    total_amount: number | string;
    currency: string;
    created_at: string;
    shops: {
      name: string;
      cafeterias: {
        name: string;
      } | { name: string }[] | null;
    } | { name: string; cafeterias: { name: string } | { name: string }[] | null }[] | null;
  };

  const rawOrders = (recentOrdersRes.data ?? []) as unknown as OrderRow[];

  const recentOrders: AdminRecentOrder[] = rawOrders.map((order) => {
    const shopObj = Array.isArray(order.shops) ? order.shops[0] : order.shops;
    const cafeteriaObj = shopObj
      ? Array.isArray(shopObj.cafeterias)
        ? shopObj.cafeterias[0]
        : shopObj.cafeterias
      : null;

    return {
      id: order.id,
      order_number: order.order_number,
      order_code: order.order_code,
      status: order.status,
      payment_method: order.payment_method,
      total_amount: Number(order.total_amount) || 0,
      currency: order.currency || "BDT",
      shop_name: shopObj?.name ?? "Sales Point",
      cafeteria_name: cafeteriaObj?.name ?? "Cafeteria",
      created_at: order.created_at,
    };
  });

  const pendingApprovalsCount = (pendingCafeteriasRes.count ?? 0) + (pendingShopsRes.count ?? 0);

  return {
    totalUniversities: universitiesRes.count ?? 0,
    totalCafeterias: cafeteriasRes.count ?? 0,
    totalShops: shopsRes.count ?? 0,
    activeShops: activeShopsRes.count ?? 0,
    totalTerminals: terminalsRes.count ?? 0,
    activeTerminals: activeTerminalsRes.count ?? 0,
    totalMenuItems: menuItemsRes.count ?? 0,
    totalOrders: ordersCountRes.count ?? 0,
    pendingApprovalsCount,
    recentOrders,
  };
}

export async function getAdminUniversities(): Promise<AdminUniversity[]> {
  await requireAdmin();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("universities")
    .select(`
      id,
      name,
      slug,
      is_active,
      created_at,
      updated_at,
      cafeterias (id)
    `)
    .order("name", { ascending: true });

  if (error || !data) {
    console.error("Error fetching admin universities:", error);
    return [];
  }

  return data.map((u) => ({
    id: u.id,
    name: u.name,
    slug: u.slug,
    is_active: u.is_active,
    cafeteria_count: Array.isArray(u.cafeterias) ? u.cafeterias.length : 0,
    created_at: u.created_at,
    updated_at: u.updated_at,
  }));
}

export async function getAdminCafeterias(universityId?: string): Promise<AdminCafeteria[]> {
  await requireAdmin();
  const supabase = await createClient();

  let query = supabase
    .from("cafeterias")
    .select(`
      id,
      university_id,
      name,
      slug,
      is_active,
      approval_status,
      approved_at,
      created_at,
      updated_at,
      universities (name),
      shops (id)
    `)
    .order("name", { ascending: true });

  if (universityId) {
    query = query.eq("university_id", universityId);
  }

  const { data, error } = await query;
  if (error || !data) {
    console.error("Error fetching admin cafeterias:", error);
    return [];
  }

  type CafeteriaRow = (typeof data)[number];

  return data.map((c: CafeteriaRow) => {
    const uni = Array.isArray(c.universities) ? c.universities[0] : c.universities;
    return {
      id: c.id,
      university_id: c.university_id,
      university_name: (uni as { name?: string } | null)?.name ?? "Unknown University",
      name: c.name,
      slug: c.slug,
      is_active: c.is_active,
      approval_status: c.approval_status,
      shop_count: Array.isArray(c.shops) ? c.shops.length : 0,
      approved_at: c.approved_at,
      created_at: c.created_at,
      updated_at: c.updated_at,
    };
  });
}

export async function getAdminShops(cafeteriaId?: string): Promise<AdminShop[]> {
  await requireAdmin();
  const supabase = await createClient();

  let query = supabase
    .from("shops")
    .select(`
      id,
      cafeteria_id,
      name,
      slug,
      description,
      logo_path,
      is_active,
      approval_status,
      created_at,
      updated_at,
      cafeterias (
        name,
        universities (
          name
        )
      ),
      terminal_accounts (id),
      menu_items (id)
    `)
    .order("name", { ascending: true });

  if (cafeteriaId) {
    query = query.eq("cafeteria_id", cafeteriaId);
  }

  const { data, error } = await query;
  if (error || !data) {
    console.error("Error fetching admin shops:", error);
    return [];
  }

  type ShopRow = (typeof data)[number];

  return data.map((s: ShopRow) => {
    const caf = Array.isArray(s.cafeterias) ? s.cafeterias[0] : s.cafeterias;
    const cafTyped = caf as { name?: string; universities?: { name?: string } | { name?: string }[] } | null;
    const uni = Array.isArray(cafTyped?.universities) ? cafTyped?.universities[0] : cafTyped?.universities;

    return {
      id: s.id,
      cafeteria_id: s.cafeteria_id,
      cafeteria_name: cafTyped?.name ?? "Unknown Cafeteria",
      university_name: (uni as { name?: string } | null)?.name ?? "Unknown University",
      name: s.name,
      slug: s.slug,
      description: s.description,
      logo_path: s.logo_path,
      is_active: s.is_active,
      approval_status: s.approval_status,
      terminal_count: Array.isArray(s.terminal_accounts) ? s.terminal_accounts.length : 0,
      menu_item_count: Array.isArray(s.menu_items) ? s.menu_items.length : 0,
      created_at: s.created_at,
      updated_at: s.updated_at,
    };
  });
}

export async function getAdminTerminals(shopId?: string): Promise<AdminTerminalAccount[]> {
  await requireAdmin();
  const supabase = await createClient();

  let query = supabase
    .from("terminal_accounts")
    .select(`
      id,
      auth_user_id,
      shop_id,
      display_name,
      is_active,
      created_at,
      updated_at,
      shops (
        name,
        cafeterias (
          name,
          universities (
            name
          )
        )
      )
    `)
    .order("created_at", { ascending: false });

  if (shopId) {
    query = query.eq("shop_id", shopId);
  }

  const { data, error } = await query;
  if (error || !data) {
    console.error("Error fetching admin terminals:", error);
    return [];
  }

  // Get user emails safely via server-side admin client
  let emailMap: Record<string, string> = {};
  try {
    const adminClient = createAdminClient();
    const { data: usersData } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
    if (usersData?.users) {
      emailMap = Object.fromEntries(usersData.users.map((u) => [u.id, u.email ?? ""]));
    }
  } catch (err) {
    console.warn("Could not list auth emails for terminals:", err);
  }

  type TerminalRow = (typeof data)[number];

  return data.map((t: TerminalRow) => {
    const shop = Array.isArray(t.shops) ? t.shops[0] : t.shops;
    const shopTyped = shop as {
      name?: string;
      cafeterias?: {
        name?: string;
        universities?: { name?: string } | { name?: string }[];
      } | { name?: string; universities?: { name?: string } | { name?: string }[] }[];
    } | null;

    const caf = Array.isArray(shopTyped?.cafeterias) ? shopTyped?.cafeterias[0] : shopTyped?.cafeterias;
    const uni = Array.isArray(caf?.universities) ? caf?.universities[0] : caf?.universities;

    return {
      id: t.id,
      auth_user_id: t.auth_user_id,
      email: emailMap[t.auth_user_id] ?? null,
      shop_id: t.shop_id,
      shop_name: shopTyped?.name ?? "Unknown Shop",
      cafeteria_name: caf?.name ?? "Unknown Cafeteria",
      university_name: (uni as { name?: string } | null)?.name ?? "Unknown University",
      display_name: t.display_name,
      is_active: t.is_active,
      created_at: t.created_at,
      updated_at: t.updated_at,
    };
  });
}

export async function getAdminMenuItems(shopId?: string): Promise<AdminMenuItem[]> {
  await requireAdmin();
  const supabase = await createClient();

  let query = supabase
    .from("menu_items")
    .select(`
      id,
      shop_id,
      name,
      description,
      price,
      image_path,
      stock_quantity,
      max_quantity_per_order,
      is_manually_available,
      is_active,
      created_at,
      updated_at,
      shops (
        name,
        cafeterias (
          name
        )
      )
    `)
    .order("name", { ascending: true });

  if (shopId) {
    query = query.eq("shop_id", shopId);
  }

  const { data, error } = await query;
  if (error || !data) {
    console.error("Error fetching admin menu items:", error);
    return [];
  }

  type MenuItemRow = (typeof data)[number];

  return data.map((m: MenuItemRow) => {
    const shop = Array.isArray(m.shops) ? m.shops[0] : m.shops;
    const shopTyped = shop as {
      name?: string;
      cafeterias?: { name?: string } | { name?: string }[];
    } | null;

    const caf = Array.isArray(shopTyped?.cafeterias) ? shopTyped?.cafeterias[0] : shopTyped?.cafeterias;

    return {
      id: m.id,
      shop_id: m.shop_id,
      shop_name: shopTyped?.name ?? "Unknown Shop",
      cafeteria_name: (caf as { name?: string } | null)?.name ?? "Unknown Cafeteria",
      name: m.name,
      description: m.description,
      price: Number(m.price) || 0,
      image_path: m.image_path,
      stock_quantity: Number(m.stock_quantity) || 0,
      max_quantity_per_order: Number(m.max_quantity_per_order) || 1,
      is_manually_available: m.is_manually_available,
      is_active: m.is_active,
      created_at: m.created_at,
      updated_at: m.updated_at,
    };
  });
}

export async function getAdminPendingApprovals(): Promise<AdminApprovalItem[]> {
  await requireAdmin();
  const supabase = await createClient();

  const [pendingCafeteriasRes, pendingShopsRes] = await Promise.all([
    supabase
      .from("cafeterias")
      .select(`
        id,
        name,
        slug,
        approval_status,
        created_at,
        universities (name)
      `)
      .eq("approval_status", "PENDING")
      .order("created_at", { ascending: false }),
    supabase
      .from("shops")
      .select(`
        id,
        name,
        slug,
        approval_status,
        created_at,
        cafeterias (name)
      `)
      .eq("approval_status", "PENDING")
      .order("created_at", { ascending: false }),
  ]);

  const items: AdminApprovalItem[] = [];

  if (pendingCafeteriasRes.data) {
    for (const c of pendingCafeteriasRes.data) {
      const uni = Array.isArray(c.universities) ? c.universities[0] : c.universities;
      items.push({
        id: c.id,
        type: "cafeteria",
        name: c.name,
        parent_name: (uni as { name?: string } | null)?.name ?? "University",
        slug: c.slug,
        approval_status: c.approval_status,
        created_at: c.created_at,
      });
    }
  }

  if (pendingShopsRes.data) {
    for (const s of pendingShopsRes.data) {
      const caf = Array.isArray(s.cafeterias) ? s.cafeterias[0] : s.cafeterias;
      items.push({
        id: s.id,
        type: "shop",
        name: s.name,
        parent_name: (caf as { name?: string } | null)?.name ?? "Cafeteria",
        slug: s.slug,
        approval_status: s.approval_status,
        created_at: s.created_at,
      });
    }
  }

  return items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}
