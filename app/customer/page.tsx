import Link from "next/link";
import { requireCustomer } from "@/lib/auth/session";

export default async function CustomerHomePage() {
  const context = await requireCustomer();
  const displayName = context.profile?.display_name ?? context.email ?? "Student";
  const firstName = displayName.includes(" ") ? displayName.split(" ")[0] : displayName;

  const categories = [
    { name: "Burgers & Sandwiches", icon: "🍔", tag: "Hot & Fresh" },
    { name: "Biryani & Rice", icon: "🍛", tag: "Meals" },
    { name: "Rolls & Shawarma", icon: "🌯", tag: "Quick Bite" },
    { name: "Coffee & Tea", icon: "☕", tag: "Drinks" },
    { name: "Snacks & Fries", icon: "🍟", tag: "Crispy" },
  ];

  return (
    <main className="min-h-screen bg-[#FAF9F6] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-8">
        {/* Hero Greeting Section */}
        <section className="relative overflow-hidden rounded-3xl border border-zinc-200/80 bg-white p-6 shadow-sm sm:p-10">
          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-orange-50 border border-orange-100 px-3 py-1 text-xs font-bold text-orange-600">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse" />
              Live Campus Ordering
            </div>

            <h1 className="mt-4 text-3xl font-black tracking-tight text-zinc-950 sm:text-4xl lg:text-5xl">
              Hey, {firstName} 👋 <br />
              <span className="text-orange-600">Skip the queue</span> today.
            </h1>

            <p className="mt-3 text-base text-zinc-600 sm:text-lg">
              Order hot meals and fresh snacks from your university cafeteria before you walk over. Pick up with a quick QR code.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="/customer/university"
                className="inline-flex items-center justify-center gap-2.5 rounded-full bg-orange-600 px-7 py-3.5 text-sm font-bold text-white shadow-md shadow-orange-600/20 transition hover:bg-orange-700 active:scale-95"
              >
                <span>Select Your Campus</span>
                <span className="text-base">→</span>
              </Link>
              <span className="text-xs text-zinc-400 text-center sm:text-left">
                Pay in cash when you collect at the counter
              </span>
            </div>
          </div>

          {/* Decorative food gradient backdrop */}
          <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-orange-500/10 blur-3xl" />
        </section>

        {/* Quick Food Categories Carousel/List */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black tracking-tight text-zinc-950">
              Popular Campus Cravings
            </h2>
            <Link
              href="/customer/university"
              className="text-xs font-bold text-orange-600 hover:text-orange-700"
            >
              Browse all →
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {categories.map((cat) => (
              <Link
                key={cat.name}
                href="/customer/university"
                className="group flex flex-col items-center justify-center rounded-2xl border border-zinc-200/80 bg-white p-4 text-center shadow-sm transition hover:border-orange-200 hover:shadow-md active:scale-95"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-2xl transition group-hover:scale-110">
                  {cat.icon}
                </div>
                <span className="mt-3 text-xs font-bold text-zinc-900 group-hover:text-orange-600">
                  {cat.name}
                </span>
                <span className="mt-0.5 text-[10px] font-semibold text-zinc-400">
                  {cat.tag}
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* How SkipQ Works / Trust Badges */}
        <section className="rounded-3xl border border-zinc-200/80 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400">
            Three Steps to Lunch in Seconds
          </h2>

          <div className="mt-6 grid gap-6 sm:grid-cols-3">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-orange-100 font-black text-sm text-orange-700">
                1
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-950">Pick your food</h3>
                <p className="mt-1 text-xs leading-5 text-zinc-500">
                  Browse live menus with accurate stock and prep time estimates.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-orange-100 font-black text-sm text-orange-700">
                2
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-950">Receive Order Code</h3>
                <p className="mt-1 text-xs leading-5 text-zinc-500">
                  Get a secure digital QR code and a 4-digit verbal Order Code instantly.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-orange-100 font-black text-sm text-orange-700">
                3
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-950">Collect &amp; Enjoy</h3>
                <p className="mt-1 text-xs leading-5 text-zinc-500">
                  Walk straight up when ready, show your code, pay cash, and leave with your food.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
