import { useState } from "react";
import { useLoaderData, useRevalidator, useSearchParams } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { requireAdmin, logAdminAction } from "~/lib/admin.server";
import { PageTitle, Card, Pill, EmptyState, StatCard } from "~/components/AdminUI";
import { Banknote, CheckCircle2, XCircle, Landmark, Wallet, AlertTriangle } from "lucide-react";

export async function loader({ request }: LoaderFunctionArgs) {
  const { admin } = await requireAdmin(request);
  const status = new URL(request.url).searchParams.get("status") ?? "pending";

  let q = admin
    .from("withdrawal_requests")
    .select("*, worker:profiles!withdrawal_requests_worker_id_fkey(full_name, email, phone, avg_rating, reliability_score)")
    .order("requested_at", { ascending: false })
    .limit(100);
  if (status !== "all") q = q.eq("status", status);
  const { data: requests } = await q;

  // Verified bank details for the workers in view (never sent to the browser
  // beyond the masked tail we render)
  const workerIds = [...new Set((requests ?? []).map((r: any) => r.worker_id))];
  let banks: Record<string, any> = {};
  if (workerIds.length) {
    const { data } = await admin
      .from("worker_bank_accounts")
      .select("worker_id, account_number, ifsc, account_holder, penny_drop_status")
      .in("worker_id", workerIds);
    for (const b of data ?? []) {
      banks[b.worker_id] = {
        tail: String(b.account_number).slice(-4),
        ifsc: b.ifsc,
        holder: b.account_holder,
        verified: b.penny_drop_status === "verified",
      };
    }
  }

  // Wallet balance per worker so you can sanity-check before paying
  let balances: Record<string, number> = {};
  if (workerIds.length) {
    const { data } = await admin
      .from("wallet_transactions").select("worker_id, amount").in("worker_id", workerIds).neq("status", "failed");
    for (const t of data ?? []) balances[t.worker_id] = (balances[t.worker_id] ?? 0) + t.amount;
  }

  const { data: pendingAll } = await admin.from("withdrawal_requests").select("amount").eq("status", "pending");
  const pendingValue = (pendingAll ?? []).reduce((s, r) => s + (r.amount ?? 0), 0);

  return { requests: requests ?? [], banks, balances, status, pendingCount: pendingAll?.length ?? 0, pendingValue };
}

