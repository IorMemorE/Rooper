// 回合結束 / 輪迴結束 / 失敗條件（可拆卸：回合步驟、輪末掛鉤、規則檢查器皆可註冊）
window.TL = window.TL || {};

// 回合結束步驟註冊表（依 priority 排序執行；任一步驟使 ended 非空即停止）
TL.DAY_END_STEPS = [];
TL.registerDayEndStep = function (id, priority, fn) {
  TL.DAY_END_STEPS.push({ id: id, priority: priority, fn: fn });
  TL.DAY_END_STEPS.sort(function (a, b) { return a.priority - b.priority; });
};

// 輪末掛鉤（先祖記憶等）
TL.LOOP_END_HOOKS = [];
TL.registerLoopEndHook = function (id, fn) {
  TL.LOOP_END_HOOKS.push({ id: id, fn: fn });
};

// 規則Y失敗條件檢查器：rule.type -> fn(game, rule, plot) -> string | null
TL.RULE_CHECKERS = {};
TL.registerRuleChecker = function (type, fn) {
  TL.RULE_CHECKERS[type] = fn;
};

// 特殊規則Y失敗條件（動態 X / 特殊判定）：plotId -> fn(game) -> string | null
TL.PLOT_FAIL = {};
TL.registerPlotFail = function (plotId, fn) {
  TL.PLOT_FAIL[plotId] = fn;
};

// 副規則失敗條件：plotId -> fn(game) -> string | null
TL.SUBPLOT_FAIL = {};
TL.registerSubplotFail = function (plotId, fn) {
  TL.SUBPLOT_FAIL[plotId] = fn;
};

// 失敗條件描述（i18n）
function failDesc(plot) {
  return plot ? TL.desc("plot." + plot.id, plot.desc) : "";
}

// ---------- 回合結束階段 ----------
TL.Game.prototype._dayEndPhase = async function () {
  var st = this.state;
  this._log(TL.L("dayEnd", { n: st.day }) || ("—— 第" + st.day + "天 回合結束階段（夜間）——"));
  for (var i = 0; i < TL.DAY_END_STEPS.length; i++) {
    await TL.DAY_END_STEPS[i].fn(this);
    if (st.ended) return;
  }
};

// 妄想擴大病毒：平民3枚以上不安 → 身份變為殺人狂
TL.registerDayEndStep("paranoia_virus", 0, async function (g) {
  var st = g.state;
  if (!g._hasSubplot("paranoia_virus")) return;
  Object.keys(st.chars).forEach(function (id) {
    var c = st.chars[id];
    if (c.alive && !c.role && c.paranoia >= 3 && !c.becameSerial) {
      c.becameSerial = true;
      g._log(TL.L("paranoiaVirus", { char: g._charName(id) }) ||
        (g._charName(id) + "（平民）不安3枚以上，身份變為殺人狂。"));
    }
  });
});

// 強制：殺人狂
TL.registerDayEndStep("serial_kill", 10, async function (g) {
  var st = g.state;
  var serials = g._aliveChars().filter(function (id) { return st.chars[id].role === "serial_killer" || st.chars[id].becameSerial; });
  for (var i = 0; i < serials.length; i++) {
    var sid = serials[i];
    var others = g._aliveChars(st.chars[sid].loc).filter(function (id) { return id !== sid; });
    if (others.length === 1) {
      g._log(TL.L("serialKill", { char: g._charName(sid), char2: g._charName(others[0]) }) ||
        (g._charName(others[0]) + "死亡。"));
      await g._applyDeath(others[0]);
    }
  }
});

