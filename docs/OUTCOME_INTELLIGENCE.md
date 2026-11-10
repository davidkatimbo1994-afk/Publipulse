# Outcome Intelligence

PubliPulse treats administrative closure as distinct from demonstrated resolution.

## Review loop

1. Detect closure without sufficient resolution evidence.
2. Detect missing follow-up measurement.
3. Detect recurrence after previous response activity.
4. Escalate worsened outcomes.
5. Preserve inconclusive outcomes as uncertainty rather than success.
6. Request structured expert recommendations where persistent problems require contextual knowledge.
7. Evaluate interventions against subsequent outcomes.
8. Classify learning as supported, mixed, not supported, or insufficient evidence.

The system does not infer causation or clinical effectiveness from these classifications. They are bounded operational-learning signals requiring appropriate human review.

## Core distinction

`closed` is an administrative workflow state.

`resolved` requires evidence.

`improved` describes an observed outcome, not proof that an intervention caused the improvement.

`mixed` means improvement was observed but recurrence remained.

`insufficient_evidence` means the evidence cannot support a reliable learning conclusion.

## Response effectiveness decay

PubliPulse treats response decay as a workflow diagnostic: signal → verified → owned → acted → measured → durable. A stage is counted only when the corresponding auditable record exists. Missing transition timestamps are not inferred.

`durable` means that after an outcome measurement, no comparable recurrence was observed in the configured 30-day observation window. It is not proof that an intervention caused improvement or that the problem is permanently solved.

Open Action Gap codes are used as bounded dropout explanations. Counts can overlap because one case may have more than one active gap.

## Resource intelligence

Response blockers use a normalized taxonomy: supplies, transport, laboratory, authorization, staffing, funding, coordination, information, infrastructure, other. Aggregate reporting must preserve the configured minimum-cell suppression boundary.

## Reporter feedback

Reporter feedback events are non-identifying operational acknowledgements. The event records stage, channel and delivery status; it must not echo clinical detail or personal identifiers. Failed or missing feedback is operationally observable rather than silently treated as successful communication.


### Durability observation window

An outcome is not counted as `durable` until the configured 30-day observation window after measurement has fully elapsed. Outcomes measured more recently are reported separately as `pendingDurability`. This prevents a newly measured outcome from appearing durable merely because no recurrence has been observed yet. Durability remains an operational observation and is not a causal effectiveness claim.
