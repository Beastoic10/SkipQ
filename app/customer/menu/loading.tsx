export default function CustomerMenuLoading() {
  return (
    <main className="min-h-screen bg-orange-50 px-4 py-6 sm:px-6 lg:px-8">
      <section
        className="mx-auto max-w-5xl space-y-6"
        aria-live="polite"
        aria-busy="true"
      >
        <div className="h-6 w-36 animate-pulse rounded-full bg-orange-100" />

        {/* Header Skeleton */}
        <div className="rounded-[2rem] border border-orange-100 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-3">
              <div className="h-4 w-28 animate-pulse rounded-full bg-orange-100" />
              <div className="h-9 w-64 animate-pulse rounded-2xl bg-orange-100" />
              <div className="h-4 w-48 animate-pulse rounded-full bg-orange-100/70" />
            </div>
            <div className="h-14 w-32 animate-pulse rounded-2xl bg-orange-50" />
          </div>
        </div>

        {/* Search bar skeleton */}
        <div className="h-10 w-full max-w-md animate-pulse rounded-full bg-orange-100/80" />

        {/* Menu Cards Skeleton Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {["skel-1", "skel-2", "skel-3", "skel-4", "skel-5", "skel-6"].map(
            (id) => (
              <div
                key={id}
                className="overflow-hidden rounded-3xl border border-orange-100 bg-white shadow-sm"
              >
                <div className="aspect-video w-full animate-pulse bg-orange-100/60" />
                <div className="p-5 space-y-3">
                  <div className="flex justify-between">
                    <div className="h-5 w-32 animate-pulse rounded-full bg-orange-100" />
                    <div className="h-5 w-16 animate-pulse rounded-full bg-orange-100" />
                  </div>
                  <div className="h-3 w-full animate-pulse rounded-full bg-orange-100/60" />
                  <div className="h-3 w-2/3 animate-pulse rounded-full bg-orange-100/60" />
                  <div className="pt-2">
                    <div className="h-9 w-full animate-pulse rounded-full bg-orange-100/80" />
                  </div>
                </div>
              </div>
            )
          )}
        </div>
        <span className="sr-only">Loading menu items...</span>
      </section>
    </main>
  );
}
