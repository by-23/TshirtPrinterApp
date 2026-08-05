import { chromium } from "../apps/point-server/node_modules/playwright/index.mjs";

async function check(url, expectGear, label) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(2000);

  const gear = await page.locator('[aria-label="Настройки оформления"]').count();
  const gearOp = await page.locator('[aria-label="Настройки оформления экрана оператора"]').count();
  const gearTotal = gear + gearOp;
  const switcherPill = await page.locator("a[href='/operator']").filter({ hasText: "Оператор" }).count();
  const switcherKiosk = await page.locator("a").filter({ hasText: /^Киоск$/ }).count();

  const okGear = expectGear ? gearTotal > 0 : gearTotal === 0;
  const okSwitch = switcherPill === 0 && switcherKiosk === 0;
  const pass = okGear && okSwitch;

  console.log(
    JSON.stringify({
      label,
      url,
      gearTotal,
      switcherPill,
      switcherKiosk,
      expectGear,
      okGear,
      okSwitch,
      pass,
    }),
  );

  await page
    .screenshot({
      path: `docs/perf-reports/screenshots/verify-${label}.png`,
      timeout: 8_000,
    })
    .catch(() => undefined);

  await browser.close();
  return pass;
}

const results = [];
results.push(await check("http://127.0.0.1:5173/kiosk", true, "kiosk-plain"));
results.push(await check("http://127.0.0.1:5173/kiosk?native=1", false, "kiosk-native"));
results.push(await check("http://127.0.0.1:5173/operator?native=1", false, "operator-native"));
results.push(await check("http://127.0.0.1:5173/kiosk?dev=1", true, "kiosk-dev"));

if (results.some((r) => !r)) {
  console.error("VERIFY FAILED");
  process.exit(1);
}
console.log("VERIFY OK");
