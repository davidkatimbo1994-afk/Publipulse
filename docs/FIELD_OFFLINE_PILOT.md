# Field Offline Pilot Controls

## Scope

Validate action completion and outcome assessment under intermittent connectivity. Signal intake alone is insufficient evidence of offline readiness.

## Test scenarios

1. Create an action while online and complete it offline.
2. Record an outcome assessment offline.
3. Queue multiple mutations while offline.
4. Restore connectivity and replay the queue.
5. Repeat a mutation and verify idempotent behavior.
6. Change the server version before replay and verify HTTP 409 conflict handling.
7. Force a retryable server failure and verify the mutation remains queued.
8. Expire the authenticated session and verify the queue does not contain credentials.
9. Lose the device and verify that the deployment's managed-device controls, not IndexedDB alone, provide the required protection.
10. Reconnect after prolonged offline operation and verify no silent overwrite or silent deletion.

## Acceptance criteria

- no silent mutation loss;
- deterministic replay using client mutation IDs;
- explicit conflict state;
- visible pending state;
- no access tokens in the offline queue;
- no direct patient identifiers in queued payloads;
- successful replay is removable only after server acceptance;
- retryable failures remain recoverable.
