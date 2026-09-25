import { useState, useEffect } from "react";
import { supabase } from "~/lib/supabase.client";
import { CalendarDays, Check, Users, Loader2, AlertTriangle } from "lucide-react";

/**
 * The days of a gig, and — when the hirer allows it — which of them a worker
 * is signing up for.
 *
 * Each day shows how full it is. That is the whole point: a worker who is free
 * on any day will take the one that still needs people if you show them which
 * that is, and a day nobody can see is short stays short. Full days are not
 * hidden, only marked, because someone may still want to join the waitlist.
 *
 * Pay is quoted as one total, never per day. A day rate invites the reader to
 * price a single shift and haggle over it; the number that matters to someone
 * deciding whether to take the work is what they finish the run with.
 */

export interface GigDay {
  id: string;
  day_number: number;
  day_date: string;
  starts_at: string;
  ends_at: string;
  slots_needed: number;
  slots_filled: number;
  slots_left: number;
}

function fmtDate(d: string) {
  return new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", {
    weekday: "short", day: "numeric", month: "short",
  });
}

function fmtTime(t: string) {
  const [h, m] = t.split(":");
  const hr = Number(h);
  return `${hr % 12 || 12}:${m} ${hr >= 12 ? "PM" : "AM"}`;
}

export default function GigDayPicker({
  gigId,
  commitmentMode,
  minDays,
  dayRate,
  selected,
  onChange,
}: {
  gigId: string;
  commitmentMode: "all_days" | "pick_days";
  minDays: number | null;
  dayRate: number | null;
  /** Chosen gig_day ids. Ignored when the gig requires every day. */
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [days, setDays] = useState<GigDay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // gig_day_fill is a view, so the counts cannot drift from the rows they
      // are counted from.
      const { data } = await supabase
        .from("gig_day_fill")
        .select("gig_day_id, day_number, day_date, slots_needed, slots_filled, slots_left")
        .eq("gig_id", gigId)
        .order("day_number");

      if (cancelled) return;
      if (!data?.length) { setDays([]); setLoading(false); return; }

      const { data: times } = await supabase
        .from("gig_days")
        .select("id, starts_at, ends_at")
        .eq("gig_id", gigId);
      const byId = Object.fromEntries((times ?? []).map((t: any) => [t.id, t]));

      const rows: GigDay[] = data.map((r: any) => ({
        id: r.gig_day_id,
        day_number: r.day_number,
        day_date: r.day_date,
        starts_at: byId[r.gig_day_id]?.starts_at ?? "00:00:00",
        ends_at: byId[r.gig_day_id]?.ends_at ?? "00:00:00",
        slots_needed: r.slots_needed,
        slots_filled: r.slots_filled,
        slots_left: r.slots_left,
      }));
      setDays(rows);

      // A gig that wants the whole run has nothing to choose, so everything is
      // selected and the checkboxes never appear.
      if (commitmentMode === "all_days") onChange(rows.map((r) => r.id));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [gigId, commitmentMode]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-white/40 text-xs font-bold py-3">
        <Loader2 size={13} className="animate-spin" /> Loading the schedule…
      </div>
    );
  }
  // A single-day gig has no schedule worth showing — the date is already on the page.
  if (days.length < 2) return null;

  const canPick = commitmentMode === "pick_days";
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  const chosen = days.filter((d) => selected.includes(d.id));
  const belowMin = canPick && minDays != null && chosen.length > 0 && chosen.length < minDays;

  return (
    <div className="bg-[#1C1C1C] border border-white/5 rounded-2xl p-4 mb-4">
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <h3 className="text-[11px] font-black uppercase tracking-widest text-white/60 flex items-center gap-1.5">
          <CalendarDays size={12} className="text-[#F4511E]" />
          {days.length} days
        </h3>
        <span className="text-[10px] font-bold text-white/35">
          {canPick ? "Pick the days you can work" : "You'll be working every day"}
        </span>
      </div>

      <div className="space-y-2">
        {days.map((d) => {
          const isOn = selected.includes(d.id);
          const full = d.slots_left <= 0;
          return (
            <button
              key={d.id}
              type="button"
              disabled={!canPick}
              onClick={() => canPick && toggle(d.id)}
              aria-pressed={canPick ? isOn : undefined}
              className={`w-full text-left p-3 rounded-xl border transition-colors ${canPick ? "btn-tap" : "cursor-default"} ${
                isOn
                  ? "bg-[#F4511E]/10 border-[#F4511E]/40"
                  : full
                    ? "bg-[#111111] border-red-500/20"
                    : "bg-[#111111] border-white/10 hover:border-white/20"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-black text-white">
                    Day {d.day_number} · {fmtDate(d.day_date)}
                  </p>
                  <p className="text-[10px] font-semibold text-white/40 mt-0.5">
                    {fmtTime(d.starts_at)} – {fmtTime(d.ends_at)}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border flex items-center gap-1 ${
                      full
                        ? "text-red-400 bg-red-500/10 border-red-500/25"
                        : d.slots_left === 1
                          ? "text-orange-400 bg-orange-500/10 border-orange-500/25"
                          : "text-white/45 bg-white/5 border-white/10"
                    }`}
                  >
                    <Users size={9} />
                    {full ? "Full" : `${d.slots_left} left`}
                  </span>
                  {canPick && (
                    <span
                      className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
                        isOn ? "bg-[#F4511E] border-[#F4511E]" : "border-white/20"
                      }`}
                    >
                      {isOn && <Check size={12} className="text-white" />}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {canPick && (
        <div className="mt-3 pt-3 border-t border-white/5">
          {minDays != null && (
            <p className="text-[10px] font-semibold text-white/40 mb-1.5">
              This hirer needs at least {minDays} {minDays === 1 ? "day" : "days"} from each person.
            </p>
          )}
          {belowMin && (
            <p className="text-[11px] font-bold text-orange-400 flex items-center gap-1.5 mb-1.5">
              <AlertTriangle size={11} /> Pick {minDays! - chosen.length} more to apply.
            </p>
          )}
          <p className="text-[11px] font-bold text-white/60">
            {chosen.length === 0
              ? "No days picked yet."
              : <>
                  {chosen.length} {chosen.length === 1 ? "day" : "days"}
                  {dayRate != null && (
                    <span className="text-[#F4511E]"> · ₹{Math.round(dayRate * chosen.length)} total</span>
                  )}
                </>}
          </p>
        </div>
      )}
    </div>
  );
}
