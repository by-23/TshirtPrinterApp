/**
 * Minimal, dependency-free mobile page opened by scanning the "Загрузка
 * фото" QR (Этап 9, `uploadMode: "wifi"`) — plain HTML/JS (no React/build
 * step) since it's served directly by Fastify to an unknown phone browser
 * on the point's own network. Posts the chosen photo as multipart to
 * `POST /ai/upload/:token/photo` on the same origin. Re-encodes via
 * canvas first so Android JPEGs that browsers display but libvips rejects
 * (`Invalid SOS parameters`) arrive as a clean sequential JPEG. Falls
 * back to the original file if the phone cannot re-encode (HEIC on some
 * browsers — handled server-side).
 * Mirrors `apps/central-relay/src/modules/upload-relay/uploadPage.ts` (relay mode)
 * — kept independently per-app rather than shared, same as other
 * central-relay/point-server literal duplication (see
 * `kiosk-operator-app/src/lib/pointServer.ts`).
 */
export function renderUploadPage(token: string): string {
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Загрузка фото</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 20px;
    padding: 24px;
    background: #0b0b14;
    color: #fff;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    text-align: center;
  }
  h1 { font-size: 20px; margin: 0; }
  p { color: #b6b6c9; margin: 0; font-size: 14px; }
  label {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    max-width: 320px;
    padding: 32px 16px;
    border: 2px dashed #ff2d95;
    border-radius: 20px;
    font-weight: 600;
    cursor: pointer;
  }
  input[type="file"] { display: none; }
  button {
    width: 100%;
    max-width: 320px;
    padding: 14px;
    border: none;
    border-radius: 999px;
    background: #ff2d95;
    color: #fff;
    font-weight: 700;
    font-size: 16px;
    cursor: pointer;
  }
  button:disabled { opacity: 0.5; }
  #status { min-height: 20px; font-size: 14px; }
  #preview { max-width: 240px; max-height: 240px; border-radius: 12px; display: none; }
</style>
</head>
<body>
  <h1>Загрузите фото</h1>
  <p>Выберите фото — оно появится на экране киоска</p>
  <img id="preview" alt="" />
  <label id="picker">
    <span>📷 Выбрать фото</span>
    <input id="file" type="file" accept="image/*" />
  </label>
  <button id="submit" disabled>Отправить на киоск</button>
  <div id="status"></div>
  <script>
    var token = ${JSON.stringify(token)};
    var fileInput = document.getElementById("file");
    var submitBtn = document.getElementById("submit");
    var statusEl = document.getElementById("status");
    var preview = document.getElementById("preview");
    var chosenFile = null;
    var MAX_SIDE = 1600;

    fileInput.addEventListener("change", function () {
      chosenFile = fileInput.files && fileInput.files[0];
      submitBtn.disabled = !chosenFile;
      if (chosenFile) {
        preview.src = URL.createObjectURL(chosenFile);
        preview.style.display = "block";
      }
    });

    function preparePhoto(file) {
      if (typeof createImageBitmap !== "function") return Promise.resolve(file);
      return createImageBitmap(file, { imageOrientation: "from-image" })
        .then(function (bitmap) {
          return bitmapToJpeg(bitmap);
        })
        .catch(function () {
          return file;
        });
    }

    function bitmapToJpeg(bitmap) {
      var w = bitmap.width;
      var h = bitmap.height;
      if (w < 1 || h < 1) throw new Error("empty image");
      if (w > MAX_SIDE || h > MAX_SIDE) {
        var scale = Math.min(MAX_SIDE / w, MAX_SIDE / h);
        w = Math.round(w * scale);
        h = Math.round(h * scale);
      }
      var canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      var ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas");
      ctx.drawImage(bitmap, 0, 0, w, h);
      if (typeof bitmap.close === "function") bitmap.close();
      return new Promise(function (resolve, reject) {
        canvas.toBlob(
          function (blob) {
            if (!blob) {
              reject(new Error("toBlob"));
              return;
            }
            resolve(blob);
          },
          "image/jpeg",
          0.85
        );
      });
    }

    submitBtn.addEventListener("click", function () {
      if (!chosenFile) return;
      submitBtn.disabled = true;
      statusEl.textContent = "Загружаем…";
      preparePhoto(chosenFile).then(function (photo) {
        var formData = new FormData();
        formData.append("photo", photo, "photo.jpg");
        return fetch("/ai/upload/" + token + "/photo", { method: "POST", body: formData });
      })
        .then(function (res) {
          if (res.ok) {
            statusEl.textContent = "Готово! Смотрите на экран киоска.";
            return;
          }
          // Read the server's error body (if any) so the real failure reason
          // (e.g. unsupported format) is visible right on the phone screen
          // instead of a generic message — makes remote debugging possible.
          return res
            .json()
            .catch(function () {
              return null;
            })
            .then(function (body) {
              var detail = body && (body.message || body.error);
              throw new Error(detail ? detail + " (HTTP " + res.status + ")" : "HTTP " + res.status);
            });
        })
        .catch(function (err) {
          var detail = err && err.message ? err.message : "неизвестная сетевая ошибка";
          statusEl.textContent = "Не удалось загрузить фото: " + detail;
          submitBtn.disabled = false;
        });
    });
  </script>
</body>
</html>`;
}
