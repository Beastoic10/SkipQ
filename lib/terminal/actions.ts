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

export type LookupResult = ActionResult & {
  orderId?: string;
  orderNumber?: string;
  dailySerial?: number;
  status?: string;
  totalAmount?: number;
  paymentMethod?: string;
};

/**
 * Look up a today's order by its daily serial number (1–2000).
 * Authorization is derived from the terminal session — the server-verified shopId
 * is used for the RPC, so a malicious client cannot probe other shops.
 */
export async function lookupOrderBySerialAction(
  serialInput: string,
  shopId: string
): Promise<LookupResult> {
  try {
    const context = await requireTerminalShop(shopId);
    const supabase = await createClient();

    const serial = parseInt(serialInput.trim(), 10);
    if (isNaN(serial) || serial < 1 || serial > 2000) {
      return { success: false, message: "Enter a valid order number between 1 and 2000" };
    }

    const { data, error } = await supabase.rpc("lookup_order_by_daily_serial", {
      p_serial: serial,
      p_shop_id: context.shopId,
      // p_order_date defaults to current_date on the server
    });

    if (error) {
      console.error("lookup_order_by_daily_serial RPC error:", error);
      return { success: false, message: error.message || "Order lookup failed" };
    }

    const result = data as {
      found?: boolean;
      message?: string;
      order_id?: string;
      order_number?: string;
      daily_serial?: number;
      status?: string;
      total_amount?: number;
      payment_method?: string;
    };

    if (!result?.found) {
      return { success: false, message: result?.message || "Order not found" };
    }

    return {
      success: true,
      message: `Order #${result.daily_serial} found — Status: ${result.status}`,
      orderId: result.order_id,
      orderNumber: result.order_number,
      dailySerial: result.daily_serial,
      status: result.status,
      totalAmount: result.total_amount,
      paymentMethod: result.payment_method,
    };
  } catch (err: unknown) {
    return {
      success: false,
      message: (err as Error)?.message || "Order lookup failed",
    };
  }
}

/**
 * Collect a READY order immediately by its daily serial number.
 * Option A: no QR token required — serial lookup alone is sufficient proof.
 * Authorization is derived from the terminal session.
 */
export async function collectOrderBySerialAction(
  serial: number,
  shopId: string
): Promise<ActionResult & { orderId?: string; orderNumber?: string; dailySerial?: number }> {
  try {
    const context = await requireTerminalShop(shopId);
    const supabase = await createClient();

    if (serial < 1 || serial > 2000) {
      return { success: false, message: "Invalid serial number" };
    }

    const { data, error } = await supabase.rpc("collect_order_by_serial", {
      p_serial: serial,
      p_shop_id: context.shopId,
      // p_order_date defaults to current_date on the server
    });

    if (error) {
      console.error("collect_order_by_serial RPC error:", error);
      return { success: false, message: error.message || "Collection failed" };
    }

    const result = data as {
      order_id?: string;
      order_number?: string;
      daily_serial?: number;
      message?: string;
      already_collected?: boolean;
    };

    revalidatePath(`/terminal/${context.shopId}`);
    return {
      success: true,
      message: result?.message || `Order #${serial} marked as COLLECTED`,
      orderId: result?.order_id,
      orderNumber: result?.order_number,
      dailySerial: result?.daily_serial,
    };
  } catch (err: unknown) {
    return {
      success: false,
      message: (err as Error)?.message || "Collection failed",
    };
  }
}

