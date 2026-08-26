const RESEND_API_KEY = process.env.RESEND_API_KEY!;
const FROM_EMAIL = "GigDekho <noreply@gigdekho.com>";

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailOptions) {
  if (!RESEND_API_KEY) {
    console.warn("[email] RESEND_API_KEY not set, skipping email to:", to);
    return false;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  });
  if (!res.ok) console.error("[email] Resend failed:", await res.text());
  return res.ok;
}

// ── Templates ────────────────────────────────────────────────────────────────

export function applicationAcceptedEmail(
  workerName: string,
  gig: {
    title: string;
    event_date: string;
    location_text: string;
    pay_rate: number;
    duration_hrs: number;
    role_type: string;
  }
) {
  const totalPay = gig.pay_rate * gig.duration_hrs;
  const eventDate = new Date(gig.event_date).toLocaleString("en-IN", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  });
  return {
    subject: `✅ You're confirmed for ${gig.title} — GigDekho`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#111111;color:#ffffff;padding:24px;border-radius:12px;">
        <div style="color:#F4511E;font-size:24px;font-weight:bold;margin-bottom:4px;">GigDekho</div>
        <h2 style="margin-top:0;">You're confirmed! 🎉</h2>
        <p>Hi ${workerName},</p>
        <p>Great news — you've been confirmed for the following gig:</p>
        <div style="background:#1C1C1C;border-radius:8px;padding:16px;margin:16px 0;">
          <div style="font-size:18px;font-weight:bold;margin-bottom:8px;">${gig.title}</div>
          <div style="color:#9ca3af;font-size:14px;">📅 ${eventDate}</div>
          <div style="color:#9ca3af;font-size:14px;">📍 ${gig.location_text}</div>
          <div style="color:#9ca3af;font-size:14px;">💼 ${gig.role_type}</div>
          <div style="color:#F4511E;font-size:18px;font-weight:bold;margin-top:12px;">₹${totalPay} total</div>
        </div>
        <p style="color:#9ca3af;font-size:13px;">Please arrive on time. Your reliability score increases by +5 for every successful attendance.</p>
        <p style="color:#9ca3af;font-size:13px;">Need to cancel? You can do so from your GigDekho dashboard. Cancelling within 24 hours of the scheduled date will affect your reliability score.</p>
        <a href="https://gigdekho.com/worker/dashboard" style="display:inline-block;background:#F4511E;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:8px;">View on Dashboard →</a>
      </div>`,
  };
}

export function waitlistEmail(workerName: string, gigTitle: string, position: number) {
  return {
    subject: `⏳ You're on the waitlist for ${gigTitle} — GigDekho`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#111111;color:#ffffff;padding:24px;border-radius:12px;">
        <div style="color:#F4511E;font-size:24px;font-weight:bold;margin-bottom:4px;">GigDekho</div>
        <h2>You're on the waitlist</h2>
        <p>Hi ${workerName},</p>
        <p>The gig <strong>${gigTitle}</strong> is currently full, but you're #${position} on the waitlist.</p>
        <p>We'll notify you immediately if a spot opens up. Keep an eye on your dashboard!</p>
        <a href="https://gigdekho.com/worker/dashboard" style="display:inline-block;background:#F4511E;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">View Dashboard →</a>
      </div>`,
  };
}

export function promotedFromWaitlistEmail(
  workerName: string,
  gig: { title: string; event_date: string; location_text: string; pay_rate: number; duration_hrs: number }
) {
  const totalPay = gig.pay_rate * gig.duration_hrs;
  return {
    subject: `🎉 A spot opened up — You're confirmed for ${gig.title}!`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#111111;color:#ffffff;padding:24px;border-radius:12px;">
        <div style="color:#F4511E;font-size:24px;font-weight:bold;margin-bottom:4px;">GigDekho</div>
        <h2>Great news — you're in! 🚀</h2>
        <p>Hi ${workerName},</p>
        <p>A spot opened up and you've been automatically confirmed for <strong>${gig.title}</strong>!</p>
        <div style="background:#1C1C1C;border-radius:8px;padding:16px;margin:16px 0;">
          <div style="font-size:18px;font-weight:bold;">${gig.title}</div>
          <div style="color:#9ca3af;font-size:14px;">📍 ${gig.location_text}</div>
          <div style="color:#F4511E;font-size:18px;font-weight:bold;margin-top:8px;">₹${totalPay} total</div>
        </div>
        <a href="https://gigdekho.com/worker/dashboard" style="display:inline-block;background:#F4511E;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">View Dashboard →</a>
      </div>`,
  };
}

export function cancellationConfirmEmail(workerName: string, gigTitle: string, penalty: number) {
  return {
    subject: `Cancellation confirmed — ${gigTitle}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#111111;color:#ffffff;padding:24px;border-radius:12px;">
        <div style="color:#F4511E;font-size:24px;font-weight:bold;margin-bottom:4px;">GigDekho</div>
        <h2>Cancellation confirmed</h2>
        <p>Hi ${workerName},</p>
        <p>Your spot for <strong>${gigTitle}</strong> has been cancelled.</p>
        ${penalty > 0
          ? `<div style="background:#7f1d1d;border-radius:8px;padding:12px;margin:12px 0;">⚠️ Your reliability score has been reduced by ${penalty} points due to the timing of this cancellation.</div>`
          : `<div style="background:#1C1C1C;border-radius:8px;padding:12px;margin:12px 0;">✓ No penalty applied — cancelled with sufficient notice.</div>`
        }
        <a href="https://gigdekho.com/worker/home" style="display:inline-block;background:#F4511E;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Find More Gigs →</a>
      </div>`,
  };
}

export function reminder48hEmail(
  workerName: string,
  gig: { title: string; event_date: string; location_text: string; pay_rate: number; duration_hrs: number }
) {
  const totalPay = gig.pay_rate * gig.duration_hrs;
  const eventDate = new Date(gig.event_date).toLocaleString("en-IN", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  });
  return {
    subject: `⏰ Reminder: Your gig is in 48 hours — ${gig.title}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#111111;color:#ffffff;padding:24px;border-radius:12px;">
        <div style="color:#F4511E;font-size:24px;font-weight:bold;margin-bottom:4px;">GigDekho</div>
        <h2>Your gig is in 48 hours 🕐</h2>
        <p>Hi ${workerName}, just a heads-up!</p>
        <div style="background:#1C1C1C;border-radius:8px;padding:16px;margin:16px 0;">
          <div style="font-size:18px;font-weight:bold;margin-bottom:8px;">${gig.title}</div>
          <div style="color:#9ca3af;font-size:14px;">📅 ${eventDate}</div>
          <div style="color:#9ca3af;font-size:14px;">📍 ${gig.location_text}</div>
          <div style="color:#F4511E;font-size:18px;font-weight:bold;margin-top:12px;">₹${totalPay} total</div>
        </div>
        <p style="color:#9ca3af;font-size:13px;">If you need to cancel, do it now — cancellations within 24 hours will affect your reliability score.</p>
        <a href="https://gigdekho.com/worker/dashboard" style="display:inline-block;background:#F4511E;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">View Dashboard →</a>
      </div>`,
  };
}

export function reminder24hEmail(
  workerName: string,
  gig: { title: string; event_date: string; location_text: string; pay_rate: number; duration_hrs: number }
) {
  const totalPay = gig.pay_rate * gig.duration_hrs;
  const eventDate = new Date(gig.event_date).toLocaleString("en-IN", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  });
  return {
    subject: `Only 24 hours to go — ${gig.title}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#111111;color:#ffffff;padding:24px;border-radius:12px;">
        <div style="color:#F4511E;font-size:24px;font-weight:bold;margin-bottom:4px;">GigDekho</div>
        <h2>Only 24 hours to go</h2>
        <p>Hi ${workerName}, your gig is tomorrow. Here are the details one more time.</p>
        <div style="background:#1C1C1C;border-radius:8px;padding:16px;margin:16px 0;">
          <div style="font-size:18px;font-weight:bold;margin-bottom:8px;">${gig.title}</div>
          <div style="color:#9ca3af;font-size:14px;">${eventDate}</div>
          <div style="color:#9ca3af;font-size:14px;">${gig.location_text}</div>
          <div style="color:#F4511E;font-size:18px;font-weight:bold;margin-top:12px;">₹${totalPay} total</div>
        </div>
        <p style="color:#9ca3af;font-size:13px;">Plan to reach a little early, and carry a photo ID. Cancelling now affects your reliability score, so tell the hirer straight away if something has come up.</p>
        <a href="https://gigdekho.com/worker/dashboard" style="display:inline-block;background:#F4511E;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">View Dashboard</a>
      </div>`,
  };
}

export function reminder6hEmail(
  workerName: string,
  gig: { title: string; event_date: string; location_text: string; pay_rate: number; duration_hrs: number }
) {
  const totalPay = gig.pay_rate * gig.duration_hrs;
  const eventDate = new Date(gig.event_date).toLocaleString("en-IN", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  });
  return {
    subject: `🚨 Starting in 6 hours — ${gig.title}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#111111;color:#ffffff;padding:24px;border-radius:12px;">
        <div style="color:#F4511E;font-size:24px;font-weight:bold;margin-bottom:4px;">GigDekho</div>
        <h2>Head out soon! Your gig starts in 6 hours 🚀</h2>
        <p>Hi ${workerName},</p>
        <div style="background:#1C1C1C;border-radius:8px;padding:16px;margin:16px 0;">
          <div style="font-size:18px;font-weight:bold;">${gig.title}</div>
          <div style="color:#9ca3af;font-size:14px;">📅 ${eventDate}</div>
          <div style="color:#9ca3af;font-size:14px;">📍 ${gig.location_text}</div>
          <div style="color:#F4511E;font-size:18px;font-weight:bold;margin-top:8px;">₹${totalPay}</div>
        </div>
        <p style="color:#9ca3af;font-size:13px;">⚠️ Cancelling or not showing up now will result in a <strong>15 point reliability penalty</strong> and a <strong>₹100 deduction from your next payout</strong>.</p>
        <a href="https://gigdekho.com/worker/dashboard" style="display:inline-block;background:#F4511E;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">View Dashboard →</a>
      </div>`,
  };
}

export function noShowPenaltyEmail(workerName: string, gigTitle: string) {
  return {
    subject: `⚠️ No-show recorded for ${gigTitle} — GigDekho`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#111111;color:#ffffff;padding:24px;border-radius:12px;">
        <div style="color:#F4511E;font-size:24px;font-weight:bold;margin-bottom:4px;">GigDekho</div>
        <h2>No-show recorded</h2>
        <p>Hi ${workerName},</p>
        <p>You were marked as a no-show for <strong>${gigTitle}</strong>.</p>
        <div style="background:#7f1d1d;border-radius:8px;padding:12px;margin:12px 0;">
          <p style="margin:0;">⚠️ <strong>Penalties applied:</strong></p>
          <ul style="color:#fca5a5;margin:8px 0 0;padding-left:16px;">
            <li>−20 reliability score points</li>
            <li>₹100 deducted from your next payout</li>
          </ul>
        </div>
        <p style="color:#9ca3af;font-size:13px;">Repeated no-shows may result in account suspension. If this was an error, contact support.</p>
        <a href="https://gigdekho.com/worker/home" style="display:inline-block;background:#F4511E;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Find More Gigs →</a>
      </div>`,
  };
}


