// 能力系統：劇作家能力 + 友好能力（階段調度 + 效果註冊表，可拆卸）
window.TL = window.TL || {};

// ---------- 註冊表 ----------
// 劇作家能力：effect -> { targets(game, entry), usable(game, entry), exec(game, entry, target) }
TL.MM_ABILITIES = {};
TL.registerMMAbility = function (effect, impl) {
  TL.MM_ABILITIES[effect] = impl;
};

// 額外劇作家能力來源（規則/副規則提供）：fn(game) -> entry | null
TL.MM_EXTRA_SOURCES = [];
TL.registerMMSource = function (fn) {
  TL.MM_EXTRA_SOURCES.push(fn);
};

// 友好能力：effect -> { targets(game, chosen), exec(game, ctx, targetOverride) }
TL.GOODWILL_ABILITIES = {};
TL.registerGoodwillAbility = function (effect, impl) {
  TL.GOODWILL_ABILITIES[effect] = impl;
};

// 友好能力結算後掛鉤（角色身份觸發）：roleId -> fn(game, charId)
TL.GOODWILL_AFTER = {};
TL.registerGoodwillAfter = function (roleId, fn) {
  TL.GOODWILL_AFTER[roleId] = fn;
};

// ---------- 劇作家能力階段 ----------
TL.Game.prototype._mmAbilityPhase = async function () {
  var st = this.state;
  var self = this;
  this._log(TL.I18N.log("mmPhase") || "—— 劇作家能力階段 ——");
  if (this.uiManaged) {
    return;
  }
  var abilities = this.mmAbilities();
  if (!abilities.length) {
    this._log(TL.I18N.log("mmNone") || "（沒有可用的劇作家能力）");
    return;
  }
  // 強制能力（如心理醫生）先自動執行
  var mandatory = this.usableMMAbilities().filter(function (a) { return a.ability.mandatory; });
  for (var mmi = 0; mmi < mandatory.length; mmi++) {
    await this._execMMAbility(mandatory[mmi]);
  }
  var continueFlag = true;
  while (continueFlag) {
    var usable = this.usableMMAbilities();
    if (!usable.length) break;
    var opts = usable.map(function (a, i) {
      var who = a.charId ? self._charName(a.charId) + "（" + (ROLE_INDEX[st.chars[a.charId].role] ? ROLE_INDEX[st.chars[a.charId].role].name : "") + "）" : "副規則";
      var roleId = a.charId ? st.chars[a.charId].role : null;
      return who + "：" + TL.desc("role." + roleId + "." + a.ability.effect, a.ability.desc);
    });
    opts.push("結束能力階段");
    var idx = await this.io.askChoice({
      title: "劇作家能力",
      text: "選擇要使用的能力（每個角色每天最多1次）：",
      options: opts
    });
    if (idx == null || idx >= usable.length) { continueFlag = false; break; }
    await this._execMMAbility(usable[idx]);
  }
};

// 全部潛在的劇作家能力：角色能力（mm_phase）+ 規則/副規則來源
TL.Game.prototype.mmAbilities = function () {
  var st = this.state;
  var abilities = [];
  var self = this;
  this._aliveChars().forEach(function (id) {
    var role = self._role(id);
    if (!role) return;
    role.abilities.forEach(function (ab) {
      if (ab.timing === "mm_phase") abilities.push({ charId: id, ability: ab });
    });
  });
  TL.MM_EXTRA_SOURCES.forEach(function (fn) {
    var entry = fn(self);
    if (entry) abilities.push(entry);
  });
  return abilities;
};

// 目前可用的劇作家能力（委派給各效果的 usable 掛鉤）
TL.Game.prototype.usableMMAbilities = function () {
  var st = this.state;
  var self = this;
  return this.mmAbilities().filter(function (a) {
    var key = (a.charId || "plot") + "|" + a.ability.effect;
    if (st.usedMMAbility[key]) return false;
    var impl = TL.MM_ABILITIES[a.ability.effect];
    if (impl && impl.usable && !impl.usable(self, a)) return false;
    if (a.charId != null) {
      var c = st.chars[a.charId];
      if (!c || !c.alive) return false;
    }
    return true;
  });
};

