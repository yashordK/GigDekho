import { useState, useEffect, useRef } from 'react';
import { supabase } from '~/lib/supabase.client';
import { Wallet, X, Landmark, ArrowDownToLine, ArrowUpRight, ArrowDownLeft, Smartphone, QrCode, Check } from 'lucide-react';

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
  // UPI first: most people earning here are students who can read a UPI ID off
  // their own phone, and cannot find an IFSC without digging out a passbook.
  const [method, setMethod] = useState<'upi' | 'bank'>('upi');
  // Held in a ref, not state. The file picker sends the page to the background
  // on Android and anything kept in state can be gone when it returns — the
  // same failure that made document upload take five attempts.
  const qrFile = useRef<File | null>(null);
  const qrInput = useRef<HTMLInputElement | null>(null);
  const [qrName, setQrName] = useState('');
  const [bankForm, setBankForm] = useState({ account_number: '', ifsc: '', account_holder: '', upi_id: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchAll = async () => {
    const [{ data: t }, { data: b }, { data: s }] = await Promise.all([
      supabase.from('wallet_transactions').select('id, amount, type, status, description, created_at')
        .eq('worker_id', userId).neq('status', 'failed').order('created_at', { ascending: false }),
      supabase.from('worker_bank_accounts').select('id, method, account_number, ifsc, upi_id, upi_qr_url, account_holder, penny_drop_status').eq('worker_id', userId).maybeSingle(),
      supabase.from('app_settings').select('value').eq('key', 'min_withdrawal_amount').maybeSingle(),
    ]);
    setTxns(t || []);
    setBank(b);
    if (s?.value) setMinWithdrawal(Number(s.value));
  };

  useEffect(() => { fetchAll(); }, [userId]);

  const balance = txns.reduce((acc, t) => acc + t.amount, 0);
  const bankVerified = bank?.penny_drop_status === 'verified';
  const isUpi = bank?.method === 'upi';
  const payoutLabel = isUpi ? `on ${bank?.upi_id}` : 'in your bank account';

  /**
   * Shrinks a QR screenshot before upload.
   *
   * A phone screenshot is routinely 2-5MB, and the serverless request body caps
   * out around 4.5MB — so an untouched screenshot is rejected at the edge with a
   * 413 that never reaches our code and produces no message anyone can act on.
   * Shrinking here means the request is small before it is ever sent.
   *
   * Quality stays high and the long edge stays generous, because the whole
   * point of the image is that someone can still scan it.
   */
  const shrinkQr = async (file: File): Promise<File> => {
    if (file.size < 700 * 1024) return file;
    try {
      const bitmap = await createImageBitmap(file);
      const max = 1400;
      const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      const ctx = canvas.getContext('2d')!;
      // A QR is black on white; flattening onto white avoids a transparent
      // background turning into black mush when it becomes a JPEG.
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.92));
      if (!blob || blob.size >= file.size) return file;
      return new File([blob], 'upi-qr.jpg', { type: 'image/jpeg' });
    } catch {
      return file;
    }
  };

  const saveBank = async () => {
    setBusy(true); setError('');
    try {
      const form = new FormData();
      form.append('method', method);
      form.append('account_holder', bankForm.account_holder);
      if (method === 'upi') {
        form.append('upi_id', bankForm.upi_id);
        if (qrFile.current) {
          const small = await shrinkQr(qrFile.current);
          form.append('upi_qr', small, small.name || 'upi-qr.jpg');
        }
      } else {
        form.append('account_number', bankForm.account_number);
        form.append('ifsc', bankForm.ifsc);
      }
      const res = await fetch('/api/bank', { method: 'POST', body: form });
      if (res.status === 413) {
        throw new Error("That image is too large to upload. Your UPI ID alone is enough — try saving without the QR.");
      }
      const result = await res.json().catch(() => ({}));
      if (!res.ok || result.error) throw new Error(result.error || 'Failed');
      qrFile.current = null;
      setQrName('');
      // Never let them walk away thinking the QR is on file when it isn't.
      if (result.qrSkipped) {
        setError("Your UPI ID is saved. The QR image couldn't be stored — that's fine, the ID is what we pay to.");
      }
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
        if (result.error === 'bank_not_verified') throw new Error('Add where you want to be paid first.');
        throw new Error(result.error || 'Failed');
      }
      setSuccess(`Withdrawal of ₹${amount} requested — it will reach you ${payoutLabel} shortly. We'll notify you once it's sent.`);
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
              <h3 className="font-black text-white flex items-center gap-2"><Landmark size={18} className="text-[#F4511E]" /> {bankVerified ? 'Withdraw' : 'Where should we pay you?'}</h3>
              <button type="button" aria-label="Close" onClick={() => setShowWithdraw(false)} className="p-2 bg-white/10 text-white/60 hover:text-white rounded-full btn-tap"><X size={16} /></button>
            </div>

            {error && <p className="text-red-400 text-xs font-semibold mb-3 bg-red-500/10 border border-red-500/20 rounded-xl p-3">{error}</p>}
            {success && <p className="text-green-400 text-xs font-semibold mb-3 bg-green-500/10 border border-green-500/20 rounded-xl p-3">{success}</p>}

            {!bankVerified ? (
              <div className="space-y-3">
                <p className="text-[11px] font-medium text-white/50">
                  One-time setup. Only you and GigDekho can see this, and you can change it any time.
                </p>

                <div className="grid grid-cols-2 gap-2">
                  {([['upi', 'UPI', Smartphone], ['bank', 'Bank transfer', Landmark]] as const).map(([v, label, Icon]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => { setMethod(v); setError(''); }}
                      className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider border transition-colors btn-tap ${
                        method === v
                          ? 'bg-[#F4511E]/15 border-[#F4511E]/40 text-[#F4511E]'
                          : 'bg-[#111111] border-white/10 text-white/40 hover:text-white/70'
                      }`}
                    >
                      <Icon size={13} /> {label}
                    </button>
                  ))}
                </div>

                <div>
                  <label htmlFor="w-holder" className="block text-[10px] font-black text-white/60 uppercase tracking-wider mb-1">Your Full Name</label>
                  <input id="w-holder" type="text" value={bankForm.account_holder}
                    onChange={e => setBankForm(f => ({ ...f, account_holder: e.target.value }))}
                    placeholder="As it appears on your account"
                    className="w-full h-11 px-4 rounded-xl bg-[#111111] border border-white/10 text-white text-sm font-semibold placeholder:text-white/30 focus:outline-none focus:border-[#F4511E]" />
                </div>

                {method === 'upi' ? (
                  <div>
                    <label htmlFor="w-upi" className="block text-[10px] font-black text-white/60 uppercase tracking-wider mb-1">UPI ID</label>
                    <input id="w-upi" type="text" inputMode="email" autoCapitalize="none" autoCorrect="off"
                      placeholder="yourname@okhdfcbank"
                      value={bankForm.upi_id}
                      onChange={e => setBankForm(f => ({ ...f, upi_id: e.target.value }))}
                      className="w-full h-11 px-4 rounded-xl bg-[#111111] border border-white/10 text-white text-sm font-semibold placeholder:text-white/30 focus:outline-none focus:border-[#F4511E]" />
                    <p className="text-[10px] font-medium text-white/35 mt-1.5">
                      Open any UPI app — GPay, PhonePe, Paytm — and copy the ID shown on your profile.
                    </p>

                    <div className="mt-3 pt-3 border-t border-white/5">
                      <label htmlFor="w-qr" className="block text-[10px] font-black text-white/60 uppercase tracking-wider mb-1">
                        UPI QR code <span className="text-white/30">— optional</span>
                      </label>
                      <input
                        ref={qrInput}
                        id="w-qr"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          e.target.value = '';
                          if (f) { qrFile.current = f; setQrName(f.name); setError(''); }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => qrInput.current?.click()}
                        className="w-full flex items-center justify-center gap-2 h-11 rounded-xl bg-[#111111] border border-dashed border-white/15 text-white/60 hover:text-white hover:border-[#F4511E]/40 text-xs font-bold transition-colors btn-tap"
                      >
                        {qrName
                          ? <><Check size={14} className="text-green-400" /> {qrName.length > 22 ? qrName.slice(0, 22) + '…' : qrName}</>
                          : <><QrCode size={14} /> Add a screenshot of your QR</>}
                      </button>
                      <p className="text-[10px] font-medium text-white/35 mt-1.5">
                        Not required — your UPI ID above is enough. Add it if you'd rather we scan it.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
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
                  </>
                )}
                <button type="button" onClick={saveBank} disabled={busy}
                  className="w-full py-3.5 bg-[#F4511E] hover:bg-[#D84315] text-white rounded-xl font-black text-sm btn-tap disabled:opacity-50 transition-colors">
                  {busy ? 'Saving…' : 'Save'}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-[#111111] rounded-xl p-3.5 border border-white/5 flex items-center justify-between">
                  <span className="text-xs font-bold text-white/50 truncate flex items-center gap-1.5 min-w-0">
                    {isUpi
                      ? <><Smartphone size={12} className="text-[#F4511E] shrink-0" /><span className="truncate">{bank.upi_id}</span>{bank.upi_qr_url && <QrCode size={11} className="text-white/30 shrink-0" />}</>
                      : <><Landmark size={12} className="text-[#F4511E] shrink-0" /><span className="truncate">····{String(bank.account_number).slice(-4)} · {bank.ifsc}</span></>}
                  </span>
                  <button type="button"
                    onClick={() => {
                      // Editing means re-entering it; there is no partial edit
                      // that keeps half of a payout destination valid.
                      setBank(null);
                      setMethod(isUpi ? 'upi' : 'bank');
                      qrFile.current = null;
                      setQrName('');
                      setBankForm({ account_number: '', ifsc: '', upi_id: '', account_holder: bank.account_holder ?? '' });
                    }}
                    className="text-[9px] font-black uppercase tracking-wider text-white/40 hover:text-[#F4511E] transition-colors shrink-0 ml-2">
                    Change
                  </button>
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
