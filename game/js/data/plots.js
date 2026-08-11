// 規則Y（主規則）與規則X（副規則），依據 FS+BTX 模組紙
window.MAIN_PLOTS = [
  // ---------- FS ----------
  {
    id: "murder_plan", name: "謀殺計劃", module: "both", roles: ["key_person", "brain", "killer"],
    rule: null, desc: "沒有追加規則。"
  },
  {
    id: "light_of_the_avenger", name: "復仇的火種", module: "FS", roles: ["brain"],
    rule: { type: "intrigue_on_start_location", role: "brain", count: 2 },
    desc: "【失敗條件：輪迴結束時】主謀的初始區域有2枚或以上[密謀]。"
  },
  {
    id: "a_place_to_protect", name: "守護此地", module: "FS", roles: ["key_person", "cultist"],
    rule: { type: "intrigue_on_location", location: "school", count: 2 },
    desc: "【失敗條件：輪迴結束時】學校有2枚或以上[密謀]。"
  },
  // ---------- BTX ----------
  {
    id: "the_sealed_item", name: "被封印的邪靈", module: "both", roles: ["brain", "cultist"],
    rule: { type: "intrigue_on_location", location: "shrine", count: 2 },
    desc: "【失敗條件：輪迴結束時】神社有2枚或以上[密謀]。"
  },
  {
    id: "sign_with_me", name: "和我簽訂契約吧！", module: "BTX", roles: ["key_person"],
    rule: { type: "intrigue_on_role", role: "key_person", count: 2 },
    scriptConstraint: { role: "key_person", trait: "少女", desc: "關鍵人物必須有少女屬性" },
    desc: "【強制：劇本製作時】關鍵人物必須有少女屬性。\n【失敗條件：輪迴結束時】關鍵人物有2枚或以上[密謀]。"
  },
  {
    id: "changing_the_future", name: "改變未來", module: "BTX", roles: ["cultist", "time_traveler"],
    rule: { type: "butterfly_happened" },
    desc: "【失敗條件：輪迴結束時】本輪輪迴中引發過蝴蝶效應事件。"
  },
  {
    id: "giant_time_bomb", name: "巨大定時炸彈X", module: "BTX", roles: ["witch"],
    rule: { type: "intrigue_on_start_location", role: "witch", count: 2 },
    desc: "【失敗條件：輪迴結束時】魔女的初始區域有2枚或以上[密謀]。"
  },
  // ================= MC / MZ / WM 規則Y =================
  {
    id: "quilt_of_incidents", name: "事件交織的羅網", module: "MC", roles: ["key_person", "poisoner", "brain"],
    rule: { type: "ex_gauge", op: "gte", count: 3 },
    desc: "【失敗條件：輪迴結束時】Ex槽為3或以上。"
  },
  {
    id: "tightrope_plan", name: "命懸一線的計劃", module: "MC", roles: ["key_person", "killer", "brain"],
    rule: { type: "ex_gauge", op: "lte", count: 1 },
    desc: "【失敗條件：輪迴結束時】Ex槽為1或以下。"
  },
  {
    id: "the_black_school", name: "黑暗學園", module: "MC", roles: ["key_person", "brain", "killer"],
    rule: { type: "intrigue_on_location", location: "school", count: 2 },
    desc: "【失敗條件：輪迴結束時】學校的[密謀]為X枚或以上（X＝當前輪迴數－1，第1輪輪迴必定失敗）。"
  },
  {
    id: "drop_of_strychnine", name: "士的寧毒液", module: "MC", roles: ["poisoner", "key_person"],
    rule: null,
    desc: "【強制：常駐】判定「連續殺人」「自殺」是否發生時，[密謀]視作[不安]處理。"
  },
  {
    id: "secret_record", name: "絕密報告", module: "MZ", roles: ["key_person", "brain", "cultist"],
    rule: { type: "revealed_role_names", roles: ["brain", "factor", "magician"] },
    desc: "【失敗條件：輪迴結束時】本輪輪迴中公開過主謀、不安定因子或魔術師中任一身份的名稱。"
  },
  {
    id: "male_confrontation", name: "男子漢的戰爭", module: "MZ", roles: ["key_person", "ninja", "cultist"],
    rule: { type: "intrigue_on_role", role: "ninja", count: 2 },
    scriptConstraint: { role: "ninja", trait: "男性", notTrait: "少年", desc: "忍者必須有男性屬性（不可以是少年）" },
    desc: "【強制：劇本製作時】忍者必須有男性屬性（不可以是少年）。\n【失敗條件：輪迴結束時】忍者或其屍體有2枚或以上[密謀]。"
  },
  {
    id: "the_devils_hand", name: "魔爪漸近", module: "MZ", roles: ["brain", "cultist", "key_person"],
    rule: null,
    desc: "【強制：輪迴開始時】選擇1名上輪輪迴結束時處於死亡狀態的角色，放置1張Ex牌（不可以與「諸神之骰」重複發動）。"
  },
  {
    id: "fated_connections", name: "因果之絆", module: "MZ", roles: ["key_person", "brain"],
    rule: null,
    desc: "【強制：常駐】放置了Ex牌的角色，其身份變為關鍵人物（該角色失去原本的身份）。"
  },
  {
    id: "choir_to_the_outside_god", name: "外神合唱曲", module: "WM", roles: ["key_person", "cultist", "sacrifice"],
    rule: null,
    desc: "【失敗條件：輪迴結束時】5名或以上的生存角色身上均有1枚或以上[密謀]。"
  },
  {
    id: "sacred_words_of_dagon", name: "達貢的福音書", module: "WM", roles: ["key_person", "cultist", "witch"],
    rule: { type: "intrigue_on_location", location: "shrine", count: 1 },
    desc: "【失敗條件：輪迴結束時】神社有X枚或以上[密謀]（X＝Ex槽的值）。"
  },
  {
    id: "king_in_yellow", name: "黃衣之王", module: "WM", roles: ["key_person", "cultist", "witch"],
    rule: null,
    desc: "【失敗條件：輪迴結束時】本輪輪迴中Ex槽增加過。"
  },
  {
    id: "giant_time_bomb_y", name: "巨大定時炸彈Y", module: "WM", roles: ["witch"],
    rule: { type: "intrigue_on_start_location", role: "witch", count: 2 },
    desc: "【失敗條件：輪迴結束時】魔女的初始區域有2枚或以上[密謀]。"
  },
  {
    id: "bloody_rites", name: "染血的儀式", module: "WM", roles: ["sacrifice", "cultist"],
    rule: null,
    desc: "【失敗條件：輪迴結束時】有X具或以上屍體（X＝Ex槽的值）。"
  }
];

