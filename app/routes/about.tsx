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

const FAQS = [
  {
    q: "How do I get paid?",
    a: "Once the hirer marks the gig complete and your attendance is confirmed, your earnings are credited to your GigDekho wallet — typically within 1 hour of gig completion.",
  },
  {
    q: "What happens if I cancel a gig?",
    a: "Cancelling with more than 24 hours' notice carries no penalty. Cancelling within 24 hours reduces your reliability score by 5 points, and within 6 hours by 15 points plus a ₹100 deduction from your next payout.",
  },
  {
    q: "How does the waitlist work?",
    a: "Gigs are first-come-first-served. If all slots are filled, you can join the waitlist — if a confirmed worker cancels, the first person on the waitlist is automatically promoted and notified by email.",
  },
  {
    q: "How do hirers pay?",
    a: "Hirers pay a 30% advance when workers are confirmed and the remaining 70% after the event. Worker payouts are released once the final payment clears.",
  },
  {
    q: "What is the reliability score?",
    a: "Every worker starts at 100. Showing up on time earns points back; late cancellations and no-shows reduce it. Hirers see this score, so a high score means more gigs.",
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

        {/* FAQ */}
        <section id="faq" className="space-y-5">
          <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <HelpCircle size={22} className="text-[#F4511E]" /> Frequently Asked Questions
          </h2>
          <div className="space-y-3">
            {FAQS.map((item) => (
              <details key={item.q} className="bg-[#1C1C1C] border border-white/5 rounded-2xl group">
                <summary className="font-bold text-white p-5 cursor-pointer flex justify-between items-center list-none">
                  {item.q}
                  <span className="text-white/40 transition group-open:rotate-180">▾</span>
                </summary>
                <p className="px-5 pb-5 text-sm font-medium text-white/60 leading-relaxed">{item.a}</p>
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
