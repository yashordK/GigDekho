import { useState } from "react";
import { useLoaderData, useRevalidator, useSearchParams, Form } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { requireAdmin, logAdminAction } from "~/lib/admin.server";
import { PageTitle, Card, Pill, EmptyState } from "~/components/AdminUI";
import { Briefcase, Search, ExternalLink, XCircle, CheckCircle2, GraduationCap, Users, Pencil } from "lucide-react";
import EditGigModal from "~/components/EditGigModal";
import Toast from "~/components/Toast";

export async function loader({ request }: LoaderFunctionArgs) {
  const { admin } = await requireAdmin(request);
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const status = url.searchParams.get("status") ?? "open";
  const type = url.searchParams.get("type") ?? "all";

  let query = admin
    .from("gigs")
    .select("id, title, description, gig_type, status, event_date, created_at, location_text, slots_total, slots_filled, pay_rate, duration_hrs, is_urgent, role_type, custom_role, work_mode, commitment, duration_months, stipend_min, stipend_max, is_unpaid, jd_url, preferences, application_deadline, organizer_id, profiles!gigs_organizer_id_fkey(full_name, company_name, is_managed)")
    .order("created_at", { ascending: false })
    .limit(80);

  if (status !== "all") query = query.eq("status", status);
  if (type !== "all") query = query.eq("gig_type", type);
  if (q) query = query.ilike("title", `%${q}%`);

  const { data: gigs } = await query;

  // Applicant counts
  const ids = (gigs ?? []).map((g) => g.id);
  const applied: Record<string, number> = {};
  if (ids.length) {
    const [{ data: a1 }, { data: a2 }] = await Promise.all([
      admin.from("applications").select("gig_id").in("gig_id", ids),
      admin.from("internship_applications").select("gig_id").in("gig_id", ids),
    ]);
    for (const a of [...(a1 ?? []), ...(a2 ?? [])]) applied[a.gig_id] = (applied[a.gig_id] ?? 0) + 1;
  }

  return { gigs: gigs ?? [], applied, q, status, type };
}

export async function action({ request }: ActionFunctionArgs) {
  const ctx = await requireAdmin(request);
  const fd = await request.formData();
  const id = String(fd.get("id") ?? "");
  const newStatus = String(fd.get("status") ?? "");
  if (!id || !["open", "cancelled", "completed"].includes(newStatus)) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const { data: gig } = await ctx.admin.from("gigs").select("title, organizer_id").eq("id", id).single();
  const { error } = await ctx.admin.from("gigs").update({ status: newStatus }).eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  await logAdminAction(ctx, "moderate_gig", `Set "${gig?.title}" to ${newStatus}`, { targetUserId: gig?.organizer_id });

  if (newStatus === "cancelled" && gig?.organizer_id) {
    await ctx.admin.from("notifications").insert({
      user_id: gig.organizer_id,
      type: "system",
      title: `Your listing "${gig.title}" was taken down`,
      body: "The GigDekho team removed this listing. Reply to our support email if you think this was a mistake.",
      link: "/organizer/home",
    });
  }
  return Response.json({ ok: true });
}

