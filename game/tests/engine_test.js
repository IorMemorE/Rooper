// 引擎自動化測試：模擬完整對局流程
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
  const code = fs.readFileSync(path.join(root, f), "utf8");
  eval(code);
}

let failures = 0;
function assert(cond, msg) {
  if (!cond) {
    failures++;
    console.error("FAIL:", msg);
  }
}

// 自動化 io
function makeIO(logs) {
  return {
    log: function () {},
    askChoice: async function (q) { logs.push("CHOICE:" + (q.title || "") + " -> 0"); return 0; },
    askTarget: async function (q) { logs.push("TARGET:" + (q.title || "") + " -> " + (q.targets[0] ? q.targets[0].id : "none")); return q.targets[0] || null; },
    confirm: async function (q) { logs.push("CONFIRM:" + (q.title || "") + " -> false"); return false; }
  };
}

async function runFSLoop() {
  const script = TL.defaultScript("FS");
  const v = TL.validateScript(script);
  assert(v.errors.length === 0, "FS 默認劇本應通過驗證: " + v.errors.join("; "));

  const logs = [];
  const g = new TL.Game(script, { protagonists: 3, io: makeIO(logs) });
  await g.startGame();
  assert(g.state.phase === "day_start", "startGame 後應進入 day_start");

  // 第1天
  await g.nextStep(); // day_start -> mm_play
  assert(g.state.phase === "mm_play", "應進入 mm_play");
  const mmCards = ["m_intrigue_plus1", "m_paranoia_plus", "m_move_h"];
  const mmTargets = [["char", "girl_student"], ["char", "boy_student"], ["location", "school"]];
  for (let i = 0; i < 3; i++) {
    const r = g.mmPlayCard(mmCards[i], mmTargets[i][0], mmTargets[i][1]);
    assert(r.ok, "劇作家打牌 " + mmCards[i] + " 應成功: " + (r.msg || ""));
  }
  assert(g.mmPlayCard("m_intrigue_plus1", "char", "girl_student").ok === false, "相同位置不可打兩張牌");
  assert(g.confirmMMPlays().ok, "確認劇作家打牌");
  assert(g.state.phase === "p_play", "應進入 p_play");

  // 主人公打牌（3人）
  const pPlays = [
    [0, 0, "p_goodwill_plus1", "char", "shrine_maiden"],
    [1, 1, "p_goodwill_plus2", "char", "office_worker"],
    [2, 2, "p_paranoia_minus", "char", "girl_student"]
  ];
  for (const pp of pPlays) {
    const r = g.pPlayCard(pp[0], pp[1], pp[2], pp[3], pp[4]);
    assert(r.ok, "主人公打牌應成功: " + (r.msg || ""));
  }
  assert(g.confirmPPlays().ok, "確認主人公打牌");

  // 結算
  await g.nextStep(); // resolve -> mm_abilities
  assert(g.state.phase === "mm_abilities", "應進入 mm_abilities");
  await g.nextStep(); // mm_abilities -> goodwill
  assert(g.state.phase === "goodwill", "應進入 goodwill");
  await g.nextStep(); // goodwill -> incident
  assert(g.state.phase === "incident", "應進入 incident");
  await g.nextStep(); // incident -> day_end
  assert(g.state.phase === "day_end", "應進入 day_end");
  await g.nextStep(); // day_end -> day_start (第2天)
  assert(g.state.day === 2, "第2天開始");

  // 推進到輪迴結束
  for (let d = 1; d <= script.days; d++) {
    if (g.state.phase === "day_start") await g.nextStep(); // -> mm_play
    g.mmPlayCard("m_paranoia_plus", "char", "girl_student");
    g.mmPlayCard("m_intrigue_plus1", "location", "school");
    g.mmPlayCard("m_move_v", "char", "doctor");
    assert(g.confirmMMPlays().ok, "FS 劇作家打牌確認 day " + d);
    for (let pi = 0; pi < 3; pi++) {
      const targets = ["shrine_maiden", "office_worker", "boy_student"];
      const r = g.pPlayCard(pi, pi, "p_goodwill_plus1", "char", targets[pi]);
      assert(r.ok, "FS 主人公打牌 day " + d + ": " + (r.msg || ""));
    }
    assert(g.confirmPPlays().ok, "FS 主人公打牌確認 day " + d);
    await g.nextStep(); // resolve
    await g.nextStep(); // mm_abilities
    await g.nextStep(); // goodwill
    await g.nextStep(); // incident
    await g.nextStep(); // day_end
    if (g.state.phase === "loop_end") break;
  }

  // 輪迴結束
  if (g.state.phase === "loop_end") await g.nextStep(); // loop_end
  assert(g.state.phase === "loop_end" || g.state.ended !== null || g.state.phase === "day_start", "輪迴結束後應有合理結果");
  if (g.state.ended === "win") {
    console.log("FS 測試：主人公獲勝 ✓");
  } else if (g.state.phase === "day_start") {
    console.log("FS 測試：進入第2輪輪迴 ✓（loop=" + g.state.loop + "）");
  } else {
    console.log("FS 測試：劇作家獲勝（無最終決戰）✓");
  }
}

