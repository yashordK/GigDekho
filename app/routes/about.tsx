import type { MetaFunction } from 'react-router';
import { Link } from 'react-router';
import { ShieldCheck, HelpCircle, FileText, Lock } from 'lucide-react';

export const meta: MetaFunction = () => [
  { title: "About GigDekho — Indore's Hyperlocal Gig Platform" },
  {
    name: "description",
    content:
      "Learn how GigDekho works, read our FAQ, terms of service, and privacy policy. Indore's hyperlocal staffing and gig marketplace.",
  },
];

const FAQ_CATEGORIES: { category: string; faqs: { q: string; a: string }[] }[] = [
  {
    category: "General / Getting Started",
    faqs: [
      { q: "What is GigDekho?", a: "GigDekho is Indore's platform for flexible local work. Post a gig if you need people — for an event, a task, or a project — and get matched with verified local workers. Or apply to gigs if you're looking to earn on your own schedule." },
      { q: "Is GigDekho only for events and weddings?", a: "No. GigDekho covers staffing for any short-term work — events, retail and hospitality shifts, promotions, deliveries, household tasks, tutoring, and more. It also has a marketplace for skilled freelance work (GigDekho Projects) and one for booking local artists." },
      { q: "Which cities is GigDekho available in?", a: "GigDekho currently operates in Indore. We're expanding to other cities soon." },
      { q: "Do I need to pay to create an account?", a: "No, creating an account is free for both workers and hirers." },
      { q: "Is there a mobile app?", a: "GigDekho is currently fully available via the website, and we'll be launching the app soon." },
    ],
  },
  {
    category: "For Workers",
    faqs: [
      { q: "Who can work on GigDekho?", a: "Anyone above 18 who completes our ID verification. You don't need a vehicle, a degree, or prior experience for most gigs." },
      { q: "How do I start applying to gigs?", a: "Sign up, complete the GigDekho Basics onboarding, verify your ID, and you can start applying immediately." },
      { q: "What is GigDekho Basics?", a: "A short, mandatory orientation every worker completes before their first gig — covering punctuality, presentation, and how to handle common on-site situations. Completing it gives you a \"GigDekho Basics Certified\" badge that hirers see on your profile." },
      { q: "How do I get paid?", a: "Your earnings go into your GigDekho Wallet after a gig is marked complete. You can withdraw to your bank account anytime once your bank details are verified." },
      { q: "How long does it take to receive payment after a gig?", a: "You receive your payment in around 24 hours once the gig is completed." },
      { q: "What is the GigDekho Wallet?", a: "A running balance of everything you've earned on the platform. Add your bank account once, and withdraw whenever you like." },
      { q: "Is there a minimum amount I need to earn before withdrawing?", a: "You need at least ₹200 in your wallet to make a withdrawal." },
      { q: "What happens if I accept a gig and can't make it?", a: "Let the hirer know as early as possible through the gig thread. Repeated last-minute cancellations affect your reliability score, which hirers can see on your profile." },
      { q: "What is the reliability score / no-show rate?", a: "A visible score on your profile showing how consistently you show up for confirmed gigs. It's one of the first things hirers check before confirming a worker." },
      { q: "How does my rating work?", a: "After each completed gig, the hirer rates you. Your average rating and total completed gigs are shown on your profile and directly affect how often you get picked for future gigs." },
      { q: "What are worker levels/tiers?", a: "As you complete more gigs, earn badges, and maintain a strong rating, you move up levels — Bronze, Silver, Gold, Platinum — unlocking priority visibility on gig listings and other benefits." },
      { q: "Can I apply to gigs outside my registered skill category?", a: "Yes, absolutely! Your skill categories reflect what you're good at, but they don't stop you from applying to anything else." },
      { q: "What is GigDekho Perks?", a: "Discounts and offers from local cafes, brands, and services, unlocked for verified GigDekho workers. It's our way of saying thanks beyond just the pay." },
      { q: "I'm a student — do I get anything extra?", a: "Yes. Mark yourself as a student during profile setup and verify your college ID to unlock student-specific Perks and offers. Your student verification is valid for 1 year — after that you'll need to verify again." },
      { q: "Can I ask the hirer questions about a gig before it starts?", a: "Yes, every gig has a Q&A thread where you can ask the hirer directly, and see answers to questions other applicants have already asked." },
      { q: "Can I share my phone number with a hirer through the app?", a: "No — for your safety, sharing contact details through gig messages isn't allowed, and any attempt is automatically blocked. All communication and payment stays within GigDekho." },
      { q: "What is GigDekho Projects?", a: "A separate marketplace for skilled freelance work — web development, design, content writing, video editing, and more — for workers who want to take on project-based gigs instead of, or alongside, general staffing work." },
      { q: "How do I get accepted for GigDekho Projects gigs?", a: "Skilled categories require a short task or portfolio review before you're eligible to apply, to make sure the quality bar stays high for clients." },
      { q: "Can I list myself as an artist (singer, DJ, performer, etc.)?", a: "Yes, through the Artist Booking section — create a profile with samples of your work, and organisers can discover and book you directly." },
    ],
  },
  {
    category: "For Hirers / Organisers",
    faqs: [
      { q: "Who can post a gig on GigDekho?", a: "Anyone — individuals hosting a personal event, small business owners, event companies, corporates, or housing societies. You don't need to be a registered business to post most gigs." },
      { q: "How quickly can I get workers for my gig?", a: "That depends on your posting timeline and gig details — we recommend posting at least a few days ahead for the best response. GigDekho isn't built as an emergency same-day service; it's built to give you confirmed, reliable people well ahead of time." },
      { q: "How do I know the workers are trustworthy?", a: "Every worker completes ID verification and GigDekho Basics onboarding before their first gig. You can also see their rating, completed gig count, and reliability score before confirming them." },
      { q: "What is \"My Regulars\"?", a: "A saved list of workers you've rated highly in the past. When you post a new gig, your regulars get notified before it goes out to the general feed — so you can rebuild your own trusted team inside GigDekho, the same way you would offline." },
      { q: "Can I reuse a previous gig posting?", a: "Yes — quick templates let you repost similar roles in seconds instead of filling out the full form again." },
      { q: "How does payment work?", a: "Payment happens digitally through the platform. You pay a 30% advance when your workers are confirmed, and the remaining 70% before the event starts (or you can pay the full amount upfront while posting). The money is held securely and released to workers only after the gig is completed — so workers know they'll be paid, and you only release payment for work that actually happened." },
      { q: "What if a confirmed worker doesn't show up?", a: "Gigs have a waitlist — if a confirmed worker cancels, the first person on the waitlist is automatically promoted and notified, so your headcount stays covered." },
      { q: "Can I message all my confirmed workers at once?", a: "Yes — use Announcements to send updates like dress code, meeting point, or event rules to confirmed workers, or to all applicants including those on the waitlist." },
      { q: "Is there a way for workers to ask me questions before the event?", a: "Yes, every gig has a Q&A thread. Answer once and every applicant on that gig can see the response, so you're not answering the same question repeatedly." },
      { q: "Can I rate workers after a gig?", a: "Yes, and we encourage it — your ratings are what build your Regulars list and help the whole worker community stay high quality." },
      { q: "Do workers rate hirers too?", a: "Yes. Worker ratings of hirers contribute to your visible profile reputation, so being clear, fair, and prompt with workers helps you attract better applicants over time." },
      { q: "What does \"Verified Business\" mean versus \"ID Verified\"?", a: "ID Verified means your personal identity has been confirmed — the baseline for anyone posting. Verified Business is an additional tier for registered businesses (via GST or a shop license) and signals a stronger trust level to workers." },
      { q: "I'm an individual, not a business — can I still post gigs?", a: "Yes, absolutely. Most personal bookings — a birthday, a small get-together, a one-off task — come from individuals, not registered businesses." },
    ],
  },
  {
    category: "GigDekho Celebrations",
    faqs: [
      { q: "What is GigDekho Celebrations?", a: "A bundled package for personal events — birthdays, anniversaries, proposals, and small get-togethers — combining photography and reels, event setup, and optional gifting, all booked in one place." },
      { q: "What's included in each Celebrations package tier?", a: "Three options: Moments (photos & reels only), Moments + Setup (adds a crew that sets up the surprise — decor, balloons, lights), and Moments + Setup + Gifting (adds a thoughtful curated gift for the person you're celebrating)." },
      { q: "How far in advance should I book a Celebrations package?", a: "At least a day prior to your event." },
      { q: "Can I customize a Celebrations package?", a: "Yes — pick whichever of the three tiers fits your celebration: Moments only, Moments + Setup, or Moments + Setup + Gifting." },
    ],
  },
  {
    category: "GigDekho Projects",
    faqs: [
      { q: "What kind of skilled work can I post on GigDekho Projects?", a: "Web development, graphic design, video editing, content writing, social media management, tutoring, and similar project-based work." },
      { q: "How are Projects freelancers vetted?", a: "Through a short task or portfolio review specific to their skill category, so clients can trust the quality of who they're hiring." },
      { q: "How is pricing set for a Projects gig?", a: "You post your budget with the project, and the final price is negotiated with the freelancer." },
    ],
  },
  {
    category: "Artist Booking",
    faqs: [
      { q: "How do I book an artist through GigDekho?", a: "Browse artist profiles by category — singers, DJs, anchors, dancers, and more — view their samples and ratings, and book directly through the platform." },
      { q: "Do artists set their own rates?", a: "Yes — artists set their own rate expectations on their profiles." },
      { q: "Can I message an artist before booking?", a: "Yes, you can reach them via the thread on the platform — they'll also get an email notification." },
    ],
  },
  {
    category: "GigDekho Perks",
    faqs: [
      { q: "What is GigDekho Perks?", a: "A set of discounts and deals from local cafes, brands, and services, available to verified GigDekho workers as a thank-you beyond their gig earnings." },
      { q: "Who is eligible for Perks?", a: "Any ID-verified worker. Some perks are specifically for students who've verified their college ID." },
      { q: "How do I redeem a Perk?", a: "We keep posting new perks — just redeem one whenever you spot something exciting!" },
    ],
  },
  {
    category: "Trust, Safety & Verification",
    faqs: [
      { q: "Why do I need to verify my ID?", a: "It keeps GigDekho safe for everyone — hirers know the person showing up is who they say they are, and workers know they're applying to legitimate opportunities." },
      { q: "What documents do I need to verify?", a: "Aadhaar card for identity verification. Students can additionally verify a college ID for student Perks. Businesses can verify via GST or a shop license for the Verified Business badge." },
      { q: "Is my personal information safe?", a: "Your documents are used only for verification and are never shared with other users. Only you and GigDekho's verification team can see them." },
      { q: "How long does verification take?", a: "Less than a week — usually much faster." },
      { q: "What if my verification is rejected?", a: "You'll see the reason on your profile and can resubmit corrected documents right away." },
      { q: "Can I report a bad experience with a hirer or worker?", a: "Yes — reach out via the contact details in the footer and we'll review and take action." },
    ],
  },
];

