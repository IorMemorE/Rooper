// 悲劇輪迴 多人聯機伺服器（房主制 + 伺服器權威引擎）
// 啟動：node server/multiplayer.js [port]
const http = require("http");
const fs = require("fs");
const path = require("path");
const { WebSocketServer } = require("./ws");

const GAME_ROOT = path.join(__dirname, "..", "game");
const PORT = parseInt(process.argv[2] || process.env.PORT || "8360", 10);

// ---- 載入遊戲引擎（window shim） ----
global.window = global;
global.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
global.document = { documentElement: { lang: "" }, querySelectorAll() { return []; } };
global.CustomEvent = function () {};
const DATA_FILES = [
  "js/data/characters.js",
  "js/data/roles.js",
  "js/data/plots.js",
  "js/data/incidents.js",
  "js/data/cards.js",
  "js/data/modules.js",
  "js/data/presets.js",
  "js/data/i18n.js",
  "js/core/util.js",
  "js/core/engine.js",
  "js/core/state.js",
  "js/core/helpers.js",
  "js/core/cards.js",
  "js/core/incidents.js",
  "js/core/abilities.js",
  "js/core/abilities-goodwill.js",
  "js/core/phases.js",
  "js/core/death.js",
  "js/core/final.js"
];
DATA_FILES.forEach(function (f) {
  eval(fs.readFileSync(path.join(GAME_ROOT, f), "utf8"));
});

// ---- 靜態檔案服務 ----
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".pdf": "application/pdf",
  ".json": "application/json"
};
const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split("?")[0]);
  if (urlPath === "/") urlPath = "/index.html";
  const filePath = path.normalize(path.join(GAME_ROOT, urlPath));
  if (!filePath.startsWith(GAME_ROOT)) { res.writeHead(403); res.end(); return; }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end("not found"); return; }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  });
});

const SLOT_DECK = { a: 0, b: 1, c: 2 };
const DECK_SLOT = { 0: "a", 1: "b", 2: "c" };
const SLOT_NAMES = { mm: "劇作家", a: "主人公A", b: "主人公B", c: "主人公C" };

const rooms = new Map();
const clients = new Map(); // conn -> { id, name, avatar, room, conn }

function uid() {
  return "p" + Math.random().toString(36).slice(2, 10);
}
function roomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code;
  do {
    code = "";
    for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  } while (rooms.has(code));
  return code;
}
function send(conn, msg) {
  if (conn) conn.send(JSON.stringify(msg));
}
function publicRoom(room) {
  return {
    code: room.code,
    hostId: room.hostId,
    started: room.started,
    scriptTitle: room.script ? room.script.title : null,
    script: room.script ? publicScript(room.script) : null,
    seeTeammateCards: !!room.seeTeammateCards,
    leaderStart: room.leaderStart || 0,
    players: room.players.map(function (p) {
      return { id: p.id, name: p.name, avatar: p.avatar, slots: p.slots, online: !!p.conn };
    })
  };
}
function broadcastRoom(room) {
  const pr = publicRoom(room);
  room.players.forEach(function (p) { send(p.conn, { type: "room", room: pr }); });
}

function publicScript(script) {
  return {
    id: script.id,
    moduleId: script.moduleId,
    title: script.title,
    creator: script.creator,
    loops: script.loops,
    days: script.days,
    tableTalk: script.tableTalk,
    incidents: script.incidents,
    cast: (script.cast || []).map(function (e) { return { characterId: e.characterId }; }),
    specialRules: script.specialRules || "",
    note: script.note || ""
  };
}

