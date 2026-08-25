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
      <main className="min-h-screen bg-orange-50 px-4 py-6 sm:px-6 lg:px-8">
        <section className="mx-auto max-w-3xl rounded-[2rem] border border-orange-100 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-3xl font-bold text-zinc-950">Choose a university first</h1>
          <p className="mt-3 text-zinc-600">A university selection is required before cafeterias can be shown.</p>
          <Link href="/customer/university" className="mt-6 inline-flex rounded-full bg-orange-600 px-5 py-3 font-semibold text-white hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-600 focus:ring-offset-2">Select university</Link>
        </section>
      </main>
    );
  }

  const university = await getApprovedUniversity(selectedUniversityId);
  const { data: cafeterias, error } = await getApprovedCafeterias(university.id);

  return (
    <main className="min-h-screen bg-orange-50 px-4 py-6 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-5xl space-y-6">
        <Link href="/customer/university" className="inline-flex rounded-full px-3 py-2 text-sm font-semibold text-orange-700 hover:bg-orange-100 focus:outline-none focus:ring-2 focus:ring-orange-600">← Back to universities</Link>
        <div className="rounded-[2rem] border border-orange-100 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-700">Step 2 of 3</p>
          <h1 className="mt-3 text-3xl font-bold text-zinc-950">Select a cafeteria</h1>
          <p className="mt-3 text-zinc-600">Showing approved, active cafeterias for <span className="font-semibold text-zinc-900">{university.name}</span>.</p>

          {error ? <p role="alert" className="mt-6 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
          {!error && cafeterias.length === 0 ? <p className="mt-6 rounded-2xl bg-white px-4 py-3 text-sm text-zinc-600 ring-1 ring-orange-100">No approved cafeterias are available for this university yet.</p> : null}
          {!error && cafeterias.length > 0 ? (
            <ul className="mt-6 grid gap-4 sm:grid-cols-2" aria-label={`Available cafeterias for ${university.name}`}>
              {cafeterias.map((cafeteria) => (
                <li key={cafeteria.id}>
                  <Link href={`/customer/shop?universityId=${encodeURIComponent(university.id)}&cafeteriaId=${encodeURIComponent(cafeteria.id)}`} className="block rounded-3xl border border-orange-100 bg-orange-50/70 p-5 transition hover:border-orange-300 hover:bg-orange-100 focus:outline-none focus:ring-2 focus:ring-orange-600 focus:ring-offset-2">
                    <span className="text-lg font-semibold text-zinc-950">{cafeteria.name}</span>
                    <span className="mt-2 block text-sm text-zinc-600">Choose shops in this cafeteria.</span>
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
