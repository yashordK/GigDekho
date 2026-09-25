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

export function emptyDay(afterDate?: string): DayForm {
  const base = afterDate ? new Date(`${afterDate}T00:00:00`) : new Date();
  base.setDate(base.getDate() + (afterDate ? 1 : 7));
  return {
    day_date: base.toISOString().slice(0, 10),
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

export default function GigDaysEditor({
  days,
  onChange,
  errors = {},
}: {
  days: DayForm[];
  onChange: (d: DayForm[]) => void;
  errors?: Record<string, string>;
}) {
  const set = (i: number, patch: Partial<DayForm>) =>
    onChange(days.map((d, n) => (n === i ? { ...d, ...patch } : d)));

  const add = () => onChange([...days, emptyDay(days[days.length - 1]?.day_date)]);
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
                  <Clock size={10} /> {hrs || 0} hrs
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
        {days.length} {days.length === 1 ? "day" : "days"} · {totalHours(days)} hours in total
      </p>
    </div>
  );
}
