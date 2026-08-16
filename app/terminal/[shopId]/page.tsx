import { LogoutButton } from "@/app/auth/logout-button";
import { requireShopStaff } from "@/lib/auth/session";

type ShopTerminalPageProps = {
  params: Promise<{ shopId: string }>;
};

export default async function ShopTerminalPage({ params }: ShopTerminalPageProps) {
  const { shopId } = await params;
  const context = await requireShopStaff(shopId);

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-white">
      <section className="mx-auto max-w-3xl rounded-3xl bg-white p-8 text-zinc-950 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-700">Terminal shop</p>
            <h1 className="mt-2 text-3xl font-bold">Shop membership verified</h1>
            <p className="mt-3 text-zinc-600">Protected shop route for {shopId}. Terminal operations will be added later.</p>
            <p className="mt-4 text-sm text-zinc-500">Signed in as {context.email ?? context.userId}</p>
          </div>
          <LogoutButton />
        </div>
      </section>
    </main>
  );
}
