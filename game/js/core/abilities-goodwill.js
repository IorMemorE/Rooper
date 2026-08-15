// 友好能力：階段調度 + 效果註冊（可拆卸：新友好能力只需 registerGoodwillAbility）
window.TL = window.TL || {};

// ---------- 友好能力階段 ----------
TL.Game.prototype._goodwillPhase = async function () {
  var st = this.state;
  var self = this;
  this._log(TL.I18N.log("gwPhase", { n: st.leader + 1 }) || ("—— 友好能力階段（隊長：主人公" + (st.leader + 1) + "）——"));
  // 神話蒐集者（LL 背叛者B）：主人公能力階段，熟識標記6枚以上→主人公B獲勝
  if (this._hasSubplot("keeper_of_mythology")) {
    var acquaintedCount = Object.keys(st.chars).filter(function (id) { return st.chars[id].acquainted; }).length;
    if (acquaintedCount >= 6 && !st.plotFlags.traitorsNormal) {
      this._log(TL.L("traitorBWin") || "【神話蒐集者】熟識標記6枚以上，主人公B（背叛者）獲勝！");
      st.ended = "traitorB";
      st.phase = "game_over";
      return;
    }
  }
  if (this.uiManaged) {
    return;
  }
  var leaderDeck = "p" + st.leader;
  while (true) {
    var usable = this._usableGoodwill();
    if (!usable.length) { this._log(TL.I18N.log("gwNone") || "（沒有可用的友好能力）"); break; }
    var opts = usable.map(function (u) {
      return self._charName(u.charId) + "（友好" + u.ability.cost + "）：" +
        TL.desc("char." + u.charId + "." + u.abilityIdx, u.ability.desc);
    });
    opts.push("結束友好能力階段");
    var idx = await this.io.askChoice({
      title: "友好能力（隊長）",
      text: "選擇要使用的能力（每項能力每天最多1次）：",
      options: opts
    });
    if (idx == null || idx >= usable.length) break;
    await this._execGoodwill(usable[idx], leaderDeck);
  }
};

TL.Game.prototype._usableGoodwill = function () {
  var st = this.state;
  var self = this;
  var out = [];
  Object.keys(st.chars).forEach(function (id) {
    var c = st.chars[id];
    if (!c.alive || c.onStage === false) return;
    var data = CHAR_INDEX[id];
    (data.goodwill || []).forEach(function (ab, i) {
      // 十周年：希望計入友好；AHR 裏世界以不安判定能否使用友好能力
      var effGw = (self.module && self.module.id === "AHR" && (st.exGauge % 2) === 1)
        ? self._effParanoia(id)
        : self._effGoodwill(id);
      if (effGw < ab.cost) return;
      if (ab.minLoop && st.loop < ab.minLoop) return;
      if (ab.oncePerLoop) {
        if (st.usedGoodwill[id] && st.usedGoodwill[id][i]) return;
      } else {
        if (st.usedGoodwillDay[id] && st.usedGoodwillDay[id][i]) return;
      }
      if (ab.locRestriction && ab.locRestriction.indexOf(c.loc) < 0) return;
      // 目標可用性
      var ok = true;
      var area = self._charArea(id);
      if (ab.target === "char" || ab.target === "student" || ab.target === "char_at_limit" || ab.target === "corpse" || ab.target === "char_or_location") {
        if (ab.target === "corpse") {
          ok = Object.keys(st.chars).some(function (oid) { var oc = st.chars[oid]; return !oc.alive && oc.loc === area; });
        } else if (ab.target === "student") {
          ok = Object.keys(st.chars).some(function (oid) { var oc = st.chars[oid]; return oc.alive && oc.loc === area && CHAR_INDEX[oid].traits.indexOf("學生") >= 0; });
        } else if (ab.target === "char_at_limit") {
          ok = Object.keys(st.chars).some(function (oid) { var oc = st.chars[oid]; return oc.alive && oc.loc === area && oc.paranoia >= CHAR_INDEX[oid].paranoiaLimit; });
        } else {
          ok = Object.keys(st.chars).some(function (oid) { return st.chars[oid].alive && st.chars[oid].loc === area; });
        }
      }
      if (ok) out.push({ charId: id, abilityIdx: i, ability: ab });
    });
  });
  return out;
};

// 友好能力面板（含可用狀態）
TL.Game.prototype.goodwillPanel = function () {
  var st = this.state;
  var usableMap = {};
  this._usableGoodwill().forEach(function (u) { usableMap[u.charId + "|" + u.abilityIdx] = true; });
  var out = [];
  Object.keys(st.chars).forEach(function (id) {
    var c = st.chars[id];
    if (!c.alive || c.onStage === false) return;
    var data = CHAR_INDEX[id];
    (data.goodwill || []).forEach(function (ab, i) {
      out.push({ charId: id, abilityIdx: i, ability: ab, usable: !!usableMap[id + "|" + i] });
    });
  });
  return out;
};

// 友好能力的可選目標（委派給各效果的 targets 掛鉤）
TL.Game.prototype.goodwillTargets = function (chosen) {
  var st = this.state;
  var c = st.chars[chosen.charId];
  if (!c) return [];
  var impl = TL.GOODWILL_ABILITIES[chosen.ability.effect];
  if (impl && impl.targets) return impl.targets(this, chosen);
  return TL.goodwillCtx(this, chosen).charOpts;
};

