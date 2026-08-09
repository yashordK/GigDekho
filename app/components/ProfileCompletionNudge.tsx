import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { supabase } from "~/lib/supabase.client";
import { useAuth } from "~/context/AuthContext";
import {
  completionFor, hasSeenPrompt, markPromptSeen, isCardSnoozed, snoozeCard,
} from "~/lib/profile-completion";
import { CheckCircle2, Circle, X, ShieldCheck, ArrowRight, Sparkles } from "lucide-react";

/**
 * Nudges people to finish their profile and get verified.
 *
 * Deliberately restrained: the modal appears ONCE per account, ever. After
 * that the only reminder is a quiet inline card on the dashboard, and
 * dismissing that hides it for a week. Both disappear permanently once the
 * profile is complete — nobody gets nagged about something they've done.
 */
export default function ProfileCompletionNudge({
  isOrganizerView,
}: {
  isOrganizerView: boolean;
}) {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [skillCount, setSkillCount] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [cardHidden, setCardHidden] = useState(true);

  // Skills only matter for the worker checklist
  useEffect(() => {
    if (!user || isOrganizerView) { setSkillCount(0); return; }
    supabase
      .from("worker_skills")
      .select("id", { count: "exact", head: true })
      .eq("worker_id", user.id)
      .then(({ count }) => setSkillCount(count ?? 0));
  }, [user, isOrganizerView]);

  const ready = Boolean(user && profile) && skillCount !== null;
  const completion = ready
    ? completionFor(profile, isOrganizerView, { skillCount: skillCount ?? 0 })
    : null;

  useEffect(() => {
    if (!ready || !user || !completion || completion.complete) return;
    if (!hasSeenPrompt(user.id)) {
      // Let the dashboard paint first — an instant modal feels like an ad
      const t = setTimeout(() => setShowModal(true), 1200);
      return () => clearTimeout(t);
    }
    setCardHidden(isCardSnoozed(user.id));
  }, [ready, user, completion?.complete]);

  if (!ready || !completion || completion.complete || !user) return null;

  const dismissModal = () => {
    markPromptSeen(user.id);
    setShowModal(false);
    setCardHidden(isCardSnoozed(user.id));
  };

  const goFinish = () => {
    markPromptSeen(user.id);
    setShowModal(false);
    navigate(completion.nextStep?.href ?? "/worker/profile");
  };

  const blocking = completion.steps.find((s) => s.blocking && !s.done);

  return (
    <>
      {/* One-time modal */}
      {showModal && (
        <div className="fixed inset-0 z-[100] bg-black/85 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
          <div className="bg-[#1C1C1C] border-t sm:border border-white/10 w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl max-h-[92dvh] overflow-y-auto hide-scrollbar animate-in slide-in-from-bottom sm:zoom-in duration-300">
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 rounded-2xl bg-[#F4511E]/10 border border-[#F4511E]/20 text-[#F4511E] flex items-center justify-center">
                <Sparkles size={22} />
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={dismissModal}
                className="p-2 bg-white/10 text-white/60 hover:text-white rounded-full btn-tap"
              >
                <X size={16} />
              </button>
            </div>

            <h2 className="text-xl font-black text-white tracking-tight mb-2">
              {blocking
                ? "One step before you can apply"
                : `You're ${completion.percent}% set up`}
            </h2>
            <p className="text-sm font-medium text-white/50 leading-relaxed mb-5">
              {blocking
                ? "Verifying your ID is what lets hirers trust who's turning up — it's required before your first application."
                : isOrganizerView
                  ? "A complete profile gets noticeably more applicants. It takes about two minutes."
                  : "A complete profile gets you picked more often. It takes about two minutes."}
            </p>

            <div className="space-y-2 mb-6">
              {completion.steps.map((s) => (
                <div
                  key={s.id}
                  className={`flex items-start gap-3 rounded-xl px-3.5 py-3 border ${
                    s.done ? "bg-green-500/5 border-green-500/15" : "bg-[#111111] border-white/5"
                  }`}
                >
                  {s.done ? (
                    <CheckCircle2 size={16} className="text-green-400 shrink-0 mt-0.5" />
                  ) : (
                    <Circle size={16} className="text-white/25 shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0">
                    <p className={`text-xs font-bold ${s.done ? "text-white/50 line-through" : "text-white"}`}>
                      {s.label}
                      {s.blocking && !s.done && (
                        <span className="ml-2 text-[9px] font-black uppercase tracking-wider text-[#F4511E] bg-[#F4511E]/10 border border-[#F4511E]/25 px-1.5 py-0.5 rounded-full">
                          Required
                        </span>
                      )}
                    </p>
                    {!s.done && (
                      <p className="text-[11px] font-medium text-white/40 leading-relaxed mt-0.5">{s.benefit}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={goFinish}
              className="w-full py-3.5 bg-[#F4511E] hover:bg-[#D84315] text-white rounded-xl font-black text-sm btn-tap transition-colors flex items-center justify-center gap-2"
            >
              {blocking ? "Verify my ID" : "Finish my profile"} <ArrowRight size={15} />
            </button>
            <button
              type="button"
              onClick={dismissModal}
              className="w-full mt-2 py-2.5 text-xs font-bold text-white/40 hover:text-white/70 transition-colors btn-tap"
            >
              I'll do it later
            </button>
            <p className="text-[10px] font-medium text-white/25 text-center mt-2">
              We won't interrupt you about this again.
            </p>
          </div>
        </div>
      )}

      {/* Quiet inline reminder */}
      {!showModal && !cardHidden && (
        <div className="bg-[#1C1C1C] border border-[#F4511E]/20 rounded-2xl p-4 mb-6 flex flex-wrap items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-[#F4511E]/10 border border-[#F4511E]/20 text-[#F4511E] flex items-center justify-center shrink-0">
            <ShieldCheck size={18} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1.5">
              <p className="text-sm font-black text-white">
                {blocking ? "Verify your ID to start applying" : "Finish your profile"}
              </p>
              <span className="text-[10px] font-black text-white/40">
                {completion.done}/{completion.total}
              </span>
            </div>
            <div className="w-full max-w-xs h-1.5 bg-[#111111] rounded-full overflow-hidden mb-1.5">
              <div
                className="h-full rounded-full bg-[#F4511E] transition-all duration-700"
                style={{ width: `${completion.percent}%` }}
              />
            </div>
            <p className="text-[11px] font-medium text-white/40 leading-relaxed">
              Next: {completion.nextStep?.label} — {completion.nextStep?.benefit.toLowerCase()}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => navigate(completion.nextStep?.href ?? "/worker/profile")}
              className="bg-[#F4511E] hover:bg-[#D84315] text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider btn-tap transition-colors"
            >
              Continue
            </button>
            <button
              type="button"
              aria-label="Hide for now"
              onClick={() => { snoozeCard(user.id); setCardHidden(true); }}
              className="p-2 rounded-lg text-white/25 hover:text-white/60 transition-colors btn-tap"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
