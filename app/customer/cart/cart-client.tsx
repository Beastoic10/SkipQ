"use client";

import Link from "next/link";
import { useCart } from "@/lib/customer/cart-context";

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
      <div className="mx-auto max-w-3xl py-12 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-orange-600 border-t-transparent" />
        <p className="mt-3 text-sm text-zinc-500">Loading your cart...</p>
      </div>
    );
  }

  const outlet = cart.outlet;

  const menuHref = outlet
    ? `/customer/menu?universityId=${encodeURIComponent(outlet.university_id)}&cafeteriaId=${encodeURIComponent(outlet.cafeteria_id)}&shopId=${encodeURIComponent(outlet.shop_id)}`
    : "/customer/university";

  if (cart.items.length === 0 || !outlet) {
    return (
      <section className="mx-auto max-w-3xl rounded-[2rem] border border-orange-100 bg-white p-8 text-center shadow-sm sm:p-12">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-orange-100 text-orange-600">
          <svg className="h-10 w-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
            <path d="M3 6h18" />
            <path d="M16 10a4 4 0 0 1-8 0" />
          </svg>
        </div>

        <h1 className="mt-5 text-2xl font-bold tracking-tight text-zinc-950 sm:text-3xl">
          Your Cart is Empty
        </h1>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          You haven&apos;t added any food items yet. Browse your campus cafeteria menus to start your order.
        </p>

        <div className="mt-8">
          <Link
            href="/customer/university"
            className="inline-flex items-center gap-2 rounded-full bg-orange-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-600 focus:ring-offset-2"
          >
            <span>Explore Cafeterias</span>
            <span>→</span>
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-4xl space-y-6">
      {/* Back button */}
      <Link
        href={menuHref}
        className="inline-flex rounded-full px-3 py-2 text-sm font-semibold text-orange-700 hover:bg-orange-100 focus:outline-none focus:ring-2 focus:ring-orange-600"
      >
        ← Back to {outlet.shop_name} Menu
      </Link>

      {/* Outlet header card */}
      <div className="rounded-[2rem] border border-orange-100 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-700">
              Order Destination
            </span>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-950 sm:text-3xl">
              {outlet.shop_name}
            </h1>
            <p className="mt-1 text-sm font-medium text-zinc-600">
              {outlet.cafeteria_name} · <span className="text-zinc-500">{outlet.university_name}</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={clearCart}
              className="rounded-full border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            >
              Clear Cart
            </button>
            <Link
              href={menuHref}
              className="rounded-full bg-orange-50 px-4 py-2 text-xs font-semibold text-orange-800 hover:bg-orange-100 focus:outline-none focus:ring-2 focus:ring-orange-600"
            >
              + Add More Items
            </Link>
          </div>
        </div>
      </div>

      {/* Cart items list */}
      <div className="rounded-[2rem] border border-orange-100 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex items-center justify-between border-b border-orange-100 pb-4">
          <h2 className="text-lg font-bold text-zinc-950">
            Selected Items ({totalItemsCount})
          </h2>
          <span className="text-xs text-zinc-500">Single sales point order</span>
        </div>

        <ul className="divide-y divide-orange-50" role="list" aria-label="Cart items">
          {cart.items.map((item) => {
            const maxAllowed = Math.min(item.available_stock, item.max_quantity_per_order);
            const hasReachedMax = item.quantity >= maxAllowed;

            return (
              <li
                key={item.menu_item_id}
                className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between"
              >
                {/* Item Info */}
                <div className="flex items-center gap-4">
                  {/* Thumbnail */}
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-orange-50 border border-orange-100">
                    {item.image_path ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.image_path}
                        alt={item.name}
                        className="h-full w-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                          e.currentTarget.parentElement?.querySelector(".cart-fallback")?.classList.remove("hidden");
                        }}
                      />
                    ) : null}
                    <div
                      className={`cart-fallback flex h-full w-full items-center justify-center text-orange-400 ${
                        item.image_path ? "hidden" : ""
                      }`}
                    >
                      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8Z" />
                      </svg>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-zinc-950">{item.name}</h3>
                    <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
                      <span>৳{item.price.toFixed(2)} each</span>
                      <span>·</span>
                      <span className="text-zinc-400">Max {item.max_quantity_per_order}/order</span>
                    </div>
                  </div>
                </div>

                {/* Quantity Controls & Line Total */}
                <div className="flex items-center justify-between sm:justify-end sm:gap-6">
                  {/* Quantity selector */}
                  <div className="flex items-center gap-1 rounded-full border border-orange-200 bg-white p-1 shadow-sm">
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.menu_item_id, -1)}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-50 text-orange-700 transition hover:bg-orange-100 active:scale-95 focus:outline-none focus:ring-2 focus:ring-orange-500"
                      aria-label={`Decrease quantity of ${item.name}`}
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M5 12h14" />
                      </svg>
                    </button>

                    <span className="min-w-[2rem] text-center text-sm font-bold text-zinc-950" aria-live="polite">
                      {item.quantity}
                    </span>

                    <button
                      type="button"
                      onClick={() => updateQuantity(item.menu_item_id, 1)}
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

                  {/* Line Total */}
                  <div className="text-right min-w-[5rem]">
                    <div className="text-base font-bold text-zinc-950">
                      ৳{(item.price * item.quantity).toFixed(2)}
                    </div>
                  </div>

                  {/* Remove Button */}
                  <button
                    type="button"
                    onClick={() => removeItem(item.menu_item_id)}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 hover:bg-red-50 hover:text-rose-600 transition focus:outline-none focus:ring-2 focus:ring-rose-500"
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
      <div className="rounded-[2rem] border border-orange-100 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-bold text-zinc-950">Order Summary</h2>

        <div className="mt-4 space-y-3 border-b border-orange-50 pb-4 text-sm text-zinc-600">
          <div className="flex justify-between">
            <span>Items Subtotal ({totalItemsCount} items)</span>
            <span className="font-semibold text-zinc-900">৳{estimatedTotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-xs text-zinc-500">
            <span>Payment Method</span>
            <span className="font-semibold text-zinc-800">Cash on Collection</span>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Estimated Total
            </div>
            <div className="text-2xl font-black text-orange-600 sm:text-3xl">
              ৳{estimatedTotal.toFixed(2)}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href={menuHref}
              className="hidden rounded-full border border-zinc-200 px-5 py-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-400 sm:inline-block"
            >
              Continue Browsing
            </Link>
            <Link
              href="/customer/checkout"
              className="inline-flex items-center gap-2 rounded-full bg-orange-600 px-7 py-3.5 text-sm font-bold text-white shadow-md transition hover:bg-orange-700 active:scale-98 focus:outline-none focus:ring-2 focus:ring-orange-600 focus:ring-offset-2"
            >
              <span>Proceed to Confirmation</span>
              <span>→</span>
            </Link>
          </div>
        </div>

        <p className="mt-4 text-[11px] text-zinc-400">
          * Prices and live availability will be verified directly with the server database before order placement.
        </p>
      </div>
    </section>
  );
}