// 友好能力共用上下文
TL.goodwillCtx = function (game, chosen) {
  var st = game.state;
  var c = st.chars[chosen.charId];
  var ab = chosen.ability;
  var loc = game._charArea(chosen.charId);
  var charOpts = game._aliveChars(loc).filter(function (id) { return id !== chosen.charId; })
    .map(function (id) { return { type: "char", id: id, label: game._charName(id) }; });
  var anyCharOpts = Object.keys(st.chars).filter(function (id) { return st.chars[id].alive && id !== chosen.charId; })
    .map(function (id) { return { type: "char", id: id, label: game._charName(id) }; });
  var studentOpts = game._aliveChars(loc).filter(function (id) {
    return id !== chosen.charId && CHAR_INDEX[id].traits.indexOf("學生") >= 0;
  }).map(function (id) { return { type: "char", id: id, label: game._charName(id) }; });
  var corpseOpts = Object.keys(st.chars).filter(function (id) {
    return !st.chars[id].alive && st.chars[id].loc === loc && id !== chosen.charId;
  }).map(function (id) { return { type: "char", id: id, label: game._charName(id) }; });
  var limitOpts = charOpts.filter(function (o) {
    return st.chars[o.id].paranoia >= CHAR_INDEX[o.id].paranoiaLimit;
  });
  var T = function (opts, title, text, override) {
    return override || game.io.askTarget({ title: title, text: text, targets: opts });
  };
  var who = game._charName(chosen.charId);
  return {
    st: st, c: c, ab: ab, loc: loc,
    charOpts: charOpts, anyCharOpts: anyCharOpts, studentOpts: studentOpts,
    corpseOpts: corpseOpts, limitOpts: limitOpts, T: T,
    who: who,
    abTitle: TL.L("gwAbilityTitle", { who: who }) || (who + "的友好能力")
  };
};

TL.Game.prototype.execGoodwill = async function (chosen, leaderDeck, target) {
  await this._execGoodwill(chosen, leaderDeck, target);
};

// 标记友好能力已被声明使用（含熟识标记与 1x∞ 计数），不执行效果（手动结算用）
TL.Game.prototype.markGoodwillDeclared = function (chosen, refused) {
  var st = this.state;
  var c = st.chars[chosen.charId];
  if (!c) return;
  if (!c.acquainted) {
    c.acquainted = true;
    c.acquaintedRefused = !!refused;
    this._feed({ type: "token", id: chosen.charId, kind: "acquainted", on: true });
  } else {
    c.acquaintedRefused = !!refused;
  }
  st.usedGoodwill[chosen.charId] = st.usedGoodwill[chosen.charId] || {};
  st.usedGoodwillDay[chosen.charId] = st.usedGoodwillDay[chosen.charId] || {};
  st.usedGoodwillDay[chosen.charId][chosen.abilityIdx] = true;
  if (chosen.ability.oncePerLoop) st.usedGoodwill[chosen.charId][chosen.abilityIdx] = true;
};

TL.Game.prototype._execGoodwill = async function (chosen, leaderDeck, targetOverride) {
  var st = this.state;
  var c = st.chars[chosen.charId];
  var role = this._role(chosen.charId);
  // 十周年：友好能力被聲明使用時（無論是否被拒絕）放置熟識標記
  if (!c.acquainted) {
    c.acquainted = true;
    this._feed({ type: "token", id: chosen.charId, kind: "acquainted", on: true });
    this._log(TL.L("acquaintedPlaced", { char: this._charName(chosen.charId) }) ||
      ("【熟識】" + this._charName(chosen.charId) + "的友好能力被聲明使用，放置熟識標記。"));
  }
  // 十周年規則：每輪限1次的能力被拒絕後不視為已使用；WM 劇本依特規視為已使用
  var markRefusedUsed = !!(this.module && this.module.refusedAbilityUsed);
  // 拒絕判定
  var refusal = this._refusalOf(chosen.charId);
  if (!chosen.ability.cannotBeRefused && refusal !== "none") {
    if (refusal === "mandatory") {
      if (markRefusedUsed) {
        st.usedGoodwill[chosen.charId] = st.usedGoodwill[chosen.charId] || {};
        st.usedGoodwillDay[chosen.charId] = st.usedGoodwillDay[chosen.charId] || {};
        st.usedGoodwillDay[chosen.charId][chosen.abilityIdx] = true;
        if (chosen.ability.oncePerLoop) st.usedGoodwill[chosen.charId][chosen.abilityIdx] = true;
      }
      c.acquaintedRefused = true;
      this._log(TL.I18N.log("refuseMand", { char: this._charName(chosen.charId) }) ||
        ("【拒絕】" + this._charName(chosen.charId) + "拒絕了友好能力。"));
      return;
    }
    var refuse = await this.io.confirm({
      title: TL.t("game.refusalTitle"),
      text: TL.t("game.refusalText", { char: this._charName(chosen.charId), role: TL.rname(role.id) }),
      owner: "mm",
      kind: "refuse",
      charId: chosen.charId,
      effect: chosen.ability.effect
    });
    if (refuse) {
      c.acquaintedRefused = true;
      if (markRefusedUsed) {
        st.usedGoodwill[chosen.charId] = st.usedGoodwill[chosen.charId] || {};
        st.usedGoodwillDay[chosen.charId] = st.usedGoodwillDay[chosen.charId] || {};
        st.usedGoodwillDay[chosen.charId][chosen.abilityIdx] = true;
        if (chosen.ability.oncePerLoop) st.usedGoodwill[chosen.charId][chosen.abilityIdx] = true;
      }
      this._log(TL.L("refuseOpt", { char: this._charName(chosen.charId) }) ||
        ("【拒絕】" + this._charName(chosen.charId) + "拒絕了友好能力。"));
      return;
    }
  }
  c.acquaintedRefused = false;
  st.usedGoodwill[chosen.charId] = st.usedGoodwill[chosen.charId] || {};
  st.usedGoodwillDay[chosen.charId] = st.usedGoodwillDay[chosen.charId] || {};
  st.usedGoodwillDay[chosen.charId][chosen.abilityIdx] = true;
  if (chosen.ability.oncePerLoop) st.usedGoodwill[chosen.charId][chosen.abilityIdx] = true;
  // AHR：使用 1x∞ 友好能力後自動觸發世界移動
  if (this.module && this.module.id === "AHR" && chosen.ability.oncePerLoop) {
    this._triggerWarp(true);
  }
  var impl = TL.GOODWILL_ABILITIES[chosen.ability.effect];
  if (impl && impl.exec) {
    var ctx = TL.goodwillCtx(this, chosen);
    await impl.exec(this, ctx, targetOverride, leaderDeck);
  } else {
    var usedDesc = TL.desc("char." + chosen.charId + "." + chosen.abilityIdx, chosen.ability.desc);
    this._log(TL.L("gwAbilityUsed", { who: this._charName(chosen.charId), desc: usedDesc }) ||
      ("【" + this._charName(chosen.charId) + "】使用了能力：" + usedDesc));
  }
  // 友好能力結算後的角色身份效果（提線木偶/敘述者/愛麗絲/網絡名流/密鑰等）
  var afterFn = TL.GOODWILL_AFTER[c.role];
  if (afterFn) await afterFn(this, chosen.charId);
  // 巫師：結算該角色友好能力後，公開該角色身份；之後隊長可以使Ex槽增加1
  if (c.role === "wizard") {
    if (!c.roleRevealed) await this._revealRole(chosen.charId);
    var wInc = await this.io.askChoice({
      title: TL.rname("wizard"),
      text: TL.L("wizardExPrompt", { char: this._charName(chosen.charId) }) ||
        (this._charName(chosen.charId) + "的身份已公開。隊長要使Ex槽增加1嗎？"),
      options: [TL.t("editor.yes"), TL.t("editor.no")]
    });
    if (wInc === 0) this._addExGauge(1);
  }
};

