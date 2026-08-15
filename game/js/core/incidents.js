// 事件階段：判定 + 效果分派（可拆卸：新事件只需 registerIncident）
window.TL = window.TL || {};

// 事件效果處理器註冊表：effect -> async function(game, def, culpritId)
TL.INCIDENT_HANDLERS = {};
TL.registerIncident = function (effect, handler) {
  TL.INCIDENT_HANDLERS[effect] = handler;
};

// 事件處理共用上下文
TL.incidentCtx = function (game, culpritId) {
  var st = game.state;
  var loc = game._incidentArea(culpritId);
  var others = game._aliveChars(loc).filter(function (id) { return id !== culpritId; })
    .map(function (id) { return { type: "char", id: id, label: game._charName(id) }; });
  var anyChars = Object.keys(st.chars).filter(function (id) { return st.chars[id].alive; })
    .map(function (id) { return { type: "char", id: id, label: game._charName(id) }; });
  var locs = LOCATIONS.filter(function (l) { return !l.offBoard; }).map(function (l) {
    return { type: "location", id: l.id, label: TL.t("game.pTarget", { loc: TL.lname(l.id) }) };
  });
  var askTarget = function (targets, title, text) {
    return game.io.askTarget({ title: title, text: text, targets: targets });
  };
  return { st: st, loc: loc, others: others, anyChars: anyChars, locs: locs, askTarget: askTarget, culpritId: culpritId };
};

TL.Game.prototype._incidentPhase = async function () {
  var st = this.state;
  this._log(TL.L("incidentPhasePlain") || "—— 事件階段 ——");
  var scheduled = this.script.incidents.filter(function (inc) { return inc.day === st.day; });
  if (!scheduled.length) {
    this._log(TL.L("incidentNone") || "（今天沒有預定事件）");
    return;
  }
  for (var i = 0; i < scheduled.length; i++) {
    var inc = scheduled[i];
    var def = INCIDENT_INDEX[inc.incidentId];
    var culprit = st.chars[inc.culpritId];
    var record = { day: st.day, loop: st.loop, incidentId: inc.incidentId, culpritId: inc.culpritId, happened: false };
    st.incidentHistory.push(record);
    if (st.plotFlags.incidentForbid[inc.culpritId]) {
      this._log(TL.L("incidentBlocked", { name: TL.iname(inc.incidentId) }) ||
        ("【事件】「" + def.name + "」沒有發生。"));
      continue;
    }
    // 判定是否發生：強迫症/偵探/必定發生事件強制發生；預言家同區域阻擋
    var force = !!def.alwaysTriggers || culprit.role === "obstinate" || this._detectiveForce(inc.culpritId);
    var blocked = this._prophetBlocks(inc.culpritId);
    // HSA 群眾事件：以當事人所在版圖的屍體數量（含版圖密謀）判定是否發生
    var mobOk = true;
    if (def.mobIncident) {
      var mobLoc = culprit ? culprit.loc : inc.culpritId;
      var corpseCount = Object.keys(st.chars).filter(function (id) {
        return !st.chars[id].alive && st.chars[id].loc === mobLoc;
      }).length + (st.locations[mobLoc] ? st.locations[mobLoc].intrigue : 0);
      mobOk = corpseCount >= (def.mobCorpses || 0);
    }
    if ((def.mobIncident ? !mobOk : (!culprit || !culprit.alive || blocked || (this._incidentCount(def, inc.culpritId) < this._incidentLimit(def, inc.culpritId) && !force)))) {
      this._log(TL.L("incidentNotHappen", { name: TL.iname(inc.incidentId) }) ||
        ("【事件】「" + def.name + "」沒有發生（當事人存活/不安條件不滿足）。"));
      continue;
    }
    // 附加條件（醫院事故需要醫院密謀等）
    if (def.extraCondition) {
      var cond = def.extraCondition;
      var okCond = true;
      if (def.id === "uproar") {
        okCond = st.locations.school.intrigue >= 1 || st.locations.city.intrigue >= 1;
      } else if (cond.type === "location_intrigue") {
        okCond = (st.locations[cond.location] || {}).intrigue >= cond.count;
      } else if (cond.type === "culprit_intrigue") {
        okCond = (culprit.intrigue || 0) >= cond.count;
      }
      if (!okCond) {
        this._log(TL.L("incidentNoEffect", { name: TL.iname(inc.incidentId) }) ||
          ("【事件】「" + def.name + "」發生，但什麼都沒發生（附加條件不滿足）。"));
        continue;
      }
    }
    record.happened = true;
    this._log(TL.L("incidentHappen", { name: TL.iname(inc.incidentId) }) ||
      ("【事件】「" + def.name + "」發生！"));
    await this._execIncident(def, inc.culpritId);
    // 廷達羅斯之嗅：本輪輪迴剩餘時間，如果發生其它事件，則在那個事件階段結束時主人公死亡
    if (st.houndDogActive && inc.incidentId !== "hound_dog_scent") {
      await this._protagonistDeath("廷達羅斯之嗅");
      return;
    }
  }
  // 銀色子彈：該階段結束時，本輪輪迴結束
  if (st.plotFlags.silverBulletEnd) {
    this._log(TL.L("silverBulletEnd") || "【銀色子彈】事件階段結束，本輪輪迴結束。");
    st.phase = "loop_end";
  }
};

