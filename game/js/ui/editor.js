(function () {
  var SCRIPT = null;
  var selectedChar = null;

  function $(id) { return document.getElementById(id); }

  function moduleOptions(modId) {
    var mod = MODULES[modId];
    var roles = [];
    mod.mainPlots.concat(mod.subplots).forEach(function (pid) {
      var p = PLOT_INDEX[pid];
      (p.roles || []).forEach(function (rid) {
        if (roles.indexOf(rid) < 0) roles.push(rid);
      });
    });
    return roles;
  }

  // ---------- 角色池篩選 ----------
  var poolFilterLang = null;

  function abilityCategory(effect) {
    var map = {
      paranoia_minus: "paranoia", paranoia_plus: "paranoia", paranoia_plus_minus: "paranoia",
      goodwill_plus: "goodwill", goodwill_paranoia_ex: "goodwill", intrigue_to_goodwill: "goodwill",
      intrigue_plus: "intrigue", intrigue_minus: "intrigue", intrigue_minus_location: "intrigue",
      reveal_role: "reveal", reveal_self: "reveal", reveal_culprit: "reveal", reveal_rule_x: "reveal",
      reveal_corpse: "reveal", reveal_same_roles: "reveal",
      kill: "combat", resurrect: "combat", guard_place: "combat", prevent_death: "combat",
      move_any: "move", move_counter: "move", sennin_move_resurrect: "move",
      sister_trigger: "other", servant_add_scope: "other"
    };
    return map[effect] || "other";
  }

  function poolFilterValue() {
    return {
      q: ($("pool-search").value || "").trim().toLowerCase(),
      p: $("f-pool-paranoia").value,
      t: $("f-pool-trait").value,
      a: $("f-pool-ability").value,
      l: $("f-pool-loc").value
    };
  }

  function matchPool(ch) {
    var f = poolFilterValue();
    if (f.p !== "" && String(ch.paranoiaLimit) !== f.p) return false;
    if (f.t && ch.traits.indexOf(f.t) < 0) return false;
    if (f.l && ch.defaultStart !== f.l) return false;
    if (f.a) {
      var ok = (ch.goodwill || []).some(function (g) { return abilityCategory(g.effect) === f.a; });
      if (!ok) return false;
    }
    if (f.q) {
      var hay = [
        TL.cname(ch.id), ch.name,
        (ch.traits || []).join(" "),
        (ch.goodwill || []).map(function (g) { return g.desc; }).join(" "),
        (ch.specials || []).join(" ")
      ].join(" ").toLowerCase();
      if (hay.indexOf(f.q) < 0) return false;
    }
    return true;
  }

  function ensurePoolFilter() {
    if (poolFilterLang === TL.I18N.lang()) return;
    poolFilterLang = TL.I18N.lang();
    var pSel = $("f-pool-paranoia");
    if (!pSel) return;
    var prev = {
      p: pSel.value, t: $("f-pool-trait").value,
      a: $("f-pool-ability").value, l: $("f-pool-loc").value
    };
    var allLabel = TL.t("filter.all");
    pSel.innerHTML = '<option value="">' + TL.escapeHtml(allLabel + " · " + TL.t("editor.paranoiaLimit")) + "</option>" +
      [0, 1, 2, 3, 4].map(function (n) {
        return '<option value="' + n + '">' + n + "</option>";
      }).join("");
    var traits = [];
    CHARACTERS.forEach(function (c) {
      (c.traits || []).forEach(function (t) { if (traits.indexOf(t) < 0) traits.push(t); });
    });
    traits.sort(function (a, b) { return a.localeCompare(b, "zh-Hant"); });
    var tSel = $("f-pool-trait");
    tSel.innerHTML = '<option value="">' + TL.escapeHtml(allLabel + " · " + TL.t("editor.traits")) + "</option>" +
    traits.map(function (t) { return '<option value="' + TL.escapeHtml(t) + '">' + TL.escapeHtml(TL.traitName(t)) + "</option>"; }).join("");
    var cats = [
      ["paranoia", TL.t("filter.abParanoia")],
      ["goodwill", TL.t("filter.abGoodwill")],
      ["intrigue", TL.t("filter.abIntrigue")],
      ["reveal", TL.t("filter.abReveal")],
      ["combat", TL.t("filter.abCombat")],
      ["move", TL.t("filter.abMove")],
      ["other", TL.t("filter.abOther")]
    ];
    var aSel = $("f-pool-ability");
    aSel.innerHTML = '<option value="">' + TL.escapeHtml(allLabel + " · " + TL.t("filter.ability")) + "</option>" +
      cats.map(function (c) { return '<option value="' + c[0] + '">' + TL.escapeHtml(c[1]) + "</option>"; }).join("");
    var lSel = $("f-pool-loc");
    lSel.innerHTML = '<option value="">' + TL.escapeHtml(allLabel + " · " + TL.t("editor.startLoc")) + "</option>" +
      LOCATIONS.map(function (l) { return '<option value="' + l.id + '">' + TL.escapeHtml(TL.lname(l.id)) + "</option>"; }).join("");
    pSel.value = prev.p; tSel.value = prev.t; aSel.value = prev.a; lSel.value = prev.l;
  }

  function resetPoolFilter() {
    ["pool-search", "f-pool-paranoia", "f-pool-trait", "f-pool-ability", "f-pool-loc"].forEach(function (id) {
      $(id).value = "";
    });
    renderPool();
  }

  // 領地（大人物）：僅在登場時顯示
  function renderTurf() {
    var row = $("f-turf-row");
    var sel = $("f-turf");
    if (!row || !sel) return;
    var hasBoss = SCRIPT.cast.some(function (e) { return e.characterId === "boss"; });
    if (!hasBoss) {
      if (SCRIPT.turf) SCRIPT.turf = null;
      row.style.display = "none";
      return;
    }
    row.style.display = "";
    sel.innerHTML = '<option value="">' + TL.t("editor.turfNone") + "</option>" +
      LOCATIONS.filter(function (l) { return !l.offBoard; }).map(function (l) {
        return '<option value="' + l.id + '">' + TL.escapeHtml(TL.lname(l.id)) + "</option>";
      }).join("");
    sel.value = SCRIPT.turf || "";
  }

  function saveScript() {
    SCRIPT.title = $("f-title").value.trim() || "未命名劇本";
    SCRIPT.creator = $("f-creator").value.trim() || "劇作家";
    SCRIPT.loops = Math.max(1, parseInt($("f-loops").value, 10) || 1);
    SCRIPT.days = Math.max(1, Math.min(10, parseInt($("f-days").value, 10) || 1));
    SCRIPT.tableTalk = $("f-talk").value === "true";
    SCRIPT.specialRules = $("f-special").value;
    SCRIPT.publicSpecialRules = $("f-public-special").value;
    SCRIPT.turf = $("f-turf").value || null;
    SCRIPT.allowFinalGuess = $("f-final-guess").checked;
  }

  function castEntry(charId) {
    for (var i = 0; i < SCRIPT.cast.length; i++) {
      if (SCRIPT.cast[i].characterId === charId) return SCRIPT.cast[i];
    }
    return null;
  }

  // 空劇本（編輯器開啟時使用）
  function blankScript(modId) {
    var mod = MODULES[modId] || MODULES.FS;
    return {
      id: TL.uid(),
      moduleId: modId,
      title: TL.t("editor.untitled"),
      creator: "劇作家",
      loops: mod.loopRecommend ? mod.loopRecommend.loops : 3,
      days: mod.loopRecommend ? mod.loopRecommend.days : 4,
      tableTalk: true,
      mainPlot: null,
      subplots: [],
      cast: [],
      incidents: [],
      specialRules: "",
      publicSpecialRules: "",
      turf: null,
      allowFinalGuess: true,
      note: ""
    };
  }

  function newScript(modId) {
    SCRIPT = blankScript(modId);
    SCRIPT.id = TL.uid();
    $("f-module").value = modId;
    $("f-title").value = SCRIPT.title;
    $("f-creator").value = SCRIPT.creator;
    $("f-loops").value = SCRIPT.loops;
    $("f-days").value = SCRIPT.days;
    $("f-talk").value = SCRIPT.tableTalk ? "true" : "false";
    $("f-special").value = SCRIPT.specialRules || "";
    $("f-public-special").value = SCRIPT.publicSpecialRules || "";
    $("f-turf").value = SCRIPT.turf || "";
    $("f-final-guess").checked = SCRIPT.allowFinalGuess !== false;
    selectedChar = SCRIPT.cast[0] ? SCRIPT.cast[0].characterId : null;
    renderAll();
  }

  function loadPreset(id) {
    var p = PRESET_INDEX[id];
    if (!p) return;
    SCRIPT = TL.clone(p);
    SCRIPT.id = TL.uid();
    $("f-module").value = SCRIPT.moduleId;
    $("f-title").value = SCRIPT.title;
    $("f-creator").value = SCRIPT.creator;
    $("f-loops").value = SCRIPT.loops;
    $("f-days").value = SCRIPT.days;
    $("f-talk").value = SCRIPT.tableTalk ? "true" : "false";
    $("f-special").value = SCRIPT.specialRules || "";
    $("f-public-special").value = SCRIPT.publicSpecialRules || "";
    $("f-turf").value = SCRIPT.turf || "";
    $("f-final-guess").checked = SCRIPT.allowFinalGuess !== false;
    selectedChar = SCRIPT.cast[0] ? SCRIPT.cast[0].characterId : null;
    renderAll();
    TL.UI.notify(TL.t("editor.presetLoaded", { title: p.title }));
  }

  function renderAll() {
    ensurePoolFilter();
    renderTurf();
    renderPool();
    renderBoardPreview();
    renderDetail();
    renderMainPlots();
    renderSubPlots();
    renderRoleReq();
    renderIncidents();
    renderCards();
    validate();
  }

  // ---------- 角色池 ----------
  function renderPool() {
    var box = $("character-pool");
    box.innerHTML = "";
    box.className = "pool-grid";
    var shown = 0;
    CHARACTERS.forEach(function (ch) {
      if (!matchPool(ch)) return;
      shown++;
      var entry = castEntry(ch.id);
      var disabledChar = ch.id === "part_time_jobbess";
      var card = document.createElement("div");
      card.className = "pool-card" + (disabledChar ? " disabled" : "") + (entry ? " in-cast" : "") + (selectedChar === ch.id ? " selected" : "");
      card.draggable = !disabledChar;
      var roleName = "";
      if (entry && entry.role) roleName = TL.rname(entry.role);
      var badge = disabledChar
        ? '<div class="badge custom">' + TL.t("editor.unusable") + "</div>"
        : (ch.custom ? '<div class="badge custom">' + TL.t("editor.extBadge") + "</div>" : "");
      card.innerHTML =
        (entry && !disabledChar ? '<div class="remove-x" title="' + TL.t("editor.removeTitle") + '">×</div>' : "") +
        '<img src="assets/chara_live/' + encodeURIComponent(ch.id) + '.png" alt="" draggable="false">' +
        '<div class="cname">' + TL.escapeHtml(TL.cname(ch.id)) + "</div>" +
      '<div class="cstat">' + TL.t("editor.paranoiaShort") + ch.paranoiaLimit + (ch.traits.length ? TL.t("editor.traitsSep") + TL.escapeHtml(TL.traitsName(ch.traits).join("/")) : "") + "</div>" +
        '<div class="crole">' + (roleName ? TL.escapeHtml(roleName) : (entry ? TL.t("editor.commoner") : "")) + "</div>" + badge;
      card.addEventListener("click", function () {
        if (disabledChar) {
          TL.UI.toast(TL.t("validate.noPartTimerQ"), "error");
          return;
        }
        selectedChar = ch.id;
        renderPool();
        renderBoardPreview();
        renderDetail();
      });
      if (!disabledChar) {
        card.addEventListener("dragstart", function (e) {
          e.dataTransfer.setData("text/plain", ch.id);
          e.dataTransfer.effectAllowed = "move";
          card.classList.add("dragging");
        });
        card.addEventListener("dragend", function () { card.classList.remove("dragging"); });
      }
      var x = card.querySelector(".remove-x");
      if (x) {
        x.addEventListener("click", function (ev) {
          ev.stopPropagation();
          removeFromCast(ch.id);
        });
      }
      box.appendChild(card);
    });
    if (!shown) {
      box.innerHTML = '<div style="color:var(--text-faint);font-size:13px;padding:8px;text-align:center;">' +
        TL.t("editor.filterEmpty") + "</div>";
    }
  }

  function removeFromCast(charId) {
    SCRIPT.cast = SCRIPT.cast.filter(function (e) { return e.characterId !== charId; });
    if (selectedChar === charId) selectedChar = null;
    renderAll();
    TL.UI.notify(TL.t("editor.removed", { name: TL.cname(charId) }));
  }

  function addToCast(charId, startLoc) {
    if (castEntry(charId)) return;
    var ch = CHAR_INDEX[charId];
    // 手下的初始區域由劇作家每輪決定，劇本編輯時留空
    var initialLoc = charId === "henchman" ? "" : (startLoc || ch.defaultStart);
    SCRIPT.cast.push({ characterId: charId, role: null, startLoc: initialLoc });
    renderAll();
  }

  // ---------- 開始盤面預覽 ----------
  function renderBoardPreview() {
    var box = $("board-preview");
    box.innerHTML = "";
    LOCATIONS.forEach(function (loc) {
      if (loc.offBoard) return;
      var panel = document.createElement("div");
      panel.className = "location-panel";
      panel.dataset.loc = loc.id;
      var members = SCRIPT.cast.filter(function (e) { return e.startLoc === loc.id; });
      var tokens = members.map(function (e) {
        return makePreviewToken(e);
      }).join("");
      var turfHtml = SCRIPT.turf === loc.id
        ? '<div class="turf-mark"><img src="assets/token/turf.png" alt=""><span>' + TL.t("game.turfTag") + "</span></div>"
        : "";
      panel.innerHTML = '<img class="loc-bg" src="assets/board/' + loc.id + '.png" alt="">' +
        '<div class="loc-name">' + TL.lname(loc.id) + "（" + members.length + "）</div>" +
        '<div class="chars-area">' + tokens + "</div>" +
        turfHtml +
        '<div class="drop-hint" style="position:absolute;bottom:8px;right:10px;z-index:5;font-size:12.5px;color:var(--text-dim);background:rgba(16,11,24,.7);border-radius:6px;padding:2px 8px;">' + TL.t("editor.dropHint") + "</div>";
      panel.addEventListener("dragover", function (e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        panel.classList.add("drag-over");
      });
      panel.addEventListener("dragleave", function () { panel.classList.remove("drag-over"); });
      panel.addEventListener("drop", function (e) {
        e.preventDefault();
        panel.classList.remove("drag-over");
        var cid = e.dataTransfer.getData("text/plain");
        if (!cid || !CHAR_INDEX[cid]) return;
        var entry = castEntry(cid);
        if (entry) {
          entry.startLoc = loc.id;
        } else {
          SCRIPT.cast.push({ characterId: cid, role: null, startLoc: loc.id });
        }
        selectedChar = cid;
        renderAll();
      });
      box.appendChild(panel);
    });
    var distantMembers = SCRIPT.cast.filter(function (e) { return e.startLoc === "distant"; });
    if (distantMembers.length) {
      var note = document.createElement("div");
      note.className = "distant-note";
      note.textContent = TL.lname("distant") + "（場外）：" +
        distantMembers.map(function (e) { return TL.cname(e.characterId); }).join("、");
      box.appendChild(note);
    }
    var undecidedMembers = SCRIPT.cast.filter(function (e) { return !e.startLoc; });
    if (undecidedMembers.length) {
      var note2 = document.createElement("div");
      note2.className = "distant-note";
      note2.textContent = TL.t("editor.henchmanLocNote") + "：" +
        undecidedMembers.map(function (e) { return TL.cname(e.characterId); }).join("、");
      box.appendChild(note2);
    }
    bindPreviewTokens(box);
  }

  function makePreviewToken(entry) {
    var ch = CHAR_INDEX[entry.characterId];
    var roleName = entry.role ? TL.rname(entry.role) : "";
    return '<div class="preview-token" data-cid="' + entry.characterId + '" draggable="true" title="' + TL.escapeHtml(TL.cname(entry.characterId)) +
      (roleName ? "（" + roleName + "）" : "") + '">' +
      '<img src="assets/chara_stand/' + encodeURIComponent(entry.characterId) + '.png" alt="" draggable="false">' +
      '<div class="pt-name">' + TL.escapeHtml(TL.cname(entry.characterId)) + "</div>" +
      (roleName ? '<div class="pt-role">' + TL.escapeHtml(roleName) + "</div>" : "") +
      "</div>";
  }

  function bindPreviewTokens(box) {
    box.querySelectorAll(".preview-token").forEach(function (t) {
      t.addEventListener("dragstart", function (e) {
        e.dataTransfer.setData("text/plain", t.dataset.cid);
        e.dataTransfer.effectAllowed = "move";
        t.classList.add("dragging");
      });
      t.addEventListener("dragend", function () { t.classList.remove("dragging"); });
      t.addEventListener("click", function () {
        selectedChar = t.dataset.cid;
        renderAll();
      });
    });
  }

  // ---------- 角色詳情 / 編輯 ----------
  function renderDetail() {
    var box = $("char-detail");
    if (!selectedChar) {
      box.innerHTML = '<div style="color:var(--text-dim);padding:8px;">' + TL.t("editor.selectPrompt") + "</div>";
      return;
    }
    var ch = CHAR_INDEX[selectedChar];
    var entry = castEntry(ch.id);
    var abHtml = (ch.goodwill || []).map(function (ab, gi) {
      return '<div class="ab">' + TL.t("editor.gwCost", { n: ab.cost }) + (ab.oncePerLoop ? TL.t("editor.perLoopOnce") : "") +
        (ab.cannotBeRefused ? TL.t("editor.cannotRefuse") : "") +
        (ab.locRestriction ? TL.t("editor.restriction", { list: ab.locRestriction.map(function (l) { return TL.lname(l); }).join("、") }) : "") +
        " " + TL.escapeHtml(TL.desc("char." + ch.id + "." + gi, ab.desc)) + "</div>";
    }).join("");
    if (!abHtml) abHtml = '<div class="ab" style="color:#c9b56a;">' + TL.t("editor.noGoodwill") + "</div>";
    var spHtml = (ch.specials || []).map(function (s, si) {
      return '<div class="ab" style="color:#8fc7ff;">' + TL.escapeHtml(TL.desc("char." + ch.id + ".special." + si, s)) + "</div>";
    }).join("");
    var html = '<div class="detail-card">' +
      '<img class="big" src="assets/chara_live/' + encodeURIComponent(ch.id) + '.png" alt="">' +
      '<div class="info">' +
      "<b style='font-size:20px;'>" + TL.escapeHtml(TL.cname(ch.id)) + "</b>" +
      (ch.custom ? ' <span style="color:#c9b56a;font-size:15px;">' + TL.t("editor.extChar") + "</span>" : "") +
      '<div style="margin:4px 0;">' + TL.t("editor.paranoiaLimit") + " <b>" + ch.paranoiaLimit + "</b>" +
      (ch.traits.length ? "　" + TL.t("editor.traits") + " " + TL.escapeHtml(TL.traitsName(ch.traits).join("、")) : "") +
      (ch.forbidden.length ? '　<small style="color:#ff9ba3;">' + TL.t("editor.forbidden") + ch.forbidden.map(function (l) { return TL.lname(l); }).join("、") + "</small>" : "") +
      "</div>" +
      '<div style="color:var(--text-dim);font-size:14px;">' + TL.escapeHtml(TL.desc("chardesc." + ch.id, ch.desc)) + "</div>" +
      (spHtml ? '<div style="margin-top:6px;font-size:14px;color:var(--accent);">' + TL.t("editor.specials") + "</div>" + spHtml : "") +
      '<div style="margin-top:6px;font-size:14px;color:var(--accent);">' + TL.t("editor.goodwillAb") + "</div>" + abHtml;
    // 編輯控制項
    if (entry) {
      var isMB = ch.id === "mystery_boy";
      var isCopycat = ch.id === "copycat";
      var isHenchman = ch.id === "henchman";
      var isServant = ch.id === "maid";
      var isGodly = ch.id === "godly_being";
      var isTransfer = ch.id === "transfer_student";
      // 身份選項
      var roleOpts = "";
      if (isCopycat) {
        roleOpts = '<option value="">' + TL.t("editor.copycatRole") + "</option>";
      } else if (isMB) {
        var requiredRoles = Object.keys(TL.effectiveRoleCounts(SCRIPT).counts);
        roleOpts = '<option value="">' + TL.t("editor.mbRoleSelect") + "</option>";
        moduleOptions(SCRIPT.moduleId).forEach(function (rid) {
          if (requiredRoles.indexOf(rid) >= 0) return;
          roleOpts += '<option value="' + rid + '"' + (entry.role === rid ? " selected" : "") + ">" +
            TL.rname(rid) + "</option>";
        });
      } else {
        roleOpts = '<option value="">' + TL.t("editor.commoner") + "</option>";
        moduleOptions(SCRIPT.moduleId).forEach(function (rid) {
          var max = TL.roleMax(rid);
          roleOpts += '<option value="' + rid + '"' + (entry.role === rid ? " selected" : "") + ">" +
            TL.rname(rid) + (max != null ? TL.t("editor.maxSuffix", { n: max }) : "") + "</option>";
        });
      }
      // 初始區域選項
      var locOpts = "";
      if (isHenchman) {
        locOpts = '<option value="" selected>' + TL.t("editor.henchmanLoc") + "</option>";
      } else if (isServant) {
        ["school", "city"].forEach(function (lid) {
          locOpts += '<option value="' + lid + '"' + (entry.startLoc === lid ? " selected" : "") + ">" + TL.lname(lid) + "</option>";
        });
      } else {
        LOCATIONS.forEach(function (l) {
          if (l.offBoard) return;
          locOpts += '<option value="' + l.id + '"' + (entry.startLoc === l.id ? " selected" : "") + ">" + TL.lname(l.id) + "</option>";
        });
      }
      html += '<div class="detail-actions">' +
        '<div class="tl-field"><label>' + TL.t("editor.role") + '</label><select id="d-role">' + roleOpts + "</select></div>" +
        '<div class="tl-field"><label>' + TL.t("editor.startLoc") + '</label><select id="d-startloc">' + locOpts + "</select></div>" +
        "</div>";
      var extra = "";
      if (isGodly) {
        extra += '<div class="tl-field"><label>' + TL.t("editor.appearLoop") + '</label><input type="number" id="d-appear-loop" min="1" max="' + SCRIPT.loops + '" value="' + (entry.appearLoop || 1) + '"></div>';
      }
      if (isTransfer) {
        extra += '<div class="tl-field"><label>' + TL.t("editor.appearDay") + '</label><input type="number" id="d-appear-day" min="1" max="' + SCRIPT.days + '" value="' + (entry.appearDay || 1) + '"></div>';
      }
      if (isCopycat) {
        var ctOpts = SCRIPT.cast.filter(function (e) { return e.characterId !== "copycat"; }).map(function (e) {
          return '<option value="' + e.characterId + '"' + (entry.copyTarget === e.characterId ? " selected" : "") + ">" +
            TL.escapeHtml(TL.cname(e.characterId)) + "</option>";
        }).join("");
        extra += '<div class="tl-field"><label>' + TL.t("editor.copyTarget") + '</label><select id="d-copy-target">' +
          '<option value="">—</option>' + ctOpts + "</select></div>";
      }
      if (extra) html += '<div class="detail-actions">' + extra + "</div>";
    }
    html += "</div></div>";
    if (entry) {
      html += '<div class="detail-actions">' +
        '<button class="tl-btn tl-btn-danger" id="d-remove">' + TL.t("editor.removeFromCast") + "</button>" +
        "</div>";
    } else {
      html += '<div class="detail-actions">' +
        '<button class="tl-btn tl-btn-primary" id="d-add">' + TL.t("editor.addToCast") + "</button>" +
        "</div>";
    }
    box.innerHTML = html;
    var roleSel = $("d-role");
    if (roleSel) {
      roleSel.addEventListener("change", function () {
        entry.role = roleSel.value || null;
        renderPool();
        renderBoardPreview();
        renderDetail();
        renderRoleReq();
        renderCards();
        validate();
      });
    }
    var locSel = $("d-startloc");
    if (locSel) {
      locSel.addEventListener("change", function () {
        entry.startLoc = locSel.value;
        renderBoardPreview();
        renderCards();
      });
    }
    var loopSel = $("d-appear-loop");
    if (loopSel) {
      loopSel.addEventListener("change", function () {
        entry.appearLoop = Math.max(1, Math.min(SCRIPT.loops, parseInt(this.value, 10) || 1));
        renderDetail();
        renderCards();
        validate();
      });
    }
    var daySel = $("d-appear-day");
    if (daySel) {
      daySel.addEventListener("change", function () {
        entry.appearDay = Math.max(1, Math.min(SCRIPT.days, parseInt(this.value, 10) || 1));
        renderDetail();
        renderCards();
        validate();
      });
    }
    var copySel = $("d-copy-target");
    if (copySel) {
      copySel.addEventListener("change", function () {
        entry.copyTarget = copySel.value || null;
        renderCards();
        validate();
      });
    }
    var addBtn = $("d-add");
    if (addBtn) {
      addBtn.addEventListener("click", function () {
        addToCast(ch.id, ch.defaultStart);
      });
    }
    var rmBtn = $("d-remove");
    if (rmBtn) {
      rmBtn.addEventListener("click", function () { removeFromCast(ch.id); });
    }
  }

  // ---------- 規則選擇 ----------
  function renderMainPlots() {
    var mod = MODULES[SCRIPT.moduleId];
    var box = $("main-plot-list");
    box.innerHTML = "";
    mod.mainPlots.forEach(function (pid) {
      var p = PLOT_INDEX[pid];
      var div = document.createElement("div");
      div.className = "plot-card" + (SCRIPT.mainPlot === pid ? " selected" : "");
      var roleNames = (p.roles || []).map(function (r) { return TL.rname(r); }).join("、");
      div.innerHTML = '<div class="name">' + TL.escapeHtml(TL.pname(pid)) + "</div>" +
        '<div class="desc">' + TL.escapeHtml(TL.desc("plot." + p.id, p.desc)) + "</div>" +
        (roleNames ? '<div class="roles">' + TL.t("editor.roleList", { roles: roleNames }) + "</div>" : "");
      div.addEventListener("click", function () {
        SCRIPT.mainPlot = pid;
        renderAll();
      });
      box.appendChild(div);
    });
  }

  function renderSubPlots() {
    var mod = MODULES[SCRIPT.moduleId];
    var box = $("sub-plot-list");
    box.innerHTML = "";
    mod.subplots.forEach(function (pid) {
      var p = PLOT_INDEX[pid];
      var selected = SCRIPT.subplots.indexOf(pid) >= 0;
      var div = document.createElement("div");
      div.className = "plot-card" + (selected ? " selected" : "");
      var roleNames = (p.roles || []).map(function (r) { return TL.rname(r); }).join("、");
      div.innerHTML = '<div class="name">' + TL.escapeHtml(TL.pname(pid)) + (selected ? " ✓" : "") + "</div>" +
        '<div class="desc">' + TL.escapeHtml(TL.desc("plot." + p.id, p.desc)) + "</div>" +
        (roleNames ? '<div class="roles">' + TL.t("editor.roleList", { roles: roleNames }) + "</div>" : "");
      div.addEventListener("click", function () {
        var idx = SCRIPT.subplots.indexOf(pid);
        if (idx >= 0) SCRIPT.subplots.splice(idx, 1);
        else SCRIPT.subplots.push(pid);
        renderAll();
      });
      box.appendChild(div);
    });
  }

  function renderRoleReq() {
    var box = $("role-req");
    var eff = TL.effectiveRoleCounts(SCRIPT);
    var counts = eff.counts;
    var html = "";
    var assigned = {};
    SCRIPT.cast.forEach(function (e) {
      if (e.role) assigned[e.role] = (assigned[e.role] || 0) + 1;
    });
    Object.keys(counts).forEach(function (rid) {
      var need = counts[rid];
      var have = assigned[rid] || 0;
      var max = TL.roleMax(rid);
      var maxText = max != null ? TL.t("editor.maxSuffix", { n: max }) : "";
      var color = have >= need ? "var(--green)" : "#ff9ba3";
      html += '<div><span style="color:' + color + ';">' + (have >= need ? "✓" : "✗") + "</span> " +
        TL.escapeHtml(TL.rname(rid)) + maxText + "　" + TL.t("editor.needHave", { need: need, have: have }) + "</div>";
    });
    eff.merges.forEach(function (m) {
      html += '<div style="color:#c9b56a;">' + TL.t("editor.roleCapWarn", { role: TL.escapeHtml(TL.rname(m.role)), n: m.total, max: m.max }) + "</div>";
    });
    if (SCRIPT.subplots.indexOf("a_hideous_script") >= 0) {
      html += '<div style="color:var(--text-dim);">' + TL.t("editor.hideousNote") + "</div>";
    }
    if (SCRIPT.moduleId === "FS" && SCRIPT.subplots.length > 1) {
      html += '<div style="color:#c9b56a;">' + TL.t("editor.fsMultiWarn", { n: SCRIPT.subplots.length }) + "</div>";
    }
    box.innerHTML = html;
  }

  // ---------- 事件安排 ----------
  function renderIncidents() {
    var tbody = $("incident-body");
    tbody.innerHTML = "";
    SCRIPT.incidents.forEach(function (inc, idx) {
      var tr = document.createElement("tr");
      var daySel = '<select data-i="' + idx + '" data-k="day">';
      for (var d = 1; d <= SCRIPT.days; d++) {
        daySel += '<option value="' + d + '"' + (inc.day === d ? " selected" : "") + ">" + TL.t("editor.dayX", { n: d }) + "</option>";
      }
      daySel += "</select>";
      var incSel = '<select data-i="' + idx + '" data-k="incident">';
      var mod = MODULES[SCRIPT.moduleId];
      mod.incidents.forEach(function (iid) {
        var def = INCIDENT_INDEX[iid];
        incSel += '<option value="' + iid + '"' + (inc.incidentId === iid ? " selected" : "") + ">" + TL.iname(iid) + "</option>";
      });
      incSel += "</select>";
      var def = INCIDENT_INDEX[inc.incidentId];
      var effectCell = def ? '<td style="text-align:left;font-size:15px;color:var(--text-dim);max-width:260px;">' +
        TL.escapeHtml(TL.desc("incident." + def.id, def.desc)) + "</td>" : "<td>—</td>";
      var culSel = '<select data-i="' + idx + '" data-k="culprit">';
      culSel += '<option value="">—</option>';
      SCRIPT.cast.forEach(function (e) {
        culSel += '<option value="' + e.characterId + '"' + (inc.culpritId === e.characterId ? " selected" : "") + ">" + TL.cname(e.characterId) + "</option>";
      });
      culSel += "</select>";
      tr.innerHTML = "<td>" + daySel + "</td><td>" + incSel + "</td>" + effectCell + "<td>" + culSel + "</td>" +
        '<td><button class="tl-btn tl-btn-danger" data-del="' + idx + '">' + TL.t("editor.remove") + "</button></td>";
      tbody.appendChild(tr);
    });
    tbody.querySelectorAll("select").forEach(function (sel) {
      sel.addEventListener("change", function () {
        var i = parseInt(sel.dataset.i, 10);
        var k = sel.dataset.k;
        if (k === "day") SCRIPT.incidents[i].day = parseInt(sel.value, 10);
        else if (k === "incident") { SCRIPT.incidents[i].incidentId = sel.value; }
        else SCRIPT.incidents[i].culpritId = sel.value || null;
        renderIncidents();
        renderCards();
        validate();
      });
    });
    tbody.querySelectorAll("[data-del]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        SCRIPT.incidents.splice(parseInt(btn.dataset.del, 10), 1);
        renderIncidents();
        renderCards();
        validate();
      });
    });
  }

  // ---------- 劇本卡 / 驗證 ----------
  function renderCards() {
    saveScript();
    var mod = MODULES[SCRIPT.moduleId];
    var main = PLOT_INDEX[SCRIPT.mainPlot];
    var open = $("open-card");
    var secret = $("secret-card");
    var incidentHtml = (SCRIPT.incidents.length ? SCRIPT.incidents.map(function (inc) {
      var def = INCIDENT_INDEX[inc.incidentId];
      return TL.t("editor.dayX", { n: inc.day }) + "　" + (def ? TL.iname(inc.incidentId) : inc.incidentId);
    }).join("<br>") : TL.t("editor.none"));
    open.innerHTML = "<h4>" + TL.t("editor.openCard") + "</h4>" +
      '<div class="row">' + TL.t("editor.scriptRow") + "<b>" + TL.escapeHtml(SCRIPT.title) + "</b></div>" +
      '<div class="row">' + TL.t("editor.moduleRow") + "<b>" + TL.modname(SCRIPT.moduleId) + "</b></div>" +
      '<div class="row">' + TL.t("editor.loopsRow") + "<b>" + SCRIPT.loops + "</b>　" + TL.t("editor.daysRow") + "<b>" + SCRIPT.days + "</b></div>" +
      '<div class="row">' + TL.t("editor.talkRow") + "<b>" + (SCRIPT.tableTalk ? TL.t("editor.yes") : TL.t("editor.no")) + "</b></div>" +
      '<div class="row">' + TL.t("editor.castRow") + "<b>" + SCRIPT.cast.map(function (e) { return TL.cname(e.characterId); }).join("、") + "</b></div>" +
      '<div class="row">' + TL.t("editor.incidentRow") + "<br>" + incidentHtml + "</div>" +
      (SCRIPT.publicSpecialRules ? '<div class="row">' + TL.t("editor.specialRowPublic") + "<br>" + TL.escapeHtml(SCRIPT.publicSpecialRules) + "</div>" : "") +
      (SCRIPT.note ? '<div class="row">' + TL.t("editor.noteRow") + "<br>" + TL.escapeHtml(SCRIPT.note) + "</div>" : "");
    var roleLines = SCRIPT.cast.filter(function (e) { return e.role; }).map(function (e) {
      return TL.cname(e.characterId) + " → " + TL.rname(e.role);
    });
    var culLines = SCRIPT.incidents.map(function (inc) {
      var def = INCIDENT_INDEX[inc.incidentId];
      return TL.t("editor.dayX", { n: inc.day }) + "　" + (def ? TL.iname(inc.incidentId) : inc.incidentId) + " → " + (inc.culpritId ? TL.cname(inc.culpritId) : "—");
    });
    secret.innerHTML = "<h4>" + TL.t("editor.secretCard") + "</h4>" +
      '<div class="row">' + TL.t("editor.mainRow") + "<b>" + (main ? TL.pname(main.id) : "—") + "</b></div>" +
      '<div class="row">' + TL.t("editor.subRow") + "<b>" + SCRIPT.subplots.map(function (sid) { return TL.pname(sid); }).join("、") + "</b></div>" +
      (SCRIPT.specialRules ? '<div class="row">' + TL.t("editor.specialRowSecret") + "<br>" + TL.escapeHtml(SCRIPT.specialRules) + "</div>" : "") +
      (SCRIPT.publicSpecialRules ? '<div class="row">' + TL.t("editor.specialRowPublic") + "<br>" + TL.escapeHtml(SCRIPT.publicSpecialRules) + "</div>" : "") +
      '<div class="row">' + TL.t("editor.roleAssign") + "<br>" + (roleLines.join("<br>") || TL.t("editor.allCommoner")) + "</div>" +
      '<div class="row">' + TL.t("editor.culpritRow") + "<br>" + (culLines.join("<br>") || TL.t("editor.none")) + "</div>";
  }

  function validate() {
    saveScript();
    var v = TL.validateScript(SCRIPT);
    var box = $("validate-out");
    var html = "";
    if (v.errors.length) {
      html += '<div style="color:#ff9ba3;font-weight:700;">' + TL.t("editor.errCount", { n: v.errors.length }) + "</div>" +
        v.errors.map(function (e) { return "• " + TL.escapeHtml(e); }).join("<br>");
    } else {
      html += '<div class="ok">' + TL.t("editor.valid") + "</div>";
    }
    if (v.warnings.length) {
      html += '<div style="color:#c9b56a;margin-top:6px;font-weight:700;">' + TL.t("editor.warnTitle") + "</div>" +
        v.warnings.map(function (w) { return "• " + TL.escapeHtml(w.text); }).join("<br>");
    }
    box.innerHTML = html;
  }

  function hasMultiXNote() {
    return SCRIPT.specialRules.indexOf("【多副規則】") >= 0;
  }

  function prepareAction(action) {
    saveScript();
    var v = TL.validateScript(SCRIPT);
    if (v.errors.length) {
      TL.UI.toast(TL.t("editor.invalidFirst") + "\n" + v.errors.join("\n"), "error");
      return;
    }
    var multiX = v.warnings.filter(function (w) { return w.code === "fs_multi_x"; })[0];
    if (multiX && !hasMultiXNote()) {
      TL.UI.confirm({
        title: TL.t("editor.multiXTitle"),
        text: TL.t("editor.multiXText", { text: multiX.text }),
        okText: TL.t("editor.multiXOk"),
        cancelText: TL.t("common.cancel")
      }).then(function (yes) {
        if (!yes) return;
        SCRIPT.specialRules = (SCRIPT.specialRules ? SCRIPT.specialRules + "\n" : "") +
          TL.t("editor.multiXNote", { n: SCRIPT.subplots.length });
        $("f-special").value = SCRIPT.specialRules;
        action();
      });
      return;
    }
    var extraRole = v.warnings.filter(function (w) { return w.code === "extra_role"; })[0];
    if (extraRole && SCRIPT.specialRules.indexOf("【額外身份】") < 0) {
      TL.UI.confirm({
        title: TL.t("editor.extraRoleTitle"),
        text: TL.t("editor.extraRoleText", { text: extraRole.text }),
        okText: TL.t("editor.extraRoleOk"),
        cancelText: TL.t("common.cancel")
      }).then(function (yes) {
        if (!yes) return;
        SCRIPT.specialRules = (SCRIPT.specialRules ? SCRIPT.specialRules + "\n" : "") +
          TL.t("editor.extraRoleNote");
        $("f-special").value = SCRIPT.specialRules;
        action();
      });
      return;
    }
    action();
  }

  function exportJson() {
    prepareAction(function () {
      saveScript();
      var blob = new Blob([JSON.stringify(SCRIPT, null, 2)], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = (SCRIPT.title || "script") + ".json";
      a.click();
      URL.revokeObjectURL(a.href);
      localStorage.setItem("tl_current_script", JSON.stringify(SCRIPT));
      TL.UI.notify(TL.t("editor.exported"));
    });
  }

  function play() {
    prepareAction(function () {
      saveScript();
      localStorage.setItem("tl_current_script", JSON.stringify(SCRIPT));
      location.href = "game.html";
    });
  }

  // 從編輯器直接開房：把當前劇本帶入聯機大廳
  function playMultiplayer() {
    prepareAction(function () {
      saveScript();
      var json = JSON.stringify(SCRIPT);
      localStorage.setItem("tl_current_script", json);
      localStorage.setItem("tl_preset_script", json);
      location.href = "multiplayer.html?preset=1";
    });
  }

  function loadJson() {
    var input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.addEventListener("change", function () {
      var f = input.files[0];
      if (!f) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var obj = JSON.parse(reader.result);
          if (!obj.moduleId || !obj.cast) throw new Error(TL.t("editor.badFormat"));
          SCRIPT = obj;
          $("f-module").value = obj.moduleId;
          $("f-title").value = obj.title || "";
          $("f-creator").value = obj.creator || "";
          $("f-loops").value = obj.loops || 3;
          $("f-days").value = obj.days || 4;
          $("f-talk").value = obj.tableTalk ? "true" : "false";
          $("f-special").value = obj.specialRules || "";
          $("f-public-special").value = obj.publicSpecialRules || "";
          $("f-turf").value = obj.turf || "";
          $("f-final-guess").checked = obj.allowFinalGuess !== false;
          selectedChar = SCRIPT.cast[0] ? SCRIPT.cast[0].characterId : null;
          renderAll();
          TL.UI.notify(TL.t("editor.loaded"));
        } catch (e) {
          TL.UI.toast(TL.t("editor.loadFail") + e.message, "error");
        }
      };
      reader.readAsText(f);
    });
    input.click();
  }

  // ---------- 規則參考（模組紙） ----------
  function openRulesRef() {
    TL.UI.modal({
      title: TL.t("editor.refTitle"),
      text: TL.t("editor.refText"),
      body: function (bodyEl) {
        var tabs = [
          TL.t("editor.refTabY"), TL.t("editor.refTabX"), TL.t("editor.refTabRole"),
          TL.t("editor.refTabIncident"), TL.t("editor.refTabChar"), TL.t("editor.refTabCard"),
          TL.t("editor.refTabOriginal")
        ];
        var tabHtml = tabs.map(function (t, i) {
          return '<button class="ref-tab' + (i === 0 ? " active" : "") + '" data-tab="' + i + '">' + t + "</button>";
        }).join("");
        var paperOnlyModules = ["AH", "HS", "HSA", "LL", "OF"];
        var allModuleIds = Object.keys(MODULES);
        paperOnlyModules.forEach(function (mid) { if (allModuleIds.indexOf(mid) < 0) allModuleIds.push(mid); });
        var moduleOptions = [""].concat(allModuleIds).map(function (mid) {
          return '<option value="' + mid + '"' + (mid === "" ? " selected" : "") + ">" +
            (mid === "" ? TL.t("editor.refModuleAll") : TL.modname(mid)) + "</option>";
        }).join("");
        bodyEl.innerHTML = '<div class="ref-tabs">' + tabHtml + "</div>" +
          '<div class="ref-toolbar"><label>' + TL.t("editor.refModule") + '</label>' +
          '<select id="ref-module">' + moduleOptions + "</select></div>" +
          '<input class="ref-search" id="ref-search" type="text" placeholder="' + TL.t("editor.refSearch") + '">' +
          '<div class="ref-list" id="ref-list"></div>';
        var currentTab = 0;
        var search = "";
        var moduleId = "";
        function renderRefList() {
          var list = bodyEl.querySelector("#ref-list");
          list.innerHTML = "";
          if (currentTab === 6) {
            renderOriginal(list);
            return;
          }
          var items = refTabData(currentTab, search, moduleId);
          if (!items.length) { list.innerHTML = '<div style="color:var(--text-dim);">' + TL.t("editor.refEmpty") + "</div>"; return; }
          items.forEach(function (it) {
            var div = document.createElement("div");
            div.className = "ref-item";
            div.innerHTML = '<div class="ri-name">' + it.name + '</div>' +
              (it.meta ? '<div class="ri-meta">' + it.meta + "</div>" : "") +
              '<div class="ri-desc">' + it.desc + "</div>";
            list.appendChild(div);
          });
        }
        function renderOriginal(list) {
          // 原版模组纸：基础五模组 + 十周年相关模组（AH/HS/HSA/LL/OF）
          var paperMap = {
            FS: "FS", BTX: "BTX", MC: "MC", MZ: "MZ", WM: "WM",
            AHR: "AH", AH: "AH", HS: "HS", HSA: "HSA", LL: "LL", OF: "OF"
          };
          var mids = moduleId ? [moduleId] : ["FS", "BTX", "MC", "MZ", "WM", "AHR", "HS", "HSA", "LL", "OF"];
          mids.forEach(function (mid) {
            var img = document.createElement("img");
            img.className = "ref-original";
            img.src = "assets/rules/" + (paperMap[mid] || mid) + ".png";
            img.alt = mid;
            img.addEventListener("error", function () {
              if (img.parentNode) img.parentNode.removeChild(img);
            });
            list.appendChild(img);
          });
          if (!list.children.length) {
            list.innerHTML = '<div style="color:var(--text-dim);">' + TL.t("editor.refEmpty") + "</div>";
          }
        }
        bodyEl.querySelectorAll(".ref-tab").forEach(function (btn) {
          btn.addEventListener("click", function () {
            currentTab = parseInt(btn.dataset.tab, 10);
            bodyEl.querySelectorAll(".ref-tab").forEach(function (b) { b.classList.toggle("active", b === btn); });
            renderRefList();
          });
        });
        bodyEl.querySelector("#ref-search").addEventListener("input", function () {
          search = this.value.trim().toLowerCase();
          renderRefList();
        });
        bodyEl.querySelector("#ref-module").addEventListener("change", function () {
          moduleId = this.value;
          renderRefList();
        });
        renderRefList();
      },
      buttons: [{ label: TL.t("common.close"), value: "close" }]
    });
  }

  function refTabData(tabIdx, search, moduleId) {
    var out = [];
    var modTag = function (m) { return m === "both" ? "FS/BTX" : m; };
    var modOk = function (m) {
      if (!moduleId) return true;
      if (m === "both") return moduleId === "FS" || moduleId === "BTX";
      return m === moduleId;
    };
    var plotModOk = function (pid) {
      if (!moduleId) return true;
      var p = PLOT_INDEX[pid];
      if (!p) return false;
      return modOk(p.module);
    };
    function pass(text) {
      if (!search) return true;
      return String(text).toLowerCase().indexOf(search) >= 0;
    }
    if (tabIdx === 0) {
      MAIN_PLOTS.forEach(function (p) {
        if (!modOk(p.module) || !pass(TL.pname(p.id) + p.desc)) return;
        out.push({
          name: TL.pname(p.id),
          meta: TL.t("editor.ruleY") + " · " + TL.t("editor.moduleTag", { m: modTag(p.module) }) +
            (p.roles && p.roles.length ? " · " + TL.t("editor.roleList", { roles: p.roles.map(function (r) { return TL.rname(r); }).join("、") }) : ""),
          desc: TL.desc("plot." + p.id, p.desc)
        });
      });
    } else if (tabIdx === 1) {
      SUB_PLOTS.forEach(function (p) {
        if (!modOk(p.module) || !pass(TL.pname(p.id) + p.desc)) return;
        out.push({
          name: TL.pname(p.id),
          meta: TL.t("editor.ruleX") + " · " + TL.t("editor.moduleTag", { m: modTag(p.module) }) +
            (p.roles && p.roles.length ? " · " + TL.t("editor.roleList", { roles: p.roles.map(function (r) { return TL.rname(r); }).join("、") }) : ""),
          desc: TL.desc("plot." + p.id, p.desc)
        });
      });
    } else if (tabIdx === 2) {
      ROLES.forEach(function (r) {
        if (!(r.appearsIn || []).some(plotModOk) || !pass(TL.rname(r.id))) return;
        var refusal = r.refusal === "optional" ? TL.t("editor.refusalOpt") : r.refusal === "mandatory" ? TL.t("editor.refusalMand") : "";
        var abDesc = (r.abilities || []).map(function (a) {
          return TL.desc("role." + r.id + "." + a.effect, a.desc);
        }).join("<br>");
        out.push({
          name: TL.rname(r.id),
          meta: (r.max ? TL.t("editor.maxCap", { n: r.max }) : TL.t("editor.noCap")) + (refusal ? " · " + refusal : "") + (r.undying ? " · " + TL.t("editor.undying") : "") +
            " · " + TL.t("editor.appearsIn", { list: r.appearsIn.map(function (pid) { return PLOT_INDEX[pid] ? TL.pname(pid) : pid; }).join("、") }),
          desc: abDesc || TL.t("editor.noAbility")
        });
      });
    } else if (tabIdx === 3) {
      INCIDENTS.forEach(function (inc) {
        if (!modOk(inc.module) || !pass(TL.iname(inc.id) + inc.desc)) return;
        out.push({
          name: TL.iname(inc.id),
          meta: TL.t("editor.moduleTag", { m: modTag(inc.module) }) + (inc.extraCondition ? " · " + TL.t("editor.extraCond", { desc: TL.desc("incident." + inc.id + ".cond", inc.extraCondition.desc) }) : ""),
          desc: TL.desc("incident." + inc.id, inc.desc)
        });
      });
    } else if (tabIdx === 4) {
      CHARACTERS.forEach(function (ch) {
        if (!modOk(ch.module) || !pass(TL.cname(ch.id) + (ch.traits || []).join("") + (ch.specials || []).join("") + (ch.goodwill || []).map(function (g) { return g.desc; }).join(""))) return;
        var abDesc = (ch.goodwill || []).map(function (g, gi) {
          return TL.t("editor.gwCost", { n: g.cost }) + (g.oncePerLoop ? TL.t("editor.perLoopOnce") : "") + (g.cannotBeRefused ? TL.t("editor.cannotRefuse") : "") + " " +
            TL.desc("char." + ch.id + "." + gi, g.desc);
        }).join("<br>") || TL.t("editor.tempNoGoodwill");
        var spDesc = (ch.specials || []).map(function (s, si) {
          return TL.t("editor.specials") + TL.desc("char." + ch.id + ".special." + si, s);
        }).join("<br>");
        out.push({
          name: TL.cname(ch.id),
          meta: TL.t("editor.moduleTag", { m: modTag(ch.module) }) + " · " + TL.t("editor.paranoiaLimit") + " " + ch.paranoiaLimit +
            (ch.traits.length ? " · " + TL.t("editor.traits") + " " + TL.traitsName(ch.traits).join("、") : "") +
            (ch.forbidden.length ? " · " + TL.t("editor.forbidden") + ch.forbidden.map(function (l) { return TL.lname(l); }).join("、") : "") +
            (ch.custom ? " · " + TL.t("editor.extRoleTag") : ""),
          desc: abDesc + (spDesc ? (abDesc ? "<br>" : "") + spDesc : "")
        });
      });
    } else {
      CARDS.forEach(function (c) {
        if (!pass(TL.cardname(c.id) + c.desc)) return;
        out.push({
          name: TL.cardname(c.id) + (c.side === "mastermind" ? TL.t("editor.mmSide") : TL.t("editor.pSide")),
          meta: (c.oncePerLoop ? TL.t("editor.perLoop1") : TL.t("editor.unlimited")) + (c.count ? " · " + TL.t("editor.cardCount", { n: c.count }) : ""),
          desc: TL.desc("card." + c.id, c.desc)
        });
      });
    }
    return out;
  }

  // ---------- 導入預設劇本 ----------
  function openImportPreset() {
    TL.UI.modal({
      title: TL.t("editor.importPreset"),
      text: TL.t("editor.importPresetHint"),
      body: function (el) {
        el.innerHTML =
          '<input class="ref-search" id="import-search" type="text" placeholder="' + TL.t("editor.importSearch") + '">' +
          '<div class="ref-list" id="import-list"></div>';
        function renderList(search) {
          var list = el.querySelector("#import-list");
          list.innerHTML = "";
          PRESETS.forEach(function (p) {
            var title = TL.I18N.name("preset", p.id, p.title);
            if (search && title.toLowerCase().indexOf(search) < 0) return;
            var div = document.createElement("div");
            div.className = "ref-item";
            div.innerHTML = '<div class="ri-name">' + TL.escapeHtml(title) + '</div>' +
              '<div class="ri-meta">' + TL.modname(p.moduleId) + " · " + TL.t("editor.loopsRow") + p.loops +
              "　" + TL.t("editor.daysRow") + p.days + " · " + p.cast.length + " 名角色</div>" +
              '<div class="ri-desc">' + TL.escapeHtml(p.note || "") + "</div>";
            div.addEventListener("click", function () {
              loadPreset(p.id);
              var wrap = div.closest(".tl-modal-wrap");
              if (wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap);
            });
            list.appendChild(div);
          });
          if (!list.children.length) list.innerHTML = '<div style="color:var(--text-dim);padding:6px;">' + TL.t("editor.refEmpty") + "</div>";
        }
        el.querySelector("#import-search").addEventListener("input", function () {
          renderList(this.value.trim().toLowerCase());
        });
        renderList("");
      },
      buttons: [{ label: TL.t("common.close"), value: "close", primary: true }]
    });
  }

  // ---------- 角色池側邊欄（可收起） ----------
  function togglePool() {
    var wrap = document.querySelector(".editor-wrap");
    var collapsed = wrap.classList.toggle("pool-collapsed");
    $("pool-toggle").textContent = collapsed ? "⏵" : "⏴";
    try { localStorage.setItem("tl_pool_collapsed", collapsed ? "1" : "0"); } catch (e) {}
  }

  // ---------- 綁定 ----------
  $("f-module").addEventListener("change", function () { newScript(this.value); });
  $("f-turf").addEventListener("change", function () {
    SCRIPT.turf = this.value || null;
    renderAll();
  });
  ["f-title", "f-creator", "f-loops", "f-days", "f-talk", "f-special", "f-public-special"].forEach(function (id) {
    $(id).addEventListener("input", function () { saveScript(); renderCards(); validate(); });
  });
  $("f-days").addEventListener("change", function () {
    SCRIPT.incidents = SCRIPT.incidents.filter(function (inc) { return inc.day <= SCRIPT.days; });
    renderIncidents();
    renderCards();
    validate();
  });
  $("btn-add-incident").addEventListener("click", function () {
    if (SCRIPT.incidents.length >= SCRIPT.days) { TL.UI.notify(TL.t("editor.maxIncidents")); return; }
    var usedDays = SCRIPT.incidents.map(function (i) { return i.day; });
    var day = 1;
    while (usedDays.indexOf(day) >= 0 && day <= SCRIPT.days) day++;
    if (day > SCRIPT.days) day = 1;
    SCRIPT.incidents.push({ day: day, incidentId: MODULES[SCRIPT.moduleId].incidents[0], culpritId: null });
    renderIncidents();
    renderCards();
    validate();
  });
  $("btn-export").addEventListener("click", exportJson);
  $("btn-play").addEventListener("click", play);
  $("btn-multiplayer").addEventListener("click", playMultiplayer);
  $("btn-load").addEventListener("click", loadJson);
  $("btn-ref").addEventListener("click", openRulesRef);
  $("btn-import-preset").addEventListener("click", openImportPreset);
  $("pool-toggle").addEventListener("click", togglePool);
  $("pool-expand").addEventListener("click", togglePool);
  $("pool-search").addEventListener("input", renderPool);
  ["f-pool-paranoia", "f-pool-trait", "f-pool-ability", "f-pool-loc"].forEach(function (id) {
    $(id).addEventListener("change", renderPool);
  });
  $("pool-filter-reset").addEventListener("click", resetPoolFilter);

  // 語言切換時重新渲染（供頁面上的語言下拉框呼叫）
  window.__tlEditorRefresh = function () {
    renderAll();
  };

  newScript("FS");
  try {
    if (localStorage.getItem("tl_pool_collapsed") === "1") {
      document.querySelector(".editor-wrap").classList.add("pool-collapsed");
      $("pool-toggle").textContent = "⏵";
    }
    if (location.search.indexOf("import=1") >= 0) {
      var pid = localStorage.getItem("tl_import_preset_id");
      if (pid && PRESET_INDEX[pid]) loadPreset(pid);
    }
  } catch (e) {}
})();
