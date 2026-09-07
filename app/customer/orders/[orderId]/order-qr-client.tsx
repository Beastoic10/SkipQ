"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/client";
import type { CustomerOrderDetails } from "@/lib/customer/orders";
import { updateActiveOrderStatus, saveActiveOrder, loadActiveOrder } from "@/lib/customer/active-order-store";

type OrderQRClientProps = {
  order: CustomerOrderDetails;
};

export function OrderQRClient({ order }: OrderQRClientProps) {
  const router = useRouter();
  const [qrState, setQrState] = useState<{
    isLoading: boolean;
    dataUrl: string | null;
    hasToken: boolean;
  }>({
    isLoading: true,
    dataUrl: null,
    hasToken: true,
  });
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);

  // Realtime subscription — scoped strictly to this customer's own order ID
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`customer-order-${order.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `id=eq.${order.id}`,
        },
        (payload) => {
          const newStatus = payload.new?.status;
          if (newStatus) {
            updateActiveOrderStatus(newStatus);
          }
          router.refresh();
        }
      )
      .subscribe((status) => {
        setIsRealtimeConnected(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [order.id, router]);

  useEffect(() => {
    let isCancelled = false;

    const generateQRCode = async () => {
      // QR is only relevant for active (non-terminal) orders
      if (order.status === "COLLECTED" || order.status === "CANCELLED") {
        if (!isCancelled) {
          setQrState({ isLoading: false, dataUrl: null, hasToken: false });
        }
        return;
      }

      // Attempt to read the collection token from client storage
      let token = sessionStorage.getItem(`skipq_qr_${order.id}`);
      if (!token) {
        token = localStorage.getItem(`skipq_qr_${order.id}`);
      }

      if (!token) {
        if (!isCancelled) {
          setQrState({ isLoading: false, dataUrl: null, hasToken: false });
        }
        return;
      }

      try {
        const url = await QRCode.toDataURL(token, {
          width: 320,
          margin: 2,
          color: {
            dark: "#09090b", // zinc-950
            light: "#ffffff",
          },
          errorCorrectionLevel: "M",
        });

        if (!isCancelled) {
          setQrState({ isLoading: false, dataUrl: url, hasToken: true });
        }
      } catch (err) {
        console.error("QR Generation error:", err);
        if (!isCancelled) {
          setQrState({ isLoading: false, dataUrl: null, hasToken: false });
        }
      }
    };

    generateQRCode();

    // Sync order_code into the active order store once we know it
    if (order.order_code) {
      const stored = loadActiveOrder();
      if (stored && stored.orderId === order.id && !stored.orderCode) {
        saveActiveOrder({ ...stored, orderCode: order.order_code });
      }
    }

    return () => {
      isCancelled = true;
    };
  }, [order.id, order.status]);

  const statusConfig = {
    PLACED: {
      label: "Order Placed",
      color: "bg-orange-50 text-orange-700 border-orange-200",
      step: 1,
    },
    PREPARING: {
      label: "Preparing in Kitchen",
      color: "bg-amber-50 text-amber-800 border-amber-200",
      step: 2,
    },
    READY: {
      label: "Ready for Pickup! 🎉",
      color: "bg-emerald-50 text-emerald-800 border-emerald-200",
      step: 3,
    },
    COLLECTED: {
      label: "Order Collected",
      color: "bg-zinc-100 text-zinc-700 border-zinc-200",
      step: 4,
    },
    CANCELLED: {
      label: "Cancelled",
      color: "bg-rose-50 text-rose-700 border-rose-200",
      step: 0,
    },
    PAYMENT_PENDING: {
      label: "Payment Pending",
      color: "bg-blue-50 text-blue-800 border-blue-200",
      step: 0,
    },
  };

  const currentStatusInfo = statusConfig[order.status] || {
    label: order.status,
    color: "bg-zinc-100 text-zinc-700 border-zinc-200",
    step: 1,
  };

  const formattedDate = new Date(order.created_at).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  const isTerminalState = order.status === "COLLECTED" || order.status === "CANCELLED";

  return (
    <div className="mx-auto max-w-xl space-y-6 pb-16">
      {/* Top Header & Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          href="/customer"
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 transition"
        >
          <span>←</span>
          <span>Back to Home</span>
        </Link>

        {/* Live Realtime Indicator */}
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold ${
            isRealtimeConnected
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-zinc-100 text-zinc-500 border border-zinc-200"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              isRealtimeConnected ? "bg-emerald-500 animate-pulse" : "bg-zinc-400"
            }`}
          />
          <span>{isRealtimeConnected ? "Live Queue" : "Connecting..."}</span>
        </span>
      </div>

      {/* Main Order Card */}
      <div className="rounded-3xl border border-zinc-200/80 bg-white p-6 shadow-sm sm:p-8">
        {/* Stall & Cafeteria Info */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-orange-600">
              Counter Destination
            </span>
            <h1 className="text-2xl font-black text-zinc-950">
              {order.shop.name}
            </h1>
            <p className="mt-0.5 text-xs text-zinc-500">
              {order.cafeteria.name} · {order.university.name}
            </p>
          </div>

          <span
            className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold shrink-0 ${currentStatusInfo.color}`}
          >
            {currentStatusInfo.label}
          </span>
        </div>

        {/* Soft Pickup Banner inspired by requirements.png */}
        <div className="mt-5 flex items-center gap-2 rounded-2xl bg-orange-50 border border-orange-100/80 p-3.5 text-xs text-orange-900">
          <span className="text-base">📍</span>
          <span className="font-semibold">
            Please show this screen at the counter to collect your order.
          </span>
        </div>

        {/* 4-digit Verbal Order Code Callout */}
        {order.order_code != null && !isTerminalState && (
          <div className="mt-5 flex flex-col items-center justify-center rounded-2xl bg-violet-50/80 border border-violet-100 p-5 text-center">
            <span className="text-[11px] font-bold uppercase tracking-widest text-violet-600">
              Your Verbal Order Code
            </span>
            <div className="mt-1 text-5xl font-black tracking-[0.2em] text-violet-700 font-mono">
              #{order.order_code}
            </div>
            <p className="mt-2 text-xs text-violet-900/80 font-medium">
              Call out code <strong className="font-bold">#{order.order_code}</strong> at the pickup counter
            </p>
          </div>
        )}

        {/* Live Stepper */}
        {!isTerminalState ? (
          <div className="mt-6 border-t border-zinc-100 pt-5">
            <div className="grid grid-cols-3 gap-2 text-center text-[11px] font-bold">
              <div
                className={`rounded-xl py-2 px-1 transition ${
                  currentStatusInfo.step >= 1
                    ? "bg-orange-600 text-white shadow-sm"
                    : "bg-zinc-100 text-zinc-400"
                }`}
              >
                1. Placed
              </div>
              <div
                className={`rounded-xl py-2 px-1 transition ${
                  currentStatusInfo.step >= 2
                    ? "bg-orange-600 text-white shadow-sm"
                    : "bg-zinc-100 text-zinc-400"
                }`}
              >
                2. Preparing
              </div>
              <div
                className={`rounded-xl py-2 px-1 transition ${
                  currentStatusInfo.step >= 3
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "bg-zinc-100 text-zinc-400"
                }`}
              >
                {order.status === "READY" ? "✓ Ready!" : "3. Ready"}
              </div>
            </div>

            {order.status === "READY" && (
              <p className="mt-3 text-center text-xs font-bold text-emerald-700 animate-pulse">
                🎉 Your food is ready for collection at the counter!
              </p>
            )}
          </div>
        ) : order.status === "COLLECTED" ? (
          <div className="mt-6 rounded-2xl bg-emerald-50 border border-emerald-100 p-4 text-xs text-emerald-800 flex items-start gap-2.5">
            <span className="text-emerald-600 font-black text-sm">✓</span>
            <div>
              <strong className="font-bold">Order Collected!</strong>
              <p className="mt-0.5 text-emerald-700">Enjoy your meal. Thank you for using SkipQ.</p>
            </div>
          </div>
        ) : (
          <div className="mt-6 rounded-2xl bg-rose-50 border border-rose-100 p-4 text-xs text-rose-800">
            <strong className="font-bold">Order Cancelled</strong>
            {order.cancellation_reason ? (
              <p className="mt-1 text-rose-700">{order.cancellation_reason}</p>
            ) : null}
          </div>
        )}

        {/* Scannable QR Code Frame */}
        {!isTerminalState && (
          <div className="mt-8 flex flex-col items-center text-center">
            <div className="rounded-3xl border-2 border-zinc-200/80 bg-white p-4 shadow-sm">
              {qrState.isLoading ? (
                <div className="flex h-56 w-56 items-center justify-center rounded-2xl bg-zinc-50">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-600 border-t-transparent" />
                </div>
              ) : qrState.dataUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={qrState.dataUrl}
                  alt={`Collection QR for order ${order.order_number}`}
                  className="h-56 w-56 rounded-xl object-contain sm:h-64 sm:w-64"
                />
              ) : (
                <div className="flex h-56 w-56 flex-col items-center justify-center rounded-2xl bg-zinc-50 p-4 text-center text-xs text-zinc-500">
                  <span className="text-2xl mb-2">📱</span>
                  <p className="font-bold text-zinc-700">Use Verbal Order Code</p>
                  <p className="text-[11px] text-zinc-400 mt-1">
                    Tell the counter: #{order.order_code ?? order.order_number}
                  </p>
                </div>
              )}
            </div>

            <p className="mt-3 text-xs text-zinc-400">
              Cash payment of <strong className="text-zinc-900 font-black">৳{order.total_amount.toFixed(2)}</strong> due upon pickup
            </p>
          </div>
        )}
      </div>

      {/* Itemized Order Receipt Summary */}
      <div className="rounded-3xl border border-zinc-200/80 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-base font-bold text-zinc-950">Receipt &amp; Items</h2>
        <p className="text-xs text-zinc-400 mt-0.5">Order #{order.order_number} · Placed {formattedDate}</p>

        <ul className="mt-4 divide-y divide-zinc-100 text-xs" role="list">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-center justify-between py-3">
              <div>
                <span className="font-bold text-zinc-950">{item.item_name_snapshot}</span>
                <span className="ml-1.5 font-bold text-orange-600">× {item.quantity}</span>
                <div className="text-[11px] text-zinc-400">৳{item.unit_price_snapshot.toFixed(2)} each</div>
              </div>
              <div className="font-black text-zinc-950">
                ৳{item.line_total_snapshot.toFixed(2)}
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-4 border-t border-zinc-100 pt-4 space-y-1.5 text-xs">
          <div className="flex justify-between text-zinc-500">
            <span>Payment Method</span>
            <span className="font-bold text-zinc-800">
              {order.payment_method === "CASH" ? "Cash on Collection" : "Online"}
            </span>
          </div>
          <div className="flex items-baseline justify-between pt-2 border-t border-zinc-100">
            <span className="text-sm font-bold text-zinc-900">Total</span>
            <span className="text-2xl font-black text-orange-600">
              ৳{order.total_amount.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Action to browse more */}
      <div className="text-center pt-2">
        <Link
          href="/customer/university"
          className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-6 py-3 text-xs font-bold text-zinc-700 shadow-sm hover:bg-zinc-50 transition"
        >
          <span>Explore More Cafeterias</span>
          <span>→</span>
        </Link>
      </div>
    </div>
  );
}