TL.Game.prototype._execIncident = async function (def, culpritId) {
  var handler = TL.INCIDENT_HANDLERS[def.effect];
  if (!handler) {
    this._log("（事件「" + def.name + "」的效果尚未實作：" + def.effect + "）");
    return;
  }
  await handler(this, def, culpritId);
};

// ---------- 各事件效果註冊 ----------
TL.registerIncident("kill_other_in_location", async function (g, def, culpritId) {
  var c = TL.incidentCtx(g, culpritId);
  if (!c.others.length) { g._log("（沒有可殺害的目標，什麼都沒發生）"); return; }
  var t = await c.askTarget(c.others, TL.iname(def.id), "選擇死亡的1名角色：");
  if (t) await g._applyDeath(t.id);
});

TL.registerIncident("paranoia2_then_intrigue1", async function (g, def, culpritId) {
  var c = TL.incidentCtx(g, culpritId);
  var t1 = await c.askTarget(c.anyChars, TL.iname(def.id), "選擇1名角色放置2枚[不安]：");
  var t2 = await c.askTarget(c.anyChars, TL.iname(def.id), "選擇另外1名角色放置1枚[密謀]：");
  if (t1) { c.st.chars[t1.id].paranoia += 2; g._log(g._charName(t1.id) + " 不安+2。"); }
  if (t2) { c.st.chars[t2.id].intrigue += 1; g._log(g._charName(t2.id) + " 密謀+1。"); }
});

TL.registerIncident("shrine_intrigue2", async function (g) {
  g.state.locations.shrine.intrigue += 2;
  g._log("神社 密謀+2。");
});

TL.registerIncident("culprit_dies", async function (g, def, culpritId) {
  await g._applyDeath(culpritId);
});

TL.registerIncident("hospital_incident", async function (g) {
  var st = g.state;
  var hc = st.locations.hospital.intrigue;
  var hosp = g._aliveChars("hospital");
  if (hc >= 1) {
    for (var i = 0; i < hosp.length; i++) await g._applyDeath(hosp[i]);
  }
  if (hc >= 2) await g._protagonistDeath("醫院事故（醫院2枚以上密謀）");
});

TL.registerIncident("faraway_kill", async function (g, def) {
  var st = g.state;
  var candidates = Object.keys(st.chars).filter(function (id) { return st.chars[id].alive && st.chars[id].intrigue >= 2; })
    .map(function (id) { return { type: "char", id: id, label: g._charName(id) }; });
  if (!candidates.length) { g._log("（沒有身上有2枚以上密謀的角色）"); return; }
  var t3 = await g.io.askTarget({ title: TL.iname(def.id), text: "選擇死亡的1名角色：", targets: candidates });
  if (t3) await g._applyDeath(t3.id);
});

TL.registerIncident("move_culprit_place_intrigue", async function (g, def, culpritId) {
  var c = TL.incidentCtx(g, culpritId);
  var t4 = await c.askTarget(c.locs, TL.iname(def.id), "將當事人移動至哪塊版圖？");
  if (t4) {
    c.st.chars[culpritId].loc = t4.id;
    c.st.locations[t4.id].intrigue += 1;
    g._log(g._charName(culpritId) + "移動至" + g._locName(t4.id) + "，並放置1枚密謀。");
  }
});