async function runBTXLoop() {
  const script = TL.defaultScript("BTX");
  const v = TL.validateScript(script);
  assert(v.errors.length === 0, "BTX 默認劇本應通過驗證: " + v.errors.join("; "));
  const logs = [];
  const g = new TL.Game(script, { protagonists: 3, io: makeIO(logs) });
  await g.startGame();
  for (let day = 1; day <= script.days; day++) {
    if (g.state.phase === "day_start") await g.nextStep(); // -> mm_play
    g.mmPlayCard("m_paranoia_plus", "char", "girl_student");
    g.mmPlayCard("m_intrigue_plus1", "location", "shrine");
    g.mmPlayCard("m_move_v", "char", "doctor");
    assert(g.confirmMMPlays().ok, "BTX 劇作家打牌確認");
    for (let pi = 0; pi < 3; pi++) {
      const targets = ["shrine_maiden", "office_worker", "boy_student"];
      const r = g.pPlayCard(pi, pi, "p_goodwill_plus1", "char", targets[pi]);
      assert(r.ok, "BTX 主人公打牌: " + (r.msg || ""));
    }
    assert(g.confirmPPlays().ok, "BTX 主人公打牌確認");
    await g.nextStep(); // resolve
    await g.nextStep(); // mm_abilities
    await g.nextStep(); // goodwill
    await g.nextStep(); // incident
    await g.nextStep(); // day_end
    if (g.state.phase === "loop_end") break;
  }
  if (g.state.phase === "loop_end") await g.nextStep(); // loop_end
  if (g.state.ended === "win") {
    console.log("BTX 測試：主人公獲勝 ✓");
  } else if (g.state.phase === "final_guess") {
    console.log("BTX 測試：進入最終決戰 ✓");
    // 最終決戰：猜測所有角色（全錯 -> 失敗）
    const roles = [...new Set(TL.rolesFromScript(script))];
    for (const cid of Object.keys(g.state.chars)) {
      if (g.state.chars[cid].roleRevealed) continue;
      const wrong = roles.find(r => r !== g.state.chars[cid].role);
      const r = await g.finalGuess(cid, wrong);
      assert(r.ok, "最終決戰猜測應執行");
      break;
    }
    assert(g.state.ended === "lose", "猜錯後應失敗");
    console.log("BTX 測試：最終決戰猜錯 -> 失敗 ✓");
  } else if (g.state.phase === "day_start") {
    console.log("BTX 測試：進入下一輪 ✓");
  } else {
    console.log("BTX 測試：其他結果 phase=" + g.state.phase + " ended=" + g.state.ended);
  }
}

// ---------- 機制專項測試 ----------
function buildScript(opts) {
  const s = TL.defaultScript(opts.module || "FS");
  s.title = "機制測試";
  if (opts.mainPlot) s.mainPlot = opts.mainPlot;
  if (opts.subplots) s.subplots = opts.subplots;
  // 重新按角色順序分配身份
  const roles = TL.rolesFromScript(s);
  s.cast.forEach((e, i) => { e.role = roles[i] || null; });
  s.incidents = [];
  return s;
}

