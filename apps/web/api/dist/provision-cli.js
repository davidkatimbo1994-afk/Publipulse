/** Usage: npm run provision:org -w @publipulse/api -- --name "District Health Office" --country UG [--owner-sub <uuid>] [--invite-days 7] [--dry-run]
 *  Needs PROVISION_DATABASE_URL: a database administrator connection, not the API's runtime role. */
import { PostgresPoolAdapter } from './postgres-pool.js';
import { parseProvisionArgs, provisionOrganization } from './provision-organization.js';
const parsed = parseProvisionArgs(process.argv.slice(2));
if (parsed.error || !parsed.input) {
    console.error(`Cannot provision: ${parsed.error ?? 'invalid input'}`);
    process.exit(2);
}
if (parsed.dryRun) {
    const { name, countryCode, ownerUserId, invitationDays } = parsed.input;
    console.log(`Dry run, nothing written. Would create "${name}" (${countryCode}) with its first owner via ${ownerUserId ? `existing identity ${ownerUserId}` : `a one-time invitation valid ${invitationDays} days`}.`);
    process.exit(0);
}
const url = process.env.PROVISION_DATABASE_URL;
if (!url) {
    console.error('PROVISION_DATABASE_URL is required. Use an administrator connection, not the API runtime role.');
    process.exit(2);
}
const pool = new PostgresPoolAdapter(url, process.env.NODE_ENV === 'production');
try {
    const r = await provisionOrganization(pool, parsed.input);
    console.log(`Organisation created. Organisation ID: ${r.organizationId}`);
    if (r.ownerInvitationCode) {
        console.log(`Owner invitation code (shown once, expires ${r.invitationExpiresAt}):\n${r.ownerInvitationCode}\nGive it to the first owner over a trusted channel. They sign in, then redeem it for this organisation ID.`);
    }
}
catch (e) {
    console.error(`Provisioning failed: ${e instanceof Error ? e.message : 'unknown error'}`);
    process.exitCode = 1;
}
finally {
    await pool.close();
}
