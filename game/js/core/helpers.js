// 引擎通用工具方法（資料讀取 / 角色狀態 / 區域 / 判定 / Ex 槽與 Ex 牌）
window.TL = window.TL || {};

// ---------- 日誌與事件流 ----------
TL.Game.prototype._log = function (msg) {
  this.state.log.push({ text: msg, day: this.state.day, loop: this.state.loop });
};

TL.Game.prototype._feed = function (ev) {
  this.state.feed.push(ev);
};

// ---------- 資料讀取 ----------
TL.Game.prototype._char = function (id) {
  return this.state.chars[id];
};

TL.Game.prototype._charData = function (id) {
  return CHAR_INDEX[id];
};

TL.Game.prototype._role = function (charId) {
  var c = this._char(charId);
  // 臨時工：身份視為平民（除非被「因果之絆」等效果覆寫為其它身份）
  if (charId === "part_time_jobber" && c && c.role && c.role === c.baseRole) return null;
  return c && c.role ? ROLE_INDEX[c.role] : null;
};

TL.Game.prototype._aliveChars = function (loc) {
  var self = this;
  return Object.keys(this.state.chars).filter(function (id) {
    var c = self.state.chars[id];
    return c.alive && c.onStage !== false && (!loc || c.loc === loc);
  });
};

TL.Game.prototype._charsIn = function (loc) {
  return this._aliveChars(loc);
};

TL.Game.prototype._charName = function (id) {
  return TL.cname(id);
};

TL.Game.prototype._locName = function (id) {
  return TL.lname(id);
};

TL.Game.prototype._hasSubplot = function (id) {
  return this.script.subplots.indexOf(id) >= 0;
};

// ---------- 區域 / 移動判定 ----------
// 該角色是否正被劇作家的移動牌移動（AI 需要接管方向抉擇）
TL.Game.prototype._isMMMove = function (cid) {
  return this.state.mmPlays.some(function (p) {
    return p.targetType === "char" && p.targetId === cid &&
      (p.card === "m_move_h" || p.card === "m_move_v" || p.card === "m_move_d");
  });
};

// 角色能力的有效區域：大人物可把領地視為其所在區域
TL.Game.prototype._charArea = function (charId) {
  if (charId === "boss" && this.script.turf && this.state.chars[charId]) return this.script.turf;
  return this.state.chars[charId] ? this.state.chars[charId].loc : null;
};

// 事件結算時當事人的「有效區域」：雙胞胎視為位於本位置對角線上的版圖
TL.Game.prototype._incidentArea = function (charId) {
  var c = this._char(charId);
  if (!c) return null;
  if (c.role === "twin" && c.alive) {
    var d = ADJ[c.loc] && ADJ[c.loc].d;
    if (d && d.length) return d[0];
  }
  return c.loc;
};

// 封鎖：該版圖在封鎖天數內不可移動進入/離開
TL.Game.prototype._locBlocked = function (locId) {
  var st = this.state;
  return (st.closedCircles || []).some(function (c) {
    return c.loc === locId && st.day <= c.untilDay;
  });
};

// ---------- 身份 / 特性判定 ----------
TL.Game.prototype._isUndying = function (charId) {
  var c = this._char(charId);
  if (!c) return false;
  // 紙老虎：2枚以上[不安]→失去不死
  if (c.role === "paper_tiger" && this._effParanoia(charId) >= 2) return false;
  var role = this._role(charId);
  if (role && role.undying) return true;
  var data = this._charData(charId);
  if (data && data.traits.indexOf("不死") >= 0) return true;
  return false;
};

TL.Game.prototype._isCultist = function (charId) {
  var c = this._char(charId);
  return !!c && c.role === "cultist" && c.alive;
};

// ---------- 十周年：希望/绝望指示物計數 ----------
// 希望：計為1友好、對密謀-1（最低0）、移除無視友好
// 絕望：計為1不安+1密謀、賦予必定無視友好
TL.Game.prototype._effParanoia = function (charId) {
  var c = this._char(charId);
  if (!c) return 0;
  return (c.paranoia || 0) + (c.despair || 0);
};

