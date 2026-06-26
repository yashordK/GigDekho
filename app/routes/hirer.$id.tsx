import { useLoaderData, useNavigate } from "react-router";
import { createSupabaseServerClient } from "~/lib/supabase.server";
import { Star, MapPin, ShieldCheck, ExternalLink, Calendar, Users, Award, IndianRupee, MessageSquare, ArrowLeft } from "lucide-react";
import GigCard from "~/components/GigCard";

export async function loader({ params, request }: { params: { id: string }; request: Request }) {
  const supabaseServer = createSupabaseServerClient(request);

  // 1. Fetch Profile
  const { data: profile, error: profileErr } = await supabaseServer
    .from("profiles")
    .select("id, full_name, company_name, avatar_url, bio, city, avg_rating, is_verified, created_at, website")
    .eq("id", params.id)
    .single();

  if (profileErr || !profile) {
    throw new Response("Profile not found", { status: 404 });
  }

  // 2. Fetch Gigs Stats
  const { count: gigsCompleted } = await supabaseServer
    .from("gigs")
    .select("id", { count: "exact", head: true })
    .eq("organizer_id", params.id)
    .eq("status", "completed");

  const { count: gigsTotal } = await supabaseServer
    .from("gigs")
    .select("id", { count: "exact", head: true })
    .eq("organizer_id", params.id)
    .not("status", "eq", "cancelled");

  // 3. Fetch Payments Stats for Reliability
  const { count: totalPayments } = await supabaseServer
    .from("gig_payments")
    .select("id", { count: "exact", head: true })
    .eq("organizer_id", params.id);

  const { count: paidPayments } = await supabaseServer
    .from("gig_payments")
    .select("id", { count: "exact", head: true })
    .eq("organizer_id", params.id)
    .eq("final_paid", true);

  const paymentRate = totalPayments && totalPayments > 0 
    ? Math.round(((paidPayments || 0) / totalPayments) * 100) 
    : null;

  // 4. Fetch Active Gigs
  const { data: activeGigs } = await supabaseServer
    .from("gigs")
    .select("id, title, role_type, custom_role, pay_rate, duration_hrs, event_date, location_text, is_urgent, slots_total, slots_filled, status")
    .eq("organizer_id", params.id)
    .eq("status", "open")
    .order("event_date", { ascending: true })
    .limit(6);

  // 5. Fetch reviews/ratings received (where ratee_id = profile_id)
  const { data: reviews } = await supabaseServer
    .from("ratings")
    .select(`
      id, score, comment, created_at, rater_id,
      profiles!ratings_rater_id_fkey(full_name, avatar_url)
    `)
    .eq("ratee_id", params.id)
    .order("created_at", { ascending: false })
    .limit(10);

  // 6. Compute total workers hired
  const { data: gigsData } = await supabaseServer
    .from("gigs")
    .select("slots_filled")
    .eq("organizer_id", params.id);
  const workersHired = (gigsData || []).reduce((sum, g) => sum + (g.slots_filled || 0), 0);

  return {
    profile,
    gigsCompleted: gigsCompleted || 0,
    gigsTotal: gigsTotal || 0,
    paymentRate,
    activeGigs: activeGigs || [],
    reviews: reviews || [],
    workersHired,
  };
}

export const meta = ({ data }: { data: any }) => {
  if (!data?.profile) {
    return [{ title: "Profile Not Found — GigDekho" }];
  }
  const { profile, gigsCompleted } = data;
  const name = profile.company_name ?? profile.full_name;
  return [
    { title: `${name} — Hirer Profile on GigDekho` },
    {
      name: "description",
      content: `View ${name}'s hiring profile on GigDekho. ${gigsCompleted} gigs completed in ${profile.city || "Indore"}.`,
    },
  ];
};