TL.registerIncident("goodwill_swap", async function (g, def, culpritId) {
  var c = TL.incidentCtx(g, culpritId);
  var t5 = await c.askTarget(c.anyChars, TL.iname(def.id), "選擇1名角色移除2枚[友好]：");
  var t6 = await c.askTarget(c.anyChars, TL.iname(def.id), "選擇另外1名角色放置2枚[友好]：");
  if (t5) { c.st.chars[t5.id].goodwill = Math.max(0, c.st.chars[t5.id].goodwill - 2); g._log(g._charName(t5.id) + " 友好-2。"); }
  if (t6) { c.st.chars[t6.id].goodwill += 2; g._log(g._charName(t6.id) + " 友好+2。"); }
});

TL.registerIncident("butterfly", async function (g, def, culpritId) {
  var c = TL.incidentCtx(g, culpritId);
  var pool = g._aliveChars(c.loc).map(function (id) { return { type: "char", id: id, label: g._charName(id) }; });
  var t7 = await c.askTarget(pool, TL.iname(def.id), "選擇當事人所在區域的1名角色：");
  if (!t7) return;
  var kind = await g.io.askChoice({
    title: TL.L("butterflyTitle") || "蝴蝶效應",
    text: TL.L("butterflyText") || "放置哪種指示物？",
    options: [TL.t("game.counter.goodwill"), TL.t("game.counter.paranoia"), TL.t("game.counter.intrigue")]
  });
  if (kind === 0) c.st.chars[t7.id].goodwill += 1;
  else if (kind === 1) c.st.chars[t7.id].paranoia += 1;
  else c.st.chars[t7.id].intrigue += 1;
  c.st.plotFlags.butterflyHappened = true;
  g._log(TL.L("butterflyLog", { char: g._charName(t7.id), kind: [TL.t("game.counter.goodwill"), TL.t("game.counter.paranoia"), TL.t("game.counter.intrigue")][kind] }) ||
    ("【蝴蝶效應】" + g._charName(t7.id) + " [" + ["友好", "不安", "密謀"][kind] + "]+1。"));
});

TL.registerIncident("light_of_hope", async function (g, def, culpritId) {
  var c = TL.incidentCtx(g, culpritId);
  var targets = Object.keys(c.st.chars).filter(function (id) { return c.st.chars[id].alive; })
    .map(function (id) { return { type: "char", id: id, label: g._charName(id) }; });
  var t = await c.askTarget(targets, TL.iname(def.id), "選擇1名角色放置1枚[希望]：");
  if (t) {
    c.st.chars[t.id].hope = (c.st.chars[t.id].hope || 0) + 1;
    g._feed({ type: "marker", id: t.id, kind: "hope", delta: 1, value: c.st.chars[t.id].hope });
    g._log(TL.L("hopeIncident", { char: g._charName(t.id), v: c.st.chars[t.id].hope }) ||
      (g._charName(t.id) + " 希望+1（" + c.st.chars[t.id].hope + "）。"));
  }
});

TL.registerIncident("murk_of_despair", async function (g, def, culpritId) {
  var c = TL.incidentCtx(g, culpritId);
  var targets = Object.keys(c.st.chars).filter(function (id) { return c.st.chars[id].alive; })
    .map(function (id) { return { type: "char", id: id, label: g._charName(id) }; });
  var t = await c.askTarget(targets, TL.iname(def.id), "選擇1名角色放置1枚[絕望]：");
  if (t) {
    c.st.chars[t.id].despair = (c.st.chars[t.id].despair || 0) + 1;
    g._feed({ type: "marker", id: t.id, kind: "despair", delta: 1, value: c.st.chars[t.id].despair });
    g._log(TL.L("despairIncident", { char: g._charName(t.id), v: c.st.chars[t.id].despair }) ||
      (g._charName(t.id) + " 絕望+1（" + c.st.chars[t.id].despair + "）。"));
  }
});

