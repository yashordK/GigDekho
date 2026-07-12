import { useState, useEffect, useRef } from 'react';
import { supabase } from '~/lib/supabase.client';
import { ShieldCheck, GraduationCap, Building2, Upload, Clock, XCircle, CheckCircle2 } from 'lucide-react';

interface DocRow {
  id: string;
  doc_type: string;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason: string | null;
  created_at: string;
}

const DOC_META: Record<string, { label: string; icon: React.ReactNode; hint: string }> = {
  aadhaar:      { label: 'Aadhaar (ID Verification)', icon: <ShieldCheck size={16} />, hint: 'Required before you can apply to gigs.' },
  student_id:   { label: 'College ID (Student Verification)', icon: <GraduationCap size={16} />, hint: 'Unlocks student-only Perks.' },
  gst:          { label: 'GST Certificate (Verified Business)', icon: <Building2 size={16} />, hint: 'Upgrades you to a Verified Business.' },
  shop_license: { label: 'Shop Establishment License', icon: <Building2 size={16} />, hint: 'Alternative to GST for Verified Business.' },
};

/**
 * Document upload + status panel. `docTypes` controls which rows show
 * (worker: aadhaar [+ student_id if student]; hirer: aadhaar, gst, shop_license).
 */
export default function VerificationPanel({
  userId,
  docTypes,
  onStatusChange,
}: {
  userId: string;
  docTypes: string[];
  onStatusChange?: () => void;
}) {
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [uploadingType, setUploadingType] = useState<string | null>(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingTypeRef = useRef<string | null>(null);

  const fetchDocs = async () => {
    const { data } = await supabase
      .from('verification_documents')
      .select('id, doc_type, status, rejection_reason, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    setDocs(data || []);
  };

  useEffect(() => { fetchDocs(); }, [userId]);

  // Latest submission per doc type decides the shown status
  const latestFor = (type: string) => docs.find(d => d.doc_type === type);

  const startUpload = (type: string) => {
    pendingTypeRef.current = type;
    fileInputRef.current?.click();
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const type = pendingTypeRef.current;
    e.target.value = '';
    if (!file || !type) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('File too large — max 5 MB.');
      return;
    }
    setError('');
    setUploadingType(type);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${userId}/${type}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('verification-docs')
        .upload(path, file, { upsert: false });
      if (upErr) throw upErr;

      const { error: insErr } = await supabase.from('verification_documents').insert({
        user_id: userId,
        doc_type: type,
        file_path: path,
        status: 'pending',
      });
      if (insErr) throw insErr;

      await fetchDocs();
      onStatusChange?.();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Upload failed. Try again.');
    } finally {
      setUploadingType(null);
    }
  };

  return (
    <div className="bg-[#1C1C1C] rounded-2xl shadow-sm border border-white/5 p-5 lg:p-8">
      <h3 className="font-bold text-white lg:text-xl mb-1">Verification</h3>
      <p className="text-xs font-medium text-white/40 mb-5">
        Documents are reviewed manually by the GigDekho team — usually within 24 hours.
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf"
        className="hidden"
        aria-hidden="true"
        onChange={handleFile}
      />

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs font-semibold">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {docTypes.map(type => {
          const meta = DOC_META[type];
          const doc = latestFor(type);
          return (
            <div key={type} className="bg-[#111111] rounded-2xl p-4 border border-white/5 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-[#F4511E]/10 text-[#F4511E] flex items-center justify-center shrink-0">
                  {meta.icon}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-white text-sm">{meta.label}</p>
                  <p className="text-[11px] font-medium text-white/40">{doc?.status === 'rejected' && doc.rejection_reason
                    ? <span className="text-red-400">Rejected: {doc.rejection_reason}</span>
                    : meta.hint}</p>
                </div>
              </div>

              {doc?.status === 'approved' ? (
                <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-green-400 bg-green-500/10 border border-green-500/20 px-3 py-1.5 rounded-full">
                  <CheckCircle2 size={12} /> Approved
                </span>
              ) : doc?.status === 'pending' ? (
                <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 px-3 py-1.5 rounded-full">
                  <Clock size={12} className="animate-pulse" /> In Review
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => startUpload(type)}
                  disabled={uploadingType === type}
                  className={`flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider px-4 py-2 rounded-full transition-colors btn-tap disabled:opacity-50 ${
                    doc?.status === 'rejected'
                      ? 'bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20'
                      : 'bg-[#F4511E] text-white hover:bg-[#D84315]'
                  }`}
                >
                  {doc?.status === 'rejected' ? <><XCircle size={12} /> Re-upload</> : <><Upload size={12} /> {uploadingType === type ? 'Uploading…' : 'Upload'}</>}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
