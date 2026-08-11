import { useLoaderData, useParams, useNavigate, useLocation, Link } from 'react-router';
import { useState, useEffect } from 'react';
import { supabase } from '~/lib/supabase.client';
import { useAuth } from '~/context/AuthContext';
import { MapPin, Clock, Calendar, Info, CheckCircle2, AlertCircle, ShieldCheck, ChevronRight, Users, IndianRupee, Briefcase, GraduationCap, Link2, Hourglass } from 'lucide-react';
import { formatRelativeDate } from '~/lib/utils';
import { createSupabaseServerClient } from '~/lib/supabase.server';
import { getMapsLoader } from "~/lib/maps";
import GigThread from "~/components/GigThread";
import { gigCoverUrl } from "~/lib/cover";
import InternshipApplyModal from "~/components/InternshipApplyModal";
import ReportModal from "~/components/ReportModal";

const GIG_FIELDS = `
  id, title, description, role_type, pay_rate, duration_hrs, event_date,
  location_text, lat, lng, is_urgent, slots_total, slots_filled, status,
  created_at, organizer_id, gig_type, work_mode, commitment, duration_months,
  stipend_min, stipend_max, is_unpaid, jd_url, preferences,
  application_deadline, custom_role,
  profiles!gigs_organizer_id_fkey ( full_name, company_name, avg_rating, is_verified )
`;
const COVER_FIELDS = "cover_mode, cover_image_url,";

export async function loader({ params, request }) {
  const supabaseServer = createSupabaseServerClient(request);

  const fetchGig = (withCover: boolean) =>
    supabaseServer
      .from("gigs")
      .select(withCover ? COVER_FIELDS + GIG_FIELDS : GIG_FIELDS)
      .eq("id", params.id)
      .single();

  let { data: gigRow, error } = await fetchGig(true);

  // The cover columns arrive with migration 011. Until it's applied, asking
  // for them fails the whole query — and a listing 404ing is far worse than
  // one rendering with its default cover. Retry without them.
  if (error && /cover_mode|cover_image_url/.test(error.message ?? "")) {
    ({ data: gigRow, error } = await fetchGig(false));
  }

  if (error || !gigRow) {
    throw new Response("Gig not found", { status: 404 });
  }
  const gig = gigRow as any;

  // Count of completed gigs by this organizer
  const { count: gigsHosted } = await supabaseServer
    .from('gigs')
    .select('id', { count: 'exact', head: true })
    .eq('organizer_id', gig.organizer_id)
    .eq('status', 'completed');

  // Count of gig_payments where final_paid = true vs total
  const { count: totalPayments } = await supabaseServer
    .from('gig_payments')
    .select('id', { count: 'exact', head: true })
    .eq('organizer_id', gig.organizer_id);

  const { count: paidPayments } = await supabaseServer
    .from('gig_payments')
    .select('id', { count: 'exact', head: true })
    .eq('organizer_id', gig.organizer_id)
    .eq('final_paid', true);

  const paymentRate = totalPayments && totalPayments > 0 
    ? Math.round(((paidPayments || 0) / totalPayments) * 100) 
    : null;

  return { gig, gigsHosted: gigsHosted || 0, paymentRate };
}

// ── Internship display helpers ──────────────────────────────────────
export function stipendText(gig: any) {
  if (gig.is_unpaid) return "Unpaid";
  if (gig.stipend_min == null) return "Not disclosed";
  if (gig.stipend_max && gig.stipend_max > gig.stipend_min) {
    return `₹${gig.stipend_min.toLocaleString("en-IN")} – ₹${gig.stipend_max.toLocaleString("en-IN")}/mo`;
  }
  return `₹${gig.stipend_min.toLocaleString("en-IN")}/mo`;
}
const WORK_MODE_LABEL: Record<string, string> = { onsite: "On-site", hybrid: "Hybrid", remote: "Remote" };
const COMMITMENT_LABEL: Record<string, string> = { full_time: "Full-time", part_time: "Part-time" };

