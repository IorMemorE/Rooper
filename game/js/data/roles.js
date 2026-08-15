// 身份（角色）数据，依据 FS+BTX 模组纸
// refusal: none | optional(無視友好) | mandatory(必定無視友好)
// ability.timing: always | card_resolve | mm_phase | day_end | loop_start | loop_end | day_start | final_day_end | script_creation
window.ROLES = [
  {
    id: "key_person", name: "關鍵人物", max: null, refusal: "none",
    deathLoss: true, appearsIn: ["murder_plan", "a_place_to_protect", "sign_with_me", "the_forbidden_future", "fairy_tale_murderer", "jekyll_and_hyde", "the_final_plan", "world_of_rebellion", "the_noble_bloodline", "moonlit_beast", "nightmares_in_the_mist", "the_living_dead", "cursed_land"],
    abilities: [
      { timing: "always", mandatory: true, desc: "【強制：常駐】該角色死亡時，主人公失敗，當前輪迴立即結束。", effect: "key_person_death" }
    ]
  },
  {
    id: "killer", name: "殺手", max: null, refusal: "optional",
    appearsIn: ["murder_plan", "the_final_plan"],
    abilities: [
      { timing: "day_end", mandatory: false, desc: "【任意：回合結束階段】同一區域1名關鍵人物身上有2枚或以上[密謀]→那名關鍵人物死亡。", effect: "killer_kill_key" },
      { timing: "day_end", mandatory: false, desc: "【任意：回合結束階段】該角色身上有4枚或以上[密謀]→主人公死亡。", effect: "killer_kill_protagonists" }
    ]
  },
  {
    id: "brain", name: "主謀", max: null, refusal: "optional",
    appearsIn: ["murder_plan", "light_of_the_avenger", "the_sealed_item", "the_forbidden_future", "fairy_tale_murderer", "into_nothingness", "the_final_plan", "giant_time_bomb_z", "the_stubborn"],
    abilities: [
      { timing: "mm_phase", mandatory: false, desc: "【任意：劇作家能力階段】往同一區域中任意1名角色身上，或者該角色所在的版圖上放置1枚[密謀]。", effect: "brain_intrigue" }
    ]
  },
  {
    id: "cultist", name: "邪教徒", max: null, refusal: "mandatory",
    appearsIn: ["a_place_to_protect", "the_sealed_item", "changing_the_future"],
    abilities: [
      { timing: "card_resolve", mandatory: false, desc: "【任意：行動結算階段】可以無效化同一區域中任意角色身上和該角色所在版圖上放置的禁止密謀。", effect: "cultist_cancel_forbid_intrigue" }
    ]
  },
  {
    id: "conspiracy_theorist", name: "傳謠人", max: 1, refusal: "none",
    appearsIn: ["shadow_of_the_ripper", "unsettling_rumor", "a_hideous_script", "circle_of_friends", "paranoia_virus"],
    abilities: [
      { timing: "mm_phase", mandatory: false, desc: "【任意：劇作家能力階段】往同一區域中任意1名角色身上放置1枚[不安]。", effect: "ct_paranoia" }
    ]
  },
  {
    id: "serial_killer", name: "殺人狂", max: null, refusal: "none",
    appearsIn: ["shadow_of_the_ripper", "the_hidden_freak", "paranoia_virus", "the_demons_script", "the_real_monster", "social_media_paranoia", "the_stubborn"],
    abilities: [
      { timing: "day_end", mandatory: true, desc: "【強制：回合結束階段】僅有1名角色與該角色位於同一區域→那名角色死亡。", effect: "serial_kill" }
    ]
  },
  {
    id: "curmudgeon", name: "暴徒", max: null, refusal: "optional",
    appearsIn: ["a_hideous_script"],
    abilities: [
      { timing: "loop_end", mandatory: true, desc: "【失敗條件：輪迴結束時】該卡牌為死亡狀態。此時，需要告知主人公該卡牌的身份。", effect: "curmudgeon_death_loss" }
    ]
  },
  {
    id: "friend", name: "親友", max: 2, refusal: "none",
    appearsIn: ["a_hideous_script", "circle_of_friends", "the_hidden_freak"],
    abilities: [
      { timing: "loop_start", mandatory: true, desc: "【強制：輪迴開始時】該角色身份曾被公開→往該角色身上放置1枚[友好]。", effect: "friend_loop_start_goodwill" },
      { timing: "loop_end", mandatory: true, desc: "【失敗條件：輪迴結束時】該角色死亡→公開身份，主人公失敗。", effect: "friend_death_loss" }
    ]
  },
  {
    id: "time_traveler", name: "時間旅者", max: null, refusal: "none",
    undying: true, appearsIn: ["changing_the_future"],
    abilities: [
      { timing: "always", mandatory: true, desc: "【強制：常駐】該角色不會死亡。", effect: "undying" },
      { timing: "card_resolve", mandatory: true, desc: "【強制：行動結算階段】該角色身上的禁止友好被無視。", effect: "tt_ignore_forbid_goodwill" },
      { timing: "final_day_end", mandatory: false, desc: "【任意：最終日的回合結束階段】該角色身上的[友好]為2枚或以下→主人公失敗，當前輪迴立即結束。", effect: "tt_final_day_loss" }
    ]
  },
  {
    id: "witch", name: "魔女", max: null, refusal: "mandatory",
    appearsIn: ["giant_time_bomb", "giant_time_bomb_z", "witches_tea_time", "witchs_curse"],
    abilities: [
      { timing: "loop_end", mandatory: true, desc: "【失敗條件：輪迴結束時】該卡牌為死亡狀態。此時，需要告知主人公該卡牌的身份。", effect: "witch_death_loss" }
    ]
  },
  {
    id: "factor", name: "不安定因子", max: null, refusal: "optional",
    appearsIn: ["unknown_factor_x", "the_sealed_conclusion", "unsafe_trigger_ll"],
    abilities: [
      { timing: "always", mandatory: true, desc: "【強制：常駐】學校有2枚或以上[密謀]→該角色獲得傳謠人的能力。（身份依然為[不安定因子]）", effect: "factor_ct_ability" },
      { timing: "always", mandatory: true, desc: "【強制：常駐】都市有2枚或以上[密謀]→該角色獲得關鍵人物的能力。（身份依然為[不安定因子]）", effect: "factor_key_person_ability" }
    ]
  },
  {
    id: "loved_one", name: "心上人", max: null, refusal: "none",
    appearsIn: ["a_love_affair"],
    abilities: [
      { timing: "always", mandatory: true, desc: "【強制：常駐】求愛者死亡時→往該角色身上放置6枚[不安]。", effect: "lover_dies_give_paranoia" }
    ]
  },
  {
    id: "lover", name: "求愛者", max: null, refusal: "none",
    appearsIn: ["a_love_affair"],
    abilities: [
      { timing: "always", mandatory: true, desc: "【強制：常駐】心上人死亡時→往該角色身上放置6枚[不安]。", effect: "loved_one_dies_give_paranoia" },
      { timing: "day_end", mandatory: false, desc: "【任意：回合結束階段】該角色身上有1枚或以上[密謀]且有3枚或以上[不安]→主人公死亡。", effect: "lover_kill_protagonists" }
    ]
  },
  // ================= MC / MZ / WM 擴充身份 =================
  {
    id: "poisoner", name: "投毒者", max: null, refusal: "optional",
    appearsIn: ["quilt_of_incidents", "drop_of_strychnine"],
    abilities: [
      { timing: "day_end", mandatory: true, desc: "【強制：回合結束階段】Ex槽為2或以上→使同一區域的1名角色死亡。（每輪限1次）", effect: "poisoner_kill" },
      { timing: "day_end", mandatory: true, desc: "【強制：回合結束階段】Ex槽為4或以上→主人公死亡。", effect: "poisoner_kill_p" }
    ]
  },
  {
    id: "fool", name: "愚者", max: null, refusal: "none",
    appearsIn: ["dance_of_fools"],
    abilities: [
      { timing: "always", mandatory: true, desc: "【強制：擔任當事人的事件完成結算後】移除該卡牌上所有的[不安]。", effect: "fool_clear_paranoia" }
    ]
  },
  {
    id: "paranoiac", name: "偏執狂", max: null, refusal: "mandatory",
    appearsIn: ["an_absolute_will", "whispers_from_the_deep"],
    abilities: [
      { timing: "mm_phase", mandatory: false, desc: "【任意：劇作家能力階段】往該角色身上放置1枚[密謀]或[不安]。", effect: "paranoiac_self_marker" }
    ]
  },
  {
    id: "therapist", name: "心理醫生", max: null, refusal: "none",
    appearsIn: ["isolation_institution_psycho"],
    abilities: [
      { timing: "mm_phase", mandatory: true, desc: "【強制：劇作家能力階段】Ex槽為1或以上→移除同一區域中自身以外1名角色身上的1枚[不安]。", effect: "therapist_remove_paranoia" }
    ]
  },
  {
    id: "detective", name: "偵探", max: null, refusal: "none", undying: true,
    appearsIn: ["i_am_a_master_detective"],
    abilities: [
      { timing: "incident", mandatory: true, desc: "【強制：事件階段】Ex槽為0→如果與當天事件的當事人（存活）處於同一區域，則事件必定發生。", effect: "detective_force_incident" }
    ]
  },
  {
    id: "obstinate", name: "強迫症", max: null, refusal: "mandatory",
    appearsIn: ["an_absolute_will", "witches_tea_time"],
    abilities: [
      { timing: "incident", mandatory: true, desc: "【強制：事件階段】當事人為該角色的事件必定會發生。", effect: "obstinate_force_incident" }
    ]
  },
  {
    id: "twin", name: "雙胞胎", max: null, refusal: "none",
    appearsIn: ["tricky_twins"],
    abilities: [
      { timing: "incident", mandatory: true, desc: "【強制：結算該角色擔任當事人的事件時】該角色視為位於本來所在位置對角線上的版圖。", effect: "twin_diagonal" }
    ]
  },
  {
    id: "ninja", name: "忍者", max: null, refusal: "optional",
    appearsIn: ["male_confrontation"],
    abilities: [
      { timing: "always", mandatory: true, desc: "【任意：常駐】需公開該角色身份時，可以宣稱本局遊戲非公開信息表中的任意非平民身份名。", effect: "ninja_fake_reveal" },
      { timing: "loop_end", mandatory: true, desc: "【失敗條件：輪迴結束時】該卡牌為死亡狀態。此時，需要告知主人公該卡牌的身份。", effect: "ninja_death_loss" }
    ]
  },
  {
    id: "magician", name: "魔術師", max: null, refusal: "none",
    appearsIn: ["witches_tea_time"],
    abilities: [
      { timing: "mm_phase", mandatory: false, desc: "【任意：劇作家能力階段】使同一區域中1名放置了1枚或以上不安指示物的角色移動至相鄰版圖（所有魔術師合計，每輪限1次）。", effect: "magician_move" },
      { timing: "always", mandatory: true, desc: "【強制：該角色死亡時】移除該角色身上的所有[不安]。", effect: "magician_death_clear" }
    ]
  },
  {
    id: "immortal_role", name: "永生者", max: null, refusal: "none", undying: true,
    appearsIn: ["witches_tea_time", "choir_to_the_outside_god"],
    abilities: [
      { timing: "always", mandatory: true, desc: "【強制：常駐】劇作家不可以往該角色身上設置任何行動牌。", effect: "immortal_no_cards" }
    ]
  },
  {
    id: "prophet", name: "預言家", max: null, refusal: "none",
    appearsIn: ["worshippers_of_the_apocalypse"],
    abilities: [
      { timing: "incident", mandatory: true, desc: "【強制：事件階段】與該角色位於同一區域的其他角色不會觸發事件。", effect: "prophet_block_incident" }
    ]
  },
  {
    id: "sacrifice", name: "祭品", max: null, refusal: "none", undying: true,
    appearsIn: ["choir_to_the_outside_god", "bloody_rites"],
    abilities: [
      { timing: "incident", mandatory: true, desc: "【強制：事件階段】判定該角色擔任當事人的事件是否發生時，[密謀]視為[不安]處理。", effect: "sacrifice_intrigue_as_paranoia" }
    ]
  },
  {
    id: "deep_one", name: "深潛者", max: null, refusal: "optional",
    appearsIn: ["whispers_from_the_deep"],
    abilities: [
      { timing: "mm_phase", mandatory: false, desc: "【任意：劇作家能力階段】往同一區域中任意1名角色身上，或者該角色所在的版圖上放置1枚[密謀]。", effect: "brain_intrigue" },
      { timing: "always", mandatory: true, desc: "【強制：該角色死亡時】公開該角色身份，Ex槽增加1。", effect: "deep_one_death_reveal" }
    ]
  },
  {
    id: "wizard", name: "巫師", max: null, refusal: "none",
    appearsIn: ["twisted_truth"],
    abilities: [
      { timing: "loop_end", mandatory: true, desc: "【失敗條件：輪迴結束時】該卡牌為死亡狀態。", effect: "wizard_death_loss" },
      { timing: "always", mandatory: true, desc: "【強制：結算該角色友好能力後】公開該角色身份。之後，隊長可以使Ex槽增加1。", effect: "wizard_reveal_after_goodwill" }
    ]
  },
  {
    id: "witness", name: "目擊者", max: null, refusal: "none",
    appearsIn: ["the_resistance", "people_who_saw"],
    abilities: [
      { timing: "day_end", mandatory: true, desc: "【強制：回合結束階段】該角色有4枚或以上[不安]→該角色死亡，Ex槽增加1。", effect: "witness_death" }
    ]
  },
  {
    id: "faceless", name: "無面者", max: null, refusal: "optional",
    appearsIn: ["the_faceless_god"],
    abilities: [
      { timing: "mm_phase", mandatory: false, desc: "【強制：常駐】Ex槽為1或以下→該角色獲得傳謠人的能力（身份不發生變化）。", effect: "faceless_ct" },
      { timing: "mm_phase", mandatory: false, desc: "【強制：常駐】Ex槽為2或以上→該角色獲得深潛者的能力（身份不發生變化）。", effect: "faceless_deep_one" }
    ]
  },
  // ================= 十周年（觀測者之書 / AHR / LL）身份 =================
  {
    id: "fragment", name: "因果殘片", max: null, refusal: "none",
    appearsIn: ["crossing_world_lines", "the_sealed_conclusion", "world_of_rebellion", "dimensional_merger", "puppeteers_strings", "hysteria_virus", "into_nothingness"],
    abilities: [
      { timing: "loop_start", mandatory: true, desc: "【強制：輪迴開始時】若該角色在上輪輪迴結束時為死亡狀態→劇作家獲得「絕望+1」。若該角色上輪輪迴結束時存活且身上有2枚或以上[友好]→主人公獲得「希望+1」。", effect: "fragment_loop_start" }
    ]
  },
  // ================= AHR 身份 =================
  {
    id: "marionette", name: "提線木偶", max: null, refusal: "puppeted",
    appearsIn: ["the_forbidden_future", "mother_goose_mystery", "into_nothingness", "jekyll_and_hyde"],
    abilities: [
      { timing: "always", mandatory: true, desc: "【強制：結算該角色友好能力後】該角色身上有2種或以上不同指示物→該角色死亡，進行世界移動。", effect: "marionette_after_goodwill" },
      { timing: "day_end", mandatory: false, desc: "【任意：回合結束階段】該角色身上有4種或以上不同指示物→主人公死亡。", effect: "marionette_kill_p" }
    ]
  },
  {
    id: "storyteller", name: "敘述者", max: null, refusal: "none", undying: true,
    appearsIn: ["the_forbidden_future", "fairy_tale_murderer", "mother_goose_mystery", "dimensional_merger"],
    abilities: [
      { timing: "mm_phase", mandatory: false, desc: "【任意：劇作家能力階段】Ex槽為1或以上→選擇與該角色位於同一區域的另外2名角色，移動所選2名角色之間的1枚指示物。", effect: "storyteller_move_counter" },
      { timing: "loop_start", mandatory: true, desc: "【強制：輪迴開始時】若上輪輪迴結束時Ex槽為3或以上→主人公獲得「希望+1」。", effect: "storyteller_hope_loop" },
      { timing: "always", mandatory: true, desc: "【強制：結算該角色友好能力後】若該角色的友好能力指定了對象，那些被指定為對象的角色死亡。", effect: "storyteller_kill_targets" }
    ]
  },
  {
    id: "lullaby", name: "童謠", max: null, refusal: "puppeted",
    appearsIn: ["the_forbidden_future"],
    abilities: [
      { timing: "mm_phase", mandatory: false, desc: "【任意：劇作家能力階段】往同一區域中任意1名角色身上放置1枚[不安]或1枚[友好]。（每輪限1次）", effect: "lullaby_marker" },
      { timing: "day_end", mandatory: false, desc: "【任意：回合結束階段】該角色身上有4種或以上不同指示物→主人公死亡。", effect: "marionette_kill_p" }
    ]
  },
  {
    id: "shifter", name: "次元旅者", max: null, refusal: "none", undying: true,
    appearsIn: ["dimensional_merger"],
    abilities: [
      { timing: "always", mandatory: true, desc: "【強制：行動結算階段】無視該角色身上放置的禁止友好。", effect: "tt_ignore_forbid_goodwill" },
      { timing: "final_day_end", mandatory: false, desc: "【任意：最終日的回合結束階段】該角色身上有2種或以下不同指示物→主人公死亡。", effect: "shifter_final_day" }
    ]
  },
  {
    id: "pied_piper", name: "魔笛手", max: null, refusal: "optional",
    appearsIn: ["the_plaguebringer"],
    abilities: [
      { timing: "day_end", mandatory: true, desc: "【強制：回合結束階段】Ex槽為2或以上→同一區域任意1名角色死亡。（每輪限1次）", effect: "pied_piper_kill" },
      { timing: "day_end", mandatory: false, desc: "【任意：回合結束階段】往同一區域任意1具屍體上放置1枚[密謀]。隨後，如果所有屍體上的[密謀]合計有3枚或以上，則主人公死亡。", effect: "pied_piper_corpse" }
    ]
  },
  {
    id: "gossip", name: "佈道者", max: null, refusal: "none",
    appearsIn: ["the_plaguebringer", "puppeteers_strings", "unspeakable_horrors", "hysteria_virus"],
    abilities: [
      { timing: "mm_phase", mandatory: false, desc: "【任意：劇作家能力階段】往同一區域中任意1名角色身上放置1枚[友好]。", effect: "gossip_goodwill" },
      { timing: "always", mandatory: true, desc: "【強制：該角色死亡時】往同一區域中任意1名角色身上放置1枚[絕望]。隨後，可以進行世界移動。", effect: "gossip_death" }
    ]
  },
  {
    id: "alice", name: "愛麗絲", max: null, refusal: "none",
    appearsIn: ["through_the_looking_glass"],
    abilities: [
      { timing: "loop_end", mandatory: true, desc: "【失敗條件：輪迴結束時】該角色死亡→主人公失敗。", effect: "alice_death_loss" },
      { timing: "always", mandatory: true, desc: "【強制：(1x∞)結算該角色友好能力後】Ex槽為1或以上→往同一區域中所有其他角色身上放置1枚[希望]。", effect: "alice_after_goodwill" }
    ]
  },
  // ================= LL 身份 =================
  {
    id: "watcher", name: "監視者", max: 1, refusal: "none", undying: true,
    appearsIn: ["the_demons_script", "i_am_the_true_detective"],
    abilities: [
      { timing: "incident", mandatory: true, desc: "【強制：事件階段】如果與當天事件的當事人位於同一區域且當事人身上有1枚或以上[絕望]→事件必定發生。", effect: "watcher_force_incident" }
    ]
  },
  {
    id: "influencer", name: "網絡名流", max: null, refusal: "none",
    appearsIn: ["keeper_of_mythology", "social_media_paranoia"],
    abilities: [
      { timing: "always", mandatory: true, desc: "【強制：該角色死亡時】往與該角色同一初始區域的其他所有角色身上放置1枚[不安]。", effect: "influencer_death" },
      { timing: "always", mandatory: true, desc: "【強制：(1x∞)結算該角色友好能力後】往與該角色同一初始區域的其他所有角色身上放置1枚[不安]和1枚[友好]。", effect: "influencer_after_goodwill" }
    ]
  },
  {
    id: "secretkeeper", name: "密鑰", max: null, refusal: "mandatory", undying: true,
    appearsIn: ["the_real_monster", "keeper_of_mythology", "i_am_the_true_detective"],
    abilities: [
      { timing: "always", mandatory: true, desc: "【強制：該角色死亡時或結算該角色友好能力後】公開該角色身份。", effect: "secretkeeper_reveal" },
      { timing: "always", mandatory: true, desc: "【強制：該角色身份公開後】若當前為第1或第2輪輪迴→次日劇作家僅能放置1張行動牌。次日或本輪輪迴最終日的回合結束階段主人公死亡。", effect: "secretkeeper_punish" }
    ]
  },
  {
    id: "wildcard", name: "怪傑", max: null, refusal: "mandatory", undying: true,
    appearsIn: ["the_real_monster", "keeper_of_mythology", "i_am_the_true_detective"],
    abilities: [
      { timing: "always", mandatory: true, desc: "【強制】若當前日數為3的倍數→該角色獲得傳謠人、主謀以及殺人狂的能力。", effect: "wildcard_triple" },
      { timing: "script_creation", mandatory: true, desc: "【強制：劇本製作時】必須成為某1個事件的當事人。", effect: "wildcard_culprit" }
    ]
  },
  // ================= HSA 身份 =================
  {
    id: "vampire", name: "吸血鬼", max: null, refusal: "optional", undying: true,
    appearsIn: ["the_noble_bloodline", "moonlit_beast", "nightmares_in_the_mist"],
    abilities: [
      { timing: "day_end", mandatory: false, desc: "【任意：回合結束階段】同一區域1名異性身上有1枚或以上[不安]和1枚或以上[密謀]→那名異性死亡。", effect: "vampire_kill" },
      { timing: "day_end", mandatory: false, desc: "【任意：回合結束階段】有3張或以上該角色的異性卡牌處於死亡狀態→主人公死亡。", effect: "vampire_kill_p" }
    ]
  },
  {
    id: "werewolf", name: "狼人", max: null, refusal: "optional",
    appearsIn: ["moonlit_beast", "nightmares_in_the_mist"],
    abilities: [
      { timing: "always", mandatory: true, desc: "【強制：常駐】劇作家不可以往該角色身上設置任何行動牌。", effect: "immortal_no_cards" },
      { timing: "day_end", mandatory: false, desc: "【任意：回合結束階段】本回合曾發生過[瘋狂之夜]事件→主人公死亡。", effect: "werewolf_night" }
    ]
  },
  {
    id: "nightmare", name: "夢魘", max: null, refusal: "optional",
    appearsIn: ["nightmares_in_the_mist"],
    abilities: [
      { timing: "day_end", mandatory: false, desc: "【任意：回合結束階段】與該角色位於同一區域的1名角色死亡。", effect: "nightmare_kill" }
    ]
  },
  {
    id: "ghost", name: "鬼魂", max: 2, refusal: "none", undying: true,
    appearsIn: ["cursed_land", "nightmares_in_the_mist"],
    abilities: [
      { timing: "mm_phase", mandatory: true, desc: "【強制：劇作家能力階段】如果該卡牌為死亡狀態→往位於同一區域或該卡牌初始區域的1名角色身上放置1枚[不安]。", effect: "ghost_mm_paranoia" }
    ]
  },
  {
    id: "paper_tiger", name: "紙老虎", max: null, refusal: "none", undying: true,
    appearsIn: ["the_living_dead", "cursed_land"],
    abilities: [
      { timing: "always", mandatory: true, desc: "【強制：常駐】該角色身上有2枚或以上的[不安]→該角色失去不死的身份特性，獲得必定無視友好的身份特性。", effect: "paper_tiger_flip" }
    ]
  },
  {
    id: "coward", name: "膽小鬼", max: null, refusal: "none",
    appearsIn: ["the_living_dead", "cursed_land"],
    abilities: [
      { timing: "mm_phase", mandatory: true, desc: "【強制：劇作家能力階段】該角色身上有2枚或以上的[不安]→選擇1塊相鄰版圖，將該角色移動至那塊版圖。", effect: "coward_move" }
    ]
  },
  {
    id: "zombie", name: "喪屍", max: null, refusal: "mandatory",
    appearsIn: ["the_living_dead", "cursed_land"],
    abilities: [
      { timing: "day_end", mandatory: true, desc: "【強制：回合結束階段】選擇1塊喪屍數量大於非喪屍的角色數量，且至少有1名角色存活的版圖→使該版圖中的1名角色死亡（所有喪屍合計，每日限1次）。", effect: "zombie_kill" },
      { timing: "day_end", mandatory: false, desc: "【任意：回合結束階段】將1具身份為喪屍的屍體移動至相鄰版圖（所有喪屍合計，每日限1次）。", effect: "zombie_move_corpse" }
    ]
  }
];

window.ROLE_INDEX = {};
window.ROLES.forEach(function (r) { ROLE_INDEX[r.id] = r; });
