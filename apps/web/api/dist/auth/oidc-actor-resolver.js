import { createRemoteJWKSet, jwtVerify } from 'jose';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ROLES = new Set(['owner', 'administrator', 'reviewer', 'investigator', 'responder', 'analyst', 'read_only', 'auditor']);
export function createOidcVerifier(config) {
    const issuerUrl = new URL(config.issuer);
    const jwksUrl = new URL(config.jwksUrl);
    if (issuerUrl.protocol !== 'https:' || jwksUrl.protocol !== 'https:') {
        throw new Error('OIDC issuer and JWKS endpoints must use HTTPS');
    }
    if (!config.audience.trim())
        throw new Error('OIDC audience must not be empty');
    // Preserve the configured issuer exactly: OIDC issuer matching is string-exact.
    if (issuerUrl.search || issuerUrl.hash || issuerUrl.username || issuerUrl.password) {
        throw new Error('OIDC issuer must be a clean issuer URL without credentials, query or fragment');
    }
    if (jwksUrl.username || jwksUrl.password || jwksUrl.hash) {
        throw new Error('OIDC JWKS URL must not contain credentials or a fragment');
    }
    const issuer = config.issuer;
    const jwks = createRemoteJWKSet(jwksUrl);
    return async (token) => {
        const { payload } = await jwtVerify(token, jwks, { issuer, audience: config.audience, algorithms: ['RS256', 'ES256'] });
        return payload;
    };
}
/**
 * Verifies an OIDC access token and then resolves active organisation membership from PostgreSQL.
 * The requested organisation is only a selector; it is never trusted until membership is verified.
 * Membership lookup runs under transaction-local tenant scope and uses a non-owner runtime DB role.
 */
export function createOidcActorResolver(pool, verifyToken) {
    return async (authorizationHeader, organizationHeader) => {
        if (!authorizationHeader || authorizationHeader.length > 12_000)
            return null;
        const match = /^Bearer ([A-Za-z0-9._~+/-]+=*)$/.exec(authorizationHeader);
        if (!match || !organizationHeader || !UUID.test(organizationHeader))
            return null;
        let claims;
        try {
            claims = await verifyToken(match[1]);
        }
        catch {
            return null;
        }
        if (typeof claims.sub !== 'string' || !UUID.test(claims.sub))
            return null;
        const connection = await pool.connect();
        let operationFailed = false;
        try {
            await connection.query('BEGIN READ ONLY');
            await connection.query("SELECT set_config('app.organization_id', $1, true)", [organizationHeader]);
            const result = await connection.query(`SELECT role FROM organization_memberships
         WHERE organization_id = $1 AND user_id = $2 AND active = true
         LIMIT 1`, [organizationHeader, claims.sub]);
            await connection.query('COMMIT');
            const role = result.rows[0]?.role;
            if (!role || !ROLES.has(role))
                return null;
            const actor = { userId: claims.sub, organizationId: organizationHeader, roles: [role] };
            return actor;
        }
        catch (error) {
            operationFailed = true;
            try {
                await connection.query('ROLLBACK');
            }
            catch { /* Preserve the original failure. */ }
            throw error;
        }
        finally {
            try {
                connection.release();
            }
            catch (releaseError) {
                // A cleanup failure must not hide a failed authentication/database operation.
                if (!operationFailed)
                    throw releaseError;
            }
        }
    };
}
