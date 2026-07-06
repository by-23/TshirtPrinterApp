import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import { adminLoginSchema, type AuthResponse } from "@tshirt/shared-types";
import { db } from "../../db/client.js";
import { admins } from "../../db/schema.js";

export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/login", async (request, reply) => {
    const parsed = adminLoginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const [admin] = await db.select().from(admins).where(eq(admins.login, parsed.data.login));
    if (!admin) {
      return reply.status(401).send({ error: "Invalid credentials" });
    }

    const passwordMatches = await bcrypt.compare(parsed.data.password, admin.passwordHash);
    if (!passwordMatches) {
      return reply.status(401).send({ error: "Invalid credentials" });
    }

    const token = app.jwt.sign({ adminId: admin.id, login: admin.login }, { expiresIn: "12h" });
    const response: AuthResponse = {
      token,
      admin: { id: admin.id, login: admin.login },
    };
    return response;
  });

  app.get(
    "/auth/me",
    { preHandler: app.authenticate },
    async (request: FastifyRequest, _reply: FastifyReply) => {
      return { id: request.user.adminId, login: request.user.login };
    },
  );
}
