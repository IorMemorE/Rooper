// 行動牌結算：階段調度 + 卡牌效果註冊表（可拆卸：新卡牌只需 registerCard）
window.TL = window.TL || {};

// 卡牌效果註冊表
// TL.registerCard(cardId, phase, { apply(game, play, ctx) })
// phase: forbid_move | move | forbid_intrigue | forbid | action_paranoia_plus
//        | action_paranoia_minus | action_goodwill | action_intrigue | action_hope | action_despair
TL.CARD_EFFECTS = {};
TL.CARD_PHASE = {};
TL.registerCard = function (cardId, phase, impl) {
  TL.CARD_PHASE[cardId] = phase;
  TL.CARD_EFFECTS[cardId] = impl;
};

function applyMarker(game, id, kind, delta) {
  var c = game.state.chars[id];
  if (kind === "paranoia") {
    c.paranoia = Math.max(0, c.paranoia + delta);
    game._feed({ type: "marker", id: id, kind: kind, delta: delta, value: c.paranoia });
    game._log(TL.I18N.log(delta > 0 ? "paranoiaPlus" : "paranoiaMinus", { char: game._charName(id), n: Math.abs(delta), v: c.paranoia }) ||
      (game._charName(id) + (delta > 0 ? " 不安+" : " 不安-") + Math.abs(delta) + "（" + c.paranoia + "）"));
  } else if (kind === "goodwill") {
    c.goodwill += delta;
    game._feed({ type: "marker", id: id, kind: kind, delta: delta, value: c.goodwill });
    game._log(TL.I18N.log("goodwillPlus", { char: game._charName(id), n: delta, v: c.goodwill }) ||
      (game._charName(id) + " 友好+" + delta + "（" + c.goodwill + "）"));
  } else if (kind === "intrigue") {
    c.intrigue += delta;
    game._feed({ type: "marker", id: id, kind: kind, delta: delta, value: c.intrigue });
    game._log(TL.I18N.log("intriguePlus", { char: game._charName(id), n: delta, v: c.intrigue }) ||
      (game._charName(id) + " 密謀+" + delta + "（" + c.intrigue + "）"));
  }
}

function applyLocMarker(game, locId, delta) {
  var st = game.state;
  st.locations[locId].intrigue += delta;
  game._feed({ type: "loc_marker", id: locId, kind: "intrigue", delta: delta, value: st.locations[locId].intrigue });
  game._log(TL.I18N.log("locIntriguePlus", { loc: game._locName(locId), n: delta, v: st.locations[locId].intrigue }) ||
    (game._locName(locId) + " 密謀+" + delta + "（" + st.locations[locId].intrigue + "）"));
}

