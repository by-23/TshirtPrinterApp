import fastifyJwt from "@fastify/jwt";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { env } from "../../env.js";

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { adminId: string; login: string };
    user: { adminId: string; login: string };
  }
}

/**
 * Registers `@fastify/jwt` and an `authenticate` preHandler used by every
 * protected admin route (points/catalog-master/pricing/stats). Must run
 * before those modules are registered.
 */
export async function registerAuth(app: FastifyInstance) {
  await app.register(fastifyJwt, { secret: env.JWT_SECRET });

  app.decorate("authenticate", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch {
      reply.status(401).send({ error: "Unauthorized" });
    }
  });
}
