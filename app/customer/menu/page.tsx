import Link from "next/link";
import { requireCustomer } from "@/lib/auth/session";
import {
  getApprovedCafeteria,
  getApprovedShop,
  getApprovedShops,
  getApprovedUniversity,
  getShopMenuItems,
  getSingleSearchParam,
} from "@/lib/customer/data";
import { CustomerMenuClient } from "./customer-menu-client";

type CustomerMenuPageProps = {
  searchParams: Promise<{
    universityId?: string | string[];
    cafeteriaId?: string | string[];
    shopId?: string | string[];
  }>;
};

export default async function CustomerMenuPage({ searchParams }: CustomerMenuPageProps) {
  await requireCustomer();
  const params = await searchParams;
  const selectedUniversityId = getSingleSearchParam(params.universityId);
  const selectedCafeteriaId = getSingleSearchParam(params.cafeteriaId);
  const selectedShopId = getSingleSearchParam(params.shopId);

  if (!selectedUniversityId || !selectedCafeteriaId || !selectedShopId) {
    return (
      <main className="min-h-screen bg-[#FAF9F6] px-4 py-12 sm:px-6 lg:px-8">
        <section className="mx-auto max-w-xl rounded-3xl border border-zinc-200/80 bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-black text-zinc-950">Select a sales point first</h1>
          <p className="mt-2 text-sm text-zinc-500">
            A valid university, cafeteria, and sales point must be selected to view a menu.
          </p>
          <Link
            href="/customer/university"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-orange-600 px-6 py-3 text-xs font-bold text-white shadow-sm hover:bg-orange-700"
          >
            <span>Start Selection</span>
            <span>→</span>
          </Link>
        </section>
      </main>
    );
  }

  // Hierarchy validation: shop belongs to cafeteria, cafeteria belongs to university
  const university = await getApprovedUniversity(selectedUniversityId);
  const cafeteria = await getApprovedCafeteria(selectedCafeteriaId, university.id);
  const shop = await getApprovedShop(selectedShopId, cafeteria.id);

  // Check sibling shops count to decide back button navigation target
  const { data: siblingShops } = await getApprovedShops(cafeteria.id);
  const backHref =
    siblingShops.length > 1
      ? `/customer/shop?universityId=${encodeURIComponent(university.id)}&cafeteriaId=${encodeURIComponent(cafeteria.id)}`
      : `/customer/cafeteria?universityId=${encodeURIComponent(university.id)}`;
  const backLabel =
    siblingShops.length > 1 ? "← Back to Sales Points" : "← Back to Cafeteria";

  // Outlet-scoped menu query
  const { data: menuItems, error: menuError } = await getShopMenuItems(shop.id);

  return (
    <main className="min-h-screen bg-[#FAF9F6] px-4 py-6 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-5xl space-y-6">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 transition"
        >
          <span>{backLabel}</span>
        </Link>

        {/* Shop Header Card */}
        <div className="rounded-3xl border border-zinc-200/80 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex rounded-full bg-orange-50 px-2.5 py-0.5 text-[11px] font-bold tracking-wide uppercase text-orange-600 border border-orange-100">
                  Live Menu
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Open for Ordering
                </span>
              </div>
              <h1 className="mt-2 text-2xl font-black tracking-tight text-zinc-950 sm:text-3xl">
                {shop.name}
              </h1>
              <p className="mt-1 text-xs font-medium text-zinc-500">
                {cafeteria.name} · <span className="text-zinc-400">{university.name}</span>
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-100 bg-zinc-50/80 px-4 py-3 text-right sm:text-left">
              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Sales Point</div>
              <div className="text-sm font-extrabold text-zinc-900">{shop.name}</div>
            </div>
          </div>

          {shop.description ? (
            <p className="mt-4 max-w-2xl text-xs leading-5 text-zinc-600 border-t border-zinc-100 pt-3">
              {shop.description}
            </p>
          ) : null}
        </div>

        {/* Error Alert */}
        {menuError ? (
          <div role="alert" className="rounded-2xl bg-rose-50 border border-rose-100 p-4 text-xs font-medium text-rose-800">
            {menuError}
          </div>
        ) : null}

        {/* Interactive Menu List */}
        {!menuError ? (
          <CustomerMenuClient
            items={menuItems}
            shopId={shop.id}
            shopName={shop.name}
            cafeteriaId={cafeteria.id}
            cafeteriaName={cafeteria.name}
            universityId={university.id}
            universityName={university.name}
          />
        ) : null}
      </section>
    </main>
  );
}
