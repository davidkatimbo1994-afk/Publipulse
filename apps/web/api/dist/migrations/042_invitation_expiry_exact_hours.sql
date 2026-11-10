-- Migration 040 limited invitation lifetime with "created_at + interval '30 days'". For timestamptz, a day is a calendar day
-- in the session time zone, so across a daylight-saving change "30 days" can be an hour shorter than 30 x 24 hours and
-- would wrongly reject a 30-day invitation. Replace it with an exact number of hours.
BEGIN;

DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'organization_invitations'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%30 days%'
  LOOP
    EXECUTE format('ALTER TABLE organization_invitations DROP CONSTRAINT %I', c.conname);
  END LOOP;
END
$$;

ALTER TABLE organization_invitations
  ADD CONSTRAINT organization_invitations_expiry_window
  CHECK (expires_at > created_at AND expires_at <= created_at + interval '720 hours');

COMMIT;
