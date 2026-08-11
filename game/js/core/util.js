window.TL = window.TL || {};

TL.clone = function (obj) {
  return JSON.parse(JSON.stringify(obj));
};

TL.uid = function () {
  return "id" + Math.random().toString(36).slice(2, 10);
};

TL.escapeHtml = function (s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
};

// 从剧本 JSON 中取得所有需要的身份（按顺序，并应用身份上限合并）
TL.rolesFromScript = function (script) {
  var roles = [];
  var main = PLOT_INDEX[script.mainPlot];
  var subs = script.subplots.map(function (id) { return PLOT_INDEX[id]; });
  var all = [main].concat(subs);
  all.forEach(function (p) {
    if (!p) return;
    (p.roles || []).forEach(function (r) { roles.push(r); });
  });
  // 身份上限合并：例如傳謠人上限1名，多個規則合計也只算1名
  var seen = {};
  var out = [];
  roles.forEach(function (r) {
    var max = TL.roleMax(r);
    if (max == null) { out.push(r); return; }
    seen[r] = (seen[r] || 0) + 1;
    if (seen[r] <= max) out.push(r);
  });
  return out;
};

// 原始（未合并上限）的身份数量
TL.rawRoleCounts = function (script) {
  var counts = {};
  var main = PLOT_INDEX[script.mainPlot];
  var subs = script.subplots.map(function (id) { return PLOT_INDEX[id]; });
  var all = [main].concat(subs);
  all.forEach(function (p) {
    if (!p) return;
    (p.roles || []).forEach(function (r) { counts[r] = (counts[r] || 0) + 1; });
  });
  return counts;
};

// 按上限合并后的身份数量与合并信息
TL.effectiveRoleCounts = function (script) {
  var counts = TL.rawRoleCounts(script);
  var merges = [];
  Object.keys(counts).forEach(function (rid) {
    var max = TL.roleMax(rid);
    if (max != null && counts[rid] > max) {
      merges.push({ role: rid, total: counts[rid], max: max });
      counts[rid] = max;
    }
  });
  return { counts: counts, merges: merges };
};

// 计算某个身份在剧本中的数量（含重复，原始）
TL.roleCounts = function (script) {
  return TL.rawRoleCounts(script);
};

// 剧本中身份上限（模组纸）：親友最多2、傳謠人最多1
TL.roleMax = function (roleId) {
  var r = ROLE_INDEX[roleId];
  return r ? r.max : null;
};

