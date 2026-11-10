/** Parse API_PORT strictly as a decimal TCP port; avoid Number() accepting hex/scientific notation. */
export function parseApiPort(value) {
    if (value === undefined)
        return 4000;
    if (!/^[0-9]{1,5}$/.test(value)) {
        throw new Error('API_PORT must be a valid decimal TCP port');
    }
    const port = Number(value);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error('API_PORT must be a valid decimal TCP port');
    }
    return port;
}
const MAX_WEB_ORIGINS = 5;
/**
 * Parse WEB_ORIGIN: one exact browser origin, or a comma-separated list (for example the web command center
 * and the field PWA served from different hosts). Each entry must be a bare origin; production entries must be
 * HTTPS. No wildcards, paths, credentials, queries or fragments are accepted.
 */
export function parseWebOrigins(value, isProduction) {
    if (!value?.trim())
        throw new Error('WEB_ORIGIN must be explicitly configured in production');
    const entries = value.split(',').map((entry) => entry.trim());
    if (entries.some((entry) => entry === ''))
        throw new Error('WEB_ORIGIN must be a valid origin URL');
    if (entries.length > MAX_WEB_ORIGINS)
        throw new Error(`WEB_ORIGIN may list at most ${MAX_WEB_ORIGINS} origins`);
    for (const entry of entries) {
        let parsed;
        try {
            parsed = new URL(entry);
        }
        catch {
            throw new Error('WEB_ORIGIN must be a valid origin URL');
        }
        if (parsed.origin !== entry || (isProduction && parsed.protocol !== 'https:')) {
            throw new Error('WEB_ORIGIN must be an origin without a path, credentials, query or fragment; production origins must use HTTPS');
        }
    }
    return [...new Set(entries)];
}
/** Validate production-only settings before allocating external resources such as a DB pool. */
export function validateProductionWebOrigin(environment, origin) {
    if (environment !== 'production')
        return;
    parseWebOrigins(origin, true);
}
/** Reject incomplete or unsafe production connection/authentication configuration before opening sockets. */
export function validateProductionServiceConfig(environment, config) {
    if (environment !== 'production')
        return;
    const required = [
        ['databaseUrl', 'DATABASE_URL'],
        ['issuer', 'OIDC_ISSUER'],
        ['audience', 'OIDC_AUDIENCE'],
        ['jwksUrl', 'OIDC_JWKS_URL']
    ];
    for (const [key, label] of required) {
        if (!config[key]?.trim())
            throw new Error(`Production requires a non-empty ${label}`);
    }
    let database;
    try {
        database = new URL(config.databaseUrl);
    }
    catch {
        throw new Error('DATABASE_URL must be a valid PostgreSQL connection URL');
    }
    if (database.protocol !== 'postgres:' && database.protocol !== 'postgresql:') {
        throw new Error('DATABASE_URL must use the postgres:// or postgresql:// scheme');
    }
    if (!database.hostname || database.pathname.length < 2 || database.pathname === '/') {
        throw new Error('DATABASE_URL must include a database host and explicit database name');
    }
    if (database.hash) {
        throw new Error('DATABASE_URL must not contain a fragment');
    }
    // node-postgres may let SSL parameters in the connection string override the
    // explicit TLS options supplied to Pool. PostgreSQL `options` can also set
    // session parameters such as search_path. Keep transport and session policy
    // in service configuration rather than accepting them from a connection URL.
    const tlsParameters = new Set(['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'ssl', 'options']);
    // Query parameter names are not consistently normalized by URL parsers and
    // database drivers. Compare decoded names case-insensitively, including duplicates.
    for (const [name] of database.searchParams) {
        const normalizedName = name.toLowerCase();
        if (tlsParameters.has(normalizedName)) {
            throw new Error(`DATABASE_URL must not override production TLS/session policy using ${normalizedName}; configure it through the service`);
        }
    }
    for (const [value, label] of [[config.issuer, 'OIDC_ISSUER'], [config.jwksUrl, 'OIDC_JWKS_URL']]) {
        let parsed;
        try {
            parsed = new URL(value);
        }
        catch {
            throw new Error(`${label} must be a valid HTTPS URL in production`);
        }
        if (parsed.protocol !== 'https:' || parsed.username || parsed.password || !parsed.hostname) {
            throw new Error(`${label} must be an HTTPS URL without embedded credentials in production`);
        }
        if (label === 'OIDC_ISSUER' && (parsed.search || parsed.hash)) {
            throw new Error('OIDC_ISSUER must not contain a query string or fragment');
        }
    }
    validateProductionWebOrigin(environment, config.webOrigin);
}
