import { requireCustomer } from "@/lib/auth/session";
import { getCustomerOrderDetails } from "@/lib/customer/orders";
import { OrderQRClient } from "./order-qr-client";

type OrderPageProps = {
  params: Promise<{
    orderId: string;
  }>;
};

export default async function CustomerOrderPage({ params }: OrderPageProps) {
  await requireCustomer();
  const { orderId } = await params;

  const order = await getCustomerOrderDetails(orderId);

  return (
    <main className="min-h-screen bg-[#FAF9F6] px-4 py-8 sm:px-6 lg:px-8">
      <OrderQRClient order={order} />
    </main>
  );
}