// 強制：投毒者（Ex槽2+ → 同區域1名角色死亡，每輪限1次）
TL.registerDayEndStep("poisoner_kill", 20, async function (g) {
  var st = g.state;
  var poisoners = g._aliveChars().filter(function (id) { return st.chars[id].role === "poisoner"; });
  for (var pi = 0; pi < poisoners.length && !st.plotFlags.poisonerKillUsed; pi++) {
    var pid = poisoners[pi];
    if (st.exGauge < 2) break;
    var pArea = g._charArea(pid);
    var pTargets = g._aliveChars(pArea).filter(function (id) { return id !== pid; })
      .map(function (id) { return { type: "char", id: id, label: g._charName(id) }; });
    if (!pTargets.length) { g._log(TL.L("poisonerNoTarget", { char: g._charName(pid) }) || (g._charName(pid) + "所在區域沒有可殺害的角色。")); continue; }
    var pt = await g.io.askTarget({
      title: TL.rname("poisoner"),
      text: TL.L("poisonerPrompt", { char: g._charName(pid) }) || (g._charName(pid) + "（投毒者）選擇同一區域的1名角色：那名角色死亡。"),
      targets: pTargets,
      owner: "mm"
    });
    if (pt) {
      st.plotFlags.poisonerKillUsed = true;
      g._log(TL.L("poisonerKillLog", { char: g._charName(pid), char2: g._charName(pt.id) }) ||
        (g._charName(pt.id) + "死亡。"));
      await g._applyDeath(pt.id);
    }
  }
});

// 強制：投毒者（Ex槽4+ → 主人公死亡）
TL.registerDayEndStep("poisoner_kill_p", 30, async function (g) {
  var st = g.state;
  if (st.exGauge >= 4 && g._aliveChars().some(function (id) { return st.chars[id].role === "poisoner"; })) {
    await g._protagonistDeath("投毒者（Ex槽4以上）");
  }
});

// 強制：目擊者（4枚以上[不安] → 該角色死亡，Ex槽增加1）
TL.registerDayEndStep("witness_death", 40, async function (g) {
  var st = g.state;
  var witnesses = g._aliveChars().filter(function (id) { return st.chars[id].role === "witness"; });
  for (var w = 0; w < witnesses.length; w++) {
    var wid = witnesses[w];
    if (st.chars[wid].paranoia >= 4) {
      g._log(TL.L("witnessDeath", { char: g._charName(wid) }) ||
        (g._charName(wid) + "（目擊者）不安4枚以上，死亡。"));
      await g._applyDeath(wid);
      g._addExGauge(1);
    }
  }
});

// Ex槽4+ 發狂：回合結束階段主人公死亡
TL.registerDayEndStep("ex4_madness", 50, async function (g) {
  if (g.state.exGauge >= 4) {
    await g._protagonistDeath("Ex槽4以上的發狂");
  }
});

// 任意：殺手（關鍵人物/主人公）
TL.registerDayEndStep("killer", 60, async function (g) {
  var st = g.state;
  var killers = g._aliveChars().filter(function (id) { return st.chars[id].role === "killer"; });
  for (var k = 0; k < killers.length; k++) {
    var kid = killers[k];
    var kp = Object.keys(st.chars).filter(function (id) { return st.chars[id].alive && st.chars[id].role === "key_person" && st.chars[id].loc === st.chars[kid].loc && st.chars[id].intrigue >= 2; });
    if (kp.length) {
      var yes = await g.io.confirm({
        title: TL.rname("killer"),
        text: TL.L("killerKillKey", { char: g._charName(kid), char2: g._charName(kp[0]) }) ||
          (g._charName(kid) + "（殺手）是否殺害關鍵人物" + g._charName(kp[0]) + "？（同一區域且關鍵人物有2枚以上密謀）"),
        owner: "mm",
        kind: "night",
        subKind: "killer_kp"
      });
      if (yes) {
        g._log(TL.L("killerKillLog", { char: g._charName(kid), char2: g._charName(kp[0]) }) ||
          (g._charName(kp[0]) + "死亡。"));
        await g._applyDeath(kp[0]);
      }
    }
    if (st.ended) return;
    if (st.chars[kid].intrigue >= 4) {
      var yes2 = await g.io.confirm({
        title: TL.rname("killer"),
        text: TL.L("killerKillP", { char: g._charName(kid) }) ||
          (g._charName(kid) + "（殺手）身上有4枚以上密謀，是否殺害主人公？"),
        owner: "mm",
        kind: "night",
        subKind: "killer_p"
      });
      if (yes2) await g._protagonistDeath("殺手的能力");
    }
    if (st.ended) return;
  }
});

