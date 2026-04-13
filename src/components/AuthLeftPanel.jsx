import { Star } from 'lucide-react';

export default function AuthLeftPanel() {
  return (
    <div className="hidden lg:flex flex-col justify-between bg-primary text-white p-16 lg:w-1/2 min-h-screen relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-[-100px] right-[-100px] w-96 h-96 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-[100px] left-[-50px] w-72 h-72 bg-blue-400/20 rounded-full blur-2xl pointer-events-none"></div>

      <div className="relative z-10 flex-col space-y-12">
        <div className="space-y-4">
          <h1 className="text-[56px] font-black leading-tight tracking-tight max-w-[500px]">
            Your next gig is one tap away.
          </h1>
          
          <div className="flex flex-col space-y-3 pt-6">
            <div className="flex items-center text-lg font-bold bg-white/10 w-fit px-5 py-2.5 rounded-full border border-white/20">
              <span className="mr-3">⚡</span> 500+ workers earning weekly
            </div>
            <div className="flex items-center text-lg font-bold bg-white/10 w-fit px-5 py-2.5 rounded-full border border-white/20">
              <span className="mr-3">📍</span> Active in Indore
            </div>
            <div className="flex items-center text-lg font-bold bg-white/10 w-fit px-5 py-2.5 rounded-full border border-white/20">
              <span className="mr-3">💸</span> Payouts within 1 hour
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="bg-white rounded-2xl p-6 text-slate-800 shadow-xl max-w-sm hover:-translate-y-1 transition-transform">
            <p className="font-bold text-lg mb-3 text-slate-800">
              "Got paid the same night. Easiest ₹2000 I've made."
            </p>
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-slate-500">— Rahul S., Event Helper</span>
              <div className="flex text-amber-400">
                <Star size={14} className="fill-current" /><Star size={14} className="fill-current" /><Star size={14} className="fill-current" /><Star size={14} className="fill-current" /><Star size={14} className="fill-current" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 text-slate-800 shadow-xl max-w-sm translate-x-8 hover:-translate-y-1 transition-transform">
            <p className="font-bold text-lg mb-3 text-slate-800">
              "Found 3 gigs in my first week. Legit platform."
            </p>
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-slate-500">— Priya M., Singer</span>
              <div className="flex text-amber-400">
                <Star size={14} className="fill-current" /><Star size={14} className="fill-current" /><Star size={14} className="fill-current" /><Star size={14} className="fill-current" /><Star size={14} className="fill-current" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-10 pt-10">
        <h2 className="text-3xl font-black tracking-tight flex items-center">
          <span className="bg-white text-primary px-[6px] py-[2px] rounded mr-1">Gig</span>Up
        </h2>
      </div>
    </div>
  );
}
