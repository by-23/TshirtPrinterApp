import { execFile } from "node:child_process";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type { DtfPrinterConfig } from "@tshirt/shared-types";

const execFileAsync = promisify(execFile);

/** Subset of Win32_Printer / Get-Printer PrinterStatus values we care about. */
export type WindowsPrinterHealth = "ready" | "busy" | "offline" | "error" | "not_found" | "unknown";

export interface WindowsPrinterInfo {
  name: string;
  driverName: string;
  jobCount: number;
  health: WindowsPrinterHealth;
  statusCode: number | null;
  statusText: string;
}

export interface HotfolderFileInfo {
  name: string;
  absolutePath: string;
  sizeBytes: number;
  modifiedAt: string;
}

export interface HotfolderInfo {
  dir: string;
  fileCount: number;
  files: HotfolderFileInfo[];
}

interface RawPrinterRow {
  Name?: string;
  DriverName?: string;
  JobCount?: number;
  PrinterStatus?: number;
}

const STATUS_MAP: Record<number, { health: WindowsPrinterHealth; text: string }> = {
  1: { health: "unknown", text: "Другое" },
  2: { health: "unknown", text: "Неизвестно" },
  3: { health: "ready", text: "Готов" },
  4: { health: "busy", text: "Печатает" },
  5: { health: "busy", text: "Прогрев" },
  6: { health: "error", text: "Остановлен" },
  7: { health: "offline", text: "Офлайн" },
  8: { health: "error", text: "Пауза" },
  9: { health: "error", text: "Ошибка" },
};

function matchPrinter(rows: RawPrinterRow[], config: DtfPrinterConfig): RawPrinterRow | null {
  if (!rows.length) return null;
  const exact = config.windowsPrinterName.trim().toLowerCase();
  if (exact) {
    const hit = rows.find((row) => (row.Name ?? "").toLowerCase() === exact);
    if (hit) return hit;
  }
  const needle = (config.printerModel || "L1800").toLowerCase();
  const tokens = needle.split(/\s+/).filter((t) => t.length >= 3);
  const scored = rows
    .map((row) => {
      const name = `${row.Name ?? ""} ${row.DriverName ?? ""}`.toLowerCase();
      let score = 0;
      if (name.includes("l1800")) score += 100;
      if (name.includes("epson")) score += 20;
      for (const token of tokens) {
        if (name.includes(token)) score += 10;
      }
      return { row, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored[0]?.row ?? null;
}

async function listWindowsPrinters(): Promise<RawPrinterRow[]> {
  if (process.platform !== "win32") return [];
  try {
    const { stdout } = await execFileAsync(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "Get-Printer | Select-Object Name,DriverName,JobCount,PrinterStatus | ConvertTo-Json -Compress",
      ],
      { windowsHide: true, timeout: 12_000, maxBuffer: 2 * 1024 * 1024 },
    );
    const trimmed = stdout.trim();
    if (!trimmed) return [];
    const parsed = JSON.parse(trimmed) as RawPrinterRow | RawPrinterRow[];
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [];
  }
}

export async function resolveWindowsPrinter(config: DtfPrinterConfig): Promise<WindowsPrinterInfo> {
  const rows = await listWindowsPrinters();
  const availableNames = rows.map((row) => row.Name).filter((name): name is string => Boolean(name));
  const hit = matchPrinter(rows, config);
  if (!hit?.Name) {
    return {
      name: config.windowsPrinterName || config.printerModel,
      driverName: "",
      jobCount: 0,
      health: process.platform === "win32" ? "not_found" : "unknown",
      statusCode: null,
      statusText:
        process.platform === "win32"
          ? availableNames.length
            ? "Принтер не найден в Windows"
            : "Нет принтеров в системе"
          : "Статус только на Windows",
    };
  }

  const code = typeof hit.PrinterStatus === "number" ? hit.PrinterStatus : null;
  const mapped = code != null ? STATUS_MAP[code] : undefined;
  return {
    name: hit.Name,
    driverName: hit.DriverName ?? "",
    jobCount: typeof hit.JobCount === "number" ? hit.JobCount : 0,
    health: mapped?.health ?? "unknown",
    statusCode: code,
    statusText: mapped?.text ?? (code != null ? `Код ${code}` : "Неизвестно"),
  };
}

export async function listHotfolderFiles(dir: string): Promise<HotfolderInfo> {
  try {
    const names = await readdir(dir);
    const files: HotfolderFileInfo[] = [];
    for (const name of names) {
      if (!/\.(png|tif|tiff|pdf)$/i.test(name)) continue;
      const absolutePath = path.join(dir, name);
      try {
        const meta = await stat(absolutePath);
        if (!meta.isFile()) continue;
        files.push({
          name,
          absolutePath,
          sizeBytes: meta.size,
          modifiedAt: meta.mtime.toISOString(),
        });
      } catch {
        // skip unreadable
      }
    }
    files.sort((a, b) => (a.modifiedAt < b.modifiedAt ? 1 : -1));
    return { dir, fileCount: files.length, files: files.slice(0, 20) };
  } catch {
    return { dir, fileCount: 0, files: [] };
  }
}

/** Open a folder in Explorer (Windows) / default file manager. */
export function openPathInOs(targetPath: string): void {
  if (process.platform === "win32") {
    // explorer often exits with code 1 even on success — fire-and-forget.
    execFile("explorer.exe", [targetPath], { windowsHide: false }, () => undefined);
    return;
  }
  execFile("xdg-open", [targetPath], () => undefined);
}

/** Open the Windows printer queue UI for this printer. */
export function openPrinterQueue(printerName: string): boolean {
  if (process.platform !== "win32" || !printerName.trim()) return false;
  execFile(
    "rundll32.exe",
    ["printui.dll,PrintUIEntry", "/o", "/n", printerName],
    { windowsHide: false },
    () => undefined,
  );
  return true;
}

/** Ask Windows to print the driver nozzle/test page for this queue. */
export function printNozzleCheckPage(printerName: string): boolean {
  if (process.platform !== "win32" || !printerName.trim()) return false;
  execFile(
    "rundll32.exe",
    ["printui.dll,PrintUIEntry", "/k", "/n", printerName],
    { windowsHide: false },
    () => undefined,
  );
  return true;
}

export async function listInstalledPrinterNames(): Promise<string[]> {
  const rows = await listWindowsPrinters();
  return rows.map((row) => row.Name).filter((name): name is string => Boolean(name)).sort((a, b) => a.localeCompare(b));
}