export async function action({ request }: ActionFunctionArgs) {
  const ctx = await requireAdmin(request);
  const fd = await request.formData();
  const id = String(fd.get("id") ?? "");
  const decision = String(fd.get("decision") ?? "");
  const reason = String(fd.get("reason") ?? "").trim();
  if (!id || !["approve", "reject"].includes(decision)) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const { data: req } = await ctx.admin
    .from("withdrawal_requests").select("id, worker_id, amount, status").eq("id", id).single();
  if (!req) return Response.json({ error: "not_found" }, { status: 404 });
  if (req.status !== "pending") {
    return Response.json({ error: "This request was already processed." }, { status: 400 });
  }

  if (decision === "approve") {
    await ctx.admin.from("withdrawal_requests")
      .update({ status: "completed", processed_at: new Date().toISOString() }).eq("id", id);
    // Settle the matching pending debit so the balance is final
    await ctx.admin.from("wallet_transactions")
      .update({ status: "completed" }).eq("reference_id", id).eq("type", "withdrawal");
    await logAdminAction(ctx, "approve_withdrawal", `Approved ₹${req.amount} withdrawal`, { targetUserId: req.worker_id });
  } else {
    await ctx.admin.from("withdrawal_requests").update({
      status: "rejected",
      rejection_reason: reason || "Rejected by GigDekho",
      processed_at: new Date().toISOString(),
    }).eq("id", id);
    // Marking the debit failed returns the money to their balance, because
    // balance is the sum of every non-failed transaction.
    await ctx.admin.from("wallet_transactions")
      .update({ status: "failed" }).eq("reference_id", id).eq("type", "withdrawal");
    await logAdminAction(ctx, "reject_withdrawal", `Rejected ₹${req.amount} withdrawal: ${reason}`, { targetUserId: req.worker_id });
  }

  // Tell the worker either way
  await ctx.admin.from("notifications").insert({
    user_id: req.worker_id,
    type: "withdrawal",
    title: decision === "approve" ? `Withdrawal of ₹${req.amount} approved` : `Withdrawal of ₹${req.amount} was rejected`,
    body: decision === "approve"
      ? "The transfer to your bank account is on its way."
      : `${reason || "Please check your bank details and try again."} The amount is back in your wallet.`,
    link: "/worker/earnings",
  });

  return Response.json({ ok: true });
}

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export default function AdminPayouts() {
  const d = useLoaderData<typeof loader>();
  const [params, setParams] = useSearchParams();
  const revalidator = useRevalidator();
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState<any>(null);
  const [reason, setReason] = useState("");

  const decide = async (id: string, decision: "approve" | "reject", why = "") => {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("id", id);
      fd.append("decision", decision);
      fd.append("reason", why);
      await fetch("/admin/payouts", { method: "POST", body: fd });
      revalidator.revalidate();
      setRejecting(null);
      setReason("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageTitle title="Payouts" subtitle="Workers withdrawing their wallet balance. Approve once you've made the bank transfer." />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <StatCard label="Pending Requests" value={d.pendingCount} accent={d.pendingCount > 0 ? "orange" : "neutral"} icon={<Banknote size={15} />} />
        <StatCard label="Pending Value" value={inr(d.pendingValue)} sub="Money waiting on you" accent="orange" icon={<Wallet size={15} />} />
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {["pending", "completed", "rejected", "all"].map((s) => (
          <button key={s} type="button"
            onClick={() => { params.set("status", s); setParams(params); }}
            className={`px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-wider border transition-colors btn-tap min-h-0 ${
              d.status === s ? "bg-[#F4511E] border-[#F4511E] text-white" : "border-white/10 text-white/50 hover:text-white"
            }`}
            style={{ minHeight: "34px" }}>
            {s}
          </button>
        ))}
      </div>

      {d.requests.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 size={22} />}
          title={d.status === "pending" ? "No withdrawals waiting" : `No ${d.status} withdrawals`}
          hint="When a worker withdraws from their wallet, the request appears here with their verified bank details so you can make the transfer and mark it done."
        />
      ) : (
        <div className="space-y-3">
          {d.requests.map((r: any) => {
            const w = Array.isArray(r.worker) ? r.worker[0] : r.worker;
            const bank = d.banks[r.worker_id];
            const balance = d.balances[r.worker_id] ?? 0;
            const overdrawn = r.status === "pending" && r.amount > balance + r.amount; // sanity guard
            return (
              <Card key={r.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <h3 className="font-black text-white">{w?.full_name ?? "Unknown worker"}</h3>
                      <Pill tone={r.status === "pending" ? "orange" : r.status === "completed" ? "green" : "red"}>{r.status}</Pill>
                      {bank && !bank.verified && <Pill tone="red">Bank unverified</Pill>}
                    </div>
                    <p className="text-[11px] font-semibold text-white/40">
                      Requested {new Date(r.requested_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                      {w?.reliability_score != null && ` · ${Math.round(w.reliability_score)}% reliable`}
                      {w?.avg_rating ? ` · ⭐ ${Number(w.avg_rating).toFixed(1)}` : ""}
                    </p>
                    {bank ? (
                      <p className="text-[11px] font-bold text-white/60 mt-2 flex items-center gap-1.5">
                        <Landmark size={12} className="text-[#F4511E]" />
                        {bank.holder} · ····{bank.tail} · {bank.ifsc}
                      </p>
                    ) : (
                      <p className="text-[11px] font-bold text-red-400 mt-2 flex items-center gap-1.5">
                        <AlertTriangle size={12} /> No bank details on file — don't pay this out
                      </p>
                    )}
                    <p className="text-[10px] font-semibold text-white/30 mt-1">
                      Wallet balance after this request: {inr(balance)}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-2xl font-black text-[#F4511E] leading-none mb-3">{inr(r.amount)}</p>
                    {r.status === "pending" && (
                      <div className="flex gap-2">
                        <button type="button" disabled={busy || !bank}
                          onClick={() => decide(r.id, "approve")}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-green-500/15 border border-green-500/30 text-green-400 text-[11px] font-black uppercase tracking-wider hover:bg-green-500/25 transition-colors btn-tap disabled:opacity-40">
                          <CheckCircle2 size={12} /> Paid
                        </button>
                        <button type="button" disabled={busy}
                          onClick={() => { setRejecting(r); setReason(""); }}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-[11px] font-black uppercase tracking-wider hover:bg-red-500/25 transition-colors btn-tap disabled:opacity-50">
                          <XCircle size={12} /> Reject
                        </button>
                      </div>
                    )}
                    {r.status === "rejected" && r.rejection_reason && (
                      <p className="text-[10px] font-semibold text-red-400/70 max-w-[200px]">{r.rejection_reason}</p>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {rejecting && (
        <div className="fixed inset-0 z-[100] bg-black/85 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#1C1C1C] border border-white/10 rounded-3xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="font-black text-white mb-2">Reject {inr(rejecting.amount)} withdrawal?</h3>
            <p className="text-xs font-medium text-white/45 mb-4 leading-relaxed">
              The amount goes straight back into their wallet and they're notified with your reason.
            </p>
            <label htmlFor="reject-why" className="block text-[10px] font-black uppercase tracking-wider text-white/50 mb-1.5">Reason (shown to the worker)</label>
            <textarea id="reject-why" rows={3} value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Bank details don't match your verified name."
              className="w-full p-3 rounded-xl bg-[#111111] border border-white/10 text-white text-sm font-medium placeholder:text-white/30 focus:outline-none focus:border-[#F4511E] resize-none mb-4" />
            <div className="flex gap-2">
              <button type="button" onClick={() => setRejecting(null)}
                className="flex-1 py-3 rounded-xl border border-white/15 text-white/70 text-sm font-bold btn-tap">Cancel</button>
              <button type="button" disabled={busy} onClick={() => decide(rejecting.id, "reject", reason)}
                className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-black btn-tap disabled:opacity-50">Reject</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
