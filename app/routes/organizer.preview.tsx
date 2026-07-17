import { useState } from "react";
import { useNavigate } from "react-router";
import type { MetaFunction } from "react-router";
import { Users, Camera, Briefcase, Music, ShieldCheck, Star, Megaphone, ArrowRight, Check, Sparkles } from "lucide-react";
import AuthModal from "~/components/AuthModal";
import SpotlightCategories from "~/components/SpotlightCategories";
import Footer from "~/components/Footer";

export const meta: MetaFunction = () => [
  { title: "Hire on GigDekho — Staff, Celebrations, Projects & Artists in Indore" },
  {
    name: "description",
    content:
      "Post a gig and get verified local workers in Indore — event staff, celebration packages with photographers and reels, skilled freelancers, and bookable artists.",
  },
];

const STAFF_ROLES = [
  { emoji: '🙋', label: 'Helpers' },
  { emoji: '📋', label: 'Coordinators' },
  { emoji: '🧸', label: 'Babysitters' },
  { emoji: '🎥', label: 'Reel Shooters' },
  { emoji: '📸', label: 'Photographers' },
  { emoji: '🛎️', label: 'Receptionists' },
  { emoji: '🍽️', label: 'Waitstaff' },
  { emoji: '🍸', label: 'Bartenders' },
  { emoji: '🛡️', label: 'Security' },
  { emoji: '📣', label: 'Promoters' },
  { emoji: '🥘', label: 'Catering Staff' },
  { emoji: '🧹', label: 'Cleanup Crew' },
];

const PROJECT_SKILLS = [
  { emoji: '🌐', label: 'Website Builders', desc: 'Want a website for your business? Get one built in no time.' },
  { emoji: '🎨', label: 'Graphic Designers', desc: 'Menus, posters, branding — designed locally.' },
  { emoji: '📱', label: 'Social Media & Marketing', desc: 'Interns and managers to run your pages.' },
  { emoji: '🤝', label: 'Sales Support', desc: 'Part-time sales people when you need a push.' },
  { emoji: '🎬', label: 'Video Editors', desc: 'Reels, ads, and event edits turned around fast.' },
  { emoji: '✍️', label: 'Content Writers', desc: 'Descriptions, captions, and copy that converts.' },
];

const ARTISTS = [
  { emoji: '🎤', label: 'Singers' },
  { emoji: '💃', label: 'Dancers' },
  { emoji: '🎙️', label: 'Anchors & Emcees' },
  { emoji: '🎧', label: 'DJs' },
  { emoji: '🎸', label: 'Live Bands' },
  { emoji: '🪄', label: 'Magicians' },
  { emoji: '😂', label: 'Comedians' },
];

