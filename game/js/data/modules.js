// 模組定義：FS（第一步）與 BTX（基礎悲劇）
window.MODULES = {
  FS: {
    id: "FS", name: "FS 模組（第一步）", subplotsCount: 1, finalGuess: false,
    loopRecommend: { loops: 3, days: 4 },
    mainPlots: ["murder_plan", "light_of_the_avenger", "a_place_to_protect"],
    subplots: ["shadow_of_the_ripper", "unsettling_rumor", "a_hideous_script"],
    incidents: ["murder", "increasing_unease", "suicide", "hospital_incident", "faraway_murder", "missing_person", "spreading"],
    characters: ["boy_student", "girl_student", "shrine_maiden", "office_worker", "pop_idol", "doctor"],
    note: "無最終決戰。副規則僅使用1條。建議每輪4-6天、6-7名角色。"
  },
  BTX: {
    id: "BTX", name: "BTX 模組（基礎悲劇）", subplotsCount: 2, finalGuess: true,
    loopRecommend: { loops: 3, days: 6 },
    mainPlots: ["murder_plan", "the_sealed_item", "sign_with_me", "changing_the_future", "giant_time_bomb"],
    subplots: ["circle_of_friends", "a_love_affair", "the_hidden_freak", "unsettling_rumor_b", "paranoia_virus", "threads_of_fate", "unknown_factor_x"],
    incidents: ["murder", "increasing_unease", "foul_evil", "suicide", "hospital_incident", "faraway_murder", "missing_person", "spreading", "butterfly_effect"],
    characters: ["boy_student", "girl_student", "rich_man's_daughter", "shrine_maiden", "police_officer", "office_worker", "informer", "doctor", "patient", "class_rep", "alien", "pop_idol", "journalist", "forensic_specialist", "teacher", "nurce", "soldier"],
    note: "有最終決戰。副規則使用2條。建議每輪6-8天。"
  },
  MC: {
    id: "MC", name: "MC 模組（神秘圈）", subplotsCount: 2, finalGuess: true,
    usesEx: true,
    loopRecommend: { loops: 3, days: 6 },
    mainPlots: ["murder_plan", "quilt_of_incidents", "tightrope_plan", "the_black_school", "drop_of_strychnine"],
    subplots: ["the_hidden_freak", "isolation_institution_psycho", "smell_of_gunpowder", "i_am_a_master_detective", "dance_of_fools", "an_absolute_will", "tricky_twins"],
    incidents: ["murder", "serial_murder", "terrorism", "suicide", "increasing_unease", "hospital_incident", "portent", "bestial_murder", "faked_suicide", "suspicious_letter", "closed_circle", "silver_bullet"],
    characters: ["boy_student", "girl_student", "rich_man's_daughter", "class_rep", "mystery_boy", "shrine_maiden", "alien", "godly_being", "police_officer", "office_worker", "informer", "pop_idol", "journalist", "boss", "doctor", "patient", "nurce", "henchman"],
    note: "有最終決戰。使用Ex槽等特殊規則（部分機制尚未完整實作）。建議每輪6天左右。"
  },
  MZ: {
    id: "MZ", name: "MZ 模組（午夜地帶）", subplotsCount: 2, finalGuess: true,
    usesEx: true,
    loopRecommend: { loops: 3, days: 6 },
    mainPlots: ["the_sealed_item", "secret_record", "male_confrontation", "the_devils_hand", "fated_connections"],
    subplots: ["love_hate_spiral", "witches_tea_time", "dice_of_the_gods", "unsafe_trigger", "showtime_of_death", "unanswered_heart", "worshippers_of_the_apocalypse"],
    incidents: ["murder", "serial_murder", "suicide", "increasing_unease", "missing_person", "hospital_incident", "conspiracies", "uproar", "confession", "breakthrough", "faked_suicide", "fake_incident"],
    characters: ["boy_student", "girl_student", "rich_man's_daughter", "class_rep", "mystery_boy", "shrine_maiden", "alien", "godly_being", "police_officer", "office_worker", "informer", "pop_idol", "journalist", "boss", "doctor", "patient", "nurce", "henchman"],
    note: "有最終決戰。使用Ex牌/Ex槽等特殊規則（部分機制尚未完整實作）。建議每輪6天左右。"
  },
  WM: {
    id: "WM", name: "WM 模組（怪異神話）", subplotsCount: 2, finalGuess: true, refusedAbilityUsed: true,
    usesEx: true,
    loopRecommend: { loops: 3, days: 6 },
    mainPlots: ["choir_to_the_outside_god", "sacred_words_of_dagon", "king_in_yellow", "giant_time_bomb_y", "bloody_rites"],
    subplots: ["unsettling_rumor_w", "the_resistance", "people_who_saw", "the_profound_race", "whispers_from_the_deep", "the_faceless_god", "twisted_truth"],
    incidents: ["insane_murder", "mass_suicide", "increasing_unease", "missing_person", "foul_evil", "hospital_incident", "uproar", "fire_of_demise", "hound_dog_scent", "discovery", "the_executioner"],
    characters: ["boy_student", "girl_student", "rich_man's_daughter", "class_rep", "mystery_boy", "shrine_maiden", "alien", "godly_being", "police_officer", "office_worker", "informer", "pop_idol", "journalist", "boss", "doctor", "patient", "nurce", "henchman"],
    note: "有最終決戰。使用Ex槽等特殊規則（部分機制尚未完整實作）。建議每輪6天左右。"
  },
  AHR: {
    id: "AHR", name: "AHR 模組（另一片地平線）", subplotsCount: 2, finalGuess: true,
    usesEx: true,
    loopRecommend: { loops: 3, days: 6 },
    mainPlots: ["the_forbidden_future", "fairy_tale_murderer", "mother_goose_mystery", "dimensional_merger", "into_nothingness"],
    subplots: ["jekyll_and_hyde", "the_plaguebringer", "puppeteers_strings", "through_the_looking_glass", "crossing_world_lines", "unspeakable_horrors", "hysteria_virus"],
    incidents: ["crime_of_passion", "dimensional_distortion", "dimensional_perversion", "dimensional_fracture", "left_behind", "phantasmal_incident", "hospital_incident", "last_will", "the_singularity", "seeping_daylight", "the_murk_of_despair"],
    characters: ["boy_student", "girl_student", "rich_man's_daughter", "class_rep", "mystery_boy", "shrine_maiden", "alien", "godly_being", "police_officer", "office_worker", "informer", "pop_idol", "journalist", "boss", "doctor", "patient", "nurce", "henchman"],
    note: "有最終決戰。Ex槽代表表/裏世界，世界移動與雙重身份等機制（部分已實作）。建議每輪6天左右。"
  },
  LL: {
    id: "LL", name: "LL 模組（最後的謊言）", subplotsCount: 2, finalGuess: true,
    usesEx: true, refusedAbilityUsed: false,
    loopRecommend: { loops: 4, days: 6 },
    mainPlots: ["the_final_plan", "the_sealed_conclusion", "world_of_rebellion", "the_demons_script", "giant_time_bomb_z"],
    subplots: ["the_real_monster", "keeper_of_mythology", "i_am_the_true_detective", "crossing_world_lines", "unsafe_trigger_ll", "social_media_paranoia", "the_mythomaniacs_secret"],
    incidents: ["murder", "increasing_unease", "missing_person", "hospital_incident", "the_executor", "distortion", "last_will", "confession", "spreading", "the_light_of_hope", "the_murk_of_despair"],
    characters: ["boy_student", "girl_student", "rich_man's_daughter", "class_rep", "mystery_boy", "shrine_maiden", "alien", "godly_being", "police_officer", "office_worker", "informer", "pop_idol", "journalist", "boss", "doctor", "patient", "nurce", "henchman"],
    note: "有最終決戰。必須關閉桌上交談、固定4名玩家；使用遺骸/熟識標記與背叛者規則（部分已實作）。建議4輪6天左右。"
  },
  HSA: {
    id: "HSA", name: "HSA 模組（鬧鬼舞台）", subplotsCount: 2, finalGuess: true,
    usesEx: true,
    loopRecommend: { loops: 3, days: 6 },
    mainPlots: ["the_noble_bloodline", "moonlit_beast", "nightmares_in_the_mist", "the_living_dead", "cursed_land"],
    subplots: ["panicky_party", "love_story", "witchs_curse", "girl_crisis", "monsters_plot", "paranoia_and_delusion", "the_stubborn"],
    incidents: ["blasphemous_murder", "increasing_unease", "missing_person", "foul_evil", "the_executioner", "word_curse", "left_alone", "night_of_madness", "curse_awakening", "filth_overflow", "apocalypse_of_the_dead"],
    characters: ["boy_student", "girl_student", "rich_man's_daughter", "class_rep", "mystery_boy", "shrine_maiden", "alien", "godly_being", "police_officer", "office_worker", "informer", "pop_idol", "journalist", "boss", "doctor", "patient", "nurce", "henchman"],
    note: "有最終決戰。詛咒牌、喪屍與群眾事件等機制（部分已實作）。建議每輪6天左右。"
  }
};