// 劇作家能力的可選目標（委派給各效果的 targets 掛鉤）
TL.Game.prototype.mmAbilityTargets = function (entry) {
  var impl = TL.MM_ABILITIES[entry.ability.effect];
  return (impl && impl.targets) ? impl.targets(this, entry) : [];
};

TL.Game.prototype.execMMAbility = async function (entry, target) {
  await this._execMMAbility(entry, target);
};

TL.Game.prototype._execMMAbility = async function (entry, targetOverride) {
  var st = this.state;
  var eff = entry.ability.effect;
  var key = (entry.charId || "plot") + "|" + eff;
  st.usedMMAbility[key] = true;
  // 上位存在：劇作家使用其友好能力時，與主人的 1x∞ 限制共用
  if (entry.charId === "higher_being" && eff === "hope_despair") {
    st.usedGoodwill["higher_being"] = st.usedGoodwill["higher_being"] || {};
    st.usedGoodwill["higher_being"][0] = true;
  }
  // AHR：劇作家使用 1x∞ 友好能力後自動觸發世界移動
  if (this.module && this.module.id === "AHR" && entry.ability.oncePerLoop) {
    this._triggerWarp(true);
  }
  var impl = TL.MM_ABILITIES[eff];
  var gwImpl = TL.GOODWILL_ABILITIES[eff];
  if ((!impl || !impl.exec) && gwImpl && gwImpl.exec) {
    // 傀儡無視友好：劇作家使用角色的友好能力（共享1x∞計數）
    if (entry.charId != null && entry.ability.abilityIdx != null) {
      st.usedGoodwill[entry.charId] = st.usedGoodwill[entry.charId] || {};
      if (entry.ability.oncePerLoop) st.usedGoodwill[entry.charId][entry.ability.abilityIdx] = true;
    }
    var chosen = { charId: entry.charId, abilityIdx: entry.ability.abilityIdx || 0, ability: entry.ability };
    var ctx = TL.goodwillCtx(this, chosen);
    await gwImpl.exec(this, ctx, targetOverride);
    return;
  }
  if (!impl || !impl.exec) {
    this._log("（劇作家能力「" + eff + "」尚未實作）");
    return;
  }
  await impl.exec(this, entry, targetOverride);
};

// ---------- 劇作家能力效果註冊 ----------
function mmBrainImpl() {
  return {
    targets: function (game, entry) {
      var loc = game._charArea(entry.charId);
      return game._aliveChars(loc).map(function (id) { return { type: "char", id: id, label: game._charName(id) }; })
        .concat([{ type: "location", id: loc, label: game._locName(loc) + "（版圖）" }]);
    },
    exec: async function (game, entry, targetOverride) {
      var st = game.state;
      var loc = game._charArea(entry.charId);
      var targets = game._aliveChars(loc).map(function (id) { return { type: "char", id: id, label: game._charName(id) }; })
        .concat([{ type: "location", id: loc, label: TL.t("game.pTarget", { loc: game._locName(loc) }) }]);
      var t = targetOverride || await game.io.askTarget({ title: TL.rname("brain"), text: TL.I18N.log("brainPrompt") || "往同一區域的1名角色或版圖放置1枚[密謀]。", targets: targets });
      if (!t) { game._log(TL.I18N.log("brainSkip") || "劇作家未使用能力。"); return; }
      if (t.type === "char") {
        st.chars[t.id].intrigue += 1;
        game._feed({ type: "marker", id: t.id, kind: "intrigue", delta: 1, value: st.chars[t.id].intrigue });
        game._log(TL.I18N.log("intriguePlus", { char: game._charName(t.id), n: 1, v: st.chars[t.id].intrigue }) ||
          (game._charName(t.id) + " 密謀+1（" + st.chars[t.id].intrigue + "）。"));
      } else {
        st.locations[t.id].intrigue += 1;
        game._feed({ type: "loc_marker", id: t.id, kind: "intrigue", delta: 1, value: st.locations[t.id].intrigue });
        game._log(TL.I18N.log("locIntriguePlus", { loc: game._locName(t.id), n: 1, v: st.locations[t.id].intrigue }) ||
          (game._locName(t.id) + " 密謀+1（" + st.locations[t.id].intrigue + "）。"));
      }
    }
  };
}
TL.registerMMAbility("brain_intrigue", mmBrainImpl());
TL.registerMMAbility("faceless_deep_one", mmBrainImpl());

