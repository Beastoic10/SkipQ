"use client";

export type ActiveOrderSummary = {
  orderId: string;
  orderCode: string | null;
  orderNumber: string;
  shopName: string;
  status: "PLACED" | "PREPARING" | "READY" | "COLLECTED" | "CANCELLED";
  placedAt: string;
};

const KEY = "skipq_active_order_v1";

let cachedOrder: ActiveOrderSummary | null = null;
let isHydrated = false;

// ---------------------------------------------------------------------------
// Reactive listener set — lets mounted components know when the value changes
// ---------------------------------------------------------------------------
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((fn) => fn());
}

/** Subscribe to active-order changes. Returns an unsubscribe function. */
export function subscribeActiveOrder(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

/** Read the current snapshot (safe to call during render via useSyncExternalStore). */
export function getActiveOrderSnapshot(): ActiveOrderSummary | null {
  if (typeof window === "undefined") return null;
  if (!isHydrated) {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        cachedOrder = JSON.parse(raw) as ActiveOrderSummary;
      }
    } catch {
      cachedOrder = null;
    }
    isHydrated = true;
  }
  return cachedOrder;
}

export function saveActiveOrder(order: ActiveOrderSummary): void {
  cachedOrder = order;
  isHydrated = true;
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(KEY, JSON.stringify(order));
    } catch {}
  }
  notifyListeners();
}

export function loadActiveOrder(): ActiveOrderSummary | null {
  return getActiveOrderSnapshot();
}

export function updateActiveOrderStatus(status: ActiveOrderSummary["status"]): void {
  const current = loadActiveOrder();
  if (!current || current.status === status) return;
  saveActiveOrder({ ...current, status });
}

export function clearActiveOrder(): void {
  cachedOrder = null;
  isHydrated = true;
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem(KEY);
    } catch {}
  }
  notifyListeners();
}


