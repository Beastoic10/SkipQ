import "server-only";

import { createClient } from "@/lib/supabase/server";

export type ResolvedShopContext = {
  shopId: string;
  shopName: string;
  cafeteriaId: string;
  cafeteriaName: string;
  universityId: string;
  universityName: string;
};

export type MenuItemWithLiveStock = {
  id: string;
  shop_id: string;
  name: string;
  description: string | null;
  price: number;
  stock_quantity: number;
  max_quantity_per_order: number;
  is_manually_available: boolean;
  is_active: boolean;
  reserved_quantity: number;
  available_stock: number;
};

export type ItemResolutionResult =
  | {
      status: "ready_for_confirmation";
      item: {
        id: string;
        name: string;
        price: number;
        quantity: number;
        lineTotal: number;
      };
      shop: {
        id: string;
        name: string;
        cafeteria: string;
        university: string;
      };
      totalAmount: number;
    }
  | {
      status: "ambiguous";
      message: string;
      matchingNames: string[];
    }
  | {
      status: "not_found";
      message: string;
      availableItems: string[];
    }
  | {
      status: "unavailable";
      message: string;
    }
  | {
      status: "out_of_stock";
      message: string;
    }
  | {
      status: "exceeds_limit";
      message: string;
    }
  | {
      status: "insufficient_stock";
      message: string;
    }
  | {
      status: "invalid_quantity";
      message: string;
    };

/**
 * Validates and resolves the current shop context against the real database hierarchy.
 * Returns null if the shop does not exist or is inactive/unapproved.
 */
export async function resolveShopContext(
  shopId?: string | null
): Promise<ResolvedShopContext | null> {
  if (!shopId) return null;

  const supabase = await createClient();

  const { data: shop, error } = await supabase
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

  if (error || !shop) return null;

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
    return null;
  }

  return {
    shopId: shop.id,
    shopName: shop.name,
    cafeteriaId: cafeteriaData.id,
    cafeteriaName: cafeteriaData.name,
    universityId: universityData.id,
    universityName: universityData.name,
  };
}

/**
 * Fetches all active menu items for a shop and calculates live available stock
 * by subtracting active unexpired reservations.
 */
export async function getShopMenuWithStock(
  shopId: string
): Promise<MenuItemWithLiveStock[]> {
  const supabase = await createClient();

  const { data: rawItems, error } = await supabase
    .from("menu_items")
    .select("id, shop_id, name, description, price, stock_quantity, max_quantity_per_order, is_manually_available, is_active")
    .eq("shop_id", shopId)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error || !rawItems) return [];

  return Promise.all(
    rawItems.map(async (item) => {
      const { data: reserved } = await supabase.rpc("active_reserved_quantity", {
        p_menu_item_id: item.id,
      });

      const reservedQty = Number(reserved ?? 0);
      const stockQty = Number(item.stock_quantity ?? 0);
      const availableStock = Math.max(0, stockQty - reservedQty);

      return {
        id: item.id,
        shop_id: item.shop_id,
        name: item.name,
        description: item.description,
        price: Number(item.price),
        stock_quantity: stockQty,
        max_quantity_per_order: Number(item.max_quantity_per_order),
        is_manually_available: Boolean(item.is_manually_available),
        is_active: Boolean(item.is_active),
        reserved_quantity: reservedQty,
        available_stock: availableStock,
      };
    })
  );
}

function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Resolves an item name requested by the AI against the real database menu items.
 * Performs disambiguation, availability checks, and inventory limits.
 */
