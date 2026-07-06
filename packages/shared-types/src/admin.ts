import { z } from "zod";

export const adminLoginSchema = z.object({
  login: z.string().min(1),
  password: z.string().min(1),
});
export type AdminLoginInput = z.infer<typeof adminLoginSchema>;

export const adminSchema = z.object({
  id: z.string(),
  login: z.string(),
});
export type Admin = z.infer<typeof adminSchema>;

/** Response of `POST /auth/login` on central-relay — consumed by admin-panel's authStore. */
export const authResponseSchema = z.object({
  token: z.string(),
  admin: adminSchema,
});
export type AuthResponse = z.infer<typeof authResponseSchema>;