// 任意：求愛者
TL.registerDayEndStep("lover", 70, async function (g) {
  var st = g.state;
  var lovers = g._aliveChars().filter(function (id) { return st.chars[id].role === "lover"; });
  for (var l = 0; l < lovers.length; l++) {
    var lid = lovers[l];
    if (st.chars[lid].intrigue >= 1 && st.chars[lid].paranoia >= 3) {
      var yes3 = await g.io.confirm({
        title: TL.rname("lover"),
        text: TL.L("loverKillP", { char: g._charName(lid) }) ||
          (g._charName(lid) + "（求愛者）有1枚以上密謀且3枚以上不安，是否殺害主人公？"),
        owner: "mm",
        kind: "night",
        subKind: "lover"
      });
      if (yes3) await g._protagonistDeath("求愛者的能力");
    }
    if (st.ended) return;
  }
});

// 時間旅者（最終日）
TL.registerDayEndStep("time_traveler", 80, async function (g) {
  var st = g.state;
  if (st.day < g.script.days) return;
  var tts = g._aliveChars().filter(function (id) { return st.chars[id].role === "time_traveler"; });
  for (var t = 0; t < tts.length; t++) {
    var tid = tts[t];
    if (st.chars[tid].goodwill <= 2) {
      var yes4 = await g.io.confirm({
        title: TL.rname("time_traveler"),
        text: TL.L("ttFinalFail", { char: g._charName(tid) }) ||
          (g._charName(tid) + "（時間旅者）的友好為2枚或以下，是否宣告主人公失敗？"),
        owner: "mm",
        kind: "night",
        subKind: "tt"
      });
      if (yes4) {
        g._log(TL.L("ttFailLog", { char: g._charName(tid) }) ||
          (g._charName(tid) + "宣告主人公失敗。"));
        st.ended = "lose";
        st.phase = "loop_end";
        return;
      }
    }
  }
});

// ---------- 規則Y失敗條件判定 ----------
TL.Game.prototype._mainFailLosses = function () {
  var st = this.state;
  var main = PLOT_INDEX[st.plotFlags.activeFailPlotId || this.script.mainPlot] || PLOT_INDEX[this.script.mainPlot];
  var losses = [];
  if (!main) return losses;
  var special = TL.PLOT_FAIL[main.id];
  if (special) {
    var s = special(this);
    if (s) losses.push(s);
    return losses;
  }
  var checker = main.rule && TL.RULE_CHECKERS[main.rule.type];
  if (checker) {
    var hit = checker(this, main.rule, main);
    if (hit) losses.push(hit);
  }
  return losses;
};

