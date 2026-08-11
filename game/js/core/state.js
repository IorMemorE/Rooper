// 引擎狀態：初始建構 / 輪迴重置 / 登場條件 / 輪迴開始效果調度
window.TL = window.TL || {};

// 輪迴開始效果註冊表（可拆卸：新規則/副規則只需註冊 loopStart 掛鉤）
TL.PLOT_LOOP_START = {};
TL.registerLoopStart = function (plotId, fn) {
  TL.PLOT_LOOP_START[plotId] = fn;
};

TL.Game.prototype._init = function () {
  var s = this.script;
  var chars = {};
  s.cast.forEach(function (entry) {
    chars[entry.characterId] = {
      id: entry.characterId,
      role: entry.role || null,
      baseRole: entry.role || null,
      roleRevealed: false,
      startingLoc: entry.startLoc || CHAR_INDEX[entry.characterId].defaultStart,
      loc: entry.startLoc || CHAR_INDEX[entry.characterId].defaultStart,
      alive: true,
      onStage: true,
      paranoia: 0,
      goodwill: 0,
      intrigue: 0,
      guard: 0,
      becameSerial: false
    };
  });
  // 模仿犯：複製場上另一名角色的身份（無視上限）
  s.cast.forEach(function (entry) {
    if (entry.characterId === "copycat" && entry.copyTarget && chars[entry.copyTarget]) {
      chars.copycat.role = chars[entry.copyTarget].role || null;
      chars.copycat.baseRole = chars.copycat.role;
    }
  });
  var locations = {};
  LOCATIONS.forEach(function (l) { locations[l.id] = { intrigue: 0 }; });
  this.state = {
    phase: "setup",
    day: 1,
    loop: 1,
    leader: 0,
    chars: chars,
    locations: locations,
    mmPlays: [],
    pPlays: [],
    used: { mm: {}, p0: {}, p1: {}, p2: {} },
    usedGoodwill: {},     // charId -> { abilityIdx: true }
    usedGoodwillDay: {},  // 每日使用過的友好能力
    usedMMAbility: {},    // 每日使用過的劇作家能力
    exGauge: 0,           // Ex槽（跨輪迴保留）
    exGaugeIncreased: false, // 本輪輪迴中Ex槽是否增加過（黃衣之王）
    exCards: {},          // charId -> true（本輪輪迴放置的Ex牌）
    prevLoopExGauge: 0,   // 上輪輪迴結束時的Ex槽（隔離病房驚魂記）
    prevLoopDead: [],     // 上輪輪迴結束時處於死亡狀態的角色（魔爪漸近/諸神之骰）
    closedCircles: [],    // { loc, untilDay }：封鎖
    cannotMoveNextDay: {},// charId -> true（可疑信件：次日無法移動）
    houndDogActive: false, // 廷達羅斯之嗅：本輪輪迴剩餘時間已生效
    nextLoopPending: false, // 輪迴失敗且有剩餘輪迴：等待「下一輪輪迴」確認
    plotFlags: {
      unsettledRumorUsed: false,
      butterflyHappened: false,
      prevLoopGoodwill: {},
      patientOpen: false,
      preventDeath: false,
      incidentForbid: {},   // charId -> true (本輪迴)
      magicianMoveUsed: false, // 魔術師移動（所有魔術師合計每輪限1次）
      unsafeTriggerUsed: false, // χ異因子（每輪限1次）
      poisonerKillUsed: false,  // 投毒者夜殺（每輪限1次）
      paranoiacIsKey: false,    // 深淵之都的私語：偏執狂視為關鍵人物
      silverBulletEnd: false,   // 銀色子彈：事件階段結束後本輪輪迴結束
      activeFailPlotId: null    // 瘋狂的真相：切換後的規則Y
    },
    incidentHistory: [],  // {day, loop, incidentId, culpritId, happened}
    log: [],
    feed: [],             // 結算事件流（供界面動畫：move/marker/death/…）
    ended: null,          // 'win' | 'lose'
    finalGuess: null,
    selected: null
  };
  this._updateOnStage(1, 1);
  this._log(TL.I18N.log("loaded", { title: this.script.title, module: TL.modname(this.module.id) }) ||
    "劇本《" + this.script.title + "》已載入（模組 " + this.module.name + "）。");
};

// 登場條件：神靈（初登場輪迴）/ 轉校生（登場日期）等
TL.Game.prototype._updateOnStage = function (loop, day) {
  var self = this;
  (this.script.cast || []).forEach(function (entry) {
    var c = self.state.chars[entry.characterId];
    if (!c) return;
    var appearLoop = entry.appearLoop || 1;
    var appearDay = entry.appearDay || 1;
    c.onStage = loop >= appearLoop && day >= appearDay;
  });
};

