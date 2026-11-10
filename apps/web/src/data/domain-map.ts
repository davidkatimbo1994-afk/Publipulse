/**
 * Maps presentation-layer health signals to shapes compatible with
 * @publipulse/shared SignalIntake / SignalStatus contracts.
 *
 * Presentation UI may use richer disease labels and severity for field usability.
 * When submitting to the API, prefer shared enums and narrative constraints.
 */

/** Shared SignalStatus values from packages/shared/src/signal.ts */
export type SharedSignalStatus =
  | 'submitted'
  | 'under_review'
  | 'investigating'
  | 'verified'
  | 'dismissed'
  | 'closed';

/** Shared SignalIntake category */
export type SharedCategory =
  | 'unusual_illness'
  | 'environmental_hazard'
  | 'service_disruption'
  | 'other';

/** Shared sourceType */
export type SharedSourceType =
  | 'community_report'
  | 'facility_report'
  | 'field_observation'
  | 'research'
  | 'other';

/** Shared location precision */
export type SharedPrecision = 'community' | 'facility' | 'district';

export const PRESENTATION_TO_SHARED_STATUS: Record<string, SharedSignalStatus> = {
  'Under Investigation': 'investigating',
  'Action Pending': 'under_review',
  Verified: 'verified',
  'Response Active': 'investigating',
  Closed: 'closed'
};

export function toSharedStatus(presentation: string): SharedSignalStatus {
  return PRESENTATION_TO_SHARED_STATUS[presentation] ?? 'submitted';
}

/** Heuristic category from free-text disease label (demo only). */
export function inferCategory(disease: string): SharedCategory {
  const d = disease.toLowerCase();
  if (/cholera|measles|typhoid|fever|diarrhea|diarrhoea|hemorrhagic|vhf|ebola/.test(d)) {
    return 'unusual_illness';
  }
  if (/water|well|sanitation|vector|environmental/.test(d)) {
    return 'environmental_hazard';
  }
  if (/service|staffing|stockout|vaccine/.test(d)) {
    return 'service_disruption';
  }
  return 'other';
}

/**
 * Build a SignalIntake-compatible payload from presentation fields.
 * clientSubmissionId must be a UUID at submit time (crypto.randomUUID()).
 * summary must be 10–1000 chars per shared schema.
 */
export function toSignalIntakeDraft(input: {
  disease: string;
  location: string;
  notes: string;
  cases: number;
  deaths: number;
  precision?: SharedPrecision;
  sourceType?: SharedSourceType;
}): {
  category: SharedCategory;
  summary: string;
  location: { administrativeAreaCode: string; precision: SharedPrecision };
  sourceType: SharedSourceType;
  observedAtHint: string;
} {
  const narrativeParts = [
    input.disease.trim(),
    input.notes.trim(),
    `Suspected cases: ${input.cases}.`,
    input.deaths > 0 ? `Related deaths reported: ${input.deaths}.` : null
  ].filter(Boolean);
  let summary = narrativeParts.join(' ').trim();
  if (summary.length < 10) summary = `${summary} Field signal recorded via PubliPulse intake.`.trim();
  if (summary.length > 1000) summary = summary.slice(0, 997) + '…';

  return {
    category: inferCategory(input.disease),
    summary,
    location: {
      administrativeAreaCode: input.location.trim().slice(0, 80) || 'UNKNOWN',
      precision: input.precision ?? 'community'
    },
    sourceType: input.sourceType ?? 'field_observation',
    observedAtHint: new Date().toISOString()
  };
}
