DROP schema drizzle CASCADE; 


-- Supprimer toutes les tables
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;
END
$$;

-- Supprimer toutes les séquences
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT sequencename FROM pg_sequences WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP SEQUENCE IF EXISTS public.' || quote_ident(r.sequencename) || ' CASCADE';
    END LOOP;
END
$$;

-- Supprimer toutes les vues
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT table_name FROM information_schema.views WHERE table_schema = 'public') LOOP
        EXECUTE 'DROP VIEW IF EXISTS public.' || quote_ident(r.table_name) || ' CASCADE';
    END LOOP;
END
$$;


UPDATE public.planets p SET uuid = '844221a5-e2be-432c-94c2-947462c1c310' WHERE p.id = 3;
UPDATE public.planets p SET uuid = '418a2436-81f5-4069-a042-5e33ce313b20' WHERE p.id = 4;
UPDATE public.planets p SET uuid = 'fc22a2f0-80be-4da2-89db-bc7a19665e82' WHERE p.id = 5;
UPDATE public.planets p SET uuid = '3f99e498-31cd-450f-8c72-d7ae2362d27c' WHERE p.id = 6;
UPDATE public.planets p SET uuid = '384b6c37-c8b3-4bad-b338-1b5d09509fed' WHERE p.id = 7;
UPDATE public.planets p SET uuid = '8a15cc8a-98c0-4c72-b5d5-f8ec34169d6b' WHERE p.id = 8;
UPDATE public.planets p SET uuid = '6d322080-dd78-4961-a895-bdb71c7f53f6' WHERE p.id = 9;
UPDATE public.planets p SET uuid = '87720dfc-0699-4cf2-bacb-7e867e272c62' WHERE p.id = 10;


UPDATE public.planet_moons pm SET uuid = 'a1a66614-21d5-4541-8a3e-d4ae350b669c' WHERE pm.id = 12;
UPDATE public.planet_moons pm SET uuid = '77ec9ee3-6e9b-47b5-af82-8f72a57cb4ac' WHERE pm.id = 13;
UPDATE public.planet_moons pm SET uuid = '88f3a0af-28c7-42f6-8228-551a98fc55cd' WHERE pm.id = 11;


UPDATE public.stars s SET uuid = 'a848b7e9-0d91-4868-bd62-7731fd253157' WHERE s.id = 2;
