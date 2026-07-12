import { useState, useEffect } from 'react';
import { supabase } from '~/lib/supabase.client';
import { Wallet, X, Landmark, ArrowDownToLine, ArrowUpRight, ArrowDownLeft } from 'lucide-react';

const TXN_LABEL: Record<string, string> = {
  gig_earning: 'Gig earnings',
  withdrawal: 'Withdrawal',
  bonus: 'Bonus',
  refund: 'Refund',
  penalty_deduction: 'Penalty',
  platform_spend: 'Platform spend',
};

export default function WalletCard({ userId }: { userId: string }) {
  const [txns, setTxns] = useState<any[]>([]);
  const [bank, setBank] = useState<any>(null);
  const [minWithdrawal, setMinWithdrawal] = useState(100);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [showLog, setShowLog] = useState(false);

  // Withdraw modal state
  const [amount, setAmount] = useState('');
  const [bankForm, setBankForm] = useState({ account_number: '', ifsc: '', account_holder: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchAll = async () => {
    const [{ data: t }, { data: b }, { data: s }] = await Promise.all([
      supabase.from('wallet_transactions').select('id, amount, type, status, description, created_at')
        .eq('worker_id', userId).neq('status', 'failed').order('created_at', { ascending: false }),
      supabase.from('worker_bank_accounts').select('id, account_number, ifsc, penny_drop_status').eq('worker_id', userId).maybeSingle(),
      supabase.from('app_settings').select('value').eq('key', 'min_withdrawal_amount').maybeSingle(),
    ]);
    setTxns(t || []);
    setBank(b);
    if (s?.value) setMinWithdrawal(Number(s.value));
  };

  useEffect(() => { fetchAll(); }, [userId]);

  const balance = txns.reduce((acc, t) => acc + t.amount, 0);
  const bankVerified = bank?.penny_drop_status === 'verified';

  const saveBank = async () => {
    setBusy(true); setError('');
    try {
      const form = new FormData();
      form.append('account_number', bankForm.account_number);
      form.append('ifsc', bankForm.ifsc);
      form.append('account_holder', bankForm.account_holder);
      const res = await fetch('/api/bank', { method: 'POST', body: form });
      const result = await res.json();
      if (!res.ok || result.error) throw new Error(result.error || 'Failed');
      await fetchAll();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async () => {
    setBusy(true); setError(''); setSuccess('');
    try {
      const form = new FormData();
      form.append('amount', amount);
      const res = await fetch('/api/withdraw', { method: 'POST', body: form });
      const result = await res.json();
      if (!res.ok || result.error) {
        if (result.error === 'bank_not_verified') throw new Error('Add and verify your bank details first.');
        throw new Error(result.error || 'Failed');
      }
      setSuccess(`Withdrawal of ₹${amount} requested — it will be transferred to your bank shortly.`);
      setAmount('');
      await fetchAll();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-[#1C1C1C] rounded-3xl shadow-sm border border-white/5 p-6 lg:p-8">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-[#F4511E]/10 border border-[#F4511E]/20 text-[#F4511E] flex items-center justify-center">
            <Wallet size={20} />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-white/40">Wallet Balance</p>
            <p className="text-3xl font-black text-white tracking-tight">₹{balance.toLocaleString('en-IN')}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => { setShowWithdraw(true); setError(''); setSuccess(''); }}
          disabled={balance < minWithdrawal}
          className="flex items-center gap-2 px-6 py-3 bg-[#F4511E] hover:bg-[#D84315] text-white rounded-xl text-sm font-black btn-tap disabled:opacity-40 transition-colors"
        >
          <ArrowDownToLine size={16} /> Withdraw
        </button>
      </div>

      {balance < minWithdrawal && (
        <p className="text-[11px] font-medium text-white/40 mb-4">
          Minimum withdrawal is ₹{minWithdrawal} — earnings from completed gigs credit here automatically.
        </p>
      )}

      {/* Transaction log */}
      <button type="button" onClick={() => setShowLog(!showLog)} aria-expanded={showLog}
        className="text-xs font-bold text-white/50 hover:text-white btn-tap min-h-0 flex items-center gap-1" style={{ minHeight: '32px' }}>
        {showLog ? 'Hide' : 'Show'} wallet activity ({txns.length}) {showLog ? '▴' : '▾'}
      </button>
      {showLog && (
        <div className="mt-3 space-y-2 max-h-72 overflow-y-auto hide-scrollbar animate-in fade-in duration-150">
          {txns.length === 0 ? (
            <p className="text-xs font-medium text-white/40 py-3">No wallet activity yet — complete a gig to see your first credit.</p>
          ) : txns.map(t => (
            <div key={t.id} className="flex items-center justify-between bg-[#111111] rounded-xl px-4 py-3 border border-white/5">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${t.amount >= 0 ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                  {t.amount >= 0 ? <ArrowDownLeft size={13} /> : <ArrowUpRight size={13} />}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white truncate">{t.description || TXN_LABEL[t.type] || t.type}</p>
                  <p className="text-[10px] font-semibold text-white/40">
                    {new Date(t.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    {t.status === 'pending' && <span className="ml-1.5 text-yellow-400 uppercase font-black">· Pending</span>}
                  </p>
                </div>
              </div>
              <span className={`text-sm font-black shrink-0 ${t.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {t.amount >= 0 ? '+' : ''}₹{Math.abs(t.amount).toLocaleString('en-IN')}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Withdraw modal */}
      {showWithdraw && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-end sm:items-center sm:justify-center p-0 sm:p-4 animate-in fade-in">
          <div className="bg-[#1C1C1C] border-t sm:border border-white/10 w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom sm:zoom-in duration-300">
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-black text-white flex items-center gap-2"><Landmark size={18} className="text-[#F4511E]" /> {bankVerified ? 'Withdraw' : 'Add Bank Details'}</h3>
              <button type="button" aria-label="Close" onClick={() => setShowWithdraw(false)} className="p-2 bg-white/10 text-white/60 hover:text-white rounded-full btn-tap"><X size={16} /></button>
            </div>

            {error && <p className="text-red-400 text-xs font-semibold mb-3 bg-red-500/10 border border-red-500/20 rounded-xl p-3">{error}</p>}
            {success && <p className="text-green-400 text-xs font-semibold mb-3 bg-green-500/10 border border-green-500/20 rounded-xl p-3">{success}</p>}

            {!bankVerified ? (
              <div className="space-y-3">
                <p className="text-[11px] font-medium text-white/50">
                  One-time setup — your account is verified before any transfer so typos are caught early. Details are visible only to you.
                </p>
                <div>
                  <label htmlFor="w-holder" className="block text-[10px] font-black text-white/60 uppercase tracking-wider mb-1">Account Holder Name</label>
                  <input id="w-holder" type="text" value={bankForm.account_holder}
                    onChange={e => setBankForm(f => ({ ...f, account_holder: e.target.value }))}
                    className="w-full h-11 px-4 rounded-xl bg-[#111111] border border-white/10 text-white text-sm font-semibold focus:outline-none focus:border-[#F4511E]" />
                </div>
                <div>
                  <label htmlFor="w-acct" className="block text-[10px] font-black text-white/60 uppercase tracking-wider mb-1">Account Number</label>
                  <input id="w-acct" type="text" inputMode="numeric" value={bankForm.account_number}
                    onChange={e => setBankForm(f => ({ ...f, account_number: e.target.value }))}
                    className="w-full h-11 px-4 rounded-xl bg-[#111111] border border-white/10 text-white text-sm font-semibold focus:outline-none focus:border-[#F4511E]" />
                </div>
                <div>
                  <label htmlFor="w-ifsc" className="block text-[10px] font-black text-white/60 uppercase tracking-wider mb-1">IFSC Code</label>
                  <input id="w-ifsc" type="text" placeholder="SBIN0001234" value={bankForm.ifsc}
                    onChange={e => setBankForm(f => ({ ...f, ifsc: e.target.value.toUpperCase() }))}
                    className="w-full h-11 px-4 rounded-xl bg-[#111111] border border-white/10 text-white text-sm font-semibold placeholder:text-white/30 focus:outline-none focus:border-[#F4511E]" />
                </div>
                <button type="button" onClick={saveBank} disabled={busy}
                  className="w-full py-3.5 bg-[#F4511E] hover:bg-[#D84315] text-white rounded-xl font-black text-sm btn-tap disabled:opacity-50 transition-colors">
                  {busy ? 'Verifying…' : 'Save & Verify'}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-[#111111] rounded-xl p-3.5 border border-white/5 flex items-center justify-between">
                  <span className="text-xs font-bold text-white/50">Bank ····{bank.account_number.slice(-4)} · {bank.ifsc}</span>
                  <span className="text-[9px] font-black uppercase text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-1 rounded-full">Verified</span>
                </div>
                <div>
                  <label htmlFor="w-amount" className="block text-[10px] font-black text-white/60 uppercase tracking-wider mb-1">
                    Amount (available: ₹{balance.toLocaleString('en-IN')})
                  </label>
                  <input id="w-amount" type="number" min={minWithdrawal} max={balance} value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder={`Min ₹${minWithdrawal}`}
                    className="w-full h-12 px-4 rounded-xl bg-[#111111] border border-white/10 text-white text-lg font-black placeholder:text-white/30 placeholder:font-semibold placeholder:text-sm focus:outline-none focus:border-[#F4511E]" />
                </div>
                <button type="button" onClick={withdraw} disabled={busy || !amount}
                  className="w-full py-3.5 bg-[#F4511E] hover:bg-[#D84315] text-white rounded-xl font-black text-sm btn-tap disabled:opacity-50 transition-colors">
                  {busy ? 'Processing…' : `Withdraw ₹${amount || '—'}`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
