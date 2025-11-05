CREATE TABLE "systems" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"internal_name" text NOT NULL,
	CONSTRAINT "systems_name_unique" UNIQUE("name"),
	CONSTRAINT "systems_internal_name_unique" UNIQUE("internal_name")
);
--> statement-breakpoint
CREATE TABLE "stars" (
	"id" serial PRIMARY KEY NOT NULL,
	"uuid" uuid DEFAULT gen_random_uuid(),
	"system_id" integer,
	"name" text NOT NULL,
	"internal_name" text NOT NULL,
	"mass_kg" double precision NOT NULL,
	CONSTRAINT "stars_uuid_unique" UNIQUE("uuid"),
	CONSTRAINT "stars_name_unique" UNIQUE("name"),
	CONSTRAINT "stars_internal_name_unique" UNIQUE("internal_name")
);
--> statement-breakpoint
CREATE TABLE "planets" (
	"id" serial PRIMARY KEY NOT NULL,
	"uuid" uuid DEFAULT gen_random_uuid(),
	"system_id" integer,
	"name" text NOT NULL,
	"internal_name" text NOT NULL,
	"mass_kg" double precision NOT NULL,
	"periapsis_au" double precision NOT NULL,
	"apoapsis_au" double precision NOT NULL,
	"inc_deg" double precision NOT NULL,
	"node_deg" double precision NOT NULL,
	"arg_peri_deg" double precision NOT NULL,
	"mean_anomaly_deg" double precision NOT NULL,
	"radius_km" double precision NOT NULL,
	"radius_gravity_influence_km" double precision NOT NULL,
	CONSTRAINT "planets_uuid_unique" UNIQUE("uuid"),
	CONSTRAINT "planets_name_unique" UNIQUE("name"),
	CONSTRAINT "planets_internal_name_unique" UNIQUE("internal_name")
);
--> statement-breakpoint
CREATE TABLE "planet_moons" (
	"id" serial PRIMARY KEY NOT NULL,
	"planet_id" integer,
	"uuid" uuid DEFAULT gen_random_uuid(),
	"name" text NOT NULL,
	"internal_name" text NOT NULL,
	"mass_kg" double precision NOT NULL,
	"periapsis_au" double precision NOT NULL,
	"apoapsis_au" double precision NOT NULL,
	"inc_deg" double precision NOT NULL,
	"node_deg" double precision NOT NULL,
	"arg_peri_deg" double precision NOT NULL,
	"mean_anomaly_deg" double precision NOT NULL,
	"radius_km" double precision NOT NULL,
	"radius_gravity_influence_km" double precision NOT NULL,
	CONSTRAINT "planet_moons_uuid_unique" UNIQUE("uuid"),
	CONSTRAINT "planet_moons_name_unique" UNIQUE("name"),
	CONSTRAINT "planet_moons_internal_name_unique" UNIQUE("internal_name")
);
--> statement-breakpoint
CREATE TABLE "celestial_bodies_mapping" (
	"uuid" uuid PRIMARY KEY NOT NULL,
	"id" integer NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"internal_name" text NOT NULL,
	"system_id" integer NOT NULL,
	"parent_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "celestial_bodies_mapping_uuid_unique" UNIQUE("uuid"),
	CONSTRAINT "celestial_bodies_mapping_id_unique" UNIQUE("id"),
	CONSTRAINT "celestial_bodies_mapping_name_unique" UNIQUE("name"),
	CONSTRAINT "celestial_bodies_mapping_internal_name_unique" UNIQUE("internal_name")
);
--> statement-breakpoint
ALTER TABLE "stars" ADD CONSTRAINT "stars_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planets" ADD CONSTRAINT "planets_system_id_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."systems"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planet_moons" ADD CONSTRAINT "planet_moons_planet_id_planets_id_fk" FOREIGN KEY ("planet_id") REFERENCES "public"."planets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_celestial_mapping_id_type" ON "celestial_bodies_mapping" USING btree ("id","type");--> statement-breakpoint
CREATE INDEX "idx_celestial_mapping_system" ON "celestial_bodies_mapping" USING btree ("system_id");