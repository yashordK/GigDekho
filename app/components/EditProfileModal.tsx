import { useState, useEffect } from 'react';
import { supabase } from '~/lib/supabase.client';
import { X } from 'lucide-react';

/** Full profile editor — covers worker fields and hirer business fields. */
export default function EditProfileModal({
  isOpen,
  onClose,
  profile,
  isOrganizerView,
  onSaved,
}: {
  isOpen: boolean;
  onClose: () => void;
  profile: any;
  isOrganizerView: boolean;
  onSaved: (updates: any) => void;
}) {
  const [form, setForm] = useState({ full_name: '', city: '', phone: '', bio: '', company_name: '', website: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && profile) {
      setForm({
        full_name: profile.full_name || '',
        city: profile.city || 'Indore',
        phone: profile.phone || '',
        bio: profile.bio || '',
        company_name: profile.company_name || '',
        website: profile.website || '',
      });
      setError('');
    }
  }, [isOpen, profile]);

  if (!isOpen) return null;

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.full_name.trim()) { setError('Name is required.'); return; }
    if (form.phone && !/^[+]?[\d\s-]{10,13}$/.test(form.phone.trim())) {
      setError('Enter a valid phone number.'); return;
    }
    if (form.website && !/^https?:\/\/.+\..+/.test(form.website.trim())) {
      setError('Website must start with http:// or https://'); return;
    }
    setSaving(true);
    setError('');
    try {
      const updates: any = {
        full_name: form.full_name.trim(),
        city: form.city.trim() || 'Indore',
        phone: form.phone.trim() || null,
        bio: form.bio.trim() || null,
      };
      if (isOrganizerView) {
        updates.company_name = form.company_name.trim() || null;
        updates.website = form.website.trim() || null;
      }
      const { error: err } = await supabase.from('profiles').update(updates).eq('id', profile.id);
      if (err) throw err;
      onSaved(updates);
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Could not save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full h-11 px-4 rounded-xl bg-[#111111] border border-white/10 text-white text-sm font-semibold placeholder:text-white/30 focus:outline-none focus:border-[#F4511E]";

  return (
    <div className="fixed inset-0 bg-black/80 z-[100] flex items-end sm:items-center sm:justify-center animate-in fade-in p-0 sm:p-4">
      <div className="bg-[#1C1C1C] border-t sm:border border-white/10 w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl max-h-[90dvh] overflow-y-auto hide-scrollbar animate-in slide-in-from-bottom sm:zoom-in duration-300">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-black text-white">Edit Profile</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="p-2 bg-white/10 text-white/60 hover:text-white rounded-full btn-tap"><X size={18} /></button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs font-semibold">{error}</div>
        )}

        <div className="space-y-4">
          <div>
            <label htmlFor="ep-name" className="block text-[11px] font-black text-white/60 uppercase tracking-wider mb-1.5">Full Name</label>
            <input id="ep-name" type="text" value={form.full_name} onChange={e => set('full_name', e.target.value)} className={inputCls} />
          </div>
          <div>
            <label htmlFor="ep-city" className="block text-[11px] font-black text-white/60 uppercase tracking-wider mb-1.5">City</label>
            <input id="ep-city" type="text" value={form.city} onChange={e => set('city', e.target.value)} className={inputCls} />
          </div>
          <div>
            <label htmlFor="ep-phone" className="block text-[11px] font-black text-white/60 uppercase tracking-wider mb-1.5">Phone</label>
            <input id="ep-phone" type="tel" placeholder="+91 98xxxxxx00" value={form.phone} onChange={e => set('phone', e.target.value)} className={inputCls} />
            <p className="text-[10px] font-medium text-white/30 mt-1">Only shared with {isOrganizerView ? 'workers you confirm' : 'hirers who confirm you'}.</p>
          </div>
          {isOrganizerView && (
            <>
              <div>
                <label htmlFor="ep-company" className="block text-[11px] font-black text-white/60 uppercase tracking-wider mb-1.5">Company / Business Name</label>
                <input id="ep-company" type="text" value={form.company_name} onChange={e => set('company_name', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label htmlFor="ep-website" className="block text-[11px] font-black text-white/60 uppercase tracking-wider mb-1.5">Website</label>
                <input id="ep-website" type="url" placeholder="https://…" value={form.website} onChange={e => set('website', e.target.value)} className={inputCls} />
              </div>
            </>
          )}
          <div>
            <label htmlFor="ep-bio" className="block text-[11px] font-black text-white/60 uppercase tracking-wider mb-1.5">Bio</label>
            <textarea id="ep-bio" rows={3} maxLength={300} value={form.bio} onChange={e => set('bio', e.target.value)}
              placeholder={isOrganizerView ? 'Tell workers about your business…' : 'A line about you and the work you do…'}
              className="w-full p-4 rounded-xl bg-[#111111] border border-white/10 text-white text-sm font-semibold placeholder:text-white/30 focus:outline-none focus:border-[#F4511E] resize-none" />
          </div>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="mt-6 w-full py-3.5 bg-[#F4511E] hover:bg-[#D84315] text-white rounded-xl font-bold shadow-lg shadow-orange-500/20 btn-tap disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