async function mechTests() {
  // 移動合成
  const g = new TL.Game(buildScript({}), { protagonists: 3, io: makeIO([]) });
  assert(g._netMove(1, 0, 0) === "h", "H 單獨 = 水平");
  assert(g._netMove(0, 1, 0) === "v", "V 單獨 = 垂直");
  assert(g._netMove(1, 1, 0) === "d", "H+V = 對角");
  assert(g._netMove(0, 1, 1) === "h", "V+D = 水平");
  assert(g._netMove(1, 0, 1) === "v", "H+D = 垂直");
  assert(g._netMove(2, 0, 0) === "h", "H+H = 水平");
  assert(g._netMove(2, 1, 0) === "v", "H+H+V = 垂直");

  // 禁止密謀優先級
  const g2 = new TL.Game(buildScript({}), { protagonists: 3, io: makeIO([]) });
  await g2.startGame();
  g2.state.phase = "mm_play";
  g2.mmPlayCard("m_intrigue_plus1", "char", "girl_student");
  g2.confirmMMPlays();
  g2.state.phase = "p_play";
  g2.pPlayCard(0, 0, "p_forbid_intrigue", "char", "girl_student");
  g2.confirmPPlays();
  await g2.nextStep(); // resolve
  assert(g2.state.chars.girl_student.intrigue === 0, "禁止密謀攔截密謀+1");

  const g3 = new TL.Game(buildScript({}), { protagonists: 3, io: makeIO([]) });
  await g3.startGame();
  g3.state.phase = "mm_play";
  g3.mmPlayCard("m_intrigue_plus1", "char", "girl_student");
  g3.confirmMMPlays();
  g3.state.phase = "p_play";
  g3.pPlayCard(0, 0, "p_forbid_intrigue", "char", "girl_student");
  g3.pPlayCard(1, 1, "p_forbid_intrigue", "location", "shrine");
  g3.confirmPPlays();
  await g3.nextStep();
  assert(g3.state.chars.girl_student.intrigue === 1, "兩張禁止密謀互相無效化後密謀生效");

  // 邪教徒無效化禁止密謀
  const g4 = new TL.Game(buildScript({ mainPlot: "a_place_to_protect" }), { protagonists: 3, io: makeIO([]) });
  await g4.startGame();
  const ct = Object.keys(g4.state.chars).find(id => g4.state.chars[id].role === "cultist");
  const loc4 = g4.state.chars[ct].loc;
  g4.state.phase = "mm_play";
  g4.mmPlayCard("m_intrigue_plus1", "location", loc4);
  g4.confirmMMPlays();
  g4.state.phase = "p_play";
  g4.pPlayCard(0, 0, "p_forbid_intrigue", "location", loc4);
  g4.confirmPPlays();
  const io4 = makeIO([]);
  const yesIo = Object.assign({}, io4, { confirm: async () => true });
  g4.io = yesIo;
  await g4.nextStep();
  assert(g4.state.locations[loc4].intrigue === 1, "邪教徒無效化禁止密謀後密謀生效");

  // 殺人狂夜間殺人 + 關鍵人物死亡失敗
  const s5 = buildScript({ module: "FS" });
  const g5 = new TL.Game(s5, { protagonists: 3, io: makeIO([]) });
  await g5.startGame();
  const serial = Object.keys(g5.state.chars).find(id => g5.state.chars[id].role === "serial_killer");
  const kp = Object.keys(g5.state.chars).find(id => g5.state.chars[id].role === "key_person");
  const other = Object.keys(g5.state.chars).find(id => id !== serial && id !== kp);
  Object.keys(g5.state.chars).forEach(id => { g5.state.chars[id].loc = "shrine"; });
  g5.state.chars[serial].loc = "hospital";
  g5.state.chars[other].loc = "hospital";
  g5.state.chars[serial].paranoia = 5;
  await g5._dayEndPhase();
  assert(!g5.state.chars[other].alive, "殺人狂殺害獨處角色");
  await g5._applyDeath(kp);
  assert(g5.state.ended === "lose", "關鍵人物死亡 → 主人公失敗");

  // 死亡導致的輪迴結束 → 應進入下一輪而不是判勝
  const s5b = buildScript({ module: "FS" });
  s5b.loops = 3;
  const g5b = new TL.Game(s5b, { protagonists: 3, io: makeIO([]) });
  await g5b.startGame();
  g5b.state.phase = "loop_end";
  const kpb = Object.keys(g5b.state.chars).find(id => g5b.state.chars[id].role === "key_person");
  await g5b._applyDeath(kpb);
  assert(g5b.state.ended === "lose" && g5b.state.phase === "loop_end", "死亡後應為失敗狀態");
  await g5b.nextStep();
  assert(g5b.state.phase === "loop_end" && g5b.state.nextLoopPending === true, "失敗且有剩餘輪迴時應停在輪迴結束等待下一輪");
  await g5b.nextStep();
  assert(g5b.state.loop === 2 && g5b.state.phase === "day_start" && g5b.state.ended === null, "死亡後進入第2輪且ended重置");

  // 最終決戰正確 → 勝利
  const s6 = buildScript({ module: "BTX" });
  s6.loops = 1;
  const g6 = new TL.Game(s6, { protagonists: 3, io: makeIO([]) });
  await g6.startGame();
  // 直接讓所有輪迴失敗進入最終決戰
  g6.state.phase = "loop_end";
  g6.state.loop = 1;
  g6.state.ended = "lose";
  // 手動觸發最終決戰初始化（模擬失敗後）
  Object.keys(g6.state.chars).forEach(id => {
    g6.state.chars[id].loc = g6.state.chars[id].startingLoc;
    g6.state.chars[id].alive = true;
  });
  g6.state.phase = "final_guess";
  g6.state.finalGuess = { index: 0, order: Object.keys(g6.state.chars), done: false };
  for (const cid of Object.keys(g6.state.chars)) {
    const r = await g6.finalGuess(cid, g6.state.chars[cid].role);
    assert(r.ok, "最終決戰猜測執行");
  }
  assert(g6.state.ended === "win", "最終決戰全部正確 → 主人公勝利");

  // FS 多副規則：不應是錯誤，但應有警告
  const s7 = TL.defaultScript("FS");
  s7.subplots = ["shadow_of_the_ripper", "unsettling_rumor"];
  const roles7 = TL.rolesFromScript(s7);
  s7.cast.forEach((e, i) => { e.role = roles7[i] || null; });
  const v7 = TL.validateScript(s7);
  assert(v7.errors.length === 0, "FS 多副規則不應報錯");
  assert(v7.warnings.some(w => w.code === "fs_multi_x"), "FS 多副規則應產生警告");
  assert(v7.warnings.some(w => w.code === "role_cap_merge"), "傳謠人被多個規則要求時應有上限合併警告");
  const eff7 = TL.effectiveRoleCounts(s7);
  assert(eff7.counts.conspiracy_theorist === 1, "傳謠人合計上限為1名");

  // BTX 親友上限：好友圈+潛伏的殺人狂 → 親友合計3名，按上限合併為2名
  const s8 = buildScript({ module: "BTX", mainPlot: "murder_plan", subplots: ["circle_of_friends", "the_hidden_freak"] });
  const v8 = TL.validateScript(s8);
  assert(v8.errors.length === 0, "BTX 親友合併後應合法: " + v8.errors.join("; "));
  assert(v8.warnings.some(w => w.code === "role_cap_merge"), "親友合計超過上限應有合併警告");
  const eff8 = TL.effectiveRoleCounts(s8);
  assert(eff8.counts.friend === 2, "親友按上限合併為2名");
  assert(eff8.merges.some(m => m.role === "friend" && m.total === 3 && m.max === 2), "親友合併信息正確（3→2）");

  // 最黑暗的劇本：暴徒 0-2 人彈性（模組紙標示暴徒②）
  const s9 = buildScript({ module: "FS", mainPlot: "murder_plan", subplots: ["a_hideous_script"] });
  const roles9 = TL.rolesFromScript(s9);
  assert(roles9.filter(r => r === "curmudgeon").length === 2, "最黑暗的劇本應包含暴徒×2");
  const assignCur = (n) => {
    const s = TL.clone(s9);
    const fill = roles9.filter(r => r !== "curmudgeon").concat(Array(n).fill("curmudgeon"));
    s.cast.forEach((e, i) => { e.role = fill[i] || null; });
    for (let i = s.cast.length; i < fill.length; i++) {
      s.cast.push({ characterId: "police_officer", role: fill[i], startLoc: "school" });
    }
    return s;
  };
  assert(TL.validateScript(assignCur(0)).errors.length === 0, "暴徒0名合法");
  assert(TL.validateScript(assignCur(1)).errors.length === 0, "暴徒1名合法");
  assert(TL.validateScript(assignCur(2)).errors.length === 0, "暴徒2名合法");
  const s9bad = assignCur(2);
  s9bad.cast[0].role = "curmudgeon"; s9bad.cast[1].role = "curmudgeon"; s9bad.cast[2].role = "curmudgeon";
  assert(TL.validateScript(s9bad).errors.some(e => e.indexOf("暴徒") >= 0), "暴徒3名應報錯");

  // 官方劇本預設全部應通過驗證（額外身份產生警告而非錯誤）
  assert(PRESETS.length === 2, "官方劇本數量應為2（THE FIRST SCRIPT + PROLOGUE）");
  PRESETS.forEach(function (p) {
    const vp = TL.validateScript(p);
    assert(vp.errors.length === 0, "官方劇本「" + p.title + "」應通過驗證: " + vp.errors.join("; "));
    const expectedExtra = (p.extraRoles || []).length;
    const gotExtra = vp.warnings.filter(w => w.code === "extra_role").length;
    assert(gotExtra === expectedExtra, "官方劇本「" + p.title + "」額外身份警告數應為 " + expectedExtra + "（實際 " + gotExtra + "）");
  });

  console.log("機制專項測試完成 ✓");
}

