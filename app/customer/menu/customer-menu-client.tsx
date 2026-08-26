"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type { CustomerMenuItem } from "@/lib/customer/data";
import type { OutletContext } from "@/lib/customer/cart-types";
import { useCart } from "@/lib/customer/cart-context";

type CustomerMenuClientProps = {
  items: CustomerMenuItem[];
  shopId: string;
  shopName: string;
  cafeteriaId: string;
  cafeteriaName: string;
  universityId: string;
  universityName: string;
};

export function CustomerMenuClient({
  items,
  shopId,
  shopName,
  cafeteriaId,
  cafeteriaName,
  universityId,
  universityName,
}: CustomerMenuClientProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const {
    cart,
    addItem,
    updateQuantity,
    getItemQuantity,
    pendingSwitch,
    confirmOutletSwitch,
    cancelOutletSwitch,
    clearCart,
  } = useCart();

  const outletContext: OutletContext = useMemo(
    () => ({
      university_id: universityId,
      university_name: universityName,
      cafeteria_id: cafeteriaId,
      cafeteria_name: cafeteriaName,
      shop_id: shopId,
      shop_name: shopName,
    }),
    [universityId, universityName, cafeteriaId, cafeteriaName, shopId, shopName]
  );

  const isCurrentOutletInCart = cart.outlet?.shop_id === shopId;

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase().trim();
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        (item.description && item.description.toLowerCase().includes(q))
    );
  }, [items, searchQuery]);

  const handleAddItem = (item: CustomerMenuItem) => {
    addItem(outletContext, item, 1);
  };

  const handleIncrement = (item: CustomerMenuItem) => {
    if (!isCurrentOutletInCart) {
      addItem(outletContext, item, 1);
      return;
    }

    const currentQty = getItemQuantity(item.id);
    const maxAllowed = Math.min(item.available_stock, item.max_quantity_per_order);
    if (currentQty >= maxAllowed) return;

    updateQuantity(item.id, 1);
  };

  const handleDecrement = (itemId: string) => {
    if (!isCurrentOutletInCart) return;
    updateQuantity(itemId, -1);
  };

  const currentOutletItemsCount = isCurrentOutletInCart
    ? cart.items.reduce((sum, i) => sum + i.quantity, 0)
    : 0;

  const currentOutletTotal = isCurrentOutletInCart
    ? cart.items.reduce((sum, i) => sum + i.price * i.quantity, 0)
    : 0;

  return (
    <div className="space-y-6 pb-28">
      {/* Search and stats bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <label htmlFor="menu-search" className="sr-only">
            Search menu items
          </label>
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-400">
            <svg className="h-4 w-4 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
          </div>
          <input
            id="menu-search"
            type="text"
            placeholder="Search food, snacks, drinks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-full border border-orange-200 bg-white py-2.5 pl-10 pr-10 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
          />
          {searchQuery ? (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-zinc-400 hover:text-zinc-600"
              aria-label="Clear search"
            >
              <svg className="h-4 w-4 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          ) : null}
        </div>

        <div className="text-xs font-medium text-zinc-500">
          Showing {filteredItems.length} of {items.length} items
        </div>
      </div>

      {/* Notice if user already has cart from another outlet */}
      {cart.outlet && !isCurrentOutletInCart && cart.items.length > 0 ? (
        <div className="flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-xs text-amber-900">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-200 font-bold text-amber-900">
              !
            </span>
            <span>
              Your cart has items from <strong>{cart.outlet.shop_name}</strong> ({cart.outlet.cafeteria_name}).
            </span>
          </div>
          <Link
            href="/customer/cart"
            className="font-semibold text-orange-700 underline hover:text-orange-800"
          >
            View Cart
          </Link>
        </div>
      ) : null}

      {/* Menu items list */}
      {filteredItems.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-orange-200 bg-white p-8 text-center sm:p-12">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-orange-100 text-orange-600">
            <svg className="h-7 w-7 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
              <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm0 14a1 1 0 1 1 1-1 1 1 0 0 1-1 1Zm1-5a1 1 0 0 1-2 0V7a1 1 0 0 1 2 0Z" />
            </svg>
          </div>
          <h3 className="mt-4 text-base font-semibold text-zinc-900">
            {searchQuery ? "No matching food items found" : "Menu is empty"}
          </h3>
          <p className="mt-1 text-sm text-zinc-600">
            {searchQuery
              ? `No items found matching "${searchQuery}". Try a different keyword.`
              : `No items have been added to ${shopName} yet.`}
          </p>
          {searchQuery ? (
            <button
              onClick={() => setSearchQuery("")}
              className="mt-4 inline-flex rounded-full bg-orange-600 px-4 py-2 text-xs font-semibold text-white hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-600"
            >
              Clear search filter
            </button>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="list" aria-label="Menu items">
          {filteredItems.map((item) => {
            const isManualUnavailable = !item.is_manually_available;
            const isOutOfStock = item.is_manually_available && item.available_stock <= 0;
            const isAvailable = item.is_manually_available && item.available_stock > 0;
            const maxAllowed = Math.min(item.available_stock, item.max_quantity_per_order);
            const currentQty = isCurrentOutletInCart ? getItemQuantity(item.id) : 0;
            const hasReachedMax = currentQty >= maxAllowed;

            return (
              <div
                key={item.id}
                className={`group flex flex-col justify-between overflow-hidden rounded-3xl border transition ${
                  isAvailable
                    ? "border-orange-100 bg-white shadow-sm hover:border-orange-300 hover:shadow-md"
                    : "border-zinc-200 bg-zinc-50/80 opacity-80"
                }`}
              >
                <div>
                  {/* Image container */}
                  <div className="relative aspect-video w-full overflow-hidden bg-gradient-to-br from-orange-100 via-amber-50 to-orange-50">
                    {item.image_path ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.image_path}
                        alt={item.name}
                        className={`h-full w-full object-cover transition duration-300 ${
                          isAvailable ? "group-hover:scale-105" : "grayscale"
                        }`}
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                          e.currentTarget.parentElement?.querySelector(".fallback-icon")?.classList.remove("hidden");
                        }}
                      />
                    ) : null}

                    {/* Fallback food SVG illustration */}
                    <div
                      className={`fallback-icon flex h-full w-full items-center justify-center text-orange-400 ${
                        item.image_path ? "hidden" : ""
                      }`}
                    >
                      <svg className="h-12 w-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8Z" />
                        <line x1="6" y1="1" x2="6" y2="4" />
                        <line x1="10" y1="1" x2="10" y2="4" />
                        <line x1="14" y1="1" x2="14" y2="4" />
                      </svg>
                    </div>

                    {/* Status Badges */}
                    <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
                      {isManualUnavailable ? (
                        <span className="inline-flex items-center rounded-full bg-zinc-800/90 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                          UNAVAILABLE
                        </span>
                      ) : isOutOfStock ? (
                        <span className="inline-flex items-center rounded-full bg-rose-600/90 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                          OUT OF STOCK
                        </span>
                      ) : item.available_stock <= 5 ? (
                        <span className="inline-flex items-center rounded-full bg-amber-500/90 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                          Only {item.available_stock} left
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-emerald-600/90 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                          {item.available_stock} left
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Content */}
                  <div className="p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-base font-bold text-zinc-950 line-clamp-1">{item.name}</h3>
                      <span className="shrink-0 text-base font-bold text-orange-600">
                        ৳{item.price.toFixed(2)}
                      </span>
                    </div>

                    {item.description ? (
                      <p className="mt-1 text-xs leading-5 text-zinc-600 line-clamp-2">{item.description}</p>
                    ) : null}

                    {/* Metadata chips */}
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
                      <span className="rounded-md bg-orange-50 px-2 py-0.5 font-medium text-orange-800">
                        Max {item.max_quantity_per_order}/order
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Action / Quantity Selector */}
                <div className="border-t border-orange-50 bg-orange-50/30 p-4 sm:p-5">
                  {isAvailable ? (
                    currentQty === 0 ? (
                      <button
                        type="button"
                        onClick={() => handleAddItem(item)}
                        className="flex w-full items-center justify-center gap-2 rounded-full bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-700 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-orange-600 focus:ring-offset-1"
                        aria-label={`Add ${item.name} to cart`}
                      >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M12 5v14M5 12h14" />
                        </svg>
                        Add to Order
                      </button>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 rounded-full border border-orange-200 bg-white p-1 shadow-sm">
                          <button
                            type="button"
                            onClick={() => handleDecrement(item.id)}
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-50 text-orange-700 transition hover:bg-orange-100 active:scale-95 focus:outline-none focus:ring-2 focus:ring-orange-500"
                            aria-label={`Decrease quantity of ${item.name}`}
                          >
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <path d="M5 12h14" />
                            </svg>
                          </button>

                          <span className="min-w-[2rem] text-center text-sm font-bold text-zinc-950" aria-live="polite">
                            {currentQty}
                          </span>

                          <button
                            type="button"
                            onClick={() => handleIncrement(item)}
                            disabled={hasReachedMax}
                            className={`flex h-8 w-8 items-center justify-center rounded-full transition active:scale-95 focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                              hasReachedMax
                                ? "cursor-not-allowed bg-zinc-100 text-zinc-400"
                                : "bg-orange-600 text-white hover:bg-orange-700"
                            }`}
                            aria-label={`Increase quantity of ${item.name}`}
                          >
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <path d="M12 5v14M5 12h14" />
                            </svg>
                          </button>
                        </div>

                        <div className="text-right">
                          <div className="text-xs font-semibold text-zinc-900">
                            ৳{(item.price * currentQty).toFixed(2)}
                          </div>
                          {hasReachedMax ? (
                            <div className="text-[10px] font-medium text-amber-700">
                              {currentQty >= item.available_stock ? "Stock limit" : "Max per order"}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    )
                  ) : (
                    <div className="flex h-10 w-full items-center justify-center rounded-full bg-zinc-200/80 px-4 text-xs font-semibold text-zinc-500">
                      {isManualUnavailable ? "Item Unavailable" : "Out of Stock"}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Floating Bottom Cart Bar */}
      {isCurrentOutletInCart && currentOutletItemsCount > 0 ? (
        <aside
          aria-label="Active cart summary"
          className="fixed bottom-4 left-4 right-4 z-40 mx-auto max-w-2xl rounded-3xl border border-orange-200 bg-zinc-950/95 p-4 text-white shadow-xl backdrop-blur-md sm:p-5"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-orange-600 px-2 text-xs font-bold text-white">
                  {currentOutletItemsCount}
                </span>
                <span className="text-sm font-semibold text-zinc-200">
                  {currentOutletItemsCount === 1 ? "item in cart" : "items in cart"}
                </span>
                <span className="text-zinc-500">·</span>
                <span className="text-base font-bold text-orange-400">
                  ৳{currentOutletTotal.toFixed(2)}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-zinc-400">
                {shopName} · {cafeteriaName}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={clearCart}
                className="rounded-full bg-zinc-800 px-3.5 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-zinc-600"
              >
                Clear
              </button>
              <Link
                href="/customer/cart"
                className="inline-flex items-center gap-2 rounded-full bg-orange-600 px-5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-600"
              >
                <span>View Cart</span>
                <span>→</span>
              </Link>
            </div>
          </div>
        </aside>
      ) : null}

      {/* Outlet Conflict Modal */}
      {pendingSwitch ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="switch-outlet-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/60 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-md rounded-[2rem] border border-orange-100 bg-white p-6 shadow-2xl sm:p-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 9v4m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </div>

            <h3 id="switch-outlet-title" className="mt-4 text-xl font-bold text-zinc-950">
              Start a new order?
            </h3>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              Your cart currently contains items from <strong>{cart.outlet?.shop_name}</strong> (
              {cart.outlet?.cafeteria_name}).
            </p>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              Each order is strictly for one sales point. Would you like to clear your current cart and start ordering from <strong>{pendingSwitch.outlet.shop_name}</strong>?
            </p>

            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={cancelOutletSwitch}
                className="rounded-full border border-zinc-200 px-5 py-2.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400"
              >
                Keep Current Cart
              </button>
              <button
                type="button"
                onClick={confirmOutletSwitch}
                className="rounded-full bg-orange-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-600 focus:ring-offset-1"
              >
                Clear & Switch Outlet
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
