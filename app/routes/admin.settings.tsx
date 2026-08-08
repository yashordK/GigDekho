import { useState } from "react";
import { useLoaderData, useRevalidator } from "react-router";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { requireAdmin, logAdminAction } from "~/lib/admin.server";
import { serviceRoleConfigured } from "~/lib/service-client.server";
import { PageTitle, Card, Pill } from "~/components/AdminUI";
import { Settings as SettingsIcon, Save, History, Table2, Map as MapIcon, Mail, CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react";

const EDITABLE = [
  { key: "min_withdrawal_amount", label: "Minimum withdrawal (₹)", hint: "Workers can't request less than this.", type: "number" },
  { key: "platform_fee_pct", label: "Platform fee (%)", hint: "Charged to hirers on top of worker pay.", type: "number" },
  { key: "advance_pct", label: "Advance payment (%)", hint: "Share of the total a hirer pays upfront.", type: "number" },
  { key: "support_email", label: "Support email", hint: "Shown to users for disputes and account deletion.", type: "text" },
  { key: "new_signups_enabled", label: "New signups enabled", hint: "Set to false to pause registrations.", type: "text" },
];

export async function loader({ request }: LoaderFunctionArgs) {
  const { admin } = await requireAdmin(request);

  const [{ data: settings }, { data: recentActions }] = await Promise.all([
    admin.from("app_settings").select("key, value, updated_at"),
    admin.from("admin_actions")
      .select("id, action, detail, created_at, admin:profiles!admin_actions_admin_id_fkey(full_name)")
      .order("created_at", { ascending: false }).limit(30),
  ]);

  const map: Record<string, string> = {};
  for (const s of settings ?? []) map[s.key] = s.value;

  return {
    settings: map,
    recentActions: recentActions ?? [],
    integrations: {
      serviceRole: serviceRoleConfigured(),
      sheets: Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || (process.env.GOOGLE_SA_EMAIL && process.env.GOOGLE_SA_PRIVATE_KEY)),
      maps: Boolean(process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY),
      email: Boolean(process.env.RESEND_API_KEY),
      cron: Boolean(process.env.CRON_SECRET),
    },
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const ctx = await requireAdmin(request);
  const fd = await request.formData();
  const key = String(fd.get("key") ?? "");
  const value = String(fd.get("value") ?? "").trim();

  if (!EDITABLE.some((e) => e.key === key)) {
    return Response.json({ error: "That setting can't be edited here." }, { status: 400 });
  }
  if (!value) return Response.json({ error: "Value can't be empty." }, { status: 400 });

  const { error } = await ctx.admin.from("app_settings")
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  await logAdminAction(ctx, "update_setting", `${key} → ${value}`);
  return Response.json({ ok: true });
}

export default function AdminSettings() {
  const { settings, recentActions, integrations } = useLoaderData<typeof loader>();
  const revalidator = useRevalidator();
  const [values, setValues] = useState<Record<string, string>>(settings);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const save = async (key: string) => {
    setSavingKey(key);
    setMessage("");
    try {
      const fd = new FormData();
      fd.append("key", key);
      fd.append("value", values[key] ?? "");
      const res = await fetch("/admin/settings", { method: "POST", body: fd });
      const r = await res.json();
      if (!res.ok || r.error) throw new Error(r.error);
      setMessage(`Saved ${key}`);
      revalidator.revalidate();
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setSavingKey(null);
    }
  };

  const INTEGRATIONS = [
    { ok: integrations.serviceRole, label: "Supabase service role", env: "SUPABASE_SERVICE_ROLE_KEY", icon: <ShieldCheck size={15} />, why: "Required — every write API and this panel depend on it" },
    { ok: integrations.email, label: "Transactional email (Resend)", env: "RESEND_API_KEY", icon: <Mail size={15} />, why: "Confirmations, reminders, claim emails" },
    { ok: integrations.maps, label: "Google Maps", env: "GOOGLE_MAPS_API_KEY", icon: <MapIcon size={15} />, why: "Location picker and gig maps" },
    { ok: integrations.sheets, label: "Google Sheets export", env: "GOOGLE_SERVICE_ACCOUNT_JSON", icon: <Table2 size={15} />, why: "Live applicant sheets for hirers" },
    { ok: integrations.cron, label: "Cron authentication", env: "CRON_SECRET", icon: <History size={15} />, why: "Reminder emails and no-show detection" },
  ];

  return (
    <div className="space-y-8">
      <PageTitle title="Settings" subtitle="Platform rules, integration health, and the full admin audit trail." />

      {message && (
        <div className="bg-green-500/10 border border-green-500/20 text-green-400 rounded-xl px-4 py-3 text-xs font-bold">{message}</div>
      )}

      {/* Integration health */}
      <Card className="p-6">
        <h3 className="text-sm font-black uppercase tracking-wider mb-4 flex items-center gap-2">
          <SettingsIcon size={15} className="text-[#F4511E]" /> Integrations
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {INTEGRATIONS.map((i) => (
            <div key={i.env} className="bg-[#111111] rounded-xl p-4 border border-white/5 flex items-start gap-3">
              <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${i.ok ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
                {i.icon}
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-xs font-black text-white truncate">{i.label}</p>
                  {i.ok ? <Pill tone="green">Live</Pill> : <Pill tone="red">Not set</Pill>}
                </div>
                <p className="text-[10px] font-medium text-white/35 leading-relaxed">{i.why}</p>
                {!i.ok && <p className="text-[10px] font-bold text-red-400/70 mt-1">Set {i.env} in your Vercel env vars</p>}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Editable settings */}
      <Card className="p-6">
        <h3 className="text-sm font-black uppercase tracking-wider mb-1">Platform rules</h3>
        <p className="text-[11px] font-medium text-white/35 mb-5">These take effect immediately across the site.</p>
        <div className="space-y-4">
          {EDITABLE.map((s) => (
            <div key={s.key} className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[220px]">
                <label htmlFor={`set-${s.key}`} className="block text-[11px] font-black text-white/60 uppercase tracking-wider mb-1.5">{s.label}</label>
                <input
                  id={`set-${s.key}`}
                  type={s.type}
                  value={values[s.key] ?? ""}
                  onChange={(e) => setValues({ ...values, [s.key]: e.target.value })}
                  className="w-full h-11 px-4 rounded-xl bg-[#111111] border border-white/10 text-white text-sm font-semibold focus:outline-none focus:border-[#F4511E]"
                />
                <p className="text-[10px] font-medium text-white/30 mt-1">{s.hint}</p>
              </div>
              <button
                type="button"
                onClick={() => save(s.key)}
                disabled={savingKey === s.key || values[s.key] === settings[s.key]}
                className="h-11 px-5 rounded-xl bg-[#F4511E] hover:bg-[#D84315] text-white text-xs font-black uppercase tracking-wider btn-tap disabled:opacity-30 transition-colors flex items-center gap-1.5"
              >
                <Save size={13} /> {savingKey === s.key ? "…" : "Save"}
              </button>
            </div>
          ))}
        </div>
      </Card>

      {/* Audit log */}
      <Card className="p-6">
        <h3 className="text-sm font-black uppercase tracking-wider mb-1 flex items-center gap-2">
          <History size={15} className="text-[#F4511E]" /> Admin audit trail
        </h3>
        <p className="text-[11px] font-medium text-white/35 mb-5">
          Every administrative action, who did it, and when. This is your accountability record.
        </p>
        {recentActions.length === 0 ? (
          <p className="text-xs font-medium text-white/35">No admin actions recorded yet.</p>
        ) : (
          <div className="space-y-1.5 max-h-[420px] overflow-y-auto hide-scrollbar">
            {recentActions.map((a: any) => {
              const who = Array.isArray(a.admin) ? a.admin[0] : a.admin;
              const destructive = /suspend|reject|moderate|revoke/.test(a.action);
              return (
                <div key={a.id} className="flex items-start justify-between gap-3 bg-[#111111] rounded-xl px-3.5 py-2.5 border border-white/5">
                  <div className="min-w-0">
                    <p className="text-[11px] font-black text-white flex items-center gap-1.5">
                      {destructive ? <AlertTriangle size={11} className="text-red-400 shrink-0" /> : <CheckCircle2 size={11} className="text-green-400 shrink-0" />}
                      {a.action}
                    </p>
                    <p className="text-[10px] font-medium text-white/40 truncate">{a.detail}</p>
                  </div>
                  <p className="text-[10px] font-semibold text-white/30 shrink-0 text-right">
                    {who?.full_name ?? "—"}<br />
                    {new Date(a.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