// 擴展角色（官方）數據與新能力測試：小女孩 / 臨時工？ / 局外人
async function extensionCharTest() {
  const script = TL.defaultScript("BTX");
  script.cast = [
    { characterId: "young_girl", role: null, startLoc: "school" },
    { characterId: "part_time_jobbess", role: null, startLoc: "city" },
    { characterId: "mystery_boy", role: null, startLoc: "school" },
    { characterId: "boy_student", role: null, startLoc: "city" },
    { characterId: "girl_student", role: null, startLoc: "school" }
  ];
  script.incidents = [];
  const logs = [];
  const g = new TL.Game(script, { protagonists: 3, io: makeIO(logs) });
  await g.startGame();

  // 小女孩 友好1：解除禁行
  g.state.chars.young_girl.goodwill = 1;
  await g.execGoodwill({ charId: "young_girl", abilityIdx: 0, ability: CHAR_INDEX.young_girl.goodwill[0] }, "p0", null);
  assert(g.state.plotFlags.youngGirlOpen === true, "小女孩友好1解除禁行");

  // 小女孩 友好3：移動至相鄰版圖（askChoice 回傳 0 → 第一候選）
  g.state.chars.young_girl.goodwill = 3;
  await g.execGoodwill({ charId: "young_girl", abilityIdx: 1, ability: CHAR_INDEX.young_girl.goodwill[1] }, "p0", null);
  assert(g.state.chars.young_girl.loc !== "school", "小女孩友好3移動到相鄰版圖（現於 " + g.state.chars.young_girl.loc + "）");

  // 臨時工？ 友好3：公開自身身份並給同區域他人 +2 友好
  g.state.chars.part_time_jobbess.goodwill = 3;
  g.state.chars.part_time_jobbess.role = "brain";
  await g.execGoodwill({ charId: "part_time_jobbess", abilityIdx: 0, ability: CHAR_INDEX.part_time_jobbess.goodwill[0] }, "p0", { type: "char", id: "boy_student" });
  assert(g.state.chars.part_time_jobbess.roleRevealed === true, "臨時工？公開自身身份");
  assert(g.state.chars.boy_student.goodwill === 2, "臨時工？給同區域角色 +2 友好");

  // 局外人 友好3：第1輪不可用、第2輪可用並公開自身
  g.state.chars.mystery_boy.goodwill = 3;
  assert(!g._usableGoodwill().some(u => u.charId === "mystery_boy"), "局外人第1輪不能使用友好3");
  g.state.loop = 2;
  assert(g._usableGoodwill().some(u => u.charId === "mystery_boy"), "局外人第2輪可使用友好3");
  g.state.chars.mystery_boy.role = "killer";
  await g.execGoodwill({ charId: "mystery_boy", abilityIdx: 0, ability: CHAR_INDEX.mystery_boy.goodwill[0] }, "p0", null);
  assert(g.state.chars.mystery_boy.roleRevealed === true, "局外人公開自身身份");

  // 資料校正：名稱與數值
  assert(CHAR_INDEX.mystery_boy.name === "局外人" && CHAR_INDEX.mystery_boy.paranoiaLimit === 3 && !CHAR_INDEX.mystery_boy.custom, "局外人資料（名稱/不安限度/非擴展）");
  assert(CHAR_INDEX.young_girl.name === "小女孩" && CHAR_INDEX.young_girl.paranoiaLimit === 1 && !CHAR_INDEX.young_girl.custom, "小女孩資料（名稱/不安限度/非擴展）");
  assert(CHAR_INDEX.part_time_jobber.name === "臨時工" && CHAR_INDEX.part_time_jobber.paranoiaLimit === 1 && !CHAR_INDEX.part_time_jobber.custom, "臨時工資料（名稱/不安限度/非擴展）");
  assert(CHAR_INDEX.part_time_jobbess.name === "臨時工？" && CHAR_INDEX.part_time_jobbess.paranoiaLimit === 3 && !CHAR_INDEX.part_time_jobbess.custom, "臨時工？資料（名稱/不安限度/非擴展）");
  assert(CHAR_INDEX.hierarch.name === "教主" && CHAR_INDEX.hierarch.paranoiaLimit === 3 && !CHAR_INDEX.hierarch.custom, "教主資料（高層→教主）");
  assert(CHAR_INDEX.sister.name === "妹妹" && CHAR_INDEX.sister.paranoiaLimit === 3 && !CHAR_INDEX.sister.custom, "妹妹資料（修女→妹妹）");
  assert(CHAR_INDEX.maid.name === "從者" && CHAR_INDEX.maid.paranoiaLimit === 3 && !CHAR_INDEX.maid.custom, "從者資料（女僕→從者）");
  assert(CHAR_INDEX.immortal.name === "仙人" && !CHAR_INDEX.immortal.custom, "仙人資料（永生者→仙人）");
  assert(CHAR_INDEX.uploader.defaultStart === "distant", "Up主初始區域為遠方（場外）");

  console.log("擴展角色校正測試完成 ✓");
}

