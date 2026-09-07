"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth/session";
import type {
  AdminActionResult,
  ApprovalStatus,
  CreateUniversityInput,
  UpdateUniversityInput,
  CreateCafeteriaInput,
  UpdateCafeteriaInput,
  CreateShopInput,
  UpdateShopInput,
  CreateTerminalAccountInput,
  UpdateTerminalAccountInput,
  CreateMenuItemInput,
  UpdateMenuItemInput,
} from "./types";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// -----------------------------------------------------------------------------
// University Actions
// -----------------------------------------------------------------------------

export async function createUniversityAction(input: CreateUniversityInput): Promise<AdminActionResult> {
  try {
    const context = await requireAdmin();
    const supabase = await createClient();

    const name = input.name.trim();
    const slug = (input.slug.trim() || slugify(name)).toLowerCase();

    if (!name) return { success: false, message: "University name is required" };
    if (!slug) return { success: false, message: "Valid slug is required" };

    const { data, error } = await supabase
      .from("universities")
      .insert({
        name,
        slug,
        is_active: input.is_active ?? true,
        created_by: context.userId,
      })
      .select("id")
      .single();

    if (error) {
      console.error("createUniversityAction error:", error);
      return { success: false, message: error.message || "Failed to create university" };
    }

    revalidatePath("/admin");
    revalidatePath("/admin/universities");
    return { success: true, message: "University created successfully", id: data.id };
  } catch (err: unknown) {
    return { success: false, message: (err as Error)?.message || "Unexpected error occurred" };
  }
}

