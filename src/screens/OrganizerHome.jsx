import { useNavigate } from 'react-router-dom';
import { Tent } from 'lucide-react';

export default function OrganizerHomeScreen() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background font-sans flex flex-col items-center justify-center p-6 relative text-center">
      
      {/* Top Left Logo Just In Case */}
      <div className="absolute top-6 left-6 lg:top-10 lg:left-12 flex items-center">
         <span className="text-xl lg:text-2xl font-bold tracking-tight text-slate-900 drop-shadow-sm">
           Gig<span className="text-[#F4511E] italic font-black">Dekho</span>
         </span>
         <span className="ml-3 bg-slate-900 text-white text-[10px] uppercase font-black tracking-widest px-2 py-0.5 rounded-full">
           Organizer
         </span>
      </div>

      <div className="w-24 h-24 lg:w-32 lg:h-32 bg-slate-800 rounded-full shadow-lg flex items-center justify-center text-5xl lg:text-6xl mb-8 border border-slate-700 mx-auto">
        🎪
      </div>
      
      <h1 className="text-3xl lg:text-5xl font-black text-slate-900 tracking-tight leading-tight mb-4 max-w-lg">
        Organizer Dashboard
      </h1>
      
      <p className="text-slate-600 font-medium text-lg lg:text-xl max-w-md mx-auto mb-10 leading-relaxed">
        We're building something great for you. Manage your events, track applications, and hire instantly. Check back soon.
      </p>

      {/* Manual bypass link per user instruction */}
      <button 
        onClick={() => navigate('/')} 
        className="text-[#F4511E] font-bold text-sm lg:text-base border-b-2 border-transparent hover:border-[#F4511E] pb-0.5 transition-all"
      >
        Browse as Worker instead
      </button>

    </div>
  );
}