// 教主 / 妹妹 / 從者 / 仙人 能力測試
async function sectAndServantTest() {
  const script = TL.defaultScript("BTX");
  script.cast = [
    { characterId: "hierarch", role: null, startLoc: "shrine" },
    { characterId: "girl_student", role: null, startLoc: "shrine" },
    { characterId: "office_worker", role: null, startLoc: "shrine" },
    { characterId: "sister", role: null, startLoc: "shrine" },
    { characterId: "maid", role: null, startLoc: "school" },
    { characterId: "boy_student", role: null, startLoc: "school" },
    { characterId: "immortal", role: null, startLoc: "hospital" }
  ];
  script.incidents = [];
  const logs = [];
  const g = new TL.Game(script, { protagonists: 3, io: makeIO(logs) });
  await g.startGame();

  // 教主友好3：目標限於「不安達到或超出限度」的角色
  g.state.chars.hierarch.goodwill = 3;
  g.state.chars.girl_student.paranoia = 3; // 到達限度（3）
  const targets = g.goodwillTargets({ charId: "hierarch", ability: CHAR_INDEX.hierarch.goodwill[0] });
  assert(targets.length === 1 && targets[0].id === "girl_student", "教主友好3目標僅限不安達標角色（實際 " + targets.map(t => t.id).join(",") + "）");
  await g.execGoodwill({ charId: "hierarch", abilityIdx: 0, ability: CHAR_INDEX.hierarch.goodwill[0] }, "p0", { type: "char", id: "girl_student" });
  assert(g.state.chars.girl_student.goodwill === 1, "教主友好3：不安達標角色 +1 友好");
  // 教主友好4：公開不安達標角色身份
  g.state.chars.hierarch.goodwill = 4;
  g.state.chars.girl_student.role = "brain";
  await g.execGoodwill({ charId: "hierarch", abilityIdx: 1, ability: CHAR_INDEX.hierarch.goodwill[1] }, "p0", { type: "char", id: "girl_student" });
  assert(g.state.chars.girl_student.roleRevealed === true, "教主友好4：公開不安達標角色身份");

  // 從者友好4：追加特性適用對象
  g.state.chars.maid.goodwill = 4;
  await g.execGoodwill({ charId: "maid", abilityIdx: 0, ability: CHAR_INDEX.maid.goodwill[0] }, "p0", { type: "char", id: "boy_student" });
  assert((g.state.plotFlags.servantScope || []).indexOf("boy_student") >= 0, "從者友好4：追加對象至特性範圍");

  // 仙人友好5：移動至任意版圖並復活同區域屍體
  g.state.chars.immortal.goodwill = 5;
  g.state.chars.office_worker.alive = false;
  g.state.chars.office_worker.loc = "hospital";
  await g.execGoodwill({ charId: "immortal", abilityIdx: 0, ability: CHAR_INDEX.immortal.goodwill[0] }, "p0", null);
  assert(g.state.chars.immortal.loc === "hospital", "仙人友好5：移動至目標版圖（現於 " + g.state.chars.immortal.loc + "）");
  assert(g.state.chars.office_worker.alive === true, "仙人友好5：復活同區域屍體");

  // 妹妹友好5：同區域成人使用1個友好能力（無視友好數/不可拒絕）
  g.state.chars.hierarch.alive = false; // 避免教主搶先成為被選中的成人
  g.state.chars.office_worker.loc = "shrine";
  g.state.chars.sister.goodwill = 5;
  g.state.chars.office_worker.role = "brain";
  await g.execGoodwill({ charId: "sister", abilityIdx: 0, ability: CHAR_INDEX.sister.goodwill[0] }, "p0", null);
  assert(g.state.chars.office_worker.roleRevealed === true, "妹妹友好5：讓成人（職員）執行其友好能力");

  console.log("教主/妹妹/從者/仙人 能力測試完成 ✓");
}

