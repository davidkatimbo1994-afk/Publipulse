-- Defense-in-depth checks for the public-health data boundary.
-- Application schemas reject common direct identifiers; these checks protect
-- against accidental writes through a separately provisioned runtime path.
BEGIN;

ALTER TABLE signals
  ADD CONSTRAINT signals_summary_no_common_direct_identifier
  CHECK (summary !~* '[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}' AND summary !~* '(^|[^0-9])\+?[0-9][0-9 .()\-]{7,}[0-9]([^0-9]|$)' AND summary !~* '\b(patient|client|person)\s*(id|identifier|number)\s*[:#-]?\s*[A-Z0-9-]{4,}\b');

ALTER TABLE evidence
  ADD CONSTRAINT evidence_description_no_common_direct_identifier
  CHECK (description !~* '[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}' AND description !~* '(^|[^0-9])\+?[0-9][0-9 .()\-]{7,}[0-9]([^0-9]|$)' AND description !~* '\b(patient|client|person)\s*(id|identifier|number)\s*[:#-]?\s*[A-Z0-9-]{4,}\b');

COMMIT;
