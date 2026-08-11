(function () {
  var $ = function (id) { return document.getElementById(id); };
  var AVATARS = [
    "writer_1.png", "writer_2.png", "hero_A.png", "hero_B.png", "hero_C.png",
    "chibi_W.png", "chibi_A1.png", "chibi_A2.png", "chibi_B1.png", "chibi_B2.png", "chibi_C1.png", "chibi_C2.png"
  ];
  var HEROES = [
    { slot: "mm", name: function () { return TL.t("lobby.hero.mm"); }, logo: "assets/extra/clock.png" },
    { slot: "a", name: function () { return TL.t("lobby.hero.a"); }, logo: "assets/extra/diary.png" },
    { slot: "b", name: function () { return TL.t("lobby.hero.b"); }, logo: "assets/extra/icon.png" },
    { slot: "c", name: function () { return TL.t("lobby.hero.c"); }, logo: "assets/extra/heros.png" }
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

    // 劇本選擇（房主）
    if (isHost) {
      var saved = null;
      try { saved = JSON.parse(localStorage.getItem("tl_current_script") || "null"); } catch (e) {}
      var opts = PRESETS.map(function (p) {
        return '<option value="' + p.id + '"' + (selectedScript && selectedScript.presetId === p.id ? " selected" : "") + ">" +
          (p.moduleId === "FS" ? "[FS] " : "[BTX] ") + esc(p.title) + "</option>";
      }).join("");
      if (saved && saved.cast) {
        opts += '<option value="__editor__"' + (selectedScript && selectedScript.presetId === "__editor__" ? " selected" : "") + ">" + TL.t("lobby.editorScript", { title: esc(saved.title || TL.t("editor.title")) }) + "</option>";
      }
      $("lb-script").innerHTML =
        '<h4 class="lobby-sec">' + TL.t("lobby.script") + "</h4>" +
        '<select id="lb-script-sel">' + opts + "</select>" +
        (room.script ? '<div class="script-picked">' + TL.t("lobby.picked", { title: esc(room.script.title) }) + "</div>" : "");
      $("lb-script-sel").addEventListener("change", function () {
        var v = this.value;
        if (v === "__editor__") {
          selectedScript = { presetId: v, script: saved };
          TL.Net.selectScript(null, saved);
        } else {
          selectedScript = { presetId: v, script: null };
          TL.Net.selectScript(v, null);
        }
      });
    } else {
      $("lb-script").innerHTML = room.script
        ? '<h4 class="lobby-sec">' + TL.t("lobby.script") + '</h4><div class="script-picked">' + TL.t("lobby.hostPicked", { title: esc(room.script.title) }) + "</div>"
        : "";
    }
  }

  function appendChat(m) {
    var box = $("lb-chat");
    var div = document.createElement("div");
    div.className = "chat-msg";
    div.innerHTML = '<img class="avatar-sm" src="' + avatarUrl(m.avatar) + '" alt=""><span class="chat-from">' +
      esc(m.from) + "：</span><span class='chat-text'>" + esc(m.text) + "</span>";
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
