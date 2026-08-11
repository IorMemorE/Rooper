// 遊戲界面入口：初始化 / 設定 / 聯機 / 階段按鈕 / 渲染調度
// 渲染與動畫已拆分至 board / panels / log / anim / notes 模組
(function () {
  var S = TL.UI.state;
  TL.UI.loadSettings();

  function netAction(name, payload) {
    if (S.online) {
      TL.Net.action(name, payload || {});
      return true;
    }
    return false;
  }

  function loadScript() {
    var raw = localStorage.getItem("tl_current_script");
    if (raw) {
      try {
        var obj = JSON.parse(raw);
        if (obj && obj.moduleId && obj.cast) return obj;
      } catch (e) { /* ignore */ }
    }
    var q = new URLSearchParams(location.search);
    var modId = q.get("script") === "btx" ? "BTX" : "FS";
    return TL.defaultScript(modId);
  }

  function showSetup(script) {
    var modal = TL.UI.$("setup-modal");
    modal.innerHTML = "<div class='tl-modal-title'>" + TL.t("game.setupTitle") + "</div>" +
      "<div class='tl-modal-text'>" + TL.t("game.setupScript", {
        title: TL.escapeHtml(script.title),
        module: TL.modname(script.moduleId),
        loops: script.loops,
        days: script.days
      }) + "</div>" +
      "<div class='tl-modal-btns'>" +
      "<button class='tl-btn tl-btn-primary' data-n='1'>" + TL.t("game.p1") + "</button>" +
      "<button class='tl-btn tl-btn-primary' data-n='2'>" + TL.t("game.p2") + "</button>" +
      "<button class='tl-btn tl-btn-primary' data-n='3'>" + TL.t("game.p3") + "</button>" +
      "<button class='tl-btn tl-btn-primary' id='btn-ai-mode'>" + TL.t("game.aiMode") + "</button>" +
      "</div>";
    modal.querySelectorAll("[data-n]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        startLocalGame(script, parseInt(btn.dataset.n, 10), false);
      });
    });
    var aiBtn = modal.querySelector("#btn-ai-mode");
    if (aiBtn) {
      aiBtn.addEventListener("click", function () {
        startLocalGame(script, 3, true);
      });
    }
  }

  function startLocalGame(script, n, ai) {
    S.aiMode = ai;
    S.finalGuessShown = false;
    S.gameOverShown = false;
    S.notes = TL.UI.Notes.freshNotes();
    var baseIO = TL.UI.io();
    var gameIO = baseIO;
    if (S.aiMode) {
      TL.AI.setDifficulty(S.settings.aiDifficulty || "normal");
      gameIO = TL.AI.io(baseIO);
    }
    S.game = new TL.Game(script, { protagonists: n, io: gameIO });
    S.game.uiManaged = true; // 能力階段由界面（能力面板＋點擊目標）操作
    if (S.aiMode) TL.AI.ctx.game = S.game;
    TL.UI.$("setup-overlay").style.display = "none";
    bindEvents();
    render();
    S.game.startGame().then(function () {
      render();
      maybeRunAI();
    });
  }

  function bindEvents() {
    TL.UI.$("tgl-secret").addEventListener("change", function () {
      S.secretOn = this.checked;
      render();
    });
    TL.UI.$("btn-editor").addEventListener("click", function () { location.href = "editor.html"; });
    TL.UI.$("btn-restart").addEventListener("click", function () {
      TL.UI.confirm({ title: TL.t("game.restart"), text: TL.t("game.restartConfirm") }).then(function (yes) {
        if (yes) { localStorage.removeItem("tl_current_script"); location.reload(); }
      });
    });
    TL.UI.$("btn-settings").addEventListener("click", openSettings);
    TL.UI.$("btn-notes").addEventListener("click", TL.UI.Notes.openNotes);
    TL.UI.$("skip-btn").addEventListener("click", doSkipPPlays);
    TL.UI.$("phase-btn").addEventListener("click", async function () {
      var st = S.game.state;
      if (S.waitingAction) return;
      if (S.aiMode && (st.phase === "mm_play" || st.phase === "mm_abilities")) return;
      if (st.phase === "mm_play") {
        if (netAction("confirmMMPlays")) return;
        var r = S.game.confirmMMPlays();
        if (!r.ok) { TL.UI.toast(r.msg, "error"); return; }
      } else if (st.phase === "p_play") {
        if (netAction("confirmPPlays")) return;
        var r2 = S.game.confirmPPlays();
        if (!r2.ok) { TL.UI.toast(r2.msg, "error"); return; }
      } else if (st.phase === "resolve") {
        if (S.animBusy) return;
        S.animBusy = true;
        try {
          var preLogLen = S.game.state.log.length;
          var snap = { mm: st.mmPlays.slice(), p: st.pPlays.slice() };
          if (S.settings.anim) {
            S.revealMode = true;
            S.resolvePlays = snap;
            render();
            await TL.UI.sleep(900 * S.SPEED[S.settings.speed]);
          }
          if (S.online) {
            S.waitingAction = true;
            netAction("nextStep");
            return;
          }
          TL.UI.Anim.captureTokenRects();
          S.feedCursor = 0;
          await S.game.nextStep();
          S.revealMode = false;
          render();
          await TL.UI.Anim.playFeed(snap, preLogLen);
        } finally {
          S.animBusy = false;
        }
        render();
        maybeRunAI();
        return;
      } else {
        if (S.animBusy) await waitAnimDone();
        if (netAction("nextStep")) {
          S.waitingAction = true;
          return;
        }
        await S.game.nextStep();
      }
      render();
      maybeRunAI();
    });
  }

  // 主人公跳過：全部打「禁止密謀」（測試用；禁止密謀對不安/能力無效，因此並非真正無敵）
  function doSkipPPlays() {
    var st = S.game.state;
    if (st.phase !== "p_play" || S.online) return;
    var targets = [];
    Object.keys(st.chars).forEach(function (id) {
      if (st.chars[id].alive && st.chars[id].onStage !== false) targets.push({ type: "char", id: id });
    });
    LOCATIONS.forEach(function (l) { if (!l.offBoard) targets.push({ type: "location", id: l.id }); });
    var usedPos = {};
    st.pPlays.forEach(function (p) { usedPos[p.targetType + "|" + p.targetId] = true; });
    var ti = 0;
    var filled = 0;
    for (var i = 0; i < S.game.protagonistCount; i++) {
      var need = S.game._playsPerProtagonist(i);
      var have = st.pPlays.filter(function (p) { return p.player === i; }).length;
      var decks = S.game.decksForPlayer(i);
      var deckUsed = {};
      st.pPlays.filter(function (p) { return p.player === i; }).forEach(function (p) { deckUsed[p.deck] = true; });
      while (have < need) {
        var deck = null;
        for (var d = 0; d < decks.length; d++) { if (!deckUsed[decks[d]]) { deck = decks[d]; break; } }
        if (deck == null) break;
        var t = null;
        while (ti < targets.length) {
          var cand = targets[ti++];
          if (!usedPos[cand.type + "|" + cand.id]) { t = cand; break; }
        }
        if (!t) break;
        var r = S.game.pPlayCard(i, deck, "p_forbid_intrigue", t.type, t.id);
        if (r.ok) { have++; filled++; usedPos[t.type + "|" + t.id] = true; deckUsed[deck] = true; }
        else break;
      }
    }
    if (filled) {
      var cr = S.game.confirmPPlays();
      if (!cr.ok) TL.UI.toast(cr.msg, "error");
      render();
    } else {
      TL.UI.toast(TL.t("game.skipFail"), "error");
    }
  }

  // AI 劇作家自動行動（打牌 / 能力階段）
  async function maybeRunAI() {
    if (!S.aiMode || !S.game || S.aiBusy) return;
    var st = S.game.state;
    if (st.phase === "mm_play") {
      S.aiBusy = true;
      try {
        var plays = TL.AI.mmPlays(st, S.game);
        for (var i = 0; i < plays.length; i++) {
          var r = S.game.mmPlayCard(plays[i].card, plays[i].targetType, plays[i].targetId);
          if (r && r.ok) {
            render();
            await TL.UI.sleep(430 * S.SPEED[S.settings.speed]);
          }
        }
        var cr = S.game.confirmMMPlays();
        if (cr.ok) {
          render();
          await TL.UI.sleep(260 * S.SPEED[S.settings.speed]);
        }
        render();
      } finally {
        S.aiBusy = false;
      }
    } else if (st.phase === "mm_abilities") {
      S.aiBusy = true;
      try {
        var acts = TL.AI.mmAbilities(st, S.game);
        for (var j = 0; j < acts.length; j++) {
          await S.game.execMMAbility(acts[j].entry, acts[j].target || null);
          render();
          await TL.UI.Anim.playFeed();
          await TL.UI.sleep(320 * S.SPEED[S.settings.speed]);
        }
        render();
        await S.game.nextStep();
        render();
      } finally {
        S.aiBusy = false;
      }
    }
  }

  function waitAnimDone() {
    return new Promise(function (resolve) {
      (function poll() {
        if (!S.animBusy) return resolve();
        setTimeout(poll, 120);
      })();
    });
  }

  // ---------- 多人聯機 ----------
  function initOnline() {
    S.online = true;
    TL.UI.$("setup-overlay").style.display = "none";
    TL.UI.$("btn-restart").style.display = "none";
    TL.UI.$("btn-editor").style.display = "none";
    TL.UI.$("net-bar").style.display = "flex";
    TL.UI.$("chat-panel").style.display = "";
    TL.UI.$("persp-bar-wrap").style.display = "";
    document.title = TL.t("game.title") + "（" + TL.t("game.online") + "） - Tragedy Looper";
    TL.Net.on("view", onNetView);
    TL.Net.on("prompt", onNetPrompt);
    TL.Net.on("chat", onNetChat);
    TL.Net.on("room", function (r) { S.roomInfo = r; renderChatPlayers(); });
    TL.Net.on("error", function (m) {
      TL.UI.toast(m, "error");
      TL.UI.$("net-status").textContent = TL.t("game.net.error");
      setNetDot("error");
    });
    TL.Net.on("status", function (s) {
      if (s === "connected") { TL.UI.$("net-status").textContent = TL.t("game.net.connected"); setNetDot("ok"); }
      else if (s === "connecting") { TL.UI.$("net-status").textContent = TL.t("game.net.connecting"); setNetDot("connecting"); }
      else if (s === "error") { TL.UI.$("net-status").textContent = TL.t("game.net.error"); setNetDot("error"); }
    });
    TL.UI.$("btn-leave").addEventListener("click", function () {
      TL.Net.leave();
      location.href = "index.html";
    });
    TL.UI.$("chat-send").addEventListener("click", sendChat);
    TL.UI.$("chat-input").addEventListener("keydown", function (e) {
      if (e.key === "Enter") sendChat();
    });
    function sendChat() {
      var t = TL.UI.$("chat-input").value.trim();
      if (!t) return;
      TL.Net.chat(t);
      TL.UI.$("chat-input").value = "";
    }
    TL.Net.resume();
  }

  function setNetDot(cls) {
    var bar = TL.UI.$("net-bar");
    if (!bar) return;
    bar.classList.remove("net-ok", "net-connecting", "net-error");
    if (cls) bar.classList.add("net-" + cls);
  }

  function viewState(view) {
    var chars = {};
    Object.keys(view.chars || {}).forEach(function (id) {
      var c = view.chars[id];
      chars[id] = {
        id: id,
        role: (view.roles || {})[id] || null,
        roleRevealed: !!c.roleRevealed,
        startingLoc: c.loc,
        loc: c.loc,
        alive: !!c.alive,
        paranoia: c.paranoia || 0,
        goodwill: c.goodwill || 0,
        intrigue: c.intrigue || 0,
        guard: c.guard || 0,
        becameSerial: false
      };
    });
    var locations = {};
    LOCATIONS.forEach(function (l) { locations[l.id] = { intrigue: (view.locations || {})[l.id] || 0 }; });
    return {
      phase: view.phase,
      day: view.day,
      loop: view.loop,
      leader: view.leader,
      ended: view.ended,
      chars: chars,
      locations: locations,
      mmPlays: (view.mmPlays || []).map(function (p) {
        return { card: p.card, targetType: p.targetType, targetId: p.targetId, owner: "mm" };
      }),
      pPlays: (view.pPlays || []).map(function (p) {
        return { card: p.card, player: p.player, deck: p.deck, targetType: p.targetType, targetId: p.targetId, owner: "p" };
      }),
      used: view.used || { mm: {}, p0: {}, p1: {}, p2: {} },
      usedGoodwill: view.usedGoodwill || {},
      usedGoodwillDay: view.usedGoodwillDay || {},
      usedMMAbility: view.usedMMAbility || {},
      plotFlags: view.plotFlags || {},
      incidentHistory: view.incidentHistory || [],
      log: view.log || [],
      feed: view.feed || [],
      finalGuess: view.finalGuess || null
    };
  }

  function onNetView(view) {
    if (view.seq <= S.mirrorSeq && S.game) return;
    S.mirrorSeq = view.seq;
    var hasNewFeed = S.game ? view.feed.length > S.lastFeedLen : false;
    if (!S.game) {
      S.game = TL.Game.fromState(view.script, viewState(view), { protagonists: view.protagonistCount || 3, io: TL.UI.io() });
      bindEvents();
      S.finalGuessShown = false;
      S.gameOverShown = false;
      S.notes = TL.UI.Notes.freshNotes();
      TL.UI.$("setup-overlay").style.display = "none";
    } else {
      S.game.state = JSON.parse(JSON.stringify(viewState(view)));
    }
    S.waitingAction = false;
    S.revealMode = false;
    renderPerspectiveBar();
    render();
    if (hasNewFeed && S.settings.anim) {
      S.feedCursor = S.lastFeedLen;
      var preLogLen = S.lastLogLen;
      S.logReveal = preLogLen;
      S.animBusy = true;
      try {
        TL.UI.Anim.playFeed(preLogLen);
      } finally {
        S.animBusy = false;
      }
      render();
    }
    S.lastFeedLen = view.feed.length;
    S.lastLogLen = view.log.length;
  }

  function onNetPrompt(p) {
    if (p.kind === "confirm") {
      TL.UI.confirm({ title: p.title, text: p.text }).then(function (yes) {
        TL.Net.promptReply(p.id, yes);
      });
    } else if (p.kind === "choice") {
      TL.UI.askChoice({ title: p.title, text: p.text, options: p.options || [] }).then(function (idx) {
        TL.Net.promptReply(p.id, idx);
      });
    } else if (p.kind === "target") {
      TL.UI.askTarget({ title: p.title, text: p.text, targets: p.targets || [] }).then(function (t) {
        TL.Net.promptReply(p.id, t);
      });
    }
  }

  function onNetChat(m) {
    var box = TL.UI.$("chat-log");
    var div = document.createElement("div");
    div.className = "chat-msg";
    div.innerHTML = '<img class="avatar-sm" src="assets/player_stand/' + encodeURIComponent(m.avatar) + '" alt="">' +
      '<span class="chat-from">' + TL.escapeHtml(m.from) + "：</span><span class='chat-text'>" + TL.escapeHtml(m.text) + "</span>";
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
  }

  function renderChatPlayers() {
    var box = TL.UI.$("chat-players");
    if (!box || !S.roomInfo) return;
    box.innerHTML = S.roomInfo.players.map(function (p) {
      var badges = (p.slots || []).map(function (s) {
        var name = { mm: TL.t("game.heroChip.mm"), a: TL.t("game.heroChip.a"), b: TL.t("game.heroChip.b"), c: TL.t("game.heroChip.c") }[s] || s;
        return '<span class="hero-chip">' + name + "</span>";
      }).join("");
      return '<span class="cp"><img src="assets/player_stand/' + encodeURIComponent(p.avatar) + '" alt="">' +
        TL.escapeHtml(p.name) + badges + "</span>";
    }).join("");
  }

  function renderPerspectiveBar() {
    var wrap = TL.UI.$("persp-bar");
    if (!wrap) return;
    var slots = TL.Net.slots || [];
    var HEROES = [
      { slot: "mm", name: TL.t("game.mastermind"), logo: "assets/extra/clock.png" },
      { slot: "a", name: "A", logo: "assets/extra/diary.png" },
      { slot: "b", name: "B", logo: "assets/extra/icon.png" },
      { slot: "c", name: "C", logo: "assets/extra/heros.png" }
    ];
    wrap.innerHTML = slots.map(function (s) {
      var h = HEROES.find(function (x) { return x.slot === s; }) || { name: s, logo: "" };
      return '<button class="persp-btn' + (TL.Net.perspective === s ? " active" : "") + '" data-slot="' + s + '">' +
        '<img src="' + h.logo + '" alt=""><span>' + h.name + "</span></button>";
    }).join("");
    wrap.querySelectorAll(".persp-btn").forEach(function (b) {
      b.addEventListener("click", function () {
        TL.Net.setPerspective(this.dataset.slot);
        render();
      });
    });
  }

  function openSettings() {
    TL.UI.modal({
      title: TL.t("game.settings"),
      body: function (el) {
        function renderSettings() {
          el.innerHTML =
            '<div class="set-row"><label class="set-label">' + TL.t("common.language") + "</label>" +
            '<select id="set-lang"></select></div>' +
            '<div class="set-row"><label class="set-label">' + TL.t("game.aiDifficulty") + "</label>" +
            '<select id="set-ai-difficulty">' +
            '<option value="easy"' + (S.settings.aiDifficulty === "easy" ? " selected" : "") + ">" + TL.t("game.aiEasy") + "</option>" +
            '<option value="normal"' + (S.settings.aiDifficulty === "normal" ? " selected" : "") + ">" + TL.t("game.aiNormal") + "</option>" +
            '<option value="hard"' + (S.settings.aiDifficulty === "hard" ? " selected" : "") + ">" + TL.t("game.aiHard") + "</option>" +
            "</select></div>" +
            '<div class="set-row"><label class="toggle-row"><input type="checkbox" id="set-anim"' +
            (S.settings.anim ? " checked" : "") + "> " + TL.t("game.animLabel") + "</label></div>" +
            '<div class="set-row"><label class="toggle-row"><input type="checkbox" id="set-secret"' +
            (S.secretOn ? " checked" : "") + "> " + TL.t("game.showSecret") + "</label></div>" +
            '<div class="set-row"><label class="set-label">' + TL.t("game.animSpeed") + "</label>" +
            '<select id="set-speed">' +
            '<option value="slow"' + (S.settings.speed === "slow" ? " selected" : "") + ">" + TL.t("game.slow") + "</option>" +
            '<option value="normal"' + (S.settings.speed === "normal" ? " selected" : "") + ">" + TL.t("game.normal") + "</option>" +
            '<option value="fast"' + (S.settings.speed === "fast" ? " selected" : "") + ">" + TL.t("game.fast") + "</option>" +
            "</select></div>";
          TL.I18N.bindSelect(el.querySelector("#set-lang"), function () {
            renderSettings();
            if (S.game) render();
            var foot = el.closest(".tl-modal");
            if (foot) {
              var closeBtn = foot.querySelector(".tl-modal-btns .tl-btn");
              if (closeBtn) closeBtn.textContent = TL.t("common.close");
            }
          });
          el.querySelector("#set-anim").addEventListener("change", function () {
            S.settings.anim = this.checked;
            TL.UI.saveSettings();
          });
          el.querySelector("#set-speed").addEventListener("change", function () {
            S.settings.speed = this.value;
            TL.UI.saveSettings();
          });
          el.querySelector("#set-ai-difficulty").addEventListener("change", function () {
            S.settings.aiDifficulty = this.value;
            TL.UI.saveSettings();
            TL.AI.setDifficulty(this.value);
          });
          el.querySelector("#set-secret").addEventListener("change", function () {
            S.secretOn = this.checked;
            render();
          });
        }
        renderSettings();
      },
      buttons: [{ label: TL.t("common.close"), value: "close", primary: true }]
    });
  }

  // ---------- 渲染調度 ----------
  var PHASE_INFO = {
    setup: ["game.phase.setup", "game.phase.setupHint"],
    day_start: ["game.phase.day_start", "game.phase.day_startHint"],
    mm_play: ["game.phase.mm_play", "game.phase.mm_playHint"],
    p_play: ["game.phase.p_play", "game.phase.p_playHint"],
    resolve: ["game.phase.resolve", "game.phase.resolveHint"],
    mm_abilities: ["game.phase.mm_abilities", "game.phase.mm_abilitiesHint"],
    goodwill: ["game.phase.goodwill", "game.phase.goodwillHint"],
    incident: ["game.phase.incident", "game.phase.incidentHint"],
    day_end: ["game.phase.day_end", "game.phase.day_endHint"],
    loop_end: ["game.phase.loop_end", "game.phase.loop_endHint"],
    final_guess: ["game.phase.final_guess", "game.phase.final_guessHint"],
    game_over: ["game.phase.game_over", "game.phase.game_overHint"]
  };

  function renderPhaseBar() {
    var st = S.game.state;
    var info = PHASE_INFO[st.phase] || [st.phase, ""];
    var aiSuffix = S.aiMode && (st.phase === "mm_play" || st.phase === "mm_abilities") ? TL.t("game.aiTag") : "";
    TL.UI.$("phase-name").textContent = TL.t(info[0]) + aiSuffix;
    TL.UI.$("phase-hint").textContent = TL.t(info[1]);
    var btn = TL.UI.$("phase-btn");
    var labels = {
      day_start: "game.btn.day_start",
      resolve: "game.btn.resolve",
      mm_abilities: "game.btn.mm_abilities",
      goodwill: "game.btn.goodwill",
      incident: "game.btn.incident",
      day_end: "game.btn.day_end",
      loop_end: "game.btn.loop_end"
    };
    var waitingNext = st.phase === "loop_end" && !!st.nextLoopPending;
    // 死亡導致的輪迴結束也會帶 ended（lose），此時仍在「輪迴結束」階段：先給「結算輪迴」按鈕
    if (st.ended && st.phase !== "loop_end" && !waitingNext) {
      btn.style.display = "none";
    } else if (waitingNext) {
      // 主人公失敗且有剩餘輪迴：顯示「下一輪輪迴」按鈕
      btn.style.display = "";
      btn.textContent = TL.t("game.btn.nextLoop");
    } else if (labels[st.phase]) {
      btn.style.display = "";
      btn.textContent = TL.t(labels[st.phase]);
    } else if (st.phase === "final_guess") {
      btn.style.display = "none";
    } else {
      btn.style.display = "none";
    }
    // 打牌階段改用確認按鈕
    if (st.phase === "mm_play" || st.phase === "p_play") {
      btn.style.display = "";
      btn.textContent = TL.t("game.btn.confirm");
    }
    // 跳過按鈕：僅本地模式（熱座 / AI 對戰）主人公打牌階段可用
    var skipBtn = TL.UI.$("skip-btn");
    if (st.phase === "p_play" && !S.online) {
      skipBtn.style.display = "";
      skipBtn.textContent = TL.t("game.skip");
    } else {
      skipBtn.style.display = "none";
    }
    if (st.phase === "setup" || st.phase === "game_over") btn.style.display = "none";
    if (S.aiMode && (st.phase === "mm_play" || st.phase === "mm_abilities")) {
      btn.style.display = "";
      btn.disabled = true;
      btn.textContent = TL.t("game.aiThinking");
    }
    if (S.animBusy) {
      btn.disabled = true;
      if (st.phase === "resolve" || st.phase === "mm_abilities" || st.phase === "goodwill") {
        btn.textContent = TL.t("game.btn.resolving");
      }
    } else {
      btn.disabled = false;
    }
  }

  function render() {
    if (!S.game) return;
    var st = S.game.state;
    if (S.online) {
      renderPerspectiveBar();
      TL.UI.$("tgl-secret-row").style.display = TL.Net.perspective === "mm" ? "" : "none";
      TL.UI.$("tgl-secret").checked = S.secretOn && TL.Net.perspective === "mm";
    }
    if (st.phase === "final_guess" && !S.finalGuessShown && !st.ended) {
      S.finalGuessShown = true;
      finalGuessUI();
    }
    if (st.phase === "game_over" && !S.gameOverShown) {
      S.gameOverShown = true;
      showGameOver();
    }
    TL.UI.$("hd-title").textContent = S.game.script.title;
    TL.UI.$("hd-meta").textContent = TL.t("game.meta", { l: st.loop, loops: S.game.script.loops, d: st.day, days: S.game.script.days });
    renderPhaseBar();
    TL.UI.Board.renderBoard();
    TL.UI.Panels.renderDataBoard();
    TL.UI.Panels.renderHand();
    TL.UI.Panels.renderPlays();
    TL.UI.Panels.renderAbilityPanel();
    TL.UI.Log.renderLog();
    TL.UI.Panels.renderSecret();
    TL.UI.Notes.renderNotesStrip();
  }

  // ---------- 最終決戰 / 遊戲結束 ----------
  function finalGuessUI() {
    var st = S.game.state;
    if (st.phase !== "final_guess" || st.ended) return;
    var chars = Object.keys(st.chars).filter(function (id) {
      return !st.chars[id].roleRevealed && st.chars[id].onStage !== false;
    });
    var roles = [];
    if (S.online) {
      var gr = TL.Net.guessRoles || [];
      gr.forEach(function (rid) { if (roles.indexOf(rid) < 0) roles.push(rid); });
    } else {
      TL.rolesFromScript(S.game.script).forEach(function (rid) {
        if (roles.indexOf(rid) < 0) roles.push(rid);
      });
    }
    var overlay = document.createElement("div");
    overlay.className = "tl-modal-wrap";
    overlay.id = "fg-overlay";
    overlay.innerHTML = '<div class="tl-modal">' +
      '<div class="tl-modal-title">' + TL.t("game.fg.title") + "</div>" +
      '<div class="tl-modal-text">' + TL.t("game.fg.text", { n: chars.length }) + "</div>" +
      '<div class="tl-field" style="margin-bottom:8px;"><label>' + TL.t("game.fg.char") + '</label><select id="fg-char">' +
      chars.map(function (id) { return '<option value="' + id + '">' + TL.escapeHtml(TL.cname(id)) + "</option>"; }).join("") +
      "</select></div>" +
      '<div class="tl-field" style="margin-bottom:12px;"><label>' + TL.t("game.fg.role") + '</label><select id="fg-role">' +
      roles.map(function (rid) { return '<option value="' + rid + '">' + TL.escapeHtml(TL.rname(rid)) + "</option>"; }).join("") +
      "</select></div>" +
      '<button class="tl-btn tl-btn-primary" id="fg-go">' + TL.t("game.fg.go") + "</button></div>";
    document.body.appendChild(overlay);
    overlay.querySelector("#fg-go").addEventListener("click", async function () {
      var cid = overlay.querySelector("#fg-char").value;
      var rid = overlay.querySelector("#fg-role").value;
      if (S.online) {
        netAction("finalGuess", { cid: cid, rid: rid });
      } else {
        await S.game.finalGuess(cid, rid);
      }
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      S.finalGuessShown = false;
      if (!S.online) render();
    });
  }

  function showGameOver() {
    var st = S.game.state;
    if (st.phase !== "game_over") return;
    var win = st.ended === "win";
    if (S.online) {
      TL.UI.modal({
        title: win ? TL.t("game.win") : TL.t("game.lose"),
        text: win ? TL.t("game.winText") : TL.t("game.loseText"),
        buttons: [
          { label: TL.t("game.stay"), value: "stay", primary: true },
          { label: TL.t("game.leaveRoom"), value: "leave" }
        ]
      }).then(function (v) {
        if (v === "leave") { TL.Net.leave(); location.href = "index.html"; }
      });
      return;
    }
    TL.UI.modal({
      title: win ? TL.t("game.win") : TL.t("game.lose"),
      text: win ? TL.t("game.winText") : TL.t("game.loseText"),
      buttons: [
        { label: TL.t("game.restartBtn"), value: "restart" },
        { label: TL.t("game.backEditor"), value: "editor" }
      ]
    }).then(function (v) {
      if (v === "restart") location.reload();
      else if (v === "editor") location.href = "editor.html";
    });
  }

  // 供其他模組呼叫的核心 API
  TL.UI.core = {
    render: render,
    renderPhaseBar: renderPhaseBar,
    netAction: netAction,
    maybeRunAI: maybeRunAI,
    waitAnimDone: waitAnimDone,
    openSettings: openSettings
  };

  // ---------- 啟動 ----------
  var script = loadScript();
  var wantOnline = location.search.indexOf("online=1") >= 0 && !!TL.Net.loadSession();
  var wantAI = location.search.indexOf("mode=ai") >= 0;
  if (wantOnline) {
    initOnline();
  } else if (wantAI) {
    startLocalGame(script, 3, true);
  } else {
    showSetup(script);
  }
  // 防止右鍵查看角色時彈出瀏覽器選單
  document.addEventListener("contextmenu", function (e) {
    if (e.target && e.target.closest && e.target.closest(".char-token")) e.preventDefault();
  }, true);
  window.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      S.pending = null;
      if (S.pendingAbility) {
        S.pendingAbility = null;
        render();
      }
    }
  });

  // 語言切換時重新渲染（供頁面上的語言下拉框呼叫）
  window.__tlGameRefresh = function () {
    if (S.game) render();
  };
})();