TL.registerIncident("city_incident", async function (g) {
  var st = g.state;
  var cityChars = g._aliveChars("city");
  if (st.locations.city.intrigue >= 1) {
    for (var ci = 0; ci < cityChars.length; ci++) await g._applyDeath(cityChars[ci]);
  }
  if (st.locations.city.intrigue >= 2) await g._protagonistDeath("恐怖襲擊（都市2枚以上密謀）");
});

TL.registerIncident("uproar", async function (g) {
  var st = g.state;
  var schChars = g._aliveChars("school");
  var ctyChars = g._aliveChars("city");
  if (st.locations.school.intrigue >= 1) {
    for (var ui = 0; ui < schChars.length; ui++) await g._applyDeath(schChars[ui]);
  }
  if (st.locations.city.intrigue >= 1) {
    for (var uj = 0; uj < ctyChars.length; uj++) await g._applyDeath(ctyChars[uj]);
  }
});

TL.registerIncident("portent", async function (g, def, culpritId) {
  var c = TL.incidentCtx(g, culpritId);
  var sameArea = g._aliveChars(c.loc).map(function (id) { return { type: "char", id: id, label: g._charName(id) }; });
  var pt = await c.askTarget(sameArea, TL.iname(def.id), "往同區域的1名角色放置1枚[不安]：");
  if (pt) {
    c.st.chars[pt.id].paranoia += 1;
    g._log(g._charName(pt.id) + " 不安+1。");
  }
});

TL.registerIncident("culprit_reveal", async function (g, def, culpritId) {
  await g._revealRole(culpritId);
});

TL.registerIncident("remove_intrigue2", async function (g, def) {
  var st = g.state;
  var breakTargets = g._aliveChars().map(function (id) { return { type: "char", id: id, label: g._charName(id) }; })
    .concat(LOCATIONS.filter(function (l) { return !l.offBoard; }).map(function (l) {
      return { type: "location", id: l.id, label: TL.t("game.pTarget", { loc: TL.lname(l.id) }) };
    }));
  var bt = await g.io.askTarget({ title: TL.iname(def.id), text: "選擇1名角色或1塊版圖，移除2枚[密謀]：", targets: breakTargets });
  if (bt) {
    if (bt.type === "char") st.chars[bt.id].intrigue = Math.max(0, st.chars[bt.id].intrigue - 2);
    else st.locations[bt.id].intrigue = Math.max(0, st.locations[bt.id].intrigue - 2);
  }
});

TL.registerIncident("mass_suicide", async function (g, def, culpritId) {
  var c = TL.incidentCtx(g, culpritId);
  if (c.st.chars[culpritId].intrigue >= 1) {
    var msChars = g._aliveChars(c.loc);
    for (var mi = 0; mi < msChars.length; mi++) await g._applyDeath(msChars[mi]);
  }
});

TL.registerIncident("fire_of_demise", async function (g) {
  var st = g.state;
  var allChars = Object.keys(st.chars).filter(function (id) { return st.chars[id].alive; });
  for (var fi = 0; fi < allChars.length; fi++) await g._applyDeath(allChars[fi]);
  await g._protagonistDeath("滅絕之火");
});

TL.registerIncident("kill_chosen", async function (g, def, culpritId) {
  var st = g.state;
  var anyTargets = Object.keys(st.chars).filter(function (id) { return st.chars[id].alive && id !== culpritId; })
    .map(function (id) { return { type: "char", id: id, label: g._charName(id) }; });
  var kc = await g.io.askTarget({ title: TL.iname(def.id), text: "選擇1名角色：那名角色死亡。", targets: anyTargets });
  if (kc) await g._applyDeath(kc.id);
});

TL.registerIncident("bestial_murder", async function (g, def, culpritId) {
  // 獵奇殺人：<當事人不安限度+1><Ex槽增加2> 按照「連續殺人」「不安擴散」的順序結算事件
  g._addExGauge(2);
  await g._execIncident(INCIDENT_INDEX.serial_murder, culpritId);
  await g._execIncident(INCIDENT_INDEX.increasing_unease, culpritId);
});

