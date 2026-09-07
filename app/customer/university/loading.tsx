export default function UniversityLoading() {
  return (
    <main className="min-h-screen bg-[#FAF9F6] px-4 py-8 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-2xl rounded-3xl border border-zinc-200/80 bg-white p-6 shadow-sm sm:p-8" aria-live="polite" aria-busy="true">
        <div className="h-5 w-32 animate-pulse rounded-full bg-orange-100" />
        <div className="mt-4 h-8 w-64 animate-pulse rounded-full bg-zinc-200" />
        <div className="mt-2 h-4 w-full max-w-md animate-pulse rounded-full bg-zinc-100" />
        <div className="mt-8 space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-zinc-100" />
          ))}
        </div>
        <span className="sr-only">Loading universities...</span>
      </section>
    </main>
  );
}
