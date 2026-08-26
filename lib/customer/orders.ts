import "server-only";

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireCustomer } from "@/lib/auth/session";

export type OrderItemDetail = {
  id: string;
  menu_item_id: string;
  item_name_snapshot: string;
  quantity: number;
  unit_price_snapshot: number;
  line_total_snapshot: number;
};

export type OrderStatusEventDetail = {
  id: string;
  previous_status: string | null;
  new_status: string;
  reason: string | null;
  created_at: string;
};

export type CustomerOrderDetails = {
  id: string;
  order_number: string;
  customer_id: string;
  status: "PAYMENT_PENDING" | "PLACED" | "PREPARING" | "READY" | "COLLECTED" | "CANCELLED";
  payment_method: "CASH" | "ONLINE";
  total_amount: number;
  currency: string;
  created_at: string;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  collected_at: string | null;
  shop: {
    id: string;
    name: string;
    description: string | null;
  };
  cafeteria: {
    id: string;
    name: string;
  };
  university: {
    id: string;
    name: string;
  };
  items: OrderItemDetail[];
  status_events: OrderStatusEventDetail[];
  payment: {
    method: string;
    status: string;
    transaction_ref: string;
    amount: number;
    paid_at: string | null;
  } | null;
};

export async function getCustomerOrderDetails(orderId: string): Promise<CustomerOrderDetails> {
  const context = await requireCustomer();
  const supabase = await createClient();

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select(`
      id,
      order_number,
      customer_id,
      status,
      payment_method,
      total_amount,
      currency,
      created_at,
      cancelled_at,
      cancellation_reason,
      collected_at,
      shops!inner (
        id,
        name,
        description
      ),
      cafeterias!inner (
        id,
        name
      ),
      universities!inner (
        id,
        name
      )
    `)
    .eq("id", orderId)
    .eq("customer_id", context.userId)
    .maybeSingle();

  if (orderError || !order) {
    notFound();
  }

  // Fetch items, status events, and payment attempt in parallel
  const [itemsRes, eventsRes, paymentsRes] = await Promise.all([
    supabase
      .from("order_items")
      .select("id, menu_item_id, item_name_snapshot, quantity, unit_price_snapshot, line_total_snapshot")
      .eq("order_id", order.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("order_status_events")
      .select("id, previous_status, new_status, reason, created_at")
      .eq("order_id", order.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("payment_attempts")
      .select("method, status, transaction_ref, amount, paid_at")
      .eq("order_id", order.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const shopData = Array.isArray(order.shops) ? order.shops[0] : order.shops;
  const cafeteriaData = Array.isArray(order.cafeterias) ? order.cafeterias[0] : order.cafeterias;
  const universityData = Array.isArray(order.universities) ? order.universities[0] : order.universities;

  const items: OrderItemDetail[] = (itemsRes.data ?? []).map((i) => ({
    id: i.id,
    menu_item_id: i.menu_item_id,
    item_name_snapshot: i.item_name_snapshot,
    quantity: i.quantity,
    unit_price_snapshot: Number(i.unit_price_snapshot),
    line_total_snapshot: Number(i.line_total_snapshot),
  }));

  const status_events: OrderStatusEventDetail[] = (eventsRes.data ?? []).map((e) => ({
    id: e.id,
    previous_status: e.previous_status,
    new_status: e.new_status,
    reason: e.reason,
    created_at: e.created_at,
  }));

  const paymentData = paymentsRes.data;
  const payment = paymentData
    ? {
        method: paymentData.method,
        status: paymentData.status,
        transaction_ref: paymentData.transaction_ref,
        amount: Number(paymentData.amount),
        paid_at: paymentData.paid_at,
      }
    : null;

  return {
    id: order.id,
    order_number: order.order_number,
    customer_id: order.customer_id,
    status: order.status as CustomerOrderDetails["status"],
    payment_method: order.payment_method as CustomerOrderDetails["payment_method"],
    total_amount: Number(order.total_amount),
    currency: order.currency,
    created_at: order.created_at,
    cancelled_at: order.cancelled_at,
    cancellation_reason: order.cancellation_reason,
    collected_at: order.collected_at,
    shop: {
      id: shopData?.id ?? "",
      name: shopData?.name ?? "Sales Point",
      description: shopData?.description ?? null,
    },
    cafeteria: {
      id: cafeteriaData?.id ?? "",
      name: cafeteriaData?.name ?? "Cafeteria",
    },
    university: {
      id: universityData?.id ?? "",
      name: universityData?.name ?? "University",
    },
    items,
    status_events,
    payment,
  };
}