function buildView(room, player) {
  const g = room.game;
  const st = g.state;
  const isMM = player.slots.indexOf("mm") >= 0;
  const ownedDecks = player.slots.filter(function (s) { return s !== "mm"; }).map(function (s) { return SLOT_DECK[s]; });
  const chars = {};
  const roles = {};
  Object.keys(st.chars).forEach(function (id) {
    const c = st.chars[id];
    chars[id] = {
      loc: c.loc, alive: c.alive, paranoia: c.paranoia, goodwill: c.goodwill,
      intrigue: c.intrigue, guard: c.guard, hope: c.hope, despair: c.despair,
      perished: c.perished, acquainted: c.acquainted, acquaintedRefused: c.acquaintedRefused,
      loyaltyOn: c.loyaltyOn, roleRevealed: c.roleRevealed
    };
    roles[id] = isMM || c.roleRevealed ? c.role : null;
  });
  const used = {};
  if (isMM) used.mm = st.used.mm;
  ownedDecks.forEach(function (d) { used["p" + d] = st.used["p" + d]; });
  return {
    type: "view",
    seq: room.seq++,
    phase: st.phase,
    day: st.day,
    loop: st.loop,
    leader: st.leader,
    ended: st.ended,
    nextLoopPending: !!st.nextLoopPending,
    mmManual: !!room.mmManual,
    manualArmed: !!room.manualArmed,
    seeTeammateCards: !!room.seeTeammateCards,
    leaderStart: room.leaderStart || 0,
    pConfirmed: st.pConfirmed || {},
    allPConfirmed: !!st.allPConfirmed,
    revealed: !!st.revealed,
    resolveDone: !!st.resolveDone,
    loseCause: st.loseCause || null,
    gwManualPending: !!room.gwManualPending,
    chars: chars,
    locations: {
      hospital: st.locations.hospital.intrigue,
      shrine: st.locations.shrine.intrigue,
      city: st.locations.city.intrigue,
      school: st.locations.school.intrigue
    },
    mmPlays: (isMM || st.revealed) ? st.mmPlays : st.mmPlays.map(function (p) { return { card: null, targetType: p.targetType, targetId: p.targetId, owner: "mm" }; }),
    pPlays: st.pPlays.map(function (p) {
      return (st.revealed || (!isMM && ownedDecks.indexOf(p.deck) >= 0) || room.seeTeammateCards)
        ? p
        : { card: null, player: p.player, deck: p.deck, targetType: p.targetType, targetId: p.targetId, owner: "p" };
    }),
    used: used,
    usedGoodwill: st.usedGoodwill,
    usedGoodwillDay: st.usedGoodwillDay,
    usedMMAbility: isMM ? st.usedMMAbility : {},
    mmHandExtra: isMM ? (st.mmHandExtra || []) : [],
    pHandExtra: (function () {
      const out = {};
      ownedDecks.forEach(function (d) {
        if (st.pHandExtra && st.pHandExtra["p" + d]) out[d] = st.pHandExtra["p" + d].slice();
      });
      return out;
    })(),
    exGauge: st.exGauge,
    plotFlags: isMM ? st.plotFlags : {},
    feed: st.feed,
    log: st.log,
    roles: roles,
    incidentHistory: isMM
      ? st.incidentHistory
      : st.incidentHistory.map(function (h) { return { day: h.day, loop: h.loop, incidentId: h.incidentId, happened: h.happened }; }),
    script: (isMM || st.phase === "final_result") ? room.script : publicScript(room.script),
    protagonistCount: 3,
    slots: player.slots,
    finalGuess: st.finalGuess,
    guessRoles: (st.phase === "final_guess" || st.phase === "final_guess_pending" || st.phase === "final_result")
      ? TL.rolesFromScript(room.script)
      : null
  };
}

function broadcastViews(room) {
  room.players.forEach(function (p) {
    if (p.conn) send(p.conn, buildView(room, p));
  });
}

function playerOfSlot(room, slot) {
  return room.players.find(function (p) { return p.slots.indexOf(slot) >= 0; }) || null;
}

function routePrompt(room, q, kind) {
  return new Promise(function (resolve) {
    const toMM = kind === "confirm" || kind === "gw_request" || room.promptIsMastermind;
    let player = toMM ? playerOfSlot(room, "mm") : (room.promptPlayer || playerOfSlot(room, "mm"));
    if (!player) player = room.players[0] || null;
    if (!player || !player.conn) {
      // 提示對象離線：自動選取預設值
      resolve(kind === "confirm" ? false : (kind === "choice" ? 0 : null));
      return;
    }
    const promptId = "p" + (++room.promptSeq);
    room.prompts.set(promptId, { resolve: resolve, playerId: player.id, kind: kind });
    send(player.conn, {
      type: "prompt", id: promptId, kind: kind,
      title: q.title || "", text: q.text || "",
      options: q.options || null, targets: q.targets || null,
      detail: q.detail || null, canRefuse: q.canRefuse, canAgree: q.canAgree, manual: q.manual
    });
  });
}

function makeServerIO(room) {
  return {
    log: function () {},
    askChoice: function (q) { return routePrompt(room, q, "choice"); },
    askTarget: function (q) { return routePrompt(room, q, "target"); },
    confirm: function (q) { return routePrompt(room, q, "confirm"); }
  };
}

