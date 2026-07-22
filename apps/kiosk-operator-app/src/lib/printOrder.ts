/**
 * Opens the system print dialog (Windows print UI in the browser) for an
 * order's design PNG. Uses an off-screen iframe so the operator screen itself
 * is not sent to the printer.
 */
export function printOrderDesign(imageUrl: string, title: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    // Full-size off-screen frame — zero-size / visibility:hidden frames often
    // produce a blank print job in Chromium.
    iframe.style.cssText =
      "position:fixed;inset:0;width:100%;height:100%;border:0;opacity:0;pointer-events:none;z-index:-1;";
    document.body.appendChild(iframe);

    const win = iframe.contentWindow;
    const doc = win?.document;
    if (!win || !doc) {
      iframe.remove();
      reject(new Error("Не удалось открыть окно печати"));
      return;
    }

    const safeTitle = title.replace(/[<>&"]/g, "");
    const safeUrl = imageUrl.replace(/"/g, "%22");

    doc.open();
    doc.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${safeTitle}</title>
  <style>
    @page { margin: 0; }
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      background: #fff;
    }
    body {
      display: flex;
      align-items: center;
      justify-content: center;
    }
    img {
      display: block;
      max-width: 100%;
      max-height: 100vh;
      object-fit: contain;
    }
  </style>
</head>
<body>
  <img src="${safeUrl}" alt="${safeTitle}" />
</body>
</html>`);
    doc.close();

    const img = doc.querySelector("img");
    if (!img) {
      iframe.remove();
      reject(new Error("Не удалось подготовить изображение для печати"));
      return;
    }

    const removeFrame = () => {
      try {
        iframe.remove();
      } catch {
        // already detached
      }
    };

    const runPrint = () => {
      try {
        win.focus();
        win.addEventListener("afterprint", removeFrame);
        window.setTimeout(removeFrame, 60_000);
        win.print();
        resolve();
      } catch (err) {
        removeFrame();
        reject(err instanceof Error ? err : new Error("Печать не удалась"));
      }
    };

    if (img.complete && img.naturalWidth > 0) {
      runPrint();
      return;
    }

    img.onload = () => runPrint();
    img.onerror = () => {
      removeFrame();
      reject(new Error("Не удалось загрузить изображение дизайна"));
    };
  });
}
