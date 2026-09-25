import { CalendarDays, Plus, Trash2, Clock, Users } from "lucide-react";

/**
 * The schedule for a gig that runs over more than one day.
 *
 * Days are edited here rather than derived from a start date and a length,
 * because real multi-day work is not uniform: a setup day is four hours and
 * the event day is eleven. Each day carries its own times and its own
 * headcount, which is what lets a hirer say "I need four people on the main
 * day and two for the setup".
 */

export interface DayForm {
  day_date: string;   // yyyy-mm-dd
  starts_at: string;  // HH:MM
  ends_at: string;    // HH:MM
  slots_needed: number | "";
}

/** yyyy-mm-dd for a Date, in local time. `toISOString` goes through UTC,
 * which rolls the date back a day for anyone east of it (IST included) — the
 * exact bug that silently broke same-day date math here before. */
function localISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function emptyDay(afterDate?: string): DayForm {
  const base = afterDate ? new Date(`${afterDate}T00:00:00`) : new Date();
  base.setDate(base.getDate() + (afterDate ? 1 : 7));
  return {
    day_date: localISODate(base),
    starts_at: "10:00",
    ends_at: "18:00",
    slots_needed: 2,
  };
}

/** Hours between two HH:MM values, treating an end before a start as crossing midnight. */
export function dayHours(d: DayForm): number {
  const [sh, sm] = d.starts_at.split(":").map(Number);
  const [eh, em] = d.ends_at.split(":").map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return 0;
  let mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins <= 0) mins += 24 * 60;
  return Math.round((mins / 60) * 100) / 100;
}

export function totalHours(days: DayForm[]): number {
  return Math.round(days.reduce((s, d) => s + dayHours(d), 0) * 100) / 100;
}

/**
 * Hours and minutes, the way a shift is actually spoken about.
 *
 * dayHours returns decimal hours because that is what the duration column
 * stores and what the pay maths multiplies. Showing that number raw reads as
 * a wrong time: 4:30pm to 11:59pm is 7 hours 29 minutes, which decimalises to
 * 7.48 and looks like 7 hours 48 minutes to anyone reading quickly.
 */
export function fmtDuration(hours: number): string {
  const mins = Math.round(hours * 60);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export default function GigDaysEditor({
  days,
  onChange,
  errors = {},
}: {
  days: DayForm[];
  onChange: (d: DayForm[]) => void;
  errors?: Record<string, string>;
}) {
  // Editing a field on day i also updates every later day that still carries
  // that same value forward — i.e. one the hirer never customised away from
  // what was auto-filled. A day that was deliberately set differently keeps
  // its own value; the date is never cascaded this way since each day's date
  // is necessarily distinct.
  const set = (i: number, patch: Partial<DayForm>) =>
    onChange(
      days.map((d, n) => {
        if (n === i) return { ...d, ...patch };
        if (n < i) return d;
        const cascade: Partial<DayForm> = {};
        (Object.keys(patch) as (keyof DayForm)[]).forEach((key) => {
          if (key === "day_date") return;
          if (d[key] === days[i][key]) cascade[key] = patch[key] as any;
        });
        return Object.keys(cascade).length ? { ...d, ...cascade } : d;
      })
    );

  // A new day starts as a copy of the last one — same times, same headcount —
  // with its date pushed one day forward. Re-entering the same details for
  // every day is the exact hassle this is meant to remove.
  const add = () => {
    const prev = days[days.length - 1];
    const next = prev
      ? { ...emptyDay(prev.day_date), starts_at: prev.starts_at, ends_at: prev.ends_at, slots_needed: prev.slots_needed }
      : emptyDay();
    onChange([...days, next]);
  };
  const remove = (i: number) => onChange(days.filter((_, n) => n !== i));

  const input =
    "w-full h-11 px-3 rounded-xl bg-[#111111] md:bg-[#1C1C1C] border border-white/10 text-white text-sm font-semibold focus:outline-none focus:border-[#F4511E]";
  const tiny = "block text-[10px] font-black text-white/50 uppercase tracking-wider mb-1";

  return (
    <div className="space-y-3">
      {days.map((d, i) => {
        const hrs = dayHours(d);
        return (
          <div key={i} className="bg-[#1C1C1C] md:bg-[#111111] border border-white/10 rounded-2xl p-3.5">
            <div className="flex items-center justify-between mb-3 gap-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-[#F4511E] flex items-center gap-1.5">
                <CalendarDays size={12} /> Day {i + 1}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-white/40 flex items-center gap-1">
                  <Clock size={10} /> {fmtDuration(hrs)}
                </span>
                {days.length > 1 && (
                  <button
                    type="button"
                    onClick={() => remove(i)}
                    aria-label={`Remove day ${i + 1}`}
                    className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors btn-tap min-h-0"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-2.5">
              <div>
                <label htmlFor={`day-date-${i}`} className={tiny}>Date</label>
                <input id={`day-date-${i}`} type="date" value={d.day_date}
                  onChange={(e) => set(i, { day_date: e.target.value })} className={input} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor={`day-start-${i}`} className={tiny}>Starts</label>
                  <input id={`day-start-${i}`} type="time" value={d.starts_at}
                    onChange={(e) => set(i, { starts_at: e.target.value })} className={input} />
                </div>
                <div>
                  <label htmlFor={`day-end-${i}`} className={tiny}>Ends</label>
                  <input id={`day-end-${i}`} type="time" value={d.ends_at}
                    onChange={(e) => set(i, { ends_at: e.target.value })} className={input} />
                </div>
              </div>
              <div>
                <label htmlFor={`day-slots-${i}`} className={tiny}>
                  <Users size={10} className="inline mr-1 -mt-0.5" />People needed this day
                </label>
                <input id={`day-slots-${i}`} type="number" inputMode="numeric" min={1} value={d.slots_needed}
                  onChange={(e) => set(i, { slots_needed: e.target.value === "" ? "" : Number(e.target.value) })}
                  className={input} />
              </div>
            </div>
          </div>
        );
      })}

      {errors.days && (
        <p className="text-[11px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
          {errors.days}
        </p>
      )}

      <button
        type="button"
        onClick={add}
        className="w-full py-3 rounded-xl border border-dashed border-white/15 text-white/60 hover:text-white hover:border-[#F4511E]/40 text-xs font-black uppercase tracking-wider transition-colors btn-tap flex items-center justify-center gap-2"
      >
        <Plus size={14} /> Add another day
      </button>

      <p className="text-[11px] font-bold text-white/40 text-center">
        {days.length} {days.length === 1 ? "day" : "days"} · {fmtDuration(totalHours(days))} in total
      </p>
    </div>
  );
}
