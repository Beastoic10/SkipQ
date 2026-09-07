"use client";

import { useEffect, useState, useCallback, useSyncExternalStore } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  updateActiveOrderStatus,
  clearActiveOrder,
  subscribeActiveOrder,
  getActiveOrderSnapshot,
  type ActiveOrderSummary,
} from "@/lib/customer/active-order-store";

const TERMINAL_STATUSES: ActiveOrderSummary["status"][] = ["COLLECTED", "CANCELLED"];

function serverSnapshot() { return null; }

function ElapsedTimer({ placedAt }: { placedAt: string }) {
  const [elapsed, setElapsed] = useState<string>("");

  useEffect(() => {
    const tick = () => {
      const diff = Math.floor((Date.now() - new Date(placedAt).getTime()) / 1000);
      if (diff < 60) {
        setElapsed(`${diff}s`);
      } else if (diff < 3600) {
        setElapsed(`${Math.floor(diff / 60)}m`);
      } else {
        setElapsed(`${Math.floor(diff / 3600)}h`);
      }
    };
    tick();
    const interval = setInterval(tick, 10_000);
    return () => clearInterval(interval);
  }, [placedAt]);

  return <span>{elapsed}</span>;
}

export function ActiveOrderBanner() {
  // Reactively read the active order — re-renders instantly when saveActiveOrder is called
  const stored = useSyncExternalStore(subscribeActiveOrder, getActiveOrderSnapshot, serverSnapshot);

  const [dismissed, setDismissed] = useState(false);

  // Derive the visible order (skip terminal statuses, auto-clear them)
  const order = stored && !TERMINAL_STATUSES.includes(stored.status) ? stored : null;

  useEffect(() => {
    if (stored && TERMINAL_STATUSES.includes(stored.status)) {
      const delay = stored.status === "COLLECTED" ? 5000 : 0;
      const timer = setTimeout(() => { clearActiveOrder(); }, delay);
      return () => clearTimeout(timer);
    }
  }, [stored]);

  const handleStatusChange = useCallback(
    (newStatus: ActiveOrderSummary["status"]) => {
      updateActiveOrderStatus(newStatus);
      // useSyncExternalStore will re-render automatically.
      // Terminal-status cleanup is handled by the useEffect above.
    },
    []
  );

  // Supabase realtime subscription
  useEffect(() => {
    if (!order) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`active-order-banner-${order.orderId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `id=eq.${order.orderId}`,
        },
        (payload) => {
          const newStatus = payload.new?.status as ActiveOrderSummary["status"];
          if (newStatus) handleStatusChange(newStatus);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [order, order?.orderId, handleStatusChange]);

  if (!order || dismissed) return null;

  const isReady = order.status === "READY";
  const isPreparing = order.status === "PREPARING";

  return (
    <div
      className={`
        fixed bottom-5 left-1/2 z-50 -translate-x-1/2
        w-[calc(100%-2rem)] max-w-sm
        rounded-2xl border px-4 py-3.5 shadow-xl
        transition-all duration-500
        ${
          isReady
            ? "border-emerald-200 bg-emerald-50"
            : "border-[#d4ede5] bg-[#edf7f2]"
        }
      `}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3">
        {/* Left content */}
        <div className="flex-1 min-w-0">
          {/* Badge row */}
          <div className="flex items-center gap-2 mb-0.5">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                isReady
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-[#c7ead9] text-[#1a6646]"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  isReady ? "bg-emerald-500" : "bg-[#2a9d6f] animate-pulse"
                }`}
              />
              {order.orderCode ? `#SQ-${order.orderCode}` : `#${order.orderNumber}`}
            </span>

            {/* Elapsed time */}
            <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-semibold text-zinc-400">
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
              <ElapsedTimer placedAt={order.placedAt} />
            </span>
          </div>

          {/* Status text */}
          <p className="text-sm font-black text-zinc-900 leading-tight truncate">
            {isReady
              ? "🎉 Your order is ready!"
              : isPreparing
              ? "Your order is being prepared"
              : "Your order is in progress"}
          </p>

          {/* CTA */}
          <Link
            href={`/customer/orders/${order.orderId}`}
            className="mt-2 inline-flex items-center gap-1 rounded-full bg-zinc-900 px-3.5 py-1.5 text-[11px] font-bold text-white hover:bg-zinc-800 transition active:scale-95"
          >
            See details
            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>

        {/* Right: SkipQ logo pill + dismiss */}
        <div className="flex flex-col items-center gap-1.5 shrink-0">
          <Link
            href={`/customer/orders/${order.orderId}`}
            className="flex h-10 w-10 items-center justify-center rounded-2xl bg-zinc-900 shadow-md hover:scale-105 transition"
            aria-label="View active order"
          >
            <span className="text-[17px] font-black text-white leading-none">
              S<span className="text-orange-400">Q</span>
            </span>
          </Link>
          <button
            onClick={() => setDismissed(true)}
            className="text-[9px] font-semibold text-zinc-400 hover:text-zinc-600 transition"
            aria-label="Dismiss banner"
          >
            hide
          </button>
        </div>
      </div>
    </div>
  );
}
