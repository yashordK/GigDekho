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
const MAX_QR_BYTES = 4 * 1024 * 1024;

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

  let qrSkipped = false;

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

    // An optional QR screenshot. Plenty of people know their UPI only as the
    // square their app shows them, and a second way to read the same address
    // is worth having when someone is about to send real money.
    const qr = formData.get("upi_qr");
    if (qr instanceof File && qr.size > 0) {
      if (!qr.type.startsWith("image/")) {
        return Response.json({ error: "The QR code needs to be an image." }, { status: 400 });
      }
      if (qr.size > MAX_QR_BYTES) {
        return Response.json({ error: "That image is too large — take a screenshot rather than a photo." }, { status: 400 });
      }
      const ext = (qr.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
      const path = `${user.id}/upi-qr-${Date.now()}.${ext}`;
      const admin0 = serviceClient();
      const { error: upErr } = await admin0.storage
        .from("payout-qr")
        .upload(path, await qr.arrayBuffer(), { contentType: qr.type, upsert: true });

      // The QR is a convenience; the UPI ID is the thing that actually gets
      // them paid. If the bucket is missing because migration 021 has not run
      // yet, or storage simply has a bad minute, save the ID anyway rather than
      // refusing the whole form and leaving them with no payout method at all.
      if (upErr) {
        console.error("[api.bank] QR upload failed, saving UPI ID without it:", upErr.message);
        qrSkipped = true;
      } else {
        // Remove the previous one rather than letting old payment addresses
        // accumulate in a private bucket nobody prunes.
        const { data: prev } = await admin0
          .from("worker_bank_accounts").select("upi_qr_url").eq("worker_id", user.id).maybeSingle();
        if (prev?.upi_qr_url && prev.upi_qr_url !== path) {
          await admin0.storage.from("payout-qr").remove([prev.upi_qr_url]);
        }
        row.upi_qr_url = path;
      }
    }
  } else if (method === "bank") {
    row.upi_qr_url = null;
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
  let { data: saved, error } = await admin
    .from("worker_bank_accounts")
    .upsert(row, { onConflict: "worker_id" })
    .select("id, method");

  // upi_qr_url arrives with migration 021. If a deploy lands before the
  // migration is run, saving where someone gets paid matters far more than
  // saving their QR image — so drop the column and try again rather than
  // breaking payouts for everyone, including the bank path that never asked
  // for a QR in the first place.
  if (error && /upi_qr_url/.test(error.message ?? "")) {
    const { upi_qr_url, ...rest } = row;
    ({ data: saved, error } = await admin
      .from("worker_bank_accounts")
      .upsert(rest, { onConflict: "worker_id" })
      .select("id, method"));
  }

  if (error) return Response.json({ error: error.message }, { status: 500 });
  // A refused upsert returns no error and no rows. Never report a save that
  // did not happen.
  if (!saved?.length) {
    return Response.json({ error: "That didn't save. Please try again." }, { status: 500 });
  }

  // Tell the truth about the QR rather than letting them believe it saved.
  return Response.json({ ok: true, method, status: "verified", qrSkipped });
});
