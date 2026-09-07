import "server-only";

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type UniversitySummary = {
  id: string;
  name: string;
  slug: string;
};

export type CafeteriaSummary = {
  id: string;
  university_id: string;
  name: string;
  slug: string;
};

export type ShopSummary = {
  id: string;
  cafeteria_id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_path: string | null;
  is_active: boolean;
};

type DataResult<T> = {
  data: T[];
  error: string | null;
};

function getQueryErrorMessage(operation: string, message?: string) {
  return `${operation} failed${message ? `: ${message}` : "."}`;
}

export function getSingleSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export async function getApprovedUniversities(): Promise<DataResult<UniversitySummary>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("universities")
    .select("id, name, slug")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    return { data: [], error: getQueryErrorMessage("University lookup", error.message) };
  }

  return { data: data ?? [], error: null };
}

export async function getApprovedUniversity(universityId: string): Promise<UniversitySummary> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("universities")
    .select("id, name, slug")
    .eq("id", universityId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw new Error(getQueryErrorMessage("Selected university lookup", error.message));
  }

  if (!data) notFound();
  return data;
}

export async function getApprovedCafeterias(universityId: string): Promise<DataResult<CafeteriaSummary>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cafeterias")
    .select("id, university_id, name, slug")
    .eq("university_id", universityId)
    .eq("is_active", true)
    .eq("approval_status", "APPROVED")
    .order("name", { ascending: true });

  if (error) {
    return { data: [], error: getQueryErrorMessage("Cafeteria lookup", error.message) };
  }

  return { data: data ?? [], error: null };
}

export async function getApprovedCafeteria(cafeteriaId: string, universityId: string): Promise<CafeteriaSummary> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cafeterias")
    .select("id, university_id, name, slug")
    .eq("id", cafeteriaId)
    .eq("university_id", universityId)
    .eq("is_active", true)
    .eq("approval_status", "APPROVED")
    .maybeSingle();

  if (error) {
    throw new Error(getQueryErrorMessage("Selected cafeteria lookup", error.message));
  }

  if (!data) notFound();
  return data;
}

export async function getApprovedShops(cafeteriaId: string): Promise<DataResult<ShopSummary>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("shops")
    .select("id, cafeteria_id, name, slug, description, logo_path, is_active")
    .eq("cafeteria_id", cafeteriaId)
    .eq("is_active", true)
    .eq("approval_status", "APPROVED")
    .order("name", { ascending: true });

  if (error) {
    return { data: [], error: getQueryErrorMessage("Shop lookup", error.message) };
  }

  return { data: data ?? [], error: null };
}

export async function getApprovedShop(shopId: string, cafeteriaId: string): Promise<ShopSummary> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("shops")
    .select("id, cafeteria_id, name, slug, description, logo_path, is_active")
    .eq("id", shopId)
    .eq("cafeteria_id", cafeteriaId)
    .eq("is_active", true)
    .eq("approval_status", "APPROVED")
    .maybeSingle();

  if (error) {
    throw new Error(getQueryErrorMessage("Selected shop lookup", error.message));
  }

  if (!data) notFound();
  return data;
}

export type CustomerMenuItem = {
  id: string;
  shop_id: string;
  name: string;
  description: string | null;
  price: number;
  image_path: string | null;
  stock_quantity: number;
  max_quantity_per_order: number;
  is_manually_available: boolean;
  is_active: boolean;
  reserved_quantity: number;
  available_stock: number;
};

export async function getShopMenuItems(shopId: string): Promise<DataResult<CustomerMenuItem>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("menu_items")
    .select("id, shop_id, name, description, price, image_path, stock_quantity, max_quantity_per_order, is_manually_available, is_active")
    .eq("shop_id", shopId)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    return { data: [], error: getQueryErrorMessage("Menu items lookup", error.message) };
  }

  const rawItems = data ?? [];
  const itemsWithStock: CustomerMenuItem[] = await Promise.all(
    rawItems.map(async (item) => {
      const { data: reserved, error: rpcError } = await supabase.rpc(
        "active_reserved_quantity",
        { p_menu_item_id: item.id }
      );
      const reservedQty = rpcError ? 0 : Number(reserved ?? 0);
      const stockQty = Number(item.stock_quantity ?? 0);
      const availableStock = Math.max(0, stockQty - reservedQty);

      return {
        id: item.id,
        shop_id: item.shop_id,
        name: item.name,
        description: item.description,
        price: Number(item.price),
        image_path: item.image_path,
        stock_quantity: stockQty,
        max_quantity_per_order: Number(item.max_quantity_per_order),
        is_manually_available: Boolean(item.is_manually_available),
        is_active: Boolean(item.is_active),
        reserved_quantity: reservedQty,
        available_stock: availableStock,
      };
    })
  );

  return { data: itemsWithStock, error: null };
}

