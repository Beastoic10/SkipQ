import { requireCustomer } from "@/lib/auth/session";
import { CheckoutClient } from "./checkout-client";

export default async function CustomerCheckoutPage() {
  await requireCustomer();

  return (
    <main className="min-h-screen bg-orange-50/60 px-4 py-6 sm:px-6 lg:px-8">
      <CheckoutClient />
    </main>
  );
}
