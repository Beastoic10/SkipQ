import { getAdminCafeterias } from "@/lib/admin/data";

export default async function AdminCafeteriasPage() {
  const cafeterias = await getAdminCafeterias();

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-950">Cafeterias & Vendors</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Brand food vendors and dining entities operating on university campuses.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white shadow-xs overflow-hidden">
        <div className="border-b border-zinc-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-zinc-950">Vendor Directory</h2>
          <span className="text-xs font-semibold text-zinc-500">{cafeterias.length} Cafeterias</span>
        </div>

        {cafeterias.length === 0 ? (
          <div className="p-8 text-center text-sm text-zinc-500">No cafeterias registered.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-100 bg-zinc-50/75 text-xs uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-6 py-3 font-semibold">Vendor Name</th>
                  <th className="px-6 py-3 font-semibold">Campus</th>
                  <th className="px-6 py-3 font-semibold">Sales Points</th>
                  <th className="px-6 py-3 font-semibold">Approval</th>
                  <th className="px-6 py-3 font-semibold">Status</th>
                  <th className="px-6 py-3 font-semibold text-right">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {cafeterias.map((caf) => {
                  let approvalBadge = "bg-zinc-100 text-zinc-700";
                  if (caf.approval_status === "APPROVED") approvalBadge = "bg-emerald-50 text-emerald-700 border border-emerald-200";
                  if (caf.approval_status === "PENDING") approvalBadge = "bg-amber-50 text-amber-700 border border-amber-200";
                  if (caf.approval_status === "REJECTED") approvalBadge = "bg-red-50 text-red-700 border border-red-200";

                  return (
                    <tr key={caf.id} className="hover:bg-zinc-50/50">
                      <td className="px-6 py-4">
                        <p className="font-semibold text-zinc-950">{caf.name}</p>
                        <p className="font-mono text-xs text-zinc-600">/{caf.slug}</p>
                      </td>
                      <td className="px-6 py-4 text-zinc-700">{caf.university_name}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center rounded-md bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">
                          {caf.shop_count} outlet{caf.shop_count !== 1 ? "s" : ""}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${approvalBadge}`}>
                          {caf.approval_status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            caf.is_active
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-zinc-100 text-zinc-600 border border-zinc-200"
                          }`}
                        >
                          {caf.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-xs text-zinc-500 font-mono">
                        {new Date(caf.created_at).toLocaleDateString()}
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
