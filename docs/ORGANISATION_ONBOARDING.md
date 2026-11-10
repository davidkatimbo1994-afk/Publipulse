# Organisation onboarding

## The three steps

1. **An operator creates the organisation.** This is not an API route: creating a tenant is a platform decision, and the API's database role works inside one tenant at a time.
   ```
   PROVISION_DATABASE_URL=postgres://<administrator connection> \
   npm run provision:org -w @publipulse/api -- --name "District Health Office" --country UG
   ```
   - `--country` is required and must be two upper-case letters. There is no default.
   - By default the first owner is created as a **one-time owner invitation**. The code is printed once. Give it to the first owner over a trusted channel.
   - If you already know the person's identity-provider `sub`, pass `--owner-sub <uuid>` instead and the owner membership is created directly.
   - `--invite-days` (1 to 30, default 7) sets how long the owner code is valid. `--dry-run` checks the input and writes nothing.
   - `npm run provision:org` uses `tsx`, a development dependency. On a machine with only production dependencies, build first and run `npm run provision:org:dist -w @publipulse/api -- <same options>`.
   - The script prints the new organisation ID. Share it with the owner; they need it to connect.
2. **People get a sign-in** in your identity provider (OIDC). PubliPulse stores no passwords, names or emails.
3. **The owner invites everyone else** under Settings, Team and permissions. Each invitation is a one-time code for one role. The invited person signs in, connects with the organisation ID, and enters the code under Settings, Account, Join with an invitation code. The code is then used up.

## Who may do what

| Action | Owner | Administrator |
|---|---|---|
| See members and invitations | yes | yes |
| Invite as owner, administrator or auditor | yes | no |
| Invite as reviewer, investigator, responder, analyst, read-only | yes | yes |
| Change or suspend a member holding those operational roles | yes | yes |
| Change or suspend an owner, administrator or auditor | yes | no |

Everyone: you cannot change your own role or suspend yourself, and the last active owner can never be demoted or suspended (two owners cannot remove each other at the same moment; the owner rows are locked in a fixed order). Other roles cannot manage members at all.

## What is recorded

Every invitation created or withdrawn, every role or status change and every join writes an audit event with roles and ids only. The plain code is never stored, logged or listed: only its SHA-256 hash is kept, and it cannot be shown again. Failed redemptions are **not** written to the audit log, because the organisation ID is supplied by the caller before they are a member, and logging failures would let anyone write rows into another organisation's log. The endpoint is rate limited (10 a minute) and answers one error for an unknown organisation, a wrong code, a used code, an expired code and a withdrawn code.

## Rules worth knowing

- An invitation lasts 1 to 30 days and works once. A person who already has a membership, even a suspended one, cannot use a code to get another or to be reactivated; an administrator reactivates them.
- Suspending a member does not delete anything. Their earlier work and audit trail stay.
- Invitations and the audit trail are append-only at the database level. Invitations are never deleted.

## Not done, and why

- **No email is sent.** There is no outbound mail in this build. The code is handed over by a person.
- **No platform-admin screen or API for creating organisations.** Provisioning is a script run by an operator with an administrator database connection.
- **Least privilege in production is a deployment task.** The documented development grants let the runtime role write to every table. In production, do not grant the API's runtime role INSERT on `organizations`; only the provisioning connection needs it. See `docs/DEPLOYMENT_SECURITY.md`, which lists the exact grants the member and invitation endpoints need (INSERT and column-limited UPDATE on memberships, SELECT/INSERT and column-limited UPDATE on invitations).
- **Not run against PostgreSQL here.** The store and provisioning logic are tested with a recording fake connection, and the migration passes the repository's SQL and checksum guards. The locking, trigger and RLS behaviour need the PostgreSQL integration run before real use (`docs/RELEASE_GATES.md`).