function mmCtImpl() {
  return {
    targets: function (game, entry) {
      var loc = game._charArea(entry.charId);
      return game._aliveChars(loc).map(function (id) { return { type: "char", id: id, label: game._charName(id) }; });
    },
    exec: async function (game, entry, targetOverride) {
      var st = game.state;
      var loc = game._charArea(entry.charId);
      var targets = game._aliveChars(loc).map(function (id) { return { type: "char", id: id, label: game._charName(id) }; });
      var t = targetOverride || await game.io.askTarget({ title: TL.rname("conspiracy_theorist"), text: TL.I18N.log("ctPrompt") || "往同一區域的1名角色身上放置1枚[不安]。", targets: targets });
      if (!t) { game._log(TL.I18N.log("ctSkip") || "劇作家未使用能力。"); return; }
      st.chars[t.id].paranoia += 1;
      game._feed({ type: "marker", id: t.id, kind: "paranoia", delta: 1, value: st.chars[t.id].paranoia });
      game._log(TL.I18N.log("paranoiaPlus", { char: game._charName(t.id), n: 1, v: st.chars[t.id].paranoia }) ||
        (game._charName(t.id) + " 不安+1（" + st.chars[t.id].paranoia + "）。"));
    }
  };
}
TL.registerMMAbility("ct_paranoia", mmCtImpl());
TL.registerMMAbility("faceless_ct", mmCtImpl());

TL.registerMMAbility("unsettling_rumor", {
  usable: function (game) { return !game.state.plotFlags.unsettledRumorUsed; },
  targets: function () {
    return LOCATIONS.filter(function (l) { return !l.offBoard; }).map(function (l) {
      return { type: "location", id: l.id, label: TL.t("game.pTarget", { loc: TL.lname(l.id) }) };
    });
  },
  exec: async function (game, entry, targetOverride) {
    var st = game.state;
    var targets = LOCATIONS.map(function (l) { return { type: "location", id: l.id, label: TL.t("game.pTarget", { loc: TL.lname(l.id) }) }; });
    var t = targetOverride || await game.io.askTarget({ title: TL.pname("unsettling_rumor"), text: TL.I18N.log("rumorPrompt") || "往任意1塊版圖上放置1枚[密謀]。(每輪限1次)", targets: targets });
    if (!t) { game._log(TL.I18N.log("rumorSkip") || "劇作家未使用能力。"); return; }
    st.locations[t.id].intrigue += 1;
    st.plotFlags.unsettledRumorUsed = true;
    game._feed({ type: "loc_marker", id: t.id, kind: "intrigue", delta: 1, value: st.locations[t.id].intrigue });
    game._log(TL.I18N.log("locIntriguePlus", { loc: game._locName(t.id), n: 1, v: st.locations[t.id].intrigue }) ||
      (game._locName(t.id) + " 密謀+1（" + st.locations[t.id].intrigue + "）。"));
  }
});

