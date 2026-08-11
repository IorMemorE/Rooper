// 最終決戰
window.TL = window.TL || {};

TL.Game.prototype.finalGuess = async function (charId, roleId) {
  var st = this.state;
  if (!st.finalGuess) return { ok: false, msg: TL.t("game.err.notFinalGuess") };
  var c = st.chars[charId];
  if (!c) return { ok: false, msg: TL.t("game.err.noChar") };
  if (c.roleRevealed) return { ok: false, msg: TL.t("game.err.roleRevealed") };
  if (c.role === roleId) {
    c.roleRevealed = true;
    this._log(TL.L("finalCorrect", { char: this._charName(charId), role: TL.rname(roleId) }) ||
      ("✓ 最終決戰：「" + this._charName(charId) + "」的身份是「" + ROLE_INDEX[roleId].name + "」——正確！"));
    var remaining = Object.keys(st.chars).filter(function (id) {
      return !st.chars[id].roleRevealed && st.chars[id].onStage !== false;
    });
    if (!remaining.length) {
      st.ended = "win";
      st.phase = "game_over";
      this._log(TL.L("finalAllCorrect") || "✓ 最終決戰全部正確！主人公獲得最終勝利！");
    }
    return { ok: true };
  } else {
    this._log(TL.L("finalWrong", { char: this._charName(charId), role: TL.rname(roleId) }) ||
      ("✗ 最終決戰：「" + this._charName(charId) + "」的身份不是「" + ROLE_INDEX[roleId].name + "」——錯誤！"));
    st.ended = "lose";
    st.phase = "game_over";
    this._log(TL.L("finalFail") || "主人公最終失敗。劇作家獲勝。");
    return { ok: true };
  }
};