// AI 劇作家自動對局測試
async function runAITest() {
  TL.AI.setDifficulty("normal");
  const script = TL.clone(PRESET_INDEX.the_first_script);
  const logs = [];
  const g = new TL.Game(script, { protagonists: 3, io: TL.AI.io(makeIO(logs)) });
  g.uiManaged = true;
  TL.AI.ctx.game = g;
  await g.startGame();
  let steps = 0;
  while (g.state.phase !== "game_over" && g.state.phase !== "final_guess" && steps < 500) {
    steps++;
    const st = g.state;
    if (st.phase === "mm_play") {
      const plays = TL.AI.mmPlays(st, g);
      assert(plays.length === 3, "AI 每次打出3張牌（實際 " + plays.length + "）");
      plays.forEach(function (p) {
        const r = g.mmPlayCard(p.card, p.targetType, p.targetId);
        assert(r.ok, "AI 打牌合法 " + p.card + " → " + p.targetId + "：" + (r.msg || ""));
      });
      g.confirmMMPlays();
    } else if (st.phase === "p_play") {
      const targets = Object.keys(st.chars).filter(id => st.chars[id].alive);
      for (let i = 0; i < g.protagonistCount; i++) {
        const decks = g.decksForPlayer(i);
        if (!decks.length || !targets.length) continue;
        const deck = decks[0];
        const cardId = PROTAGONIST_DECK.find(cid => {
          const card = CARD_INDEX[cid];
          return !card.oncePerLoop || !st.used["p" + i][cid];
        });
        const r2 = g.pPlayCard(i, deck, cardId, "char", targets[i % targets.length]);
        assert(r2.ok, "主人公打牌合法：" + (r2.msg || ""));
      }
      g.confirmPPlays();
    } else if (st.phase === "mm_abilities") {
      const acts = TL.AI.mmAbilities(st, g);
      for (const a of acts) await g.execMMAbility(a.entry, a.target || null);
      await g.nextStep();
    } else {
      await g.nextStep();
    }
  }
  assert(steps < 500, "AI 對局在步數內完成（" + steps + " 步）");
  assert(g.state.phase === "game_over" || g.state.phase === "final_guess", "AI 對局正常結束（phase=" + g.state.phase + "，loop=" + g.state.loop + "）");
  assert(g.state.ended === "lose" || g.state.phase === "final_guess", "AI 能阻止主人公（ended=" + g.state.ended + "，phase=" + g.state.phase + "）");
  assert(!g.state.log.some(l => l.text.indexOf("{n}") >= 0 || l.text.indexOf("{d}") >= 0), "日誌無未渲染佔位符（{n}/{d}）");
  const leakTags = [
    "【殺人狂】", "【殺手】", "【時間旅者】", "【邪教徒】", "【主謀】", "【傳謠人】", "【軍人】",
    "【因果線】", "【妄想擴大病毒】", "關鍵人物", "獨處", "主人公死亡：", "【心上人】", "【求愛者】"
  ];
  assert(!g.state.log.some(l => leakTags.some(t => l.text.indexOf(t) >= 0)), "事件記錄不洩漏真實身份/規則名");
  TL.AI.ctx.game = null;
  console.log("AI 劇作家自動對局測試完成 ✓（" + steps + " 步，" + g.state.loop + " 輪）");
}

