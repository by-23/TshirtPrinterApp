import { z } from "zod";

export const designCategorySchema = z.enum([
  "memes",
  "anime_movies",
  "games",
  "text",
  "custom",
  "ai_style",
]);
export type DesignCategory = z.infer<typeof designCategorySchema>;

export const designSchema = z.object({
  id: z.string(),
  category: designCategorySchema,
  title: z.string(),
  imageUrl: z.string(),
  isFeatured: z.boolean().default(false),
});
export type Design = z.infer<typeof designSchema>;

export const createDesignSchema = z.object({
  category: designCategorySchema,
  title: z.string().min(1),
  imageUrl: z.string().default(""),
  isFeatured: z.boolean().default(false),
});
export type CreateDesignInput = z.infer<typeof createDesignSchema>;

export const updateDesignSchema = createDesignSchema.partial();
export type UpdateDesignInput = z.infer<typeof updateDesignSchema>;
