import { useLoaderData, useSearchParams, Link } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { requireAdmin } from "~/lib/admin.server";
import { PageTitle, StatCard, Card, BarSeries, Funnel, Pill } from "~/components/AdminUI";
import {
  Eye, Users, Briefcase, IndianRupee, TrendingUp, Wallet, Flag,
  FileCheck, Banknote, GraduationCap, AlertTriangle, Activity,
} from "lucide-react";

const count = (q: any) => q.then((r: any) => r.count ?? 0);

export async function loader({ request }: LoaderFunctionArgs) {
  const { admin } = await requireAdmin(request);
  const days = Math.min(90, Math.max(7, Number(new URL(request.url).searchParams.get("days")) || 30));
  const since = new Date(Date.now() - days * 86400000);
  const sinceIso = since.toISOString();
  const db = admin;

  const [
    // Traffic
    events,
    // Users
    totalUsers, newUsers, workers, hirers, idVerified, managed, suspended,
    // Listings
    totalGigs, openGigs, newGigs, internships, completedGigs, cancelledGigs,
    // Applications
    totalApps, acceptedApps, completedApps, noShows, internApps,
    // Funnel
    profilesComplete, everApplied,
    // Money
    payments, walletTxns, pendingWithdrawals,
    // Queues
    openReports, pendingDocs, pendingPayoutCount,
    // Recent activity
    recentGigs, recentReports,
  ] = await Promise.all([
    db.from("analytics_events").select("created_at, session_id, path, event_name")
      .gte("created_at", sinceIso).order("created_at", { ascending: false }).limit(20000),

    count(db.from("profiles").select("id", { count: "exact", head: true })),
    count(db.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", sinceIso)),
    count(db.from("profiles").select("id", { count: "exact", head: true }).eq("role", "worker")),
    count(db.from("profiles").select("id", { count: "exact", head: true }).eq("role", "organizer")),
    count(db.from("profiles").select("id", { count: "exact", head: true }).eq("id_verified", true)),
    count(db.from("profiles").select("id", { count: "exact", head: true }).eq("is_managed", true)),
    count(db.from("profiles").select("id", { count: "exact", head: true }).eq("is_suspended", true)),

    count(db.from("gigs").select("id", { count: "exact", head: true })),
    count(db.from("gigs").select("id", { count: "exact", head: true }).eq("status", "open")),
    count(db.from("gigs").select("id", { count: "exact", head: true }).gte("created_at", sinceIso)),
    count(db.from("gigs").select("id", { count: "exact", head: true }).eq("gig_type", "internship")),
    count(db.from("gigs").select("id", { count: "exact", head: true }).eq("status", "completed")),
    count(db.from("gigs").select("id", { count: "exact", head: true }).eq("status", "cancelled")),

    count(db.from("applications").select("id", { count: "exact", head: true })),
    count(db.from("applications").select("id", { count: "exact", head: true }).eq("status", "accepted")),
    count(db.from("applications").select("id", { count: "exact", head: true }).eq("status", "completed")),
    count(db.from("applications").select("id", { count: "exact", head: true }).eq("status", "no_show")),
    count(db.from("internship_applications").select("id", { count: "exact", head: true })),

    count(db.from("profiles").select("id", { count: "exact", head: true }).not("full_name", "is", null)),
    db.from("applications").select("worker_id"),

    db.from("gig_payments").select("organizer_total, platform_fee, final_paid, advance_paid"),
    db.from("wallet_transactions").select("amount, status").neq("status", "failed"),
    db.from("withdrawal_requests").select("amount").eq("status", "pending"),

    count(db.from("reports").select("id", { count: "exact", head: true }).eq("status", "open")),
    count(db.from("verification_documents").select("id", { count: "exact", head: true }).eq("status", "pending")),
    count(db.from("withdrawal_requests").select("id", { count: "exact", head: true }).eq("status", "pending")),

    db.from("gigs").select("id, title, gig_type, status, created_at, profiles!gigs_organizer_id_fkey(full_name, company_name)")
      .order("created_at", { ascending: false }).limit(6),
    db.from("reports").select("id, category, subject, status, created_at").eq("status", "open")
      .order("created_at", { ascending: false }).limit(5),
  ]);

  // ── Traffic series (bucketed in JS; avoids an untestable SQL function) ──
  const rows = events.data ?? [];
  const buckets = new Map<string, { views: number; sessions: Set<string> }>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    buckets.set(d.toISOString().slice(0, 10), { views: 0, sessions: new Set() });
  }
  const pathCounts = new Map<string, number>();
  for (const e of rows) {
    if (e.event_name !== "pageview") continue;
    const key = String(e.created_at).slice(0, 10);
    const b = buckets.get(key);
    if (b) {
      b.views++;
      if (e.session_id) b.sessions.add(e.session_id);
    }
    if (e.path) pathCounts.set(e.path, (pathCounts.get(e.path) ?? 0) + 1);
  }
  const series = [...buckets.entries()].map(([date, b]) => ({
    label: new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
    value: b.views,
  }));
  const totalViews = series.reduce((s, d) => s + d.value, 0);
  const uniqueVisitors = new Set(rows.filter(e => e.event_name === "pageview").map(e => e.session_id).filter(Boolean)).size;
  const topPages = [...pathCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);

  // ── Money ──
  const pay = payments.data ?? [];
  const gmv = pay.filter(p => p.final_paid).reduce((s, p) => s + (p.organizer_total ?? 0), 0);
  const fees = pay.filter(p => p.final_paid).reduce((s, p) => s + (p.platform_fee ?? 0), 0);
  const walletOutstanding = (walletTxns.data ?? []).reduce((s, t) => s + (t.amount ?? 0), 0);
  const pendingPayoutValue = (pendingWithdrawals.data ?? []).reduce((s, w) => s + (w.amount ?? 0), 0);

  const uniqueApplicants = new Set((everApplied.data ?? []).map((a: any) => a.worker_id)).size;

  return {
    days,
    traffic: { totalViews, uniqueVisitors, series, topPages },
    users: { totalUsers, newUsers, workers, hirers, idVerified, managed, suspended },
    listings: { totalGigs, openGigs, newGigs, internships, completedGigs, cancelledGigs },
    apps: { totalApps, acceptedApps, completedApps, noShows, internApps },
    funnel: {
      visitors: uniqueVisitors,
      signups: totalUsers,
      profilesComplete,
      applied: uniqueApplicants,
      completed: completedApps,
    },
    money: { gmv, fees, walletOutstanding, pendingPayoutValue },
    queues: { openReports, pendingDocs, pendingPayoutCount },
    recentGigs: recentGigs.data ?? [],
    recentReports: recentReports.data ?? [],
  };
}

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export default function AdminOverview() {
  const d = useLoaderData<typeof loader>();
  const [params, setParams] = useSearchParams();

  const fillRate = d.apps.totalApps > 0 ? Math.round((d.apps.acceptedApps / d.apps.totalApps) * 100) : 0;
  const noShowRate = d.apps.completedApps + d.apps.noShows > 0
    ? Math.round((d.apps.noShows / (d.apps.completedApps + d.apps.noShows)) * 100) : 0;

  return (
    <div className="space-y-8">
      <PageTitle
        title="Overview"
        subtitle={`Everything happening on GigDekho over the last ${d.days} days`}
        action={
          <div className="flex bg-[#1C1C1C] border border-white/10 p-1 rounded-full">
            {[7, 30, 90].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => { params.set("days", String(n)); setParams(params); }}
                className={`px-4 py-1.5 text-[11px] font-black rounded-full transition-colors btn-tap min-h-0 ${
                  d.days === n ? "bg-[#F4511E] text-white" : "text-white/50 hover:text-white"
                }`}
                style={{ minHeight: "32px" }}
              >
                {n}d
              </button>
            ))}
          </div>
        }
      />

      {/* Needs attention */}
      {(d.queues.openReports > 0 || d.queues.pendingDocs > 0 || d.queues.pendingPayoutCount > 0) && (
        <div className="bg-[#F4511E]/5 border border-[#F4511E]/25 rounded-2xl p-4 flex flex-wrap items-center gap-3">
          <AlertTriangle size={18} className="text-[#F4511E] shrink-0" />
          <span className="text-sm font-bold text-white">Needs your attention</span>
          <div className="flex flex-wrap gap-2 ml-auto">
            {d.queues.openReports > 0 && (
              <Link prefetch="intent" to="/admin/reports" className="flex items-center gap-1.5 text-[11px] font-black bg-[#111111] border border-white/10 hover:border-[#F4511E]/50 px-3 py-2 rounded-full transition-colors btn-tap">
                <Flag size={12} className="text-red-400" /> {d.queues.openReports} open report{d.queues.openReports !== 1 && "s"}
              </Link>
            )}
            {d.queues.pendingDocs > 0 && (
              <Link prefetch="intent" to="/admin/verifications" className="flex items-center gap-1.5 text-[11px] font-black bg-[#111111] border border-white/10 hover:border-[#F4511E]/50 px-3 py-2 rounded-full transition-colors btn-tap">
                <FileCheck size={12} className="text-blue-400" /> {d.queues.pendingDocs} to verify
              </Link>
            )}
            {d.queues.pendingPayoutCount > 0 && (
              <Link prefetch="intent" to="/admin/payouts" className="flex items-center gap-1.5 text-[11px] font-black bg-[#111111] border border-white/10 hover:border-[#F4511E]/50 px-3 py-2 rounded-full transition-colors btn-tap">
                <Banknote size={12} className="text-green-400" /> {d.queues.pendingPayoutCount} payout{d.queues.pendingPayoutCount !== 1 && "s"} ({inr(d.money.pendingPayoutValue)})
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Headline numbers */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Page Views" value={d.traffic.totalViews.toLocaleString("en-IN")} sub={`${d.traffic.uniqueVisitors.toLocaleString("en-IN")} unique visitors`} icon={<Eye size={15} />} />
        <StatCard label="Total Users" value={d.users.totalUsers.toLocaleString("en-IN")} sub={`+${d.users.newUsers} this period`} accent="blue" icon={<Users size={15} />} />
        <StatCard label="Listings Posted" value={d.listings.totalGigs.toLocaleString("en-IN")} sub={`+${d.listings.newGigs} this period · ${d.listings.openGigs} open`} accent="purple" icon={<Briefcase size={15} />} />
        <StatCard label="GMV Settled" value={inr(d.money.gmv)} sub={`${inr(d.money.fees)} platform fees`} accent="green" icon={<IndianRupee size={15} />} />
      </div>

      {/* Traffic + funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-6 lg:col-span-2">
          <h3 className="text-sm font-black uppercase tracking-wider mb-1 flex items-center gap-2">
            <Activity size={15} className="text-[#F4511E]" /> Traffic
          </h3>
          <p className="text-[11px] font-medium text-white/35 mb-5">Daily page views. Admin pages are excluded.</p>
          <BarSeries data={d.traffic.series} valueLabel="Daily page views" />
          {d.traffic.topPages.length > 0 && (
            <div className="mt-6 pt-5 border-t border-white/5">
              <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-3">Top pages</p>
              <div className="space-y-1.5">
                {d.traffic.topPages.map(([path, n]) => (
                  <div key={path} className="flex items-center justify-between gap-3 text-xs">
                    <span className="font-semibold text-white/60 truncate">{path}</span>
                    <span className="font-black text-white/80 shrink-0">{n}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h3 className="text-sm font-black uppercase tracking-wider mb-1 flex items-center gap-2">
            <TrendingUp size={15} className="text-[#F4511E]" /> Conversion
          </h3>
          <p className="text-[11px] font-medium text-white/35 mb-5">All-time, except visitors (this period).</p>
          <Funnel
            steps={[
              { label: "Visitors", value: d.funnel.visitors },
              { label: "Signed up", value: d.funnel.signups },
              { label: "Completed profile", value: d.funnel.profilesComplete },
              { label: "Applied to something", value: d.funnel.applied },
              { label: "Completed a gig", value: d.funnel.completed },
            ]}
          />
        </Card>
      </div>

      {/* Marketplace health */}
      <div>
        <h3 className="text-sm font-black uppercase tracking-wider mb-4">Marketplace health</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Applications" value={d.apps.totalApps.toLocaleString("en-IN")} sub={`${d.apps.acceptedApps} confirmed · ${fillRate}% fill rate`} accent="blue" />
          <StatCard label="Gigs Completed" value={d.listings.completedGigs} sub={`${d.listings.cancelledGigs} cancelled`} accent="green" />
          <StatCard label="No-show Rate" value={`${noShowRate}%`} sub={`${d.apps.noShows} no-shows recorded`} accent={noShowRate > 15 ? "red" : "neutral"} />
          <StatCard label="Internship Apps" value={d.apps.internApps} sub={`across ${d.listings.internships} listings`} accent="purple" icon={<GraduationCap size={15} />} />
        </div>
      </div>

      {/* People + money */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-sm font-black uppercase tracking-wider mb-4">People</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { l: "Workers", v: d.users.workers },
              { l: "Hirers", v: d.users.hirers },
              { l: "ID Verified", v: d.users.idVerified },
              { l: "Managed accounts", v: d.users.managed },
            ].map((x) => (
              <div key={x.l} className="bg-[#111111] rounded-xl p-3.5 border border-white/5">
                <p className="text-[10px] font-black uppercase tracking-widest text-white/35 mb-1">{x.l}</p>
                <p className="text-xl font-black">{x.v.toLocaleString("en-IN")}</p>
              </div>
            ))}
          </div>
          {d.users.suspended > 0 && (
            <p className="text-[11px] font-bold text-red-400 mt-3">{d.users.suspended} suspended account{d.users.suspended !== 1 && "s"}</p>
          )}
        </Card>

        <Card className="p-6">
          <h3 className="text-sm font-black uppercase tracking-wider mb-4 flex items-center gap-2">
            <Wallet size={15} className="text-[#F4511E]" /> Money
          </h3>
          <div className="space-y-3">
            {[
              { l: "GMV settled", v: inr(d.money.gmv), hint: "Hirer payments fully cleared" },
              { l: "Platform fees earned", v: inr(d.money.fees), hint: "Your revenue from settled gigs" },
              { l: "Wallet balances held", v: inr(d.money.walletOutstanding), hint: "Money you owe workers" },
              { l: "Withdrawals pending", v: inr(d.money.pendingPayoutValue), hint: "Awaiting your approval" },
            ].map((x) => (
              <div key={x.l} className="flex items-start justify-between gap-3 pb-3 border-b border-white/5 last:border-0 last:pb-0">
                <div>
                  <p className="text-xs font-bold text-white/70">{x.l}</p>
                  <p className="text-[10px] font-medium text-white/30">{x.hint}</p>
                </div>
                <p className="text-sm font-black shrink-0">{x.v}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-sm font-black uppercase tracking-wider mb-4">Latest listings</h3>
          {d.recentGigs.length === 0 ? (
            <p className="text-xs font-medium text-white/35">Nothing posted yet.</p>
          ) : (
            <div className="space-y-2.5">
              {d.recentGigs.map((g: any) => {
                const p = Array.isArray(g.profiles) ? g.profiles[0] : g.profiles;
                return (
                  <div key={g.id} className="flex items-center justify-between gap-3 bg-[#111111] rounded-xl px-3.5 py-2.5 border border-white/5">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">{g.title}</p>
                      <p className="text-[10px] font-semibold text-white/35 truncate">
                        {p?.company_name || p?.full_name || "Unknown"} · {new Date(g.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      </p>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      {g.gig_type === "internship" && <Pill tone="blue">Internship</Pill>}
                      <Pill tone={g.status === "open" ? "green" : g.status === "cancelled" ? "red" : "neutral"}>{g.status}</Pill>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="p-6">
          <h3 className="text-sm font-black uppercase tracking-wider mb-4">Open reports</h3>
          {d.recentReports.length === 0 ? (
            <p className="text-xs font-medium text-white/35">No open reports. All clear.</p>
          ) : (
            <div className="space-y-2.5">
              {d.recentReports.map((r: any) => (
                <Link prefetch="intent" key={r.id} to="/admin/reports" className="flex items-center justify-between gap-3 bg-[#111111] rounded-xl px-3.5 py-2.5 border border-white/5 hover:border-[#F4511E]/40 transition-colors">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">{r.subject || r.category}</p>
                    <p className="text-[10px] font-semibold text-white/35">
                      {new Date(r.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </p>
                  </div>
                  <Pill tone="red">{r.category}</Pill>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
