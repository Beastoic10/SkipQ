"use client";

import React, {
  createContext,
  useContext,
  useSyncExternalStore,
  useCallback,
  useState,
  useMemo,
} from "react";
import type { CustomerMenuItem } from "./data";
import type { CartState, OutletContext, PendingOutletSwitch } from "./cart-types";

const CART_STORAGE_KEY = "skipq_customer_cart_v1";

const INITIAL_CART: CartState = {
  outlet: null,
  items: [],
};

let cachedCart: CartState = INITIAL_CART;
let isHydrated = false;
const listeners = new Set<() => void>();

function getSnapshot(): CartState {
  if (typeof window === "undefined") return INITIAL_CART;
  if (!isHydrated) {
    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as CartState;
        if (parsed && Array.isArray(parsed.items)) {
          cachedCart = parsed;
        }
      }
    } catch {
      // Fallback to initial
    }
    isHydrated = true;
  }
  return cachedCart;
}

function getServerSnapshot(): CartState {
  return INITIAL_CART;
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

function updateCartStore(newCart: CartState) {
  cachedCart = newCart;
  if (typeof window !== "undefined") {
    try {
      if (newCart.items.length === 0) {
        localStorage.removeItem(CART_STORAGE_KEY);
      } else {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(newCart));
      }
    } catch {
      // Storage unavailable
    }
  }
  listeners.forEach((listener) => listener());
}

type CartContextType = {
  cart: CartState;
  isLoaded: boolean;
  totalItemsCount: number;
  estimatedTotal: number;
  pendingSwitch: PendingOutletSwitch | null;
  addItem: (outlet: OutletContext, item: CustomerMenuItem, qty?: number) => { conflict: boolean };
  updateQuantity: (menu_item_id: string, delta: number) => void;
  setItemQuantity: (menu_item_id: string, quantity: number) => void;
  removeItem: (menu_item_id: string) => void;
  clearCart: () => void;
  confirmOutletSwitch: () => void;
  cancelOutletSwitch: () => void;
  getItemQuantity: (menu_item_id: string) => number;
};

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const cart = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [pendingSwitch, setPendingSwitch] = useState<PendingOutletSwitch | null>(null);

  const totalItemsCount = useMemo(() => {
    return cart.items.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart.items]);

  const estimatedTotal = useMemo(() => {
    return cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [cart.items]);

  const getItemQuantity = useCallback(
    (menuItemId: string) => {
      const existing = cart.items.find((item) => item.menu_item_id === menuItemId);
      return existing ? existing.quantity : 0;
    },
    [cart.items]
  );

  const addItem = useCallback(
    (outlet: OutletContext, item: CustomerMenuItem, qty: number = 1): { conflict: boolean } => {
      if (!item.is_manually_available || item.available_stock <= 0) {
        return { conflict: false };
      }

      if (cart.outlet && cart.items.length > 0 && cart.outlet.shop_id !== outlet.shop_id) {
        setPendingSwitch({ outlet, item, quantity: qty });
        return { conflict: true };
      }

      const currentQty = cart.items.find((i) => i.menu_item_id === item.id)?.quantity || 0;
      const maxAllowed = Math.min(item.available_stock, item.max_quantity_per_order);
      const newQty = Math.min(maxAllowed, currentQty + qty);

      if (newQty <= 0) return { conflict: false };

      const updatedItems = cart.items.filter((i) => i.menu_item_id !== item.id);
      updatedItems.push({
        menu_item_id: item.id,
        name: item.name,
        price: item.price,
        image_path: item.image_path,
        quantity: newQty,
        max_quantity_per_order: item.max_quantity_per_order,
        available_stock: item.available_stock,
      });

      updateCartStore({
        outlet,
        items: updatedItems,
      });

      return { conflict: false };
    },
    [cart.outlet, cart.items]
  );

  const updateQuantity = useCallback(
    (menuItemId: string, delta: number) => {
      const existing = cart.items.find((i) => i.menu_item_id === menuItemId);
      if (!existing) return;

      const maxAllowed = Math.min(existing.available_stock, existing.max_quantity_per_order);
      const newQty = existing.quantity + delta;

      if (newQty <= 0) {
        const remainingItems = cart.items.filter((i) => i.menu_item_id !== menuItemId);
        updateCartStore({
          outlet: remainingItems.length > 0 ? cart.outlet : null,
          items: remainingItems,
        });
        return;
      }

      const cappedQty = Math.min(maxAllowed, newQty);
      const updatedItems = cart.items.map((i) =>
        i.menu_item_id === menuItemId ? { ...i, quantity: cappedQty } : i
      );

      updateCartStore({
        ...cart,
        items: updatedItems,
      });
    },
    [cart]
  );

  const setItemQuantity = useCallback(
    (menuItemId: string, quantity: number) => {
      const existing = cart.items.find((i) => i.menu_item_id === menuItemId);
      if (!existing) return;

      if (quantity <= 0) {
        const remainingItems = cart.items.filter((i) => i.menu_item_id !== menuItemId);
        updateCartStore({
          outlet: remainingItems.length > 0 ? cart.outlet : null,
          items: remainingItems,
        });
        return;
      }

      const maxAllowed = Math.min(existing.available_stock, existing.max_quantity_per_order);
      const cappedQty = Math.min(maxAllowed, quantity);

      const updatedItems = cart.items.map((i) =>
        i.menu_item_id === menuItemId ? { ...i, quantity: cappedQty } : i
      );

      updateCartStore({
        ...cart,
        items: updatedItems,
      });
    },
    [cart]
  );

  const removeItem = useCallback(
    (menuItemId: string) => {
      const remainingItems = cart.items.filter((i) => i.menu_item_id !== menuItemId);
      updateCartStore({
        outlet: remainingItems.length > 0 ? cart.outlet : null,
        items: remainingItems,
      });
    },
    [cart.outlet, cart.items]
  );

  const clearCart = useCallback(() => {
    updateCartStore(INITIAL_CART);
    setPendingSwitch(null);
  }, []);

  const confirmOutletSwitch = useCallback(() => {
    if (!pendingSwitch) return;
    const { outlet, item, quantity } = pendingSwitch;
    const maxAllowed = Math.min(item.available_stock, item.max_quantity_per_order);
    const initialQty = Math.min(maxAllowed, quantity);

    if (initialQty > 0) {
      updateCartStore({
        outlet,
        items: [
          {
            menu_item_id: item.id,
            name: item.name,
            price: item.price,
            image_path: item.image_path,
            quantity: initialQty,
            max_quantity_per_order: item.max_quantity_per_order,
            available_stock: item.available_stock,
          },
        ],
      });
    } else {
      updateCartStore(INITIAL_CART);
    }
    setPendingSwitch(null);
  }, [pendingSwitch]);

  const cancelOutletSwitch = useCallback(() => {
    setPendingSwitch(null);
  }, []);

  return (
    <CartContext.Provider
      value={{
        cart,
        isLoaded: true,
        totalItemsCount,
        estimatedTotal,
        pendingSwitch,
        addItem,
        updateQuantity,
        setItemQuantity,
        removeItem,
        clearCart,
        confirmOutletSwitch,
        cancelOutletSwitch,
        getItemQuantity,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