export function resolveMenuItem(
  menuItems: MenuItemWithLiveStock[],
  shop: ResolvedShopContext,
  requestedName: string,
  quantity: number
): ItemResolutionResult {
  const qty = Math.floor(quantity);
  if (isNaN(qty) || qty <= 0) {
    return {
      status: "invalid_quantity",
      message: "Please specify a valid quantity of 1 or more.",
    };
  }

  const normalizedQuery = normalizeString(requestedName);
  if (!normalizedQuery) {
    return {
      status: "not_found",
      message: "Please provide a valid item name.",
      availableItems: menuItems.map((i) => i.name),
    };
  }

  // 1. Exact match (case & whitespace insensitive)
  const exactMatches = menuItems.filter(
    (item) => normalizeString(item.name) === normalizedQuery
  );

  let targetItem: MenuItemWithLiveStock | null = null;

  if (exactMatches.length === 1) {
    targetItem = exactMatches[0];
  } else if (exactMatches.length > 1) {
    return {
      status: "ambiguous",
      message: `Multiple items match "${requestedName}": ${exactMatches.map((i) => i.name).join(", ")}. Please clarify which one you'd like.`,
      matchingNames: exactMatches.map((i) => i.name),
    };
  } else {
    // 2. Partial / Substring matches
    const queryTokens = normalizedQuery.split(" ").filter(Boolean);

    const substringMatches = menuItems.filter((item) => {
      const normalizedItem = normalizeString(item.name);
      // Either full phrase is contained, or every token is contained
      return (
        normalizedItem.includes(normalizedQuery) ||
        queryTokens.every((token) => normalizedItem.includes(token))
      );
    });

    if (substringMatches.length === 0) {
      // 3. Fallback: check if item name is contained in the query (e.g. user typed "cold coffee drink")
      const reverseMatches = menuItems.filter((item) =>
        normalizedQuery.includes(normalizeString(item.name))
      );

      if (reverseMatches.length === 1) {
        targetItem = reverseMatches[0];
      } else if (reverseMatches.length > 1) {
        return {
          status: "ambiguous",
          message: `Multiple items match your request: ${reverseMatches.map((i) => i.name).join(", ")}. Which one would you prefer?`,
          matchingNames: reverseMatches.map((i) => i.name),
        };
      } else {
        return {
          status: "not_found",
          message: `"${requestedName}" was not found on the menu at ${shop.shopName}.`,
          availableItems: menuItems.map((i) => i.name),
        };
      }
    } else if (substringMatches.length === 1) {
      targetItem = substringMatches[0];
    } else {
      // Ambiguous: multiple items match the query (e.g. "Cold Coffee" vs "Vanilla Cold Coffee")
      return {
        status: "ambiguous",
        message: `We have multiple options matching "${requestedName}": ${substringMatches.map((i) => i.name).join(", ")}. Which one would you like?`,
        matchingNames: substringMatches.map((i) => i.name),
      };
    }
  }

  // Now validate business rules against the real database item
  if (!targetItem.is_active || !targetItem.is_manually_available) {
    return {
      status: "unavailable",
      message: `"${targetItem.name}" is currently unavailable for ordering.`,
    };
  }

  if (targetItem.available_stock <= 0) {
    return {
      status: "out_of_stock",
      message: `"${targetItem.name}" is currently out of stock.`,
    };
  }

  if (qty > targetItem.max_quantity_per_order) {
    return {
      status: "exceeds_limit",
      message: `Maximum ${targetItem.max_quantity_per_order} of "${targetItem.name}" allowed per order.`,
    };
  }

  if (qty > targetItem.available_stock) {
    return {
      status: "insufficient_stock",
      message: `Only ${targetItem.available_stock} "${targetItem.name}" remaining in stock.`,
    };
  }

  const price = targetItem.price;
  const lineTotal = price * qty;

  return {
    status: "ready_for_confirmation",
    item: {
      id: targetItem.id,
      name: targetItem.name,
      price,
      quantity: qty,
      lineTotal,
    },
    shop: {
      id: shop.shopId,
      name: shop.shopName,
      cafeteria: shop.cafeteriaName,
      university: shop.universityName,
    },
    totalAmount: lineTotal,
  };
}

export type UniversityItem = {
  id: string;
  name: string;
  slug: string;
};

export type ShopWithItemMatch = {
  shopId: string;
  shopName: string;
  cafeteriaId: string;
  cafeteriaName: string;
  universityId: string;
  universityName: string;
  matchedItems: MenuItemWithLiveStock[];
};

export async function getAvailableUniversities(): Promise<UniversityItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("universities")
    .select("id, name, slug")
    .eq("is_active", true)
    .order("name", { ascending: true });
  return data ?? [];
}