TL.registerMMAbility("unsafe_trigger", {
  usable: function (game) {
    return !game.state.plotFlags.unsafeTriggerUsed && game._aliveChars().some(function (id) { return game.state.chars[id].role === "factor"; });
  },
  targets: function (game) {
    var st = game.state;
    var factorLocs = [];
    Object.keys(st.chars).forEach(function (id) {
      if (st.chars[id].alive && st.chars[id].role === "factor") {
        var fl = st.chars[id].loc;
        if (factorLocs.indexOf(fl) < 0) factorLocs.push(fl);
      }
    });
    return factorLocs.map(function (lid) {
      return { type: "location", id: lid, label: TL.t("game.pTarget", { loc: TL.lname(lid) }) };
    });
  },
  exec: async function (game, entry, targetOverride) {
    var st = game.state;
    var factorLocs = [];
    Object.keys(st.chars).forEach(function (id) {
      if (st.chars[id].alive && st.chars[id].role === "factor") {
        var fl = st.chars[id].loc;
        if (factorLocs.indexOf(fl) < 0) factorLocs.push(fl);
      }
    });
    var uTargets = factorLocs.map(function (lid) {
      return { type: "location", id: lid, label: TL.t("game.pTarget", { loc: TL.lname(lid) }) };
    });
    var ut = targetOverride || await game.io.askTarget({
      title: TL.L("unsafeTriggerTitle") || "χ異因子",
      text: TL.L("unsafeTriggerPrompt") || "往存活的不安定因子所在版圖放置1枚[密謀]。",
      targets: uTargets,
      owner: "mm"
    });
    if (!ut) return;
    st.locations[ut.id].intrigue += 1;
    st.plotFlags.unsafeTriggerUsed = true;
    game._feed({ type: "loc_marker", id: ut.id, kind: "intrigue", delta: 1, value: st.locations[ut.id].intrigue });
    game._log(game._locName(ut.id) + " 密謀+1（" + st.locations[ut.id].intrigue + "）。");
  }
});

TL.registerMMAbility("paranoiac_self_marker", {
  exec: async function (game, entry) {
    var st = game.state;
    var pk = await game.io.askChoice({
      title: TL.rname("paranoiac"),
      text: TL.L("paranoiacSelf") || "往該角色身上放置1枚[密謀]或[不安]？",
      options: [TL.term("card.m_intrigue_plus1", "密謀+1"), TL.term("card.m_paranoia_plus", "不安+1")],
      owner: "mm"
    });
    var cid = entry.charId;
    if (pk === 0) {
      st.chars[cid].intrigue += 1;
      game._feed({ type: "marker", id: cid, kind: "intrigue", delta: 1, value: st.chars[cid].intrigue });
      game._log(game._charName(cid) + " 密謀+1（" + st.chars[cid].intrigue + "）。");
    } else {
      st.chars[cid].paranoia += 1;
      game._feed({ type: "marker", id: cid, kind: "paranoia", delta: 1, value: st.chars[cid].paranoia });
      game._log(game._charName(cid) + " 不安+1（" + st.chars[cid].paranoia + "）。");
    }
  }
});

TL.registerMMAbility("therapist_remove_paranoia", {
  usable: function (game, entry) {
    if (game.state.exGauge < 1) return false;
    var area = game._charArea(entry.charId);
    return game._aliveChars(area).some(function (id) {
      return id !== entry.charId && game.state.chars[id].paranoia >= 1;
    });
  },
  targets: function (game, entry) {
    var area = game._charArea(entry.charId);
    return game._aliveChars(area).filter(function (id) {
      return id !== entry.charId && game.state.chars[id].paranoia >= 1;
    }).map(function (id) { return { type: "char", id: id, label: game._charName(id) }; });
  },
  exec: async function (game, entry, targetOverride) {
    var st = game.state;
    var area = game._charArea(entry.charId);
    var targets = game._aliveChars(area).filter(function (id) {
      return id !== entry.charId && st.chars[id].paranoia >= 1;
    }).map(function (id) { return { type: "char", id: id, label: game._charName(id) }; });
    if (!targets.length) { game._log("（沒有可移除不安的目標）"); return; }
    var tt = targetOverride || await game.io.askTarget({
      title: TL.rname("therapist"),
      text: TL.L("therapistPrompt") || "移除同一區域中自身以外1名角色身上的1枚[不安]。",
      targets: targets,
      owner: "mm"
    });
    if (!tt) return;
    st.chars[tt.id].paranoia = Math.max(0, st.chars[tt.id].paranoia - 1);
    game._feed({ type: "marker", id: tt.id, kind: "paranoia", delta: -1, value: st.chars[tt.id].paranoia });
    game._log(game._charName(tt.id) + " 不安-1（" + st.chars[tt.id].paranoia + "）。");
  }
});

