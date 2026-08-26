"use client";

import Link from "next/link";
import { useCart } from "@/lib/customer/cart-context";
import { LogoutButton } from "@/app/auth/logout-button";

type CustomerHeaderProps = {
  displayName: string;
};

export function CustomerHeader({ displayName }: CustomerHeaderProps) {
  const { totalItemsCount, cart } = useCart();

  return (
    <header className="sticky top-0 z-30 border-b border-orange-100 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        {/* Brand & Home Link */}
        <div className="flex items-center gap-3">
          <Link
            href="/customer"
            className="flex items-center gap-2 rounded-full focus:outline-none focus:ring-2 focus:ring-orange-600 focus:ring-offset-2"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-600 font-bold text-white shadow-sm">
              Q
            </div>
            <div className="flex flex-col">
              <span className="text-base font-extrabold tracking-tight text-zinc-950">
                Skip<span className="text-orange-600">Q</span>
              </span>
              <span className="hidden text-[10px] font-semibold uppercase tracking-wider text-orange-700 sm:block">
                Campus Food
              </span>
            </div>
          </Link>
        </div>

        {/* Right navigation: Cart & User profile / Logout */}
        <div className="flex items-center gap-3">
          {/* Active Outlet indicator if cart has items */}
          {cart.outlet && totalItemsCount > 0 ? (
            <span className="hidden text-xs font-medium text-zinc-500 md:inline-block">
              Ordering from: <span className="font-semibold text-zinc-800">{cart.outlet.shop_name}</span>
            </span>
          ) : null}

          {/* Cart Icon Link */}
          <Link
            href="/customer/cart"
            className={`relative flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-orange-600 focus:ring-offset-2 ${
              totalItemsCount > 0
                ? "bg-orange-600 text-white shadow-sm hover:bg-orange-700 active:scale-95"
                : "bg-orange-50 text-orange-800 hover:bg-orange-100"
            }`}
            aria-label={`Shopping cart with ${totalItemsCount} items`}
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
              <path d="M3 6h18" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
            <span className="hidden sm:inline">Cart</span>
            {totalItemsCount > 0 ? (
              <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-white px-1.5 text-xs font-bold text-orange-600">
                {totalItemsCount}
              </span>
            ) : null}
          </Link>

          {/* User Display & Logout */}
          <div className="hidden items-center gap-2 text-xs font-medium text-zinc-600 sm:flex">
            <span className="max-w-[120px] truncate">{displayName}</span>
          </div>
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
