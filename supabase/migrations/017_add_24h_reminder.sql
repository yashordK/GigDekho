-- Adds the 24-hour reminder.
--
-- The cron also moves from daily to hourly (see vercel.json). The windows are
-- two hours wide, so a once-a-day job could only ever catch a gig that
-- happened to sit in that slot — in practice the 48h and 6h reminders almost
-- never fired.

ALTER TABLE applications ADD COLUMN IF NOT EXISTS reminder_24h_sent boolean NOT NULL DEFAULT false;

-- Anything already past 24h out shouldn't suddenly get a "24 hours to go"
-- mail the first time the hourly job runs.
UPDATE applications a
SET reminder_24h_sent = true
FROM gigs g
WHERE g.id = a.gig_id
  AND g.event_date < now() + interval '24 hours';
