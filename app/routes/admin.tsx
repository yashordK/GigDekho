import { useState, useEffect } from 'react';
import { supabase } from '~/lib/supabase.client';
import { useAuth } from '~/context/AuthContext';
import { useNavigate } from 'react-router';
import { ShieldCheck, Search, CheckCircle2, XCircle, Ban, FileText, Crown, GraduationCap, BadgeCheck, Building2, ExternalLink } from 'lucide-react';

const DOC_LABELS: Record<string, string> = {
  aadhaar: 'Aadhaar (ID)',
  student_id: 'College ID',
  gst: 'GST Certificate',
  shop_license: 'Shop License',
};

// Which profile flag an approved document unlocks
const DOC_APPROVAL_EFFECT: Record<string, Record<string, any>> = {
  aadhaar: { id_verified: true },
  student_id: { student_status: 'student_verified' },
  gst: { business_verified: true },
  shop_license: { business_verified: true },
};

const BADGE_FIELDS = [
  { key: 'id_verified', label: 'ID Verified', icon: <ShieldCheck size={13} /> },
  { key: 'business_verified', label: 'Verified Business', icon: <Building2 size={13} /> },
  { key: 'basics_certified', label: 'Basics Certified', icon: <BadgeCheck size={13} /> },
  { key: 'campus_ambassador', label: 'Campus Ambassador', icon: <Crown size={13} /> },
];