export async function updateUniversityAction(input: UpdateUniversityInput): Promise<AdminActionResult> {
  try {
    await requireAdmin();
    const supabase = await createClient();

    const name = input.name.trim();
    const slug = input.slug.trim().toLowerCase();

    if (!name) return { success: false, message: "University name is required" };
    if (!slug) return { success: false, message: "Valid slug is required" };

    const { error } = await supabase
      .from("universities")
      .update({
        name,
        slug,
        is_active: input.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.id);

    if (error) {
      console.error("updateUniversityAction error:", error);
      return { success: false, message: error.message || "Failed to update university" };
    }

    revalidatePath("/admin");
    revalidatePath("/admin/universities");
    return { success: true, message: "University updated successfully" };
  } catch (err: unknown) {
    return { success: false, message: (err as Error)?.message || "Unexpected error occurred" };
  }
}

export async function toggleUniversityStatusAction(id: string, is_active: boolean): Promise<AdminActionResult> {
  try {
    await requireAdmin();
    const supabase = await createClient();

    const { error } = await supabase
      .from("universities")
      .update({ is_active, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      return { success: false, message: error.message || "Failed to toggle university status" };
    }

    revalidatePath("/admin");
    revalidatePath("/admin/universities");
    return { success: true, message: `University ${is_active ? "activated" : "deactivated"} successfully` };
  } catch (err: unknown) {
    return { success: false, message: (err as Error)?.message || "Unexpected error occurred" };
  }
}

// -----------------------------------------------------------------------------
// Cafeteria / Vendor Actions
// -----------------------------------------------------------------------------

export async function createCafeteriaAction(input: CreateCafeteriaInput): Promise<AdminActionResult> {
  try {
    const context = await requireAdmin();
    const supabase = await createClient();

    const name = input.name.trim();
    const slug = (input.slug.trim() || slugify(name)).toLowerCase();

    if (!input.university_id) return { success: false, message: "Parent university is required" };
    if (!name) return { success: false, message: "Cafeteria name is required" };
    if (!slug) return { success: false, message: "Valid slug is required" };

    const approvalStatus: ApprovalStatus = input.approval_status ?? "APPROVED";

    const { data, error } = await supabase
      .from("cafeterias")
      .insert({
        university_id: input.university_id,
        name,
        slug,
        is_active: input.is_active ?? true,
        approval_status: approvalStatus,
        approved_by: approvalStatus === "APPROVED" ? context.userId : null,
        approved_at: approvalStatus === "APPROVED" ? new Date().toISOString() : null,
        created_by: context.userId,
      })
      .select("id")
      .single();

    if (error) {
      console.error("createCafeteriaAction error:", error);
      return { success: false, message: error.message || "Failed to create cafeteria" };
    }

    revalidatePath("/admin");
    revalidatePath("/admin/cafeterias");
    return { success: true, message: "Cafeteria created successfully", id: data.id };
  } catch (err: unknown) {
    return { success: false, message: (err as Error)?.message || "Unexpected error occurred" };
  }
}

export async function updateCafeteriaAction(input: UpdateCafeteriaInput): Promise<AdminActionResult> {
  try {
    const context = await requireAdmin();
    const supabase = await createClient();

    const name = input.name.trim();
    const slug = input.slug.trim().toLowerCase();

    if (!input.university_id) return { success: false, message: "Parent university is required" };
    if (!name) return { success: false, message: "Cafeteria name is required" };
    if (!slug) return { success: false, message: "Valid slug is required" };

    const updatePayload: Record<string, unknown> = {
      university_id: input.university_id,
      name,
      slug,
      is_active: input.is_active,
      approval_status: input.approval_status,
      updated_at: new Date().toISOString(),
    };

    if (input.approval_status === "APPROVED") {
      updatePayload.approved_by = context.userId;
      updatePayload.approved_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from("cafeterias")
      .update(updatePayload)
      .eq("id", input.id);

    if (error) {
      console.error("updateCafeteriaAction error:", error);
      return { success: false, message: error.message || "Failed to update cafeteria" };
    }

    revalidatePath("/admin");
    revalidatePath("/admin/cafeterias");
    revalidatePath("/admin/approvals");
    return { success: true, message: "Cafeteria updated successfully" };
  } catch (err: unknown) {
    return { success: false, message: (err as Error)?.message || "Unexpected error occurred" };
  }
}

export async function toggleCafeteriaStatusAction(id: string, is_active: boolean): Promise<AdminActionResult> {
  try {
    await requireAdmin();
    const supabase = await createClient();

    const { error } = await supabase
      .from("cafeterias")
      .update({ is_active, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      return { success: false, message: error.message || "Failed to toggle cafeteria status" };
    }

    revalidatePath("/admin");
    revalidatePath("/admin/cafeterias");
    return { success: true, message: `Cafeteria ${is_active ? "activated" : "deactivated"} successfully` };
  } catch (err: unknown) {
    return { success: false, message: (err as Error)?.message || "Unexpected error occurred" };
  }
}

export async function updateCafeteriaApprovalAction(
  id: string,
  approval_status: ApprovalStatus
): Promise<AdminActionResult> {
  try {
    const context = await requireAdmin();
    const supabase = await createClient();

    const updatePayload: Record<string, unknown> = {
      approval_status,
      updated_at: new Date().toISOString(),
    };

    if (approval_status === "APPROVED") {
      updatePayload.approved_by = context.userId;
      updatePayload.approved_at = new Date().toISOString();
    } else {
      updatePayload.approved_by = null;
      updatePayload.approved_at = null;
    }

    const { error } = await supabase
      .from("cafeterias")
      .update(updatePayload)
      .eq("id", id);

    if (error) {
      return { success: false, message: error.message || "Failed to update cafeteria approval status" };
    }

    revalidatePath("/admin");
    revalidatePath("/admin/cafeterias");
    revalidatePath("/admin/approvals");
    return { success: true, message: `Cafeteria approval set to ${approval_status}` };
  } catch (err: unknown) {
    return { success: false, message: (err as Error)?.message || "Unexpected error occurred" };
  }
}

// -----------------------------------------------------------------------------
// Shop / Outlet Actions
// -----------------------------------------------------------------------------

export async function createShopAction(input: CreateShopInput): Promise<AdminActionResult> {
  try {
    const context = await requireAdmin();
    const supabase = await createClient();

    const name = input.name.trim();
    const slug = (input.slug.trim() || slugify(name)).toLowerCase();

    if (!input.cafeteria_id) return { success: false, message: "Parent cafeteria is required" };
    if (!name) return { success: false, message: "Shop name is required" };
    if (!slug) return { success: false, message: "Valid slug is required" };

    const approvalStatus: ApprovalStatus = input.approval_status ?? "APPROVED";

    const { data, error } = await supabase
      .from("shops")
      .insert({
        cafeteria_id: input.cafeteria_id,
        name,
        slug,
        description: input.description?.trim() || null,
        is_active: input.is_active ?? true,
        approval_status: approvalStatus,
        approved_by: approvalStatus === "APPROVED" ? context.userId : null,
        approved_at: approvalStatus === "APPROVED" ? new Date().toISOString() : null,
        created_by: context.userId,
      })
      .select("id")
      .single();

    if (error) {
      console.error("createShopAction error:", error);
      return { success: false, message: error.message || "Failed to create shop" };
    }

    revalidatePath("/admin");
    revalidatePath("/admin/shops");
    return { success: true, message: "Shop created successfully", id: data.id };
  } catch (err: unknown) {
    return { success: false, message: (err as Error)?.message || "Unexpected error occurred" };
  }
}

export async function updateShopAction(input: UpdateShopInput): Promise<AdminActionResult> {
  try {
    const context = await requireAdmin();
    const supabase = await createClient();

    const name = input.name.trim();
    const slug = input.slug.trim().toLowerCase();

    if (!input.cafeteria_id) return { success: false, message: "Parent cafeteria is required" };
    if (!name) return { success: false, message: "Shop name is required" };
    if (!slug) return { success: false, message: "Valid slug is required" };

    const updatePayload: Record<string, unknown> = {
      cafeteria_id: input.cafeteria_id,
      name,
      slug,
      description: input.description?.trim() || null,
      is_active: input.is_active,
      approval_status: input.approval_status,
      updated_at: new Date().toISOString(),
    };

    if (input.approval_status === "APPROVED") {
      updatePayload.approved_by = context.userId;
      updatePayload.approved_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from("shops")
      .update(updatePayload)
      .eq("id", input.id);

    if (error) {
      console.error("updateShopAction error:", error);
      return { success: false, message: error.message || "Failed to update shop" };
    }

    revalidatePath("/admin");
    revalidatePath("/admin/shops");
    revalidatePath("/admin/approvals");
    return { success: true, message: "Shop updated successfully" };
  } catch (err: unknown) {
    return { success: false, message: (err as Error)?.message || "Unexpected error occurred" };
  }
}

export async function toggleShopStatusAction(id: string, is_active: boolean): Promise<AdminActionResult> {
  try {
    await requireAdmin();
    const supabase = await createClient();

    const { error } = await supabase
      .from("shops")
      .update({ is_active, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      return { success: false, message: error.message || "Failed to toggle shop status" };
    }

    revalidatePath("/admin");
    revalidatePath("/admin/shops");
    return { success: true, message: `Shop ${is_active ? "activated" : "deactivated"} successfully` };
  } catch (err: unknown) {
    return { success: false, message: (err as Error)?.message || "Unexpected error occurred" };
  }
}

export async function updateShopApprovalAction(
  id: string,
  approval_status: ApprovalStatus
): Promise<AdminActionResult> {
  try {
    const context = await requireAdmin();
    const supabase = await createClient();

    const updatePayload: Record<string, unknown> = {
      approval_status,
      updated_at: new Date().toISOString(),
    };

    if (approval_status === "APPROVED") {
      updatePayload.approved_by = context.userId;
      updatePayload.approved_at = new Date().toISOString();
    } else {
      updatePayload.approved_by = null;
      updatePayload.approved_at = null;
    }

    const { error } = await supabase
      .from("shops")
      .update(updatePayload)
      .eq("id", id);

    if (error) {
      return { success: false, message: error.message || "Failed to update shop approval status" };
    }

    revalidatePath("/admin");
    revalidatePath("/admin/shops");
    revalidatePath("/admin/approvals");
    return { success: true, message: `Shop approval set to ${approval_status}` };
  } catch (err: unknown) {
    return { success: false, message: (err as Error)?.message || "Unexpected error occurred" };
  }
}

// -----------------------------------------------------------------------------
// Terminal Account Actions
// -----------------------------------------------------------------------------

export async function createTerminalAccountAction(
  input: CreateTerminalAccountInput
): Promise<AdminActionResult> {
  try {
    const context = await requireAdmin();
    const adminClient = createAdminClient();

    const displayName = input.display_name.trim();
    const email = input.email.trim().toLowerCase();
    const password = input.password || "Terminal1234!";

    if (!input.shop_id) return { success: false, message: "Physical shop assignment is required" };
    if (!displayName) return { success: false, message: "Terminal display name is required" };
    if (!email || !email.includes("@")) return { success: false, message: "Valid email address is required" };
    if (password.length < 6) return { success: false, message: "Password must be at least 6 characters" };

    // Verify target shop exists
    const { data: shop, error: shopCheckError } = await adminClient
      .from("shops")
      .select("id, name")
      .eq("id", input.shop_id)
      .maybeSingle();

    if (shopCheckError || !shop) {
      return { success: false, message: "Assigned shop was not found" };
    }

    // 1. Create auth user
    const { data: userData, error: createAuthError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName, role: "terminal" },
    });

    if (createAuthError || !userData?.user) {
      console.error("createTerminalUser error:", createAuthError);
      return { success: false, message: createAuthError?.message || "Failed to create terminal auth user" };
    }

    const authUserId = userData.user.id;

    // 2. Insert profile
    const { error: profileError } = await adminClient
      .from("profiles")
      .upsert({
        id: authUserId,
        display_name: displayName,
        is_active: true,
      }, { onConflict: "id" });

    if (profileError) {
      console.error("terminal profile error:", profileError);
      // Clean up created user to prevent orphans
      await adminClient.auth.admin.deleteUser(authUserId);
      return { success: false, message: "Failed to configure terminal profile" };
    }

    // 3. Assign terminal role
    const { data: roleRow, error: roleLookupError } = await adminClient
      .from("roles")
      .select("id")
      .eq("name", "terminal")
      .maybeSingle();

    if (roleLookupError || !roleRow) {
      console.error("terminal role lookup error:", roleLookupError);
      await adminClient.auth.admin.deleteUser(authUserId);
      return { success: false, message: "System terminal role is missing" };
    }

    const { error: roleAssignError } = await adminClient
      .from("user_roles")
      .insert({
        user_id: authUserId,
        role_id: roleRow.id,
        is_active: true,
        assigned_by: context.userId,
      });

    if (roleAssignError) {
      console.error("terminal role assign error:", roleAssignError);
      await adminClient.auth.admin.deleteUser(authUserId);
      return { success: false, message: "Failed to grant terminal role" };
    }

    // 4. Link to terminal_accounts
    const { data: terminalAcc, error: terminalError } = await adminClient
      .from("terminal_accounts")
      .insert({
        auth_user_id: authUserId,
        shop_id: input.shop_id,
        display_name: displayName,
        is_active: true,
      })
      .select("id")
      .single();

    if (terminalError) {
      console.error("terminal_accounts insert error:", terminalError);
      await adminClient.auth.admin.deleteUser(authUserId);
      return { success: false, message: terminalError.message || "Failed to link terminal to physical shop" };
    }

    revalidatePath("/admin");
    revalidatePath("/admin/terminals");
    return {
      success: true,
      message: `Terminal account created successfully for "${displayName}" (${email})`,
      id: terminalAcc.id,
    };
  } catch (err: unknown) {
    return { success: false, message: (err as Error)?.message || "Unexpected error occurred" };
  }
}

export async function updateTerminalAccountAction(
  input: UpdateTerminalAccountInput
): Promise<AdminActionResult> {
  try {
    await requireAdmin();
    const supabase = await createClient();

    const displayName = input.display_name.trim();
    if (!displayName) return { success: false, message: "Terminal display name is required" };
    if (!input.shop_id) return { success: false, message: "Shop assignment is required" };

    const { error } = await supabase
      .from("terminal_accounts")
      .update({
        shop_id: input.shop_id,
        display_name: displayName,
        is_active: input.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.id);

    if (error) {
      console.error("updateTerminalAccountAction error:", error);
      return { success: false, message: error.message || "Failed to update terminal account" };
    }

    revalidatePath("/admin");
    revalidatePath("/admin/terminals");
    return { success: true, message: "Terminal account updated successfully" };
  } catch (err: unknown) {
    return { success: false, message: (err as Error)?.message || "Unexpected error occurred" };
  }
}

export async function resetTerminalPasswordAction(
  terminalAccountId: string,
  newPassword: string
): Promise<AdminActionResult> {
  try {
    await requireAdmin();
    const adminClient = createAdminClient();

    if (!newPassword || newPassword.length < 6) {
      return { success: false, message: "Password must be at least 6 characters" };
    }

    const { data: terminal, error: fetchError } = await adminClient
      .from("terminal_accounts")
      .select("auth_user_id, display_name")
      .eq("id", terminalAccountId)
      .maybeSingle();

    if (fetchError || !terminal) {
      return { success: false, message: "Terminal account not found" };
    }

    const { error: updateError } = await adminClient.auth.admin.updateUserById(
      terminal.auth_user_id,
      { password: newPassword }
    );

    if (updateError) {
      return { success: false, message: updateError.message || "Failed to update password" };
    }

    return { success: true, message: `Password updated for ${terminal.display_name}` };
  } catch (err: unknown) {
    return { success: false, message: (err as Error)?.message || "Unexpected error occurred" };
  }
}

export async function toggleTerminalStatusAction(id: string, is_active: boolean): Promise<AdminActionResult> {
  try {
    await requireAdmin();
    const supabase = await createClient();

    const { error } = await supabase
      .from("terminal_accounts")
      .update({ is_active, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      return { success: false, message: error.message || "Failed to toggle terminal status" };
    }

    revalidatePath("/admin");
    revalidatePath("/admin/terminals");
    return { success: true, message: `Terminal ${is_active ? "activated" : "deactivated"} successfully` };
  } catch (err: unknown) {
    return { success: false, message: (err as Error)?.message || "Unexpected error occurred" };
  }
}

// -----------------------------------------------------------------------------
// Menu Item Actions
// -----------------------------------------------------------------------------

export async function createMenuItemAction(input: CreateMenuItemInput): Promise<AdminActionResult> {
  try {
    await requireAdmin();
    const supabase = await createClient();

    const name = input.name.trim();
    const price = Number(input.price);
    const initialStock = Number(input.initial_stock);
    const maxQty = Number(input.max_quantity_per_order);

    if (!input.shop_id) return { success: false, message: "Physical shop assignment is required" };
    if (!name) return { success: false, message: "Item name is required" };
    if (isNaN(price) || price < 0) return { success: false, message: "Valid non-negative price is required" };
    if (isNaN(initialStock) || initialStock < 0) return { success: false, message: "Valid non-negative stock quantity is required" };
    if (isNaN(maxQty) || maxQty <= 0) return { success: false, message: "Maximum quantity per order must be at least 1" };

    const { data, error } = await supabase
      .from("menu_items")
      .insert({
        shop_id: input.shop_id,
        name,
        description: input.description?.trim() || null,
        price,
        stock_quantity: Math.floor(initialStock),
        max_quantity_per_order: Math.floor(maxQty),
        is_manually_available: input.is_manually_available ?? true,
        is_active: input.is_active ?? true,
        image_path: input.image_path?.trim() || null,
      })
      .select("id")
      .single();

    if (error) {
      console.error("createMenuItemAction error:", error);
      return { success: false, message: error.message || "Failed to create menu item" };
    }

    revalidatePath("/admin");
    revalidatePath("/admin/menus");
    return { success: true, message: `Menu item "${name}" created successfully`, id: data.id };
  } catch (err: unknown) {
    return { success: false, message: (err as Error)?.message || "Unexpected error occurred" };
  }
}

export async function updateMenuItemAction(input: UpdateMenuItemInput): Promise<AdminActionResult> {
  try {
    await requireAdmin();
    const supabase = await createClient();

    const name = input.name.trim();
    const price = Number(input.price);
    const maxQty = Number(input.max_quantity_per_order);

    if (!name) return { success: false, message: "Item name is required" };
    if (isNaN(price) || price < 0) return { success: false, message: "Valid non-negative price is required" };
    if (isNaN(maxQty) || maxQty <= 0) return { success: false, message: "Maximum quantity per order must be at least 1" };

    // 1. Update details (excluding stock_quantity to satisfy trigger requirement)
    const { error: updateError } = await supabase
      .from("menu_items")
      .update({
        name,
        description: input.description?.trim() || null,
        price,
        max_quantity_per_order: Math.floor(maxQty),
        is_manually_available: input.is_manually_available,
        is_active: input.is_active,
        image_path: input.image_path?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.id);

    if (updateError) {
      console.error("updateMenuItemAction details error:", updateError);
      return { success: false, message: updateError.message || "Failed to update menu item" };
    }

    // 2. Adjust stock if a non-zero adjustment was requested
    const stockAdj = Number(input.stock_adjustment || 0);
    if (!isNaN(stockAdj) && stockAdj !== 0) {
      const { error: rpcError } = await supabase.rpc("adjust_menu_item_stock", {
        p_menu_item_id: input.id,
        p_quantity_change: Math.floor(stockAdj),
      });

      if (rpcError) {
        console.error("adjust_menu_item_stock RPC error:", rpcError);
        return {
          success: false,
          message: `Details updated, but stock adjustment failed: ${rpcError.message}`,
        };
      }
    }

    revalidatePath("/admin");
    revalidatePath("/admin/menus");
    return { success: true, message: "Menu item updated successfully" };
  } catch (err: unknown) {
    return { success: false, message: (err as Error)?.message || "Unexpected error occurred" };
  }
}

export async function toggleMenuItemStatusAction(id: string, is_active: boolean): Promise<AdminActionResult> {
  try {
    await requireAdmin();
    const supabase = await createClient();

    const { error } = await supabase
      .from("menu_items")
      .update({ is_active, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      return { success: false, message: error.message || "Failed to toggle menu item status" };
    }

    revalidatePath("/admin");
    revalidatePath("/admin/menus");
    return { success: true, message: `Menu item ${is_active ? "activated" : "deactivated"} successfully` };
  } catch (err: unknown) {
    return { success: false, message: (err as Error)?.message || "Unexpected error occurred" };
  }
}

export async function toggleMenuItemAvailabilityAction(
  id: string,
  is_manually_available: boolean
): Promise<AdminActionResult> {
  try {
    await requireAdmin();
    const supabase = await createClient();

    const { error } = await supabase
      .from("menu_items")
      .update({ is_manually_available, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      return { success: false, message: error.message || "Failed to toggle item availability" };
    }

    revalidatePath("/admin");
    revalidatePath("/admin/menus");
    return {
      success: true,
      message: `Menu item marked as ${is_manually_available ? "available" : "unavailable"}`,
    };
  } catch (err: unknown) {
    return { success: false, message: (err as Error)?.message || "Unexpected error occurred" };
  }
}
