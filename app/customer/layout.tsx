import { requireCustomer } from "@/lib/auth/session";
import { CartProvider } from "@/lib/customer/cart-context";
import { CustomerHeader } from "./customer-header";

export default async function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const context = await requireCustomer();
  const displayName = context.profile?.display_name ?? context.email ?? "Customer";

  return (
    <CartProvider>
      <div className="min-h-screen bg-orange-50/50">
        <CustomerHeader displayName={displayName} />
        {children}
      </div>
    </CartProvider>
  );
}
