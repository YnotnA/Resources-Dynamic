import { z } from "zod";

import { requestTransform } from "./requestTransform.model";

export const nextTicksSchema = z.object({
  event_type: z.literal("transform"),
  data: requestTransform.extend({
    uuid: z.uuid(),
  }),
});

export type NextTicksType = z.infer<typeof nextTicksSchema>;
