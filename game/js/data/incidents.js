// 事件定义（FS+BTX 模組紙）
// module: FS | BTX | both
// extraCondition 表示除了當事人生存與不安達標外還需要滿足的條件
window.INCIDENTS = [
  {
    id: "murder", name: "謀殺", module: "both",
    desc: "與當事人位於同一區域的另外1名角色死亡。",
    target: "char_other", effect: "kill_other_in_location"
  },
  {
    id: "increasing_unease", name: "不安擴散", module: "both",
    desc: "往任意1名角色身上放置2枚[不安]，隨後往另外1名角色身上放置1枚[密謀]。",
    target: "two_chars", effect: "paranoia2_then_intrigue1"
  },
  {
    id: "foul_evil", name: "邪氣污染", module: "BTX",
    desc: "往神社放置2枚[密謀]。",
    target: "none", effect: "shrine_intrigue2"
  },
  {
    id: "suicide", name: "自殺", module: "both",
    desc: "當事人死亡。",
    target: "none", effect: "culprit_dies"
  },
  {
    id: "hospital_incident", name: "醫院事故", module: "both",
    desc: "醫院有1枚或以上[密謀]→位於醫院的所有角色死亡。醫院有2枚或以上[密謀]→主人公死亡。",
    target: "none", effect: "hospital_incident",
    extraCondition: { type: "location_intrigue", location: "hospital", count: 1, desc: "醫院有1枚或以上[密謀]" }
  },
  {
    id: "faraway_murder", name: "遠距離殺人", module: "both",
    desc: "任意1名身上有2枚或以上[密謀]的角色死亡。",
    target: "char_with_intrigue2", effect: "faraway_kill"
  },
  {
    id: "missing_person", name: "失蹤", module: "both",
    desc: "將當事人移動至任意版圖。隨後，往當事人所在版圖放置1枚[密謀]。",
    target: "location", effect: "move_culprit_place_intrigue"
  },
  {
    id: "spreading", name: "散播", module: "both",
    desc: "從任意1名角色身上移除2枚[友好]，隨後，往另外1名角色身上放置2枚[友好]。",
    target: "two_chars", effect: "goodwill_swap"
  },
  {
    id: "butterfly_effect", name: "蝴蝶效應", module: "BTX",
    desc: "選擇與當事人位於同一區域的任意1名角色，往該角色身上放置1枚[友好]、[不安]或[密謀]。",
    target: "char_choice_counter", effect: "butterfly"
  },
  // ================= 十周年（觀測者之書）事件 =================
  {
    id: "the_light_of_hope", name: "希望之光", module: "both",
    desc: "（通過友好指示物數量判定是否發生）隊長選擇1名角色，往那名角色身上放置1枚[希望]。",
    target: "char_any", effect: "light_of_hope"
  },
  {
    id: "the_murk_of_despair", name: "絕望之暗", module: "both",
    desc: "往任意1名角色身上放置1枚[絕望]。",
    target: "char_any", effect: "murk_of_despair"
  },
  // ================= AHR 事件 =================
  {
    id: "crime_of_passion", name: "衝動殺人", module: "AHR",
    desc: "（當事人不安限度－1）與當事人位於同一區域的另外1名角色死亡。",
    target: "char_other", effect: "kill_other_in_location",
    extraCondition: { type: "culprit_limit_minus1" }
  },
  {
    id: "dimensional_distortion", name: "次元轉換", module: "AHR",
    desc: "（當事人存活時必定發生）進行世界移動。",
    target: "none", effect: "dimensional_distortion",
    alwaysTriggers: true
  },
  {
    id: "dimensional_perversion", name: "次元歪曲", module: "AHR",
    desc: "可以進行世界移動。往任意1名角色身上放置2枚[不安]，往另外1名角色身上放置2枚[友好]。",
    target: "none", effect: "dimensional_perversion"
  },
  {
    id: "dimensional_fracture", name: "次元斷層", module: "AHR",
    desc: "可以進行世界移動。隨後，若當事人身上有3種或以上不同指示物→主人公死亡。",
    target: "none", effect: "dimensional_fracture"
  },
  {
    id: "left_behind", name: "遺失物", module: "AHR",
    desc: "往與當事人位於同一區域中的任意1名角色身上放置1枚[密謀]。隨後，將當事人移動至任意版圖。",
    target: "char_then_loc", effect: "left_behind"
  },
  {
    id: "phantasmal_incident", name: "空想事件", module: "AHR",
    desc: "（通過密謀指示物判定是否發生）從衝動殺人、次元歪曲或者遺失物中選擇1個事件並處理。",
    target: "none", effect: "phantasmal_incident"
  },
  {
    id: "last_will", name: "遺言", module: "AHR",
    desc: "當事人死亡。下輪輪迴開始時，主人公獲得「希望+1」。",
    target: "none", effect: "last_will"
  },
  {
    id: "the_singularity", name: "奇點", module: "AHR",
    desc: "當前為表世界→如果本局遊戲中該事件首次發生，則主人公死亡。否則進行世界移動。當前為裏世界，且當事人的初始區域有1枚或以上[密謀]→主人公死亡。",
    target: "none", effect: "the_singularity"
  },
  {
    id: "seeping_daylight", name: "隙間的陽光", module: "AHR",
    desc: "隊長選擇1名角色。往那名角色身上放置1枚[希望]。",
    target: "char_any", effect: "light_of_hope"
  },
  // ================= LL 事件 =================
  {
    id: "the_executor", name: "代行者", module: "LL",
    desc: "劇作家指定1名主人公，由那名主人公選擇1名角色。那名角色死亡。當事人的初始區域有2枚或以上[密謀]→主人公死亡。",
    target: "none", effect: "the_executor"
  },
  {
    id: "distortion", name: "驟變", module: "LL",
    desc: "當事人的初始區域有2枚或以上[密謀]→主人公死亡。當事人的初始區域有1枚或以下[密謀]→往當事人的初始區域放置2枚[密謀]。",
    target: "none", effect: "distortion"
  },
  // ================= HSA 事件 =================
  {
    id: "blasphemous_murder", name: "褻瀆殺人", module: "HSA",
    desc: "與當事人位於同一區域的另外1名角色死亡，或往當事人所在版圖放置1枚[密謀]。",
    target: "char_or_location", effect: "blasphemous_murder"
  },
  {
    id: "word_curse", name: "言靈詛咒", module: "HSA",
    desc: "往當事人身上放置1張Ex牌。",
    target: "none", effect: "faked_suicide"
  },
  {
    id: "left_alone", name: "孤守", module: "HSA",
    desc: "將與當事人位於同一區域的其它所有角色分別移動至其它任意版圖。",
    target: "none", effect: "left_alone"
  },
  {
    id: "night_of_madness", name: "瘋狂之夜", module: "HSA",
    desc: "（群眾事件）（必要屍體數0）該事件發生時，遊戲中有6具或以上的喪屍→本回合的回合結束階段時，主人公死亡。",
    target: "none", effect: "night_of_madness",
    mobIncident: true, mobCorpses: 0
  },
  {
    id: "curse_awakening", name: "詛咒活化", module: "HSA",
    desc: "（群眾事件）（必要屍體數1）往當事人所在版圖放置Ex牌。",
    target: "none", effect: "curse_awakening",
    mobIncident: true, mobCorpses: 1
  },
  {
    id: "filth_overflow", name: "污穢溢出", module: "HSA",
    desc: "（群眾事件）（必要屍體數2）往任意1名角色身上放置2枚[不安]，隨後往任意1塊版圖上放置1枚[密謀]。",
    target: "none", effect: "filth_overflow",
    mobIncident: true, mobCorpses: 2
  },
  {
    id: "apocalypse_of_the_dead", name: "死者默示錄", module: "HSA",
    desc: "（群眾事件）（必要屍體數2）使當事人所在版圖中的所有角色死亡。之後，如果當事人所在版圖有5具或以上的屍體，則主人公死亡。",
    target: "none", effect: "apocalypse_of_the_dead",
    mobIncident: true, mobCorpses: 2
  },
  // ================= MC / MZ / WM 擴充事件 =================
  {
    id: "serial_murder", name: "連續殺人", module: "both",
    desc: "與當事人位於同一區域的另外1名角色死亡。1名角色可以同時擔任多個連續殺人事件的當事人。",
    target: "char_other", effect: "kill_other_in_location"
  },
  {
    id: "terrorism", name: "恐怖襲擊", module: "MC",
    desc: "都市有1枚或以上[密謀]→位於都市的所有角色死亡。都市有2枚或以上[密謀]→主人公死亡。",
    target: "none", effect: "city_incident",
    extraCondition: { type: "location_intrigue", location: "city", count: 1, desc: "都市有1枚或以上[密謀]" }
  },
  {
    id: "portent", name: "前兆", module: "MC",
    desc: "（當事人不安限度－1）往和當事人位於同一區域的1名角色身上放置1枚[不安]。",
    target: "char_same_area", effect: "portent"
  },
  {
    id: "bestial_murder", name: "獵奇殺人", module: "MC",
    desc: "（當事人不安限度＋1）（Ex槽增加2）按照「連續殺人」「不安擴散」的順序結算事件。",
    target: "none", effect: "bestial_murder"
  },
  {
    id: "faked_suicide", name: "偽裝自殺", module: "both",
    desc: "往當事人身上放置1張Ex牌。本輪輪迴剩餘時間主人公將無法往放置了Ex牌的角色身上放置行動牌。",
    target: "none", effect: "faked_suicide"
  },
  {
    id: "suspicious_letter", name: "可疑信件", module: "MC",
    desc: "將和當事人位於同一區域的1名角色移動至任意版圖。如果那名角色被移動至其它版圖，則次日那名角色無法移動。",
    target: "char_same_area", effect: "suspicious_letter"
  },
  {
    id: "closed_circle", name: "封鎖", module: "MC",
    desc: "指定當事人所在版圖。自事件發生日起算，3天內角色無法通過移動進入或離開該版圖。",
    target: "none", effect: "closed_circle"
  },
  {
    id: "silver_bullet", name: "銀色子彈", module: "MC",
    desc: "（Ex槽不增加）該階段結束時，本輪輪迴結束。",
    target: "none", effect: "silver_bullet"
  },
  {
    id: "conspiracies", name: "陰謀活動", module: "MZ",
    desc: "（通過密謀指示物數量判定是否發生）結算連續殺人或失蹤事件的效果。",
    target: "none", effect: "conspiracies"
  },
  {
    id: "uproar", name: "暴亂", module: "MZ",
    desc: "學校有1枚或以上[密謀]→位於學校的所有角色死亡。都市有1枚或以上[密謀]→位於都市的所有角色死亡。",
    target: "none", effect: "uproar",
    extraCondition: { type: "location_intrigue", location: "school", count: 1, desc: "學校或都市有1枚或以上[密謀]" }
  },
  {
    id: "confession", name: "自白", module: "MZ",
    desc: "當事人公開自己的身份。",
    target: "none", effect: "culprit_reveal"
  },
  {
    id: "breakthrough", name: "破局", module: "MZ",
    desc: "由隊長選擇1名角色或1塊版圖，移除其2枚[密謀]。",
    target: "char_or_location", effect: "remove_intrigue2"
  },
  {
    id: "fake_incident", name: "偽造事件", module: "MZ",
    desc: "將偽造事件記入公開信息表時，可以自由命名事件名稱（非公開信息表和遊戲中依然視為偽造事件）。",
    target: "none", effect: "fake_incident"
  },
  {
    id: "insane_murder", name: "瘋狂殺人", module: "WM",
    desc: "與當事人位於同一區域的1名角色死亡。",
    target: "char_other", effect: "kill_other_in_location"
  },
  {
    id: "mass_suicide", name: "集體自殺", module: "WM",
    desc: "當事人有1枚或以上[密謀]→當事人所在區域的所有角色死亡。",
    target: "none", effect: "mass_suicide",
    extraCondition: { type: "culprit_intrigue", count: 1, desc: "當事人有1枚或以上[密謀]" }
  },
  {
    id: "fire_of_demise", name: "滅絕之火", module: "WM",
    desc: "本局遊戲中若本事件首次發生→所有角色和主人公死亡。",
    target: "none", effect: "fire_of_demise"
  },
  {
    id: "hound_dog_scent", name: "廷達羅斯之嗅", module: "WM",
    desc: "（通過密謀指示物判定是否發生）本輪輪迴剩餘時間，如果發生其它事件，則在那個事件階段結束時，主人公死亡。",
    target: "none", effect: "hound_dog_scent"
  },
  {
    id: "discovery", name: "發現", module: "WM",
    desc: "Ex槽增加1。",
    target: "none", effect: "discovery"
  },
  {
    id: "the_executioner", name: "送葬", module: "WM",
    desc: "（當事人不安限度－1）隊長選擇1名角色。那名角色死亡。",
    target: "char_any", effect: "kill_chosen"
  }
];

window.INCIDENT_INDEX = {};
window.INCIDENTS.forEach(function (i) { INCIDENT_INDEX[i.id] = i; });

// 位置信息
window.LOCATIONS = [
  { id: "hospital", name: "醫院", row: 0, col: 0 },
  { id: "shrine", name: "神社", row: 0, col: 1 },
  { id: "city", name: "都市", row: 1, col: 0 },
  { id: "school", name: "學校", row: 1, col: 1 },
  { id: "distant", name: "遠方", row: 1, col: 2, offBoard: true }
];

window.LOC_INDEX = {};
window.LOCATIONS.forEach(function (l) { LOC_INDEX[l.id] = l; });

// 相邻关系（用于移动）
window.ADJ = {
  hospital: { v: ["city"], h: ["shrine"], d: ["school"] },
  shrine: { v: ["school"], h: ["hospital"], d: ["city"] },
  city: { v: ["hospital"], h: ["school"], d: ["shrine"] },
  school: { v: ["shrine"], h: ["city"], d: ["hospital"] },
  distant: { h: [], v: [], d: [] }
};
