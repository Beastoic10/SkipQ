"use server";

import { createClient } from "@/lib/supabase/server";
import { requireCustomer } from "@/lib/auth/session";

export type CartItemInput = {
  menu_item_id: string;
  quantity: number;
};

export type ValidatedCartItem = {
  menu_item_id: string;
  name: string;
  price: number;
  quantity: number;
  line_total: number;
  available_stock: number;
  max_quantity_per_order: number;
};

export type CartValidationResult =
  | {
      valid: true;
      shopId: string;
      shopName: string;
      cafeteriaName: string;
      universityName: string;
      items: ValidatedCartItem[];
      totalAmount: number;
    }
  | {
      valid: false;
      generalError?: string;
      itemErrors: Record<string, string>;
    };

export type PlaceCashOrderResult =
  | {
      success: true;
      orderId: string;
      orderNumber: string;
      collectionToken: string;
    }
  | {
      success: false;
      error: string;
    };

export async function validateCartAction(
  shopId: string,
  items: CartItemInput[]
): Promise<CartValidationResult> {
  await requireCustomer();

  if (!shopId || !Array.isArray(items) || items.length === 0) {
    return {
      valid: false,
      generalError: "Cart is empty or sales point is missing.",
      itemErrors: {},
    };
  }

  const supabase = await createClient();

  // Validate shop, cafeteria, university hierarchy
  const { data: shop, error: shopError } = await supabase
    .from("shops")
    .select(`
      id,
      name,
      is_active,
      approval_status,
      cafeterias!inner (
        id,
        name,
        is_active,
        approval_status,
        universities!inner (
          id,
          name,
          is_active
        )
      )
    `)
    .eq("id", shopId)
    .maybeSingle();

  if (shopError || !shop) {
    return {
      valid: false,
      generalError: "Selected sales point could not be found.",
      itemErrors: {},
    };
  }

  const cafeteriaData = Array.isArray(shop.cafeterias) ? shop.cafeterias[0] : shop.cafeterias;
  const universityData = cafeteriaData && (Array.isArray(cafeteriaData.universities) ? cafeteriaData.universities[0] : cafeteriaData.universities);

  if (
    !shop.is_active ||
    shop.approval_status !== "APPROVED" ||
    !cafeteriaData ||
    !cafeteriaData.is_active ||
    cafeteriaData.approval_status !== "APPROVED" ||
    !universityData ||
    !universityData.is_active
  ) {
    return {
      valid: false,
      generalError: "This sales point is currently inactive or not approved for ordering.",
      itemErrors: {},
    };
  }

  const itemErrors: Record<string, string> = {};
  const validatedItems: ValidatedCartItem[] = [];
  let calculatedTotal = 0;

  // Aggregate quantities by menu_item_id
  const itemMap = new Map<string, number>();
  for (const item of items) {
    if (!item.menu_item_id || item.quantity <= 0) continue;
    const current = itemMap.get(item.menu_item_id) || 0;
    itemMap.set(item.menu_item_id, current + item.quantity);
  }

  for (const [menuItemId, requestedQty] of itemMap.entries()) {
    const { data: menuItem, error: itemError } = await supabase
      .from("menu_items")
      .select("id, shop_id, name, price, stock_quantity, max_quantity_per_order, is_manually_available, is_active")
      .eq("id", menuItemId)
      .eq("shop_id", shopId)
      .maybeSingle();

    if (itemError || !menuItem) {
      itemErrors[menuItemId] = "This item is no longer available on this menu.";
      continue;
    }

    if (!menuItem.is_active || !menuItem.is_manually_available) {
      itemErrors[menuItemId] = `"${menuItem.name}" is currently unavailable.`;
      continue;
    }

    if (requestedQty > menuItem.max_quantity_per_order) {
      itemErrors[menuItemId] = `Maximum ${menuItem.max_quantity_per_order} "${menuItem.name}" allowed per order.`;
      continue;
    }

    // Check active reservations
    const { data: reserved } = await supabase.rpc("active_reserved_quantity", {
      p_menu_item_id: menuItem.id,
    });
    const reservedQty = Number(reserved ?? 0);
    const availableStock = Math.max(0, menuItem.stock_quantity - reservedQty);

    if (availableStock <= 0) {
      itemErrors[menuItemId] = `"${menuItem.name}" is now out of stock.`;
      continue;
    }

    if (requestedQty > availableStock) {
      itemErrors[menuItemId] = `Only ${availableStock} "${menuItem.name}" remaining in stock.`;
      continue;
    }

    const price = Number(menuItem.price);
    const lineTotal = price * requestedQty;
    calculatedTotal += lineTotal;

    validatedItems.push({
      menu_item_id: menuItem.id,
      name: menuItem.name,
      price,
      quantity: requestedQty,
      line_total: lineTotal,
      available_stock: availableStock,
      max_quantity_per_order: menuItem.max_quantity_per_order,
    });
  }

  if (Object.keys(itemErrors).length > 0) {
    return {
      valid: false,
      itemErrors,
    };
  }

  return {
    valid: true,
    shopId: shop.id,
    shopName: shop.name,
    cafeteriaName: cafeteriaData.name,
    universityName: universityData.name,
    items: validatedItems,
    totalAmount: calculatedTotal,
  };
}

