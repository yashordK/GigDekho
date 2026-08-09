import { Link, useLocation } from "react-router";
import { Compass, Home, Briefcase, HelpCircle, AlertTriangle } from "lucide-react";

/**
 * The branded page we show when something has gone wrong — a missing URL, a
 * gig that no longer exists, or an unexpected crash.
 *
 * Shared by the catch-all 404 route and the root ErrorBoundary so all three
 * cases look like GigDekho instead of React Router's unstyled default. The
 * `<title>` is rendered inline because an ErrorBoundary never gets to run a
 * route `meta` export; React 19 hoists it into <head>.
 */
export default function ErrorState({
  title,
  heading,
  message,
  showPath = false,
  variant = "notFound",
}: {
  title: string;
  heading: string;
  message: string;
  showPath?: boolean;
  variant?: "notFound" | "error";
}) {
  const location = useLocation();
  const Icon = variant === "error" ? AlertTriangle : Compass;

  return (
    <main
      id="main-content"
      className="min-h-screen bg-[#111111] flex items-center justify-center px-6 py-20"
    >
      <title>{title}</title>
      <meta name="robots" content="noindex, nofollow" />

      <div className="w-full max-w-md text-center">
        <div className="w-16 h-16 rounded-2xl bg-[#F4511E]/10 border border-[#F4511E]/20 text-[#F4511E] flex items-center justify-center mx-auto mb-6">
          <Icon size={28} />
        </div>

        <h1 className="text-3xl lg:text-4xl font-black text-white tracking-tight mb-3">
          {heading}
        </h1>

        {showPath && (
          <p className="text-white/50 font-medium text-sm leading-relaxed mb-2">
            We couldn't find anything at{" "}
            <span className="text-white/70 font-mono text-xs bg-white/5 px-1.5 py-0.5 rounded break-all">
              {location.pathname}
            </span>
          </p>
        )}

        <p className="text-white/35 font-medium text-xs leading-relaxed mb-8">{message}</p>

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
