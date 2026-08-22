import { Outlet, NavLink, useLoaderData, useNavigate } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { requireAdmin } from "~/lib/admin.server";
import {
  ShieldCheck, LayoutDashboard, Users, Briefcase, Flag, Banknote,
  Building2, Settings, FileCheck, ArrowLeft, Video,
} from "lucide-react";

export async function loader({ request }: LoaderFunctionArgs) {
  const ctx = await requireAdmin(request);

  // Badge counts for the nav — shows where attention is needed
  const [pendingDocs, openReports, pendingPayouts] = await Promise.all([
    ctx.admin.from("verification_documents").select("id", { count: "exact", head: true }).eq("status", "pending"),
    ctx.admin.from("reports").select("id", { count: "exact", head: true }).eq("status", "open"),
    ctx.admin.from("withdrawal_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);

  return {
    adminName: ctx.adminName,
    counts: {
      verifications: pendingDocs.count ?? 0,
      reports: openReports.count ?? 0,
      payouts: pendingPayouts.count ?? 0,
    },
  };
}

const NAV = [
  { to: "/admin", end: true, label: "Overview", icon: LayoutDashboard, badge: null },
  { to: "/admin/reports", label: "Reports", icon: Flag, badge: "reports" as const },
  { to: "/admin/verifications", label: "Verifications", icon: FileCheck, badge: "verifications" as const },
  { to: "/admin/payouts", label: "Payouts", icon: Banknote, badge: "payouts" as const },
  { to: "/admin/reels", label: "Reels", icon: Video, badge: null },
  { to: "/admin/users", label: "Users", icon: Users, badge: null },
  { to: "/admin/gigs", label: "Listings", icon: Briefcase, badge: null },
  { to: "/admin/accounts", label: "Managed Accounts", icon: Building2, badge: null },
  { to: "/admin/settings", label: "Settings", icon: Settings, badge: null },
];

export default function AdminLayout() {
  const { adminName, counts } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#111111] text-white">
      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-[#111111]/95 backdrop-blur border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#F4511E]/10 border border-[#F4511E]/20 text-[#F4511E] flex items-center justify-center shrink-0">
              <ShieldCheck size={18} />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-black tracking-tight leading-none">
                Gig<span className="text-[#F4511E] italic">Dekho</span> Admin
              </h1>
              <p className="text-[10px] font-bold text-white/35 truncate">
                {adminName} · every action is logged
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate("/worker/home")}
            className="flex items-center gap-1.5 text-[11px] font-bold text-white/50 hover:text-white border border-white/10 hover:border-white/30 px-3.5 py-2 rounded-full transition-colors btn-tap shrink-0"
          >
            <ArrowLeft size={12} /> Back to site
          </button>
        </div>

        {/* Nav */}
        <nav className="max-w-7xl mx-auto px-4 lg:px-8 pb-2 flex gap-1 overflow-x-auto hide-scrollbar">
          {NAV.map((item) => {
            const Icon = item.icon;
            const count = item.badge ? counts[item.badge] : 0;
            return (
              <NavLink prefetch="intent"
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors btn-tap min-h-0 ${
                    isActive
                      ? "bg-[#F4511E] text-white"
                      : "text-white/50 hover:text-white hover:bg-white/5"
                  }`
                }
                style={{ minHeight: "36px" }}
              >
                <Icon size={13} /> {item.label}
                {count > 0 && (
                  <span className="ml-0.5 text-[9px] font-black bg-[#F4511E] text-white px-1.5 py-0.5 rounded-full border border-white/20">
                    {count}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>
      </header>

      <main id="main-content" className="max-w-7xl mx-auto px-4 lg:px-8 py-8 pb-24">
        <Outlet />
      </main>
    </div>
  );
}
