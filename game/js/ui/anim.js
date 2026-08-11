// 結算動畫：翻牌 → 移動（附著牌跟隨）→ 撤移動牌 → 剩餘牌結算
window.TL = window.TL || {};
TL.UI = TL.UI || {};

TL.UI.Anim = (function () {
  var S = TL.UI.state;

  function captureTokenRects() {
    S.tokenRects = {};
    document.querySelectorAll(".char-token").forEach(function (t) {
      if (t.dataset.cid) S.tokenRects[t.dataset.cid] = t.getBoundingClientRect();
    });
  }

  function findToken(cid) {
    var found = null;
    document.querySelectorAll(".char-token").forEach(function (t) {
      if (t.dataset.cid === cid) found = t;
    });
    return found;
  }

  function playFeed(snap, preLogLen) {
    var st = S.game.state;
    var delay = Math.round(520 * (S.SPEED[S.settings.speed] || 1));
    function step() {
      if (S.feedCursor >= st.feed.length) {
        S.logReveal = null;
        TL.UI.Log.renderLog();
        S.tokenRects = {};
        document.body.classList.remove("tl-anim");
        return Promise.resolve();
      }
      var ev = st.feed[S.feedCursor++];
      handleEvent(ev);
      S.logReveal = Math.min(st.log.length, (preLogLen || 0) + S.feedCursor + 1);
      TL.UI.Log.renderLog();
      return TL.UI.sleep(delay).then(step);
    }
    if (!S.settings.anim) {
      S.feedCursor = st.feed.length;
      S.resolvePlays = null;
      TL.UI.core.render();
      S.logReveal = null;
      TL.UI.Log.renderLog();
      return Promise.resolve();
    }
    if (snap) return stagedResolve(snap, preLogLen, delay);
    return step();
  }

  function handleEvent(ev) {
    if (ev.type === "move") {
      document.body.classList.add("tl-anim");
      animateMove(ev);
    } else if (ev.type === "marker") {
      animateMarker(ev);
    } else if (ev.type === "loc_marker") {
      animateLocMarker(ev);
    } else if (ev.type === "death") {
      pulseToken(ev.id, "hit-death");
    } else if (ev.type === "resurrect") {
      pulseToken(ev.id, "hit-resurrect");
    } else if (ev.type === "ex_gauge") {
      TL.UI.Panels.renderDataBoard();
      var exEl = TL.UI.$("data-board").querySelector(".ex-bar");
      if (exEl) { exEl.classList.remove("hit-marker"); void exEl.offsetWidth; exEl.classList.add("hit-marker"); }
    } else if (ev.type === "ex_card") {
      pulseToken(ev.id, "hit-marker");
    }
  }

  // 結算動畫分階段：翻開 → 移動（附著牌跟隨）→ 撤移動牌 → 結算剩餘牌 → 撤剩餘牌
  function stagedResolve(snap, preLogLen, delay) {
    var st = S.game.state;
    function isMoveCard(card) {
      return card === "m_move_h" || card === "m_move_v" || card === "m_move_d" ||
        card === "p_move_h" || card === "p_move_v";
    }
    function advanceLog() {
      S.logReveal = Math.min(st.log.length, (preLogLen || 0) + S.feedCursor + 1);
      TL.UI.Log.renderLog();
    }
    function stepRest() {
      if (S.feedCursor >= st.feed.length) {
        // 撤掉剩餘牌
        S.resolvePlays = null;
        TL.UI.core.render();
        S.logReveal = null;
        TL.UI.Log.renderLog();
        S.tokenRects = {};
        document.body.classList.remove("tl-anim");
        return Promise.resolve();
      }
      handleEvent(st.feed[S.feedCursor++]);
      advanceLog();
      return TL.UI.sleep(delay).then(stepRest);
    }
    async function run() {
      // 階段2：移動（角色牌掛在棋子身上，隨移動跟過去）
      document.body.classList.add("tl-anim");
      while (S.feedCursor < st.feed.length && st.feed[S.feedCursor].type === "move") {
        handleEvent(st.feed[S.feedCursor++]);
        advanceLog();
        await TL.UI.sleep(delay);
      }
      await TL.UI.sleep(delay); // 移動後停頓
      // 階段3：撤掉移動牌
      S.resolvePlays = {
        mm: snap.mm.filter(function (p) { return !isMoveCard(p.card); }),
        p: snap.p.filter(function (p) { return !isMoveCard(p.card); })
      };
      TL.UI.core.render();
      await TL.UI.sleep(Math.round(delay * 0.8));
      // 階段4：其餘牌結算
      await stepRest();
    }
    return run();
  }

  function animateMove(ev) {
    var el = findToken(ev.id);
    var old = S.tokenRects[ev.id];
    if (!el || !old) return;
    var r = el.getBoundingClientRect();
    var dx = old.left - r.left, dy = old.top - r.top;
    if (!dx && !dy) { pulseToken(ev.id, "hit-move"); return; }
    var dur = Math.round(480 * (S.SPEED[S.settings.speed] || 1));
    el.style.transition = "none";
    el.style.transform = "translate(" + dx + "px," + dy + "px)";
    void el.offsetWidth;
    el.style.transition = "transform " + dur + "ms cubic-bezier(.22,.8,.3,1)";
    el.style.transform = "";
    setTimeout(function () {
      el.style.transition = "";
      el.style.transform = "";
    }, dur + 80);
  }

  function pulseToken(cid, cls) {
    var el = findToken(cid);
    if (!el) return;
    el.classList.remove("hit-move", "hit-death", "hit-resurrect", "hit-marker");
    void el.offsetWidth;
    el.classList.add(cls);
    setTimeout(function () { el.classList.remove(cls); }, 760);
  }

  function floatChip(el, kind, delta, isLoc) {
    var labels = {
      goodwill: TL.t("game.counter.goodwill"),
      paranoia: TL.t("game.counter.paranoia"),
      intrigue: TL.t("game.counter.intrigue"),
      guard: TL.t("game.counter.guard"),
      hope: TL.t("game.counter.hope"),
      despair: TL.t("game.counter.despair")
    };
    var imgs = { goodwill: "goodwill", paranoia: "paranoia", intrigue: "intrigue", guard: "guard" };
    var chip = document.createElement("span");
    chip.className = "float-chip " + (delta > 0 ? "up" : "down") + (isLoc ? " loc" : "");
    chip.innerHTML = '<img src="assets/token/' + imgs[kind] + '.png" alt=""><b>' +
      (delta > 0 ? "+" + delta : delta) + " " + labels[kind] + "</b>";
    el.appendChild(chip);
    setTimeout(function () { if (chip.parentNode) chip.parentNode.removeChild(chip); }, 1150);
  }

  function animateMarker(ev) {
    var el = findToken(ev.id);
    if (!el) return;
    pulseToken(ev.id, "hit-marker");
    floatChip(el, ev.kind, ev.delta, false);
  }

  function animateLocMarker(ev) {
    var panel = null;
    document.querySelectorAll(".location-panel").forEach(function (p) {
      if (p.dataset.loc === ev.id) panel = p;
    });
    if (!panel) return;
    panel.classList.remove("hit-marker");
    void panel.offsetWidth;
    panel.classList.add("hit-marker");
    setTimeout(function () { panel.classList.remove("hit-marker"); }, 760);
    floatChip(panel, ev.kind, ev.delta, true);
  }

  return {
    captureTokenRects: captureTokenRects,
    playFeed: playFeed
  };
})();