TL.registerMMAbility("magician_move", {
  usable: function (game) { return !game.state.plotFlags.magicianMoveUsed; },
  targets: function (game, entry) {
    var area = game._charArea(entry.charId);
    return game._aliveChars(area).filter(function (id) {
      return id !== entry.charId && game.state.chars[id].paranoia >= 1;
    }).map(function (id) { return { type: "char", id: id, label: game._charName(id) }; });
  },
  exec: async function (game, entry, targetOverride) {
    var st = game.state;
    var area = game._charArea(entry.charId);
    var targets = game._aliveChars(area).filter(function (id) {
      return id !== entry.charId && st.chars[id].paranoia >= 1;
    }).map(function (id) { return { type: "char", id: id, label: game._charName(id) }; });
    if (!targets.length) { game._log("（沒有身上有1枚以上不安的角色可移動）"); return; }
    var mt = targetOverride || await game.io.askTarget({
      title: TL.rname("magician"),
      text: TL.L("magicianMovePrompt") || "選擇同一區域中1名放置了1枚或以上不安指示物的角色。",
      targets: targets,
      owner: "mm"
    });
    if (!mt) return;
    var mFrom = st.chars[mt.id].loc;
    var mOpts = [];
    ["h", "v", "d"].forEach(function (mt2) {
      (ADJ[mFrom] && ADJ[mFrom][mt2] || []).forEach(function (lid) {
        if (mOpts.indexOf(lid) < 0) mOpts.push(lid);
      });
    });
    if (!mOpts.length) { game._log("（沒有相鄰版圖可移動）"); return; }
    var mi = await game.io.askChoice({
      title: TL.rname("magician"),
      text: TL.L("magicianMoveTo") || ("將" + game._charName(mt.id) + "移動至哪塊版圖？"),
      options: mOpts.map(function (lid) { return TL.lname(lid); }),
      owner: "mm"
    });
    var mTo = mOpts[mi == null ? 0 : mi];
    st.chars[mt.id].loc = mTo;
    game._feed({ type: "move", id: mt.id, from: mFrom, to: mTo });
    st.plotFlags.magicianMoveUsed = true;
    game._log(game._charName(mt.id) + "移動至" + game._locName(mTo) + "。");
  }
});

// 上位存在（劇作家使用）：委派給友好能力 hope_despair
TL.registerMMAbility("hope_despair", {
  targets: function (game, entry) {
    var loc = game._charArea(entry.charId);
    return game._aliveChars(loc).filter(function (id) { return id !== entry.charId; })
      .map(function (id) { return { type: "char", id: id, label: game._charName(id) }; });
  },
  exec: async function (game, entry, targetOverride) {
    var chosen = { charId: entry.charId, abilityIdx: 0, ability: CHAR_INDEX.higher_being.goodwill[0] };
    var impl = TL.GOODWILL_ABILITIES["hope_despair"];
    var ctx = TL.goodwillCtx(game, chosen);
    await impl.exec(game, ctx, targetOverride);
  }
});

// 敘述者：Ex槽1+ → 選擇同區域另外2名角色，移動其中1枚指示物
TL.registerMMAbility("storyteller_move_counter", {
  usable: function (game) { return game.state.exGauge >= 1; },
  targets: function (game, entry) {
    var loc = game._charArea(entry.charId);
    return game._aliveChars(loc).filter(function (id) { return id !== entry.charId; })
      .map(function (id) { return { type: "char", id: id, label: game._charName(id) }; });
  },
  exec: async function (game, entry, targetOverride) {
    var st = game.state;
    var loc = game._charArea(entry.charId);
    var pool = game._aliveChars(loc).filter(function (id) { return id !== entry.charId; });
    if (pool.length < 2) { game._log(TL.L("storytellerNoTarget") || "敘述者所在區域沒有2名其他角色。"); return; }
    var a = await game.io.askChoice({ title: TL.rname("storyteller"), text: "選擇第1名角色（指示物來源）：", options: pool.map(function (id) { return game._charName(id); }) });
    var b = await game.io.askChoice({ title: TL.rname("storyteller"), text: "選擇第2名角色（指示物目標）：", options: pool.map(function (id) { return game._charName(id); }) });
    if (a == null || b == null || a === b) return;
    var from = pool[a], to = pool[b];
    var kinds = [];
    if (st.chars[from].paranoia > 0) kinds.push("paranoia");
    if (st.chars[from].goodwill > 0) kinds.push("goodwill");
    if (st.chars[from].intrigue > 0) kinds.push("intrigue");
    if (st.chars[from].hope > 0) kinds.push("hope");
    if (st.chars[from].despair > 0) kinds.push("despair");
    if (!kinds.length) { game._log(TL.L("storytellerNoMarker") || (game._charName(from) + "身上沒有可移動的指示物。")); return; }
    var k = await game.io.askChoice({ title: TL.rname("storyteller"), text: "移動哪種指示物？", options: kinds.map(function (kd) { return TL.t("game.counter." + kd); }) });
    if (k == null) return;
    var kindId = kinds[k];
    st.chars[from][kindId] -= 1;
    st.chars[to][kindId] += 1;
    game._feed({ type: "marker", id: from, kind: kindId, delta: -1, value: st.chars[from][kindId] });
    game._feed({ type: "marker", id: to, kind: kindId, delta: 1, value: st.chars[to][kindId] });
    game._log(game._charName(from) + "→" + game._charName(to) + " 移動1枚[" + kinds[k] + "]。");
  }
});

