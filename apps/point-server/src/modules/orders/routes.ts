import type { FastifyInstance, FastifyRequest } from "fastify";
import { eq, sql } from "drizzle-orm";
import { createOrderSchema, updateOrderStatusSchema, type DtfPrinterConfig, type SyncOrderPushPayload } from "@tshirt/shared-types";
import { db } from "../../db/client.js";
import { orders } from "../../db/schema.js";
import { emitOrderEvent } from "../../realtime/socket.js";
import {
  ensureOrderMockup,
  generateOrderImages,
  resolveOrderDesignAbsolutePath,
} from "./mockup.js";
import { getDtfPrinterConfig } from "../printer/config.js";
import { copyOrderFileToHotfolder, prepareDtfPrint, type PrepareDtfPrintResult } from "../printer/dtfExport.js";
import { dataPath } from "../../lib/dataDir.js";
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
    otherSide: row.otherSide ?? null,
    otherPrintSize: row.otherPrintSize ?? null,
    otherMockupImageUrl: row.otherMockupImagePath ? fileUrl(request, row.otherMockupImagePath) : null,
    otherDesignImageUrl: row.otherDesignImagePath ? fileUrl(request, row.otherDesignImagePath) : null,
    otherDtfPrintImageUrl: row.otherDtfPrintImagePath ? fileUrl(request, row.otherDtfPrintImagePath) : null,
    createdAt: row.createdAt,
  };
}

function serializePrintJob(request: FastifyRequest, job: PrepareDtfPrintResult, side: OrderRow["side"]) {
  return {
    side,
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
  };
}

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) ? id : null;
}