// 註冊基礎行動牌效果
["p_paranoia_plus", "m_paranoia_plus"].forEach(function (cid) {
  TL.registerCard(cid, "action_paranoia_plus", {
    apply: function (game, play) {
      if (play.targetType === "char") applyMarker(game, play.targetId, "paranoia", 1);
    }
  });
});
// AH：不安+2（1x∞）——與不安-1同角色時先結算（不安+ 階段在不安- 之前）
TL.registerCard("p_paranoia_plus2", "action_paranoia_plus", {
  apply: function (game, play) {
    if (play.targetType === "char") applyMarker(game, play.targetId, "paranoia", 2);
  }
});
["p_paranoia_minus", "m_paranoia_minus"].forEach(function (cid) {
  TL.registerCard(cid, "action_paranoia_minus", {
    apply: function (game, play) {
      if (play.targetType === "char") applyMarker(game, play.targetId, "paranoia", -1);
    }
  });
});
// 十周年：希望+1（若當日2名以上主人公打出則改為友好+1，不回收）
TL.registerCard("p_hope_plus1", "action_hope", {
  apply: function (game, play, ctx) {
    if (play.targetType !== "char") return;
    if (ctx.hopeShared) {
      applyMarker(game, play.targetId, "goodwill", 1);
    } else {
      var c = game.state.chars[play.targetId];
      c.hope = (c.hope || 0) + 1;
      game._feed({ type: "marker", id: play.targetId, kind: "hope", delta: 1, value: c.hope });
      game._log(TL.L("hopePlus", { char: game._charName(play.targetId), v: c.hope }) ||
        (game._charName(play.targetId) + " 希望+1（" + c.hope + "）。"));
    }
  }
});
// 十周年：絕望+1（1x∞）
TL.registerCard("m_despair_plus1", "action_despair", {
  apply: function (game, play) {
    if (play.targetType !== "char") return;
    var c = game.state.chars[play.targetId];
    c.despair = (c.despair || 0) + 1;
    game._feed({ type: "marker", id: play.targetId, kind: "despair", delta: 1, value: c.despair });
    game._log(TL.L("despairPlus", { char: game._charName(play.targetId), v: c.despair }) ||
      (game._charName(play.targetId) + " 絕望+1（" + c.despair + "）。"));
  }
});
// AH：友好+1（劇作家）
TL.registerCard("m_goodwill_plus1", "action_goodwill", {
  apply: function (game, play) {
    if (play.targetType === "char") applyMarker(game, play.targetId, "goodwill", 1);
  }
});
["p_goodwill_plus1", "p_goodwill_plus2"].forEach(function (cid) {
  TL.registerCard(cid, "action_goodwill", {
    apply: function (game, play) {
      if (play.targetType === "char") applyMarker(game, play.targetId, "goodwill", cid === "p_goodwill_plus2" ? 2 : 1);
    }
  });
});
["m_intrigue_plus1", "m_intrigue_plus2"].forEach(function (cid) {
  TL.registerCard(cid, "action_intrigue", {
    apply: function (game, play) {
      var delta = cid === "m_intrigue_plus2" ? 2 : 1;
      if (play.targetType === "char") applyMarker(game, play.targetId, "intrigue", delta);
      else applyLocMarker(game, play.targetId, delta);
    }
  });
});
TL.registerCard("p_forbid_move", "forbid_move", {
  apply: function (game, play, ctx) {
    if (play.targetType === "char") ctx.moveForbidden[play.targetId] = true;
  }
});
["m_forbid_paranoia"].forEach(function (cid) {
  TL.registerCard(cid, "forbid", {
    apply: function (game, play, ctx) {
      if (play.targetType === "char") ctx.forbidParanoia[play.targetId] = true;
    }
  });
});
TL.registerCard("m_forbid_goodwill", "forbid", {
  apply: function (game, play, ctx) {
    if (play.targetType === "char") ctx.forbidGoodwill[play.targetId] = true;
  }
});
TL.registerCard("p_forbid_intrigue", "forbid_intrigue", { apply: function () {} });
["m_move_h", "m_move_v", "m_move_d", "p_move_h", "p_move_v"].forEach(function (cid) {
  TL.registerCard(cid, "move", { apply: function () {} });
});

// 結算順序（禁止移動 → 移動 → 禁止密謀 → 其他禁止 → 不安+ → 不安- → 友好 → 密謀）
var RESOLVE_PHASES = [
  "forbid_move", "move", "forbid_intrigue", "forbid",
  "action_paranoia_plus", "action_paranoia_minus", "action_goodwill", "action_intrigue",
  "action_hope", "action_despair"
];

