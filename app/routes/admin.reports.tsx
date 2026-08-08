import { useState } from "react";
import { useLoaderData, useRevalidator, useSearchParams } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { requireAdmin, logAdminAction } from "~/lib/admin.server";
import { PageTitle, Card, Pill, EmptyState } from "~/components/AdminUI";
import { Flag, ChevronDown, ChevronUp, ExternalLink, ShieldCheck } from "lucide-react";

const STATUSES = ["open", "investigating", "resolved", "dismissed"] as const;

export async function loader({ request }: LoaderFunctionArgs) {
  const { admin } = await requireAdmin(request);
  const status = new URL(request.url).searchParams.get("status") ?? "open";

  let query = admin
    .from("reports")
    .select("*, reporter:profiles!reports_reporter_id_fkey(full_name, email, role)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (status !== "all") query = query.eq("status", status);

  const { data: reports } = await query;

  const counts: Record<string, number> = {};
  for (const s of STATUSES) {
    const { count } = await admin.from("reports").select("id", { count: "exact", head: true }).eq("status", s);
    counts[s] = count ?? 0;
  }

  return { reports: reports ?? [], counts, status };
}

export async function action({ request }: ActionFunctionArgs) {
  const ctx = await requireAdmin(request);
  const fd = await request.formData();
  const id = String(fd.get("id") ?? "");
  const status = String(fd.get("status") ?? "");
  const note = String(fd.get("admin_note") ?? "").trim();

  if (!id || !STATUSES.includes(status as any)) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const resolved = status === "resolved" || status === "dismissed";
  const { error } = await ctx.admin.from("reports").update({
    status,
    admin_note: note || null,
    resolved_by: resolved ? ctx.adminId : null,
    resolved_at: resolved ? new Date().toISOString() : null,
  }).eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  await logAdminAction(ctx, "resolve_report", `Report ${id} → ${status}${note ? `: ${note}` : ""}`);
  return Response.json({ ok: true });
}

const PRIORITY_TONE: Record<string, string> = { urgent: "red", high: "orange", normal: "neutral", low: "neutral" };
const STATUS_TONE: Record<string, string> = { open: "red", investigating: "yellow", resolved: "green", dismissed: "neutral" };

export default function AdminReports() {
  const { reports, counts, status } = useLoaderData<typeof loader>();
  const [params, setParams] = useSearchParams();
  const revalidator = useRevalidator();
  const [openId, setOpenId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const update = async (id: string, newStatus: string) => {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("id", id);
      fd.append("status", newStatus);
      fd.append("admin_note", notes[id] ?? "");
      await fetch("/admin/reports", { method: "POST", body: fd });
      revalidator.revalidate();
      setOpenId(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageTitle title="Reports" subtitle="Issues raised by workers and hirers. Safety and fraud are auto-prioritised." />

      <div className="flex flex-wrap gap-2 mb-6">
        {(["open", "investigating", "resolved", "dismissed", "all"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => { params.set("status", s); setParams(params); }}
            className={`px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-wider border transition-colors btn-tap min-h-0 ${
              status === s ? "bg-[#F4511E] border-[#F4511E] text-white" : "border-white/10 text-white/50 hover:text-white"
            }`}
            style={{ minHeight: "34px" }}
          >
            {s} {s !== "all" && counts[s] > 0 ? `(${counts[s]})` : ""}
          </button>
        ))}
      </div>

      {reports.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck size={22} />}
          title={status === "open" ? "No open reports" : `No ${status} reports`}
          hint="When someone reports a safety concern, scam, payment problem or no-show, it lands here and you're emailed for the urgent ones."
        />
      ) : (
        <div className="space-y-3">
          {reports.map((r: any) => {
            const isOpen = openId === r.id;
            const reporter = Array.isArray(r.reporter) ? r.reporter[0] : r.reporter;
            return (
              <Card key={r.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(isOpen ? null : r.id)}
                  aria-expanded={isOpen}
                  className="w-full px-5 py-4 flex items-start justify-between gap-3 text-left hover:bg-white/[0.02] transition-colors rounded-2xl"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <Pill tone={PRIORITY_TONE[r.priority]}>{r.priority}</Pill>
                      <Pill tone="purple">{r.category}</Pill>
                      <Pill tone={STATUS_TONE[r.status]}>{r.status}</Pill>
                    </div>
                    <p className="text-sm font-bold text-white truncate">{r.subject || `${r.category} report`}</p>
                    <p className="text-[11px] font-semibold text-white/35 truncate">
                      {reporter?.full_name ?? "Unknown"} ({reporter?.role ?? "—"}) ·{" "}
                      {new Date(r.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                    </p>
                  </div>
                  {isOpen ? <ChevronUp size={16} className="text-white/30 shrink-0 mt-1" /> : <ChevronDown size={16} className="text-white/30 shrink-0 mt-1" />}
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 border-t border-white/5 pt-4 space-y-4 animate-in fade-in duration-150">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-white/35 mb-1.5">What they said</p>
                      <p className="text-sm font-medium text-white/75 leading-relaxed whitespace-pre-wrap bg-[#111111] rounded-xl p-4 border border-white/5">
                        {r.description}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2 text-[11px] font-semibold text-white/40">
                      <span>Target: {r.target_type}</span>
                      {r.target_id && r.target_type === "gig" && (
                        <a href={`/gigs/${r.target_id}`} target="_blank" rel="noopener noreferrer" className="text-[#F4511E] hover:underline flex items-center gap-1">
                          view listing <ExternalLink size={10} />
                        </a>
                      )}
                      {r.target_id && r.target_type === "user" && (
                        <a href={`/hirer/${r.target_id}`} target="_blank" rel="noopener noreferrer" className="text-[#F4511E] hover:underline flex items-center gap-1">
                          view profile <ExternalLink size={10} />
                        </a>
                      )}
                      {reporter?.email && <span>· Reporter: {reporter.email}</span>}
                    </div>

                    {r.admin_note && (
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-white/35 mb-1">Previous note</p>
                        <p className="text-xs font-medium text-white/55">{r.admin_note}</p>
                      </div>
                    )}

                    <div>
                      <label htmlFor={`note-${r.id}`} className="block text-[10px] font-black uppercase tracking-widest text-white/35 mb-1.5">
                        Your note (kept internal)
                      </label>
                      <textarea
                        id={`note-${r.id}`} rows={2}
                        value={notes[r.id] ?? ""}
                        onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })}
                        placeholder="What you found, what action you took…"
                        className="w-full p-3 rounded-xl bg-[#111111] border border-white/10 text-white text-sm font-medium placeholder:text-white/30 focus:outline-none focus:border-[#F4511E] resize-none"
                      />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {STATUSES.filter((s) => s !== r.status).map((s) => (
                        <button
                          key={s}
                          type="button"
                          disabled={busy}
                          onClick={() => update(r.id, s)}
                          className={`px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-wider border transition-colors btn-tap disabled:opacity-50 min-h-0 ${
                            s === "resolved" ? "bg-green-500/10 border-green-500/30 text-green-400"
                            : s === "dismissed" ? "bg-white/5 border-white/15 text-white/50"
                            : s === "investigating" ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-400"
                            : "bg-red-500/10 border-red-500/30 text-red-400"
                          }`}
                          style={{ minHeight: "32px" }}
                        >
                          Mark {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
