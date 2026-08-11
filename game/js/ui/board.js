// 盤面渲染：版圖 / 角色棋子 / 目標點擊 / 角色卡大圖與懸停
window.TL = window.TL || {};
TL.UI = TL.UI || {};

TL.UI.Board = (function () {
  var S = TL.UI.state;

  function playCardHtml(pl, faceUp, omitTag) {
    var ownerCls = pl.owner === "mm" ? "mm" : "p";
    var tag = omitTag ? "" :
      '<span class="card-target">' + TL.escapeHtml(pl.targetType === "location" ? TL.t("game.locationTag") : TL.cname(pl.targetId)) + "</span>";
    if (faceUp) {
      var card = CARD_INDEX[pl.card];
      if (!card) {
        return '<span class="card-wrap"><div class="face-up unknown ' + ownerCls + '">?</div>' + tag + "</span>";
      }
      var imgSrc = pl.owner === "mm"
        ? "assets/mastermind_cards/" + card.img
        : "assets/protagonist" + ["A", "B", "C"][pl.deck] + "_cards/" + card.img;
      return '<span class="card-wrap"><img class="face-up ' + ownerCls + '" src="' + imgSrc + '" title="' +
        TL.escapeHtml(TL.cardname(pl.card)) + '" alt="">' + tag + "</span>";
    }
    var backSrc = pl.owner === "mm"
      ? "assets/mastermind_cards/back.png"
      : "assets/protagonist" + ["A", "B", "C"][pl.deck] + "_cards/back.png";
    return '<span class="card-wrap"><img class="face-down ' + ownerCls + '" src="' + backSrc + '" alt="">' + tag + "</span>";
  }

  function renderBoard() {
    var board = TL.UI.$("board");
    var st = S.game.state;
    board.innerHTML = "";
    var faceUp = S.revealMode || !!S.resolvePlays;
    var mmList = S.resolvePlays ? S.resolvePlays.mm : st.mmPlays;
    var pList = S.resolvePlays ? S.resolvePlays.p : st.pPlays;
    LOCATIONS.forEach(function (loc) {
      if (loc.offBoard) return;
      var panel = document.createElement("div");
      panel.className = "location-panel";
      panel.dataset.loc = loc.id;
      var chars = Object.keys(st.chars).filter(function (id) {
        return st.chars[id].loc === loc.id && st.chars[id].onStage !== false;
      });
      var intrigue = st.locations[loc.id].intrigue;
      var playsOn = [];
      mmList.map(function (p) { return { owner: "mm", card: p.card, targetType: p.targetType, targetId: p.targetId }; })
        .concat(pList.map(function (p) { return { owner: "p", deck: p.deck, card: p.card, targetType: p.targetType, targetId: p.targetId }; }))
        .forEach(function (pl) {
          if ((pl.targetType === "location" && pl.targetId === loc.id) ||
              (pl.targetType === "char" && st.chars[pl.targetId] && st.chars[pl.targetId].loc === loc.id)) {
            playsOn.push(pl);
          }
        });
      // 結算覆蓋期間：地點牌留在版圖卡槽，角色牌掛在棋子身上跟著移動
      var panelPlays = playsOn.filter(function (pl) { return pl.targetType === "location" || !S.resolvePlays; });
      var cardSlots = panelPlays.map(function (pl) { return playCardHtml(pl, faceUp, false); }).join("");
      var turfHtml = S.game.script.turf === loc.id
        ? '<div class="turf-mark"><img src="assets/token/turf.png" alt=""><span>' + TL.t("game.turfTag") + "</span></div>"
        : "";
      panel.innerHTML = '<img class="loc-bg" src="assets/board/' + loc.id + '.png" alt="">' +
        '<div class="loc-name">' + TL.lname(loc.id) + "</div>" +
        '<div class="loc-intrigue">' + TL.t("game.intrigueAt", { n: intrigue }) + "</div>" +
        turfHtml +
        '<div class="chars-area"></div>' +
        (cardSlots ? '<div class="cards-slot">' + cardSlots + "</div>" : "");
      var charsArea = panel.querySelector(".chars-area");
      chars.forEach(function (cid) {
        var charCards = S.resolvePlays
          ? playsOn.filter(function (pl) { return pl.targetType === "char" && pl.targetId === cid; })
          : [];
        charsArea.appendChild(makeCharToken(cid, charCards, faceUp));
      });
      var targetable = isTargetable("location", loc.id);
      if (targetable) panel.classList.add("targetable");
      if (S.online && TL.Net.perspective === "mm" && S.game.state.mmManual) {
        panel.classList.add("mm-editable");
        panel.addEventListener("click", function () { TL.UI.Panels.openMMLocEditor(loc.id); });
      } else {
        panel.addEventListener("click", function () { onTargetClick("location", loc.id); });
      }
      board.appendChild(panel);
    });
  }

  function makeCharToken(cid, charCards, faceUp) {
    var st = S.game.state;
    var c = st.chars[cid];
    var data = CHAR_INDEX[cid];
    var role = c.role ? ROLE_INDEX[c.role] : null;
    var img = c.alive ? "chara_stand" : "chara_dead";
    var imgClass = c.alive ? "stand" : "dead";
    var counters = "";
    if (c.goodwill > 0) counters += '<div class="counter gw"><img src="assets/token/goodwill.png" alt="' + TL.t("game.counter.goodwill") + '"><span>' + c.goodwill + "</span></div>";
    if (c.paranoia > 0) counters += '<div class="counter pa"><img src="assets/token/paranoia.png" alt="' + TL.t("game.counter.paranoia") + '"><span>' + c.paranoia + "</span></div>";
    if (c.intrigue > 0) counters += '<div class="counter in"><img src="assets/token/intrigue.png" alt="' + TL.t("game.counter.intrigue") + '"><span>' + c.intrigue + "</span></div>";
    if (c.guard > 0) counters += '<div class="counter guard"><img src="assets/token/guard.png" alt="' + TL.t("game.counter.guard") + '"><span>' + c.guard + "</span></div>";
    if (st.exCards && st.exCards[cid]) counters += '<div class="counter ex" title="' + TL.term("basic.exCard", "Ex牌") + '">Ex</div>';
    var roleBadge = "";
    if (role && (c.roleRevealed || S.secretOn)) {
      var shownRole = (!S.secretOn && c.revealedRole && ROLE_INDEX[c.revealedRole]) ? ROLE_INDEX[c.revealedRole] : role;
      roleBadge = '<div class="role-badge' + (c.roleRevealed ? " revealed" : "") + '">' + TL.escapeHtml(TL.rname(shownRole.id)) + "</div>";
    } else if (c.sameRoleRevealed) {
      roleBadge = '<div class="role-badge same">' + TL.t("game.sameRole") + "</div>";
    }
    var tokenCards = "";
    if (charCards && charCards.length) {
      tokenCards = '<div class="token-cards">' + charCards.map(function (pl) {
        return playCardHtml(pl, faceUp, true);
      }).join("") + "</div>";
    }
    var noteRoles = (S.notes && S.notes.roles[cid]) || [];
    var noteHtml = "";
    if (noteRoles.length) {
      var shownRoles = noteRoles.slice(0, 2).map(function (rid) { return TL.rname(rid); }).join("、");
      noteHtml = '<div class="token-note" title="' + TL.escapeHtml(noteRoles.map(function (rid) { return TL.rname(rid); }).join("、")) + '">' +
        "？" + TL.escapeHtml(shownRoles) + (noteRoles.length > 2 ? " +" + (noteRoles.length - 2) : "") + "</div>";
    } else if (S.notes && S.notes.memos && S.notes.memos[cid]) {
      noteHtml = '<div class="token-note memo" title="' + TL.escapeHtml(S.notes.memos[cid]) + '">📝</div>';
    }
    var token = document.createElement("div");
    token.className = "char-token";
    token.dataset.cid = cid;
    token.innerHTML = '<img class="' + imgClass + '" src="assets/' + img + "/" + encodeURIComponent(cid) + '.png" alt="">' +
      '<div class="cname">' + TL.escapeHtml(TL.cname(cid)) + (c.alive ? "" : TL.t("game.died")) + "</div>" +
      (counters ? '<div class="counters">' + counters + "</div>" : "") +
      '<div class="paranoia-limit">' + TL.t("game.limitShort") + data.paranoiaLimit + "</div>" + roleBadge +
      tokenCards + noteHtml;
    if (isTargetable("char", cid)) token.classList.add("targetable");
    // 長按（或右鍵）查看角色卡大圖
    var pressTimer = null;
    token.addEventListener("pointerdown", function (e) {
      if (e.button !== undefined && e.button !== 0) return;
      S.suppressClick = false;
      pressTimer = setTimeout(function () {
        pressTimer = null;
        S.suppressClick = true;
        showCharCard(cid);
      }, 550);
    });
    token.addEventListener("pointerup", function () {
      if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
    });
    token.addEventListener("pointerleave", function () {
      if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
    });
    // 滑鼠懸停稍作停留 → 顯示卡牌大圖（僅限具備 hover 的裝置）
    var hoverSupported = window.matchMedia && window.matchMedia("(hover: hover)").matches;
    if (hoverSupported) {
      token.addEventListener("pointerenter", function () {
        clearTimeout(S.hoverTimer);
        S.hoverTimer = setTimeout(function () { showHoverCard(cid, token); }, 420);
      });
      token.addEventListener("pointerleave", function () {
        clearTimeout(S.hoverTimer);
        hideHoverCard();
      });
    }
    token.addEventListener("contextmenu", function (e) {
      e.preventDefault();
      e.stopPropagation();
      hideHoverCard();
      showCharCard(cid);
      return false;
    });
    token.addEventListener("click", function (e) {
      e.stopPropagation(); // 避免冒泡到版圖面板重複觸發目標選擇
      if (S.suppressClick) { S.suppressClick = false; return; }
      // 聯機劇作家手動模式：點擊角色直接開啟編輯面板
      if (S.online && TL.Net.perspective === "mm" && S.game.state.mmManual) {
        TL.UI.Panels.openMMCharEditor(cid);
        return;
      }
      onTargetClick("char", cid);
    });
    return token;
  }

  function isTargetable(targetType, targetId) {
    var st = S.game.state;
    if (S.pendingAbility && (st.phase === "mm_abilities" || st.phase === "goodwill")) {
      return (S.pendingAbility.targets || []).some(function (t) { return t.type === targetType && t.id === targetId; });
    }
    if (!S.pending) return false;
    if (st.phase !== "mm_play" && st.phase !== "p_play") return false;
    if (S.pending.kind === "mm" && st.phase === "mm_play") return true;
    if (S.pending.kind === "p" && st.phase === "p_play") {
      var conflict = st.pPlays.some(function (p) { return p.targetType === targetType && p.targetId === targetId; });
      return !conflict;
    }
    return false;
  }

  function onTargetClick(targetType, targetId) {
    if (TL.UI.Panels.handleAbilityTarget(targetType, targetId)) return;
    if (!S.pending) return;
    var st = S.game.state;
    var res;
    if (S.pending.kind === "mm") {
      if (TL.UI.core.netAction("mmPlayCard", { card: S.pending.cardId, targetType: targetType, targetId: targetId })) {
        S.pending = null;
        TL.UI.core.render();
        return;
      }
      res = S.game.mmPlayCard(S.pending.cardId, targetType, targetId);
    } else {
      if (TL.UI.core.netAction("pPlayCard", { deck: S.pending.deck, card: S.pending.cardId, targetType: targetType, targetId: targetId })) {
        S.pending = null;
        TL.UI.core.render();
        return;
      }
      res = S.game.pPlayCard(S.pending.player, S.pending.deck, S.pending.cardId, targetType, targetId);
    }
    if (res && res.ok) {
      S.pending = null;
      TL.UI.core.render();
    } else if (res) {
      TL.UI.toast(res.msg, "error");
    }
  }

  function hideHoverCard() {
    clearTimeout(S.hoverTimer);
    if (S.hoverCard) {
      if (S.hoverCard.parentNode) S.hoverCard.parentNode.removeChild(S.hoverCard);
      S.hoverCard = null;
    }
  }

  function showHoverCard(cid, token) {
    var st = S.game.state;
    var c = st.chars[cid];
    var data = CHAR_INDEX[cid];
    if (!c || !data) return;
    hideHoverCard();
    var role = c.role ? ROLE_INDEX[c.role] : null;
    var card = document.createElement("div");
    card.className = "char-hover-card";
    var markers = "";
    if (c.goodwill > 0) markers += '<span class="mk gw">' + TL.t("game.counter.goodwill") + " " + c.goodwill + "</span>";
    if (c.paranoia > 0) markers += '<span class="mk pa">' + TL.t("game.counter.paranoia") + " " + c.paranoia + "</span>";
    if (c.intrigue > 0) markers += '<span class="mk in">' + TL.t("game.counter.intrigue") + " " + c.intrigue + "</span>";
    if (c.guard > 0) markers += '<span class="mk guard">' + TL.t("game.counter.guard") + " " + c.guard + "</span>";
    if (st.exCards && st.exCards[cid]) markers += '<span class="mk ex">' + TL.term("basic.exCard", "Ex牌") + "</span>";
    card.innerHTML =
      '<img src="assets/chara_live/' + encodeURIComponent(cid) + '.png" alt="">' +
      '<div class="hc-info">' +
      '<div class="hc-name">' + TL.escapeHtml(TL.cname(cid)) +
      (c.alive ? "" : TL.t("game.died")) + "</div>" +
      '<div class="hc-meta">' + TL.t("game.paranoiaLimit") + " " + data.paranoiaLimit +
      (data.traits.length ? "　" + TL.t("game.traits") + " " + TL.escapeHtml(TL.traitsName(data.traits).join("、")) : "") + "</div>" +
      (role && (c.roleRevealed || S.secretOn) ?
        '<div class="hc-role">' + TL.t("game.role") + "：" +
        TL.rname((!S.secretOn && c.revealedRole && ROLE_INDEX[c.revealedRole]) ? c.revealedRole : role.id) + "</div>" : "") +
      (markers ? '<div class="hc-mks">' + markers + "</div>" : "") +
      (data.desc ? '<div class="hc-desc">' + TL.escapeHtml(TL.desc("chardesc." + cid, data.desc)) + "</div>" : "") +
      "</div>";
    document.body.appendChild(card);
    S.hoverCard = card;
    // 定位：預設放在棋子右側，靠近視窗邊緣時翻到左側
    var r = token.getBoundingClientRect();
    var cw = card.offsetWidth;
    var left = r.right + 12;
    if (left + cw > window.innerWidth - 8) left = Math.max(8, r.left - cw - 12);
    card.style.left = left + "px";
    card.style.top = Math.max(8, Math.min(window.innerHeight - card.offsetHeight - 8, r.top - 40)) + "px";
  }

  function showCharCard(cid) {
    hideHoverCard();
    var st = S.game.state;
    var c = st.chars[cid];
    if (!c) return;
    var data = CHAR_INDEX[cid];
    var role = c.role ? ROLE_INDEX[c.role] : null;
    var abHtml = (data.goodwill || []).map(function (ab, gi) {
      return '<div class="ab">' + TL.t("editor.gwCost", { n: ab.cost }) + (ab.oncePerLoop ? TL.t("editor.perLoopOnce") : "") +
        (ab.cannotBeRefused ? TL.t("editor.cannotRefuse") : "") +
        (ab.locRestriction ? TL.t("editor.restriction", { list: ab.locRestriction.map(function (l) { return TL.lname(l); }).join("、") }) : "") +
        " " + TL.escapeHtml(TL.desc("char." + cid + "." + gi, ab.desc)) + "</div>";
    }).join("");
    if (!abHtml) abHtml = '<div class="ab" style="color:#c9b56a;">' + TL.t("game.noGw") + "</div>";
    var spHtml = (data.specials || []).map(function (s, si) {
      return '<div class="ab">' + TL.escapeHtml(TL.desc("char." + cid + ".special." + si, s)) + "</div>";
    }).join("");
    var mk = function (img, label, count, cls) {
      return '<span class="mk ' + cls + '"><img src="assets/token/' + img + '.png" alt=""><b>' + count + "</b> " + label + "</span>";
    };
    var markersHtml = "";
    if (c.goodwill > 0) markersHtml += mk("goodwill", TL.t("game.counter.goodwill"), c.goodwill, "gw");
    if (c.intrigue > 0) markersHtml += mk("intrigue", TL.t("game.counter.intrigue"), c.intrigue, "in");
    if (c.guard > 0) markersHtml += mk("guard", TL.t("game.counter.guard"), c.guard, "guard");
    if (st.exCards && st.exCards[cid]) markersHtml += '<span class="mk ex">' + TL.term("basic.exCard", "Ex牌") + "</span>";
    var panicPct = data.paranoiaLimit > 0 ? Math.min(100, Math.round(c.paranoia / data.paranoiaLimit * 100)) : 0;
    var status =
      '<div class="status-block">' +
      '<div class="status-row"><span>' + TL.t("game.atLoc") + '</span><b>' + TL.lname(c.loc) + "</b>" +
      "<span>" + TL.t("game.status") + "</span><b class='" + (c.alive ? "alive" : "dead") + "'>" + (c.alive ? TL.t("game.alive") : TL.t("game.dead")) + "</b></div>" +
      '<div class="status-row"><span>' + TL.t("game.counter.paranoia") + '</span><b>' + c.paranoia + " / " + data.paranoiaLimit + "</b>" +
      '<div class="pbar"><div class="pfill" style="width:' + panicPct + '%"></div></div>' +
      (c.paranoia > 0 ? mk("paranoia", TL.t("game.counter.paranoia"), c.paranoia, "pa") : "") + "</div>" +
      '<div class="status-note">' + TL.t("game.paranoiaHint") + "</div>" +
      (markersHtml ? '<div class="status-row"><span>' + TL.t("game.markers") + '</span><div class="mks">' + markersHtml + "</div></div>" : "") +
      (role && (c.roleRevealed || S.secretOn) ?
        '<div class="status-row"><span>' + TL.t("game.role") + '</span><b class="role">' +
        TL.rname((!S.secretOn && c.revealedRole && ROLE_INDEX[c.revealedRole]) ? c.revealedRole : role.id) + "</b></div>" : "") +
      "</div>";
    TL.UI.modal({
      title: TL.cname(cid) + (c.alive ? "" : TL.t("game.died")),
      buttons: [{ label: TL.t("common.close"), value: "close", primary: true }],
      body: function (el) {
        el.innerHTML = '<div class="char-card-pop">' +
          '<img src="assets/chara_live/' + encodeURIComponent(cid) + '.png" alt="">' +
          '<div class="info">' +
          '<div>' + TL.t("game.paranoiaLimit") + " <b>" + data.paranoiaLimit + "</b>" +
          (data.traits.length ? "　" + TL.t("game.traits") + " " + TL.escapeHtml(TL.traitsName(data.traits).join("、")) : "") +
          (data.forbidden.length ? '　<small style="color:#ff9ba3;">' + TL.t("game.forbidden") + data.forbidden.map(function (l) { return TL.lname(l); }).join("、") + "</small>" : "") +
          "</div>" +
          '<div style="color:var(--text-dim);font-size:14px;margin-top:4px;">' + TL.escapeHtml(TL.desc("chardesc." + cid, data.desc)) + "</div>" +
          (spHtml ? '<div style="margin-top:6px;color:var(--accent);">' + TL.t("game.specials") + "</div>" + spHtml : "") +
          '<div style="margin-top:6px;color:var(--accent);">' + TL.t("game.goodwillAb") + "</div>" + abHtml +
          '<div style="margin-top:10px;color:var(--accent);">' + TL.t("game.now") + "</div>" + status +
          "</div></div>";
      }
    });
  }

  return {
    renderBoard: renderBoard,
    makeCharToken: makeCharToken,
    isTargetable: isTargetable,
    onTargetClick: onTargetClick,
    playCardHtml: playCardHtml,
    hideHoverCard: hideHoverCard,
    showHoverCard: showHoverCard,
    showCharCard: showCharCard
  };
})();
