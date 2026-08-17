-- Cancelling a gig has never once worked.
--
-- applications_status_check allows pending, accepted, rejected, completed and
-- no_show. The cancel flow writes 'cancelled', which the constraint refuses —
-- and api/cancel discarded the result of that update, so the request still
-- answered 200 and went on to send the cancellation email. The worker was
-- told they had cancelled, the row stayed 'accepted', the slot was never
-- freed, and the hirer kept counting on someone who wasn't coming.
--
-- Confirmed against live data: there is not a single cancelled row in the
-- table, because none could ever be written.
--
-- Everything downstream assumed the value existed — the applicant counts
-- filter on `status != 'cancelled'`, and promote_next_waitlist only fires
-- when a row leaves 'accepted', so the waitlist never promoted either.

ALTER TABLE applications DROP CONSTRAINT IF EXISTS applications_status_check;

ALTER TABLE applications ADD CONSTRAINT applications_status_check
  CHECK (status = ANY (ARRAY[
    'pending',    -- applied, or waiting on the waitlist
    'accepted',   -- confirmed for the gig
    'rejected',   -- turned down by the hirer
    'completed',  -- worked and marked attended
    'no_show',    -- confirmed but didn't turn up
    'cancelled'   -- withdrew before the gig
  ]));
