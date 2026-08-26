# GigDekho

Hyperlocal gig marketplace for Indore. Connects people who need short-term
on-ground help (event staff, promoters, setup crew) with students and freshers
who want paid work. Founder and sole operator: Yash Upadhyay.

This file is loaded automatically into every Claude Code session opened in this
directory. It is the shared brain across chats — keep it current.

---

## 1. Ground rules for working here

- **Don't claim something works until you've seen it work.** Prefer exercising
  the real HTTP endpoint over reading the code and reasoning about it.
- **PostgREST returns no error and zero rows when RLS refuses a write.** Row
  count is the only honest signal. Never trust a bare `!error` check.
- **Reproduce before fixing.** Guessing from symptoms has cost this project
  hours. If a bug is mobile-only, find a way to trigger it deterministically on
  desktop first.
- **Clean up test data and verify the cleanup.** FK constraints
  (`admin_actions`, `internship_applications`, `analytics_events`) block profile
  deletion; a delete that silently fails leaves fake users in the live admin
  panel.
- Match the surrounding comment style: comments explain *why*, not *what*.

---

## 2. Tech stack

| Layer | Choice |
|---|---|
| Framework | **React Router v8**, framework mode, SSR |
| Routing | Explicit `app/routes.ts` — file names are not routes |
| UI | React 19, Tailwind **v4** (`@theme` in `app/index.css`) |
| Icons | `lucide-react` |
| Backend | **Supabase** (Postgres + Auth + Storage + RLS) |
| Hosting | **Vercel** (Hobby tier) |
| Email | **Resend** |
| Maps | Google Maps JS API |
| Sheets export | Google service account |

### Version-specific traps

- **React Router v8 renamed the `meta` argument `data` to `loaderData`.**
  Using `data` yields silently empty meta (this caused every gig title to read
  "Gig Not Found").
- **A `fetch()` POST to a page route is a document request** and returns
  re-rendered HTML, not the action's JSON. Anything called by `fetch` must be a
  resource route (`api.*.ts` with no default export).
- **`@supabase/ssr` `createBrowserClient` is PKCE-only**, but Supabase email
  links use the *implicit* flow (`#access_token` in the hash).
  `app/lib/auth-url.ts` bridges this. Don't remove it.
- **`auth.uid()` is NULL for the service role**, so `is_admin()` is false there.
  This does *not* block RLS policies — the service role bypasses RLS entirely
  (verified against the live database). It **does** break **triggers**, which
  run regardless. Any trigger that must permit the server needs
  `OR auth.role() = 'service_role'`. See section 7.
- **Supabase hands back a fresh `user` object on every token refresh**, which
  fires on tab visibility change. `useEffect(..., [user])` therefore re-runs at
  random. Always depend on `user?.id`.
- **Vercel Hobby**: crons run at most once per day; request bodies cap at ~4.5MB.

---

## 3. Design system

Dark-first. There is no light theme.

```
--color-primary     #F4511E   GigDekho orange — CTAs, active state, accents
--color-accent      #FF8A50   lighter orange, highlights
--color-background  #111111   page
--color-surface     #1C1C1C   cards, panels
--color-border      #2A2A2A   subtle dividers (often rgba(255,255,255,.05-.10))
text                #F5F5F5   with white/60, white/40, white/30 for hierarchy
```

Font: **Inter**, weights 400-900. Headings lean `font-black` with tight
tracking. Small labels are `text-[10px]`/`text-[11px] font-black uppercase
tracking-wider`.

Utility classes in `app/index.css`: `.glass-panel`, `.hero-gradient-overlay`,
`.floating-glass-rect`, `.hover-glow`, `.btn-tap`, `.hide-scrollbar`.

Shape language: `rounded-xl` inputs, `rounded-2xl`/`rounded-3xl` cards,
`rounded-full` buttons and pills.

Status colour convention: green = approved/paid, orange = pending/attention,
red = rejected/destructive, blue = informational.

