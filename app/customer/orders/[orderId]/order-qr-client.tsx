"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/client";
import type { CustomerOrderDetails } from "@/lib/customer/orders";

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
        () => {
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

    return () => {
      isCancelled = true;
    };
  }, [order.id, order.status]);

  const statusConfig = {
    PLACED: {
      label: "Order Placed",
      color: "bg-orange-100 text-orange-800 border-orange-200",
      step: 1,
    },
    PREPARING: {
      label: "Preparing Food",
      color: "bg-amber-100 text-amber-800 border-amber-200",
      step: 2,
    },
    READY: {
      label: "Ready for Pickup! 🎉",
      color: "bg-emerald-100 text-emerald-800 border-emerald-200",
      step: 3,
    },
    COLLECTED: {
      label: "Collected",
      color: "bg-zinc-100 text-zinc-800 border-zinc-200",
      step: 4,
    },
    CANCELLED: {
      label: "Cancelled",
      color: "bg-rose-100 text-rose-800 border-rose-200",
      step: 0,
    },
    PAYMENT_PENDING: {
      label: "Payment Pending",
      color: "bg-blue-100 text-blue-800 border-blue-200",
      step: 0,
    },
  };

  const currentStatusInfo = statusConfig[order.status] || {
    label: order.status,
    color: "bg-zinc-100 text-zinc-800 border-zinc-200",
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
    <div className="mx-auto max-w-2xl space-y-6 pb-12">
      {/* Top Header Card */}
      <div className="rounded-[2rem] border border-orange-100 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              {order.status !== "CANCELLED" && order.status !== "PAYMENT_PENDING" && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                  Order Confirmed
                </span>
              )}
              <span className="text-xs font-semibold uppercase tracking-wider text-orange-700">
                {order.payment_method === "CASH" ? "Cash Order" : "Online Order"}
              </span>
              {/* Realtime status dot */}
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  isRealtimeConnected
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-zinc-100 text-zinc-500 border border-zinc-200"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${isRealtimeConnected ? "bg-emerald-500 animate-pulse" : "bg-zinc-400"}`}
                />
                {isRealtimeConnected ? "Live" : "Connecting…"}
              </span>
            </div>

            <h1 className="mt-2 text-2xl font-black tracking-tight text-zinc-950 sm:text-3xl">
              Order #{order.order_number}
            </h1>
            {order.order_code != null && (
              <div className="mt-3 inline-flex items-baseline gap-2 rounded-2xl bg-violet-50 border border-violet-200 px-4 py-2">
                <span className="text-xs font-bold uppercase tracking-wider text-violet-500">Code</span>
                <span className="text-4xl font-black tracking-[0.2em] text-violet-700 tabular-nums">
                  #{order.order_code}
                </span>
              </div>
            )}
            <p className="mt-2 text-xs text-zinc-400">Tell the counter: <strong className="text-zinc-600">#{order.order_code ?? order.order_number}</strong></p>
            <p className="mt-1 text-xs text-zinc-500">Placed on {formattedDate}</p>
          </div>

          <div className="flex flex-col sm:items-end">
            <span
              className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${currentStatusInfo.color}`}
            >
              {currentStatusInfo.label}
            </span>
            <span className="mt-1 text-xs text-zinc-500">
              Payment: {order.payment_method === "CASH" ? "Cash on Collection" : "Online"}
            </span>
          </div>
        </div>

        {/* Status Lifecycle Stepper */}
        {order.status === "CANCELLED" ? (
          <div className="mt-6 rounded-2xl bg-rose-50 border border-rose-100 p-4 text-xs text-rose-800">
            <div className="flex items-start gap-2">
              <svg className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" />
                <path d="M15 9l-6 6M9 9l6 6" />
              </svg>
              <div>
                <strong className="font-bold">Order Cancelled</strong>
                {order.cancellation_reason && (
                  <p className="mt-1 text-rose-700">{order.cancellation_reason}</p>
                )}
                <p className="mt-1 text-rose-600">
                  If you have questions, please contact the sales point directly.
                </p>
              </div>
            </div>
          </div>
        ) : order.status === "COLLECTED" ? (
          <div className="mt-6 rounded-2xl bg-emerald-50 border border-emerald-100 p-4 text-xs text-emerald-800">
            <div className="flex items-start gap-2">
              <svg className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M20 6 9 17l-5-5" />
              </svg>
              <div>
                <strong className="font-bold">Order Collected Successfully!</strong>
                <p className="mt-1 text-emerald-700">
                  Enjoy your food! Thank you for using SkipQ.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-6 border-t border-orange-50 pt-5">
            <div className="grid grid-cols-3 gap-2 text-center text-[11px] font-semibold">
              <div
                className={`rounded-xl p-2 transition ${
                  currentStatusInfo.step >= 1
                    ? "bg-orange-600 text-white shadow-sm"
                    : "bg-zinc-100 text-zinc-400"
                }`}
              >
                1. Placed
              </div>
              <div
                className={`rounded-xl p-2 transition ${
                  currentStatusInfo.step >= 2
                    ? "bg-orange-600 text-white shadow-sm"
                    : "bg-zinc-100 text-zinc-400"
                }`}
              >
                2. Preparing
              </div>
              <div
                className={`rounded-xl p-2 transition ${
                  currentStatusInfo.step >= 3
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "bg-zinc-100 text-zinc-400"
                }`}
              >
                {order.status === "READY" ? "✓ Ready!" : "3. Ready"}
              </div>
            </div>
            {order.status === "READY" && (
              <p className="mt-3 text-center text-sm font-bold text-emerald-700 animate-pulse">
                🎉 Your order is ready — head to the counter now!
              </p>
            )}
          </div>
        )}
      </div>

      {/* QR Code Collection Box — hidden for COLLECTED and CANCELLED orders */}
      {!isTerminalState && (
        <div className="rounded-[2.5rem] border border-orange-200 bg-white p-6 text-center shadow-lg sm:p-8">
          <div className="mx-auto max-w-sm">
            <div className="inline-flex items-center gap-2 rounded-full bg-orange-100 px-3.5 py-1 text-xs font-bold text-orange-800">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
              Digital Collection Credential
            </div>

            <h2 className="mt-3 text-xl font-extrabold text-zinc-950">
              Collection QR Code
            </h2>
            <p className="mt-1 text-xs text-zinc-600">
              Show this QR code at the counter when collecting your order.
            </p>

            {/* QR Code Canvas/Image */}
            <div className="my-6 flex justify-center">
              {qrState.isLoading ? (
                <div className="flex h-64 w-64 items-center justify-center rounded-3xl border border-dashed border-orange-200 bg-orange-50">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-600 border-t-transparent" />
                </div>
              ) : qrState.dataUrl ? (
                <div className="rounded-3xl border-4 border-orange-500/30 bg-white p-4 shadow-md transition hover:scale-[1.02]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrState.dataUrl}
                    alt={`Collection QR for order ${order.order_number}`}
                    className="h-64 w-64 rounded-xl object-contain sm:h-72 sm:w-72"
                  />
                </div>
              ) : (
                <div className="flex h-64 w-64 flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center text-xs text-zinc-500">
                  <svg className="h-10 w-10 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M12 9v4m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                  <p className="mt-3 font-semibold text-zinc-700">QR Available on Origin Device</p>
                  <p className="mt-1 text-[11px] leading-4 text-zinc-500">
                    For security, the collection QR is delivered once upon order creation to the originating device session.
                  </p>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-orange-100 bg-orange-50/70 p-4 text-left text-xs leading-5 text-zinc-700">
              <div className="font-semibold text-orange-950">Pickup Instructions:</div>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-zinc-600">
                <li>Head to <strong>{order.shop.name}</strong> ({order.cafeteria.name}).</li>
                <li>Present this QR code to the cashier / terminal scanner.</li>
                {order.payment_method === "CASH" && (
                  <li>Pay <strong>৳{order.total_amount.toFixed(2)}</strong> cash at the counter upon collection.</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Order Summary & Receipt Details */}
      <div className="rounded-[2rem] border border-orange-100 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-bold text-zinc-950">Order Summary</h2>

        {/* Location banner */}
        <div className="mt-4 rounded-2xl bg-orange-50/60 p-4 text-xs text-zinc-700">
          <div className="font-bold text-zinc-900">{order.shop.name}</div>
          <div className="text-zinc-600">
            {order.cafeteria.name} · {order.university.name}
          </div>
        </div>

        {/* Items List */}
        <ul className="mt-4 divide-y divide-orange-50 border-b border-orange-50 pb-4 text-sm" role="list">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-center justify-between py-3">
              <div>
                <span className="font-bold text-zinc-950">{item.item_name_snapshot}</span>
                <span className="ml-2 text-xs text-zinc-500">× {item.quantity}</span>
                <div className="text-xs text-zinc-400">৳{item.unit_price_snapshot.toFixed(2)} each</div>
              </div>
              <div className="font-bold text-zinc-950">
                ৳{item.line_total_snapshot.toFixed(2)}
              </div>
            </li>
          ))}
        </ul>

        {/* Totals */}
        <div className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between font-medium text-zinc-600">
            <span>Payment Method</span>
            <span className="font-bold text-zinc-900">
              {order.payment_method === "CASH" ? "Cash on Collection" : "Online"}
            </span>
          </div>
          <div className="flex justify-between items-baseline pt-2 border-t border-orange-100">
            <span className="text-base font-bold text-zinc-950">Total Amount</span>
            <span className="text-2xl font-black text-orange-600 sm:text-3xl">
              ৳{order.total_amount.toFixed(2)} {order.currency}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation action */}
      <div className="text-center">
        <Link
          href="/customer/university"
          className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-600"
        >
          <span>Order More from Cafeterias</span>
          <span>→</span>
        </Link>
      </div>
    </div>
  );
}
