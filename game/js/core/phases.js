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
    if (c.alive && !c.role && g._effParanoia(id) >= 3 && !c.becameSerial) {
      c.becameSerial = true;
      g._log(TL.L("paranoiaVirus", { char: g._charName(id) }) ||
        (g._charName(id) + "（平民）不安3枚以上，身份變為殺人狂。"));
    }
  });
});

// 十周年：臨時工（回合結束階段，3枚以上指示物→死亡）
TL.registerDayEndStep("part_timer_die", 5, async function (g) {
  var st = g.state;
  if (!st.chars.part_time_jobber || !st.chars.part_time_jobber.alive) return;
  if (g._totalCounters("part_time_jobber") >= 3) {
    g._log(TL.L("partTimerDie", { char: g._charName("part_time_jobber") }) ||
      (g._charName("part_time_jobber") + "（臨時工）身上有3枚以上指示物，死亡。"));
    await g._applyDeath("part_time_jobber");
  }
});

// AHR：世界移動結算（回合結束階段開始時：本日觸發過世界移動→Ex槽+1）
TL.registerDayEndStep("ahr_warp", 6, async function (g) {
  var st = g.state;
  if (g.module && g.module.id === "AHR" && st.warpsTriggered) {
    st.warpsTriggered = false;
    g._log(TL.L("warpDayEnd") || "【世界移動】回合結束階段開始時，Ex槽+1。");
    g._addExGauge(1);
  }
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
    if (g._effParanoia(wid) >= 4) {
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
    var kp = Object.keys(st.chars).filter(function (id) { return st.chars[id].alive && st.chars[id].role === "key_person" && st.chars[id].loc === st.chars[kid].loc && g._effIntrigueChar(id) >= 2; });
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
    if (g._effIntrigueChar(kid) >= 4) {
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
    if (g._effIntrigueChar(lid) >= 1 && g._effParanoia(lid) >= 3) {
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
    if (g._effGoodwill(tid) <= 2) {
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

// ================= 十周年 / AHR / LL / HSA 回合結束步驟 =================

// 難以言喻的怪物：Ex槽3+ → 可殺害主人公
TL.registerDayEndStep("unspeakable_horrors", 62, async function (g) {
  if (g.script.mainPlot !== "unspeakable_horrors" || g.state.exGauge < 3) return;
  var yes = await g.io.confirm({
    title: TL.pname("unspeakable_horrors"),
    text: TL.L("unspeakableKillP") || "Ex槽3以上，劇作家是否殺害主人公？",
    owner: "mm", kind: "night", subKind: "unspeakable"
  });
  if (yes) await g._protagonistDeath("難以言喻的怪物");
});

// 惡魔的劇本：最終日監視者指示物1枚以下 → 可殺害主人公
TL.registerDayEndStep("watcher_final_day", 63, async function (g) {
  if (g.script.mainPlot !== "the_demons_script" || g.state.day !== g.script.days) return;
  var watchers = g._aliveChars().filter(function (id) { return g.state.chars[id].role === "watcher"; });
  if (!watchers.length) return;
  if (g._totalCounters(watchers[0]) <= 1) {
    var yes = await g.io.confirm({
      title: TL.rname("watcher"),
      text: TL.L("watcherKillP") || "監視者身上的指示物僅有1枚或以下，劇作家是否殺害主人公？",
      owner: "mm", kind: "night", subKind: "watcher"
    });
    if (yes) await g._protagonistDeath("監視者");
  }
});

// 封印的終末：神社密謀2+ → 可殺害主人公
TL.registerDayEndStep("sealed_conclusion", 64, async function (g) {
  if (g.script.mainPlot !== "the_sealed_conclusion") return;
  var shrineInt = g._locIntrigueWithHeroes("shrine");
  if (shrineInt >= 2) {
    var yes = await g.io.confirm({
      title: TL.pname("the_sealed_conclusion"),
      text: TL.L("sealedKillP") || "神社有2枚以上密謀，劇作家是否殺害主人公？",
      owner: "mm", kind: "night", subKind: "sealed"
    });
    if (yes) await g._protagonistDeath("封印的終末");
  }
});

// 提線木偶/童謠：身上4種以上指示物 → 可殺害主人公
TL.registerDayEndStep("marionette_kill_p", 65, async function (g) {
  var st = g.state;
  var candidates = g._aliveChars().filter(function (id) {
    var c = st.chars[id];
    return (c.role === "marionette" || c.role === "lullaby") && g._counterKinds(id).length >= 4;
  });
  for (var mi = 0; mi < candidates.length; mi++) {
    var yes = await g.io.confirm({
      title: TL.rname(st.chars[candidates[mi]].role),
      text: TL.L("marionetteKillP", { char: g._charName(candidates[mi]) }) ||
        (g._charName(candidates[mi]) + "身上有4種以上指示物，劇作家是否殺害主人公？"),
      owner: "mm", kind: "night", subKind: "marionette"
    });
    if (yes) await g._protagonistDeath("提線木偶/童謠");
    if (st.ended) return;
  }
});

// 魔笛手：Ex槽2+ → 同一區域1名角色死亡（每輪限1次）
TL.registerDayEndStep("pied_piper_kill", 66, async function (g) {
  var st = g.state;
  if (st.exGauge < 2 || st.plotFlags.piedPiperKillUsed) return;
  var pipers = g._aliveChars().filter(function (id) { return st.chars[id].role === "pied_piper"; });
  for (var pi = 0; pi < pipers.length && !st.plotFlags.piedPiperKillUsed; pi++) {
    var pid = pipers[pi];
    var area = g._charArea(pid);
    var targets = g._aliveChars(area).filter(function (id) { return id !== pid; })
      .map(function (id) { return { type: "char", id: id, label: g._charName(id) }; });
    if (!targets.length) { g._log(TL.L("piedPiperNoTarget", { char: g._charName(pid) }) || (g._charName(pid) + "所在區域沒有可殺害的角色。")); continue; }
    var t = await g.io.askTarget({
      title: TL.rname("pied_piper"),
      text: TL.L("piedPiperPrompt", { char: g._charName(pid) }) || (g._charName(pid) + "（魔笛手）選擇同一區域的1名角色：那名角色死亡。"),
      targets: targets, owner: "mm"
    });
    if (t) {
      st.plotFlags.piedPiperKillUsed = true;
      g._log(g._charName(t.id) + "死亡。");
      await g._applyDeath(t.id);
    }
  }
});

// 魔笛手：往同區域屍體放置密謀；所有屍體密謀合計3+ → 主人公死亡
TL.registerDayEndStep("pied_piper_corpse", 67, async function (g) {
  var st = g.state;
  var pipers = g._aliveChars().filter(function (id) { return st.chars[id].role === "pied_piper"; });
  for (var pj = 0; pj < pipers.length; pj++) {
    var pid = pipers[pj];
    var area = g._charArea(pid);
    var corpses = Object.keys(st.chars).filter(function (id) {
      return !st.chars[id].alive && st.chars[id].loc === area;
    }).map(function (id) { return { type: "char", id: id, label: g._charName(id) }; });
    if (!corpses.length) continue;
    var yes = await g.io.confirm({
      title: TL.rname("pied_piper"),
      text: TL.L("piedPiperCorpse", { char: g._charName(pid) }) ||
        (g._charName(pid) + "（魔笛手）是否往同一區域的1具屍體放置1枚[密謀]？"),
      owner: "mm", kind: "night", subKind: "pied_piper_corpse"
    });
    if (yes) {
      var t = await g.io.askTarget({ title: TL.rname("pied_piper"), text: "選擇1具屍體：", targets: corpses, owner: "mm" });
      if (t) { st.chars[t.id].intrigue += 1; g._log(g._charName(t.id) + " 密謀+1。"); }
    }
    var totalCorpseIntrigue = Object.keys(st.chars).reduce(function (s, id) {
      return !st.chars[id].alive ? s + (st.chars[id].intrigue || 0) : s;
    }, 0);
    if (totalCorpseIntrigue >= 3) await g._protagonistDeath("魔笛手（屍體密謀3枚以上）");
    if (st.ended) return;
  }
});

// 吸血鬼：同一區域異性有1不安+1密謀 → 死亡
TL.registerDayEndStep("vampire_kill", 68, async function (g) {
  var st = g.state;
  var vampires = g._aliveChars().filter(function (id) { return st.chars[id].role === "vampire"; });
  for (var v = 0; v < vampires.length; v++) {
    var vid = vampires[v];
    var area = g._charArea(vid);
    var vData = g._charData(vid);
    var targets = g._aliveChars(area).filter(function (id) {
      if (id === vid) return false;
      var d = g._charData(id);
      var opposite = (vData.traits.indexOf("男性") >= 0 && d.traits.indexOf("女性") >= 0) ||
        (vData.traits.indexOf("女性") >= 0 && d.traits.indexOf("男性") >= 0);
      return opposite && g._effParanoia(id) >= 1 && g._effIntrigueChar(id) >= 1;
    }).map(function (id) { return { type: "char", id: id, label: g._charName(id) }; });
    if (!targets.length) continue;
    var yes = await g.io.confirm({
      title: TL.rname("vampire"),
      text: TL.L("vampireKill", { char: g._charName(vid), char2: g._charName(targets[0].id) }) ||
        (g._charName(vid) + "（吸血鬼）是否殺害" + g._charName(targets[0].id) + "？"),
      owner: "mm", kind: "night", subKind: "vampire"
    });
    if (yes) await g._applyDeath(targets[0].id);
    if (st.ended) return;
  }
});

// 吸血鬼：3張以上異性卡牌死亡 → 主人公死亡
TL.registerDayEndStep("vampire_kill_p", 69, async function (g) {
  var st = g.state;
  var vampires = g._aliveChars().filter(function (id) { return st.chars[id].role === "vampire"; });
  for (var vp = 0; vp < vampires.length; vp++) {
    var vid = vampires[vp];
    var vData = g._charData(vid);
    var isMale = vData.traits.indexOf("男性") >= 0;
    var deadOpposite = Object.keys(st.chars).filter(function (id) {
      if (st.chars[id].alive) return false;
      var d = g._charData(id);
      return isMale ? d.traits.indexOf("女性") >= 0 : d.traits.indexOf("男性") >= 0;
    }).length;
    if (deadOpposite >= 3) {
      var yes = await g.io.confirm({
        title: TL.rname("vampire"),
        text: TL.L("vampireKillP", { char: g._charName(vid) }) ||
          (g._charName(vid) + "（吸血鬼）有3張以上異性卡牌死亡，是否殺害主人公？"),
        owner: "mm", kind: "night", subKind: "vampire_p"
      });
      if (yes) await g._protagonistDeath("吸血鬼");
      if (st.ended) return;
    }
  }
});

// 夢魘：同一區域1名角色死亡
TL.registerDayEndStep("nightmare_kill", 70, async function (g) {
  var st = g.state;
  var nightmares = g._aliveChars().filter(function (id) { return st.chars[id].role === "nightmare"; });
  for (var nm = 0; nm < nightmares.length; nm++) {
    var nid = nightmares[nm];
    var area = g._charArea(nid);
    var targets = g._aliveChars(area).filter(function (id) { return id !== nid; })
      .map(function (id) { return { type: "char", id: id, label: g._charName(id) }; });
    if (!targets.length) continue;
    var yes = await g.io.confirm({
      title: TL.rname("nightmare"),
      text: TL.L("nightmareKill", { char: g._charName(nid) }) ||
        (g._charName(nid) + "（夢魘）是否殺害同一區域的1名角色？"),
      owner: "mm", kind: "night", subKind: "nightmare"
    });
    if (yes) {
      var t = await g.io.askTarget({ title: TL.rname("nightmare"), text: "選擇1名角色：", targets: targets, owner: "mm" });
      if (t) await g._applyDeath(t.id);
    }
    if (st.ended) return;
  }
});

// 狼人：本日發生過瘋狂之夜 → 主人公死亡
TL.registerDayEndStep("werewolf_night", 71, async function (g) {
  var st = g.state;
  if (st.plotFlags.nightOfMadness && g._aliveChars().some(function (id) { return st.chars[id].role === "werewolf"; })) {
    var yes = await g.io.confirm({
      title: TL.rname("werewolf"),
      text: TL.L("werewolfNight") || "本日發生過[瘋狂之夜]，劇作家是否殺害主人公？",
      owner: "mm", kind: "night", subKind: "werewolf"
    });
    if (yes) await g._protagonistDeath("狼人（瘋狂之夜）");
  }
});

// 瘋狂之夜：6具以上喪屍 → 主人公死亡
TL.registerDayEndStep("night_madness_p", 72, async function (g) {
  if (g.state.plotFlags.nightOfMadness) {
    await g._protagonistDeath("瘋狂之夜");
  }
});

// 喪屍：選擇喪屍數量大於非喪屍的版圖 → 1名非喪屍角色死亡（每日限1次）
TL.registerDayEndStep("zombie_kill", 73, async function (g) {
  var st = g.state;
  if (st.plotFlags.zombieKillUsed) return;
  var zombieLocs = LOCATIONS.filter(function (l) { return !l.offBoard; }).filter(function (l) {
    var chars = g._aliveChars(l.id);
    if (!chars.length) return false;
    var zombies = chars.filter(function (id) { return st.chars[id].role === "zombie"; }).length;
    return zombies > (chars.length - zombies);
  }).map(function (l) { return { type: "location", id: l.id, label: g._locName(l.id) }; });
  if (!zombieLocs.length) return;
  var yes = await g.io.confirm({
    title: TL.rname("zombie"),
    text: TL.L("zombieKillPrompt") || "喪屍數量多於非喪屍的版圖存在，劇作家是否殺害其中1名角色？",
    owner: "mm", kind: "night", subKind: "zombie_kill"
  });
  if (yes && zombieLocs.length) {
    var locT = await g.io.askTarget({ title: TL.rname("zombie"), text: "選擇1塊版圖：", targets: zombieLocs, owner: "mm" });
    if (locT) {
      var chars = g._aliveChars(locT.id).filter(function (id) { return st.chars[id].role !== "zombie"; })
        .map(function (id) { return { type: "char", id: id, label: g._charName(id) }; });
      if (chars.length) {
        var t = await g.io.askTarget({ title: TL.rname("zombie"), text: "選擇1名非喪屍角色：", targets: chars, owner: "mm" });
        if (t) { st.plotFlags.zombieKillUsed = true; await g._applyDeath(t.id); }
      }
    }
  }
});

// 喪屍：將1具喪屍屍體移動至相鄰版圖（每日限1次）
TL.registerDayEndStep("zombie_move_corpse", 74, async function (g) {
  var st = g.state;
  if (st.plotFlags.zombieMoveUsed) return;
  var zombieCorpses = Object.keys(st.chars).filter(function (id) {
    return !st.chars[id].alive && st.chars[id].role === "zombie";
  }).map(function (id) { return { type: "char", id: id, label: g._charName(id) }; });
  if (!zombieCorpses.length) return;
  var yes = await g.io.confirm({
    title: TL.rname("zombie"),
    text: TL.L("zombieMovePrompt") || "是否移動1具喪屍屍體至相鄰版圖？",
    owner: "mm", kind: "night", subKind: "zombie_move"
  });
  if (!yes) return;
  var t = await g.io.askTarget({ title: TL.rname("zombie"), text: "選擇1具喪屍屍體：", targets: zombieCorpses, owner: "mm" });
  if (!t) return;
  var from = st.chars[t.id].loc;
  var opts = [];
  ["h", "v", "d"].forEach(function (mt) {
    (ADJ[from] && ADJ[from][mt] || []).forEach(function (lid) { if (opts.indexOf(lid) < 0) opts.push(lid); });
  });
  if (!opts.length) return;
  var mi = await g.io.askChoice({
    title: TL.rname("zombie"),
    text: TL.L("zombieMoveTo", { char: g._charName(t.id) }) || ("將" + g._charName(t.id) + "移動至哪塊版圖？"),
    options: opts.map(function (lid) { return g._locName(lid); }),
    owner: "mm"
  });
  var to = opts[mi == null ? 0 : mi];
  st.chars[t.id].loc = to;
  st.plotFlags.zombieMoveUsed = true;
  g._feed({ type: "move", id: t.id, from: from, to: to });
  g._log(g._charName(t.id) + "移動至" + g._locName(to) + "。");
});

// 密鑰：第1/2輪身份公開後，回合結束階段主人公死亡
TL.registerDayEndStep("secretkeeper_punish", 75, async function (g) {
  var st = g.state;
  if (st.loop > 2) return;
  var sk = Object.keys(st.chars).filter(function (id) { return st.chars[id].role === "secretkeeper" && st.chars[id].roleRevealed; });
  if (sk.length) {
    g._log(TL.L("secretkeeperPunish") || "【密鑰】身份已公開（第1/2輪），劇作家次日僅能放置1張行動牌；回合結束階段主人公死亡。");
    await g._protagonistDeath("密鑰");
  }
});

// 真正的怪物（背叛者A）：回合結束階段遺骸標記5+ → 主人公A獲勝
TL.registerDayEndStep("traitor_a", 76, async function (g) {
  if (!g._hasSubplot("the_real_monster")) return;
  if (g.state.plotFlags.traitorsNormal) return; // 最終計劃：關鍵人物有希望→背叛者變回普通主人公
  var perished = Object.keys(g.state.chars).filter(function (id) { return g.state.chars[id].perished; }).length;
  if (perished >= 5) {
    g._log(TL.L("traitorAWin") || "【真正的怪物】遺骸標記5枚以上，主人公A（背叛者）獲勝！");
    g.state.ended = "traitorA";
    g.state.phase = "game_over";
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
    if (g._effIntrigueChar(holders[i]) >= rule.count) {
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
TL.registerRuleChecker("light_world_at_loop_end", function (g) {
  if (!g._isDarkWorld()) return failDesc(PLOT_INDEX[g.state.plotFlags.activeFailPlotId || g.script.mainPlot]);
  return null;
});
TL.registerRuleChecker("corpses_by_loop", function (g, rule) {
  var x = Math.min(g.state.loop, rule.max || 3);
  var corpses = Object.keys(g.state.chars).filter(function (id) { return !g.state.chars[id].alive; }).length;
  return corpses >= x ? failDesc(PLOT_INDEX[g.state.plotFlags.activeFailPlotId || g.script.mainPlot]) : null;
});
TL.registerRuleChecker("last_will_or_left_behind", function (g) {
  if (g.state.plotFlags.lastWillTriggered || g.state.plotFlags.leftBehindTriggered) {
    return failDesc(PLOT_INDEX[g.state.plotFlags.activeFailPlotId || g.script.mainPlot]);
  }
  return null;
});
TL.registerRuleChecker("last_will_or_executor", function (g) {
  if (g.state.plotFlags.lastWillTriggered || g.state.plotFlags.executorTriggered) {
    return failDesc(PLOT_INDEX[g.state.plotFlags.activeFailPlotId || g.script.mainPlot]);
  }
  return null;
});
TL.registerRuleChecker("ex_plus_obstinate_intrigue", function (g) {
  var obst = Object.keys(g.state.chars).filter(function (id) { return g.state.chars[id].role === "obstinate"; });
  var total = g.state.exGauge;
  for (var i = 0; i < obst.length; i++) total += g._effIntrigueChar(obst[i]);
  return total >= 3 ? failDesc(PLOT_INDEX[g.state.plotFlags.activeFailPlotId || g.script.mainPlot]) : null;
});
TL.registerRuleChecker("hope_on_key_person", function (g) {
  var kp = Object.keys(g.state.chars).filter(function (id) { return g.state.chars[id].role === "key_person"; });
  var hasHope = kp.some(function (id) { return (g.state.chars[id].hope || 0) > 0; });
  if (hasHope) g.state.plotFlags.traitorsNormal = true;
  return null;
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
  var marked = g._aliveChars().filter(function (id) { return g._effIntrigueChar(id) >= 1; }).length;
  if (marked >= 5) return failDesc(PLOT_INDEX.choir_to_the_outside_god);
  return null;
});
TL.registerPlotFail("bloody_rites", function (g) {
  var corpses = Object.keys(g.state.chars).filter(function (id) { return !g.state.chars[id].alive; }).length;
  if (corpses >= g.state.exGauge) return failDesc(PLOT_INDEX.bloody_rites);
  return null;
});

TL.registerSubplotFail("smell_of_gunpowder", function (g) {
  var totalPa = g._aliveChars().reduce(function (s, id) { return s + g._effParanoia(id); }, 0);
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

// 超越世界線（十周年/AHR/LL 副規則）：偶數輪開始劇作家獲得絕望+1；最終輪開始主人公獲得希望+1
TL.registerLoopStart("crossing_world_lines", async function (g) {
  var st = g.state;
  if (st.loop > 1 && st.loop % 2 === 0) {
    g._addMMHandCard("m_despair_plus1");
  }
  if (st.loop === g.script.loops) {
    for (var d = 0; d < g.protagonistCount; d++) g._addPHandCard(d, "p_hope_plus1");
  }
});

// 因果殘片（十周年身份）：上輪結束死亡→劇作家獲得絕望+1；上輪結束存活且2+友好→主人公獲得希望+1
TL.Game.prototype._fragmentLoopStart = async function () {
  var st = this.state;
  var self = this;
  if (st.loop <= 1) return;
  Object.keys(st.chars).forEach(function (id) {
    var c = st.chars[id];
    if (c.role !== "fragment") return;
    var wasDead = (st.prevLoopDead || []).indexOf(id) >= 0;
    if (wasDead) {
      self._addMMHandCard("m_despair_plus1");
    } else if (c.alive && self._effGoodwill(id) >= 2) {
      for (var d = 0; d < self.protagonistCount; d++) self._addPHandCard(d, "p_hope_plus1");
    }
  });
};
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
  await this._fragmentLoopStart();
  var ids = [this.script.mainPlot].concat(this.script.subplots || []);
  for (var i = 0; i < ids.length; i++) {
    var fn = TL.PLOT_LOOP_START[ids[i]];
    if (fn) await fn(this);
  }
};

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

// 敘述者：上輪輪迴結束時Ex槽3+ → 主人公獲得希望+1
TL.registerLoopStart("storyteller_hope_loop", async function (g) {
  var st = g.state;
  if (st.loop <= 1 || st.prevLoopExGauge < 3) return;
  var has = Object.keys(st.chars).some(function (id) { return st.chars[id].role === "storyteller"; });
  if (has) for (var d = 0; d < g.protagonistCount; d++) g._addPHandCard(d, "p_hope_plus1");
});

// 魔女遺咒（HSA）：輪迴開始時往魔女的初始區域對應的版圖放置1張詛咒牌
TL.registerLoopStart("witchs_curse", async function (g) {
  var st = g.state;
  var witch = Object.keys(st.chars).filter(function (id) { return st.chars[id].role === "witch"; })[0];
  if (witch) {
    st.plotFlags.curseLoc = st.chars[witch].startingLoc;
    g._log(TL.L("witchCurse", { loc: g._locName(st.chars[witch].startingLoc) }) ||
      ("【魔女遺咒】往" + g._locName(st.chars[witch].startingLoc) + "放置1張詛咒牌。"));
  }
});

// 古墓活屍（HSA）：平民/膽小鬼/紙老虎的屍體身份變為喪屍（回合結束階段檢查）
TL.registerDayEndStep("corpse_to_zombie", 8, async function (g) {
  var st = g.state;
  if (g.script.mainPlot !== "the_living_dead") return;
  Object.keys(st.chars).forEach(function (id) {
    var c = st.chars[id];
    if (c.alive) return;
    if (c.role === "zombie" || st.plotFlags.zombieRoles[id]) return;
    var data = CHAR_INDEX[id];
    var isPerson = !c.role && !data.specials;
    if (isPerson || c.role === "coward" || c.role === "paper_tiger") {
      st.plotFlags.zombieRoles[id] = true;
      g._log(TL.L("corpseToZombie", { char: g._charName(id) }) ||
        (g._charName(id) + "的屍體身份變為喪屍。"));
    }
  });
});

// 空想擴大病毒（AHR）：裏世界時，有2種以上指示物的平民/因果殘片身份變為殺人狂
TL.registerDayEndStep("hysteria_virus", 9, async function (g) {
  var st = g.state;
  if (g.script.subplots.indexOf("hysteria_virus") < 0) return;
  if (!g._isDarkWorld()) return;
  g._aliveChars().forEach(function (id) {
    var c = st.chars[id];
    if (c.becameSerial) return;
    if (c.role !== "fragment" && c.role !== null) return;
    if (g._counterKinds(id).length >= 2) {
      c.becameSerial = true;
      g._log(TL.L("hysteriaVirus", { char: g._charName(id) }) ||
        (g._charName(id) + "（" + (c.role === "fragment" ? TL.rname("fragment") : TL.t("basic.commoner")) + "）身份變為殺人狂。"));
    }
  });
});

// 被詛咒的土地（HSA）：回合結束階段，位於版圖上的詛咒牌沒有目標角色可以放置 → 主人公死亡
TL.registerDayEndStep("curse_no_target", 11, async function (g) {
  var st = g.state;
  if (g.script.mainPlot !== "cursed_land" || !st.plotFlags.curseLoc) return;
  var locChars = g._aliveChars(st.plotFlags.curseLoc);
  if (!locChars.length) {
    await g._protagonistDeath("被詛咒的土地（詛咒牌沒有目標角色）");
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
    if (self._effGoodwill(id) > 0) st.plotFlags.prevLoopGoodwill[id] = self._effGoodwill(id);
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
      if (c.alive && !c.role && self._effParanoia(id) >= 3 && !c.becameSerial) {
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
      this._enterFinalGuessPending();
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
