import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { createOrderSchema, updateOrderStatusSchema } from "@tshirt/shared-types";
import { db } from "../../db/client.js";
import { orders } from "../../db/schema.js";

type OrderRow = typeof orders.$inferSelect;

function serializeOrder(row: OrderRow) {
  return {
    id: String(row.id),
    garment: {
      id: `garment-${row.id}`,
      type: row.garmentType,
      color: row.garmentColor,
      size: row.garmentSize,
      fabric: row.garmentFabric,
    },
    side: row.side,
    printSize: row.printSize,
    price: row.price,
    status: row.status,
    mockupImageUrl: row.mockupImagePath,
    designImageUrl: row.designImagePath,
    createdAt: row.createdAt,
  };
}

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) ? id : null;
}

export async function ordersRoutes(app: FastifyInstance) {
  app.get("/orders", async () => {
    const rows = await db.select().from(orders);
    return rows.map(serializeOrder);
  });

  app.get<{ Params: { id: string } }>("/orders/:id", async (request, reply) => {
    const id = parseId(request.params.id);
    if (id === null) {
      return reply.status(400).send({ error: "Invalid id" });
    }

    const [row] = await db.select().from(orders).where(eq(orders.id, id));
    if (!row) {
      return reply.status(404).send({ error: "Order not found" });
    }
    return serializeOrder(row);
  });

  app.post("/orders", async (request, reply) => {
    const parsed = createOrderSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const [row] = await db.insert(orders).values(parsed.data).returning();
    return reply.status(201).send(serializeOrder(row!));
  });

  // Generic status transition — used by Stage 5's operator "Принять заказ",
  // not called anywhere in the kiosk checkout flow itself.
  app.patch<{ Params: { id: string } }>("/orders/:id", async (request, reply) => {
    const id = parseId(request.params.id);
    if (id === null) {
      return reply.status(400).send({ error: "Invalid id" });
    }

    const parsed = updateOrderStatusSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const [row] = await db.update(orders).set(parsed.data).where(eq(orders.id, id)).returning();
    if (!row) {
      return reply.status(404).send({ error: "Order not found" });
    }
    return serializeOrder(row);
  });
}
