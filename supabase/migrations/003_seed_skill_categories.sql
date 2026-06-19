-- Enable Organizers to manage gig_payments from client
CREATE POLICY "Organizers insert own gig payments"
  ON gig_payments FOR INSERT
  WITH CHECK (auth.uid() = organizer_id);

CREATE POLICY "Organizers update own gig payments"
  ON gig_payments FOR UPDATE
  USING (auth.uid() = organizer_id)
  WITH CHECK (auth.uid() = organizer_id);
