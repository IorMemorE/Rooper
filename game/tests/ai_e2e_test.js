// AI 劇作家本地對戰端到端測試（Playwright + Edge）
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
async function waitFor(fn, timeout = 12000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try { const v = await fn(); if (v) return v; } catch (e) {}
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error("timeout waiting");
}

(async () => {
  await new Promise(r => server.listen(8378, r));
  const browser = await chromium.launch({
    executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", e => errors.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text()); });

  await page.goto("http://localhost:8378/game.html?script=fs");
  await page.waitForSelector("#setup-modal");
  assert((await page.locator("#btn-ai-mode").count()) === 1, "設定畫面有 AI 對戰按鈕");
  await page.click("#btn-ai-mode");
  await waitFor(async () => (await page.locator("#phase-name").innerText()).includes("早晨"));
  await page.click("#phase-btn"); // 開始本日 → AI 劇作家行動
  await waitFor(async () => (await page.locator("#phase-name").innerText()).includes("劇作家"));
  // AI 自動打出3張並自動確認 → 進入主人公行動
  await waitFor(async () => (await page.locator("#phase-name").innerText()).includes("主人公行動"), 15000);
  assert((await page.locator(".play-item").count()) === 3, "AI 已自動打出3張牌（實際 " + (await page.locator(".play-item").count()) + "）");
  // 主人公視角：只看到蓋牌與目標，看不到劇作家的卡面
  const playsText = await page.locator("#plays-list").innerText();
  assert(playsText.indexOf("蓋牌") >= 0 && playsText.indexOf("密謀") < 0 && playsText.indexOf("禁止") < 0,
    "主人公只能看到劇作家的蓋牌與目標（實際：" + playsText.replace(/\n/g, " / ").slice(0, 120) + "）");
  // 主人公視角：看不到劇作家手牌
  const handText = await page.locator("#hand-area").innerText();
  assert(handText.indexOf("劇作家手牌") < 0, "主人公視角不顯示劇作家手牌");
  // AI 對戰：可從設定/開關啟用劇作家秘密
  assert((await page.locator("#tgl-secret-row").evaluate(el => getComputedStyle(el).display)) !== "none", "AI 對戰顯示劇作家秘密開關");
  await page.check("#tgl-secret");
  await page.waitForSelector("#secret-panel:visible");
  assert((await page.locator("#secret-panel").innerText()).includes("主規則"), "AI 對戰可啟用劇作家秘密");
  await page.uncheck("#tgl-secret");
  // 事件記錄包含劇作家能力/結算等 AI 提示（至少無錯誤）
  assert((await page.locator("#log-panel").count()) >= 1, "事件記錄面板存在");
  // 設定面板含 AI 難度
  await page.click("#btn-settings");
  await waitFor(() => page.locator("#set-ai-difficulty").count());
  assert((await page.locator("#set-ai-difficulty option").count()) === 3, "設定面板有 AI 難度（3檔）");
  await page.locator(".tl-modal-btns .tl-btn", { hasText: "關閉" }).last().click();

  // 思考輔助：主人公推理記錄
  await page.click("#btn-notes");
  await waitFor(() => page.locator("#notes-body").count());
  assert((await page.locator("#notes-body .notes-block").count()) > 0, "思考輔助有記錄區塊");
  const firstState = await page.locator("#notes-body .notes-block").first().locator(".notes-state").innerText();
  assert(firstState.trim() === "？？", "思考輔助初始為未知（？？）");
  await page.locator("#notes-body .notes-block").first().locator(".chip").first().click();
  assert((await page.locator("#notes-body .notes-block").first().locator(".chip.on").count()) === 1, "點擊晶片可標註");
  // 盤面顯示：被標註角色的棋子上出現推理標籤
  await page.locator(".tl-modal-btns .tl-btn", { hasText: "關閉" }).last().click();
  await waitFor(() => page.locator("#board .char-token .token-note").count());
  assert((await page.locator("#board .char-token .token-note").count()) >= 1, "盤面棋子顯示推理標籤");
  // 事件當事人推理 → 資料板顯示「疑：」
  await page.click("#btn-notes");
  await waitFor(() => page.locator("#notes-body").count());
  await page.locator("#notes-tabs .ref-tab", { hasText: "事件當事人" }).click();
  await waitFor(() => page.locator("#notes-body .notes-block").count());
  assert((await page.locator("#notes-body .notes-block").count()) >= 1, "事件當事人分頁有記錄區塊");
  await page.locator("#notes-body .notes-block").first().locator(".chip").first().click();
  await page.locator(".tl-modal-btns .tl-btn", { hasText: "關閉" }).last().click();
  await waitFor(() => page.locator("#data-board .inc-note").count());
  assert((await page.locator("#data-board .inc-note").count()) >= 1, "資料板事件顯示「疑：」推理標記");
  // 可能規則：✓/✗/? 三態 + 身份數量/額外規則 → 盤面推理條
  await page.click("#btn-notes");
  await waitFor(() => page.locator("#notes-body").count());
  await page.locator("#notes-tabs .ref-tab", { hasText: "可能規則" }).click();
  await waitFor(() => page.locator("#notes-body .notes-rule").count());
  assert((await page.locator("#notes-body .notes-rule").count()) >= 2, "可能規則分頁列出主/副規則");
  const ruleText = await page.locator("#notes-body").innerText();
  assert(ruleText.indexOf("身份：") >= 0 && ruleText.indexOf("額外規則：") >= 0, "規則列出身份數量與額外規則");
  assert((await page.locator("#notes-body .tri").first().innerText()).trim() === "？", "規則初始為「？」");
  await page.locator("#notes-body .tri").first().click();
  assert((await page.locator("#notes-body .tri").first().innerText()).trim() === "✓", "規則可切為「✓」");
  await page.locator("#notes-body .tri").first().click();
  assert((await page.locator("#notes-body .tri").first().innerText()).trim() === "✗", "規則可切為「✗」");
  await page.locator(".tl-modal-btns .tl-btn", { hasText: "關閉" }).last().click();
  await waitFor(() => page.locator("#notes-strip:visible").count());
  assert((await page.locator("#notes-strip").innerText()).indexOf("✗") >= 0, "盤面推理條顯示規則標記");

  // 懸停角色稍作停留 → 顯示卡牌大圖（夠大），移開後消失
  const hoverTok = page.locator("#board .char-token").first();
  const hb = await hoverTok.boundingBox();
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await waitFor(() => page.locator(".char-hover-card").count(), 3000);
  const hc = await page.evaluate(() => {
    const el = document.querySelector(".char-hover-card");
    const img = el.querySelector("img");
    return { w: Math.round(el.getBoundingClientRect().width), imgW: Math.round(img.getBoundingClientRect().width), name: el.querySelector(".hc-name").textContent };
  });
  assert(hc.w >= 360 && hc.imgW >= 180, "懸停卡牌大圖足夠大（卡寬 " + hc.w + "，圖寬 " + hc.imgW + "）");
  assert(!!hc.name, "懸停卡牌顯示角色名（" + hc.name + "）");
  await page.mouse.move(20, 20);
  await page.waitForTimeout(300);
  assert((await page.locator(".char-hover-card").count()) === 0, "移開滑鼠後懸停卡牌消失");

  await page.screenshot({ path: path.join(root, "tests", "shot_ai_mode.png"), fullPage: false });
  console.log("\n控制台錯誤數:", errors.length);
  errors.forEach(e => console.log("  ", e));
  await browser.close();
  server.close();
  console.log(failures === 0 && errors.length === 0 ? "\nAI 對戰測試全部通過 ✓" : "\n有 " + failures + " 項失敗 / " + errors.length + " 個錯誤 ✗");
  process.exit(failures === 0 && errors.length === 0 ? 0 : 1);
})().catch(e => {
  console.error("測試異常:", e);
  process.exit(1);
});
