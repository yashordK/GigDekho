import { useState, useEffect, useRef } from "react";
import { supabase } from "~/lib/supabase.client";
import {
  Camera, CheckCircle2, Clock, AlertTriangle, MapPin, Loader2, ShieldCheck,
} from "lucide-react";

/**
 * The worker's side of attendance: one row per day, and a check-in button that
 * takes a photo.
 *
 * The photo is the whole point. A tap proves nothing and cannot be argued with
 * later; a picture taken at the venue can. It is captured at check-in rather
 * than asked for during a dispute, so the evidence exists before anyone needs
 * it.
 *
 * Uploading is deliberately old-fashioned — the file goes straight into a
 * FormData POST from the change handler's own closure. Android discards this
 * page while the camera is open, and anything that depends on component state
 * surviving that round trip does not work on a real phone. That lesson cost
 * five attempts on document upload; it is not being relearned here.
 */

interface Day {
  id: string;              // gig_attendance id
  gig_day_id: string;
  status: string;
  worker_marked_at: string | null;
  confirmed_at: string | null;
  punctuality: string | null;
  day: {
    day_number: number;
    day_date: string;
    starts_at: string;
    ends_at: string;
    duration_hrs: number;
  };
}

const STATUS: Record<string, { label: string; cls: string; icon: any }> = {
  pending:       { label: "Not marked",     cls: "text-white/40 bg-white/5 border-white/10",              icon: Clock },
  worker_marked: { label: "Waiting on hirer", cls: "text-orange-400 bg-orange-500/10 border-orange-500/25", icon: Clock },
  confirmed:     { label: "Confirmed",      cls: "text-green-400 bg-green-500/10 border-green-500/25",     icon: CheckCircle2 },
  excused:       { label: "Excused",        cls: "text-blue-400 bg-blue-500/10 border-blue-500/25",        icon: ShieldCheck },
  absent:        { label: "Marked absent",  cls: "text-red-400 bg-red-500/10 border-red-500/25",           icon: AlertTriangle },
  disputed:      { label: "Disputed",       cls: "text-red-400 bg-red-500/10 border-red-500/25",           icon: AlertTriangle },
};

/** IST wall-clock day + time to a real instant. */
function instant(date: string, time: string) {
  return new Date(new Date(`${date}T${time}`).getTime() - 5.5 * 3600 * 1000);
}

function fmtDay(d: Day["day"]) {
  const dt = new Date(`${d.day_date}T00:00:00`);
  return dt.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

// Mirrors attendance_checkin_window_mins / attendance_late_checkin_hrs. These
// are only used to decide whether to draw the button — the server reads the
// real values from app_settings and has the final say.
const OPEN_MINS = 60;
const LATE_HRS = 12;

function fmtTime(t: string) {
  const [h, m] = t.split(":");
  const hr = Number(h);
  const ampm = hr >= 12 ? "PM" : "AM";
  return `${hr % 12 || 12}:${m} ${ampm}`;
}

/**
 * Shrinks a camera photo before upload. Phone cameras produce 4-8MB files and
 * the serverless request body caps out around 4.5MB, so a full-size photo would
 * fail at the edge with an error nobody can act on.
 */
async function shrink(file: File): Promise<File> {
  if (file.size < 900 * 1024) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const max = 1280;
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.82));
    if (!blob) return file;
    return new File([blob], "checkin.jpg", { type: "image/jpeg" });
  } catch {
    // Any failure here just means we send the original.
    return file;
  }
}