TL.registerIncident("faked_suicide", async function (g, def, culpritId) {
  var st = g.state;
  g._placeExCard(culpritId);
  g._log(TL.L("fakedSuicide", { char: g._charName(culpritId) }) ||
    ("本輪輪迴剩餘時間，主人公將無法往" + g._charName(culpritId) + "身上放置行動牌。"));
  // MZ 模組紙：當事人初始區域有2枚或以上[密謀]→主人公死亡
  if (g.module.id === "MZ" && st.locations[st.chars[culpritId].startingLoc].intrigue >= 2) {
    g._log(TL.L("fakedSuicideStartIntrigue", { char: g._charName(culpritId) }) ||
      (g._charName(culpritId) + "的初始區域有2枚或以上[密謀]，主人公死亡。"));
    await g._protagonistDeath("偽裝自殺（當事人初始區域密謀2枚以上）");
  }
});

TL.registerIncident("suspicious_letter", async function (g, def, culpritId) {
  var c = TL.incidentCtx(g, culpritId);
  var slTargets = c.others;
  if (!slTargets.length) { g._log("（沒有可選擇的角色，什麼都沒發生）"); return; }
  var slChar = await c.askTarget(slTargets, TL.iname(def.id), "選擇和當事人位於同一區域的1名角色：");
  if (!slChar) return;
  var slFrom = c.st.chars[slChar.id].loc;
  var slLoc = await c.askTarget(c.locs, TL.iname(def.id), "將該角色移動至哪塊版圖？");
  if (!slLoc) return;
  c.st.chars[slChar.id].loc = slLoc.id;
  g._feed({ type: "move", id: slChar.id, from: slFrom, to: slLoc.id });
  g._log(g._charName(slChar.id) + "移動至" + g._locName(slLoc.id) + "。");
  if (slLoc.id !== slFrom) {
    c.st.cannotMoveNextDay[slChar.id] = true;
    g._log(TL.L("letterCannotMove", { char: g._charName(slChar.id) }) ||
      (g._charName(slChar.id) + "次日無法移動。"));
  }
});

TL.registerIncident("closed_circle", async function (g, def, culpritId) {
  var c = TL.incidentCtx(g, culpritId);
  c.st.closedCircles.push({ loc: c.loc, untilDay: c.st.day + 2 });
  g._log(TL.L("closedCircle", { loc: g._locName(c.loc), n: 3 }) ||
    (g._locName(c.loc) + "被封鎖，3天內角色無法通過移動進入或離開。"));
});

TL.registerIncident("silver_bullet", async function (g) {
  g._log(TL.L("silverBullet") || "【銀色子彈】該階段結束時，本輪輪迴結束（Ex槽不增加）。");
  g.state.plotFlags.silverBulletEnd = true;
});

TL.registerIncident("conspiracies", async function (g, def, culpritId) {
  // 陰謀活動：結算「連續殺人」或「失蹤」事件的效果
  var cIdx = await g.io.askChoice({
    title: TL.iname(def.id),
    text: "結算哪個事件的效果？",
    options: [TL.iname("serial_murder"), TL.iname("missing_person")],
    owner: "mm"
  });
  if (cIdx === 0) await g._execIncident(INCIDENT_INDEX.serial_murder, culpritId);
  else await g._execIncident(INCIDENT_INDEX.missing_person, culpritId);
});

TL.registerIncident("fake_incident", async function (g) {
  g._log(TL.L("fakeIncident") || "【偽造事件】將偽造事件記入公開信息表（遊戲中無額外效果）。");
});

TL.registerIncident("hound_dog_scent", async function (g) {
  g.state.houndDogActive = true;
  g._log(TL.L("houndDog") || "【廷達羅斯之嗅】本輪輪迴剩餘時間，如果發生其它事件，則在那個事件階段結束時主人公死亡。");
});

TL.registerIncident("discovery", async function (g) {
  g._addExGauge(1);
});

// ================= AHR / LL / HSA 事件 =================

// 世界移動
TL.registerIncident("dimensional_distortion", async function (g) {
  g._triggerWarp();
});