TL.Game.prototype._effGoodwill = function (charId) {
  var c = this._char(charId);
  if (!c) return 0;
  return (c.goodwill || 0) + (c.hope || 0);
};

TL.Game.prototype._effIntrigueChar = function (charId) {
  var c = this._char(charId);
  if (!c) return 0;
  return Math.max(0, (c.intrigue || 0) + (c.despair || 0) - (c.hope || 0));
};

// 角色身上的「種類」數量（AHR 的空想擴大病毒 / 提線木偶等需要）
TL.Game.prototype._counterKinds = function (charId) {
  var c = this._char(charId);
  if (!c) return [];
  var kinds = [];
  if (c.paranoia > 0) kinds.push("paranoia");
  if (c.goodwill > 0) kinds.push("goodwill");
  if (c.intrigue > 0) kinds.push("intrigue");
  if (c.hope > 0) kinds.push("hope");
  if (c.despair > 0) kinds.push("despair");
  if (c.guard > 0) kinds.push("guard");
  return kinds;
};

// 無視友好判定：hope 優先於 despair；否則絕望賦予必定無視友好
TL.Game.prototype._refusalOf = function (charId) {
  var c = this._char(charId);
  if (!c) return "none";
  if ((c.hope || 0) > 0) return "none";
  var role = this._role(charId);
  var base = (c.despair || 0) > 0 ? "mandatory" : (role ? role.refusal || "none" : "none");
  // 紙老虎：2枚以上[不安]→必定無視友好
  if (c.role === "paper_tiger" && this._effParanoia(charId) >= 2) base = "mandatory";
  // AHR 傀儡之線：所有無視友好（含絕望附加的必定無視友好）變為傀儡無視友好
  if (this._hasSubplot("puppeteers_strings") && base !== "none") return "puppeted";
  return base;
};

// 從者的保護對象：大人物/大小姐 + 追加對象
TL.Game.prototype._servantScope = function () {
  return ["boss", "rich_man's_daughter"].concat(this.state.plotFlags.servantScope || []);
};

// 若 charId 是從者保護對象且同區域有存活的從者，回傳該從者 id
TL.Game.prototype._servantProtector = function (charId) {
  var st = this.state;
  var scope = this._servantScope();
  if (scope.indexOf(charId) < 0) return null;
  var c = st.chars[charId];
  if (!c || !c.alive) return null;
  var found = null;
  Object.keys(st.chars).forEach(function (id) {
    if (found) return;
    var oc = st.chars[id];
    if (!oc.alive || id === charId || id !== "maid") return;
    if (oc.loc === c.loc) found = id;
  });
  return found;
};

// 該角色是否被 Ex 牌 / 特性禁止由劇作家設置行動牌（永生者等）
TL.Game.prototype._noMMCards = function (charId) {
  var c = this._char(charId);
  if (!c) return false;
  var role = this._role(charId);
  if (role && role.abilities.some(function (ab) { return ab.effect === "immortal_no_cards"; })) return true;
  var data = this._charData(charId);
  if (data && data.specials && data.specials.some(function (s) { return s.indexOf("不能放置行動卡") >= 0; })) return true;
  return false;
};

