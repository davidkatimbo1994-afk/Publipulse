-- LOCAL DEVELOPMENT ONLY. Creates the runtime role the API connects as.
-- The role does not own tables, is not a superuser and cannot bypass row-level security, which the schema relies on.
-- The table grants below are deliberately broad so the whole API works in a dev stack. For any real deployment replace
-- them with the reviewed least-privilege set described in docs/DEPLOYMENT_SECURITY.md.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'publipulse_app') THEN
    CREATE ROLE publipulse_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  END IF;
END $$;

ALTER ROLE publipulse_app PASSWORD :'app_password';

GRANT CONNECT ON DATABASE :"dbname" TO publipulse_app;
GRANT USAGE ON SCHEMA public TO publipulse_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO publipulse_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO publipulse_app;
-- The audit trail is append-only, and the migration bookkeeping table is not the application's business.
REVOKE UPDATE, DELETE, TRUNCATE ON audit_events FROM publipulse_app;
REVOKE ALL ON schema_migrations FROM publipulse_app;