// ---------- 友好能力效果註冊 ----------
function gwTargetsChar(ctx) { return ctx.charOpts; }
function gwTargetsAny(ctx) { return ctx.anyCharOpts; }

TL.registerGoodwillAbility("paranoia_minus", {
  targets: function (game, chosen) {
    return chosen.ability.target === "char_at_limit" ? TL.goodwillCtx(game, chosen).limitOpts : TL.goodwillCtx(game, chosen).charOpts;
  },
  exec: async function (game, ctx, targetOverride) {
    var target = await ctx.T(ctx.charOpts, ctx.abTitle, ctx.ab.desc, targetOverride);
    if (target) {
      ctx.st.chars[target.id].paranoia = Math.max(0, ctx.st.chars[target.id].paranoia - 1);
      game._feed({ type: "marker", id: target.id, kind: "paranoia", delta: -1, value: ctx.st.chars[target.id].paranoia });
      game._log(TL.L("gwParanoiaMinus", { who: ctx.who, char: game._charName(target.id), n: 1, v: ctx.st.chars[target.id].paranoia }) ||
        ("【" + ctx.who + "】" + game._charName(target.id) + " 不安-1（" + ctx.st.chars[target.id].paranoia + "）。"));
    }
  }
});

TL.registerGoodwillAbility("paranoia_plus", {
  targets: function (game, chosen) {
    var ctx = TL.goodwillCtx(game, chosen);
    return chosen.ability.target === "char_anywhere" ? ctx.anyCharOpts : ctx.charOpts;
  },
  exec: async function (game, ctx, targetOverride) {
    var pool = ctx.ab.target === "char_anywhere" ? ctx.anyCharOpts : ctx.charOpts;
    var target = await ctx.T(pool, ctx.abTitle, ctx.ab.desc, targetOverride);
    if (target) {
      var amt = ctx.ab.desc.indexOf("＋2") >= 0 || ctx.ab.desc.indexOf("+2") >= 0 ? 2 : 1;
      ctx.st.chars[target.id].paranoia += amt;
      game._feed({ type: "marker", id: target.id, kind: "paranoia", delta: amt, value: ctx.st.chars[target.id].paranoia });
      game._log(TL.L("gwParanoiaPlus", { who: ctx.who, char: game._charName(target.id), n: amt, v: ctx.st.chars[target.id].paranoia }) ||
        ("【" + ctx.who + "】" + game._charName(target.id) + " 不安+" + amt + "（" + ctx.st.chars[target.id].paranoia + "）。"));
    }
  }
});

TL.registerGoodwillAbility("paranoia_plus_minus", {
  targets: gwTargetsChar,
  exec: async function (game, ctx, targetOverride) {
    var target = await ctx.T(ctx.charOpts, ctx.abTitle, ctx.ab.desc, targetOverride);
    if (target) {
      var dir = await game.io.askChoice({
        title: TL.L("dirTitle") || "方向",
        text: TL.L("dirText", { char: game._charName(target.id) }) || ("增加或減少" + game._charName(target.id) + "的不安？"),
        options: [TL.term("card.p_paranoia_plus", "不安+1"), TL.term("card.p_paranoia_minus", "不安-1")]
      });
      if (dir === 0) ctx.st.chars[target.id].paranoia += 1;
      else ctx.st.chars[target.id].paranoia = Math.max(0, ctx.st.chars[target.id].paranoia - 1);
      var delta = dir === 0 ? 1 : -1;
      game._feed({ type: "marker", id: target.id, kind: "paranoia", delta: delta, value: ctx.st.chars[target.id].paranoia });
      game._log(TL.L("gwParanoiaDir", { who: ctx.who, char: game._charName(target.id), dir: dir === 0 ? TL.term("card.p_paranoia_plus", "不安+1") : TL.term("card.p_paranoia_minus", "不安-1"), v: ctx.st.chars[target.id].paranoia }) ||
        ("【" + ctx.who + "】" + game._charName(target.id) + (dir === 0 ? " 不安+1" : " 不安-1") + "（" + ctx.st.chars[target.id].paranoia + "）。"));
    }
  }
});