// 劇本定制 AI 策略測試：兩個保留劇本＋主人公全打禁止密謀（跳過）
async function runStrategyTest() {
  TL.AI.setDifficulty("normal");
  for (const presetId of ["the_first_script", "prologue"]) {
    const script = TL.clone(PRESET_INDEX[presetId]);
    const logs = [];
    const g = new TL.Game(script, { protagonists: 3, io: TL.AI.io(makeIO(logs)) });
    g.uiManaged = true;
    TL.AI.ctx.game = g;
    await g.startGame();
    let steps = 0;
    while (g.state.phase !== "game_over" && g.state.phase !== "final_guess" && steps < 600) {
      steps++;
      const st = g.state;
      if (st.phase === "mm_play") {
        const plays = TL.AI.mmPlays(st, g);
        assert(plays.length === 3, "策略 AI 每次打出3張牌（實際 " + plays.length + "）");
        plays.forEach(function (p) { g.mmPlayCard(p.card, p.targetType, p.targetId); });
        g.confirmMMPlays();
      } else if (st.phase === "p_play") {
        // 主人公跳過：全打禁止密謀（不產生任何有助於防禦的結果）
        const targets = [];
        Object.keys(st.chars).forEach(function (id) {
          if (st.chars[id].alive && st.chars[id].onStage !== false) targets.push({ type: "char", id: id });
        });
        LOCATIONS.forEach(function (l) { if (!l.offBoard) targets.push({ type: "location", id: l.id }); });
        const usedPos = {};
        st.pPlays.forEach(function (p) { usedPos[p.targetType + "|" + p.targetId] = true; });
        for (let i = 0; i < g.protagonistCount; i++) {
          const need = g._playsPerProtagonist(i);
          const have = st.pPlays.filter(function (p) { return p.player === i; }).length;
          const decks = g.decksForPlayer(i);
          const deckUsed = {};
          st.pPlays.filter(function (p) { return p.player === i; }).forEach(function (p) { deckUsed[p.deck] = true; });
          for (let k = 0; k < need - have; k++) {
            const deck = decks.find(function (d) { return !deckUsed[d]; });
            if (deck == null) break;
            const t = targets.find(function (x) { return !usedPos[x.type + "|" + x.id]; });
            if (!t) break;
            const r = g.pPlayCard(i, deck, "p_forbid_intrigue", t.type, t.id);
            assert(r.ok, "跳過打牌合法：" + (r.msg || ""));
            usedPos[t.type + "|" + t.id] = true;
            deckUsed[deck] = true;
          }
        }
        g.confirmPPlays();
      } else if (st.phase === "mm_abilities") {
        const acts = TL.AI.mmAbilities(st, g);
        for (const a of acts) await g.execMMAbility(a.entry, a.target || null);
        await g.nextStep();
      } else {
        await g.nextStep();
      }
    }
    assert(steps < 600, "策略對局在步數內完成（" + steps + " 步）");
    assert(g.state.ended === "lose" || g.state.phase === "final_guess",
      "主人公全跳過時，定制 AI 仍能阻止主人公（" + presetId + "：phase=" + g.state.phase + " ended=" + g.state.ended + " loop=" + g.state.loop + "）");
    console.log("  策略「" + script.title + "」完成 ✓（" + steps + " 步，" + g.state.loop + " 輪）");
  }
  TL.AI.ctx.game = null;
  console.log("劇本定制 AI 策略測試完成 ✓");
}

// 從者（跟隨/代死）與大人物領地
async function servantAndTurfTest() {
  const script = TL.defaultScript("BTX");
  script.turf = "school";
  script.cast = [
    { characterId: "boss", role: null, startLoc: "city" },
    { characterId: "maid", role: null, startLoc: "city" },
    { characterId: "rich_man's_daughter", role: null, startLoc: "city" },
    { characterId: "boy_student", role: null, startLoc: "school" },
    { characterId: "girl_student", role: null, startLoc: "school" },
    { characterId: "doctor", role: null, startLoc: "hospital" }
  ];
  script.incidents = [];
  const logs = [];
  const g = new TL.Game(script, { protagonists: 3, io: makeIO(logs) });
  await g.startGame();

  // 從者代死：殺 boss → 同區域從者死亡，boss 存活
  const dead = await g._applyDeath("boss");
  assert(g.state.chars.maid.alive === false, "從者代死（主人不死）");
  assert(g.state.chars.boss.alive === true, "從者代死後主人存活");
  assert(dead === "maid", "_applyDeath 回傳實際死亡者（從者）");

  // 從者跟隨：主人移動時同區域從者一起移動
  g.state.chars.maid.alive = true;
  g.state.chars.maid.loc = "city";
  g.state.chars.boss.loc = "city";
  await g._applyMovement("boss", "h"); // city → school
  assert(g.state.chars.boss.loc === "school", "大人物移動至 school");
  assert(g.state.chars.maid.loc === "school", "從者跟隨大人物移動");

  // 大人物領地：能力區域視為領地（school）而非所在 city
  g.state.chars.maid.loc = "city";
  const gTargets = g.goodwillTargets({ charId: "boss", ability: CHAR_INDEX.boss.goodwill[0] });
  assert(gTargets.some(t => t.type === "char" && t.id === "boy_student"), "大人物友好能力以領地為區域");
  g.state.chars.boss.role = "brain";
  const mTargets = g.mmAbilityTargets({ charId: "boss", ability: { effect: "brain_intrigue" } });
  assert(mTargets.some(t => t.type === "char" && t.id === "boy_student"), "大人物劇作家能力以領地為區域");
  assert(mTargets.some(t => t.type === "location" && t.id === "school"), "大人物能力可選領地版圖");

  console.log("從者/領地測試完成 ✓");
}

