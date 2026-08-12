import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { supabase } from "~/lib/supabase.client";
import { consumeAuthFromUrl } from "~/lib/auth-url";

/**
 * OAuth / magic-link landing page.
 *
 * IMPORTANT: do NOT call `exchangeCodeForSession()` here. The browser client
 * from `@supabase/ssr` has `detectSessionInUrl` enabled, so it consumes the
 * `?code=` and the PKCE verifier automatically as soon as it loads. Calling
 * the exchange again afterwards fails with "PKCE code verifier not found in
 * storage" — the verifier is single-use and already gone — which is what made
 * sign-in show an error and then only work after a delay.
 *
 * So: wait for the session the client is already establishing, then route.
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const [errorText, setErrorText] = useState("");

  useEffect(() => {
    let settled = false;

    const routeTo = async (session: any) => {
      if (settled) return;
      settled = true;
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, role, full_name")
          .eq("id", session.user.id)
          .maybeSingle();

        if (!profile || !profile.full_name) {
          navigate("/setup-profile", { replace: true });
          return;
        }

        const nextUrl = localStorage.getItem("redirectAfterLogin");
        if (nextUrl) {
          localStorage.removeItem("redirectAfterLogin");
          navigate(nextUrl, { replace: true });
          return;
        }

        const lastView = localStorage.getItem("activeView");
        if (lastView === "organizer") navigate("/organizer/home", { replace: true });
        else if (lastView === "worker") navigate("/worker/home", { replace: true });
        else navigate(profile.role === "organizer" ? "/organizer/home" : "/worker/home", { replace: true });
      } catch (err: any) {
        console.error("Auth callback error:", err);
        setErrorText(err.message || "Could not finish signing you in.");
      }
    };

    const failWith = (message: string) => {
      if (settled) return;
      settled = true;
      setErrorText(message);
      setTimeout(() => navigate("/auth", { replace: true }), 3500);
    };

    // Confirm-signup and magic links come back with the tokens in the hash
    // (implicit flow); the browser client only watches for a PKCE `?code=`,
    // so those links would otherwise sit here until the timeout. OAuth still
    // resolves through the listener below.
    consumeAuthFromUrl(supabase).then((res) => {
      if (res.status === "error") failWith(res.message);
      // 'session' is picked up by onAuthStateChange / getSession below
    });

    // Catch the session whenever the automatic exchange completes…
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) routeTo(session);
    });

    // …and cover the case where it finished before this effect ran.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) routeTo(session);
    });

    // Give up rather than spinning forever (link opened in another browser,
    // storage cleared, expired link, etc.)
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      setErrorText(
        "That sign-in link couldn't be completed. It may have expired, already been used, or been opened in a different browser. Please request a new one."
      );
      setTimeout(() => navigate("/auth", { replace: true }), 3500);
    }, 12000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [navigate]);

  return (
    <div className="min-h-screen bg-[#111111] flex items-center justify-center px-4">
      <div className="text-white text-center">
        {errorText ? (
          <>
            <p className="text-red-400 font-bold max-w-sm">{errorText}</p>
            <p className="text-white/40 text-xs font-semibold mt-3">Taking you back to sign in…</p>
          </>
        ) : (
          <>
            <div className="w-8 h-8 border-2 border-[#F4511E] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-400">Signing you in…</p>
          </>
        )}
      </div>
    </div>
  );
}
