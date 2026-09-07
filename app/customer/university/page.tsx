import Link from "next/link";
import { requireCustomer } from "@/lib/auth/session";
import { getApprovedUniversities } from "@/lib/customer/data";
import { UniversitySearchSelect } from "./university-search-select";

export default async function UniversitySelectionPage() {
  await requireCustomer();
  const { data: universities, error } = await getApprovedUniversities();

  return (
    <main className="min-h-screen bg-[#FAF9F6] px-4 py-8 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-2xl space-y-6">
        {/* Navigation back */}
        <Link
          href="/customer"
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 transition"
        >
          <span>←</span>
          <span>Back to Home</span>
        </Link>

        {/* Selection Card */}
        <div className="rounded-3xl border border-zinc-200/80 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-center gap-2">
            <span className="inline-flex rounded-full bg-orange-50 px-3 py-1 text-xs font-bold tracking-wide uppercase text-orange-600 border border-orange-100">
              Step 1 of 3 · Campus
            </span>
          </div>

          <h1 className="mt-3 text-2xl font-black tracking-tight text-zinc-950 sm:text-3xl">
            Select Your University
          </h1>
          <p className="mt-1.5 text-sm text-zinc-500">
            Choose your campus to see available cafeterias, stalls, and live ordering queues.
          </p>

          <div className="mt-6">
            {error ? (
              <div role="alert" className="rounded-2xl bg-rose-50 border border-rose-100 p-4 text-xs font-medium text-rose-800">
                {error}
              </div>
            ) : null}

            {!error && universities.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-200 p-8 text-center text-sm text-zinc-500">
                No active universities are available yet. Please check back soon.
              </div>
            ) : null}

            {!error && universities.length > 0 ? (
              <UniversitySearchSelect universities={universities} />
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
