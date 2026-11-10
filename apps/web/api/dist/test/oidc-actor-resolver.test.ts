import { describe, expect, it } from 'vitest';
import { createOidcActorResolver, type AccessTokenVerifier } from '../src/auth/oidc-actor-resolver.js';
import type { SqlConnection, SqlPool, SqlResult } from '../src/postgres-signal-store.js';

const userId = '2dfe2db1-8b0e-4cbd-bf12-c4fdbf01d3d1';
const organizationId = '1dfe2db1-8b0e-4cbd-bf12-c4fdbf01d3d1';

class MembershipConnection implements SqlConnection {
  calls: string[] = [];
  released = false;
  constructor(private readonly role: string | undefined, private readonly queryError?: Error, private readonly releaseError?: Error) {}
  async query<Row = Record<string, unknown>>(text: string): Promise<SqlResult<Row>> {
    this.calls.push(text);
    if (this.queryError && text.includes('SELECT role FROM organization_memberships')) throw this.queryError;
    if (text.includes('SELECT role FROM organization_memberships')) {
      return { rows: this.role ? [{ role: this.role } as Row] : [], rowCount: this.role ? 1 : 0 };
    }
    return { rows: [], rowCount: 0 };
  }
  release(): void { this.released = true; if (this.releaseError) throw this.releaseError; }
}
class MembershipPool implements SqlPool {
  connects = 0;
  readonly connection: MembershipConnection;
  constructor(role?: string, queryError?: Error, releaseError?: Error) { this.connection = new MembershipConnection(role, queryError, releaseError); }
  async connect(): Promise<SqlConnection> { this.connects += 1; return this.connection; }
}

const validClaims = { sub: userId, iss: 'https://identity.example.org/', aud: 'publipulse-api' };
const verifier: AccessTokenVerifier = async (token) => {
  if (token !== 'valid-token') throw new Error('invalid token');
  return validClaims;
};

describe('OIDC actor resolution', () => {
  it('rejects missing bearer credentials and missing tenant selector before database access', async () => {
    const pool = new MembershipPool('reviewer');
    const resolve = createOidcActorResolver(pool, verifier);
    expect(await resolve(undefined, organizationId)).toBeNull();
    expect(await resolve('Bearer valid-token', undefined)).toBeNull();
    expect(pool.connects).toBe(0);
  });

  it('rejects invalid tokens before database access', async () => {
    const pool = new MembershipPool('reviewer');
    const resolve = createOidcActorResolver(pool, verifier);
    expect(await resolve('Bearer invalid-token', organizationId)).toBeNull();
    expect(pool.connects).toBe(0);
  });

  it('resolves only an active membership in the requested tenant and releases the connection', async () => {
    const pool = new MembershipPool('investigator');
    const resolve = createOidcActorResolver(pool, verifier);
    const actor = await resolve('Bearer valid-token', organizationId);
    expect(actor).toEqual({ userId, organizationId, roles: ['investigator'] });
    expect(pool.connection.calls[0]).toBe('BEGIN READ ONLY');
    expect(pool.connection.calls.some((call) => call.includes("set_config('app.organization_id'"))).toBe(true);
    expect(pool.connection.calls.some((call) => call.includes('active = true'))).toBe(true);
    expect(pool.connection.calls.at(-1)).toBe('COMMIT');
    expect(pool.connection.released).toBe(true);
  });

  it('denies absent or unsupported membership roles', async () => {
    const noMembership = new MembershipPool();
    expect(await createOidcActorResolver(noMembership, verifier)('Bearer valid-token', organizationId)).toBeNull();
    const unsupported = new MembershipPool('superuser');
    expect(await createOidcActorResolver(unsupported, verifier)('Bearer valid-token', organizationId)).toBeNull();
  });

  it('preserves the database error if connection release also fails', async () => {
    const databaseError = new Error('membership query failed');
    const pool = new MembershipPool('reviewer', databaseError, new Error('release failed'));
    await expect(createOidcActorResolver(pool, verifier)('Bearer valid-token', organizationId)).rejects.toBe(databaseError);
    expect(pool.connection.calls).toContain('ROLLBACK');
    expect(pool.connection.released).toBe(true);
  });

  it('surfaces a release failure after an otherwise successful lookup', async () => {
    const releaseError = new Error('release failed');
    const pool = new MembershipPool('reviewer', undefined, releaseError);
    await expect(createOidcActorResolver(pool, verifier)('Bearer valid-token', organizationId)).rejects.toBe(releaseError);
  });
});
