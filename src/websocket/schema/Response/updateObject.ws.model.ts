import { z } from "zod";

import { vector3Schema } from "../vector3.model";

const responseUpdateObjectDataSchema = z.object({
  object_type: z.enum(["planet", "moon", "system", "star"]),
  object_uuid: z.uuidv4(),
  object_data: z.object({
    from_timestamp: z.number().int().positive(),
    positions: z.array(vector3Schema).optional(),
    rotations: z.array(vector3Schema).optional(),
  }),
});

export const responseUpdateObjectSchema = z.object({
  namespace: z.literal("genericprops"),
  event: z.literal("update_object"),
  data: responseUpdateObjectDataSchema,
});

export type ResponseUpdateObjectType = z.infer<
  typeof responseUpdateObjectSchema
>;
export type ResponseUpdateObjectDataType = z.infer<
  typeof responseUpdateObjectDataSchema
>;