async function startGame(room, script) {
  const v = TL.validateScript(script);
  if (v.errors.length) return { ok: false, msg: "劇本不合法：" + v.errors.join("；") };
  room.script = script;
  room.game = new TL.Game(script, { protagonists: 3, io: makeServerIO(room), onlineMode: true });
  room.game.uiManaged = true; // 能力階段由各客戶端面板驅動
  room.started = true;
  room.promptSeq = 0;
  room.prompts = new Map();
  await room.game.startGame();
  return { ok: true };
}

// ---- 動作處理（含所有權檢查） ----
async function handleAction(room, player, msg) {
  const g = room.game;
  if (!g) return { ok: false, msg: "遊戲尚未開始" };
  const st = g.state;
  const mmPlayer = playerOfSlot(room, "mm");
  const err = function (m) { return { ok: false, msg: m }; };
  try {
    switch (msg.action) {
      case "mmPlayCard": {
        if (player.slots.indexOf("mm") < 0) return err("你不是劇作家");
        if (st.phase !== "mm_play") return err("當前不是劇作家行動階段");
        const r = g.mmPlayCard(msg.card, msg.targetType, msg.targetId);
        return r.ok ? { ok: true } : err(r.msg || "打牌失敗");
      }
      case "mmRemovePlay": {
        if (player.slots.indexOf("mm") < 0 || st.phase !== "mm_play") return err("不可移除");
        g.mmRemovePlay(msg.idx);
        return { ok: true };
      }
      case "confirmMMPlays": {
        if (player.slots.indexOf("mm") < 0 || st.phase !== "mm_play") return err("你不是劇作家");
        const r = g.confirmMMPlays();
        return r.ok ? { ok: true } : err(r.msg || "確認失敗");
      }
      case "pPlayCard": {
        const deck = msg.deck;
        if (player.slots.indexOf(DECK_SLOT[deck]) < 0) return err("你不是主人公" + ["A", "B", "C"][deck]);
        if (st.phase !== "p_play") return err("當前不是主人公行動階段");
        const r = g.pPlayCard(deck, deck, msg.card, msg.targetType, msg.targetId);
        return r.ok ? { ok: true } : err(r.msg || "打牌失敗");
      }
      case "pRemovePlay": {
        const pl = st.pPlays[msg.idx];
        if (!pl || player.slots.indexOf(DECK_SLOT[pl.deck]) < 0 || st.phase !== "p_play") return err("不可移除");
        g.pRemovePlay(msg.idx);
        return { ok: true };
      }
      case "confirmPPlays": {
        // 联机：分人确认。每个主人公点击“确认打出”结束自己的阶段（从队长开始由客户端引导）
        const deck = msg.deck != null ? msg.deck : st.leader;
        // 确认打出始终由主人公自己操作（手动模式也不例外）
        if (player.slots.indexOf(DECK_SLOT[deck]) < 0) {
          return err("你不是主人公" + ["A", "B", "C"][deck]);
        }
        const r = g.confirmPPlayByPlayer(deck);
        return r.ok ? { ok: true } : err(r.msg || "確認失敗");
      }
      case "revealAll": {
        if (player.slots.indexOf("mm") < 0) return err("你不是劇作家");
        const r = await g.revealPlays(!!room.mmManual);
        return r.ok ? { ok: true } : err(r.msg || "掀開失敗");
      }
      case "finishResolve": {
        if (player.slots.indexOf("mm") < 0) return err("你不是劇作家");
        const r = await g.finishResolve();
        return r.ok ? { ok: true } : err(r.msg || "推進失敗");
      }
      case "mmDeclareLose": {
        if (player.slots.indexOf("mm") < 0) return err("你不是劇作家");
        const r = g.declareLose(msg.loseType || msg.type);
        return r.ok ? { ok: true } : err(r.msg || "宣告失敗");
      }
      case "beginFinalGuess": {
        if (player.slots.indexOf(DECK_SLOT[st.leader]) < 0) return err("你不是現任隊長");
        const r = g.beginFinalGuess();
        return r.ok ? { ok: true } : err(r.msg || "進入最終決戰失敗");
      }
      case "finalGuessSet": {
        if (player.slots.indexOf("mm") >= 0) return err("劇作家不可以猜測");
        const r = g.finalGuessSet(msg.cid, msg.rid);
        return r.ok ? { ok: true } : err(r.msg || "設定猜測失敗");
      }
      case "finalGuessConfirm": {
        const deck = msg.deck != null ? msg.deck : st.leader;
        if (player.slots.indexOf(DECK_SLOT[deck]) < 0) return err("你不是主人公" + ["A", "B", "C"][deck]);
        const r = g.finalGuessConfirm(deck);
        return r.ok ? { ok: true } : err(r.msg || "確認猜測失敗");
      }
      case "finalGuessReveal": {
        if (player.slots.indexOf("mm") < 0) return err("你不是劇作家");
        const r = g.finalGuessReveal();
        return r.ok ? { ok: true } : err(r.msg || "顯示結果失敗");
      }
      case "nextStep": {
        if (st.phase === "mm_play" || st.phase === "p_play") {
          return err("打牌階段請使用「確認打出」");
        }
        const isMM = player.slots.indexOf("mm") >= 0;
        let ownerOk;
        // 结束友好能力始终归队长（主人公）；其余推进/结算归剧作家
        ownerOk = (st.phase === "goodwill")
          ? (player.slots.indexOf(DECK_SLOT[st.leader]) >= 0)
          : isMM;
        if (!ownerOk) return err("當前階段不是由你操作");
        // 手動模式：結算類階段需要「準備 → 開始」兩步，避免自動結算
        const settlePhase = st.phase === "resolve" || st.phase === "incident" ||
          st.phase === "day_end" || st.phase === "loop_end";
        if (room.mmManual && settlePhase && !room.manualArmed) {
          room.manualArmed = true;
          broadcastViews(room);
          return { ok: true, manualArmed: true };
        }
        room.manualArmed = false;
        // 手动模式：事件/夜晚阶段不自动结算，由剧作家手动调整盘面后直接推进
        if (room.mmManual && (st.phase === "incident" || st.phase === "day_end")) {
          g._log(TL.L("manualSettleSkipped", { phase: st.phase === "incident" ? TL.t("game.phase.incident") : TL.t("game.phase.day_end") }) ||
            ("（手動模式）" + (st.phase === "incident" ? "事件" : "夜晚") + "由劇作家手動結算，已跳過自動結算。"));
          if (st.phase === "incident") {
            st.phase = "day_end";
          } else if (st.day >= g.script.days) {
            st.phase = "loop_end";
          } else {
            st.day += 1;
            g._updateOnStage(st.loop, st.day);
            st.phase = "day_start";
          }
          return { ok: true };
        }
        room.promptPlayer = player;
        room.promptIsMastermind = true;
        await g.nextStep();
        return { ok: true };
      }
      case "execMMAbility": {
        if (player.slots.indexOf("mm") < 0) return err("你不是劇作家");
        room.promptPlayer = player;
        room.promptIsMastermind = false;
        await g.execMMAbility(msg.entry, msg.target || null);
        return { ok: true };
      }
      case "execGoodwill": {
        if (player.slots.indexOf(DECK_SLOT[st.leader]) < 0) return err("你不是現任隊長");
        const chosen = msg.chosen;
        const data = CHAR_INDEX[chosen.charId];
        const ab = (data.goodwill || [])[chosen.abilityIdx];
        if (!data || !ab) return err("友好能力不存在");
        const refusal = g._refusalOf(chosen.charId);
        const canRefuse = !ab.cannotBeRefused && refusal !== "mandatory";
        const canAgree = refusal !== "mandatory";
        const tgt = msg.target || null;
        const detail = {
          who: g._charName(chosen.charId),
          role: st.chars[chosen.charId].role ? g._role(chosen.charId).name : TL.t("basic.commoner"),
          desc: ab.desc,
          target: tgt ? (tgt.type === "location" ? g._locName(tgt.id) : g._charName(tgt.id)) : ""
        };
        // 友好能力请求必须询问剧作家（即使不能拒绝）
        room.promptPlayer = player;
        room.promptIsMastermind = true;
        const reply = await routePrompt(room, {
          title: TL.L("gwRequestTitle") || "友好能力請求",
          text: TL.L("gwRequestText", { who: detail.who, desc: detail.desc }) || (detail.who + " 請求使用友好能力：" + detail.desc),
          detail: detail, canRefuse: canRefuse, canAgree: canAgree, manual: !!room.mmManual
        }, "gw_request");
        if (reply === "refuse") {
          if (!canRefuse && !room.mmManual) return err("劇作家不能拒絕此能力");
          g.markGoodwillDeclared(chosen, true);
          g._log(TL.L("gwRefusedByMM", { who: detail.who }) || ("【拒絕】劇作家拒絕了" + detail.who + "的友好能力。"));
          return { ok: true };
        }
        // 同意
        if (!canAgree && !room.mmManual) return err("劇作家不能同意此能力");
        if (room.mmManual) {
          // 手动模式：标记已使用，权限转移给剧作家手动结算，等待「主人公继续」
          g.markGoodwillDeclared(chosen, false);
          g._log(TL.L("gwManualSettle", { who: detail.who }) || ("【友好能力】劇作家同意" + detail.who + "的請求，進入手動結算。"));
          room.gwManualPending = true;
          broadcastViews(room);
          return { ok: true };
        }
        room.promptPlayer = player;
        room.promptIsMastermind = false;
        await g.execGoodwill(chosen, "p" + st.leader, tgt);
        return { ok: true };
      }
      case "gwContinue": {
        if (player.slots.indexOf("mm") < 0) return err("你不是劇作家");
        room.gwManualPending = false;
        broadcastViews(room);
        return { ok: true };
      }
      case "finalGuess": {
        if (player.slots.indexOf(DECK_SLOT[st.leader]) < 0) return err("你不是現任隊長");
        const r = await g.finalGuess(msg.cid, msg.rid);
        return r.ok ? { ok: true } : err(r.msg || "猜測失敗");
      }
      case "mmManualEnable": {
        if (player.slots.indexOf("mm") < 0) return err("你不是劇作家");
        room.mmManual = !!msg.enabled;
        if (!room.mmManual) room.manualArmed = false;
        broadcastViews(room);
        return { ok: true };
      }
      case "mmManualSet": {
        if (player.slots.indexOf("mm") < 0) return err("你不是劇作家");
        if (!room.mmManual) return err("劇作家手動模式未開啟");
        if (msg.locId != null) {
          // 地點編輯：調整版圖密謀
          const loc = st.locations[msg.locId];
          if (!loc) return err("版圖不存在");
          if (msg.intrigue != null) loc.intrigue = Math.max(0, Math.min(99, Math.round(msg.intrigue)));
        } else {
          const c = st.chars[msg.charId];
          if (!c) return err("角色不存在");
          if (msg.loc != null) {
            if (!LOC_INDEX[msg.loc]) return err("版圖不存在");
            c.loc = msg.loc;
          }
          if (msg.paranoia != null) c.paranoia = Math.max(0, Math.min(99, Math.round(msg.paranoia)));
          if (msg.goodwill != null) c.goodwill = Math.max(0, Math.min(99, Math.round(msg.goodwill)));
          if (msg.intrigue != null) c.intrigue = Math.max(0, Math.min(99, Math.round(msg.intrigue)));
          if (msg.guard != null) c.guard = Math.max(0, Math.min(5, Math.round(msg.guard)));
          if (msg.hope != null) c.hope = Math.max(0, Math.min(5, Math.round(msg.hope)));
          if (msg.despair != null) c.despair = Math.max(0, Math.min(5, Math.round(msg.despair)));
          if (typeof msg.alive === "boolean") c.alive = msg.alive;
        }
        broadcastViews(room);
        return { ok: true };
      }
      default:
        return err("未知動作：" + msg.action);
    }
  } catch (e) {
    return { ok: false, msg: "伺服器錯誤：" + e.message };
  } finally {
    room.promptPlayer = null;
    room.promptIsMastermind = false;
  }
}

