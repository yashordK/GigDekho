import { type ActionFunctionArgs } from "react-router";
import { jsonRoute } from "~/lib/service-client.server";
import { requireAdmin, logAdminAction } from "~/lib/admin.server";
import { sendEmail } from "~/lib/email.server";

const SITE = process.env.SITE_URL || "https://gigdekho.com";

function claimEmail(name: string, email: string, createdBy: string) {
  return {
    subject: `Your GigDekho account is ready — ${name}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#111111;color:#ffffff;padding:24px;border-radius:12px;">
        <div style="color:#F4511E;font-size:24px;font-weight:bold;margin-bottom:4px;">GigDekho</div>
        <h2 style="margin-top:0;">An account has been set up for you</h2>
        <p style="color:#9ca3af;line-height:1.6;">
          Hi ${name}, the GigDekho team (${createdBy}) has created a hirer account for you at
          <strong style="color:#fff;">${email}</strong> so we can help you get staff and applicants quickly.
        </p>
        <p style="color:#9ca3af;line-height:1.6;">
          <strong style="color:#fff;">It's your account.</strong> Sign in with this email address any time to take
          full control — view applicants, post your own listings, and manage everything yourself. No password
          needed to start; just use the sign-in link.
        </p>
        <p style="margin:24px 0;">
          <a href="${SITE}/auth?mode=organizer" style="background:#F4511E;color:#fff;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:8px;display:inline-block;">Take control of your account</a>
        </p>
        <p style="color:#6b7280;font-size:12px;line-height:1.6;">
          Didn't expect this? Reply to this email and we'll delete the account and all its data immediately.
        </p>
      </div>`,
  };
}

function gigPostedEmail(name: string, gigTitle: string, count: number) {
  return {
    subject: `✅ Your listing is live on GigDekho — ${gigTitle}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#111111;color:#ffffff;padding:24px;border-radius:12px;">
        <div style="color:#F4511E;font-size:24px;font-weight:bold;margin-bottom:4px;">GigDekho</div>
        <h2 style="margin-top:0;">Your listing is live 🎉</h2>
        <p style="color:#9ca3af;line-height:1.6;">
          Hi ${name}, the GigDekho team has posted <strong style="color:#fff;">${gigTitle}</strong>${count > 1 ? ` (${count} roles)` : ""} on your behalf.
          Applications will start coming in shortly.
        </p>
        <p style="color:#9ca3af;line-height:1.6;">
          Sign in with this email address to see applicants, message them, and manage the listing yourself.
        </p>
        <p style="margin:24px 0;">
          <a href="${SITE}/auth?mode=organizer" style="background:#F4511E;color:#fff;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:8px;display:inline-block;">View your dashboard</a>
        </p>
      </div>`,
  };
}

export const action = jsonRoute(async ({ request }: ActionFunctionArgs) => {
  const ctx = await requireAdmin(request);
  const fd = await request.formData();
  const intent = String(fd.get("intent") ?? "");

  // ── Create an account on a business's behalf ──
  if (intent === "create") {
    const email = String(fd.get("email") ?? "").trim().toLowerCase();
    const name = String(fd.get("name") ?? "").trim();
    const companyName = String(fd.get("company_name") ?? "").trim();
    const phone = String(fd.get("phone") ?? "").trim();
    const city = String(fd.get("city") ?? "Indore").trim();
    const note = String(fd.get("internal_note") ?? "").trim();

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return Response.json({ error: "Enter a valid email address." }, { status: 400 });
    }
    if (!name) return Response.json({ error: "Contact name is required." }, { status: 400 });

    // Reuse an existing auth user if this email already signed up
    const { data: existingProfile } = await ctx.admin
      .from("profiles").select("id, is_managed").eq("email", email).maybeSingle();
    if (existingProfile) {
      return Response.json(
        { error: "An account with that email already exists on GigDekho." },
        { status: 400 }
      );
    }

    // email_confirm: true — the owner never has to click a verification link;
    // they simply sign in with this address whenever they want to take over.
    const { data: created, error: createErr } = await ctx.admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { created_by_admin: true, full_name: name },
    });
    if (createErr || !created?.user) {
      return Response.json({ error: createErr?.message ?? "Could not create the account." }, { status: 500 });
    }

    // A database trigger on auth.users already inserts a bare profile row
    // (role 'worker') the moment the auth user is created. Inserting here
    // collided with it on the primary key, so every attempt failed with a
    // 500 — and left the auth user behind, which made the retry report
    // "already exists". Upsert takes ownership of that row instead.
    const { error: profileErr } = await ctx.admin.from("profiles").upsert(
      {
        id: created.user.id,
        full_name: name,
        email,
        phone: phone || null,
        city: city || "Indore",
        role: "organizer",
        company_name: companyName || null,
        is_managed: true,
        managed_by: ctx.adminId,
        internal_note: note || null,
      },
      { onConflict: "id" }
    );
    if (profileErr) {
      // Don't leave a half-created account behind — including the row the
      // trigger made, or the next attempt hits "already exists".
      await ctx.admin.from("profiles").delete().eq("id", created.user.id);
      await ctx.admin.auth.admin.deleteUser(created.user.id).catch(() => {});
      return Response.json({ error: profileErr.message }, { status: 500 });
    }

    await logAdminAction(ctx, "create_managed_account", `Created managed hirer ${companyName || name} <${email}>`, {
      targetUserId: created.user.id,
    });

    sendEmail({ to: email, ...claimEmail(name, email, ctx.adminName) })
      .catch((e) => console.error("[admin.accounts] claim email:", e));

    return Response.json({ ok: true, id: created.user.id });
  }

  // ── Notify the business that we posted for them ──
  if (intent === "notify_posted") {
    const accountId = String(fd.get("account_id") ?? "");
    const gigTitle = String(fd.get("gig_title") ?? "a new listing");
    const roleCount = Number(fd.get("role_count") ?? 1);
    if (!accountId) return Response.json({ error: "Missing account_id" }, { status: 400 });

    const { data: acct } = await ctx.admin
      .from("profiles").select("id, full_name, company_name, email").eq("id", accountId).single();
    if (!acct) return Response.json({ error: "not_found" }, { status: 404 });

    await logAdminAction(ctx, "post_on_behalf", `Posted "${gigTitle}" for ${acct.company_name || acct.full_name}`, {
      targetUserId: accountId,
    });

    if (acct.email) {
      sendEmail({ to: acct.email, ...gigPostedEmail(acct.full_name ?? "there", gigTitle, roleCount) })
        .catch((e) => console.error("[admin.accounts] posted email:", e));
    }
    return Response.json({ ok: true });
  }

  // ── Re-send the claim email ──
  if (intent === "resend_claim") {
    const accountId = String(fd.get("account_id") ?? "");
    const { data: acct } = await ctx.admin
      .from("profiles").select("full_name, email").eq("id", accountId).single();
    if (!acct?.email) return Response.json({ error: "No email on that account" }, { status: 400 });

    await sendEmail({ to: acct.email, ...claimEmail(acct.full_name ?? "there", acct.email, ctx.adminName) });
    await logAdminAction(ctx, "resend_claim_email", `Re-sent claim email to ${acct.email}`, { targetUserId: accountId });
    return Response.json({ ok: true });
  }

  return Response.json({ error: "Unknown intent" }, { status: 400 });
});
