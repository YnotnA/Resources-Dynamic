import { z } from "zod";

import { vector3Schema } from "../vector3.model";

export const initMessageSchema = z.object({
  namespace: z.literal("genericprops"),
  event: z.literal("create_object"),
  data: z.array(
    z.object({
      object_type: z.enum(["planet", "moon", "system", "star"]),
      object_uuid: z.uuidv4(),
      object_data: z.object({
        name: z.string(),
        scenename: z.string(),
        parent_id: z.string(),
        from_timestamp: z.number().int().positive(),
        positions: z.array(vector3Schema),
        rotations: z.array(vector3Schema),
      }),
    }),
  ),
});

export type InitMessageType = z.infer<typeof initMessageSchema>;
