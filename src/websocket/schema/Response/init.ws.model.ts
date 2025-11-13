import { z } from "zod";

import { vector3Schema } from "../vector3.model";

const responseInitData = z.object({
  object_type: z.enum(["planet", "moon", "system", "star"]),
  object_uuid: z.uuidv4(),
  object_data: z.object({
    name: z.string(),
    scenename: z.string(),
    parent_id: z.string().optional(),
    from_timestamp: z.number().int().positive(),
    positions: z.array(vector3Schema).optional(),
    rotations: z.array(vector3Schema).optional(),
  }),
});

export const responseInitSchema = z.object({
  namespace: z.literal("genericprops"),
  event: z.literal("create_object"),
  data: z.array(responseInitData),
});

export type ResponseInitType = z.infer<typeof responseInitSchema>;
export type ResponseInitDataType = z.infer<typeof responseInitData>;