/**
 * The gig is done and the money is in their wallet.
 *
 * This is the one email a worker is guaranteed to open, so it carries the two
 * things they need next: how to actually get the money out, and the fact that
 * a reel is worth real money on top. Both are stated as amounts rather than as
 * features — "up to ₹150 more" is a reason to read on; "reel rewards are
 * available" is not.
 *
 * The reel figures are passed in rather than hardcoded, because they live in
 * app_settings and an email that contradicts the site is worse than no email.
 */
export function gigPaidEmail(
  workerName: string,
  opts: {
    amount: number;
    gigTitle: string;
    minWithdrawal: number;
    perReel: number;
    maxPerGig: number;
    viewsBonus: number;
    viewsThreshold: number;
    hasPayoutMethod: boolean;
  }
) {
  const maxReels = Math.max(1, Math.floor(opts.maxPerGig / opts.perReel));
  const maxTotal = opts.maxPerGig + opts.viewsBonus;

  return {
    subject: `₹${opts.amount} added to your GigDekho wallet`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#111111;color:#ffffff;padding:24px;border-radius:12px;">
        <div style="color:#F4511E;font-size:24px;font-weight:bold;margin-bottom:4px;">GigDekho</div>
        <h2 style="margin-top:0;">You've been paid 🎉</h2>
        <p>Hi ${workerName},</p>
        <p>Thanks for working <strong>${opts.gigTitle}</strong>. Your attendance has been confirmed and your earnings are now in your GigDekho wallet.</p>

        <div style="background:#1C1C1C;border-radius:8px;padding:20px;margin:16px 0;text-align:center;">
          <div style="color:#9ca3af;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Added to your wallet</div>
          <div style="color:#4ade80;font-size:32px;font-weight:bold;margin-top:6px;">₹${opts.amount}</div>
        </div>

        <h3 style="margin-bottom:6px;">How to get your money</h3>
        <p style="color:#d1d5db;font-size:14px;margin-top:0;">
          Whenever you want to claim it, open your Earnings page and
          ${opts.hasPayoutMethod
            ? "request a withdrawal"
            : "add your <strong>UPI ID</strong> (or upload your <strong>UPI QR code</strong>), then request a withdrawal"}.
          The money is sent to you by UPI, usually within a few hours.
        </p>
        <p style="color:#9ca3af;font-size:13px;">Minimum withdrawal is ₹${opts.minWithdrawal}.</p>
        <a href="https://gigdekho.com/worker/earnings" style="display:inline-block;background:#F4511E;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin:8px 0 20px;">Claim my money →</a>

        <div style="background:#1C1C1C;border-left:3px solid #F4511E;border-radius:8px;padding:16px;margin:8px 0 20px;">
          <div style="font-weight:bold;font-size:16px;margin-bottom:6px;">Want up to ₹${maxTotal} more?</div>
          <p style="color:#d1d5db;font-size:14px;margin:0 0 10px;">
            Post a reel about your experience on this gig and get paid for it:
          </p>
          <ul style="color:#d1d5db;font-size:14px;margin:0 0 10px;padding-left:18px;">
            <li><strong>₹${opts.perReel}</strong> per reel — up to ${maxReels} reels per gig, so <strong>₹${opts.maxPerGig}</strong> in total</li>
            <li><strong>+₹${opts.viewsBonus}</strong> if a reel crosses <strong>${opts.viewsThreshold.toLocaleString("en-IN")} views</strong></li>
          </ul>
          <p style="color:#9ca3af;font-size:13px;margin:0 0 12px;">
            Say <strong>GigDekho</strong> by name, share what the work was actually like, and tell people they can
            find work or post a gig on the site. Your account has to be public so we can open the reel and check it.
            You can submit it any time — there's no deadline.
          </p>
          <a href="https://gigdekho.com/worker/profile" style="display:inline-block;background:#1C1C1C;border:1px solid #F4511E;color:#F4511E;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:bold;">Submit a reel →</a>
        </div>

        <p style="color:#6b7280;font-size:12px;">Any problem with this payment? Just reply to this email.</p>
      </div>`,
  };
}
