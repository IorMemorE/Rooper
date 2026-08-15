// 多人聯機整合測試：啟動真實伺服器 + 3 個 WebSocket 客戶端
const { spawn } = require("child_process");
const path = require("path");
const { WSClient } = require(path.join(__dirname, "..", "..", "server", "ws"));

const PORT = 8370;
const SERVER = path.join(__dirname, "..", "..", "server", "multiplayer.js");
const URL = "ws://localhost:" + PORT + "/ws";

let failures = 0;
function assert(cond, msg) {
  if (!cond) { failures++; console.error("FAIL:", msg); }
  else console.log("ok:", msg);
}

class TestClient {
  constructor() { this.msgs = []; this.waiters = []; }
  async connect() {
    this.conn = await new WSClient(URL).connect();
    this.conn.on("message", (raw) => {
      let m;
      try { m = JSON.parse(raw); } catch (e) { return; }
      this.msgs.push(m);
      this.waiters = this.waiters.filter((w) => {
        if (w.pred(m)) { clearTimeout(w.t); w.resolve(m); return false; }
        return true;
      });
    });
    return this;
  }
  send(type, payload) {
    this.conn.send(JSON.stringify(Object.assign({ type: type }, payload || {})));
  }
  waitFor(pred, timeout) {
    return new Promise((resolve, reject) => {
      const hit = this.msgs.find(pred);
      if (hit) return resolve(hit);
      const t = setTimeout(() => reject(new Error("等待訊息超時")), timeout || 10000);
      this.waiters.push({ pred: pred, resolve: resolve, t: t });
    });
  }
  waitView(pred, timeout) {
    return this.waitFor((m) => m.type === "view" && (!pred || pred(m)), timeout);
  }
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function startServer() {
  const proc = spawn(process.execPath, [SERVER, String(PORT)], { stdio: ["ignore", "pipe", "pipe"] });
  await new Promise((resolve, reject) => {
    let out = "";
    proc.stdout.on("data", (d) => {
      out += d.toString();
      if (out.indexOf("已啟動") >= 0) resolve();
    });
    proc.on("error", reject);
    setTimeout(() => reject(new Error("伺服器啟動超時")), 8000);
  });
  return proc;
}

(async () => {
  let proc;
  try {
    proc = await startServer();
    const c1 = await new TestClient().connect();
    const c2 = await new TestClient().connect();
    const c3 = await new TestClient().connect();

    // 建立房間（房主自動獨占4英雄）
    c1.send("create", { name: "房主", avatar: "writer_1.png" });
    const w1 = await c1.waitFor((m) => m.type === "welcome");
    const p1 = w1.id;
    const roomMsg = await c1.waitFor((m) => m.type === "room");
    const code = roomMsg.room.code;
    assert(!!code && code.length === 4, "建立房間並取得4位代碼");
    assert(roomMsg.room.players[0].slots.length === 4, "1人時房主獨占全部英雄");

    c2.send("join", { room: code, name: "玩家2", avatar: "hero_A.png" });
    const w2 = await c2.waitFor((m) => m.type === "welcome");
    const p2 = w2.id;
    c3.send("join", { room: code, name: "玩家3", avatar: "hero_C.png" });
    const w3 = await c3.waitFor((m) => m.type === "welcome");
    const p3 = w3.id;
    assert(p2 !== p1 && p3 !== p1 && p2 !== p3, "三名玩家各得獨立ID");

    // 分配規則：先給玩家2主人公A，再試圖給劇作家 → 應被拒絕
    c1.send("assign", { slot: "a", playerId: p2 });
    await sleep(200);
    c1.send("assign", { slot: "mm", playerId: p2 });
    const errAssign = await c1.waitFor((m) => m.type === "error");
    assert(errAssign.msg.indexOf("劇作家不可兼任主人公") >= 0, "劇作家不可兼任主人公");

    // 正確分配：P1=劇作家, P2=A+B, P3=C
    c1.send("assign", { slot: "mm", playerId: p1 });
    c1.send("assign", { slot: "a", playerId: p2 });
    c1.send("assign", { slot: "b", playerId: p2 });
    c1.send("assign", { slot: "c", playerId: p3 });
    await sleep(300);
    const roomFinal = await c1.waitFor((m) => {
      if (m.type !== "room") return false;
      const pl = m.room.players;
      const g = (id) => (pl.find((p) => p.id === id) || { slots: [] }).slots;
      return g(p1).join(",") === "mm" && g(p2).slice().sort().join(",") === "a,b" && g(p3).join(",") === "c";
    });
    assert(true, "P1 劇作家 / P2 A+B / P3 C 分配正確");

    // 選劇本並開始
    c1.send("select_script", { presetId: "the_first_script" });
    await sleep(150);
    // 房间设置：主人公可看队友盖牌 + 起始队长为主人公C
    c1.send("room_setting", { seeTeammateCards: true, leaderStart: 2 });
    await sleep(150);
    c1.send("start");
    const v1 = await c1.waitView();
    const v2 = await c2.waitView();
    const v3 = await c3.waitView();
    assert(v1.script.mainPlot === "murder_plan", "劇作家收到完整劇本（含主規則）");
    assert(v2.script.mainPlot === undefined, "主人公收到公開劇本（不含主規則）");
    assert(v1.phase === "day_start", "遊戲從早晨開始");
    assert(v1.leader === 2, "起始队长为主人公C（leaderStart 生效）");

    // 開始本日 → 劇作家行動
    c1.send("action", { action: "nextStep" });
    await c1.waitView((m) => m.phase === "mm_play");
    assert(true, "進入劇作家行動");

    // 劇作家打3張（含移動牌，測試提示路由）
    c1.send("action", { action: "mmPlayCard", card: "m_intrigue_plus1", targetType: "char", targetId: "girl_student" });
    c1.send("action", { action: "mmPlayCard", card: "m_paranoia_plus", targetType: "char", targetId: "boy_student" });
    c1.send("action", { action: "mmPlayCard", card: "m_move_h", targetType: "char", targetId: "police_officer" });
    const v1b = await c1.waitView((m) => (m.mmPlays || []).length === 3);
    assert(v1b.mmPlays[0].card === "m_intrigue_plus1", "劇作家視角能看到自己的牌");
    const v2b = await c2.waitView((m) => (m.mmPlays || []).length === 3);
    assert(v2b.mmPlays.every((p) => p.card === null), "主人公看不到劇作家的牌（蓋牌）");
    c1.send("action", { action: "confirmMMPlays" });
    await c1.waitView((m) => m.phase === "p_play");

    // 主人公打牌：P2 打 A、B 兩張牌，P3 打 C 牌
    c2.send("action", { action: "pPlayCard", deck: 0, card: "p_goodwill_plus1", targetType: "char", targetId: "shrine_maiden" });
    c2.send("action", { action: "pPlayCard", deck: 1, card: "p_goodwill_plus1", targetType: "char", targetId: "office_worker" });
    c3.send("action", { action: "pPlayCard", deck: 2, card: "p_paranoia_plus", targetType: "char", targetId: "boy_student" });
    const v2c = await c2.waitView((m) => (m.pPlays || []).length === 3);
    const v3c = await c3.waitView((m) => (m.pPlays || []).length === 3);
    assert(v2c.pPlays.find((p) => p.deck === 0).card === "p_goodwill_plus1", "P2 看到自己（A）的牌");
    assert(v2c.pPlays.find((p) => p.deck === 1).card === "p_goodwill_plus1", "P2 看到自己（B）的牌");
    assert(v2c.pPlays.find((p) => p.deck === 2).card === "p_paranoia_plus", "看队友盖牌：P2 能看到主人公C的卡面");
    assert(v3c.pPlays.find((p) => p.deck === 2).card === "p_paranoia_plus", "P3 看到自己（C）的牌");
    assert(v3c.pPlays.find((p) => p.deck === 0).card === "p_goodwill_plus1" && v3c.pPlays.find((p) => p.deck === 1).card === "p_goodwill_plus1", "看队友盖牌：P3 能看到主人公A/B的卡面");
    assert(!!v2c.used.p0 && !!v2c.used.p1 && !v2c.used.p2, "P2 只拿到自己的牌組狀態（A+B）");
    // 分人確認：P2 確認 A/B，P3 確認 C（從隊長 A 開始）
    c2.send("action", { action: "confirmPPlays", deck: 0 });
    await c2.waitView((m) => m.pConfirmed && m.pConfirmed[0] === true);
    c2.send("action", { action: "confirmPPlays", deck: 1 });
    await c2.waitView((m) => m.pConfirmed && m.pConfirmed[1] === true);
    c3.send("action", { action: "confirmPPlays", deck: 2 });
    const vAllP = await c3.waitView((m) => m.allPConfirmed === true);
    assert(vAllP.allPConfirmed === true, "三位主人公都已確認打出");

    // 劇作家掀開所有卡牌（自動模式 → 自動結算）；移動方向提示路由給 P1
    c1.send("action", { action: "revealAll" });
    const prompt = await c1.waitFor((m) => m.type === "prompt");
    assert(prompt.kind === "choice" && prompt.title === "移動方向", "移動方向提示發給劇作家");
    c1.send("prompt_reply", { id: prompt.id, value: 0 });
    const vResolveDone = await c1.waitView((m) => m.phase === "resolve_done");
    assert(vResolveDone.revealed === true, "掀開卡牌並自動結算完成");
    const vRevealedP = await c3.waitView((m) => m.revealed === true);
    assert(vRevealedP.mmPlays.every((p) => p.card != null), "掀開後所有人能看到劇作家的卡面");

    // 右上角「進入劇作家能力階段」
    c1.send("action", { action: "finishResolve" });
    const v1d = await c1.waitView((m) => m.phase === "mm_abilities" && m.chars.girl_student && m.chars.girl_student.intrigue === 1);
    assert(v1d.phase === "mm_abilities", "結算完成進入劇作家能力階段");
    assert(v1d.chars.boy_student.paranoia >= 2, "男學生不安+2（劇作家+主人公C）");
    assert(v1d.chars.shrine_maiden.goodwill === 1, "巫女友好+1");
    await c2.waitView((m) => m.chars.girl_student && m.chars.girl_student.intrigue === 1);

    // 劇作家能力（主謀=醫生）：日誌不得洩漏身份
    c1.send("action", {
      action: "execMMAbility",
      entry: { charId: "doctor", ability: { effect: "brain_intrigue", desc: "主謀能力" } },
      target: { type: "char", id: "boy_student" }
    });
    const v1e = await c1.waitView((m) => m.chars.boy_student && m.chars.boy_student.intrigue >= 1);
    assert(v1e.log.every((l) => l.text.indexOf("【主謀】") < 0 && l.text.indexOf("【傳謠人】") < 0), "劇作家能力日誌不洩漏身份");
    assert(v1e.log.some((l) => l.text.indexOf("密謀+1") >= 0), "日誌只記錄結果（密謀+1）");

    // 聊天
    c2.send("chat", { text: "大家好" });
    const chatMsg = await c1.waitFor((m) => m.type === "chat");
    assert(chatMsg.text === "大家好" && chatMsg.from === "玩家2", "聊天訊息全房廣播");

    // 非劇作家不能替劇作家打牌
    c2.send("action", { action: "mmPlayCard", card: "m_intrigue_plus1", targetType: "char", targetId: "girl_student" });
    const errOwn = await c2.waitFor((m) => m.type === "error");
    assert(errOwn.msg && errOwn.msg.indexOf("你不是劇作家") >= 0, "主人公不能替劇作家打牌（實際：" + (errOwn.msg || "") + "）");

    // ---- 手動模式：結算暫停 + 推進權限歸劇作家 ----
    {
      const c4 = await new TestClient().connect();
      const c5 = await new TestClient().connect();
      c4.send("create", { name: "房主2", avatar: "writer_1.png" });
      await c4.waitFor((m) => m.type === "welcome");
      const room2 = await c4.waitFor((m) => m.type === "room");
      c5.send("join", { room: room2.room.code, name: "玩家5", avatar: "hero_B.png" });
      await c5.waitFor((m) => m.type === "welcome");
      await sleep(250);
      const w4p = (await c4.waitFor((m) => m.type === "room")).room.players;
      const p4 = w4p[0].id;
      const p5 = (await c5.waitFor((m) => m.type === "room")).room.players.find((p) => p.id !== p4).id;
      c4.send("assign", { slot: "mm", playerId: p4 });
      c4.send("assign", { slot: "a", playerId: p5 });
      c4.send("assign", { slot: "b", playerId: p5 });
      c4.send("assign", { slot: "c", playerId: p5 });
      await sleep(250);
      c4.send("select_script", { presetId: "the_first_script" });
      await sleep(150);
      c4.send("start");
      await c4.waitView((m) => m.phase === "day_start");
      assert(true, "手動模式測試：房間2開始");

      // 開啟手動模式
      c4.send("action", { action: "mmManualEnable", enabled: true });
      const v4b = await c4.waitView((m) => m.mmManual === true);
      assert(v4b.manualArmed === false, "手動模式已開啟（manualArmed 初始 false）");

      // 推進開始本日（手動模式下 day_start 也由劇作家）
      c4.send("action", { action: "nextStep" });
      await c4.waitView((m) => m.phase === "mm_play");
      assert(true, "手動模式下劇作家推進開始本日");

      // 劇作家打牌並確認
      c4.send("action", { action: "mmPlayCard", card: "m_intrigue_plus1", targetType: "char", targetId: "girl_student" });
      c4.send("action", { action: "mmPlayCard", card: "m_paranoia_plus", targetType: "char", targetId: "boy_student" });
      c4.send("action", { action: "mmPlayCard", card: "m_move_h", targetType: "char", targetId: "police_officer" });
      await c4.waitView((m) => (m.mmPlays || []).length === 3);
      c4.send("action", { action: "confirmMMPlays" });
      await c4.waitView((m) => m.phase === "p_play");

      // 主人公出牌（P5 打 A/B/C 三張）
      c5.send("action", { action: "pPlayCard", deck: 0, card: "p_goodwill_plus1", targetType: "char", targetId: "shrine_maiden" });
      c5.send("action", { action: "pPlayCard", deck: 1, card: "p_goodwill_plus1", targetType: "char", targetId: "office_worker" });
      c5.send("action", { action: "pPlayCard", deck: 2, card: "p_paranoia_plus", targetType: "char", targetId: "boy_student" });
      await c5.waitView((m) => (m.pPlays || []).length === 3);

      // 确认打出始终由主人公操作（手动模式也不例外）：剧作家不能代确认
      c4.send("action", { action: "confirmPPlays", deck: 0 });
      const errMMConfirm = await c4.waitFor((m) => m.type === "error" && m.msg && m.msg.indexOf("你不是主人公") >= 0);
      assert(errMMConfirm.msg && errMMConfirm.msg.indexOf("你不是主人公") >= 0, "手動模式下劇作家不能代主人公確認打出（實際：" + (errMMConfirm.msg || "") + "）");
      // 主人公 c5 确认 A/B/C
      c5.send("action", { action: "confirmPPlays", deck: 0 });
      await c5.waitView((m) => m.pConfirmed && m.pConfirmed[0] === true);
      c5.send("action", { action: "confirmPPlays", deck: 1 });
      c5.send("action", { action: "confirmPPlays", deck: 2 });
      const vAllP2 = await c5.waitView((m) => m.allPConfirmed === true);
      assert(vAllP2.allPConfirmed === true, "主人公確認三位主人公（手動模式也不例外）");

      // 掀開所有卡牌（手動模式 → 停在手動結算，不自動結算；卡面公開）
      c4.send("action", { action: "revealAll" });
      const vReveal = await c4.waitView((m) => m.phase === "resolve" && m.revealed === true);
      assert(vReveal.revealed === true && vReveal.phase === "resolve", "手動模式掀開後停在手動結算（不自動結算）");
      const c5Reveal = await c5.waitView((m) => m.revealed === true);
      assert(c5Reveal.mmPlays.every((p) => p.card != null), "掀開後主人公也能看到劇作家的卡面");

      // 手動模式下主人公不能推進結算
      c5.send("action", { action: "finishResolve" });
      const errManualStep = await c5.waitFor((m) => m.type === "error" && m.msg && m.msg.indexOf("你不是劇作家") >= 0);
      assert(errManualStep.msg && errManualStep.msg.indexOf("你不是劇作家") >= 0, "手動模式下主人公不能推進結算（實際：" + (errManualStep.msg || "") + "）");

      // 劇作家「進入劇作家能力階段」→ 真正結算
      c4.send("action", { action: "finishResolve" });
      const settlePrompt = await c4.waitFor((m) => m.type === "prompt");
      c4.send("prompt_reply", { id: settlePrompt.id, value: 0 });
      const vDone = await c4.waitView((m) => m.phase === "mm_abilities");
      assert(vDone.phase === "mm_abilities", "手動模式：劇作家結算完成進入能力階段");
      assert(vDone.chars.boy_student.paranoia >= 2, "結算結果生效（男學生不安+2）");

      // 關閉手動模式後恢復原規則（goodwill 歸隊長）；此處僅驗證開關可重置
      c4.send("action", { action: "mmManualEnable", enabled: false });
      await c4.waitView((m) => m.mmManual === false && m.phase === "mm_abilities");
      assert(true, "關閉手動模式成功");

      // 友好能力請求：手動模式下劇作家收到請求 → 同意 → 手動結算 → 主人公繼續
      c4.send("action", { action: "mmManualEnable", enabled: true });
      await c4.waitView((m) => m.mmManual === true);
      // 劇作家手動給女學生加友好，使其可用友好能力
      c4.send("action", { action: "mmManualSet", charId: "girl_student", goodwill: 2 });
      await c4.waitView((m) => m.chars.girl_student && m.chars.girl_student.goodwill === 2);
      // 結束劇作家能力 → 進入友好能力階段（隊長 A = c5）
      c4.send("action", { action: "nextStep" });
      await c4.waitView((m) => m.phase === "goodwill");
      // 主人公（c5）發起友好能力請求
      c5.send("action", {
        action: "execGoodwill",
        chosen: { charId: "girl_student", abilityIdx: 0, ability: { cost: 2, target: "student", effect: "paranoia_minus", desc: "同一區域另外1名學生不安－1" } },
        target: { type: "char", id: "boy_student" }
      });
      const gwPrompt = await c4.waitFor((m) => m.type === "prompt" && m.kind === "gw_request");
      assert(gwPrompt.detail && gwPrompt.detail.who === "女學生" && gwPrompt.canRefuse === true, "劇作家收到友好能力請求（含詳細與可拒絕）");
      c4.send("prompt_reply", { id: gwPrompt.id, value: "agree" });
      const vGwManual = await c4.waitView((m) => m.gwManualPending === true);
      assert(vGwManual.gwManualPending === true, "手動模式：劇作家同意後進入手動結算");
      // 劇作家「主人公繼續」歸還權限
      c4.send("action", { action: "gwContinue" });
      await c4.waitView((m) => m.gwManualPending === false);
      assert(true, "主人公繼續，權限歸還");

      // 结束友好能力归队长（主人公）：剧作家不能推进，队长可推进
      c4.send("action", { action: "nextStep" });
      const errGwStep = await c4.waitFor((m) => m.type === "error" && m.msg && m.msg.indexOf("不是由你操作") >= 0);
      assert(errGwStep.msg && errGwStep.msg.indexOf("不是由你操作") >= 0, "結束友好能力歸隊長，劇作家不能推進（實際：" + (errGwStep.msg || "") + "）");
      c5.send("action", { action: "nextStep" });
      await c5.waitView((m) => m.phase === "incident");
      assert(true, "隊長結束友好能力進入事件階段");

      // 手动模式：事件阶段不自动结算（准备 → 开始 → 直接推进到夜晚）
      c4.send("action", { action: "nextStep" });
      await c4.waitView((m) => m.manualArmed === true && m.phase === "incident");
      c4.send("action", { action: "nextStep" });
      await c4.waitView((m) => m.phase === "day_end");
      assert(true, "手動模式事件階段跳過自動結算");
      // 手动模式：夜晚阶段不自动结算 → 下一日
      c4.send("action", { action: "nextStep" });
      await c4.waitView((m) => m.manualArmed === true && m.phase === "day_end");
      c4.send("action", { action: "nextStep" });
      await c4.waitView((m) => m.phase === "day_start");
      assert(true, "手動模式夜晚階段跳過自動結算");

      // 手動模式：劇作家宣告主人公死亡 → 開啟下一輪迴
      c4.send("action", { action: "mmManualEnable", enabled: true });
      await c4.waitView((m) => m.mmManual === true);
      c4.send("action", { action: "mmDeclareLose", loseType: "death" });
      const vLose = await c4.waitView((m) => m.loseCause === "death" && m.nextLoopPending === true);
      assert(vLose.phase === "loop_end" && vLose.loseCause === "death" && vLose.nextLoopPending, "劇作家宣告死亡→開啟下一輪迴");
      const c5Lose = await c5.waitView((m) => m.loseCause === "death");
      assert(c5Lose.loseCause === "death", "主人公被告知死亡");
    }

    // ---- 最终决战：待命 → 猜测（团队共享）→ 显示结果 ----
    {
      const c8 = await new TestClient().connect();
      const c9 = await new TestClient().connect();
      c8.send("create", { name: "房主3", avatar: "writer_1.png" });
      await c8.waitFor((m) => m.type === "welcome");
      const room3 = await c8.waitFor((m) => m.type === "room");
      c9.send("join", { room: room3.room.code, name: "玩家9", avatar: "hero_A.png" });
      await c9.waitFor((m) => m.type === "welcome");
      await sleep(250);
      const rp8 = (await c8.waitFor((m) => m.type === "room")).room.players;
      const p8 = rp8[0].id;
      const p9 = (await c9.waitFor((m) => m.type === "room")).room.players.find((p) => p.id !== p8).id;
      c8.send("assign", { slot: "mm", playerId: p8 });
      c8.send("assign", { slot: "a", playerId: p9 });
      c8.send("assign", { slot: "b", playerId: p9 });
      c8.send("assign", { slot: "c", playerId: p9 });
      await sleep(250);
      const fgScript = {
        id: "fg", moduleId: "MC", title: "FG測試", creator: "t", loops: 2, days: 2, tableTalk: true,
        mainPlot: "quilt_of_incidents", subplots: ["dance_of_fools", "an_absolute_will"], allowFinalGuess: true,
        cast: [
          { characterId: "girl_student", role: "key_person", startLoc: "school" },
          { characterId: "rich_man's_daughter", role: "key_person", startLoc: "school" },
          { characterId: "boy_student", role: "poisoner", startLoc: "school" },
          { characterId: "shrine_maiden", role: "brain", startLoc: "shrine" },
          { characterId: "class_rep", role: "brain", startLoc: "school" },
          { characterId: "police_officer", role: "fool", startLoc: "city" },
          { characterId: "office_worker", role: "obstinate", startLoc: "city" },
          { characterId: "doctor", role: null, startLoc: "hospital" }
        ],
        incidents: [{ day: 1, incidentId: "murder", culpritId: "office_worker" }], specialRules: "", publicSpecialRules: ""
      };
      c8.send("select_script", { script: fgScript });
      await sleep(150);
      c8.send("start");
      await c8.waitView((m) => m.phase === "day_start");
      // 连续宣告失败至最终轮回
      c8.send("action", { action: "mmDeclareLose", loseType: "fail" });
      await c8.waitView((m) => m.nextLoopPending === true);
      c8.send("action", { action: "nextStep" });
      await c8.waitView((m) => m.phase === "day_start");
      c8.send("action", { action: "mmDeclareLose", loseType: "fail" });
      const vPending = await c8.waitView((m) => m.phase === "final_guess_pending");
      assert(vPending.phase === "final_guess_pending", "最終輪迴失敗後進入最終決戰待命");

      // 队长（主人公A = c9）点击“最终决战”
      c9.send("action", { action: "beginFinalGuess" });
      await c9.waitView((m) => m.phase === "final_guess");
      assert(true, "進入最終決戰猜測階段");

      // 主人公设置猜测（团队共享，同步）；剧作家不能猜测
      c9.send("action", { action: "finalGuessSet", cid: "girl_student", rid: "key_person" });
      await c9.waitView((m) => m.finalGuess && m.finalGuess.selections && m.finalGuess.selections.girl_student === "key_person");
      c8.send("action", { action: "finalGuessSet", cid: "boy_student", rid: "key_person" });
      const errFgSet = await c8.waitFor((m) => m.type === "error" && m.msg && m.msg.indexOf("劇作家不可以猜測") >= 0);
      assert(errFgSet.msg && errFgSet.msg.indexOf("劇作家不可以猜測") >= 0, "劇作家不可以猜測");

      // 三位主人公确认猜测
      c9.send("action", { action: "finalGuessConfirm", deck: 0 });
      c9.send("action", { action: "finalGuessConfirm", deck: 1 });
      c9.send("action", { action: "finalGuessConfirm", deck: 2 });
      await c9.waitView((m) => m.finalGuess && m.finalGuess.confirmed[0] && m.finalGuess.confirmed[1] && m.finalGuess.confirmed[2]);
      assert(true, "三位主人公確認猜測");

      // 剧作家显示最终结果
      c8.send("action", { action: "finalGuessReveal" });
      const vResult = await c8.waitView((m) => m.phase === "final_result");
      assert(vResult.ended === "win" || vResult.ended === "lose", "最終結果已顯示");
      const c9Result = await c9.waitView((m) => m.phase === "final_result");
      assert(c9Result.roles.girl_student === "key_person" && c9Result.roles.boy_student === "poisoner", "主人公在最終結果看到真實身份（秘密公開）");
    }

    console.log(failures === 0 ? "\n多人聯機測試全部通過 ✓" : "\n有 " + failures + " 項失敗 ✗");
    process.exit(failures === 0 ? 0 : 1);
  } catch (e) {
    console.error("測試異常:", e);
    process.exit(1);
  } finally {
    if (proc) proc.kill();
  }
})();
