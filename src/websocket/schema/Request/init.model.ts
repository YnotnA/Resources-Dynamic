import { z } from "zod";

import { requestTransform } from "./requestTransform.model";

export const requestInitSchema = z.object({
  event_type: z.literal("init"),
  data: requestTransform.extend({
    system_internal_name: z.string(),
  }),
});

export type RequestInitType = z.infer<typeof requestInitSchema>;