TL.registerGoodwillAbility("goodwill_plus", {
  targets: function (game, chosen) {
    return chosen.ability.target === "char_at_limit" ? TL.goodwillCtx(game, chosen).limitOpts : TL.goodwillCtx(game, chosen).charOpts;
  },
  exec: async function (game, ctx, targetOverride) {
    var target = await ctx.T(ctx.charOpts, ctx.abTitle, ctx.ab.desc, targetOverride);
    if (target) {
      ctx.st.chars[target.id].goodwill += 1;
      game._feed({ type: "marker", id: target.id, kind: "goodwill", delta: 1, value: ctx.st.chars[target.id].goodwill });
      game._log(TL.L("gwGoodwillPlus", { who: ctx.who, char: game._charName(target.id), v: ctx.st.chars[target.id].goodwill }) ||
        ("【" + ctx.who + "】" + game._charName(target.id) + " 友好+1（" + ctx.st.chars[target.id].goodwill + "）。"));
    }
  }
});

function gwIntrigueExec(delta) {
  return async function (game, ctx, targetOverride) {
    var locOpts = [{ type: "location", id: ctx.loc, label: TL.t("game.pTarget", { loc: game._locName(ctx.loc) }) }];
    var target = await ctx.T(ctx.charOpts.concat(locOpts), ctx.abTitle, ctx.ab.desc, targetOverride);
    if (target) {
      if (target.type === "char") {
        ctx.st.chars[target.id].intrigue = Math.max(0, ctx.st.chars[target.id].intrigue + delta);
        game._feed({ type: "marker", id: target.id, kind: "intrigue", delta: delta, value: ctx.st.chars[target.id].intrigue });
      } else {
        ctx.st.locations[target.id].intrigue = Math.max(0, ctx.st.locations[target.id].intrigue + delta);
        game._feed({ type: "loc_marker", id: target.id, kind: "intrigue", delta: delta, value: ctx.st.locations[target.id].intrigue });
      }
      var label = target.type === "char" ? game._charName(target.id) : game._locName(target.id);
      game._log(TL.L(delta > 0 ? "gwIntriguePlus" : "gwIntrigueMinus", { who: ctx.who, target: label, n: 1 }) ||
        ("【" + ctx.who + "】" + label + " 密謀" + (delta > 0 ? "+1。" : "-1。")));
    }
  };
}
TL.registerGoodwillAbility("intrigue_plus", {
  targets: function (game, chosen) {
    var ctx = TL.goodwillCtx(game, chosen);
    return ctx.charOpts.concat([{ type: "location", id: ctx.loc, label: game._locName(ctx.loc) + "（版圖）" }]);
  },
  exec: gwIntrigueExec(1)
});
TL.registerGoodwillAbility("intrigue_minus", {
  targets: function (game, chosen) {
    var ctx = TL.goodwillCtx(game, chosen);
    return ctx.charOpts.concat([{ type: "location", id: ctx.loc, label: game._locName(ctx.loc) + "（版圖）" }]);
  },
  exec: gwIntrigueExec(-1)
});

TL.registerGoodwillAbility("intrigue_minus_location", {
  targets: function () { return []; },
  exec: async function (game, ctx) {
    ctx.st.locations.shrine.intrigue = Math.max(0, ctx.st.locations.shrine.intrigue - 1);
    game._feed({ type: "loc_marker", id: "shrine", kind: "intrigue", delta: -1, value: ctx.st.locations.shrine.intrigue });
    game._log(TL.L("gwShrineMinus", { who: ctx.who }) || ("【" + ctx.who + "】神社 密謀-1。"));
  }
});

TL.registerGoodwillAbility("reveal_role", {
  targets: function (game, chosen) {
    var ctx = TL.goodwillCtx(game, chosen);
    if (chosen.ability.target === "student") return ctx.studentOpts;
    if (chosen.ability.target === "char_at_limit") return ctx.limitOpts;
    return ctx.charOpts;
  },
  exec: async function (game, ctx, targetOverride) {
    var pool = ctx.ab.target === "student" ? ctx.studentOpts : ctx.charOpts;
    var target = await ctx.T(pool, ctx.abTitle, ctx.ab.desc, targetOverride);
    if (target) await game._revealRole(target.id);
  }
});

TL.registerGoodwillAbility("reveal_self", {
  targets: function () { return []; },
  exec: async function (game, ctx) {
    await game._revealRole(ctx.c.id);
  }
});

TL.registerGoodwillAbility("reveal_corpse", {
  targets: function (game, chosen) { return TL.goodwillCtx(game, chosen).corpseOpts; },
  exec: async function (game, ctx, targetOverride) {
    var target = await ctx.T(ctx.corpseOpts, ctx.abTitle, ctx.ab.desc, targetOverride);
    if (target) await game._revealRole(target.id);
  }
});

