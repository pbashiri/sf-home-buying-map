import { z } from "zod";

export const SavedHomeZ = z.object({
  id: z.string().uuid(),
  label: z.string(),
  lat: z.number(),
  lng: z.number(),
  horizon: z.number(),
  notes: z.string().nullable(),
  share_token: z.string().nullable(),
  share_enabled: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type SavedHome = z.infer<typeof SavedHomeZ>;

export type SavedHomeMessage = {
  id: string;
  saved_home_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};
