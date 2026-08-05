import type { FastifyInstance } from "fastify";
import { mkdir } from "node:fs/promises";
import { updateDtfPrinterConfigSchema } from "@tshirt/shared-types";
import { dataPath, getDataDir } from "../../lib/dataDir.js";
import { getDtfPrinterConfig, updateDtfPrinterConfig } from "./config.js";
import {
  listHotfolderFiles,
  listInstalledPrinterNames,
  openPathInOs,
  openPrinterQueue,
  printNozzleCheckPage,
  resolveWindowsPrinter,
} from "./windowsPrinter.js";

function hotfolderDirFromConfig(hotfolderName: string): string {
  const cleaned = hotfolderName.replace(/[<>:"|?*\\/]/g, "").trim() || "dtf-print-jobs";
  return dataPath(cleaned);
}

async function buildStatusPayload() {
  const { config, updatedAt } = await getDtfPrinterConfig();
  const hotfolderDir = hotfolderDirFromConfig(config.hotfolderName);
  await mkdir(hotfolderDir, { recursive: true });
  const [windows, hotfolder, installedPrinters] = await Promise.all([
    resolveWindowsPrinter(config),
    listHotfolderFiles(hotfolderDir),
    listInstalledPrinterNames(),
  ]);

  const ready = windows.health === "ready" || windows.health === "busy";
  return {
    config,
    updatedAt,
    hotfolderAbsolutePath: hotfolderDir,
    dataDir: getDataDir(),
    windows,
    hotfolder,
    installedPrinters,
    ready,
    summary:
      windows.health === "ready"
        ? "Принтер готов"
        : windows.health === "busy"
          ? "Принтер занят"
          : windows.health === "offline"
            ? "Принтер офлайн"
            : windows.health === "error"
              ? "Ошибка принтера"
              : windows.health === "not_found"
                ? "Принтер не найден"
                : "Статус неизвестен",
  };
}

/** Operator printer panel — Epson L1800 / DTF RIP settings + Windows status. */
export async function printerRoutes(app: FastifyInstance) {
  app.get("/printer-config", async () => {
    const status = await buildStatusPayload();
    return {
      config: status.config,
      updatedAt: status.updatedAt,
      hotfolderAbsolutePath: status.hotfolderAbsolutePath,
      dataDir: status.dataDir,
    };
  });

  app.get("/printer-status", async () => buildStatusPayload());

  app.patch("/printer-config", async (request, reply) => {
    const parsed = updateDtfPrinterConfigSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const { config, updatedAt } = await updateDtfPrinterConfig(parsed.data);
    const hotfolderDir = hotfolderDirFromConfig(config.hotfolderName);
    await mkdir(hotfolderDir, { recursive: true });
    return {
      config,
      updatedAt,
      hotfolderAbsolutePath: hotfolderDir,
      dataDir: getDataDir(),
    };
  });

  app.post("/printer/open-hotfolder", async (_request, reply) => {
    const { config } = await getDtfPrinterConfig();
    const dir = hotfolderDirFromConfig(config.hotfolderName);
    await mkdir(dir, { recursive: true });
    openPathInOs(dir);
    return { ok: true, path: dir };
  });

  app.post("/printer/open-queue", async (_request, reply) => {
    const { config } = await getDtfPrinterConfig();
    const windows = await resolveWindowsPrinter(config);
    if (windows.health === "not_found") {
      return reply.status(404).send({ error: "Printer not found in Windows", windows });
    }
    const ok = openPrinterQueue(windows.name);
    if (!ok) {
      return reply.status(500).send({ error: "Cannot open printer queue on this OS" });
    }
    return { ok: true, printerName: windows.name };
  });

  app.post("/printer/nozzle-check", async (_request, reply) => {
    const { config } = await getDtfPrinterConfig();
    const windows = await resolveWindowsPrinter(config);
    if (windows.health === "not_found") {
      return reply.status(404).send({ error: "Printer not found in Windows", windows });
    }
    const ok = printNozzleCheckPage(windows.name);
    if (!ok) {
      return reply.status(500).send({ error: "Cannot send nozzle check on this OS" });
    }
    return {
      ok: true,
      printerName: windows.name,
      message: "Тестовая страница отправлена в очередь Windows. Для DTF лучше проверить дюзы из AcroRIP.",
    };
  });
}
