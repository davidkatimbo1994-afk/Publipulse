/** Usage: npm run purge:sender-events -w @publipulse/api -- [--days 30] [--dry-run]
 *  Deletes community_sender_events older than the retention period (ADR-008: 30 days). Needs PROVISION_DATABASE_URL, an
 *  administrator connection: the runtime role cannot delete these rows. Run daily from your scheduler. */
import { PostgresPoolAdapter } from './postgres-pool.js';
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const i = args.indexOf('--days');
const days = i >= 0 ? Number(args[i + 1]) : 30;
if (!Number.isInteger(days) || days < 1 || days > 365) {
    console.error('--days must be a whole number from 1 to 365');
    process.exit(2);
}
const url = process.env.PROVISION_DATABASE_URL;
if (!url) {
    console.error('PROVISION_DATABASE_URL is required (administrator connection).');
    process.exit(2);
}
const pool = new PostgresPoolAdapter(url, process.env.NODE_ENV === 'production');
const c = await pool.connect();
try {
    await c.query('BEGIN');
    // Row-level security applies to the administrator too, so each organisation is purged under its own scope.
    const orgs = await c.query('SELECT id FROM organizations');
    let total = 0;
    for (const o of orgs.rows) {
        await c.query("SELECT set_config('app.organization_id',$1,true)", [o.id]);
        const r = dryRun
            ? await c.query("SELECT count(*)::int AS n FROM community_sender_events WHERE organization_id=$1 AND occurred_at < now() - make_interval(days => $2::int)", [o.id, days])
            : await c.query("WITH d AS (DELETE FROM community_sender_events WHERE organization_id=$1 AND occurred_at < now() - make_interval(days => $2::int) RETURNING 1) SELECT count(*)::int AS n FROM d", [o.id, days]);
        total += r.rows[0]?.n ?? 0;
    }
    await c.query(dryRun ? 'ROLLBACK' : 'COMMIT');
    console.log(`${dryRun ? 'Would delete' : 'Deleted'} ${total} sender events older than ${days} days.`);
}
catch (e) {
    try {
        await c.query('ROLLBACK');
    }
    catch { /* keep the original failure */ }
    console.error(`Purge failed: ${e instanceof Error ? e.message : 'unknown error'}`);
    process.exitCode = 1;
}
finally {
    c.release();
    await pool.close();
}
