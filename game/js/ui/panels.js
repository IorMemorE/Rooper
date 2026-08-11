// 側欄面板：資料板 / 手牌 / 已出牌 / 能力面板 / 秘密面板
window.TL = window.TL || {};
TL.UI = TL.UI || {};

TL.UI.Panels = (function () {
  var S = TL.UI.state;

  function renderDataBoard() {
    var st = S.game.state;
    var mod = MODULES[S.game.script.moduleId];
    var incidentDays = {};
    S.game.script.incidents.forEach(function (inc) { incidentDays[inc.day] = inc; });
    var dayCells = "";
    for (var d = 1; d <= S.game.script.days; d++) {
      var inc = incidentDays[d];
      dayCells += '<div class="day-cell' + (d === st.day ? " current" : "") + '"' +
        (inc ? ' title="' + TL.t("editor.dayX", { n: d }) + "：" + TL.escapeHtml(TL.iname(inc.incidentId)) + '"' : "") + ">" +
        d + (inc ? '<div class="inc-mark"></div>' : "") +
        (d === st.day ? '<img class="day-nopin" src="assets/extra/nopin_1.png" alt="">' : "") + "</div>";
    }
    var incidentList = S.game.script.incidents.map(function (inc, idx) {
      var def = INCIDENT_INDEX[inc.incidentId];
      var marks2 = (S.notes && S.notes.culprits[idx]) || [];
      var noteHtml = marks2.length
        ? ' <span class="inc-note">' + TL.t("game.notesSuspects") + marks2.map(function (id) { return TL.cname(id); }).join("、") + "</span>"
        : "";
      return TL.t("editor.dayX", { n: inc.day }) + " <b>" + TL.escapeHtml(TL.iname(inc.incidentId)) + "</b>" + noteHtml;
    }).join("　") || TL.t("editor.none");
    var exHtml = "";
    var modUsesEx = !!(mod && mod.usesEx);
    var exCardCount = Object.keys(st.exCards || {}).filter(function (id) { return !!st.exCards[id]; }).length;
    if (modUsesEx) {
      exHtml = '<div class="drow ex-row"><span>' + TL.term("basic.exGauge", "Ex槽") + '</span>' +
        '<div class="ex-bar"><span class="ex-seg' + (st.exGauge >= 1 ? " on" : "") + '"></span>' +
        '<span class="ex-seg' + (st.exGauge >= 2 ? " on" : "") + '"></span>' +
        '<span class="ex-seg' + (st.exGauge >= 3 ? " on" : "") + '"></span>' +
        '<span class="ex-seg' + (st.exGauge >= 4 ? " on" : "") + '"></span></div>' +
        '<b class="ex-val">' + st.exGauge + "</b></div>" +
        (exCardCount ? '<div class="drow"><span>' + TL.term("basic.exCard", "Ex牌") + '</span><b>' + exCardCount + "</b></div>" : "");
    }
    TL.UI.$("data-board").innerHTML =
      '<div class="drow"><span>' + TL.t("game.dataLoop") + '</span><b>' + st.loop + " / " + S.game.script.loops + "</b></div>" +
      exHtml +
      '<div class="drow"><span>' + TL.t("game.dataDays") + '</span><div class="day-row">' + dayCells + "</div></div>" +
      '<div class="drow"><span>' + TL.t("game.dataIncidents") + '</span></div>' +
      '<div class="incident-list">' + incidentList + "</div>" +
      '<div class="drow"><span>' + TL.t("game.dataTalk") + '</span><b>' + (S.game.script.tableTalk ? TL.t("editor.yes") : TL.t("editor.no")) + "</b></div>" +
      (S.game.script.publicSpecialRules ? '<div class="drow"><span>' + TL.t("game.dataSpecialPublic") + '</span><div class="incident-list">' + TL.escapeHtml(S.game.script.publicSpecialRules) + "</div></div>" : "");
  }

  function renderHand() {
    var st = S.game.state;
    var area = TL.UI.$("hand-area");
    area.innerHTML = "";
    if (S.online) {
      var persp = TL.Net.perspective;
      if (persp === "mm") {
        if (st.phase === "mm_play") area.appendChild(handSection(TL.t("game.mmHand"), "mm", null, null));
        else area.innerHTML = '<div style="color:var(--text-dim);font-size:14px;">' + TL.t("game.handHidden") + "</div>";
      } else {
        var idx = { a: 0, b: 1, c: 2 }[persp];
        if (st.phase === "p_play") {
          var sec = document.createElement("div");
          sec.innerHTML = '<div class="hand-title">' + TL.t("game.pHand", { n: idx + 1, leader: idx === st.leader ? TL.t("game.leaderTag") : "" }) + "</div>";
          var decks = S.game.decksForPlayer(idx);
          decks.forEach(function (deck) {
            sec.appendChild(handSection(TL.t("game.deck") + ["A", "B", "C"][deck], "p", idx, deck));
          });
          area.appendChild(sec);
        } else {
          area.innerHTML = '<div style="color:var(--text-dim);font-size:14px;">' + TL.t("game.handHidden") + "</div>";
        }
      }
      return;
    }
    if (S.aiMode) {
      // 本地 AI 對戰：人類是主人公，不顯示劇作家手牌
      if (st.phase === "p_play") {
        for (var ai = 0; ai < S.game.protagonistCount; ai++) {
          var decksAi = S.game.decksForPlayer(ai);
          if (!decksAi.length) continue;
          var secAi = document.createElement("div");
          secAi.innerHTML = '<div class="hand-title">' + TL.t("game.pHand", { n: ai + 1, leader: ai === st.leader ? TL.t("game.leaderTag") : "" }) + "</div>";
          decksAi.forEach(function (deck) {
            secAi.appendChild(handSection(TL.t("game.deck") + ["A", "B", "C"][deck], "p", ai, deck));
          });
          area.appendChild(secAi);
        }
      } else {
        area.innerHTML = '<div style="color:var(--text-dim);font-size:14px;">' + TL.t("game.handHidden") + "</div>";
      }
      return;
    }
    if (st.phase === "mm_play") {
      area.appendChild(handSection(TL.t("game.mmHand"), "mm", null, null));
    } else if (st.phase === "p_play") {
      for (var i = 0; i < S.game.protagonistCount; i++) {
        var decks = S.game.decksForPlayer(i);
        if (!decks.length) continue;
        var sec = document.createElement("div");
        sec.innerHTML = '<div class="hand-title">' + TL.t("game.pHand", { n: i + 1, leader: i === st.leader ? TL.t("game.leaderTag") : "" }) + "</div>";
        decks.forEach(function (deck) {
          sec.appendChild(handSection(TL.t("game.deck") + ["A", "B", "C"][deck], "p", i, deck));
        });
        area.appendChild(sec);
      }
    } else {
      area.innerHTML = '<div style="color:var(--text-dim);font-size:14px;">' + TL.t("game.handHidden") + "</div>";
    }
  }

  function handSection(title, kind, player, deck) {
    var st = S.game.state;
    var wrap = document.createElement("div");
    var titleEl = document.createElement("div");
    titleEl.className = "hand-title";
    titleEl.textContent = title;
    wrap.appendChild(titleEl);
    var cards = document.createElement("div");
    cards.className = "hand-cards";
    var deckId = kind === "mm" ? "mm" : "p" + deck;
    var cardIds = kind === "mm" ? MASTERMIND_DECK : PROTAGONIST_DECK;
    cardIds.forEach(function (cid) {
      var card = CARD_INDEX[cid];
      var used = !!st.used[deckId][cid];
      var btn = document.createElement("div");
      btn.className = "hand-card" + (used ? " used" : "");
      var imgPath = kind === "mm"
        ? "assets/mastermind_cards/" + card.img
        : "assets/protagonist" + ["A", "B", "C"][deck] + "_cards/" + card.img;
      btn.innerHTML = '<img src="' + imgPath + '" alt=""><div class="hname">' + TL.cardname(cid) +
        (card.oncePerLoop ? TL.t("game.perLoop") : "") + "</div>";
      var active = !used;
      if (kind === "mm") {
        active = active && st.phase === "mm_play" && st.mmPlays.length < 3;
      } else {
        var existing = st.pPlays.filter(function (p) { return p.player === player; });
        active = active && st.phase === "p_play" && existing.length < S.game._playsPerProtagonist(player) &&
          !st.pPlays.some(function (p) { return p.deck === deck; });
      }
      if (active) {
        btn.addEventListener("click", function () {
          if (S.pending && S.pending.kind === kind && S.pending.cardId === cid &&
              (kind === "mm" || (S.pending.player === player && S.pending.deck === deck))) {
            S.pending = null;
          } else {
            S.pending = { kind: kind, cardId: cid, player: player, deck: deck };
          }
          TL.UI.core.render();
        });
      }
      if (S.pending && S.pending.kind === kind && S.pending.cardId === cid &&
          (kind === "mm" || (S.pending.player === player && S.pending.deck === deck))) {
        btn.classList.add("selected");
      }
      cards.appendChild(btn);
    });
    wrap.appendChild(cards);
    return wrap;
  }

  function targetLabel(targetType, targetId) {
    if (targetType === "location") return TL.t("game.pTarget", { loc: TL.lname(targetId) });
    return TL.cname(targetId);
  }

  function renderPlays() {
    var st = S.game.state;
    var box = TL.UI.$("plays-list");
    box.innerHTML = "";
    var items = [];
    var persp = S.online ? TL.Net.perspective : null;
    var perspDeck = persp && persp !== "mm" ? { a: 0, b: 1, c: 2 }[persp] : null;
    var viewerMM = S.online ? persp === "mm" : !S.aiMode;
    var canSee = function (owner, deck) {
      if (owner === "mm") return true; // 蓋牌顯示目標位置，不顯示卡面
      if (!S.online) return true;
      return perspDeck != null && deck === perspDeck;
    };
    var cardLabel = function (p, owner) {
      if (owner === "mm" && !viewerMM && (st.phase === "mm_play" || st.phase === "p_play")) {
        return TL.t("game.faceDown");
      }
      return p.card ? TL.cardname(p.card) : TL.t("game.faceDown");
    };
    st.mmPlays.forEach(function (p, i) {
      items.push({ owner: "mm", deck: null, label: TL.t("game.mmPlayLabel", { card: cardLabel(p, "mm"), target: targetLabel(p.targetType, p.targetId) }), idx: i, key: "mm" + i });
    });
    st.pPlays.forEach(function (p, i) {
      items.push({ owner: "p", deck: p.deck, label: TL.t("game.pPlayLabel", { n: p.player + 1, card: cardLabel(p, "p"), target: targetLabel(p.targetType, p.targetId) }), idx: i, key: "p" + i });
    });
    items = items.filter(function (it) { return canSee(it.owner, it.deck); });
    if (!items.length) {
      box.innerHTML = S.online
        ? '<div style="color:var(--text-dim);font-size:14px;">' + TL.t("game.playsHidden") + "</div>"
        : '<div style="color:var(--text-dim);font-size:14px;">' + TL.t("game.playsNone") + "</div>";
      return;
    }
    items.forEach(function (it) {
      var div = document.createElement("div");
      div.className = "play-item";
      var canRemove = (it.owner === "mm" && st.phase === "mm_play" && !S.aiMode) || (it.owner === "p" && st.phase === "p_play");
      div.innerHTML = '<span' + (canRemove ? "" : ' style="opacity:.85"') + ">" + TL.escapeHtml(it.label) + "</span>" +
        (canRemove ? "<button class='tl-btn' style='padding:2px 8px;font-size:15px;'>" + TL.t("editor.remove") + "</button>" : "");
      if (canRemove) {
        div.querySelector("button").addEventListener("click", function () {
          if (S.online) {
            TL.UI.core.netAction(it.owner === "mm" ? "mmRemovePlay" : "pRemovePlay", { idx: it.idx });
          } else if (it.owner === "mm") {
            S.game.mmRemovePlay(it.idx);
          } else {
            S.game.pRemovePlay(it.idx);
          }
          TL.UI.core.render();
        });
      } else {
        div.title = TL.t("game.cannotRemove");
      }
      box.appendChild(div);
    });
  }

  function abilityKey(entry) {
    return (entry.charId || "plot") + "|" + entry.ability.effect;
  }

  function hintDiv(text) {
    var d = document.createElement("div");
    d.style.cssText = "color:var(--text-dim);font-size:15px;margin-top:8px;line-height:1.6;";
    d.textContent = text;
    return d;
  }

  function renderAbilityPanel() {
    var box = TL.UI.$("ability-panel");
    if (!box) return;
    var st = S.game.state;
    box.innerHTML = "";
    if (st.phase === "mm_abilities") {
      if (S.aiMode) {
        box.innerHTML = '<div style="color:var(--text-dim);">' + TL.t("game.aiThinking") + "</div>";
        return;
      }
      var all = S.game.mmAbilities();
      var usable = {};
      S.game.usableMMAbilities().forEach(function (a) { usable[abilityKey(a)] = true; });
      if (!all.length) {
        box.innerHTML = '<div style="color:var(--text-dim);">' + TL.t("game.abilityNone") + "</div>";
        return;
      }
      var wrap = document.createElement("div");
      wrap.className = "ability-panel";
      all.forEach(function (a) {
        var who = a.charId
          ? TL.cname(a.charId) + "（" + (st.chars[a.charId].role ? TL.rname(st.chars[a.charId].role) : "") + "）"
          : TL.t("game.subplotAbility");
        var isSel = S.pendingAbility && S.pendingAbility.kind === "mm" && S.pendingAbility.entry === a;
        var btn = document.createElement("button");
        btn.className = "ability-btn" + (usable[abilityKey(a)] ? " usable" : " dim") + (isSel ? " selected" : "");
        btn.textContent = who + "：" + a.ability.desc;
        if (usable[abilityKey(a)]) {
          btn.addEventListener("click", function () { beginAbility("mm", a); });
        } else {
          btn.title = TL.t("game.abilityUnusable");
        }
        wrap.appendChild(btn);
      });
      box.appendChild(wrap);
      box.appendChild(hintDiv(TL.t("game.abilityHint")));
    } else if (st.phase === "goodwill") {
      var list = S.game.goodwillPanel();
      if (!list.length) {
        box.innerHTML = '<div style="color:var(--text-dim);">' + TL.t("game.gwNone") + "</div>";
        return;
      }
      var wrap2 = document.createElement("div");
      wrap2.className = "ability-panel";
      list.forEach(function (g) {
        var isSel = S.pendingAbility && S.pendingAbility.kind === "gw" &&
          S.pendingAbility.entry.charId === g.charId && S.pendingAbility.entry.abilityIdx === g.abilityIdx;
        var btn = document.createElement("button");
        btn.className = "ability-btn" + (g.usable ? " usable" : " dim") + (isSel ? " selected" : "");
        btn.textContent = TL.t("editor.gwCost", { n: g.ability.cost }) + " " + TL.cname(g.charId) + "：" + g.ability.desc;
        if (g.usable) {
          btn.addEventListener("click", function () {
            beginAbility("gw", { charId: g.charId, abilityIdx: g.abilityIdx, ability: g.ability });
          });
        } else {
          btn.title = TL.t("game.gwUnusable");
        }
        wrap2.appendChild(btn);
      });
      box.appendChild(wrap2);
      box.appendChild(hintDiv(TL.t("game.abilityHint")));
    } else {
      box.innerHTML = '<div style="color:var(--text-dim);">' + TL.t("game.abilityWait") + "</div>";
    }
  }

  function beginAbility(kind, entry) {
    if (S.animBusy) {
      TL.UI.toast(TL.t("game.animBusy"), "info");
      return;
    }
    var st = S.game.state;
    var same = S.pendingAbility && S.pendingAbility.kind === kind &&
      (kind === "mm"
        ? S.pendingAbility.entry === entry
        : S.pendingAbility.entry.charId === entry.charId && S.pendingAbility.entry.abilityIdx === entry.abilityIdx);
    if (same) {
      S.pendingAbility = null; // 再點一次取消
      TL.UI.core.render();
      return;
    }
    S.pendingAbility = { kind: kind, entry: entry };
    S.pendingAbility.targets = kind === "mm" ? S.game.mmAbilityTargets(entry) : S.game.goodwillTargets(entry);
    TL.UI.core.render();
    if (!S.pendingAbility.targets.length) {
      confirmAbility(null); // 無需選單一目標的能力直接二次確認
    }
  }

  function confirmAbility(target) {
    var pa = S.pendingAbility;
    if (!pa) return;
    var st = S.game.state;
    var who = "";
    if (pa.kind === "mm") {
      who = pa.entry.charId
        ? TL.cname(pa.entry.charId) + "（" + (st.chars[pa.entry.charId].role ? TL.rname(st.chars[pa.entry.charId].role) : "") + "）"
        : TL.t("game.subplotAbility");
    } else {
      who = TL.cname(pa.entry.charId);
    }
    var text = TL.t("game.confirmAbilityText", {
      who: who,
      desc: pa.entry.ability.desc,
      target: target ? TL.t("game.targetRow", { label: target.label }) : ""
    });
    TL.UI.confirm({ title: TL.t("game.confirmAbility"), text: text, okText: TL.t("game.confirmUse"), cancelText: TL.t("common.cancel") }).then(async function (yes) {
      if (!yes) {
        S.pendingAbility = null;
        TL.UI.core.render();
        return;
      }
      if (S.online) {
        if (pa.kind === "mm") {
          TL.UI.core.netAction("execMMAbility", { entry: pa.entry, target: target || null });
        } else {
          TL.UI.core.netAction("execGoodwill", { chosen: pa.entry, target: target || null });
        }
        S.pendingAbility = null;
        TL.UI.core.render();
        return;
      }
      if (pa.kind === "mm") {
        await S.game.execMMAbility(pa.entry, target || null);
      } else {
        await S.game.execGoodwill(pa.entry, "p" + st.leader, target || null);
      }
      S.pendingAbility = null;
      S.animBusy = true;
      try {
        TL.UI.core.render();
        await TL.UI.Anim.playFeed();
      } finally {
        S.animBusy = false;
      }
      TL.UI.core.render();
    });
  }

  function handleAbilityTarget(targetType, targetId) {
    var pa = S.pendingAbility;
    if (!pa) return false;
    var st = S.game.state;
    if (st.phase !== "mm_abilities" && st.phase !== "goodwill") return false;
    var t = null;
    (pa.targets || []).forEach(function (x) { if (x.type === targetType && x.id === targetId) t = x; });
    if (!t) {
      TL.UI.toast(TL.t("game.badTarget"), "error");
      return true;
    }
    confirmAbility(t);
    return true;
  }

  function renderSecret() {
    var panel = TL.UI.$("secret-panel");
    if (S.online && TL.Net.perspective !== "mm") { panel.style.display = "none"; return; }
    if (!S.secretOn) { panel.style.display = "none"; return; }
    panel.style.display = "";
    var st = S.game.state;
    var main = PLOT_INDEX[S.game.script.mainPlot];
    var roleLines = S.game.script.cast.map(function (e) {
      return TL.cname(e.characterId) + " → " + (e.role ? TL.rname(e.role) : TL.t("game.commoner"));
    }).join("<br>");
    var culLines = S.game.script.incidents.map(function (inc) {
      var def = INCIDENT_INDEX[inc.incidentId];
      return TL.t("editor.dayX", { n: inc.day }) + " " + TL.iname(inc.incidentId) + " → " + TL.cname(inc.culpritId);
    }).join("<br>");
    panel.innerHTML = "<h4>" + TL.t("game.secretInfo") + "</h4>" +
      "<div>" + TL.t("game.mainRow") + (main ? TL.pname(main.id) : "—") + "</div>" +
      "<div>" + TL.t("game.subRow") + S.game.script.subplots.map(function (sid) { return TL.pname(sid); }).join("、") + "</div>" +
      (S.game.script.specialRules ? "<div style='margin-top:6px;'>" + TL.t("game.secretSpecial") + "<br>" + TL.escapeHtml(S.game.script.specialRules) + "</div>" : "") +
      (S.game.script.publicSpecialRules ? "<div style='margin-top:6px;'>" + TL.t("game.dataSpecialPublic") + "<br>" + TL.escapeHtml(S.game.script.publicSpecialRules) + "</div>" : "") +
      "<div style='margin-top:6px;'>" + TL.t("game.roleAssign") + "<br>" + roleLines + "</div>" +
      "<div style='margin-top:6px;'>" + TL.t("game.culpritRow") + "<br>" + culLines + "</div>";
  }

  return {
    renderDataBoard: renderDataBoard,
    renderHand: renderHand,
    renderPlays: renderPlays,
    renderAbilityPanel: renderAbilityPanel,
    renderSecret: renderSecret,
    handleAbilityTarget: handleAbilityTarget
  };
})();
