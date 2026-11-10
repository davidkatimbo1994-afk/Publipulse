# Product differentiation and defensibility

PubliPulse must not rely on hidden code as its primary defence. Its defensibility should come from a coherent workflow, trusted integrations, implementation quality, and validated domain expertise.

## Candidate differentiators to validate

1. **Public Health Action Graph:** a provenance-preserving chain from signal to evidence, investigation, decision, action, and measured outcome.
2. **Decision rationale and uncertainty:** record why an authorised reviewer acted, deferred, or dismissed a signal, including evidence gaps and limitations.
3. **Offline-safe operations:** reliable field capture with idempotent synchronisation and explicit conflict handling.
4. **Response accountability:** connect tasks to owners, deadlines, completion evidence, and follow-up measures.
5. **Evaluation loop:** make outcome measurement a first-class part of the workflow instead of stopping at case closure.
6. **Local operational fit:** configurable administrative areas, language support, low-bandwidth workflows, and authorised integration with existing health systems.

## Validation before novelty claims

- Map capabilities against WHO EWARS, Africa CDC event-management tools, DHIS2 ecosystem components, academic publications, and relevant commercial products.
- Interview public health workers, district programme leads, epidemiologists, researchers, and intended institutional buyers.
- Test whether the proposed Action Graph solves a repeated, costly problem better than existing workflows.
- Search relevant trademark registries, domains, app stores, patents, and published prior art before making exclusivity claims.

## Data and IP safeguards

- Never treat sensitive health data as a commercial moat.
- Use only data collected with an appropriate lawful basis, purpose limitation, retention policy, and access controls.
- Prefer aggregate, appropriately de-identified metrics for product learning where feasible; assess re-identification risk before sharing.
- Keep proprietary workflow implementation in controlled repositories, enforce MFA and least privilege, review dependencies, and protect release credentials.
- Document ownership and licences for code, models, datasets, and external integrations.

## Outcome evidence and accountability (v0.61)

An action marked `completed` is not, by itself, evidence that a public-health condition improved. Outcome assessments therefore record the indicator, baseline/target/follow-up values when measurable, an explicit result (`improved`, `no_change`, `worsened`, or `inconclusive`), the evidence source and assessment method, and uncertainty. Inconclusive results are first-class outcomes; the platform must not infer causation from a before/after change. Existing database records remain compatible, while new shared intake contracts require provenance and a result.
