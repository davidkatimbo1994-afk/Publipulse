-- Outcome effectiveness integrity hardening: enforce bounded assessment counts without rewriting migration 022.
BEGIN;

ALTER TABLE intervention_learning_summaries
  ADD CONSTRAINT intervention_learning_counts_nonnegative
  CHECK (recurrence_count >= 0);

ALTER TABLE persistent_problem_assessments
  ADD CONSTRAINT persistent_problem_counts_bounded
  CHECK (unresolved_count <= occurrence_count AND recurrence_after_action_count <= occurrence_count);

COMMIT;
