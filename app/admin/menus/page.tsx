import { getAdminMenuItems } from "@/lib/admin/data";

export default async function AdminMenusPage() {
  const menuItems = await getAdminMenuItems();

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-950">Menu Catalog</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Global food catalog items, outlet inventory levels, and manual availability states.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white shadow-xs overflow-hidden">
        <div className="border-b border-zinc-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-zinc-950">Catalog Items</h2>
          <span className="text-xs font-semibold text-zinc-500">{menuItems.length} Items</span>
        </div>

        {menuItems.length === 0 ? (
          <div className="p-8 text-center text-sm text-zinc-500">No menu items found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-100 bg-zinc-50/75 text-xs uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-6 py-3 font-semibold">Item</th>
                  <th className="px-6 py-3 font-semibold">Physical Outlet</th>
                  <th className="px-6 py-3 font-semibold">Price</th>
                  <th className="px-6 py-3 font-semibold">Stock</th>
                  <th className="px-6 py-3 font-semibold">Max / Order</th>
                  <th className="px-6 py-3 font-semibold">Available</th>
                  <th className="px-6 py-3 font-semibold text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {menuItems.map((item) => (
                  <tr key={item.id} className="hover:bg-zinc-50/50">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-zinc-950">{item.name}</p>
                      {item.description && <p className="text-xs text-zinc-500">{item.description}</p>}
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-zinc-900">{item.shop_name}</p>
                      <p className="text-xs text-zinc-500">{item.cafeteria_name}</p>
                    </td>
                    <td className="px-6 py-4 font-semibold text-zinc-950">
                      ৳{item.price.toFixed(2)}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold ${
                          item.stock_quantity > 10
                            ? "bg-emerald-50 text-emerald-700"
                            : item.stock_quantity > 0
                            ? "bg-amber-50 text-amber-700"
                            : "bg-red-50 text-red-700"
                        }`}
                      >
                        {item.stock_quantity} left
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-zinc-700">
                      {item.max_quantity_per_order}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                          item.is_manually_available
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-zinc-100 text-zinc-600"
                        }`}
                      >
                        {item.is_manually_available ? "Available" : "Unavailable"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          item.is_active
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-zinc-100 text-zinc-600 border border-zinc-200"
                        }`}
                      >
                        {item.is_active ? "Active" : "Archived"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