TL.registerRuleChecker("intrigue_on_location", function (g, rule) {
  if (g.state.locations[rule.location].intrigue >= rule.count) return failDesc(PLOT_INDEX[g.state.plotFlags.activeFailPlotId || g.script.mainPlot]);
  return null;
});
TL.registerRuleChecker("intrigue_on_start_location", function (g, rule) {
  var st = g.state;
  var holders = Object.keys(st.chars).filter(function (id) { return st.chars[id].role === rule.role; });
  for (var i = 0; i < holders.length; i++) {
    if (st.locations[st.chars[holders[i]].startingLoc].intrigue >= rule.count) {
      return failDesc(PLOT_INDEX[st.plotFlags.activeFailPlotId || g.script.mainPlot]);
    }
  }
  return null;
});
TL.registerRuleChecker("intrigue_on_role", function (g, rule) {
  var st = g.state;
  var holders = Object.keys(st.chars).filter(function (id) { return st.chars[id].role === rule.role; });
  for (var i = 0; i < holders.length; i++) {
    if ((st.chars[holders[i]].intrigue || 0) >= rule.count) {
      return failDesc(PLOT_INDEX[st.plotFlags.activeFailPlotId || g.script.mainPlot]);
    }
  }
  return null;
});
TL.registerRuleChecker("butterfly_happened", function (g) {
  if (g.state.plotFlags.butterflyHappened) return failDesc(PLOT_INDEX[g.state.plotFlags.activeFailPlotId || g.script.mainPlot]);
  return null;
});
TL.registerRuleChecker("ex_gauge", function (g, rule) {
  var ok = (rule.op === "gte" && g.state.exGauge >= rule.count) || (rule.op === "lte" && g.state.exGauge <= rule.count);
  return ok ? failDesc(PLOT_INDEX[g.state.plotFlags.activeFailPlotId || g.script.mainPlot]) : null;
});
TL.registerRuleChecker("revealed_role_names", function (g, rule) {
  var st = g.state;
  var revealed = {};
  Object.keys(st.chars).forEach(function (id) {
    if (st.chars[id].roleRevealed) revealed[st.chars[id].role] = true;
  });
  var hit = (rule.roles || []).some(function (rid) { return revealed[rid]; });
  return hit ? failDesc(PLOT_INDEX[st.plotFlags.activeFailPlotId || g.script.mainPlot]) : null;
});

TL.registerPlotFail("the_black_school", function (g) {
  var x = g.state.loop - 1;
  if (g.state.locations.school.intrigue >= x) return failDesc(PLOT_INDEX.the_black_school);
  return null;
});
TL.registerPlotFail("sacred_words_of_dagon", function (g) {
  if (g.state.locations.shrine.intrigue >= g.state.exGauge) return failDesc(PLOT_INDEX.sacred_words_of_dagon);
  return null;
});
TL.registerPlotFail("king_in_yellow", function (g) {
  if (g.state.exGaugeIncreased) return failDesc(PLOT_INDEX.king_in_yellow);
  return null;
});
TL.registerPlotFail("choir_to_the_outside_god", function (g) {
  var marked = g._aliveChars().filter(function (id) { return g.state.chars[id].intrigue >= 1; }).length;
  if (marked >= 5) return failDesc(PLOT_INDEX.choir_to_the_outside_god);
  return null;
});
TL.registerPlotFail("bloody_rites", function (g) {
  var corpses = Object.keys(g.state.chars).filter(function (id) { return !g.state.chars[id].alive; }).length;
  if (corpses >= g.state.exGauge) return failDesc(PLOT_INDEX.bloody_rites);
  return null;
});

TL.registerSubplotFail("smell_of_gunpowder", function (g) {
  var totalPa = g._aliveChars().reduce(function (s, id) { return s + g.state.chars[id].paranoia; }, 0);
  return totalPa >= 12 ? failDesc(PLOT_INDEX.smell_of_gunpowder) : null;
});
TL.registerSubplotFail("showtime_of_death", function (g) {
  return g._aliveChars().length <= 6 ? failDesc(PLOT_INDEX.showtime_of_death) : null;
});

// ---------- 輪迴開始效果註冊 ----------
// 因果線（Threads of Fate）
TL.registerLoopStart("threads_of_fate", async function (g) {
  var st = g.state;
  if (st.loop <= 1) return;
  Object.keys(st.plotFlags.prevLoopGoodwill).forEach(function (id) {
    var c = st.chars[id];
    if (c && c.alive && c.onStage !== false) {
      c.paranoia += 2;
      g._log(TL.I18N.log("threadsOfFate", { char: g._charName(id) }) || (g._charName(id) + "身上放置2枚[不安]。"));
    }
  });
});

// 隔離病房驚魂記：上輪輪迴結束時Ex槽為2或以下 → Ex槽增加1
TL.registerLoopStart("isolation_institution_psycho", async function (g) {
  var st = g.state;
  if (st.loop > 1 && st.prevLoopExGauge <= 2) {
    g._log(TL.L("isolationEx") || "【隔離病房驚魂記】上輪輪迴結束時Ex槽為2或以下，Ex槽增加1。");
    g._addExGauge(1);
  }
});

