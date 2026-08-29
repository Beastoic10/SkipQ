"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogoutButton } from "@/app/auth/logout-button";
import { createClient } from "@/lib/supabase/client";
import type { TerminalOrder, TerminalShopDetails } from "@/lib/terminal/data";
import {
  updateOrderStatusAction,
  validateCollectionQRAction,
  cancelOrderAction,
  lookupOrderBySerialAction,
  collectOrderBySerialAction,
  type LookupResult,
} from "@/lib/terminal/actions";

type TerminalDashboardClientProps = {
  shopDetails: TerminalShopDetails;
  orders: TerminalOrder[];
  terminalDisplayName: string;
};

// Which sub-tab is active inside the collect modal
type CollectTab = "qr" | "serial";

// State for the "serial" tab — two steps: lookup then confirm-collect
type SerialStep = "lookup" | "confirm";

export function TerminalDashboardClient({
  shopDetails,
  orders,
  terminalDisplayName,
}: TerminalDashboardClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Active view tab: 'QUEUE' or 'HISTORY'
  const [activeTab, setActiveTab] = useState<"QUEUE" | "HISTORY">("QUEUE");

  // Realtime connection state
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);

  // ── Collect Modal State ──────────────────────────────────────────────────
  const [isCollectModalOpen, setIsCollectModalOpen] = useState(false);
  const [collectTab, setCollectTab] = useState<CollectTab>("qr");

  // QR / Token tab state
  const [qrTokenInput, setQrTokenInput] = useState("");
  const [qrFeedback, setQrFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Serial tab state
  const [serialInput, setSerialInput] = useState("");
  const [serialStep, setSerialStep] = useState<SerialStep>("lookup");
  const [serialLookupResult, setSerialLookupResult] = useState<LookupResult | null>(null);
  const [serialFeedback, setSerialFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // ── Cancellation Modal State ─────────────────────────────────────────────
  const [cancellingOrder, setCancellingOrder] = useState<TerminalOrder | null>(null);
  const [cancellationReason, setCancellationReason] = useState("");
  const [restoreStock, setRestoreStock] = useState(true);
  const [cancelFeedback, setCancelFeedback] = useState<string | null>(null);

  // ── Realtime subscription ────────────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`terminal-shop-${shopDetails.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `shop_id=eq.${shopDetails.id}`,
        },
        () => {
          startTransition(() => {
            router.refresh();
          });
        }
      )
      .subscribe((status) => {
        setIsRealtimeConnected(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [shopDetails.id, router]);

  // ── Derived order lists ──────────────────────────────────────────────────
  const placedOrders = orders.filter((o) => o.status === "PLACED");
  const preparingOrders = orders.filter((o) => o.status === "PREPARING");
  const readyOrders = orders.filter((o) => o.status === "READY");
  const completedOrders = orders.filter((o) => o.status === "COLLECTED");
  const cancelledOrders = orders.filter((o) => o.status === "CANCELLED");

  // ── Helpers ──────────────────────────────────────────────────────────────
  const openCollectModal = (tab: CollectTab = "qr") => {
    setCollectTab(tab);
    setQrFeedback(null);
    setQrTokenInput("");
    setSerialInput("");
    setSerialStep("lookup");
    setSerialLookupResult(null);
    setSerialFeedback(null);
    setIsCollectModalOpen(true);
  };

  const closeCollectModal = () => {
    setIsCollectModalOpen(false);
  };

  const formatTime = (isoString: string) =>
    new Date(isoString).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

  // ── Handlers: status update ───────────────────────────────────────────────
  const handleUpdateStatus = (orderId: string, newStatus: "PREPARING" | "READY") => {
    startTransition(async () => {
      const res = await updateOrderStatusAction(orderId, newStatus, shopDetails.id);
      if (!res.success) {
        alert(`Status update failed: ${res.message}`);
      }
    });
  };

  // ── Handlers: QR / token collection ──────────────────────────────────────
  const handleValidateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    setQrFeedback(null);

    if (!qrTokenInput.trim()) {
      setQrFeedback({ type: "error", message: "Please enter or scan a collection token" });
      return;
    }

    startTransition(async () => {
      const res = await validateCollectionQRAction(qrTokenInput, shopDetails.id);
      if (res.success) {
        setQrFeedback({ type: "success", message: res.message });
        setQrTokenInput("");
      } else {
        setQrFeedback({ type: "error", message: res.message });
      }
    });
  };

  // ── Handlers: serial lookup ───────────────────────────────────────────────
  const handleSerialLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSerialFeedback(null);
    setSerialLookupResult(null);

    if (!serialInput.trim()) {
      setSerialFeedback({ type: "error", message: "Enter an order number" });
      return;
    }

    startTransition(async () => {
      const res = await lookupOrderBySerialAction(serialInput, shopDetails.id);
      if (res.success) {
        setSerialLookupResult(res);
        setSerialStep("confirm");
      } else {
        setSerialFeedback({ type: "error", message: res.message });
      }
    });
  };

  const handleSerialCollect = async () => {
    if (!serialLookupResult?.dailySerial) return;
    setSerialFeedback(null);

    startTransition(async () => {
      const res = await collectOrderBySerialAction(serialLookupResult.dailySerial!, shopDetails.id);
      if (res.success) {
        setSerialFeedback({ type: "success", message: res.message });
        setSerialStep("lookup");
        setSerialInput("");
        setSerialLookupResult(null);
      } else {
        setSerialFeedback({ type: "error", message: res.message });
      }
    });
  };

  const handleSerialBack = () => {
    setSerialStep("lookup");
    setSerialLookupResult(null);
    setSerialFeedback(null);
  };

  // ── Handlers: cancellation ────────────────────────────────────────────────
  const handleConfirmCancellation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancellingOrder) return;
    setCancelFeedback(null);

    if (!cancellationReason.trim()) {
      setCancelFeedback("Please provide a reason for cancellation");
      return;
    }

    startTransition(async () => {
      const res = await cancelOrderAction(
        cancellingOrder.id,
        cancellationReason,
        restoreStock,
        shopDetails.id
      );
      if (res.success) {
        setCancellingOrder(null);
        setCancellationReason("");
      } else {
        setCancelFeedback(res.message);
      }
    });
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-zinc-950 font-sans text-zinc-100 antialiased selection:bg-orange-500 selection:text-white">
      {/* Top Header / Status Bar */}
      <header className="sticky top-0 z-30 border-b border-zinc-800 bg-zinc-900/90 px-6 py-4 backdrop-blur-md">
        <div className="mx-auto flex flex-col gap-4 max-w-7xl sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-600 font-bold text-white shadow-lg shadow-orange-600/30">
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black tracking-tight text-white">{shopDetails.name}</h1>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                    isRealtimeConnected
                      ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                      : "bg-amber-950 text-amber-400 border border-amber-800"
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${isRealtimeConnected ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
                  {isRealtimeConnected ? "Realtime Live" : "Connecting..."}
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                {terminalDisplayName} · {shopDetails.cafeteria_name} ({shopDetails.university_name})
              </p>
            </div>
          </div>

          {/* Action buttons header */}
          <div className="flex items-center gap-3">
            {/* QR Scan button */}
            <button
              id="collect-qr-btn"
              onClick={() => openCollectModal("qr")}
              className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-emerald-600/20 transition hover:bg-emerald-500 active:scale-95"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
              <span>Scan QR</span>
            </button>
            {/* Manual order # button */}
            <button
              id="collect-serial-btn"
              onClick={() => openCollectModal("serial")}
              className="inline-flex items-center gap-2 rounded-2xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-violet-600/20 transition hover:bg-violet-500 active:scale-95"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 7h4M3 12h8M3 17h4" strokeLinecap="round" />
                <rect x="15" y="5" width="6" height="14" rx="1" />
              </svg>
              <span>Order #</span>
            </button>
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* Navigation Tabs Bar */}
      <div className="border-b border-zinc-800 bg-zinc-900/40 px-6 py-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("QUEUE")}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${
                activeTab === "QUEUE"
                  ? "bg-orange-600 text-white shadow-sm"
                  : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
              }`}
            >
              <span>Active Orders</span>
              <span className="rounded-full bg-black/30 px-2 py-0.5 text-xs font-black">
                {placedOrders.length + preparingOrders.length + readyOrders.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab("HISTORY")}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${
                activeTab === "HISTORY"
                  ? "bg-orange-600 text-white shadow-sm"
                  : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
              }`}
            >
              <span>History</span>
              <span className="rounded-full bg-black/30 px-2 py-0.5 text-xs font-black">
                {completedOrders.length + cancelledOrders.length}
              </span>
            </button>
          </div>

          {isPending && (
            <div className="flex items-center gap-2 text-xs font-semibold text-orange-400">
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
              Updating...
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <main className="mx-auto max-w-7xl p-6">
        {activeTab === "QUEUE" ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Column 1: PLACED */}
            <div className="flex flex-col rounded-3xl border border-amber-900/40 bg-zinc-900/60 p-4">
              <div className="mb-4 flex items-center justify-between rounded-2xl bg-amber-950/60 border border-amber-800/40 p-3 text-amber-200">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-amber-400" />
                  <h2 className="font-extrabold uppercase tracking-wider text-xs">1. Placed</h2>
                </div>
                <span className="rounded-full bg-amber-900/80 px-2.5 py-0.5 text-xs font-black text-amber-100">
                  {placedOrders.length}
                </span>
              </div>

              <div className="flex-1 space-y-4">
                {placedOrders.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-zinc-800 p-8 text-center text-xs text-zinc-500">
                    No newly placed orders
                  </div>
                ) : (
                  placedOrders.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      onUpdateStatus={() => handleUpdateStatus(order.id, "PREPARING")}
                      actionLabel="Start Preparing"
                      actionColor="bg-amber-600 hover:bg-amber-500 text-white"
                      onCancel={() => {
                        setCancelFeedback(null);
                        setCancellingOrder(order);
                      }}
                      formatTime={formatTime}
                      disabled={isPending}
                    />
                  ))
                )}
              </div>
            </div>

            {/* Column 2: PREPARING */}
            <div className="flex flex-col rounded-3xl border border-blue-900/40 bg-zinc-900/60 p-4">
              <div className="mb-4 flex items-center justify-between rounded-2xl bg-blue-950/60 border border-blue-800/40 p-3 text-blue-200">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-blue-400" />
                  <h2 className="font-extrabold uppercase tracking-wider text-xs">2. Preparing</h2>
                </div>
                <span className="rounded-full bg-blue-900/80 px-2.5 py-0.5 text-xs font-black text-blue-100">
                  {preparingOrders.length}
                </span>
              </div>

              <div className="flex-1 space-y-4">
                {preparingOrders.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-zinc-800 p-8 text-center text-xs text-zinc-500">
                    No orders being prepared
                  </div>
                ) : (
                  preparingOrders.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      onUpdateStatus={() => handleUpdateStatus(order.id, "READY")}
                      actionLabel="Mark Ready"
                      actionColor="bg-blue-600 hover:bg-blue-500 text-white"
                      onCancel={() => {
                        setCancelFeedback(null);
                        setCancellingOrder(order);
                      }}
                      formatTime={formatTime}
                      disabled={isPending}
                    />
                  ))
                )}
              </div>
            </div>

            {/* Column 3: READY */}
            <div className="flex flex-col rounded-3xl border border-emerald-900/40 bg-zinc-900/60 p-4">
              <div className="mb-4 flex items-center justify-between rounded-2xl bg-emerald-950/60 border border-emerald-800/40 p-3 text-emerald-200">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-emerald-400" />
                  <h2 className="font-extrabold uppercase tracking-wider text-xs">3. Ready for Collection</h2>
                </div>
                <span className="rounded-full bg-emerald-900/80 px-2.5 py-0.5 text-xs font-black text-emerald-100">
                  {readyOrders.length}
                </span>
              </div>

              <div className="flex-1 space-y-4">
                {readyOrders.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-zinc-800 p-8 text-center text-xs text-zinc-500">
                    No orders ready for pickup
                  </div>
                ) : (
                  readyOrders.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      onUpdateStatus={() => openCollectModal("qr")}
                      actionLabel="Scan QR / Collect"
                      actionColor="bg-emerald-600 hover:bg-emerald-500 text-white"
                      formatTime={formatTime}
                      disabled={isPending}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        ) : (
          /* HISTORY TAB */
          <div className="space-y-6">
            <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
              <h2 className="text-lg font-bold text-white mb-4">Completed &amp; Cancelled Orders</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-zinc-800 text-zinc-400 uppercase font-semibold">
                    <tr>
                      <th className="py-3 px-4">#</th>
                      <th className="py-3 px-4">Order ID</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Items</th>
                      <th className="py-3 px-4">Payment</th>
                      <th className="py-3 px-4">Total</th>
                      <th className="py-3 px-4">Time</th>
                      <th className="py-3 px-4">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800 text-zinc-300">
                    {[...completedOrders, ...cancelledOrders].map((order) => (
                      <tr key={order.id} className="hover:bg-zinc-800/50">
                        <td className="py-3 px-4 font-black text-violet-300">
                          {order.daily_serial != null
                            ? `#${String(order.daily_serial).padStart(3, "0")}`
                            : "—"}
                        </td>
                        <td className="py-3 px-4 font-black text-white">{order.order_number}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                              order.status === "COLLECTED"
                                ? "bg-zinc-800 text-zinc-300 border border-zinc-700"
                                : "bg-rose-950 text-rose-300 border border-rose-800"
                            }`}
                          >
                            {order.status}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {order.items.map((i) => `${i.item_name_snapshot} (×${i.quantity})`).join(", ")}
                        </td>
                        <td className="py-3 px-4 font-semibold text-amber-400">{order.payment_method}</td>
                        <td className="py-3 px-4 font-bold text-white">৳{order.total_amount.toFixed(2)}</td>
                        <td className="py-3 px-4 text-zinc-500">{formatTime(order.created_at)}</td>
                        <td className="py-3 px-4 text-zinc-400">{order.cancellation_reason || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── COLLECT MODAL (dual-tab) ────────────────────────────────────── */}
      {isCollectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-600 text-white font-bold text-sm">
                  ✓
                </div>
                <h3 className="text-lg font-extrabold text-white">Collect Order</h3>
              </div>
              <button
                id="collect-modal-close"
                onClick={closeCollectModal}
                className="rounded-full p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Tab switcher */}
            <div className="mt-4 flex rounded-2xl bg-zinc-950 p-1 gap-1">
              <button
                id="collect-tab-qr"
                onClick={() => {
                  setCollectTab("qr");
                  setQrFeedback(null);
                }}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition ${
                  collectTab === "qr"
                    ? "bg-emerald-600 text-white shadow"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                </svg>
                Scan QR / Token
              </button>
              <button
                id="collect-tab-serial"
                onClick={() => {
                  setCollectTab("serial");
                  setSerialFeedback(null);
                }}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition ${
                  collectTab === "serial"
                    ? "bg-violet-600 text-white shadow"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 7h4M3 12h8M3 17h4" strokeLinecap="round" />
                  <rect x="15" y="5" width="6" height="14" rx="1" />
                </svg>
                Manual Order #
              </button>
            </div>

            {/* ── QR / Token tab ── */}
            {collectTab === "qr" && (
              <form onSubmit={handleValidateCollection} className="mt-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300">
                    Scan QR or Enter Token
                  </label>
                  <p className="mt-1 text-[11px] text-zinc-500">
                    Type or scan the customer&apos;s collection token string.
                  </p>
                  <input
                    id="qr-token-input"
                    type="text"
                    value={qrTokenInput}
                    onChange={(e) => setQrTokenInput(e.target.value)}
                    placeholder="Hex token from customer QR code…"
                    className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm font-mono text-white placeholder-zinc-600 focus:border-emerald-500 focus:outline-none"
                    autoFocus
                  />
                </div>

                {qrFeedback && (
                  <div
                    className={`rounded-2xl p-3 text-xs font-medium ${
                      qrFeedback.type === "success"
                        ? "bg-emerald-950/80 border border-emerald-800 text-emerald-200"
                        : "bg-rose-950/80 border border-rose-800 text-rose-200"
                    }`}
                  >
                    {qrFeedback.message}
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeCollectModal}
                    className="w-1/2 rounded-2xl border border-zinc-700 px-4 py-3 text-xs font-bold text-zinc-300 hover:bg-zinc-800"
                  >
                    Cancel
                  </button>
                  <button
                    id="qr-collect-submit"
                    type="submit"
                    disabled={isPending}
                    className="w-1/2 rounded-2xl bg-emerald-600 px-4 py-3 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {isPending ? "Validating…" : "Validate & Collect"}
                  </button>
                </div>
              </form>
            )}

            {/* ── Serial tab ── */}
            {collectTab === "serial" && (
              <div className="mt-5 space-y-4">
                {/* Step 1: lookup */}
                {serialStep === "lookup" && (
                  <form onSubmit={handleSerialLookup} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-zinc-300">
                        Today&apos;s Order Number
                      </label>
                      <p className="mt-1 text-[11px] text-zinc-500">
                        Enter the 3-digit daily order number (e.g. 001, 042).
                      </p>
                      <input
                        id="serial-input"
                        type="number"
                        min="1"
                        max="2000"
                        value={serialInput}
                        onChange={(e) => setSerialInput(e.target.value)}
                        placeholder="e.g. 42"
                        className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-2xl font-black text-white placeholder-zinc-700 focus:border-violet-500 focus:outline-none text-center tracking-widest"
                        autoFocus
                      />
                    </div>

                    {serialFeedback && (
                      <div className="rounded-2xl bg-rose-950/80 border border-rose-800 p-3 text-xs text-rose-200">
                        {serialFeedback.message}
                      </div>
                    )}

                    <div className="flex gap-3 pt-2">
                      <button
                        type="button"
                        onClick={closeCollectModal}
                        className="w-1/2 rounded-2xl border border-zinc-700 px-4 py-3 text-xs font-bold text-zinc-300 hover:bg-zinc-800"
                      >
                        Cancel
                      </button>
                      <button
                        id="serial-lookup-submit"
                        type="submit"
                        disabled={isPending}
                        className="w-1/2 rounded-2xl bg-violet-600 px-4 py-3 text-xs font-bold text-white hover:bg-violet-500 disabled:opacity-50"
                      >
                        {isPending ? "Looking up…" : "Find Order"}
                      </button>
                    </div>
                  </form>
                )}

                {/* Step 2: confirm collect */}
                {serialStep === "confirm" && serialLookupResult && (
                  <div className="space-y-4">
                    {/* Order summary card */}
                    <div className="rounded-2xl border border-zinc-700 bg-zinc-950 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                          Order Found
                        </span>
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-extrabold border ${
                            serialLookupResult.status === "READY"
                              ? "bg-emerald-950 text-emerald-300 border-emerald-800"
                              : serialLookupResult.status === "COLLECTED"
                              ? "bg-zinc-800 text-zinc-300 border-zinc-700"
                              : "bg-amber-950 text-amber-300 border-amber-800"
                          }`}
                        >
                          {serialLookupResult.status}
                        </span>
                      </div>
                      <div className="text-4xl font-black text-white tracking-tight">
                        #
                        {serialLookupResult.dailySerial != null
                          ? String(serialLookupResult.dailySerial).padStart(3, "0")
                          : "—"}
                      </div>
                      <div className="text-[11px] text-zinc-500 font-mono">{serialLookupResult.orderNumber}</div>
                      <div className="flex items-center justify-between pt-1 border-t border-zinc-800">
                        <span className="text-xs text-zinc-400">{serialLookupResult.paymentMethod}</span>
                        <span className="text-sm font-black text-white">
                          ৳{serialLookupResult.totalAmount?.toFixed(2) ?? "—"}
                        </span>
                      </div>
                    </div>

                    {serialFeedback && (
                      <div
                        className={`rounded-2xl p-3 text-xs font-medium ${
                          serialFeedback.type === "success"
                            ? "bg-emerald-950/80 border border-emerald-800 text-emerald-200"
                            : "bg-rose-950/80 border border-rose-800 text-rose-200"
                        }`}
                      >
                        {serialFeedback.message}
                      </div>
                    )}

                    {serialLookupResult.status === "READY" ? (
                      <div className="flex gap-3 pt-2">
                        <button
                          type="button"
                          onClick={handleSerialBack}
                          className="w-1/2 rounded-2xl border border-zinc-700 px-4 py-3 text-xs font-bold text-zinc-300 hover:bg-zinc-800"
                        >
                          ← Back
                        </button>
                        <button
                          id="serial-collect-confirm"
                          type="button"
                          onClick={handleSerialCollect}
                          disabled={isPending}
                          className="w-1/2 rounded-2xl bg-emerald-600 px-4 py-3 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
                        >
                          {isPending ? "Collecting…" : "Confirm Collect"}
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="rounded-2xl bg-amber-950/60 border border-amber-800/40 p-3 text-xs text-amber-300">
                          This order is <strong>{serialLookupResult.status}</strong> — it cannot be collected yet.
                        </div>
                        <button
                          type="button"
                          onClick={handleSerialBack}
                          className="w-full rounded-2xl border border-zinc-700 px-4 py-3 text-xs font-bold text-zinc-300 hover:bg-zinc-800"
                        >
                          ← Back
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── CANCELLATION MODAL ─────────────────────────────────────────── */}
      {cancellingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <h3 className="text-lg font-extrabold text-rose-400">
                Cancel Order #{cancellingOrder.order_number}
              </h3>
              <button
                onClick={() => setCancellingOrder(null)}
                className="rounded-full p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmCancellation} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300">
                  Cancellation Reason <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  placeholder="e.g. Out of ingredients, customer requested cancellation, shop closing"
                  rows={3}
                  className="mt-2 w-full rounded-2xl border border-zinc-700 bg-zinc-950 p-3 text-xs text-white placeholder-zinc-600 focus:border-rose-500 focus:outline-none"
                  required
                />
              </div>

              <div className="flex items-center gap-2 rounded-2xl bg-zinc-950 p-3 border border-zinc-800">
                <input
                  type="checkbox"
                  id="restoreStock"
                  checked={restoreStock}
                  onChange={(e) => setRestoreStock(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-orange-600 focus:ring-0"
                />
                <label htmlFor="restoreStock" className="text-xs text-zinc-300 cursor-pointer">
                  Restore item quantities back to menu stock
                </label>
              </div>

              {cancelFeedback && (
                <div className="rounded-2xl bg-rose-950/80 border border-rose-800 p-3 text-xs text-rose-200">
                  {cancelFeedback}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCancellingOrder(null)}
                  className="w-1/2 rounded-2xl border border-zinc-700 px-4 py-3 text-xs font-bold text-zinc-300 hover:bg-zinc-800"
                >
                  Keep Order
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="w-1/2 rounded-2xl bg-rose-600 px-4 py-3 text-xs font-bold text-white hover:bg-rose-500 disabled:opacity-50"
                >
                  {isPending ? "Cancelling…" : "Confirm Cancel"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── OrderCard Sub-component ───────────────────────────────────────────────────
type OrderCardProps = {
  order: TerminalOrder;
  onUpdateStatus?: () => void;
  actionLabel?: string;
  actionColor?: string;
  onCancel?: () => void;
  formatTime: (time: string) => string;
  disabled?: boolean;
};

function OrderCard({
  order,
  onUpdateStatus,
  actionLabel,
  actionColor,
  onCancel,
  formatTime,
  disabled,
}: OrderCardProps) {
  return (
    <div className="flex flex-col justify-between rounded-3xl border border-zinc-800 bg-zinc-900 p-5 shadow-lg transition hover:border-zinc-700">
      <div>
        {/* Header line */}
        <div className="flex items-start justify-between gap-2 border-b border-zinc-800/80 pb-3">
          <div>
            {/* Daily serial badge — prominent verbal identifier */}
            {order.daily_serial != null ? (
              <div className="mb-1 inline-flex items-center gap-1 rounded-lg bg-violet-950 border border-violet-800/60 px-2 py-0.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-violet-400">Order</span>
                <span className="text-xl font-black text-violet-200 tabular-nums">
                  #{String(order.daily_serial).padStart(3, "0")}
                </span>
              </div>
            ) : (
              <span className="text-[11px] font-bold uppercase tracking-wider text-orange-400">Order</span>
            )}
            <h3 className="text-xs font-mono text-zinc-500 mt-0.5">{order.order_number}</h3>
          </div>
          <div className="flex flex-col items-end">
            <span className="inline-flex rounded-full bg-amber-950 border border-amber-800/60 px-2.5 py-0.5 text-[10px] font-extrabold text-amber-300">
              {order.payment_method}
            </span>
            <span className="mt-1 text-[11px] text-zinc-400">{formatTime(order.created_at)}</span>
          </div>
        </div>

        {/* Item list */}
        <ul className="my-4 divide-y divide-zinc-800/50 text-xs">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-center justify-between py-2">
              <span className="font-semibold text-zinc-200">
                {item.item_name_snapshot}{" "}
                <span className="text-orange-400 font-extrabold">× {item.quantity}</span>
              </span>
              <span className="font-medium text-zinc-400">৳{item.line_total_snapshot.toFixed(2)}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Footer Total & Action buttons */}
      <div className="border-t border-zinc-800/80 pt-3">
        <div className="flex items-baseline justify-between mb-3">
          <span className="text-xs text-zinc-400 font-medium">Total Amount</span>
          <span className="text-xl font-black text-white">৳{order.total_amount.toFixed(2)}</span>
        </div>

        <div className="flex gap-2">
          {onCancel && (
            <button
              onClick={onCancel}
              disabled={disabled}
              className="rounded-xl border border-rose-900/60 bg-rose-950/40 px-3 py-2 text-xs font-bold text-rose-300 hover:bg-rose-900/60 disabled:opacity-50"
            >
              Cancel
            </button>
          )}

          {onUpdateStatus && actionLabel && (
            <button
              onClick={onUpdateStatus}
              disabled={disabled}
              className={`flex-1 rounded-xl px-4 py-2.5 text-xs font-extrabold transition active:scale-95 disabled:opacity-50 ${actionColor}`}
            >
              {actionLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
