import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * The service-role Supabase client, created in one place.
 *
 * Every API route used to build this inline with
 * `createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)`.
 * Those non-null assertions are a lie at runtime: if either variable is absent
 * on the server, createClient throws, the throw escapes the route, and the
 * framework returns the plain-text "Unexpected Server Error" — which the
 * browser then fails to parse as JSON ("Unexpected token 'U'"). That is a
 * confusing way to learn an env var is missing.
 *
 * So: fall back through every name the URL might have (including the
 * build-time inlined one, which is always present because the build needs
 * it), and if the service key really is missing, fail with a message that
 * names the variable.
 */

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  import.meta.env?.VITE_SUPABASE_URL ||
  "";

const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  "";

export function serviceRoleConfigured() {
  return Boolean(SUPABASE_URL && SERVICE_KEY);
}

/** Which piece is missing, for the admin health panel. */
export function serviceRoleStatus() {
  return {
    url: Boolean(SUPABASE_URL),
    key: Boolean(SERVICE_KEY),
    missing: [
      !SUPABASE_URL && "SUPABASE_URL (or VITE_SUPABASE_URL)",
      !SERVICE_KEY && "SUPABASE_SERVICE_ROLE_KEY",
    ].filter(Boolean) as string[],
  };
}

let cached: SupabaseClient | null = null;

export function serviceClient(): SupabaseClient {
  if (cached) return cached;

  if (!SUPABASE_URL || !SERVICE_KEY) {
    const missing = serviceRoleStatus().missing.join(" and ");
    throw new Error(
      `Server is missing ${missing}. Set it in your hosting environment ` +
      `(Vercel → Project → Settings → Environment Variables) and redeploy.`
    );
  }

  cached = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cached;
}

/**
 * Wraps a route handler so it can never return a non-JSON body. Thrown
 * Responses (redirects, 404s from requireAdmin) pass through untouched;
 * anything else becomes a JSON 500 the client can actually read.
 */
export function jsonRoute<A>(handler: (args: A) => Promise<Response>) {
  return async (args: A): Promise<Response> => {
    try {
      return await handler(args);
    } catch (err: any) {
      if (err instanceof Response) return err;
      console.error("[api]", err);
      return Response.json(
        { error: err?.message ?? "Something went wrong on our side. Please try again." },
        { status: 500 }
      );
    }
  };
}
