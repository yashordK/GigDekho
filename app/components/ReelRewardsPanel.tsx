import { useState, useEffect } from 'react';
import { supabase } from '~/lib/supabase.client';
import {
  Video, IndianRupee, CheckCircle2, Clock, XCircle, TrendingUp, Info, Plus,
} from 'lucide-react';

interface Reel {
  id: string;
  gig_id: string;
  reel_url: string;
  platform: string;
  status: 'pending' | 'approved' | 'rejected';
  review_note: string | null;
  views_claimed: boolean;
  views_status: 'none' | 'pending' | 'approved' | 'rejected';
  views_proof_url: string | null;
  created_at: string;
}

interface EligibleGig {
  application_id: string;
  gig_id: string;
  title: string;
}

const PLATFORMS = [
  { v: 'instagram', label: 'Instagram' },
  { v: 'youtube', label: 'YouTube' },
  { v: 'facebook', label: 'Facebook' },
  { v: 'other', label: 'Other' },
];

/**
 * Reel rewards: post a reel about a gig you worked, get paid for it.
 *
 * Two separate rewards, reviewed separately, because they're proving different
 * things: that a reel exists and is about this gig, and that it later crossed
 * the views bar. Neither is automatic — Instagram gives no lawful way to read
 * a public reel's view count, so a person checks a screenshot. The copy says
 * so rather than implying the number is detected.
 */
