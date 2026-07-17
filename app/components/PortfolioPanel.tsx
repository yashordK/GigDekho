import { useState, useEffect, useRef } from 'react';
import { supabase } from '~/lib/supabase.client';
import { Link2, FileText, Upload, Trash2, ExternalLink, Plus } from 'lucide-react';

interface PortfolioItem {
  id: string;
  kind: 'link' | 'file';
  url: string;
  label: string;
}

/**
 * Worker portfolio/resume: shareable links + uploaded files.
 * Publicly readable (hirers see it), owner-managed.
 */
export default function PortfolioPanel({ userId, readOnly = false }: { userId: string; readOnly?: boolean }) {
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkLabel, setLinkLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchItems = async () => {
    const { data } = await supabase
      .from('portfolio_items')
      .select('id, kind, url, label')
      .eq('worker_id', userId)
      .order('created_at', { ascending: false });
    setItems((data as PortfolioItem[]) || []);
  };

  useEffect(() => { fetchItems(); }, [userId]);

  const addLink = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = linkUrl.trim();
    if (!/^https?:\/\/.+\..+/.test(url)) {
      setError('Link must start with http:// or https://');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const { error: err } = await supabase.from('portfolio_items').insert({
        worker_id: userId,
        kind: 'link',
        url,
        label: linkLabel.trim() || url.replace(/^https?:\/\//, '').slice(0, 40),
      });
      if (err) throw err;
      setLinkUrl('');
      setLinkLabel('');
      setShowLinkForm(false);
      await fetchItems();
    } catch (err: any) {
      setError(err.message || 'Could not add link.');
    } finally {
      setBusy(false);
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError('File too large — max 10 MB.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${userId}/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage.from('portfolios').upload(path, file);
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('portfolios').getPublicUrl(path);
      const { error: insErr } = await supabase.from('portfolio_items').insert({
        worker_id: userId,
        kind: 'file',
        url: pub.publicUrl,
        label: file.name.slice(0, 60),
      });
      if (insErr) throw insErr;
      await fetchItems();
    } catch (err: any) {
      setError(err.message || 'Upload failed.');
    } finally {
      setBusy(false);
    }
  };

  const removeItem = async (item: PortfolioItem) => {
    setBusy(true);
    try {
      await supabase.from('portfolio_items').delete().eq('id', item.id);
      // Best-effort storage cleanup for uploaded files
      if (item.kind === 'file') {
        const marker = '/portfolios/';
        const idx = item.url.indexOf(marker);
        if (idx !== -1) {
          const path = decodeURIComponent(item.url.slice(idx + marker.length));
          await supabase.storage.from('portfolios').remove([path]);
        }
      }
      await fetchItems();
    } finally {
      setBusy(false);
    }
  };

  if (readOnly && items.length === 0) return null;

  return (
    <div className="bg-[#1C1C1C] rounded-2xl shadow-sm border border-white/5 p-5 lg:p-8">
      <div className="flex justify-between items-center mb-1">
        <h3 className="font-bold text-white lg:text-xl">Portfolio & Resume</h3>
        {!readOnly && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setShowLinkForm(!showLinkForm); setError(''); }}
              className="flex items-center gap-1 text-[11px] font-black text-[#F4511E] bg-[#F4511E]/10 border border-[#F4511E]/20 px-3 py-1.5 rounded-full hover:bg-[#F4511E]/20 transition-colors btn-tap min-h-0"
              style={{ minHeight: '32px' }}
            >
              <Link2 size={12} /> Add Link
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
              className="flex items-center gap-1 text-[11px] font-black text-white bg-[#F4511E] px-3 py-1.5 rounded-full hover:bg-[#D84315] transition-colors btn-tap disabled:opacity-50 min-h-0"
              style={{ minHeight: '32px' }}
            >
              <Upload size={12} /> {busy ? 'Working…' : 'Upload File'}
            </button>
          </div>
        )}
      </div>
      <p className="text-xs font-medium text-white/40 mb-4">
        {readOnly
          ? 'Work samples and documents shared by this worker.'
          : 'Share links to your work and upload your resume or proof of work — hirers see these on your profile.'}
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf,.doc,.docx"
        className="hidden"
        aria-hidden="true"
        onChange={handleFile}
      />

      {error && (
        <div className="mb-3 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs font-semibold">{error}</div>
      )}

      {showLinkForm && !readOnly && (
        <form onSubmit={addLink} className="mb-4 bg-[#111111] rounded-2xl p-4 border border-white/5 space-y-3 animate-in fade-in duration-150">
          <div>
            <label htmlFor="pf-url" className="block text-[10px] font-black text-white/60 uppercase tracking-wider mb-1">Link URL</label>
            <input
              id="pf-url" type="url" placeholder="https://behance.net/you, drive link, insta page…"
              value={linkUrl} onChange={e => setLinkUrl(e.target.value)} required
              className="w-full h-10 px-3 rounded-xl bg-[#1C1C1C] border border-white/10 text-white text-sm font-semibold placeholder:text-white/30 focus:outline-none focus:border-[#F4511E]"
            />
          </div>
          <div>
            <label htmlFor="pf-label" className="block text-[10px] font-black text-white/60 uppercase tracking-wider mb-1">Label (optional)</label>
            <input
              id="pf-label" type="text" placeholder="e.g. My photography portfolio" maxLength={60}
              value={linkLabel} onChange={e => setLinkLabel(e.target.value)}
              className="w-full h-10 px-3 rounded-xl bg-[#1C1C1C] border border-white/10 text-white text-sm font-semibold placeholder:text-white/30 focus:outline-none focus:border-[#F4511E]"
            />
          </div>
          <button type="submit" disabled={busy}
            className="w-full py-2.5 bg-[#F4511E] hover:bg-[#D84315] text-white rounded-xl text-xs font-black btn-tap disabled:opacity-50 transition-colors flex items-center justify-center gap-1">
            <Plus size={14} /> Add to Portfolio
          </button>
        </form>
      )}

      {items.length === 0 ? (
        <div className="text-sm font-medium text-white/40 bg-[#111111] p-4 rounded-xl border border-white/5 border-dashed">
          Nothing here yet — add a link or upload your resume to stand out to hirers.
        </div>
      ) : (
        <div className="space-y-2.5">
          {items.map(item => (
            <div key={item.id} className="flex items-center justify-between bg-[#111111] rounded-xl px-4 py-3 border border-white/5 gap-3">
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 min-w-0 group"
              >
                <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${item.kind === 'link' ? 'bg-blue-500/10 text-blue-400' : 'bg-[#F4511E]/10 text-[#F4511E]'}`}>
                  {item.kind === 'link' ? <Link2 size={14} /> : <FileText size={14} />}
                </span>
                <span className="text-sm font-bold text-white/80 group-hover:text-white truncate">{item.label}</span>
                <ExternalLink size={12} className="text-white/30 shrink-0" />
              </a>
              {!readOnly && (
                <button
                  type="button"
                  aria-label={`Remove ${item.label}`}
                  onClick={() => removeItem(item)}
                  disabled={busy}
                  className="p-2 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors btn-tap disabled:opacity-50 min-h-0"
                  style={{ minHeight: '36px' }}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
