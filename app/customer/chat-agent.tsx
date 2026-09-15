"use client";

import React, { useState, useEffect, useRef, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCart } from "@/lib/customer/cart-context";
import { saveActiveOrder } from "@/lib/customer/active-order-store";

/** Generate a unique message ID without Date.now() to satisfy React compiler purity rules. */
let _msgSeq = 0;
function uid(prefix: string) {
  return `${prefix}${++_msgSeq}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Get a formatted timestamp for chat messages. */
function timestamp() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export type ChatOption = {
  label: string;
  value: string;
  shopId?: string;
  universityId?: string;
};

type PendingOrderData = {
  shopId: string;
  shopName: string;
  cafeteriaName: string;
  universityName: string;
  items: Array<{
    menuItemId: string;
    name: string;
    price: number;
    quantity: number;
    lineTotal: number;
  }>;
  totalAmount: number;
};

type OrderSuccessData = {
  orderId: string;
  orderNumber: string;
  orderCode: string | null;
  collectionToken: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "model";
  text: string;
  timestamp: string;
  options?: ChatOption[] | null;
  pendingOrder?: PendingOrderData | null;
  orderSuccess?: OrderSuccessData | null;
  error?: string | null;
};

const SESSION_CHAT_KEY = "skipq_chat_history_v1";

const INITIAL_WELCOME_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "model",
  text: "👋 Hi! I'm your SkipQ assistant. What would you like to order today? (e.g. \"Order 2 cold coffees for me\")",
  timestamp: "Just now",
};

function getInitialMessages(): ChatMessage[] {
  if (typeof window === "undefined") return [INITIAL_WELCOME_MESSAGE];
  try {
    const stored = sessionStorage.getItem(SESSION_CHAT_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as ChatMessage[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {}
  return [INITIAL_WELCOME_MESSAGE];
}

export function ChatAgent() {
  const { cart, clearCart } = useCart();
  const searchParams = useSearchParams();

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(getInitialMessages);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isConfirming, startConfirmTransition] = useTransition();

  // Selected context state during conversation
  const [selectedUniversityId, setSelectedUniversityId] = useState<string | null>(null);
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null);
  const [pendingIntent, setPendingIntent] = useState<{ item: string; quantity: number } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Active shop context priority: user manual selection -> URL query param -> cart outlet
  const activeShopId =
    selectedShopId || searchParams.get("shopId") || cart.outlet?.shop_id || null;
  const activeShopName =
    cart.outlet?.shop_name ||
    (searchParams.get("shopId") ? "Selected Sales Point" : null);

  // Persist chat to sessionStorage whenever it changes
  useEffect(() => {
    if (messages.length > 0) {
      try {
        sessionStorage.setItem(SESSION_CHAT_KEY, JSON.stringify(messages));
      } catch {
        // Storage quota / error
      }
    }
  }, [messages]);

  // Scroll to bottom when messages update or panel opens
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [messages, isOpen]);

  const handleSend = async (
    customText?: string,
    explicitShopId?: string,
    explicitUniId?: string,
    // Pass current pendingIntent explicitly to avoid stale-closure issues
    overridePendingIntent?: { item: string; quantity: number } | null
  ) => {
    const textToSend = customText || input.trim();
    if (!textToSend || isLoading) return;

    // Use the explicitly passed intent (from option clicks) or current state
    const activePendingIntent =
      overridePendingIntent !== undefined ? overridePendingIntent : pendingIntent;

    // For display: if message is a sentinel, show the label instead
    const displayText = textToSend.startsWith("__")
      ? textToSend.replace(/^__\w+__:?\s*/, "")
      : textToSend;

    const userMessage: ChatMessage = {
      id: uid("u-"),
      role: "user",
      text: displayText,
      timestamp: timestamp(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    const targetShopId = explicitShopId || activeShopId;
    const targetUniId = explicitUniId || selectedUniversityId;

    try {
      const res = await fetch("/api/chat-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: textToSend,
          shopId: targetShopId,
          universityId: targetUniId,
          pendingIntent: activePendingIntent,
          history: newMessages.slice(-6).map((m) => ({
            role: m.role,
            text: m.text,
          })),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const errorMessage: ChatMessage = {
          id: uid("err-"),
          role: "model",
          text: data.error || "Unable to reach the assistant right now. Please try again.",
          timestamp: timestamp(),
          error: data.error,
        };
        setMessages((prev) => [...prev, errorMessage]);
      } else {
        if (data.pendingIntent) {
          setPendingIntent(data.pendingIntent);
        }
        if (data.pendingOrder) {
          setPendingIntent(null);
        }

        const botMessage: ChatMessage = {
          id: uid("m-"),
          role: "model",
          text: data.text || "I've processed your request.",
          timestamp: timestamp(),
          options: data.options || null,
          pendingOrder: data.pendingOrder || null,
        };
        setMessages((prev) => [...prev, botMessage]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: uid("net-err-"),
          role: "model",
          text: "Network connection issue. Please check your internet connection.",
          timestamp: timestamp(),
          error: "Network error",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOptionClick = (option: ChatOption) => {
    if (option.universityId) {
      setSelectedUniversityId(option.universityId);
    }
    if (option.shopId) {
      setSelectedShopId(option.shopId);
    }

    // Use sentinel messages so the server can distinguish these from food requests.
    // Also explicitly forward the current pendingIntent to avoid React's async state lag.
    let sentinelMsg: string;
    if (option.shopId) {
      // User selected a specific shop outlet
      sentinelMsg = `__select_shop__: ${option.label}`;
    } else if (option.universityId) {
      // User selected a university campus
      sentinelMsg = `__select_university__: ${option.label}`;
    } else {
      // Generic text option (e.g. item disambiguation)
      sentinelMsg = option.value;
    }

    // Pass current pendingIntent explicitly — setState hasn't flushed yet at this point
    handleSend(sentinelMsg, option.shopId, option.universityId, pendingIntent);
  };

  const handleConfirmOrder = (pending: PendingOrderData) => {
    startConfirmTransition(async () => {
      setIsLoading(true);
      try {
        const res = await fetch("/api/chat-agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "confirm_order",
            shopId: pending.shopId,
            items: pending.items.map((i) => ({
              menuItemId: i.menuItemId,
              quantity: i.quantity,
            })),
          }),
        });

        const data = await res.json();

        if (data.success) {
          // 1. Securely cache QR collection token locally for QR display
          try {
            localStorage.setItem(`skipq_qr_${data.orderId}`, data.collectionToken);
            sessionStorage.setItem(`skipq_qr_${data.orderId}`, data.collectionToken);
          } catch {}

          // 2. Persist active order for persistent SkipQ banner
          saveActiveOrder({
            orderId: data.orderId,
            orderCode: data.orderCode,
            orderNumber: data.orderNumber,
            shopName: pending.shopName,
            status: "PLACED",
            placedAt: new Date().toISOString(),
          });

          // 3. Clear cart if ordered from same outlet
          if (cart.outlet?.shop_id === pending.shopId) {
            clearCart();
          }

          // 4. Append success message in chat
          setMessages((prev) => [
            ...prev,
            {
              id: uid("success-"),
              role: "model",
              text: `🎉 Order placed successfully at ${pending.shopName}! Pick it up with your Order Code or QR credential.`,
              timestamp: timestamp(),
              orderSuccess: {
                orderId: data.orderId,
                orderNumber: data.orderNumber,
                orderCode: data.orderCode,
                collectionToken: data.collectionToken,
              },
            },
          ]);
        } else {
          setMessages((prev) => [
            ...prev,
            {
              id: uid("fail-"),
              role: "model",
              text: `❌ Could not complete your order: ${data.error || "Inventory or validation issue"}.`,
              timestamp: timestamp(),
              error: data.error,
            },
          ]);
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: uid("fail-net-"),
            role: "model",
            text: "❌ Network error while placing order. Please try again.",
            timestamp: timestamp(),
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    });
  };

  const handleCancelOrder = () => {
    setMessages((prev) => [
      ...prev,
      {
        id: uid("cancel-"),
        role: "model",
        text: "Order cancelled. What else can I help you find?",
        timestamp: timestamp(),
      },
    ]);
  };

  const handleClearChat = () => {
    try {
      sessionStorage.removeItem(SESSION_CHAT_KEY);
    } catch {}
    setSelectedUniversityId(null);
    setSelectedShopId(null);
    setPendingIntent(null);
    setMessages([
      {
        id: "welcome-reset",
        role: "model",
        text: "Conversation cleared. What would you like to order today?",
        timestamp: timestamp(),
      },
    ]);
  };

  return (
    <>
      {/* Floating Chat Trigger Button */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 rounded-full bg-zinc-950 px-4 py-3 text-white shadow-2xl transition-all duration-300 hover:scale-105 hover:bg-zinc-900 active:scale-95 border border-zinc-800/80"
          aria-label="Open SkipQ AI Assistant"
          title="Open SkipQ Assistant"
        >
          <div className="relative flex h-7 w-7 items-center justify-center rounded-full bg-orange-600 text-sm font-black shadow-md">
            <span>✨</span>
            <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-zinc-950 animate-pulse" />
          </div>
          <span className="text-xs font-bold tracking-tight">
            Order with AI
          </span>
        </button>
      )}

      {/* Expandable Chat Panel */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="SkipQ Order Assistant"
          className="fixed bottom-4 right-4 z-50 flex h-[600px] max-h-[85vh] w-[390px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-3xl border border-zinc-200/90 bg-white shadow-2xl transition-all duration-300"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-950 px-4 py-3.5 text-white">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-600 text-sm font-black">
                ✨
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xs font-black tracking-wide uppercase text-white">
                    SkipQ Assistant
                  </h2>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Live
                  </span>
                </div>
                <p className="text-[10px] text-zinc-400 truncate max-w-[190px]">
                  {activeShopName ? `Outlet: ${activeShopName}` : "Smart Campus Ordering"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleClearChat}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition"
                title="Clear conversation"
                aria-label="Clear conversation"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition"
                title="Minimize chat"
                aria-label="Close chat"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#FAF9F6] text-xs">
            {messages.map((msg) => {
              const isUser = msg.role === "user";
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 leading-relaxed ${
                      isUser
                        ? "bg-zinc-900 text-white rounded-br-xs shadow-xs"
                        : "bg-white text-zinc-800 rounded-bl-xs border border-zinc-200/80 shadow-xs"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                  </div>

                  {/* Interactive Options / Choices (Universities or Cafeterias) */}
                  {msg.options && msg.options.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5 w-[95%]">
                      {msg.options.map((opt, i) => (
                        <button
                          key={i}
                          type="button"
                          disabled={isLoading}
                          onClick={() => handleOptionClick(opt)}
                          className="rounded-full border border-orange-200 bg-white px-3 py-1.5 text-xs font-bold text-orange-600 hover:bg-orange-50 hover:border-orange-300 shadow-xs active:scale-95 transition disabled:opacity-50 text-left"
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Interactive Confirmation Card */}
                  {msg.pendingOrder && (
                    <div className="mt-2.5 w-[95%] rounded-2xl border border-orange-200 bg-white p-3.5 shadow-md">
                      <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-orange-600">
                          Order Confirmation
                        </span>
                        <span className="text-[10px] font-semibold text-zinc-500 truncate max-w-[170px]">
                          {msg.pendingOrder.shopName}
                        </span>
                      </div>

                      <div className="mt-2 text-[10px] text-zinc-400">
                        {msg.pendingOrder.cafeteriaName} · {msg.pendingOrder.universityName}
                      </div>

                      <div className="mt-2.5 space-y-1.5">
                        {msg.pendingOrder.items.map((item) => (
                          <div
                            key={item.menuItemId}
                            className="flex items-center justify-between text-xs"
                          >
                            <span className="font-bold text-zinc-800">
                              {item.quantity}x {item.name}
                            </span>
                            <span className="font-semibold text-zinc-600">
                              ৳{item.lineTotal}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="mt-3 flex items-center justify-between border-t border-zinc-100 pt-2">
                        <span className="font-bold text-zinc-900">Total (Pay at counter)</span>
                        <span className="text-sm font-black text-orange-600">
                          ৳{msg.pendingOrder.totalAmount}
                        </span>
                      </div>

                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          disabled={isLoading || isConfirming}
                          onClick={() => handleConfirmOrder(msg.pendingOrder!)}
                          className="flex-1 rounded-full bg-orange-600 py-2 text-center text-xs font-bold text-white shadow-sm hover:bg-orange-700 active:scale-95 disabled:opacity-50 transition"
                        >
                          {isConfirming ? "Placing..." : "Confirm & Place Order"}
                        </button>
                        <button
                          type="button"
                          disabled={isLoading || isConfirming}
                          onClick={handleCancelOrder}
                          className="rounded-full border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 active:scale-95 transition"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Order Placement Success Card */}
                  {msg.orderSuccess && (
                    <div className="mt-2.5 w-[95%] rounded-2xl border border-emerald-200 bg-emerald-50/80 p-3.5 shadow-md">
                      <div className="flex items-center gap-1.5 text-emerald-800 font-black text-xs">
                        <span>✅</span>
                        <span>Order Confirmed</span>
                      </div>

                      <div className="mt-2 space-y-1 text-[11px] text-zinc-700">
                        <div>
                          Order Number:{" "}
                          <span className="font-mono font-bold text-zinc-900">
                            #{msg.orderSuccess.orderNumber}
                          </span>
                        </div>
                        {msg.orderSuccess.orderCode && (
                          <div>
                            Verbal Order Code:{" "}
                            <span className="font-black text-emerald-700">
                              #SQ-{msg.orderSuccess.orderCode}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="mt-3">
                        <Link
                          href={`/customer/orders/${msg.orderSuccess.orderId}`}
                          onClick={() => setIsOpen(false)}
                          className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-zinc-950 py-2 text-xs font-bold text-white shadow-sm hover:bg-zinc-900 active:scale-95 transition"
                        >
                          <span>View Order &amp; QR Code</span>
                          <span>→</span>
                        </Link>
                      </div>
                    </div>
                  )}

                  <span className="mt-1 text-[9px] text-zinc-400 px-1">
                    {msg.timestamp}
                  </span>
                </div>
              );
            })}

            {/* Typing Indicator */}
            {isLoading && (
              <div className="flex items-center gap-1.5 rounded-2xl bg-white px-3.5 py-2.5 text-zinc-400 border border-zinc-200/80 w-fit shadow-xs">
                <span className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse" />
                <span className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse delay-150" />
                <span className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse delay-300" />
                <span className="ml-1 text-[10px] font-semibold text-zinc-500">
                  Thinking...
                </span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggestions */}
          <div className="border-t border-zinc-100 bg-white px-3 py-1.5 flex gap-1.5 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => handleSend("Order 2 cold coffees for me")}
              className="shrink-0 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[10px] font-bold text-zinc-700 hover:border-orange-300 hover:bg-orange-50/50 hover:text-orange-700 transition active:scale-95"
            >
              ☕ 2x Cold Coffee
            </button>
            <button
              type="button"
              onClick={() => handleSend("United International University")}
              className="shrink-0 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[10px] font-bold text-zinc-700 hover:border-orange-300 hover:bg-orange-50/50 hover:text-orange-700 transition active:scale-95"
            >
              🏫 UIU Campus
            </button>
            <button
              type="button"
              onClick={() => handleSend("Get me 1 burger")}
              className="shrink-0 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[10px] font-bold text-zinc-700 hover:border-orange-300 hover:bg-orange-50/50 hover:text-orange-700 transition active:scale-95"
            >
              🍔 1x Burger
            </button>
          </div>

          {/* Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2 border-t border-zinc-100 bg-white p-2.5"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g. Order 2 cold coffees for me..."
              disabled={isLoading}
              className="flex-1 rounded-full border border-zinc-200 bg-zinc-50/80 px-3.5 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-orange-500 focus:bg-white focus:outline-hidden"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-600 text-white hover:bg-orange-700 active:scale-95 disabled:opacity-40 transition"
              aria-label="Send message"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </form>
        </div>
      )}
    </>
  );
}
