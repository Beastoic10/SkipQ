import Link from "next/link";
import { getAdminDashboardStats } from "@/lib/admin/data";

export default async function AdminDashboardPage() {
  const stats = await getAdminDashboardStats();

  return (
    <div className="space-y-8">
      {/* Header section */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-950 sm:text-3xl">
            System Overview
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Real-time platform metrics across universities, vendors, and terminal sales points.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/admin/approvals"
            className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-500"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Pending Approvals
            {stats.pendingApprovalsCount > 0 && (
              <span className="ml-1 rounded-full bg-white px-2 py-0.5 text-xs font-bold text-orange-700">
                {stats.pendingApprovalsCount}
              </span>
            )}
          </Link>
        </div>
      </div>

      {/* Pending Approvals Alert Banner */}
      {stats.pendingApprovalsCount > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 shadow-xs">
          <div className="flex items-start gap-3.5">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-amber-950">
                Action Required: {stats.pendingApprovalsCount} Pending Registration{stats.pendingApprovalsCount > 1 ? "s" : ""}
              </h3>
              <p className="mt-0.5 text-xs text-amber-800">
                There are vendor cafeterias or outlet shops awaiting administrative review before they become visible to campus customers.
              </p>
            </div>
            <Link
              href="/admin/approvals"
              className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-amber-700"
            >
              Review Now →
            </Link>
          </div>
        </div>
      )}

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {/* Universities */}
        <Link
          href="/admin/universities"
          className="group relative overflow-hidden rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs transition hover:-translate-y-0.5 hover:border-orange-300 hover:shadow-md"
        >
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-600">Universities</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition group-hover:bg-blue-600 group-hover:text-white">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443" />
              </svg>
            </div>
          </div>
          <p className="mt-3 text-3xl font-extrabold tracking-tight text-zinc-950">
            {stats.totalUniversities}
          </p>
          <p className="mt-1 text-xs text-zinc-600">Partner campuses</p>
        </Link>

        {/* Cafeterias */}
        <Link
          href="/admin/cafeterias"
          className="group relative overflow-hidden rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs transition hover:-translate-y-0.5 hover:border-orange-300 hover:shadow-md"
        >
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-600">Cafeterias</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-50 text-orange-600 transition group-hover:bg-orange-600 group-hover:text-white">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.614A2.993 2.993 0 009 9.35c.66 0 1.28-.213 1.785-.575m0 0a3.001 3.001 0 003.75.614 2.993 2.993 0 001.785-.575m0 0a3.001 3.001 0 003.75.614 2.993 2.993 0 001.93-.614M3.75 9.35l1.62-5.405A1.5 1.5 0 016.79 3h10.42a1.5 1.5 0 011.42 1.045L20.25 9.35" />
              </svg>
            </div>
          </div>
          <p className="mt-3 text-3xl font-extrabold tracking-tight text-zinc-950">
            {stats.totalCafeterias}
          </p>
          <p className="mt-1 text-xs text-zinc-600">Brand vendors</p>
        </Link>

        {/* Shops */}
        <Link
          href="/admin/shops"
          className="group relative overflow-hidden rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs transition hover:-translate-y-0.5 hover:border-orange-300 hover:shadow-md"
        >
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-600">Outlets / Shops</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-50 text-purple-600 transition group-hover:bg-purple-600 group-hover:text-white">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
              </svg>
            </div>
          </div>
          <p className="mt-3 text-3xl font-extrabold tracking-tight text-zinc-950">
            {stats.totalShops}
          </p>
          <p className="mt-1 text-xs text-emerald-600 font-semibold">
            {stats.activeShops} active now
          </p>
        </Link>

        {/* POS Terminals */}
        <Link
          href="/admin/terminals"
          className="group relative overflow-hidden rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs transition hover:-translate-y-0.5 hover:border-orange-300 hover:shadow-md"
        >
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-600">Terminals</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 transition group-hover:bg-emerald-600 group-hover:text-white">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0H3" />
              </svg>
            </div>
          </div>
          <p className="mt-3 text-3xl font-extrabold tracking-tight text-zinc-950">
            {stats.totalTerminals}
          </p>
          <p className="mt-1 text-xs text-emerald-600 font-semibold">
            {stats.activeTerminals} configured
          </p>
        </Link>

        {/* Menu Items */}
        <Link
          href="/admin/menus"
          className="group relative overflow-hidden rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs transition hover:-translate-y-0.5 hover:border-orange-300 hover:shadow-md"
        >
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-600">Menu Items</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-600 transition group-hover:bg-amber-600 group-hover:text-white">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
              </svg>
            </div>
          </div>
          <p className="mt-3 text-3xl font-extrabold tracking-tight text-zinc-950">
            {stats.totalMenuItems}
          </p>
          <p className="mt-1 text-xs text-zinc-600">Active catalog items</p>
        </Link>

        {/* Total Orders */}
        <div className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-600">Total Orders</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
            </div>
          </div>
          <p className="mt-3 text-3xl font-extrabold tracking-tight text-zinc-950">
            {stats.totalOrders}
          </p>
          <p className="mt-1 text-xs text-zinc-600">All-time volume</p>
        </div>
      </div>

      {/* Quick Navigation Shortcuts */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs">
        <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-600">
          Administrative Modules
        </h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Link
            href="/admin/universities"
            className="flex flex-col items-center justify-center gap-2 rounded-xl border border-zinc-100 bg-zinc-50/70 p-3 text-center transition hover:border-orange-200 hover:bg-orange-50/50 hover:text-orange-700"
          >
            <span className="text-lg">🏛️</span>
            <span className="text-xs font-semibold">Universities</span>
          </Link>
          <Link
            href="/admin/cafeterias"
            className="flex flex-col items-center justify-center gap-2 rounded-xl border border-zinc-100 bg-zinc-50/70 p-3 text-center transition hover:border-orange-200 hover:bg-orange-50/50 hover:text-orange-700"
          >
            <span className="text-lg">🏪</span>
            <span className="text-xs font-semibold">Cafeterias</span>
          </Link>
          <Link
            href="/admin/shops"
            className="flex flex-col items-center justify-center gap-2 rounded-xl border border-zinc-100 bg-zinc-50/70 p-3 text-center transition hover:border-orange-200 hover:bg-orange-50/50 hover:text-orange-700"
          >
            <span className="text-lg">📍</span>
            <span className="text-xs font-semibold">Sales Points</span>
          </Link>
          <Link
            href="/admin/terminals"
            className="flex flex-col items-center justify-center gap-2 rounded-xl border border-zinc-100 bg-zinc-50/70 p-3 text-center transition hover:border-orange-200 hover:bg-orange-50/50 hover:text-orange-700"
          >
            <span className="text-lg">🖥️</span>
            <span className="text-xs font-semibold">Terminals</span>
          </Link>
          <Link
            href="/admin/menus"
            className="flex flex-col items-center justify-center gap-2 rounded-xl border border-zinc-100 bg-zinc-50/70 p-3 text-center transition hover:border-orange-200 hover:bg-orange-50/50 hover:text-orange-700"
          >
            <span className="text-lg">🍽️</span>
            <span className="text-xs font-semibold">Menu Catalog</span>
          </Link>
          <Link
            href="/admin/approvals"
            className="flex flex-col items-center justify-center gap-2 rounded-xl border border-zinc-100 bg-zinc-50/70 p-3 text-center transition hover:border-orange-200 hover:bg-orange-50/50 hover:text-orange-700"
          >
            <span className="text-lg">✅</span>
            <span className="text-xs font-semibold">Approvals</span>
          </Link>
        </div>
      </div>

      {/* Recent Orders Overview */}
      <div className="rounded-2xl border border-zinc-200 bg-white shadow-xs overflow-hidden">
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-zinc-950">Recent Order Activity</h2>
            <p className="text-xs text-zinc-500">Live order flow across physical outlet sales points</p>
          </div>
          <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600">
            Last {stats.recentOrders.length} orders
          </span>
        </div>

        {stats.recentOrders.length === 0 ? (
          <div className="p-8 text-center text-sm text-zinc-500">
            No recent orders recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-100 bg-zinc-50/75 text-xs uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-6 py-3 font-semibold">Order</th>
                  <th className="px-6 py-3 font-semibold">Outlet / Cafeteria</th>
                  <th className="px-6 py-3 font-semibold">Payment</th>
                  <th className="px-6 py-3 font-semibold">Amount</th>
                  <th className="px-6 py-3 font-semibold">Status</th>
                  <th className="px-6 py-3 font-semibold text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {stats.recentOrders.map((order) => {
                  let statusBadge = "bg-zinc-100 text-zinc-700";
                  if (order.status === "PLACED") statusBadge = "bg-blue-50 text-blue-700 border border-blue-200";
                  if (order.status === "PREPARING") statusBadge = "bg-amber-50 text-amber-700 border border-amber-200";
                  if (order.status === "READY") statusBadge = "bg-purple-50 text-purple-700 border border-purple-200";
                  if (order.status === "COLLECTED") statusBadge = "bg-emerald-50 text-emerald-700 border border-emerald-200";
                  if (order.status === "CANCELLED") statusBadge = "bg-red-50 text-red-700 border border-red-200";

                  return (
                    <tr key={order.id} className="hover:bg-zinc-50/50 transition-colors">
                      <td className="px-6 py-4 font-mono font-medium text-zinc-950">
                        <div className="flex items-center gap-2">
                          <span>{order.order_number}</span>
                          {order.order_code && (
                            <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-xs font-semibold text-zinc-700">
                              #{order.order_code}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-semibold text-zinc-900">{order.shop_name}</p>
                        <p className="text-xs text-zinc-500">{order.cafeteria_name}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
                            order.payment_method === "ONLINE"
                              ? "bg-indigo-50 text-indigo-700"
                              : "bg-zinc-100 text-zinc-700"
                          }`}
                        >
                          {order.payment_method}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-semibold text-zinc-950">
                        ৳{order.total_amount.toFixed(2)}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadge}`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-xs text-zinc-500 font-mono">
                        {new Date(order.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