// 检查剧本合法性，返回 { errors: [], warnings: [] }
TL.validateScript = function (script) {
  var errors = [];
  var warnings = [];
  var mod = MODULES[script.moduleId];
  if (!mod) errors.push(TL.t("validate.unknownModule", { id: script.moduleId }));
  if (!script.title) errors.push(TL.t("validate.titleRequired"));
  if (!PLOT_INDEX[script.mainPlot]) errors.push(TL.t("validate.mainRequired"));
  var main = PLOT_INDEX[script.mainPlot];
  if (main && main.module !== "both" && main.module !== script.moduleId) {
    errors.push(TL.t("validate.mainNotInModule", { name: TL.pname(main.id), mod: TL.modname(script.moduleId) }));
  }
  if (script.moduleId === "BTX" && (script.subplots || []).length !== 2) {
    errors.push(TL.t("validate.btxSubs", { mod: TL.modname(script.moduleId) }));
  }
  if (script.moduleId === "FS" && (!script.subplots || script.subplots.length < 1)) {
    errors.push(TL.t("validate.fsSubsMin", { mod: TL.modname(script.moduleId) }));
  }
  if (script.moduleId === "FS" && (script.subplots || []).length > 1) {
    warnings.push({
      code: "fs_multi_x",
      text: TL.t("validate.fsMultiX", { n: script.subplots.length })
    });
  }
  (script.subplots || []).forEach(function (sid) {
    var sp = PLOT_INDEX[sid];
    if (!sp) errors.push(TL.t("validate.unknownSubplot", { id: sid }));
    else if (sp.module !== "both" && sp.module !== script.moduleId) errors.push(TL.t("validate.subplotNotInModule", { name: TL.pname(sid), mod: TL.modname(script.moduleId) }));
  });
  if (!script.loops || script.loops < 1) errors.push(TL.t("validate.loopsMin"));
  if (!script.days || script.days < 1 || script.days > 10) errors.push(TL.t("validate.daysRange"));
  if (!script.cast || script.cast.length < 4) errors.push(TL.t("validate.castMin"));
  // 身份分配（数量按模组纸上限合并：如傳謠人上限1名）
  var eff = TL.effectiveRoleCounts(script);
  var counts = eff.counts;
  eff.merges.forEach(function (m) {
    warnings.push({
      code: "role_cap_merge",
      text: TL.t("validate.roleCapMerge", { role: TL.rname(m.role), total: m.total, max: m.max })
    });
  });
  var assigned = {};
  var extraRoles = script.extraRoles || [];
  var extraWarned = {};
  // 模組身份池（局外人用）
  var modRolePool = [];
  MODULES[script.moduleId].mainPlots.concat(MODULES[script.moduleId].subplots).forEach(function (pid) {
    var pp = PLOT_INDEX[pid];
    (pp.roles || []).forEach(function (r) { if (modRolePool.indexOf(r) < 0) modRolePool.push(r); });
  });
  script.cast.forEach(function (entry) {
    if (!CHAR_INDEX[entry.characterId]) errors.push(TL.t("validate.unknownChar", { id: entry.characterId }));
    if (entry.characterId === "part_time_jobbess") {
      errors.push(TL.t("validate.noPartTimerQ"));
    }
    if (entry.characterId === "mystery_boy") {
      if (!entry.role) {
        errors.push(TL.t("validate.mbRoleRequired"));
      } else {
        if (modRolePool.indexOf(entry.role) < 0) {
          errors.push(TL.t("validate.mbRoleNotInModule", { role: TL.rname(entry.role) }));
        }
        if (counts[entry.role]) {
          errors.push(TL.t("validate.mbRoleMustBeExtra", { role: TL.rname(entry.role) }));
        }
      }
    }
    if (entry.characterId === "copycat") {
      if (entry.role) errors.push(TL.t("validate.copycatNoRole"));
      if (!entry.copyTarget || !script.cast.some(function (e) { return e.characterId === entry.copyTarget; })) {
        errors.push(TL.t("validate.copycatNeedTarget"));
      }
    }
    if (entry.appearLoop != null && (entry.appearLoop < 1 || entry.appearLoop > script.loops)) {
      errors.push(TL.t("validate.appearLoopRange", { name: TL.cname(entry.characterId), loops: script.loops }));
    }
    if (entry.appearDay != null && (entry.appearDay < 1 || entry.appearDay > script.days)) {
      errors.push(TL.t("validate.appearDayRange", { name: TL.cname(entry.characterId), days: script.days }));
    }
    if (entry.role && assigned[entry.role] && counts[entry.role] === 1) {
      errors.push(TL.t("validate.roleDup", { role: entry.role && ROLE_INDEX[entry.role] ? TL.rname(entry.role) : entry.role }));
    }
    if (entry.role) {
      assigned[entry.role] = (assigned[entry.role] || 0) + 1;
      if (assigned[entry.role] > (counts[entry.role] || 0)) {
        if (entry.characterId === "mystery_boy" || extraRoles.indexOf(entry.role) >= 0) {
          if (!extraWarned[entry.role]) {
            extraWarned[entry.role] = true;
            warnings.push({
              code: "extra_role",
              text: TL.t("validate.extraRole", { role: TL.rname(entry.role) })
            });
          }
        } else {
          errors.push(TL.t("validate.roleOver", { role: entry.role && ROLE_INDEX[entry.role] ? TL.rname(entry.role) : entry.role }));
        }
      }
    }
  });
  var hideousActive = !!PLOT_INDEX["a_hideous_script"] && (script.subplots || []).indexOf("a_hideous_script") >= 0;
  Object.keys(counts).forEach(function (rid) {
    // 最黑暗的劇本：暴徒為 0-2 人彈性，不強制全數
    if (hideousActive && rid === "curmudgeon") return;
    if ((assigned[rid] || 0) < counts[rid]) {
      errors.push(TL.t("validate.roleMissing", { role: TL.rname(rid), need: counts[rid] }));
    }
  });
  // 暴徒彈性
  var hideous = PLOT_INDEX["a_hideous_script"];
  if (hideous && (script.subplots || []).indexOf("a_hideous_script") >= 0) {
    var cmCount = assigned["curmudgeon"] || 0;
    if (cmCount < 0 || cmCount > 2) errors.push(TL.t("validate.curmudgeonCount"));
  }
  // 和我簽訂契約吧：關鍵人物必須有少女屬性
  if (main && main.id === "sign_with_me") {
    var kp = script.cast.filter(function (e) { return e.role === "key_person"; })[0];
    if (kp) {
      var ch = CHAR_INDEX[kp.characterId];
      if (!ch || ch.traits.indexOf("少女") < 0) errors.push(TL.t("validate.signGirl", { plot: TL.pname(main.id) }));
    }
  }
  // 事件
  var culprits = {};
  (script.incidents || []).forEach(function (inc) {
    if (!INCIDENT_INDEX[inc.incidentId]) errors.push(TL.t("validate.unknownIncident", { id: inc.incidentId }));
    else if (INCIDENT_INDEX[inc.incidentId].module !== "both" && INCIDENT_INDEX[inc.incidentId].module !== script.moduleId) {
      errors.push(TL.t("validate.incidentNotInModule", { name: TL.iname(inc.incidentId), mod: TL.modname(script.moduleId) }));
    }
    var iname = INCIDENT_INDEX[inc.incidentId] ? TL.iname(inc.incidentId) : inc.incidentId;
    if (!inc.day || inc.day < 1 || inc.day > script.days) errors.push(TL.t("validate.incidentDay", { name: iname }));
    if (!inc.culpritId) errors.push(TL.t("validate.incidentNoCulprit", { name: iname }));
    // 連續殺人允許同一角色擔任多個連續殺人事件的當事人
    if (inc.culpritId) {
      var prevInc = culprits[inc.culpritId];
      if (prevInc && !(prevInc === "serial_murder" && inc.incidentId === "serial_murder")) {
        errors.push(TL.t("validate.culpritDup", { name: CHAR_INDEX[inc.culpritId] ? TL.cname(inc.culpritId) : inc.culpritId }));
      }
      culprits[inc.culpritId] = inc.incidentId;
    }
    if (inc.culpritId && !script.cast.some(function (e) { return e.characterId === inc.culpritId; })) {
      errors.push(TL.t("validate.culpritNotCast"));
    }
    var dupDay = script.incidents.filter(function (o) { return o !== inc && o.day === inc.day; });
    if (dupDay.length) errors.push(TL.t("validate.dupDay"));
  });
  // 擴充模組劇本限制
  var isCulprit = {};
  (script.incidents || []).forEach(function (inc) { if (inc.culpritId) isCulprit[inc.culpritId] = true; });
  function requireCulprit(roleId, plotId) {
    var holder = script.cast.filter(function (e) { return e.role === roleId; })[0];
    if (holder && !isCulprit[holder.characterId]) {
      errors.push(TL.t("validate.roleMustBeCulprit", { role: TL.rname(roleId), plot: TL.pname(plotId) }));
    }
  }
  if ((script.subplots || []).indexOf("i_am_a_master_detective") >= 0) requireCulprit("detective", "i_am_a_master_detective");
  if ((script.subplots || []).indexOf("an_absolute_will") >= 0) requireCulprit("obstinate", "an_absolute_will");
  if ((script.subplots || []).indexOf("tricky_twins") >= 0) requireCulprit("twin", "tricky_twins");
  if ((script.subplots || []).indexOf("isolation_institution_psycho") >= 0) {
    (script.incidents || []).forEach(function (inc) {
      var e = script.cast.filter(function (c) { return c.characterId === inc.culpritId; })[0];
      if (e && e.role === "therapist") errors.push(TL.t("validate.therapistNoCulprit"));
    });
  }
  if ((script.subplots || []).indexOf("worshippers_of_the_apocalypse") >= 0) {
    if (!(script.incidents || []).some(function (inc) { return inc.incidentId === "suicide"; })) {
      errors.push(TL.t("validate.needSuicide", { plot: TL.pname("worshippers_of_the_apocalypse") }));
    }
  }
  if ((script.subplots || []).indexOf("twisted_truth") >= 0) {
    if (!script.cast.some(function (e) { return e.characterId === "informer"; })) {
      errors.push(TL.t("validate.needInformer", { plot: TL.pname("twisted_truth") }));
    }
  }
  if (main && main.id === "male_confrontation") {
    var ninjaEntry = script.cast.filter(function (e) { return e.role === "ninja"; })[0];
    if (ninjaEntry) {
      var ninjaCh = CHAR_INDEX[ninjaEntry.characterId];
      if (!ninjaCh || ninjaCh.traits.indexOf("男性") < 0 || ninjaCh.traits.indexOf("少年") >= 0) {
        errors.push(TL.t("validate.ninjaMale", { plot: TL.pname(main.id) }));
      }
    }
  }
  return { errors: errors, warnings: warnings };
};

