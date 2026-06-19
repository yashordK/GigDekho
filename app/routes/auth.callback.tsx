import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { supabase } from "~/lib/supabase.client";

export default function AuthCallback() {
  const navigate = useNavigate();
  const [errorText, setErrorText] = useState("");

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Detect if protocol or domain needs restoration to the origin where sign-in started
        if (typeof window !== 'undefined') {
          const authOrigin = localStorage.getItem('authOrigin');
          const currentOrigin = window.location.origin;
          
          if (authOrigin && authOrigin !== currentOrigin) {
            console.log(`Restoring origin: redirecting from ${currentOrigin} to ${authOrigin}`);
            // Clean up to prevent redirect loops
            localStorage.removeItem('authOrigin');
            window.location.href = window.location.href.replace(currentOrigin, authOrigin);
            return;
          }
        }

        const code = new URL(window.location.href).searchParams.get("code");
        
        if (!code) {
          // If there is no code in the URL, check if we already have an active session
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();
          if (sessionError || !session) {
            navigate("/auth");
            return;
          }
          await proceedWithSession(session);
          return;
        }

        // Exchange the code for a session
        const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        
        if (exchangeError) throw exchangeError;

        const sessionUser = data?.user;
        const session = data?.session;
        if (!sessionUser || !session) {
          navigate("/auth");
          return;
        }

        await proceedWithSession(session);
      } catch (err: any) {
        console.error("Auth callback error:", err);
        setErrorText(err.message || "Failed to complete authentication. Redirecting to login...");
        setTimeout(() => {
          navigate("/auth");
        }, 3000);
      }
    };

    const proceedWithSession = async (session: any) => {
      // Check if profile exists
      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("id, role, full_name")
        .eq("id", session.user.id)
        .maybeSingle();

      if (profileErr) throw profileErr;

      if (!profile || !profile.full_name) {
        // New user — send to setup
        navigate("/setup-profile");
        return;
      }

      // Existing user — redirect based on last active view, fall back to signup role
      const lastView = localStorage.getItem('activeView');
      if (lastView === 'organizer') {
        navigate("/organizer/home");
      } else if (lastView === 'worker') {
        navigate("/worker/home");
      } else if (profile.role === "organizer") {
        navigate("/organizer/home");
      } else {
        navigate("/worker/home");
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-[#111111] flex items-center justify-center">
      <div className="text-white text-center">
        {errorText ? (
          <p className="text-red-400 font-bold max-w-sm px-4">{errorText}</p>
        ) : (
          <>
            <div className="w-8 h-8 border-2 border-[#F4511E] border-t-transparent 
                            rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-400">Signing you in...</p>
          </>
        )}
      </div>
    </div>
  );
}
