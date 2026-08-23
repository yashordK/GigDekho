import { type ActionFunctionArgs } from "react-router";
import { serviceClient, jsonRoute } from "~/lib/service-client.server";
import { createSupabaseServerClient } from "~/lib/supabase.server";
import { attachReferral } from "~/lib/referrals.server";

/**
 * Claims a referral code for the signed-in user.
 *
 * Runs server-side because it writes another person's referral row and sets
 * referred_by — neither of which a user should be able to do for themselves
 * from the browser. The client just forwards whatever code it captured from
 * the landing URL.
 *
 * Always answers 200 with a reason. A referral is a bonus: a bad or already
 * used code should never look like a broken signup.
 */
export const action = jsonRoute(async ({ request }: ActionFunctionArgs) => {
  const supabase = createSupabaseServerClient(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ ok: false, reason: "not_signed_in" });

  let code = "";
  try {
    const fd = await request.formData();
    code = String(fd.get("code") ?? "");
  } catch {
    return Response.json({ ok: false, reason: "bad_request" });
  }

  const admin = serviceClient();
  const result = await attachReferral(admin, user.id, code);
  return Response.json(result);
});