Mobile is the primary target — most workers arrive on a phone.

---

## 4. How money actually moves

There is **no payment gateway and no automated payout**, deliberately. An
automated payout API (RazorpayX and equivalents) requires a registered business
entity, which GigDekho is not. So:

1. The hirer pays Yash directly — cash, UPI, or bank transfer, against an
   invoice generated from this repo.
2. The hirer (or an admin) confirms attendance per day, then presses Pay. That
   credits the worker's **wallet** — an internal ledger, not real money moving.
3. The worker requests a withdrawal to their UPI ID or bank account.
4. Yash sends it from his own UPI app and marks it paid in `/admin/payouts`,
   recording the UTR. The debit settles and the worker is notified.

Nothing in the codebase moves money on its own. `/api/pay` is a *simulated*
hirer-side payment flow and does not charge anyone.

## 4b. Money rules

| Thing | Rule |
|---|---|
| Gig payout | Paid on **whole-gig** completion, not per day |
| Late cancellation | **Rs 100** penalty if cancelled with under 2 days notice |
| Minimum withdrawal | **Rs 150** |
| Referral | **Rs 50 to each side**, paid when the referred person *works* a gig (not on signup). Cap **4/month**, counted at payout. Over-cap referrals are marked `qualified`, never rejected. Gigs and internships both count. |
| Reels | **Rs 50 per reel**, max **2 per gig** (Rs 100). **+Rs 50** if it crosses **3,000 views**. Public account required. Manually verified — Instagram exposes no lawful view-count API, and the UI must never pretend otherwise. Claimable any time after the gig. |
| Services (planned) | **10%** commission |

Wallet writes are idempotent, keyed on `reference_id` + `type`. Never write a
credit without that key.

---

## 5. Feature status

### Solid — tested against real accounts and live data

- Auth: email/password, verification mail, forgot-password reset
- Worker/hirer dual mode, single source of truth in `app/hooks/useActiveView.ts`
  (URL wins; `/worker/profile` is a shared page)
- Gig posting, browsing, gig detail pages, cover images
- Applying to gigs and internships; applicant lists in portal *and* admin
- Cancelling an application, with applicant counts correcting
- Waitlist when a gig is full
- Document upload — **including from mobile** (see section 7)
- Admin: users plus full detail incl. uploaded docs, gigs, applicants per gig,
  verifications, payouts, reports, settings, managed accounts
- Wallet, bank details, withdrawal requests
- Reminder emails (48h / 24h / 6h) via GitHub Actions hourly trigger
- Reel rewards end to end: submit, admin review queue, wallet credit
- Referrals end to end: capture `?ref=`, attach at signup, pay both sides
- Google Sheets applicant export
- **Multi-day attendance** — worker checks in per day with a photo, hirer
  confirms and records punctuality, admin overrides any row. 25 assertions run
  against real accounts on the live database, then rolled back.
- **Payout on completion** — the advertised whole-gig figure, prorated by
  attended hours only when days are missed. Idempotent on the application id.
- **UPI withdrawals** — worker saves a UPI ID or bank account, requests a
  withdrawal, admin sends the money by hand and records the UTR.

**ID verification is NOT required to apply to a gig.** Deliberate decision.

### Built but unproven

- Analytics tracking — `/api/track` returns `{"ok":false}` in production
- Google Maps in production — blocked by a CSP whose source is not in this repo
  or in `vercel.json`

### Designed, not built

- Multi-day *posting* flow — `gig_days` rows are created automatically (one per
  day, backfilled for single-day gigs), but there is no UI to set per-day dates
  and times when posting. They currently have to be inserted by hand.
- Gig page showing "6 hrs x 3 days" instead of a single date
- Selfie deletion once a dispute is resolved and the gig is paid — the photos
  are captured and stored privately, but nothing prunes them yet
