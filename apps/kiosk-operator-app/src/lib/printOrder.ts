import { prepareOrderPrint, type PrepareOrderPrintResult, type PreparedPrintJob } from "./pointServer.js";
import { isPointDesktop } from "./pointDesktop.js";

export type SendOrderToPrintResult = PrepareOrderPrintResult;

function formatSizeCm(widthMm: number, heightMm: number): string {
  const w = (widthMm / 10).toFixed(widthMm % 10 === 0 ? 0 : 1);
  const h = (heightMm / 10).toFixed(heightMm % 10 === 0 ? 0 : 1);
  return `${w}×${h} см`;
}

const SIDE_LABEL: Record<string, string> = {
  front: "Перед",
  back: "Спина",
};

function describeOneJob(job: PreparedPrintJob): string {
  const mirror = job.mirrored ? "зеркало вкл." : "без зеркала";
  const size = `${formatSizeCm(job.widthMm, job.heightMm)}, ${job.dpi} DPI, ${mirror}, плёнка ${job.mediaSize}`;
  if (!job.side) return size;
  return `${SIDE_LABEL[job.side] ?? job.side}: ${size}`;
}

/** Short operator-facing summary after a DTF file is ready. */
export function describeDtfPrintJob(job: PreparedPrintJob): string {
  return describeDtfPrintJobs([job]);
}

export function describeDtfPrintJobs(jobs: PreparedPrintJob[]): string {
  const first = jobs[0];
  if (!first) return "";
  const printer = first.printerModel;
  const body =
    jobs.length > 1
      ? jobs.map((job) => `• ${describeOneJob(job)}`).join("\n")
      : describeOneJob(first);
  return (
    `Файл${jobs.length > 1 ? "ы" : ""} для ${printer} готов${jobs.length > 1 ? "ы" : ""}${jobs.length > 1 ? ` (${jobs.length} стороны)` : ""}: ${jobs.length > 1 ? `\n${body}` : body}.\n\n` +
    `Откройте файл в AcroRIP и нажмите Print.\n` +
    `Папка печати: ${first.hotfolderDir}`
  );
}

/**
 * Prepares RIP-ready DTF PNG(s) on point-server, opens the first file for the
 * operator (Explorer on desktop / new tab in browser), and returns job metadata.
 * Does NOT change order status — caller still PATCHes `accepted`.
 */
export async function sendOrderToDtfPrint(orderId: string): Promise<SendOrderToPrintResult> {
  const result = await prepareOrderPrint(orderId);
  const jobs = result.printJobs ?? [result.printJob];
  const first = jobs[0] ?? result.printJob;

  if (isPointDesktop() && window.pointDesktop?.showItemInFolder) {
    try {
      await window.pointDesktop.showItemInFolder(first.hotfolderAbsolutePath ?? first.absolutePath);
    } catch {
      // fail-open — file is still on disk / hotfolder
    }
  } else if (isPointDesktop() && window.pointDesktop?.openPath) {
    try {
      await window.pointDesktop.openPath(first.absolutePath);
    } catch {
      // fail-open
    }
  } else {
    // Browser / Android operator: open the PNG so it can be saved or dragged into RIP.
    for (const job of jobs) {
      window.open(job.fileUrl, "_blank", "noopener,noreferrer");
    }
  }

  return result;
}