// 魔爪漸近（規則Y）/ 諸神之骰（規則X）：輪迴開始時選擇1名上輪死亡角色放置1張Ex牌（不可重複發動）
TL.registerLoopStart("the_devils_hand", async function (g) {
  await g._exCardLoopStartPick(true);
});
TL.registerLoopStart("dice_of_the_gods", async function (g) {
  if (g.script.mainPlot === "the_devils_hand") return; // 兩者同時存在時僅魔爪漸近發動
  await g._exCardLoopStartPick(false);
});

TL.Game.prototype._exCardLoopStartPick = async function (devilsHand) {
  var st = this.state;
  var deadPool = (st.prevLoopDead || []).filter(function (id) { return st.chars[id] && st.chars[id].alive; });
  if (!deadPool.length) return;
  var exTarget = await this.io.askTarget({
    title: TL.pname(devilsHand ? "the_devils_hand" : "dice_of_the_gods"),
    text: TL.L("exCardLoopStart") || "選擇1名上輪輪迴結束時處於死亡狀態的角色，放置1張Ex牌。",
    targets: deadPool.map(function (id) { return { type: "char", id: id, label: this._charName(id) }; }, this),
    owner: "mm"
  });
  if (exTarget) this._placeExCard(exTarget.id);
};

// 瘋狂的真相：Ex槽為2或以上 → 本輪輪迴中規則Y的失敗條件變更為另一條規則Y的失敗條件
TL.registerLoopStart("twisted_truth", async function (g) {
  var st = g.state;
  if (st.exGauge < 2) return;
  var swapId = g.script.swapFailRule;
  if (!swapId || !PLOT_INDEX[swapId]) {
    swapId = MODULES[g.script.moduleId].mainPlots.filter(function (id) {
      return id !== g.script.mainPlot && PLOT_INDEX[id] &&
        (PLOT_INDEX[id].rule || id === "choir_to_the_outside_god" || id === "king_in_yellow" || id === "bloody_rites");
    })[0];
  }
  if (swapId && PLOT_INDEX[swapId]) {
    st.plotFlags.activeFailPlotId = swapId;
    g._log(TL.L("twistedTruth", { name: PLOT_INDEX[swapId].name }) ||
      ("【瘋狂的真相】本輪輪迴的規則Y失敗條件變更為「" + PLOT_INDEX[swapId].name + "」。"));
  } else {
    g._log(TL.L("twistedTruthNone") || "【瘋狂的真相】Ex槽2以上，但劇本未設定另一條規則Y失敗條件。");
  }
});

