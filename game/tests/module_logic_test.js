// MC/MZ/WM 模組邏輯測試：Ex槽/Ex牌、事件結算、新身份能力、輪末/輪初條件
const fs = require("fs");
const path = require("path");

global.window = global;
global.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
global.document = { documentElement: { lang: "" }, querySelectorAll() { return []; } };
global.CustomEvent = function () {};

const root = path.join(__dirname, "..");
const files = [
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
  "js/core/final.js",
  "js/ai/ai.js",
  "js/ai/strategies.js"
];
for (const f of files) {
  eval(fs.readFileSync(path.join(root, f), "utf8"));
}

let failures = 0;
function assert(cond, msg) {
  if (!cond) {
    failures++;
    console.error("FAIL:", msg);
  }
}

function makeIO(logs) {
  return {
    log: function () {},
    askChoice: async function (q) { logs.push("CHOICE:" + (q.title || "") + " -> 0"); return 0; },
    askTarget: async function (q) { logs.push("TARGET:" + (q.title || "") + " -> " + (q.targets[0] ? q.targets[0].id : "none")); return q.targets[0] || null; },
    confirm: async function (q) { logs.push("CONFIRM:" + (q.title || "") + " -> false"); return false; },
    promptNumber: async function () { return 0; }
  };
}

// 構建自訂劇本：moduleId 指定模組；roleMap 覆蓋身份；其餘角色置為平民
function mk(moduleId, mainPlot, subplots, roleMap, incidents, extra) {
  const s = TL.defaultScript(moduleId);
  s.mainPlot = mainPlot;
  s.subplots = subplots || [];
  s.cast.forEach(function (e) {
    e.role = (roleMap && roleMap[e.characterId]) ? roleMap[e.characterId] : null;
  });
  if (!s.cast.some(function (e) { return e.role === "key_person"; })) {
    const first = s.cast.find(function (e) { return !e.role; });
    if (first) first.role = "key_person";
  }
  s.incidents = incidents || [];
  if (extra) Object.assign(s, extra);
  return s;
}

function roleChar(g, role) {
  return Object.keys(g.state.chars).find(function (id) { return g.state.chars[id].role === role; });
}

