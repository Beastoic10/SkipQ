import Link from "next/link";
import { requireCustomer } from "@/lib/auth/session";
import { getApprovedCafeteria, getApprovedShop, getApprovedShops, getApprovedUniversity, getSingleSearchParam } from "@/lib/customer/data";

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
          <p className="mt-3 text-zinc-600">A university and cafeteria selection are required before shops can be shown.</p>
          <Link href="/customer/university" className="mt-6 inline-flex rounded-full bg-orange-600 px-5 py-3 font-semibold text-white hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-600 focus:ring-offset-2">Start selection</Link>
        </section>
      </main>
    );
  }

  const university = await getApprovedUniversity(selectedUniversityId);
  const cafeteria = await getApprovedCafeteria(selectedCafeteriaId, university.id);

  if (selectedShopId) {
    const shop = await getApprovedShop(selectedShopId, cafeteria.id);

    return (
      <main className="min-h-screen bg-orange-50 px-4 py-6 sm:px-6 lg:px-8">
        <section className="mx-auto max-w-5xl space-y-6">
          <Link href={`/customer/shop?universityId=${encodeURIComponent(university.id)}&cafeteriaId=${encodeURIComponent(cafeteria.id)}`} className="inline-flex rounded-full px-3 py-2 text-sm font-semibold text-orange-700 hover:bg-orange-100 focus:outline-none focus:ring-2 focus:ring-orange-600">← Back to shops</Link>
          <div className="rounded-[2rem] border border-orange-100 bg-white p-6 shadow-sm sm:p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-700">Menu entry point</p>
            <h1 className="mt-3 text-3xl font-bold text-zinc-950">{shop.name}</h1>
            <p className="mt-3 text-zinc-600">{cafeteria.name} · {university.name}</p>
            {shop.description ? <p className="mt-5 max-w-2xl leading-7 text-zinc-700">{shop.description}</p> : null}
            <div className="mt-6 rounded-3xl bg-orange-50 p-5">
              <h2 className="text-xl font-semibold text-zinc-950">Menu coming next</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-600">This placeholder confirms the selected shop. Menu browsing will be implemented in the next milestone.</p>
            </div>
          </div>
        </section>
      </main>
    );
  }

  const { data: shops, error } = await getApprovedShops(cafeteria.id);

  return (
    <main className="min-h-screen bg-orange-50 px-4 py-6 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-5xl space-y-6">
        <Link href={`/customer/cafeteria?universityId=${encodeURIComponent(university.id)}`} className="inline-flex rounded-full px-3 py-2 text-sm font-semibold text-orange-700 hover:bg-orange-100 focus:outline-none focus:ring-2 focus:ring-orange-600">← Back to cafeterias</Link>
        <div className="rounded-[2rem] border border-orange-100 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-700">Step 3 of 3</p>
          <h1 className="mt-3 text-3xl font-bold text-zinc-950">Select a shop</h1>
          <p className="mt-3 text-zinc-600">Showing active, approved shops in <span className="font-semibold text-zinc-900">{cafeteria.name}</span> at {university.name}.</p>

          {error ? <p role="alert" className="mt-6 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
          {!error && shops.length === 0 ? <p className="mt-6 rounded-2xl bg-white px-4 py-3 text-sm text-zinc-600 ring-1 ring-orange-100">No active shops are available for this cafeteria yet.</p> : null}
          {!error && shops.length > 0 ? (
            <ul className="mt-6 grid gap-4 sm:grid-cols-2" aria-label={`Available shops in ${cafeteria.name}`}>
              {shops.map((shop) => (
                <li key={shop.id}>
                  <Link href={`/customer/shop?universityId=${encodeURIComponent(university.id)}&cafeteriaId=${encodeURIComponent(cafeteria.id)}&shopId=${encodeURIComponent(shop.id)}`} className="block h-full rounded-3xl border border-orange-100 bg-orange-50/70 p-5 transition hover:border-orange-300 hover:bg-orange-100 focus:outline-none focus:ring-2 focus:ring-orange-600 focus:ring-offset-2">
                    <span className="text-lg font-semibold text-zinc-950">{shop.name}</span>
                    {shop.description ? <span className="mt-2 block text-sm leading-6 text-zinc-600">{shop.description}</span> : null}
                    <span className="mt-4 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Open for selection</span>
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