// ---------- 輪迴結束 ----------
TL.Game.prototype._loopEndPhase = async function () {
  var st = this.state;
  var self = this;
  this._log(TL.L("loopResolve") || "—— 輪迴結束結算 ——");
  // 記錄上輪輪迴結束時狀態（Ex槽 / 死亡角色）
  st.prevLoopExGauge = st.exGauge;
  st.prevLoopDead = Object.keys(st.chars).filter(function (id) { return !st.chars[id].alive; });
  // 記錄友好（因果線用）
  st.plotFlags.prevLoopGoodwill = {};
  Object.keys(st.chars).forEach(function (id) {
    if (st.chars[id].goodwill > 0) st.plotFlags.prevLoopGoodwill[id] = st.chars[id].goodwill;
  });
  var losses = [];
  if (st.ended === "lose") {
    losses.push(TL.L("loopDeathLoss") || "主人公死亡（輪迴因死亡立即結束）");
  }
  // 規則Y失敗條件（含切換/Ex槽/動態X）
  losses = losses.concat(this._mainFailLosses());
  // 副規則失敗條件
  (this.script.subplots || []).forEach(function (sid) {
    var fn = TL.SUBPLOT_FAIL[sid];
    if (fn) {
      var s = fn(self);
      if (s) losses.push(s);
    }
  });
  // 輪末掛鉤（先祖記憶等）
  for (var hi = 0; hi < TL.LOOP_END_HOOKS.length; hi++) {
    await TL.LOOP_END_HOOKS[hi].fn(this);
  }
  // 身份死亡失敗條件
  Object.keys(st.chars).forEach(function (id) {
    var c = st.chars[id];
    if (!c.alive && (c.role === "friend" || c.role === "curmudgeon" || c.role === "witch" || c.role === "ninja" || c.role === "wizard")) {
      c.roleRevealed = true;
      losses.push("【" + TL.rname(c.role) + "】" + self._charName(id) + TL.t("game.deathRoleLoss", { role: TL.rname(c.role) }));
    }
  });
  // 妄想擴大病毒：平民3+不安 → 身份變為殺人狂
  if (this._hasSubplot("paranoia_virus")) {
    Object.keys(st.chars).forEach(function (id) {
      var c = st.chars[id];
      if (c.alive && !c.role && c.paranoia >= 3 && !c.becameSerial) {
        c.becameSerial = true;
        self._log(TL.L("paranoiaVirus", { char: self._charName(id) }) ||
          (self._charName(id) + "（平民）不安3枚以上，身份變為殺人狂。"));
      }
    });
  }
  if (losses.length) {
    losses.forEach(function (l) { self._log(TL.L("loopFailLine", { line: l }) || ("✗ 失敗條件：" + l)); });
    this._log(TL.L("loopFail") || "✗ 主人公在本輪輪迴失敗。");
    if (st.loop >= this.script.loops || st.exGauge >= 4) {
      if (this.module.finalGuess) {
        // 最終決戰前重置場地
        Object.keys(st.chars).forEach(function (id) {
          var c = st.chars[id];
          c.loc = c.startingLoc;
          c.alive = true;
          c.paranoia = 0;
          c.goodwill = 0;
          c.intrigue = 0;
          c.guard = 0;
        });
        LOCATIONS.forEach(function (l) { st.locations[l.id].intrigue = 0; });
        st.phase = "final_guess";
        st.finalGuess = {
          index: 0,
          order: Object.keys(st.chars).filter(function (id) { return st.chars[id].onStage !== false; }),
          done: false
        };
        this._log(TL.L("allFailFinal") || "所有輪迴均失敗。進入最終決戰。");
      } else {
        st.ended = "lose";
        st.phase = "game_over";
        this._log(TL.L("allFailNoFinal") || "所有輪迴均失敗（本模組無最終決戰）。劇作家獲勝。");
      }
      return;
    }
    // 有剩餘輪迴：停在「輪迴結束」階段，由玩家點「下一輪輪迴」再繼續
    st.loop += 1;
    st.nextLoopPending = true;
    this._log(TL.L("nextLoopReady") || "主人公失敗。準備進入下一輪輪迴（點擊「下一輪輪迴」開始）。");
  } else {
    st.ended = "win";
    st.phase = "game_over";
    this._log(TL.L("loopWin") || "✓ 主人公成功度過本輪輪迴！遊戲勝利！");
  }
};

// Ex槽2+ 先祖記憶：可以得知規則X1的規則名
TL.registerLoopEndHook("ancestor_memory", async function (g) {
  var st = g.state;
  if (st.exGauge < 2 || !g.script.subplots.length) return;
  var learnX = await g.io.confirm({
    title: TL.L("ancestorTitle") || "先祖記憶",
    text: TL.L("ancestorText") || "Ex槽2以上：隊長可以得知規則X1的規則名。",
    owner: "p",
    kind: "ancestor_memory"
  });
  if (learnX) {
    g._log(TL.L("ancestorLog", { name: TL.pname(g.script.subplots[0]) }) ||
      ("【先祖記憶】得知規則X1「" + PLOT_INDEX[g.script.subplots[0]].name + "」的規則名。"));
  }
});