export default function AdminScreen() {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'queue' | 'users'>('queue');

  // Queue state
  const [queue, setQueue] = useState<any[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [busy, setBusy] = useState(false);

  // Users state
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const isAdmin = (profile as any)?.is_admin === true;

  useEffect(() => {
    if (!authLoading && (!user || (profile && !isAdmin))) {
      navigate('/');
    }
  }, [authLoading, user, profile]);

  const fetchQueue = async () => {
    const { data } = await supabase
      .from('verification_documents')
      .select('id, user_id, doc_type, file_path, status, created_at, profiles!verification_documents_user_id_fkey(full_name, email, phone, role)')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
    setQueue(data || []);
  };

  useEffect(() => {
    if (isAdmin) fetchQueue();
  }, [isAdmin]);

  const logAction = async (action: string, targetUserId: string, targetDocumentId: string | null, detail: string) => {
    await supabase.from('admin_actions').insert({
      admin_id: user.id,
      action,
      target_user_id: targetUserId,
      target_document_id: targetDocumentId,
      detail,
    });
  };

  const openPreview = async (doc: any) => {
    const { data, error } = await supabase.storage
      .from('verification-docs')
      .createSignedUrl(doc.file_path, 300);
    if (!error && data?.signedUrl) setPreviewUrl(data.signedUrl);
  };

  const approveDoc = async (doc: any) => {
    setBusy(true);
    try {
      await supabase.from('verification_documents').update({
        status: 'approved',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        rejection_reason: null,
      }).eq('id', doc.id);
      const effect = DOC_APPROVAL_EFFECT[doc.doc_type];
      if (effect) await supabase.from('profiles').update(effect).eq('id', doc.user_id);
      await logAction('approve_document', doc.user_id, doc.id, `Approved ${doc.doc_type}`);
      await fetchQueue();
    } finally {
      setBusy(false);
    }
  };

  const rejectDoc = async () => {
    if (!rejecting) return;
    setBusy(true);
    try {
      await supabase.from('verification_documents').update({
        status: 'rejected',
        rejection_reason: rejectReason.trim() || 'Document unclear — please re-upload.',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      }).eq('id', rejecting.id);
      await logAction('reject_document', rejecting.user_id, rejecting.id, `Rejected ${rejecting.doc_type}: ${rejectReason}`);
      setRejecting(null);
      setRejectReason('');
      await fetchQueue();
    } finally {
      setBusy(false);
    }
  };

  const searchUsers = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    try {
      const q = query.trim();
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone, role, city, avg_rating, is_suspended, id_verified, business_verified, basics_certified, campus_ambassador, student_status, worker_level, created_at')
        .or(`full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`)
        .limit(20);
      setResults(data || []);
    } finally {
      setSearching(false);
    }
  };

  const toggleBadge = async (target: any, key: string) => {
    const newVal = !target[key];
    await supabase.from('profiles').update({ [key]: newVal }).eq('id', target.id);
    await logAction(newVal ? 'grant_badge' : 'revoke_badge', target.id, null, `${key} → ${newVal}`);
    setResults(rs => rs.map(r => r.id === target.id ? { ...r, [key]: newVal } : r));
  };

  const toggleStudentVerified = async (target: any) => {
    const newStatus = target.student_status === 'student_verified' ? 'student_unverified' : 'student_verified';
    await supabase.from('profiles').update({ student_status: newStatus }).eq('id', target.id);
    await logAction(newStatus === 'student_verified' ? 'grant_badge' : 'revoke_badge', target.id, null, `student_status → ${newStatus}`);
    setResults(rs => rs.map(r => r.id === target.id ? { ...r, student_status: newStatus } : r));
  };

  const toggleSuspend = async (target: any) => {
    const newVal = !target.is_suspended;
    await supabase.from('profiles').update({ is_suspended: newVal }).eq('id', target.id);
    await logAction(newVal ? 'suspend_user' : 'unsuspend_user', target.id, null, newVal ? 'Account suspended' : 'Account unsuspended');
    setResults(rs => rs.map(r => r.id === target.id ? { ...r, is_suspended: newVal } : r));
  };

  if (authLoading || !profile) {
    return <div className="min-h-screen flex items-center justify-center bg-[#111111]"><div className="w-8 h-8 border-4 border-white/10 border-t-[#F4511E] rounded-full animate-spin" /></div>;
  }
  if (!isAdmin) return null;

  return (
    <main className="min-h-screen bg-[#111111] text-white pb-24 pt-8 px-4 lg:px-12">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#F4511E]/10 border border-[#F4511E]/20 text-[#F4511E] flex items-center justify-center">
            <ShieldCheck size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight">Admin Panel</h1>
            <p className="text-xs font-bold text-white/40">Internal only — every action is logged.</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-[#1C1C1C] border border-white/10 p-1.5 rounded-full w-full max-w-sm">
          <button onClick={() => setTab('queue')} className={`flex-1 py-2 text-sm font-bold rounded-full transition-all btn-tap min-h-0 ${tab === 'queue' ? 'bg-[#F4511E] text-white' : 'text-white/60'}`} style={{ minHeight: '38px' }}>
            Verification Queue {queue.length > 0 && <span className="ml-1 text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full">{queue.length}</span>}
          </button>
          <button onClick={() => setTab('users')} className={`flex-1 py-2 text-sm font-bold rounded-full transition-all btn-tap min-h-0 ${tab === 'users' ? 'bg-[#F4511E] text-white' : 'text-white/60'}`} style={{ minHeight: '38px' }}>
            Users
          </button>
        </div>

        {/* ── Queue tab ── */}
        {tab === 'queue' && (
          <div className="space-y-3">
            {queue.length === 0 ? (
              <div className="bg-[#1C1C1C] border border-white/5 rounded-2xl p-10 text-center">
                <CheckCircle2 size={28} className="text-green-400 mx-auto mb-3" />
                <p className="font-bold text-white/70">Queue is clear — no documents awaiting review.</p>
              </div>
            ) : (
              queue.map(doc => {
                const p = Array.isArray(doc.profiles) ? doc.profiles[0] : doc.profiles;
                return (
                  <div key={doc.id} className="bg-[#1C1C1C] border border-white/5 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-white/5 text-[#F4511E] flex items-center justify-center shrink-0">
                        <FileText size={18} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-black text-sm">{p?.full_name || 'Unknown'} <span className="text-white/40 font-bold">· {p?.role}</span></p>
                        <p className="text-[11px] font-semibold text-white/40 truncate">{DOC_LABELS[doc.doc_type]} · {p?.email || p?.phone || '—'} · {new Date(doc.created_at).toLocaleDateString('en-IN')}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => openPreview(doc)} className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-white/15 text-white/70 hover:text-white text-xs font-bold btn-tap">
                        <ExternalLink size={12} /> Preview
                      </button>
                      <button type="button" disabled={busy} onClick={() => approveDoc(doc)} className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-green-500/15 border border-green-500/30 text-green-400 hover:bg-green-500/25 text-xs font-black btn-tap disabled:opacity-50">
                        <CheckCircle2 size={12} /> Approve
                      </button>
                      <button type="button" disabled={busy} onClick={() => { setRejecting(doc); setRejectReason(''); }} className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25 text-xs font-black btn-tap disabled:opacity-50">
                        <XCircle size={12} /> Reject
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ── Users tab ── */}
        {tab === 'users' && (
          <div className="space-y-4">
            <form onSubmit={searchUsers} className="flex gap-2">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                <input
                  type="text"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search by name, email, or phone…"
                  aria-label="Search users"
                  className="w-full h-11 pl-11 pr-4 rounded-xl bg-[#1C1C1C] border border-white/10 text-white text-sm font-semibold placeholder:text-white/30 focus:outline-none focus:border-[#F4511E]"
                />
              </div>
              <button type="submit" disabled={searching} className="px-6 h-11 bg-[#F4511E] hover:bg-[#D84315] rounded-xl text-sm font-black btn-tap disabled:opacity-50">
                {searching ? '…' : 'Search'}
              </button>
            </form>

            {results.map(u => (
              <div key={u.id} className={`bg-[#1C1C1C] border rounded-2xl p-5 space-y-4 ${u.is_suspended ? 'border-red-500/30' : 'border-white/5'}`}>
                <div className="flex flex-wrap justify-between items-start gap-3">
                  <div>
                    <p className="font-black text-base">
                      {u.full_name}
                      {u.is_suspended && <span className="ml-2 text-[9px] uppercase font-black bg-red-500/15 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full">Suspended</span>}
                    </p>
                    <p className="text-[11px] font-semibold text-white/40">
                      {u.role} · {u.city} · {u.email || '—'} · {u.phone || 'no phone'} · ⭐ {u.avg_rating ? Number(u.avg_rating).toFixed(1) : '—'} · {u.worker_level}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleSuspend(u)}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-black btn-tap border ${
                      u.is_suspended
                        ? 'bg-green-500/10 border-green-500/30 text-green-400'
                        : 'bg-red-500/10 border-red-500/30 text-red-400'
                    }`}
                  >
                    <Ban size={12} /> {u.is_suspended ? 'Unsuspend' : 'Suspend'}
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {BADGE_FIELDS.map(b => (
                    <button
                      key={b.key}
                      type="button"
                      onClick={() => toggleBadge(u, b.key)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold border btn-tap transition-colors min-h-0 ${
                        u[b.key]
                          ? (b.key === 'campus_ambassador' ? 'bg-amber-500/15 text-amber-400 border-amber-500/40' : 'bg-[#F4511E]/15 text-[#F4511E] border-[#F4511E]/40')
                          : 'border-white/10 text-white/40 hover:text-white/70'
                      }`}
                      style={{ minHeight: '32px' }}
                    >
                      {b.icon} {b.label} {u[b.key] ? '✓' : ''}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => toggleStudentVerified(u)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold border btn-tap transition-colors min-h-0 ${
                      u.student_status === 'student_verified'
                        ? 'bg-[#F4511E]/15 text-[#F4511E] border-[#F4511E]/40'
                        : 'border-white/10 text-white/40 hover:text-white/70'
                    }`}
                    style={{ minHeight: '32px' }}
                  >
                    <GraduationCap size={13} /> Student Verified {u.student_status === 'student_verified' ? '✓' : ''}
                  </button>
                </div>
              </div>
            ))}
            {results.length === 0 && query && !searching && (
              <p className="text-sm font-medium text-white/40 text-center py-6">No users match "{query}".</p>
            )}
          </div>
        )}
      </div>

      {/* Document preview modal */}
      {previewUrl && (
        <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-4" onClick={() => setPreviewUrl(null)}>
          <div className="max-w-2xl w-full max-h-[85dvh] overflow-auto bg-[#1C1C1C] border border-white/10 rounded-2xl p-4" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-3">
              <p className="text-sm font-black">Document Preview <span className="text-white/40 font-bold">(link expires in 5 min)</span></p>
              <button type="button" aria-label="Close preview" onClick={() => setPreviewUrl(null)} className="p-2 bg-white/10 rounded-full text-white/60 hover:text-white btn-tap"><XCircle size={16} /></button>
            </div>
            {previewUrl.includes('.pdf') ? (
              <iframe src={previewUrl} title="Document preview" className="w-full h-[70dvh] rounded-xl bg-white" />
            ) : (
              <img src={previewUrl} alt="Verification document" className="w-full rounded-xl" />
            )}
          </div>
        </div>
      )}

      {/* Reject reason modal */}
      {rejecting && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
          <div className="bg-[#1C1C1C] border border-white/10 rounded-2xl p-6 w-full max-w-sm">
            <h3 className="font-black text-white mb-3">Reject {DOC_LABELS[rejecting.doc_type]}?</h3>
            <label htmlFor="reject-reason" className="block text-[11px] font-black text-white/60 uppercase tracking-wider mb-1.5">Reason (shown to the user)</label>
            <textarea
              id="reject-reason"
              rows={3}
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="e.g. Photo is blurry — please re-upload a clear image."
              className="w-full p-3 rounded-xl bg-[#111111] border border-white/10 text-white text-sm font-medium placeholder:text-white/30 focus:outline-none focus:border-[#F4511E] resize-none mb-4"
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => setRejecting(null)} className="flex-1 py-3 rounded-xl border border-white/15 text-white/70 text-sm font-bold btn-tap">Cancel</button>
              <button type="button" disabled={busy} onClick={rejectDoc} className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-black btn-tap disabled:opacity-50">Reject</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
