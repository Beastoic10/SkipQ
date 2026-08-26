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
      <main className="min-h-screen bg-orange-50 px-4 py-6 sm:px-6 lg:px-8">
        <section className="mx-auto max-w-3xl rounded-[2rem] border border-orange-100 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-3xl font-bold text-zinc-950">Choose a cafeteria first</h1>
          <p className="mt-3 text-zinc-600">A university and cafeteria selection are required before sales points can be shown.</p>
          <Link href="/customer/university" className="mt-6 inline-flex rounded-full bg-orange-600 px-5 py-3 font-semibold text-white hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-600 focus:ring-offset-2">Start selection</Link>
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

  // A1. Single Outlet: immediately navigate directly to that shop's menu
  if (!error && shops.length === 1) {
    redirect(`/customer/menu?universityId=${encodeURIComponent(university.id)}&cafeteriaId=${encodeURIComponent(cafeteria.id)}&shopId=${encodeURIComponent(shops[0].id)}`);
  }

  // A2 & A3. Multiple Outlets or Zero Outlets display
  return (
    <main className="min-h-screen bg-orange-50 px-4 py-6 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-5xl space-y-6">
        <Link href={`/customer/cafeteria?universityId=${encodeURIComponent(university.id)}`} className="inline-flex rounded-full px-3 py-2 text-sm font-semibold text-orange-700 hover:bg-orange-100 focus:outline-none focus:ring-2 focus:ring-orange-600">← Back to cafeterias</Link>
        <div className="rounded-[2rem] border border-orange-100 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-700">Step 3 of 3</p>
          <h1 className="mt-3 text-3xl font-bold text-zinc-950">Choose a Sales Point</h1>
          <p className="mt-3 text-zinc-600">Showing available sales locations for <span className="font-semibold text-zinc-900">{cafeteria.name}</span> at {university.name}.</p>

          {error ? <p role="alert" className="mt-6 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
          {!error && shops.length === 0 ? (
            <div className="mt-6 rounded-3xl bg-orange-50 p-6 text-center">
              <p className="text-base font-medium text-zinc-800">No active sales points are available for this cafeteria right now.</p>
              <p className="mt-2 text-sm text-zinc-600">Please choose another cafeteria or check back later.</p>
              <Link href={`/customer/cafeteria?universityId=${encodeURIComponent(university.id)}`} className="mt-5 inline-flex rounded-full bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-600 focus:ring-offset-2">
                Choose another cafeteria
              </Link>
            </div>
          ) : null}
          {!error && shops.length > 1 ? (
            <ul className="mt-6 grid gap-4 sm:grid-cols-2" aria-label={`Available sales points for ${cafeteria.name}`}>
              {shops.map((shop) => (
                <li key={shop.id}>
                  <Link href={`/customer/menu?universityId=${encodeURIComponent(university.id)}&cafeteriaId=${encodeURIComponent(cafeteria.id)}&shopId=${encodeURIComponent(shop.id)}`} className="group flex h-full flex-col justify-between rounded-3xl border border-orange-100 bg-orange-50/70 p-5 transition hover:border-orange-300 hover:bg-orange-100 focus:outline-none focus:ring-2 focus:ring-orange-600 focus:ring-offset-2">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-semibold text-zinc-950">{shop.name}</span>
                        <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">Open</span>
                      </div>
                      {shop.description ? <p className="mt-2 text-sm leading-6 text-zinc-600">{shop.description}</p> : null}
                    </div>
                    <span className="mt-4 inline-flex items-center text-sm font-medium text-orange-700 group-hover:text-orange-800">
                      View menu →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </section>
    </main>
  );
}