TL.registerIncident("dimensional_perversion", async function (g, def) {
  var c = TL.incidentCtx(g, def.culpritId);
  var t1 = await c.askTarget(c.anyChars, TL.iname(def.id), "選擇1名角色放置2枚[不安]：");
  var t2 = await c.askTarget(c.anyChars, TL.iname(def.id), "選擇另外1名角色放置2枚[友好]：");
  if (t1) { c.st.chars[t1.id].paranoia += 2; g._log(g._charName(t1.id) + " 不安+2。"); }
  if (t2) { c.st.chars[t2.id].goodwill += 2; g._log(g._charName(t2.id) + " 友好+2。"); }
  var warp = await g.io.confirm({
    title: TL.iname(def.id),
    text: TL.L("warpAsk") || "是否進行世界移動？",
    owner: "mm", kind: "warp"
  });
  if (warp) g._triggerWarp();
});

TL.registerIncident("dimensional_fracture", async function (g, def, culpritId) {
  var warp = await g.io.confirm({
    title: TL.iname(def.id),
    text: TL.L("warpAsk") || "是否進行世界移動？",
    owner: "mm", kind: "warp"
  });
  if (warp) g._triggerWarp();
  if (g._counterKinds(culpritId).length >= 3) {
    await g._protagonistDeath("次元斷層（當事人身上3種以上指示物）");
  }
});

TL.registerIncident("left_behind", async function (g, def, culpritId) {
  var c = TL.incidentCtx(g, culpritId);
  g.state.plotFlags.leftBehindTriggered = true;
  var targets = g._aliveChars(c.loc).map(function (id) { return { type: "char", id: id, label: g._charName(id) }; });
  var t = await c.askTarget(targets, TL.iname(def.id), "往與當事人同一區域的1名角色放置1枚[密謀]：");
  if (t) { c.st.chars[t.id].intrigue += 1; g._log(g._charName(t.id) + " 密謀+1。"); }
  var loc = await c.askTarget(c.locs, TL.iname(def.id), "將當事人移動至哪塊版圖？");
  if (loc) { c.st.chars[culpritId].loc = loc.id; g._log(g._charName(culpritId) + "移動至" + g._locName(loc.id) + "。"); }
});

TL.registerIncident("phantasmal_incident", async function (g, def, culpritId) {
  var c = TL.incidentCtx(g, culpritId);
  var pick = await g.io.askChoice({
    title: TL.iname(def.id),
    text: TL.L("phantasmalPick") || "處理哪個事件的效果？",
    options: [TL.iname("crime_of_passion"), TL.iname("dimensional_perversion"), TL.iname("left_behind")]
  });
  var subId = ["crime_of_passion", "dimensional_perversion", "left_behind"][pick == null ? 0 : pick];
  await g._execIncident(INCIDENT_INDEX[subId], culpritId);
});

TL.registerIncident("last_will", async function (g, def, culpritId) {
  g.state.plotFlags.lastWillTriggered = true;
  await g._applyDeath(culpritId);
});

TL.registerIncident("the_singularity", async function (g, def, culpritId) {
  var st = g.state;
  if (!g._isDarkWorld()) {
    if (!st.plotFlags.singularityFired) {
      st.plotFlags.singularityFired = true;
      await g._protagonistDeath("奇點（表世界首次發生）");
    } else {
      g._triggerWarp();
    }
  } else {
    var c = st.chars[culpritId];
    if (st.locations[c.startingLoc].intrigue >= 1) {
      await g._protagonistDeath("奇點（裏世界，當事人初始區域有密謀）");
    }
  }
});

TL.registerIncident("the_executor", async function (g, def, culpritId) {
  var st = g.state;
  st.plotFlags.executorTriggered = true;
  var pIdx = await g.io.askChoice({
    title: TL.iname(def.id),
    text: TL.L("executorPick") || "劇作家指定1名主人公，由那名主人公選擇1名角色死亡。",
    options: [TL.t("basic.protagonistA"), TL.t("basic.protagonistB"), TL.t("basic.protagonistC")]
  });
  var targets = Object.keys(st.chars).filter(function (id) { return st.chars[id].alive; })
    .map(function (id) { return { type: "char", id: id, label: g._charName(id) }; });
  var t = await g.io.askTarget({ title: TL.iname(def.id), text: TL.L("executorTarget") || "選擇1名角色：那名角色死亡。", targets: targets });
  if (t) await g._applyDeath(t.id);
  var c = st.chars[culpritId];
  if (st.locations[c.startingLoc].intrigue >= 2) {
    await g._protagonistDeath("代行者（當事人初始區域密謀2枚以上）");
  }
});