// 童謠：同區域任意1名角色不安+1或友好+1（每輪限1次）
TL.registerMMAbility("lullaby_marker", {
  targets: function (game, entry) {
    var loc = game._charArea(entry.charId);
    return game._aliveChars(loc).map(function (id) { return { type: "char", id: id, label: game._charName(id) }; });
  },
  exec: async function (game, entry, targetOverride) {
    var st = game.state;
    var loc = game._charArea(entry.charId);
    var targets = game._aliveChars(loc).map(function (id) { return { type: "char", id: id, label: game._charName(id) }; });
    var t = targetOverride || await game.io.askTarget({ title: TL.rname("lullaby"), text: "往同一區域的1名角色放置1枚[不安]或[友好]：", targets: targets, owner: "mm" });
    if (!t) return;
    var k = await game.io.askChoice({
      title: TL.rname("lullaby"),
      text: "放置哪種指示物？",
      options: [TL.t("game.counter.paranoia"), TL.t("game.counter.goodwill")],
      owner: "mm"
    });
    if (k === 0) { st.chars[t.id].paranoia += 1; game._feed({ type: "marker", id: t.id, kind: "paranoia", delta: 1, value: st.chars[t.id].paranoia }); game._log(game._charName(t.id) + " 不安+1。"); }
    else { st.chars[t.id].goodwill += 1; game._feed({ type: "marker", id: t.id, kind: "goodwill", delta: 1, value: st.chars[t.id].goodwill }); game._log(game._charName(t.id) + " 友好+1。"); }
  }
});

// 佈道者：同區域任意1名角色友好+1
TL.registerMMAbility("gossip_goodwill", {
  targets: function (game, entry) {
    var loc = game._charArea(entry.charId);
    return game._aliveChars(loc).map(function (id) { return { type: "char", id: id, label: game._charName(id) }; });
  },
  exec: async function (game, entry, targetOverride) {
    var st = game.state;
    var loc = game._charArea(entry.charId);
    var targets = game._aliveChars(loc).map(function (id) { return { type: "char", id: id, label: game._charName(id) }; });
    var t = targetOverride || await game.io.askTarget({ title: TL.rname("gossip"), text: "往同一區域的1名角色放置1枚[友好]：", targets: targets, owner: "mm" });
    if (t) { st.chars[t.id].goodwill += 1; game._feed({ type: "marker", id: t.id, kind: "goodwill", delta: 1, value: st.chars[t.id].goodwill }); game._log(game._charName(t.id) + " 友好+1。"); }
  }
});

