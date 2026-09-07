import { getAdminPendingApprovals } from "@/lib/admin/data";
import { updateCafeteriaApprovalAction, updateShopApprovalAction } from "@/lib/admin/actions";

export default async function AdminApprovalsPage() {
  const pendingItems = await getAdminPendingApprovals();

  async function handleApprove(formData: FormData) {
    "use server";
    const id = String(formData.get("id"));
    const type = String(formData.get("type"));

    if (type === "cafeteria") {
      await updateCafeteriaApprovalAction(id, "APPROVED");
    } else {
      await updateShopApprovalAction(id, "APPROVED");
    }
  }

  async function handleReject(formData: FormData) {
    "use server";
    const id = String(formData.get("id"));
    const type = String(formData.get("type"));

    if (type === "cafeteria") {
      await updateCafeteriaApprovalAction(id, "REJECTED");
    } else {
      await updateShopApprovalAction(id, "REJECTED");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-950">Approval Requests</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Review vendor cafeterias and physical sales point outlets awaiting operational approval.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white shadow-xs overflow-hidden">
        <div className="border-b border-zinc-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-zinc-950">Pending Review Queue</h2>
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800 border border-amber-200">
            {pendingItems.length} Pending
          </span>
        </div>

        {pendingItems.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="mt-4 text-base font-semibold text-zinc-900">All clear!</h3>
            <p className="mt-1 text-sm text-zinc-500">
              There are currently no vendor cafeterias or outlet sales points pending approval.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100">
            {pendingItems.map((item) => (
              <div key={item.id} className="flex flex-col justify-between gap-4 p-6 sm:flex-row sm:items-center hover:bg-zinc-50/50 transition">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-700 font-bold">
                    {item.type === "cafeteria" ? "🏪" : "📍"}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-zinc-950">{item.name}</h4>
                      <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-600 uppercase">
                        {item.type}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-600 mt-0.5">
                      Parent: <span className="font-medium text-zinc-900">{item.parent_name}</span> • Slug: <code className="font-mono text-zinc-500">/{item.slug}</code>
                    </p>
                    <p className="text-[11px] text-zinc-600 mt-1">
                      Submitted on {new Date(item.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <form action={handleReject}>
                    <input type="hidden" name="id" value={item.id} />
                    <input type="hidden" name="type" value={item.type} />
                    <button
                      type="submit"
                      className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-700 transition hover:bg-red-50 hover:border-red-200 hover:text-red-700"
                    >
                      Reject
                    </button>
                  </form>
                  <form action={handleApprove}>
                    <input type="hidden" name="id" value={item.id} />
                    <input type="hidden" name="type" value={item.type} />
                    <button
                      type="submit"
                      className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-emerald-500"
                    >
                      Approve
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