// ---------- 事件判定（是否發生 / 有效數值） ----------
// 事件是否發生的判定數值（密謀視作不安等）
TL.Game.prototype._incidentCount = function (def, culpritId) {
  var st = this.state;
  var c = st.chars[culpritId];
  if (!c) return 0;
  // A.I.：判定事件觸發時，該角色身上所有標記視為[不安]
  if (culpritId === "ai") {
    return (c.paranoia || 0) + (c.goodwill || 0) + (c.intrigue || 0) + (c.hope || 0) + (c.despair || 0);
  }
  // 陰謀活動 / 廷達羅斯之嗅 / 空想事件：通過密謀指示物數量判定是否發生
  if (def.id === "conspiracies" || def.id === "hound_dog_scent" || def.id === "phantasmal_incident") return c.intrigue || 0;
  // 祭品：判定其擔任當事人的事件是否發生時，[密謀]視為[不安]處理
  if (c.role === "sacrifice") return (c.paranoia || 0) + (c.intrigue || 0);
  // 士的寧毒液：判定「連續殺人」「自殺」是否發生時，[密謀]視作[不安]處理
  if (this.script.mainPlot === "drop_of_strychnine" && (def.id === "serial_murder" || def.id === "suicide")) {
    return (c.paranoia || 0) + (c.intrigue || 0);
  }
  // AHR：裏世界（Ex槽為奇數）時，通過友好指示物數量判定事件是否發生
  if (this.module && this.module.id === "AHR" && (st.exGauge % 2) === 1) {
    return this._effGoodwill(culpritId);
  }
  // 絕望指示物計入不安；希望指示物計入友好
  var base = c.paranoia || 0;
  if (c.despair > 0) base += c.despair;
  // 希望之光：通過友好指示物判定是否發生
  if (def.id === "the_light_of_hope") return this._effGoodwill(culpritId);
  return base;
};

// 事件判定用密謀數量（絕望計入、希望抵銷，最低0）
TL.Game.prototype._intrigueCount = function (charId) {
  var c = this._char(charId);
  if (!c) return 0;
  return this._effIntrigueChar(charId);
};

// 版圖密謀數量（LL 封印的終末：該區域角色身上的希望/絕望也計入版圖）
TL.Game.prototype._locIntrigueWithHeroes = function (locId) {
  var st = this.state;
  var n = st.locations[locId] ? st.locations[locId].intrigue : 0;
  if (this.script.mainPlot === "the_sealed_conclusion") {
    Object.keys(st.chars).forEach(function (id) {
      var c = st.chars[id];
      if (c.loc === locId) n += (c.hope || 0) + (c.despair || 0);
    });
  }
  return n;
};

// 角色身上的總指示物數量（臨時工：3枚或以上→死亡）
TL.Game.prototype._totalCounters = function (charId) {
  var c = this._char(charId);
  if (!c) return 0;
  return (c.paranoia || 0) + (c.goodwill || 0) + (c.intrigue || 0) + (c.guard || 0) + (c.hope || 0) + (c.despair || 0);
};

// AHR：世界移動（Ex槽+1，僅在回合結束階段開始時結算）
TL.Game.prototype._triggerWarp = function (silent) {
  var st = this.state;
  st.warpsTriggered = true;
  if (!silent) {
    this._log(TL.L("warpTriggered") || "【世界移動】本日觸發了世界移動。");
  }
};

// 是否為裏世界（AHR：Ex槽為奇數）
TL.Game.prototype._isDarkWorld = function () {
  return (this.state.exGauge % 2) === 1;
};

// 當前世界名
TL.Game.prototype._worldName = function () {
  return this._isDarkWorld() ? (TL.L("worldDark") || "裏世界") : (TL.L("worldLight") || "表世界");
};

// 事件的當事人不安限度（含 ±1 修正）
TL.Game.prototype._incidentLimit = function (def, culpritId) {
  var st = this.state;
  var data = this._charData(culpritId);
  var limit = data.paranoiaLimit;
  if (def.id === "portent" || def.id === "the_executioner" || def.id === "crime_of_passion") limit -= 1;
  if (def.id === "bestial_murder") limit += 1;
  // HSA 群眾事件：以版圖上的屍體數量判定（當事人為版圖，此處不適用角色限度）
  if (def.mobIncident) return 0;
  // 滅亡謳歌：當事人的身份為平民的事件在判定是否發生時，如果預言家存活，該當事人的不安限度－1
  if (this._hasSubplot("worshippers_of_the_apocalypse") && !st.chars[culpritId].role) {
    var prophets = this._aliveChars().filter(function (id) { return st.chars[id].role === "prophet"; });
    if (prophets.length) limit -= 1;
  }
  return limit;
};

