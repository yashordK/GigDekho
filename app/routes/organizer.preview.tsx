import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Plus, Briefcase, Clock, Users, IndianRupee, Calendar, MapPin } from "lucide-react";
import AuthModal from "~/components/AuthModal";

export default function OrganizerPreviewScreen() {
  const navigate = useNavigate();
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Auto show modal after 1 minute (60,000ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowAuthModal(true);
    }, 60000);
    return () => clearTimeout(timer);
  }, []);

  const handlePreviewClick = () => {
    if (!showAuthModal) {
      setShowAuthModal(true);
    }
  };



  // Fake stats for the blurred background
  const ghostStats = [
    { label: "Total Gigs", value: "—" },
    { label: "Active Now", value: "—" },
    { label: "Workers Hired", value: "—" },
    { label: "Total Spent", value: "—" },
  ];

  // Fake gigs for the blurred background
  const ghostGigs = [
    { title: "Annual Tech Conference", role: "📋 Coordinator", date: "Sat, 28 Jun · 9:00 AM", location: "Grand Hall, Indore", slots: "4/6", pay: "₹4,800" },
    { title: "Wedding Reception", role: "🍽️ Waitstaff", date: "Sun, 29 Jun · 6:00 PM", location: "Sayaji Hotel, Indore", slots: "8/10", pay: "₹6,000" },
    { title: "Product Launch Event", role: "🎤 Emcee", date: "Mon, 30 Jun · 5:00 PM", location: "C21 Mall, Indore", slots: "1/1", pay: "₹3,500" },
  ];

  return (
    <div className="relative min-h-screen bg-[#111111] overflow-hidden flex flex-col font-sans">
      
      {/* Simple Nav Bar */}
      <nav className="relative w-full h-[64px] border-b border-white/10 flex items-center justify-between px-6 xl:px-12 z-20 bg-[#111111]/80 backdrop-blur-md">
        <div className="text-[22px] tracking-tight flex items-center cursor-pointer">
          <span className="text-white font-bold">
            Gig<span className="text-[#F4511E] italic font-black">Dekho</span>
          </span>
        </div>
        <button
          onClick={() => navigate("/auth?mode=organizer")}
          className="bg-white/10 hover:bg-white/20 text-white font-bold px-5 py-1.5 rounded-full text-xs tracking-wider transition-colors btn-tap min-h-[38px] flex items-center"
        >
          Sign In
        </button>
      </nav>

      {/* Ghost Content Container */}
      <div 
        onClick={handlePreviewClick}
        className={`flex-grow p-6 xl:p-12 space-y-8 z-0 transition-all duration-300 ${
          showAuthModal 
            ? "filter blur-sm pointer-events-none select-none opacity-20" 
            : "opacity-95 cursor-pointer"
        }`}
      >
        
        {/* Preview Banner */}
        {!showAuthModal && (
          <div className="max-w-md mx-auto bg-[#F4511E]/10 border border-[#F4511E]/20 text-[#F4511E] px-4 py-2.5 rounded-2xl text-center text-xs font-black uppercase tracking-wider animate-in slide-in-from-top duration-300">
             ⚡ Demo Preview Mode — Click anywhere to post a real gig
          </div>
        )}

        {/* Welcome Header */}
        <div className="max-w-md mx-auto text-center space-y-2 mt-4">
          <div className="inline-block bg-[#1C1C1C] px-3.5 py-1.5 rounded-full border border-white/10">
            <span className="text-white font-bold text-xs">Welcome back, Event Planners</span>
          </div>
          <h1 className="text-3xl font-black text-white">Indore Organizer Center</h1>
          <p className="text-white/60 text-sm">Post and manage your hyperlocal event staffing instantly.</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 max-w-7xl mx-auto">
          {ghostStats.map((stat, idx) => (
            <div key={idx} className="glass-panel p-5 rounded-2xl flex items-center space-x-4">
              <div className="w-10 h-10 rounded-xl bg-[#F4511E]/10 flex items-center justify-center text-[#F4511E]">
                {idx === 0 && <Briefcase size={20} />}
                {idx === 1 && <Clock size={20} />}
                {idx === 2 && <Users size={20} />}
                {idx === 3 && <IndianRupee size={20} />}
              </div>
              <div className="flex flex-col text-left">
                <span className="text-[10px] uppercase font-black tracking-wider text-white/40">{stat.label}</span>
                <span className="text-xl font-black text-white">{stat.value}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Gigs List */}
        <div className="space-y-4 max-w-7xl mx-auto text-left">
          <h2 className="text-base font-black text-white uppercase tracking-wider">Active & Upcoming Gigs</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {ghostGigs.map((gig, idx) => (
              <div key={idx} className="bg-[#1C1C1C] rounded-2xl p-5 border border-white/5 shadow-md flex flex-col space-y-4">
                <div className="flex flex-col space-y-1">
                  <div className="flex gap-2">
                    <span className="text-xs font-black text-white/50 bg-[#111111] px-2.5 py-1 rounded-lg border border-white/5">
                      {gig.role}
                    </span>
                  </div>
                  <h3 className="font-black text-white text-base tracking-tight mt-1">{gig.title}</h3>
                  <span className="text-[11px] font-semibold text-white/40 flex items-center gap-1">
                    <Calendar size={12} className="text-[#F4511E]" /> {gig.date}
                  </span>
                  <span className="text-[11px] font-semibold text-white/40 flex items-center gap-1">
                    <MapPin size={12} className="text-[#F4511E]" /> {gig.location}
                  </span>
                </div>

                <div className="bg-[#111111] p-3 rounded-xl border border-white/5">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-black text-white/40 uppercase tracking-wider">Workers Hired</span>
                    <span className="text-[10px] font-black uppercase text-green-400">{gig.slots} Filled</span>
                  </div>
                  <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 w-[70%]" />
                  </div>
                </div>

                <div className="border-t border-white/5 pt-4">
                  <div className="w-full py-2 rounded-xl bg-green-500/10 border border-green-500/20 text-center text-xs text-green-400 font-bold uppercase tracking-wider">
                    ✓ Paid {gig.pay}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Floating post gig trigger (dimmed if modal is open) */}
      <button 
        onClick={handlePreviewClick}
        className={`fixed bottom-6 right-6 z-10 bg-[#F4511E] text-white px-6 py-3.5 rounded-full shadow-xl font-black tracking-widest text-xs uppercase transition-all duration-300 ${
          showAuthModal 
            ? "filter blur-[2px] opacity-35 pointer-events-none" 
            : "hover:scale-105 hover:bg-[#D84315]"
        }`}
      >
        <Plus size={18} className="mr-1.5 inline" /> Post a Gig
      </button>

      {/* Overlay Modal — Reusable Stateful Auth Card */}
      <AuthModal 
        isOpen={showAuthModal} 
        onClose={() => setShowAuthModal(false)} 
        defaultIntent="organizer" 
      />
      
    </div>
  );
}
