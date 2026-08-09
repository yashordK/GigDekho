import { useState } from "react";
import { useLoaderData, useRevalidator } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { requireAdmin } from "~/lib/admin.server";
import { PageTitle, Card, Pill, EmptyState } from "~/components/AdminUI";
import PostGigModal from "~/components/PostGigModal";
import Toast from "~/components/Toast";
import { Building2, Plus, Mail, Send, CheckCircle2, X, Briefcase, ExternalLink } from "lucide-react";

export async function loader({ request }: LoaderFunctionArgs) {
  const { admin } = await requireAdmin(request);

  const { data: accounts } = await admin
    .from("profiles")
    .select("id, full_name, company_name, email, phone, city, created_at, claimed_at, internal_note, is_managed")
    .eq("is_managed", true)
    .order("created_at", { ascending: false });

  const ids = (accounts ?? []).map((a) => a.id);
  let gigCounts: Record<string, number> = {};
  if (ids.length > 0) {
    const { data: gigs } = await admin.from("gigs").select("organizer_id").in("organizer_id", ids);
    for (const g of gigs ?? []) {
      gigCounts[g.organizer_id] = (gigCounts[g.organizer_id] ?? 0) + 1;
    }
  }

  return { accounts: accounts ?? [], gigCounts };
}

export default function AdminAccounts() {
  const { accounts, gigCounts } = useLoaderData<typeof loader>();
  const revalidator = useRevalidator();
  const [showCreate, setShowCreate] = useState(false);
  const [postingFor, setPostingFor] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const [form, setForm] = useState({ name: "", company_name: "", email: "", phone: "", city: "Indore", internal_note: "" });

  const showToast = (message: string, type: "success" | "error" | "info") => setToast({ message, type });

  const submit = async (intent: string, fields: Record<string, string>) => {
    const fd = new FormData();
    fd.append("intent", intent);
    Object.entries(fields).forEach(([k, v]) => fd.append(k, v));
    let res: Response;
    try {
      res = await fetch("/api/admin/accounts", { method: "POST", body: fd });
    } catch {
      // fetch() only rejects when the response never arrived at all
      throw new Error("Couldn't reach the server. Check your connection and try again.");
    }

    // Never assume the body is JSON — an auth redirect or a proxy error page
    // would otherwise surface as an unreadable "Unexpected token" parse error.
    const raw = await res.text();
    let r: any = {};
    try {
      r = raw ? JSON.parse(raw) : {};
    } catch {
      throw new Error(
        res.status === 404
          ? "That admin endpoint wasn't found on this deployment."
          : `Server returned ${res.status}. Please try again.`
      );
    }
    if (!res.ok || r.error) throw new Error(r.error || `Something went wrong (${res.status})`);
    return r;
  };

  const createAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await submit("create", form);
      showToast(`Account created for ${form.company_name || form.name}. Claim email sent.`, "success");
      setForm({ name: "", company_name: "", email: "", phone: "", city: "Indore", internal_note: "" });
      setShowCreate(false);
      revalidator.revalidate();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const resendClaim = async (account: any) => {
    setBusy(true);
    try {
      await submit("resend_claim", { account_id: account.id });
      showToast(`Claim email re-sent to ${account.email}`, "success");
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const inputCls = "w-full h-11 px-4 rounded-xl bg-[#111111] border border-white/10 text-white text-sm font-semibold placeholder:text-white/30 focus:outline-none focus:border-[#F4511E]";
  const labelCls = "block text-[11px] font-black text-white/60 uppercase tracking-wider mb-1.5";

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <PageTitle
        title="Managed Accounts"
        subtitle="Set up hirers yourself and post for them. They take control by signing in with the same email."
        action={
          <button
            type="button"
            onClick={() => { setShowCreate(true); setError(""); }}
            className="flex items-center gap-2 bg-[#F4511E] hover:bg-[#D84315] text-white px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-colors btn-tap"
          >
            <Plus size={15} /> New Account
          </button>
        }
      />

      {accounts.length === 0 ? (
        <EmptyState
          icon={<Building2 size={22} />}
          title="No managed accounts yet"
          hint="Create one for a business you're onboarding — you can post their listings immediately, and they take over whenever they're ready by signing in with their email."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {accounts.map((a) => (
            <Card key={a.id} className="p-5">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="font-black text-white truncate">{a.company_name || a.full_name}</h3>
                    {a.claimed_at ? <Pill tone="green">Claimed</Pill> : <Pill tone="orange">Unclaimed</Pill>}
                  </div>
                  <p className="text-[11px] font-semibold text-white/40 truncate">{a.email}</p>
                  <p className="text-[11px] font-semibold text-white/30 truncate">
                    {a.full_name}{a.phone ? ` · ${a.phone}` : ""} · {a.city}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-lg font-black text-white leading-none">{gigCounts[a.id] ?? 0}</p>
                  <p className="text-[9px] font-black uppercase tracking-widest text-white/30 mt-1">listings</p>
                </div>
              </div>

              {a.internal_note && (
                <p className="text-[11px] font-medium text-white/40 bg-[#111111] rounded-lg px-3 py-2 border border-white/5 mb-3">
                  {a.internal_note}
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setPostingFor(a)}
                  className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider bg-[#F4511E]/10 border border-[#F4511E]/25 text-[#F4511E] px-3.5 py-2 rounded-full hover:bg-[#F4511E]/20 transition-colors btn-tap"
                >
                  <Briefcase size={12} /> Post for them
                </button>
                <button
                  type="button"
                  onClick={() => resendClaim(a)}
                  disabled={busy}
                  className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider bg-[#111111] border border-white/10 text-white/60 hover:text-white px-3.5 py-2 rounded-full transition-colors btn-tap disabled:opacity-50"
                >
                  <Mail size={12} /> Resend claim
                </button>
                <a
                  href={`/hirer/${a.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider bg-[#111111] border border-white/10 text-white/60 hover:text-white px-3.5 py-2 rounded-full transition-colors btn-tap"
                >
                  <ExternalLink size={12} /> Profile
                </a>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create account */}
      {showCreate && (
        <div className="fixed inset-0 z-[100] bg-black/85 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
          <div className="bg-[#1C1C1C] border-t sm:border border-white/10 w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl max-h-[92dvh] overflow-y-auto hide-scrollbar">
            <div className="flex justify-between items-center mb-1">
              <h3 className="text-lg font-black text-white">New managed account</h3>
              <button type="button" aria-label="Close" onClick={() => setShowCreate(false)} className="p-2 bg-white/10 text-white/60 hover:text-white rounded-full btn-tap">
                <X size={16} />
              </button>
            </div>
            <p className="text-[11px] font-medium text-white/40 mb-5">
              No verification step — the account is active immediately and they're emailed a link to take control.
            </p>

            {error && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs font-semibold">{error}</div>}

            <form onSubmit={createAccount} className="space-y-4">
              <div>
                <label htmlFor="ma-company" className={labelCls}>Business / Organisation</label>
                <input id="ma-company" type="text" placeholder="e.g. Sayaji Hotels" value={form.company_name}
                  onChange={(e) => setForm({ ...form, company_name: e.target.value })} className={inputCls} />
                <p className="text-[10px] font-medium text-white/25 mt-1">Leave blank for an individual hirer.</p>
              </div>
              <div>
                <label htmlFor="ma-name" className={labelCls}>Contact person *</label>
                <input id="ma-name" type="text" placeholder="e.g. Ramesh Sharma" value={form.name} required
                  onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label htmlFor="ma-email" className={labelCls}>Their email *</label>
                <input id="ma-email" type="email" placeholder="owner@business.com" value={form.email} required
                  onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} />
                <p className="text-[10px] font-medium text-white/25 mt-1">This is how they'll sign in and take over the account.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="ma-phone" className={labelCls}>Phone</label>
                  <input id="ma-phone" type="tel" value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label htmlFor="ma-city" className={labelCls}>City</label>
                  <input id="ma-city" type="text" value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })} className={inputCls} />
                </div>
              </div>
              <div>
                <label htmlFor="ma-note" className={labelCls}>Internal note (only you see this)</label>
                <textarea id="ma-note" rows={2} placeholder="How you met them, what they need…" value={form.internal_note}
                  onChange={(e) => setForm({ ...form, internal_note: e.target.value })}
                  className="w-full p-3 rounded-xl bg-[#111111] border border-white/10 text-white text-sm font-medium placeholder:text-white/30 focus:outline-none focus:border-[#F4511E] resize-none" />
              </div>

              <button type="submit" disabled={busy}
                className="w-full py-3.5 bg-[#F4511E] hover:bg-[#D84315] text-white rounded-xl font-black text-sm btn-tap disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                <Send size={14} /> {busy ? "Creating…" : "Create & send claim email"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Post on behalf — reuses the real posting form, submitting as the managed account */}
      {postingFor && (
        <PostGigModal
          isOpen={true}
          onClose={() => setPostingFor(null)}
          user={{ id: postingFor.id }}
          showToast={showToast}
          onSuccess={async () => {
            try {
              await submit("notify_posted", {
                account_id: postingFor.id,
                gig_title: "your new listing",
                role_count: "1",
              });
            } catch (e) {
              console.error(e);
            }
            revalidator.revalidate();
          }}
        />
      )}

      {accounts.length > 0 && (
        <div className="mt-8 bg-[#1C1C1C] border border-white/5 rounded-2xl p-5 flex items-start gap-3">
          <CheckCircle2 size={16} className="text-green-400 shrink-0 mt-0.5" />
          <p className="text-[11px] font-medium text-white/45 leading-relaxed">
            Every account creation and post-on-behalf is written to the admin audit log with your name and a timestamp.
            Businesses are told in plain language that the account is theirs and how to have it deleted.
          </p>
        </div>
      )}
    </div>
  );
}
