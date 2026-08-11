// 角色卡数据（依据《惨剧轮回 没有意义材料表v2.6.xls》校正；材料表未收录的角色保留 custom 标注）
// ability 结构: { cost, oncePerLoop, cannotBeRefused, locRestriction, target, effect, desc }
// specials: 卡面上的“特性/特殊”说明（非友好能力）
window.CHARACTERS = [
  {
    id: "boy_student", name: "男學生", module: "FS+BTX", paranoiaLimit: 2,
    traits: ["學生", "少年"], forbidden: [], defaultStart: "school",
    goodwill: [
      { cost: 2, target: "student", effect: "paranoia_minus", desc: "同一區域另外1名學生不安－1" }
    ],
    desc: "乍看之下只是個處事略顯輕率的班中核心，其背後的真容是？"
  },
  {
    id: "girl_student", name: "女學生", module: "FS+BTX", paranoiaLimit: 3,
    traits: ["學生", "少女"], forbidden: [], defaultStart: "school",
    goodwill: [
      { cost: 2, target: "student", effect: "paranoia_minus", desc: "同一區域另外1名學生不安－1" }
    ],
    desc: "乍看之下只是個開朗活潑的班花，其背後的真容是？"
  },
  {
    id: "rich_man's_daughter", name: "大小姐", module: "BTX", paranoiaLimit: 1,
    traits: ["學生", "少女"], forbidden: [], defaultStart: "school",
    goodwill: [
      { cost: 3, target: "char", locRestriction: ["school", "city"], effect: "goodwill_plus", desc: "(限制：學校、都市)同一區域1名角色友好＋1" }
    ],
    desc: "任性卻聰慧的富家千金。"
  },
  {
    id: "shrine_maiden", name: "巫女", module: "FS+BTX", paranoiaLimit: 2,
    traits: ["學生", "少女"], forbidden: ["city"], defaultStart: "shrine",
    goodwill: [
      { cost: 3, target: "location", locRestriction: ["shrine"], effect: "intrigue_minus_location", desc: "(限制：神社)神社密謀－1" },
      { cost: 5, oncePerLoop: true, target: "char", effect: "reveal_role", desc: "公開同一區域1名角色的身份" }
    ],
    desc: "乍看之下只是個存在感稍低的小丫頭，其背後的真容是？"
  },
  {
    id: "police_officer", name: "刑警", module: "BTX", paranoiaLimit: 3,
    traits: ["成人", "男性"], forbidden: [], defaultStart: "city",
    goodwill: [
      { cost: 4, oncePerLoop: true, target: "none", effect: "reveal_culprit", desc: "公開1個本輪輪迴已發生事件的當事人" },
      { cost: 5, oncePerLoop: true, target: "char", effect: "guard_place", desc: "往同一區域1名角色放置1枚護衛指示物（免死一次）" }
    ],
    desc: "追查事件的刑警。"
  },
  {
    id: "office_worker", name: "職員", module: "FS+BTX", paranoiaLimit: 2,
    traits: ["成人", "男性"], forbidden: ["school"], defaultStart: "city",
    goodwill: [
      { cost: 3, target: "self", effect: "reveal_self", desc: "公開該角色的身份" }
    ],
    desc: "乍看之下只是個認真工作的企業戰士，其背後的真容是？"
  },
  {
    id: "informer", name: "情報商", module: "BTX", paranoiaLimit: 3,
    traits: ["成人", "女性"], forbidden: [], defaultStart: "city",
    goodwill: [
      { cost: 5, oncePerLoop: true, target: "none", effect: "reveal_rule_x", desc: "公開主人公未聲明的規則X" }
    ],
    desc: "掌握各路情報的情報販子。"
  },
  {
    id: "doctor", name: "醫生", module: "FS+BTX", paranoiaLimit: 2,
    traits: ["成人", "男性"], forbidden: [], defaultStart: "hospital",
    goodwill: [
      { cost: 2, target: "char", effect: "paranoia_plus_minus", desc: "同一區域另外1名角色不安＋1或－1" },
      { cost: 3, target: "none", effect: "patient_open", desc: "本輪迴，取消住院患者的禁行區域" }
    ],
    specials: ["【特殊】若本角色擁有『無視友好』，劇作家使用此技能。"],
    desc: "乍看之下是慈祥且值得信賴的本地名醫，其背後的真容是？"
  },
  {
    id: "patient", name: "住院患者", module: "BTX", paranoiaLimit: 2,
    traits: ["少年"], forbidden: ["shrine", "city", "school"], defaultStart: "hospital",
    goodwill: [],
    desc: "住院中的少年患者，無法離開醫院。"
  },
  {
    id: "class_rep", name: "班長", module: "BTX", paranoiaLimit: 2,
    traits: ["學生", "少女"], forbidden: [], defaultStart: "school",
    goodwill: [
      { cost: 2, oncePerLoop: true, target: "none", effect: "retrieve_card", desc: "隊長回收自己1張已使用的每輪限1次牌" }
    ],
    desc: "班上能幹的班長。"
  },
  {
    id: "alien", name: "異界人", module: "BTX", paranoiaLimit: 2,
    traits: ["少女"], forbidden: ["hospital"], defaultStart: "shrine",
    goodwill: [
      { cost: 4, oncePerLoop: true, target: "char", effect: "kill", desc: "使同一區域另外1名角色死亡" },
      { cost: 5, oncePerLoop: true, target: "corpse", effect: "resurrect", desc: "復活同一區域1具屍體" }
    ],
    desc: "來自異界的訪客。"
  },
  {
    id: "pop_idol", name: "偶像", module: "FS+BTX", paranoiaLimit: 2,
    traits: ["學生", "少女"], forbidden: [], defaultStart: "city",
    goodwill: [
      { cost: 3, target: "char", effect: "paranoia_minus", desc: "同一區域另外1名角色不安－1" },
      { cost: 4, target: "char", effect: "goodwill_plus", desc: "同一區域另外1名角色友好＋1" }
    ],
    desc: "乍看之下是正當紅的超人氣偶像，其背後的真容是？"
  },
  {
    id: "journalist", name: "媒體人", module: "BTX", paranoiaLimit: 2,
    traits: ["成人", "男性"], forbidden: [], defaultStart: "city",
    goodwill: [
      { cost: 2, target: "char_anywhere", effect: "paranoia_plus", desc: "任意1名角色不安＋1" },
      { cost: 2, target: "char_or_location", effect: "intrigue_plus", desc: "同一區域1名角色或該角色所在版圖密謀＋1" }
    ],
    desc: "追逐新聞的媒體人。"
  },
  {
    id: "forensic_specialist", name: "鑑別員", module: "BTX", paranoiaLimit: 3,
    traits: ["成人", "男性"], forbidden: [], defaultStart: "city",
    goodwill: [
      { cost: 2, oncePerLoop: true, target: "counter_move", effect: "move_counter", desc: "選擇同一區域另外2名角色，移動1枚指示物" },
      { cost: 5, oncePerLoop: true, target: "corpse", effect: "reveal_corpse", desc: "公開1具屍體的身份" }
    ],
    desc: "專業的鑑識人員。"
  },
  {
    id: "teacher", name: "教師", module: "BTX", paranoiaLimit: 2,
    traits: ["成人", "女性"], forbidden: [], defaultStart: "school",
    goodwill: [
      { cost: 3, target: "student", effect: "paranoia_plus_minus", desc: "同一區域1名學生不安＋1或－1" },
      { cost: 4, oncePerLoop: true, target: "student", effect: "reveal_role", desc: "公開同一區域1名學生的身份" }
    ],
    desc: "嚴厲而負責的教師。"
  },
  {
    id: "nurce", name: "護士", module: "BTX", paranoiaLimit: 3,
    traits: ["成人", "女性"], forbidden: [], defaultStart: "hospital",
    goodwill: [
      { cost: 2, cannotBeRefused: true, target: "char_at_limit", effect: "paranoia_minus", desc: "(不可拒絕)同一區域不安達到或超出限度的另外1名角色不安－1" }
    ],
    specials: ["【特殊】即使本角色擁有『無視友好』，劇作家也不能拒絕使用。"],
    desc: "醫院裡溫柔的護士。"
  },
  {
    id: "soldier", name: "軍人", module: "BTX", paranoiaLimit: 3,
    traits: ["成人", "男性"], forbidden: [], defaultStart: "hospital",
    goodwill: [
      { cost: 2, oncePerLoop: true, target: "char", effect: "paranoia_plus", desc: "同一區域1名角色不安＋2" },
      { cost: 5, oncePerLoop: true, target: "none", effect: "prevent_death", desc: "本輪輪迴，主人公不會死亡" }
    ],
    desc: "不苟言笑的軍人。"
  },
  // ---- 官方角色（依 Fandom 角色介绍校正）----
  {
    id: "mystery_boy", name: "局外人", module: "FS+BTX", paranoiaLimit: 3,
    traits: ["學生", "少年"], forbidden: [], defaultStart: "school",
    specials: ["【劇本製作時】該角色不參與劇本所選規則的身份分配，但不直接視作平民，而是為其分配當前模組中存在、並且劇本所選規則中未帶有的某一身份。"],
    goodwill: [
      { cost: 3, target: "self", effect: "reveal_self", minLoop: 2, cannotBeRefused: true, desc: "公開該角色的身份。必須在第2輪輪迴或之後才可使用；即使帶有無視友好特性，也不能拒絕行使該能力。" }
    ],
    desc: "行蹤神秘的外來少年，其真實身份是？"
  },
  {
    id: "transfer_student", name: "轉校生", module: "EXT", paranoiaLimit: 2,
    traits: ["學生", "少女"], forbidden: [], defaultStart: "school",
    specials: ["轉校生會在劇本特定的日期登場。"],
    goodwill: [
      { cost: 2, target: "char", effect: "intrigue_to_goodwill", desc: "將同一區域另外1名其他角色身上的1枚[密謀]替換成[友好]" }
    ],
    desc: "在特定日期轉入學校的轉校生。"
  },
  {
    id: "godly_being", name: "神靈", module: "EXT", paranoiaLimit: 3,
    traits: ["男性", "女性"], forbidden: [], defaultStart: "shrine",
    specials: ["只在特定的輪迴登場，特定輪迴前不會上場。"],
    goodwill: [
      { cost: 3, oncePerLoop: true, target: "none", effect: "reveal_culprit", desc: "公開1個事件的當事人" },
      { cost: 5, target: "char_or_location", effect: "intrigue_minus", desc: "同一區域的1名角色或者所在版圖密謀－1" }
    ],
    desc: "高位存在的神靈。"
  },
  {
    id: "boss", name: "大人物", module: "EXT", paranoiaLimit: 4,
    traits: ["成人", "男性"], forbidden: [], defaultStart: "city",
    specials: ["指定1個版圖作為領地，可將領地視為其所在區域使用能力。"],
    goodwill: [
      { cost: 5, oncePerLoop: true, target: "char", effect: "reveal_role", desc: "公開領地中另外1名角色的身份" }
    ],
    desc: "掌控地下勢力的首領。"
  },
  {
    id: "henchman", name: "手下", module: "EXT", paranoiaLimit: 1,
    traits: ["成人", "男性"], forbidden: [], defaultStart: "city",
    specials: ["每輪輪迴初始區域由劇作家決定。"],
    goodwill: [
      { cost: 3, target: "none", effect: "incident_forbid", desc: "本輪迴中，該角色擔任當事人的事件不會發生" }
    ],
    desc: "首領身邊的打手。"
  },
  {
    id: "scientist", name: "學者", module: "EXT", paranoiaLimit: 2,
    traits: ["大人", "男性"], forbidden: [], defaultStart: "hospital",
    specials: ["輪迴開始時，在該角色身上放置1枚[不安]\[密謀]\[友好]標記。"],
    goodwill: [
      { cost: 3, target: "self", effect: "clear_markers", desc: "移除該角色身上的所有標記。（若使用EX計量槽，Ex槽＋1/－1）" }
    ],
    desc: "潛心研究的學者。"
  },
  {
    id: "illusion", name: "幻想", module: "EXT", paranoiaLimit: 3,
    traits: ["虛構", "女性"], forbidden: [], defaultStart: "shrine",
    specials: ["本角色不能放置行動卡，但同一區域版圖上的行動卡會對她產生效果。"],
    goodwill: [
      { cost: 3, oncePerLoop: true, target: "char", effect: "move_any", desc: "將同一區域任意1名角色移動到任意版圖" },
      { cost: 4, target: "none", effect: "remove_self", desc: "本輪迴，移除該角色" }
    ],
    desc: "捉摸不定的幻想存在。"
  },
  {
    id: "ai", name: "人工智能", module: "EXT", paranoiaLimit: 4,
    traits: ["虛構"], forbidden: ["hospital", "shrine", "school"], defaultStart: "city",
    specials: ["劇本製作時，該角色不能為[平民]；判斷事件觸發時，該角色身上所有標記視為[不安]。"],
    goodwill: [
      { cost: 3, oncePerLoop: true, target: "none", effect: "ai_incident", desc: "由隊長選擇1個公開情報卡上記載的事件；該事件的當事人視為A.I.，效果目標由隊長選擇（決定所有目標和結算效果後，由劇作家決定是否拒絕，事件不視為已發生）" }
    ],
    desc: "神秘的人工智能。"
  },
  {
    id: "black_cat", name: "黑貓", module: "EXT", paranoiaLimit: 0,
    traits: ["動物"], forbidden: [], defaultStart: "shrine",
    specials: ["【每輪輪迴開始】在神社放置1枚[密謀]。", "該角色為當事人的事件，效果變為沒有效果。"],
    goodwill: [],
    desc: "徘徊於街巷的黑貓。"
  },
  {
    id: "young_girl", name: "小女孩", module: "EXT", paranoiaLimit: 1,
    traits: ["學生", "少女"], forbidden: ["shrine", "city", "hospital"], defaultStart: "school",
    goodwill: [
      { cost: 1, target: "self", effect: "young_girl_open", desc: "本輪輪迴中，該角色不再擁有禁行區域，可以移動至學校之外。" },
      { cost: 3, oncePerLoop: true, target: "self", effect: "self_move_adjacent", desc: "將該角色移動至相鄰的版圖。" }
    ],
    desc: "天真無邪的小女孩，為何會捲入輪迴之中？"
  },
  {
    id: "copycat", name: "模仿犯", module: "EXT", paranoiaLimit: 2,
    traits: ["學生", "少年"], forbidden: [], defaultStart: "city",
    specials: ["該角色獲得另外1位角色相同的身份（無視劇本身份人數限制）。"],
    goodwill: [
      { cost: 3, cannotBeRefused: true, target: "none", effect: "reveal_same_roles", desc: "(不可拒絕、第1輪不可使用)公開場上與本角色身份相同的所有角色名" }
    ],
    desc: "模仿他人的罪犯。"
  },
  {
    id: "hierarch", name: "教主", module: "EXT", paranoiaLimit: 3,
    traits: ["成人", "女性"], forbidden: [], defaultStart: "shrine",
    specials: ["該角色為當事人的事件，按事件文字表述結算2次。"],
    goodwill: [
      { cost: 3, target: "char_at_limit", effect: "goodwill_plus", desc: "往另外1名不安達到或超出不安限度的角色身上放置1枚[友好]。" },
      { cost: 4, oncePerLoop: true, target: "char_at_limit", effect: "reveal_role", desc: "公開同一區域另外1名不安達到或超出不安限度的角色的身份。" }
    ],
    desc: "宣揚信仰、令人畏懼的教主。"
  },
  {
    id: "tree", name: "御神木", module: "EXT", paranoiaLimit: 4,
    traits: ["樹"], forbidden: [], defaultStart: "shrine",
    specials: ["每個主人公能力階段，可將該角色1枚標記移至同區域另外1名角色身上；若該角色擁有『無視友好』，劇作家在劇作家能力階段也必須使用。"],
    goodwill: [],
    desc: "靜默矗立的神木。"
  },
  {
    id: "sister", name: "妹妹", module: "EXT", paranoiaLimit: 3,
    traits: ["少女", "妹妹"], forbidden: [], defaultStart: "shrine",
    specials: ["【劇本製作時】該角色的身份不可以為帶有無視友好特性的身份。"],
    goodwill: [
      { cost: 5, target: "none", effect: "sister_trigger", desc: "同一區域的1名成人使用1個友好能力，此時無視該成人的友好指示物數量。即使該成人帶有無視友好特性，也不能拒絕使用那個能力。但能力依然受到次數限制。" }
    ],
    desc: "與姊姊形影不離的妹妹。"
  },
  {
    id: "part_time_jobber", name: "臨時工", module: "EXT", paranoiaLimit: 1,
    traits: ["成人", "男性"], forbidden: [], defaultStart: "city",
    specials: [
      "該卡牌的身份為平民（無視其原本所配置的身份）。",
      "【回合結束階段】若該角色總共有3枚或以上的任意指示物，該角色死亡。",
      "【回合開始階段】若該卡牌為死亡狀態，則將「臨時工？」在都市配置上場。"
    ],
    goodwill: [],
    desc: "辛勤工作到令人心疼的臨時工。"
  },
  {
    id: "part_time_jobbess", name: "臨時工？", module: "EXT", paranoiaLimit: 3,
    traits: ["少女"], forbidden: [], defaultStart: "city",
    specials: [
      "該角色不能在劇本製作時使用。",
      "該角色的身份以及事件當事人的配置與「臨時工」的配置一致。"
    ],
    goodwill: [
      { cost: 3, oncePerLoop: true, target: "char", effect: "reveal_self_goodwill2", desc: "公開該角色的身份，並選擇同一區域的1名角色放置2枚[友好]。" }
    ],
    desc: "打工是不可能打工的，只能維持生活這樣子。"
  },
  {
    id: "maid", name: "從者", module: "EXT", paranoiaLimit: 3,
    traits: ["成人", "女性"], forbidden: [], defaultStart: "school",
    specials: [
      "初始區域為學校或都市（由劇本規定）。",
      "同一區域的大人物或大小姐移動時，無視自身移動並跟隨那名角色移動（如果多名角色同時移動，由主人公選擇跟隨哪名角色）。",
      "同一區域的大人物或大小姐死亡時，代替那名角色死亡。"
    ],
    goodwill: [
      { cost: 4, oncePerLoop: true, target: "char", effect: "servant_add_scope", desc: "選擇場上的另外1名角色，本輪輪迴中，將那名角色追加至特性適用對象中。" }
    ],
    desc: "誓死守護主人的從者。"
  },
  {
    id: "higher_being", name: "上位存在", module: "EXT", paranoiaLimit: 2,
    traits: ["少女"], forbidden: [], defaultStart: "shrine",
    goodwill: [
      { cost: 3, oncePerLoop: true, target: "char", effect: "hope_despair", desc: "同一區域選擇1名角色獲得1枚[希望]或[絕望]指示物；若該角色擁有『無視友好』且有至少1枚友好，劇作家可在劇作家能力階段使用此技能" }
    ],
    desc: "超越常理的存在。"
  },
  {
    id: "immortal", name: "仙人", module: "EXT", paranoiaLimit: 0,
    traits: ["成人", "男性"], forbidden: [], defaultStart: "shrine",
    specials: [
      "初始區域為神社或醫院（由劇本規定）。",
      "不安限度X為劇本規定的數值；在事件判定之外需要參照該角色的不安限度時，該角色的不安限度視為0（本工具以0顯示，劇本製作時請自行規定X）。",
      "結算該角色擔任當事人的事件時，該角色可以視為位於本來所在位置順時針相鄰的版圖。"
    ],
    goodwill: [
      { cost: 5, oncePerLoop: true, target: "location", effect: "sennin_move_resurrect", desc: "將該角色移動至任意版圖或遠方。隨後，復活同一區域任意1具屍體，並在那張卡牌上放置X枚友好指示物（X為劇本規定的數值）。" }
    ],
    desc: "超脫凡塵、神龍見首不見尾的仙人。"
  },
  {
    id: "uploader", name: "Up主", module: "EXT", paranoiaLimit: 2,
    traits: ["男性", "學生"], forbidden: [], defaultStart: "distant",
    specials: ["第一次事件發生後，當天結束階段往1個少女/少年放置1張Ex；使用技能時可視為處在有Ex角色所在的地區。"],
    goodwill: [
      { cost: 3, target: "char", effect: "goodwill_paranoia_ex", desc: "同一區域另外1名角色友好＋1、不安－1，然後可將那名角色的Ex卡移動到同區域且非Up主的角色身上" }
    ],
    desc: "活躍於網路的匿名上傳者。"
  }
];

window.CHAR_INDEX = {};
window.CHARACTERS.forEach(function (c) { CHAR_INDEX[c.id] = c; });
