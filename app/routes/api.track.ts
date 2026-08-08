import { type ActionFunctionArgs } from "react-router";
import { serviceClient, jsonRoute } from "~/lib/service-client.server";
import { createSupabaseServerClient } from "~/lib/supabase.server";

const ALLOWED_EVENTS = new Set([
  "pageview", "signup_started", "profile_completed",
  "gig_applied", "internship_applied", "gig_posted",
]);

/**
 * First-party analytics beacon.
 *
 * Privacy stance: we store a path, a coarse device class, the referring host
 * (not the full URL), and a random per-tab session id. No IP addresses, no
 * user agents, no cross-site identifiers. Enough to answer "how many people
 * came and what did they do", not enough to profile anyone.
 */
export const action = jsonRoute(async ({ request }: ActionFunctionArgs) => {
  try {
    const body = await request.json();
    const eventName = String(body.event ?? "pageview");
    if (!ALLOWED_EVENTS.has(eventName)) {
      return Response.json({ ok: false }, { status: 400 });
    }

    // Attach the user id when there's a session, but never require one
    let userId: string | null = null;
    try {
      const supabase = createSupabaseServerClient(request);
      const { data: { user } } = await supabase.auth.getUser();
      userId = user?.id ?? null;
    } catch { /* anonymous visitor */ }

    let referrerHost: string | null = null;
    if (body.referrer) {
      try { referrerHost = new URL(String(body.referrer)).host.slice(0, 120); } catch { /* ignore */ }
    }

    const device = ["mobile", "tablet", "desktop"].includes(body.device) ? body.device : null;

    await serviceClient().from("analytics_events").insert({
      event_name: eventName,
      path: String(body.path ?? "").slice(0, 300) || null,
      referrer_host: referrerHost,
      session_id: String(body.session ?? "").slice(0, 64) || null,
      user_id: userId,
      device,
      metadata: body.metadata && typeof body.metadata === "object" ? body.metadata : null,
    });

    return Response.json({ ok: true });
  } catch (e) {
    // Analytics must never break a page load
    console.error("[api.track]", e);
    return Response.json({ ok: false }, { status: 200 });
  }
});