window.SUB_PLOTS = [
  // ---------- FS ----------
  {
    id: "shadow_of_the_ripper", name: "開膛者的魔影", module: "FS", roles: ["conspiracy_theorist", "serial_killer"],
    rule: null, desc: "沒有追加規則。"
  },
  {
    id: "unsettling_rumor", name: "流言四起", module: "FS", roles: ["conspiracy_theorist"],
    rule: { type: "mm_intrigue_any_location", perLoop: true },
    desc: "【任意能力：劇作家能力階段】往任意1塊版圖上放置1枚[密謀]。(每輪限1次)"
  },
  {
    id: "a_hideous_script", name: "最黑暗的劇本", module: "FS", roles: ["conspiracy_theorist", "friend", "curmudgeon", "curmudgeon"],
    rule: null, curmudgeonFlex: true,
    desc: "【任意能力：劇本製作時】劇本製作時，暴徒的人數可以為0-2人。",
    rolesNote: "暴徒 0-2 人（彈性）"
  },
  // ---------- BTX ----------
  {
    id: "circle_of_friends", name: "好友圈", module: "BTX", roles: ["friend", "friend", "conspiracy_theorist"],
    rule: null, desc: "沒有追加規則。"
  },
  {
    id: "a_love_affair", name: "戀愛風景線", module: "BTX", roles: ["lover", "loved_one"],
    rule: null, desc: "沒有追加規則。"
  },
  {
    id: "the_hidden_freak", name: "潛伏的殺人狂", module: "both", roles: ["friend", "serial_killer"],
    rule: null, desc: "沒有追加規則。"
  },
  {
    id: "unsettling_rumor_b", name: "流言四起", module: "BTX", roles: ["conspiracy_theorist"],
    rule: { type: "mm_intrigue_any_location", perLoop: true },
    desc: "【任意能力：劇作家能力階段】往任意1塊版圖上放置1枚[密謀]。(每輪限1次)"
  },
  {
    id: "paranoia_virus", name: "妄想擴大病毒", module: "BTX", roles: ["conspiracy_theorist"],
    rule: { type: "paranoia_virus" },
    desc: "【強制：常駐】某1名平民角色有3枚或以上[不安]時，那名平民身份變為殺人狂。"
  },
  {
    id: "threads_of_fate", name: "因果線", module: "BTX", roles: [],
    rule: { type: "threads_of_fate" },
    desc: "【強制：輪迴開始時】上輪輪迴結束時所有帶有[友好]的角色，全部放置2枚[不安]。"
  },
  {
    id: "unknown_factor_x", name: "未知因子χ", module: "BTX", roles: ["factor"],
    rule: null, desc: "沒有追加規則。"
  },
  // ================= MC / MZ / WM 規則X =================
  {
    id: "isolation_institution_psycho", name: "隔離病房驚魂記", module: "MC", roles: ["key_person", "therapist", "brain"],
    rule: null,
    desc: "【強制：輪迴開始時】上輪輪迴結束時Ex槽為2或以下→Ex槽增加1。"
  },
  {
    id: "smell_of_gunpowder", name: "火藥的味道", module: "MC", roles: ["key_person", "brain", "killer"],
    rule: null,
    desc: "【失敗條件：輪迴結束時】所有生存角色身上的[不安]總數為12枚或以上。"
  },
  {
    id: "i_am_a_master_detective", name: "我是名偵探", module: "MC", roles: ["detective", "key_person"],
    rule: null,
    desc: "【強制：劇本製作時】偵探必須成為某1個事件的當事人。"
  },
  {
    id: "dance_of_fools", name: "愚者之舞", module: "MC", roles: ["fool", "brain"],
    rule: null,
    desc: "沒有追加規則。"
  },
  {
    id: "an_absolute_will", name: "絕對意志", module: "MC", roles: ["obstinate", "key_person"],
    rule: null,
    desc: "【強制：劇本製作時】強迫症必須成為某1個事件的當事人。"
  },
  {
    id: "tricky_twins", name: "雙子的詭計", module: "MC", roles: ["twin", "key_person"],
    rule: null,
    desc: "【強制：劇本製作時】雙胞胎必須成為某1個事件的當事人。"
  },
  {
    id: "love_hate_spiral", name: "愛與恨的螺旋", module: "MZ", roles: ["key_person", "brain"],
    rule: null,
    desc: "沒有追加規則。"
  },
  {
    id: "witches_tea_time", name: "魔女的茶會", module: "MZ", roles: ["witch", "brain", "cultist"],
    rule: null,
    desc: "沒有追加規則。"
  },
  {
    id: "dice_of_the_gods", name: "諸神之骰", module: "MZ", roles: ["brain", "cultist"],
    rule: null,
    desc: "【強制：輪迴開始時】選擇1名上一輪輪迴結束時處於死亡狀態的角色，放置1張Ex牌（不可以與「因果之絆」重複發動）。"
  },
  {
    id: "unsafe_trigger", name: "χ異因子", module: "MZ", roles: ["factor"],
    rule: null,
    desc: "【任意能力：劇作家能力階段】往存活的不安定因子所在版圖放置1枚[密謀]。（每輪限1次）"
  },
  {
    id: "showtime_of_death", name: "死亡真人秀", module: "MZ", roles: ["brain", "cultist", "key_person"],
    rule: null,
    desc: "【失敗條件：輪迴結束時】生存角色數量為6名或以下。"
  },
  {
    id: "unanswered_heart", name: "心無靈犀", module: "MZ", roles: ["key_person", "brain"],
    rule: null,
    desc: "【強制：行動結算階段】禁止友好同時具備禁止移動的效果。"
  },
  {
    id: "worshippers_of_the_apocalypse", name: "滅亡謳歌", module: "MZ", roles: ["prophet", "cultist"],
    rule: null,
    desc: "【強制：劇本製作時】必須引入1個或以上的自殺事件。\n【強制：事件階段】當事人的身份為平民的事件在判定是否發生時，如果預言家存活，該當事人的不安限度－1。"
  },
  {
    id: "unsettling_rumor_w", name: "流言四起", module: "WM", roles: ["conspiracy_theorist"],
    rule: { type: "mm_intrigue_any_location", perLoop: true },
    desc: "【任意能力：劇作家能力階段】往任意1塊版圖上放置1枚[密謀]。(每輪限1次)"
  },
  {
    id: "the_resistance", name: "抗爭者", module: "WM", roles: ["key_person", "witness"],
    rule: null,
    desc: "沒有追加規則。"
  },
  {
    id: "people_who_saw", name: "見證恐懼", module: "WM", roles: ["witness", "conspiracy_theorist"],
    rule: null,
    desc: "沒有追加規則。"
  },
  {
    id: "the_profound_race", name: "伊斯之偉大種族", module: "WM", roles: ["key_person", "faceless"],
    rule: null,
    desc: "沒有追加規則。"
  },
  {
    id: "whispers_from_the_deep", name: "深淵之都的私語", module: "WM", roles: ["deep_one", "conspiracy_theorist"],
    rule: null,
    desc: "【強制：常駐】偏執狂獲得關鍵人物的能力（身份不發生變化）。"
  },
  {
    id: "the_faceless_god", name: "無貌之神", module: "WM", roles: ["faceless", "key_person"],
    rule: null,
    desc: "沒有追加規則。"
  },
  {
    id: "twisted_truth", name: "瘋狂的真相", module: "WM", roles: ["wizard", "key_person"],
    rule: null,
    desc: "【強制：劇本製作時】情報商必須登場。\n【強制：輪迴開始時】Ex槽為2或以上→本輪輪迴中，規則Y規定的失敗條件變更為（劇本事先設定的）另一條規則Y的失敗條件。"
  }
];

window.PLOT_INDEX = {};
window.MAIN_PLOTS.concat(window.SUB_PLOTS).forEach(function (p) { PLOT_INDEX[p.id] = p; });