TL.Game.prototype._resolveCards = async function () {
  var st = this.state;
  var self = this;
  this._log(TL.I18N.log("resolve") || "—— 翻開並結算行動牌 ——");
  var all = st.mmPlays.map(function (p) { return { card: p.card, targetType: p.targetType, targetId: p.targetId, owner: "mm" }; })
    .concat(st.pPlays.map(function (p) { return { card: p.card, targetType: p.targetType, targetId: p.targetId, owner: "p" + p.deck }; }));
  // 十周年：若2名以上主人公同日打出希望+1，全部視為友好+1（不回收）
  var hopePlays = st.pPlays.filter(function (p) { return p.card === "p_hope_plus1"; });
  st.hopeHandShared = hopePlays.length >= 2;
  if (st.hopeHandShared) {
    this._log(TL.L("hopeShared") || "【希望+1】2名以上主人公同時打出，全部改為友好+1。");
  }
  all.forEach(function (p) {
    var who = p.owner === "mm" ? "劇作家" : "主人公";
    var target = p.targetType === "location" ? LOC_INDEX[p.targetId].name + "（版圖）" : self._charName(p.targetId);
    self._log(TL.I18N.log("reveal", { who: who, card: TL.cardname(p.card), target: target }) || ("翻開：" + who + "【" + CARD_INDEX[p.card].name + "】→ " + target));
    self._feed({ type: "reveal", owner: p.owner, card: p.card, targetType: p.targetType, targetId: p.targetId });
  });
  this._log(TL.I18N.log("resolveOrder") || "【結算順序】① 禁止移動 → ② 移動 → ③ 其他禁止牌 → ④ 其他行動牌");

  // 標記每輪限1次牌
  all.forEach(function (play) {
    var card = CARD_INDEX[play.card];
    if (card && card.oncePerLoop) st.used[play.owner][play.card] = true;
  });

  // 按階段分組
  var grouped = {};
  RESOLVE_PHASES.forEach(function (ph) { grouped[ph] = []; });
  all.forEach(function (p) {
    var ph = TL.CARD_PHASE[p.card] || "action";
    if (!grouped[ph]) grouped[ph] = [];
    grouped[ph].push(p);
  });

  // 1) 禁止移動
  var ctx = { moveForbidden: {}, forbidParanoia: {}, forbidGoodwill: {} };
  ctx.hopeShared = st.hopeHandShared;
  grouped.forbid_move.forEach(function (p) {
    TL.CARD_EFFECTS[p.card].apply(self, p, ctx);
  });
  // 心無靈犀：禁止友好同時具備禁止移動的效果
  if (this._hasSubplot("unanswered_heart")) {
    grouped.forbid.forEach(function (p) {
      if (p.card === "m_forbid_goodwill" && p.targetType === "char") ctx.moveForbidden[p.targetId] = true;
    });
  }

  // 2) 移動（同角色合成後一次移動）
  var perChar = {};
  grouped.move.forEach(function (p) {
    if (p.targetType !== "char") return;
    perChar[p.targetId] = perChar[p.targetId] || { h: 0, v: 0, d: 0 };
    if (p.card.indexOf("_h") > 0) perChar[p.targetId].h++;
    else if (p.card.indexOf("_v") > 0) perChar[p.targetId].v++;
    else perChar[p.targetId].d++;
  });
  for (var cid in perChar) {
    if (ctx.moveForbidden[cid]) {
      this._log(TL.I18N.log("moveForbid", { char: this._charName(cid) }) || (this._charName(cid) + "的移動被[禁止移動]無效化。"));
      continue;
    }
    // 可疑信件：次日無法移動（僅當天生效）
    if (st.cannotMoveNextDay[cid]) {
      this._log(TL.L("cannotMoveDay", { char: this._charName(cid) }) ||
        (this._charName(cid) + "因[可疑信件]今日無法移動。"));
      delete st.cannotMoveNextDay[cid];
      continue;
    }
    var m = perChar[cid];
    var net = this._netMove(m.h, m.v, m.d);
    if (!net) continue;
    await this._applyMovement(cid, net);
  }

  // 3) 禁止密謀（互相無效化；邪教徒可取消；舊印 Ex3+ 不互消）
  var forbidIntriguePlays = grouped.forbid_intrigue;
  var oldSeal = st.exGauge >= 3;
  var forbidIntrigueActive = forbidIntriguePlays.length === 1 || (oldSeal && forbidIntriguePlays.length >= 2);
  if (forbidIntriguePlays.length >= 2 && !oldSeal) {
    this._log(TL.I18N.log("forbidCancel") || "本日打出2張或以上[禁止密謀]，互相無效化。");
  }
  var cultistCancels = {};
  var cultists = this._aliveChars().filter(function (id) { return self._isCultist(id); });
  for (var ci = 0; ci < cultists.length; ci++) {
    var cid2 = cultists[ci];
    var loc = st.chars[cid2].loc;
    var applicable = forbidIntriguePlays.filter(function (p) {
      if (p.targetType === "location" && p.targetId === loc) return true;
      if (p.targetType === "char" && st.chars[p.targetId] && st.chars[p.targetId].loc === loc) return true;
      return false;
    });
    if (applicable.length) {
      var use = await this.io.confirm({
        title: TL.rname("cultist"),
        text: TL.I18N.log("cultistConfirm", { char: this._charName(cid2) }) || (this._charName(cid2) + "（邪教徒）是否無效化所在區域的[禁止密謀]？"),
        owner: "mm",
        kind: "cultist",
        charId: cid2,
        locId: loc
      });
      if (use) {
        applicable.forEach(function (p) { cultistCancels[p.card + "|" + p.targetType + "|" + p.targetId] = true; });
        this._log(TL.I18N.log("cultistCancel", { char: this._charName(cid2) }) || (this._charName(cid2) + "無效化了所在區域的[禁止密謀]。"));
      }
    }
  }

  // 其他禁止牌
  grouped.forbid.forEach(function (p) {
    TL.CARD_EFFECTS[p.card].apply(self, p, ctx);
  });
  // 時間旅者無視禁止友好
  Object.keys(ctx.forbidGoodwill).forEach(function (id) {
    var c = st.chars[id];
    if (c && c.role === "time_traveler") {
      delete ctx.forbidGoodwill[id];
      self._log(TL.I18N.log("ttIgnore", { char: self._charName(id) }) || (self._charName(id) + "身上的[禁止友好]被無視。"));
    }
  });

  // 4) 其他行動牌
  RESOLVE_PHASES.slice(4).forEach(function (ph) {
    grouped[ph].forEach(function (p) {
      var blocked = false;
      if (ph === "action_intrigue") {
        blocked = forbidIntrigueActive && forbidIntriguePlays.some(function (f) {
          return f.targetType === p.targetType && f.targetId === p.targetId &&
            !cultistCancels[f.card + "|" + f.targetType + "|" + f.targetId];
        });
      } else if (ph === "action_paranoia_plus" || ph === "action_paranoia_minus") {
        blocked = p.targetType !== "char" || !!ctx.forbidParanoia[p.targetId];
      } else if (ph === "action_goodwill") {
        blocked = p.targetType !== "char" || !!ctx.forbidGoodwill[p.targetId];
      }
      if (blocked) return;
      TL.CARD_EFFECTS[p.card].apply(self, p, ctx);
    });
  });

  // 希望+1 使用後回收（除非當日共享改為友好+1）
  if (!st.hopeHandShared) {
    var pDecks = Object.keys(st.pHandExtra || {});
    pDecks.forEach(function (d) {
      var arr = st.pHandExtra[d] || [];
      for (var hi = arr.length - 1; hi >= 0; hi--) {
        if (arr[hi] === "p_hope_plus1") arr.splice(hi, 1);
      }
    });
  }
  st.mmPlays = [];
  st.pPlays = [];
};

