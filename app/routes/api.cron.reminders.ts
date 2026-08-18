import { type LoaderFunctionArgs } from "react-router";
import { serviceClient } from "~/lib/service-client.server";
import { sendEmail, reminder48hEmail, reminder24hEmail, reminder6hEmail, noShowPenaltyEmail } from "~/lib/email.server";

export async function loader({ request }: LoaderFunctionArgs) {
  // Vercel cron sends Authorization: Bearer <CRON_SECRET>
  // Fail closed: if CRON_SECRET isn't configured, nobody can trigger this endpoint.
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = serviceClient();
  const now = new Date();
  const results = { reminders48h: 0, reminders24h: 0, reminders6h: 0, noShows: 0, errors: [] as string[] };

  // ── 48-hour reminders ──────────────────────────────────────────────────────
  try {
    // Day-wide buckets, not a two-hour slot. Vercel Hobby allows one cron run
    // a day with up to 59 minutes of jitter, so a narrow window is missed far
    // more often than it is hit. 36-60h means "the gig is two days away" and
    // catches every accepted application exactly once, whenever the run lands.
    const win47 = new Date(now.getTime() + 36 * 3600000).toISOString();
    const win49 = new Date(now.getTime() + 60 * 3600000).toISOString();

    const { data: apps } = await admin
      .from("applications")
      .select("id, worker_id, profiles(full_name), gigs(title, event_date, location_text, pay_rate, duration_hrs)")
      .eq("status", "accepted")
      .eq("reminder_48h_sent", false)
      .gte("gigs.event_date", win47)
      .lte("gigs.event_date", win49);

    for (const app of apps ?? []) {
      const gig = app.gigs as any;
      const prof = app.profiles as any;
      if (!gig || !prof) continue;
      const { data: au } = await admin.auth.admin.getUserById(app.worker_id);
      if (au?.user?.email) {
        await sendEmail({ to: au.user.email, ...reminder48hEmail(prof.full_name || "there", gig) });
      }
      await admin.from("applications").update({ reminder_48h_sent: true }).eq("id", app.id);
      results.reminders48h++;
    }
  } catch (e: any) {
    results.errors.push(`48h: ${e.message}`);
  }

  // ── 24-hour reminders ────────────────────────────────────────────────
  try {
    // "The gig is tomorrow" — 12-36h, adjacent to the 48h bucket above with
    // no overlap, so nobody receives both on the same run.
    const win23 = new Date(now.getTime() + 12 * 3600000).toISOString();
    const win25 = new Date(now.getTime() + 36 * 3600000).toISOString();

    const { data: apps } = await admin
      .from("applications")
      .select("id, worker_id, profiles(full_name), gigs(title, event_date, location_text, pay_rate, duration_hrs)")
      .eq("status", "accepted")
      .eq("reminder_24h_sent", false)
      .gte("gigs.event_date", win23)
      .lte("gigs.event_date", win25);

    for (const app of apps ?? []) {
      const gig = app.gigs as any;
      const prof = app.profiles as any;
      if (!gig || !prof) continue;
      const { data: au } = await admin.auth.admin.getUserById(app.worker_id);
      if (au?.user?.email) {
        await sendEmail({ to: au.user.email, ...reminder24hEmail(prof.full_name || "there", gig) });
      }
      await admin.from("applications").update({ reminder_24h_sent: true }).eq("id", app.id);
      results.reminders24h++;
    }
  } catch (e: any) {
    results.errors.push(`24h: ${e.message}`);
  }

  // ── 6-hour reminders ───────────────────────────────────────────────────────
  try {
    // Genuinely impossible on a once-daily cron — a 6-hour window only gets
    // hit if the run happens to land in it. Kept narrow on purpose: it fires
    // properly when the hourly GitHub Actions schedule is enabled, and simply
    // no-ops on the days the Vercel run misses it rather than mailing someone
    // "6 hours to go" a day early.
    const win5 = new Date(now.getTime() + 5 * 3600000).toISOString();
    const win7 = new Date(now.getTime() + 7 * 3600000).toISOString();

    const { data: apps } = await admin
      .from("applications")
      .select("id, worker_id, profiles(full_name), gigs(title, event_date, location_text, pay_rate, duration_hrs)")
      .eq("status", "accepted")
      .eq("reminder_6h_sent", false)
      .gte("gigs.event_date", win5)
      .lte("gigs.event_date", win7);

    for (const app of apps ?? []) {
      const gig = app.gigs as any;
      const prof = app.profiles as any;
      if (!gig || !prof) continue;
      const { data: au } = await admin.auth.admin.getUserById(app.worker_id);
      if (au?.user?.email) {
        await sendEmail({ to: au.user.email, ...reminder6hEmail(prof.full_name || "there", gig) });
      }
      await admin.from("applications").update({ reminder_6h_sent: true }).eq("id", app.id);
      results.reminders6h++;
    }
  } catch (e: any) {
    results.errors.push(`6h: ${e.message}`);
  }

  // ── No-show detection (via SQL function) ───────────────────────────────────
  try {
    const { data: noShowApps, error } = await admin.rpc("mark_and_fetch_no_shows");
    if (error) throw error;

    for (const app of noShowApps ?? []) {
      const { data: au } = await admin.auth.admin.getUserById(app.worker_id);
      if (au?.user?.email) {
        await sendEmail({ to: au.user.email, ...noShowPenaltyEmail(app.worker_name || "there", app.gig_title) });
      }
      results.noShows++;
    }
  } catch (e: any) {
    results.errors.push(`no-show: ${e.message}`);
  }

  return Response.json({ ok: true, ...results, ts: now.toISOString() });
}
