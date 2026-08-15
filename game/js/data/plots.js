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
  },
  // ================= AHR 規則Y =================
  {
    id: "the_forbidden_future", name: "閉鎖的未來", module: "AHR",
    roles: ["obstinate", "marionette", "key_person", "lullaby", "brain", "storyteller"],
    rule: { type: "light_world_at_loop_end" },
    desc: "【失敗條件：輪迴結束時】當前為表世界。"
  },
  {
    id: "fairy_tale_murderer", name: "童話中的殺人鬼", module: "AHR",
    roles: ["storyteller", "key_person", "brain"],
    rule: null,
    desc: "沒有追加規則。"
  },
  {
    id: "mother_goose_mystery", name: "鵝媽媽神秘故事", module: "AHR",
    roles: ["marionette", "storyteller", "shifter", "fragment"],
    rule: { type: "corpses_by_loop", max: 3 },
    desc: "【失敗條件：輪迴結束時】有X具或以上屍體。（X＝當前輪迴數，且最大為3）"
  },
  {
    id: "dimensional_merger", name: "次元融合計劃", module: "AHR",
    roles: ["storyteller", "shifter", "fragment"],
    rule: { type: "last_will_or_left_behind" },
    desc: "【失敗條件：輪迴結束時】本輪輪迴中引發過遺言或遺失物事件。"
  },
  {
    id: "into_nothingness", name: "虛幻世界", module: "AHR",
    roles: ["obstinate", "marionette", "brain"],
    rule: { type: "ex_plus_obstinate_intrigue" },
    desc: "【失敗條件：輪迴結束時】通過本規則追加的強迫症（無論生死）身上的[密謀]數量與當前Ex槽的數值合計為3或以上。"
  },
  // ================= AHR 規則X =================
  {
    id: "jekyll_and_hyde", name: "化身博士", module: "AHR",
    roles: ["key_person", "marionette"],
    rule: null, desc: "沒有追加規則。（身份為雙重身份：表世界關鍵人物/裏世界主謀，最終決戰需兩個身份都對）"
  },
  {
    id: "the_plaguebringer", name: "惡魔吹著笛子來", module: "AHR",
    roles: ["pied_piper", "gossip"],
    rule: null, desc: "沒有追加規則。（身份為雙重身份：表世界魔笛手/裏世界佈道者）"
  },
  {
    id: "puppeteers_strings", name: "傀儡之線", module: "AHR",
    roles: ["fragment", "gossip", "serial_killer"],
    rule: { type: "puppeted_refusal" },
    desc: "【強制：常駐】所有無視友好變為傀儡無視友好。（包括通過[絕望]附加的必定無視友好特性）"
  },
  {
    id: "through_the_looking_glass", name: "愛麗絲夢遊仙境", module: "AHR",
    roles: ["conspiracy_theorist", "alice"],
    scriptConstraint: { role: "alice", trait: "少女", desc: "愛麗絲必須有少女屬性" },
    rule: null,
    desc: "【強制：劇本製作時】愛麗絲必須有少女屬性。（身份為雙重身份：表世界傳謠人/裏世界殺人狂）"
  },
  {
    id: "unspeakable_horrors", name: "難以言喻的怪物", module: "AHR",
    roles: ["conspiracy_theorist", "gossip"],
    rule: { type: "ex3_kill_p" },
    desc: "【任意能力：回合結束階段】Ex槽為3或以上→主人公死亡。"
  },
  {
    id: "hysteria_virus", name: "空想擴大病毒", module: "AHR",
    roles: ["fragment", "conspiracy_theorist", "gossip"],
    rule: { type: "hysteria_virus" },
    desc: "【強制：常駐】當前為裏世界→身上有2種或以上不同指示物的平民或因果殘片的角色身份變為殺人狂。"
  },
  // ================= LL 規則Y =================
  {
    id: "the_final_plan", name: "最終計劃", module: "LL",
    roles: ["key_person", "brain", "killer"],
    rule: { type: "hope_on_key_person" },
    desc: "【強制：常駐】關鍵人物（無論生死）身上有1枚或以上[希望]→所有主人公不再是背叛者。如果當前為最終輪迴，則最終決戰時依然生效。"
  },
  {
    id: "the_sealed_conclusion", name: "封印的終末", module: "LL",
    roles: ["factor", "fragment"],
    rule: { type: "shrine_intrigue_day_end" },
    desc: "【任意能力：回合結束階段】神社有2枚或以上[密謀]→主人公死亡。\n【強制：進行判定時】計算某塊版圖上的[密謀]數量時，該區域角色身上的[希望]和[絕望]也視為位於版圖上。"
  },
  {
    id: "world_of_rebellion", name: "叛逆的世界", module: "LL",
    roles: ["key_person", "fragment"],
    scriptConstraint: { role: "key_person", trait: "少女", desc: "關鍵人物必須有少女屬性" },
    rule: { type: "intrigue_on_role", role: "key_person", count: 2 },
    desc: "【強制：劇本製作時】關鍵人物與因果殘片必須有少女屬性。\n【失敗條件：輪迴結束時】關鍵人物有2枚或以上[密謀]。"
  },
  {
    id: "the_demons_script", name: "惡魔的劇本", module: "LL",
    roles: ["watcher", "serial_killer"],
    rule: { type: "last_will_or_executor" },
    desc: "【失敗條件：輪迴結束時】本輪輪迴中引發過遺言或代行者事件。\n【任意能力：最終日的回合結束階段】若監視者身上的指示物僅有1枚或以下→主人公死亡。"
  },
  {
    id: "giant_time_bomb_z", name: "巨大定時炸彈Z", module: "LL",
    roles: ["witch"],
    rule: { type: "intrigue_on_start_location", role: "witch", count: 2 },
    desc: "【失敗條件：輪迴結束時】魔女的初始區域有2枚或以上[密謀]。"
  },
  // ================= LL 規則X =================
  {
    id: "the_real_monster", name: "真正的怪物", module: "LL",
    roles: ["serial_killer", "secretkeeper", "wildcard"],
    rule: { type: "traitor_a" },
    desc: "【特殊勝利條件A：回合結束階段】總計放置過5枚或以上已死亡標誌。"
  },
  {
    id: "keeper_of_mythology", name: "神話蒐集者", module: "LL",
    roles: ["influencer", "secretkeeper", "wildcard"],
    rule: { type: "traitor_b" },
    desc: "【特殊勝利條件B：主人公能力階段】總計放置過6枚或以上已溝通標誌。"
  },
  {
    id: "i_am_the_true_detective", name: "我才是名偵探", module: "LL",
    roles: ["watcher", "secretkeeper", "wildcard"],
    rule: { type: "traitor_c" },
    desc: "【特殊勝利條件C：最終決戰】最終決戰前主人公C獲得推理機會，需要正確推理所有事件的當事人。"
  },
  {
    id: "unsafe_trigger_ll", name: "χ異因子", module: "LL",
    roles: ["factor"],
    rule: null,
    desc: "【任意能力：劇作家能力階段】往存活的不安定因子所在的版圖放置1枚[密謀]。（每輪限1次）"
  },
  {
    id: "social_media_paranoia", name: "SNS恐慌", module: "LL",
    roles: ["serial_killer", "influencer", "conspiracy_theorist"],
    rule: null, desc: "沒有追加規則。"
  },
  {
    id: "the_mythomaniacs_secret", name: "捏造的秘密", module: "LL",
    roles: ["conspiracy_theorist"],
    rule: { type: "mythomaniac_secret" },
    desc: "【強制：劇本製作時】密鑰獲得無視友好。如果劇本中不存在密鑰，選擇追加1名殺手、主謀或者因果殘片。（不能追加劇本規則中已存在的身份）"
  },
  // ================= HSA 規則Y =================
  {
    id: "the_noble_bloodline", name: "高貴的血族", module: "HSA",
    roles: ["key_person", "vampire"],
    scriptConstraint: { role: "key_person", notTrait: "vampire", desc: "關鍵人物和吸血鬼必須互為異性" },
    rule: null,
    desc: "【強制：劇本製作時】關鍵人物和吸血鬼必須互為異性。"
  },
  {
    id: "moonlit_beast", name: "月夜兇獸", module: "HSA",
    roles: ["vampire", "werewolf"],
    rule: null, desc: "沒有追加規則。"
  },
  {
    id: "nightmares_in_the_mist", name: "霧中夜驚夢", module: "HSA",
    roles: ["vampire", "werewolf", "nightmare"],
    rule: null, desc: "沒有追加規則。"
  },
  {
    id: "the_living_dead", name: "古墓活屍", module: "HSA",
    roles: ["paper_tiger", "coward", "zombie"],
    rule: { type: "corpse_to_zombie" },
    desc: "【強制：常駐】平民、膽小鬼和紙老虎的屍體身份變為喪屍。"
  },
  {
    id: "cursed_land", name: "被詛咒的土地", module: "HSA",
    roles: ["ghost", "coward", "zombie"],
    rule: { type: "curse_no_target" },
    desc: "【任意能力：回合結束階段】本回合結束階段結算詛咒牌時，1張或以上位於版圖上的詛咒牌沒有目標角色可以放置→主人公死亡。"
  },
  // ================= HSA 規則X =================
  {
    id: "panicky_party", name: "心慌派對", module: "HSA",
    roles: [],
    rule: null, desc: "使用慘劇10週年紀念擴展的追加規則。"
  },
  {
    id: "love_story", name: "戀愛風景線", module: "HSA",
    roles: ["lover", "loved_one"],
    rule: null, desc: "沒有追加規則。"
  },
  {
    id: "witchs_curse", name: "魔女遺咒", module: "HSA",
    roles: ["witch"],
    rule: { type: "witch_curse" },
    desc: "【任意能力：輪迴開始時】往魔女的初始區域對應的版圖上放置1張詛咒牌。"
  },
  {
    id: "girl_crisis", name: "少女大危機", module: "HSA",
    roles: ["key_person"],
    scriptConstraint: { role: "key_person", trait: "少女", desc: "關鍵人物必須有少女屬性" },
    rule: null,
    desc: "【強制：劇本製作時】關鍵人物必須有少女屬性。"
  },
  {
    id: "monsters_plot", name: "怪物們的陰謀", module: "HSA",
    roles: ["vampire", "werewolf", "nightmare"],
    rule: { type: "monsters_plot" },
    desc: "【任意能力：劇作家能力階段】往擁有無視友好身份特性的角色所在版圖放置1枚[密謀]（每日限1次，每輪限2次）。"
  },
  {
    id: "paranoia_and_delusion", name: "恐慌與妄想", module: "HSA",
    roles: ["conspiracy_theorist"],
    rule: null, desc: "沒有追加規則。"
  },
  {
    id: "the_stubborn", name: "不聽勸的人", module: "HSA",
    roles: ["key_person", "brain", "serial_killer"],
    rule: null, desc: "沒有追加規則。"
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
  // ================= 十周年（觀測者之書）副規則 =================
  {
    id: "crossing_world_lines", name: "超越世界線", module: "both", roles: ["conspiracy_theorist"],
    rule: null,
    desc: "【強制：輪迴開始時】偶數輪輪迴開始時劇作家獲得「絕望+1」。最終輪迴開始時主人公獲得「希望+1」。"
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
