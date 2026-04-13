import { Clock, Building2, Calendar, Zap, MapPin } from 'lucide-react';
import { formatRelativeDate } from '../lib/utils';

const getImageUrl = (role) => {
  const r = (role || '').toLowerCase();
  let url = 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=400';
  if (r.includes('wait') || r.includes('hostess')) url = 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400';
  else if (r.includes('sing') || r.includes('vocal')) url = 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400';
  else if (r.includes('dj') || r.includes('disc')) url = 'https://images.unsplash.com/photo-1571266028243-d220c6f3f07b?w=400';
  else if (r.includes('art') || r.includes('sketch')) url = 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=400';
  else if (r.includes('secur') || r.includes('guard') || r.includes('bouncer')) url = 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400';
  else if (r.includes('danc')) url = 'https://images.unsplash.com/photo-1508700929628-666bc8bd84ea?w=400';
  else if (r.includes('photo') || r.includes('camera')) url = 'https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=400';
  
  return url + '&auto=format&fit=crop';
};

export default function GigCard({ gig, onClick }) {
  const { title, role_type, location_text, pay_rate, duration_hrs, event_date, is_urgent, slots_total, slots_filled } = gig;
  
  const totalEarning = pay_rate * duration_hrs;
  const remainingSpots = (slots_total || 0) - (slots_filled || 0);
  const dateFormatted = formatRelativeDate(event_date);
  const imageUrl = getImageUrl(role_type);

  return (
    <div 
      onClick={onClick}
      className={`bg-white rounded-3xl shadow-sm hover:shadow-md border border-slate-100 overflow-hidden cursor-pointer transition-all mb-4 btn-tap flex flex-col p-4 w-full`}
    >
       {/* Large Embedded Image Area */}
       <div className="relative h-48 w-full bg-slate-900 rounded-2xl overflow-hidden mb-4">
         <img 
           src={imageUrl} 
           alt={role_type} 
           loading="lazy"
           className="w-full h-full object-cover opacity-80"
         />
         <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
         
         <div className="absolute top-4 left-4 flex gap-2">
            {is_urgent ? (
              <span className="bg-[#F4511E] text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full shadow-lg flex items-center">
                 <Zap size={10} className="mr-1" fill="currentColor"/> URGENT
              </span>
            ) : null}
            {!is_urgent && (
               <span className="bg-white/90 backdrop-blur-md text-slate-900 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full shadow-sm">
                 FEATURED
               </span>
            )}
         </div>
         
         {remainingSpots > 0 && (
           <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold tracking-wider px-2.5 py-1 rounded-md border border-white/10">
             {remainingSpots} spot{remainingSpots !== 1 ? 's' : ''} left
           </div>
         )}

         <div className="absolute inset-0 flex flex-col items-center justify-center text-white/50 opacity-40 mix-blend-overlay">
           {/* Center mock text/logo from screenshot if needed, keeping it minimal */}
         </div>
       </div>

       {/* Body Texts */}
       <div className="flex justify-between items-start mb-2 px-1">
          <h3 className="text-lg font-black text-slate-900 leading-tight">{title}</h3>
          <span className="text-lg font-black text-[#00BCD4] drop-shadow-sm ml-4">₹{totalEarning.toLocaleString('en-IN')}</span>
       </div>

       <div className="flex items-center text-slate-500 text-xs font-bold px-1 mb-5 flex-wrap gap-y-2">
          <Calendar size={12} className="mr-1 shrink-0" />
          <span className="mr-2 text-[#00BCD4]">{dateFormatted}</span>
          <span className="mr-2 text-slate-300 hidden sm:inline">•</span>
          
          <MapPin size={12} className="mr-1 shrink-0 lg:ml-0 md:ml-0 sm:ml-0" />
          <span className="mr-2 truncate max-w-[120px]">{location_text}</span>
          <span className="mr-2 text-slate-300">•</span>
          
          <Clock size={12} className="mr-1 shrink-0" />
          <span>{duration_hrs}h</span>
       </div>

       {/* Full Width Apply Button */}
       {is_urgent ? (
         <button 
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            className="w-full bg-[#F4511E] hover:bg-[#D84315] text-white font-black py-3.5 rounded-2xl text-[14px] transition-colors shadow-sm btn-tap"
          >
            Apply Now
         </button>
       ) : (
         <button 
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            className="w-full bg-transparent border-2 border-slate-200 hover:border-slate-300 text-slate-700 font-black py-3 rounded-2xl text-[14px] transition-colors btn-tap"
          >
            View Details
         </button>
       )}
    </div>
  );
}
