// 行動牌
window.CARDS = [
  // 主人公牌
  { id: "p_paranoia_plus", name: "不安+1", side: "protagonist", oncePerLoop: false, img: "paranoia_increase.png", desc: "往該角色身上放置1枚[不安]。" },
  { id: "p_paranoia_minus", name: "不安-1", side: "protagonist", oncePerLoop: true, img: "paranoia_decrease.png", desc: "移除該角色身上1枚[不安]。" },
  { id: "p_goodwill_plus1", name: "友好+1", side: "protagonist", oncePerLoop: false, img: "goodwill_increase.png", desc: "往該角色身上放置1枚[友好]。" },
  { id: "p_goodwill_plus2", name: "友好+2", side: "protagonist", oncePerLoop: true, img: "goodwill_double.png", desc: "往該角色身上放置2枚[友好]。" },
  { id: "p_forbid_intrigue", name: "禁止密謀", side: "protagonist", oncePerLoop: false, img: "intrigue_forbid.png", desc: "無效化同一位置上的密謀+1/+2。" },
  { id: "p_forbid_move", name: "禁止移動", side: "protagonist", oncePerLoop: true, img: "movement_forbid.png", desc: "無效化同一角色身上的移動牌。" },
  { id: "p_move_v", name: "移動↑↓", side: "protagonist", oncePerLoop: false, img: "movement_v.png", desc: "該角色向上或向下移動。" },
  { id: "p_move_h", name: "移動←→", side: "protagonist", oncePerLoop: false, img: "movement_h.png", desc: "該角色向左或向右移動。" },
  // 劇作家牌
  { id: "m_paranoia_plus", name: "不安+1", side: "mastermind", oncePerLoop: false, count: 2, img: "paranoia_increase.png", desc: "往該角色身上放置1枚[不安]。" },
  { id: "m_paranoia_minus", name: "不安-1", side: "mastermind", oncePerLoop: false, img: "paranoia_decrease.png", desc: "移除該角色身上1枚[不安]。" },
  { id: "m_forbid_paranoia", name: "禁止不安", side: "mastermind", oncePerLoop: false, img: "paranoia_forbid.png", desc: "無效化同一位置上的不安+1/-1。" },
  { id: "m_forbid_goodwill", name: "禁止友好", side: "mastermind", oncePerLoop: false, img: "goodwill_forbid.png", desc: "無效化同一位置上的友好+1/+2。" },
  { id: "m_intrigue_plus1", name: "密謀+1", side: "mastermind", oncePerLoop: false, img: "intrigue_increase.png", desc: "往該角色或版圖上放置1枚[密謀]。" },
  { id: "m_intrigue_plus2", name: "密謀+2", side: "mastermind", oncePerLoop: true, img: "intrigue_double.png", desc: "往該角色或版圖上放置2枚[密謀]。" },
  { id: "m_move_v", name: "移動↑↓", side: "mastermind", oncePerLoop: false, img: "movement_v.png", desc: "該角色向上或向下移動。" },
  { id: "m_move_h", name: "移動←→", side: "mastermind", oncePerLoop: false, img: "movement_h.png", desc: "該角色向左或向右移動。" },
  { id: "m_move_d", name: "斜向移動", side: "mastermind", oncePerLoop: true, img: "movement_x.png", desc: "該角色對角線移動。" }
];

window.CARD_INDEX = {};
window.CARDS.forEach(function (c) { CARD_INDEX[c.id] = c; });

window.PROTAGONIST_DECK = ["p_paranoia_plus", "p_paranoia_minus", "p_goodwill_plus1", "p_goodwill_plus2", "p_forbid_intrigue", "p_forbid_move", "p_move_v", "p_move_h"];
window.MASTERMIND_DECK = ["m_paranoia_plus", "m_paranoia_plus", "m_paranoia_minus", "m_forbid_paranoia", "m_forbid_goodwill", "m_intrigue_plus1", "m_intrigue_plus2", "m_move_v", "m_move_h", "m_move_d"];
