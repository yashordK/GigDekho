import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { supabase } from "~/lib/supabase.client";
import { Loader2 } from "lucide-react";

export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState("");

  useEffect(() => {
    const code = searchParams.get("code");

    async function handleCallback() {
      try {
        if (code) {
          // Exchange code for session (sets cookies & local session)
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
          
          const sessionUser = data?.user;
          if (sessionUser) {
            // Check if profile exists and has role
            const { data: profile, error: profileError } = await supabase
              .from("profiles")
              .select("full_name, role")
              .eq("id", sessionUser.id)
              .maybeSingle();

            if (profileError) throw profileError;

            if (profile && profile.full_name) {
              // Redirect based on role
              if (profile.role === "organizer") {
                navigate("/organizer/home");
              } else {
                navigate("/worker/home");
              }
            } else {
              // Profile setup incomplete
              navigate("/setup-profile");
            }
          } else {
            navigate("/auth");
          }
        } else {
          // If no code, check if we already have a session (e.g. hash parameters already consumed)
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("full_name, role")
              .eq("id", session.user.id)
              .maybeSingle();
            
            if (profile && profile.full_name) {
              navigate(profile.role === "organizer" ? "/organizer/home" : "/worker/home");
            } else {
              navigate("/setup-profile");
            }
          } else {
            navigate("/auth");
          }
        }
      } catch (err: any) {
        console.error("Auth callback error:", err);
        setError(err.message || "Failed to complete authentication. Redirecting back...");
        setTimeout(() => {
          navigate("/auth");
        }, 3000);
      }
    }

    handleCallback();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#111111] text-white p-6">
      <div className="bg-[#1C1C1C] border border-white/10 p-8 rounded-3xl max-w-sm w-full text-center shadow-xl">
        {error ? (
          <div className="space-y-4">
            <p className="text-red-400 font-bold">{error}</p>
          </div>
        ) : (
          <div className="flex flex-col items-center space-y-4">
            <Loader2 className="animate-spin text-[#F4511E] w-8 h-8" />
            <h2 className="text-lg font-black tracking-tight">Completing Sign-In</h2>
            <p className="text-sm text-white/50">Securing your session. Please wait...</p>
          </div>
        )}
      </div>
    </div>
  );
}
