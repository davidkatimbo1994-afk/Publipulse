-- Organisation onboarding: one-time invitations for joining an organisation, explicit country on every organisation,
-- and an update timestamp on memberships. Organisations themselves are created by an operator (see
-- docs/ORGANISATION_ONBOARDING.md), never by the tenant-scoped API.
BEGIN;

-- A silent default of 'UG' put organisations in the wrong country whenever the value was forgotten.
ALTER TABLE organizations ALTER COLUMN country_code DROP DEFAULT;
-- NOT VALID: new and changed rows must be two upper-case letters; existing rows are not rewritten or rejected.
ALTER TABLE organizations ADD CONSTRAINT organizations_country_code_format CHECK (country_code ~ '^[A-Z]{2}$') NOT VALID;

ALTER TABLE organization_memberships ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE organization_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  role text NOT NULL CHECK (role IN ('owner','administrator','reviewer','investigator','responder','analyst','read_only','auditor')),
  -- SHA-256 (hex) of a 256-bit random code. The code itself is shown once and never stored.
  code_hash text NOT NULL CHECK (code_hash ~ '^[0-9a-f]{64}$'),
  -- NULL when an operator created the first owner invitation while provisioning the organisation.
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  redeemed_at timestamptz,
  redeemed_by uuid,
  revoked_at timestamptz,
  revoked_by uuid,
  CHECK (expires_at > created_at AND expires_at <= created_at + interval '30 days'),
  CHECK ((redeemed_at IS NULL) = (redeemed_by IS NULL)),
  CHECK ((revoked_at IS NULL) = (revoked_by IS NULL)),
  CHECK (redeemed_at IS NULL OR revoked_at IS NULL),
  UNIQUE (organization_id, id),
  UNIQUE (organization_id, code_hash)
);
CREATE INDEX organization_invitations_org_created_idx ON organization_invitations(organization_id, created_at DESC);

ALTER TABLE organization_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_invitations FORCE ROW LEVEL SECURITY;
CREATE POLICY organization_invitations_tenant_policy ON organization_invitations
  USING (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid)
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid);

-- Rows are never deleted. The only allowed change is closing a pending invitation once, by redeeming or revoking it.
CREATE OR REPLACE FUNCTION guard_organization_invitation_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'organization invitations are never deleted' USING ERRCODE='42501';
  END IF;
  IF NEW.id <> OLD.id OR NEW.organization_id <> OLD.organization_id OR NEW.role <> OLD.role OR NEW.code_hash <> OLD.code_hash
     OR NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.created_at <> OLD.created_at OR NEW.expires_at <> OLD.expires_at THEN
    RAISE EXCEPTION 'only the redeemed or revoked fields of an invitation can change' USING ERRCODE='42501';
  END IF;
  IF OLD.redeemed_at IS NOT NULL OR OLD.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'a closed invitation cannot change' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER organization_invitations_guard
  BEFORE UPDATE OR DELETE ON organization_invitations
  FOR EACH ROW EXECUTE FUNCTION guard_organization_invitation_change();

COMMIT;