TL.registerGoodwillAbility("reveal_culprit", {
  targets: function () { return []; },
  exec: async function (game, ctx) {
    var st = ctx.st;
    if (st.incidentHistory.length) {
      var opts2 = st.incidentHistory.map(function (h) {
        return TL.t("game.historyLabel", { loop: h.loop, day: h.day, name: TL.iname(h.incidentId) });
      });
      var i2 = await game.io.askChoice({ title: ctx.abTitle, text: TL.L("gwRevealCulpritText") || "公開1個已發生事件的當事人：", options: opts2 });
      if (i2 != null && st.incidentHistory[i2]) {
        game._log(TL.L("gwRevealCulpritLog", {
          who: ctx.who,
          name: TL.iname(st.incidentHistory[i2].incidentId),
          char: game._charName(st.incidentHistory[i2].culpritId)
        }) || ("【" + ctx.who + "】事件「" + INCIDENT_INDEX[st.incidentHistory[i2].incidentId].name + "」的當事人是" + game._charName(st.incidentHistory[i2].culpritId) + "。"));
      }
    } else {
      game._log(TL.L("gwRevealCulpritNone", { who: ctx.who }) || ("【" + ctx.who + "】本輪輪迴還沒有已發生的事件。"));
    }
  }
});

TL.registerGoodwillAbility("reveal_rule_x", {
  targets: function () { return []; },
  exec: async function (game, ctx) {
    game.script.subplots.forEach(function (sid) {
      var sp = PLOT_INDEX[sid];
      if (sp && sp.rule && sp.rule.type === "mm_intrigue_any_location") {
        game._log("【" + ctx.who + "】副規則「" + sp.name + "」：劇作家能力階段可往任意版圖放置1枚密謀（每輪限1次）。");
      } else if (sp && sp.rule) {
        game._log("【" + ctx.who + "】副規則「" + sp.name + "」：" + sp.desc.replace(/\n/g, " "));
      } else if (sp) {
        game._log("【" + ctx.who + "】副規則「" + sp.name + "」已在本局啟用。");
      }
    });
  }
});

TL.registerGoodwillAbility("kill", {
  targets: gwTargetsChar,
  exec: async function (game, ctx, targetOverride) {
    var target = await ctx.T(ctx.charOpts, ctx.abTitle, ctx.ab.desc, targetOverride);
    if (target) {
      var killed = await game._applyDeath(target.id);
      if (killed) {
        game._feed({ type: "death", id: killed });
        game._log(TL.L("gwKill", { who: ctx.who, char: game._charName(killed) }) ||
          ("【" + ctx.who + "】" + game._charName(killed) + "死亡。"));
      }
    }
  }
});

TL.registerGoodwillAbility("resurrect", {
  targets: function (game, chosen) { return TL.goodwillCtx(game, chosen).corpseOpts; },
  exec: async function (game, ctx, targetOverride) {
    var target = await ctx.T(ctx.corpseOpts, ctx.abTitle, ctx.ab.desc, targetOverride);
    if (target) {
      ctx.st.chars[target.id].alive = true;
      game._feed({ type: "resurrect", id: target.id });
      game._log(TL.L("gwResurrect", { who: ctx.who, char: game._charName(target.id) }) ||
        ("【" + ctx.who + "】" + game._charName(target.id) + "復活。"));
    }
  }
});

TL.registerGoodwillAbility("guard_place", {
  targets: gwTargetsChar,
  exec: async function (game, ctx, targetOverride) {
    var target = await ctx.T(ctx.charOpts, ctx.abTitle, ctx.ab.desc, targetOverride);
    if (target) {
      ctx.st.chars[target.id].guard += 1;
      game._feed({ type: "marker", id: target.id, kind: "guard", delta: 1, value: ctx.st.chars[target.id].guard });
      game._log(TL.L("gwGuard", { who: ctx.who, char: game._charName(target.id) }) ||
        ("【" + ctx.who + "】" + game._charName(target.id) + "獲得1枚護衛指示物。"));
    }
  }
});

TL.registerGoodwillAbility("move_counter", {
  targets: function () { return []; },
  exec: async function (game, ctx) {
    var cpool = game._aliveChars(ctx.loc).filter(function (id) { return id !== ctx.c.id; });
    if (cpool.length >= 2) {
      var a = await game.io.askChoice({ title: TL.t("game.moveMarkerTitle"), text: TL.t("game.moveMarkerFrom"), options: cpool.map(function (id) { return game._charName(id); }) });
      var b = await game.io.askChoice({ title: TL.t("game.moveMarkerTitle"), text: TL.t("game.moveMarkerTo"), options: cpool.map(function (id) { return game._charName(id); }) });
      if (a != null && b != null && a !== b) {
        var from = cpool[a], to = cpool[b];
        var kinds = [];
        if (ctx.st.chars[from].goodwill > 0) kinds.push(TL.t("game.counter.goodwill"));
        if (ctx.st.chars[from].paranoia > 0) kinds.push(TL.t("game.counter.paranoia"));
        if (ctx.st.chars[from].intrigue > 0) kinds.push(TL.t("game.counter.intrigue"));
        if (kinds.length) {
          var k = await game.io.askChoice({ title: TL.t("game.moveMarkerTitle"), text: TL.t("game.moveMarkerKind"), options: kinds });
          var kindId = k === 0 ? "goodwill" : k === 1 ? "paranoia" : "intrigue";
          if (k === 0) { ctx.st.chars[from].goodwill--; ctx.st.chars[to].goodwill++; }
          else if (k === 1) { ctx.st.chars[from].paranoia--; ctx.st.chars[to].paranoia++; }
          else if (k === 2) { ctx.st.chars[from].intrigue--; ctx.st.chars[to].intrigue++; }
          game._feed({ type: "marker", id: from, kind: kindId, delta: -1, value: ctx.st.chars[from][kindId] });
          game._feed({ type: "marker", id: to, kind: kindId, delta: 1, value: ctx.st.chars[to][kindId] });
          game._log(TL.L("gwMoveCounter", { who: ctx.who, kind: kinds[k], from: game._charName(from), to: game._charName(to) }) ||
            ("【" + ctx.who + "】把1枚[" + kinds[k] + "]從" + game._charName(from) + "移動到" + game._charName(to) + "。"));
        } else game._log(TL.L("gwMoveCounterNone", { who: ctx.who, char: game._charName(from) }) ||
          ("【" + ctx.who + "】" + game._charName(from) + "身上沒有可移動的指示物。"));
      }
    }
  }
});