// React Router v8 passes `loaderData`; the v7 name was `data`. Reading the
// old name silently yields undefined, which sent every gig to the
// "not found" title even though the page rendered fine.
export const meta = ({ loaderData: data }: { loaderData: any }) => {
  if (!data?.gig) {
    return [{ title: "Gig Not Found — GigDekho" }];
  }
  const { gig } = data;
  if (gig.gig_type === "internship") {
    const title = `${gig.title} · ${WORK_MODE_LABEL[gig.work_mode] ?? ""} · ${stipendText(gig)} — GigDekho`;
    const description = gig.description?.slice(0, 155)
      ?? `${gig.title} in ${gig.location_text}. ${stipendText(gig)}, ${gig.duration_months} month commitment.`;
    return [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `https://gigdekho.com/gigs/${gig.id}` },
      { name: "robots", content: gig.status === "open" ? "index, follow" : "noindex, nofollow" },
    ];
  }
  const totalPay = gig.pay_rate * gig.duration_hrs;
  const displayRole = gig.role_type;
  const slotsLeft = gig.slots_total - gig.slots_filled;
  const title = `${gig.title} · ${gig.location_text} · ₹${totalPay} — GigDekho`;
  const description =
    gig.description?.slice(0, 155) ??
    `${displayRole} in ${gig.location_text}. Earn ₹${totalPay} for ${gig.duration_hrs}hrs. ${slotsLeft} slot${slotsLeft !== 1 ? "s" : ""} left.`;

  return [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { property: "og:url", content: `https://gigdekho.com/gigs/${gig.id}` },
    {
      name: "robots",
      content: gig.status === "open" ? "index, follow" : "noindex, nofollow",
    },
  ];
};

