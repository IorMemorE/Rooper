// 死亡處理：角色死亡 / 主人公死亡 / 輪迴立即結束
window.TL = window.TL || {};

TL.Game.prototype._applyDeath = async function (charId) {
  var st = this.state;
  var c = st.chars[charId];
  if (!c || !c.alive) return false;
  if (this._isUndying(charId)) {
    this._log(this._charName(charId) + TL.t("game.notDie") + "。");
    return false;
  }
  if (c.guard > 0) {
    c.guard -= 1;
    this._log(this._charName(charId) + TL.t("game.guardSave"));
    return false;
  }
  // 從者代死：主人（大人物/大小姐/追加對象）死亡時，同區域從者代替死亡
  var protector = this._servantProtector(charId);
  if (protector) {
    return await this._applyDeath(protector);
  }
  c.alive = false;
  // AHR/LL/HSA 身份死亡效果（佈道者/網絡名流/密鑰等）
  var deathRoleFns = {
    gossip: async function (g, id) {
      var st = g.state;
      var area = g._charArea(id);
      var targets = g._aliveChars(area).map(function (cid) { return { type: "char", id: cid, label: g._charName(cid) }; });
      if (targets.length) {
        var t = await g.io.askTarget({ title: TL.rname("gossip"), text: "往同一區域的1名角色放置1枚[絕望]：", targets: targets, owner: "mm" });
        if (t) { st.chars[t.id].despair = (st.chars[t.id].despair || 0) + 1; g._feed({ type: "marker", id: t.id, kind: "despair", delta: 1, value: st.chars[t.id].despair }); }
      }
      var warp = await g.io.confirm({ title: TL.rname("gossip"), text: TL.L("gossipWarp") || "是否進行世界移動？", owner: "mm", kind: "warp" });
      if (warp) g._triggerWarp();
    },
    influencer: async function (g, id) {
      var st = g.state;
      var start = st.chars[id].startingLoc;
      Object.keys(st.chars).forEach(function (cid) {
        if (cid === id || st.chars[cid].loc !== start || !st.chars[cid].alive) return;
        st.chars[cid].paranoia += 1;
        g._feed({ type: "marker", id: cid, kind: "paranoia", delta: 1, value: st.chars[cid].paranoia });
        g._log(g._charName(cid) + " 不安+1。");
      });
    },
    secretkeeper: async function (g, id) {
      await g._revealRole(id);
    }
  };
  if (deathRoleFns[c.role]) await deathRoleFns[c.role](this, charId);
  // 十周年：角色首次死亡时放置遗骸标记（跨轮回保留，不因复活移除）
  if (!c.perished) {
    c.perished = true;
    this._feed({ type: "token", id: charId, kind: "perished", on: true });
    this._log(TL.L("perishedPlaced", { char: this._charName(charId) }) ||
      ("【遺骸】" + this._charName(charId) + "首次死亡，放置遺骸標記。"));
  }
  this._log(TL.L("charDeath", { char: this._charName(charId) }) || ("☠ " + this._charName(charId) + "死亡。"));
  // 魔術師：該角色死亡時，移除該角色身上的所有[不安]
  if (c.role === "magician" && c.paranoia > 0) {
    var oldParanoia = c.paranoia;
    c.paranoia = 0;
    this._feed({ type: "marker", id: charId, kind: "paranoia", delta: -oldParanoia, value: 0 });
    this._log(TL.L("magicianDeathClear", { char: this._charName(charId) }) ||
      ("【魔術師】" + this._charName(charId) + "身上的所有[不安]被移除。"));
  }
  // 深潛者：該角色死亡時公開身份，Ex槽增加1
  if (c.role === "deep_one") {
    await this._revealRole(charId);
    this._addExGauge(1);
  }
  // 心上人/求愛者連動
  var self = this;
  Object.keys(st.chars).forEach(function (id) {
    var oc = st.chars[id];
    if (!oc.alive || id === charId) return;
    var role = self._role(id);
    if (!role) return;
    role.abilities.forEach(function (ab) {
      if (ab.timing === "always" && ab.effect === "lover_dies_give_paranoia" && st.chars[charId].role === "lover") {
        oc.paranoia += 6;
        self._log(TL.L("loverDeathGoodwill", { char: self._charName(id) }) ||
          (self._charName(id) + " 不安+6。"));
      }
      if (ab.timing === "always" && ab.effect === "loved_one_dies_give_paranoia" && st.chars[charId].role === "loved_one") {
        oc.paranoia += 6;
        self._log(TL.L("lovedOneDeathGoodwill", { char: self._charName(id) }) ||
          (self._charName(id) + " 不安+6。"));
      }
    });
  });
  // 關鍵人物死亡 → 失敗
  var paranoiacIsKey = st.plotFlags.paranoiacIsKey && c.role === "paranoiac";
  if (c.role === "key_person" || paranoiacIsKey || (c.role === "factor" && st.locations.city.intrigue >= 2)) {
    await this._endLoopByDeath(TL.L("keyPersonDeath", { char: this._charName(charId) }) ||
      (this._charName(charId) + "死亡，主人公失敗。"));
  }
  return charId;
};

TL.Game.prototype._protagonistDeath = async function (reason) {
  var st = this.state;
  if (st.plotFlags.preventDeath) {
    st.plotFlags.preventDeath = false;
    this._log(TL.L("soldierSaved") || "主人公的死亡被避免！");
    return;
  }
  this._log(TL.L("protagonistDeath", { reason: reason }) || "☠☠ 主人公死亡。");
  await this._endLoopByDeath(reason);
};

TL.Game.prototype._endLoopByDeath = async function (reason) {
  var st = this.state;
  st.ended = "lose";
  this._log(TL.L("protagonistFail", { reason: reason }) || "！！！主人公失敗。輪迴立即結束。");
  st.phase = "loop_end";
};
