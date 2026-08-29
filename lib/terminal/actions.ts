"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireTerminalShop } from "@/lib/auth/session";

export type ActionResult = {
  success: boolean;
  message: string;
};

export async function updateOrderStatusAction(
  orderId: string,
  newStatus: "PREPARING" | "READY",
  shopId: string
): Promise<ActionResult> {
  try {
    const context = await requireTerminalShop(shopId);
    const supabase = await createClient();

    const { error } = await supabase.rpc("update_order_status", {
      p_order_id: orderId,
      p_new_status: newStatus,
    });

    if (error) {
      console.error("update_order_status RPC error:", error);
      return { success: false, message: error.message || "Failed to update order status" };
    }

    revalidatePath(`/terminal/${context.shopId}`);
    return {
      success: true,
      message: `Order status updated to ${newStatus}`,
    };
  } catch (err: unknown) {
    return {
      success: false,
      message: (err as Error)?.message || "An unexpected error occurred",
    };
  }
}

export async function validateCollectionQRAction(
  tokenInput: string,
  shopId: string
): Promise<ActionResult & { orderId?: string; orderNumber?: string }> {
  try {
    const context = await requireTerminalShop(shopId);
    const supabase = await createClient();

    const token = tokenInput.trim();
    if (!token) {
      return { success: false, message: "Collection token or QR input is required" };
    }

    const { data, error } = await supabase.rpc("validate_collection_qr", {
      p_token: token,
    });

    if (error) {
      console.error("validate_collection_qr RPC error:", error);
      return { success: false, message: error.message || "QR validation failed" };
    }

    const result = data as {
      order_id?: string;
      order_number?: string;
      message?: string;
      status?: string;
    };

    revalidatePath(`/terminal/${context.shopId}`);
    return {
      success: true,
      message: result?.message || `Order #${result?.order_number || ""} marked as COLLECTED`,
      orderId: result?.order_id,
      orderNumber: result?.order_number,
    };
  } catch (err: unknown) {
    return {
      success: false,
      message: (err as Error)?.message || "Collection validation failed",
    };
  }
}

export async function cancelOrderAction(
  orderId: string,
  reason: string,
  restoreInventory: boolean,
  shopId: string
): Promise<ActionResult> {
  try {
    const context = await requireTerminalShop(shopId);
    const supabase = await createClient();

    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      return { success: false, message: "A cancellation reason is required" };
    }

    const { error } = await supabase.rpc("cancel_order", {
      p_order_id: orderId,
      p_reason: trimmedReason,
      p_restore_inventory: restoreInventory,
    });

    if (error) {
      console.error("cancel_order RPC error:", error);
      return { success: false, message: error.message || "Order cancellation failed" };
    }

    revalidatePath(`/terminal/${context.shopId}`);
    return {
      success: true,
      message: "Order cancelled successfully",
    };
  } catch (err: unknown) {
    return {
      success: false,
      message: (err as Error)?.message || "An error occurred during cancellation",
    };
  }
}

export type CollectionLookupResult = ActionResult & {
  orderId?: string;
  orderNumber?: string;
  orderCode?: string;
  status?: string;
  totalAmount?: number;
  paymentMethod?: string;
  method: "qr" | "code";
  credential: string;
};

export type LookupResult = ActionResult & {
  orderId?: string;
  orderNumber?: string;
  orderCode?: string;
  status?: string;
  totalAmount?: number;
  paymentMethod?: string;
};


export async function lookupCollectionQRAction(
  tokenInput: string,
  shopId: string
): Promise<CollectionLookupResult> {
  try {
    await requireTerminalShop(shopId);
    const supabase = await createClient();

    const token = tokenInput.trim();
    if (!token) {
      return { success: false, message: "Collection token is required", method: "qr", credential: "" };
    }

    const { data, error } = await supabase.rpc("lookup_collection_qr", {
      p_token: token,
    });

    if (error) {
      console.error("lookup_collection_qr RPC error:", error);
      return { success: false, message: error.message || "QR validation failed", method: "qr", credential: token };
    }

    const result = data as {
      found?: boolean;
      message?: string;
      order_id?: string;
      order_number?: string;
      order_code?: string;
      status?: string;
      total_amount?: number;
      payment_method?: string;
    };

    if (!result?.found) {
      return { success: false, message: result?.message || "Invalid collection QR", method: "qr", credential: token };
    }

    return {
      success: true,
      message: result.message || `Order ${result.order_number || ""} found`,
      orderId: result.order_id,
      orderNumber: result.order_number,
      orderCode: result.order_code,
      status: result.status,
      totalAmount: result.total_amount,
      paymentMethod: result.payment_method,
      method: "qr",
      credential: token,
    };
  } catch (err: unknown) {
    return { success: false, message: (err as Error)?.message || "QR validation failed", method: "qr", credential: tokenInput };
  }
}

