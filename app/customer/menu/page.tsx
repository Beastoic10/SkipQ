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
      <main className="min-h-screen bg-orange-50 px-4 py-6 sm:px-6 lg:px-8">
        <section className="mx-auto max-w-3xl rounded-[2rem] border border-orange-100 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-3xl font-bold text-zinc-950">Select a sales point first</h1>
          <p className="mt-3 text-zinc-600">
            A valid university, cafeteria, and sales point must be selected to view a menu.
          </p>
          <Link
            href="/customer/university"
            className="mt-6 inline-flex rounded-full bg-orange-600 px-5 py-3 font-semibold text-white hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-600 focus:ring-offset-2"
          >
            Start selection
          </Link>
        </section>
      </main>
    );
  }

  // Hierarchy validation: shop belongs to cafeteria, cafeteria belongs to university, and all are active & approved
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
    siblingShops.length > 1 ? "← Back to sales points" : "← Back to cafeterias";

  // Outlet-scoped menu query
  const { data: menuItems, error: menuError } = await getShopMenuItems(shop.id);

  return (
    <main className="min-h-screen bg-orange-50 px-4 py-6 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-5xl space-y-6">
        <Link
          href={backHref}
          className="inline-flex rounded-full px-3 py-2 text-sm font-semibold text-orange-700 hover:bg-orange-100 focus:outline-none focus:ring-2 focus:ring-orange-600"
        >
          {backLabel}
        </Link>

        {/* Shop Header Card */}
        <div className="rounded-[2rem] border border-orange-100 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-700">
                  Sales Point Menu
                </span>
                <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                  Open
                </span>
              </div>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-zinc-950 sm:text-4xl">
                {shop.name}
              </h1>
              <p className="mt-1 text-sm font-medium text-zinc-600">
                {cafeteria.name} · <span className="text-zinc-500">{university.name}</span>
              </p>
            </div>

            <div className="rounded-2xl border border-orange-100 bg-orange-50/60 px-4 py-3 text-right sm:text-left">
              <div className="text-xs text-zinc-500">Location</div>
              <div className="text-sm font-semibold text-zinc-900">{shop.name}</div>
            </div>
          </div>

          {shop.description ? (
            <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-700 border-t border-orange-50 pt-4">
              {shop.description}
            </p>
          ) : null}
        </div>

        {/* Error Alert */}
        {menuError ? (
          <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {menuError}
          </p>
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
