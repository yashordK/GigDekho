import { useLoaderData, Link } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { requireAdmin } from "~/lib/admin.server";
import { PageTitle, Card, Pill, EmptyState } from "~/components/AdminUI";
import { ArrowLeft, Users, ExternalLink, Phone, Mail, Star, ShieldCheck, GraduationCap } from "lucide-react";

/**
 * Who applied to one listing, with the contact details the hirer sees.
 *
 * The Listings page showed an applicant count with nothing behind it, so
 * answering "who actually applied to this?" meant querying the database by
 * hand. Covers both sides: applications for event gigs, and
 * internship_applications for internships.
 */
export async function loader({ params, request }: LoaderFunctionArgs) {
  const { admin } = await requireAdmin(request);
  const id = params.id!;

  const { data: gig } = await admin
    .from("gigs")
    .select("id, title, gig_type, status, event_date, location_text, slots_total, slots_filled, pay_rate, duration_hrs, organizer_id, profiles!gigs_organizer_id_fkey(full_name, company_name, email, phone)")
    .eq("id", id)
    .maybeSingle();

  if (!gig) throw Response.json({ error: "not_found" }, { status: 404 });

  const isIntern = gig.gig_type === "internship";

  const [{ data: apps }, { data: interns }] = await Promise.all([
    isIntern
      ? Promise.resolve({ data: [] as any[] })
      : admin.from("applications")
          .select("id, status, applied_at, waitlist_position, worker:profiles!applications_worker_id_fkey(id, full_name, email, phone, city, avg_rating, reliability_score, id_verified, worker_level)")
          .eq("gig_id", id).order("applied_at", { ascending: true }),
    isIntern
      ? admin.from("internship_applications")
          .select("*").eq("gig_id", id).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as any[] }),
  ]);

  return { gig, apps: apps ?? [], interns: interns ?? [], isIntern };
}

const when = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";

export default function AdminGigApplicants() {
  const { gig, apps, interns, isIntern } = useLoaderData<typeof loader>();
  const org = Array.isArray(gig.profiles) ? gig.profiles[0] : gig.profiles;
  const total = isIntern ? interns.length : apps.length;

  const tone = (s: string) =>
    s === "accepted" || s === "shortlisted" ? "green" : s === "cancelled" || s === "rejected" ? "red" : "orange";

  return (
    <div>
      <Link
        to="/admin/gigs"
        className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-white/40 hover:text-white mb-5 transition-colors"
      >
        <ArrowLeft size={13} /> All listings
      </Link>

      <PageTitle
        title={gig.title}
        subtitle={`${org?.company_name || org?.full_name || "Unknown hirer"} · ${gig.location_text} · ${when(gig.event_date)}`}
        action={
          <a
            href={`/gigs/${gig.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 border border-white/10 text-white/70 hover:text-white px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-colors btn-tap"
          >
            <ExternalLink size={15} /> View listing
          </a>
        }
      />

      <div className="flex flex-wrap gap-2 mb-6">
        <Pill tone={isIntern ? "blue" : "neutral"}>{isIntern ? "Internship" : "Event gig"}</Pill>
        <Pill tone={gig.status === "open" ? "green" : gig.status === "cancelled" ? "red" : "neutral"}>{gig.status}</Pill>
        {!isIntern && <Pill tone="neutral">{gig.slots_filled}/{gig.slots_total} filled</Pill>}
        <Pill tone="neutral">{total} applicant{total === 1 ? "" : "s"}</Pill>
        {gig.organizer_id && (
          <Link to={`/admin/users/${gig.organizer_id}`} className="text-[10px] font-black uppercase tracking-wider text-[#F4511E] hover:underline self-center ml-1">
            open hirer →
          </Link>
        )}
      </div>

      {total === 0 ? (
        <EmptyState icon={<Users size={22} />} title="Nobody has applied yet" hint="Applicants appear here the moment they apply." />
      ) : isIntern ? (
        <div className="space-y-3">
          {interns.map((a: any) => (
            <Card key={a.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="font-black text-white">{a.full_name}</h3>
                    <Pill tone={tone(a.status)}>{a.status}</Pill>
                  </div>
                  <p className="text-[11px] font-semibold text-white/45 flex flex-wrap items-center gap-3">
                    <span className="flex items-center gap-1"><Mail size={10} /> {a.email}</span>
                    <span className="flex items-center gap-1"><Phone size={10} /> {a.phone}</span>
                  </p>
                  <p className="text-[11px] font-semibold text-white/30 mt-0.5">
                    {[a.institution, a.degree_domain, a.graduation_year].filter(Boolean).join(" · ") || "no education details"}
                  </p>
                  {a.why_you && <p className="text-[11px] font-medium text-white/50 mt-2 max-w-2xl leading-relaxed">{a.why_you}</p>}
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  {a.resume_url && (
                    <a href={a.resume_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-white/10 text-white/60 hover:text-white text-[10px] font-black uppercase tracking-wider transition-colors btn-tap">
                      <ExternalLink size={11} /> Resume
                    </a>
                  )}
                  {a.applicant_id && (
                    <Link to={`/admin/users/${a.applicant_id}`}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-white/10 text-white/60 hover:text-white text-[10px] font-black uppercase tracking-wider transition-colors btn-tap">
                      Profile
                    </Link>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {apps.map((a: any) => {
            const w = Array.isArray(a.worker) ? a.worker[0] : a.worker;
            return (
              <Card key={a.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-black text-white">{w?.full_name ?? "Unknown"}</h3>
                      <Pill tone={tone(a.status)}>{a.status}</Pill>
                      {w?.id_verified && <Pill tone="green"><ShieldCheck size={9} className="inline mr-0.5" /> verified</Pill>}
                      {a.waitlist_position != null && <Pill tone="orange">waitlist #{a.waitlist_position}</Pill>}
                    </div>
                    <p className="text-[11px] font-semibold text-white/45 flex flex-wrap items-center gap-3">
                      {w?.email && <span className="flex items-center gap-1"><Mail size={10} /> {w.email}</span>}
                      {w?.phone && <span className="flex items-center gap-1"><Phone size={10} /> {w.phone}</span>}
                    </p>
                    <p className="text-[11px] font-semibold text-white/30 mt-0.5 flex flex-wrap items-center gap-3">
                      <span className="flex items-center gap-1"><Star size={10} /> {w?.avg_rating ? Number(w.avg_rating).toFixed(1) : "—"}</span>
                      <span>reliability {w?.reliability_score ?? 100}</span>
                      <span>{w?.worker_level ?? ""}</span>
                      <span>applied {when(a.applied_at)}</span>
                    </p>
                  </div>
                  {w?.id && (
                    <Link to={`/admin/users/${w.id}`}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-white/10 text-white/60 hover:text-white text-[10px] font-black uppercase tracking-wider transition-colors btn-tap shrink-0">
                      Profile
                    </Link>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