// 生成默认剧本
TL.defaultScript = function (moduleId) {
  var mod = MODULES[moduleId];
  var mainPlot = mod.mainPlots[0];
  var subs = mod.subplots.slice(0, mod.subplotsCount);
  var script = {
    id: TL.uid(),
    moduleId: moduleId,
    title: moduleId === "FS" ? "初迴·第一步" : "眾神的未來",
    creator: "劇作家",
    loops: mod.loopRecommend.loops,
    days: mod.loopRecommend.days,
    tableTalk: true,
    mainPlot: mainPlot,
    subplots: subs,
    cast: [],
    incidents: [],
    specialRules: "",
    publicSpecialRules: "",
    note: mod.note
  };
  var roles = TL.rolesFromScript(script);
  // 局外人加入時，身份總數需多1名（不參與規則身份分配）
  var hasOutsider = mod.characters.indexOf("mystery_boy") >= 0;
  var needChars = Math.max(moduleId === "FS" ? 6 : 8, roles.length + (hasOutsider ? 1 : 0));
  var chars = mod.characters.slice(0, Math.min(mod.characters.length, needChars));
  // 局外人：分配模組中存在但規則未帶有的身份（不參與規則身份分配）
  var ruleRoles = {};
  roles.forEach(function (r) { ruleRoles[r] = true; });
  var modRolePool = [];
  MODULES[moduleId].mainPlots.concat(MODULES[moduleId].subplots).forEach(function (pid) {
    var pp = PLOT_INDEX[pid];
    (pp.roles || []).forEach(function (r) { if (modRolePool.indexOf(r) < 0) modRolePool.push(r); });
  });
  var extraRole = modRolePool.filter(function (r) { return !ruleRoles[r]; })[0] || null;
  var roleIdx = 0;
  chars.forEach(function (cid) {
    if (cid === "mystery_boy") {
      script.cast.push({ characterId: cid, role: extraRole, startLoc: CHAR_INDEX[cid].defaultStart });
      return;
    }
    script.cast.push({
      characterId: cid,
      role: roles[roleIdx] || null,
      startLoc: CHAR_INDEX[cid].defaultStart
    });
    roleIdx++;
  });
  // 默认事件
  if (moduleId === "FS") {
    script.incidents = [
      { day: 2, incidentId: "murder", culpritId: "girl_student" },
      { day: 3, incidentId: "missing_person", culpritId: "doctor" },
      { day: 4, incidentId: "hospital_incident", culpritId: "office_worker" }
    ];
  } else {
    // 依模組可用事件與登場角色生成事件（確保事件與當事人都屬於該模組）
    var incPool = (mod.incidents || []).filter(function (id) {
      var d = INCIDENT_INDEX[id];
      return d && (d.module === "both" || d.module === moduleId);
    });
    var days = [2, 4, 5];
    for (var di = 0; di < days.length && di < incPool.length; di++) {
      script.incidents.push({
        day: days[di],
        incidentId: incPool[di],
        culpritId: chars[di % chars.length]
      });
    }
  }
  return script;
};

TL.roleName = function (rid) {
  return ROLE_INDEX[rid] ? TL.rname(rid) : rid;
};
