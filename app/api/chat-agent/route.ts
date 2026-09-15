import { GoogleGenAI, FunctionDeclaration, Type } from "@google/genai";
import { getCurrentUserContext } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { placeCashOrderAction } from "@/lib/customer/actions";
import {
  resolveShopContext,
  getShopMenuWithStock,
  resolveMenuItem,
  getAvailableUniversities,
  matchUniversityFromText,
  findShopsAtUniversity,
  type ResolvedShopContext,
} from "@/lib/customer/chat-agent-service";

export const dynamic = "force-dynamic";

const prepareOrderDeclaration: FunctionDeclaration = {
  name: "prepare_order",
  description:
    "Prepares a food order item for customer review and confirmation. Does NOT place the order. Always call this when the customer expresses an intent to order a menu item.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      item_name: {
        type: Type.STRING,
        description:
          "The name of the menu item requested by the customer, e.g. Cold Coffee, Chicken Biryani, Burger.",
      },
      quantity: {
        type: Type.INTEGER,
        description:
          "The quantity of items to order as a positive whole number (e.g. 1, 2, 3). Defaults to 1 if not specified.",
      },
    },
    required: ["item_name", "quantity"],
  },
};

type ChatMessagePart = {
  role: "user" | "model";
  text: string;
};

export type ChatOption = {
  label: string;
  value: string;
  shopId?: string;
  universityId?: string;
};