TL.Game.prototype._netMove = function (h, v, d) {
  // 依規則化簡：H+V→D, V+D→H, H+D→V；同類疊加仍為同類
  var guard = 0;
  while ((h > 0 && v > 0) || (d > 0 && (h > 0 || v > 0))) {
    if (h > 0 && v > 0) { h--; v--; d++; }
    else if (d > 0 && h > 0) { d--; h--; v++; }
    else if (d > 0 && v > 0) { d--; v--; h++; }
    if (++guard > 10) break;
  }
  if (h > 0) return "h";
  if (v > 0) return "v";
  if (d > 0) return "d";
  return null;
};

TL.Game.prototype._applyMovement = async function (cid, moveType) {
  var st = this.state;
  var self = this;
  var from = st.chars[cid].loc;
  var data = this._charData(cid);
  // 封鎖：封鎖中的版圖無法通過移動進入或離開
  if (this._locBlocked(from)) {
    this._log(TL.L("locBlockedFrom", { char: this._charName(cid), loc: this._locName(from) }) ||
      (this._charName(cid) + "無法離開被封鎖的" + this._locName(from) + "。"));
    return;
  }
  var options = (ADJ[from] && ADJ[from][moveType]) || [];
  var legal = options.filter(function (loc) {
    if (self._locBlocked(loc)) return false;
    if (data.forbidden && data.forbidden.indexOf(loc) >= 0) {
      if (!(cid === "patient" && st.plotFlags.patientOpen) &&
          !(st.plotFlags.youngGirlOpen && cid === "young_girl")) return false;
    }
    return true;
  });
  if (!legal.length) {
    this._log(TL.I18N.log("moveFail", { char: this._charName(cid) }) || (this._charName(cid) + "的移動失敗（沒有合法方向）。"));
    return;
  }
  var dirs = { h: "左右", v: "上下", d: "對角" };
  var idx = await this.io.askChoice({
    title: TL.I18N.log("moveDirTitle") || "移動方向",
    text: TL.I18N.log("moveDirText", { char: this._charName(cid), loc: this._locName(from) }) ||
      (this._charName(cid) + "（" + this._locName(from) + "）移動方向？"),
    options: legal.map(function (loc) { return TL.t("game.moveTo") + " " + selfLoc(loc); }),
    owner: this._isMMMove(cid) ? "mm" : "p",
    kind: "move_dir",
    charId: cid,
    locIds: legal
  });
  var target = legal[idx == null ? 0 : idx];
  st.chars[cid].loc = target;
  this._feed({ type: "move", id: cid, from: from, to: target });
  this._log(TL.I18N.log("move", { char: this._charName(cid), from: this._locName(from), to: this._locName(target), dir: dirs[moveType] }) ||
    (this._charName(cid) + "：" + this._locName(from) + " → " + this._locName(target) + "（" + dirs[moveType] + "）"));
  // 從者跟隨：同區域的主人（大人物/大小姐/追加對象）移動時，從者一起移動
  var scope = this._servantScope();
  if (scope.indexOf(cid) >= 0) {
    Object.keys(st.chars).forEach(function (id) {
      var oc = st.chars[id];
      if (!oc.alive || id === cid || id !== "maid") return;
      if (oc.loc !== from) return;
      st.chars[id].loc = target;
      self._feed({ type: "move", id: id, from: from, to: target });
      self._log(TL.L("servantFollow", { char: self._charName(id), loc: self._locName(target) }) ||
        (self._charName(id) + "跟隨移動至" + self._locName(target) + "。"));
    });
  }

  function selfLoc(loc) { return TL.lname(loc); }
};
