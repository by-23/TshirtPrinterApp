import type { FastifyInstance, FastifyRequest } from "fastify";
import { eq, sql } from "drizzle-orm";
import { createOrderSchema, updateOrderStatusSchema, type SyncOrderPushPayload } from "@tshirt/shared-types";
import { db } from "../../db/client.js";
import { orders } from "../../db/schema.js";
import { dataPath } from "../../lib/dataDir.js";
import { emitOrderEvent } from "../../realtime/socket.js";
import { generateOrderImages } from "./mockup.js";
import { getDtfPrinterConfig } from "../printer/config.js";
import { prepareDtfPrint } from "../printer/dtfExport.js";
import { drainSyncQueue, enqueueOrderPush } from "../sync/queue.js";
import { getSyncSocket } from "../sync/client.js";

type OrderRow = typeof orders.$inferSelect;

/** Queues this order's current state for `sync:order-push`, and nudges an immediate drain if already connected (Этап 7). */
function pushOrderToCentral(app: FastifyInstance, row: OrderRow): void {
  const payload: SyncOrderPushPayload = {
    pointOrderId: row.id,
    status: row.status,
    garmentType: row.garmentType,
    printSize: row.printSize,
    price: row.price,
    printCount: row.printCount,
    createdAt: row.createdAt,
  };
  void enqueueOrderPush(payload).then(() => {
    const socket = getSyncSocket();
    if (socket?.connected) {
      void drainSyncQueue(socket, app.log);
    }
  });
}

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
    printCount: row.printCount,
    mockupImageUrl: row.mockupImagePath ? fileUrl(request, row.mockupImagePath) : null,
    designImageUrl: row.designImagePath ? fileUrl(request, row.designImagePath) : null,
    dtfPrintImageUrl: row.dtfPrintImagePath ? fileUrl(request, row.dtfPrintImagePath) : null,
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
    pushOrderToCentral(app, finalRow);
    return reply.status(201).send(serialized);
  });

  /**
   * Builds a RIP-ready DTF PNG for Epson L1800 (physical mm @ DPI, mirror),
   * copies it into the hotfolder, and returns paths for the operator/desktop.
   */
  app.post<{ Params: { id: string } }>("/orders/:id/prepare-print", async (request, reply) => {
    const id = parseId(request.params.id);
    if (id === null) {
      return reply.status(400).send({ error: "Invalid id" });
    }

    const [row] = await db.select().from(orders).where(eq(orders.id, id));
    if (!row) {
      return reply.status(404).send({ error: "Order not found" });
    }
    if (!row.designImagePath) {
      return reply.status(400).send({ error: "Order has no design image" });
    }

    try {
      const { config } = await getDtfPrinterConfig();
      const designAbsolutePath = dataPath(row.designImagePath);
      const job = await prepareDtfPrint({
        orderId: String(row.id),
        garmentType: row.garmentType,
        side: row.side,
        designAbsolutePath,
        config,
      });

      const [updated] = await db
        .update(orders)
        .set({ dtfPrintImagePath: job.dtfPrintImagePath })
        .where(eq(orders.id, id))
        .returning();

      const serialized = serializeOrder(updated!, request);
      emitOrderEvent("updated", serialized);

      return {
        order: serialized,
        printJob: {
          fileUrl: fileUrl(request, job.dtfPrintImagePath),
          absolutePath: job.absolutePath,
          hotfolderAbsolutePath: job.hotfolderAbsolutePath,
          hotfolderDir: job.hotfolderDir,
          widthMm: job.widthMm,
          heightMm: job.heightMm,
          widthPx: job.widthPx,
          heightPx: job.heightPx,
          dpi: job.dpi,
          mirrored: job.mirrored,
          mediaSize: job.mediaSize,
          printerModel: job.printerModel,
        },
      };
    } catch (err) {
      app.log.error(err, "Failed to prepare DTF print");
      return reply.status(500).send({ error: "Failed to prepare DTF print" });
    }
  });

  // Status transitions used by Stage 5's operator actions ("Отправить на
  // печать" -> accepted, "Готово" -> done, "Отменить заказ" -> cancelled).
  // Every transition to `accepted` (first print or reprint) bumps `printCount`
  // and immediately re-pushes to central for cash-register audit.
  app.patch<{ Params: { id: string } }>("/orders/:id", async (request, reply) => {
    const id = parseId(request.params.id);
    if (id === null) {
      return reply.status(400).send({ error: "Invalid id" });
    }

    const parsed = updateOrderStatusSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const patch =
      parsed.data.status === "accepted"
        ? { status: parsed.data.status, printCount: sql`${orders.printCount} + 1` }
        : { status: parsed.data.status };

    const [row] = await db.update(orders).set(patch).where(eq(orders.id, id)).returning();
    if (!row) {
      return reply.status(404).send({ error: "Order not found" });
    }
    const serialized = serializeOrder(row, request);
    emitOrderEvent("updated", serialized);
    pushOrderToCentral(app, row);
    return serialized;
  });
}
