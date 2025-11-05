import { pgSequence } from "drizzle-orm/pg-core";

export const celestialBodiesIdSeq = pgSequence("celestial_bodies_id_seq");
