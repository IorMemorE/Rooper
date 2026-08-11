// 多語言端到端測試（Playwright + Edge）
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
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error("timeout waiting");
}

(async () => {
  await new Promise(r => server.listen(8359, r));
  const browser = await chromium.launch({
    executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", e => errors.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text()); });

  // 清空本地語言設定，從預設（繁體中文）開始
  await page.goto("http://localhost:8359/index.html");
  await page.evaluate(() => localStorage.clear());

  // 1. 首頁：切換英文
  await page.reload();
  await waitFor(() => page.locator("#lang-select").count());
  assert((await page.locator("h1").innerText()) === "悲劇輪迴 本地助手", "預設繁體中文標題");
  await page.selectOption("#lang-select", "en");
  await waitFor(async () => (await page.locator("h1").innerText()) === "Tragedy Looper Local Assistant");
  assert((await page.locator("h1").innerText()) === "Tragedy Looper Local Assistant", "首頁切換英文標題");
  assert((await page.title()).includes("Tragedy Looper Local Assistant"), "瀏覽器標題跟隨語言");
  const stored = await page.evaluate(() => localStorage.getItem("tl_lang"));
  assert(stored === "en", "語言選擇已持久化");

  // 2. 編輯器：角色/規則/身份名與官方劇本名
  await page.goto("http://localhost:8359/editor.html");
  await waitFor(() => page.locator("#character-pool .pool-card").count());
  const poolText = await page.locator("#character-pool").innerText();
  assert(poolText.includes("Boy Student") && poolText.includes("Shrine Maiden"), "英文角色名（角色池）");
  assert(!poolText.includes("男學生"), "英文角色名不含中文");
  const moduleText = await page.locator("#f-module option[value=FS]").innerText();
  assert(moduleText === "FS Set (First Steps)", "模組下拉英文");
  const plotText = await page.locator("#main-plot-list").innerText();
  assert(plotText.includes("Murder Plan"), "主規則英文名");
  assert((await page.locator("#btn-import-preset").innerText()).includes("Import Preset"), "導入預設按鈕英文");
  // 切換簡體中文
  await page.selectOption("#lang-select", "zh-Hans");
  await waitFor(async () => (await page.locator("#character-pool").innerText()).includes("男学生"));
  assert((await page.locator("#f-module option[value=FS]").innerText()) === "FS 模组（第一步）", "切換簡體中文後模組名更新");
  // 重新載入仍為簡體
  await page.reload();
  await waitFor(async () => (await page.locator("#character-pool").innerText()).includes("男学生"));
  assert(true, "編輯器語言切換後重新載入保持");

  // 3. 遊戲：設定面板內語言選項
  await page.goto("http://localhost:8359/game.html?script=fs");
  await waitFor(() => page.locator("#setup-modal").isVisible());
  await page.click("#setup-modal [data-n='3']");
  await waitFor(async () => (await page.locator(".location-panel").count()) === 4);
  await page.click("#btn-settings");
  await waitFor(() => page.locator("#set-lang").count());
  assert((await page.locator("#set-lang option").count()) === 4, "設定面板有4種語言");
  await page.selectOption("#set-lang", "en");
  await waitFor(async () => (await page.locator("#set-lang option:checked").innerText()) === "English");
  assert((await page.locator("#ability-panel").count()) >= 1, "設定面板語言切換不崩潰");
  await page.locator(".tl-modal-btns .tl-btn", { hasText: "Close" }).last().click();
  await page.click("#phase-btn"); // 開始本日 → 劇作家行動
  await waitFor(async () => (await page.locator("#phase-name").innerText()) === "Mastermind Action");
  assert((await page.locator("#phase-name").innerText()) === "Mastermind Action", "遊戲階段名英文");
  const boardText = await page.locator("#board").innerText();
  assert(boardText.includes("School") && boardText.includes("Hospital"), "版圖名英文");
  assert(boardText.includes("Intrigue"), "密謀計數英文");
  const handText = await page.locator("#hand-area").innerText();
  assert(handText.includes("Mastermind Hand"), "劇作家手牌英文");
  // 角色卡大圖（長按）英文
  const tok = page.locator(".char-token").first();
  const tb = await tok.boundingBox();
  await page.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(750);
  await page.mouse.up();
  await waitFor(() => page.locator(".char-card-pop").count());
  const cardText = await page.locator(".char-card-pop").innerText();
  assert(cardText.includes("Paranoia limit") && cardText.includes("Goodwill abilities"), "角色卡大圖英文");
  await page.locator(".tl-modal-btns .tl-btn", { hasText: "Close" }).last().click();

  // 4. 多人聯機大廳
  await page.goto("http://localhost:8359/multiplayer.html");
  await waitFor(() => page.locator("#lb-create").count());
  assert((await page.locator("#lb-create").innerText()) === "Create Room", "大廳建立房間按鈕英文");
  assert((await page.locator(".tl-header .brand span").innerText()) === "Multiplayer Lobby", "大廳標題英文");
  await page.selectOption("#lang-select", "ja");
  await waitFor(async () => (await page.locator("#lb-create").innerText()) === "ルームを作成");
  assert(true, "大廳切換日文");

  console.log("\n控制台錯誤數:", errors.length);
  errors.forEach(e => console.log("  ", e));
  await browser.close();
  server.close();
  console.log(failures === 0 && errors.length === 0 ? "\ni18n UI 測試全部通過 ✓" : "\n有 " + failures + " 項失敗 / " + errors.length + " 個控制台錯誤 ✗");
  process.exit(failures === 0 && errors.length === 0 ? 0 : 1);
})().catch(e => {
  console.error("測試異常:", e);
  process.exit(1);
});
