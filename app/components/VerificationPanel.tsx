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
  aadhaar:      { label: 'Aadhaar (ID Verification)', icon: <ShieldCheck size={16} />, hint: 'Optional — but hirers pick verified workers first.' },
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

  /**
   * Which document the picker was opened for.
   *
   * This used to live only in a ref. Mobile browsers routinely tear the page
   * down while the native file picker is open and rebuild it on return, which
   * reset the ref to null — so the change event fired with a real file, the
   * handler hit `if (!file || !type) return`, and nothing happened at all. No
   * error, no upload, just the page jumping to the hidden input at the bottom.
   * sessionStorage survives that round trip.
   */
  const PENDING_KEY = 'gd-pending-doc-type';

  const startUpload = (type: string) => {
    pendingTypeRef.current = type;
    try { sessionStorage.setItem(PENDING_KEY, type); } catch { /* private mode */ }
    fileInputRef.current?.click();
  };

  /**
   * Shrink a photo before upload.
   *
   * A phone camera produces 3-8 MB images, so the old 5 MB gate rejected most
   * of them outright — that is why uploading from a phone "didn't work". Going
   * through a canvas also re-encodes whatever the camera produced (HEIC on
   * iOS) into a JPEG the reviewer can actually open.
   */
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

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    let type = pendingTypeRef.current;
    if (!type) {
      try { type = sessionStorage.getItem(PENDING_KEY); } catch { /* private mode */ }
    }
    e.target.value = '';
    if (!file) return;
    if (!type) {
      setError("Something went wrong picking that file. Tap Upload and choose it again.");
      return;
    }
    try { sessionStorage.removeItem(PENDING_KEY); } catch { /* ignore */ }

    const isImage = file.type.startsWith('image/');
    // PDFs can't be shrunk here, so they keep a hard cap. Images are resized
    // below rather than refused.
    if (!isImage && file.size > 10 * 1024 * 1024) {
      setError('That file is too large — please keep PDFs under 10 MB.');
      return;
    }
    setError('');
    setUploadingType(type);
    try {
      let body: File | Blob = file;
      let ext = 'jpg';
      let contentType = file.type || 'application/octet-stream';

      if (isImage) {
        try {
          body = await shrinkImage(file);
          ext = 'jpg';
          contentType = 'image/jpeg';
        } catch {
          // Fall back to the original if the canvas can't handle it, but only
          // when it's small enough to go up as-is.
          if (file.size > 10 * 1024 * 1024) {
            throw new Error('That photo is too large. Try again with a smaller one.');
          }
          body = file;
          ext = (file.name.includes('.') ? file.name.split('.').pop() : '') || 'jpg';
          contentType = file.type || 'image/jpeg';
        }
      } else {
        // Camera and file-picker names are unreliable — only trust a real
        // extension, otherwise take it from the MIME type.
        ext = (file.name.includes('.') ? file.name.split('.').pop() : '') || (file.type === 'application/pdf' ? 'pdf' : 'bin');
      }

      const path = `${userId}/${type}-${Date.now()}.${ext.toLowerCase()}`;
      const { error: upErr } = await supabase.storage
        .from('verification-docs')
        .upload(path, body, { upsert: false, contentType });
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
        Documents are reviewed manually by the GigDekho team — usually within a few days.
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf"
        aria-hidden="true"
        tabIndex={-1}
        style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
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
