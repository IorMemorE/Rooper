// 官方劇本預設（僅保留 THE FIRST SCRIPT 與 PROLOGUE）
// 角色/規則名已按官方英文卡面對應到本遊戲數據。
window.PRESETS = [
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
  }
];

window.PRESET_INDEX = {};
window.PRESETS.forEach(function (p) { PRESET_INDEX[p.id] = p; });
