import { useState, useEffect } from 'react';
import { X, Megaphone } from 'lucide-react';

const TEMPLATES = [
  { id: 'dress', label: '👔 Dress code', text: 'Dress code reminder: please arrive in black & white formals (black trousers, white shirt, closed shoes).' },
  { id: 'meet', label: '📍 Meeting point', text: 'Meeting details: please reach the main entrance 30 minutes before start time. Ask for the event coordinator at the gate.' },
  { id: 'parking', label: '🅿️ Parking/access', text: 'Parking & access: two-wheeler parking is available at the venue. Carry a valid ID for entry — mention GigDekho at the gate.' },
];

export default function AnnounceModal({
  isOpen,
  onClose,
  gigId,
  gigTitle,
  onSent,
}: {
  isOpen: boolean;
  onClose: () => void;
  gigId: string;
  gigTitle: string;
  onSent: (recipients: number) => void;
}) {
  const [message, setMessage] = useState('');
  const [audience, setAudience] = useState<'confirmed' | 'all_applicants'>('confirmed');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) { setMessage(''); setAudience('confirmed'); setError(''); }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSend = async () => {
    if (!message.trim()) { setError('Write a message first.'); return; }
    setSending(true);
    setError('');
    try {
      const form = new FormData();
      form.append('gig_id', gigId);
      form.append('message', message.trim());
      form.append('audience', audience);
      const res = await fetch('/api/announce', { method: 'POST', body: form });
      const result = await res.json();
      if (!res.ok || result.error) throw new Error(result.error || 'Failed to send');
      onSent(result.recipients);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Could not send. Try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-[100] flex items-end md:items-center justify-center p-0 md:p-4 animate-in fade-in duration-200">
      <div className="bg-[#1C1C1C] border-t md:border border-white/10 w-full max-w-md rounded-t-3xl md:rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom md:zoom-in duration-300">
        <div className="flex justify-between items-center mb-1">
          <h3 className="font-black text-white flex items-center gap-2"><Megaphone size={18} className="text-[#F4511E]" /> Announcement</h3>
          <button type="button" aria-label="Close" onClick={onClose} className="p-2 bg-white/10 text-white/60 hover:text-white rounded-full btn-tap"><X size={16} /></button>
        </div>
        <p className="text-[11px] font-semibold text-white/40 mb-4 truncate">{gigTitle}</p>

        {/* Quick-fill templates */}
        <div className="flex flex-wrap gap-2 mb-3">
          {TEMPLATES.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setMessage(t.text)}
              className="px-3 py-1.5 rounded-full text-[11px] font-bold border border-white/10 text-white/60 hover:border-[#F4511E]/40 hover:text-white transition-colors btn-tap min-h-0"
              style={{ minHeight: '32px' }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <textarea
          rows={4}
          maxLength={1000}
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="e.g. Meeting time moved to 5:30 PM — please arrive 15 minutes early."
          aria-label="Announcement message"
          className="w-full p-4 rounded-xl bg-[#111111] border border-white/10 text-white text-sm font-medium placeholder:text-white/30 focus:outline-none focus:border-[#F4511E] resize-none mb-4"
        />

        {/* Audience */}
        <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-2">Send to</p>
        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => setAudience('confirmed')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold border btn-tap transition-colors ${audience === 'confirmed' ? 'bg-[#F4511E]/15 border-[#F4511E]/40 text-[#F4511E]' : 'border-white/10 text-white/50'}`}
          >
            Confirmed workers only
          </button>
          <button
            type="button"
            onClick={() => setAudience('all_applicants')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold border btn-tap transition-colors ${audience === 'all_applicants' ? 'bg-[#F4511E]/15 border-[#F4511E]/40 text-[#F4511E]' : 'border-white/10 text-white/50'}`}
          >
            All applicants
          </button>
        </div>

        {error && <p className="text-red-400 text-xs font-semibold mb-3">{error}</p>}

        <button
          type="button"
          onClick={handleSend}
          disabled={sending}
          className="w-full py-3.5 bg-[#F4511E] hover:bg-[#D84315] text-white rounded-xl font-black text-sm btn-tap disabled:opacity-50 transition-colors"
        >
          {sending ? 'Sending…' : 'Send Announcement'}
        </button>
        <p className="text-[10px] font-medium text-white/30 mt-2 text-center">Delivered in-app + by email, and pinned on the gig page.</p>
      </div>
    </div>
  );
}
