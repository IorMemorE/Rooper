// 多人聯機瀏覽器測試：雙頁面（房主 + 玩家）走完大廳→遊戲→視角切換→聊天
const { spawn } = require("child_process");
const path = require("path");
const { chromium } = require("playwright-core");

const PORT = 8374;
const ROOT = path.join(__dirname, "..");
const SERVER = path.join(__dirname, "..", "..", "server", "multiplayer.js");
const BASE = "http://localhost:" + PORT;

let failures = 0;
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function assert(cond, msg) {
  if (!cond) { failures++; console.error("FAIL:", msg); }
  else console.log("ok:", msg);
}
async function waitFor(fn, timeout = 12000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try { const v = await fn(); if (v) return v; } catch (e) {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("timeout waiting");
}

async function startServer() {
  const proc = spawn(process.execPath, [SERVER, String(PORT)], { stdio: ["ignore", "pipe", "pipe"] });
  await new Promise((resolve, reject) => {
    let out = "";
    proc.stdout.on("data", (d) => { out += d.toString(); if (out.indexOf("已啟動") >= 0) resolve(); });
    proc.on("error", reject);
    setTimeout(() => reject(new Error("伺服器啟動超時")), 8000);
  });
  return proc;
}

(async () => {
  let proc;
  const browser = await chromium.launch({
    executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    headless: true
  });
  const errors = [];
  try {
    proc = await startServer();
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
    const p1 = await ctx.newPage();
    const p2 = await ctx.newPage();
    p1.on("console", (m) => { if (m.type() === "error") errors.push("p1: " + m.text()); });
    p2.on("console", (m) => { if (m.type() === "error") errors.push("p2: " + m.text()); });

    // 大廳：房主建立
    await p1.goto(BASE + "/multiplayer.html");
    await p1.fill("#lb-name", "房主");
    await p1.click("#lb-create");
    await waitFor(() => p1.locator("#lb-roomcode").innerText());
    const code = (await p1.locator("#lb-roomcode").innerText()).trim();
    assert(!!code, "房主建立房間取得代碼 " + code);
    assert((await p1.locator("#lb-players .lb-player").count()) === 1, "房主1人時獨占4英雄");

    // 玩家2加入
    await p2.goto(BASE + "/multiplayer.html");
    await p2.fill("#lb-name", "玩家2");
    await p2.fill("#lb-code", code);
    await p2.click("#lb-join");
    await waitFor(async () => (await p2.locator("#lb-players .lb-player").count()) === 2);
    assert(true, "玩家2加入房間");

    // 房主分配：房主=劇作家，玩家2=A+B+C（規則：劇作家不可兼任主人公）
    await p1.locator('.assign-sel[data-slot="mm"]').selectOption({ label: "房主" });
    await p1.locator('.assign-sel[data-slot="a"]').selectOption({ label: "玩家2" });
    await p1.locator('.assign-sel[data-slot="b"]').selectOption({ label: "玩家2" });
    await p1.locator('.assign-sel[data-slot="c"]').selectOption({ label: "玩家2" });
    await waitFor(async () => (await p2.locator('.slot-badge').count()) === 4);
    assert((await p2.locator('.slot-badge').count()) === 4, "英雄分配完成（房主：劇作家，玩家2：A+B+C）");

    // 選劇本並開始
    await p1.locator("#lb-use-preset").click();
    await waitFor(() => p1.locator("#lb-preset-cards .script-card").count());
    await p1.locator('#lb-preset-cards .script-card[data-id="the_first_script"]').click();
    await waitFor(async () => (await p1.locator(".script-picked").innerText()).indexOf("THE FIRST SCRIPT") >= 0);
    await p1.click("#lb-start");
    await waitFor(() => p1.locator("#phase-name").count());
    await waitFor(() => p2.locator("#phase-name").count());
    assert((await p1.locator(".location-panel").count()) === 4, "房主進入聯機遊戲（4版圖）");
    assert((await p2.locator(".location-panel").count()) === 4, "玩家2進入聯機遊戲");

    // 視角與隱私
    assert((await p1.locator("#persp-bar .persp-btn").count()) === 1, "房主視角按鈕：劇作家");
    assert((await p2.locator("#persp-bar .persp-btn").count()) === 3, "玩家2視角按鈕：A+B+C");
    assert(await p2.locator("#tgl-secret-row").isHidden(), "主人公看不到劇作家秘密開關");
    assert(await p1.locator("#tgl-secret-row").isVisible(), "劇作家看得到秘密開關");

    // 開始本日 → 劇作家打牌
    await p1.click("#phase-btn");
    await waitFor(async () => (await p1.locator("#phase-name").innerText()) === "劇作家行動");
    await p1.locator(".hand-card", { hasText: "密謀+1" }).first().click();
    await p1.locator(".char-token", { hasText: "女學生" }).click();
    await sleep(300);
    await p1.locator(".hand-card", { hasText: "不安+1" }).first().click();
    await p1.locator(".char-token", { hasText: "男學生" }).click();
    await sleep(300);
    await p1.locator(".hand-card", { hasText: "移動←→" }).first().click();
    await p1.locator(".char-token", { hasText: "刑警" }).click();
    await waitFor(async () => (await p1.locator("#plays-list .play-item").count()) >= 1, 15000);
    await waitFor(async () => (await p1.locator("#plays-list .play-item").count()) === 3);
    await waitFor(async () => (await p2.locator("#board .face-down").count()) === 3);
    assert((await p2.locator("#plays-list .play-item").count()) === 3, "玩家2的牌表顯示劇作家的蓋牌（顯示目標、不顯示卡面）");
    const p2plays = await p2.locator("#plays-list").innerText();
    assert(p2plays.indexOf("密謀") < 0 && p2plays.indexOf("不安") < 0 && p2plays.indexOf("蓋牌") >= 0, "玩家2只看到蓋牌與目標，看不到劇作家的卡牌內容");
    await p1.click("#phase-btn"); // 確認打出
    await waitFor(async () => (await p1.locator("#phase-name").innerText()) === "主人公行動");

    // 玩家2：視角A打一張、切換視角B再打一張
    await p2.locator(".hand-card", { hasText: "友好+1" }).first().click();
    await p2.locator(".char-token", { hasText: "巫女" }).click();
    await waitFor(async () => (await p2.locator("#plays-list .play-item").count()) === 4); // 劇作家蓋牌3 + 自己的1
    await p2.locator('.persp-btn[data-slot="b"]').click();
    await waitFor(async () => (await p2.locator(".hand-card").count()) > 0);
    await p2.locator(".hand-card", { hasText: "友好+1" }).first().click();
    await p2.locator(".char-token", { hasText: "職員" }).click();
    await waitFor(async () => (await p2.locator("#plays-list .play-item").count()) === 4);
    assert(true, "玩家2以 A/B 雙視角各打一張");

    // 聊天
    await p2.fill("#chat-input", "大家好");
    await p2.click("#chat-send");
    await waitFor(() => p1.locator("#chat-log .chat-msg", { hasText: "大家好" }).count());
    assert((await p1.locator("#chat-log .chat-msg", { hasText: "大家好" }).count()) === 1, "聊天訊息送達房主");

    // ---- 手動模式：分人確認 + 掀開卡牌 + 手動結算 + 失敗按鈕 ----
    // 主人公C 補打一張（P2 持有 A/B/C 三視角）
    await p2.locator('.persp-btn[data-slot="c"]').click();
    await waitFor(async () => (await p2.locator(".hand-card").count()) > 0);
    await p2.locator(".hand-card", { hasText: "不安+1" }).first().click();
    await p2.locator(".char-token", { hasText: "男學生" }).click();
    await waitFor(async () => (await p2.locator("#plays-list .play-item").count()) === 4);
    assert(true, "主人公C補打一張");

    // 開啟手動模式（劇作家側）
    await p1.click("#btn-mm-manual");
    await waitFor(() => p1.locator("#btn-mm-manual").innerText().then((t) => t.indexOf("✋") >= 0));
    assert(true, "劇作家開啟手動模式");

    // 主人公失敗按鈕：劇作家側顯示，彈窗三選一後取消
    assert(await p1.locator("#btn-mm-lose").isVisible(), "手動模式下顯示主人公失敗按鈕");
    await p1.click("#btn-mm-lose");
    await waitFor(() => p1.locator(".tl-btn-choice").count());
    const loseOpts = await p1.locator(".tl-btn-choice").allInnerTexts();
    assert(loseOpts.some((t) => t.indexOf("主人公失敗") >= 0) && loseOpts.some((t) => t.indexOf("主人公死亡") >= 0) &&
      loseOpts.some((t) => t.indexOf("取消") >= 0), "失敗彈窗三選一");
    await p1.locator(".tl-btn-choice", { hasText: "取消" }).click();
    await sleep(300);
    assert((await p1.locator(".tl-btn-choice").count()) === 0, "失敗彈窗可取消");

    // 主人公（P2）各自確認打出 A/B/C（切換視角）；劇作家在全部確認前無確認按鈕
    assert(await p1.locator("#phase-btn").isHidden(), "主人公未全部確認前劇作家視角無按鈕");
    await p2.locator('.persp-btn[data-slot="a"]').click();
    await waitFor(async () => (await p2.locator("#phase-btn").innerText()).indexOf("確認打出（A）") >= 0);
    await p2.locator("#phase-btn").click(); // 確認 A
    await p2.locator('.persp-btn[data-slot="b"]').click();
    await waitFor(async () => (await p2.locator("#phase-btn").innerText()).indexOf("確認打出（B）") >= 0);
    await p2.locator("#phase-btn").click(); // 確認 B
    await p2.locator('.persp-btn[data-slot="c"]').click();
    await waitFor(async () => (await p2.locator("#phase-btn").innerText()).indexOf("確認打出（C）") >= 0);
    await p2.locator("#phase-btn").click(); // 確認 C
    await waitFor(async () => (await p1.locator("#phase-btn").innerText()).indexOf("掀開所有卡牌") >= 0);
    assert(true, "主人公各自確認打出後劇作家側出現掀開按鈕");

    // 掀開所有卡牌 → 停在行動結算（手動，不自動結算）；卡面公開給所有人
    await p1.click("#phase-btn");
    await waitFor(async () => (await p1.locator("#phase-name").innerText()) === "行動結算");
    const revealedText = await p2.locator("#plays-list").innerText();
    assert(revealedText.indexOf("密謀") >= 0, "掀開後主人公能看到劇作家的卡面（密謀+1）");
    assert(await p2.locator("#phase-btn").isHidden(), "手動結算期間主人公視角無推進按鈕");

    // 手動結算期間：劇作家點角色仍可開啟編輯面板
    await p1.locator(".char-token", { hasText: "女學生" }).click();
    await waitFor(() => p1.locator('.tl-modal', { hasText: "編輯角色" }).count());
    assert(true, "手動結算期間可編輯盤面");
    await p1.locator(".tl-modal .tl-btn", { hasText: "取消" }).click();
    await sleep(300);
    assert((await p1.locator('.tl-modal', { hasText: "編輯角色" }).count()) === 0, "編輯面板可關閉");

    // 劇作家「進入劇作家能力階段」→ 真正結算（處理移動方向提示）
    await p1.click("#phase-btn");
    await waitFor(() => p1.locator(".tl-btn-choice").count());
    await p1.locator(".tl-btn-choice").first().click();
    await waitFor(async () => (await p1.locator("#phase-name").innerText()).indexOf("劇作家能力") >= 0);
    assert(true, "手動模式掀開後由劇作家結算並進入能力階段");

    // 關閉手動模式
    await p1.click("#btn-mm-manual");
    await waitFor(async () => (await p1.locator("#btn-mm-manual").innerText()).indexOf("✋") < 0);
    assert(true, "關閉手動模式成功");

    // ---- 手動模式下劇作家打牌（推進到下一日 mm_play 驗證）----
    await p1.click("#btn-mm-manual");
    await waitFor(async () => (await p1.locator("#btn-mm-manual").innerText()).indexOf("✋") >= 0);
    // mm_abilities → goodwill → incident → day_end → 下一日（全程劇作家推進，手動模式下結算需兩步）
    await p1.click("#phase-btn"); // 結束能力階段
    await waitFor(async () => (await p1.locator("#phase-name").innerText()).indexOf("友好能力") >= 0);
    // 結束友好能力歸隊長（主人公 A），由 P2 切到 A 視角點擊
    await p2.locator('.persp-btn[data-slot="a"]').click();
    await waitFor(async () => (await p2.locator("#phase-btn").innerText()).indexOf("結束友好能力") >= 0);
    await p2.locator("#phase-btn").click();
    await waitFor(async () => (await p1.locator("#phase-name").innerText()).indexOf("事件") >= 0);
    await p1.click("#phase-btn"); // 事件：準備結算
    await waitFor(async () => (await p1.locator("#phase-btn").innerText()).indexOf("開始結算") >= 0);
    await p1.click("#phase-btn"); // 事件：開始結算
    await waitFor(async () => (await p1.locator("#phase-name").innerText()).indexOf("回合結束") >= 0);
    await p1.click("#phase-btn"); // 夜間：準備結算
    await waitFor(async () => (await p1.locator("#phase-btn").innerText()).indexOf("開始結算") >= 0);
    await p1.click("#phase-btn"); // 夜間：開始結算
    await waitFor(async () => (await p1.locator("#phase-name").innerText()).indexOf("早晨") >= 0);
    await p1.click("#phase-btn"); // 開始本日
    await waitFor(async () => (await p1.locator("#phase-name").innerText()).indexOf("劇作家行動") >= 0);

    // 手動模式下劇作家打牌：點手牌 → 點角色目標（不得被編輯面板攔截）
    await p1.locator(".hand-card", { hasText: "密謀+1" }).first().click();
    await p1.locator(".char-token", { hasText: "女學生" }).click();
    await waitFor(async () => (await p1.locator("#plays-list .play-item").count()) >= 1, 15000);
    const mmPlayText = await p1.locator("#plays-list").innerText();
    assert(mmPlayText.indexOf("密謀+1") >= 0 && mmPlayText.indexOf("女學生") >= 0, "手動模式下劇作家成功打出密謀+1到女學生");

    // 蓋出後對應手牌灰掉；點擊盤面卡牌收回後重新可用
    const playedCardCls = await p1.locator(".hand-card", { hasText: "密謀+1" }).first().getAttribute("class");
    assert(playedCardCls.indexOf("used") >= 0, "蓋出後對應手牌灰掉");
    await p1.locator('#board .card-wrap[data-owner="mm"]').first().click();
    await waitFor(async () => (await p1.locator(".hand-card", { hasText: "密謀+1" }).first().getAttribute("class")).indexOf("used") < 0);
    assert(true, "點擊盤面蓋牌收回後手牌重新可用");
    await p1.locator(".hand-card", { hasText: "密謀+1" }).first().click();
    await p1.locator(".char-token", { hasText: "女學生" }).click();
    await waitFor(async () => (await p1.locator("#plays-list .play-item").count()) >= 1, 15000);

    await p1.locator(".hand-card", { hasText: "不安+1" }).first().click();
    await p1.locator(".char-token", { hasText: "男學生" }).click();
    await waitFor(async () => (await p1.locator("#plays-list .play-item").count()) === 2, 15000);
    const mmPlayText2 = await p1.locator("#plays-list").innerText();
    assert(mmPlayText2.indexOf("不安+1") >= 0 && mmPlayText2.indexOf("男學生") >= 0, "手動模式下劇作家成功打出不安+1到男學生");
    assert(await p2.locator("#phase-btn").isHidden(), "手動模式打牌階段主人公視角仍無推進按鈕");

    console.log("控制台錯誤數:", errors.length);
    errors.forEach((e) => console.log("  ", e));
    console.log(failures === 0 && errors.length === 0 ? "\n多人聯機瀏覽器測試全部通過 ✓" : "\n有 " + failures + " 項失敗 / " + errors.length + " 個控制台錯誤 ✗");
    process.exit(failures === 0 && errors.length === 0 ? 0 : 1);
  } catch (e) {
    console.error("測試異常:", e);
    process.exit(1);
  } finally {
    if (proc) proc.kill();
    await browser.close();
  }
})();
