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
    // 判定是否發生：強迫症/偵探強制發生；預言家同區域阻擋
    var force = culprit.role === "obstinate" || this._detectiveForce(inc.culpritId);
    var blocked = this._prophetBlocks(inc.culpritId);
    if (!culprit.alive || blocked || (this._incidentCount(def, inc.culpritId) < this._incidentLimit(def, inc.culpritId) && !force)) {
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
