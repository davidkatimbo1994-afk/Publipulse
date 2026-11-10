# Architecture Decisions (initial)

## ADR-001: Modular monolith first
**Decision:** Use one deployable API with clear domain modules.
**Reason:** Keeps deployment and operations manageable while contracts and workflow are still being validated.
**Revisit when:** measured throughput, isolation requirements or independent team ownership justify service extraction.

## ADR-002: Relational Action Graph
**Decision:** Represent signals, evidence, investigations, decisions, actions and outcomes as relational entities with explicit foreign keys and history.
**Reason:** Strong transactions, constraints, reporting and auditability without graph infrastructure overhead.

## ADR-003: Synthetic data first
**Decision:** Do not store real health or personally identifiable information in the starter application.
**Reason:** Authentication, persistence, tenant isolation, consent, retention and incident processes are not yet implemented or verified.

## ADR-004: Human accountability for consequential decisions
**Decision:** AI can assist summarisation and analysis but cannot independently declare an outbreak or trigger high-impact intervention.
**Reason:** Public health decisions require validated evidence, clear responsibility and review.

## ADR-005: Offline submission IDs
**Decision:** Every field submission carries a client-generated UUID used for idempotent synchronisation.
**Reason:** Retries and interrupted connectivity must not create duplicate reports.

## ADR-006: Inbound USSD/SMS intake — provider-neutral gateway adapter
**Decision:** Inbound intake goes through an `InboundIntakeAdapter` boundary (verify provider request, normalise to `{channel, sessionId, sender, text}`, reply with the provider's response format). No provider is hard-coded in core. The first reference adapter targets Africa's Talking (one vendor with USSD and SMS webhooks across several African markets). Webhooks must be HTTPS, authenticated (shared secret and/or provider IP allow-list) and fail closed; an unverified request is rejected before any parsing.
**Reason:** Matches the existing `ReporterFeedbackTransport` rule that deployments supply and verify the provider. The pilot country is not fixed in this repository, so the vendor choice cannot be final here.
**Open, deployment gates (not verified in this repository):** USSD short code and SMS shortcode approval by each mobile operator and regulator; provider coverage, price and data-processing terms for the pilot country; where the provider processes message content.
**Revisit when:** the pilot country and mobile operators are chosen.

## ADR-007: Consent wording and what is kept
**Decision:** A person is asked to agree before anything is accepted, and the agreement is recorded as a wording version on the submission, not as a phone number.
- USSD screen 1 (kept under about 160 characters; confirm the per-screen limit with the operator): "PubliPulse health report. We keep your report, not your number. 1 Agree and continue 2 Stop"
- SMS auto-reply to a first message: "Reply YES to send your health report to the district team. We keep the report, not your number. Reply STOP to opt out."
- Wording is held in versioned, reviewable text per language. Translations are written and approved by the public health team before a pilot; none are included here.
- No callback or feedback SMS in this step. Reporter feedback over SMS needs a separate opt-in and would require keeping a contactable number, so it stays with the existing feedback path and is out of scope for step 4.
- STOP, 2 or no reply ends the session and stores nothing.
**Reason:** `data-boundary.ts` and migration 027 already reject phone numbers in stored narratives; intake must not undo that.

## ADR-008: Abuse limits and sender handling
**Decision:** The sender number is never stored with a submission. It is converted to `HMAC-SHA256(organisation pepper, number)` only to enforce limits, kept in a separate short-lived table (30 days), and never joined to a submission.
- Per sender: 3 accepted submissions per hour and 10 per day; identical text from the same sender within 24 hours is dropped.
- Per organisation: 500 inbound messages per hour, then new messages are held and administrators are notified.
- Cooldown: 3 rejected messages from one sender in an hour starts a 24-hour cooldown.
- Content: SMS free text at most 160 characters; USSD uses menus for category and area, with at most one short free-text step. Any text that matches the identifier guard (phone-like numbers, ID patterns) is refused with a generic reply and nothing is stored.
- Replies never confirm a limit was hit in detail and never echo the submitted text.
- Pepper rotation invalidates old hashes by design; limits restart.
**Reason and caveat:** These numbers are starting values chosen to be conservative, not measured. They must be calibrated during the pilot and are configuration, not code.

## ADR-009: Intake lands in a review queue, not as a signal
**Decision:** Community messages are stored as `pending_review` submissions (append-only, with review decisions as separate rows). A reviewer promotes one to a signal through the existing signal intake with `sourceType: community_report` and location precision `community` or `district`, or dismisses or merges it with a reason. Nothing is promoted automatically.
- Unreviewed submissions do not start 7-1-7 clocks, appear in action gaps, or count in weekly review or dashboards.
- Queue age is measured and shown, with a 24-hour triage target to be calibrated in the pilot.
- The USSD menu has an "urgent: several people are sick" choice. It sorts the queue first. It does not bypass review.
**Reason:** ADR-004 (human accountability), the risk of rumour or spam starting response clocks, and the chance of identifiers in free text. **Cost:** triage delay, which is why queue age is a first-class metric.
**Needs later:** migration 040 (submissions, review decisions, sender-limit table with RLS, update/delete rejected as in 037 to 039), a review-queue screen and a gateway adapter. None of these exist yet.

## Amendments made while building step 4
- **ADR-007, SMS consent.** The draft said "Reply YES to send". An SMS has no session, so holding the text until a YES arrives would mean keeping a message, and the sender's number, from someone who has not yet agreed. The built flow is one message: `REPORT <type 1-5> <area> [URGENT] [short note]`. Sending a complete REPORT message is the agreement and the report in one act. Any other message gets the consent text and nothing is kept. The USSD flow is as drafted.
- **ADR-007, replies.** A reply SMS needs the sender's number for one send. The code returns the reply text and calls an optional deployment-supplied `OutboundSmsSender`; none is included. Without one, SMS senders get no reply. The number is never stored or logged either way.
- **ADR-008, number format.** The sender hash uses the digits of the number only, so `+254 700 111 222` and `254700111222` count as one sender. A local format that drops the country code cannot be reconciled in code; the gateway is expected to send one format per sender.
- **ADR-008, free text.** USSD has no free text at all (menus only). Only SMS carries a note, up to 160 characters, checked with the same direct-identifier rule as the rest of the system.
- **ADR-009, decisions.** Three, not two: promoted, merged (into an existing signal) and dismissed. A promoted decision creates the signal in the same database transaction as the decision, so a signal can never exist without its decision or the reverse. Reviewers are owners, administrators and reviewers.
- **ADR-006, gateway secret.** The shared secret is accepted only in the `x-intake-secret` header, never in the URL, because request URLs appear in logs. A gateway that cannot send a custom header needs a small proxy in front that adds it.
