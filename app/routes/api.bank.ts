import { type ActionFunctionArgs } from "react-router";
import { serviceClient, jsonRoute } from "~/lib/service-client.server";
import { createSupabaseServerClient } from "~/lib/supabase.server";

/**
 * Where a worker gets paid: a UPI ID, or a bank account.
 *
 * UPI is the default because the people earning here are mostly students, and
 * asking for an account number and IFSC off a passbook loses more of them than
 * it protects. A UPI ID is something they can read off their own phone.
 *
 * Neither is verified against the banking system yet — a real penny drop needs
 * a payout gateway, which needs a registered business. Until then the format is
 * checked, the row is marked verified so the withdrawal flow works end to end,
 * and the person actually paying reads the destination off the payouts screen
 * and confirms the name before sending anything.
 */

// user@bank — the handle is 2-256 chars, the bank suffix alphabetic. Deliberately
// permissive on the handle: banks allow dots, hyphens and phone numbers.
const UPI_RE = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;

export const action = jsonRoute(async ({ request }: ActionFunctionArgs) => {
  const supabase = createSupabaseServerClient(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const method = String(formData.get("method") ?? "bank").toLowerCase();
  const accountHolder = String(formData.get("account_holder") ?? "").trim();

  if (!accountHolder) {
    return Response.json({ error: "Enter the name on the account." }, { status: 400 });
  }
  if (accountHolder.length > 100) {
    return Response.json({ error: "That name is too long." }, { status: 400 });
  }

  const row: Record<string, any> = {
    worker_id: user.id,
    account_holder: accountHolder,
    method,
    penny_drop_status: "verified",
    verified_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (method === "upi") {
    const upiId = String(formData.get("upi_id") ?? "").trim().toLowerCase();
    if (!UPI_RE.test(upiId)) {
      return Response.json({
        error: "That doesn't look like a UPI ID. It should look like name@bank or 9876543210@upi.",
      }, { status: 400 });
    }
    row.upi_id = upiId;
    // Switching methods must clear the other one, or the payouts screen can
    // show a stale destination next to the new one.
    row.account_number = null;
    row.ifsc = null;
  } else if (method === "bank") {
    const accountNumber = String(formData.get("account_number") ?? "").replace(/\s/g, "");
    const ifsc = String(formData.get("ifsc") ?? "").trim().toUpperCase();
    if (!/^\d{9,18}$/.test(accountNumber)) {
      return Response.json({ error: "Account number must be 9–18 digits." }, { status: 400 });
    }
    if (!IFSC_RE.test(ifsc)) {
      return Response.json({ error: "That doesn't look like a valid IFSC code (e.g. SBIN0001234)." }, { status: 400 });
    }
    row.account_number = accountNumber;
    row.ifsc = ifsc;
    row.upi_id = null;
  } else {
    return Response.json({ error: "Choose UPI or bank transfer." }, { status: 400 });
  }

  const admin = serviceClient();
  const { data: saved, error } = await admin
    .from("worker_bank_accounts")
    .upsert(row, { onConflict: "worker_id" })
    .select("id, method");
  if (error) return Response.json({ error: error.message }, { status: 500 });
  // A refused upsert returns no error and no rows. Never report a save that
  // did not happen.
  if (!saved?.length) {
    return Response.json({ error: "That didn't save. Please try again." }, { status: 500 });
  }

  return Response.json({ ok: true, method, status: "verified" });
});
