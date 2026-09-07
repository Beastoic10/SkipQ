import { getAdminTerminals } from "@/lib/admin/data";

export default async function AdminTerminalsPage() {
  const terminals = await getAdminTerminals();

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-950">POS Terminal Accounts</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Physical point-of-sale device credentials mapped 1:1 to outlet counters.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white shadow-xs overflow-hidden">
        <div className="border-b border-zinc-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-zinc-950">Active Terminals</h2>
          <span className="text-xs font-semibold text-zinc-500">{terminals.length} Terminals</span>
        </div>

        {terminals.length === 0 ? (
          <div className="p-8 text-center text-sm text-zinc-500">No terminal accounts provisioned.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-100 bg-zinc-50/75 text-xs uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-6 py-3 font-semibold">Terminal Name</th>
                  <th className="px-6 py-3 font-semibold">Assigned Shop</th>
                  <th className="px-6 py-3 font-semibold">Vendor & Campus</th>
                  <th className="px-6 py-3 font-semibold">Auth Email</th>
                  <th className="px-6 py-3 font-semibold">Status</th>
                  <th className="px-6 py-3 font-semibold text-right">Provisioned</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {terminals.map((term) => (
                  <tr key={term.id} className="hover:bg-zinc-50/50">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-zinc-950">{term.display_name}</p>
                      <p className="font-mono text-[11px] text-zinc-600">ID: {term.id.slice(0, 8)}...</p>
                    </td>
                    <td className="px-6 py-4 font-medium text-zinc-900">{term.shop_name}</td>
                    <td className="px-6 py-4">
                      <p className="text-zinc-900">{term.cafeteria_name}</p>
                      <p className="text-xs text-zinc-500">{term.university_name}</p>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-zinc-700">
                      {term.email || "No email assigned"}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          term.is_active
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-zinc-100 text-zinc-600 border border-zinc-200"
                        }`}
                      >
                        {term.is_active ? "Active" : "Disabled"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-xs text-zinc-500 font-mono">
                      {new Date(term.created_at).toLocaleDateString()}
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