export async function placeCashOrderAction(
  shopId: string,
  items: CartItemInput[]
): Promise<PlaceCashOrderResult> {
  const context = await requireCustomer();
  if (!context) {
    return { success: false, error: "Authentication required to place an order." };
  }

  if (!shopId || !Array.isArray(items) || items.length === 0) {
    return { success: false, error: "Order must contain at least one item." };
  }

  const supabase = await createClient();

  // Call the trusted transactional create_cash_order function
  const { data, error } = await supabase.rpc("create_cash_order", {
    p_shop_id: shopId,
    p_items: items.map((i) => ({
      menu_item_id: i.menu_item_id,
      quantity: i.quantity,
    })),
  });

  if (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[placeCashOrderAction] Development Diagnostics for failed RPC:", {
        functionName: "create_cash_order",
        parameters: {
          p_shop_id: shopId,
          p_items: items.map((i) => ({
            menu_item_id: i.menu_item_id,
            quantity: i.quantity,
          })),
        },
        supabaseError: {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        },
      });
    } else {
      console.error("[placeCashOrderAction] Database order creation failed", {
        code: error.code,
        message: error.message,
      });
    }

    const msg = error.message.toLowerCase();
    if (msg.includes("insufficient stock")) {
      return {
        success: false,
        error: "Insufficient stock available for some items. Please review your cart.",
      };
    }
    if (msg.includes("unavailable") || msg.includes("not found")) {
      return {
        success: false,
        error: "One or more items in your cart are no longer available.",
      };
    }
    if (msg.includes("invalid item quantity")) {
      return {
        success: false,
        error: "An item quantity exceeds the maximum allowed or is invalid.",
      };
    }
    if (msg.includes("not orderable")) {
      return {
        success: false,
        error: "This sales point is currently unavailable for ordering.",
      };
    }
    if (msg.includes("only authenticated customers")) {
      return {
        success: false,
        error: "Only registered customer accounts can place orders.",
      };
    }

    if (process.env.NODE_ENV === "development") {
      return {
        success: false,
        error: `Could not complete order. Database error: ${error.message} (Code: ${error.code}). Details: ${error.details || "None"}. Hint: ${error.hint || "None"}.`,
      };
    }

    return {
      success: false,
      error: "Could not complete order. Please review your cart and try again.",
    };
  }

  const result = data as {
    order_id?: string;
    order_number?: string;
    collection_token?: string;
  };

  if (!result?.order_id || !result?.order_number || !result?.collection_token) {
    return {
      success: false,
      error: "Order was created but collection credential could not be generated.",
    };
  }

  return {
    success: true,
    orderId: result.order_id,
    orderNumber: result.order_number,
    collectionToken: result.collection_token,
  };
}
