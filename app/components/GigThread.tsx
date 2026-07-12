import { useState, useEffect } from 'react';
import { supabase } from '~/lib/supabase.client';
import { detectContactInfo } from '~/lib/contact-filter';
import { Megaphone, MessagesSquare, Lock, Send, CornerDownRight } from 'lucide-react';

/**
 * Gig-scoped announcements + Q&A thread. Visible to the organizer and anyone
 * who applied (RLS enforces this — others simply fetch nothing).
 */
export default function GigThread({
  gigId,
  eventDate,
  isOrganizer,
  hasApplied,
  userId,
}: {
  gigId: string;
  eventDate: string;
  isOrganizer: boolean;
  hasApplied: boolean;
  userId: string | null;
}) {
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');

  const isLocked = new Date(eventDate) <= new Date();
  const canParticipate = !!userId && (isOrganizer || hasApplied);

  const fetchThread = async () => {
    if (!canParticipate) return;
    const [{ data: anns }, { data: qs }] = await Promise.all([
      supabase
        .from('gig_announcements')
        .select('id, message, audience, created_at, organizer:profiles!gig_announcements_organizer_id_fkey(full_name, company_name)')
        .eq('gig_id', gigId)
        .order('created_at', { ascending: false }),
      supabase
        .from('gig_questions')
        .select('id, body, parent_id, created_at, author_id, author:profiles!gig_questions_author_id_fkey(full_name)')
        .eq('gig_id', gigId)
        .order('created_at', { ascending: true }),
    ]);
    setAnnouncements(anns || []);
    setQuestions(qs || []);
  };

  useEffect(() => { fetchThread(); }, [gigId, canParticipate]);

  if (!canParticipate) return null;

  const topLevel = questions.filter(q => !q.parent_id);
  const repliesFor = (id: string) => questions.filter(q => q.parent_id === id);

  const handlePost = async () => {
    const body = draft.trim();
    if (!body) return;
    // Instant client-side feedback; the server re-checks authoritatively
    const detected = detectContactInfo(body);
    if (detected) {
      setError(`Looks like that contains a ${detected} — contact details can't be shared here.`);
      return;
    }
    setPosting(true);
    setError('');
    try {
      const form = new FormData();
      form.append('gig_id', gigId);
      form.append('body', body);
      if (replyTo) form.append('parent_id', replyTo);
      const res = await fetch('/api/qa', { method: 'POST', body: form });
      const result = await res.json();
      if (!res.ok || result.error) throw new Error(result.error || 'Failed to post');
      setDraft('');
      setReplyTo(null);
      await fetchThread();
    } catch (err: any) {
      setError(err.message || 'Could not post. Try again.');
    } finally {
      setPosting(false);
    }
  };

  const authorName = (q: any) => {
    const a = Array.isArray(q.author) ? q.author[0] : q.author;
    return a?.full_name || 'User';
  };

  return (
    <div className="mb-10 space-y-6">
      {/* Announcements */}
      {announcements.length > 0 && (
        <div>
          <h3 className="font-black text-white text-lg mb-4 flex items-center gap-2">
            <Megaphone size={18} className="text-[#F4511E]" /> Announcements
          </h3>
          <div className="space-y-3">
            {announcements.map(a => {
              const org = Array.isArray(a.organizer) ? a.organizer[0] : a.organizer;
              return (
                <div key={a.id} className="bg-[#F4511E]/5 border border-[#F4511E]/20 rounded-2xl p-4">
                  <p className="text-sm font-medium text-white/85 leading-relaxed whitespace-pre-wrap">{a.message}</p>
                  <p className="text-[10px] font-bold text-white/40 mt-2 uppercase tracking-wider">
                    {org?.company_name || org?.full_name || 'Hirer'} · {new Date(a.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Q&A */}
      <div>
        <h3 className="font-black text-white text-lg mb-1 flex items-center gap-2">
          <MessagesSquare size={18} className="text-[#00BCD4]" /> Questions & Answers
        </h3>
        <p className="text-xs font-medium text-white/40 mb-4">
          Visible to everyone who applied — check here before asking, your question may already be answered.
        </p>

        {topLevel.length === 0 ? (
          <div className="bg-[#1C1C1C] border border-white/5 border-dashed rounded-2xl p-5 text-sm font-medium text-white/40 mb-4">
            {isLocked ? 'No questions were asked on this gig.' : isOrganizer ? 'No questions yet — workers can ask here and everyone sees your answer.' : 'No questions yet — be the first to ask.'}
          </div>
        ) : (
          <div className="space-y-3 mb-4">
            {topLevel.map(q => (
              <div key={q.id} className="bg-[#1C1C1C] border border-white/5 rounded-2xl p-4">
                <div className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-white/10 text-white/60 font-black flex items-center justify-center text-xs shrink-0">
                    {authorName(q).charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold text-white/40">{authorName(q)} · {new Date(q.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                    <p className="text-sm font-medium text-white/85 leading-relaxed">{q.body}</p>
                  </div>
                  {!isLocked && (
                    <button type="button" onClick={() => { setReplyTo(replyTo === q.id ? null : q.id); setError(''); }}
                      className="text-[10px] font-black text-[#F4511E] uppercase tracking-wider btn-tap min-h-0 shrink-0" style={{ minHeight: '28px' }}>
                      Reply
                    </button>
                  )}
                </div>
                {repliesFor(q.id).map(r => (
                  <div key={r.id} className="ml-9 mt-3 flex items-start gap-2 bg-[#111111] rounded-xl p-3 border border-white/5">
                    <CornerDownRight size={13} className="text-white/30 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] font-bold text-[#F4511E]">{r.author_id === q.author_id ? authorName(r) : `${authorName(r)}${isOrganizer && r.author_id === userId ? ' (you)' : ''}`}</p>
                      <p className="text-sm font-medium text-white/75 leading-relaxed">{r.body}</p>
                    </div>
                  </div>
                ))}
                {replyTo === q.id && !isLocked && (
                  <div className="ml-9 mt-3 flex gap-2">
                    <input
                      type="text"
                      value={draft}
                      onChange={e => setDraft(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handlePost()}
                      placeholder="Write a reply…"
                      aria-label="Reply"
                      className="flex-1 h-10 px-3 rounded-xl bg-[#111111] border border-white/10 text-white text-sm font-medium placeholder:text-white/30 focus:outline-none focus:border-[#F4511E]"
                    />
                    <button type="button" onClick={handlePost} disabled={posting} aria-label="Send reply"
                      className="w-10 h-10 rounded-xl bg-[#F4511E] text-white flex items-center justify-center btn-tap disabled:opacity-50 min-h-0">
                      <Send size={15} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {error && <p className="text-red-400 text-xs font-semibold mb-3">{error}</p>}

        {isLocked ? (
          <div className="flex items-center gap-2 text-xs font-bold text-white/40 bg-[#1C1C1C] border border-white/5 rounded-xl px-4 py-3">
            <Lock size={14} /> Thread locked — the gig date has passed.
          </div>
        ) : replyTo === null && (
          <div className="flex gap-2">
            <input
              type="text"
              value={draft}
              onChange={e => { setDraft(e.target.value); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && handlePost()}
              placeholder={isOrganizer ? 'Post an answer or note…' : 'Ask a question about this gig…'}
              aria-label="New question"
              className="flex-1 h-11 px-4 rounded-xl bg-[#1C1C1C] border border-white/10 text-white text-sm font-medium placeholder:text-white/30 focus:outline-none focus:border-[#F4511E]"
            />
            <button type="button" onClick={handlePost} disabled={posting || !draft.trim()} aria-label="Post question"
              className="w-11 h-11 rounded-xl bg-[#F4511E] hover:bg-[#D84315] text-white flex items-center justify-center btn-tap disabled:opacity-50 transition-colors">
              <Send size={16} />
            </button>
          </div>
        )}
        {!isLocked && <p className="text-[10px] font-medium text-white/30 mt-2">Phone numbers, emails, and social handles are automatically blocked.</p>}
      </div>
    </div>
  );
}
