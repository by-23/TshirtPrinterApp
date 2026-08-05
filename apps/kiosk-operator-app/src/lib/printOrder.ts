import { prepareOrderPrint, type PrepareOrderPrintResult } from "./pointServer.js";
import { isPointDesktop } from "./pointDesktop.js";

export type SendOrderToPrintResult = PrepareOrderPrintResult;

function formatSizeCm(widthMm: number, heightMm: number): string {
  const w = (widthMm / 10).toFixed(widthMm % 10 === 0 ? 0 : 1);
  const h = (heightMm / 10).toFixed(heightMm % 10 === 0 ? 0 : 1);
  return `${w}×${h} см`;
}

/** Short operator-facing summary after a DTF file is ready. */
export function describeDtfPrintJob(job: PrepareOrderPrintResult["printJob"]): string {
  const mirror = job.mirrored ? "зеркало вкл." : "без зеркала";
  return (
    `Файл для ${job.printerModel} готов: ${formatSizeCm(job.widthMm, job.heightMm)}, ` +
    `${job.dpi} DPI, ${mirror}, плёнка ${job.mediaSize}.\n\n` +
    `Откройте файл в AcroRIP и нажмите Print.\n` +
    `Папка печати: ${job.hotfolderDir}`
  );
}

/**
 * Prepares a RIP-ready DTF PNG on point-server, opens it for the operator
 * (Explorer on desktop / new tab in browser), and returns job metadata.
 * Does NOT change order status — caller still PATCHes `accepted`.
 */
export async function sendOrderToDtfPrint(orderId: string): Promise<SendOrderToPrintResult> {
  const result = await prepareOrderPrint(orderId);
  const { printJob } = result;

  if (isPointDesktop() && window.pointDesktop?.showItemInFolder) {
    try {
      await window.pointDesktop.showItemInFolder(printJob.absolutePath);
    } catch {
      // fail-open — file is still on disk / hotfolder
    }
  } else if (isPointDesktop() && window.pointDesktop?.openPath) {
    try {
      await window.pointDesktop.openPath(printJob.absolutePath);
    } catch {
      // fail-open
    }
  } else {
    // Browser / Android operator: open the PNG so it can be saved or dragged into RIP.
    window.open(printJob.fileUrl, "_blank", "noopener,noreferrer");
  }

  return result;
}
