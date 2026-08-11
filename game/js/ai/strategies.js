// 劇本定制 AI 策略（可拆卸：用戶自定義劇本可 TL.AI.registerStrategy(id, impl)）
// impl: { planExtra(state, p, script), candidates(state, game, p, add), abilityScore(state, game, entry, t, p) }
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

// 讓角色朝目標版圖移動的候選（回傳 {card, targetType, targetId, score} 陣列）
function aiMoveToward(state, add, cid, targetLoc, base) {
  var loc = state.chars[cid] && state.chars[cid].loc;
  if (!loc || loc === targetLoc) return;
  var targetAdj = aiAdjacentOf(targetLoc);
  ["h", "v", "d"].forEach(function (mt) {
    (ADJ[loc] && ADJ[loc][mt] || []).forEach(function (lid) {
      if (targetAdj.indexOf(lid) >= 0) add("m_move_" + mt, "char", cid, base + 8);
    });
  });
  // 無法一步到達時，先往目標方向任意移動（低分兜底）
  if (state.chars[cid]) {
    add("m_move_h", "char", cid, base - 30);
    add("m_move_v", "char", cid, base - 30);
    add("m_move_d", "char", cid, base - 30);
  }
}

// ================= 謀殺計劃（FS 基礎劇本）=================
// 主人公失敗的原因分析：
// 1) 關鍵人物死亡 → 立即失敗。主要途徑：
//    a. 自殺事件：把關鍵人物（或自殺當事人）的不安推到門檻，事件階段當事人死亡。
//    b. 殺手夜殺：關鍵人物密謀2+ 且與殺手同區，回合結束階段殺手殺害關鍵人物。
//    c. 謀殺事件：關鍵人物作為被害人。
// 2) 主人公「全打禁止密謀」＝跳過：禁止密謀只擋密謀牌，擋不住「不安+1」牌與能力，
//    因此以不安/能力為主的加壓路徑可以穿透跳過策略。
var murderPlanStrategy = {
  planExtra: function (state, p, script) {
    p.suicide = null;
    (script.incidents || []).forEach(function (inc) {
      if (inc.incidentId === "suicide" && (!p.suicide || inc.day < p.suicide.day)) {
        p.suicide = { day: inc.day, culprit: inc.culpritId };
      }
    });
    p.suicideTarget = null;
    p.suicideNeed = 0;
    p.suicideIsKp = false;
    if (p.suicide && state.chars[p.suicide.culprit] && state.chars[p.suicide.culprit].alive) {
      var data = CHAR_INDEX[p.suicide.culprit];
      p.suicideTarget = p.suicide.culprit;
      p.suicideNeed = Math.max(0, data.paranoiaLimit - (state.chars[p.suicide.culprit].paranoia || 0));
      p.suicideIsKp = p.suicideTarget === p.kp;
    }
  },
  candidates: function (state, game, p, add) {
    var st = state;
    var kpId = p.kp;
    var killer = p.killer;
    var ct = p.ct;

    // 1) 自殺路徑：不安牌穿透禁止密謀；已達門檻後用禁止不安鎖住，防止主人公移除
    if (p.suicideTarget && st.chars[p.suicideTarget].alive && st.day <= p.suicide.day) {
      var tData = CHAR_INDEX[p.suicideTarget];
      var cur = st.chars[p.suicideTarget].paranoia || 0;
      if (cur < tData.paranoiaLimit) {
        add("m_paranoia_plus", "char", p.suicideTarget, 130);
      } else {
        add("m_forbid_paranoia", "char", p.suicideTarget, 125);
      }
      // 傳謠人靠近自殺當事人，用能力補不安
      if (ct && st.chars[ct].alive && st.chars[ct].loc !== st.chars[p.suicideTarget].loc) {
        aiMoveToward(st, add, ct, st.chars[p.suicideTarget].loc, 95);
      }
    }

    // 2) 殺手夜殺路徑：關鍵人物密謀2+ 且殺手同區
    if (kpId && st.chars[kpId].alive && killer && st.chars[killer].alive) {
      var kpInt = st.chars[kpId].intrigue || 0;
      if (kpInt < 2) {
        add("m_intrigue_plus1", "char", kpId, 108);
        add("m_intrigue_plus2", "char", kpId, 120);
      }
      if (st.chars[killer].loc !== st.chars[kpId].loc) {
        aiMoveToward(st, add, killer, st.chars[kpId].loc, 100);
      } else if (kpInt >= 2) {
        // 已就位且密謀足夠 → 當晚就能殺，轉為繼續加壓
        if (p.suicideTarget) add("m_paranoia_plus", "char", p.suicideTarget, 60);
        else add("m_paranoia_plus", "char", kpId, 60);
      }
    }

    // 3) 殺人狂路徑：移動到只有 1 名其他角色的版圖，夜間強制殺人
    if (p.serial && st.chars[p.serial] && st.chars[p.serial].alive) {
      var serialLoc = st.chars[p.serial].loc;
      var bestLoc = null, bestN = 99;
      aiAdjacentOf(serialLoc).forEach(function (lid) {
        var n = stAlive(state).filter(function (id) {
          return id !== p.serial && st.chars[id].loc === lid;
        }).length;
        if (n < bestN) { bestN = n; bestLoc = lid; }
      });
      if (bestLoc && bestN < 3) aiMoveToward(st, add, p.serial, bestLoc, 88);
    }

    // 4) 保險：不安分散（讓跳過無法一次擋完）
    var press = [p.suicideTarget, kpId].filter(Boolean);
    stAlive(state).slice(0, 4).forEach(function (id) {
      if (id === p.serial || id === killer) return;
      if (press.indexOf(id) >= 0) return;
      add("m_paranoia_plus", "char", id, 35);
    });
  },
  abilityScore: function (state, game, entry, t, p) {
    var eff = entry.ability.effect;
    if (eff === "ct_paranoia" || eff === "faceless_ct") {
      if (t.id === p.suicideTarget) return 120;
      if (t.id === p.kp) return 80;
      return 30;
    }
    if (eff === "brain_intrigue" || eff === "faceless_deep_one") {
      if (t.type === "char" && t.id === p.kp) return 110;
      if (t.type === "char" && t.id === p.suicideTarget) return 75;
      return t.type === "char" ? 35 : 20;
    }
    if (eff === "therapist_remove_paranoia") {
      // 被迫移除不安：選不安最少、影響最小的目標
      return -state.chars[t.id].paranoia * 3;
    }
    if (eff === "magician_move") {
      return (state.chars[t.id].paranoia || 0) * 2;
    }
    return 10;
  }
};

// 註冊：泛用「謀殺計劃」規則Y + 最基礎劇本「THE FIRST SCRIPT」
TL.AI.registerStrategy("murder_plan", murderPlanStrategy);
TL.AI.registerStrategy("the_first_script", murderPlanStrategy);
