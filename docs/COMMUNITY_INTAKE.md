# Community USSD/SMS intake

Decisions: ADR-006 to ADR-009 and the amendments at the end of `docs/ARCHITECTURE_DECISIONS.md`.

## What a community member experiences
- **USSD** (dial the code): consent screen, then what happened (5 choices), then where (up to 9 areas), then "are several people sick". Nothing is saved until the last answer. Choosing "2 Stop" or any invalid input saves nothing.
- **SMS**: send `REPORT <type 1-5> <area number> [URGENT] [short note up to 160 characters]`. Any other message gets the explanation and saves nothing. `STOP` ends it.
- The person is told once: "We keep your report, not your number."

## What the system does with it
1. The gateway calls `/inbound/community/ussd` or `/sms` with the shared secret in the `x-intake-secret` header.
2. The sender's number is turned into a keyed hash (HMAC-SHA256 with the pepper and the organisation id, digits only) used only to apply limits. It is kept in `community_sender_events` with no link to the report, and purged after 30 days.
3. The report is stored as **pending** in `community_intake_submissions`: type, area code, urgent flag, optional note, consent version. **No phone number.** It does not appear in dashboards, gaps or 7-1-7 clocks.
4. A reviewer (owner, administrator or reviewer) opens **Community reports** in the web app and decides: create a signal (same transaction as the decision), link to an existing signal, or dismiss with a reason. Decisions are final. Urgent reports and older reports sort first.
5. The page shows how many are waiting, the oldest age and the median time to decide over 30 days (target 24 hours, to calibrate).

## Setting it up
Set these on the API (nothing set means the feature is off and the routes answer 503; a partial or weak setup stops start-up):

| Variable | Meaning |
|---|---|
| `COMMUNITY_INTAKE_CHANNELS` | JSON array. One entry per organisation and code: `{"organizationId":"<uuid>","ussdServiceCode":"*384*12#","smsShortCode":"23456","areas":[{"code":"KE-NAIROBI-03","label":"Ward A"}]}`. 1 to 9 areas. Optional `messages` to replace the default wording (translations). |
| `COMMUNITY_INTAKE_PEPPER` | 32 or more random characters. Rotating it restarts every sender's limits. |
| `COMMUNITY_INTAKE_WEBHOOK_SECRET` | 24 or more random characters. The gateway sends it in the `x-intake-secret` header. |
| `COMMUNITY_INTAKE_ALLOWED_IPS` | Optional. Only useful if the API sees the gateway's real address (the API does not trust proxy headers). |
| `COMMUNITY_INTAKE_LIMITS` | Optional JSON overriding the starting limits: `senderPerHour` 3, `senderPerDay` 10, `organizationPerHour` 500, `cooldownRejects` 3, `cooldownHours` 24. These are conservative guesses to calibrate in a pilot. |
| `COMMUNITY_INTAKE_GATEWAY_RATE` | Optional requests a minute for the gateway routes (default 1200). The gateway shares one address, so the normal 120 a minute would block real use. |

Point the gateway's callback at the two routes. The reference adapter reads Africa's Talking's form fields (`serviceCode`, `phoneNumber`, `text`; `to`, `from`, `text`). Another gateway needs only a new small adapter file.

Run `npm run purge:sender-events -w @publipulse/api` (or `purge:sender-events:dist` after a build, on a machine without development dependencies) daily (administrator connection in `PROVISION_DATABASE_URL`; `--dry-run` to preview).

## Limits (ADR-008)
Per sender 3 reports an hour and 10 a day; an identical report within 24 hours is dropped (and answered "thank you", so gateway retries are harmless); three refused messages within an hour start a 24-hour block; 500 messages an hour per organisation, after which new messages are refused and the first one each hour is written to the audit log. Replies never say which limit was hit. A message with a phone number or ID-like text in the note is refused and stored nowhere.

## What is not done, and why
- **No outbound SMS provider.** Replies to SMS senders need an `OutboundSmsSender` that your deployment supplies. Without one, SMS senders get no reply. USSD replies work as they are part of the session.
- **No ready-made translations.** Default wording is English. The public health team must write and approve local-language wording before a pilot; set it in `messages`.
- **More than 9 areas** per code needs paging, which is not built. Split into several codes or use coarser areas.
- **No operator approval of USSD codes or shortcodes, no provider contract, no data-processing agreement.** These are deployment gates for each country and mobile operator (ADR-006).
- **The queue age is on the Community reports page only.** It is not yet on the Weekly Review.
- **Not exercised against a live gateway, live PostgreSQL for these tables, or a phone.** The behaviour is covered by tests with recording fakes. Run the PostgreSQL integration tests and a staging gateway test before real use.
