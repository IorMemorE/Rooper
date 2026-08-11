// 端到端 UI 測試（Playwright + Edge）
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

async function waitForPhase(page, name, timeout = 8000) {
  try {
    await waitFor(async () => (await page.locator("#phase-name").innerText()) === name, timeout);
  } catch (e) {
    const cur = await page.locator("#phase-name").innerText().catch(() => "?");
    const btn = await page.locator("#phase-btn").innerText().catch(() => "?");
    const plays = await page.locator(".play-item").count();
    console.error("waitForPhase 超時:", name, "| 當前:", cur, "| 按鈕:", btn, "| 打出牌數:", plays);
    throw e;
  }
}

// 穩定點擊彈窗按鈕：等待可見 → 等動畫穩定 → force 點擊
async function clickModalBtn(page, text) {
  const loc = page.locator(".tl-modal-btns .tl-btn", { hasText: text }).last();
  try {
    await loc.waitFor({ state: "visible", timeout: 8000 });
  } catch (e) {
    const titles = await page.evaluate(() =>
      Array.from(document.querySelectorAll(".tl-modal-wrap:not(#setup-overlay)")).map(w => (w.querySelector(".tl-modal-title") || {}).textContent || "?").join(" | ") || "(none)"
    );
    const mlog = await page.evaluate(() => (window.__mlog || []).join(" -> ")).catch(() => "");
    console.error("等待彈窗按鈕失敗，當前彈窗:", titles, "| 彈窗史:", mlog);
    throw e;
  }
  await page.waitForTimeout(400);
  try {
    await loc.click({ force: true, timeout: 8000 });
  } catch (e) {
    const titles = await page.evaluate(() =>
      Array.from(document.querySelectorAll(".tl-modal-wrap:not(#setup-overlay)")).map(w => (w.querySelector(".tl-modal-title") || {}).textContent || "?").join(" | ") || "(none)"
    );
    console.error("點擊彈窗按鈕失敗，當前彈窗:", titles);
    throw e;
  }
}