async function run() {
  // ---------- Ex 槽基礎 ----------
  {
    const g = new TL.Game(mk("MC", "quilt_of_incidents", []), { protagonists: 3, io: makeIO([]) });
    await g.startGame();
    g._addExGauge(2);
    assert(g.state.exGauge === 2, "Ex槽+2");
    assert(g.state.exGaugeIncreased, "Ex槽增加過");
    g._placeExCard("girl_student");
    assert(g._exCardChars().indexOf("girl_student") >= 0, "Ex牌已放置");
    // 跨輪迴保留 Ex槽、清空 Ex牌
    g.state.phase = "loop_end";
    g.state.ended = "lose";
    g.state.loop = 1;
    g.script.loops = 2;
    await g._loopEndPhase();
    assert(g.state.nextLoopPending === true, "失敗且有剩餘輪迴時停在輪迴結束等待下一輪");
    await g.nextStep();
    assert(g.state.loop === 2, "進入第2輪");
    assert(g.state.exGauge === 2, "Ex槽跨輪迴保留");
    assert(g._exCardChars().length === 0, "Ex牌每輪清空");
    assert(g.state.prevLoopExGauge === 2, "記錄上輪Ex槽");
  }

  // ---------- Ex牌阻擋主人公行動牌 / 永生者阻擋劇作家行動牌 ----------
  {
    const s = mk("MZ", "fated_connections", []);
    s.cast.forEach(function (e) { if (e.characterId === "class_rep") e.role = "immortal_role"; });
    const g = new TL.Game(s, { protagonists: 3, io: makeIO([]) });
    await g.startGame();
    g.state.phase = "mm_play";
    const imm = roleChar(g, "immortal_role");
    const r = g.mmPlayCard("m_paranoia_plus", "char", imm);
    assert(!r.ok, "永生者不可被劇作家設置行動牌");
    g.state.phase = "p_play";
    g._placeExCard("girl_student");
    const r2 = g.pPlayCard(0, 0, "p_goodwill_plus1", "char", "girl_student");
    assert(!r2.ok, "Ex牌角色不可被主人公放置行動牌");
  }

  // ---------- 獵奇殺人：Ex+2 並依序結算連續殺人＋不安擴散 ----------
  {
    const g = new TL.Game(mk("MC", "quilt_of_incidents", [], null, [
      { day: 1, incidentId: "bestial_murder", culpritId: "girl_student" }
    ]), { protagonists: 3, io: makeIO([]) });
    await g.startGame();
    g.state.day = 1;
    g.state.chars.girl_student.paranoia = 5;
    g.state.chars.boy_student.paranoia = 0;
    g.state.chars.boy_student.loc = g.state.chars.girl_student.loc;
    await g._incidentPhase();
    assert(g.state.exGauge >= 2, "獵奇殺人 Ex槽+2");
    assert(!g.state.chars.boy_student.alive || g.state.log.some(l => l.text.indexOf("不安+2") >= 0),
      "獵奇殺人依序結算連續殺人＋不安擴散");
  }

  // ---------- 發現：Ex+1 ----------
  {
    const g = new TL.Game(mk("WM", "king_in_yellow", [], null, [
      { day: 1, incidentId: "discovery", culpritId: "girl_student" }
    ]), { protagonists: 3, io: makeIO([]) });
    await g.startGame();
    g.state.day = 1;
    g.state.chars.girl_student.paranoia = 3;
    await g._incidentPhase();
    assert(g.state.exGauge === 1, "發現事件 Ex槽+1");
  }

  // ---------- 可疑信件：次日無法移動 ----------
  {
    const g = new TL.Game(mk("MC", "quilt_of_incidents", [], null, [
      { day: 1, incidentId: "suspicious_letter", culpritId: "girl_student" }
    ]), { protagonists: 3, io: makeIO([]) });
    await g.startGame();
    g.state.day = 1;
    g.state.chars.girl_student.paranoia = 3;
    g.state.chars.boy_student.loc = g.state.chars.girl_student.loc;
    await g._incidentPhase();
    assert(g.state.cannotMoveNextDay["boy_student"] === true, "可疑信件：被移動角色次日無法移動");
    // 次日結算移動 → 不移動
    g.state.day = 2;
    g.state.phase = "mm_play";
    const before = g.state.chars.boy_student.loc;
    g.state.mmPlays = [{ card: "m_move_h", targetType: "char", targetId: "boy_student" }];
    g.state.pPlays = [];
    await g._resolveCards();
    assert(g.state.chars.boy_student.loc === before, "可疑信件次日移動被禁止");
  }

  // ---------- 封鎖：3天內無法移動進入/離開 ----------
  {
    const g = new TL.Game(mk("MC", "quilt_of_incidents", [], null, [
      { day: 1, incidentId: "closed_circle", culpritId: "girl_student" }
    ]), { protagonists: 3, io: makeIO([]) });
    await g.startGame();
    g.state.day = 1;
    g.state.chars.girl_student.paranoia = 3;
    const blockedLoc = g.state.chars.girl_student.loc;
    await g._incidentPhase();
    assert(g._locBlocked(blockedLoc), "封鎖版圖生效");
    // 在封鎖版圖內的角色不能移動
    const before = g.state.chars.boy_student.loc;
    g.state.chars.boy_student.loc = blockedLoc;
    await g._applyMovement("boy_student", "h");
    assert(g.state.chars.boy_student.loc === blockedLoc, "封鎖區域內不能移動離開");
    // 3天後解封
    g.state.day = blockedLoc === "school" ? 4 : 4;
    g.state.closedCircles = [{ loc: blockedLoc, untilDay: 3 }];
    g.state.day = 4;
    assert(!g._locBlocked(blockedLoc), "封鎖3天後解除");
  }

  // ---------- 銀色子彈：事件階段結束 → 輪迴結束 ----------
  {
    const g = new TL.Game(mk("MC", "quilt_of_incidents", [], null, [
      { day: 1, incidentId: "silver_bullet", culpritId: "girl_student" }
    ]), { protagonists: 3, io: makeIO([]) });
    await g.startGame();
    g.state.day = 1;
    g.state.chars.girl_student.paranoia = 3;
    await g._incidentPhase();
    assert(g.state.phase === "loop_end", "銀色子彈 → 事件階段結束即輪迴結束");
  }

  // ---------- 廷達羅斯之嗅：後續其它事件 → 主人公死亡 ----------
  {
    const g = new TL.Game(mk("WM", "king_in_yellow", [], null, [
      { day: 1, incidentId: "hound_dog_scent", culpritId: "girl_student" },
      { day: 2, incidentId: "discovery", culpritId: "boy_student" }
    ]), { protagonists: 3, io: makeIO([]) });
    await g.startGame();
    g.state.day = 1;
    g.state.chars.girl_student.intrigue = 3;
    await g._incidentPhase();
    assert(g.state.houndDogActive, "廷達羅斯之嗅已生效");
    assert(g.state.ended === null, "嗅覺當日不觸發主人公死亡");
    g.state.day = 2;
    g.state.chars.boy_student.paranoia = 3;
    await g._incidentPhase();
    assert(g.state.ended === "lose", "廷達羅斯之嗅：後續事件發生 → 主人公死亡");
  }

  // ---------- 投毒者 / 目擊者 / Ex4發狂（回合結束） ----------
  {
    const g = new TL.Game(mk("MC", "quilt_of_incidents", [], null), { protagonists: 3, io: makeIO([]) });
    await g.startGame();
    g.state.chars.class_rep.role = "poisoner";
    g.state.chars.class_rep.loc = "school";
    g.state.chars.boy_student.loc = "school";
    g.state.chars.girl_student.loc = "city";
    g.state.exGauge = 2;
    g.state.day = 1;
    await g._dayEndPhase();
    assert(!g.state.chars.boy_student.alive, "投毒者 Ex槽2+ 殺害同區域角色");
    assert(g.state.plotFlags.poisonerKillUsed, "投毒者每輪限1次已標記");
  }
  {
    const g = new TL.Game(mk("MC", "quilt_of_incidents", [], null), { protagonists: 3, io: makeIO([]) });
    await g.startGame();
    g.state.chars.class_rep.role = "poisoner";
    g.state.exGauge = 4;
    g.state.day = 1;
    await g._dayEndPhase();
    assert(g.state.ended === "lose", "投毒者 Ex槽4+ → 主人公死亡");
  }
  {
    const g = new TL.Game(mk("WM", "king_in_yellow", [], null), { protagonists: 3, io: makeIO([]) });
    await g.startGame();
    g.state.chars.class_rep.role = "witness";
    g.state.chars.class_rep.paranoia = 4;
    g.state.day = 1;
    await g._dayEndPhase();
    assert(!g.state.chars.class_rep.alive, "目擊者不安4+ 死亡");
    assert(g.state.exGauge === 1, "目擊者死亡 Ex槽+1");
  }
  {
    const g = new TL.Game(mk("WM", "king_in_yellow", [], null), { protagonists: 3, io: makeIO([]) });
    await g.startGame();
    g.state.exGauge = 4;
    g.state.day = 1;
    await g._dayEndPhase();
    assert(g.state.ended === "lose", "Ex槽4+ 發狂：回合結束主人公死亡");
  }

  // ---------- 心理醫生（強制）/ 魔術師 / χ異因子（劇作家能力階段） ----------
  {
    const g = new TL.Game(mk("MC", "quilt_of_incidents", []), { protagonists: 3, io: makeIO([]) });
    await g.startGame();
    g.state.chars.class_rep.role = "therapist";
    g.state.chars.class_rep.loc = "school";
    g.state.chars.boy_student.loc = "school";
    g.state.chars.boy_student.paranoia = 2;
    g.state.exGauge = 1;
    g.state.phase = "mm_abilities";
    const logs = [];
    g.io = makeIO(logs);
    await g._mmAbilityPhase();
    assert(g.state.chars.boy_student.paranoia === 1, "心理醫生強制移除不安");
  }
  {
    const g = new TL.Game(mk("MZ", "secret_record", ["witches_tea_time"]), { protagonists: 3, io: makeIO([]) });
    await g.startGame();
    g.state.chars.class_rep.role = "magician";
    g.state.chars.class_rep.loc = "school";
    g.state.chars.boy_student.loc = "school";
    g.state.chars.boy_student.paranoia = 1;
    g.state.phase = "mm_abilities";
    await g._mmAbilityPhase();
    assert(g.state.chars.boy_student.loc !== "school" || g.state.plotFlags.magicianMoveUsed, "魔術師移動使用");
  }
  {
    const g = new TL.Game(mk("MZ", "secret_record", ["unsafe_trigger"]), { protagonists: 3, io: makeIO([]) });
    await g.startGame();
    const factor = roleChar(g, "factor") || "boy_student";
    g.state.chars[factor].role = "factor";
    g.state.chars[factor].loc = "city";
    g.state.phase = "mm_abilities";
    await g._mmAbilityPhase();
    assert(g.state.locations.city.intrigue >= 1, "χ異因子：不安定因子所在版圖密謀+1");
  }

  // ---------- 舊印（Ex3+）：禁止密謀不互相無效化 ----------
  {
    const g = new TL.Game(mk("MC", "quilt_of_incidents", []), { protagonists: 3, io: makeIO([]) });
    await g.startGame();
    g.state.exGauge = 3;
    g.state.phase = "mm_play";
    g.mmPlayCard("m_intrigue_plus1", "char", "girl_student");
    g.confirmMMPlays();
    g.state.phase = "p_play";
    g.pPlayCard(0, 0, "p_forbid_intrigue", "char", "girl_student");
    g.pPlayCard(1, 1, "p_forbid_intrigue", "location", "shrine");
    g.confirmPPlays();
    await g.nextStep();
    assert(g.state.chars.girl_student.intrigue === 0, "舊印：Ex3+ 兩張禁止密謀各自生效");
  }
  {
    const g = new TL.Game(mk("MC", "quilt_of_incidents", []), { protagonists: 3, io: makeIO([]) });
    await g.startGame();
    g.state.exGauge = 0;
    g.state.phase = "mm_play";
    g.mmPlayCard("m_intrigue_plus1", "char", "girl_student");
    g.confirmMMPlays();
    g.state.phase = "p_play";
    g.pPlayCard(0, 0, "p_forbid_intrigue", "char", "girl_student");
    g.pPlayCard(1, 1, "p_forbid_intrigue", "location", "shrine");
    g.confirmPPlays();
    await g.nextStep();
    assert(g.state.chars.girl_student.intrigue === 1, "Ex<3：兩張禁止密謀互相無效化");
  }

  // ---------- 心無靈犀：禁止友好同時具備禁止移動 ----------
  {
    const g = new TL.Game(mk("MZ", "secret_record", ["unanswered_heart"]), { protagonists: 3, io: makeIO([]) });
    await g.startGame();
    g.state.phase = "mm_play";
    g.mmPlayCard("m_forbid_goodwill", "char", "girl_student");
    g.mmPlayCard("m_move_h", "char", "girl_student");
    g.mmPlayCard("m_paranoia_plus", "char", "boy_student");
    g.confirmMMPlays();
    g.state.phase = "p_play";
    g.confirmPPlays();
    const before = g.state.chars.girl_student.loc;
    await g.nextStep();
    assert(g.state.chars.girl_student.loc === before, "心無靈犀：禁止友好同時禁止移動");
  }

  // ---------- 因果之絆：Ex牌角色身份變為關鍵人物 ----------
  {
    const g = new TL.Game(mk("MZ", "fated_connections", []), { protagonists: 3, io: makeIO([]) });
    await g.startGame();
    g.state.chars.girl_student.role = "witch";
    g._placeExCard("girl_student");
    assert(g.state.chars.girl_student.role === "key_person", "因果之絆：Ex牌角色身份變為關鍵人物");
  }

  // ---------- 巫師：友好能力後公開身份，隊長可使Ex+1 ----------
  {
    const g = new TL.Game(mk("MZ", "secret_record", []), { protagonists: 3, io: makeIO([]) });
    await g.startGame();
    g.state.chars.class_rep.role = "wizard";
    g.state.chars.class_rep.goodwill = 2;
    const logs = [];
    g.io = makeIO(logs);
    const ab = CHAR_INDEX.class_rep.goodwill[0];
    await g.execGoodwill({ charId: "class_rep", abilityIdx: 0, ability: ab }, "p0", null);
    assert(g.state.chars.class_rep.roleRevealed, "巫師：友好能力後公開身份");
    assert(g.state.exGauge === 1, "巫師：隊長使Ex槽+1");
  }

  // ---------- 深潛者死亡：公開身份＋Ex+1；魔術師死亡：移除不安 ----------
  {
    const g = new TL.Game(mk("WM", "king_in_yellow", []), { protagonists: 3, io: makeIO([]) });
    await g.startGame();
    g.state.chars.class_rep.role = "deep_one";
    await g._applyDeath("class_rep");
    assert(g.state.chars.class_rep.roleRevealed, "深潛者死亡時公開身份");
    assert(g.state.exGauge === 1, "深潛者死亡 Ex槽+1");
  }
  {
    const g = new TL.Game(mk("MZ", "secret_record", ["witches_tea_time"]), { protagonists: 3, io: makeIO([]) });
    await g.startGame();
    g.state.chars.class_rep.role = "magician";
    g.state.chars.class_rep.paranoia = 3;
    await g._applyDeath("class_rep");
    assert(g.state.chars.class_rep.paranoia === 0, "魔術師死亡時移除所有不安");
  }

  // ---------- 偏執狂：劇作家能力階段自放密謀/不安 ----------
  {
    const g = new TL.Game(mk("MZ", "secret_record", []), { protagonists: 3, io: makeIO([]) });
    await g.startGame();
    g.state.chars.class_rep.role = "paranoiac";
    g.state.phase = "mm_abilities";
    const before = g.state.chars.class_rep.intrigue;
    await g._mmAbilityPhase();
    assert(g.state.chars.class_rep.intrigue === before + 1, "偏執狂自放1枚密謀（選項0）");
  }

  // ---------- 輪末失敗條件 ----------
  // Ex槽 gte
  {
    const g = new TL.Game(mk("MC", "quilt_of_incidents", [], null, [], { loops: 1 }), { protagonists: 3, io: makeIO([]) });
    await g.startGame();
    g.state.exGauge = 3;
    g.state.phase = "loop_end";
    await g._loopEndPhase();
    assert(g.state.phase === "final_guess", "事件交織的羅網：Ex3+ 失敗");
  }
  // Ex槽 lte
  {
    const g = new TL.Game(mk("MC", "tightrope_plan", [], null, [], { loops: 1 }), { protagonists: 3, io: makeIO([]) });
    await g.startGame();
    g.state.exGauge = 0;
    g.state.phase = "loop_end";
    await g._loopEndPhase();
    assert(g.state.phase === "final_guess", "命懸一線：Ex≤1 失敗");
  }
  // 黑暗學園：X = loop-1
  {
    const g = new TL.Game(mk("MC", "the_black_school", [], null, [], { loops: 1 }), { protagonists: 3, io: makeIO([]) });
    await g.startGame();
    g.state.phase = "loop_end";
    await g._loopEndPhase();
    assert(g.state.phase === "final_guess", "黑暗學園第1輪必定失敗");
  }
  // 絕密報告
  {
    const g = new TL.Game(mk("MZ", "secret_record", [], null, [], { loops: 1 }), { protagonists: 3, io: makeIO([]) });
    await g.startGame();
    g.state.chars.boy_student.role = "brain";
    g.state.chars.boy_student.roleRevealed = true;
    g.state.phase = "loop_end";
    await g._loopEndPhase();
    assert(g.state.phase === "final_guess", "絕密報告：公開主謀身份 → 失敗");
  }
  // 火藥的味道
  {
    const g = new TL.Game(mk("MC", "quilt_of_incidents", ["smell_of_gunpowder"], null, [], { loops: 1 }), { protagonists: 3, io: makeIO([]) });
    await g.startGame();
    g.state.chars.boy_student.paranoia = 6;
    g.state.chars.girl_student.paranoia = 6;
    g.state.phase = "loop_end";
    await g._loopEndPhase();
    assert(g.state.phase === "final_guess", "火藥的味道：不安總數12+ 失敗");
  }
  // 死亡真人秀
  {
    const g = new TL.Game(mk("MZ", "secret_record", ["showtime_of_death"], null, [], { loops: 1 }), { protagonists: 3, io: makeIO([]) });
    await g.startGame();
    Object.keys(g.state.chars).slice(0, 5).forEach(function (id) { g.state.chars[id].alive = false; });
    g.state.phase = "loop_end";
    await g._loopEndPhase();
    assert(g.state.phase === "final_guess", "死亡真人秀：存活≤6 失敗");
  }
  // 達貢的福音書：神社密謀 ≥ Ex槽
  {
    const g = new TL.Game(mk("WM", "sacred_words_of_dagon", [], null, [], { loops: 1 }), { protagonists: 3, io: makeIO([]) });
    await g.startGame();
    g.state.exGauge = 2;
    g.state.locations.shrine.intrigue = 2;
    g.state.phase = "loop_end";
    await g._loopEndPhase();
    assert(g.state.phase === "final_guess", "達貢的福音書：神社密謀≥Ex槽 失敗");
  }
  // 黃衣之王
  {
    const g = new TL.Game(mk("WM", "king_in_yellow", [], null, [], { loops: 1 }), { protagonists: 3, io: makeIO([]) });
    await g.startGame();
    g._addExGauge(1);
    g.state.phase = "loop_end";
    await g._loopEndPhase();
    assert(g.state.phase === "final_guess", "黃衣之王：本輪Ex槽增加過 失敗");
  }
  // 染血的儀式
  {
    const g = new TL.Game(mk("WM", "bloody_rites", [], null, [], { loops: 1 }), { protagonists: 3, io: makeIO([]) });
    await g.startGame();
    g.state.exGauge = 1;
    g.state.chars.boy_student.alive = false;
    g.state.phase = "loop_end";
    await g._loopEndPhase();
    assert(g.state.phase === "final_guess", "染血的儀式：屍體≥Ex槽 失敗");
  }
  // 外神合唱曲
  {
    const g = new TL.Game(mk("WM", "choir_to_the_outside_god", [], null, [], { loops: 1 }), { protagonists: 3, io: makeIO([]) });
    await g.startGame();
    Object.keys(g.state.chars).slice(0, 5).forEach(function (id) { g.state.chars[id].intrigue = 1; });
    g.state.phase = "loop_end";
    await g._loopEndPhase();
    assert(g.state.phase === "final_guess", "外神合唱曲：5名以上帶密謀 失敗");
  }
  // Ex4 發狂：跳過剩餘輪迴直接最終決戰
  {
    const g = new TL.Game(mk("MZ", "secret_record", [], null, [], { loops: 3 }), { protagonists: 3, io: makeIO([]) });
    await g.startGame();
    g.state.exGauge = 4;
    g.state.phase = "loop_end";
    g.state.ended = "lose";
    await g._loopEndPhase();
    assert(g.state.phase === "final_guess", "Ex4 發狂：直接進入最終決戰");
  }

  // ---------- 劇本校驗 ----------
  {
    const s = mk("MZ", "male_confrontation", []);
    s.cast.forEach(function (e) { if (e.characterId === "boy_student") e.role = "ninja"; });
    const v = TL.validateScript(s);
    assert(v.errors.some(function (e) { return e.indexOf("忍者") >= 0; }), "男子漢的戰爭：忍者須男性且非少年");
  }
  {
    const s = mk("MZ", "secret_record", ["worshippers_of_the_apocalypse"], null, [
      { day: 2, incidentId: "murder", culpritId: "girl_student" }
    ]);
    const v = TL.validateScript(s);
    assert(v.errors.some(function (e) { return e.indexOf("自殺") >= 0; }), "滅亡謳歌：必須引入自殺事件");
  }
  {
    const s = mk("WM", "king_in_yellow", ["twisted_truth"]);
    const v = TL.validateScript(s);
    assert(v.errors.some(function (e) { return e.indexOf("情報商") >= 0; }), "瘋狂的真相：情報商必須登場");
  }
  {
    const s = mk("MC", "quilt_of_incidents", ["isolation_institution_psycho"], null, [
      { day: 2, incidentId: "murder", culpritId: "doctor" }
    ]);
    s.cast.forEach(function (e) { if (e.characterId === "doctor") e.role = "therapist"; });
    const v = TL.validateScript(s);
    assert(v.errors.some(function (e) { return e.indexOf("心理醫生") >= 0; }), "心理醫生不可成為當事人");
  }
  {
    const s = mk("MC", "quilt_of_incidents", ["i_am_a_master_detective"], null, [
      { day: 2, incidentId: "murder", culpritId: "girl_student" }
    ]);
    s.cast.forEach(function (e) { if (e.characterId === "doctor") e.role = "detective"; });
    const v = TL.validateScript(s);
    assert(v.errors.some(function (e) { return e.indexOf("偵探") >= 0; }), "我是名偵探：偵探必須成為當事人");
  }
  {
    const s = mk("MC", "quilt_of_incidents", [], null, [
      { day: 2, incidentId: "serial_murder", culpritId: "girl_student" },
      { day: 3, incidentId: "serial_murder", culpritId: "girl_student" }
    ]);
    const v = TL.validateScript(s);
    assert(!v.errors.some(function (e) { return e.indexOf("擔任了多個事件") >= 0; }), "連續殺人允許同一角色擔任多個當事人");
  }
  {
    const s = mk("MC", "quilt_of_incidents", [], null, [
      { day: 2, incidentId: "serial_murder", culpritId: "girl_student" },
      { day: 3, incidentId: "murder", culpritId: "girl_student" }
    ]);
    const v = TL.validateScript(s);
    assert(v.errors.some(function (e) { return e.indexOf("擔任了多個事件") >= 0; }), "非連續殺人重複當事人仍報錯");
  }

  console.log(failures ? "有 " + failures + " 項失敗 ✗" : "MC/MZ/WM 模組邏輯測試全部通過 ✓");
  process.exit(failures ? 1 : 0);
}

run().catch(function (e) { console.error(e); process.exit(1); });
