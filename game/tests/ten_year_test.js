// 十周年（觀測者之書 / AHR / LL / HSA）機制測試
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
  "js/data/ai-strategies.js",
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
    confirm: async function (q) { logs.push("CONFIRM:" + (q.title || "") + " -> " + (q.kind === "refuse" ? "true" : "false")); return q.kind === "refuse"; },
    promptNumber: async function () { return 0; }
  };
}

function mk(moduleId, mainPlot, subplots, roleMap, incidents, extra) {
  const s = TL.defaultScript(moduleId);
  s.mainPlot = mainPlot;
  s.subplots = subplots || [];
  s.cast.forEach(function (e) {
    e.role = (roleMap && roleMap[e.characterId]) ? roleMap[e.characterId] : null;
  });
  // 追加登場角色（如 臨時工/從者/上位存在）
  const addChars = (extra && extra.addChars) || [];
  addChars.forEach(function (cid) {
    if (!s.cast.some(function (e) { return e.characterId === cid; })) {
      s.cast.push({ characterId: cid, role: (roleMap && roleMap[cid]) || null, startLoc: CHAR_INDEX[cid].defaultStart });
    }
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
  // ---------- 希望/絕望計數與拒絕判定 ----------
  {
    const g = new TL.Game(mk("FS", "murder_plan", ["shadow_of_the_ripper"], { girl_student: "key_person" }), { protagonists: 3, io: makeIO([]) });
    await g.startGame();
    const c = g.state.chars.girl_student;
    c.hope = 1;
    assert(g._effGoodwill("girl_student") === 1, "希望計入友好");
    c.goodwill = 2;
    assert(g._effGoodwill("girl_student") === 3, "友好+希望合計");
    c.intrigue = 2;
    assert(g._effIntrigueChar("girl_student") === 1, "希望抵銷密謀（2-1=1）");
    assert(g._refusalOf("girl_student") === "none", "希望移除無視友好");
    c.hope = 0;
    c.despair = 1;
    assert(g._effParanoia("girl_student") === 1, "絕望計入不安");
    assert(g._effIntrigueChar("girl_student") === 3, "絕望計入密謀（2+1=3）");
    assert(g._refusalOf("girl_student") === "mandatory", "絕望賦予必定無視友好");
    c.hope = 1;
    assert(g._refusalOf("girl_student") === "none", "希望優先於絕望");
  }

  // ---------- 希望+1 / 絕望+1 行動牌 ----------
  {
    const logs = [];
    const g = new TL.Game(mk("FS", "murder_plan", ["shadow_of_the_ripper"], { girl_student: "key_person" }), { protagonists: 3, io: makeIO(logs) });
    await g.startGame();
    g._addPHandCard(0, "p_hope_plus1");
    assert(g.state.pHandExtra.p0.indexOf("p_hope_plus1") >= 0, "希望+1已入手");
    g.state.phase = "p_play";
    g.state.pPlays.push({ player: 0, deck: 0, card: "p_hope_plus1", targetType: "char", targetId: "girl_student" });
    g.state.mmPlays = [];
    await g._resolveCards();
    assert(g.state.chars.girl_student.hope === 1, "希望+1放置希望指示物");
    assert(g.state.pHandExtra.p0.indexOf("p_hope_plus1") < 0, "希望+1使用後回收");
  }
  {
    const logs = [];
    const g = new TL.Game(mk("FS", "murder_plan", ["shadow_of_the_ripper"], { girl_student: "key_person" }), { protagonists: 3, io: makeIO(logs) });
    await g.startGame();
    g._addPHandCard(0, "p_hope_plus1");
    g._addPHandCard(1, "p_hope_plus1");
    g.state.phase = "p_play";
    g.state.pPlays.push({ player: 0, deck: 0, card: "p_hope_plus1", targetType: "char", targetId: "girl_student" });
    g.state.pPlays.push({ player: 1, deck: 1, card: "p_hope_plus1", targetType: "char", targetId: "girl_student" });
    g.state.mmPlays = [];
    await g._resolveCards();
    assert(g.state.chars.girl_student.hope === 0, "2名以上打出希望+1→不放置希望");
    assert(g.state.chars.girl_student.goodwill === 2, "2名以上打出希望+1→改為友好+1");
    assert(g.state.pHandExtra.p0.indexOf("p_hope_plus1") >= 0 && g.state.pHandExtra.p1.indexOf("p_hope_plus1") >= 0, "共享時不回收希望+1");
  }
  {
    const logs = [];
    const g = new TL.Game(mk("FS", "murder_plan", ["shadow_of_the_ripper"], { girl_student: "key_person" }), { protagonists: 3, io: makeIO(logs) });
    await g.startGame();
    g._addMMHandCard("m_despair_plus1");
    g.state.phase = "mm_play";
    g.state.mmPlays.push({ card: "m_despair_plus1", targetType: "char", targetId: "girl_student" });
    g.state.pPlays = [];
    await g._resolveCards();
    assert(g.state.chars.girl_student.despair === 1, "絕望+1放置絕望指示物");
  }

  // ---------- 遺骸/熟識標記 ----------
  {
    const logs = [];
    const g = new TL.Game(mk("FS", "murder_plan", ["shadow_of_the_ripper"], { girl_student: "key_person", boy_student: "serial_killer" }), { protagonists: 3, io: makeIO(logs) });
    await g.startGame();
    await g._applyDeath("boy_student");
    assert(g.state.chars.boy_student.perished === true, "首次死亡放置遺骸標記");
    g.state.chars.boy_student.alive = true;
    await g._applyDeath("boy_student");
    assert(g.state.chars.boy_student.perished === true, "重複死亡不重複放置遺骸標記");
  }
  {
    const logs = [];
    const g = new TL.Game(mk("FS", "murder_plan", ["shadow_of_the_ripper"], { girl_student: "killer", boy_student: "key_person" }), { protagonists: 3, io: makeIO(logs) });
    await g.startGame();
    const chosen = { charId: "girl_student", abilityIdx: 0, ability: CHAR_INDEX.girl_student.goodwill[0] };
    await g._execGoodwill(chosen, "p0", null);
    assert(g.state.chars.girl_student.acquainted === true, "聲明使用友好能力放置熟識標記");
    assert(g.state.chars.girl_student.acquaintedRefused === true, "被拒絕時熟識標記記錄拒絕面");
  }

  // ---------- 臨時工 / 臨時工? ----------
  {
    const logs = [];
    const g = new TL.Game(mk("FS", "murder_plan", [], { girl_student: "key_person" }, [], { addChars: ["part_time_jobber"] }), { protagonists: 3, io: makeIO(logs) });
    await g.startGame();
    const pt = g.state.chars.part_time_jobber;
    pt.paranoia = 3;
    await TL.DAY_END_STEPS.find(function (s) { return s.id === "part_timer_die"; }).fn(g);
    assert(!pt.alive, "臨時工3枚以上指示物死亡");
    await g._partTimerSpawn();
    assert(g.state.chars.part_time_jobbess && g.state.chars.part_time_jobbess.alive, "臨時工死亡後放置臨時工?");
    assert(g.state.chars.part_time_jobbess.loc === "city", "臨時工?出現在都市");
    assert(g._role("part_time_jobber") === null, "臨時工身份視為平民");
  }

  // ---------- 從者忠誠指示物 ----------
  {
    const logs = [];
    const g = new TL.Game(mk("FS", "murder_plan", [], { girl_student: "key_person" }, [], { addChars: ["maid"] }), { protagonists: 3, io: makeIO(logs) });
    await g.startGame();
    const chosen = { charId: "maid", abilityIdx: 0, ability: CHAR_INDEX.maid.goodwill[0] };
    await g._execGoodwill(chosen, "p0", { type: "char", id: "boy_student" });
    assert(g.state.chars.boy_student.loyaltyOn === true, "從者能力目標放置忠誠指示物");
    assert(g.state.plotFlags.servantScope.indexOf("boy_student") >= 0, "從者能力追加保護對象");
  }

  // ---------- 上位存在：希望/絕望能力 + 劇作家使用 ----------
  {
    const logs = [];
    const g = new TL.Game(mk("FS", "murder_plan", [], { girl_student: "key_person" }, [], { addChars: ["higher_being"] }), { protagonists: 3, io: makeIO(logs) });
    await g.startGame();
    const chosen = { charId: "higher_being", abilityIdx: 0, ability: CHAR_INDEX.higher_being.goodwill[0] };
    await g._execGoodwill(chosen, "p0", { type: "char", id: "boy_student" });
    assert(g.state.chars.boy_student.hope === 1, "上位存在放置希望指示物（默認選0=希望）");
    assert(g.state.usedGoodwill.higher_being && g.state.usedGoodwill.higher_being[0], "上位存在 1x∞ 已計數");
    g.state.usedGoodwill = {};
    g.state.chars.higher_being.goodwill = 1;
    g.state.chars.higher_being.despair = 1;
    const src = TL.MM_EXTRA_SOURCES.map(function (fn) { return fn(g); }).filter(Boolean);
    assert(src.some(function (e) { return e.charId === "higher_being" && e.ability.effect === "hope_despair"; }), "擁有無視友好+友好時劇作家可用上位存在能力");
  }

  // ---------- 因果殘片最終決戰 ----------
  {
    const g = new TL.Game(mk("FS", "murder_plan", [], { girl_student: "key_person", boy_student: "fragment" }), { protagonists: 3, io: makeIO([]) });
    await g.startGame();
    g.state.phase = "final_guess";
    g.state.finalGuess = { index: 0, order: Object.keys(g.state.chars), done: false };
    const r = await g.finalGuess("boy_student", null);
    assert(r.ok === true, "因果殘片聲明為平民也正確");
    assert(g.state.chars.boy_student.roleRevealed, "因果殘片已公開");
  }

  // ---------- 超越世界線：輪迴開始手牌 ----------
  {
    const logs = [];
    const g = new TL.Game(mk("FS", "murder_plan", ["crossing_world_lines"], { girl_student: "key_person" }), { protagonists: 3, io: makeIO(logs) });
    await g.startGame();
    g.state.loop = 2;
    await g._beginLoop();
    assert(g.state.mmHandExtra.indexOf("m_despair_plus1") >= 0, "偶數輪劇作家獲得絕望+1");
    g.state.loop = g.script.loops;
    await g._beginLoop();
    assert(g.state.pHandExtra.p0 && g.state.pHandExtra.p0.indexOf("p_hope_plus1") >= 0, "最終輪主人公獲得希望+1");
  }

  // ---------- 希望之光 / 絕望之暗 事件 ----------
  {
    const logs = [];
    const g = new TL.Game(mk("FS", "murder_plan", [], { girl_student: "key_person" }, [
      { day: 1, incidentId: "the_light_of_hope", culpritId: "girl_student" }
    ]), { protagonists: 3, io: makeIO(logs) });
    await g.startGame();
    g.state.chars.girl_student.goodwill = 3;
    g.state.phase = "incident";
    await g._incidentPhase();
    const hoped = Object.keys(g.state.chars).filter(function (id) { return g.state.chars[id].hope > 0; });
    assert(hoped.length === 1, "希望之光放置1枚希望指示物");
  }
  {
    const logs = [];
    const g = new TL.Game(mk("FS", "murder_plan", [], { girl_student: "key_person" }, [
      { day: 1, incidentId: "the_murk_of_despair", culpritId: "girl_student" }
    ]), { protagonists: 3, io: makeIO(logs) });
    await g.startGame();
    g.state.chars.girl_student.paranoia = 3;
    g.state.phase = "incident";
    await g._incidentPhase();
    const despaired = Object.keys(g.state.chars).filter(function (id) { return g.state.chars[id].despair > 0; });
    assert(despaired.length === 1, "絕望之暗放置1枚絕望指示物");
  }

  // ---------- AHR：世界移動 / 裏世界判定 ----------
  {
    const logs = [];
    const g = new TL.Game(mk("AHR", "fairy_tale_murderer", [], { girl_student: "key_person", boy_student: "storyteller" }), { protagonists: 3, io: makeIO(logs) });
    await g.startGame();
    assert(g.state.mmHandExtra.indexOf("m_goodwill_plus1") >= 0, "AHR劇作家持有友好+1");
    assert(g.state.pHandExtra.p0 && g.state.pHandExtra.p0.indexOf("p_paranoia_plus2") >= 0, "AHR主人公持有不安+2");
    assert(g.state.mmHandExtra.indexOf("m_despair_plus1") >= 0, "AHR第1輪劇作家持有絕望+1");
    g._triggerWarp();
    await TL.DAY_END_STEPS.find(function (s) { return s.id === "ahr_warp"; }).fn(g);
    assert(g.state.exGauge === 1, "觸發世界移動→回合結束Ex槽+1");
    assert(g._isDarkWorld(), "Ex槽奇數為裏世界");
    g.state.chars.boy_student.paranoia = 3;
    assert(g._incidentCount(INCIDENT_INDEX.murder, "boy_student") === 0, "裏世界以友好判定事件");
    g.state.chars.boy_student.goodwill = 3;
    assert(g._incidentCount(INCIDENT_INDEX.murder, "boy_student") === 3, "裏世界友好達標可觸發事件");
  }

  // ---------- 新模組預設劇本可建立 ----------
  ["AHR", "LL", "HSA"].forEach(function (mid) {
    const s = TL.defaultScript(mid);
    const v = TL.validateScript(s);
    assert(MODULES[mid] && MODULES[mid].mainPlots.length === 5, mid + " 模組定義（5條規則Y）");
    assert(MODULES[mid].subplots.length === 7, mid + " 模組定義（7條規則X）");
    assert(s.mainPlot && s.subplots.length > 0, mid + " 預設劇本可建立");
    console.log("   " + mid + " 預設劇本可建立 ✓");
  });

  console.log(failures === 0 ? "\n十周年機制測試全部通過 ✓" : "\n有 " + failures + " 項失敗 ✗");
  process.exit(failures === 0 ? 0 : 1);
}

run().catch(function (e) {
  console.error("測試異常:", e);
  process.exit(1);
});