(async () => {
  await new Promise(r => server.listen(8358, r));
  const browser = await chromium.launch({
    executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", e => errors.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text()); });

  // 自動點掉能力詢問等模態框（第一個選項），但排除遊戲設定彈窗
  function startModalTimer() {
    modalTimerDisabled = false;
    return setInterval(async () => {
    if (modalTimerDisabled) return;
    try {
      const visible = await page.locator(".tl-modal-wrap:not(#setup-overlay)").count();
    if (visible > 0) {
      const btn = page.locator(".tl-modal-wrap:not(#setup-overlay) .tl-btn").first();
      if (await btn.count()) {
        if (modalTimerDisabled) return;
        await btn.click().catch(() => {});
      }
    }
    } catch (e) {}
    }, 250);
  }
  let modalTimerDisabled = false;
  let modalTimer = startModalTimer();

  // 1. 啟動頁
  await page.goto("http://localhost:8358/index.html");
  assert((await page.title()).includes("本地助手"), "啟動頁標題（本地化）");
  assert((await page.locator(".landing-btns a").count()) === 3, "啟動頁有3個入口（編輯器/選擇預設/多人）");

  // 2. 編輯器
  await page.goto("http://localhost:8358/editor.html");
  await waitFor(() => page.locator("#character-pool .pool-card").count());
  const rosterCount = await page.locator("#character-pool .pool-card").count();
  assert(rosterCount === 37, "編輯器包含全部37名角色（實際 " + rosterCount + "）");
  assert(await page.locator("#main-plot-list .plot-card").count() === 3, "FS 主規則3條");
  assert(await page.locator("#sub-plot-list .plot-card").count() === 3, "FS 副規則3條");
  // 開始盤面預覽
  assert(await page.locator("#board-preview .location-panel").count() === 4, "開始盤面預覽顯示4塊版圖");
  const previewTokens = await page.locator("#board-preview .preview-token").count();
  assert(previewTokens === 0, "編輯器開啟為空劇本（無角色，實際 " + previewTokens + "）");
  // 角色池側邊欄可收起/展開
  await page.click("#pool-toggle");
  assert(await page.evaluate(() => document.querySelector(".editor-wrap").classList.contains("pool-collapsed")), "角色池可收起");
  await page.click("#pool-expand");
  assert(!(await page.evaluate(() => document.querySelector(".editor-wrap").classList.contains("pool-collapsed"))), "角色池可展開");
  // 切換 BTX
  await page.selectOption("#f-module", "BTX");
  await waitFor(async () => (await page.locator("#main-plot-list .plot-card").count()) === 5);
  assert((await page.locator("#sub-plot-list .plot-card").count()) === 7, "BTX 副規則7條");
  // 角色加入（詳情面板）與移出
  const beforeCast = await page.locator("#character-pool .pool-card.in-cast").count();
  await page.locator("#character-pool .pool-card", { hasText: "黑貓" }).click();
  await waitFor(() => page.locator("#d-add").count());
  await page.click("#d-add");
  const afterCast = await page.locator("#character-pool .pool-card.in-cast").count();
  assert(afterCast === beforeCast + 1, "可以加入擴展角色（黑貓）");
  await page.click("#d-remove");
  assert((await page.locator("#character-pool .pool-card.in-cast").count()) === beforeCast, "可以移出角色");
  // 拖曳角色到地圖
  const beforeDrag = await page.locator("#character-pool .pool-card.in-cast").count();
  const targetLoc = page.locator("#board-preview .location-panel", { hasText: "醫院" });
  await page.locator("#character-pool .pool-card", { hasText: "局外人" }).dragTo(targetLoc);
  const afterDrag = await page.locator("#character-pool .pool-card.in-cast").count();
  assert(afterDrag === beforeDrag + 1, "拖曳角色到地圖可加入劇本");
  const hospitalTokens = await page.locator("#board-preview .location-panel", { hasText: "醫院" }).locator(".preview-token").count();
  assert(hospitalTokens >= 1, "局外人出現在醫院版圖");
  // 驗證
  const errText = await page.locator("#validate-out").innerText();
  console.log("編輯器驗證信息:", errText.split("\n")[0]);
  // 返回 FS 並導入預設劇本（THE FIRST SCRIPT）
  await page.selectOption("#f-module", "FS");
  clearInterval(modalTimer);
  modalTimerDisabled = true;
  await page.click("#btn-import-preset");
  await waitFor(() => page.locator("#import-list .ref-item").count());
  await page.locator("#import-list .ref-item", { hasText: "THE FIRST SCRIPT" }).click();
  await waitFor(async () => (await page.locator("#validate-out .ok").count()) === 1);
  assert((await page.inputValue("#f-title")).includes("THE FIRST SCRIPT"), "導入預設劇本標題已載入");
  assert((await page.locator("#board-preview .preview-token").count()) === 6, "THE FIRST SCRIPT 6名角色上場");
  const presetSecretText = await page.locator("#secret-card").innerText();
  assert(presetSecretText.includes("開膛者的魔影"), "THE FIRST SCRIPT 秘密卡包含副規則");
  modalTimer = startModalTimer();
  // FS 多副規則：可多選，導出時提醒並寫入特殊規則
  await page.locator("#sub-plot-list .plot-card", { hasText: "流言四起" }).click();
  await waitFor(async () => (await page.locator("#sub-plot-list .plot-card.selected").count()) === 2);
  const warnText = await page.locator("#validate-out").innerText();
  assert(warnText.includes("提醒") && warnText.includes("副規則"), "FS 多副規則顯示提醒");
  // 傳謠人按上限合併為1名，劇本應直接合法
  await waitFor(async () => (await page.locator("#validate-out .ok").count()) === 1);
  await page.click("#btn-play");
  await waitFor(() => page.locator("#setup-modal").isVisible(), 10000);
  const saved = await page.evaluate(() => localStorage.getItem("tl_current_script") || "");
  assert(saved.includes("【多副規則】"), "特殊規則已寫入【多副規則】註明");

  // 3. 遊戲（從編輯器跳轉）
  await waitFor(() => page.locator("#setup-modal").isVisible());
  assert(await page.locator("#setup-modal").isVisible(), "顯示遊戲設定");
  await page.click("#setup-modal [data-n='3']");
  await waitFor(async () => (await page.locator(".location-panel").count()) === 4);
  // 彈窗生命周期記錄（失敗診斷用）
  await page.evaluate(() => {
    window.__mlog = [];
    const rec = (ev, w) => window.__mlog.push((Date.now() % 100000) + ":" + ev + ":" + ((w.querySelector(".tl-modal-title") || {}).textContent || "?") + ":" + ((w.querySelector(".tl-btn") || {}).textContent || "?"));
    document.addEventListener("click", (e) => {
      if (e.target && e.target.closest && e.target.closest("#tl-modal-root")) {
        window.__mlog.push((Date.now() % 100000) + ":CLICK:" + (e.target.className || e.target.tagName) + ":trusted=" + e.isTrusted + ":x=" + Math.round(e.clientX) + ":y=" + Math.round(e.clientY));
      }
    }, true);
    const start = () => {
      const root = document.getElementById("tl-modal-root");
      if (!root) return false;
      new MutationObserver((ms) => {
        for (const m of ms) {
          for (const n of m.addedNodes) if (n.classList && n.classList.contains("tl-modal-wrap")) rec("ADD", n);
          for (const n of m.removedNodes) if (n.classList && n.classList.contains("tl-modal-wrap")) rec("DEL", n);
        }
      }).observe(root, { childList: true });
      return true;
    };
    if (!start()) {
      const obs = new MutationObserver(() => { if (start()) obs.disconnect(); });
      obs.observe(document.body, { childList: true });
    }
  });
  assert(await page.locator(".location-panel").count() === 4, "四塊版圖渲染");
  const tokenCount = await page.locator(".char-token").count();
  assert(tokenCount === 6, "FS 6名角色上場（實際 " + tokenCount + "）");
  // 打牌流程：劇作家
  await page.click("#phase-btn"); // 開始本日
  await waitForPhase(page, "劇作家行動");
  await page.locator(".hand-card", { hasText: "密謀+1" }).first().click();
  await page.locator(".char-token", { hasText: "女學生" }).click();
  await page.waitForTimeout(250);
  await page.locator(".hand-card", { hasText: "不安+1" }).first().click();
  await page.locator(".char-token", { hasText: "男學生" }).click();
  await page.waitForTimeout(250);
  await page.locator(".hand-card", { hasText: "移動←→" }).first().click();
  await page.locator(".location-panel", { hasText: "學校" }).click();
  assert(await page.locator(".play-item").count() === 3, "劇作家已打出3張牌");
  await page.click("#phase-btn");
  await waitForPhase(page, "主人公行動");
  // 主人公：3人各打1張（不同位置）
  const pTargets = ["巫女", "職員", "男學生"];
  for (let i = 0; i < 3; i++) {
    const hand = page.locator(".hand-area > div").nth(i);
    await hand.locator(".hand-card", { hasText: "友好+1" }).first().click();
    await page.locator(".char-token", { hasText: pTargets[i] }).click();
  }
  assert(await page.locator(".play-item").count() === 6, "主人公已打出3張牌（共6張）");
  const removableInP = await page.locator(".play-item button", { hasText: "移除" }).count();
  assert(removableInP === 3, "主人公階段不可移除劇作家的牌（僅主人公3張可移除，實際 " + removableInP + "）");
  await page.click("#phase-btn");
  await waitForPhase(page, "行動結算");
  await page.click("#phase-btn");
  await waitFor(async () => (await page.locator(".face-up").count()) > 0, 2000);
  assert((await page.locator(".face-up").count()) >= 3, "結算時翻牌顯示卡面");
  await waitForPhase(page, "劇作家能力階段");
  await waitFor(async () => !(await page.locator("#phase-btn").isDisabled()), 15000);
  // 劇作家能力階段：能力面板高亮可用能力 → 點擊能力 → 目標高亮 → 二次確認
  assert((await page.locator("#ability-panel .ability-btn.usable").count()) >= 1, "劇作家能力面板有高亮可用能力");
  await page.locator("#ability-panel .ability-btn.usable").first().click();
  await waitFor(async () => (await page.locator(".char-token.targetable").count()) > 0);
  assert((await page.locator(".char-token.targetable").count()) >= 1, "選擇能力後角色目標高亮");
  clearInterval(modalTimer);
    modalTimerDisabled = true;
  await page.locator(".char-token.targetable").first().click({ force: true });
  await waitFor(async () => (await page.locator(".tl-modal-wrap:not(#setup-overlay)").count()) > 0);
  assert((await page.locator(".tl-modal-wrap:not(#setup-overlay)").count()) > 0, "使用能力前顯示二次確認");
  await page.waitForTimeout(300); // 等待彈窗動畫穩定
  await clickModalBtn(page, "確認使用");
  modalTimer = startModalTimer();
  await waitFor(async () => (await page.locator("#ability-panel .ability-btn.selected").count()) === 0);
  await page.click("#phase-btn");
  await waitForPhase(page, "友好能力階段");
  await page.click("#phase-btn");
  await waitForPhase(page, "事件階段");
  await page.click("#phase-btn");
  await waitForPhase(page, "回合結束（夜間）");
  await page.click("#phase-btn");
  // 第2天
  await waitForPhase(page, "早晨");
  await page.click("#phase-btn"); // 開始本日
  await waitForPhase(page, "劇作家行動");
  assert(true, "完整第1天流程可運行");
  // 長按角色彈出角色卡大圖
  clearInterval(modalTimer);
    modalTimerDisabled = true;
  const tok = page.locator(".char-token").first();
  const tb = await tok.boundingBox();
  await page.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(750);
  await page.mouse.up();
  await waitFor(() => page.locator(".char-card-pop").count());
  assert((await page.locator(".char-card-pop").count()) > 0, "長按角色彈出角色卡大圖");
  await clickModalBtn(page, "關閉");
  modalTimer = startModalTimer();
  // 右鍵查看角色詳情（不應彈出瀏覽器選單）
  clearInterval(modalTimer);
    modalTimerDisabled = true;
  await page.locator(".char-token", { hasText: "男學生" }).click({ button: "right" });
  await waitFor(() => page.locator(".char-card-pop").count());
  assert((await page.locator(".char-card-pop").count()) > 0, "右鍵角色彈出角色卡大圖");
  assert((await page.locator(".char-card-pop .status-block").count()) === 1, "角色卡包含現況狀態");
  await clickModalBtn(page, "關閉");
  modalTimer = startModalTimer();
  // 秘密視圖
  await page.check("#tgl-secret");
  assert(await page.locator("#secret-panel").isVisible(), "劇作家秘密面板顯示");
  const secretText = await page.locator("#secret-panel").innerText();
  assert(secretText.includes("主規則"), "秘密面板包含主規則");
  // 設定面板：動畫開關
  clearInterval(modalTimer);
    modalTimerDisabled = true;
  await page.click("#btn-settings");
  await waitFor(() => page.locator("#set-anim").count());
  assert((await page.locator("#set-anim").isChecked()) === true, "設定面板動畫預設開啟");
  await page.click("#set-anim");
  assert((await page.locator("#set-anim").isChecked()) === false, "可關閉結算動畫");
  await clickModalBtn(page, "關閉");
  modalTimer = startModalTimer();

  // 遊戲畫面截圖
  await page.screenshot({ path: path.join(root, "tests", "shot_game.png"), fullPage: true });

  // 4. 規則參考（模組紙）
  clearInterval(modalTimer);
    modalTimerDisabled = true;
  await page.goto("http://localhost:8358/editor.html");
  await waitFor(async () => (await page.locator("#character-pool .pool-card").count()) === 37);
  await page.click("#btn-ref");
  await waitFor(() => page.locator(".ref-tab").count());
  assert((await page.locator(".ref-tab").count()) === 6, "規則參考有6個分頁");
  await page.locator(".ref-tab", { hasText: "角色卡" }).click();
  await waitFor(async () => (await page.locator(".ref-item").count()) > 0);
  assert((await page.locator(".ref-item").count()) >= 17, "角色卡分頁顯示角色（≥17）");
  await page.locator(".ref-tab", { hasText: "事件" }).click();
  await waitFor(async () => (await page.locator(".ref-item").count()) > 0);
  assert((await page.locator(".ref-item").count()) >= 7, "事件分頁顯示事件（≥7）");
  await clickModalBtn(page, "關閉");
  modalTimer = startModalTimer();

  // 編輯器截圖（保留供人工檢查）
  await page.screenshot({ path: path.join(root, "tests", "shot_editor.png"), fullPage: true });

  console.log("\n控制台錯誤數:", errors.length);
  errors.forEach(e => console.log("  ", e));
  await browser.close();
  clearInterval(modalTimer);
    modalTimerDisabled = true;
  server.close();
  console.log(failures === 0 && errors.length === 0 ? "\nUI 測試全部通過 ✓" : "\n有 " + failures + " 項失敗 / " + errors.length + " 個控制台錯誤 ✗");
  process.exit(failures === 0 && errors.length === 0 ? 0 : 1);
})().catch(e => {
  console.error("測試異常:", e);
  process.exit(1);
});
