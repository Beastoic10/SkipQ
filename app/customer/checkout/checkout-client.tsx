"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCart } from "@/lib/customer/cart-context";
import { validateCartAction, placeCashOrderAction, type CartValidationResult } from "@/lib/customer/actions";

export function CheckoutClient() {
  const router = useRouter();
  const { cart, isLoaded, clearCart } = useCart();

  const [validationState, setValidationState] = useState<{
    isLoading: boolean;
    result: CartValidationResult | null;
    error: string | null;
  }>({
    isLoading: true,
    result: null,
    error: null,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    if (!cart.outlet || cart.items.length === 0) {
      return;
    }

    let isCancelled = false;

    const executeValidation = async () => {
      try {
        const result = await validateCartAction(
          cart.outlet!.shop_id,
          cart.items.map((i) => ({ menu_item_id: i.menu_item_id, quantity: i.quantity }))
        );

        if (isCancelled) return;

        if (result.valid) {
          setValidationState({
            isLoading: false,
            result,
            error: null,
          });
        } else {
          const firstItemError = Object.values(result.itemErrors)[0];
          setValidationState({
            isLoading: false,
            result,
            error: result.generalError || firstItemError || "Cart validation failed.",
          });
        }
      } catch {
        if (!isCancelled) {
          setValidationState({
            isLoading: false,
            result: null,
            error: "Unable to verify cart with server. Please try again.",
          });
        }
      }
    };

    executeValidation();

    return () => {
      isCancelled = true;
    };
  }, [isLoaded, cart.outlet, cart.items]);

  const handleConfirmOrder = async () => {
    if (isSubmitting || !cart.outlet || cart.items.length === 0) return;

    setIsSubmitting(true);
    setSubmissionError(null);

    try {
      const orderItems = cart.items.map((i) => ({
        menu_item_id: i.menu_item_id,
        quantity: i.quantity,
      }));

      const res = await placeCashOrderAction(cart.outlet.shop_id, orderItems);

      if (res.success) {
        // Securely store the collection token locally for QR display
        try {
          localStorage.setItem(`skipq_qr_${res.orderId}`, res.collectionToken);
          sessionStorage.setItem(`skipq_qr_${res.orderId}`, res.collectionToken);
        } catch {
          // Local storage quota or security policy
        }

        // Clear cart immediately upon successful placement
        clearCart();

        // Redirect to order details & QR screen
        router.push(`/customer/orders/${res.orderId}`);
      } else {
        setSubmissionError(res.error);
        setIsSubmitting(false);
      }
    } catch {
      setSubmissionError("Network error while submitting order. Please check your connection and retry.");
      setIsSubmitting(false);
    }
  };

  if (!isLoaded || (cart.items.length > 0 && validationState.isLoading)) {
    return (
      <div className="mx-auto max-w-3xl py-12 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-orange-600 border-t-transparent" />
        <p className="mt-3 text-sm font-medium text-zinc-600">Verifying live prices and stock with cafeteria...</p>
      </div>
    );
  }

  if (cart.items.length === 0 || !cart.outlet) {
    return (
      <section className="mx-auto max-w-3xl rounded-[2rem] border border-orange-100 bg-white p-8 text-center shadow-sm sm:p-12">
        <h1 className="text-2xl font-bold text-zinc-950">No items to checkout</h1>
        <p className="mt-2 text-sm text-zinc-600">Your cart is currently empty. Add items from a cafeteria menu first.</p>
        <Link
          href="/customer/university"
          className="mt-6 inline-flex rounded-full bg-orange-600 px-6 py-3 text-sm font-semibold text-white hover:bg-orange-700"
        >
          Browse Menus
        </Link>
      </section>
    );
  }

  const { result } = validationState;
  const isCartValid = result?.valid === true;

  return (
    <section className="mx-auto max-w-4xl space-y-6">
      <Link
        href="/customer/cart"
        className="inline-flex rounded-full px-3 py-2 text-sm font-semibold text-orange-700 hover:bg-orange-100 focus:outline-none focus:ring-2 focus:ring-orange-600"
      >
        ← Edit Cart
      </Link>

      {/* Header */}
      <div className="rounded-[2rem] border border-orange-100 bg-white p-6 shadow-sm sm:p-8">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-700">
          Order Confirmation
        </span>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-950 sm:text-3xl">
          Review & Confirm Order
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          Please confirm your selected food items, pickup sales point, and cash payment.
        </p>

        {/* Pickup Location Details */}
        <div className="mt-6 rounded-2xl border border-orange-100 bg-orange-50/60 p-4 sm:p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-orange-800">
            Pickup Destination
          </div>
          <div className="mt-1 text-lg font-bold text-zinc-950">
            {cart.outlet.shop_name}
          </div>
          <div className="text-sm text-zinc-600">
            {cart.outlet.cafeteria_name} · <span className="text-zinc-500">{cart.outlet.university_name}</span>
          </div>
        </div>
      </div>

      {/* Validation Error Banner */}
      {!isCartValid && validationState.error ? (
        <div
          role="alert"
          className="rounded-[2rem] border border-rose-200 bg-rose-50 p-6 text-rose-900 shadow-sm"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-200 font-bold text-rose-800">
              !
            </div>
            <div>
              <h3 className="text-base font-bold">Cart Items Need Attention</h3>
              <p className="mt-1 text-sm text-rose-700">
                {validationState.error}
              </p>
              <div className="mt-4">
                <Link
                  href="/customer/cart"
                  className="inline-flex rounded-full bg-rose-700 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-rose-800"
                >
                  Return to Cart to Fix
                </Link>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Submission Error Banner */}
      {submissionError ? (
        <div
          role="alert"
          className="rounded-[2rem] border border-rose-200 bg-rose-50 p-6 text-rose-900 shadow-sm"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-200 font-bold text-rose-800">
              !
            </div>
            <div>
              <h3 className="text-base font-bold">Could Not Place Order</h3>
              <p className="mt-1 text-sm text-rose-700">{submissionError}</p>
            </div>
          </div>
        </div>
      ) : null}

      {/* Items Breakdown Card */}
      <div className="rounded-[2rem] border border-orange-100 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-bold text-zinc-950">Ordered Items</h2>

        <ul className="mt-4 divide-y divide-orange-50" role="list">
          {isCartValid && result ? (
            result.items.map((item) => (
              <li key={item.menu_item_id} className="flex items-center justify-between py-3.5">
                <div>
                  <div className="text-sm font-bold text-zinc-950">{item.name}</div>
                  <div className="text-xs text-zinc-500">
                    ৳{item.price.toFixed(2)} × {item.quantity}
                  </div>
                </div>
                <div className="text-sm font-bold text-zinc-950">
                  ৳{item.line_total.toFixed(2)}
                </div>
              </li>
            ))
          ) : (
            cart.items.map((item) => {
              const itemErr = result && "itemErrors" in result ? result.itemErrors[item.menu_item_id] : null;

              return (
                <li key={item.menu_item_id} className="flex flex-col gap-1 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-bold text-zinc-950">{item.name}</div>
                    <div className="text-xs text-zinc-500">
                      ৳{item.price.toFixed(2)} × {item.quantity}
                    </div>
                    {itemErr ? (
                      <span className="mt-1 inline-block rounded-md bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-800">
                        {itemErr}
                      </span>
                    ) : null}
                  </div>
                  <div className="text-sm font-bold text-zinc-950">
                    ৳{(item.price * item.quantity).toFixed(2)}
                  </div>
                </li>
              );
            })
          )}
        </ul>

        {/* Total calculation */}
        <div className="mt-6 border-t border-orange-100 pt-4">
          <div className="flex items-baseline justify-between">
            <span className="text-base font-bold text-zinc-950">Authoritative Order Total</span>
            <span className="text-2xl font-black text-orange-600 sm:text-3xl">
              ৳{(isCartValid && result ? result.totalAmount : cart.items.reduce((s, i) => s + i.price * i.quantity, 0)).toFixed(2)}
            </span>
          </div>
          <span className="text-xs text-zinc-500">Currency: BDT</span>
        </div>
      </div>

      {/* Payment Method Card */}
      <div className="rounded-[2rem] border border-orange-100 bg-white p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-bold text-zinc-950">Payment Method</h2>

        <div className="mt-4 rounded-2xl border-2 border-orange-500 bg-orange-50/70 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-600 text-white font-bold">
                ৳
              </div>
              <div>
                <div className="text-base font-bold text-zinc-950">Cash on Collection</div>
                <div className="text-xs text-zinc-600">
                  Pay cash at the physical counter when collecting your food.
                </div>
              </div>
            </div>

            <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">
              Selected
            </span>
          </div>
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-xl bg-orange-50/40 p-3 text-xs text-zinc-600">
          <svg className="h-4 w-4 shrink-0 text-orange-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="10" r="10" />
            <path d="M12 16v-4M12 8h.01" />
          </svg>
          <span>
            Upon placing the order, you will immediately receive a digital <strong>Collection QR Code</strong> to present to the cafeteria staff.
          </span>
        </div>
      </div>

      {/* Action Button */}
      <div className="rounded-[2rem] border border-orange-100 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-zinc-500">
            Clicking Confirm Order consumes inventory and creates your order immediately.
          </div>

          <button
            type="button"
            onClick={handleConfirmOrder}
            disabled={!isCartValid || isSubmitting}
            className={`inline-flex items-center justify-center gap-2 rounded-full px-8 py-4 text-base font-bold text-white shadow-md transition focus:outline-none focus:ring-2 focus:ring-orange-600 focus:ring-offset-2 ${
              !isCartValid || isSubmitting
                ? "cursor-not-allowed bg-zinc-300 text-zinc-500 shadow-none"
                : "bg-orange-600 hover:bg-orange-700 active:scale-98"
            }`}
          >
            {isSubmitting ? (
              <>
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>Creating Order...</span>
              </>
            ) : (
              <>
                <span>Confirm Order (CASH)</span>
                <span>✓</span>
              </>
            )}
          </button>
        </div>
      </div>
    </section>
  );
}
