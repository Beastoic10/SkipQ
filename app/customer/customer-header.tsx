"use client";

import Link from "next/link";
import { useCart } from "@/lib/customer/cart-context";
import { LogoutButton } from "@/app/auth/logout-button";

type CustomerHeaderProps = {
  displayName: string;
};

export function CustomerHeader({ displayName }: CustomerHeaderProps) {
  const { totalItemsCount, cart } = useCart();
  const firstName = displayName.includes(" ") ? displayName.split(" ")[0] : displayName;

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200/70 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        {/* Brand */}
        <Link
          href="/customer"
          className="group flex items-center gap-2.5 rounded-full focus:outline-none focus:ring-2 focus:ring-orange-600 focus:ring-offset-2"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-orange-600 font-black text-white shadow-sm shadow-orange-600/30 transition group-hover:scale-105">
            Q
          </div>
          <span className="text-lg font-black tracking-tight text-zinc-950">
            Skip<span className="text-orange-600">Q</span>
          </span>
        </Link>

        {/* Center / Outlet indicator */}
        {cart.outlet && totalItemsCount > 0 ? (
          <div className="hidden md:flex items-center gap-1.5 rounded-full bg-orange-50 border border-orange-100/80 px-3 py-1 text-xs font-semibold text-orange-900">
            <span className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse" />
            <span className="text-zinc-500">Ordering from</span>
            <span className="font-bold text-zinc-900">{cart.outlet.shop_name}</span>
          </div>
        ) : null}

        {/* Right side actions */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Cart Button */}
          <Link
            href="/customer/cart"
            className={`relative inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-bold transition focus:outline-none focus:ring-2 focus:ring-orange-600 focus:ring-offset-2 ${
              totalItemsCount > 0
                ? "bg-orange-600 text-white pill-shadow hover:bg-orange-700 active:scale-95"
                : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
            }`}
            aria-label={`Cart with ${totalItemsCount} ${totalItemsCount === 1 ? "item" : "items"}`}
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
              <path d="M3 6h18" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
            <span className="hidden sm:inline">Cart</span>
            {totalItemsCount > 0 ? (
              <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-white px-1.5 text-[11px] font-black text-orange-600">
                {totalItemsCount}
              </span>
            ) : null}
          </Link>

          {/* User profile chip */}
          <div className="hidden sm:flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-700">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-orange-600 text-[10px] font-black text-white">
              {firstName.charAt(0).toUpperCase()}
            </span>
            <span className="max-w-[110px] truncate">{firstName}</span>
          </div>

          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