export default function AdminGigs() {
  const { gigs, applied, q, status, type } = useLoaderData<typeof loader>();
  const [params, setParams] = useSearchParams();
  const revalidator = useRevalidator();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  const setFilter = (key: string, value: string) => { params.set(key, value); setParams(params); };

  const moderate = async (id: string, newStatus: string) => {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("id", id);
      fd.append("status", newStatus);
      await fetch("/admin/gigs", { method: "POST", body: fd });
      revalidator.revalidate();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageTitle title="Listings" subtitle="Every gig and internship on the platform. Take down anything that shouldn't be live." />

      <Form method="get" className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="text" name="q" defaultValue={q} placeholder="Search listing titles…"
            aria-label="Search listings"
            className="w-full h-11 pl-11 pr-4 rounded-xl bg-[#1C1C1C] border border-white/10 text-white text-sm font-semibold placeholder:text-white/30 focus:outline-none focus:border-[#F4511E]"
          />
        </div>
        <input type="hidden" name="status" value={status} />
        <input type="hidden" name="type" value={type} />
        <button type="submit" className="px-6 h-11 bg-[#F4511E] hover:bg-[#D84315] rounded-xl text-sm font-black btn-tap">Search</button>
      </Form>

      <div className="flex flex-wrap gap-2 mb-6">
        {["open", "completed", "cancelled", "all"].map((s) => (
          <button key={s} type="button" onClick={() => setFilter("status", s)}
            className={`px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-wider border transition-colors btn-tap min-h-0 ${
              status === s ? "bg-[#F4511E] border-[#F4511E] text-white" : "border-white/10 text-white/50 hover:text-white"
            }`} style={{ minHeight: "34px" }}>{s}</button>
        ))}
        <span className="w-px bg-white/10 mx-1" />
        {["all", "event", "internship"].map((t) => (
          <button key={t} type="button" onClick={() => setFilter("type", t)}
            className={`px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-wider border transition-colors btn-tap min-h-0 ${
              type === t ? "bg-blue-500/20 border-blue-500/40 text-blue-300" : "border-white/10 text-white/50 hover:text-white"
            }`} style={{ minHeight: "34px" }}>{t === "all" ? "all types" : t}</button>
        ))}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <EditGigModal
        isOpen={Boolean(editing)}
        onClose={() => setEditing(null)}
        gig={editing}
        onSaved={() => revalidator.revalidate()}
        showToast={(message, type) => setToast({ message, type })}
      />

      {gigs.length === 0 ? (
        <EmptyState icon={<Briefcase size={22} />} title="No listings match" hint="Try a different status or search term." />
      ) : (
        <div className="space-y-3">
          {gigs.map((g: any) => {
            const p = Array.isArray(g.profiles) ? g.profiles[0] : g.profiles;
            const isIntern = g.gig_type === "internship";
            return (
              <Card key={g.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      {isIntern ? <Pill tone="blue"><GraduationCap size={9} className="inline mr-0.5" /> Internship</Pill> : <Pill tone="neutral">Event</Pill>}
                      <Pill tone={g.status === "open" ? "green" : g.status === "cancelled" ? "red" : "neutral"}>{g.status}</Pill>
                      {p?.is_managed && <Pill tone="purple">Managed</Pill>}
                    </div>
                    <h3 className="font-black text-white truncate">{g.title}</h3>
                    <p className="text-[11px] font-semibold text-white/40 truncate">
                      {p?.company_name || p?.full_name || "Unknown"} · {g.location_text} ·{" "}
                      {new Date(g.event_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                    <p className="text-[11px] font-semibold text-white/30 mt-0.5 flex items-center gap-3">
                      <span className="flex items-center gap-1"><Users size={10} /> {applied[g.id] ?? 0} applied</span>
                      {!isIntern && <span>{g.slots_filled}/{g.slots_total} filled · ₹{g.pay_rate}/hr</span>}
                      {isIntern && <span>{g.is_unpaid ? "Unpaid" : g.stipend_min ? `₹${g.stipend_min}/mo` : "—"}</span>}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 shrink-0">
                    <button type="button" onClick={() => setEditing(g)}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-white/10 text-white/60 hover:text-white text-[11px] font-black uppercase tracking-wider transition-colors btn-tap">
                      <Pencil size={12} /> Edit
                    </button>
                    <a href={`/gigs/${g.id}`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-white/10 text-white/60 hover:text-white text-[11px] font-black uppercase tracking-wider transition-colors btn-tap">
                      <ExternalLink size={12} /> View
                    </a>
                    {g.status !== "cancelled" ? (
                      <button type="button" disabled={busy} onClick={() => moderate(g.id, "cancelled")}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-[11px] font-black uppercase tracking-wider hover:bg-red-500/20 transition-colors btn-tap disabled:opacity-50">
                        <XCircle size={12} /> Take down
                      </button>
                    ) : (
                      <button type="button" disabled={busy} onClick={() => moderate(g.id, "open")}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-green-500/10 border border-green-500/30 text-green-400 text-[11px] font-black uppercase tracking-wider hover:bg-green-500/20 transition-colors btn-tap disabled:opacity-50">
                        <CheckCircle2 size={12} /> Restore
                      </button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
