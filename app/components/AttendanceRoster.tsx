import { useState, useEffect, useRef } from "react";
import {
  CheckCircle2, XCircle, Clock, ShieldCheck, IndianRupee, Loader2, Camera,
  AlertTriangle, Wallet,
} from "lucide-react";

/**
 * The hirer's roster: every accepted worker, every day, and the button that
 * pays them.
 *
 * Admins get the same component. The difference is not what they can see but
 * what the server lets them do — override a day the hirer already settled, and
 * pay an amount the attendance record does not support. Both of those are
 * checked in /api/attendance, not here; this only decides which controls are
 * worth rendering.
 *
 * Every read goes through the server. Fetching this with the browser's anon key
 * returned an empty roster for admins, because there is no admin SELECT policy
 * on `applications` — correctly, since an admin is neither the worker nor the
 * organizer. Rather than widen RLS, the data comes from the service role behind
 * an authorisation check, which is how the rest of the admin panel works.
 */

interface Row {
  id: string;
  application_id: string;
  worker_id: string;
  status: string;
  worker_marked_at: string | null;
  worker_selfie_url: string | null;
  confirmed_at: string | null;
  punctuality: string | null;
  day: { day_number: number; day_date: string; starts_at: string; ends_at: string; duration_hrs: number };
}

interface Worker {
  applicationId: string;
  workerId: string;
  name: string;
  email: string;
  status: string;
  rows: Row[];
  paid: number | null;
}

const PILL: Record<string, string> = {
  pending: "text-white/40 bg-white/5 border-white/10",
  worker_marked: "text-orange-400 bg-orange-500/10 border-orange-500/25",
  confirmed: "text-green-400 bg-green-500/10 border-green-500/25",
  excused: "text-blue-400 bg-blue-500/10 border-blue-500/25",
  absent: "text-red-400 bg-red-500/10 border-red-500/25",
  disputed: "text-red-400 bg-red-500/10 border-red-500/25",
};
const LABEL: Record<string, string> = {
  pending: "Not marked",
  worker_marked: "Checked in",
  confirmed: "Confirmed",
  excused: "Excused",
  absent: "Absent",
  disputed: "Disputed",
};

