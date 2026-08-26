import { useLoaderData, Link } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { requireAdmin } from "~/lib/admin.server";
import { PageTitle, Card, Pill, EmptyState } from "~/components/AdminUI";
import {
  ArrowLeft, FileText, Wallet, Briefcase, ShieldCheck, Star, Phone, Mail, Smartphone,
  MapPin, ExternalLink, GraduationCap,
} from "lucide-react";

/**
 * Everything we hold on one person, in one place.
 *
 * The admin panel could list users and review the pending-document queue, but
 * there was nowhere to open a single person and see who they are — their
 * documents (whatever the status), what they've applied to, and every rupee
 * that moved through their wallet. Support questions all start here.
 *
 * Documents live in private buckets, so the loader mints short-lived signed
 * URLs rather than exposing paths.
 */
export async function loader({ params, request }: LoaderFunctionArgs) {
  const { admin } = await requireAdmin(request);
  const id = params.id!;

  const { data: profile } = await admin
    .from("profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!profile) throw Response.json({ error: "not_found" }, { status: 404 });

  const [
    { data: docs },
    { data: legacyDocs },
    { data: apps },
    { data: internApps },
    { data: wallet },
    { data: skills },
    { data: gigsPosted },
    { data: reliability },
  ] = await Promise.all([
    admin.from("verification_documents")
      .select("id, doc_type, file_path, status, rejection_reason, reviewed_at, created_at")
      .eq("user_id", id).order("created_at", { ascending: false }),
    admin.from("worker_documents")
      .select("id, doc_type, doc_url, uploaded_at")
      .eq("worker_id", id).order("uploaded_at", { ascending: false }),
    admin.from("applications")
      .select("id, status, applied_at, gig:gigs(id, title, event_date, gig_type, pay_rate, duration_hrs)")
      .eq("worker_id", id).order("applied_at", { ascending: false }).limit(50),
    admin.from("internship_applications")
      .select("id, status, created_at, gig:gigs(id, title)")
      .eq("applicant_id", id).order("created_at", { ascending: false }).limit(50),
    admin.from("wallet_transactions")
      .select("id, amount, type, status, description, created_at")
      .eq("worker_id", id).order("created_at", { ascending: false }).limit(50),
    admin.from("worker_skills").select("skill").eq("worker_id", id),
    admin.from("gigs")
      .select("id, title, status, event_date, gig_type, slots_filled, slots_total")
      .eq("organizer_id", id).order("created_at", { ascending: false }).limit(50),
    admin.from("reliability_events")
      .select("event_type, score_delta, created_at")
      .eq("worker_id", id).order("created_at", { ascending: false }).limit(20),
  ]);

  // Where this person gets paid. Previously visible only on /admin/payouts,
  // and only once they had already requested a withdrawal — so "have they told
  // us where to send the money yet?" had no answer anywhere.
  const PAYOUT_COLS = "method, account_number, ifsc, upi_id, account_holder, penny_drop_status, updated_at";
  let { data: payoutRow, error: payoutErr } = await admin
    .from("worker_bank_accounts")
    .select(`${PAYOUT_COLS}, upi_qr_url`)
    .eq("worker_id", id)
    .maybeSingle();

  // upi_qr_url arrives with migration 021. Asking for a column that does not
  // exist fails the whole select, which would hide the UPI ID too — the one
  // thing this panel exists to show. Retry without it.
  if (payoutErr && /upi_qr_url/.test(payoutErr.message ?? "")) {
    ({ data: payoutRow } = await admin
      .from("worker_bank_accounts").select(PAYOUT_COLS).eq("worker_id", id).maybeSingle());
  }

  let payout: any = null;
  if (payoutRow) {
    let qr: string | null = null;
    if ((payoutRow as any).upi_qr_url) {
      const { data } = await admin.storage.from("payout-qr").createSignedUrl((payoutRow as any).upi_qr_url, 60 * 30);
      qr = data?.signedUrl ?? null;
    }
    payout = {
      method: payoutRow.method ?? "bank",
      upi: payoutRow.upi_id ?? null,
      qr,
      // Only the tail of an account number is needed to recognise it; the UPI
      // ID is shown whole because it has to be typed into a payment app.
      tail: payoutRow.account_number ? String(payoutRow.account_number).slice(-4) : null,
      ifsc: payoutRow.ifsc ?? null,
      holder: payoutRow.account_holder ?? null,
      updatedAt: payoutRow.updated_at ?? null,
    };
  }

  // Signed URLs — the buckets are private and must stay that way.
  const signedDocs = await Promise.all(
    (docs ?? []).map(async (d) => {
      const { data } = await admin.storage.from("verification-docs").createSignedUrl(d.file_path, 300);
      return { ...d, url: data?.signedUrl ?? null };
    })
  );

  const balance = (wallet ?? [])
    .filter((t) => t.status !== "failed")
    .reduce((sum, t) => sum + (t.amount ?? 0), 0);

  return {
    profile,
    docs: signedDocs,
    legacyDocs: legacyDocs ?? [],
    apps: apps ?? [],
    internApps: internApps ?? [],
    wallet: wallet ?? [],
    balance,
    skills: (skills ?? []).map((s) => s.skill),
    gigsPosted: gigsPosted ?? [],
    reliability: reliability ?? [],
    payout,
  };
}

const money = (n: number) => `₹${(n ?? 0).toLocaleString("en-IN")}`;
const when = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";

export default function AdminUserDetail() {
  const {
    profile, docs, legacyDocs, apps, internApps, wallet, balance, skills, gigsPosted, reliability, payout,
  } = useLoaderData<typeof loader>();

  const name = profile.company_name || profile.full_name || "Unnamed";
  const isHirer = profile.role === "organizer";

  const Row = ({ label, value }: { label: string; value: any }) => (
    <div className="flex justify-between gap-4 py-2 border-b border-white/5 last:border-0">
      <span className="text-[11px] font-bold text-white/40 uppercase tracking-wider shrink-0">{label}</span>
      <span className="text-[12px] font-semibold text-white/80 text-right break-all">{value ?? "—"}</span>
    </div>
  );

  return (
    <div>
      <Link
        to="/admin/users"
        className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-white/40 hover:text-white mb-5 transition-colors"
      >
        <ArrowLeft size={13} /> All users
      </Link>

      <PageTitle
        title={name}
        subtitle={`${profile.email ?? "no email"} · joined ${when(profile.created_at)}`}
        action={
          isHirer ? (
            <Link
              to={`/admin/gigs?q=${encodeURIComponent(profile.full_name ?? "")}`}
              className="flex items-center gap-2 bg-[#F4511E] hover:bg-[#D84315] text-white px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-colors btn-tap"
            >
              <Briefcase size={15} /> Their listings
            </Link>
          ) : undefined
        }
      />

      <div className="flex flex-wrap gap-2 mb-6">
        <Pill tone={isHirer ? "purple" : "blue"}>{profile.role ?? "worker"}</Pill>
        {profile.is_admin && <Pill tone="orange">Admin</Pill>}
        {profile.is_suspended && <Pill tone="red">Suspended</Pill>}
        {profile.is_managed && <Pill tone="purple">Managed</Pill>}
        {profile.claimed_at && <Pill tone="green">Claimed</Pill>}
        {profile.id_verified && <Pill tone="green">ID verified</Pill>}
        {profile.business_verified && <Pill tone="green">Business verified</Pill>}
        {profile.basics_certified && <Pill tone="green">Basics certified</Pill>}
        {profile.campus_ambassador && <Pill tone="orange">Campus ambassador</Pill>}
        {profile.student_status && <Pill tone="neutral">{profile.student_status}</Pill>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Identity */}
        <Card className="p-5">
          <h3 className="font-black text-white mb-3 flex items-center gap-2 text-sm">
            <ShieldCheck size={15} className="text-[#F4511E]" /> Identity & contact
          </h3>
          <Row label="Full name" value={profile.full_name} />
          <Row label="Email" value={profile.email} />
          <Row label="Phone" value={profile.phone} />
          <Row label="City" value={profile.city} />
          {isHirer && <Row label="Business" value={profile.company_name} />}
          {isHirer && <Row label="Website" value={profile.website} />}
          <Row label="User id" value={<span className="font-mono text-[10px]">{profile.id}</span>} />
          {profile.internal_note && <Row label="Internal note" value={profile.internal_note} />}
        </Card>

        {/* Standing */}
        <Card className="p-5">
          <h3 className="font-black text-white mb-3 flex items-center gap-2 text-sm">
            <Star size={15} className="text-[#F4511E]" /> Standing
          </h3>
          <Row label="Rating" value={profile.avg_rating ? `${profile.avg_rating} / 5` : "no ratings yet"} />
          <Row label="Reliability" value={`${profile.reliability_score ?? 100} / 100`} />
          <Row label="Level" value={profile.worker_level ?? "—"} />
          <Row label="Total earned" value={money(profile.total_earned)} />
          <Row label="Wallet balance" value={money(balance)} />
          {skills.length > 0 && <Row label="Skills" value={skills.join(", ")} />}
        </Card>
      </div>

      {/* Documents */}
      <Card className="p-5 mb-4">
        <h3 className="font-black text-white mb-4 flex items-center gap-2 text-sm">
          <FileText size={15} className="text-[#F4511E]" /> Documents ({docs.length + legacyDocs.length})
        </h3>
        {docs.length === 0 && legacyDocs.length === 0 ? (
          <p className="text-[12px] font-semibold text-white/40">Nothing uploaded yet.</p>
        ) : (
          <div className="space-y-2">
            {docs.map((d: any) => (
              <div key={d.id} className="flex flex-wrap items-center justify-between gap-3 bg-[#111111] border border-white/5 rounded-xl px-4 py-3">
                <div className="min-w-0">
                  <p className="text-[12px] font-black text-white capitalize">{String(d.doc_type).replace(/_/g, " ")}</p>
                  <p className="text-[10px] font-semibold text-white/35">
                    uploaded {when(d.created_at)}
                    {d.reviewed_at ? ` · reviewed ${when(d.reviewed_at)}` : ""}
                    {d.rejection_reason ? ` · ${d.rejection_reason}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Pill tone={d.status === "approved" ? "green" : d.status === "rejected" ? "red" : "orange"}>
                    {d.status}
                  </Pill>
                  {d.url && (
                    <a
                      href={d.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-white/10 text-white/60 hover:text-white text-[10px] font-black uppercase tracking-wider transition-colors btn-tap"
                    >
                      <ExternalLink size={11} /> View
                    </a>
                  )}
                </div>
              </div>
            ))}
            {legacyDocs.map((d: any) => (
              <div key={d.id} className="flex items-center justify-between gap-3 bg-[#111111] border border-white/5 rounded-xl px-4 py-3">
                <div className="min-w-0">
                  <p className="text-[12px] font-black text-white capitalize">{String(d.doc_type).replace(/_/g, " ")}</p>
                  <p className="text-[10px] font-semibold text-white/35">uploaded {when(d.uploaded_at)}</p>
                </div>
                {d.doc_url && (
                  <a href={d.doc_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-white/10 text-white/60 hover:text-white text-[10px] font-black uppercase tracking-wider transition-colors btn-tap">
                    <ExternalLink size={11} /> View
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
        <p className="text-[10px] font-semibold text-white/25 mt-3">
          Links are signed and expire in 5 minutes. Approve or reject from the Verifications queue.
        </p>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* What they've done */}
        <Card className="p-5">
          <h3 className="font-black text-white mb-4 flex items-center gap-2 text-sm">
            <Briefcase size={15} className="text-[#F4511E]" />
            {isHirer ? `Listings posted (${gigsPosted.length})` : `Applications (${apps.length + internApps.length})`}
          </h3>
          <div className="space-y-2 max-h-[340px] overflow-y-auto hide-scrollbar">
            {isHirer
              ? gigsPosted.map((g: any) => (
                  <Link key={g.id} to={`/gigs/${g.id}`} target="_blank"
                    className="block bg-[#111111] border border-white/5 hover:border-[#F4511E]/40 rounded-xl px-4 py-3 transition-colors">
                    <p className="text-[12px] font-black text-white truncate">{g.title}</p>
                    <p className="text-[10px] font-semibold text-white/35">
                      {g.status} · {g.slots_filled}/{g.slots_total} filled · {when(g.event_date)}
                    </p>
                  </Link>
                ))
              : [...apps, ...internApps].map((a: any) => (
                  <div key={a.id} className="bg-[#111111] border border-white/5 rounded-xl px-4 py-3">
                    <p className="text-[12px] font-black text-white truncate">{a.gig?.title ?? "listing removed"}</p>
                    <p className="text-[10px] font-semibold text-white/35">
                      {a.status} · applied {when(a.applied_at ?? a.created_at)}
                    </p>
                  </div>
                ))}
            {((isHirer && gigsPosted.length === 0) || (!isHirer && apps.length + internApps.length === 0)) && (
              <p className="text-[12px] font-semibold text-white/40">Nothing yet.</p>
            )}
          </div>
        </Card>

        {/* Where the money goes — visible before they ever request a
            withdrawal, which is the whole point of putting it here. */}
        <Card className="p-5">
          <h3 className="font-black text-white mb-3 flex items-center gap-2 text-sm">
            <Smartphone size={15} className="text-[#F4511E]" /> Where they get paid
          </h3>
          {!payout ? (
            <p className="text-[12px] font-semibold text-white/40">
              Nothing on file yet — they add this themselves on the Earnings page before withdrawing.
            </p>
          ) : payout.method === "upi" ? (
            <div className="flex items-start gap-4 flex-wrap">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-wider text-white/40 mb-1">UPI ID</p>
                <p className="font-mono font-black text-[#F4511E] text-sm break-all">{payout.upi}</p>
                {payout.holder && <p className="text-[11px] font-semibold text-white/50 mt-1">{payout.holder}</p>}
              </div>
              {payout.qr && (
                <img src={payout.qr} alt="Their UPI QR code"
                  className="w-28 h-28 object-contain rounded-xl bg-white p-1.5 shrink-0" />
              )}
            </div>
          ) : (
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-white/40 mb-1">Bank account</p>
              <p className="font-black text-white text-sm">····{payout.tail} · {payout.ifsc}</p>
              {payout.holder && <p className="text-[11px] font-semibold text-white/50 mt-1">{payout.holder}</p>}
            </div>
          )}
        </Card>

        {/* Money */}
        <Card className="p-5">
          <h3 className="font-black text-white mb-4 flex items-center gap-2 text-sm">
            <Wallet size={15} className="text-[#F4511E]" /> Wallet ({money(balance)})
          </h3>
          <div className="space-y-2 max-h-[340px] overflow-y-auto hide-scrollbar">
            {wallet.length === 0 && <p className="text-[12px] font-semibold text-white/40">No transactions.</p>}
            {wallet.map((t: any) => (
              <div key={t.id} className="flex items-center justify-between gap-3 bg-[#111111] border border-white/5 rounded-xl px-4 py-2.5">
                <div className="min-w-0">
                  <p className="text-[11px] font-black text-white capitalize">{String(t.type).replace(/_/g, " ")}</p>
                  <p className="text-[10px] font-semibold text-white/35 truncate">
                    {t.description ?? ""} · {when(t.created_at)}
                  </p>
                </div>
                <span className={`text-[12px] font-black shrink-0 ${t.amount < 0 ? "text-red-400" : "text-green-400"}`}>
                  {t.amount < 0 ? "-" : "+"}{money(Math.abs(t.amount))}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {reliability.length > 0 && (
        <Card className="p-5 mt-4">
          <h3 className="font-black text-white mb-3 flex items-center gap-2 text-sm">
            <GraduationCap size={15} className="text-[#F4511E]" /> Reliability history
          </h3>
          <div className="flex flex-wrap gap-2">
            {reliability.map((e: any, i: number) => (
              <span key={i} className="text-[10px] font-bold bg-[#111111] border border-white/10 rounded-full px-3 py-1.5 text-white/60">
                {String(e.event_type).replace(/_/g, " ")} {e.score_delta > 0 ? `+${e.score_delta}` : e.score_delta} · {when(e.created_at)}
              </span>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
