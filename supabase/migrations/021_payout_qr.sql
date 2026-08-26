-- Let a worker hand over a UPI QR code as well as a typed UPI ID.
--
-- A typed ID is the better input — it can be copied straight into a payment app
-- and it cannot be misread. But plenty of people only know their UPI as the
-- square their app shows them, and telling those people to go and find a string
-- they have never looked at loses the payout. So: the ID stays required, the QR
-- is an optional extra that gives whoever is paying a second way to get it
-- right.

ALTER TABLE worker_bank_accounts
  ADD COLUMN IF NOT EXISTS upi_qr_url text;

-- Private, like every other image of a person's business. The QR encodes a
-- payment address; a public bucket would put every worker's UPI handle on a
-- guessable URL.
INSERT INTO storage.buckets (id, name, public)
VALUES ('payout-qr', 'payout-qr', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Workers upload own payout QR" ON storage.objects;
CREATE POLICY "Workers upload own payout QR"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'payout-qr' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Workers replace own payout QR" ON storage.objects;
CREATE POLICY "Workers replace own payout QR"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'payout-qr' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Owner or admin reads payout QR" ON storage.objects;
CREATE POLICY "Owner or admin reads payout QR"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'payout-qr'
         AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin()));