// Resilient model invocation with fallback
async function generateWithGemini(
  ai: GoogleGenAI,
  params: {
    contents: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }>;
    systemInstruction: string;
    tools?: Array<{ functionDeclarations: FunctionDeclaration[] }>;
  }
) {
  const modelsToTry = [
    process.env.GEMINI_MODEL || "gemini-3.6-flash",
    "gemini-3.6-flash",
    "gemini-3.7-flash",
    "gemini-3.8-flash",
  ];
  const uniqueModels = Array.from(new Set(modelsToTry));

  let lastError: unknown = null;
  for (const model of uniqueModels) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: params.contents,
        config: {
          systemInstruction: params.systemInstruction,
          tools: params.tools,
        },
      });
      return response;
    } catch (err: unknown) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[/api/chat-agent] Model ${model} returned error: ${msg}. Attempting fallback...`);
      if (
        msg.includes("404") ||
        msg.includes("503") ||
        msg.includes("NOT_FOUND") ||
        msg.includes("UNAVAILABLE") ||
        msg.includes("not available to new users") ||
        msg.includes("high demand")
      ) {
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

// Simple regex extractor for quantity and item when parsing natural phrases
function extractOrderIntent(text: string): { item: string; quantity: number } | null {
  // Never parse sentinel selection messages as food items
  if (text.startsWith("__")) return null;

  const lower = text.toLowerCase().trim();
  // e.g. "order 2x cold coffee", "2 cold coffees", "get me 1 burger", "2x coffee to order"
  const qtyMatch = lower.match(/\b(\d+)\s*(?:x\s*)?([a-z\s'-]+?)(?:\s+for\s+me|\s+please|\s+to\s+order)?$/i) ||
                   lower.match(/(?:order|get|buy|want)\s+(\d+)\s*(?:x\s*)?([a-z\s'-]+)/i);

  if (qtyMatch) {
    const qty = parseInt(qtyMatch[1], 10);
    const item = qtyMatch[2].replace(/\b(?:for me|please|to order|can i have|i want)\b/gi, "").trim();
    if (qty > 0 && item.length > 1) {
      return { item, quantity: qty };
    }
  }

  // Fallback if no explicit number: check words like "a cold coffee" or "cold coffee"
  if (lower.includes("coffee") || lower.includes("burger") || lower.includes("juice") || lower.includes("tehari") || lower.includes("biryani")) {
    const item = lower.replace(/\b(?:order|get me|i want|please|for me|to order|can i have)\b/gi, "").trim();
    return { item: item || "coffee", quantity: 1 };
  }

  return null;
}

export async function POST(request: Request) {
  try {
    // 1. Authenticate customer
    const userContext = await getCurrentUserContext();
    if (!userContext || !userContext.roles.includes("customer")) {
      return Response.json(
        { error: "Unauthorized. An authenticated customer session is required." },
        { status: 401 }
      );
    }

    const body = await request.json();

    // ------------------------------------------------------------------------
    // Action 1: Explicit Order Confirmation
    // ------------------------------------------------------------------------
    if (body.action === "confirm_order") {
      const { shopId, items } = body as {
        shopId?: string;
        items?: Array<{ menuItemId: string; quantity: number }>;
      };

      if (!shopId || !Array.isArray(items) || items.length === 0) {
        return Response.json(
          { success: false, error: "Invalid confirmation payload. Shop and items are required." },
          { status: 400 }
        );
      }

      // Re-verify shop hierarchy before order execution
      const shopContext = await resolveShopContext(shopId);
      if (!shopContext) {
        return Response.json(
          { success: false, error: "This sales point is inactive or no longer approved for ordering." },
          { status: 400 }
        );
      }

      // Call the existing trusted order-placement server logic / RPC
      const orderResult = await placeCashOrderAction(
        shopId,
        items.map((i) => ({
          menu_item_id: i.menuItemId,
          quantity: i.quantity,
        }))
      );

      if (!orderResult.success) {
        return Response.json({
          success: false,
          error: orderResult.error,
        });
      }

      // Fetch newly generated 4-digit order_code for display in chat
      const supabase = await createClient();
      const { data: orderRow } = await supabase
        .from("orders")
        .select("order_code")
        .eq("id", orderResult.orderId)
        .maybeSingle();

      return Response.json({
        success: true,
        orderId: orderResult.orderId,
        orderNumber: orderResult.orderNumber,
        orderCode: orderRow?.order_code ?? null,
        collectionToken: orderResult.collectionToken,
      });
    }

    // ------------------------------------------------------------------------
    // Action 2: Natural Language Chat with Gemini Agent
    // ------------------------------------------------------------------------
    const {
      message,
      history,
      shopId: clientShopId,
      universityId: clientUniId,
      pendingIntent: clientPendingIntent,
    } = body as {
      message?: string;
      history?: ChatMessagePart[];
      shopId?: string | null;
      universityId?: string | null;
      pendingIntent?: { item: string; quantity: number } | null;
    };

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return Response.json(
        { error: "A non-empty user message is required." },
        { status: 400 }
      );
    }

    const trimmedMsg = message.trim();

    // Detect sentinel messages emitted when user clicks a structured option button.
    // These should not be parsed as food item names.
    const isShopSelection = trimmedMsg.startsWith("__select_shop__");
    const isUniversitySelection = trimmedMsg.startsWith("__select_university__");
    // The human-readable label embedded in the sentinel (after ': ')
    const sentinelLabel = trimmedMsg.split(": ").slice(1).join(": ").trim();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return Response.json(
        {
          error:
            "GEMINI_API_KEY is not configured on the server. Please add your GEMINI_API_KEY to .env.local to use the AI chat assistant.",
        },
        { status: 503 }
      );
    }

    const universities = await getAvailableUniversities();

    // If user just selected a shop via option button, skip food-intent extraction from message.
    // Rely solely on clientPendingIntent which was passed explicitly from the frontend.
    const orderIntent = isShopSelection
      ? clientPendingIntent
      : (extractOrderIntent(trimmedMsg) || clientPendingIntent);

    // For university matching: use the sentinel label (the readable name) for shop/uni selections,
    // otherwise use the full trimmed message.
    const textForUniMatch = (isShopSelection || isUniversitySelection)
      ? sentinelLabel
      : trimmedMsg;

    // Check if user mentioned a university in their message or passed it.
    // IMPORTANT: Explicit clientUniId (from option button click) takes priority over fuzzy text matching
    // to avoid false matches on shared tokens like "international" + "university".
    const matchedUni =
      (clientUniId ? universities.find((u) => u.id === clientUniId) : null) ||
      matchUniversityFromText(textForUniMatch, universities);

    let effectiveShopContext: ResolvedShopContext | null = null;
    if (clientShopId) {
      effectiveShopContext = await resolveShopContext(clientShopId);
    }

    // If no shop context is active, try to resolve it from the university and message
    if (!effectiveShopContext) {
      // Step A: No university known yet
      if (!matchedUni) {
        const uniOptions: ChatOption[] = universities.map((u) => ({
          label: u.name,
          value: u.name,
          universityId: u.id,
        }));

        const promptText = orderIntent
          ? `I'd love to prepare ${orderIntent.quantity}x ${orderIntent.item} for you! Which campus or university are you currently at? Please choose below:`
          : "👋 Welcome to SkipQ! Which campus or university are you ordering from today? Please select your university:";

        return Response.json({
          text: promptText,
          options: uniOptions,
          pendingIntent: orderIntent,
          pendingOrder: null,
        });
      }

      // Step B: University is known (e.g. United International University)
      // Find cafeterias and shops at this university
      const shopsAtUni = await findShopsAtUniversity(
        matchedUni.id,
        orderIntent?.item ?? null
      );

      if (shopsAtUni.length === 0) {
        // No shop with that item, get all shops at uni
        const allShops = await findShopsAtUniversity(matchedUni.id, null);
        if (allShops.length === 0) {
          return Response.json({
            text: `Currently, there are no approved sales points open at ${matchedUni.name}. Please check back later.`,
            pendingOrder: null,
          });
        }

        const shopOptions: ChatOption[] = allShops.map((s) => ({
          label: `${s.shopName} (${s.cafeteriaName})`,
          value: s.shopName,
          shopId: s.shopId,
          universityId: matchedUni.id,
        }));

        return Response.json({
          text: orderIntent
            ? `I couldn't find "${orderIntent.item}" in stock at ${matchedUni.name}. Here are the open sales points at your campus you can order from:`
            : `Here are the active sales points at ${matchedUni.name}. Please select one to see the menu:`,
          options: shopOptions,
          pendingIntent: orderIntent,
          pendingOrder: null,
        });
      }

      // Check if user specifically mentioned a shop in their message.
      // Skip this heuristic for sentinel messages — they are already resolved via clientShopId.
      const lowerMsg = isShopSelection || isUniversitySelection
        ? sentinelLabel.toLowerCase()
        : trimmedMsg.toLowerCase();
      const specificallyMentionedShop = !isShopSelection && shopsAtUni.find((s) => {
        const sName = s.shopName.toLowerCase();
        const cName = s.cafeteriaName.toLowerCase();
        return (
          lowerMsg.includes(sName) ||
          sName.split(" ").some((t) => t.length > 3 && lowerMsg.includes(t)) ||
          lowerMsg.includes(cName)
        );
      });

      if (specificallyMentionedShop) {
        effectiveShopContext = await resolveShopContext(specificallyMentionedShop.shopId);
      } else if (shopsAtUni.length === 1) {
        // Exactly one shop serves this item
        effectiveShopContext = await resolveShopContext(shopsAtUni[0].shopId);
      } else {
        // Multiple shops have this item at the campus
        const shopOptions: ChatOption[] = shopsAtUni.map((s) => ({
          label: `${s.shopName} (${s.cafeteriaName})`,
          value: s.shopName,
          shopId: s.shopId,
          universityId: matchedUni.id,
        }));

        return Response.json({
          text: orderIntent
            ? `At ${matchedUni.name}, "${orderIntent.item}" is available at the following sales points. Which one would you like to order from?`
            : `Available sales points at ${matchedUni.name}:`,
          options: shopOptions,
          pendingIntent: orderIntent,
          pendingOrder: null,
        });
      }
    }

    // If at this point we still don't have a shop, ask the user to pick one
    if (!effectiveShopContext) {
      const allShops = matchedUni
        ? await findShopsAtUniversity(matchedUni.id, null)
        : [];

      return Response.json({
        text: "Please select your sales point to continue:",
        options: allShops.map((s) => ({
          label: `${s.shopName} (${s.cafeteriaName})`,
          value: s.shopName,
          shopId: s.shopId,
          universityId: matchedUni?.id,
        })),
        pendingIntent: orderIntent,
        pendingOrder: null,
      });
    }

    // Step C: We have an authenticated customer and an active validated shop!
    const menuItems = await getShopMenuWithStock(effectiveShopContext.shopId);
    if (menuItems.length === 0) {
      return Response.json({
        text: `There are currently no active menu items available at ${effectiveShopContext.shopName}. Please choose another sales point.`,
        pendingOrder: null,
      });
    }

    // If we have an orderIntent (e.g. from earlier step or current message) and it's a direct ordering request.
    // IMPORTANT: Never use a sentinel message (__select_shop__ / __select_university__) as an item name.
    const targetItemName = orderIntent?.item ?? (isShopSelection || isUniversitySelection ? null : trimmedMsg);
    const targetQuantity = orderIntent?.quantity ?? 1;

    // Only attempt direct resolution when we have a meaningful item name from intent
    const directResolution =
      targetItemName && targetItemName.length > 0
        ? resolveMenuItem(menuItems, effectiveShopContext, targetItemName, targetQuantity)
        : null;

    if (directResolution?.status === "ready_for_confirmation") {
      return Response.json({
        text: `I've prepared your order: ${directResolution.item.quantity}x ${directResolution.item.name} at ${effectiveShopContext.shopName} (${effectiveShopContext.cafeteriaName}). The total is ৳${directResolution.totalAmount}. Please review and confirm below:`,
        pendingOrder: {
          shopId: effectiveShopContext.shopId,
          shopName: effectiveShopContext.shopName,
          cafeteriaName: effectiveShopContext.cafeteriaName,
          universityName: effectiveShopContext.universityName,
          items: [
            {
              menuItemId: directResolution.item.id,
              name: directResolution.item.name,
              price: directResolution.item.price,
              quantity: directResolution.item.quantity,
              lineTotal: directResolution.item.lineTotal,
            },
          ],
          totalAmount: directResolution.totalAmount,
        },
      });
    }

    // 4. Initialize Gemini Client with function calling for natural reasoning & dialogue
    const ai = new GoogleGenAI({ apiKey });

    const menuSummary = menuItems
      .map(
        (m) =>
          `- ${m.name}: ৳${m.price} (Available stock: ${m.available_stock}, Max per order: ${m.max_quantity_per_order})`
      )
      .join("\n");

    const systemInstruction = `You are SkipQ's dedicated cafeteria food-ordering assistant.
Current Active Sales Point:
- Outlet: ${effectiveShopContext.shopName}
- Cafeteria: ${effectiveShopContext.cafeteriaName}
- Campus: ${effectiveShopContext.universityName}

Available Menu Items at ${effectiveShopContext.shopName}:
${menuSummary}

CRITICAL RULES:
1. ONLY assist with ordering food from the menu above. Do not attempt payment processing, cancellation, or admin features.
2. Whenever the customer expresses an intent to order or get food (e.g., "Order 2 cold coffees for me", "Get me one burger", "I'd like 3 lemon mint juices"), you MUST call the "prepare_order" tool immediately.
3. Pass the item name and integer quantity to "prepare_order".
4. The "prepare_order" tool validates the item and presents an explicit confirmation card to the customer. It DOES NOT place the order.
5. If the customer's request is ambiguous (e.g. asking for "coffee" when multiple coffee items exist), ask a polite clarification question instead of guessing.
6. If the item requested is not on the menu, inform the customer politely and suggest popular items from the menu above.
7. Keep responses concise, friendly, and helpful.
${orderIntent ? `
IMPORTANT: The customer has already expressed interest in ordering ${orderIntent.quantity}x "${orderIntent.item}". If this item (or a close match) exists on the menu above, call prepare_order immediately with the correct item name and quantity.` : ""}`;

    const contents: Array<{
      role: "user" | "model";
      parts: Array<{ text: string }>;
    }> = [];

    if (Array.isArray(history)) {
      for (const h of history.slice(-6)) {
        if (h.role === "user" || h.role === "model") {
          contents.push({
            role: h.role,
            parts: [{ text: h.text }],
          });
        }
      }
    }

    // Send a human-readable message to Gemini — never forward sentinel strings.
    // If user just selected a shop/uni, replace the sentinel with a natural prompt.
    const geminiUserMessage = isShopSelection
      ? orderIntent
        ? `I selected ${sentinelLabel}. Please prepare my order of ${orderIntent.quantity}x ${orderIntent.item}.`
        : `I selected ${sentinelLabel}. What can I order here?`
      : isUniversitySelection
      ? orderIntent
        ? `I'm at ${sentinelLabel}. Please prepare my order of ${orderIntent.quantity}x ${orderIntent.item}.`
        : `I'm at ${sentinelLabel}. What food options are available?`
      : trimmedMsg;

    contents.push({
      role: "user",
      parts: [{ text: geminiUserMessage }],
    });

    const response = await generateWithGemini(ai, {
      contents,
      systemInstruction,
      tools: [{ functionDeclarations: [prepareOrderDeclaration] }],
    });

    const functionCalls = response.functionCalls;

    if (functionCalls && functionCalls.length > 0) {
      const call = functionCalls[0];
      if (call.name === "prepare_order") {
        const rawArgs = (call.args || {}) as {
          item_name?: string;
          quantity?: number | string;
        };

        const itemName = String(rawArgs.item_name || "").trim();
        const quantity = Number(rawArgs.quantity) || 1;

        const resolution = resolveMenuItem(
          menuItems,
          effectiveShopContext,
          itemName,
          quantity
        );

        if (resolution.status === "ready_for_confirmation") {
          return Response.json({
            text: `I've prepared your order: ${resolution.item.quantity}x ${resolution.item.name} at ${effectiveShopContext.shopName} (${effectiveShopContext.cafeteriaName}). The total is ৳${resolution.totalAmount}. Please review and confirm below:`,
            pendingOrder: {
              shopId: effectiveShopContext.shopId,
              shopName: effectiveShopContext.shopName,
              cafeteriaName: effectiveShopContext.cafeteriaName,
              universityName: effectiveShopContext.universityName,
              items: [
                {
                  menuItemId: resolution.item.id,
                  name: resolution.item.name,
                  price: resolution.item.price,
                  quantity: resolution.item.quantity,
                  lineTotal: resolution.item.lineTotal,
                },
              ],
              totalAmount: resolution.totalAmount,
            },
          });
        } else {
          return Response.json({
            text: resolution.message,
            pendingOrder: null,
          });
        }
      }
    }

    return Response.json({
      text: response.text || "How can I help you with your order today?",
      pendingOrder: null,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    console.error("[/api/chat-agent] Error:", errorMsg);

    if (errorMsg.includes("API_KEY") || errorMsg.includes("API key")) {
      return Response.json(
        {
          error:
            "Invalid or missing Gemini API key. Please check your GEMINI_API_KEY configuration.",
        },
        { status: 401 }
      );
    }

    return Response.json(
      {
        error:
          "An unexpected error occurred while processing your request. Please try again.",
      },
      { status: 500 }
    );
  }
}
