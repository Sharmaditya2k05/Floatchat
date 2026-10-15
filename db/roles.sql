-- Read-only role used by the API. Ingestion uses floatchat_admin.
DO $$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'floatchat_ro') THEN
      CREATE ROLE floatchat_ro LOGIN PASSWORD 'floatchat_ro';
   END IF;
END
$$;

GRANT CONNECT ON DATABASE floatchat TO floatchat_ro;
GRANT USAGE ON SCHEMA public TO floatchat_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO floatchat_ro;
ALTER DEFAULT PRIVILEGES FOR ROLE floatchat_admin IN SCHEMA public
  GRANT SELECT ON TABLES TO floatchat_ro;
