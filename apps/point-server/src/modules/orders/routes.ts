import type { FastifyInstance, FastifyRequest } from "fastify";
import { eq } from "drizzle-orm";
import { createOrderSchema, updateOrderStatusSchema } from "@tshirt/shared-types";
import { db } from "../../db/client.js";
import { orders } from "../../db/schema.js";
import { emitOrderEvent } from "../../realtime/socket.js";
import { generateOrderImages } from "./mockup.js";

type OrderRow = typeof orders.$inferSelect;

function fileUrl(request: FastifyRequest, relativePath: string): string {
  return `${request.protocol}://${request.headers.host}/files/${relativePath}`;
}

function serializeOrder(row: OrderRow, request: FastifyRequest) {
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
    mockupImageUrl: row.mockupImagePath ? fileUrl(request, row.mockupImagePath) : null,
    designImageUrl: row.designImagePath ? fileUrl(request, row.designImagePath) : null,
    createdAt: row.createdAt,
  };
}

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) ? id : null;
}

export async function ordersRoutes(app: FastifyInstance) {
  app.get("/orders", async (request) => {
    const rows = await db.select().from(orders);
    return rows.map((row) => serializeOrder(row, request));
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
    return serializeOrder(row, request);
  });

  app.post("/orders", async (request, reply) => {
    const parsed = createOrderSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const { designImageBase64, ...orderFields } = parsed.data;
    const [row] = await db.insert(orders).values(orderFields).returning();
    let finalRow = row!;

    if (designImageBase64) {
      try {
        const { designImagePath, mockupImagePath } = await generateOrderImages({
          orderId: String(finalRow.id),
          garmentType: finalRow.garmentType,
          garmentColor: finalRow.garmentColor,
          side: finalRow.side,
          designImageBase64,
        });
        const [updated] = await db
          .update(orders)
          .set({ designImagePath, mockupImagePath })
          .where(eq(orders.id, finalRow.id))
          .returning();
        finalRow = updated!;
      } catch (err) {
        // Order is still valid without the generated PNGs — operator can still
        // see/accept it, just without a preview. Fail-open rather than 500.
        app.log.error(err, "Failed to generate order images");
      }
    }

    const serialized = serializeOrder(finalRow, request);
    emitOrderEvent("created", serialized);
    return reply.status(201).send(serialized);
  });

  // Status transitions used by Stage 5's operator actions ("Отправить на
  // печать" -> accepted, "Готово" -> done, "Отменить заказ" -> cancelled).
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
    const serialized = serializeOrder(row, request);
    emitOrderEvent("updated", serialized);
    return serialized;
  });
}
