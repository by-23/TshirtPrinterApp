import { z } from "zod";

/** How a managed editor font is resolved on the kiosk. */
export const fontKindSchema = z.enum(["system", "local", "google", "custom"]);
export type FontKind = z.infer<typeof fontKindSchema>;

export const fontFormatSchema = z.enum(["truetype", "opentype", "woff", "woff2"]);
export type FontFormat = z.infer<typeof fontFormatSchema>;

/**
 * One editor font in a `sync:snapshot` (and the point's `GET /fonts` response).
 * Built-ins use stable string ids (`pt-sans-narrow`); custom uploads use UUIDs.
 * `fileUrl` is a path on the central-relay origin for `kind: "custom"` only.
 */
export const managedFontSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  /** CSS `font-family` stack used by Fabric / chips. */
  family: z.string().min(1),
  kind: fontKindSchema,
  /** Google Fonts CSS2 family name — only for `kind: "google"`. */
  googleFamily: z.string().min(1).optional(),
  enabled: z.boolean(),
  sortOrder: z.number().int(),
  revision: z.number().int().nonnegative(),
  /** Central-relay path (`/fonts/:id/file`) — only for `kind: "custom"`. */
  fileUrl: z.string().optional(),
  format: fontFormatSchema.optional(),
});
export type ManagedFont = z.infer<typeof managedFontSchema>;

/** Admin list row (no file bytes; sync status is implicit via snapshot push). */
export const adminFontSchema = managedFontSchema.extend({
  createdAt: z.string(),
  updatedAt: z.string(),
  /** Built-ins cannot be deleted — only disabled. */
  deletable: z.boolean(),
});
export type AdminFont = z.infer<typeof adminFontSchema>;

export const createCustomFontSchema = z.object({
  label: z.string().min(1).max(120),
  /** Optional CSS family name; defaults to a quoted form of `label`. */
  familyName: z.string().min(1).max(120).optional(),
});
export type CreateCustomFontInput = z.infer<typeof createCustomFontSchema>;

export const updateManagedFontSchema = z
  .object({
    label: z.string().min(1).max(120).optional(),
    enabled: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "No fields to update" });
export type UpdateManagedFontInput = z.infer<typeof updateManagedFontSchema>;

/**
 * Default canvas text fonts — seeded on central-relay and used as the
 * point/kiosk fallback when sync has never delivered a font list.
 * Keep in sync with the historical `EDITOR_FONTS` list in the kiosk.
 */
export const BUILTIN_EDITOR_FONTS: ReadonlyArray<{
  id: string;
  label: string;
  family: string;
  kind: Exclude<FontKind, "custom">;
  googleFamily?: string;
  sortOrder: number;
}> = [
  {
    id: "pt-sans-narrow",
    label: "PT Sans Narrow",
    family: "'PT Sans Narrow', sans-serif",
    kind: "local",
    sortOrder: 0,
  },
  {
    id: "barlow-condensed",
    label: "Barlow Condensed",
    family: "'Barlow Condensed', sans-serif",
    kind: "local",
    sortOrder: 1,
  },
  {
    id: "roboto",
    label: "Roboto",
    family: "'Roboto', sans-serif",
    kind: "google",
    googleFamily: "Roboto",
    sortOrder: 2,
  },
  {
    id: "roboto-condensed",
    label: "Roboto Condensed",
    family: "'Roboto Condensed', sans-serif",
    kind: "google",
    googleFamily: "Roboto Condensed",
    sortOrder: 3,
  },
  {
    id: "oswald",
    label: "Oswald",
    family: "'Oswald', sans-serif",
    kind: "google",
    googleFamily: "Oswald",
    sortOrder: 4,
  },
  {
    id: "anton",
    label: "Anton",
    family: "'Anton', sans-serif",
    kind: "google",
    googleFamily: "Anton",
    sortOrder: 5,
  },
  {
    id: "bebas-neue",
    label: "Bebas Neue",
    family: "'Bebas Neue', sans-serif",
    kind: "google",
    googleFamily: "Bebas Neue",
    sortOrder: 6,
  },
  {
    id: "bangers",
    label: "Bangers",
    family: "'Bangers', cursive",
    kind: "google",
    googleFamily: "Bangers",
    sortOrder: 7,
  },
  {
    id: "permanent-marker",
    label: "Permanent Marker",
    family: "'Permanent Marker', cursive",
    kind: "google",
    googleFamily: "Permanent Marker",
    sortOrder: 8,
  },
  {
    id: "pacifico",
    label: "Pacifico",
    family: "'Pacifico', cursive",
    kind: "google",
    googleFamily: "Pacifico",
    sortOrder: 9,
  },
  {
    id: "rubik",
    label: "Rubik",
    family: "'Rubik', sans-serif",
    kind: "google",
    googleFamily: "Rubik",
    sortOrder: 10,
  },
  {
    id: "roboto-slab",
    label: "Roboto Slab",
    family: "'Roboto Slab', serif",
    kind: "google",
    googleFamily: "Roboto Slab",
    sortOrder: 11,
  },
  {
    id: "impact",
    label: "Impact",
    family: "Impact, Haettenschweiler, sans-serif",
    kind: "system",
    sortOrder: 12,
  },
  {
    id: "courier",
    label: "Courier",
    family: "'Courier New', Courier, monospace",
    kind: "system",
    sortOrder: 13,
  },
];

/** Google CSS2 weights used when injecting enabled Google faces on the kiosk. */
export const GOOGLE_FONT_WEIGHTS: Record<string, number[] | undefined> = {
  Inter: [400, 600, 700, 800],
  Oswald: [400, 600, 700],
  Montserrat: [600, 700, 800],
  Rubik: [400, 600, 700],
  Roboto: [400, 500, 600, 700, 800, 900],
  "Roboto Condensed": [400, 500, 600, 700],
  "Roboto Slab": [400, 700],
};