TL.registerGoodwillAbility("retrieve_card", {
  targets: function () { return []; },
  exec: async function (game, ctx, targetOverride, leaderDeck) {
    var usedOnce = Object.keys(ctx.st.used[leaderDeck] || {}).filter(function (cid) { return ctx.st.used[leaderDeck][cid]; });
    if (usedOnce.length) {
      var opts3 = usedOnce.map(function (cid) { return TL.cardname(cid); });
      var r = await game.io.askChoice({ title: TL.t("game.retrieveTitle"), text: TL.t("game.retrieveText"), options: opts3 });
      if (r != null) {
        var rid = usedOnce[r];
        delete ctx.st.used[leaderDeck][rid];
        game._log(TL.L("gwRetrieveCard", { who: ctx.who, card: TL.cardname(rid) }) ||
          ("【" + ctx.who + "】回收了隊長的一張「" + CARD_INDEX[rid].name + "」。"));
      }
    } else {
      game._log(TL.L("gwRetrieveNone", { who: ctx.who }) || ("【" + ctx.who + "】隊長沒有已使用的每輪限1次牌。"));
    }
  }
});

function gwFlag(flagKey, logKey) {
  return {
    targets: function () { return []; },
    exec: async function (game, ctx) {
      ctx.st.plotFlags[flagKey] = true;
      game._log(TL.L(logKey, { who: ctx.who }) || ("【" + ctx.who + "】使用了能力：" + ctx.ab.desc));
    }
  };
}
TL.registerGoodwillAbility("patient_open", gwFlag("patientOpen", "gwPatientOpen"));
TL.registerGoodwillAbility("prevent_death", gwFlag("preventDeath", "gwSoldierSave"));
TL.registerGoodwillAbility("young_girl_open", gwFlag("youngGirlOpen", "gwYoungGirlOpen"));
TL.registerGoodwillAbility("incident_forbid", {
  targets: function () { return []; },
  exec: async function (game, ctx) {
    ctx.st.plotFlags.incidentForbid[ctx.c.id] = true;
    game._log(TL.L("gwHenchmanForbid", { who: ctx.who }) || ("【" + ctx.who + "】該角色擔任當事人的事件不會發生。"));
  }
});

TL.registerGoodwillAbility("self_move_adjacent", {
  targets: function () { return []; },
  exec: async function (game, ctx) {
    var fromLoc = ctx.c.loc;
    var moveOpts = [];
    ["h", "v", "d"].forEach(function (mt) {
      (ADJ[fromLoc] && ADJ[fromLoc][mt] || []).forEach(function (lid) {
        if (moveOpts.indexOf(lid) < 0) moveOpts.push(lid);
      });
    });
    if (!moveOpts.length) {
      game._log(TL.L("gwSelfMoveFail", { who: ctx.who, char: game._charName(ctx.c.id) }) ||
        ("【" + ctx.who + "】" + game._charName(ctx.c.id) + "沒有可移動的相鄰版圖。"));
    } else {
      var mi = await game.io.askChoice({
        title: TL.L("gwSelfMoveTitle") || "移動目標",
        text: TL.L("gwSelfMoveText", { char: game._charName(ctx.c.id) }) || ("將" + game._charName(ctx.c.id) + "移動至哪塊版圖？"),
        options: moveOpts.map(function (lid) { return TL.lname(lid); })
      });
      var toLoc = moveOpts[mi == null ? 0 : mi];
      ctx.st.chars[ctx.c.id].loc = toLoc;
      game._feed({ type: "move", id: ctx.c.id, from: fromLoc, to: toLoc });
      game._log(TL.L("gwSelfMoveLog", { who: ctx.who, char: game._charName(ctx.c.id), loc: game._locName(toLoc) }) ||
        ("【" + ctx.who + "】" + game._charName(ctx.c.id) + "移動至" + game._locName(toLoc) + "。"));
    }
  }
});

TL.registerGoodwillAbility("reveal_self_goodwill2", {
  targets: gwTargetsChar,
  exec: async function (game, ctx, targetOverride) {
    await game._revealRole(ctx.c.id);
    var target = await ctx.T(ctx.charOpts, ctx.abTitle, ctx.ab.desc, targetOverride);
    if (target) {
      ctx.st.chars[target.id].goodwill += 2;
      game._feed({ type: "marker", id: target.id, kind: "goodwill", delta: 2, value: ctx.st.chars[target.id].goodwill });
      game._log(TL.L("gwGoodwillPlus", { who: ctx.who, char: game._charName(target.id), n: 2, v: ctx.st.chars[target.id].goodwill }) ||
        ("【" + ctx.who + "】" + game._charName(target.id) + " 友好+2（" + ctx.st.chars[target.id].goodwill + "）。"));
    }
  }
});