export function matchUniversityFromText(
  text: string,
  universities: UniversityItem[]
): UniversityItem | null {
  const normalizedText = normalizeString(text);
  if (!normalizedText) return null;

  // Generic words that appear in many university names — exclude from fuzzy token matching
  const genericWords = new Set([
    "university", "international", "college", "institute", "technology",
    "science", "engineering", "of", "the", "and", "bangladesh", "national",
  ]);

  let bestMatch: UniversityItem | null = null;
  let bestScore = 0;

  for (const uni of universities) {
    const normUni = normalizeString(uni.name);

    // 1. Acronym match (highest priority, e.g. UIU, NSU, AIUB)
    const acronymMatch = uni.name.match(/\(([^)]+)\)/);
    const acronym = acronymMatch ? normalizeString(acronymMatch[1]) : "";

    if (acronym && normalizedText.includes(acronym)) {
      // Acronym match beats everything — return immediately
      return uni;
    }

    // 2. Exact full-name containment (one contains the other)
    if (normalizedText === normUni) {
      return uni; // Perfect match
    }
    if (normalizedText.includes(normUni)) {
      // Query fully contains the university name — very strong match
      const score = normUni.length * 10;
      if (score > bestScore) {
        bestScore = score;
        bestMatch = uni;
      }
      continue;
    }
    if (normUni.includes(normalizedText)) {
      const score = normalizedText.length * 8;
      if (score > bestScore) {
        bestScore = score;
        bestMatch = uni;
      }
      continue;
    }

    // 3. Token-based scoring: count how many *distinctive* tokens overlap
    const uniTokens = normUni.split(" ").filter((t) => t.length > 2);
    const textTokens = normalizedText.split(" ").filter((t) => t.length > 2);

    // Score distinctive matches higher than generic ones
    let tokenScore = 0;
    let distinctiveMatches = 0;
    for (const ut of uniTokens) {
      if (textTokens.some((tt) => ut === tt || ut.includes(tt) || tt.includes(ut))) {
        if (genericWords.has(ut)) {
          tokenScore += 1; // Generic word match: low weight
        } else {
          tokenScore += 5; // Distinctive word match (e.g. "united", "american"): high weight
          distinctiveMatches++;
        }
      }
    }

    // Require at least one distinctive token match for fuzzy matching
    if (distinctiveMatches >= 1 && tokenScore > bestScore) {
      bestScore = tokenScore;
      bestMatch = uni;
    }
  }

  return bestMatch;
}

export async function findShopsAtUniversity(
  universityId: string,
  itemNameQuery?: string | null
): Promise<ShopWithItemMatch[]> {
  const supabase = await createClient();

  const { data: shops, error } = await supabase
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
    .eq("cafeterias.university_id", universityId)
    .eq("is_active", true)
    .eq("approval_status", "APPROVED");

  if (error || !shops) return [];

  const results: ShopWithItemMatch[] = [];

  for (const shop of shops) {
    const cafeteriaData = Array.isArray(shop.cafeterias) ? shop.cafeterias[0] : shop.cafeterias;
    const universityData = cafeteriaData && (Array.isArray(cafeteriaData.universities) ? cafeteriaData.universities[0] : cafeteriaData.universities);

    if (
      !cafeteriaData ||
      !cafeteriaData.is_active ||
      cafeteriaData.approval_status !== "APPROVED" ||
      !universityData ||
      !universityData.is_active
    ) {
      continue;
    }

    const menuItems = await getShopMenuWithStock(shop.id);

    let matchedItems = menuItems;
    if (itemNameQuery) {
      const normalizedQuery = normalizeString(itemNameQuery);
      matchedItems = menuItems.filter((item) => {
        const normName = normalizeString(item.name);
        return (
          item.is_manually_available &&
          item.available_stock > 0 &&
          (normName.includes(normalizedQuery) ||
            normalizedQuery.includes(normName) ||
            normalizedQuery.split(" ").some((t) => t.length > 2 && normName.includes(t)))
        );
      });
    }

    if (!itemNameQuery || matchedItems.length > 0) {
      results.push({
        shopId: shop.id,
        shopName: shop.name,
        cafeteriaId: cafeteriaData.id,
        cafeteriaName: cafeteriaData.name,
        universityId: universityData.id,
        universityName: universityData.name,
        matchedItems,
      });
    }
  }

  return results;
}

