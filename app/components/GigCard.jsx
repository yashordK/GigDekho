import { Clock, Calendar, Zap, MapPin, GraduationCap, Hourglass, Briefcase } from 'lucide-react';
import { formatRelativeDate, gigTotalPay } from '~/lib/utils';
import { gigCoverUrl } from '~/lib/cover';

const WORK_MODE = { onsite: 'On-site', hybrid: 'Hybrid', remote: 'Remote' };
const COMMITMENT = { full_time: 'Full-time', part_time: 'Part-time' };

function stipendText(gig) {
  if (gig.is_unpaid) return 'Unpaid';
  if (gig.stipend_min == null) return 'Stipend TBD';
  if (gig.stipend_max && gig.stipend_max > gig.stipend_min) {
    return `₹${gig.stipend_min.toLocaleString('en-IN')}–${gig.stipend_max.toLocaleString('en-IN')}`;
  }
  return `₹${gig.stipend_min.toLocaleString('en-IN')}`;
}

export default function GigCard({ gig, onClick, isPast = false }) {
  const { title, role_type, custom_role, location_text, event_date, is_urgent, slots_total, slots_filled, status } = gig;
  const dayCount = Math.max(Number(gig.day_count) || 1, 1);

  // ── Internship / job variant: text-forward, no hero image ──
  if (gig.gig_type === 'internship') {
    const deadlineSoon = gig.application_deadline
      && new Date(gig.application_deadline) > new Date()
      && (new Date(gig.application_deadline) - Date.now()) < 5 * 24 * 3600000;

    return (
      <div
        onClick={onClick}
        className="bg-[#1C1C1C] rounded-3xl shadow-sm hover:shadow-md border border-white/5 hover:border-blue-500/30 overflow-hidden cursor-pointer transition-all mb-4 btn-tap flex flex-col p-5 w-full"
      >
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="bg-blue-500/10 text-blue-400 border border-blue-500/25 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full flex items-center gap-1">
            <GraduationCap size={11} /> Internship
          </span>
          {deadlineSoon && (
            <span className="bg-[#F4511E]/15 text-[#F4511E] border border-[#F4511E]/25 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full">
              Closes {new Date(gig.application_deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            </span>
          )}
        </div>

        <h3 className="text-lg font-black text-white leading-tight mb-1">{title}</h3>
        <p className="text-white/40 text-xs font-bold mb-4">{custom_role || role_type}</p>

        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="bg-[#111111] rounded-xl px-3 py-2.5 border border-white/5">
            <p className="text-[9px] font-black text-white/30 uppercase tracking-widest mb-0.5">Stipend / mo</p>
            <p className="text-sm font-black text-[#F4511E] truncate">{stipendText(gig)}</p>
          </div>
          <div className="bg-[#111111] rounded-xl px-3 py-2.5 border border-white/5">
            <p className="text-[9px] font-black text-white/30 uppercase tracking-widest mb-0.5">Duration</p>
            <p className="text-sm font-black text-white">{gig.duration_months} month{gig.duration_months !== 1 ? 's' : ''}</p>
          </div>
        </div>

        <div className="flex items-center text-white/50 text-xs font-bold mb-5 flex-wrap gap-y-2">
          <Briefcase size={12} className="mr-1 shrink-0" />
          <span className="mr-2">{COMMITMENT[gig.commitment] || '—'}</span>
          <span className="mr-2 text-white/20">•</span>
          <MapPin size={12} className="mr-1 shrink-0" />
          <span className="truncate max-w-[140px]">{WORK_MODE[gig.work_mode] === 'Remote' ? 'Remote' : location_text}</span>
        </div>

        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onClick(); }}
          className="w-full bg-[#F4511E] hover:bg-[#D84315] text-white font-black py-3.5 rounded-2xl text-[14px] transition-colors shadow-sm btn-tap mt-auto"
        >
          View & Apply
        </button>
      </div>
    );
  }

  // ── Event gig variant ──
  // Through the shared helper, so a gig priced per day shows the whole run
  // rather than one day of it. Doing the multiplication here is how this card
  // ended up advertising a single day's pay for a three-day event.
  const totalEarning = gigTotalPay(gig);
  const remainingSpots = (slots_total || 0) - (slots_filled || 0);
  // 'filled' is the hirer's own statement that they are done taking people,
  // and it outranks the seat count — a gig can be closed to applicants while
  // the raw numbers still look like there is room.
  const isFull = status === 'filled' || remainingSpots <= 0;
  // A finished gig that nobody worked was closed, not completed. Saying
  // "Completed" over an empty roster would be a claim about work that never
  // happened.
  const pastLabel = status === 'completed' || (slots_filled || 0) > 0 ? 'Completed' : 'Closed';
  const dateFormatted = formatRelativeDate(event_date);
  const imageUrl = gigCoverUrl(gig, 400);

  return (
    <div
      onClick={onClick}
      className={`bg-[#1C1C1C] rounded-3xl shadow-sm hover:shadow-md border border-white/5 overflow-hidden cursor-pointer transition-all mb-4 btn-tap flex flex-col p-4 w-full`}
    >
       {/* Cover area — collapses to a compact badge strip when the hirer
           chose to have no cover image */}
       <div className={`relative w-full rounded-2xl overflow-hidden mb-4 ${imageUrl ? 'h-48 bg-slate-900' : 'h-auto'}`}>
         {imageUrl && (
           <>
             <img
               src={imageUrl}
               alt=""
               loading="lazy"
               decoding="async"
               className="w-full h-full object-cover opacity-80"
             />
             <div className="absolute inset-0 bg-gradient-to-t from-[#111111]/90 via-black/20 to-transparent"></div>
           </>
         )}

         <div className={imageUrl ? "absolute top-4 left-4 flex gap-2" : "flex gap-2 flex-wrap"}>
            {is_urgent && !isPast && (
              <span className="bg-[#F4511E] text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full shadow-lg flex items-center">
                 <Zap size={10} className="mr-1" fill="currentColor"/> URGENT
              </span>
            )}
            {(!is_urgent || isPast) && role_type && (
               <span className="bg-white/10 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full shadow-sm border border-white/20">
                 {role_type}
               </span>
            )}
         </div>

         {isPast ? (
           <div className={imageUrl
             ? "absolute top-4 right-4 bg-black/70 backdrop-blur-sm text-white/70 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md border border-white/20"
             : "inline-block bg-white/10 text-white/60 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md border border-white/15"}>
             {pastLabel}
           </div>
         ) : isFull ? (
           <div className={imageUrl
             ? "absolute top-4 right-4 bg-black/70 backdrop-blur-sm text-white/80 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md border border-white/20"
             : "inline-block bg-white/10 text-white/70 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md border border-white/15"}>
             Seats full
           </div>
         ) : remainingSpots > 0 ? (
           <div className={imageUrl
             ? "absolute top-4 right-4 bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold tracking-wider px-2.5 py-1 rounded-md border border-white/10"
             : "inline-block bg-white/5 text-white/60 text-[10px] font-bold tracking-wider px-2.5 py-1 rounded-md border border-white/10"}>
             {remainingSpots} spot{remainingSpots !== 1 ? 's' : ''} left
           </div>
         ) : null}
       </div>

       {/* Body Texts */}
       <div className="flex justify-between items-start mb-2 px-1">
          <h3 className="text-lg font-black text-white leading-tight">{title}</h3>
          <span className="text-lg font-black text-[#F4511E] drop-shadow-sm ml-4">₹{totalEarning.toLocaleString('en-IN')}</span>
       </div>

       <div className="flex items-center text-white/50 text-xs font-bold px-1 mb-5 flex-wrap gap-y-2">
          <Calendar size={12} className="mr-1 shrink-0" />
          <span className="mr-2 text-[#F4511E]">{dateFormatted}</span>
          <span className="mr-2 text-white/20 hidden sm:inline">•</span>

          <MapPin size={12} className="mr-1 shrink-0 lg:ml-0 md:ml-0 sm:ml-0" />
          <span className="mr-2 truncate max-w-[120px]">{location_text}</span>

          {/* Days, not hours. A total like "89.76h" is arithmetic nobody
              asked for — it describes a twelve-day run as one number that
              matches no shift anyone works. */}
          {dayCount > 1 && (
            <>
              <span className="mr-2 text-white/20">•</span>
              <Clock size={12} className="mr-1 shrink-0" />
              <span>{dayCount} days</span>
            </>
          )}
       </div>

       {/* Full Width Apply Button */}
       {isPast ? (
         <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            className="w-full bg-white/5 border-2 border-white/10 text-white/40 font-black py-3 rounded-2xl text-[14px] transition-colors btn-tap"
         >
           {pastLabel} · View details
         </button>
       ) : isFull ? (
         <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            className="w-full bg-white/5 border-2 border-white/10 text-white/50 font-black py-3 rounded-2xl text-[14px] transition-colors btn-tap"
         >
           Seats full · View details
         </button>
       ) : is_urgent ? (
         <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            className="w-full bg-[#F4511E] hover:bg-[#D84315] text-white font-black py-3.5 rounded-2xl text-[14px] transition-colors shadow-sm btn-tap"
         >
           Apply Now
         </button>
       ) : (
         <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            className="w-full bg-transparent border-2 border-white/10 hover:border-white/20 hover:bg-white/5 text-white/80 font-black py-3 rounded-2xl text-[14px] transition-colors btn-tap"
         >
           View Details
         </button>
       )}
    </div>
  );
}
