// AI 劇作家（本地模擬對戰）
// 原則：
// 1. 能正常施壓並阻止主人公（多條勝利路徑、按局勢切換）。
// 2. 避免過度暴露身份：有最終決戰（BTX）的模組中，高暴露行動（拒絕、夜殺、戀人連動）
//    會讓主人公在最終決戰更好猜，因此會權衡「贏這輪」與「藏身份」。
// 3. 每一輪輪迴變換打法（主路徑輪替、誘餌目標、拒絕機率、移動變化），
//    避免主人公靠「同一套邏輯」累積資訊。
window.TL = window.TL || {};

TL.AI = (function () {
  var ctx = { game: null, memory: null };
  var difficultyLevel = "normal";
  var NOISE = { easy: 0.42, normal: 0.16, hard: 0.05 };

  function freshMemory() {
    return { loop: 0, refusals: 0, kills: 0, pathCounts: {}, lastPrimary: null };
  }
  function mem() {
    if (!ctx.memory) ctx.memory = freshMemory();
    return ctx.memory;
  }
  function setDifficulty(d) { difficultyLevel = d; }
  function noisy() {
    var n = NOISE[difficultyLevel];
    return Math.random() < (n === undefined ? 0.16 : n);
  }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function aliveChars(state) {
    return Object.keys(state.chars).filter(function (id) { return state.chars[id].alive; });
  }
  function boards() {
    return LOCATIONS.filter(function (l) { return !l.offBoard; });
  }

  // ---------- 目標規劃 ----------
  function plan(state, script) {
    var p = {
      roles: {},
      main: PLOT_INDEX[script.mainPlot],
      subs: (script.subplots || []).map(function (id) { return PLOT_INDEX[id]; })
    };
    Object.keys(state.chars).forEach(function (id) {
      var r = state.chars[id].role;
      if (r) (p.roles[r] = p.roles[r] || []).push(id);
    });
    p.kp = (p.roles.key_person || [])[0];
    p.killer = (p.roles.killer || [])[0];
    p.brain = (p.roles.brain || [])[0];
    p.ct = (p.roles.conspiracy_theorist || [])[0];
    p.serial = (p.roles.serial_killer || [])[0];
    p.friends = p.roles.friend || [];
    p.witch = (p.roles.witch || [])[0];
    p.lover = (p.roles.lover || [])[0];
    p.lovedOne = (p.roles.loved_one || [])[0];
    p.cultist = (p.roles.cultist || [])[0];
    p.ninja = (p.roles.ninja || [])[0];
    p.poisoner = (p.roles.poisoner || [])[0];
    p.witness = (p.roles.witness || [])[0];
    p.paranoiac = (p.roles.paranoiac || [])[0];
    p.faceless = (p.roles.faceless || [])[0];
    p.deepOne = (p.roles.deep_one || [])[0];
    p.magician = (p.roles.magician || [])[0];
    p.ex = state.exGauge || 0;
    var mod = MODULES[script.moduleId];
    p.finalGuess = !!(mod && mod.finalGuess);
    var rule = p.main && p.main.rule;
    p.keyLoc = null;
    p.startLocTarget = null;
    if (rule) {
      if (rule.type === "intrigue_on_location") p.keyLoc = rule.location;
      else if (rule.type === "intrigue_on_start_location") {
        var holder = (p.roles[rule.role] || [])[0];
        if (holder) p.startLocTarget = state.chars[holder].startingLoc;
      }
    }
    p.kpIntrigue = !!(p.main && (p.main.id === "murder_plan" || p.main.id === "sign_with_me")) || !!(p.killer && p.kp);
    if (p.witch && p.main && p.main.id === "giant_time_bomb") {
      p.startLocTarget = state.chars[p.witch].startingLoc || p.startLocTarget;
    }
    p.preventButterfly = !!(p.main && p.main.id === "changing_the_future");
    p.virus = p.subs.some(function (s) { return s && s.id === "paranoia_virus"; });
    p.rumor = p.subs.some(function (s) { return s && s.rule && s.rule.type === "mm_intrigue_any_location"; });
    p.loveAffair = p.subs.some(function (s) { return s && s.id === "a_love_affair"; });
    p.serialSub = p.subs.some(function (s) { return s && (s.id === "shadow_of_the_ripper" || s.id === "the_hidden_freak"); });
    p.smellGunpowder = p.subs.some(function (s) { return s && s.id === "smell_of_gunpowder"; });
    p.showtime = p.subs.some(function (s) { return s && s.id === "showtime_of_death"; });
    p.sacredWords = !!(p.main && p.main.id === "sacred_words_of_dagon");
    p.bloodyRites = !!(p.main && p.main.id === "bloody_rites");
    p.choir = !!(p.main && p.main.id === "choir_to_the_outside_god");
    p.maleConfrontation = !!(p.main && p.main.id === "male_confrontation");
    p.secretRecord = !!(p.main && p.main.id === "secret_record");
    p.strychnine = !!(p.main && p.main.id === "drop_of_strychnine");
    p.virusTarget = null;
    if (p.virus) {
      var commoners = aliveChars(state).filter(function (id) { return !state.chars[id].role; });
      p.virusTarget = commoners.length ? pick(commoners) : null;
    }
    var m = mem();
    if (state.loop !== m.loop) m.loop = state.loop;
    // 玩家行為變化：第2輪起關鍵人物密謀一直被壓制 → 轉向低暴露/次級路徑
    p.shift = state.loop >= 2 && p.kp && state.chars[p.kp] && state.chars[p.kp].alive && state.chars[p.kp].intrigue < 2;
    choosePaths(state, p, m);
    return p;
  }

  // 選擇本輪主路徑（依難度與過往使用次數變換，避免同一套路）
  function choosePaths(state, p, m) {
    var cands = [];
    function add(id, base, loud) {
      // 高暴露路徑在最終決戰模組中扣分更多
      var exposure = loud ? (p.finalGuess ? 1.7 : 0.9) : (p.finalGuess ? 0.6 : 0.4);
      var repeat = m.pathCounts[id] || 0;
      cands.push({ id: id, score: base - exposure - repeat * 1.1 + Math.random() * 0.5 });
    }
    if (p.kpIntrigue && p.kp && state.chars[p.kp] && state.chars[p.kp].alive) add("kp", p.shift ? 7 : 10, true);
    if (p.keyLoc) add("loc", 9, false);
    if (p.startLocTarget) add("startloc", 8, false);
    if (p.virusTarget) add("virus", 8, false);
    if (p.serial && state.chars[p.serial] && state.chars[p.serial].alive && (p.serialSub || p.shift)) add("serial", 7, true);
    if (p.lover && state.chars[p.lover] && state.chars[p.lover].alive && p.loveAffair) add("lover", 5, true);
    if (p.maleConfrontation && p.ninja && state.chars[p.ninja] && state.chars[p.ninja].alive) add("ninja", 8, false);
    if (p.smellGunpowder) add("paranoia", 8, false);
    if (p.showtime) add("blood", 8, true);
    if (p.choir) add("choir", 8, false);
    if (p.bloodyRites && p.ex >= 1) add("blood", 7, true);
    if (!cands.length) { p.primary = null; p.secondary = null; p.decoy = null; return; }
    cands.sort(function (a, b) { return b.score - a.score; });
    var idx = 0;
    if (difficultyLevel === "easy") idx = Math.floor(Math.random() * Math.min(3, cands.length));
    else if (difficultyLevel === "normal" && Math.random() < 0.28) idx = Math.floor(Math.random() * Math.min(2, cands.length));
    p.primary = cands[idx].id;
    m.pathCounts[p.primary] = (m.pathCounts[p.primary] || 0) + 1;
    p.secondary = cands.length > 1 ? cands[idx === 0 ? 1 : 0].id : null;
    // 誘餌目標：讓主人公追錯人（低暴露路徑的干擾）
    p.decoy = null;
    var decoyProb = difficultyLevel === "hard" ? 0.15 : difficultyLevel === "normal" ? 0.32 : 0.5;
    if (Math.random() < decoyProb) {
      var decoys = aliveChars(state).filter(function (id) {
        return !state.chars[id].role && id !== p.kp && id !== p.virusTarget;
      });
      if (decoys.length) p.decoy = pick(decoys);
    }
  }

  // ---------- 目標評分 ----------
  function charScore(state, p, id) {
    if (!state.chars[id] || !state.chars[id].alive) return -100;
    var base = 12;
    if (p.primary === "kp" && id === p.kp) base = 100;
    else if (p.primary === "virus" && id === p.virusTarget) base = 92;
    else if (p.primary === "lover" && id === p.lover) base = 80;
    else if (p.primary === "ninja" && id === p.ninja) base = 90;
    else if (p.primary === "choir" || p.primary === "paranoia" || p.primary === "blood") base = 62;
    else if ((p.primary === "serial" || p.serialSub) && id === p.serial) base = 70;
    else if (p.kpIntrigue && id === p.kp) base = 55;
    else if (p.virus && id === p.virusTarget) base = 45;
    else if (p.friends.indexOf(id) >= 0) base = 60;
    else if (id === p.killer) base = 50;
    else if (id === p.decoy) base = 48;
    return base + Math.random() * 6;
  }
  function locScore(state, p, lid) {
    var base = 20;
    if (lid === p.keyLoc) base = p.primary === "loc" ? 100 : 70;
    if (lid === p.startLocTarget) base = p.primary === "startloc" ? 100 : 65;
    if (p.sacredWords && lid === "shrine") base = Math.max(base, p.primary === "loc" ? 110 : 80);
    return base + Math.random() * 6;
  }

  function pickBest(items, scoreFn) {
    if (!items || !items.length) return null;
    var scored = items.map(function (t) { return { t: t, s: scoreFn(t) }; })
      .sort(function (a, b) { return b.s - a.s; });
    if (noisy()) {
      var top = scored.slice(0, Math.min(3, scored.length));
      return pick(top).t;
    }
    return scored[0].t;
  }
  function pickBestIndex(scores) {
    var best = 0;
    for (var i = 1; i < scores.length; i++) if (scores[i] > scores[best]) best = i;
    if (noisy() && scores.length > 1) {
      var idx = Math.floor(Math.random() * scores.length);
      if (idx !== best) return idx;
    }
    return best;
  }

  // ---------- 劇作家打牌（3張） ----------
  function mmPlays(state, game) {
    var p = plan(state, game.script);
    var used = state.used.mm || {};
    var deckCount = {};
    MASTERMIND_DECK.forEach(function (c) { deckCount[c] = (deckCount[c] || 0) + 1; });
    var candidates = [];
    function add(card, tt, ti, score) {
      if (!card || !CARD_INDEX[card]) return;
      candidates.push({ card: card, targetType: tt, targetId: ti, score: score });
    }
    function onceUsed(card) {
      var c = CARD_INDEX[card];
      return !!(c && c.oncePerLoop && used[card]);
    }
    var alive = aliveChars(state).filter(function (id) { return !game._noMMCards(id); });
    var kpId = p.kp;

    // 主路徑
    if (p.primary === "kp" && kpId && state.chars[kpId].alive) {
      add("m_intrigue_plus1", "char", kpId, 100);
      add("m_intrigue_plus2", "char", kpId, 118);
    }
    if (p.primary === "loc" && p.keyLoc) {
      add("m_intrigue_plus1", "location", p.keyLoc, 98);
      add("m_intrigue_plus2", "location", p.keyLoc, 116);
    }
    if (p.primary === "startloc" && p.startLocTarget) {
      add("m_intrigue_plus1", "location", p.startLocTarget, 96);
      add("m_intrigue_plus2", "location", p.startLocTarget, 114);
    }
    if (p.primary === "virus" && p.virusTarget) {
      add("m_paranoia_plus", "char", p.virusTarget, 96);
    }
    if (p.primary === "lover" && p.lover && state.chars[p.lover].alive) {
      if (state.chars[p.lover].intrigue >= 1) add("m_paranoia_plus", "char", p.lover, 84);
      else add("m_intrigue_plus1", "char", p.lover, 62);
    }
    if (p.primary === "serial" && p.serial && state.chars[p.serial].alive) {
      add("m_move_h", "char", p.serial, 76);
      add("m_move_v", "char", p.serial, 76);
      add("m_move_d", "char", p.serial, 76);
    }
    if (p.primary === "ninja" && p.ninja && state.chars[p.ninja].alive) {
      add("m_intrigue_plus1", "char", p.ninja, 100);
      add("m_intrigue_plus2", "char", p.ninja, 116);
    }
    if (p.primary === "paranoia") {
      var paCands = alive;
      paCands.forEach(function (id) { add("m_paranoia_plus", "char", id, 55); });
    }
    if (p.primary === "choir") {
      alive.slice(0, 4).forEach(function (id) { add("m_intrigue_plus1", "char", id, 58); });
    }
    if (p.primary === "blood") {
      var bCands = alive.filter(function (id) { return id !== p.kp; });
      bCands.slice(0, 4).forEach(function (id) { add("m_paranoia_plus", "char", id, 60); });
      if (p.serial && state.chars[p.serial] && state.chars[p.serial].alive) {
        add("m_move_h", "char", p.serial, 70);
        add("m_move_v", "char", p.serial, 70);
      }
    }
    // 次級路徑
    if (p.secondary === "loc" && p.keyLoc) add("m_intrigue_plus1", "location", p.keyLoc, 62);
    if (p.secondary === "startloc" && p.startLocTarget) add("m_intrigue_plus1", "location", p.startLocTarget, 60);
    if (p.secondary === "virus" && p.virusTarget) add("m_paranoia_plus", "char", p.virusTarget, 58);
    if (p.secondary === "kp" && kpId && state.chars[kpId].alive) add("m_intrigue_plus1", "char", kpId, 55);
    // 關鍵人物/親友 禁止友好
    if (kpId && state.chars[kpId].alive) add("m_forbid_goodwill", "char", kpId, 46);
    p.friends.forEach(function (fid) {
      if (state.chars[fid] && state.chars[fid].alive) add("m_forbid_goodwill", "char", fid, 42);
    });
    // 誘餌
    if (p.decoy && state.chars[p.decoy].alive) {
      add("m_paranoia_plus", "char", p.decoy, 50);
      add("m_intrigue_plus1", "char", p.decoy, 44);
    }
    // 保險候選（保證至少有牌可出）
    if (alive.length) {
      add("m_paranoia_plus", "char", pick(alive), 20);
      add("m_intrigue_plus1", "location", pick(boards()).id, 18);
    }

    candidates.sort(function (a, b) { return b.score - a.score; });
    var chosen = [];
    var usedCards = {};
    var usedTargets = {};
    for (var i = 0; i < candidates.length && chosen.length < 3; i++) {
      var c = candidates[i];
      if (usedCards[c.card] >= (deckCount[c.card] || 1)) continue;
      if (onceUsed(c.card)) continue;
      var posKey = c.targetType + "|" + c.targetId;
      if (usedTargets[posKey]) continue;
      chosen.push(c);
      usedCards[c.card] = (usedCards[c.card] || 0) + 1;
      usedTargets[posKey] = true;
    }
    // 補滿3張
    var fallbackCards = ["m_paranoia_plus", "m_intrigue_plus1", "m_forbid_paranoia", "m_forbid_goodwill", "m_move_h"];
    var fbIdx = 0;
    while (chosen.length < 3 && fbIdx < fallbackCards.length * 6) {
      var card = fallbackCards[fbIdx % fallbackCards.length];
      fbIdx++;
      if (usedCards[card] >= (deckCount[card] || 1)) continue;
      if (onceUsed(card)) continue;
      var tt = "char", ti = null;
      if (card.indexOf("intrigue") >= 0 && Math.random() < 0.5) {
        tt = "location"; ti = pick(boards()).id;
      } else {
        if (!alive.length) continue;
        ti = pick(alive);
      }
      var posKey2 = tt + "|" + ti;
      if (usedTargets[posKey2]) continue;
      chosen.push({ card: card, targetType: tt, targetId: ti, score: 0 });
      usedCards[card] = (usedCards[card] || 0) + 1;
      usedTargets[posKey2] = true;
    }
    return chosen;
  }

  // ---------- 劇作家能力階段 ----------
  function mmAbilities(state, game) {
    var p = plan(state, game.script);
    var usable = game.usableMMAbilities();
    var acts = [];
    usable.forEach(function (entry) {
      var eff = entry.ability.effect;
      var target = null;
      if (eff === "brain_intrigue" || eff === "faceless_deep_one") {
        target = pickBest(game.mmAbilityTargets(entry), function (t) {
          return t.type === "char" ? charScore(state, p, t.id) : locScore(state, p, t.id);
        });
      } else if (eff === "ct_paranoia" || eff === "faceless_ct") {
        target = pickBest(game.mmAbilityTargets(entry), function (t) {
          return charScore(state, p, t.id);
        });
      } else if (eff === "unsettling_rumor" || eff === "unsafe_trigger") {
        target = pickBest(game.mmAbilityTargets(entry), function (t) {
          return locScore(state, p, t.id);
        });
      } else if (eff === "therapist_remove_paranoia") {
        // 心理醫生（強制）：被迫移除不安 → 選不安最少、影響最小的目標
        target = pickBest(game.mmAbilityTargets(entry), function (t) {
          return -state.chars[t.id].paranoia * 3 + charScore(state, p, t.id) * 0.2;
        });
      } else if (eff === "magician_move") {
        target = pickBest(game.mmAbilityTargets(entry), function (t) {
          return charScore(state, p, t.id) + state.chars[t.id].paranoia * 2;
        });
      }
      if (eff === "paranoiac_self_marker") {
        acts.push({ entry: entry, target: null });
        return;
      }
      if (target || !entry.charId) acts.push({ entry: entry, target: target });
    });
    return acts;
  }

  // ---------- 移動方向（劇作家移動牌） ----------
  function moveDir(state, q) {
    if (!state || !ctx.game) return 0;
    var p = plan(state, ctx.game.script);
    var locs = q.locIds || [];
    if (!locs.length) return 0;
    var charId = q.charId;
    var isSerial = state.chars[charId] && state.chars[charId].role === "serial_killer";
    // 有機率故意不按最佳走（防主人公預判殺人狂路線）
    var wander = Math.random() < (difficultyLevel === "hard" ? 0.05 : difficultyLevel === "normal" ? 0.2 : 0.45);
    if (wander) return Math.floor(Math.random() * locs.length);
    var scores = locs.map(function (lid) {
      var others = Object.keys(state.chars).filter(function (id) {
        return state.chars[id].alive && id !== charId && state.chars[id].loc === lid;
      }).length;
      var s = 10;
      if (isSerial) s = others === 1 ? 100 : (others === 0 ? 45 : 12);
      if (lid === p.keyLoc) s += 12;
      if (lid === p.startLocTarget) s += 10;
      return s;
    });
    return pickBestIndex(scores);
  }

  // ---------- 劇作家確認（拒絕 / 邪教徒 / 夜間） ----------
  var HARMFUL_ABILITIES = [
    "reveal_role", "reveal_self", "reveal_culprit", "reveal_corpse", "reveal_rule_x", "reveal_same_roles",
    "kill", "resurrect", "guard_place", "paranoia_minus", "intrigue_minus", "intrigue_minus_location",
    "clear_markers", "move_counter", "retrieve_card", "hope_despair"
  ];

  function aiConfirm(state, q) {
    if (!q) return true;
    var m = mem();
    if (q.kind === "refuse") {
      m.refusals++;
      // 拒絕會暗示「該角色帶有無視友好身份」；非關鍵能力盡量放行
      var harmful = HARMFUL_ABILITIES.indexOf(q.effect) >= 0;
      if (!harmful) return Math.random() < 0.12;
      var prob = difficultyLevel === "hard" ? 0.92 : difficultyLevel === "normal" ? 0.7 : 0.45;
      if (m.refusals > 3) prob *= 0.55; // 暴露過多後開始放行
      return Math.random() < prob;
    }
    if (q.kind === "cultist") {
      var p = state && ctx.game ? plan(state, ctx.game.script) : null;
      // 只有影響關鍵地點的禁止密謀才值得暴露邪教徒
      if (p && p.keyLoc && q.locId === p.keyLoc) return Math.random() < 0.8;
      if (p && p.startLocTarget && q.locId === p.startLocTarget) return Math.random() < 0.75;
      return Math.random() < 0.3;
    }
    if (q.kind === "ninja_fake") {
      var fakeProb = difficultyLevel === "hard" ? 0.95 : difficultyLevel === "normal" ? 0.8 : 0.55;
      return Math.random() < fakeProb;
    }
    if (q.kind === "night") {
      m.kills++;
      if (q.subKind === "killer_kp") return m.kills <= 3 ? Math.random() < 0.95 : Math.random() < 0.6;
      if (q.subKind === "tt") return true; // 最終日宣告失敗：決定性勝利
      var p2 = state && ctx.game ? plan(state, ctx.game.script) : null;
      var prob2 = p2 && p2.finalGuess ? 0.55 : 0.9;
      if (m.kills > 3) prob2 *= 0.7;
      return Math.random() < prob2;
    }
    return true;
  }

  // 手下初始區域：優先靠近關鍵版圖/起始地點，其次隨機
  function henchmanLoc(q) {
    var targets = q.targets || [];
    if (!targets.length) return null;
    var st = ctx.game ? ctx.game.state : null;
    var p = st && ctx.game ? plan(st, ctx.game.script) : null;
    if (!p) return targets[0];
    var best = targets[0], bestScore = -1;
    targets.forEach(function (t) {
      var s = 10;
      if (t.id === p.keyLoc) s = 100;
      if (t.id === p.startLocTarget) s = 90;
      if (s > bestScore) { bestScore = s; best = t; }
    });
    return best;
  }

  // ---------- io 包裝 ----------
  function io(base) {
    return {
      log: function (msg) { try { base.log(msg); } catch (e) {} },
      askChoice: async function (q) {
        if (q && q.owner === "mm") return moveDir(ctx.game ? ctx.game.state : null, q);
        return base.askChoice(q);
      },
      askTarget: async function (q) {
        if (q && q.owner === "mm") {
          if (q.kind === "henchman_loc") return henchmanLoc(q);
          return (q.targets && q.targets[0]) || null;
        }
        return base.askTarget(q);
      },
      confirm: async function (q) {
        if (q && q.owner === "mm") return aiConfirm(ctx.game ? ctx.game.state : null, q);
        return base.confirm(q);
      },
      promptNumber: base.promptNumber || (async function (q, min) { return min; })
    };
  }

  return {
    setDifficulty: setDifficulty,
    get difficulty() { return difficultyLevel; },
    plan: plan,
    mmPlays: mmPlays,
    mmAbilities: mmAbilities,
    moveDir: moveDir,
    confirm: aiConfirm,
    io: io,
    ctx: ctx
  };
})();
