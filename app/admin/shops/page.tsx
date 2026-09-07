import { getAdminShops } from "@/lib/admin/data";

export default async function AdminShopsPage() {
  const shops = await getAdminShops();

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-950">Shops & Sales Points</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Physical outlets and food counters where customers collect food and POS terminals operate.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white shadow-xs overflow-hidden">
        <div className="border-b border-zinc-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-zinc-950">Outlets Directory</h2>
          <span className="text-xs font-semibold text-zinc-500">{shops.length} Outlets</span>
        </div>

        {shops.length === 0 ? (
          <div className="p-8 text-center text-sm text-zinc-500">No shops configured.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-100 bg-zinc-50/75 text-xs uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-6 py-3 font-semibold">Sales Point / Outlet</th>
                  <th className="px-6 py-3 font-semibold">Vendor & Campus</th>
                  <th className="px-6 py-3 font-semibold">Terminals</th>
                  <th className="px-6 py-3 font-semibold">Menu Items</th>
                  <th className="px-6 py-3 font-semibold">Approval</th>
                  <th className="px-6 py-3 font-semibold">Status</th>
                  <th className="px-6 py-3 font-semibold text-right">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {shops.map((shop) => {
                  let approvalBadge = "bg-zinc-100 text-zinc-700";
                  if (shop.approval_status === "APPROVED") approvalBadge = "bg-emerald-50 text-emerald-700 border border-emerald-200";
                  if (shop.approval_status === "PENDING") approvalBadge = "bg-amber-50 text-amber-700 border border-amber-200";
                  if (shop.approval_status === "REJECTED") approvalBadge = "bg-red-50 text-red-700 border border-red-200";

                  return (
                    <tr key={shop.id} className="hover:bg-zinc-50/50">
                      <td className="px-6 py-4">
                        <p className="font-semibold text-zinc-950">{shop.name}</p>
                        {shop.description && <p className="text-xs text-zinc-500">{shop.description}</p>}
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-medium text-zinc-900">{shop.cafeteria_name}</p>
                        <p className="text-xs text-zinc-500">{shop.university_name}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          {shop.terminal_count} device{shop.terminal_count !== 1 ? "s" : ""}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                          {shop.menu_item_count} item{shop.menu_item_count !== 1 ? "s" : ""}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${approvalBadge}`}>
                          {shop.approval_status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            shop.is_active
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-zinc-100 text-zinc-600 border border-zinc-200"
                          }`}
                        >
                          {shop.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-xs text-zinc-500 font-mono">
                        {new Date(shop.created_at).toLocaleDateString()}
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
