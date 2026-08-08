import { type ActionFunctionArgs } from "react-router";
import { serviceClient, jsonRoute } from "~/lib/service-client.server";
import { createSupabaseServerClient } from "~/lib/supabase.server";

// Save (upsert) the worker's bank details for withdrawals.
// Penny-drop verification will go through Razorpay once the gateway is
// integrated — until then details are validated by format and marked verified
// so the withdrawal flow can be exercised end-to-end.
export const action = jsonRoute(async ({ request }: ActionFunctionArgs) => {
  const supabase = createSupabaseServerClient(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const accountNumber = ((formData.get("account_number") as string) || "").replace(/\s/g, "");
  const ifsc = ((formData.get("ifsc") as string) || "").trim().toUpperCase();
  const accountHolder = ((formData.get("account_holder") as string) || "").trim();

  if (!/^\d{9,18}$/.test(accountNumber)) {
    return Response.json({ error: "Account number must be 9–18 digits." }, { status: 400 });
  }
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) {
    return Response.json({ error: "That doesn't look like a valid IFSC code (e.g. SBIN0001234)." }, { status: 400 });
  }
  if (!accountHolder) {
    return Response.json({ error: "Account holder name is required." }, { status: 400 });
  }

  const admin = serviceClient();

  // TODO(razorpay): replace with a real penny-drop via Razorpay Fund Account
  // Validation API. Until the gateway is integrated, format-validated details
  // are marked verified so withdrawals can be tested.
  const { error } = await admin.from("worker_bank_accounts").upsert(
    {
      worker_id: user.id,
      account_number: accountNumber,
      ifsc,
      account_holder: accountHolder,
      penny_drop_status: "verified",
      verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "worker_id" }
  );
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ ok: true, status: "verified" });
});