function handleJoin(conn, data, client) {
  const room = rooms.get(data.room);
  if (!room) {
    console.log("[join] 房間不存在", data.room);
    return send(conn, { type: "error", msg: "房間不存在" });
  }
  if (room.deadline) { clearTimeout(room.deadline); room.deadline = null; }
  console.log("[join]", data.name, data.room, data.playerId || "(new)");
  client.room = room;
  client.name = String(data.name || "玩家").slice(0, 12);
  client.avatar = data.avatar || randomAvatar();
  let player = null;
  if (data.playerId) {
    const old = room.players.find(function (p) { return p.id === data.playerId && p.name === client.name; });
    if (old) {
      if (old.conn && old.conn !== conn) { try { old.conn.close(); } catch (e) {} }
      old.conn = conn;
      old.name = client.name;
      old.avatar = client.avatar;
      player = old;
    }
  }
  if (!player) {
    if (room.players.length >= 4) return send(conn, { type: "error", msg: "房間已滿（最多4人）" });
    player = { id: uid(), name: client.name, avatar: client.avatar, slots: [], conn: conn };
    room.players.push(player);
  }
  client.id = player.id;
  clients.set(conn, client);
  send(conn, { type: "welcome", id: player.id, room: publicRoom(room) });
  if (room.chat && room.chat.length) {
    send(conn, { type: "chat_history", messages: room.chat.slice(-50) });
  }
  broadcastRoom(room);
  if (room.started && room.game) send(conn, buildView(room, player));
}