TL.registerIncident("distortion", async function (g, def, culpritId) {
  var st = g.state;
  var c = st.chars[culpritId];
  if (st.locations[c.startingLoc].intrigue >= 2) {
    await g._protagonistDeath("驟變（當事人初始區域密謀2枚以上）");
  } else {
    st.locations[c.startingLoc].intrigue += 2;
    g._log(g._locName(c.startingLoc) + " 密謀+2。");
  }
});

TL.registerIncident("blasphemous_murder", async function (g, def, culpritId) {
  var c = TL.incidentCtx(g, culpritId);
  var opts = c.others.map(function (o) { return { type: "char", id: o.id, label: g._charName(o.id) }; })
    .concat([{ type: "location", id: c.loc, label: g._locName(c.loc) + "（版圖）" }]);
  var t = await c.askTarget(opts, TL.iname(def.id), "選擇1名角色死亡，或往當事人所在版圖放置1枚[密謀]：");
  if (!t) return;
  if (t.type === "char") await g._applyDeath(t.id);
  else { c.st.locations[t.id].intrigue += 1; g._log(g._locName(t.id) + " 密謀+1。"); }
});

TL.registerIncident("left_alone", async function (g, def, culpritId) {
  var c = TL.incidentCtx(g, culpritId);
  var movers = c.others.slice();
  for (var mi = 0; mi < movers.length; mi++) {
    var id = movers[mi].id;
    var from = c.st.chars[id].loc;
    var locOpts = LOCATIONS.filter(function (l) { return !l.offBoard && l.id !== from; })
      .map(function (l) { return { type: "location", id: l.id, label: g._locName(l.id) }; });
    var t = await c.askTarget(locOpts, TL.iname(def.id), ("將" + g._charName(id) + "移動至哪塊版圖？"));
    if (t) { c.st.chars[id].loc = t.id; g._feed({ type: "move", id: id, from: from, to: t.id }); }
  }
});

TL.registerIncident("night_of_madness", async function (g, def, culpritId) {
  var zombieCount = g._aliveChars().filter(function (id) { return g.state.chars[id].role === "zombie"; }).length +
    Object.keys(g.state.chars).filter(function (id) { return !g.state.chars[id].alive && g.state.chars[id].role === "zombie"; }).length;
  if (zombieCount >= 6) {
    g.state.plotFlags.nightOfMadness = true;
    g._log(TL.L("nightMadness") || "【瘋狂之夜】遊戲中有6具或以上喪屍，本回合結束階段主人公死亡。");
  }
});

TL.registerIncident("curse_awakening", async function (g, def, culpritId) {
  var c = TL.incidentCtx(g, culpritId);
  g.state.plotFlags.curseLoc = c.loc;
  g._log(TL.L("curseAwaken", { loc: g._locName(c.loc) }) || ("【詛咒活化】往" + g._locName(c.loc) + "放置1張詛咒牌。"));
});

TL.registerIncident("filth_overflow", async function (g, def, culpritId) {
  var c = TL.incidentCtx(g, culpritId);
  var t1 = await c.askTarget(c.anyChars, TL.iname(def.id), "選擇1名角色放置2枚[不安]：");
  var t2 = await c.askTarget(c.locs, TL.iname(def.id), "選擇1塊版圖放置1枚[密謀]：");
  if (t1) { c.st.chars[t1.id].paranoia += 2; g._log(g._charName(t1.id) + " 不安+2。"); }
  if (t2) { c.st.locations[t2.id].intrigue += 1; g._log(g._locName(t2.id) + " 密謀+1。"); }
});

TL.registerIncident("apocalypse_of_the_dead", async function (g, def, culpritId) {
  var c = TL.incidentCtx(g, culpritId);
  var victims = g._aliveChars(c.loc).slice();
  for (var vi = 0; vi < victims.length; vi++) await g._applyDeath(victims[vi]);
  var corpseCount = Object.keys(c.st.chars).filter(function (id) {
    return !c.st.chars[id].alive && c.st.chars[id].loc === c.loc;
  }).length;
  if (corpseCount >= 5) await g._protagonistDeath("死者默示錄（5具以上屍體）");
});
