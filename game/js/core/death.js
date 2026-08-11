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
