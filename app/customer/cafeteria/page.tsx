import Link from "next/link";
import { requireCustomer } from "@/lib/auth/session";
import { getApprovedCafeterias, getApprovedUniversity, getSingleSearchParam } from "@/lib/customer/data";

type CafeteriaSelectionPageProps = {
  searchParams: Promise<{ universityId?: string | string[] }>;
};

export default async function CafeteriaSelectionPage({ searchParams }: CafeteriaSelectionPageProps) {
  await requireCustomer();
  const { universityId } = await searchParams;
  const selectedUniversityId = getSingleSearchParam(universityId);

  if (!selectedUniversityId) {
    return (
      <main className="min-h-screen bg-[#FAF9F6] px-4 py-12 sm:px-6 lg:px-8">
        <section className="mx-auto max-w-xl rounded-3xl border border-zinc-200/80 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-2xl text-orange-600">
            🏛️
          </div>
          <h1 className="mt-4 text-2xl font-black text-zinc-950">Choose a university first</h1>
          <p className="mt-2 text-sm text-zinc-500">A university selection is required before cafeterias can be shown.</p>
          <Link
            href="/customer/university"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-orange-600 px-6 py-3 text-xs font-bold text-white shadow-sm hover:bg-orange-700"
          >
            <span>Select University</span>
            <span>→</span>
          </Link>
        </section>
      </main>
    );
  }

  const university = await getApprovedUniversity(selectedUniversityId);
  const { data: cafeterias, error } = await getApprovedCafeterias(university.id);

  return (
    <main className="min-h-screen bg-[#FAF9F6] px-4 py-8 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-2xl space-y-6">
        <Link
          href="/customer/university"
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 transition"
        >
          <span>←</span>
          <span>Back to Universities</span>
        </Link>

        <div className="rounded-3xl border border-zinc-200/80 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-center gap-2">
            <span className="inline-flex rounded-full bg-orange-50 px-3 py-1 text-xs font-bold tracking-wide uppercase text-orange-600 border border-orange-100">
              Step 2 of 3 · Cafeteria
            </span>
          </div>

          <h1 className="mt-3 text-2xl font-black tracking-tight text-zinc-950 sm:text-3xl">
            Select a Cafeteria
          </h1>
          <p className="mt-1.5 text-sm text-zinc-500">
            Showing approved cafeterias at <strong className="text-zinc-800">{university.name}</strong>.
          </p>

          <div className="mt-6">
            {error ? (
              <div role="alert" className="rounded-2xl bg-rose-50 border border-rose-100 p-4 text-xs font-medium text-rose-800">
                {error}
              </div>
            ) : null}

            {!error && cafeterias.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-200 p-8 text-center text-sm text-zinc-500">
                No approved cafeterias are registered for this university yet.
              </div>
            ) : null}

            {!error && cafeterias.length > 0 ? (
              <ul className="grid gap-3.5" aria-label={`Available cafeterias for ${university.name}`}>
                {cafeterias.map((cafeteria) => (
                  <li key={cafeteria.id}>
                    <Link
                      href={`/customer/shop?universityId=${encodeURIComponent(university.id)}&cafeteriaId=${encodeURIComponent(cafeteria.id)}`}
                      className="group flex items-center justify-between rounded-2xl border border-zinc-200/80 bg-white p-4 sm:p-5 transition hover:border-orange-300 hover:bg-orange-50/40 hover:shadow-sm"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-xl text-orange-600 transition group-hover:scale-105 group-hover:bg-orange-600 group-hover:text-white">
                          🍴
                        </div>
                        <div>
                          <h2 className="text-base font-bold text-zinc-950 group-hover:text-orange-950">
                            {cafeteria.name}
                          </h2>
                          <p className="mt-0.5 text-xs text-zinc-500">
                            Tap to view food stalls and menus
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="hidden sm:inline-flex rounded-full bg-emerald-50 border border-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                          Open
                        </span>
                        <span className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 group-hover:text-orange-600 group-hover:translate-x-0.5 transition">
                          →
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
