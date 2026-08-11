// 劇本定制 AI 策略（純資料 / JSON 風格，由 js/ai/strategies.js 的解釋器執行）
// 結構：
//   pressure[]: { target, cards[], weight, lockCard? }  目標加壓（lockCard＝不安達標時改出的鎖牌）
//   moves[]:    { role, to, weight }                     角色移動（to 可為目標物件或 "isolate"）
//   abilities:  { effect: [target...] }                  能力目標優先序
//   fallbackParanoia: 是否把不安分散到多個角色（穿透「全打禁止密謀」）
// target: { kind: "role", role } | { kind: "incident", incident } | { kind: "char", id }
window.AI_SCRIPT_STRATEGIES = {
  "the_first_script": {
    "name": "THE FIRST SCRIPT（最初的劇本）",
    "pressure": [
      { "target": { "kind": "incident", "incident": "suicide" }, "cards": ["m_paranoia_plus"], "weight": 130, "lockCard": "m_forbid_paranoia" },
      { "target": { "kind": "role", "role": "key_person" }, "cards": ["m_intrigue_plus2", "m_intrigue_plus1"], "weight": 115 }
    ],
    "moves": [
      { "role": "killer", "to": { "kind": "role", "role": "key_person" }, "weight": 100 },
      { "role": "conspiracy_theorist", "to": { "kind": "incident", "incident": "suicide" }, "weight": 95 },
      { "role": "serial_killer", "to": "isolate", "weight": 88 }
    ],
    "abilities": {
      "ct_paranoia": [ { "kind": "incident", "incident": "suicide" }, { "kind": "role", "role": "key_person" } ],
      "brain_intrigue": [ { "kind": "role", "role": "key_person" }, { "kind": "incident", "incident": "suicide" } ]
    },
    "fallbackParanoia": true
  },
  "prologue": {
    "name": "PROLOGUE（序幕）",
    "pressure": [
      { "target": { "kind": "role", "role": "key_person" }, "cards": ["m_intrigue_plus2", "m_intrigue_plus1"], "weight": 125 },
      { "target": { "kind": "role", "role": "lover" }, "cards": ["m_paranoia_plus"], "weight": 120, "lockCard": "m_forbid_paranoia", "lockAt": 3 },
      { "target": { "kind": "role", "role": "lover" }, "cards": ["m_intrigue_plus1"], "weight": 108 },
      { "target": { "kind": "incident", "incident": "suicide" }, "cards": ["m_paranoia_plus"], "weight": 95 }
    ],
    "moves": [
      { "role": "killer", "to": { "kind": "role", "role": "key_person" }, "weight": 100 },
      { "role": "conspiracy_theorist", "to": { "kind": "role", "role": "lover" }, "weight": 92 },
      { "role": "serial_killer", "to": "isolate", "weight": 80 }
    ],
    "abilities": {
      "brain_intrigue": [ { "kind": "role", "role": "key_person" }, { "kind": "role", "role": "lover" } ],
      "ct_paranoia": [ { "kind": "role", "role": "lover" }, { "kind": "role", "role": "key_person" } ]
    },
    "fallbackParanoia": true
  }
};