export default function GigDetailScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  
  const { gig: ssrGig, gigsHosted, paymentRate } = useLoaderData();

  const [gig, setGig] = useState(ssrGig);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applicationStatus, setApplicationStatus] = useState<string | null>(null);
  const [waitlistPosition, setWaitlistPosition] = useState<number | null>(null);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [isErrorToast, setIsErrorToast] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [internApplication, setInternApplication] = useState<any>(null);
  const { profile } = useAuth();

  useEffect(() => {
    if (id) {
      fetchData();
    }
  }, [id, user]);

  useEffect(() => {
    if (!gig?.lat || !gig?.lng || gig?.location_text === "Remote") return;
    
    const darkMapStyles = [
      { elementType: "geometry", stylers: [{ color: "#1C1C1C" }] },
      { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
      { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
      { featureType: "road", elementType: "geometry", stylers: [{ color: "#2c2c2c" }] },
      { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212a37" }] },
      { featureType: "water", elementType: "geometry", stylers: [{ color: "#111111" }] },
    ];

    getMapsLoader().load().then((google) => {
      const map = new google.maps.Map(
        document.getElementById("gig-map") as HTMLElement,
        {
          center: { lat: gig.lat!, lng: gig.lng! },
          zoom: 15,
          styles: darkMapStyles,
          disableDefaultUI: true,
          zoomControl: true,
        }
      );
      new google.maps.Marker({
        position: { lat: gig.lat!, lng: gig.lng! },
        map,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: "#F4511E",
          fillOpacity: 1,
          strokeWeight: 0,
          scale: 10,
        },
      });
    }).catch(err => {
      console.error("Error loading map on detail page", err);
    });
  }, [gig?.lat, gig?.lng, gig?.location_text]);

  const fetchData = async () => {
    try {
      // 1. Fetch gig details
      const { data: gigData, error: gigError } = await supabase
        .from('gigs')
        .select('*')
        .eq('id', id)
        .single();
        
      if (gigError) throw gigError;
      // Merge over the SSR gig so the joined `profiles` (hirer info) isn't lost
      setGig((prev: any) => ({ ...prev, ...gigData }));

      // 2. Check application status
      if (user && gigData?.gig_type === 'internship') {
        const { data: internApp } = await supabase
          .from('internship_applications')
          .select('id, status, created_at')
          .eq('gig_id', id)
          .eq('applicant_id', user.id)
          .maybeSingle();
        setInternApplication(internApp ?? null);
        return;
      }
      if (user) {
        const { data: appData, error: appError } = await supabase
          .from('applications')
          .select('id, status, waitlist_position')
          .eq('gig_id', id)
          .eq('worker_id', user.id)
          .maybeSingle();

        if (appError && appError.code !== 'PGRST116') throw appError;
        if (appData) {
          setApplicationStatus(appData.status);
          setWaitlistPosition(appData.waitlist_position ?? null);
          setApplicationId(appData.id);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const showToast = (msg, isError = false) => {
    setToastMessage(msg);
    setIsErrorToast(isError);
    setTimeout(() => {
      setToastMessage('');
      setIsErrorToast(false);
    }, 3000);
  };

  const handleApplyClick = () => {
    if (!user) {
      localStorage.setItem('redirectAfterLogin', location.pathname);
      localStorage.setItem('userIntent', 'worker');
      navigate('/auth?mode=worker');
      return;
    }
    setShowTerms(true);
  };

  const handleApply = async () => {
    setShowTerms(false);
    setApplying(true);
    try {
      const form = new FormData();
      form.append("gig_id", id!);
      const res = await fetch("/api/apply", { method: "POST", body: form });
      const result = await res.json();

      if (!res.ok || result.error) {
        if (result.error === "already_applied") {
          showToast("You've already applied to this gig.", true);
          await fetchData();
          return;
        }
        if (result.error === "account_suspended") {
          showToast("Your account is suspended. Contact support for help.", true);
          return;
        }
        throw new Error(result.error || "Failed to apply");
      }

      if (result.status === "accepted") {
        setApplicationStatus("accepted");
        setGig((prev: any) => ({ ...prev, slots_filled: (prev.slots_filled || 0) + 1 }));
        // Refresh to get application ID
        await fetchData();
        showToast("You're confirmed! Check your email for details. 🎉");
      } else if (result.status === "waitlisted") {
        // Stored as 'pending' with waitlist_position in DB (trigger convention)
        setApplicationStatus("pending");
        setWaitlistPosition(result.waitlist_position);
        await fetchData();
        showToast(`You're #${result.waitlist_position} on the waitlist! We'll notify you if a spot opens.`);
      }
    } catch (err) {
      console.error("Failed to apply:", err);
      showToast("Something went wrong. Try again.", true);
    } finally {
      setApplying(false);
    }
  };

  const handleCancelApplication = async () => {
    if (!applicationId) return;
    setCancelling(true);
    try {
      const form = new FormData();
      form.append("app_id", applicationId);
      const res = await fetch("/api/cancel", { method: "POST", body: form });
      const result = await res.json();
      if (!res.ok) {
        showToast(result.error || "Could not cancel. Try again.", true);
        return;
      }
      setApplicationStatus("cancelled");
      setShowCancelConfirm(false);
      setGig((prev: any) => ({ ...prev, slots_filled: Math.max(0, (prev.slots_filled || 1) - 1) }));
      showToast("Spot cancelled. Check your email for confirmation.");
    } catch {
      showToast("Network error. Try again.", true);
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
     return <div className="min-h-screen flex items-center justify-center bg-[#111111]"><div className="w-8 h-8 border-4 border-white/10 border-t-[#F4511E] rounded-full animate-spin"></div></div>;
  }

  if (!gig) {
     return <div className="p-6 text-center text-white/50 font-bold bg-[#111111] min-h-screen pt-32">Gig not found.</div>;
  }

  const payTotal = gig.pay_rate * gig.duration_hrs;
  const imageUrl = gigCoverUrl(gig, 1200);
  const isInternship = gig.gig_type === 'internship';
  const deadlinePassed = gig.application_deadline && new Date(gig.application_deadline) < new Date();

  const handleInternshipApplyClick = () => {
    if (!user) {
      localStorage.setItem('redirectAfterLogin', location.pathname);
      localStorage.setItem('userIntent', 'worker');
      navigate('/auth?mode=worker');
      return;
    }
    setShowApplyModal(true);
  };

  return (
    <main id="main-content" className="bg-[#111111] min-h-screen pb-24 font-sans relative pt-16">
      
      {/* Cancel Confirmation Modal */}
      {showCancelConfirm && gig && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-end sm:items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#1C1C1C] border border-white/10 w-full max-w-sm rounded-3xl p-6 shadow-2xl">
            <h3 className="font-black text-white text-lg mb-3">Cancel your spot?</h3>
            {(() => {
              const hoursUntil = (new Date(gig.event_date).getTime() - Date.now()) / 3600000;
              const penalty = hoursUntil < 6 ? 15 : hoursUntil < 24 ? 5 : 0;
              return penalty > 0 ? (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-4 text-sm text-red-400 font-medium">
                  Cancelling now will reduce your reliability score by {penalty} points.
                </div>
              ) : (
                <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 mb-4 text-sm text-green-400 font-medium">
                  No penalty — you're cancelling with enough notice.
                </div>
              );
            })()}
            <p className="text-white/50 text-sm font-medium mb-5">Your spot will be given to the next person on the waitlist.</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowCancelConfirm(false)} className="flex-1 py-3 rounded-xl border border-white/20 text-white font-bold text-sm btn-tap">
                Keep my spot
              </button>
              <button type="button" onClick={handleCancelApplication} disabled={cancelling} className="flex-1 py-3 rounded-xl bg-red-500 text-white font-bold text-sm disabled:opacity-50 btn-tap">
                {cancelling ? "Cancelling..." : "Yes, cancel"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ReportModal
        isOpen={showReport}
        onClose={() => setShowReport(false)}
        targetType="gig"
        targetId={gig.id}
        targetLabel={gig.title}
      />

      {/* Internship application */}
      <InternshipApplyModal
        isOpen={showApplyModal}
        onClose={() => setShowApplyModal(false)}
        onSubmitted={async () => { showToast("Application submitted! The hirer has been notified. 🎉"); await fetchData(); }}
        gigId={gig.id}
        gigTitle={gig.title}
        user={user}
        profile={profile}
      />

      {/* Terms and Conditions Modal */}
      {showTerms && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 animate-in fade-in">
           <div className="bg-[#1C1C1C] border border-white/10 w-full max-w-md rounded-3xl p-6 shadow-2xl relative">
              <h2 className="text-xl font-black text-white mb-4">Terms & Conditions</h2>
              <div className="text-white/60 text-sm font-medium space-y-4 mb-6 max-h-[40vh] overflow-y-auto hide-scrollbar">
                 <p>1. By applying, you commit to arriving at the gig location on time.</p>
                 <p>2. Failure to show up without 24 hours prior notice will negatively impact your profile rating and may result in account suspension.</p>
                 <p>3. You agree to perform the duties required by the organizer professionally.</p>
                 <p>4. Payments are credited to your wallet within around 24 hours of the organizer marking the gig as completed.</p>
              </div>
              <div className="flex space-x-3">
                 <button type="button" onClick={() => setShowTerms(false)} className="flex-1 py-3.5 rounded-full font-bold text-white/70 bg-white/10 hover:bg-white/20 transition-colors btn-tap">
                    Cancel
                 </button>
                 <button type="button" onClick={handleApply} className="flex-1 py-3.5 rounded-full font-bold text-white bg-[#F4511E] hover:bg-[#D84315] shadow-lg transition-colors btn-tap">
                    I Agree & Apply
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed top-24 left-1/2 -translate-x-1/2 z-50 text-white font-bold py-3 px-5 pt-3.5 pb-3 rounded-full shadow-lg flex items-center text-[13px] animate-bounce ${isErrorToast ? 'bg-red-500 shadow-red-500/30' : 'bg-green-500 shadow-green-500/30'}`}>
           {isErrorToast ? <AlertCircle size={18} className="mr-2" /> : <CheckCircle2 size={18} className="mr-2" />}
           {toastMessage}
        </div>
      )}

      <div className="bg-[#111111] z-40 py-4 px-4 lg:px-8 xl:px-12 w-full mx-auto flex items-center">
         {/* These were plain text — they looked like a trail out of the page
             but nothing happened when you clicked them. */}
         <nav aria-label="Breadcrumb" className="text-[11px] font-bold text-white/40 tracking-widest uppercase flex items-center flex-wrap">
           <Link prefetch="intent" to="/" className="hover:text-white transition-colors">Home</Link>
           <ChevronRight size={14} className="inline opacity-50 mx-1" />
           <Link prefetch="intent" to="/worker/home" className="hover:text-white transition-colors">
             {gig.gig_type === "internship" ? "Internships" : "Available Jobs"}
           </Link>
           <ChevronRight size={14} className="inline opacity-50 mx-1" />
           <span className="text-white/80" aria-current="page">
             {gig.custom_role ?? gig.role_type ?? gig.title}
           </span>
         </nav>
      </div>

      <div className="px-4 lg:px-8 xl:px-12 pb-8 w-full mx-auto">
        
        {/* Full width hero image — omitted entirely when the hirer opted out */}
        {imageUrl && (
          <div className="w-full h-[240px] lg:h-[320px] rounded-3xl overflow-hidden mb-8 lg:mb-10 shadow-sm relative">
             <img src={imageUrl} className="w-full h-full object-cover" alt="" />
             <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent"></div>
          </div>
        )}

        <div className="lg:grid lg:grid-cols-[60%_40%] lg:gap-12 items-start">
           
           <div className="w-full">
              {/* Title Block */}
              <div className="mb-8">
                 {gig.is_urgent && (
                   <div className="bg-cyan-500/10 text-[#00BCD4] inline-block px-3.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-4 border border-cyan-500/20">
                     URGENT REQUIREMENT
                   </div>
                 )}
                 <h1 className="text-3xl lg:text-5xl font-black text-white tracking-tight leading-[1.05] mb-5">{gig.title}</h1>
                 
                 {(() => {
                    const profile = Array.isArray(gig.profiles) ? gig.profiles[0] : gig.profiles;
                    const profileName = profile ? (profile.company_name ?? profile.full_name) : "Hirer";
                    const initials = profileName.charAt(0).toUpperCase();
                    const ratingVal = profile?.avg_rating;
                    const ratingText = (!ratingVal || ratingVal === 0) ? "New Hirer" : `${Number(ratingVal).toFixed(1)} Rating`;
                    const isVerified = profile?.is_verified === true;
                    return (
                      <div className="flex items-center space-x-3 mb-6 bg-[#1C1C1C] p-3.5 rounded-2xl border border-white/5 shadow-sm self-start max-w-max">
                        <div className="w-10 h-10 bg-white/10 text-white rounded-full flex items-center justify-center font-bold shadow-inner uppercase">
                          {initials}
                        </div>
                        <div className="flex flex-col pr-4">
                          <span className="font-bold text-white text-[13px] flex items-center">
                            {profileName} {isVerified && <ShieldCheck size={14} className="text-[#F4511E] ml-1" />}
                          </span>
                          <span className="text-[11px] font-semibold text-white/50">
                            {isVerified ? "Verified Hirer" : "Hirer"} · {ratingText}
                          </span>
                        </div>
                      </div>
                    );
                  })()}
              </div>

              {/* Info Cards — internship vs event */}
              {isInternship ? (
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4 mb-10">
                   <div className="bg-[#1C1C1C] rounded-2xl p-4 shadow-sm border border-white/5 flex flex-col items-start justify-center">
                      <IndianRupee size={18} className="text-[#F4511E] mb-2 bg-[#F4511E]/10 p-1.5 rounded-lg box-content" />
                      <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest leading-none mb-1">Stipend</p>
                      <p className="font-bold text-white text-sm leading-tight">{stipendText(gig)}</p>
                   </div>
                   <div className="bg-[#1C1C1C] rounded-2xl p-4 shadow-sm border border-white/5 flex flex-col items-start justify-center">
                      <Hourglass size={18} className="text-[#00BCD4] mb-2 bg-[#00BCD4]/10 p-1.5 rounded-lg box-content" />
                      <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest leading-none mb-1">Duration</p>
                      <p className="font-bold text-white text-sm leading-tight">{gig.duration_months} month{gig.duration_months !== 1 ? 's' : ''}</p>
                   </div>
                   <div className="bg-[#1C1C1C] rounded-2xl p-4 shadow-sm border border-white/5 flex flex-col items-start justify-center">
                      <Briefcase size={18} className="text-purple-400 mb-2 bg-purple-500/10 p-1.5 rounded-lg box-content" />
                      <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest leading-none mb-1">Type</p>
                      <p className="font-bold text-white text-sm leading-tight">{COMMITMENT_LABEL[gig.commitment] ?? '—'}</p>
                   </div>
                   <div className="bg-[#1C1C1C] rounded-2xl p-4 shadow-sm border border-white/5 flex flex-col items-start justify-center">
                      <MapPin size={18} className="text-[#F4511E] mb-2 bg-[#F4511E]/10 p-1.5 rounded-lg box-content" />
                      <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest leading-none mb-1">{WORK_MODE_LABEL[gig.work_mode] ?? 'Location'}</p>
                      <p className="font-bold text-white text-sm leading-tight truncate max-w-full" title={gig.location_text}>{gig.location_text.split(',')[0]}</p>
                   </div>
                   <div className="bg-[#1C1C1C] rounded-2xl p-4 shadow-sm border border-white/5 flex flex-col items-start justify-center">
                      <Calendar size={18} className="text-white/40 mb-2 bg-white/5 p-1.5 rounded-lg box-content" />
                      <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest leading-none mb-1">Starts</p>
                      <p className="font-bold text-white text-sm leading-tight">{new Date(gig.event_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                   </div>
                   <div className="bg-[#1C1C1C] rounded-2xl p-4 shadow-sm border border-white/5 flex flex-col items-start justify-center">
                      <Users size={18} className="text-blue-400 mb-2 bg-blue-500/10 p-1.5 rounded-lg box-content" />
                      <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest leading-none mb-1">Openings</p>
                      <p className="font-bold text-white text-sm leading-tight">{gig.slots_total}</p>
                   </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-10">
                   <div className="bg-[#1C1C1C] rounded-2xl p-4 shadow-sm border border-white/5 flex flex-col items-start justify-center">
                      <Calendar size={18} className="text-white/40 mb-2 bg-white/5 p-1.5 rounded-lg box-content" />
                      <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest leading-none mb-1">Date</p>
                      <p className="font-bold text-white text-sm leading-tight">{formatRelativeDate(gig.event_date)}</p>
                   </div>
                   <div className="bg-[#1C1C1C] rounded-2xl p-4 shadow-sm border border-white/5 flex flex-col items-start justify-center">
                      <Clock size={18} className="text-[#00BCD4] mb-2 bg-[#00BCD4]/10 p-1.5 rounded-lg box-content" />
                      <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest leading-none mb-1">Duration</p>
                      <p className="font-bold text-white text-sm leading-tight">{gig.duration_hrs} Hours</p>
                   </div>
                   <div className="bg-[#1C1C1C] rounded-2xl p-4 shadow-sm border border-white/5 flex flex-col items-start justify-center">
                      <MapPin size={18} className="text-[#F4511E] mb-2 bg-[#F4511E]/10 p-1.5 rounded-lg box-content" />
                      <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest leading-none mb-1">Location</p>
                      <p className="font-bold text-white text-sm leading-tight truncate max-w-full" title={gig.location_text}>{gig.location_text.split(',')[0]}</p>
                   </div>
                   <div className="bg-[#1C1C1C] rounded-2xl p-4 shadow-sm border border-white/5 flex flex-col items-start justify-center">
                      <Users size={18} className="text-blue-400 mb-2 bg-blue-500/10 p-1.5 rounded-lg box-content" />
                      <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest leading-none mb-1">Spots</p>
                      <p className="font-bold text-white text-sm leading-tight">{Math.max(0, gig.slots_total - (gig.slots_filled || 0))} Remaining</p>
                   </div>
                </div>
              )}

              {/* Description */}
              <div className="mb-10">
                <h3 className="font-black text-white text-lg mb-4">{isInternship ? 'About the role' : 'Gig Description'}</h3>
                <div className="text-white/60 font-medium leading-relaxed space-y-4">
                  {gig.description ? (
                    <p className="whitespace-pre-wrap">{gig.description}</p>
                  ) : (
                    <p className="italic opacity-60">
                      {isInternship ? 'Full details are in the linked job description below.' : "This organizer hasn't added a description yet."}
                    </p>
                  )}
                </div>
                {isInternship && gig.jd_url && (
                  <a href={gig.jd_url} target="_blank" rel="noopener noreferrer"
                     className="mt-4 inline-flex items-center gap-2 bg-[#1C1C1C] border border-white/10 hover:border-[#F4511E]/40 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-colors btn-tap">
                    <Link2 size={14} className="text-[#F4511E]" /> Read the full job description
                  </a>
                )}
              </div>

              {/* Who they're looking for */}
              {isInternship && gig.preferences && (
                <div className="mb-10">
                  <h3 className="font-black text-white text-lg mb-4 flex items-center gap-2">
                    <GraduationCap size={18} className="text-[#F4511E]" /> Who they're looking for
                  </h3>
                  <p className="text-white/60 font-medium leading-relaxed whitespace-pre-wrap">{gig.preferences}</p>
                </div>
              )}

              {/* Announcements + Q&A (participants only — RLS enforced) */}
              <GigThread
                gigId={gig.id}
                eventDate={gig.event_date}
                isOrganizer={!!user && user.id === gig.organizer_id}
                hasApplied={applicationStatus !== null && applicationStatus !== 'cancelled'}
                userId={user?.id ?? null}
              />

              {/* Location Details */}
              <div className="mb-10">
                  <h3 className="font-black text-white text-lg mb-4">Location Details</h3>
                  {gig?.location_text === "Remote" ? (
                    <div className="bg-[#1C1C1C] border border-white/5 p-4 rounded-2xl flex items-center gap-3">
                      <span className="text-2xl">🏠</span>
                      <div>
                        <p className="font-bold text-white">Remote / Work from Home</p>
                        <p className="text-sm text-white/50 font-medium">No physical location required</p>
                      </div>
                    </div>
                  ) : gig?.lat && gig?.lng ? (
                    <div id="gig-map" style={{ height: "200px", borderRadius: "12px" }} />
                  ) : (
                    <div className="bg-[#1C1C1C] border border-white/5 p-4 rounded-2xl flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-[#F4511E]/10 flex items-center justify-center shrink-0 mt-0.5">
                        <MapPin size={18} className="text-[#F4511E]" />
                      </div>
                      <div>
                        <p className="font-black text-white text-sm leading-snug">{gig.location_text}</p>
                        <p className="text-[11px] text-white/40 font-medium mt-1">Indore, Madhya Pradesh</p>
                      </div>
                    </div>
                  )}
              </div>

           </div>

           {/* Right Column Action Panel */}
           <div className="relative mt-8 lg:mt-0">
             <div className="lg:sticky lg:top-24">
                
                <div className="bg-[#1C1C1C] rounded-[24px] shadow-xl border border-white/10 overflow-hidden relative">
                   <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#F4511E]"></div>
                   
                   <div className="p-6 lg:p-8">
                     {isInternship ? (
                       <>
                         <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">Monthly Stipend</p>
                         <h2 className="text-[34px] font-black text-[#F4511E] tracking-tight mb-6 leading-none">{stipendText(gig)}</h2>

                         <div className="space-y-3 mb-6 pb-5 border-b border-white/5">
                           <div className="flex justify-between items-center">
                             <span className="text-[13px] font-bold text-white/50">Commitment</span>
                             <span className="text-[13px] font-bold text-white">{COMMITMENT_LABEL[gig.commitment] ?? '—'} · {WORK_MODE_LABEL[gig.work_mode] ?? '—'}</span>
                           </div>
                           <div className="flex justify-between items-center">
                             <span className="text-[13px] font-bold text-white/50">Minimum duration</span>
                             <span className="text-[13px] font-bold text-white">{gig.duration_months} month{gig.duration_months !== 1 ? 's' : ''}</span>
                           </div>
                           {gig.application_deadline && (
                             <div className="flex justify-between items-center">
                               <span className="text-[13px] font-bold text-white/50">Apply by</span>
                               <span className={`text-[13px] font-black ${deadlinePassed ? 'text-red-400' : 'text-[#F4511E]'}`}>
                                 {new Date(gig.application_deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                               </span>
                             </div>
                           )}
                         </div>

                         {internApplication ? (
                           <div className="space-y-3">
                             <div className="w-full min-h-14 py-3 rounded-2xl font-black text-[13px] flex flex-col justify-center items-center bg-green-500/10 text-green-400 border border-green-500/20 uppercase tracking-wide">
                               <span className="flex items-center"><CheckCircle2 size={16} className="mr-2" /> Application {internApplication.status}</span>
                               <span className="text-[10px] font-bold text-white/40 normal-case tracking-normal mt-1">
                                 Submitted {new Date(internApplication.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                               </span>
                             </div>
                             <p className="text-[11px] font-medium text-white/40 text-center leading-relaxed">
                               The hirer reviews applications directly. You'll get a notification when your status changes.
                             </p>
                           </div>
                         ) : deadlinePassed || gig.status !== 'open' ? (
                           <button type="button" disabled className="w-full h-14 rounded-full font-black text-[15px] flex justify-center items-center bg-white/5 text-white/40 border border-white/10 cursor-not-allowed uppercase tracking-wide">
                             Applications Closed
                           </button>
                         ) : (
                           <button
                             type="button"
                             onClick={handleInternshipApplyClick}
                             className="w-full h-14 rounded-full font-black text-[15px] flex justify-center items-center text-white bg-[#F4511E] hover:bg-[#D84315] transition-all shadow-lg btn-tap uppercase tracking-wide"
                           >
                             Apply Now
                           </button>
                         )}

                         <div className="mt-8 space-y-3.5 pt-6 border-t border-white/5 -mx-2 px-2">
                            <div className="flex items-center text-[11px] font-bold text-white/60 uppercase tracking-wide">
                              <CheckCircle2 size={16} className="text-[#F4511E] mr-2.5 shrink-0" /> Takes about 3 minutes
                            </div>
                            <div className="flex items-center text-[11px] font-bold text-white/60 uppercase tracking-wide">
                              <CheckCircle2 size={16} className="text-[#F4511E] mr-2.5 shrink-0" /> Your details are prefilled
                            </div>
                            <div className="flex items-center text-[11px] font-bold text-white/60 uppercase tracking-wide">
                              <ShieldCheck size={16} className="text-[#F4511E] mr-2.5 shrink-0" /> Shared only with this hirer
                            </div>
                         </div>
                       </>
                     ) : (
                     <>
                     <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">Total Project Payout</p>
                     <h2 className="text-[44px] font-black text-[#F4511E] tracking-tight mb-8 leading-none">₹{payTotal}</h2>

                     <div className="space-y-4 mb-6">
                       <div className="flex justify-between items-center pb-2">
                         <span className="text-[13px] font-bold text-white/50">Hourly Rate ({gig.duration_hrs}hrs)</span>
                         <span className="text-[15px] font-bold text-white">₹{gig.pay_rate}/hr</span>
                       </div>
                     </div>

                     {applicationStatus === 'accepted' ? (
                        <div className="space-y-3">
                          <div className="w-full h-14 rounded-full font-black text-[15px] flex justify-center items-center bg-green-500/10 text-green-400 border border-green-500/20 uppercase tracking-wide">
                            <CheckCircle2 size={18} className="mr-2" /> Confirmed
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowCancelConfirm(true)}
                            className="w-full py-3 rounded-xl border border-red-500/30 text-red-400 text-sm font-bold hover:border-red-500 hover:bg-red-500/10 transition-all btn-tap"
                          >
                            Cancel my spot
                          </button>
                        </div>
                     ) : applicationStatus === 'pending' && waitlistPosition ? (
                        // 'pending' + waitlist_position = on waitlist (trigger convention)
                        <button type="button" disabled className="w-full h-14 rounded-full font-black text-[15px] flex justify-center items-center bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 cursor-not-allowed uppercase tracking-wide">
                           <Info size={18} className="mr-2" /> Waitlisted #{waitlistPosition}
                        </button>
                     ) : applicationStatus === 'pending' ? (
                        <button type="button" disabled className="w-full h-14 rounded-full font-black text-[15px] flex justify-center items-center bg-white/5 text-white/40 border border-white/10 cursor-not-allowed uppercase tracking-wide">
                           <Info size={18} className="mr-2" /> Pending
                        </button>
                     ) : applicationStatus === 'completed' ? (
                        <button type="button" disabled className="w-full h-14 rounded-full font-black text-[15px] bg-green-500/10 text-green-400 border border-green-500/20 uppercase tracking-wide">
                           Completed
                        </button>
                     ) : (
                        <button
                          type="button"
                          onClick={handleApplyClick}
                          disabled={applying || (gig.slots_total - (gig.slots_filled||0) <= 0 && gig.slots_total > 0)}
                          className="w-full h-14 rounded-full font-black text-[15px] flex justify-center items-center text-white bg-[#F4511E] hover:bg-[#D84315] transition-all shadow-lg btn-tap disabled:opacity-50 disabled:shadow-none uppercase tracking-wide"
                        >
                           {applying ? 'Applying...' : gig.slots_total - (gig.slots_filled||0) <= 0 ? 'Join Waitlist' : 'Apply Now'}
                        </button>
                     )}
                     
                     <div className="mt-8 space-y-3.5 pt-6 border-t border-white/5 -mx-2 px-2">
                        <div className="flex items-center text-[11px] font-bold text-white/60 uppercase tracking-wide">
                          <CheckCircle2 size={16} className="text-[#F4511E] mr-2.5" /> Instant confirmation
                        </div>
                        <div className="flex items-center text-[11px] font-bold text-white/60 uppercase tracking-wide">
                          <CheckCircle2 size={16} className="text-[#F4511E] mr-2.5" /> EARNINGS TO YOUR WALLET
                        </div>
                        <div className="flex items-center text-[11px] font-bold text-white/60 uppercase tracking-wide">
                          <ShieldCheck size={16} className="text-[#F4511E] mr-2.5" /> Verified Gig Guarantee
                        </div>
                      </div>
                     </>
                     )}
                    </div>
                 </div>

                 {/* Hirer Reputation */}
                 <div className="mt-5 bg-[#1C1C1C] border border-white/5 rounded-2xl p-5">
                    <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-3">Hirer Reputation</p>
                    <div className={`grid ${paymentRate !== null ? 'grid-cols-2' : 'grid-cols-1'} gap-4 mb-4`}>
                       <div>
                         <p className="text-xl font-black text-white mb-0.5">
                           {gigsHosted === 0 ? "New Hirer" : gigsHosted}
                         </p>
                         <p className="text-[9px] font-bold text-white/50 tracking-wider uppercase">
                           {gigsHosted === 0 ? "Just started" : "Gigs Hosted"}
                         </p>
                       </div>
                       {paymentRate !== null && (
                         <div>
                           <p className="text-xl font-black text-white mb-0.5">{paymentRate}%</p>
                           <p className="text-[9px] font-bold text-white/50 tracking-wider uppercase">Payment Rate</p>
                         </div>
                       )}
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate(`/hirer/${gig.organizer_id}`)}
                      className="text-[#F4511E] text-[11px] font-bold hover:underline flex items-center transition-all btn-tap min-h-[44px]"
                    >
                      View Hirer Profile <ChevronRight size={14} className="ml-1" />
                    </button>
                 </div>

                 {/* Report */}
                 {user && user.id !== gig.organizer_id && (
                   <button
                     type="button"
                     onClick={() => setShowReport(true)}
                     className="mt-3 w-full text-[10px] font-bold text-white/30 hover:text-red-400 transition-colors btn-tap py-2"
                   >
                     Report this listing
                   </button>
                 )}

             </div>
           </div>

        </div>
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "JobPosting",
            "title": ssrGig.title,
            "description": ssrGig.description ?? "",
            "datePosted": ssrGig.created_at,
            "validThrough": ssrGig.event_date,
            "employmentType": ssrGig.gig_type === "internship"
              ? (ssrGig.commitment === "full_time" ? "FULL_TIME" : "PART_TIME")
              : "TEMPORARY",
            "hiringOrganization": {
              "@type": "Organization",
              "name": "GigDekho",
              "sameAs": "https://gigdekho.com",
            },
            "jobLocation": {
              "@type": "Place",
              "address": {
                "@type": "PostalAddress",
                "addressLocality": ssrGig.location_text,
                "addressRegion": "Madhya Pradesh",
                "addressCountry": "IN",
              },
            },
            "baseSalary": {
              "@type": "MonetaryAmount",
              "currency": "INR",
              "value": {
                "@type": "QuantitativeValue",
                "value": ssrGig.gig_type === "internship" ? (ssrGig.stipend_min ?? 0) : ssrGig.pay_rate,
                "unitText": ssrGig.gig_type === "internship" ? "MONTH" : "HOUR",
              },
            },
            "totalJobOpenings": ssrGig.slots_total - ssrGig.slots_filled,
            "directApply": true,
          }),
        }}
      />
    </main>
  );
}
