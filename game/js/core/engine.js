// 引擎入口：Game 建構 / 階段機 / 打牌 API
// 其餘邏輯按職責拆分至 core/*.js，並以註冊表方式掛載（可拆卸）
window.TL = window.TL || {};

TL.Game = function (script, opts) {
  opts = opts || {};
  this.script = TL.clone(script);
  this.module = MODULES[this.script.moduleId] || MODULES.FS;
  this.protagonistCount = opts.protagonists || 3;
  this.onlineMode = !!opts.onlineMode;
  this.io = opts.io || {
    log: function () {},
    askChoice: async function (q) { return 0; },
    askTarget: async function (q) { return null; },
    confirm: async function (q) { return true; },
    promptNumber: async function (q, min, max) { return min; }
  };
  this.state = null;
  this._init();
};

// 以伺服器快照重建「唯讀鏡像」（多人聯機客戶端渲染用）
TL.Game.fromState = function (script, state, opts) {
  opts = opts || {};
  var g = new TL.Game(script, opts);
  g.state = JSON.parse(JSON.stringify(state));
  g.protagonistCount = opts.protagonists || 3;
  return g;
};

// ---------- 開始 / 回合推進 ----------
TL.Game.prototype.startGame = async function () {
  this.state.phase = "loop_start";
  await this._beginLoop();
};

TL.Game.prototype.nextStep = async function () {
  var st = this.state;
  if (st.ended && st.phase !== "loop_end") return;
  switch (st.phase) {
    case "day_start":
      st.usedGoodwillDay = {};
      st.usedMMAbility = {};
      st.feed = [];
      this._log(TL.I18N.log("dayStart", { n: st.day }) || ("—— 第" + st.day + "天 早晨 ——"));
      // 臨時工：回合開始階段，若該卡牌為死亡狀態 → 在都市放置「臨時工？」
      await this._partTimerSpawn();
      // Ex槽1+ 感應咒文：第1天回合開始階段，隊長可選擇任意1名角色放置2枚[友好]
      if (st.day === 1 && st.exGauge >= 1) {
        await this._exIncantation();
      }
      st.phase = "mm_play";
      break;
    case "mm_play":
      st.phase = "p_play";
      break;
    case "p_play":
      await this._resolveCards();
      if (st.ended) return;
      st.phase = "mm_abilities";
      break;
    case "resolve":
      await this._resolveCards();
      if (st.ended) return;
      st.phase = "mm_abilities";
      break;
    case "mm_abilities":
      await this._mmAbilityPhase();
      if (st.ended) return;
      st.phase = "goodwill";
      break;
    case "goodwill":
      await this._goodwillPhase();
      if (st.ended) return;
      st.phase = "incident";
      break;
    case "incident":
      await this._incidentPhase();
      if (st.ended) return;
      if (st.phase !== "incident") return; // 銀色子彈：事件階段結束即進入輪迴結束
      st.leader = (st.leader + 1) % this.protagonistCount;
      st.phase = "day_end";
      break;
    case "day_end":
      await this._dayEndPhase();
      if (st.ended) return;
      if (st.day >= this.script.days) {
        st.phase = "loop_end";
      } else {
        st.day += 1;
        this._updateOnStage(st.loop, st.day);
        st.phase = "day_start";
      }
      break;
    case "loop_end":
      if (st.nextLoopPending) {
        // 主人公失敗且還有剩餘輪迴：玩家點「下一輪輪迴」後開始下一輪
        st.nextLoopPending = false;
        await this._beginLoop();
      } else {
        await this._loopEndPhase();
      }
      break;
    case "final_guess":
      break;
  }
};

// ---------- 劇作家打牌 ----------
TL.Game.prototype.mmPlayCard = function (cardId, targetType, targetId) {
  var st = this.state;
  if (st.phase !== "mm_play") return { ok: false, msg: TL.t("game.err.notMmPlay") };
  if (st.mmPlays.length >= 3) return { ok: false, msg: TL.t("game.err.mmMax3") };
  if (this._usedCard("mm", cardId)) return { ok: false, msg: TL.t("game.err.cardUsed") };
  if (st.mmPlays.some(function (p) { return p.targetType === targetType && p.targetId === targetId; })) {
    return { ok: false, msg: TL.t("game.err.mmSamePos") };
  }
  // 永生者等：劇作家不可以往該角色身上設置任何行動牌
  if (targetType === "char" && this._noMMCards(targetId)) {
    return { ok: false, msg: TL.L("noMMCards", { char: this._charName(targetId) }) ||
      ("劇作家不可以往" + this._charName(targetId) + "身上設置行動牌。") };
  }
  st.mmPlays.push({ card: cardId, targetType: targetType, targetId: targetId });
  return { ok: true };
};

