// 思考輔助：主人公推理記錄（角色身份 / 事件當事人 / 規則標記）
window.TL = window.TL || {};
TL.UI = TL.UI || {};

TL.UI.Notes = (function () {
  var S = TL.UI.state;

  function freshNotes() {
    return { roles: {}, culprits: {}, memos: {}, plots: { marks: {} } };
  }

  function ensureNotes() {
    if (!S.notes) S.notes = freshNotes();
    return S.notes;
  }

  function roleCandidates() {
    var mod = MODULES[S.game.script.moduleId];
    var ids = [];
    mod.mainPlots.concat(mod.subplots).forEach(function (pid) {
      var p = PLOT_INDEX[pid];
      (p.roles || []).forEach(function (r) { if (ids.indexOf(r) < 0) ids.push(r); });
    });
    return ids;
  }

  function openNotes() {
    var n = ensureNotes();
    TL.UI.modal({
      title: TL.t("game.notesTitle"),
      text: TL.t("game.notesHint"),
      body: function (el) {
        el.innerHTML =
          '<div class="ref-tabs" id="notes-tabs">' +
          '<button class="ref-tab active" data-tab="roles">' + TL.t("game.notesRoleTab") + "</button>" +
          '<button class="ref-tab" data-tab="culprits">' + TL.t("game.notesCulpritTab") + "</button>" +
          '<button class="ref-tab" data-tab="plots">' + TL.t("game.notesPlotTab") + "</button>" +
          "</div>" +
          '<div style="text-align:right;margin-bottom:10px;"><button class="tl-btn" id="notes-clear">' +
          TL.t("game.notesClearAll") + "</button></div>" +
          '<div id="notes-body"></div>';
        function renderTab(tab) {
          var body = el.querySelector("#notes-body");
          body.innerHTML = "";
          if (tab === "roles") renderNotesRoles(body, n);
          else if (tab === "culprits") renderNotesCulprits(body, n);
          else renderNotesPlots(body, n);
        }
        el.querySelectorAll("#notes-tabs .ref-tab").forEach(function (b) {
          b.addEventListener("click", function () {
            el.querySelectorAll("#notes-tabs .ref-tab").forEach(function (x) { x.classList.toggle("active", x === b); });
            renderTab(b.dataset.tab);
          });
        });
        el.querySelector("#notes-clear").addEventListener("click", function () {
          S.notes = freshNotes();
          n = S.notes;
          renderTab(el.querySelector("#notes-tabs .ref-tab.active").dataset.tab);
        });
        renderTab("roles");
      },
      buttons: [{ label: TL.t("common.close"), value: "close", primary: true }]
    });
  }

  function notesChip(on, label, dataKey) {
    return '<button class="chip' + (on ? " on" : "") + '" data-k="' + dataKey + '">' + TL.escapeHtml(label) + "</button>";
  }

  function renderNotesRoles(body, n) {
    var cands = roleCandidates();
    S.game.script.cast.forEach(function (entry) {
      var cid = entry.characterId;
      var block = document.createElement("div");
      block.className = "notes-block";
      var list = n.roles[cid] || [];
      var chips = cands.map(function (rid) {
        return notesChip(list.indexOf(rid) >= 0, TL.rname(rid), rid);
      }).join("");
      block.innerHTML =
        '<div class="notes-char">' + TL.escapeHtml(TL.cname(cid)) + "　" +
        '<span class="notes-state">' + (list.length ? list.length + " ✓" : TL.t("game.notesUnknown")) + "</span></div>" +
        '<div class="chips">' + chips + "</div>" +
        '<input class="notes-memo" data-cid="' + cid + '" placeholder="' + TL.t("game.notesMemo") + '" value="' +
        TL.escapeHtml((n.memos && n.memos[cid]) || "") + '">';
      body.appendChild(block);
      block.querySelectorAll(".chip").forEach(function (ch) {
        ch.addEventListener("click", function () {
          var l = n.roles[cid] = n.roles[cid] || [];
          var rid = ch.dataset.k;
          var idx = l.indexOf(rid);
          if (idx >= 0) l.splice(idx, 1); else l.push(rid);
          ch.classList.toggle("on");
          block.querySelector(".notes-state").textContent = l.length ? l.length + " ✓" : TL.t("game.notesUnknown");
          TL.UI.core.render();
        });
      });
      block.querySelector(".notes-memo").addEventListener("input", function () {
        n.memos = n.memos || {};
        n.memos[cid] = this.value;
        TL.UI.core.render();
      });
    });
  }

  function renderNotesCulprits(body, n) {
    if (!S.game.script.incidents.length) {
      body.innerHTML = '<div style="color:var(--text-dim);padding:6px;">' + TL.t("editor.none") + "</div>";
      return;
    }
    S.game.script.incidents.forEach(function (inc, idx) {
      var block = document.createElement("div");
      block.className = "notes-block";
      var list = n.culprits[idx] || [];
      var chips = S.game.script.cast.map(function (e) {
        return notesChip(list.indexOf(e.characterId) >= 0, TL.cname(e.characterId), e.characterId);
      }).join("");
      block.innerHTML =
        '<div class="notes-char">' + TL.t("editor.dayX", { n: inc.day }) + "　" +
        TL.escapeHtml(TL.iname(inc.incidentId)) + "　" +
        '<span class="notes-state">' + (list.length ? list.length + " ✓" : TL.t("game.notesUnknown")) + "</span></div>" +
        '<div class="chips">' + chips + "</div>";
      body.appendChild(block);
      block.querySelectorAll(".chip").forEach(function (ch) {
        ch.addEventListener("click", function () {
          var l = n.culprits[idx] = n.culprits[idx] || [];
          var cid = ch.dataset.k;
          var i2 = l.indexOf(cid);
          if (i2 >= 0) l.splice(i2, 1); else l.push(cid);
          ch.classList.toggle("on");
          block.querySelector(".notes-state").textContent = l.length ? l.length + " ✓" : TL.t("game.notesUnknown");
          TL.UI.core.render();
        });
      });
    });
  }

  function renderNotesPlots(body, n) {
    var mod = MODULES[S.game.script.moduleId];
    var marks = n.plots.marks;
    function markOf(pid) { return marks[pid] || "?"; }
    function nextMark(m) { return m === "?" ? "check" : m === "check" ? "cross" : "?"; }
    function roleCounts(roles) {
      var counts = {};
      (roles || []).forEach(function (r) { counts[r] = (counts[r] || 0) + 1; });
      var parts = Object.keys(counts).map(function (rid) { return TL.rname(rid) + "×" + counts[rid]; });
      return parts.length ? parts.join("、") : "—";
    }
    function row(pid, isMain) {
      var p = PLOT_INDEX[pid];
      var m = markOf(pid);
      var block = document.createElement("div");
      block.className = "notes-rule";
      var extra = (TL.desc("plot." + pid, p.desc) || "").replace(/\n/g, " ");
      block.innerHTML =
        '<button class="tri ' + m + '" data-pid="' + pid + '">' + (m === "check" ? "✓" : m === "cross" ? "✗" : "？") + "</button>" +
        '<div class="nr-main">' +
        '<div class="nr-name">' + TL.escapeHtml(TL.pname(pid)) + (isMain ? TL.t("game.notesRuleY") : TL.t("game.notesRuleX")) + "</div>" +
        '<div class="nr-roles">' + TL.t("editor.roleList", { roles: roleCounts(p.roles) }) + "</div>" +
        (extra ? '<div class="nr-extra">' + TL.t("game.notesExtra", { text: TL.escapeHtml(extra) }) + "</div>" : "") +
        "</div>";
      block.querySelector(".tri").addEventListener("click", function () {
        marks[pid] = nextMark(markOf(pid));
        var m2 = marks[pid];
        this.className = "tri " + m2;
        this.textContent = m2 === "check" ? "✓" : m2 === "cross" ? "✗" : "？";
        renderNotesStrip();
        TL.UI.core.render();
      });
      body.appendChild(block);
    }
    mod.mainPlots.forEach(function (pid) { row(pid, true); });
    mod.subplots.forEach(function (pid) { row(pid, false); });
  }

  function renderNotesStrip() {
    var strip = TL.UI.$("notes-strip");
    if (!strip || !S.game) return;
    var marks = (S.notes && S.notes.plots && S.notes.plots.marks) || {};
    var chips = [];
    Object.keys(marks).forEach(function (pid) {
      var m = marks[pid];
      if (m === "?" || !PLOT_INDEX[pid]) return;
      chips.push('<span class="ns-chip ' + m + '">' + (m === "check" ? "✓" : "✗") + " " +
        TL.escapeHtml(TL.pname(pid)) + "</span>");
    });
    if (!chips.length) {
      strip.style.display = "none";
      strip.innerHTML = "";
      return;
    }
    strip.style.display = "flex";
    strip.innerHTML = "<span>" + TL.t("game.notesStrip") + "</span>" + chips.join("");
  }

  return {
    freshNotes: freshNotes,
    ensureNotes: ensureNotes,
    roleCandidates: roleCandidates,
    openNotes: openNotes,
    renderNotesStrip: renderNotesStrip
  };
})();