async function writeCashierSideFiles(input: {
  orderId: string;
  garmentType: OrderRow["garmentType"];
  garmentColor: string;
  side: OrderRow["side"];
  designAbsolutePath: string;
  nameSuffix?: string;
  config: DtfPrinterConfig;
}): Promise<{ mockupImagePath: string | null; dtf: PrepareDtfPrintResult }> {
  let mockupImagePath: string | null = null;
  try {
    mockupImagePath = await ensureOrderMockup({
      orderId: input.orderId,
      garmentType: input.garmentType,
      garmentColor: input.garmentColor,
      side: input.side,
      designAbsolutePath: input.designAbsolutePath,
      nameSuffix: input.nameSuffix,
    });
  } catch {
    // Cashier still needs the mirrored RIP file even if the mockup composite fails.
  }
  const dtf = await prepareDtfPrint({
    orderId: input.orderId,
    garmentType: input.garmentType,
    side: input.side,
    designAbsolutePath: input.designAbsolutePath,
    config: input.config,
    nameSuffix: input.nameSuffix,
  });
  if (mockupImagePath) {
    await copyOrderFileToHotfolder({
      orderId: input.orderId,
      kind: "mockup",
      sourceAbsolutePath: dataPath(...mockupImagePath.split("/").filter(Boolean)),
      config: input.config,
      nameSuffix: input.nameSuffix,
    });
  }
  return { mockupImagePath, dtf };
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

    const { designImageBase64, extraSides, ...orderFields } = parsed.data;
    const extraSide = extraSides?.[0];
    const [row] = await db
      .insert(orders)
      .values({
        ...orderFields,
        otherSide: extraSide?.side ?? null,
        otherPrintSize: extraSide?.printSize ?? null,
      })
      .returning();
    let finalRow = row!;

    if (designImageBase64) {
      try {
        const dualSide = extraSide != null;
        const primarySuffix = dualSide ? finalRow.side : undefined;
        const orderId = String(finalRow.id);
        const { config } = await getDtfPrinterConfig();
        const { designImagePath, mockupImagePath } = await generateOrderImages({
          orderId,
          garmentType: finalRow.garmentType,
          garmentColor: finalRow.garmentColor,
          side: finalRow.side,
          designImageBase64,
          nameSuffix: primarySuffix,
        });
        const extraImages =
          extraSide != null
            ? await generateOrderImages({
                orderId,
                garmentType: finalRow.garmentType,
                garmentColor: finalRow.garmentColor,
                side: extraSide.side,
                designImageBase64: extraSide.designImageBase64,
                nameSuffix: extraSide.side,
              }).catch((err) => {
                app.log.error(err, "Failed to generate other-side order images");
                return null;
              })
            : null;

        const primaryAbs = resolveOrderDesignAbsolutePath({
          orderId,
          storedRelativePath: designImagePath,
          nameSuffix: primarySuffix,
          allowUnsuffixed: true,
        });
        const extraAbs =
          extraImages && extraSide
            ? resolveOrderDesignAbsolutePath({
                orderId,
                storedRelativePath: extraImages.designImagePath,
                nameSuffix: extraSide.side,
              })
            : null;

        const primaryPrint = primaryAbs
          ? await writeCashierSideFiles({
              orderId,
              garmentType: finalRow.garmentType,
              garmentColor: finalRow.garmentColor,
              side: finalRow.side,
              designAbsolutePath: primaryAbs,
              nameSuffix: primarySuffix,
              config,
            })
          : null;
        const extraPrint =
          extraAbs && extraSide
            ? await writeCashierSideFiles({
                orderId,
                garmentType: finalRow.garmentType,
                garmentColor: finalRow.garmentColor,
                side: extraSide.side,
                designAbsolutePath: extraAbs,
                nameSuffix: extraSide.side,
                config,
              })
            : null;

        const [updated] = await db
          .update(orders)
          .set({
            designImagePath,
            mockupImagePath: primaryPrint?.mockupImagePath ?? mockupImagePath,
            dtfPrintImagePath: primaryPrint?.dtf.dtfPrintImagePath ?? null,
            ...(extraImages
              ? {
                  otherDesignImagePath: extraImages.designImagePath,
                  otherMockupImagePath: extraPrint?.mockupImagePath ?? extraImages.mockupImagePath,
                  otherDtfPrintImagePath: extraPrint?.dtf.dtfPrintImagePath ?? null,
                }
              : {}),
          })
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
    const orderId = String(row.id);
    const extraDesignAbs = row.otherSide
      ? resolveOrderDesignAbsolutePath({
          orderId,
          storedRelativePath: row.otherDesignImagePath,
          nameSuffix: row.otherSide,
        })
      : null;
    const dualSide = Boolean(row.otherSide && extraDesignAbs);
    const primarySuffix = dualSide ? row.side : undefined;
    const primaryDesignAbs = resolveOrderDesignAbsolutePath({
      orderId,
      storedRelativePath: row.designImagePath,
      nameSuffix: primarySuffix,
      allowUnsuffixed: true,
    });
    if (!primaryDesignAbs) {
      return reply.status(400).send({ error: "Order has no design image" });
    }

    try {
      const { config } = await getDtfPrinterConfig();
      const primaryPrint = await writeCashierSideFiles({
        orderId,
        garmentType: row.garmentType,
        garmentColor: row.garmentColor,
        side: row.side,
        designAbsolutePath: primaryDesignAbs,
        nameSuffix: primarySuffix,
        config,
      });

      let extraMockupImagePath: string | null = row.otherMockupImagePath;
      let extraJob: PrepareDtfPrintResult | null = null;
      if (dualSide && row.otherSide && extraDesignAbs) {
        const extraPrint = await writeCashierSideFiles({
          orderId,
          garmentType: row.garmentType,
          garmentColor: row.garmentColor,
          side: row.otherSide,
          designAbsolutePath: extraDesignAbs,
          nameSuffix: row.otherSide,
          config,
        });
        extraMockupImagePath = extraPrint.mockupImagePath;
        extraJob = extraPrint.dtf;
      }

      const [updated] = await db
        .update(orders)
        .set({
          mockupImagePath: primaryPrint.mockupImagePath ?? row.mockupImagePath,
          dtfPrintImagePath: primaryPrint.dtf.dtfPrintImagePath,
          otherMockupImagePath: extraMockupImagePath,
          otherDtfPrintImagePath: extraJob?.dtfPrintImagePath ?? row.otherDtfPrintImagePath,
        })
        .where(eq(orders.id, id))
        .returning();

      const serialized = serializeOrder(updated!, request);
      emitOrderEvent("updated", serialized);

      const printJob = serializePrintJob(request, primaryPrint.dtf, row.side);
      const printJobs = extraJob && row.otherSide
        ? [printJob, serializePrintJob(request, extraJob, row.otherSide)]
        : [printJob];

      return {
        order: serialized,
        printJob,
        printJobs,
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