export default function AboutScreen() {
  return (
    <main id="main-content" className="bg-[#111111] min-h-screen text-white/90 pb-24 pt-24 lg:pt-28">
      <div className="max-w-3xl mx-auto px-6 space-y-14">

        {/* About */}
        <section id="about" className="space-y-4">
          <h1 className="text-3xl lg:text-5xl font-black text-white tracking-tight">
            About Gig<span className="text-[#F4511E]">Dekho</span>
          </h1>
          <p className="text-white/70 font-medium leading-relaxed">
            GigDekho is Indore's hyperlocal on-demand workforce marketplace. We connect
            people who need short-term help — event organisers, cafes, businesses, and
            families planning celebrations — with students, part-timers, and local artists
            who want to earn.
          </p>
          <p className="text-white/70 font-medium leading-relaxed">
            Whether you need waitstaff for a wedding, a DJ for a launch party, a
            photographer for a birthday, or an extra pair of hands for the weekend rush —
            post a gig and get verified local workers in minutes.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link to="/worker/home" className="bg-[#F4511E] hover:bg-[#D84315] text-white font-bold px-6 py-3 rounded-full text-sm transition-colors btn-tap">
              Find Work
            </Link>
            <Link to="/auth?mode=organizer" className="border border-white/20 hover:border-white text-white font-bold px-6 py-3 rounded-full text-sm transition-colors btn-tap">
              Hire People
            </Link>
          </div>
        </section>

        {/* FAQ — grouped into expandable categories */}
        <section id="faq" className="space-y-5">
          <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <HelpCircle size={22} className="text-[#F4511E]" /> Frequently Asked Questions
          </h2>
          <div className="space-y-4">
            {FAQ_CATEGORIES.map((cat, i) => (
              <details key={cat.category} open={i === 0} className="bg-[#1C1C1C] border border-white/5 rounded-2xl group/cat overflow-hidden">
                <summary className="font-black text-white p-5 cursor-pointer flex justify-between items-center list-none text-base lg:text-lg">
                  <span className="flex items-center gap-2.5">
                    {cat.category}
                    <span className="text-[10px] font-black text-[#F4511E] bg-[#F4511E]/10 border border-[#F4511E]/20 px-2 py-0.5 rounded-full">
                      {cat.faqs.length}
                    </span>
                  </span>
                  <span className="text-white/40 transition group-open/cat:rotate-180">▾</span>
                </summary>
                <div className="px-4 pb-4 space-y-2">
                  {cat.faqs.map((item) => (
                    <details key={item.q} className="bg-[#111111] border border-white/5 rounded-xl group/q">
                      <summary className="font-bold text-white/85 text-sm px-4 py-3.5 cursor-pointer flex justify-between items-center gap-3 list-none">
                        {item.q}
                        <span className="text-white/30 text-xs transition group-open/q:rotate-180 shrink-0">▾</span>
                      </summary>
                      <p className="px-4 pb-4 text-sm font-medium text-white/55 leading-relaxed">{item.a}</p>
                    </details>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </section>

        {/* Trust & Safety */}
        <section id="trust" className="space-y-4">
          <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <ShieldCheck size={22} className="text-[#F4511E]" /> Trust & Safety
          </h2>
          <ul className="space-y-3 text-sm font-medium text-white/60 leading-relaxed list-disc pl-5">
            <li>Workers can verify their identity with Aadhar/PAN — verified profiles carry a badge.</li>
            <li>Both sides rate each other after every gig. Ratings are real and cannot be edited or purchased.</li>
            <li>Reliability scores track attendance so hirers know who shows up.</li>
            <li>Payments are held and released through the platform — workers never chase hirers for cash.</li>
            <li>Report any issue to us directly at the contact details in the footer; we respond within 24 hours.</li>
          </ul>
        </section>

        {/* Terms */}
        <section id="terms" className="space-y-4">
          <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <FileText size={22} className="text-[#F4511E]" /> Terms of Service
          </h2>
          <div className="space-y-3 text-sm font-medium text-white/60 leading-relaxed">
            <p>1. By applying to a gig you commit to arriving at the location on time and performing the duties professionally.</p>
            <p>2. Failure to show up without at least 24 hours' notice affects your reliability score and may result in payout deductions or account suspension.</p>
            <p>3. Hirers agree to pay the posted rate in full through the platform. Off-platform payment arrangements are not protected by GigDekho.</p>
            <p>4. Worker payouts are processed after the hirer marks the gig complete and attendance is confirmed.</p>
            <p>5. GigDekho may suspend accounts that abuse the platform, harass other users, or attempt to defraud the payment system.</p>
          </div>
        </section>

        {/* Privacy */}
        <section id="privacy" className="space-y-4">
          <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <Lock size={22} className="text-[#F4511E]" /> Privacy Policy
          </h2>
          <div className="space-y-3 text-sm font-medium text-white/60 leading-relaxed">
            <p>We collect only the information needed to run the marketplace: your name, contact details, skills, location for gig matching, and payment records.</p>
            <p>Your phone number is shared only with a hirer after you are confirmed for their gig, and only for coordination.</p>
            <p>Identity documents uploaded for verification are stored securely and are never visible to other users.</p>
            <p>We never sell your personal data. You can request deletion of your account and data by contacting us at the email in the footer.</p>
          </div>
        </section>

      </div>
    </main>
  );
}
