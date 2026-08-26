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