export default function ReelRewardsPanel({ userId }: { userId: string }) {
  const [reels, setReels] = useState<Reel[]>([]);
  const [eligible, setEligible] = useState<EligibleGig[]>([]);
  const [rates, setRates] = useState({ perReel: 50, maxPerGig: 100, viewsBonus: 50, threshold: 3000 });
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [form, setForm] = useState({ application_id: '', reel_url: '', platform: 'instagram', public_ok: false });
  const [claiming, setClaiming] = useState<string | null>(null);
  const [claimUrl, setClaimUrl] = useState('');

  const load = async () => {
    const [{ data: mine }, { data: apps }, { data: settings }] = await Promise.all([
      supabase.from('reel_submissions')
        .select('id, gig_id, reel_url, platform, status, review_note, views_claimed, views_status, views_proof_url, created_at')
        .eq('worker_id', userId).order('created_at', { ascending: false }),
      // Only gigs they actually worked can earn a reel reward.
      supabase.from('applications')
        .select('id, gig_id, status, gigs(title)')
        .eq('worker_id', userId).in('status', ['accepted', 'completed']),
      supabase.from('app_settings').select('key, value').like('key', 'reel%'),
    ]);

    setReels((mine as Reel[]) || []);
    setEligible(((apps as any[]) || [])
      .filter(a => a.gigs)
      .map(a => ({ application_id: a.id, gig_id: a.gig_id, title: a.gigs.title })));

    if (settings) {
      const get = (k: string, d: number) => Number(settings.find((s: any) => s.key === k)?.value ?? d);
      setRates({
        perReel: get('reel_bonus_per_reel', 50),
        maxPerGig: get('reel_bonus_max_per_gig', 100),
        viewsBonus: get('reel_views_bonus', 50),
        threshold: get('reel_views_threshold', 3000),
      });
    }
  };

  useEffect(() => { load(); }, [userId]);

  const submitReel = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = form.reel_url.trim();
    if (!form.application_id) { setError('Pick which gig this reel is about.'); return; }
    if (!/^https?:\/\/.+\..+/.test(url)) { setError('Paste the full link to your reel, starting with https://'); return; }
    if (!form.public_ok) { setError('Confirm the account is public — we can\'t verify a reel we can\'t open.'); return; }

    const gig = eligible.find(g => g.application_id === form.application_id);
    if (!gig) { setError('That gig is no longer eligible.'); return; }

    // Two per gig is the cap, since each pays and the total per gig is fixed.
    const already = reels.filter(r => r.gig_id === gig.gig_id && r.status !== 'rejected').length;
    if (already >= Math.floor(rates.maxPerGig / rates.perReel)) {
      setError(`You've already submitted the maximum number of reels for that gig.`);
      return;
    }

    setBusy(true); setError(''); setNotice('');
    try {
      const row: any = {
        worker_id: userId,
        application_id: form.application_id,
        gig_id: gig.gig_id,
        reel_url: url,
        platform: form.platform,
        status: 'pending',
      };

      // public_account_confirmed arrives with migration 018. If the deploy
      // lands first, submitting a reel matters more than recording the
      // checkbox, so retry without it rather than failing the whole thing.
      let { error: err } = await supabase
        .from('reel_submissions')
        .insert({ ...row, public_account_confirmed: true });
      if (err && /public_account_confirmed/.test(err.message ?? '')) {
        ({ error: err } = await supabase.from('reel_submissions').insert(row));
      }
      if (err) throw err;
      setForm({ application_id: '', reel_url: '', platform: 'instagram', public_ok: false });
      setShowForm(false);
      setNotice('Reel submitted. We\'ll review it and credit your wallet once it\'s approved.');
      await load();
    } catch (err: any) {
      setError(err.message?.includes('duplicate') ? 'You\'ve already submitted that reel.' : (err.message || 'Could not submit that reel.'));
    } finally {
      setBusy(false);
    }
  };

  const claimViews = async (reelId: string) => {
    // A screenshot is welcome but not required — we already have the reel
    // link, and the view count is visible on the reel itself. Demanding proof
    // people can't easily produce on a phone would just lose the claim.
    const url = claimUrl.trim();
    if (url && !/^https?:\/\/.+\..+/.test(url)) {
      setError("That screenshot link doesn't look right — leave it blank if you don't have one.");
      return;
    }
    setBusy(true); setError('');
    try {
      const { error: err } = await supabase.from('reel_submissions').update({
        views_claimed: true,
        views_proof_url: url || null,
        views_status: 'pending',
      }).eq('id', reelId);
      if (err) throw err;
      setClaiming(null); setClaimUrl('');
      setNotice(`Views claim submitted — we'll check it and add ₹${rates.viewsBonus} if it's over ${rates.threshold.toLocaleString('en-IN')}.`);
      await load();
    } catch (err: any) {
      setError(err.message || 'Could not submit that claim.');
    } finally {
      setBusy(false);
    }
  };

  const earned = reels.reduce((sum, r) =>
    sum + (r.status === 'approved' ? rates.perReel : 0) + (r.views_status === 'approved' ? rates.viewsBonus : 0), 0);

  const input = 'w-full h-11 px-4 rounded-xl bg-[#111111] border border-white/10 text-white text-sm font-semibold placeholder:text-white/30 focus:outline-none focus:border-[#F4511E]';
  const label = 'block text-[11px] font-black text-white/60 uppercase tracking-wider mb-1.5';

  const maxReels = Math.floor(rates.maxPerGig / rates.perReel);

  return (
    <div className="bg-[#1C1C1C] rounded-2xl shadow-sm border border-white/5 p-5 lg:p-8">
      <div className="flex justify-between items-start mb-1 gap-3 flex-wrap">
        <h3 className="font-bold text-white lg:text-xl flex items-center gap-2">
          <Video size={18} className="text-[#F4511E]" /> Earn from Reels
        </h3>
        {earned > 0 && (
          <span className="text-[11px] font-black uppercase tracking-wider text-green-400 bg-green-500/10 border border-green-500/20 px-3 py-1.5 rounded-full">
            ₹{earned} earned
          </span>
        )}
      </div>
      <p className="text-xs font-medium text-white/40 mb-4">
        Post a reel about a gig you worked and get paid for it.
      </p>

      {/* The offer, stated plainly */}
      <div className="bg-[#111111] border border-[#F4511E]/20 rounded-2xl p-4 mb-4">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-8 h-8 rounded-lg bg-[#F4511E]/10 border border-[#F4511E]/25 text-[#F4511E] flex items-center justify-center shrink-0">
            <IndianRupee size={15} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-black text-white">₹{rates.perReel} per approved reel</p>
            <p className="text-[11px] font-medium text-white/45 leading-relaxed">
              Up to {maxReels} reels per gig, so ₹{rates.maxPerGig} in total from posting.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#F4511E]/10 border border-[#F4511E]/25 text-[#F4511E] flex items-center justify-center shrink-0">
            <TrendingUp size={15} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-black text-white">₹{rates.viewsBonus} more if it crosses {rates.threshold.toLocaleString('en-IN')} views</p>
            <p className="text-[11px] font-medium text-white/45 leading-relaxed">
              Claim it whenever your reel gets there, even long after the gig has finished. We check the count on
              your reel ourselves before paying.
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-start gap-2 bg-[#111111] border border-white/5 rounded-xl p-3 mb-4">
        <Info size={13} className="text-white/40 shrink-0 mt-0.5" />
        <p className="text-[11px] font-medium text-white/45 leading-relaxed">
          The reel must be posted from a <span className="text-white/70 font-bold">public</span> account, stay up, and be
          about a gig you actually worked. Talk about your experience and invite others to join — that's the point of it.
          We check each one by hand before paying.
        </p>
      </div>

      {error && <div className="mb-3 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs font-semibold">{error}</div>}
      {notice && <div className="mb-3 p-3 bg-green-500/10 border border-green-500/20 text-green-400 rounded-xl text-xs font-semibold">{notice}</div>}

      {eligible.length === 0 ? (
        <p className="text-[12px] font-semibold text-white/40">
          Work a gig first, then you can post a reel about it and earn from it.
        </p>
      ) : !showForm ? (
        <button
          type="button"
          onClick={() => { setShowForm(true); setError(''); setNotice(''); }}
          className="flex items-center gap-1.5 bg-[#F4511E] hover:bg-[#D84315] text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider btn-tap transition-colors"
        >
          <Plus size={14} /> Submit a reel
        </button>
      ) : (
        <form onSubmit={submitReel} className="space-y-3 bg-[#111111] border border-white/10 rounded-2xl p-4">
          <div>
            <label className={label} htmlFor="reel-gig">Which gig is it about?</label>
            <select
              id="reel-gig"
              value={form.application_id}
              onChange={(e) => setForm(f => ({ ...f, application_id: e.target.value }))}
              className={input}
            >
              <option value="">Choose a gig…</option>
              {eligible.map(g => (
                <option key={g.application_id} value={g.application_id}>{g.title}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={label} htmlFor="reel-url">Link to your reel</label>
            <input
              id="reel-url"
              className={input}
              placeholder="https://www.instagram.com/reel/…"
              value={form.reel_url}
              onChange={(e) => setForm(f => ({ ...f, reel_url: e.target.value }))}
              inputMode="url"
              autoComplete="url"
            />
          </div>
          <div>
            <span className={label}>Where did you post it?</span>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map(p => (
                <button
                  key={p.v}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, platform: p.v }))}
                  className={`px-4 py-2 rounded-xl text-xs font-black border btn-tap transition-colors ${
                    form.platform === p.v ? 'bg-[#F4511E] border-[#F4511E] text-white' : 'bg-[#1C1C1C] border-white/10 text-white/60 hover:text-white'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-start gap-2.5 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={form.public_ok}
              onChange={(e) => setForm(f => ({ ...f, public_ok: e.target.checked }))}
              className="w-4 h-4 accent-[#F4511E] mt-0.5"
            />
            <span className="text-[11px] font-semibold text-white/60 leading-relaxed">
              This is posted from a public account and anyone can open the link.
            </span>
          </label>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setShowForm(false)}
              className="flex-1 py-2.5 bg-[#1C1C1C] border border-white/10 text-white/70 hover:text-white rounded-xl text-xs font-black uppercase tracking-wider btn-tap">
              Cancel
            </button>
            <button type="submit" disabled={busy}
              className="flex-1 py-2.5 bg-[#F4511E] hover:bg-[#D84315] text-white rounded-xl text-xs font-black uppercase tracking-wider btn-tap disabled:opacity-50">
              {busy ? 'Submitting…' : 'Submit reel'}
            </button>
          </div>
        </form>
      )}

      {reels.length > 0 && (
        <div className="mt-5 space-y-2">
          {reels.map(r => (
            <div key={r.id} className="bg-[#111111] border border-white/5 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <a href={r.reel_url} target="_blank" rel="noopener noreferrer"
                    className="text-[12px] font-bold text-[#F4511E] hover:underline break-all">
                    {r.reel_url.replace(/^https?:\/\//, '').slice(0, 46)}…
                  </a>
                  <p className="text-[10px] font-semibold text-white/35 mt-0.5 capitalize">
                    {r.platform} · {new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    {r.review_note ? ` · ${r.review_note}` : ''}
                  </p>
                </div>
                <span className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-full shrink-0 ${
                  r.status === 'approved' ? 'text-green-400 bg-green-500/10 border border-green-500/20'
                  : r.status === 'rejected' ? 'text-red-400 bg-red-500/10 border border-red-500/20'
                  : 'text-yellow-400 bg-yellow-500/10 border border-yellow-500/20'
                }`}>
                  {r.status === 'approved' ? <><CheckCircle2 size={11} /> ₹{rates.perReel} paid</>
                    : r.status === 'rejected' ? <><XCircle size={11} /> Not approved</>
                    : <><Clock size={11} className="animate-pulse" /> In review</>}
                </span>
              </div>

              {/* The views bonus, only once the reel itself is approved */}
              {r.status === 'approved' && (
                <div className="mt-3 pt-3 border-t border-white/5">
                  {r.views_status === 'approved' ? (
                    <p className="text-[11px] font-black text-green-400 flex items-center gap-1.5">
                      <TrendingUp size={12} /> ₹{rates.viewsBonus} views bonus paid
                    </p>
                  ) : r.views_status === 'pending' ? (
                    <p className="text-[11px] font-bold text-yellow-400 flex items-center gap-1.5">
                      <Clock size={12} className="animate-pulse" /> Views claim in review
                    </p>
                  ) : r.views_status === 'rejected' ? (
                    <p className="text-[11px] font-semibold text-white/40">
                      Views claim wasn't approved. You can claim again once it genuinely passes {rates.threshold.toLocaleString('en-IN')}.
                    </p>
                  ) : claiming === r.id ? (
                    <div className="space-y-2">
                      <label className={label} htmlFor={`claim-${r.id}`}>Screenshot link</label>
                      <input
                        id={`claim-${r.id}`}
                        className={input}
                        placeholder="Leave blank if you don't have one"
                        value={claimUrl}
                        onChange={(e) => setClaimUrl(e.target.value)}
                        inputMode="url"
                      />
                      <p className="text-[10px] font-medium text-white/35 leading-relaxed">
                        We'll open your reel and check the count ourselves — a screenshot just speeds it up.
                      </p>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => { setClaiming(null); setClaimUrl(''); }}
                          className="flex-1 py-2 bg-[#1C1C1C] border border-white/10 text-white/70 rounded-xl text-[11px] font-black uppercase tracking-wider btn-tap">
                          Cancel
                        </button>
                        <button type="button" disabled={busy} onClick={() => claimViews(r.id)}
                          className="flex-1 py-2 bg-[#F4511E] hover:bg-[#D84315] text-white rounded-xl text-[11px] font-black uppercase tracking-wider btn-tap disabled:opacity-50">
                          {busy ? 'Sending…' : 'Claim bonus'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button type="button" onClick={() => { setClaiming(r.id); setClaimUrl(''); setError(''); }}
                      className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-[#F4511E] bg-[#F4511E]/10 border border-[#F4511E]/25 px-3.5 py-2 rounded-full hover:bg-[#F4511E]/20 transition-colors btn-tap">
                      <TrendingUp size={12} /> Crossed {rates.threshold.toLocaleString('en-IN')} views? Claim ₹{rates.viewsBonus}
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
