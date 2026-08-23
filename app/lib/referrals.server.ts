import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Referral rewards.
 *
 * ₹50 to each side, paid when the referred person completes their first gig —
 * not when they sign up. Signup is free to fake; turning up to a gig is not,
 * and it's also the point at which they've become a real user.
 *
 * The referrer is capped at a number of *paid* referrals per calendar month.
 * The cap is counted at payout rather than at signup so someone can invite
 * freely, and only the ones that actually work count against them.
 */

const AMOUNT_KEY = "referral_bonus_amount";
const CAP_KEY = "referral_monthly_cap";

async function settings(admin: SupabaseClient) {
  const { data } = await admin.from("app_settings").select("key, value").like("key", "referral%");
  const get = (k: string, d: number) => Number((data ?? []).find((s: any) => s.key === k)?.value ?? d);
  return { amount: get(AMOUNT_KEY, 50), cap: get(CAP_KEY, 4) };
}

/** First day of the month a date falls in, as a plain YYYY-MM-DD. */
const monthOf = (d: Date) =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;

/**
 * Record who referred whom, at signup.
 *
 * Deliberately permissive about failure: a referral is a bonus, and nothing
 * about it should be able to break someone creating an account. Every path
 * returns a reason rather than throwing.
 */
export async function attachReferral(
  admin: SupabaseClient,
  newUserId: string,
  code: string
): Promise<{ ok: boolean; reason?: string }> {
  const clean = (code || "").trim().toUpperCase();
  if (!clean) return { ok: false, reason: "no_code" };

  const { data: referrer } = await admin
    .from("profiles")
    .select("id")
    .eq("referral_code", clean)
    .maybeSingle();

  if (!referrer) return { ok: false, reason: "unknown_code" };
  if (referrer.id === newUserId) return { ok: false, reason: "self_referral" };

  // A person can only ever be referred once — enforced by a unique constraint
  // on referred_id too, so a race can't create two.
  const { data: existing } = await admin
    .from("referrals")
    .select("id")
    .eq("referred_id", newUserId)
    .maybeSingle();
  if (existing) return { ok: false, reason: "already_referred" };

  const { error } = await admin.from("referrals").insert({
    referrer_id: referrer.id,
    referred_id: newUserId,
    code_used: clean,
    status: "pending",
  });
  if (error) return { ok: false, reason: error.message };

  await admin.from("profiles").update({ referred_by: referrer.id }).eq("id", newUserId);
  return { ok: true };
}

/**
 * Settle a referral once the referred person has completed a gig.
 *
 * Safe to call repeatedly — it no-ops unless there's a pending referral for
 * this person, and the wallet writes are keyed on the referral id so a retry
 * can't pay twice.
 */
export async function settleReferralForCompletedGig(
  admin: SupabaseClient,
  workerId: string,
  applicationId: string
): Promise<{ paid: boolean; reason?: string }> {
  const { data: ref } = await admin
    .from("referrals")
    .select("id, referrer_id, referred_id, status")
    .eq("referred_id", workerId)
    .eq("status", "pending")
    .maybeSingle();

  if (!ref) return { paid: false, reason: "no_pending_referral" };

  const { amount, cap } = await settings(admin);
  const month = monthOf(new Date());

  // Cap counts referrals already PAID to this referrer this month.
  const { count: paidThisMonth } = await admin
    .from("referrals")
    .select("id", { count: "exact", head: true })
    .eq("referrer_id", ref.referrer_id)
    .eq("status", "paid")
    .eq("counted_month", month);

  if ((paidThisMonth ?? 0) >= cap) {
    // Not rejected — they still referred someone real. It simply doesn't pay
    // this month, and the row records why.
    await admin.from("referrals").update({
      status: "qualified",
      qualified_at: new Date().toISOString(),
      qualifying_application_id: applicationId,
      counted_month: month,
    }).eq("id", ref.id);
    return { paid: false, reason: "monthly_cap_reached" };
  }

  const credit = async (userId: string, description: string) => {
    const { data: seen } = await admin
      .from("wallet_transactions")
      .select("id")
      .eq("reference_id", ref.id)
      .eq("type", "referral_bonus")
      .eq("worker_id", userId)
      .maybeSingle();
    if (seen) return true;

    const { error } = await admin.from("wallet_transactions").insert({
      worker_id: userId,
      amount,
      type: "referral_bonus",
      status: "completed",
      reference_id: ref.id,
      description,
    });
    return !error;
  };

  const paidReferrer = await credit(ref.referrer_id, "Referral bonus — your friend completed their first gig");
  const paidReferred = await credit(ref.referred_id, "Referral bonus — welcome to GigDekho");

  if (!paidReferrer || !paidReferred) return { paid: false, reason: "wallet_write_failed" };

  const { data: updated } = await admin.from("referrals").update({
    status: "paid",
    qualified_at: new Date().toISOString(),
    paid_at: new Date().toISOString(),
    qualifying_application_id: applicationId,
    counted_month: month,
  }).eq("id", ref.id).select("id");

  if (!updated || updated.length === 0) return { paid: false, reason: "referral_update_failed" };

  // Tell both sides. Money arriving unannounced is money nobody notices.
  await admin.from("notifications").insert([
    {
      user_id: ref.referrer_id,
      type: "referral_paid",
      title: `₹${amount} referral bonus added`,
      body: "Someone you invited just completed their first gig. Thanks for spreading the word!",
      link: "/worker/earnings",
    },
    {
      user_id: ref.referred_id,
      type: "referral_paid",
      title: `₹${amount} welcome bonus added`,
      body: "That's for joining through a friend's invite — enjoy.",
      link: "/worker/earnings",
    },
  ]).then(() => {}, () => {});

  return { paid: true };
}