TL.registerGoodwillAbility("sister_trigger", {
  targets: function () { return []; },
  exec: async function (game, ctx) {
    var adultOpts = game._aliveChars(ctx.loc).filter(function (id) {
      return id !== ctx.c.id && CHAR_INDEX[id].traits.indexOf("成人") >= 0;
    }).map(function (id) { return { type: "char", id: id, label: game._charName(id) }; });
    if (!adultOpts.length) {
      game._log(TL.L("gwSisterNoAdult", { who: ctx.who }) || ("【" + ctx.who + "】同一區域沒有成人。"));
    } else {
      var adultT = await ctx.T(adultOpts, ctx.abTitle, ctx.ab.desc);
      if (adultT) {
        var adultAbs = CHAR_INDEX[adultT.id].goodwill || [];
        if (!adultAbs.length) {
          game._log(TL.L("gwSisterNoAbility", { who: ctx.who, char: game._charName(adultT.id) }) ||
            ("【" + ctx.who + "】" + game._charName(adultT.id) + "沒有可用的友好能力。"));
        } else {
          var ai = await game.io.askChoice({
            title: TL.L("gwSisterPickTitle") || "選擇要使用的友好能力",
            text: TL.L("gwSisterPickText", { char: game._charName(adultT.id) }) || ("讓" + game._charName(adultT.id) + "使用哪個友好能力？"),
            options: adultAbs.map(function (a) { return a.desc; })
          });
          if (ai != null && adultAbs[ai]) {
            var chosenAdult = { charId: adultT.id, abilityIdx: ai, ability: JSON.parse(JSON.stringify(adultAbs[ai])) };
            chosenAdult.ability.cannotBeRefused = true; // 妹妹能力：不可拒絕
            await game.execGoodwill(chosenAdult, "p" + ctx.st.leader, null);
          }
        }
      }
    }
  }
});

TL.registerGoodwillAbility("servant_add_scope", {
  targets: gwTargetsChar,
  exec: async function (game, ctx, targetOverride) {
    var target = await ctx.T(ctx.charOpts, ctx.abTitle, ctx.ab.desc, targetOverride);
    if (target) {
      ctx.st.plotFlags.servantScope = ctx.st.plotFlags.servantScope || [];
      if (ctx.st.plotFlags.servantScope.indexOf(target.id) < 0) ctx.st.plotFlags.servantScope.push(target.id);
      // 忠诚指示物：标记从者的能力目标
      Object.keys(ctx.st.chars).forEach(function (id) { ctx.st.chars[id].loyaltyOn = false; });
      ctx.st.chars[target.id].loyaltyOn = true;
      game._feed({ type: "token", id: target.id, kind: "loyalty", on: true });
      game._log(TL.L("gwServantScope", { who: ctx.who, char: game._charName(target.id) }) ||
        ("【" + ctx.who + "】將" + game._charName(target.id) + "追加至特性適用對象。"));
    }
  }
});

TL.registerGoodwillAbility("sennin_move_resurrect", {
  targets: function () { return []; },
  exec: async function (game, ctx) {
    var allLocOpts = LOCATIONS.map(function (l) {
      return { type: "location", id: l.id, label: TL.t("game.pTarget", { loc: TL.lname(l.id) }) };
    });
    var tL = await ctx.T(allLocOpts, ctx.abTitle, ctx.ab.desc);
    if (tL) {
      var fromLoc2 = ctx.c.loc;
      ctx.st.chars[ctx.c.id].loc = tL.id;
      game._feed({ type: "move", id: ctx.c.id, from: fromLoc2, to: tL.id });
      game._log(TL.L("gwSenninMove", { who: ctx.who, char: game._charName(ctx.c.id), loc: game._locName(tL.id) }) ||
        ("【" + ctx.who + "】" + game._charName(ctx.c.id) + "移動至" + game._locName(tL.id) + "。"));
      var corpseOpts2 = Object.keys(ctx.st.chars).filter(function (id) {
        return !ctx.st.chars[id].alive && ctx.st.chars[id].loc === tL.id && id !== ctx.c.id;
      }).map(function (id) { return { type: "char", id: id, label: game._charName(id) }; });
      if (corpseOpts2.length) {
        var tC = await ctx.T(corpseOpts2, ctx.abTitle, ctx.ab.desc);
        if (tC) {
          ctx.st.chars[tC.id].alive = true;
          game._feed({ type: "resurrect", id: tC.id });
          game._log(TL.L("gwSenninResurrect", { who: ctx.who, char: game._charName(tC.id) }) ||
            ("【" + ctx.who + "】復活了" + game._charName(tC.id) + "。"));
        }
      }
    }
  }
});

TL.registerGoodwillAbility("reveal_same_roles", {
  targets: function () { return []; },
  exec: async function (game, ctx) {
    // 模仿犯：公開場上（活人）中與其身份相同的所有角色名（不揭示身份本身）
    var myRole = ctx.st.chars[ctx.c.id].role;
    var sameNames = Object.keys(ctx.st.chars).filter(function (id) {
      return ctx.st.chars[id].alive && id !== ctx.c.id && ctx.st.chars[id].role === myRole;
    });
    sameNames.push(ctx.c.id);
    sameNames.forEach(function (id) { ctx.st.chars[id].sameRoleRevealed = true; });
    game._log(TL.L("sameRolesReveal", {
      who: ctx.who,
      chars: sameNames.map(function (id) { return game._charName(id); }).join("、")
    }) || ("【" + ctx.who + "】公開了與其同身份的角色名：" + sameNames.map(function (id) { return game._charName(id); }).join("、") + "。"));
  }
});

