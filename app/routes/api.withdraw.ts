import { type ActionFunctionArgs } from "react-router";
import { serviceClient, jsonRoute } from "~/lib/service-client.server";
import { createSupabaseServerClient } from "~/lib/supabase.server";

// Withdraw from wallet balance. Balance, minimum, and bank verification are
// all checked server-side. Actual bank transfer is processed manually until
// Razorpay Payouts is integrated.
export const action = jsonRoute(async ({ request }: ActionFunctionArgs) => {
  const supabase = createSupabaseServerClient(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const amount = Math.round(Number(formData.get("amount")));
  if (!Number.isFinite(amount) || amount <= 0) {
    return Response.json({ error: "Enter a valid amount." }, { status: 400 });
  }

  const admin = serviceClient();

  // Configurable minimum (admin-editable app_settings, env fallback)
  const { data: setting } = await admin.from("app_settings").select("value").eq("key", "min_withdrawal_amount").maybeSingle();
  const minWithdrawal = Number(setting?.value ?? process.env.MIN_WITHDRAWAL_AMOUNT ?? 100);
  if (amount < minWithdrawal) {
    return Response.json({ error: `Minimum withdrawal is ₹${minWithdrawal}.` }, { status: 400 });
  }

  // Verified bank account required
  const { data: bank } = await admin
    .from("worker_bank_accounts")
    .select("id, penny_drop_status, account_number, ifsc")
    .eq("worker_id", user.id)
    .maybeSingle();
  if (!bank || bank.penny_drop_status !== "verified") {
    return Response.json({ error: "bank_not_verified" }, { status: 400 });
  }

  // Available balance = completed/pending credits − debits (withdrawal txns are stored negative)
  const { data: txns } = await admin
    .from("wallet_transactions")
    .select("amount, status")
    .eq("worker_id", user.id)
    .neq("status", "failed");
  const balance = (txns || []).reduce((acc, t) => acc + t.amount, 0);

  if (amount > balance) {
    return Response.json({ error: `Insufficient balance — you have ₹${balance}.` }, { status: 400 });
  }

  // Record the request + debit atomically enough for this flow:
  // debit is 'pending' until the transfer is processed.
  const { data: wr, error: wrErr } = await admin
    .from("withdrawal_requests")
    .insert({
      worker_id: user.id,
      amount,
      bank_account: `${bank.account_number} (${bank.ifsc})`,
      status: "pending",
    })
    .select("id")
    .single();
  if (wrErr) return Response.json({ error: wrErr.message }, { status: 500 });

  const { error: txErr } = await admin.from("wallet_transactions").insert({
    worker_id: user.id,
    amount: -amount,
    type: "withdrawal",
    status: "pending",
    reference_id: wr.id,
    description: `Withdrawal to bank ending ${bank.account_number.slice(-4)}`,
  });
  if (txErr) {
    // Roll back the request so balance stays consistent
    await admin.from("withdrawal_requests").delete().eq("id", wr.id);
    return Response.json({ error: txErr.message }, { status: 500 });
  }

  return Response.json({ ok: true, id: wr.id, balance: balance - amount });
});