- Report button on an attendance row once checked in
- Admin "request a document" from a user
- Admin email tool: compose to a gig's applicants, templates, preview, log
- **Services marketplace** — user-listed services, 10% commission, everything
  on-site, contact/Instagram sharing blocked (`app/lib/contact-filter.ts`
  already exists), admin can read all chats. **Blocked on a payment gateway.**

---

## 6. Layout

```
app/
  routes.ts              explicit route table — edit this to add a route
  routes/                47 files; api.*.ts are resource routes
  components/            35 components
  lib/                   *.server.ts is server-only; never import into a component
  hooks/useActiveView.ts worker/hirer view, single source of truth
  lib/attendance.server.ts day rows, check-in windows, payout maths
  context/AuthContext.jsx  only SIGNED_OUT clears the user
  index.css              Tailwind v4 @theme plus utilities
supabase/migrations/     001-019, numbered, run in order
.github/workflows/       hourly reminder trigger
```

### Env vars

Client: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_GOOGLE_MAPS_API_KEY`

Server: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`,
`SITE_URL`, `CRON_SECRET`, `MIN_WITHDRAWAL_AMOUNT`, `GOOGLE_SA_EMAIL`,
`GOOGLE_SA_PRIVATE_KEY`, `GOOGLE_MAPS_API_KEY`

**Outstanding:** `CRON_SECRET` must be added as a *GitHub repository secret*
(it is already set in Vercel). Until then the hourly workflow fails closed.

---

## 7. Bugs worth remembering

**Mobile document upload (fixed, took five attempts).** Android discards the
page while the native file picker is open. On return, Supabase refreshed the
token, which produced a new `user` object, which re-ran a `useEffect`, which
called `setLoading(true)`, which unmounted the page and destroyed the file
input — so the `change` event never fired and no log was ever written. Fixed in
`worker.profile.tsx` by depending on `user?.id` and only showing the full-page
spinner on first load. `ProtectedRoute.tsx` has the same guard: once it has
rendered children, it never falls back to a spinner.

**Reel approvals silently reverting.** Migration 018 triggers checked only
`is_admin()`, so service-role writes were refused — the wallet was credited
while the row stayed `pending`. Fixed in 019.

**Cancel never worked.** `applications_status_check` did not allow `'cancelled'`,
and `api/cancel` discarded the result and returned 200 regardless. Fixed in 016.

**Signup 500s.** A referral-code trigger read `profiles` as
`supabase_auth_admin`. Needs `SECURITY DEFINER` with a pinned `search_path`.
Fixed in 014.

**A column that was never created.** 013 declared `gig_attendance.punctuality`
inside `CREATE TABLE IF NOT EXISTS`. That migration aborted partway through its
first run and was edited and re-run — by then the table existed, so IF NOT
EXISTS skipped it and the column silently never landed. Fixed in 020.
**CREATE TABLE IF NOT EXISTS is not a way to change a table**; new columns need
their own `ADD COLUMN IF NOT EXISTS`.

**The service role bypasses RLS.** Verified directly against the live database.
A policy naming only `is_admin()` does *not* block server-side writes. What
broke reel approvals in 018 was a **trigger**, which runs even for a role that
bypasses RLS. Don't confuse the two — check which one you are actually looking
at before "fixing" a policy.

**Admin is `profiles.is_admin`, not a role string.** `profiles.role` only ever
holds `worker` or `organizer`. Any new admin check must mirror `requireAdmin()`
and also reject `is_suspended`.

---

## 8. Business admin

Invoices and receipts are generated as self-contained HTML in the repo root and
are **gitignored** (`invoice-*.html`, `receipt-*.html`) — they carry bank
account number, PAN and home address.

- Not GST registered. Invoices are not titled "Tax Invoice".
- Numbering: bills `GD/<FY>/NNN`, receipts `GD/RCP/<FY>/NNN` (separate series).
- Cash receipts must be signed by hand.