export default function HirerProfileScreen() {
  const { profile, gigsCompleted, paymentRate, activeGigs, reviews, workersHired } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const name = profile.company_name ?? profile.full_name;
  const initials = name.charAt(0).toUpperCase();
  const joinYear = new Date(profile.created_at).getFullYear();

  // Color logic for payment rate
  let paymentColor = "text-white/60";
  if (paymentRate !== null) {
    if (paymentRate >= 90) paymentColor = "text-green-400";
    else if (paymentRate >= 70) paymentColor = "text-orange-400";
    else paymentColor = "text-red-400";
  }

  return (
    <main className="min-h-screen bg-[#111111] text-white/90 font-sans pb-24 pt-20">
      <div className="max-w-6xl mx-auto px-6 lg:px-12 space-y-10">
        
        {/* Back navigation */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-white/40 hover:text-white transition-all btn-tap cursor-pointer text-sm font-bold bg-transparent border-0"
        >
          <ArrowLeft size={16} /> Back
        </button>

        {/* PROFILE HEADER */}
        <section className="bg-[#1C1C1C] border border-white/5 rounded-3xl p-6 lg:p-8 flex flex-col md:flex-row gap-6 items-start md:items-center relative shadow-sm overflow-hidden">
          {/* Background overlay */}
          <div className="absolute right-[-100px] bottom-[-100px] w-64 h-64 bg-[#F4511E]/5 rounded-full blur-3xl pointer-events-none" />

          {/* Avatar / Logo */}
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={name}
              className="w-20 h-20 md:w-28 md:h-28 rounded-full object-cover border border-white/10 shadow-md"
            />
          ) : (
            <div className="w-20 h-20 md:w-28 md:h-28 bg-[#F4511E] text-white text-3xl md:text-5xl font-black rounded-full flex items-center justify-center shadow-md">
              {initials}
            </div>
          )}

          {/* Info */}
          <div className="flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl md:text-4xl font-black tracking-tight">{name}</h1>
              {profile.is_verified && (
                <span className="bg-[#F4511E]/10 border border-[#F4511E]/20 text-[#F4511E] text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full flex items-center gap-1">
                  ✓ Verified Hirer
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs md:text-sm font-bold text-white/50">
              <span className="flex items-center gap-1">📍 {profile.city || "Indore"}</span>
              <span>•</span>
              <span>Joined in {joinYear}</span>
            </div>

            {profile.bio && (
              <p className="text-sm md:text-base font-medium text-white/70 max-w-2xl leading-relaxed">
                {profile.bio}
              </p>
            )}

            {profile.website && (
              <a
                href={profile.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[#F4511E] hover:underline text-xs md:text-sm font-bold"
              >
                <ExternalLink size={14} /> Website
              </a>
            )}
          </div>
        </section>

        {/* TRUST STATS SECTION */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Gigs Completed */}
          <div className="glass-panel p-5 rounded-2xl flex flex-col justify-center">
            <div className="flex items-center gap-2 text-white/40 mb-2">
              <Award size={18} />
              <span className="text-[10px] uppercase font-black tracking-wider">Gigs Completed</span>
            </div>
            <span className="text-xl md:text-2xl font-black tracking-tight">
              {gigsCompleted === 0 ? "New Hirer" : gigsCompleted}
            </span>
            {gigsCompleted === 0 && (
              <span className="text-[10px] text-white/30 font-semibold mt-1">Just getting started</span>
            )}
          </div>

          {/* Average Rating */}
          <div className="glass-panel p-5 rounded-2xl flex flex-col justify-center">
            <div className="flex items-center gap-2 text-white/40 mb-2">
              <Star size={18} />
              <span className="text-[10px] uppercase font-black tracking-wider">Average Rating</span>
            </div>
            <div className="flex items-center gap-1">
              {profile.avg_rating && profile.avg_rating > 0 ? (
                <>
                  <span className="text-xl md:text-2xl font-black tracking-tight">
                    {Number(profile.avg_rating).toFixed(1)}
                  </span>
                  <div className="flex text-amber-400">
                    {Array.from({ length: Math.round(profile.avg_rating) }).map((_, idx) => (
                      <Star key={idx} size={14} className="fill-current shrink-0" />
                    ))}
                  </div>
                </>
              ) : (
                <span className="text-sm md:text-base font-bold text-white/40">No ratings yet</span>
              )}
            </div>
          </div>

          {/* Payment Rate */}
          <div className="glass-panel p-5 rounded-2xl flex flex-col justify-center">
            <div className="flex items-center gap-2 text-white/40 mb-2">
              <IndianRupee size={18} />
              <span className="text-[10px] uppercase font-black tracking-wider">Payment Rate</span>
            </div>
            <span className={`text-xl md:text-2xl font-black tracking-tight ${paymentColor}`}>
              {paymentRate !== null ? `${paymentRate}%` : "—"}
            </span>
          </div>

          {/* Workers Hired */}
          <div className="glass-panel p-5 rounded-2xl flex flex-col justify-center">
            <div className="flex items-center gap-2 text-white/40 mb-2">
              <Users size={18} />
              <span className="text-[10px] uppercase font-black tracking-wider">Workers Hired</span>
            </div>
            <span className="text-xl md:text-2xl font-black tracking-tight">{workersHired}</span>
          </div>
        </section>

        {/* ACTIVE GIGS SECTION */}
        {activeGigs.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-lg md:text-xl font-black uppercase tracking-wider text-white">
              Currently hiring for:
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {activeGigs.map((gig) => (
                <GigCard
                  key={gig.id}
                  gig={gig}
                  onClick={() => navigate(`/gigs/${gig.id}`)}
                />
              ))}
            </div>
          </section>
        )}

        {/* REVIEWS SECTION */}
        <section className="space-y-4">
          <h2 className="text-lg md:text-xl font-black uppercase tracking-wider text-white">
            What workers say
          </h2>

          {reviews.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {reviews.map((review) => {
                const raterName = (Array.isArray(review.profiles) ? review.profiles[0]?.full_name : (review.profiles as any)?.full_name) || "Anonymous Worker";
                const reviewDate = new Date(review.created_at).toLocaleDateString("en-IN", {
                  dateStyle: "medium",
                });
                return (
                  <div
                    key={review.id}
                    className="bg-[#1C1C1C] border border-white/5 p-5 rounded-2xl space-y-3 flex flex-col justify-between shadow-sm"
                  >
                    <div className="space-y-2">
                      <div className="flex text-amber-400 gap-0.5">
                        {Array.from({ length: review.score }).map((_, idx) => (
                          <Star key={idx} size={14} className="fill-current shrink-0" />
                        ))}
                      </div>
                      <p className="text-white/80 font-medium text-sm md:text-base leading-relaxed italic">
                        "{review.comment}"
                      </p>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                      <div className="w-6 h-6 bg-white/10 text-white/60 font-bold rounded-full flex items-center justify-center text-xs">
                        {raterName.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-xs font-bold text-white/50">
                        {raterName} · {reviewDate}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-[#1C1C1C] border border-white/5 rounded-3xl p-8 text-center flex flex-col items-center justify-center">
              <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center text-white/40 mb-3 shadow-inner">
                <MessageSquare size={20} />
              </div>
              <p className="text-white/50 font-bold text-sm md:text-base">
                No reviews yet — be the first to work with {name}!
              </p>
            </div>
          )}
        </section>

      </div>
    </main>
  );
}
