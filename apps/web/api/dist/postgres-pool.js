import pg from 'pg';
import { checkPostgresClient } from './postgres-pool-health.js';
const { Pool } = pg;
class PgConnectionAdapter {
    client;
    constructor(client) {
        this.client = client;
    }
    async query(text, values) {
        const result = await this.client.query(text, values ? [...values] : undefined);
        return { rows: result.rows, rowCount: result.rowCount };
    }
    release() { this.client.release(); }
}
export class PostgresPoolAdapter {
    pool;
    constructor(connectionString, production = false) {
        this.pool = new Pool({
            connectionString,
            max: 10,
            connectionTimeoutMillis: 5_000,
            // Bound both client-side waiting and server-side statement execution so
            // a stalled query cannot hold a pooled connection indefinitely.
            query_timeout: 5_000,
            statement_timeout: 5_000,
            idleTimeoutMillis: 30_000,
            allowExitOnIdle: false,
            ...(production ? { ssl: { rejectUnauthorized: true } } : {})
        });
    }
    async connect() {
        return new PgConnectionAdapter(await this.pool.connect());
    }
    async check() {
        return checkPostgresClient(await this.pool.connect());
    }
    async close() { await this.pool.end(); }
}
