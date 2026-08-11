// 官方劇本預設（來源：StoryScripts\RAW\FS_BTX 掃描件，僅 FS 與 BTX 模組）
// 角色/規則名已按官方英文卡面對應到本遊戲數據。
// extraRoles: 官方卡面上超出規則Y/X身份要求的額外身份（MIRROR PASSCODE、NEVERENDING HAPPY & SAD STORY）
window.PRESETS = [
  // ===================== FS =====================
  {
    id: "the_first_script",
    moduleId: "FS",
    title: "THE FIRST SCRIPT（最初的劇本）",
    creator: "官方劇本",
    loops: 3, days: 4, tableTalk: true,
    mainPlot: "murder_plan",
    subplots: ["shadow_of_the_ripper"],
    cast: [
      { characterId: "boy_student", role: null, startLoc: "school" },
      { characterId: "girl_student", role: "key_person", startLoc: "school" },
      { characterId: "shrine_maiden", role: "serial_killer", startLoc: "shrine" },
      { characterId: "police_officer", role: "conspiracy_theorist", startLoc: "city" },
      { characterId: "office_worker", role: "killer", startLoc: "city" },
      { characterId: "doctor", role: "brain", startLoc: "hospital" }
    ],
    incidents: [
      { day: 2, incidentId: "murder", culpritId: "office_worker" },
      { day: 3, incidentId: "suicide", culpritId: "girl_student" }
    ],
    specialRules: "",
    note: "官方 FS 劇本：謀殺計劃＋開膛者的魔影。（輪迴 2-3，本預設取 3）"
  },
  {
    id: "prevailing_secrecy",
    moduleId: "FS",
    title: "PREVAILING SECRECY（密而不宣）",
    creator: "官方劇本",
    loops: 4, days: 5, tableTalk: true,
    mainPlot: "a_place_to_protect",
    subplots: ["unsettling_rumor"],
    cast: [
      { characterId: "boy_student", role: "cultist", startLoc: "school" },
      { characterId: "girl_student", role: null, startLoc: "school" },
      { characterId: "shrine_maiden", role: "conspiracy_theorist", startLoc: "shrine" },
      { characterId: "office_worker", role: null, startLoc: "city" },
      { characterId: "doctor", role: "key_person", startLoc: "hospital" },
      { characterId: "patient", role: null, startLoc: "hospital" }
    ],
    incidents: [
      { day: 1, incidentId: "increasing_unease", culpritId: "shrine_maiden" },
      { day: 3, incidentId: "hospital_incident", culpritId: "boy_student" },
      { day: 5, incidentId: "faraway_murder", culpritId: "patient" }
    ],
    specialRules: "",
    note: "官方 FS 劇本：守護此地＋流言四起。（輪迴 3-4，本預設取 4）"
  },

  // ===================== BTX =====================
  {
    id: "secret_cat_walk",
    moduleId: "BTX",
    title: "SECRET CAT WALK（秘密貓步）",
    creator: "官方劇本",
    loops: 4, days: 6, tableTalk: true,
    mainPlot: "the_sealed_item",
    subplots: ["paranoia_virus", "unknown_factor_x"],
    cast: [
      { characterId: "rich_man's_daughter", role: "cultist", startLoc: "school" },
      { characterId: "boy_student", role: null, startLoc: "school" },
      { characterId: "teacher", role: "conspiracy_theorist", startLoc: "school" },
      { characterId: "shrine_maiden", role: null, startLoc: "shrine" },
      { characterId: "black_cat", role: "factor", startLoc: "shrine" },
      { characterId: "office_worker", role: null, startLoc: "city" },
      { characterId: "informer", role: "brain", startLoc: "city" },
      { characterId: "patient", role: null, startLoc: "hospital" },
      { characterId: "soldier", role: null, startLoc: "hospital" }
    ],
    incidents: [
      { day: 3, incidentId: "missing_person", culpritId: "boy_student" },
      { day: 4, incidentId: "hospital_incident", culpritId: "shrine_maiden" },
      { day: 6, incidentId: "butterfly_effect", culpritId: "black_cat" }
    ],
    specialRules: "",
    note: "官方 BTX 劇本：被封印的邪靈＋妄想擴大病毒＋未知因子χ。（輪迴 4-5，本預設取 4）"
  },
  {
    id: "the_future_of_the_gods",
    moduleId: "BTX",
    title: "THE FUTURE OF THE GODS（眾神的未來）",
    creator: "官方劇本",
    loops: 4, days: 7, tableTalk: true,
    mainPlot: "changing_the_future",
    subplots: ["the_hidden_freak", "a_love_affair"],
    cast: [
      { characterId: "boy_student", role: "time_traveler", startLoc: "school" },
      { characterId: "rich_man's_daughter", role: null, startLoc: "school" },
      { characterId: "shrine_maiden", role: "cultist", startLoc: "shrine" },
      { characterId: "godly_being", role: "loved_one", startLoc: "shrine", appearLoop: 3 },
      { characterId: "police_officer", role: null, startLoc: "city" },
      { characterId: "office_worker", role: "serial_killer", startLoc: "city" },
      { characterId: "pop_idol", role: "lover", startLoc: "city" },
      { characterId: "patient", role: null, startLoc: "hospital" },
      { characterId: "nurce", role: "friend", startLoc: "hospital" }
    ],
    incidents: [
      { day: 2, incidentId: "suicide", culpritId: "pop_idol" },
      { day: 4, incidentId: "increasing_unease", culpritId: "shrine_maiden" },
      { day: 5, incidentId: "butterfly_effect", culpritId: "police_officer" },
      { day: 7, incidentId: "foul_evil", culpritId: "patient" }
    ],
    specialRules: "【登場輪迴】神靈（摯愛）從第3輪迴開始登場。",
    note: "官方 BTX 劇本：改變未來＋潛伏的殺人狂＋戀愛風景線。"
  },
  {
    id: "young_women_s_battlefield",
    moduleId: "BTX",
    title: "YOUNG WOMEN'S BATTLEFIELD（少女們的戰場）",
    creator: "官方劇本",
    loops: 3, days: 6, tableTalk: true,
    mainPlot: "sign_with_me",
    subplots: ["a_love_affair", "the_hidden_freak"],
    cast: [
      { characterId: "boy_student", role: null, startLoc: "school" },
      { characterId: "girl_student", role: "friend", startLoc: "school" },
      { characterId: "class_rep", role: "loved_one", startLoc: "school" },
      { characterId: "shrine_maiden", role: "key_person", startLoc: "shrine" },
      { characterId: "police_officer", role: null, startLoc: "city" },
      { characterId: "office_worker", role: "lover", startLoc: "city" },
      { characterId: "informer", role: "serial_killer", startLoc: "city" },
      { characterId: "patient", role: null, startLoc: "hospital" },
      { characterId: "nurce", role: null, startLoc: "hospital" }
    ],
    incidents: [
      { day: 3, incidentId: "foul_evil", culpritId: "office_worker" },
      { day: 4, incidentId: "increasing_unease", culpritId: "class_rep" },
      { day: 6, incidentId: "suicide", culpritId: "girl_student" }
    ],
    specialRules: "",
    note: "官方 BTX 劇本：和我簽訂契約吧！＋戀愛風景線＋潛伏的殺人狂。（輪迴 3-4，本預設取 3）"
  },
  {
    id: "lesser_of_two_evils",
    moduleId: "BTX",
    title: "LESSER OF TWO EVILS（兩害相權）",
    creator: "官方劇本",
    loops: 3, days: 7, tableTalk: true,
    mainPlot: "the_sealed_item",
    subplots: ["the_hidden_freak", "unknown_factor_x"],
    cast: [
      { characterId: "boy_student", role: null, startLoc: "school" },
      { characterId: "girl_student", role: null, startLoc: "school" },
      { characterId: "rich_man's_daughter", role: "brain", startLoc: "school" },
      { characterId: "shrine_maiden", role: "friend", startLoc: "shrine" },
      { characterId: "office_worker", role: "serial_killer", startLoc: "city" },
      { characterId: "informer", role: null, startLoc: "city" },
      { characterId: "journalist", role: "factor", startLoc: "city" },
      { characterId: "patient", role: null, startLoc: "hospital" },
      { characterId: "nurce", role: "cultist", startLoc: "hospital" }
    ],
    incidents: [
      { day: 2, incidentId: "increasing_unease", culpritId: "rich_man's_daughter" },
      { day: 4, incidentId: "missing_person", culpritId: "nurce" },
      { day: 5, incidentId: "missing_person", culpritId: "boy_student" },
      { day: 7, incidentId: "suicide", culpritId: "journalist" }
    ],
    specialRules: "",
    note: "官方 BTX 劇本：被封印的邪靈＋潛伏的殺人狂＋未知因子χ。（輪迴 3-4，本預設取 3）"
  },
  {
    id: "the_secret_that_was_kept",
    moduleId: "BTX",
    title: "THE SECRET THAT WAS KEPT（守密之人）",
    creator: "官方劇本",
    loops: 3, days: 7, tableTalk: true,
    mainPlot: "giant_time_bomb",
    subplots: ["threads_of_fate", "circle_of_friends"],
    cast: [
      { characterId: "rich_man's_daughter", role: "witch", startLoc: "school" },
      { characterId: "class_rep", role: null, startLoc: "school" },
      { characterId: "shrine_maiden", role: null, startLoc: "shrine" },
      { characterId: "alien", role: "friend", startLoc: "shrine" },
      { characterId: "office_worker", role: "friend", startLoc: "city" },
      { characterId: "informer", role: "conspiracy_theorist", startLoc: "city" },
      { characterId: "pop_idol", role: null, startLoc: "city" },
      { characterId: "journalist", role: null, startLoc: "city" },
      { characterId: "patient", role: null, startLoc: "hospital" }
    ],
    incidents: [
      { day: 2, incidentId: "suicide", culpritId: "rich_man's_daughter" },
      { day: 3, incidentId: "missing_person", culpritId: "office_worker" },
      { day: 4, incidentId: "hospital_incident", culpritId: "journalist" },
      { day: 6, incidentId: "spreading", culpritId: "shrine_maiden" },
      { day: 7, incidentId: "foul_evil", culpritId: "pop_idol" }
    ],
    specialRules: "",
    note: "官方 BTX 劇本：巨大定時炸彈X＋因果線＋好友圈。（輪迴 3-4，本預設取 3）"
  },
  {
    id: "mirror_passcode",
    moduleId: "BTX",
    title: "MIRROR PASSCODE（鏡之密碼）",
    creator: "官方劇本",
    loops: 3, days: 7, tableTalk: true,
    mainPlot: "sign_with_me",
    subplots: ["unknown_factor_x", "paranoia_virus"],
    extraRoles: ["cultist"],
    cast: [
      { characterId: "boy_student", role: null, startLoc: "school" },
      { characterId: "girl_student", role: "key_person", startLoc: "school" },
      { characterId: "rich_man's_daughter", role: "factor", startLoc: "school" },
      { characterId: "mystery_boy", role: "cultist", startLoc: "school" },
      { characterId: "office_worker", role: null, startLoc: "city" },
      { characterId: "informer", role: "conspiracy_theorist", startLoc: "city" },
      { characterId: "journalist", role: null, startLoc: "city" },
      { characterId: "patient", role: null, startLoc: "hospital" },
      { characterId: "nurce", role: null, startLoc: "hospital" }
    ],
    incidents: [
      { day: 3, incidentId: "missing_person", culpritId: "rich_man's_daughter" },
      { day: 4, incidentId: "increasing_unease", culpritId: "journalist" },
      { day: 5, incidentId: "hospital_incident", culpritId: "mystery_boy" },
      { day: 7, incidentId: "murder", culpritId: "boy_student" }
    ],
    specialRules: "【額外身份】局外人為邪教徒，超出規則Y/X的身份要求（官方劇本卡面如此配置）。",
    note: "官方 BTX 劇本：和我簽訂契約吧！＋未知因子χ＋妄想擴大病毒。（輪迴 3-4，本預設取 3）"
  },
  {
    id: "those_with_antibodies",
    moduleId: "BTX",
    title: "THOSE WITH ANTIBODIES（擁有抗體之人）",
    creator: "官方劇本",
    loops: 4, days: 4, tableTalk: true,
    mainPlot: "changing_the_future",
    subplots: ["threads_of_fate", "paranoia_virus"],
    cast: [
      { characterId: "girl_student", role: null, startLoc: "school" },
      { characterId: "rich_man's_daughter", role: "conspiracy_theorist", startLoc: "school" },
      { characterId: "class_rep", role: null, startLoc: "school" },
      { characterId: "shrine_maiden", role: "cultist", startLoc: "shrine" },
      { characterId: "police_officer", role: null, startLoc: "city" },
      { characterId: "office_worker", role: null, startLoc: "city" },
      { characterId: "informer", role: null, startLoc: "city" },
      { characterId: "doctor", role: null, startLoc: "hospital" },
      { characterId: "patient", role: null, startLoc: "hospital" },
      { characterId: "henchman", role: "time_traveler", startLoc: "city" }
    ],
    incidents: [
      { day: 1, incidentId: "butterfly_effect", culpritId: "rich_man's_daughter" },
      { day: 2, incidentId: "foul_evil", culpritId: "henchman" },
      { day: 3, incidentId: "spreading", culpritId: "doctor" },
      { day: 4, incidentId: "missing_person", culpritId: "police_officer" }
    ],
    specialRules: "",
    note: "官方 BTX 劇本：改變未來＋因果線＋妄想擴大病毒。（輪迴 4-5，本預設取 4）"
  },
  {
    id: "prologue",
    moduleId: "BTX",
    title: "PROLOGUE（序幕）",
    creator: "官方劇本",
    loops: 4, days: 7, tableTalk: true,
    mainPlot: "murder_plan",
    subplots: ["circle_of_friends", "a_love_affair"],
    cast: [
      { characterId: "boy_student", role: "lover", startLoc: "school" },
      { characterId: "girl_student", role: "loved_one", startLoc: "school" },
      { characterId: "rich_man's_daughter", role: "killer", startLoc: "school" },
      { characterId: "shrine_maiden", role: "key_person", startLoc: "shrine" },
      { characterId: "police_officer", role: "conspiracy_theorist", startLoc: "city" },
      { characterId: "office_worker", role: null, startLoc: "city" },
      { characterId: "informer", role: "friend", startLoc: "city" },
      { characterId: "doctor", role: "brain", startLoc: "hospital" },
      { characterId: "patient", role: "friend", startLoc: "hospital" }
    ],
    incidents: [
      { day: 2, incidentId: "increasing_unease", culpritId: "office_worker" },
      { day: 4, incidentId: "suicide", culpritId: "girl_student" },
      { day: 5, incidentId: "hospital_incident", culpritId: "boy_student" },
      { day: 7, incidentId: "murder", culpritId: "police_officer" }
    ],
    specialRules: "",
    note: "官方 BTX 劇本：謀殺計劃＋好友圈＋戀愛風景線。（輪迴 4-5，本預設取 4）"
  },
  {
    id: "neverending_happy_and_sad_story",
    moduleId: "BTX",
    title: "NEVERENDING HAPPY & SAD STORY（永無止境的喜怒哀樂）",
    turf: "school",
    creator: "官方劇本",
    loops: 4, days: 6, tableTalk: true,
    mainPlot: "giant_time_bomb",
    subplots: ["unsettling_rumor_b", "a_love_affair"],
    extraRoles: ["brain"],
    cast: [
      { characterId: "girl_student", role: null, startLoc: "school" },
      { characterId: "rich_man's_daughter", role: "loved_one", startLoc: "school" },
      { characterId: "class_rep", role: null, startLoc: "school" },
      { characterId: "mystery_boy", role: "brain", startLoc: "school" },
      { characterId: "alien", role: null, startLoc: "shrine" },
      { characterId: "godly_being", role: "witch", startLoc: "shrine", appearLoop: 4 },
      { characterId: "office_worker", role: null, startLoc: "city" },
      { characterId: "pop_idol", role: null, startLoc: "city" },
      { characterId: "boss", role: "conspiracy_theorist", startLoc: "city" },
      { characterId: "patient", role: "lover", startLoc: "hospital" },
      { characterId: "nurce", role: null, startLoc: "hospital" }
    ],
    incidents: [
      { day: 2, incidentId: "butterfly_effect", culpritId: "class_rep" },
      { day: 3, incidentId: "increasing_unease", culpritId: "alien" },
      { day: 4, incidentId: "missing_person", culpritId: "office_worker" },
      { day: 5, incidentId: "butterfly_effect", culpritId: "nurce" },
      { day: 6, incidentId: "missing_person", culpritId: "patient" }
    ],
    specialRules: "【特殊規則】劇作家將「禁止友好」從手牌中取除，整局輪迴不能使用。\n【登場輪迴】神靈（魔女）從第4輪迴開始登場。\n【額外身份】局外人為主謀，超出規則Y/X的身份要求（官方劇本卡面如此配置）。\n【領地】大人物的領地為學校。",
    note: "官方 BTX 劇本：巨大定時炸彈X＋流言四起＋戀愛風景線。"
  }
];

window.PRESET_INDEX = {};
window.PRESETS.forEach(function (p) { PRESET_INDEX[p.id] = p; });
