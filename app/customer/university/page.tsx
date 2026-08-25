import Link from "next/link";
import { requireCustomer } from "@/lib/auth/session";
import { getApprovedUniversities } from "@/lib/customer/data";

export default async function UniversitySelectionPage() {
  await requireCustomer();
  const { data: universities, error } = await getApprovedUniversities();

  return (
    <main className="min-h-screen bg-orange-50 px-4 py-6 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-5xl space-y-6">
        <Link href="/customer" className="inline-flex rounded-full px-3 py-2 text-sm font-semibold text-orange-700 hover:bg-orange-100 focus:outline-none focus:ring-2 focus:ring-orange-600">← Back home</Link>
        <div className="rounded-[2rem] border border-orange-100 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-700">Step 1 of 3</p>
          <h1 className="mt-3 text-3xl font-bold text-zinc-950">Select your university</h1>
          <p className="mt-3 text-zinc-600">Only active universities available through your authenticated session are shown.</p>

          {error ? <p role="alert" className="mt-6 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
          {!error && universities.length === 0 ? <p className="mt-6 rounded-2xl bg-white px-4 py-3 text-sm text-zinc-600 ring-1 ring-orange-100">No approved universities are available yet.</p> : null}
          {!error && universities.length > 0 ? (
            <ul className="mt-6 grid gap-4 sm:grid-cols-2" aria-label="Available universities">
              {universities.map((university) => (
                <li key={university.id}>
                  <Link href={`/customer/cafeteria?universityId=${encodeURIComponent(university.id)}`} className="block rounded-3xl border border-orange-100 bg-orange-50/70 p-5 transition hover:border-orange-300 hover:bg-orange-100 focus:outline-none focus:ring-2 focus:ring-orange-600 focus:ring-offset-2">
                    <span className="text-lg font-semibold text-zinc-950">{university.name}</span>
                    <span className="mt-2 block text-sm text-zinc-600">Choose cafeterias at this university.</span>
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
