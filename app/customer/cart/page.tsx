import { requireCustomer } from "@/lib/auth/session";
import { CartClient } from "./cart-client";

export default async function CustomerCartPage() {
  await requireCustomer();

  return (
    <main className="min-h-screen bg-orange-50/60 px-4 py-6 sm:px-6 lg:px-8">
      <CartClient />
    </main>
  );
}
