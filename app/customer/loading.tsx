export default function CustomerLoading() {
  return (
    <main className="min-h-screen bg-orange-50 px-4 py-6 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-5xl rounded-3xl border border-orange-100 bg-white p-6 shadow-sm" aria-live="polite" aria-busy="true">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-700">SkipQ</p>
        <div className="mt-6 h-8 w-56 animate-pulse rounded-full bg-orange-100" />
        <div className="mt-4 h-4 w-full max-w-xl animate-pulse rounded-full bg-orange-100" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {["one", "two", "three"].map((item) => (
            <div key={item} className="h-32 animate-pulse rounded-3xl bg-orange-100/80" />
          ))}
        </div>
        <span className="sr-only">Loading customer selection screen.</span>
      </section>
    </main>
  );
}