// 上位存在：同一區域選擇1名角色獲得1枚[希望]或[絕望]（1x∞）
TL.registerGoodwillAbility("hope_despair", {
  targets: function (game, chosen) { return TL.goodwillCtx(game, chosen).charOpts; },
  exec: async function (game, ctx, targetOverride) {
    var target = await ctx.T(ctx.charOpts, ctx.abTitle, ctx.ab.desc, targetOverride);
    if (!target) return;
    var kind = await game.io.askChoice({
      title: TL.L("hopeDespairTitle") || "希望 / 絕望",
      text: TL.L("hopeDespairText", { char: game._charName(target.id) }) ||
        ("往" + game._charName(target.id) + "身上放置哪種指示物？"),
      options: [TL.t("game.counter.hope"), TL.t("game.counter.despair")]
    });
    if (kind === 0) {
      ctx.st.chars[target.id].hope = (ctx.st.chars[target.id].hope || 0) + 1;
      game._feed({ type: "marker", id: target.id, kind: "hope", delta: 1, value: ctx.st.chars[target.id].hope });
      game._log(TL.L("hopePlaced", { who: ctx.who, char: game._charName(target.id), v: ctx.st.chars[target.id].hope }) ||
        ("【" + ctx.who + "】" + game._charName(target.id) + " 希望+1（" + ctx.st.chars[target.id].hope + "）。"));
    } else {
      ctx.st.chars[target.id].despair = (ctx.st.chars[target.id].despair || 0) + 1;
      game._feed({ type: "marker", id: target.id, kind: "despair", delta: 1, value: ctx.st.chars[target.id].despair });
      game._log(TL.L("despairPlaced", { who: ctx.who, char: game._charName(target.id), v: ctx.st.chars[target.id].despair }) ||
        ("【" + ctx.who + "】" + game._charName(target.id) + " 絕望+1（" + ctx.st.chars[target.id].despair + "）。"));
    }
  }
});

// 提線木偶：結算友好能力後，2種以上指示物→死亡並世界移動
TL.registerGoodwillAfter("marionette", async function (game, charId) {
  if (game._counterKinds(charId).length >= 2) {
    game._log(TL.L("marionetteAfter", { char: game._charName(charId) }) ||
      (game._charName(charId) + "（提線木偶）身上有2種以上指示物，死亡並進行世界移動。"));
    game._triggerWarp(true);
    await game._applyDeath(charId);
  }
});

// 敘述者：結算友好能力後，被指定為對象的角色死亡
TL.registerGoodwillAfter("storyteller", async function (game, charId) {
  var st = game.state;
  var data = CHAR_INDEX[charId];
  var targets = [];
  (data.goodwill || []).forEach(function (ab, i) {
    if (ab.target && ab.target !== "self" && ab.target !== "none") {
      var area = game._charArea(charId);
      targets = targets.concat(game._aliveChars(area).filter(function (id) { return id !== charId; }));
    }
  });
  targets = targets.filter(function (id, i) { return targets.indexOf(id) === i; });
  for (var ti = 0; ti < targets.length; ti++) {
    game._log(TL.L("storytellerKillTarget", { char: game._charName(charId), char2: game._charName(targets[ti]) }) ||
      (game._charName(targets[ti]) + "（敘述者能力的對象）死亡。"));
    await game._applyDeath(targets[ti]);
  }
});

// 愛麗絲：結算友好能力後（1x∞），Ex槽1+ → 同一區域所有其他角色獲得1枚希望
TL.registerGoodwillAfter("alice", async function (game, charId) {
  if (game.state.exGauge < 1) return;
  var area = game._charArea(charId);
  game._aliveChars(area).forEach(function (id) {
    if (id === charId) return;
    game.state.chars[id].hope = (game.state.chars[id].hope || 0) + 1;
    game._feed({ type: "marker", id: id, kind: "hope", delta: 1, value: game.state.chars[id].hope });
    game._log(game._charName(id) + " 希望+1。");
  });
});

// 網絡名流：結算友好能力後（1x∞），同一初始區域其他角色獲得1不安+1友好
TL.registerGoodwillAfter("influencer", async function (game, charId) {
  var st = game.state;
  var start = st.chars[charId].startingLoc;
  Object.keys(st.chars).forEach(function (id) {
    if (id === charId || st.chars[id].loc !== start || !st.chars[id].alive) return;
    st.chars[id].paranoia += 1;
    st.chars[id].goodwill += 1;
    game._feed({ type: "marker", id: id, kind: "paranoia", delta: 1, value: st.chars[id].paranoia });
    game._feed({ type: "marker", id: id, kind: "goodwill", delta: 1, value: st.chars[id].goodwill });
    game._log(game._charName(id) + " 不安+1、友好+1。");
  });
});

// 密鑰：結算友好能力後公開身份
TL.registerGoodwillAfter("secretkeeper", async function (game, charId) {
  await game._revealRole(charId);
});

// 紙老虎：2枚以上不安→失去不死、獲得必定無視友好（在拒絕判定前已透過 _refusalOf/undying 生效）
TL.registerGoodwillAfter("paper_tiger", async function () {});

// 劇作家能力來源：上位存在（擁有無視友好且有至少1枚友好時，劇作家可在劇作家能力階段使用）
TL.registerMMSource(function (game) {
  var st = game.state;
  var c = st.chars.higher_being;
  if (!c || !c.alive || c.onStage === false) return null;
  var refusal = game._refusalOf("higher_being");
  if (refusal === "none" || game._effGoodwill("higher_being") < 1) return null;
  // 1x∞ 限制與主人公共用
  var abIdx = 0;
  var data = CHAR_INDEX.higher_being;
  var ab = (data.goodwill || [])[abIdx];
  if (!ab) return null;
  if (st.usedGoodwill["higher_being"] && st.usedGoodwill["higher_being"][abIdx]) return null;
  return {
    charId: "higher_being",
    ability: {
      timing: "mm_phase",
      mandatory: false,
      desc: TL.desc("char.higher_being.0", ab.desc),
      effect: "hope_despair",
      oncePerLoop: true,
      abilityIdx: abIdx
    }
  };
});