export default function AttendanceCheckIn({
  applicationId,
  workerId,
  onChanged,
}: {
  applicationId: string;
  workerId: string;
  onChanged?: () => void;
}) {
  const [days, setDays] = useState<Day[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const hasLoaded = useRef(false);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const load = async () => {
    // Only the very first load gets a spinner. A token refresh — which fires
    // whenever the tab regains focus, including on return from the camera —
    // must never blank this component out.
    if (!hasLoaded.current) setLoading(true);
    const { data } = await supabase
      .from("gig_attendance")
      .select("id, gig_day_id, status, worker_marked_at, confirmed_at, punctuality, day:gig_days(day_number, day_date, starts_at, ends_at, duration_hrs)")
      .eq("application_id", applicationId)
      .eq("worker_id", workerId);

    const rows = ((data ?? []) as any[])
      .map((r) => ({ ...r, day: Array.isArray(r.day) ? r.day[0] : r.day }))
      .filter((r) => r.day)
      .sort((a, b) => a.day.day_number - b.day.day_number);

    setDays(rows as Day[]);
    hasLoaded.current = true;
    setLoading(false);
  };

  useEffect(() => { load(); }, [applicationId, workerId]);

  const submit = async (attendanceId: string, file: File) => {
    setBusyId(attendanceId);
    setError(""); setNotice("");
    try {
      const small = await shrink(file);
      const fd = new FormData();
      fd.append("intent", "checkin");
      fd.append("attendance_id", attendanceId);
      fd.append("selfie", small, "checkin.jpg");
      const res = await fetch("/api/attendance", { method: "POST", body: fd });
      const raw = await res.text();
      let r: any = {};
      try { r = raw ? JSON.parse(raw) : {}; } catch { throw new Error(`Server returned ${res.status}`); }
      if (!res.ok || r.error) throw new Error(r.error || "Check-in failed.");
      setNotice("Checked in. The hirer will confirm it.");
      await load();
      onChanged?.();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-white/40 text-xs font-bold py-3">
        <Loader2 size={13} className="animate-spin" /> Loading your days…
      </div>
    );
  }
  if (!days.length) return null;

  const now = new Date();

  return (
    <div className="mt-4 pt-4 border-t border-white/5">
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <h4 className="text-[11px] font-black uppercase tracking-widest text-white/50 flex items-center gap-1.5">
          <MapPin size={12} className="text-[#F4511E]" />
          Attendance · {days.length} {days.length === 1 ? "day" : "days"}
        </h4>
        <span className="text-[10px] font-bold text-white/30">
          {days.filter((d) => d.status === "confirmed").length}/{days.length} confirmed
        </span>
      </div>

      {error && (
        <p className="text-[11px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2 mb-2">{error}</p>
      )}
      {notice && (
        <p className="text-[11px] font-bold text-green-400 bg-green-500/10 border border-green-500/20 rounded-xl px-3 py-2 mb-2">{notice}</p>
      )}

      <div className="space-y-2">
        {days.map((d) => {
          const s = STATUS[d.status] ?? STATUS.pending;
          const Icon = s.icon;
          const start = instant(d.day.day_date, d.day.starts_at);
          let end = instant(d.day.day_date, d.day.ends_at);
          if (end <= start) end = new Date(end.getTime() + 24 * 3600 * 1000);
          const opens = new Date(start.getTime() - OPEN_MINS * 60 * 1000);
          const closes = new Date(end.getTime() + LATE_HRS * 3600 * 1000);

          // The same window the server enforces. Offering a button that is
          // guaranteed to be rejected is worse than not offering one.
          const tooEarly = !d.worker_marked_at && now < opens;
          const closed = !d.worker_marked_at && now > closes;
          const canCheckIn = !d.worker_marked_at && d.status !== "absent" && !tooEarly && !closed;

          return (
            <div key={d.id} className="bg-[#111111] border border-white/5 rounded-xl p-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="text-xs font-black text-white">
                    Day {d.day.day_number} · {fmtDay(d.day)}
                  </p>
                  <p className="text-[10px] font-semibold text-white/40 mt-0.5">
                    {fmtTime(d.day.starts_at)} – {fmtTime(d.day.ends_at)} · {d.day.duration_hrs}h
                    {d.punctuality === "late" && <span className="text-orange-400"> · marked late</span>}
                  </p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border flex items-center gap-1 shrink-0 ${s.cls}`}>
                  <Icon size={10} /> {s.label}
                </span>
              </div>

              {canCheckIn && (
                <>
                  <input
                    ref={(el) => { fileInputs.current[d.id] = el; }}
                    type="file"
                    accept="image/*"
                    capture="user"
                    className="hidden"
                    // The file is read straight off the event and passed into
                    // the upload here. Nothing is stashed in state that a
                    // re-render could lose.
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (f) submit(d.id, f);
                    }}
                  />
                  <button
                    type="button"
                    disabled={busyId === d.id}
                    onClick={(e) => { e.stopPropagation(); fileInputs.current[d.id]?.click(); }}
                    className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#F4511E] hover:bg-[#d94418] text-white text-xs font-black uppercase tracking-wider transition-colors btn-tap disabled:opacity-60"
                  >
                    {busyId === d.id
                      ? <><Loader2 size={13} className="animate-spin" /> Checking in…</>
                      : <><Camera size={13} /> Check in with a photo</>}
                  </button>
                </>
              )}

              {tooEarly && (
                <p className="mt-2 text-[10px] font-semibold text-white/30">
                  Check-in opens an hour before the shift starts.
                </p>
              )}
              {closed && d.status === "pending" && (
                <p className="mt-2 text-[10px] font-semibold text-white/30">
                  Check-in has closed for this day. If you worked it, ask the hirer to mark you present.
                </p>
              )}
              {d.worker_marked_at && d.status === "worker_marked" && (
                <p className="mt-2 text-[10px] font-semibold text-white/30">
                  Marked at {new Date(d.worker_marked_at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })} — waiting for the hirer to confirm.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
