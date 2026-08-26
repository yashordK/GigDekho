import { useState } from "react";
import { useLoaderData, useRevalidator, useSearchParams } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { requireAdmin, logAdminAction } from "~/lib/admin.server";
import { PageTitle, Card, Pill, EmptyState, StatCard } from "~/components/AdminUI";
import { Banknote, CheckCircle2, XCircle, Landmark, Wallet, AlertTriangle, Smartphone, Copy, Check } from "lucide-react";

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
      .select("worker_id, method, account_number, ifsc, upi_id, account_holder, penny_drop_status")
      .in("worker_id", workerIds);
    for (const b of data ?? []) {
      // The UPI ID is sent whole because it is what has to be typed into a
      // payment app — masking it would make the screen useless for its one job.
      // The bank account number is not: only its last four digits are needed to
      // recognise the right account.
      banks[b.worker_id] = {
        method: b.method ?? "bank",
        upi: b.upi_id ?? null,
        tail: b.account_number ? String(b.account_number).slice(-4) : null,
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
  const reference = String(fd.get("reference") ?? "").trim();
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
      .update({
        status: "completed",
        processed_at: new Date().toISOString(),
        // The UTR / UPI reference is the only durable answer to "did you
        // actually pay me?" once the transfer has left the app.
        ...(reference ? { payment_reference: reference } : {}),
      }).eq("id", id);
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
      ? `The money has been sent.${reference ? ` Reference: ${reference}.` : ""} It usually lands within a few minutes.`
      : `${reason || "Please check your payout details and try again."} The amount is back in your wallet.`,
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
  const [paying, setPaying] = useState<any>(null);
  const [reason, setReason] = useState("");
  const [reference, setReference] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const decide = async (id: string, decision: "approve" | "reject", why = "", ref = "") => {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("id", id);
      fd.append("decision", decision);
      fd.append("reason", why);
      fd.append("reference", ref);
      await fetch("/admin/payouts", { method: "POST", body: fd });
      revalidator.revalidate();
      setRejecting(null);
      setPaying(null);
      setReason("");
      setReference("");
    } finally {
      setBusy(false);
    }
  };

  /** Puts the UPI ID on the clipboard so it never gets retyped by hand. */
  const copy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    } catch { /* clipboard blocked — the ID is on screen to read */ }
  };

  return (
    <div>
      <PageTitle title="Payouts" subtitle="Workers withdrawing their wallet balance. Send the money, then mark it paid." />

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
                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        {bank.method === "upi" ? (
                          <>
                            <span className="text-[11px] font-bold text-white/60 flex items-center gap-1.5">
                              <Smartphone size={12} className="text-[#F4511E]" />
                              {bank.holder}
                            </span>
                            <button type="button" onClick={() => copy(bank.upi, r.id)}
                              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F4511E]/10 border border-[#F4511E]/25 text-[#F4511E] text-[11px] font-black font-mono btn-tap hover:bg-[#F4511E]/20 transition-colors">
                              {copied === r.id ? <Check size={11} /> : <Copy size={11} />} {bank.upi}
                            </button>
                          </>
                        ) : (
                          <span className="text-[11px] font-bold text-white/60 flex items-center gap-1.5">
                            <Landmark size={12} className="text-[#F4511E]" />
                            {bank.holder} · ····{bank.tail} · {bank.ifsc}
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className="text-[11px] font-bold text-red-400 mt-2 flex items-center gap-1.5">
                        <AlertTriangle size={12} /> No payout details on file — don't pay this out
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
                          onClick={() => { setPaying({ ...r, bank }); setReference(""); }}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-green-500/15 border border-green-500/30 text-green-400 text-[11px] font-black uppercase tracking-wider hover:bg-green-500/25 transition-colors btn-tap disabled:opacity-40">
                          <CheckCircle2 size={12} /> Mark paid
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

      {paying && (
        <div className="fixed inset-0 z-[100] bg-black/85 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#1C1C1C] border border-white/10 rounded-3xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="font-black text-white mb-2">Send {inr(paying.amount)}</h3>
            <div className="bg-[#111111] border border-white/10 rounded-xl p-3.5 mb-4">
              <p className="text-[10px] font-black uppercase tracking-wider text-white/40 mb-1">Pay to</p>
              {paying.bank?.method === "upi" ? (
                <button type="button" onClick={() => copy(paying.bank.upi, "modal")}
                  className="flex items-center gap-2 text-sm font-black text-[#F4511E] font-mono btn-tap">
                  {copied === "modal" ? <Check size={13} /> : <Copy size={13} />} {paying.bank.upi}
                </button>
              ) : (
                <p className="text-sm font-black text-white">····{paying.bank?.tail} · {paying.bank?.ifsc}</p>
              )}
              <p className="text-[11px] font-semibold text-white/45 mt-1">{paying.bank?.holder}</p>
            </div>
            <p className="text-xs font-medium text-white/45 mb-4 leading-relaxed">
              Send the money from your own UPI or banking app first. Marking it paid here only records
              that you did — it does not move any money.
            </p>
            <label htmlFor="pay-ref" className="block text-[10px] font-black uppercase tracking-wider text-white/50 mb-1.5">
              Transaction reference (optional)
            </label>
            <input id="pay-ref" value={reference} onChange={(e) => setReference(e.target.value)}
              placeholder="UTR / UPI reference number"
              className="w-full h-11 px-4 rounded-xl bg-[#111111] border border-white/10 text-white text-sm font-semibold placeholder:text-white/30 focus:outline-none focus:border-[#F4511E] mb-4" />
            <div className="flex gap-2">
              <button type="button" onClick={() => setPaying(null)}
                className="flex-1 py-3 rounded-xl border border-white/15 text-white/70 text-sm font-bold btn-tap">Cancel</button>
              <button type="button" disabled={busy}
                onClick={() => decide(paying.id, "approve", "", reference)}
                className="flex-1 py-3 rounded-xl bg-green-500 hover:bg-green-600 text-white text-sm font-black btn-tap disabled:opacity-50">
                I've sent it
              </button>
            </div>
          </div>
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
