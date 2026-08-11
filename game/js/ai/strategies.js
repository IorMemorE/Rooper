// 劇本定制 AI 策略解釋器：讀取 js/data/ai-strategies.js 的 JSON 資料並生成策略
// 用戶自定義劇本可自行往 AI_SCRIPT_STRATEGIES 加入條目（或 TL.AI.registerStrategy 直接註冊函式策略）
window.TL = window.TL || {};

// 工具：與某版圖相鄰的所有版圖
function aiAdjacentOf(loc) {
  var out = [];
  ["h", "v", "d"].forEach(function (mt) {
    (ADJ[loc] && ADJ[loc][mt] || []).forEach(function (lid) {
      if (out.indexOf(lid) < 0) out.push(lid);
    });
  });
  return out;
}

function stAlive(state) {
  return Object.keys(state.chars).filter(function (id) {
    return state.chars[id].alive && state.chars[id].onStage !== false;
  });
}

// BFS 距離（版圖之間的最短步數）
function aiDist(from, to) {
  if (from === to) return 0;
  var seen = {};
  seen[from] = true;
  var frontier = [from];
  var d = 0;
  while (frontier.length) {
    d++;
    var next = [];
    for (var i = 0; i < frontier.length; i++) {
      var locs = aiAdjacentOf(frontier[i]);
      for (var j = 0; j < locs.length; j++) {
        var lid = locs[j];
        if (lid === to) return d;
        if (!seen[lid]) { seen[lid] = true; next.push(lid); }
      }
    }
    frontier = next;
  }
  return 999;
}

// 讓角色朝目標版圖移動的候選
function aiMoveToward(state, add, cid, targetLoc, base) {
  var loc = state.chars[cid] && state.chars[cid].loc;
  if (!loc || loc === targetLoc) return;
  var d0 = aiDist(loc, targetLoc);
  var found = false;
  ["h", "v", "d"].forEach(function (mt) {
    (ADJ[loc] && ADJ[loc][mt] || []).forEach(function (lid) {
      var d1 = aiDist(lid, targetLoc);
      if (d1 < d0) {
        found = true;
        add("m_move_" + mt, "char", cid, base + 8 + (d0 - d1) * 12);
      }
    });
  });
  if (!found && state.chars[cid]) {
    add("m_move_h", "char", cid, base - 30);
    add("m_move_v", "char", cid, base - 30);
    add("m_move_d", "char", cid, base - 30);
  }
}

// 解析 JSON 目標描述 → 角色 id（不存在/死亡時回傳 null）
function resolveTarget(state, script, t) {
  if (!t) return null;
  if (t.kind === "char") return state.chars[t.id] ? t.id : null;
  if (t.kind === "role") {
    var found = Object.keys(state.chars).filter(function (id) {
      return state.chars[id].role === t.role && state.chars[id].alive;
    })[0];
    return found || null;
  }
  if (t.kind === "incident") {
    var inc = (script.incidents || []).filter(function (x) { return x.incidentId === t.incident; })
      .sort(function (a, b) { return a.day - b.day; })[0];
    return (inc && state.chars[inc.culpritId] && state.chars[inc.culpritId].alive) ? inc.culpritId : null;
  }
  return null;
}

// 由 JSON 設定生成策略
function makeJsonStrategy(cfg) {
  return {
    planExtra: function (state, p, script) {
      p.ai = {
        press: [],
        moves: cfg.moves || [],
        abilities: cfg.abilities || {},
        fallbackParanoia: !!cfg.fallbackParanoia
      };
      (cfg.pressure || []).forEach(function (e) {
        var id = resolveTarget(state, script, e.target);
        if (id) p.ai.press.push({
          id: id, cards: e.cards || [], weight: e.weight || 50,
          lockCard: e.lockCard || null, lockAt: (e.lockAt != null ? e.lockAt : null)
        });
      });
      p.ai.kp = resolveTarget(state, script, { kind: "role", role: "key_person" });
      p.ai.suicideCulprit = resolveTarget(state, script, { kind: "incident", incident: "suicide" });
    },
    candidates: function (state, game, p, add) {
      var st = state;
      if (!p.ai) return;
      // 1) 壓力牌（不安穿透禁止密謀；達標後用鎖牌防移除）
      p.ai.press.forEach(function (e) {
        var c = st.chars[e.id];
        if (!c || !c.alive) return;
        var threshold = (e.lockAt != null) ? e.lockAt : (CHAR_INDEX[e.id].paranoiaLimit || 0);
        var atLimit = c.paranoia >= threshold;
        if (e.lockCard && atLimit) {
          add(e.lockCard, "char", e.id, e.weight + 10);
        } else {
          (e.cards || []).forEach(function (card, i) {
            add(card, "char", e.id, e.weight - i * 2);
          });
        }
      });
      // 2) 移動
      p.ai.moves.forEach(function (m) {
        var cid = resolveTarget(state, game.script, { kind: "role", role: m.role });
        if (!cid || !st.chars[cid] || !st.chars[cid].alive) return;
        if (m.to === "isolate") {
          var sl = st.chars[cid].loc;
          var best = null, bestN = 99;
          aiAdjacentOf(sl).forEach(function (lid) {
            var n = stAlive(state).filter(function (id) { return id !== cid && st.chars[id].loc === lid; }).length;
            if (n < bestN) { bestN = n; best = lid; }
          });
          if (best && bestN < 3) aiMoveToward(st, add, cid, best, m.weight);
        } else {
          var toId = resolveTarget(state, game.script, m.to);
          if (toId && st.chars[cid].loc !== st.chars[toId].loc) {
            aiMoveToward(st, add, cid, st.chars[toId].loc, m.weight);
          }
        }
      });
      // 3) 不安分散（讓「全打禁止密謀」無法一次擋完）
      if (p.ai.fallbackParanoia) {
        var pressIds = p.ai.press.map(function (e) { return e.id; });
        stAlive(state).slice(0, 4).forEach(function (id) {
          if (pressIds.indexOf(id) >= 0) return;
          add("m_paranoia_plus", "char", id, 32);
        });
      }
    },
    abilityScore: function (state, game, entry, t, p) {
      if (!p.ai) return 10;
      var pri = p.ai.abilities[entry.ability.effect] || [];
      for (var i = 0; i < pri.length; i++) {
        if (resolveTarget(state, game.script, pri[i]) === t.id) return 110 - i * 15;
      }
      if (t.id === p.ai.kp) return 60;
      if (t.id === p.ai.suicideCulprit) return 55;
      return 20;
    }
  };
}

// 註冊 JSON 資料中的每個劇本策略
Object.keys(AI_SCRIPT_STRATEGIES || {}).forEach(function (sid) {
  TL.AI.registerStrategy(sid, makeJsonStrategy(AI_SCRIPT_STRATEGIES[sid]));
});
