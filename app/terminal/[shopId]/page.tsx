import { requireTerminalShop } from "@/lib/auth/session";
import { getTerminalDashboardData } from "@/lib/terminal/data";
import { TerminalDashboardClient } from "./terminal-dashboard-client";

type ShopTerminalPageProps = {
  params: Promise<{ shopId: string }>;
};

export default async function ShopTerminalPage({ params }: ShopTerminalPageProps) {
  const { shopId } = await params;
  await requireTerminalShop(shopId);

  const { shopDetails, orders, terminalDisplayName } = await getTerminalDashboardData(shopId);

  return (
    <TerminalDashboardClient
      shopDetails={shopDetails}
      orders={orders}
      terminalDisplayName={terminalDisplayName}
    />
  );
}
