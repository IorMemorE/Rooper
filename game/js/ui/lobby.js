(function () {
  var $ = function (id) { return document.getElementById(id); };
  var AVATARS = [
    "writer_1.png", "writer_2.png", "hero_A.png", "hero_B.png", "hero_C.png",
    "chibi_W.png", "chibi_A1.png", "chibi_A2.png", "chibi_B1.png", "chibi_B2.png", "chibi_C1.png", "chibi_C2.png"
  ];
  var HEROES = [
    { slot: "mm", name: function () { return TL.t("lobby.hero.mm"); }, logo: "assets/player_stand/writer_1.png" },
    { slot: "a", name: function () { return TL.t("lobby.hero.a"); }, logo: "assets/extra/clock.png" },
    { slot: "b", name: function () { return TL.t("lobby.hero.b"); }, logo: "assets/extra/diary.png" },
    { slot: "c", name: function () { return TL.t("lobby.hero.c"); }, logo: "assets/extra/icon.png" }
  ];
  var room = null;
  var myId = null;
  var avatar = randomAvatar();
  var selectedScript = null; // {presetId, script}
  var preselect = null;
  try {
    if (location.search.indexOf("preset=1") >= 0) {
      var rawPre = localStorage.getItem("tl_preset_script");
      if (rawPre) {
        var objPre = JSON.parse(rawPre);
        if (objPre && objPre.cast) {
          preselect = objPre;
          selectedScript = { presetId: "__editor__", script: objPre };
        }
      }
    }
  } catch (e) {}

  function randomAvatar() {
    return AVATARS[Math.floor(Math.random() * AVATARS.length)];
  }
  function avatarUrl(name) {
    return "assets/player_stand/" + encodeURIComponent(name);
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function toast(msg) {
    TL.UI.toast(msg, "error");
  }

  function loadEditorScript() {
    try {
      var raw = localStorage.getItem("tl_preset_script") || localStorage.getItem("tl_current_script");
      var obj = raw ? JSON.parse(raw) : null;
      return (obj && obj.cast) ? obj : null;
    } catch (e) { return null; }
  }

  function selectScript(presetId, script) {
    selectedScript = { presetId: presetId, script: script || null };
    TL.Net.selectScript(presetId === "__import__" || presetId === "__editor__" ? null : presetId, script || null);
    renderRoom();
  }

  function renderScriptCards(q, cards, moduleId) {
    var list = PRESETS.filter(function (p) {
      if (moduleId && p.moduleId !== moduleId) return false;
      if (!q) return true;
      return (p.title + " " + p.moduleId + " " + TL.pname(p.mainPlot)).toLowerCase().indexOf(q) >= 0;
    });
    cards.innerHTML = list.map(function (p) {
      var sel = selectedScript && selectedScript.presetId === p.id;
      return '<div class="script-card' + (sel ? " selected" : "") + '" data-id="' + p.id + '">' +
        '<div class="sc-title">' + esc(p.title) + "</div>" +
        '<div class="sc-meta">' + TL.modname(p.moduleId) + " · " + TL.pname(p.mainPlot) + "</div>" +
        "</div>";
    }).join("") || '<div style="color:var(--text-dim);font-size:13px;">' + TL.t("lobby.scriptNone") + "</div>";
    cards.querySelectorAll(".script-card").forEach(function (c) {
      c.addEventListener("click", function () {
        var preset = PRESETS.find(function (x) { return x.id === c.dataset.id; });
        if (preset) {
          selectScript(preset.id, null);
          var wrap = c.closest(".tl-modal-wrap");
          if (wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap);
        }
      });
    });
  }

  // 「使用預設」彈窗：搜尋 + 卡片選擇
  function openPresetPicker() {
    TL.UI.modal({
      title: TL.t("lobby.presetTitle"),
      text: TL.t("lobby.presetHint"),
      body: function (el) {
        el.innerHTML =
          '<div class="ref-toolbar"><label>' + TL.t("lobby.moduleFilter") + '</label>' +
          '<select id="lb-preset-module">' +
          '<option value="">' + TL.t("lobby.moduleAll") + "</option>" +
          Object.keys(MODULES).map(function (mid) {
            return '<option value="' + mid + '">' + TL.modname(mid) + "</option>";
          }).join("") +
          "</select></div>" +
          '<input type="text" id="lb-preset-search" placeholder="' + TL.t("lobby.scriptSearch") + '">' +
          '<div class="script-cards" id="lb-preset-cards"></div>';
        var cards = el.querySelector("#lb-preset-cards");
        var moduleId = "";
        var q = "";
        function refresh() { renderScriptCards(q, cards, moduleId); }
        refresh();
        el.querySelector("#lb-preset-search").addEventListener("input", function () {
          q = this.value.trim().toLowerCase();
          refresh();
        });
        el.querySelector("#lb-preset-module").addEventListener("change", function () {
          moduleId = this.value;
          refresh();
        });
      },
      buttons: [{ label: TL.t("common.close"), value: "close" }]
    });
  }

  function setEntryVisible(show) {
    $("lobby-entry").style.display = show ? "" : "none";
    $("lobby-room").style.display = show ? "none" : "";
  }

  function renderRoom() {
    if (!room) return;
    $("lobby-room").style.display = "";
    $("lobby-entry").style.display = "none";
    $("lb-roomcode").textContent = room.code;
    $("lb-room-hint").textContent = room.started ? TL.t("lobby.started") : TL.t("lobby.waiting");
    var isHost = room.hostId === myId;
    $("lb-start").style.display = isHost ? "" : "none";
    $("lb-script").style.display = isHost ? "" : "none";

    // 玩家列表
    var playersHtml = room.players.map(function (p) {
      var badges = p.slots.map(function (s) {
        var h = HEROES.find(function (x) { return x.slot === s; });
        return '<span class="slot-badge"><img src="' + h.logo + '" alt=""><b>' + h.name() + "</b></span>";
      }).join("");
      return '<div class="lb-player' + (p.id === myId ? " me" : "") + '">' +
        '<img class="avatar" src="' + avatarUrl(p.avatar) + '" alt="">' +
        '<span class="lb-name">' + esc(p.name) + (p.id === myId ? TL.t("lobby.you") : "") + "</span>" +
        (p.online ? "" : '<span class="offline">' + TL.t("lobby.offline") + "</span>") +
        '<div class="slot-badges">' + badges + "</div></div>";
    }).join("");
    $("lb-players").innerHTML = playersHtml || TL.t("lobby.noPlayers");

    // 分配（房主）
    $("lb-assign-hint").textContent = isHost ? TL.t("lobby.assignHint") : "";
    var assignHtml = HEROES.map(function (h) {
      var opts = '<option value="">' + TL.t("lobby.unassigned") + "</option>" + room.players.map(function (p) {
        return '<option value="' + p.id + '"' + (p.slots.indexOf(h.slot) >= 0 ? " selected" : "") + ">" + esc(p.name) + "</option>";
      }).join("");
      return '<div class="assign-row"><img class="hero-logo" src="' + h.logo + '" alt=""><span class="assign-name">' +
        h.name() + '</span>' + (isHost ? '<select class="assign-sel" data-slot="' + h.slot + '">' + opts + "</select>" : "") + "</div>";
    }).join("");
    $("lb-assign").innerHTML = assignHtml;
    $("lb-assign").querySelectorAll(".assign-sel").forEach(function (sel) {
      sel.addEventListener("change", function () {
        TL.Net.assign(this.dataset.slot, this.value);
      });
    });

    // 房间设置（房主）：主人公能否看队友盖牌 + 起始队长
    var settingsBox = $("lb-room-settings");
    if (settingsBox) {
      if (isHost && !room.started) {
        settingsBox.innerHTML =
          '<h4 class="lobby-sec">' + TL.t("lobby.settings") + "</h4>" +
          '<label class="set-row toggle-row"><input type="checkbox" id="lb-see-cards"' +
          (room.seeTeammateCards ? " checked" : "") + "> " + TL.t("lobby.seeCards") + "</label>" +
          '<div class="set-row"><span class="set-label">' + TL.t("lobby.leaderStart") + '</span>' +
          '<select id="lb-leader-start">' +
          ["A", "B", "C"].map(function (n, i) {
            return '<option value="' + i + '"' + ((room.leaderStart || 0) === i ? " selected" : "") + ">主人公" + n + "</option>";
          }).join("") + "</select></div>";
        settingsBox.style.display = "";
        var seeCards = settingsBox.querySelector("#lb-see-cards");
        var leaderSel = settingsBox.querySelector("#lb-leader-start");
        if (seeCards) seeCards.addEventListener("change", function () {
          TL.Net.roomSetting({ seeTeammateCards: this.checked });
        });
        if (leaderSel) leaderSel.addEventListener("change", function () {
          TL.Net.roomSetting({ leaderStart: parseInt(this.value, 10) });
        });
      } else {
        settingsBox.style.display = "none";
      }
    }

    // 劇本選擇（房主）
    if (isHost) {
      var saved = loadEditorScript();
      $("lb-script").innerHTML =
        '<h4 class="lobby-sec">' + TL.t("lobby.script") + "</h4>" +
        '<div class="script-pick">' +
        '<div class="script-pick-row">' +
        '<button class="tl-btn tl-btn-primary" id="lb-use-preset">' + TL.t("lobby.usePreset") + "</button>" +
        '<button class="tl-btn" id="lb-import">' + TL.t("lobby.importScript") + "</button>" +
        '<input type="file" id="lb-import-file" accept=".json,application/json" style="display:none;">' +
        "</div>" +
        (saved && saved.cast
          ? '<button class="tl-btn lb-editor-btn' + (selectedScript && selectedScript.presetId === "__editor__" ? " selected" : "") + '" id="lb-use-editor">' +
            TL.t("lobby.editorScript", { title: esc(saved.title || "") }) + "</button>"
          : "") +
        "</div>" +
        (room.script ? '<div class="script-picked">' + TL.t("lobby.picked", { title: esc(room.script.title) }) + "</div>" : "");
      $("lb-use-preset").addEventListener("click", openPresetPicker);
      $("lb-import").addEventListener("click", function () { $("lb-import-file").click(); });
      $("lb-import-file").addEventListener("change", function () {
        var f = this.files && this.files[0];
        if (!f) return;
        var reader = new FileReader();
        reader.onload = function () {
          try {
            var obj = JSON.parse(reader.result);
            if (obj && obj.cast) selectScript("__import__", obj);
            else toast(TL.t("lobby.importBad"));
          } catch (e) { toast(TL.t("lobby.importBad")); }
        };
        reader.readAsText(f);
      });
      var edBtn = $("lb-use-editor");
      if (edBtn) edBtn.addEventListener("click", function () { selectScript("__editor__", saved); });
    } else {
      $("lb-script").innerHTML = room.script
        ? '<h4 class="lobby-sec">' + TL.t("lobby.script") + '</h4><div class="script-picked">' + TL.t("lobby.hostPicked", { title: esc(room.script.title) }) + "</div>"
        : "";
    }
  }

  function appendChat(m) {
    var box = $("lb-chat");
    var div = document.createElement("div");
    div.className = "chat-msg" + (m.senderId != null && m.senderId === myId ? " me" : "");
    var time = m.ts ? new Date(m.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
    div.innerHTML =
      '<img class="chat-avatar" src="' + avatarUrl(m.avatar || "writer_1.png") + '" alt="">' +
      '<div class="chat-main">' +
      '<div class="chat-meta"><span class="chat-from">' + esc(m.from) + "</span>" +
      (time ? '<span class="chat-time">' + time + "</span>" : "") + "</div>" +
      '<div class="chat-bubble">' + esc(m.text) + "</div>" +
      "</div>";
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
  }

  function bind() {
    $("lb-back").addEventListener("click", function () { location.href = "index.html"; });
    $("lb-reroll").addEventListener("click", function () {
      avatar = randomAvatar();
      $("lb-avatar-img").src = avatarUrl(avatar);
      if (myId && room) TL.Net.setAvatar(avatar);
    });
    $("lb-avatar-img").src = avatarUrl(avatar);
    $("lb-create").addEventListener("click", function () {
      var name = $("lb-name").value.trim() || TL.t("lobby.hostDefault");
      $("lb-name").value = name;
      TL.Net.connect("", null, name, avatar);
    });
    $("lb-join").addEventListener("click", function () {
      var name = $("lb-name").value.trim() || TL.t("lobby.playerDefault");
      var code = $("lb-code").value.trim().toUpperCase();
      if (!code) { toast(TL.t("lobby.needCode")); return; }
      $("lb-name").value = name;
      TL.Net.connect("", code, name, avatar);
    });
    $("lb-copy").addEventListener("click", function () {
      navigator.clipboard.writeText($("lb-roomcode").textContent).then(function () {
        TL.UI.notify(TL.t("lobby.copied"));
      });
    });
    $("lb-start").addEventListener("click", function () {
      TL.Net.startGame();
    });
    $("lb-chat-send").addEventListener("click", sendChat);
    $("lb-chat-input").addEventListener("keydown", function (e) {
      if (e.key === "Enter") sendChat();
    });
    function sendChat() {
      var t = $("lb-chat-input").value.trim();
      if (!t) return;
      TL.Net.chat(t);
      $("lb-chat-input").value = "";
    }
  }

  TL.Net.on("welcome", function (msg) {
    myId = msg.id;
  });
  TL.Net.on("room", function (r) {
    room = r;
    renderRoom();
    if (r.hostId === myId && preselect && !window.__preselectDone) {
      window.__preselectDone = true;
      selectedScript = { presetId: "__editor__", script: preselect };
      TL.Net.selectScript(null, preselect);
    }
    if (r.started) {
      setTimeout(function () { location.href = "game.html?online=1"; }, 400);
    }
  });
  TL.Net.on("chat", appendChat);
  TL.Net.on("error", function (msg) {
    $("lb-error").textContent = msg;
  });
  TL.Net.on("status", function (s) {
    var el = $("lb-error");
    if (s === "connected") { el.textContent = ""; }
    else if (s === "connecting" && !el.textContent) { el.textContent = TL.t("lobby.connecting"); }
    else if (s === "error" && !el.textContent) { el.textContent = TL.t("lobby.errConnect"); }
  });

  window.__tlLobbyRefresh = function () {
    TL.I18N.applyStatic(document);
    if (room) renderRoom();
  };

  bind();
})();
