import "server-only";

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireTerminalShop } from "@/lib/auth/session";

export type TerminalOrderItem = {
  id: string;
  menu_item_id: string;
  item_name_snapshot: string;
  quantity: number;
  unit_price_snapshot: number;
  line_total_snapshot: number;
};

export type TerminalOrder = {
  id: string;
  order_number: string;
  status: "PLACED" | "PREPARING" | "READY" | "COLLECTED" | "CANCELLED";
  payment_method: "CASH" | "ONLINE";
  total_amount: number;
  currency: string;
  created_at: string;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  collected_at: string | null;
  items: TerminalOrderItem[];
};

export type TerminalShopDetails = {
  id: string;
  name: string;
  description: string | null;
  cafeteria_name: string;
  university_name: string;
};

type OrderItemRow = {
  id: string;
  menu_item_id: string;
  item_name_snapshot: string;
  quantity: number | string;
  unit_price_snapshot: number | string;
  line_total_snapshot: number | string;
};

export async function getTerminalDashboardData(shopId: string) {
  const context = await requireTerminalShop(shopId);
  const supabase = await createClient();

  const { data: shop, error: shopError } = await supabase
    .from("shops")
    .select(`
      id,
      name,
      description,
      cafeterias!inner (
        name,
        universities!inner (
          name
        )
      )
    `)
    .eq("id", context.shopId)
    .maybeSingle();

  if (shopError || !shop) {
    notFound();
  }

  const cafeteriaData = Array.isArray(shop.cafeterias) ? shop.cafeterias[0] : shop.cafeterias;
  const universityData = cafeteriaData && Array.isArray(cafeteriaData.universities)
    ? cafeteriaData.universities[0]
    : (cafeteriaData as unknown as { universities?: { name: string }[] })?.universities;

  const shopDetails: TerminalShopDetails = {
    id: shop.id,
    name: shop.name,
    description: shop.description,
    cafeteria_name: cafeteriaData?.name ?? "Cafeteria",
    university_name: Array.isArray(universityData) ? universityData[0]?.name : (universityData as { name?: string })?.name ?? "University",
  };

  const { data: ordersData, error: ordersError } = await supabase
    .from("orders")
    .select(`
      id,
      order_number,
      status,
      payment_method,
      total_amount,
      currency,
      created_at,
      cancelled_at,
      cancellation_reason,
      collected_at,
      order_items (
        id,
        menu_item_id,
        item_name_snapshot,
        quantity,
        unit_price_snapshot,
        line_total_snapshot
      )
    `)
    .eq("shop_id", context.shopId)
    .order("created_at", { ascending: false });

  if (ordersError) {
    console.error("Error fetching terminal orders:", ordersError);
    return {
      shopDetails,
      orders: [],
      terminalDisplayName: context.terminalAccount?.display_name ?? "Terminal",
    };
  }

  const orders: TerminalOrder[] = (ordersData ?? []).map((o) => ({
    id: o.id,
    order_number: o.order_number,
    status: o.status as TerminalOrder["status"],
    payment_method: o.payment_method as TerminalOrder["payment_method"],
    total_amount: Number(o.total_amount),
    currency: o.currency,
    created_at: o.created_at,
    cancelled_at: o.cancelled_at,
    cancellation_reason: o.cancellation_reason,
    collected_at: o.collected_at,
    items: ((o.order_items as unknown as OrderItemRow[]) ?? []).map((i) => ({
      id: i.id,
      menu_item_id: i.menu_item_id,
      item_name_snapshot: i.item_name_snapshot,
      quantity: Number(i.quantity),
      unit_price_snapshot: Number(i.unit_price_snapshot),
      line_total_snapshot: Number(i.line_total_snapshot),
    })),
  }));

  return {
    shopDetails,
    orders,
    terminalDisplayName: context.terminalAccount?.display_name ?? context.profile?.display_name ?? "Terminal",
  };
}
