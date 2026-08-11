(function () {
  function $(id) { return document.getElementById(id); }

  function renderList() {
    var box = $("preset-list");
    var q = $("preset-search").value.trim().toLowerCase();
    var mod = $("preset-module").value;
    box.innerHTML = "";
    PRESETS.forEach(function (p) {
      if (mod && p.moduleId !== mod) return;
      var title = TL.I18N.name("preset", p.id, p.title);
      if (q && (title + " " + (p.note || "")).toLowerCase().indexOf(q) < 0) return;
      var card = document.createElement("div");
      card.className = "preset-card";
      card.innerHTML =
        '<div class="pc-head">' +
        '<div class="pc-title">' + TL.escapeHtml(title) + "</div>" +
        '<span class="pc-module">' + TL.modname(p.moduleId) + "</span>" +
        "</div>" +
        '<div class="pc-meta">' + TL.t("preset.loopsDays", { loops: p.loops, days: p.days }) +
        " · " + TL.t("preset.castCount", { n: p.cast.length }) + "</div>" +
        (p.note ? '<div class="pc-note">' + TL.escapeHtml(p.note) + "</div>" : "") +
        '<div class="pc-btns">' +
        '<button class="tl-btn tl-btn-primary" data-act="play">' + TL.t("preset.play") + "</button>" +
        '<button class="tl-btn" data-act="detail">' + TL.t("preset.detail") + "</button>" +
        "</div>";
      card.querySelector('[data-act="play"]').addEventListener("click", function () { startMode(p); });
      card.querySelector('[data-act="detail"]').addEventListener("click", function () { viewDetail(p); });
      box.appendChild(card);
    });
    if (!box.children.length) {
      box.innerHTML = '<div style="color:var(--text-faint);padding:20px;text-align:center;">' + TL.t("editor.refEmpty") + "</div>";
    }
  }

  function viewDetail(p) {
    try {
      localStorage.setItem("tl_import_preset_id", p.id);
    } catch (e) {}
    location.href = "editor.html?import=1";
  }

  function startMode(p) {
    var script = TL.clone(p);
    TL.UI.modal({
      title: TL.t("preset.modeTitle"),
      text: TL.t("preset.modeText", { title: TL.I18N.name("preset", p.id, p.title) }),
      body: function (el) {
        el.innerHTML =
          '<div class="mode-list">' +
          '<button class="tl-btn mode-btn" data-mode="hotseat"><b>' + TL.t("preset.modeHotseat") + '</b><span>' + TL.t("preset.modeHotseatDesc") + "</span></button>" +
          '<button class="tl-btn mode-btn" data-mode="ai"><b>' + TL.t("preset.modeAI") + '</b><span>' + TL.t("preset.modeAIDesc") + "</span></button>" +
          '<button class="tl-btn mode-btn" data-mode="online"><b>' + TL.t("preset.modeOnline") + '</b><span>' + TL.t("preset.modeOnlineDesc") + "</span></button>" +
          "</div>";
        el.querySelectorAll(".mode-btn").forEach(function (b) {
          b.addEventListener("click", function () {
            var mode = b.dataset.mode;
            var wrap = b.closest(".tl-modal-wrap");
            if (wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap);
            try { localStorage.setItem("tl_current_script", JSON.stringify(script)); } catch (e) {}
            if (mode === "ai") location.href = "game.html?mode=ai";
            else if (mode === "online") {
              try { localStorage.setItem("tl_preset_script", JSON.stringify(script)); } catch (e) {}
              location.href = "multiplayer.html?preset=1";
            } else {
              location.href = "game.html";
            }
          });
        });
      },
      buttons: [{ label: TL.t("common.cancel"), value: "cancel" }]
    });
  }

  $("preset-search").addEventListener("input", renderList);
  $("preset-module").addEventListener("change", renderList);
  $("btn-back").addEventListener("click", function () { location.href = "index.html"; });

  window.__tlPresetRefresh = function () { renderList(); };
  renderList();
})();