TL.Game.prototype.mmRemovePlay = function (idx) {
  if (this.state.phase !== "mm_play") return;
  this.state.mmPlays.splice(idx, 1);
};

TL.Game.prototype.confirmMMPlays = function () {
  var st = this.state;
  if (st.phase !== "mm_play") return { ok: false, msg: TL.t("game.err.notMmPlay") };
  if (st.mmPlays.length !== 3) return { ok: false, msg: TL.t("game.err.mmNeed3") };
  st.phase = "p_play";
  return { ok: true };
};

// ---------- 主人公打牌 ----------
TL.Game.prototype._usedCard = function (deck, cardId) {
  var card = CARD_INDEX[cardId];
  if (!card || !card.oncePerLoop) return false;
  return !!this.state.used[deck][cardId];
};

TL.Game.prototype.pPlayCard = function (playerIndex, deckIndex, cardId, targetType, targetId) {
  var st = this.state;
  if (st.phase !== "p_play") return { ok: false, msg: TL.t("game.err.notPPlay") };
  var deck = "p" + deckIndex;
  if (this._usedCard(deck, cardId)) return { ok: false, msg: TL.t("game.err.cardUsed") };
  var existing = st.pPlays.filter(function (p) { return p.player === playerIndex; });
  var maxPlays = this._playsPerProtagonist(playerIndex);
  if (existing.length >= maxPlays) return { ok: false, msg: TL.t("game.err.pMaxPlays") };
  if (st.pPlays.some(function (p) { return p.deck === deckIndex; })) return { ok: false, msg: TL.t("game.err.deckUsed") };
  if (st.pPlays.some(function (p) { return p.targetType === targetType && p.targetId === targetId; })) {
    return { ok: false, msg: TL.t("game.err.pSamePos") };
  }
  // 偽裝自殺：放置了Ex牌的角色身上，本輪輪迴剩餘時間主人公無法放置行動牌
  if (targetType === "char" && st.exCards[targetId]) {
    return { ok: false, msg: TL.L("pExCardBlock", { char: this._charName(targetId) }) ||
      ("放置了Ex牌的角色身上，主人公本輪輪迴無法放置行動牌。") };
  }
  st.pPlays.push({ player: playerIndex, deck: deckIndex, card: cardId, targetType: targetType, targetId: targetId });
  return { ok: true };
};

TL.Game.prototype.pRemovePlay = function (idx) {
  if (this.state.phase !== "p_play") return;
  this.state.pPlays.splice(idx, 1);
};

TL.Game.prototype._playsPerProtagonist = function (playerIndex) {
  var n = this.protagonistCount;
  if (n === 1) return 3;                       // 2人規則：1名主人公從3副牌各打1張
  if (n === 2) return playerIndex === this.state.leader ? 2 : 0; // 3人規則：隊長打2張
  return 1;                                    // 4人規則：各打1張
};

TL.Game.prototype.decksForPlayer = function (playerIndex) {
  var n = this.protagonistCount;
  if (n === 1) return [0, 1, 2];
  if (n === 2) return playerIndex === this.state.leader ? [0, 1] : [];
  return [playerIndex];
};

TL.Game.prototype.confirmPPlays = function () {
  var st = this.state;
  if (st.phase !== "p_play") return { ok: false, msg: TL.t("game.err.notPPlay") };
  var self = this;
  for (var i = 0; i < this.protagonistCount; i++) {
    var need = this._playsPerProtagonist(i);
    var have = st.pPlays.filter(function (p) { return p.player === i; }).length;
    if (have < need) return { ok: false, msg: TL.t("game.err.pNeedPlays", { n: i + 1, k: need - have }) };
  }
  st.phase = "resolve";
  return { ok: true };
};

// ---------- 联机流程：分人确认 / 掀开卡牌 / 结算完成 / 宣告失败 ----------

// 联机：单个主人公确认自己的出牌（需打满自己的牌数）
TL.Game.prototype.confirmPPlayByPlayer = function (playerIndex) {
  var st = this.state;
  if (st.phase !== "p_play") return { ok: false, msg: TL.t("game.err.notPPlay") };
  if (st.pConfirmed[playerIndex]) return { ok: true }; // 已确认过
  var need = this._playsPerProtagonist(playerIndex);
  var have = st.pPlays.filter(function (p) { return p.player === playerIndex; }).length;
  if (have < need) return { ok: false, msg: TL.t("game.err.pNeedPlays", { n: playerIndex + 1, k: need - have }) };
  st.pConfirmed[playerIndex] = true;
  var all = true;
  for (var i = 0; i < this.protagonistCount; i++) {
    if (!st.pConfirmed[i]) { all = false; break; }
  }
  st.allPConfirmed = all;
  return { ok: true };
};

