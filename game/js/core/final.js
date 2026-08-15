// 最終決戰（联机合作猜测流程）
window.TL = window.TL || {};

// 剧本是否允许最终决战
TL.Game.prototype._allowFinalGuess = function () {
  return !!(this.module && this.module.finalGuess) && this.script.allowFinalGuess !== false;
};

// 所有轮回失败：进入“最终决战”待命（联机显示按钮）或直接结束
TL.Game.prototype._enterFinalGuessPending = function () {
  var st = this.state;
  // 重置场地
  Object.keys(st.chars).forEach(function (id) {
    var c = st.chars[id];
    c.loc = c.startingLoc;
    c.alive = true;
    c.paranoia = 0; c.goodwill = 0; c.intrigue = 0; c.guard = 0;
    c.hope = 0; c.despair = 0;
  });
  LOCATIONS.forEach(function (l) { st.locations[l.id].intrigue = 0; });
  if (this._allowFinalGuess()) {
    if (this.onlineMode) {
      // 联机：进入“最终决战”待命，由队长点按钮开始
      st.phase = "final_guess_pending";
      this._log(TL.L("allFailFinal") || "所有輪迴均失敗。等待進入最終決戰。");
    } else {
      // 本地（熱座/AI）：直接进入最终决战（旧逐步猜测流程）
      st.phase = "final_guess";
      st.finalGuess = {
        index: 0,
        order: Object.keys(st.chars).filter(function (id) { return st.chars[id].onStage !== false; }),
        done: false
      };
      this._log(TL.L("allFailFinal") || "所有輪迴均失敗。進入最終決戰。");
    }
  } else {
    st.ended = "lose";
    st.phase = "game_over";
    this._log(TL.L("allFailNoFinal") || "所有輪迴均失敗（本模組無最終決戰）。劇作家獲勝。");
  }
};

// 联机：主人公队长点击“最终决战”按钮 → 初始化猜测
TL.Game.prototype.beginFinalGuess = function () {
  var st = this.state;
  if (st.phase !== "final_guess_pending") return { ok: false, msg: TL.t("game.err.notFinalGuess") };
  st.finalGuess = {
    selections: {},      // charId -> roleId（null/'' = 平民）
    confirmed: { 0: false, 1: false, 2: false },
    revealed: false,
    result: null
  };
  st.phase = "final_guess";
  this._log(TL.L("finalGuess") || "—— 最終決戰 ——");
  return { ok: true };
};

// 联机：主人公设置某个角色的猜测（团队共享，同步）
TL.Game.prototype.finalGuessSet = function (charId, roleId) {
  var st = this.state;
  if (st.phase !== "final_guess") return { ok: false, msg: TL.t("game.err.notFinalGuess") };
  if (!st.chars[charId]) return { ok: false, msg: TL.t("game.err.noChar") };
  st.finalGuess.selections[charId] = roleId || null;
  return { ok: true };
};

// 联机：主人公各自确认猜测（分人）
TL.Game.prototype.finalGuessConfirm = function (playerIndex) {
  var st = this.state;
  if (st.phase !== "final_guess") return { ok: false, msg: TL.t("game.err.notFinalGuess") };
  st.finalGuess.confirmed[playerIndex] = true;
  return { ok: true };
};

// 联机：剧作家“显示最终结果” → 判定并公开
TL.Game.prototype.finalGuessReveal = function () {
  var st = this.state;
  if (st.phase !== "final_guess") return { ok: false, msg: TL.t("game.err.notFinalGuess") };
  var allConfirmed = true;
  for (var i = 0; i < this.protagonistCount; i++) {
    if (!st.finalGuess.confirmed[i]) { allConfirmed = false; break; }
  }
  if (!allConfirmed) return { ok: false, msg: TL.t("game.fgNeedAll") };
  var results = [];
  var allCorrect = true;
  Object.keys(st.chars).forEach(function (id) {
    var c = st.chars[id];
    if (c.onStage === false) return;
    var guess = st.finalGuess.selections[id] || null;
    var correct = c.role === guess || (c.role === "fragment" && !guess);
    if (!correct) allCorrect = false;
    results.push({ charId: id, guess: guess, correct: correct });
    c.roleRevealed = true;
  });
  st.finalGuess.revealed = true;
  st.finalGuess.result = results;
  st.ended = allCorrect ? "win" : "lose";
  st.phase = "final_result";
  this._log(allCorrect
    ? (TL.L("finalAllCorrect") || "✓ 最終決戰全部正確！主人公獲得最終勝利！")
    : (TL.L("finalFail") || "主人公最終失敗。劇作家獲勝。"));
  return { ok: true };
};

// 本地（熱座/AI）：保留旧的逐角色立即判定流程
TL.Game.prototype.finalGuess = async function (charId, roleId) {
  var st = this.state;
  if (!st.finalGuess) return { ok: false, msg: TL.t("game.err.notFinalGuess") };
  var c = st.chars[charId];
  if (!c) return { ok: false, msg: TL.t("game.err.noChar") };
  if (c.roleRevealed) return { ok: false, msg: TL.t("game.err.roleRevealed") };
  var correct = c.role === roleId || (c.role === "fragment" && !roleId);
  if (correct) {
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
