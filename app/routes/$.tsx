import { data, Link, useLocation } from "react-router";
import type { MetaFunction } from "react-router";
import { Compass, Home, Briefcase, HelpCircle } from "lucide-react";

/**
 * Catch-all 404.
 *
 * Without this, any unmatched URL throws an ErrorResponseImpl out of the
 * router and lands in the runtime error log. In production that was the
 * single largest error group — ~200 entries, mostly `/config.json`,
 * `/favicon.ico` and automated scanners probing for `.env`, `.git/config`
 * and AWS credentials. They were all correctly refused, but they buried
 * real errors in the noise.
 *
 * `data(..., { status: 404 })` renders this page WITH a 404 status rather
 * than throwing, so crawlers and browsers still get the right signal.
 */
export function loader() {
  return data({}, { status: 404 });
}

export const meta: MetaFunction = () => [
  { title: "Page not found — GigDekho" },
  { name: "robots", content: "noindex, nofollow" },
];

export default function NotFound() {
  const location = useLocation();

  return (
    <main id="main-content" className="min-h-screen bg-[#111111] flex items-center justify-center px-6 py-20">
      <div className="w-full max-w-md text-center">
        <div className="w-16 h-16 rounded-2xl bg-[#F4511E]/10 border border-[#F4511E]/20 text-[#F4511E] flex items-center justify-center mx-auto mb-6">
          <Compass size={28} />
        </div>

        <h1 className="text-3xl lg:text-4xl font-black text-white tracking-tight mb-3">
          This page doesn't exist
        </h1>
        <p className="text-white/50 font-medium text-sm leading-relaxed mb-2">
          We couldn't find anything at{" "}
          <span className="text-white/70 font-mono text-xs bg-white/5 px-1.5 py-0.5 rounded break-all">
            {location.pathname}
          </span>
        </p>
        <p className="text-white/35 font-medium text-xs leading-relaxed mb-8">
          The link may be old, or the gig may have been filled and taken down.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link
            to="/worker/home"
            className="flex flex-col items-center gap-2 bg-[#1C1C1C] border border-white/5 hover:border-[#F4511E]/40 rounded-2xl px-4 py-5 transition-colors btn-tap"
          >
            <Briefcase size={18} className="text-[#F4511E]" />
            <span className="text-xs font-bold text-white/80">Browse gigs</span>
          </Link>
          <Link
            to="/"
            className="flex flex-col items-center gap-2 bg-[#1C1C1C] border border-white/5 hover:border-[#F4511E]/40 rounded-2xl px-4 py-5 transition-colors btn-tap"
          >
            <Home size={18} className="text-[#F4511E]" />
            <span className="text-xs font-bold text-white/80">Home</span>
          </Link>
          <Link
            to="/about#faq"
            className="flex flex-col items-center gap-2 bg-[#1C1C1C] border border-white/5 hover:border-[#F4511E]/40 rounded-2xl px-4 py-5 transition-colors btn-tap"
          >
            <HelpCircle size={18} className="text-[#F4511E]" />
            <span className="text-xs font-bold text-white/80">Help</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