function fmtDay(d: Row["day"]) {
  return new Date(`${d.day_date}T00:00:00`)
    .toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

export default function AttendanceRoster({
  gigId,
  payRate,
  durationHrs,
  isAdmin = false,
}: {
  gigId: string;
  payRate: number;
  durationHrs: number;
  isAdmin?: boolean;
}) {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selfie, setSelfie] = useState<string | null>(null);
  const [payFor, setPayFor] = useState<Worker | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const hasLoaded = useRef(false);

  const totalPay = Math.round(payRate * durationHrs);

  const load = async () => {
    if (!hasLoaded.current) setLoading(true);
    try {
      const fd = new FormData();
      fd.append("intent", "roster");
      fd.append("gig_id", gigId);
      const res = await fetch("/api/attendance", { method: "POST", body: fd });
      const raw = await res.text();
      let r: any = {};
      try { r = raw ? JSON.parse(raw) : {}; } catch { throw new Error(`Server returned ${res.status}`); }
      if (!res.ok || r.error) throw new Error(r.error || "Couldn't load the roster.");
      setWorkers(r.workers ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      hasLoaded.current = true;
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [gigId]);

  const act = async (intent: string, fields: Record<string, string>, okMsg: string) => {
    const key = fields.attendance_id || fields.application_id;
    setBusy(key); setError(""); setNotice("");
    try {
      const fd = new FormData();
      fd.append("intent", intent);
      for (const [k, v] of Object.entries(fields)) fd.append(k, v);
      const res = await fetch("/api/attendance", { method: "POST", body: fd });
      const raw = await res.text();
      let r: any = {};
      try { r = raw ? JSON.parse(raw) : {}; } catch { throw new Error(`Server returned ${res.status}`); }
      if (!res.ok || r.error) throw new Error(r.error || "That didn't work.");
      setNotice(r.alreadyPaid ? "Already paid — nothing was charged twice." : okMsg);
      setPayFor(null);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  /** Signed URL, because the proof bucket is private and stays that way. */
  const viewSelfie = async (attendanceId: string) => {
    try {
      const fd = new FormData();
      fd.append("intent", "proof");
      fd.append("attendance_id", attendanceId);
      const res = await fetch("/api/attendance", { method: "POST", body: fd });
      const r = await res.json().catch(() => ({}));
      if (!res.ok || r.error || !r.url) throw new Error(r.error || "Couldn't open that photo.");
      setSelfie(r.url);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const earnedFor = (w: Worker) => {
    const total = w.rows.reduce((s, r) => s + Number(r.day.duration_hrs), 0);
    const done = w.rows.filter((r) => ["confirmed", "excused"].includes(r.status))
      .reduce((s, r) => s + Number(r.day.duration_hrs), 0);
    if (total <= 0) return 0;
    return done >= total ? totalPay : Math.round((totalPay * done) / total);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-white/40 text-xs font-bold py-6">
        <Loader2 size={14} className="animate-spin" /> Loading the roster…
      </div>
    );
  }

  if (!workers.length) {
    return (
      <p className="text-xs font-semibold text-white/35 py-4">
        Nobody has been accepted for this gig yet. Attendance appears here once someone is confirmed.
      </p>
    );
  }

  return (
    <div>
      {error && (
        <p className="text-[11px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2 mb-3">{error}</p>
      )}
      {notice && (
        <p className="text-[11px] font-bold text-green-400 bg-green-500/10 border border-green-500/20 rounded-xl px-3 py-2 mb-3">{notice}</p>
      )}

      <div className="space-y-3">
        {workers.map((w) => {
          const allResolved = w.rows.length > 0 &&
            w.rows.every((r) => ["confirmed", "absent", "excused"].includes(r.status));
          const earned = earnedFor(w);

          return (
            <div key={w.applicationId} className="bg-[#111111] border border-white/5 rounded-2xl p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                <div className="min-w-0">
                  <p className="font-black text-white text-sm truncate">{w.name}</p>
                  <p className="text-[10px] font-semibold text-white/35 truncate">{w.email}</p>
                </div>
                {w.paid != null ? (
                  <span className="px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-green-500/10 border border-green-500/25 text-green-400 flex items-center gap-1 shrink-0">
                    <Wallet size={11} /> Paid ₹{w.paid}
                  </span>
                ) : (
                  <span className="text-[10px] font-black uppercase tracking-wider text-white/35 shrink-0">
                    Earned so far ₹{earned}
                  </span>
                )}
              </div>

              <div className="space-y-2">
                {w.rows.map((r) => {
                  const settled = ["confirmed", "absent", "excused"].includes(r.status);
                  const canAct = isAdmin || !settled;
                  return (
                    <div key={r.id} className="flex items-center justify-between gap-2 flex-wrap bg-[#1C1C1C] border border-white/5 rounded-xl px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-[11px] font-black text-white">
                          Day {r.day.day_number} · {fmtDay(r.day)} · {r.day.duration_hrs}h
                        </p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${PILL[r.status] ?? PILL.pending}`}>
                            {LABEL[r.status] ?? r.status}
                          </span>
                          {r.punctuality === "late" && (
                            <span className="text-[9px] font-black uppercase tracking-wider text-orange-400">late</span>
                          )}
                          {r.worker_selfie_url && (
                            <button type="button" onClick={() => viewSelfie(r.id)}
                              className="text-[9px] font-black uppercase tracking-wider text-blue-400 hover:underline flex items-center gap-1">
                              <Camera size={9} /> Photo
                            </button>
                          )}
                        </div>
                      </div>

                      {canAct && (
                        <div className="flex gap-1.5 shrink-0 flex-wrap">
                          <button type="button" disabled={busy === r.id}
                            onClick={() => act("confirm", { attendance_id: r.id, punctuality: "on_time" }, "Day confirmed.")}
                            title="They were here on time"
                            className="px-2.5 py-1.5 rounded-lg bg-green-500/10 border border-green-500/25 text-green-400 text-[9px] font-black uppercase tracking-wider hover:bg-green-500/20 transition-colors btn-tap disabled:opacity-40 min-h-0">
                            <CheckCircle2 size={10} className="inline mr-1" />On time
                          </button>
                          <button type="button" disabled={busy === r.id}
                            onClick={() => act("confirm", { attendance_id: r.id, punctuality: "late" }, "Day confirmed as late.")}
                            title="They were here, but late"
                            className="px-2.5 py-1.5 rounded-lg bg-orange-500/10 border border-orange-500/25 text-orange-400 text-[9px] font-black uppercase tracking-wider hover:bg-orange-500/20 transition-colors btn-tap disabled:opacity-40 min-h-0">
                            <Clock size={10} className="inline mr-1" />Late
                          </button>
                          <button type="button" disabled={busy === r.id}
                            onClick={() => act("absent", { attendance_id: r.id }, "Marked absent — that day won't be paid.")}
                            className="px-2.5 py-1.5 rounded-lg bg-red-500/10 border border-red-500/25 text-red-400 text-[9px] font-black uppercase tracking-wider hover:bg-red-500/20 transition-colors btn-tap disabled:opacity-40 min-h-0">
                            <XCircle size={10} className="inline mr-1" />Absent
                          </button>
                          {isAdmin && (
                            <button type="button" disabled={busy === r.id}
                              onClick={() => act("excused", { attendance_id: r.id }, "Excused — this day still pays.")}
                              title="Called off or not their fault — still paid"
                              className="px-2.5 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/25 text-blue-400 text-[9px] font-black uppercase tracking-wider hover:bg-blue-500/20 transition-colors btn-tap disabled:opacity-40 min-h-0">
                              <ShieldCheck size={10} className="inline mr-1" />Excuse
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {w.paid == null && (
                <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between gap-3 flex-wrap">
                  {!allResolved && !isAdmin ? (
                    <p className="text-[10px] font-bold text-white/30 flex items-center gap-1.5">
                      <AlertTriangle size={11} /> Settle every day before paying.
                    </p>
                  ) : <span />}
                  <button
                    type="button"
                    disabled={busy === w.applicationId || (!allResolved && !isAdmin)}
                    onClick={() => {
                      if (isAdmin) { setPayFor(w); setPayAmount(String(earned)); }
                      else act("settle", { application_id: w.applicationId }, `Paid ₹${earned} into their wallet.`);
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#F4511E] hover:bg-[#d94418] text-white text-[10px] font-black uppercase tracking-wider transition-colors btn-tap disabled:opacity-40"
                  >
                    <IndianRupee size={11} /> Pay {earned}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {selfie && (
        <div className="fixed inset-0 z-[120] bg-black/90 flex items-center justify-center p-4" onClick={() => setSelfie(null)}>
          <img src={selfie} alt="Check-in photo" className="max-h-[85vh] max-w-full rounded-2xl border border-white/10" />
        </div>
      )}

      {payFor && (
        <div className="fixed inset-0 z-[120] bg-black/85 flex items-center justify-center p-4">
          <div className="bg-[#1C1C1C] border border-white/10 rounded-3xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="font-black text-white mb-1">Pay {payFor.name}</h3>
            <p className="text-xs font-medium text-white/45 mb-4 leading-relaxed">
              Attendance supports ₹{earnedFor(payFor)}. You can override that — the amount you enter is
              what lands in their wallet, and it can only be paid once.
            </p>
            <label htmlFor="pay-amt" className="block text-[10px] font-black uppercase tracking-wider text-white/50 mb-1.5">Amount</label>
            <input id="pay-amt" type="number" inputMode="numeric" value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              className="w-full h-11 px-4 rounded-xl bg-[#111111] border border-white/10 text-white text-sm font-bold focus:outline-none focus:border-[#F4511E] mb-4" />
            <div className="flex gap-2">
              <button type="button" onClick={() => setPayFor(null)}
                className="flex-1 py-3 rounded-xl border border-white/15 text-white/70 text-sm font-bold btn-tap">Cancel</button>
              <button type="button" disabled={busy === payFor.applicationId}
                onClick={() => act("settle", { application_id: payFor.applicationId, amount: payAmount }, `Paid ₹${payAmount}.`)}
                className="flex-1 py-3 rounded-xl bg-[#F4511E] hover:bg-[#d94418] text-white text-sm font-black btn-tap disabled:opacity-50">
                Pay ₹{payAmount || 0}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