/**
 * Look up today's order by its 4-digit order code (e.g. "0042" or "42").
 * Authorization is derived from the terminal session — the server-verified
 * shopId is used, so a malicious client cannot probe other shops.
 */
export async function lookupOrderByCodeAction(
  codeInput: string,
  shopId: string
): Promise<CollectionLookupResult> {
  try {
    const context = await requireTerminalShop(shopId);
    const supabase = await createClient();

    const raw = codeInput.trim().replace(/\D/g, "");
    if (!/^\d{4}$/.test(raw)) {
      return { success: false, message: "Enter exactly 4 digits (0000–9999)", method: "code", credential: "" };
    }
    const paddedCode = raw.padStart(4, "0");

    const { data, error } = await supabase.rpc("lookup_order_by_code", {
      p_code:    paddedCode,
      p_shop_id: context.shopId,
      // p_order_date defaults to current_date on the server
    });

    if (error) {
      console.error("lookup_order_by_code RPC error:", error);
      return { success: false, message: error.message || "Order lookup failed", method: "code", credential: paddedCode };
    }

    const result = data as {
      found?: boolean;
      message?: string;
      order_id?: string;
      order_number?: string;
      order_code?: string;
      status?: string;
      total_amount?: number;
      payment_method?: string;
    };

    if (!result?.found) {
      return { success: false, message: result?.message || "Order not found", method: "code", credential: paddedCode };
    }

    return {
      success: true,
      message: `Order #${result.order_code} found — Status: ${result.status}`,
      orderId: result.order_id,
      orderNumber: result.order_number,
      orderCode: result.order_code,
      status: result.status,
      totalAmount: result.total_amount,
      paymentMethod: result.payment_method,
      method: "code",
      credential: paddedCode,
    };
  } catch (err: unknown) {
    return {
      success: false,
      message: (err as Error)?.message || "Order lookup failed",
      method: "code",
      credential: codeInput,
    };
  }
}

/**
 * Collect a READY order immediately by its 4-digit order code.
 * Option A: no QR token required — code lookup alone is sufficient.
 * Authorization is derived from the terminal session.
 */
export async function collectOrderByCodeAction(
  code: string,
  shopId: string
): Promise<ActionResult & { orderId?: string; orderNumber?: string; orderCode?: string }> {
  try {
    const context = await requireTerminalShop(shopId);
    const supabase = await createClient();

    const paddedCode = code.replace(/\D/g, "").padStart(4, "0");
    if (paddedCode.length > 4) {
      return { success: false, message: "Invalid order code" };
    }

    const { data, error } = await supabase.rpc("collect_order_by_code", {
      p_code:    paddedCode,
      p_shop_id: context.shopId,
      // p_order_date defaults to current_date on the server
    });

    if (error) {
      console.error("collect_order_by_code RPC error:", error);
      return { success: false, message: error.message || "Collection failed" };
    }

    const result = data as {
      order_id?: string;
      order_number?: string;
      order_code?: string;
      message?: string;
      already_collected?: boolean;
    };

    if (result?.already_collected) {
      return { success: false, message: result.message || "Order is already collected" };
    }

    revalidatePath(`/terminal/${context.shopId}`);
    return {
      success: true,
      message: result?.message || `Order #${code} marked as COLLECTED`,
      orderId: result?.order_id,
      orderNumber: result?.order_number,
      orderCode: result?.order_code,
    };
  } catch (err: unknown) {
    return {
      success: false,
      message: (err as Error)?.message || "Collection failed",
    };
  }
}

