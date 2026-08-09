-- Make a managed account deletable.
--
-- The claim email tells a business "reply and we'll delete the account and
-- all its data immediately". We couldn't honour that: admin_actions.target_user_id
-- references profiles with the default ON DELETE RESTRICT, so the audit row
-- written when the account was created permanently blocked deleting it.
--
-- SET NULL rather than CASCADE on purpose: the audit entry is the record that
-- an admin did something, and it should survive the subject being erased. The
-- detail text keeps the who/what in plain language.

ALTER TABLE admin_actions
  DROP CONSTRAINT IF EXISTS admin_actions_target_user_id_fkey;

ALTER TABLE admin_actions
  ADD CONSTRAINT admin_actions_target_user_id_fkey
  FOREIGN KEY (target_user_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- Same reasoning for the document reference: a deleted document shouldn't
-- erase the record that it was reviewed.
ALTER TABLE admin_actions
  DROP CONSTRAINT IF EXISTS admin_actions_target_document_id_fkey;

ALTER TABLE admin_actions
  ADD CONSTRAINT admin_actions_target_document_id_fkey
  FOREIGN KEY (target_document_id) REFERENCES verification_documents(id) ON DELETE SET NULL;
