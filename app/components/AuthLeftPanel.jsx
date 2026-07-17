import { Zap, MapPin, Wallet, ShieldCheck } from 'lucide-react';

export default function AuthLeftPanel() {
  return (
    <div className="hidden lg:flex flex-col justify-between hero-gradient-overlay text-white p-16 lg:w-1/2 min-h-screen relative overflow-hidden border-r border-white/5">
      {/* Background decorations */}
      <div className="absolute top-[-100px] right-[-100px] w-96 h-96 bg-[#F4511E]/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-[100px] left-[-50px] w-72 h-72 bg-white/5 rounded-full blur-2xl pointer-events-none"></div>

      <div className="relative z-10 flex-col space-y-12">
        <div className="space-y-4">
          <h1 className="text-[56px] font-black leading-tight tracking-tight max-w-[500px]">
            Your next gig is one tap away.
          </h1>

          <div className="flex flex-col space-y-3 pt-6">
            <div className="flex items-center text-lg font-bold glass-panel w-fit px-5 py-2.5 rounded-full">
              <Zap size={18} className="mr-3 text-[#F4511E]" /> Apply in one tap — first come, first confirmed
            </div>
            <div className="flex items-center text-lg font-bold glass-panel w-fit px-5 py-2.5 rounded-full">
              <MapPin size={18} className="mr-3 text-[#F4511E]" /> Hyperlocal — gigs across Indore
            </div>
            <div className="flex items-center text-lg font-bold glass-panel w-fit px-5 py-2.5 rounded-full">
              <Wallet size={18} className="mr-3 text-[#F4511E]" /> Payouts within 24 hours of completion
            </div>
            <div className="flex items-center text-lg font-bold glass-panel w-fit px-5 py-2.5 rounded-full">
              <ShieldCheck size={18} className="mr-3 text-[#F4511E]" /> Verified hirers, rated both ways
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-10 pt-10">
        <h2 className="text-3xl font-black tracking-tight">
          Gig<span className="text-[#F4511E] italic">Dekho</span>
        </h2>
      </div>
    </div>
  );
}