// 偵探：Ex槽為0且與當天事件當事人（存活）同一區域 → 事件必定發生
TL.Game.prototype._detectiveForce = function (culpritId) {
  var st = this.state;
  if (st.exGauge > 0) return false;
  var culprit = st.chars[culpritId];
  if (!culprit || !culprit.alive) return false;
  return this._aliveChars().some(function (id) {
    return st.chars[id].role === "detective" && st.chars[id].loc === culprit.loc;
  });
};

// 預言家：與該角色位於同一區域的其他角色不會觸發事件
TL.Game.prototype._prophetBlocks = function (culpritId) {
  var st = this.state;
  var culprit = st.chars[culpritId];
  if (!culprit || culprit.role === "prophet") return false;
  return this._aliveChars().some(function (id) {
    return st.chars[id].role === "prophet" && st.chars[id].loc === culprit.loc;
  });
};

// ---------- Ex 槽 / Ex 牌 ----------
TL.Game.prototype._addExGauge = function (n) {
  var st = this.state;
  var delta = n || 0;
  st.exGauge = Math.max(0, (st.exGauge || 0) + delta);
  if (delta > 0) st.exGaugeIncreased = true;
  this._feed({ type: "ex_gauge", delta: delta, value: st.exGauge });
  this._log(TL.L("exGauge", { n: delta, v: st.exGauge }) ||
    ("Ex槽" + (delta >= 0 ? "+" : "") + delta + "（" + st.exGauge + "）。"));
  return st.exGauge;
};

TL.Game.prototype._placeExCard = function (charId) {
  var st = this.state;
  var c = st.chars[charId];
  if (!c) return false;
  st.exCards[charId] = true;
  this._feed({ type: "ex_card", id: charId, on: true });
  this._log(TL.L("exCardPlaced", { char: this._charName(charId) }) ||
    ("往" + this._charName(charId) + "身上放置了1張Ex牌。"));
  // 因果之絆：放置了Ex牌的角色，其身份變為關鍵人物（該角色失去原本的身份）
  if (this.script.mainPlot === "fated_connections" && c.role !== "key_person") {
    c.role = "key_person";
    this._log(TL.L("fatedConnections", { char: this._charName(charId) }) ||
      ("【因果之絆】" + this._charName(charId) + "的身份變為關鍵人物。"));
  }
  return true;
};

TL.Game.prototype._exCardChars = function () {
  var st = this.state;
  return Object.keys(st.exCards).filter(function (id) { return !!st.exCards[id]; });
};

// ---------- 十周年：額外手牌（希望+1 / 絕望+1 / 不安+2 / 友好+1） ----------
TL.Game.prototype._addMMHandCard = function (cardId) {
  var st = this.state;
  if (!st.mmHandExtra) st.mmHandExtra = [];
  if (st.mmHandExtra.indexOf(cardId) < 0) st.mmHandExtra.push(cardId);
  this._log(TL.L("mmGotCard", { card: TL.cardname(cardId) }) ||
    ("劇作家獲得「" + TL.cardname(cardId) + "」行動牌。"));
};

TL.Game.prototype._addPHandCard = function (deck, cardId) {
  var st = this.state;
  var d = "p" + (deck == null ? 0 : deck);
  if (!st.pHandExtra) st.pHandExtra = {};
  if (!st.pHandExtra[d]) st.pHandExtra[d] = [];
  if (st.pHandExtra[d].indexOf(cardId) < 0) st.pHandExtra[d].push(cardId);
  this._log(TL.L("pGotCard", { card: TL.cardname(cardId), deck: ["A", "B", "C"][deck] || deck }) ||
    ("主人公" + (["A", "B", "C"][deck] || deck) + "獲得「" + TL.cardname(cardId) + "」行動牌。"));
};