// 鬼魂：劇作家能力階段，若死亡 → 同一區域或初始區域1名角色不安+1
TL.registerMMAbility("ghost_mm_paranoia", {
  usable: function (game, entry) { return !game.state.chars[entry.charId].alive; },
  targets: function (game, entry) {
    var st = game.state;
    var c = st.chars[entry.charId];
    var locs = [c.loc, c.startingLoc];
    var out = [];
    locs.forEach(function (l) {
      game._aliveChars(l).forEach(function (id) {
        if (out.indexOf(id) < 0) out.push(id);
      });
    });
    return out.map(function (id) { return { type: "char", id: id, label: game._charName(id) }; });
  },
  exec: async function (game, entry, targetOverride) {
    var st = game.state;
    var c = st.chars[entry.charId];
    var locs = [c.loc, c.startingLoc];
    var out = [];
    locs.forEach(function (l) {
      game._aliveChars(l).forEach(function (id) { if (out.indexOf(id) < 0) out.push(id); });
    });
    var targets = out.map(function (id) { return { type: "char", id: id, label: game._charName(id) }; });
    var t = targetOverride || await game.io.askTarget({ title: TL.rname("ghost"), text: "往同一區域或初始區域的1名角色放置1枚[不安]：", targets: targets, owner: "mm" });
    if (t) { st.chars[t.id].paranoia += 1; game._feed({ type: "marker", id: t.id, kind: "paranoia", delta: 1, value: st.chars[t.id].paranoia }); game._log(game._charName(t.id) + " 不安+1。"); }
  }
});

// 膽小鬼：劇作家能力階段，若2+不安 → 移動至相鄰版圖
TL.registerMMAbility("coward_move", {
  usable: function (game, entry) { return game._effParanoia(entry.charId) >= 2; },
  targets: function () { return []; },
  exec: async function (game, entry) {
    var st = game.state;
    var cid = entry.charId;
    var from = st.chars[cid].loc;
    var opts = [];
    ["h", "v", "d"].forEach(function (mt) {
      (ADJ[from] && ADJ[from][mt] || []).forEach(function (lid) { if (opts.indexOf(lid) < 0) opts.push(lid); });
    });
    if (!opts.length) return;
    var mi = await game.io.askChoice({
      title: TL.rname("coward"),
      text: TL.L("cowardMoveTo", { char: game._charName(cid) }) || ("將" + game._charName(cid) + "移動至哪塊相鄰版圖？"),
      options: opts.map(function (lid) { return game._locName(lid); }),
      owner: "mm"
    });
    var to = opts[mi == null ? 0 : mi];
    st.chars[cid].loc = to;
    game._feed({ type: "move", id: cid, from: from, to: to });
    game._log(game._charName(cid) + "移動至" + game._locName(to) + "。");
  }
});

// 額外來源：怪物們的陰謀（HSA）——往擁有無視友好身份特性的角色所在版圖放置密謀（每日限1次，每輪限2次）
TL.registerMMSource(function (game) {
  if (!game._hasSubplot("monsters_plot")) return null;
  var st = game.state;
  var usedToday = st.usedMMAbility["plot|monsters_plot_marker"];
  if (usedToday || st.plotFlags.monstersPlotUsed >= 2) return null;
  var refusalChars = game._aliveChars().filter(function (id) {
    return game._refusalOf(id) !== "none";
  });
  if (!refusalChars.length) return null;
  return {
    charId: null,
    ability: {
      timing: "mm_phase", mandatory: false,
      desc: TL.desc("ability.monsters_plot", "【怪物們的陰謀】往擁有無視友好身份特性的角色所在版圖放置1枚[密謀]（每日限1次，每輪限2次）。"),
      effect: "monsters_plot_marker"
    }
  };
});
TL.registerMMAbility("monsters_plot_marker", {
  targets: function (game) {
    var st = game.state;
    var locs = [];
    game._aliveChars().forEach(function (id) {
      if (game._refusalOf(id) !== "none") {
        var l = st.chars[id].loc;
        if (locs.indexOf(l) < 0) locs.push(l);
      }
    });
    return locs.map(function (lid) { return { type: "location", id: lid, label: game._locName(lid) }; });
  },
  exec: async function (game, entry, targetOverride) {
    var st = game.state;
    var targets = this.targets(game);
    var t = targetOverride || await game.io.askTarget({ title: TL.pname("monsters_plot"), text: "往1塊版圖放置1枚[密謀]：", targets: targets, owner: "mm" });
    if (!t) return;
    st.locations[t.id].intrigue += 1;
    st.plotFlags.monstersPlotUsed += 1;
    game._feed({ type: "loc_marker", id: t.id, kind: "intrigue", delta: 1, value: st.locations[t.id].intrigue });
    game._log(game._locName(t.id) + " 密謀+1。");
  }
});

