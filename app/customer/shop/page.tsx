import Link from "next/link";
import { redirect } from "next/navigation";
import { requireCustomer } from "@/lib/auth/session";
import { getApprovedCafeteria, getApprovedShops, getApprovedUniversity, getSingleSearchParam } from "@/lib/customer/data";

type ShopSelectionPageProps = {
  searchParams: Promise<{
    universityId?: string | string[];
    cafeteriaId?: string | string[];
    shopId?: string | string[];
  }>;
};

export default async function ShopSelectionPage({ searchParams }: ShopSelectionPageProps) {
  await requireCustomer();
  const params = await searchParams;
  const selectedUniversityId = getSingleSearchParam(params.universityId);
  const selectedCafeteriaId = getSingleSearchParam(params.cafeteriaId);
  const selectedShopId = getSingleSearchParam(params.shopId);

  if (!selectedUniversityId || !selectedCafeteriaId) {
    return (
      <main className="min-h-screen bg-[#FAF9F6] px-4 py-12 sm:px-6 lg:px-8">
        <section className="mx-auto max-w-xl rounded-3xl border border-zinc-200/80 bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-black text-zinc-950">Choose a cafeteria first</h1>
          <p className="mt-2 text-sm text-zinc-500">A university and cafeteria selection are required before sales points can be shown.</p>
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

  const university = await getApprovedUniversity(selectedUniversityId);
  const cafeteria = await getApprovedCafeteria(selectedCafeteriaId, university.id);

  // If a specific shop/sales-point ID was supplied, direct to the menu
  if (selectedShopId) {
    redirect(`/customer/menu?universityId=${encodeURIComponent(university.id)}&cafeteriaId=${encodeURIComponent(cafeteria.id)}&shopId=${encodeURIComponent(selectedShopId)}`);
  }

  const { data: shops, error } = await getApprovedShops(cafeteria.id);

  // Single Outlet: immediately navigate directly to that shop's menu
  if (!error && shops.length === 1) {
    redirect(`/customer/menu?universityId=${encodeURIComponent(university.id)}&cafeteriaId=${encodeURIComponent(cafeteria.id)}&shopId=${encodeURIComponent(shops[0].id)}`);
  }

  return (
    <main className="min-h-screen bg-[#FAF9F6] px-4 py-8 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-2xl space-y-6">
        <Link
          href={`/customer/cafeteria?universityId=${encodeURIComponent(university.id)}`}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 transition"
        >
          <span>←</span>
          <span>Back to Cafeterias</span>
        </Link>

        <div className="rounded-3xl border border-zinc-200/80 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-center gap-2">
            <span className="inline-flex rounded-full bg-orange-50 px-3 py-1 text-xs font-bold tracking-wide uppercase text-orange-600 border border-orange-100">
              Step 3 of 3 · Sales Point
            </span>
          </div>

          <h1 className="mt-3 text-2xl font-black tracking-tight text-zinc-950 sm:text-3xl">
            Choose a Sales Point
          </h1>
          <p className="mt-1.5 text-sm text-zinc-500">
            Available counters and stalls inside <strong className="text-zinc-800">{cafeteria.name}</strong> at {university.name}.
          </p>

          <div className="mt-6">
            {error ? (
              <div role="alert" className="rounded-2xl bg-rose-50 border border-rose-100 p-4 text-xs font-medium text-rose-800">
                {error}
              </div>
            ) : null}

            {!error && shops.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-200 p-8 text-center text-sm text-zinc-500">
                No active sales points are available for this cafeteria right now.
                <div className="mt-4">
                  <Link
                    href={`/customer/cafeteria?universityId=${encodeURIComponent(university.id)}`}
                    className="inline-flex rounded-full bg-orange-50 px-4 py-2 text-xs font-bold text-orange-700 hover:bg-orange-100"
                  >
                    Choose another cafeteria
                  </Link>
                </div>
              </div>
            ) : null}

            {!error && shops.length > 1 ? (
              <ul className="grid gap-3.5" aria-label={`Available sales points for ${cafeteria.name}`}>
                {shops.map((shop) => (
                  <li key={shop.id}>
                    <Link
                      href={`/customer/menu?universityId=${encodeURIComponent(university.id)}&cafeteriaId=${encodeURIComponent(cafeteria.id)}&shopId=${encodeURIComponent(shop.id)}`}
                      className="group flex flex-col justify-between rounded-2xl border border-zinc-200/80 bg-white p-5 transition hover:border-orange-300 hover:bg-orange-50/40 hover:shadow-sm"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-base font-bold text-zinc-950 group-hover:text-orange-950">{shop.name}</span>
                          <span className="inline-flex rounded-full bg-emerald-50 border border-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                            Open
                          </span>
                        </div>
                        {shop.description ? (
                          <p className="mt-2 text-xs leading-5 text-zinc-500">{shop.description}</p>
                        ) : null}
                      </div>
                      <div className="mt-4 flex items-center justify-end">
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-orange-600 group-hover:text-orange-700">
                          <span>Browse Menu</span>
                          <span className="transition-transform group-hover:translate-x-0.5">→</span>
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