TL.Game.prototype._beginLoop = async function () {
  var st = this.state;
  st.ended = null;
  st.day = 1;
  st.leader = 0;
  st.mmPlays = [];
  st.pPlays = [];
  st.used = { mm: {}, p0: {}, p1: {}, p2: {} };
  st.usedGoodwill = {};
  st.usedGoodwillDay = {};
  st.usedMMAbility = {};
  st.exCards = {};
  st.exGaugeIncreased = false;
  st.closedCircles = [];
  st.cannotMoveNextDay = {};
  st.houndDogActive = false;
  st.nextLoopPending = false;
  st.plotFlags.unsettledRumorUsed = false;
  st.plotFlags.butterflyHappened = false;
  st.plotFlags.patientOpen = false;
  st.plotFlags.preventDeath = false;
  st.plotFlags.incidentForbid = {};
  st.plotFlags.magicianMoveUsed = false;
  st.plotFlags.unsafeTriggerUsed = false;
  st.plotFlags.poisonerKillUsed = false;
  st.plotFlags.paranoiacIsKey = false;
  st.plotFlags.silverBulletEnd = false;
  st.plotFlags.activeFailPlotId = null;
  st.incidentHistory = [];
  var self = this;
  Object.keys(st.chars).forEach(function (id) {
    var c = st.chars[id];
    c.role = c.baseRole; // 因果之絆等臨時身份變更在輪迴開始時還原
    c.loc = c.startingLoc;
    c.alive = true;
    c.paranoia = 0;
    c.goodwill = 0;
    c.intrigue = 0;
    c.guard = 0;
    c.becameSerial = false;
  });
  this._updateOnStage(st.loop, 1);
  LOCATIONS.forEach(function (l) { st.locations[l.id].intrigue = 0; });
  // 手下：每輪輪迴開始由劇作家決定初始區域（劇本編輯時為空）
  var henchman = (this.script.cast || []).filter(function (e) { return e.characterId === "henchman" && !e.startLoc; })[0];
  if (henchman && st.chars.henchman) {
    var henchTargets = LOCATIONS.filter(function (l) { return !l.offBoard; }).map(function (l) {
      return { type: "location", id: l.id, label: TL.t("game.pTarget", { loc: TL.lname(l.id) }) };
    });
    var henchLoc = await this.io.askTarget({
      owner: "mm",
      kind: "henchman_loc",
      title: TL.t("game.henchmanLocTitle"),
      text: TL.t("game.henchmanLocText"),
      targets: henchTargets
    });
    st.chars.henchman.loc = (henchLoc && henchLoc.id) ? henchLoc.id : "city";
  }
  this._log(TL.I18N.log("loopStart", { n: st.loop, total: this.script.loops }) || ("— 第" + st.loop + "輪輪迴開始（共" + this.script.loops + "輪）—"));
  // 輪迴開始效果
  await this._loopStartEffects();
  st.phase = "day_start";
};

// 輪迴開始效果調度：親友常駐 + 已註冊的規則/副規則掛鉤
TL.Game.prototype._loopStartEffects = async function () {
  var st = this.state;
  var self = this;
  // 親友：身份被公開過 → 獲得1枚友好（角色能力，常駐）
  Object.keys(st.chars).forEach(function (id) {
    var c = st.chars[id];
    if (c.alive && c.onStage !== false && c.role === "friend" && c.roleRevealed) {
      c.goodwill += 1;
      self._log(TL.I18N.log("friendReveal", { char: self._charName(id) }) || ("【親友】" + self._charName(id) + "的身份已被公開，獲得1枚[友好]。"));
    }
  });
  var ids = [this.script.mainPlot].concat(this.script.subplots || []);
  for (var i = 0; i < ids.length; i++) {
    var fn = TL.PLOT_LOOP_START[ids[i]];
    if (fn) await fn(this);
  }
};

// Ex槽1+ 感應咒文：第1天回合開始階段，隊長可選擇任意1名角色放置2枚[友好]
TL.Game.prototype._exIncantation = async function () {
  var st = this.state;
  var self = this;
  var targets = Object.keys(st.chars).filter(function (id) {
    return st.chars[id].alive && st.chars[id].onStage !== false;
  }).map(function (id) { return { type: "char", id: id, label: self._charName(id) }; });
  var t = await this.io.askTarget({
    title: TL.L("exIncantationTitle") || "感應咒文",
    text: TL.L("exIncantationText") || "Ex槽1以上：隊長可以選擇任意1名角色，在該角色身上放置2枚[友好]。",
    targets: targets
  });
  if (t) {
    st.chars[t.id].goodwill += 2;
    this._feed({ type: "marker", id: t.id, kind: "goodwill", delta: 2, value: st.chars[t.id].goodwill });
    this._log(TL.L("exIncantationLog", { char: this._charName(t.id) }) ||
      ("【感應咒文】" + this._charName(t.id) + " 友好+2（" + st.chars[t.id].goodwill + "）。"));
  }
};