// 額外來源：怪傑（日數為3的倍數 → 獲得傳謠人/主謀/殺人狂能力）
TL.registerMMSource(function (game) {
  var st = game.state;
  if (st.day % 3 !== 0) return null;
  var wc = game._aliveChars().filter(function (id) { return st.chars[id].role === "wildcard"; })[0];
  if (!wc) return null;
  return { charId: wc, ability: { timing: "mm_phase", mandatory: false, desc: TL.desc("role.wildcard.wildcard_triple", "【怪傑】獲得傳謠人、主謀以及殺人狂的能力。"), effect: "ct_paranoia" } };
});

// 額外來源：傀儡無視友好（AHR/角色）——劇作家可使用擁有傀儡無視友好的角色的友好能力
TL.registerMMSource(function (game) {
  var st = game.state;
  var out = null;
  game._aliveChars().forEach(function (id) {
    if (out) return;
    var refusal = game._refusalOf(id);
    if (refusal !== "puppeted") return;
    var data = CHAR_INDEX[id];
    (data.goodwill || []).forEach(function (ab, i) {
      if (out) return;
      if (ab.oncePerLoop && st.usedGoodwill[id] && st.usedGoodwill[id][i]) return;
      var effGw = game.module && game.module.id === "AHR" && (st.exGauge % 2) === 1
        ? game._effParanoia(id) : game._effGoodwill(id);
      if (effGw < ab.cost) return;
      out = {
        charId: id,
        ability: {
          timing: "mm_phase", mandatory: false,
          desc: TL.desc("char." + id + "." + i, ab.desc),
          effect: ab.effect,
          oncePerLoop: ab.oncePerLoop,
          abilityIdx: i
        }
      };
    });
  });
  return out;
});

// 額外來源：χ異因子（LL 版本）
TL.registerMMSource(function (game) {
  if (!game._hasSubplot("unsafe_trigger_ll")) return null;
  return { charId: null, ability: { timing: "mm_phase", mandatory: false, desc: TL.desc("ability.unsafe_trigger_ll", "【χ異因子】往存活的不安定因子所在的版圖放置1枚[密謀]。（每輪限1次）"), effect: "unsafe_trigger" } };
});

// 額外來源：不安定因子（學校2+密謀時獲得傳謠人能力）
TL.registerMMSource(function (game) {
  var st = game.state;
  var found = null;
  game._aliveChars().forEach(function (id) {
    if (found) return;
    if (st.chars[id].role === "factor" && st.locations.school.intrigue >= 2) found = id;
  });
  if (!found) return null;
  return { charId: found, ability: { timing: "mm_phase", mandatory: false, desc: TL.desc("role.factor.factor_ct_ability", "【因子】獲得傳謠人的能力：往同一區域中任意1名角色身上放置1枚[不安]。"), effect: "ct_paranoia" } };
});
// 額外來源：流言四起（副規則）
TL.registerMMSource(function (game) {
  if (!game.script.subplots.some(function (id) { return PLOT_INDEX[id] && PLOT_INDEX[id].rule && PLOT_INDEX[id].rule.type === "mm_intrigue_any_location"; })) return null;
  return { charId: null, ability: { timing: "mm_phase", mandatory: false, desc: TL.desc("ability.unsettling_rumor", "【流言四起】往任意1塊版圖上放置1枚[密謀]。(每輪限1次)"), effect: "unsettling_rumor" } };
});
// 額外來源：χ異因子（副規則）
TL.registerMMSource(function (game) {
  if (!game._hasSubplot("unsafe_trigger")) return null;
  return { charId: null, ability: { timing: "mm_phase", mandatory: false, desc: TL.desc("ability.unsafe_trigger", "【χ異因子】往存活的不安定因子所在版圖放置1枚[密謀]。(每輪限1次)"), effect: "unsafe_trigger" } };
});

