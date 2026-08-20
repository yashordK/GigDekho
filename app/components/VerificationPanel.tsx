import { useState, useEffect } from 'react';
import { supabase } from '~/lib/supabase.client';
import { traceUpload, readUploadTrace, clearUploadTrace } from '~/lib/upload-trace';
import { ShieldCheck, GraduationCap, Building2, Upload, Clock, XCircle, CheckCircle2, FileCheck } from 'lucide-react';

interface DocRow {
  id: string;
  doc_type: string;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason: string | null;
  created_at: string;
}

const DOC_META: Record<string, { label: string; icon: React.ReactNode; hint: string }> = {
  aadhaar:      { label: 'Aadhaar (ID Verification)', icon: <ShieldCheck size={16} />, hint: 'Optional — but hirers pick verified workers first.' },
  student_id:   { label: 'College ID (Student Verification)', icon: <GraduationCap size={16} />, hint: 'Unlocks student-only Perks.' },
  gst:          { label: 'GST Certificate (Verified Business)', icon: <Building2 size={16} />, hint: 'Upgrades you to a Verified Business.' },
  shop_license: { label: 'Shop Establishment License', icon: <Building2 size={16} />, hint: 'Alternative to GST for Verified Business.' },
};

/**
 * Document upload + status panel.
 *
 * Uploading is deliberately TWO steps — choose the file, then tap Submit:
 *
 *   1. Choosing a file does no work at all. On a phone the OS often discards
 *      the page while the native picker is open; every upload that hung off
 *      the change event died there, silently, because the handler belonged to
 *      a page that no longer existed. Now the change handler only shows the
 *      filename, so there is nothing to lose.
 *   2. The upload runs when Submit is tapped — a fresh gesture on a live,
 *      fully-restored page.
 *
 * Each row is also a REAL html form posting to /api/upload-doc. When
 * JavaScript is healthy we intercept submit and upload from the browser
 * (which lets us shrink photos first); if it isn't, the native multipart POST
 * still goes through and the server does the same job.
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
  const [notice, setNotice] = useState('');
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [trace, setTrace] = useState<string[]>([]);

  const fetchDocs = async () => {
    const { data } = await supabase
      .from('verification_documents')
      .select('id, doc_type, status, rejection_reason, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    setDocs(data || []);
  };

  useEffect(() => {
    fetchDocs();
    setTrace(readUploadTrace());
    // Feedback from the no-JS server fallback, which redirects back here.
    try {
      const q = new URLSearchParams(window.location.search);
      if (q.get('uploaded')) setNotice('Document submitted — it is now in review.');
      if (q.get('upload_error')) setError(q.get('upload_error') || 'Upload failed. Try again.');
      if (q.get('uploaded') || q.get('upload_error')) {
        q.delete('uploaded'); q.delete('upload_error');
        window.history.replaceState({}, '', window.location.pathname + (q.toString() ? `?${q}` : ''));
      }
    } catch { /* ignore */ }
  }, [userId]);

  // A phone can swap the page out mid-upload; the row may land while the page
  // is away. Re-read whenever the tab comes back to the front.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') { fetchDocs(); setTrace(readUploadTrace()); }
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [userId]);

  // Latest submission per doc type decides the shown status
  const latestFor = (type: string) => docs.find(d => d.doc_type === type);

  /** Shrink a photo before upload — phone cameras produce 3-8 MB images. */
  const shrinkImage = (file: File): Promise<Blob> =>
    new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const MAX = 1800; // plenty to read an ID off
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Could not process the image.'));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error('Could not process the image.'))),
          'image/jpeg',
          0.85
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("That image couldn't be read. Try a different photo."));
      };
      img.src = url;
    });

  /** Step 1: choosing a file only records its name. Never any async work here. */
  const onPick = (type: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    traceUpload('picked', `${type}: ${f ? `${f.name || 'unnamed'} ${(f.size / 1048576).toFixed(2)}MB` : 'nothing'}`);
    setPicked(p => ({ ...p, [type]: f ? (f.name || 'selected file') : '' }));
    setError('');
    setNotice('');
  };

  /** Step 2: the actual upload, from an explicit Submit tap on a live page. */
  const onSubmit = async (type: string, e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); // JS path takes over; without JS the form posts natively
    const form = e.currentTarget;
    const input = form.elements.namedItem('file') as HTMLInputElement | null;
    const file = input?.files?.[0];
    traceUpload('submit tapped', `${type}: ${file ? `${file.name || 'unnamed'} ${(file.size / 1048576).toFixed(2)}MB ${file.type || 'no mime'}` : 'NO FILE IN FORM'}`);

    if (!file) {
      setError('Choose a file first, then tap Submit.');
      setPicked(p => ({ ...p, [type]: '' }));
      return;
    }

    const isImage = file.type.startsWith('image/');
    if (!isImage && file.size > 10 * 1024 * 1024) {
      setError('That file is too large — please keep PDFs under 10 MB.');
      return;
    }

    setError('');
    setNotice('');
    setUploadingType(type);
    try {
      let body: File | Blob = file;
      let ext = 'jpg';
      let contentType = file.type || 'application/octet-stream';

      if (isImage) {
        try {
          body = await shrinkImage(file);
          contentType = 'image/jpeg';
        } catch {
          if (file.size > 10 * 1024 * 1024) {
            throw new Error('That photo is too large. Try again with a smaller one.');
          }
          body = file;
          ext = (file.name.includes('.') ? file.name.split('.').pop() : '') || 'jpg';
          contentType = file.type || 'image/jpeg';
        }
      } else {
        ext = (file.name.includes('.') ? file.name.split('.').pop() : '') || (file.type === 'application/pdf' ? 'pdf' : 'bin');
      }

      const path = `${userId}/${type}-${Date.now()}.${ext.toLowerCase()}`;
      traceUpload('uploading to storage', path);
      const { error: upErr } = await supabase.storage
        .from('verification-docs')
        .upload(path, body, { upsert: false, contentType });
      if (upErr) { traceUpload('storage FAILED', upErr.message); throw upErr; }
      traceUpload('storage ok');

      const { error: insErr } = await supabase.from('verification_documents').insert({
        user_id: userId,
        doc_type: type,
        file_path: path,
        status: 'pending',
      });
      if (insErr) { traceUpload('row insert FAILED', insErr.message); throw insErr; }
      traceUpload('row inserted — done');

      form.reset();
      setPicked(p => ({ ...p, [type]: '' }));
      setNotice('Document submitted — it is now in review.');
      await fetchDocs();
      onStatusChange?.();
    } catch (err: any) {
      console.error(err);
      traceUpload('threw', err?.message ?? String(err));
      setError(err.message || 'Upload failed. Try again.');
    } finally {
      setUploadingType(null);
      setTrace(readUploadTrace());
    }
  };

  return (
    <div className="bg-[#1C1C1C] rounded-2xl shadow-sm border border-white/5 p-5 lg:p-8">
      <h3 className="font-bold text-white lg:text-xl mb-1">Verification</h3>
      <p className="text-xs font-medium text-white/40 mb-5">
        Documents are reviewed manually by the GigDekho team — usually within a few days.
      </p>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs font-semibold">
          {error}
        </div>
      )}
      {notice && (
        <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 text-green-400 rounded-xl text-xs font-semibold flex items-center gap-1.5">
          <FileCheck size={14} className="shrink-0" /> {notice}
        </div>
      )}

      {trace.length > 0 && (
        <div className="mb-4 bg-[#111111] border border-white/10 rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-black text-white/50 uppercase tracking-widest">Upload log</p>
            <button type="button" onClick={() => { clearUploadTrace(); setTrace([]); }}
              className="text-[10px] font-bold text-white/40 hover:text-white btn-tap">clear</button>
          </div>
          {trace.map((line, i) => (
            <p key={i} className="text-[10px] font-mono text-white/50 leading-relaxed break-all">{line}</p>
          ))}
          <p className="text-[10px] font-medium text-white/30 mt-2">
            If an upload didn't work, send this list to us — it shows exactly where it stopped.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {docTypes.map(type => {
          const meta = DOC_META[type];
          const doc = latestFor(type);
          const busy = uploadingType === type;
          return (
            <div key={type} className="bg-[#111111] rounded-2xl p-4 border border-white/5">
              <div className="flex items-center justify-between gap-3 flex-wrap">
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
                  <form
                    method="post"
                    action="/api/upload-doc"
                    encType="multipart/form-data"
                    onSubmit={(e) => onSubmit(type, e)}
                    className="flex items-center gap-2 flex-wrap"
                  >
                    <input type="hidden" name="doc_type" value={type} />
                    <input type="hidden" name="redirect_to" value="/worker/profile" />
                    <label
                      className={`flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider px-4 py-2 rounded-full transition-colors btn-tap cursor-pointer ${busy ? 'opacity-50 pointer-events-none' : ''} ${
                        doc?.status === 'rejected'
                          ? 'bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20'
                          : picked[type]
                            ? 'bg-[#111111] text-white/70 border border-white/15 hover:text-white'
                            : 'bg-[#F4511E] text-white hover:bg-[#D84315]'
                      }`}
                    >
                      <input
                        type="file"
                        name="file"
                        accept="image/*,application/pdf"
                        className="sr-only"
                        disabled={busy}
                        onChange={(e) => onPick(type, e)}
                      />
                      <Upload size={12} />
                      {picked[type] ? 'Change' : doc?.status === 'rejected' ? 'Re-upload' : 'Choose file'}
                    </label>
                    {picked[type] && (
                      <button
                        type="submit"
                        disabled={busy}
                        className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider px-4 py-2 rounded-full bg-[#F4511E] text-white hover:bg-[#D84315] transition-colors btn-tap disabled:opacity-50"
                      >
                        {busy ? 'Uploading…' : 'Submit'}
                      </button>
                    )}
                  </form>
                )}
              </div>
              {picked[type] && !busy && (
                <p className="text-[11px] font-semibold text-white/45 mt-2 break-all">
                  Selected: {picked[type]} — tap <span className="text-[#F4511E]">Submit</span> to upload it.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