// 特殊登場：神靈（輪迴）、轉校生（日期）、模仿犯、手下（劇作家決定初始）
async function specialCastTest() {
  const script = TL.defaultScript("BTX");
  script.cast = [
    { characterId: "godly_being", role: "witch", startLoc: "shrine", appearLoop: 3 },
    { characterId: "transfer_student", role: null, startLoc: "school", appearDay: 2 },
    { characterId: "copycat", role: null, startLoc: "city", copyTarget: "girl_student" },
    { characterId: "henchman", role: null, startLoc: "" },
    { characterId: "girl_student", role: "brain", startLoc: "school" },
    { characterId: "boy_student", role: null, startLoc: "school" }
  ];
  script.incidents = [];
  const logs = [];
  const g = new TL.Game(script, { protagonists: 3, io: makeIO(logs) });
  await g.startGame();
  assert(g.state.chars.copycat.role === "brain", "模仿犯複製目標身份（brain）");
  assert(g.state.chars.godly_being.onStage === false, "神靈初登場前不上場");
  assert(g.state.chars.transfer_student.onStage === false, "轉校生登場前不上場");
  assert(g.state.chars.henchman.loc === "hospital", "手下初始區域由劇作家決定（makeIO 首目標）");
  assert(!g._aliveChars().some(id => id === "godly_being" || id === "transfer_student"), "未登場角色不可作為目標");
  g.state.loop = 3;
  await g._beginLoop();
  assert(g.state.chars.godly_being.onStage === true, "神靈第3輪登場");
  g._updateOnStage(3, 2);
  assert(g.state.chars.transfer_student.onStage === true, "轉校生第2天登場");
  console.log("特殊登場/模仿/手下測試完成 ✓");
}

// 十周年拒絕規則（拒絕不視為已使用；WM 依特規視為已使用）+ 模仿犯同身份揭示
async function refusalAndCopycatTest() {
  const ioTrue = { log() {}, askChoice: async () => 0, askTarget: async (q) => (q.targets && q.targets[0]) || null, confirm: async () => true };
  const mk = () => {
    const s = TL.defaultScript("FS");
    s.cast = [
      { characterId: "police_officer", role: "killer", startLoc: "city" },
      { characterId: "copycat", role: null, startLoc: "city", copyTarget: "girl_student" },
      { characterId: "girl_student", role: "brain", startLoc: "school" },
      { characterId: "boy_student", role: null, startLoc: "school" },
      { characterId: "doctor", role: null, startLoc: "hospital" }
    ];
    s.incidents = [];
    return s;
  };
  // 十周年（FS）：拒絕後不視為已使用
  const g = new TL.Game(mk(), { protagonists: 3, io: ioTrue });
  await g.startGame();
  g.state.chars.police_officer.goodwill = 4;
  await g.execGoodwill({ charId: "police_officer", abilityIdx: 0, ability: CHAR_INDEX.police_officer.goodwill[0] }, "p0", null);
  assert(!(g.state.usedGoodwill.police_officer || {})[0], "十周年：拒絕後每輪限1次不視為已使用");
  assert(g._usableGoodwill().some(u => u.charId === "police_officer" && u.abilityIdx === 0), "十周年：拒絕後仍可使用");
  // WM：依特規，拒絕後視為已使用
  const sWm = mk();
  sWm.moduleId = "WM";
  const gw = new TL.Game(sWm, { protagonists: 3, io: ioTrue });
  await gw.startGame();
  gw.state.chars.police_officer.goodwill = 4;
  await gw.execGoodwill({ charId: "police_officer", abilityIdx: 0, ability: CHAR_INDEX.police_officer.goodwill[0] }, "p0", null);
  assert(!!(gw.state.usedGoodwill.police_officer || {})[0], "WM：拒絕後視為已使用（特規）");
  // 模仿犯：複製身份 + 同身份揭示（只揭示名字，不揭示身份）
  const gc = new TL.Game(mk(), { protagonists: 3, io: ioTrue });
  await gc.startGame();
  assert(gc.state.chars.copycat.role === "brain", "模仿犯複製目標身份");
  gc.state.chars.copycat.goodwill = 3;
  const beforeLog = gc.state.log.length;
  await gc.execGoodwill({ charId: "copycat", abilityIdx: 0, ability: CHAR_INDEX.copycat.goodwill[0] }, "p0", null);
  assert(gc.state.chars.copycat.sameRoleRevealed === true && gc.state.chars.girl_student.sameRoleRevealed === true,
    "模仿犯揭示同身份角色（含自己）");
  const logText = gc.state.log.slice(beforeLog).map(l => l.text).join(" ");
  assert(logText.indexOf("女學生") >= 0 && logText.indexOf("主謀") < 0, "模仿犯只公開角色名、不公開身份名");
  console.log("拒絕規則/模仿犯測試完成 ✓");
}

(async function () {
  await runFSLoop();
  await runBTXLoop();
  await mechTests();
  await extensionCharTest();
  await sectAndServantTest();
  await runAITest();
  await runStrategyTest();
  await servantAndTurfTest();
  await specialCastTest();
  await refusalAndCopycatTest();
  console.log(failures === 0 ? "\n全部測試通過 ✓" : "\n有 " + failures + " 項失敗 ✗");
  process.exit(failures === 0 ? 0 : 1);
})();
