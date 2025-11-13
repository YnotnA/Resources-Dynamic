import { z } from "zod";

import { requestTransformBase } from "./requestTransform.model";

export const nextTicksSchema = z.object({
  event_type: z.literal("transform"),
  data: requestTransformBase.extend({
    uuid: z.uuid(),
  }),
});

export type NextTicksType = z.infer<typeof nextTicksSchema>;
