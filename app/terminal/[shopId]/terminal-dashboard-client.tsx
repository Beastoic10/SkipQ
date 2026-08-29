"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogoutButton } from "@/app/auth/logout-button";
import { createClient } from "@/lib/supabase/client";
import type { TerminalOrder, TerminalShopDetails } from "@/lib/terminal/data";
import {
  updateOrderStatusAction,
  validateCollectionQRAction,
  lookupCollectionQRAction,
  cancelOrderAction,
  lookupOrderByCodeAction,
  collectOrderByCodeAction,
  type CollectionLookupResult,
} from "@/lib/terminal/actions";

type TerminalDashboardClientProps = {
  shopDetails: TerminalShopDetails;
  orders: TerminalOrder[];
  terminalDisplayName: string;
};

// Which sub-tab is active inside the collect modal
type CollectMethod = "qr" | "code";

// State for the "serial" tab — two steps: lookup then confirm-collect
type CollectionStep = "lookup" | "confirm";

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
  const [collectMethod, setCollectMethod] = useState<CollectMethod>("qr");
  const [collectionStep, setCollectionStep] = useState<CollectionStep>("lookup");
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [collectionLookupResult, setCollectionLookupResult] = useState<CollectionLookupResult | null>(null);
  const [collectionFeedback, setCollectionFeedback] = useState<{
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
  const openCollectModal = (method: CollectMethod = "qr") => {
    setCollectMethod(method);
    setCollectionFeedback(null);
    setCodeInput("");
    setCollectionStep("lookup");
    setCollectionLookupResult(null);
    setIsScannerOpen(method === "qr");
    setIsCollectModalOpen(true);
  };

  const closeCollectModal = () => {
    setIsScannerOpen(false);
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

  // ── Handlers: collection lookup and confirmation ──────────────────────────
  const handleQRScanned = useCallback((token: string) => {
    setCollectionFeedback(null);
    setIsScannerOpen(false);

    startTransition(async () => {
      const res = await lookupCollectionQRAction(token, shopDetails.id);
      if (res.success) {
        setCollectionLookupResult(res);
        setCollectionStep("confirm");
      } else {
        setCollectionFeedback({ type: "error", message: res.message });
      }
    });
  }, [shopDetails.id]);

  const handleCodeLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setCollectionFeedback(null);
    setCollectionLookupResult(null);

    if (!/^\d{4}$/.test(codeInput)) {
      setCollectionFeedback({ type: "error", message: "Enter exactly 4 digits (0000–9999), for example #9316." });
      return;
    }

    startTransition(async () => {
      const res = await lookupOrderByCodeAction(codeInput, shopDetails.id);
      if (res.success) {
        setCollectionLookupResult(res);
        setCollectionStep("confirm");
      } else {
        setCollectionFeedback({ type: "error", message: res.message });
      }
    });
  };

  const handleConfirmCollection = async () => {
    if (!collectionLookupResult) return;
    setCollectionFeedback(null);

    startTransition(async () => {
      const res = collectionLookupResult.method === "qr"
        ? await validateCollectionQRAction(collectionLookupResult.credential, shopDetails.id)
        : await collectOrderByCodeAction(collectionLookupResult.credential, shopDetails.id);

      if (res.success) {
        setCollectionFeedback({ type: "success", message: res.message });
        setCollectionStep("lookup");
        setCodeInput("");
        setCollectionLookupResult(null);
      } else {
        setCollectionFeedback({ type: "error", message: res.message });
      }
    });
  };

  const handleCollectionBack = () => {
    setCollectionStep("lookup");
    setCollectionLookupResult(null);
    setCollectionFeedback(null);
    setIsScannerOpen(collectMethod === "qr");
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
              onClick={() => openCollectModal("code")}
              className="inline-flex items-center gap-2 rounded-2xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-violet-600/20 transition hover:bg-violet-500 active:scale-95"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 7h4M3 12h8M3 17h4" strokeLinecap="round" />
                <rect x="15" y="5" width="6" height="14" rx="1" />
              </svg>
              <span>Enter Order Code</span>
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
                          {order.order_code != null
                            ? `#${order.order_code}`
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

            {/* Parallel collection choices */}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                id="collect-tab-qr"
                onClick={() => {
                  setCollectMethod("qr");
                  setCollectionStep("lookup");
                  setCollectionLookupResult(null);
                  setCollectionFeedback(null);
                  setIsScannerOpen(true);
                }}
                className={`flex items-center justify-center gap-2 rounded-2xl px-3 py-3 text-sm font-black transition ${
                  collectMethod === "qr"
                    ? "bg-emerald-600 text-white shadow"
                    : "border border-zinc-700 bg-zinc-950 text-zinc-300 hover:text-white"
                }`}
              >
                📷 Scan QR
              </button>
              <button
                id="collect-tab-code"
                onClick={() => {
                  setCollectMethod("code");
                  setCollectionStep("lookup");
                  setCollectionLookupResult(null);
                  setCollectionFeedback(null);
                  setIsScannerOpen(false);
                }}
                className={`flex items-center justify-center gap-2 rounded-2xl px-3 py-3 text-sm font-black transition ${
                  collectMethod === "code"
                    ? "bg-violet-600 text-white shadow"
                    : "border border-zinc-700 bg-zinc-950 text-zinc-300 hover:text-white"
                }`}
              >
                # Enter Order Code
              </button>
            </div>

            {collectionStep === "lookup" && collectMethod === "qr" && (
              <div className="mt-5 space-y-4">
                <QRScanner active={isScannerOpen} onScan={handleQRScanned} onError={(message) => setCollectionFeedback({ type: "error", message })} />
                <button type="button" onClick={() => setIsScannerOpen((open) => !open)} className="w-full rounded-2xl border border-zinc-700 px-4 py-3 text-xs font-bold text-zinc-300 hover:bg-zinc-800">
                  {isScannerOpen ? "Close scanner" : "Open camera scanner"}
                </button>
                <p className="text-center text-[11px] text-zinc-500">Camera permission is requested by your browser or device. Use Enter Order Code if camera access is unavailable.</p>
              </div>
            )}

            {collectionStep === "lookup" && collectMethod === "code" && (
              <form onSubmit={handleCodeLookup} className="mt-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300">Today&apos;s 4-digit Order Code</label>
                  <p className="mt-1 text-[11px] text-zinc-500">Enter exactly 0000–9999, for example #9316. The server scopes lookup to today and this authenticated terminal&apos;s shop.</p>
                  <div className="mt-2 flex items-center rounded-2xl border border-zinc-700 bg-zinc-950 px-4 focus-within:border-violet-500">
                    <span className="text-3xl font-black text-violet-300">#</span>
                    <input id="code-input" type="text" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} value={codeInput} onChange={(e) => setCodeInput(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="9316" className="w-full bg-transparent px-3 py-3 text-center text-3xl font-black tracking-[0.35em] text-white placeholder-zinc-700 focus:outline-none" autoFocus />
                  </div>
                </div>
                <button id="code-lookup-submit" type="submit" disabled={isPending} className="w-full rounded-2xl bg-violet-600 px-4 py-3 text-xs font-bold text-white hover:bg-violet-500 disabled:opacity-50">{isPending ? "Looking up…" : "Find Order"}</button>
              </form>
            )}

            {collectionStep === "confirm" && collectionLookupResult && (
              <CollectionConfirmation result={collectionLookupResult} isPending={isPending} onBack={handleCollectionBack} onConfirm={handleConfirmCollection} />
            )}

            {collectionFeedback && (
              <div className={`mt-4 rounded-2xl p-3 text-xs font-medium ${collectionFeedback.type === "success" ? "bg-emerald-950/80 border border-emerald-800 text-emerald-200" : "bg-rose-950/80 border border-rose-800 text-rose-200"}`}>
                {collectionFeedback.message}
              </div>
            )}          </div>
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

// ── Collection Sub-components ────────────────────────────────────────────────
type QRScannerProps = {
  active: boolean;
  onScan: (token: string) => void;
  onError: (message: string) => void;
};

type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => {
  detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>>;
};

function QRScanner({ active, onScan, onError }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    let animationFrame = 0;
    let stream: MediaStream | null = null;

    const start = async () => {
      if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        onError("Camera scanning is not available on this device. Use Enter Order Code instead.");
        return;
      }

      const Detector = (window as Window & { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
      if (!Detector) {
        onError("This browser does not support built-in QR scanning. Use Enter Order Code instead.");
        return;
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        if (!videoRef.current || cancelled) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        const detector = new Detector({ formats: ["qr_code"] });
        const scan = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            const token = codes[0]?.rawValue?.trim();
            if (token) {
              onScan(token);
              return;
            }
          } catch {
            // Keep scanning; transient decode failures are expected between frames.
          }
          animationFrame = window.requestAnimationFrame(scan);
        };
        animationFrame = window.requestAnimationFrame(scan);
      } catch (err: unknown) {
        onError((err as Error)?.message || "Camera permission was denied or unavailable. Use Enter Order Code instead.");
      }
    };

    void start();

    return () => {
      cancelled = true;
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [active, onError, onScan]);

  return (
    <div className="overflow-hidden rounded-3xl border border-emerald-800 bg-black">
      {active ? (
        <video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline aria-label="Live QR camera preview" />
      ) : (
        <div className="flex aspect-video items-center justify-center p-6 text-center text-xs text-zinc-500">Scanner closed. Open the camera or use the order-code fallback.</div>
      )}
    </div>
  );
}

function CollectionConfirmation({
  result,
  isPending,
  onBack,
  onConfirm,
}: {
  result: CollectionLookupResult;
  isPending: boolean;
  onBack: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="mt-5 space-y-4">
      <div className="rounded-2xl border border-zinc-700 bg-zinc-950 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Order Found by {result.method === "qr" ? "QR" : "Order Code"}</span>
          <span className="inline-flex rounded-full border border-emerald-800 bg-emerald-950 px-2.5 py-0.5 text-[10px] font-extrabold text-emerald-300">{result.status}</span>
        </div>
        <div className="text-5xl font-black text-white tracking-[0.15em]">#{result.orderCode ?? "——"}</div>
        <div className="text-[11px] text-zinc-500 font-mono">{result.orderNumber}</div>
        <div className="flex items-center justify-between border-t border-zinc-800 pt-2">
          <span className="text-xs text-zinc-400">{result.paymentMethod}</span>
          <span className="text-sm font-black text-white">৳{result.totalAmount?.toFixed(2) ?? "—"}</span>
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onBack} className="w-1/2 rounded-2xl border border-zinc-700 px-4 py-3 text-xs font-bold text-zinc-300 hover:bg-zinc-800">← Back</button>
        <button id="collection-confirm" type="button" onClick={onConfirm} disabled={isPending} className="w-1/2 rounded-2xl bg-emerald-600 px-4 py-3 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-50">{isPending ? "Collecting…" : "Confirm Collection"}</button>
      </div>
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
            {/* Order code badge — 4-digit verbal identifier */}
            {order.order_code != null ? (
              <div className="mb-1 inline-flex items-center gap-1 rounded-lg bg-violet-950 border border-violet-800/60 px-2 py-0.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-violet-400">Order</span>
                <span className="text-xl font-black text-violet-200 tabular-nums tracking-[0.15em]">
                  #{order.order_code}
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
