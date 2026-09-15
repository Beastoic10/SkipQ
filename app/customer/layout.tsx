import { Suspense } from "react";
import { requireCustomer } from "@/lib/auth/session";
import { CartProvider } from "@/lib/customer/cart-context";
import { CustomerHeader } from "./customer-header";
import { ActiveOrderBanner } from "./active-order-banner";
import { ChatAgent } from "./chat-agent";

export default async function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const context = await requireCustomer();
  const displayName = context.profile?.display_name ?? context.email ?? "Customer";

  return (
    <CartProvider>
      <div className="min-h-screen bg-[#FAF9F6]">
        <CustomerHeader displayName={displayName} />
        {children}
        <ActiveOrderBanner />
        <Suspense fallback={null}>
          <ChatAgent />
        </Suspense>
      </div>
    </CartProvider>
  );
}

