DO $body$
DECLARE
    r RECORD;
    cnt BIGINT;
BEGIN
    FOR r IN (
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_name NOT IN ('spatial_ref_sys', 'geometry_columns', 'geography_columns', '__EFMigrationsHistory')
        ORDER BY table_name
    ) LOOP
        EXECUTE format('SELECT count(*) FROM "%s"', r.table_name) INTO cnt;
        RAISE NOTICE '%: %', r.table_name, cnt;
    END LOOP;
END $body$;
