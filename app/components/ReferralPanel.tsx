import { useState, useEffect } from 'react';
import { supabase } from '~/lib/supabase.client';
import { Users, Copy, Check, IndianRupee, Clock, CheckCircle2 } from 'lucide-react';

interface Row {
  id: string;
  status: 'pending' | 'qualified' | 'paid' | 'rejected';
  created_at: string;
  paid_at: string | null;
}

/**
 * Refer a friend.
 *
 * The old invite button built a link containing the referrer's raw user id and
 * copied it — and nothing anywhere read it back, so every invite ever sent was
 * decorative. This uses the short code on the profile, and the code is now
 * actually claimed at signup and paid on the friend's first completed gig.
 */
export default function ReferralPanel({ userId }: { userId: string }) {
  const [code, setCode] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [rates, setRates] = useState({ amount: 50, cap: 4 });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: me }, { data: mine }, { data: settings }] = await Promise.all([
        supabase.from('profiles').select('referral_code').eq('id', userId).maybeSingle(),
        supabase.from('referrals').select('id, status, created_at, paid_at').eq('referrer_id', userId).order('created_at', { ascending: false }),
        supabase.from('app_settings').select('key, value').like('key', 'referral%'),
      ]);
      if (me?.referral_code) setCode(me.referral_code);
      setRows((mine as Row[]) || []);
      if (settings) {
        const get = (k: string, d: number) => Number(settings.find((s: any) => s.key === k)?.value ?? d);
        setRates({ amount: get('referral_bonus_amount', 50), cap: get('referral_monthly_cap', 4) });
      }
    })();
  }, [userId]);

  const link = typeof window !== 'undefined' && code ? `${window.location.origin}/?ref=${code}` : '';

  const share = async () => {
    if (!link) return;
    const text = `I'm finding paid gigs in Indore on GigDekho. Join with my link and we both get ₹${rates.amount} once you finish your first gig: ${link}`;
    if (typeof navigator.share === 'function') {
      try { await navigator.share({ title: 'GigDekho', text, url: link }); return; } catch { /* dismissed */ }
    }
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch { /* clipboard unavailable */ }
  };

  const paid = rows.filter(r => r.status === 'paid').length;
  const waiting = rows.filter(r => r.status === 'pending').length;
  const thisMonth = rows.filter(r => {
    if (r.status !== 'paid' || !r.paid_at) return false;
    const d = new Date(r.paid_at); const n = new Date();
    return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
  }).length;

  return (
    <div className="bg-gradient-to-br from-[#6231d4] to-[#4510b6] rounded-3xl p-6 relative overflow-hidden shadow-lg border border-[#7d4de2]">
      <div className="absolute right-[-30px] bottom-[-30px] opacity-20 pointer-events-none">
        <Users size={140} className="text-white" />
      </div>

      <h3 className="font-black text-white text-lg mb-1 relative z-10 tracking-tight">Refer a Friend</h3>
      <p className="text-[13px] font-medium text-white/80 mb-4 leading-relaxed relative z-10 max-w-[260px]">
        You both get <span className="font-black">₹{rates.amount}</span> when they finish their first gig.
      </p>

      {code && (
        <div className="relative z-10 mb-3">
          <p className="text-[10px] font-black text-white/50 uppercase tracking-widest mb-1.5">Your code</p>
          <div className="inline-flex items-center gap-2 bg-black/25 border border-white/20 rounded-xl px-4 py-2.5">
            <span className="font-mono font-black text-white text-lg tracking-[0.2em]">{code}</span>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={share}
        disabled={!code}
        className="bg-white hover:bg-slate-50 text-[#6231d4] font-bold py-2.5 px-6 text-sm rounded-full transition-colors shadow-sm btn-tap relative z-10 disabled:opacity-50 flex items-center gap-2"
      >
        {copied ? <><Check size={15} /> Link copied</> : <><Copy size={15} /> Share invite link</>}
      </button>

      {rows.length > 0 && (
        <div className="relative z-10 mt-4 pt-4 border-t border-white/15 flex flex-wrap gap-4">
          <div>
            <p className="text-[10px] font-black text-white/50 uppercase tracking-widest">Earned</p>
            <p className="text-lg font-black text-white flex items-center">
              <IndianRupee size={14} />{paid * rates.amount}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-black text-white/50 uppercase tracking-widest">Joined</p>
            <p className="text-lg font-black text-white">{rows.length}</p>
          </div>
          {waiting > 0 && (
            <div>
              <p className="text-[10px] font-black text-white/50 uppercase tracking-widest">Yet to work</p>
              <p className="text-lg font-black text-white/70">{waiting}</p>
            </div>
          )}
        </div>
      )}

      <p className="relative z-10 text-[10px] font-medium text-white/45 mt-3 leading-relaxed">
        Up to {rates.cap} paid referrals a month
        {thisMonth > 0 ? ` — ${thisMonth} used this month` : ''}. Your friend needs to actually work a gig,
        not just sign up.
      </p>

      {rows.some(r => r.status === 'pending') && (
        <p className="relative z-10 text-[10px] font-medium text-white/45 mt-1.5 flex items-center gap-1.5">
          <Clock size={11} /> {waiting} {waiting === 1 ? 'friend has' : 'friends have'} joined and not worked a gig yet.
        </p>
      )}
      {paid > 0 && (
        <p className="relative z-10 text-[10px] font-medium text-white/60 mt-1.5 flex items-center gap-1.5">
          <CheckCircle2 size={11} /> {paid} paid out. Thank you.
        </p>
      )}
    </div>
  );
}