// 联机：剧作家掀开所有卡牌（所有人可见卡面）。自动模式直接结算；手动模式进入手动结算阶段
TL.Game.prototype.revealPlays = async function (manual) {
  var st = this.state;
  if (st.phase !== "p_play" || !st.allPConfirmed) return { ok: false, msg: TL.t("game.err.notPPlay") };
  st.revealed = true;
  st.feed = [];
  if (!manual) {
    // 自动模式：立即结算并清空盘面卡牌
    return await this._resolveOnlinePlays();
  }
  // 手动模式：保留卡牌在盘面，进入手动结算（由“进入剧作家能力阶段”按钮结算）
  st.phase = "resolve";
  return { ok: true };
};

// 结算（联机共用，自动/手动最后一步）：清空盘面卡牌并进入剧作家能力阶段
TL.Game.prototype._resolveOnlinePlays = async function () {
  var st = this.state;
  if (!st.revealed) return { ok: false, msg: TL.t("game.err.notPPlay") };
  this._log(TL.I18N.log("resolve") || "—— 翻開並結算行動牌 ——");
  var all = st.mmPlays.map(function (p) { return { card: p.card, targetType: p.targetType, targetId: p.targetId, owner: "mm" }; })
    .concat(st.pPlays.map(function (p) { return { card: p.card, targetType: p.targetType, targetId: p.targetId, owner: "p" + p.deck }; }));
  all.forEach(function (p) {
    var who = p.owner === "mm" ? "劇作家" : "主人公";
    var target = p.targetType === "location" ? LOC_INDEX[p.targetId].name + "（版圖）" : TL.cname(p.targetId);
    st.log.push({ text: (TL.I18N.log("reveal", { who: who, card: TL.cardname(p.card), target: target }) ||
      ("翻開：" + who + "【" + CARD_INDEX[p.card].name + "】→ " + target)), day: st.day, loop: st.loop });
    st.feed.push({ type: "reveal", owner: p.owner, card: p.card, targetType: p.targetType, targetId: p.targetId });
  });
  all.forEach(function (play) {
    var card = CARD_INDEX[play.card];
    if (card && card.oncePerLoop) st.used[play.owner][play.card] = true;
  });
  // 简化联机结算：直接执行 _resolveCards 的核心逻辑（移用现有实现）
  await this._resolveCards();
  st.mmPlays = [];
  st.pPlays = [];
  st.resolveDone = true;
  st.phase = "resolve_done";
  return { ok: true };
};

// 联机：右上角“进入剧作家能力阶段”——手动模式在此执行结算；自动模式直接推进
TL.Game.prototype.finishResolve = async function () {
  var st = this.state;
  if (st.phase === "resolve_done") {
    st.phase = "mm_abilities";
    return { ok: true };
  }
  if (st.phase === "resolve" && st.revealed) {
    var r = await this._resolveOnlinePlays();
    if (!r.ok) return r;
    st.phase = "mm_abilities";
    st.resolveDone = true;
    return { ok: true };
  }
  return { ok: false, msg: TL.t("game.err.notPPlay") };
};

// 联机：剧作家宣告主人公失败/死亡（开启下一轮回）
TL.Game.prototype.declareLose = function (type) {
  var st = this.state;
  if (type !== "fail" && type !== "death") return { ok: false, msg: "unknown type" };
  st.loseCause = type;
  st.ended = "lose";
  st.phase = "loop_end";
  this._log(type === "death"
    ? (TL.L("mmDeclareDeath") || "劇作家宣告：主人公死亡。")
    : (TL.L("mmDeclareFail") || "劇作家宣告：主人公失敗。"));
  if (st.loop >= this.script.loops) {
    // 最终轮回失败：允许最终决战则进入待命（联机显示按钮）；否则直接结束
    this._enterFinalGuessPending();
  } else {
    // 有剩余轮回：直接出现「下一轮回」按钮
    st.loop += 1;
    st.nextLoopPending = true;
    this._log(TL.L("nextLoopReady") || "主人公失敗。準備進入下一輪輪迴（點擊「下一輪輪迴」開始）。");
  }
  return { ok: true };
};
