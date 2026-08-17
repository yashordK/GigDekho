import { useState } from "react";
import { useLoaderData, useRevalidator, Form, useSearchParams , Link } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { requireAdmin, logAdminAction } from "~/lib/admin.server";
import { PageTitle, Card, Pill, EmptyState } from "~/components/AdminUI";
import {
  Search, Ban, ShieldCheck, Crown, GraduationCap, BadgeCheck, Building2,
  Users as UsersIcon, Wallet, ExternalLink, Plus, Minus,
} from "lucide-react";

const BADGES = [
  { key: "id_verified", label: "ID Verified", icon: <ShieldCheck size={12} /> },
  { key: "business_verified", label: "Verified Business", icon: <Building2 size={12} /> },
  { key: "basics_certified", label: "Basics Certified", icon: <BadgeCheck size={12} /> },
  { key: "campus_ambassador", label: "Campus Ambassador", icon: <Crown size={12} /> },
];

export async function loader({ request }: LoaderFunctionArgs) {
  const { admin } = await requireAdmin(request);
  const q = (new URL(request.url).searchParams.get("q") ?? "").trim();

  let query = admin
    .from("profiles")
    .select("id, full_name, email, phone, role, city, avg_rating, reliability_score, worker_level, is_suspended, is_admin, is_managed, id_verified, business_verified, basics_certified, campus_ambassador, student_status, created_at")
    .order("created_at", { ascending: false })
    .limit(40);
  if (q) query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`);

  const { data: users } = await query;

  // Wallet balances for the visible workers
  const ids = (users ?? []).map((u) => u.id);
  const balances: Record<string, number> = {};
  if (ids.length) {
    const { data } = await admin.from("wallet_transactions").select("worker_id, amount").in("worker_id", ids).neq("status", "failed");
    for (const t of data ?? []) balances[t.worker_id] = (balances[t.worker_id] ?? 0) + t.amount;
  }

  return { users: users ?? [], balances, q };
}

export async function action({ request }: ActionFunctionArgs) {
  const ctx = await requireAdmin(request);
  const fd = await request.formData();
  const intent = String(fd.get("intent") ?? "");
  const userId = String(fd.get("user_id") ?? "");
  if (!userId) return Response.json({ error: "Missing user" }, { status: 400 });

  if (intent === "toggle_field") {
    const field = String(fd.get("field") ?? "");
    const allowed = ["id_verified", "business_verified", "basics_certified", "campus_ambassador", "is_suspended"];
    if (!allowed.includes(field)) return Response.json({ error: "Invalid field" }, { status: 400 });

    const { data: current } = await ctx.admin.from("profiles").select(field).eq("id", userId).single();
    const next = !(current as any)?.[field];
    await ctx.admin.from("profiles").update({ [field]: next }).eq("id", userId);

    const action = field === "is_suspended"
      ? (next ? "suspend_user" : "unsuspend_user")
      : (next ? "grant_badge" : "revoke_badge");
    await logAdminAction(ctx, action, `${field} → ${next}`, { targetUserId: userId });

    if (field === "is_suspended") {
      await ctx.admin.from("notifications").insert({
        user_id: userId,
        type: "system",
        title: next ? "Your account has been suspended" : "Your account has been restored",
        body: next
          ? "Contact GigDekho support if you believe this is a mistake."
          : "You can use GigDekho normally again.",
        link: "/worker/profile",
      });
    }
    return Response.json({ ok: true, value: next });
  }

  if (intent === "student_verified") {
    const { data: current } = await ctx.admin.from("profiles").select("student_status").eq("id", userId).single();
    const next = current?.student_status === "student_verified" ? "student_unverified" : "student_verified";
    await ctx.admin.from("profiles").update({ student_status: next }).eq("id", userId);
    await logAdminAction(ctx, next === "student_verified" ? "grant_badge" : "revoke_badge", `student_status → ${next}`, { targetUserId: userId });
    return Response.json({ ok: true });
  }

  // Manual wallet correction — for refunds, goodwill credits, dispute fixes
  if (intent === "wallet_adjust") {
    const amount = Math.round(Number(fd.get("amount")));
    const note = String(fd.get("note") ?? "").trim();
    if (!Number.isFinite(amount) || amount === 0) {
      return Response.json({ error: "Enter a non-zero amount" }, { status: 400 });
    }
    if (!note) return Response.json({ error: "A reason is required" }, { status: 400 });

    await ctx.admin.from("wallet_transactions").insert({
      worker_id: userId,
      amount,
      type: amount > 0 ? "bonus" : "penalty_deduction",
      status: "completed",
      description: `Admin adjustment: ${note}`,
    });
    await logAdminAction(ctx, "wallet_adjustment", `${amount > 0 ? "+" : ""}₹${amount}: ${note}`, { targetUserId: userId });
    await ctx.admin.from("notifications").insert({
      user_id: userId,
      type: "system",
      title: amount > 0 ? `₹${amount} added to your wallet` : `₹${Math.abs(amount)} deducted from your wallet`,
      body: note,
      link: "/worker/earnings",
    });
    return Response.json({ ok: true });
  }

  return Response.json({ error: "Unknown intent" }, { status: 400 });
}

export default function AdminUsers() {
  const { users, balances, q } = useLoaderData<typeof loader>();
  const revalidator = useRevalidator();
  const [busy, setBusy] = useState(false);
  const [adjusting, setAdjusting] = useState<any>(null);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustNote, setAdjustNote] = useState("");
  const [adjustError, setAdjustError] = useState("");

  const post = async (fields: Record<string, string>) => {
    const fd = new FormData();
    Object.entries(fields).forEach(([k, v]) => fd.append(k, v));
    const res = await fetch("/admin/users", { method: "POST", body: fd });
    const r = await res.json();
    if (!res.ok || r.error) throw new Error(r.error || "Failed");
    return r;
  };

  const toggle = async (userId: string, field: string) => {
    setBusy(true);
    try { await post({ intent: "toggle_field", user_id: userId, field }); revalidator.revalidate(); }
    finally { setBusy(false); }
  };

  const adjustWallet = async () => {
    setAdjustError("");
    try {
      await post({ intent: "wallet_adjust", user_id: adjusting.id, amount: adjustAmount, note: adjustNote });
      setAdjusting(null); setAdjustAmount(""); setAdjustNote("");
      revalidator.revalidate();
    } catch (e: any) { setAdjustError(e.message); }
  };

  return (
    <div>
      <PageTitle title="Users" subtitle="Search anyone, manage badges, suspend accounts, and correct wallet balances." />

      <Form method="get" className="flex gap-2 mb-6">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
          <input type="text" name="q" defaultValue={q} placeholder="Search by name, email, or phone…"
            aria-label="Search users"
            className="w-full h-11 pl-11 pr-4 rounded-xl bg-[#1C1C1C] border border-white/10 text-white text-sm font-semibold placeholder:text-white/30 focus:outline-none focus:border-[#F4511E]" />
        </div>
        <button type="submit" className="px-6 h-11 bg-[#F4511E] hover:bg-[#D84315] rounded-xl text-sm font-black btn-tap">Search</button>
      </Form>

      {users.length === 0 ? (
        <EmptyState icon={<UsersIcon size={22} />} title="No users found" hint="Try a different name, email or phone number." />
      ) : (
        <div className="space-y-3">
          {users.map((u: any) => (
            <Card key={u.id} className={`p-5 ${u.is_suspended ? "border-red-500/30" : ""}`}>
              <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <Link
                      to={`/admin/users/${u.id}`}
                      className="font-black text-white hover:text-[#F4511E] transition-colors underline decoration-white/20 underline-offset-4"
                    >
                      {u.full_name || "Unnamed"}
                    </Link>
                    {u.is_admin && <Pill tone="orange">Admin</Pill>}
                    {u.is_managed && <Pill tone="purple">Managed</Pill>}
                    {u.is_suspended && <Pill tone="red">Suspended</Pill>}
                  </div>
                  <p className="text-[11px] font-semibold text-white/40 truncate">
                    {u.role} · {u.email || "no email"} · {u.phone || "no phone"} · {u.city}
                  </p>
                  <p className="text-[11px] font-semibold text-white/30">
                    {u.worker_level} · ⭐ {u.avg_rating ? Number(u.avg_rating).toFixed(1) : "—"} ·{" "}
                    {u.reliability_score != null ? `${Math.round(u.reliability_score)}% reliable` : "—"} ·{" "}
                    joined {new Date(u.created_at).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <p className="text-[9px] font-black uppercase tracking-widest text-white/30">Wallet</p>
                    <p className="text-sm font-black text-white">₹{(balances[u.id] ?? 0).toLocaleString("en-IN")}</p>
                  </div>
                  <button type="button" onClick={() => { setAdjusting(u); setAdjustError(""); }}
                    aria-label="Adjust wallet"
                    className="p-2 rounded-lg bg-[#111111] border border-white/10 text-white/50 hover:text-white transition-colors btn-tap">
                    <Wallet size={14} />
                  </button>
                  <a href={`/hirer/${u.id}`} target="_blank" rel="noopener noreferrer" aria-label="View profile"
                    className="p-2 rounded-lg bg-[#111111] border border-white/10 text-white/50 hover:text-white transition-colors btn-tap">
                    <ExternalLink size={14} />
                  </a>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {BADGES.map((b) => (
                  <button key={b.key} type="button" disabled={busy} onClick={() => toggle(u.id, b.key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold border transition-colors btn-tap disabled:opacity-50 min-h-0 ${
                      u[b.key]
                        ? (b.key === "campus_ambassador"
                            ? "bg-amber-500/15 text-amber-400 border-amber-500/40"
                            : "bg-[#F4511E]/15 text-[#F4511E] border-[#F4511E]/40")
                        : "border-white/10 text-white/35 hover:text-white/70"
                    }`} style={{ minHeight: "30px" }}>
                    {b.icon} {b.label} {u[b.key] ? "✓" : ""}
                  </button>
                ))}
                <button type="button" disabled={busy} onClick={async () => { setBusy(true); try { await post({ intent: "student_verified", user_id: u.id }); revalidator.revalidate(); } finally { setBusy(false); } }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold border transition-colors btn-tap disabled:opacity-50 min-h-0 ${
                    u.student_status === "student_verified" ? "bg-[#F4511E]/15 text-[#F4511E] border-[#F4511E]/40" : "border-white/10 text-white/35 hover:text-white/70"
                  }`} style={{ minHeight: "30px" }}>
                  <GraduationCap size={12} /> Student {u.student_status === "student_verified" ? "✓" : ""}
                </button>
                <button type="button" disabled={busy || u.is_admin} onClick={() => toggle(u.id, "is_suspended")}
                  title={u.is_admin ? "Admins can't be suspended from here" : undefined}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black border transition-colors btn-tap disabled:opacity-30 min-h-0 ml-auto ${
                    u.is_suspended ? "bg-green-500/10 border-green-500/30 text-green-400" : "bg-red-500/10 border-red-500/30 text-red-400"
                  }`} style={{ minHeight: "30px" }}>
                  <Ban size={12} /> {u.is_suspended ? "Unsuspend" : "Suspend"}
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {adjusting && (
        <div className="fixed inset-0 z-[100] bg-black/85 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#1C1C1C] border border-white/10 rounded-3xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="font-black text-white mb-1">Adjust wallet</h3>
            <p className="text-[11px] font-medium text-white/40 mb-4">
              {adjusting.full_name} · current balance ₹{(balances[adjusting.id] ?? 0).toLocaleString("en-IN")}
            </p>
            {adjustError && <div className="mb-3 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs font-semibold">{adjustError}</div>}
            <label htmlFor="adj-amt" className="block text-[10px] font-black uppercase tracking-wider text-white/50 mb-1.5">
              Amount (negative to deduct)
            </label>
            <div className="flex gap-2 mb-3">
              <button type="button" onClick={() => setAdjustAmount((a) => String(-Math.abs(Number(a) || 0)))} aria-label="Make negative"
                className="px-3 rounded-xl bg-[#111111] border border-white/10 text-red-400 btn-tap"><Minus size={14} /></button>
              <input id="adj-amt" type="number" value={adjustAmount} onChange={(e) => setAdjustAmount(e.target.value)}
                placeholder="500"
                className="flex-1 h-11 px-4 rounded-xl bg-[#111111] border border-white/10 text-white text-sm font-black focus:outline-none focus:border-[#F4511E]" />
              <button type="button" onClick={() => setAdjustAmount((a) => String(Math.abs(Number(a) || 0)))} aria-label="Make positive"
                className="px-3 rounded-xl bg-[#111111] border border-white/10 text-green-400 btn-tap"><Plus size={14} /></button>
            </div>
            <label htmlFor="adj-note" className="block text-[10px] font-black uppercase tracking-wider text-white/50 mb-1.5">Reason (shown to them)</label>
            <input id="adj-note" type="text" value={adjustNote} onChange={(e) => setAdjustNote(e.target.value)}
              placeholder="e.g. Goodwill credit for cancelled gig"
              className="w-full h-11 px-4 rounded-xl bg-[#111111] border border-white/10 text-white text-sm font-semibold placeholder:text-white/30 focus:outline-none focus:border-[#F4511E] mb-4" />
            <div className="flex gap-2">
              <button type="button" onClick={() => setAdjusting(null)}
                className="flex-1 py-3 rounded-xl border border-white/15 text-white/70 text-sm font-bold btn-tap">Cancel</button>
              <button type="button" onClick={adjustWallet}
                className="flex-1 py-3 rounded-xl bg-[#F4511E] hover:bg-[#D84315] text-white text-sm font-black btn-tap">Apply</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