function randomAvatar() {
  const pool = [
    "writer_1.png", "writer_2.png", "hero_A.png", "hero_B.png", "hero_C.png",
    "chibi_W.png", "chibi_A1.png", "chibi_A2.png", "chibi_B1.png", "chibi_B2.png", "chibi_C1.png", "chibi_C2.png"
  ];
  return pool[Math.floor(Math.random() * pool.length)];
}

function handleCreate(conn, data, client) {
  const room = {
    code: roomCode(),
    hostId: null,
    players: [],
    script: null,
    game: null,
    started: false,
    seq: 1,
    promptSeq: 0,
    prompts: new Map(),
    promptPlayer: null,
    promptIsMastermind: false,
    mmManual: false,
    manualArmed: false,
    seeTeammateCards: false,
    leaderStart: 0,
    gwManualPending: false,
    chat: []
  };
  rooms.set(room.code, room);
  client.room = room;
  client.name = String(data.name || "房主").slice(0, 12);
  client.avatar = data.avatar || randomAvatar();
  const player = { id: uid(), name: client.name, avatar: client.avatar, slots: ["mm", "a", "b", "c"], conn: conn };
  room.players.push(player);
  room.hostId = player.id;
  client.id = player.id;
  clients.set(conn, client);
  send(conn, { type: "welcome", id: player.id, room: publicRoom(room) });
  broadcastRoom(room);
}