// 臨時工？：回合開始階段，若臨時工為死亡狀態 → 在都市放置臨時工？
TL.Game.prototype._partTimerSpawn = async function () {
  var st = this.state;
  var pt = st.chars.part_time_jobber;
  if (!pt || pt.alive) return;
  var pq = st.chars.part_time_jobbess;
  if (pq && (pq.alive || pq.perished)) return; // 已存在則不再放置（每局僅1名）
  var role = this._role("part_time_jobber");
  if (!pq) {
    var base = {
      id: "part_time_jobbess",
      role: role ? role.id : null,
      baseRole: role ? role.id : null,
      roleRevealed: false,
      startingLoc: "city",
      loc: "city",
      alive: true,
      onStage: true,
      paranoia: 0, goodwill: 0, intrigue: 0, guard: 0,
      hope: 0, despair: 0,
      perished: false, acquainted: false, acquaintedRefused: false,
      loyaltyOn: false,
      becameSerial: false
    };
    st.chars.part_time_jobbess = base;
  } else {
    pq.alive = true;
    pq.loc = "city";
    pq.role = role ? role.id : null;
    pq.baseRole = role ? role.id : null;
    pq.roleRevealed = false;
    pq.paranoia = 0; pq.goodwill = 0; pq.intrigue = 0; pq.guard = 0;
    pq.hope = 0; pq.despair = 0;
  }
  this._feed({ type: "spawn", id: "part_time_jobbess", loc: "city" });
  this._log(TL.L("partTimerQSpawn") || "【臨時工？】臨時工死亡，下一天早晨在都市放置「臨時工？」。");
};

// ---------- 身份公開（忍者假揭示） ----------
TL.Game.prototype._scriptRolePool = function () {
  var out = [];
  var main = PLOT_INDEX[this.script.mainPlot];
  var subs = this.script.subplots.map(function (id) { return PLOT_INDEX[id]; });
  [main].concat(subs).forEach(function (p) {
    if (!p) return;
    (p.roles || []).forEach(function (r) { if (out.indexOf(r) < 0) out.push(r); });
  });
  (this.script.cast || []).forEach(function (e) {
    if (e.role && out.indexOf(e.role) < 0) out.push(e.role);
  });
  return out;
};

TL.Game.prototype._revealRole = async function (charId) {
  var c = this.state.chars[charId];
  if (!c || !c.role) {
    this._log(TL.L("roleRevealCommoner", { char: this._charName(charId) }) ||
      (this._charName(charId) + "的身份是平民。"));
    return;
  }
  // 忍者：需公開該角色身份時，可以宣稱非公開信息表中的任意非平民身份名
  if (c.role === "ninja" && !c.roleRevealed) {
    var fakePool = this._scriptRolePool().filter(function (rid) { return rid !== "ninja"; });
    if (fakePool.length) {
      var useFake = await this.io.confirm({
        title: TL.rname("ninja"),
        text: TL.L("ninjaFakePrompt", { char: this._charName(charId) }) ||
          (this._charName(charId) + "（忍者）的身份需要公開。是否宣稱其它非平民身份名？"),
        owner: "mm",
        kind: "ninja_fake",
        charId: charId
      });
      if (useFake) {
        var fi = await this.io.askChoice({
          title: TL.rname("ninja"),
          text: TL.L("ninjaFakePick", { char: this._charName(charId) }) ||
            (this._charName(charId) + "宣稱什麼身份？"),
          options: fakePool.map(function (rid) { return TL.rname(rid); }),
          owner: "mm"
        });
        var fake = fakePool[fi == null ? 0 : fi];
        c.revealedRole = fake;
        c.roleRevealed = true;
        this._log(TL.L("roleReveal", { char: this._charName(charId), role: TL.rname(fake) }) ||
          ("【身份公開】" + this._charName(charId) + "的身份是「" + ROLE_INDEX[fake].name + "」。"));
        return;
      }
    }
  }
  c.roleRevealed = true;
  this._log(TL.L("roleReveal", { char: this._charName(charId), role: TL.rname(c.role) }) ||
    ("【身份公開】" + this._charName(charId) + "的身份是「" + ROLE_INDEX[c.role].name + "」。"));
};
