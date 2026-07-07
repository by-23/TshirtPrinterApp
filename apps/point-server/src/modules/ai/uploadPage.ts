/**
 * Minimal, dependency-free mobile page opened by scanning the "Загрузка
 * фото" QR (Этап 9, `uploadMode: "wifi"`) — plain HTML/JS (no React/build
 * step) since it's served directly by Fastify to an unknown phone browser
 * on the point's own network. Posts the chosen photo as multipart to
 * `POST /ai/upload/:token/photo` on the same origin. Mirrors
 * `apps/central-relay/src/modules/upload-relay/uploadPage.ts` (relay mode)
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
  <h1>Загрузите фото для ИИ-стиля</h1>
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

    fileInput.addEventListener("change", function () {
      chosenFile = fileInput.files && fileInput.files[0];
      submitBtn.disabled = !chosenFile;
      if (chosenFile) {
        preview.src = URL.createObjectURL(chosenFile);
        preview.style.display = "block";
      }
    });

    submitBtn.addEventListener("click", function () {
      if (!chosenFile) return;
      submitBtn.disabled = true;
      statusEl.textContent = "Загружаем…";
      var formData = new FormData();
      formData.append("photo", chosenFile);
      fetch("/ai/upload/" + token + "/photo", { method: "POST", body: formData })
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
