import { type ActionFunctionArgs } from "react-router";
import { requireAdmin, logAdminAction } from "~/lib/admin.server";

/**
 * Reel review mutations.
 *
 * A resource route rather than the page's own action: a fetch() POST to a page
 * path is treated as a document request, so React Router re-renders the page
 * and answers with HTML instead of the action's JSON. Every other mutation in
 * this app posts to an /api/* route for the same reason.
 *
 * Both payments are idempotent — the wallet write is keyed on the submission
 * id and its type, so a double tap cannot pay twice.
 */
export async function action({ request }: ActionFunctionArgs) {
  const ctx = await requireAdmin(request);
  const fd = await request.formData();
  const id = String(fd.get("id") ?? "");
  const intent = String(fd.get("intent") ?? "");
  const note = String(fd.get("note") ?? "").trim() || null;
  if (!id) return Response.json({ error: "Missing id" }, { status: 400 });

  const { data: reel } = await ctx.admin
    .from("reel_submissions")
    .select("*, worker:profiles!reel_submissions_worker_id_fkey(full_name), gig:gigs(title)")
    .eq("id", id)
    .maybeSingle();
  if (!reel) return Response.json({ error: "not_found" }, { status: 404 });

  const settings = await ctx.admin.from("app_settings").select("key, value").like("key", "reel%");
  const get = (k: string, d: number) => Number((settings.data ?? []).find((s: any) => s.key === k)?.value ?? d);
  const perReel = get("reel_bonus_per_reel", 50);
  const viewsBonus = get("reel_views_bonus", 50);
  const maxPerGig = get("reel_bonus_max_per_gig", 100);

  /**
   * Apply a review decision and prove it landed.
   *
   * A silently-reverted update here is the worst possible outcome: the wallet
   * is credited, the worker is notified, and the submission stays in the queue
   * looking unpaid. That is exactly what a trigger bug caused once, so the
   * row count is checked rather than assumed.
   */
  const applyUpdate = async (patch: Record<string, unknown>) => {
    const { data, error } = await ctx.admin
      .from("reel_submissions")
      .update(patch)
      .eq("id", id)
      .select("id");
    if (error) return error.message;
    if (!data || data.length === 0) {
      return "The decision could not be saved — nothing was updated. Check the reel review policies.";
    }
    return null;
  };

  /** Pay once, ever, for a given submission and reason. */
  const credit = async (amount: number, type: string, description: string) => {
    const { data: existing } = await ctx.admin
      .from("wallet_transactions")
      .select("id")
      .eq("reference_id", id)
      .eq("type", type)
      .maybeSingle();
    if (existing) return { skipped: true };

    const { error } = await ctx.admin.from("wallet_transactions").insert({
      worker_id: reel.worker_id,
      amount,
      type,
      status: "completed",
      reference_id: id,
      description,
    });
    if (error) return { error: error.message };
    return { paid: true };
  };

  if (intent === "approve") {
    // Never pay past the per-gig ceiling, however many get approved.
    const { data: paidForGig } = await ctx.admin
      .from("reel_submissions")
      .select("id")
      .eq("gig_id", reel.gig_id)
      .eq("worker_id", reel.worker_id)
      .eq("status", "approved")
      .not("base_paid_at", "is", null);
    const alreadyPaid = (paidForGig ?? []).length * perReel;
    if (alreadyPaid + perReel > maxPerGig) {
      return Response.json(
        { error: `That would exceed the ₹${maxPerGig} reel cap for this gig (₹${alreadyPaid} already paid).` },
        { status: 400 }
      );
    }

    const res = await credit(perReel, "reel_bonus", `Reel reward — ${reel.gig?.title ?? "gig"}`);
    if (res.error) return Response.json({ error: res.error }, { status: 500 });

    const upErr = await applyUpdate({
      status: "approved",
      review_note: note,
      reviewed_by: ctx.adminId,
      reviewed_at: new Date().toISOString(),
      base_paid_at: new Date().toISOString(),
    });
    if (upErr) return Response.json({ error: upErr }, { status: 500 });

    await ctx.admin.from("notifications").insert({
      user_id: reel.worker_id,
      type: "reel_approved",
      title: `₹${perReel} added to your wallet`,
      body: `Your reel for ${reel.gig?.title ?? "your gig"} was approved. Thanks for sharing it!`,
      link: "/worker/earnings",
    }).then(() => {}, () => {});

    await logAdminAction(ctx, "approve_reel", `Approved reel ${reel.reel_url} (₹${perReel})`, { targetUserId: reel.worker_id });
    return Response.json({ ok: true });
  }

  if (intent === "reject") {
    const upErr = await applyUpdate({
      status: "rejected",
      review_note: note,
      reviewed_by: ctx.adminId,
      reviewed_at: new Date().toISOString(),
    });
    if (upErr) return Response.json({ error: upErr }, { status: 500 });
    await logAdminAction(ctx, "reject_reel", `Rejected reel ${reel.reel_url}${note ? ` — ${note}` : ""}`, { targetUserId: reel.worker_id });
    return Response.json({ ok: true });
  }

  if (intent === "approve_views") {
    // Once per gig, not once per reel — the offer is a single bonus.
    const { data: alreadyForGig } = await ctx.admin
      .from("reel_submissions")
      .select("id")
      .eq("gig_id", reel.gig_id)
      .eq("worker_id", reel.worker_id)
      .eq("views_status", "approved");
    if ((alreadyForGig ?? []).some((r: any) => r.id !== id)) {
      return Response.json({ error: "They've already had the views bonus for this gig." }, { status: 400 });
    }

    const res = await credit(viewsBonus, "reel_views_bonus", `Reel views bonus — ${reel.gig?.title ?? "gig"}`);
    if (res.error) return Response.json({ error: res.error }, { status: 500 });

    const upErr = await applyUpdate({
      views_status: "approved",
      views_reviewed_by: ctx.adminId,
      views_reviewed_at: new Date().toISOString(),
      views_paid_at: new Date().toISOString(),
    });
    if (upErr) return Response.json({ error: upErr }, { status: 500 });

    await ctx.admin.from("notifications").insert({
      user_id: reel.worker_id,
      type: "reel_views_bonus",
      title: `₹${viewsBonus} views bonus added`,
      body: "Your reel passed the views target. Nice one!",
      link: "/worker/earnings",
    }).then(() => {}, () => {});

    await logAdminAction(ctx, "approve_reel_views", `Approved views bonus for ${reel.reel_url} (₹${viewsBonus})`, { targetUserId: reel.worker_id });
    return Response.json({ ok: true });
  }

  if (intent === "reject_views") {
    const upErr = await applyUpdate({
      views_status: "rejected",
      views_reviewed_by: ctx.adminId,
      views_reviewed_at: new Date().toISOString(),
    });
    if (upErr) return Response.json({ error: upErr }, { status: 500 });
    await logAdminAction(ctx, "reject_reel_views", `Rejected views claim for ${reel.reel_url}`, { targetUserId: reel.worker_id });
    return Response.json({ ok: true });
  }

  return Response.json({ error: "Unknown intent" }, { status: 400 });
}
