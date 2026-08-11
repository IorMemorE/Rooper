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
    c1.send("start");
    const v1 = await c1.waitView();
    const v2 = await c2.waitView();
    const v3 = await c3.waitView();
    assert(v1.script.mainPlot === "murder_plan", "劇作家收到完整劇本（含主規則）");
    assert(v2.script.mainPlot === undefined, "主人公收到公開劇本（不含主規則）");
    assert(v1.phase === "day_start", "遊戲從早晨開始");

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
    assert(v2c.pPlays.find((p) => p.deck === 2).card === null, "P2 看不到主人公C的牌");
    assert(v3c.pPlays.find((p) => p.deck === 2).card === "p_paranoia_plus", "P3 看到自己（C）的牌");
    assert(v3c.pPlays.find((p) => p.deck === 0).card === null && v3c.pPlays.find((p) => p.deck === 1).card === null, "P3 看不到主人公A/B的牌");
    assert(!!v2c.used.p0 && !!v2c.used.p1 && !v2c.used.p2, "P2 只拿到自己的牌組狀態（A+B）");
    // 確認主人公行動（若偶發時序競爭則重試）
    let confirmed = false;
    for (let i = 0; i < 5 && !confirmed; i++) {
      c2.send("action", { action: "confirmPPlays" });
      await sleep(250);
      if (c2.msgs.some((m) => m.type === "view" && m.phase === "resolve")) confirmed = true;
    }
    assert(confirmed, "主人公確認打出成功");

    // 結算：P1 按翻牌 → 移動方向提示路由給 P1
    c1.send("action", { action: "nextStep" });
    const prompt = await c1.waitFor((m) => m.type === "prompt");
    assert(prompt.kind === "choice" && prompt.title === "移動方向", "移動方向提示發給劇作家");
    c1.send("prompt_reply", { id: prompt.id, value: 0 });
    const v1d = await c1.waitView((m) => m.chars.girl_student && m.chars.girl_student.intrigue === 1);
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

    console.log(failures === 0 ? "\n多人聯機測試全部通過 ✓" : "\n有 " + failures + " 項失敗 ✗");
    process.exit(failures === 0 ? 0 : 1);
  } catch (e) {
    console.error("測試異常:", e);
    process.exit(1);
  } finally {
    if (proc) proc.kill();
  }
})();
