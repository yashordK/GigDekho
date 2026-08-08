import type { ReactNode } from "react";

/** Shared primitives so every admin page looks and behaves the same. */

export function PageTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
      <div>
        <h2 className="text-2xl font-black tracking-tight">{title}</h2>
        {subtitle && <p className="text-xs font-medium text-white/40 mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-[#1C1C1C] border border-white/5 rounded-2xl ${className}`}>{children}</div>
  );
}

export function StatCard({
  label, value, sub, accent = "orange", icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: "orange" | "green" | "blue" | "purple" | "red" | "neutral";
  icon?: ReactNode;
}) {
  const accents: Record<string, string> = {
    orange: "bg-[#F4511E]/10 text-[#F4511E] border-[#F4511E]/20",
    green: "bg-green-500/10 text-green-400 border-green-500/20",
    blue: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    purple: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    red: "bg-red-500/10 text-red-400 border-red-500/20",
    neutral: "bg-white/5 text-white/60 border-white/10",
  };
  return (
    <div className="bg-[#1C1C1C] border border-white/5 rounded-2xl p-5">
      <div className="flex items-start justify-between gap-2 mb-3">
        <span className="text-[10px] font-black uppercase tracking-widest text-white/40 leading-tight">{label}</span>
        {icon && (
          <span className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 ${accents[accent]}`}>
            {icon}
          </span>
        )}
      </div>
      <p className="text-2xl lg:text-3xl font-black tracking-tight leading-none">{value}</p>
      {sub && <p className="text-[11px] font-semibold text-white/35 mt-1.5">{sub}</p>}
    </div>
  );
}

export function Pill({ tone = "neutral", children }: { tone?: string; children: ReactNode }) {
  const tones: Record<string, string> = {
    neutral: "bg-white/5 text-white/60 border-white/15",
    orange: "bg-[#F4511E]/10 text-[#F4511E] border-[#F4511E]/25",
    green: "bg-green-500/10 text-green-400 border-green-500/25",
    blue: "bg-blue-500/10 text-blue-400 border-blue-500/25",
    yellow: "bg-yellow-500/10 text-yellow-400 border-yellow-500/25",
    red: "bg-red-500/10 text-red-400 border-red-500/25",
    purple: "bg-purple-500/10 text-purple-400 border-purple-500/25",
  };
  return (
    <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-full border whitespace-nowrap ${tones[tone] ?? tones.neutral}`}>
      {children}
    </span>
  );
}

export function EmptyState({ title, hint, icon }: { title: string; hint?: string; icon?: ReactNode }) {
  return (
    <div className="bg-[#1C1C1C] border border-white/5 border-dashed rounded-2xl p-10 text-center flex flex-col items-center">
      {icon && <div className="w-12 h-12 rounded-full bg-white/5 text-white/30 flex items-center justify-center mb-3">{icon}</div>}
      <p className="font-bold text-white/70 mb-1">{title}</p>
      {hint && <p className="text-xs font-medium text-white/35 max-w-sm leading-relaxed">{hint}</p>}
    </div>
  );
}

/** Horizontal bar chart for a daily series. */
export function BarSeries({ data, valueLabel }: { data: { label: string; value: number }[]; valueLabel?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) {
    return <p className="text-xs font-medium text-white/35 py-6 text-center">No data for this period yet.</p>;
  }
  return (
    <div className="flex items-end justify-between gap-1 h-40" role="img" aria-label={valueLabel ?? "Daily series"}>
      {data.map((d, i) => (
        <div key={i} className="flex-1 min-w-0 h-full flex flex-col justify-end items-center group relative">
          <div
            className="w-full max-w-[22px] rounded-t bg-[#F4511E]/70 group-hover:bg-[#F4511E] transition-all"
            style={{ height: `${Math.max(d.value > 0 ? 4 : 1, (d.value / max) * 100)}%` }}
          />
          <span className="absolute -top-1 text-[9px] font-black text-white opacity-0 group-hover:opacity-100 transition-opacity bg-[#111111] px-1.5 py-0.5 rounded border border-white/10 whitespace-nowrap z-10">
            {d.label}: {d.value}
          </span>
          {i % Math.ceil(data.length / 6) === 0 && (
            <span className="text-[8px] font-bold text-white/25 mt-1 truncate w-full text-center">{d.label}</span>
          )}
        </div>
      ))}
    </div>
  );
}

/** Conversion funnel with drop-off percentages. */
export function Funnel({ steps }: { steps: { label: string; value: number; hint?: string }[] }) {
  const top = Math.max(1, steps[0]?.value ?? 1);
  return (
    <div className="space-y-2.5">
      {steps.map((step, i) => {
        const pctOfTop = (step.value / top) * 100;
        const prev = i > 0 ? steps[i - 1].value : null;
        const conv = prev && prev > 0 ? Math.round((step.value / prev) * 100) : null;
        return (
          <div key={step.label}>
            <div className="flex items-baseline justify-between mb-1 gap-2">
              <span className="text-xs font-bold text-white/70">{step.label}</span>
              <span className="text-xs font-black text-white shrink-0">
                {step.value.toLocaleString("en-IN")}
                {conv !== null && (
                  <span className={`ml-2 text-[10px] font-bold ${conv >= 50 ? "text-green-400" : conv >= 20 ? "text-yellow-400" : "text-red-400"}`}>
                    {conv}%
                  </span>
                )}
              </span>
            </div>
            <div className="w-full h-2.5 bg-[#111111] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#F4511E] to-[#F4511E]/50 transition-all duration-700"
                style={{ width: `${Math.max(pctOfTop, step.value > 0 ? 2 : 0)}%` }}
              />
            </div>
            {step.hint && <p className="text-[10px] font-medium text-white/25 mt-1">{step.hint}</p>}
          </div>
        );
      })}
    </div>
  );
}
