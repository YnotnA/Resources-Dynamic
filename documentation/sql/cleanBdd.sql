DROP schema drizzle CASCADE; 

-- Delete all tables
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;
END
$$;

-- Delete all séquences
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT sequencename FROM pg_sequences WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP SEQUENCE IF EXISTS public.' || quote_ident(r.sequencename) || ' CASCADE';
    END LOOP;
END
$$;

-- Delete all views
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT table_name FROM information_schema.views WHERE table_schema = 'public') LOOP
        EXECUTE 'DROP VIEW IF EXISTS public.' || quote_ident(r.table_name) || ' CASCADE';
    END LOOP;
END
$$;


-- Update uuid for planets
UPDATE public.planets p SET uuid = '844221a5-e2be-432c-94c2-947462c1c310' WHERE p.internal_name = 'tarsis.1';
UPDATE public.planets p SET uuid = 'fc22a2f0-80be-4da2-89db-bc7a19665e82' WHERE p.internal_name = 'tarsis.2';
UPDATE public.planets p SET uuid = '418a2436-81f5-4069-a042-5e33ce313b20' WHERE p.internal_name = 'tarsis.3';
UPDATE public.planets p SET uuid = '3f99e498-31cd-450f-8c72-d7ae2362d27c' WHERE p.internal_name = 'tarsis.4';
UPDATE public.planets p SET uuid = '87720dfc-0699-4cf2-bacb-7e867e272c62' WHERE p.internal_name = 'tarsis.5';
UPDATE public.planets p SET uuid = '8a15cc8a-98c0-4c72-b5d5-f8ec34169d6b' WHERE p.internal_name = 'tarsis.6';
UPDATE public.planets p SET uuid = '384b6c37-c8b3-4bad-b338-1b5d09509fed' WHERE p.internal_name = 'tarsis.7';
UPDATE public.planets p SET uuid = '6d322080-dd78-4961-a895-bdb71c7f53f6' WHERE p.internal_name = 'tarsis.8';

-- Update uuid for moons
UPDATE public.planet_moons pm SET uuid = 'a1a66614-21d5-4541-8a3e-d4ae350b669c' WHERE pm.internal_name = 'tarsis.4.2';
UPDATE public.planet_moons pm SET uuid = '77ec9ee3-6e9b-47b5-af82-8f72a57cb4ac' WHERE pm.internal_name = 'tarsis.5.1';
UPDATE public.planet_moons pm SET uuid = '88f3a0af-28c7-42f6-8228-551a98fc55cd' WHERE pm.internal_name = 'tarsis.4.1';

-- Update uuid for stars
UPDATE public.stars s SET uuid = 'a848b7e9-0d91-4868-bd62-7731fd253157' WHERE s.internal_name = 'tarsis';

-- Update uuid for systems
UPDATE public.system s SET uuid = '6043ed36-8aac-40e9-8fa9-332eeec1e071' WHERE s.internal_name = 'tarsis';
