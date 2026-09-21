"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type { CustomerMenuItem } from "@/lib/customer/data";
import type { OutletContext } from "@/lib/customer/cart-types";
import { useCart } from "@/lib/customer/cart-context";
import { resolveMenuItemImage, getEstimatedPrepTime } from "@/lib/customer/food-images";

type CustomerMenuClientProps = {
  items: CustomerMenuItem[];
  shopId: string;
  shopName: string;
  cafeteriaId: string;
  cafeteriaName: string;
  universityId: string;
  universityName: string;
};

type MenuCategoryFilter = "all" | "meals" | "snacks" | "drinks";

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
  const [activeCategory, setActiveCategory] = useState<MenuCategoryFilter>("all");

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
    let result = items;

    // Filter by category
    if (activeCategory !== "all") {
      result = result.filter((item) => {
        const text = `${item.name} ${item.description ?? ""}`.toLowerCase();
        if (activeCategory === "drinks") {
          return (
            text.includes("tea") ||
            text.includes("chai") ||
            text.includes("coffee") ||
            text.includes("brew") ||
            text.includes("espresso") ||
            text.includes("americano") ||
            text.includes("cappuc") ||
            text.includes("latte") ||
            text.includes("mocha") ||
            text.includes("chocolate") ||
            text.includes("fezz") ||
            text.includes("fizz") ||
            text.includes("mint") ||
            text.includes("drink") ||
            text.includes("juice") ||
            text.includes("cola") ||
            text.includes("water") ||
            text.includes("lassi")
          );
        }
        if (activeCategory === "meals") {
          return (
            text.includes("rice") ||
            text.includes("biryani") ||
            text.includes("kichuri") ||
            text.includes("curry") ||
            text.includes("roast") ||
            text.includes("meal") ||
            text.includes("thali") ||
            text.includes("polao") ||
            text.includes("beef") ||
            text.includes("chicken")
          );
        }
        if (activeCategory === "snacks") {
          return (
            text.includes("burger") ||
            text.includes("sandwich") ||
            text.includes("roll") ||
            text.includes("wrap") ||
            text.includes("fries") ||
            text.includes("samosa") ||
            text.includes("singara") ||
            text.includes("snack") ||
            text.includes("noodle") ||
            text.includes("pasta") ||
            text.includes("cake") ||
            text.includes("sweet")
          );
        }
        return true;
      });
    }

    // Filter by query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          (item.description && item.description.toLowerCase().includes(q))
      );
    }

    return result;
  }, [items, activeCategory, searchQuery]);

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
      {/* Search Bar & Category Filter Pills */}
      <div className="space-y-3">
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-zinc-400">
            <svg className="h-4 w-4 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
          </div>
          <input
            id="menu-search"
            type="text"
            placeholder="Search items, drinks, snacks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-2xl border border-zinc-200 bg-white py-3 pl-11 pr-10 text-sm text-zinc-900 placeholder:text-zinc-400 shadow-sm outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10"
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

        {/* Category Pills inspired by modern food ordering reference */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveCategory("all")}
            className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition active:scale-95 ${
              activeCategory === "all"
                ? "bg-zinc-950 text-white shadow-sm"
                : "border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
            }`}
          >
            All Items
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory("meals")}
            className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition active:scale-95 ${
              activeCategory === "meals"
                ? "bg-zinc-950 text-white shadow-sm"
                : "border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
            }`}
          >
            🍛 Rice &amp; Meals
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory("snacks")}
            className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition active:scale-95 ${
              activeCategory === "snacks"
                ? "bg-zinc-950 text-white shadow-sm"
                : "border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
            }`}
          >
            🍔 Fast Food &amp; Snacks
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory("drinks")}
            className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition active:scale-95 ${
              activeCategory === "drinks"
                ? "bg-zinc-950 text-white shadow-sm"
                : "border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
            }`}
          >
            🥤 Drinks &amp; Coffee
          </button>
        </div>

        <div className="flex items-center justify-between text-xs font-semibold text-zinc-400 px-1">
          <span>Showing {filteredItems.length} of {items.length} items</span>
          {activeCategory !== "all" && (
            <button
              onClick={() => setActiveCategory("all")}
              className="text-orange-600 hover:text-orange-700"
            >
              Reset filter
            </button>
          )}
        </div>
      </div>

      {/* Notice if user already has cart from another outlet */}
      {cart.outlet && !isCurrentOutletInCart && cart.items.length > 0 ? (
        <div className="flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50/90 p-4 text-xs text-amber-900">
          <div className="flex items-center gap-2.5">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-200 font-bold text-amber-900">
              !
            </span>
            <span>
              Your current cart has items from <strong>{cart.outlet.shop_name}</strong> ({cart.outlet.cafeteria_name}).
            </span>
          </div>
          <Link
            href="/customer/cart"
            className="shrink-0 font-bold text-orange-700 underline hover:text-orange-800"
          >
            View Cart
          </Link>
        </div>
      ) : null}

      {/* Menu items list */}
      {filteredItems.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-zinc-200 bg-white p-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-orange-50 text-orange-600">
            <svg className="h-6 w-6 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
              <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm0 14a1 1 0 1 1 1-1 1 1 0 0 1-1 1Zm1-5a1 1 0 0 1-2 0V7a1 1 0 0 1 2 0Z" />
            </svg>
          </div>
          <h3 className="mt-3 text-base font-bold text-zinc-900">
            {searchQuery ? "No matching food items" : "No items in this category"}
          </h3>
          <p className="mt-1 text-xs text-zinc-500">
            {searchQuery
              ? `No items found matching "${searchQuery}". Try a broader term.`
              : "Try switching categories or clearing search."}
          </p>
          {(searchQuery || activeCategory !== "all") && (
            <button
              onClick={() => {
                setSearchQuery("");
                setActiveCategory("all");
              }}
              className="mt-4 inline-flex rounded-full bg-orange-50 px-4 py-2 text-xs font-bold text-orange-700 hover:bg-orange-100"
            >
              Show All Menu Items
            </button>
          )}
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
            const imageUrl = resolveMenuItemImage(item);
            const prepTime = getEstimatedPrepTime(item.name, item.description);

            return (
              <div
                key={item.id}
                className={`group flex flex-col justify-between overflow-hidden rounded-3xl border bg-white transition ${
                  isAvailable
                    ? "border-zinc-200/80 shadow-sm hover:border-orange-200 hover:shadow-md"
                    : "border-zinc-200 bg-zinc-50/80 opacity-75"
                }`}
              >
                <div>
                  {/* Food Image Container */}
                  <div className="relative aspect-[16/10] w-full overflow-hidden bg-zinc-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imageUrl}
                      alt={item.name}
                      className={`h-full w-full object-cover transition duration-300 ${
                        isAvailable ? "group-hover:scale-105" : "grayscale"
                      }`}
                      loading="lazy"
                    />

                    {/* Gradient shade for bottom badge readability */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/20 pointer-events-none" />

                    {/* Top Status Badge */}
                    <div className="absolute right-3 top-3">
                      {isManualUnavailable ? (
                        <span className="inline-flex items-center rounded-full bg-zinc-900/90 px-2.5 py-1 text-[10px] font-extrabold tracking-wider text-white backdrop-blur-sm">
                          UNAVAILABLE
                        </span>
                      ) : isOutOfStock ? (
                        <span className="inline-flex items-center rounded-full bg-rose-600/90 px-2.5 py-1 text-[10px] font-extrabold tracking-wider text-white backdrop-blur-sm">
                          OUT OF STOCK
                        </span>
                      ) : item.available_stock <= 5 ? (
                        <span className="inline-flex items-center rounded-full bg-amber-500/90 px-2.5 py-1 text-[10px] font-extrabold text-white backdrop-blur-sm">
                          Only {item.available_stock} left
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-emerald-600/90 px-2.5 py-1 text-[10px] font-extrabold text-white backdrop-blur-sm">
                          In Stock ({item.available_stock})
                        </span>
                      )}
                    </div>

                    {/* Bottom Prep Time Badge */}
                    <div className="absolute left-3 bottom-3">
                      <span className="inline-flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-md">
                        <span>⏱️</span>
                        <span>{prepTime}</span>
                      </span>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-4 sm:p-5">
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="text-base font-bold text-zinc-950 line-clamp-1 group-hover:text-orange-950">
                        {item.name}
                      </h3>
                      <span className="shrink-0 text-base font-black text-orange-600">
                        ৳{item.price.toFixed(2)}
                      </span>
                    </div>

                    {item.description ? (
                      <p className="mt-1 text-xs leading-5 text-zinc-500 line-clamp-2">
                        {item.description}
                      </p>
                    ) : null}

                    {/* Order limit tag */}
                    <div className="mt-3 flex items-center gap-2 text-[11px]">
                      <span className="inline-flex items-center rounded-md bg-zinc-100 px-2 py-0.5 font-medium text-zinc-600">
                        Max {item.max_quantity_per_order} per order
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Action Area */}
                <div className="border-t border-zinc-100 p-4 sm:px-5 sm:py-3.5 bg-zinc-50/50">
                  {isAvailable ? (
                    currentQty === 0 ? (
                      <button
                        type="button"
                        onClick={() => handleAddItem(item)}
                        className="flex w-full items-center justify-center gap-2 rounded-full bg-orange-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-orange-700 active:scale-95"
                        aria-label={`Add ${item.name} to order`}
                      >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M12 5v14M5 12h14" />
                        </svg>
                        <span>Add to Order</span>
                      </button>
                    ) : (
                      <div className="flex items-center justify-between">
                        {/* Stepper */}
                        <div className="flex items-center gap-1 rounded-full border border-orange-200 bg-white p-1 shadow-sm">
                          <button
                            type="button"
                            onClick={() => handleDecrement(item.id)}
                            className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-50 text-orange-700 transition hover:bg-orange-100 active:scale-90"
                            aria-label={`Decrease ${item.name} count`}
                          >
                            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <path d="M5 12h14" />
                            </svg>
                          </button>

                          <span className="min-w-[1.75rem] text-center text-xs font-black text-zinc-950">
                            {currentQty}
                          </span>

                          <button
                            type="button"
                            onClick={() => handleIncrement(item)}
                            disabled={hasReachedMax}
                            className={`flex h-7 w-7 items-center justify-center rounded-full transition active:scale-90 ${
                              hasReachedMax
                                ? "cursor-not-allowed bg-zinc-100 text-zinc-300"
                                : "bg-orange-600 text-white hover:bg-orange-700"
                            }`}
                            aria-label={`Increase ${item.name} count`}
                          >
                            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <path d="M12 5v14M5 12h14" />
                            </svg>
                          </button>
                        </div>

                        <div className="text-right">
                          <div className="text-xs font-black text-zinc-900">
                            ৳{(item.price * currentQty).toFixed(2)}
                          </div>
                          {hasReachedMax && (
                            <div className="text-[10px] font-bold text-amber-600">
                              {currentQty >= item.available_stock ? "Stock limit" : "Order limit"}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  ) : (
                    <div className="flex h-9 w-full items-center justify-center rounded-full bg-zinc-200/70 text-xs font-semibold text-zinc-500">
                      {isManualUnavailable ? "Item Unavailable" : "Out of Stock"}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Floating Bottom Cart Bar (inspired directly by UI inspo.png) */}
      {isCurrentOutletInCart && currentOutletItemsCount > 0 && (
        <aside
          aria-label="Active cart summary"
          className="fixed bottom-5 left-4 right-4 z-40 mx-auto max-w-xl rounded-full bg-zinc-950/95 p-3 pl-5 pr-3 text-white shadow-2xl backdrop-blur-md flex items-center justify-between border border-zinc-800 animate-in fade-in slide-in-from-bottom-3 duration-200"
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-600 text-xs font-black text-white shadow-sm shadow-orange-600/40">
              {currentOutletItemsCount}
            </span>
            <div className="min-w-0">
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>View your cart</span>
                <span className="text-zinc-400">·</span>
                <span className="text-xs font-extrabold text-orange-400">৳{currentOutletTotal.toFixed(2)}</span>
              </div>
              <p className="text-[11px] text-zinc-400 truncate">
                {shopName} · {cafeteriaName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={clearCart}
              className="rounded-full px-3 py-1.5 text-xs font-semibold text-zinc-400 hover:text-white transition"
            >
              Clear
            </button>
            <Link
              href="/customer/cart"
              className="inline-flex items-center gap-1.5 rounded-full bg-orange-600 px-5 py-2 text-xs font-bold text-white shadow-md shadow-orange-600/30 hover:bg-orange-700 active:scale-95 transition"
            >
              <span>Checkout</span>
              <span>→</span>
            </Link>
          </div>
        </aside>
      )}

      {/* Outlet Conflict Modal */}
      {pendingSwitch && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="switch-outlet-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/60 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xl sm:p-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-800 text-xl">
              ⚠️
            </div>

            <h3 id="switch-outlet-title" className="mt-4 text-xl font-black text-zinc-950">
              Start a new order?
            </h3>
            <p className="mt-2 text-xs leading-5 text-zinc-600">
              Your cart currently contains items from <strong>{cart.outlet?.shop_name}</strong> ({cart.outlet?.cafeteria_name}).
            </p>
            <p className="mt-2 text-xs leading-5 text-zinc-600">
              Each SkipQ order is strictly for one sales counter. Would you like to clear your current cart and switch to <strong>{pendingSwitch.outlet.shop_name}</strong>?
            </p>

            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={cancelOutletSwitch}
                className="rounded-full border border-zinc-200 px-5 py-2.5 text-xs font-bold text-zinc-700 hover:bg-zinc-50"
              >
                Keep Current Cart
              </button>
              <button
                type="button"
                onClick={confirmOutletSwitch}
                className="rounded-full bg-orange-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-orange-700 active:scale-95"
              >
                Clear &amp; Switch
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
