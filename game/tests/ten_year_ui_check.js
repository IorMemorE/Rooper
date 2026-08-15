// 十周年 UI 檢查：編輯器模組下拉 / 規則參考原版模組紙圖片
const path = require("path");
const http = require("http");
const fs = require("fs");

const root = path.join(__dirname, "..");
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".json": "application/json"
};

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split("?")[0]);
  if (urlPath === "/") urlPath = "/index.html";
  const filePath = path.join(root, urlPath);
  if (!filePath.startsWith(root)) { res.writeHead(403); res.end(); return; }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end("not found"); return; }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  });
});

const { chromium } = require("playwright-core");

let failures = 0;
function assert(cond, msg) {
  if (!cond) { failures++; console.error("FAIL:", msg); }
  else console.log("ok:", msg);
}

async function waitFor(fn, timeout = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try { const v = await fn(); if (v) return v; } catch (e) {}
    await new Promise((r) => setTimeout(r, 120));
  }
  return null;
}

(async () => {
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  const browser = await chromium.launch({
    executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

  try {
    await page.goto("http://127.0.0.1:" + port + "/editor.html");
    await waitFor(() => page.locator("#f-module").count());
    const modOpts = await page.locator("#f-module option").allInnerTexts();
    assert(modOpts.some((t) => t.indexOf("AHR") >= 0), "編輯器模組下拉包含 AHR");
    assert(modOpts.some((t) => t.indexOf("LL") >= 0), "編輯器模組下拉包含 LL");
    assert(modOpts.some((t) => t.indexOf("HSA") >= 0), "編輯器模組下拉包含 HSA");

    await page.selectOption("#f-module", "AHR");
    await waitFor(() => page.locator("#main-plot-list .plot-card").count() > 0);
    const mains = await page.locator("#main-plot-list .plot-card .name").allInnerTexts();
    assert(mains.length === 5, "AHR 規則Y 5條");
    const subs = await page.locator("#sub-plot-list .plot-card").count();
    assert(subs === 7, "AHR 規則X 7條");

    // 規則參考 → 原版模組紙
    await page.click("#btn-ref");
    await waitFor(() => page.locator(".ref-tab").count());
    const tabs = await page.locator(".ref-tab").allInnerTexts();
    const origIdx = tabs.findIndex((t) => t.indexOf("原版") >= 0);
    assert(origIdx >= 0, "規則參考含原版模組紙分頁");
    await page.locator('.ref-tab').nth(origIdx).click();
    await waitFor(() => page.locator(".ref-original").count() > 0);
    const imgs = await page.locator(".ref-original").evaluateAll((els) => els.map((e) => e.getAttribute("src")));
    ["AH.png", "HS.png", "HSA.png", "LL.png", "OF.png"].forEach((f) => {
      assert(imgs.some((s) => s.indexOf(f) >= 0), "原版模組紙包含 " + f);
    });

    // 選 AHR 模組時原版模組紙只顯示 AHR
    await page.selectOption("#ref-module", "AHR");
    await waitFor(() => page.locator(".ref-original").count() === 1);
    const single = await page.locator(".ref-original").first().getAttribute("src");
    assert(single.indexOf("AH.png") >= 0, "選擇 AHR 時僅顯示 AH.png");
  } catch (e) {
    console.error("測試異常:", e);
    process.exit(1);
  } finally {
    console.log("控制台錯誤數:", errors.length);
    errors.forEach((e) => console.log("  ", e));
    await browser.close();
    server.close();
  }
  console.log(failures === 0 && errors.length === 0 ? "\n十周年 UI 檢查全部通過 ✓" : "\n有失敗 ✗");
  process.exit(failures === 0 && errors.length === 0 ? 0 : 1);
})();
