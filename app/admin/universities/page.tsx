import { getAdminUniversities } from "@/lib/admin/data";

export default async function AdminUniversitiesPage() {
  const universities = await getAdminUniversities();

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-950">Universities</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Manage partner universities and campus domains.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white shadow-xs overflow-hidden">
        <div className="border-b border-zinc-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-zinc-950">Campus Directory</h2>
          <span className="text-xs font-semibold text-zinc-500">{universities.length} Campuses</span>
        </div>

        {universities.length === 0 ? (
          <div className="p-8 text-center text-sm text-zinc-500">No universities found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-100 bg-zinc-50/75 text-xs uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-6 py-3 font-semibold">University Name</th>
                  <th className="px-6 py-3 font-semibold">Slug</th>
                  <th className="px-6 py-3 font-semibold">Cafeterias</th>
                  <th className="px-6 py-3 font-semibold">Status</th>
                  <th className="px-6 py-3 font-semibold text-right">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {universities.map((uni) => (
                  <tr key={uni.id} className="hover:bg-zinc-50/50">
                    <td className="px-6 py-4 font-semibold text-zinc-950">{uni.name}</td>
                    <td className="px-6 py-4 font-mono text-xs text-zinc-600">/{uni.slug}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center rounded-md bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700">
                        {uni.cafeteria_count} cafeteria{uni.cafeteria_count !== 1 ? "s" : ""}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          uni.is_active
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-zinc-100 text-zinc-600 border border-zinc-200"
                        }`}
                      >
                        {uni.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-xs text-zinc-500 font-mono">
                      {new Date(uni.created_at).toLocaleDateString()}
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
