"use client";

import Link from "next/link";
import { useCart } from "@/lib/customer/cart-context";
import { resolveMenuItemImage } from "@/lib/customer/food-images";

export function CartClient() {
  const {
    cart,
    isLoaded,
    totalItemsCount,
    estimatedTotal,
    updateQuantity,
    removeItem,
    clearCart,
  } = useCart();

  if (!isLoaded) {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-orange-600 border-t-transparent" />
        <p className="mt-3 text-xs font-semibold text-zinc-500">Loading your cart...</p>
      </div>
    );
  }

  const outlet = cart.outlet;

  const menuHref = outlet
    ? `/customer/menu?universityId=${encodeURIComponent(outlet.university_id)}&cafeteriaId=${encodeURIComponent(outlet.cafeteria_id)}&shopId=${encodeURIComponent(outlet.shop_id)}`
    : "/customer/university";

  if (cart.items.length === 0 || !outlet) {
    return (
      <section className="mx-auto max-w-xl rounded-3xl border border-zinc-200/80 bg-white p-8 text-center shadow-sm sm:p-12">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-orange-50 text-orange-600 text-3xl">
          🛍️
        </div>

        <h1 className="mt-5 text-2xl font-black tracking-tight text-zinc-950 sm:text-3xl">
          Your Cart is Empty
        </h1>
        <p className="mt-2 text-xs leading-5 text-zinc-500 max-w-sm mx-auto">
          You haven&apos;t added any food items yet. Browse your campus cafeteria menu to order ahead and skip the line.
        </p>

        <div className="mt-8">
          <Link
            href="/customer/university"
            className="inline-flex items-center gap-2 rounded-full bg-orange-600 px-7 py-3.5 text-xs font-bold text-white shadow-md shadow-orange-600/20 transition hover:bg-orange-700 active:scale-95"
          >
            <span>Browse Campus Menus</span>
            <span>→</span>
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      {/* Back button */}
      <Link
        href={menuHref}
        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 transition"
      >
        <span>←</span>
        <span>Back to {outlet.shop_name} Menu</span>
      </Link>

      {/* Destination Header Card */}
      <div className="rounded-3xl border border-zinc-200/80 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="inline-flex rounded-full bg-orange-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-orange-600 border border-orange-100">
              Pickup Destination
            </span>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-zinc-950 sm:text-3xl">
              {outlet.shop_name}
            </h1>
            <p className="mt-1 text-xs text-zinc-500">
              {outlet.cafeteria_name} · <span className="text-zinc-400">{outlet.university_name}</span>
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={clearCart}
              className="rounded-full border border-zinc-200 px-4 py-2 text-xs font-bold text-zinc-600 hover:bg-zinc-50 transition"
            >
              Clear Cart
            </button>
            <Link
              href={menuHref}
              className="rounded-full bg-orange-50 px-4 py-2 text-xs font-bold text-orange-700 hover:bg-orange-100 transition"
            >
              + Add Items
            </Link>
          </div>
        </div>
      </div>

      {/* Cart items list */}
      <div className="rounded-3xl border border-zinc-200/80 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
          <h2 className="text-base font-bold text-zinc-950">
            Selected Items ({totalItemsCount})
          </h2>
          <span className="text-xs text-zinc-400">Cash on pickup</span>
        </div>

        <ul className="divide-y divide-zinc-100" role="list" aria-label="Cart items">
          {cart.items.map((item) => {
            const maxAllowed = Math.min(item.available_stock, item.max_quantity_per_order);
            const hasReachedMax = item.quantity >= maxAllowed;
            const imageUrl = resolveMenuItemImage(item);

            return (
              <li
                key={item.menu_item_id}
                className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                {/* Item Info */}
                <div className="flex items-center gap-3.5">
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-zinc-100 border border-zinc-200/80">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imageUrl}
                      alt={item.name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-zinc-950">{item.name}</h3>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-zinc-500">
                      <span>৳{item.price.toFixed(2)} each</span>
                      <span>·</span>
                      <span className="text-zinc-400">Max {item.max_quantity_per_order}/order</span>
                    </div>
                  </div>
                </div>

                {/* Stepper, Total & Remove */}
                <div className="flex items-center justify-between sm:justify-end sm:gap-6">
                  {/* Quantity Stepper */}
                  <div className="flex items-center gap-1 rounded-full border border-zinc-200 bg-white p-1 shadow-sm">
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.menu_item_id, -1)}
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-50 text-orange-700 hover:bg-orange-100 active:scale-90 transition"
                      aria-label={`Decrease ${item.name} quantity`}
                    >
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M5 12h14" />
                      </svg>
                    </button>

                    <span className="min-w-[1.75rem] text-center text-xs font-black text-zinc-950">
                      {item.quantity}
                    </span>

                    <button
                      type="button"
                      onClick={() => updateQuantity(item.menu_item_id, 1)}
                      disabled={hasReachedMax}
                      className={`flex h-7 w-7 items-center justify-center rounded-full transition active:scale-90 ${
                        hasReachedMax
                          ? "cursor-not-allowed bg-zinc-100 text-zinc-300"
                          : "bg-orange-600 text-white hover:bg-orange-700"
                      }`}
                      aria-label={`Increase ${item.name} quantity`}
                    >
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                    </button>
                  </div>

                  {/* Line Total */}
                  <div className="text-right min-w-[4.5rem]">
                    <span className="text-sm font-black text-zinc-950">
                      ৳{(item.price * item.quantity).toFixed(2)}
                    </span>
                  </div>

                  {/* Remove Item Button */}
                  <button
                    type="button"
                    onClick={() => removeItem(item.menu_item_id)}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 hover:bg-rose-50 hover:text-rose-600 transition"
                    aria-label={`Remove ${item.name} from cart`}
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" />
                    </svg>
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Summary and Checkout Card */}
      <div className="rounded-3xl border border-zinc-200/80 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-base font-bold text-zinc-950">Order Summary</h2>

        <div className="mt-4 space-y-2.5 border-b border-zinc-100 pb-4 text-xs text-zinc-600">
          <div className="flex justify-between">
            <span>Subtotal ({totalItemsCount} {totalItemsCount === 1 ? "item" : "items"})</span>
            <span className="font-bold text-zinc-900">৳{estimatedTotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Payment Method</span>
            <span className="font-bold text-zinc-900">Cash on Collection</span>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              Estimated Total
            </div>
            <div className="text-3xl font-black text-orange-600">
              ৳{estimatedTotal.toFixed(2)}
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href={menuHref}
              className="hidden sm:inline-block rounded-full border border-zinc-200 px-5 py-3 text-xs font-bold text-zinc-700 hover:bg-zinc-50"
            >
              Continue Browsing
            </Link>
            <Link
              href="/customer/checkout"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-orange-600 px-7 py-3.5 text-xs font-bold text-white shadow-md shadow-orange-600/20 hover:bg-orange-700 active:scale-95 transition"
            >
              <span>Review Order</span>
              <span>→</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
