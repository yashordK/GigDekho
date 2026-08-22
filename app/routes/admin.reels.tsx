import { useState } from "react";
import { useLoaderData, useRevalidator, Link } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { requireAdmin } from "~/lib/admin.server";
import { PageTitle, Card, Pill, EmptyState } from "~/components/AdminUI";
import Toast from "~/components/Toast";
import { Video, ExternalLink, CheckCircle2, XCircle, TrendingUp, IndianRupee } from "lucide-react";

/**
 * Reel review queue.
 *
 * Two independent decisions per reel — the reel itself, and the views claim —
 * because they prove different things and arrive at different times. Both pay
 * into the wallet, and both are idempotent: the wallet write is keyed on the
 * submission id and its type, so a double-click can't pay twice.
 *
 * View counts are checked by eye against an uploaded screenshot. Instagram
 * offers no lawful way to read a public reel's view count, so there is no
 * automatic path and the UI never pretends otherwise.
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const { admin } = await requireAdmin(request);

  const [{ data: reels }, { data: settings }] = await Promise.all([
    admin.from("reel_submissions")
      .select("*, worker:profiles!reel_submissions_worker_id_fkey(id, full_name, email), gig:gigs(id, title)")
      .order("created_at", { ascending: false })
      .limit(200),
    admin.from("app_settings").select("key, value").like("key", "reel%"),
  ]);

  const get = (k: string, d: number) => Number((settings ?? []).find((s: any) => s.key === k)?.value ?? d);

  return {
    reels: reels ?? [],
    rates: {
      perReel: get("reel_bonus_per_reel", 50),
      maxPerGig: get("reel_bonus_max_per_gig", 100),
      viewsBonus: get("reel_views_bonus", 50),
      threshold: get("reel_views_threshold", 3000),
    },
  };
}

export default function AdminReels() {
  const { reels, rates } = useLoaderData<typeof loader>();
  const revalidator = useRevalidator();
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const act = async (id: string, intent: string, withNote?: string) => {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("id", id);
      fd.append("intent", intent);
      if (withNote) fd.append("note", withNote);
      const res = await fetch("/api/admin/reels", { method: "POST", body: fd });
      const raw = await res.text();
      let r: any = {};
      try { r = raw ? JSON.parse(raw) : {}; } catch { throw new Error(`Server returned ${res.status}`); }
      if (!res.ok || r.error) throw new Error(r.error || "Something went wrong");
      setToast({ message: intent.startsWith("approve") ? "Approved and paid." : "Rejected.", type: "success" });
      setNoteFor(null); setNote("");
      revalidator.revalidate();
    } catch (e: any) {
      setToast({ message: e.message, type: "error" });
    } finally {
      setBusy(false);
    }
  };

  const pendingReels = reels.filter((r: any) => r.status === "pending");
  const pendingViews = reels.filter((r: any) => r.status === "approved" && r.views_status === "pending");
  const done = reels.filter((r: any) => r.status !== "pending" && r.views_status !== "pending");

  const Row = ({ r, mode }: { r: any; mode: "reel" | "views" }) => (
    <Card key={r.id + mode} className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Link to={`/admin/users/${r.worker?.id}`} className="font-black text-white hover:text-[#F4511E] transition-colors">
              {r.worker?.full_name || r.worker?.email || "Unknown"}
            </Link>
            <Pill tone="neutral">{r.platform}</Pill>
            {!r.public_account_confirmed && <Pill tone="red">public not confirmed</Pill>}
            {mode === "views" && <Pill tone="orange">views claim</Pill>}
          </div>
          <p className="text-[11px] font-semibold text-white/40 truncate">{r.gig?.title ?? "listing removed"}</p>
          <div className="flex flex-wrap gap-3 mt-2">
            <a href={r.reel_url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[11px] font-black text-[#F4511E] hover:underline">
              <ExternalLink size={11} /> Open reel
            </a>
            {mode === "views" && r.views_proof_url && (
              <a href={r.views_proof_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[11px] font-black text-blue-400 hover:underline">
                <ExternalLink size={11} /> View-count screenshot
              </a>
            )}
          </div>
          {mode === "views" && (
            <p className="text-[10px] font-semibold text-white/30 mt-2">
              Approve only if the screenshot clearly shows more than {rates.threshold.toLocaleString("en-IN")} views on this reel.
            </p>
          )}
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          <span className="text-[11px] font-black text-white/50 flex items-center gap-1">
            <IndianRupee size={11} />{mode === "reel" ? rates.perReel : rates.viewsBonus}
          </span>
          <div className="flex gap-2">
            <button type="button" disabled={busy}
              onClick={() => act(r.id, mode === "reel" ? "approve" : "approve_views")}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-green-500/10 border border-green-500/30 text-green-400 text-[11px] font-black uppercase tracking-wider hover:bg-green-500/20 transition-colors btn-tap disabled:opacity-50">
              <CheckCircle2 size={12} /> Approve & pay
            </button>
            <button type="button" disabled={busy}
              onClick={() => { if (mode === "views") act(r.id, "reject_views"); else setNoteFor(r.id); }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-[11px] font-black uppercase tracking-wider hover:bg-red-500/20 transition-colors btn-tap disabled:opacity-50">
              <XCircle size={12} /> Reject
            </button>
          </div>
        </div>
      </div>

      {noteFor === r.id && mode === "reel" && (
        <div className="mt-3 pt-3 border-t border-white/5 flex gap-2 flex-wrap">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Why? They'll see this."
            className="flex-1 min-w-[200px] h-10 px-3 rounded-xl bg-[#111111] border border-white/10 text-white text-xs font-semibold placeholder:text-white/30 focus:outline-none focus:border-[#F4511E]"
          />
          <button type="button" disabled={busy} onClick={() => act(r.id, "reject", note)}
            className="px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-[11px] font-black uppercase tracking-wider btn-tap disabled:opacity-50">
            Confirm reject
          </button>
          <button type="button" onClick={() => { setNoteFor(null); setNote(""); }}
            className="px-4 py-2 rounded-xl border border-white/10 text-white/60 text-[11px] font-black uppercase tracking-wider btn-tap">
            Cancel
          </button>
        </div>
      )}
    </Card>
  );

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <PageTitle
        title="Reel Rewards"
        subtitle={`₹${rates.perReel} per approved reel (max ₹${rates.maxPerGig} a gig), plus ₹${rates.viewsBonus} once a reel passes ${rates.threshold.toLocaleString("en-IN")} views.`}
      />

      <div className="mb-6">
        <h3 className="text-sm font-black text-white mb-3 flex items-center gap-2">
          <Video size={15} className="text-[#F4511E]" /> Reels awaiting review ({pendingReels.length})
        </h3>
        {pendingReels.length === 0 ? (
          <EmptyState icon={<Video size={22} />} title="Nothing waiting" hint="New reel submissions land here." />
        ) : (
          <div className="space-y-3">{pendingReels.map((r: any) => <Row key={r.id} r={r} mode="reel" />)}</div>
        )}
      </div>

      <div className="mb-6">
        <h3 className="text-sm font-black text-white mb-3 flex items-center gap-2">
          <TrendingUp size={15} className="text-[#F4511E]" /> Views claims ({pendingViews.length})
        </h3>
        {pendingViews.length === 0 ? (
          <EmptyState icon={<TrendingUp size={22} />} title="No views claims" hint="These appear when a worker says their reel passed the target." />
        ) : (
          <div className="space-y-3">{pendingViews.map((r: any) => <Row key={r.id} r={r} mode="views" />)}</div>
        )}
      </div>

      {done.length > 0 && (
        <div>
          <h3 className="text-sm font-black text-white/50 mb-3">Settled ({done.length})</h3>
          <div className="space-y-2">
            {done.slice(0, 30).map((r: any) => (
              <Card key={r.id} className="p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-[12px] font-black text-white truncate">{r.worker?.full_name || r.worker?.email}</p>
                    <p className="text-[10px] font-semibold text-white/35 truncate">{r.gig?.title}{r.review_note ? ` · ${r.review_note}` : ""}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Pill tone={r.status === "approved" ? "green" : "red"}>{r.status}</Pill>
                    {r.views_status !== "none" && (
                      <Pill tone={r.views_status === "approved" ? "green" : "red"}>views {r.views_status}</Pill>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