export default function OrganizerPreviewScreen() {
  const navigate = useNavigate();
  const [showAuthModal, setShowAuthModal] = useState(false);

  const openSignup = () => setShowAuthModal(true);

  return (
    <div className="relative min-h-screen bg-[#111111] flex flex-col font-sans">

      {/* Nav */}
      <nav className="sticky top-0 w-full h-[64px] border-b border-white/10 flex items-center justify-between px-6 xl:px-12 z-20 bg-[#111111]/80 backdrop-blur-md">
        <button type="button" onClick={() => navigate('/')} className="text-[22px] tracking-tight flex items-center cursor-pointer bg-transparent border-0 p-0">
          <span className="text-white font-bold">
            Gig<span className="text-[#F4511E] italic font-black">Dekho</span>
          </span>
        </button>
        <button
          onClick={() => navigate("/auth?mode=organizer")}
          className="bg-white/10 hover:bg-white/20 text-white font-bold px-5 py-1.5 rounded-full text-xs tracking-wider transition-colors btn-tap min-h-[38px] flex items-center"
        >
          Sign In
        </button>
      </nav>

      <main id="main-content" className="flex-grow pb-24">

        {/* ── Hero ── */}
        <section className="relative hero-gradient-overlay overflow-hidden text-center px-6 pt-16 pb-20">
          <SpotlightCategories />
          <div className="absolute top-10 right-[10%] w-[280px] h-[280px] floating-glass-rect rotate-12 hidden lg:block opacity-40" />
          <div className="relative z-10 max-w-3xl mx-auto">
            <div className="inline-block bg-[#1C1C1C] px-4 py-1.5 rounded-full border border-white/10 mb-5">
              <span className="text-white/80 font-bold text-xs">For events, businesses & celebrations in Indore</span>
            </div>
            <h1 className="text-4xl lg:text-6xl font-black text-white tracking-tight leading-[1.05] mb-5">
              Whatever you need people for,<br className="hidden lg:block" /> <span className="text-[#F4511E]">GigDekho has them.</span>
            </h1>
            <p className="text-white/60 font-medium text-base lg:text-lg max-w-xl mx-auto mb-8">
              Verified local workers, skilled freelancers, celebration crews, and bookable artists. Any kind of work, any kind of event. Post once and get applications in minutes.
            </p>
            <button
              onClick={openSignup}
              className="bg-[#F4511E] hover:bg-[#D84315] text-white font-black px-10 py-4 rounded-full shadow-xl shadow-orange-500/25 text-sm uppercase tracking-widest btn-tap hover:scale-105 transition-all"
            >
              Post Your First Gig, Free
            </button>
          </div>
        </section>

        <div className="max-w-6xl mx-auto px-6 xl:px-0 space-y-20 mt-16">

          {/* ── 1. Temporary Staff (first, per priority) ── */}
          <section>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-11 h-11 rounded-2xl bg-[#F4511E]/10 border border-[#F4511E]/20 text-[#F4511E] flex items-center justify-center"><Users size={20} /></div>
              <div>
                <h2 className="text-2xl lg:text-3xl font-black text-white tracking-tight">Temporary Staff</h2>
                <p className="text-xs font-bold text-white/40 uppercase tracking-widest">Extra hands, exactly when you need them</p>
              </div>
            </div>
            <p className="text-white/60 font-medium text-sm max-w-2xl mb-6">
              Helpers, coordinators, babysitters, reel shooters, photographers, receptionists. Every worker is ID-verified, rated after every gig, and trained through GigDekho Basics before their first shift.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {STAFF_ROLES.map(r => (
                <button
                  key={r.label}
                  type="button"
                  onClick={openSignup}
                  className="bg-[#1C1C1C] border border-white/5 hover:border-[#F4511E]/40 rounded-2xl p-4 flex items-center gap-3 text-left transition-all btn-tap group"
                >
                  <span className="text-2xl">{r.emoji}</span>
                  <span className="text-sm font-bold text-white/80 group-hover:text-white">{r.label}</span>
                </button>
              ))}
              {/* Not limited to listed categories */}
              <button
                type="button"
                onClick={openSignup}
                className="bg-transparent border border-dashed border-[#F4511E]/40 hover:border-[#F4511E] rounded-2xl p-4 flex items-center gap-3 text-left transition-all btn-tap group"
              >
                <span className="text-2xl">✨</span>
                <span className="text-sm font-bold text-[#F4511E]">…or anything else you need. Post a custom role!</span>
              </button>
            </div>
          </section>

          {/* ── 2. Celebrations ── */}
          <section>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-11 h-11 rounded-2xl bg-pink-500/10 border border-pink-500/20 text-pink-400 flex items-center justify-center"><Camera size={20} /></div>
              <div>
                <h2 className="text-2xl lg:text-3xl font-black text-white tracking-tight">GigDekho Celebrations</h2>
                <p className="text-xs font-bold text-white/40 uppercase tracking-widest">Birthdays · Anniversaries · Proposals · Get-togethers</p>
              </div>
            </div>
            <p className="text-white/60 font-medium text-sm max-w-2xl mb-6">
              Packages like <span className="text-white font-bold">"Kheech Meri Photo"</span> and <span className="text-white font-bold">"Ek Reel Meri Bhi"</span> — your guests leave with great photos and reels, and you didn't lift a finger. One booking covers it all.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { name: 'Moments', tag: 'Photos & Reels', desc: 'A photographer + reel shooter capture the whole event — candids, group shots, and share-ready reels.', highlight: false },
                { name: 'Moments + Setup', tag: 'Add surprise decor', desc: 'Everything in Moments, plus a crew that sets up the surprise — balloons, lights, the works — before your guest of honour walks in.', highlight: true },
                { name: 'Moments + Setup + Gifting', tag: 'The full celebration', desc: 'The complete package: photos, reels, surprise setup, and a thoughtful curated gift for the person you\'re celebrating.', highlight: false },
              ].map(p => (
                <div key={p.name} className={`rounded-3xl p-6 border flex flex-col ${p.highlight ? 'bg-[#F4511E]/5 border-[#F4511E]/30 shadow-lg shadow-orange-500/5' : 'bg-[#1C1C1C] border-white/5'}`}>
                  {p.highlight && (
                    <span className="self-start text-[9px] font-black uppercase tracking-widest bg-[#F4511E] text-white px-2.5 py-1 rounded-full mb-3 flex items-center gap-1"><Sparkles size={10} /> Popular</span>
                  )}
                  <h3 className="font-black text-white text-lg mb-0.5">{p.name}</h3>
                  <p className="text-[10px] font-black text-[#F4511E] uppercase tracking-widest mb-3">{p.tag}</p>
                  <p className="text-white/55 text-sm font-medium leading-relaxed mb-5 flex-1">{p.desc}</p>
                  <button type="button" onClick={openSignup} className="text-[#F4511E] text-xs font-black uppercase tracking-wider flex items-center gap-1 btn-tap hover:gap-2 transition-all">
                    Book this <ArrowRight size={13} />
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* ── 3. Projects ── */}
          <section>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-11 h-11 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center"><Briefcase size={20} /></div>
              <div>
                <h2 className="text-2xl lg:text-3xl font-black text-white tracking-tight">GigDekho Projects</h2>
                <p className="text-xs font-bold text-white/40 uppercase tracking-widest">Skilled freelance work, from your own city</p>
              </div>
            </div>
            <p className="text-white/60 font-medium text-sm max-w-2xl mb-6">
              Portfolio-vetted local freelancers for project work — post your budget, review applicants' work, and hire without agencies.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {PROJECT_SKILLS.map(s => (
                <button
                  key={s.label}
                  type="button"
                  onClick={openSignup}
                  className="bg-[#1C1C1C] border border-white/5 hover:border-blue-500/40 rounded-2xl p-5 text-left transition-all btn-tap"
                >
                  <span className="text-2xl block mb-2.5">{s.emoji}</span>
                  <span className="text-sm font-black text-white block mb-1">{s.label}</span>
                  <span className="text-xs font-medium text-white/45 leading-relaxed">{s.desc}</span>
                </button>
              ))}
            </div>
          </section>

          {/* ── 4. Artists ── */}
          <section>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-11 h-11 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center"><Music size={20} /></div>
              <div>
                <h2 className="text-2xl lg:text-3xl font-black text-white tracking-tight">Artist Booking</h2>
                <p className="text-xs font-bold text-white/40 uppercase tracking-widest">Skilled college talent, bookable directly</p>
              </div>
            </div>
            <p className="text-white/60 font-medium text-sm max-w-2xl mb-6">
              Indore's young performers — browse their samples and ratings, message them through the platform, and book at rates they set themselves.
            </p>
            <div className="flex flex-wrap gap-3">
              {ARTISTS.map(a => (
                <button
                  key={a.label}
                  type="button"
                  onClick={openSignup}
                  className="bg-[#1C1C1C] border border-white/5 hover:border-purple-500/40 rounded-full px-5 py-3 flex items-center gap-2 transition-all btn-tap"
                >
                  <span className="text-lg">{a.emoji}</span>
                  <span className="text-sm font-bold text-white/80">{a.label}</span>
                </button>
              ))}
            </div>
          </section>

          {/* ── Trust strip ── */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { icon: <ShieldCheck size={18} />, title: 'Verified & trained', desc: 'Every worker is ID-verified and completes GigDekho Basics before their first gig.' },
              { icon: <Star size={18} />, title: 'Ratings both ways', desc: 'See ratings, completed gigs, and reliability scores before you confirm anyone.' },
              { icon: <Megaphone size={18} />, title: 'Coordinate in-app', desc: 'Announcements, Q&A threads, and secure payments — no chasing people on calls.' },
            ].map(t => (
              <div key={t.title} className="glass-panel rounded-2xl p-5 flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#F4511E]/10 text-[#F4511E] flex items-center justify-center shrink-0">{t.icon}</div>
                <div>
                  <p className="font-black text-white text-sm mb-1">{t.title}</p>
                  <p className="text-xs font-medium text-white/50 leading-relaxed">{t.desc}</p>
                </div>
              </div>
            ))}
          </section>

          {/* ── How it works + CTA ── */}
          <section className="bg-[#1C1C1C] border border-white/5 rounded-3xl p-8 lg:p-12 text-center">
            <h2 className="text-2xl lg:text-3xl font-black text-white tracking-tight mb-8">Posting takes 2 minutes</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto mb-10 text-left">
              {[
                { n: '1', t: 'Describe your gig', d: 'Role, date, headcount, pay — or start from a template.' },
                { n: '2', t: 'Workers apply instantly', d: 'First come, first confirmed. Review profiles and ratings.' },
                { n: '3', t: 'Pay securely', d: '30% advance, the rest before the event — released after completion.' },
              ].map(s => (
                <div key={s.n} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#F4511E]/10 border border-[#F4511E]/25 text-[#F4511E] font-black flex items-center justify-center shrink-0 text-sm">{s.n}</div>
                  <div>
                    <p className="font-bold text-white text-sm mb-0.5">{s.t}</p>
                    <p className="text-xs font-medium text-white/45 leading-relaxed">{s.d}</p>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={openSignup}
              className="bg-[#F4511E] hover:bg-[#D84315] text-white font-black px-10 py-4 rounded-full shadow-xl shadow-orange-500/25 text-sm uppercase tracking-widest btn-tap hover:scale-105 transition-all"
            >
              Get Started — It's Free
            </button>
            <p className="text-white/30 text-[11px] font-bold mt-3 flex items-center justify-center gap-1">
              <Check size={12} /> No subscription. Pay only when you hire.
            </p>
          </section>

        </div>
      </main>

      <Footer />

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        defaultIntent="organizer"
      />
    </div>
  );
}
