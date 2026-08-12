import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Turns whatever Supabase put in the landing URL into a real session.
 *
 * Supabase's email links (confirm signup, magic link, password recovery) go
 * through `/auth/v1/verify`, which 303s back here with the tokens in the URL
 * *hash* — the implicit flow. The browser client from `@supabase/ssr` is a
 * PKCE client: it watches for `?code=` and ignores hash tokens entirely. So a
 * perfectly valid recovery link would sit there with a live access_token in
 * the address bar while the page waited for a session that was never coming,
 * and eventually reported "Link expired or invalid".
 *
 * OAuth (Google) is unaffected — that genuinely is PKCE and the client
 * handles it — which is why sign-in worked while every emailed link didn't.
 */

export interface AuthUrlParams {
  accessToken: string | null;
  refreshToken: string | null;
  /** 'recovery' | 'signup' | 'magiclink' | 'invite' | … */
  type: string | null;
  error: string | null;
  errorDescription: string | null;
  /** PKCE flow — the client consumes this one on its own. */
  hasCode: boolean;
}

export function readAuthParamsFromUrl(): AuthUrlParams {
  if (typeof window === "undefined") {
    return { accessToken: null, refreshToken: null, type: null, error: null, errorDescription: null, hasCode: false };
  }
  const url = new URL(window.location.href);
  const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
  const pick = (k: string) => hash.get(k) ?? url.searchParams.get(k);

  return {
    accessToken: pick("access_token"),
    refreshToken: pick("refresh_token"),
    type: pick("type"),
    error: pick("error") ?? pick("error_code"),
    errorDescription: pick("error_description"),
    hasCode: url.searchParams.has("code"),
  };
}

/**
 * Strip credentials out of the address bar once they've been used.
 *
 * The hash carries a live access_token and refresh_token. Leaving them there
 * puts working credentials into browser history, screenshots and anything the
 * user pastes when asking for help, so clear the whole thing.
 */
const AUTH_KEYS = new Set([
  "access_token", "refresh_token", "expires_at", "expires_in", "token_type",
  "type", "code", "error", "error_code", "error_description", "sb",
]);

export function clearAuthParamsFromUrl() {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  for (const k of Array.from(url.searchParams.keys())) {
    if (AUTH_KEYS.has(k)) url.searchParams.delete(k);
  }
  const clean = url.pathname + (url.searchParams.toString() ? `?${url.searchParams}` : "");
  window.history.replaceState({}, "", clean);
}

export type ConsumeResult =
  | { status: "session" }
  | { status: "error"; message: string }
  | { status: "none" };

/** Human wording for the codes Supabase puts in the URL. */
function explain(error: string, description: string | null): string {
  const d = (description ?? "").replace(/\+/g, " ");
  if (/expired/i.test(error) || /expired/i.test(d)) {
    return "That link has expired. Reset links are single-use and only last a short while — request a fresh one.";
  }
  if (/access_denied/i.test(error)) {
    return "That link is no longer valid. It may have already been used — request a fresh one.";
  }
  return d || "That link could not be verified. Request a fresh one.";
}

/**
 * Establishes a session from the URL if there is one to establish.
 * Returns 'none' when the URL carries nothing (or carries a PKCE `?code=`,
 * which the client handles by itself — callers should keep waiting then).
 */
export async function consumeAuthFromUrl(supabase: SupabaseClient): Promise<ConsumeResult> {
  const p = readAuthParamsFromUrl();

  if (p.error) {
    clearAuthParamsFromUrl();
    return { status: "error", message: explain(p.error, p.errorDescription) };
  }

  if (p.accessToken && p.refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: p.accessToken,
      refresh_token: p.refreshToken,
    });
    clearAuthParamsFromUrl();
    if (error) return { status: "error", message: error.message };
    return { status: "session" };
  }

  return { status: "none" };
}
