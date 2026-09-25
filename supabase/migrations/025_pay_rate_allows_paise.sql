-- ══════════════════════════════════════════════════════════════════
-- 025. gigs.pay_rate has to hold a fraction
-- ══════════════════════════════════════════════════════════════════
-- A multi-day gig is priced per day, but the rest of the app reads pay per
-- hour: every listing card, every worker email and the payout maths all
-- compute the advertised figure as pay_rate x duration_hrs. So posting a
-- multi-day gig derives an hourly rate from the day rate, and that division
-- almost never lands on a whole rupee — three 11-hour days at Rs 600 gives
-- Rs 1800 / 33 hrs = Rs 54.55/hr.
--
-- pay_rate was created as an integer, so Postgres rejected the insert outright
-- with 22P02 and the hirer got a type error instead of a posted gig. Rounding
-- in the client is not an option: at 55/hr the same gig advertises Rs 1815, so
-- every worker email would quote a figure nobody agreed to pay.
--
-- Widening is backwards compatible. Every existing value is a whole number and
-- stays exactly as it is, and numeric still arrives in JSON as a number.
ALTER TABLE gigs
  ALTER COLUMN pay_rate TYPE numeric(10,2);