function resolveAllPromptsOf(room, playerId) {
  if (!room) return;
  room.prompts.forEach(function (p, id) {
    if (p.playerId === playerId) {
      room.prompts.delete(id);
      p.resolve(false);
    }
  });
}

const wsServer = new WebSocketServer(server, { path: "/ws" });
wsServer.onConnection = function (conn) {
  const client = { id: uid(), name: "玩家", avatar: randomAvatar(), room: null, conn: conn };
  clients.set(conn, client);
};
wsServer.onMessage = async function (conn, raw) {
  let msg;
  try { msg = JSON.parse(raw); } catch (e) { return; }
  const client = clients.get(conn);
  if (!client) return;
  try {
    await dispatch(msg, client, conn);
  } catch (e) {
    console.log("[dispatch] 錯誤:", e && e.stack || e);
  }
};
async function dispatch(msg, client, conn) {
  switch (msg.type) {
    case "create": handleCreate(conn, msg, client); break;
    case "join": handleJoin(conn, msg, client); break;
    case "chat": {
      if (!client.room || !msg.text) break;
      const text = String(msg.text).slice(0, 300);
      const entry = { from: client.name, avatar: client.avatar, text: text, ts: Date.now(), senderId: client.id };
      client.room.chat.push(entry);
      if (client.room.chat.length > 200) client.room.chat.splice(0, client.room.chat.length - 200);
      const out = { type: "chat", from: client.name, avatar: client.avatar, text: text, ts: entry.ts, senderId: client.id };
      client.room.players.forEach(function (p) { send(p.conn, out); });
      break;
    }
    case "assign": {
      const room = client.room;
      if (!room) break;
      if (room.hostId !== client.id) { send(conn, { type: "error", msg: "只有房主可以分配英雄" }); break; }
      const slot = msg.slot, targetId = msg.playerId || null;
      if (!SLOT_NAMES[slot]) break;
      const target = targetId ? room.players.find(function (p) { return p.id === targetId; }) : null;
      if (targetId && !target) break;
      // 互斥規則：劇作家與主人公不能同人
      if (slot === "mm") {
        if (target && target.slots.some(function (s) { return s !== "mm"; })) {
          send(conn, { type: "error", msg: "劇作家不可兼任主人公" });
          break;
        }
        room.players.forEach(function (p) {
          if (p.id === targetId) p.slots = targetId ? ["mm"] : [];
          else p.slots = p.slots.filter(function (s) { return s !== "mm"; });
        });
      } else {
        room.players.forEach(function (p) { p.slots = p.slots.filter(function (s) { return s !== slot; }); });
        if (target) {
          if (target.slots.indexOf("mm") >= 0) { send(conn, { type: "error", msg: "劇作家不可兼任主人公" }); break; }
          target.slots.push(slot);
        }
      }
      broadcastRoom(room);
      break;
    }
    case "avatar": {
      client.avatar = String(msg.avatar || randomAvatar());
      if (client.room) {
        const p = client.room.players.find(function (x) { return x.id === client.id; });
        if (p) p.avatar = client.avatar;
        broadcastRoom(client.room);
      }
      break;
    }
    case "select_script": {
      const room = client.room;
      if (!room || room.hostId !== client.id) break;
      const preset = PRESET_INDEX[msg.presetId];
      if (preset) room.script = TL.clone(preset);
      else if (msg.script && msg.script.cast) room.script = msg.script;
      broadcastRoom(room);
      break;
    }
    case "room_setting": {
      const room = client.room;
      if (!room || room.hostId !== client.id) { send(conn, { type: "error", msg: "只有房主可以修改設置" }); break; }
      if (typeof msg.seeTeammateCards === "boolean") room.seeTeammateCards = msg.seeTeammateCards;
      if (msg.leaderStart != null && [0, 1, 2].indexOf(msg.leaderStart) >= 0) room.leaderStart = msg.leaderStart;
      broadcastRoom(room);
      break;
    }
    case "start": {
      const room = client.room;
      if (!room || room.hostId !== client.id) { send(conn, { type: "error", msg: "只有房主可以開始遊戲" }); break; }
      const slots = [];
      room.players.forEach(function (p) { p.slots.forEach(function (s) { if (slots.indexOf(s) < 0) slots.push(s); }); });
      if (slots.indexOf("mm") < 0 || slots.indexOf("a") < 0 || slots.indexOf("b") < 0 || slots.indexOf("c") < 0) {
        send(conn, { type: "error", msg: "尚未分配全部英雄（劇作家＋主人公A/B/C）" });
        break;
      }
      if (!room.script) {
        // 預設使用第一個官方劇本
        room.script = TL.clone(PRESETS[0]);
      }
      room.script.leaderStart = room.leaderStart || 0;
      const r = await startGame(room, room.script);
      if (!r.ok) { send(conn, { type: "error", msg: r.msg }); break; }
      broadcastRoom(room);
      broadcastViews(room);
      break;
    }
    case "action": {
      const room = client.room;
      if (!room || !room.game) { send(conn, { type: "error", msg: "遊戲尚未開始" }); break; }
      const player = room.players.find(function (p) { return p.id === client.id; });
      if (!player) break;
      const r = await handleAction(room, player, msg);
      if (!r.ok) send(conn, { type: "error", msg: r.msg });
      broadcastViews(room);
      break;
    }
    case "prompt_reply": {
      const room = client.room;
      if (!room) break;
      const prompt = room.prompts.get(msg.id);
      if (!prompt) break;
      if (prompt.playerId !== client.id) { send(conn, { type: "error", msg: "此提示不是給你的" }); break; }
      room.prompts.delete(msg.id);
      prompt.resolve(msg.value);
      break;
    }
    case "ping":
      send(conn, { type: "pong" });
      break;
  }
}

wsServer.onClose = function (conn) {
  const client = clients.get(conn);
  clients.delete(conn);
  if (!client || !client.room) return;
  const room = client.room;
  const player = room.players.find(function (p) { return p.id === client.id; });
  if (player && player.conn === conn) player.conn = null;
  resolveAllPromptsOf(room, client.id);
  broadcastRoom(room);
  if (!room.players.some(function (p) { return p.conn; })) {
    // 寬限期：所有人短暫離線時保留房間（頁面跳轉/重連）
    if (room.deadline) clearTimeout(room.deadline);
    room.deadline = setTimeout(function () { rooms.delete(room.code); }, 60000);
  }
};

server.listen(PORT, function () {
  console.log("悲劇輪迴 多人伺服器已啟動: http://localhost:" + PORT);
  console.log("WebSocket: ws://localhost:" + PORT + "/ws");
});
