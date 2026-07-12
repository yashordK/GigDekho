import { type ActionFunctionArgs } from "react-router";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "~/lib/supabase.server";

function adminClient() {
  return createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// Simulated payment flow (Razorpay integration pending).
// Amounts are computed server-side from the gig record — never trusted from the client.
export async function action({ request }: ActionFunctionArgs) {
  const supabase = createSupabaseServerClient(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const gigId = formData.get("gig_id") as string;
  const type = formData.get("type") as string; // "advance" | "final"
  if (!gigId || !["advance", "final"].includes(type)) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const admin = adminClient();

  // Verify caller owns the gig
  const { data: gig } = await admin
    .from("gigs")
    .select("id, organizer_id, pay_rate, duration_hrs, slots_filled, status")
    .eq("id", gigId)
    .single();

  if (!gig) return Response.json({ error: "not_found" }, { status: 404 });
  if (gig.organizer_id !== user.id) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }
  if (gig.slots_filled < 1) {
    return Response.json({ error: "No workers hired yet" }, { status: 400 });
  }

  const totalCost = Math.round(gig.pay_rate * gig.duration_hrs * gig.slots_filled);
  const advanceAmount = Math.round(totalCost * 0.3);
  const finalAmount = totalCost - advanceAmount;

  const { data: existing } = await admin
    .from("gig_payments")
    .select("id, advance_paid, final_paid")
    .eq("gig_id", gigId)
    .maybeSingle();

  if (type === "advance") {
    if (existing) {
      return Response.json({ error: "Advance already paid" }, { status: 400 });
    }
    const { error } = await admin.from("gig_payments").insert({
      gig_id: gigId,
      organizer_id: user.id,
      total_worker_cost: totalCost,
      platform_fee: 0,
      organizer_total: totalCost,
      advance_amount: advanceAmount,
      advance_paid: true,
      advance_paid_at: new Date().toISOString(),
      final_amount: finalAmount,
      final_paid: false,
      payout_released: false,
    });
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ ok: true, amount: advanceAmount });
  }

  // type === "final"
  if (!existing || !existing.advance_paid) {
    return Response.json({ error: "Pay the advance first" }, { status: 400 });
  }
  if (existing.final_paid) {
    return Response.json({ error: "Final payment already made" }, { status: 400 });
  }
  const { error } = await admin
    .from("gig_payments")
    .update({
      final_paid: true,
      final_paid_at: new Date().toISOString(),
      final_amount: finalAmount,
      organizer_total: totalCost,
      payout_released: true, // auto-release for the simulated flow
      payout_released_at: new Date().toISOString(),
    })
    .eq("id", existing.id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true, amount: finalAmount });
}
