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
      return who + "：" + a.ability.desc;
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
  var impl = TL.MM_ABILITIES[eff];
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

// 額外來源：不安定因子（學校2+密謀時獲得傳謠人能力）
TL.registerMMSource(function (game) {
  var st = game.state;
  var found = null;
  game._aliveChars().forEach(function (id) {
    if (found) return;
    if (st.chars[id].role === "factor" && st.locations.school.intrigue >= 2) found = id;
  });
  if (!found) return null;
  return { charId: found, ability: { timing: "mm_phase", mandatory: false, desc: "【因子】獲得傳謠人的能力：往同一區域中任意1名角色身上放置1枚[不安]。", effect: "ct_paranoia" } };
});
// 額外來源：流言四起（副規則）
TL.registerMMSource(function (game) {
  if (!game.script.subplots.some(function (id) { return PLOT_INDEX[id] && PLOT_INDEX[id].rule && PLOT_INDEX[id].rule.type === "mm_intrigue_any_location"; })) return null;
  return { charId: null, ability: { timing: "mm_phase", mandatory: false, desc: "【流言四起】往任意1塊版圖上放置1枚[密謀]。(每輪限1次)", effect: "unsettling_rumor" } };
});
// 額外來源：χ異因子（副規則）
TL.registerMMSource(function (game) {
  if (!game._hasSubplot("unsafe_trigger")) return null;
  return { charId: null, ability: { timing: "mm_phase", mandatory: false, desc: "【χ異因子】往存活的不安定因子所在版圖放置1枚[密謀]。(每輪限1次)", effect: "unsafe_trigger" } };
});

