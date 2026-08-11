// 預設劇本選擇頁端到端測試（Playwright + Edge）
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
function assert(cond, msg) { if (!cond) { failures++; console.error("FAIL:", msg); } else console.log("ok:", msg); }
async function waitFor(fn, timeout = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try { const v = await fn(); if (v) return v; } catch (e) {}
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error("timeout waiting");
}

(async () => {
  await new Promise(r => server.listen(8393, r));
  const browser = await chromium.launch({
    executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", e => errors.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text()); });

  await page.goto("http://localhost:8393/presets.html");
  await waitFor(() => page.locator("#preset-list .preset-card").count());
  assert((await page.locator("#preset-list .preset-card").count()) === 2, "預設頁列出2個官方劇本");
  // 搜尋篩選
  await page.fill("#preset-search", "SCRIPT");
  await waitFor(async () => (await page.locator("#preset-list .preset-card").count()) === 1);
  assert((await page.locator("#preset-list .preset-card").count()) === 1, "搜尋 SCRIPT 篩選出1個劇本");
  await page.fill("#preset-search", "");
  await page.selectOption("#preset-module", "FS");
  await waitFor(async () => (await page.locator("#preset-list .preset-card").count()) === 1);
  assert(true, "模組篩選 FS 為1個");
  await page.selectOption("#preset-module", "");
  // 查看詳情 → 編輯器載入預設
  await page.locator("#preset-list .preset-card", { hasText: "THE FIRST SCRIPT" }).locator('[data-act="detail"]').click();
  await waitFor(async () => (await page.inputValue("#f-title")).includes("THE FIRST SCRIPT"));
  assert((await page.locator("#board-preview .preview-token").count()) === 6, "查看詳情進入編輯器並載入劇本");
  // 返回預設頁：開始遊戲 → AI 對戰
  await page.goto("http://localhost:8393/presets.html");
  await waitFor(() => page.locator("#preset-list .preset-card").count());
  await page.locator("#preset-list .preset-card", { hasText: "THE FIRST SCRIPT" }).locator('[data-act="play"]').click();
  await waitFor(() => page.locator(".mode-list .mode-btn").count());
  assert((await page.locator(".mode-list .mode-btn").count()) === 3, "開始遊戲彈出3種模式（熱座/AI/開房）");
  await page.locator('.mode-list .mode-btn[data-mode="ai"]').click();
  await waitFor(() => page.url().indexOf("game.html?mode=ai") >= 0);
  await waitFor(async () => (await page.locator("#phase-name").innerText()).includes("早晨"));
  await page.click("#phase-btn");
  await waitFor(async () => (await page.locator("#phase-name").innerText()).includes("劇作家"), 15000);
  assert(true, "AI 模式自動開始並進入劇作家行動");
  await waitFor(async () => (await page.locator("#phase-name").innerText()).includes("主人公行動"), 15000);
  assert((await page.locator(".play-item").count()) === 3, "AI 自動打出3張牌");

  console.log("\n控制台錯誤數:", errors.length);
  errors.forEach(e => console.log("  ", e));
  await browser.close();
  server.close();
  console.log(failures === 0 && errors.length === 0 ? "\n預設頁測試全部通過 ✓" : "\n有 " + failures + " 項失敗 / " + errors.length + " 個錯誤 ✗");
  process.exit(failures === 0 && errors.length === 0 ? 0 : 1);
})().catch(e => {
  console.error("測試異常:", e);
  process.exit(1);
});
