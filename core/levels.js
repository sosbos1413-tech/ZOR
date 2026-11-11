/*
 * Campaign levels (data only — edit freely). One level per world: 4 fights + a boss.
 * A fight is a short match (CAMPAIGN.rules) against a fixed enemy line-up:
 *   units: [defId, star, slot, fromRound]   (slot: f0..f3 front, b0..b3 back; the unit joins from that round)
 *   power: enemy stat multiplier, tuned by tools/tune-campaign.js so a reference player (starter cards in
 *          levels 1-2, more/upgraded cards in 3-4) wins ~95%→60% of the fights and 40-55% of bosses.
 *          It is NOT comparable between fights (line-ups differ); the player's card levels/rarity apply too.
 *   boss:  the world's hero fights on the board with a special ability and bigger rewards.
 * Rewards are paid in full on the first win only; replays pay `replay`.
 */
(function () {
  const AMB = globalThis.AMB;

  const CAMPAIGN = {
    rules: { maxRounds: 8, winsNeeded: 8 },          // every fight plays all 8 rounds (the winner is whoever wins more rounds, then has more life)
    // boss fights are long: best of 7 rounds. The boss line-up keeps growing (extra units join later, and everything gets `growth` stronger each round)
    bossRules: { maxRounds: 8, winsNeeded: 8, growth: 0.07 },
    rewards: {
      fight: { shards: 20, passXp: 20 },
      boss: { shards: 60, passXp: 40 },
      level: { pack: 'basic' },                       // bonus for clearing every fight of a level
      replay: { shards: 5 },
      // boss fights: EVERY star pays its own prize, once (the first time you reach that star)
      bossStars: [
        { shards: 60, passXp: 40 },
        { shards: 100, passXp: 30, packs: 1 },
        { shards: 150, passXp: 40, card: 'rare' },
      ],
    },
    // star rating per fight (best result is kept): 1 = win, 2 = win without losing a round,
    // 3 = that, and your hero ended at full life. Star totals open chests (each once).
    stars: {
      rules: [
        { n: 1, text: 'فوز' },
        { n: 2, text: 'فوز بدون ما تخسر جولة' },
        { n: 3, text: 'فوز بدون ما تخسر جولة، وبطلك حياته كاملة' },
      ],
      chests: [
        { id: 'ch10', need: 10, name: 'صندوق برونزي', reward: { shards: 100 } },
        { id: 'ch25', need: 25, name: 'صندوق فضي', reward: { packs: 1 } },
        { id: 'ch40', need: 40, name: 'صندوق ذهبي', reward: { packs: 2 } },
        { id: 'ch60', need: 60, name: 'صندوق الصدع', reward: { card: 'epic' } },   // one guaranteed card of this rarity or rarer
        { id: 'ch80', need: 80, name: 'صندوق الأتون الملكي', reward: { shards: 200, packs: 1 } },
        { id: 'ch100', need: 100, name: 'صندوق الزعماء', reward: { packs: 2, card: 'epic' } },
        { id: 'ch120', need: 120, name: 'صندوق الأسطورة', reward: { shards: 400, card: 'legendary' } },
      ],
    },
  };

  // three difficulties, each with its own progress, stars, chests and boss prizes. power = enemy strength, shards/xp/packs = reward multipliers,
  // cardTier = shift of guaranteed-card rarity (-1 one tier lower, +1 one tier higher), levelPacks = free packs for finishing a level, levelShards = bonus shards for it
  const DIFFICULTY = {
    easy:   { id: 'easy',   name: 'سهل',   color: '#5ee08a', power: 0.78, growth: 0.05, shards: 0.5, xp: 0.5, packs: 0, cardTier: -1, levelPacks: 0, levelShards: 80 },
    normal: { id: 'normal', name: 'متوسط', color: '#ffd24a', power: 1,    growth: 0.07, shards: 1,   xp: 1,   packs: 1, cardTier: 0,  levelPacks: 1, levelShards: 0 },
    hard:   { id: 'hard',   name: 'صعب',   color: '#ff5a5a', power: 1.3,  growth: 0.09, shards: 2,   xp: 1.5, packs: 2, cardTier: 1,  levelPacks: 2, levelShards: 0 },
  };

  // boss specials: stat blessings + hero abilities fired at the start of every round
  const BOSS = {
    ember: { name: 'غضب الجمر', text: 'وحدات الزعيم +20% هجوم، ويستخدم «أمر الهجوم» في بداية كل جولة.', blessings: { atkPct: 0.2 }, abilities: ['inferno_banner'] },
    tide: { name: 'مدّ الحماية', text: 'وحدات الزعيم +25% صحة، ويستخدم «حاجز المدّ» في بداية كل جولة.', blessings: { hpPct: 0.25 }, abilities: ['tidal_ward'] },
    neon: { name: 'كسر السرعة', text: 'وحدات الزعيم +20% سرعة هجوم، ويستخدم «كسر السرعة» في بداية كل جولة.', blessings: { asPct: 0.2 }, abilities: ['overclock'] },
    rika: { name: 'غضب الأتون', text: 'وحدات الزعيمة +25% هجوم و+10% صحة، وتستخدم «مطرقة الحمم» و«حماية السندان» كل جولة.', blessings: { atkPct: 0.25, hpPct: 0.1 }, abilities: ['molten_hammer', 'anvil_ward'] },
    kairyu: { name: 'عاصفة القبطان', text: 'وحدات الزعيم +25% صحة و+10% سرعة هجوم، ويستخدم «أمر القبطان» و«موجة غادرة» كل جولة.', blessings: { hpPct: 0.25, asPct: 0.1 }, abilities: ['captains_order', 'rogue_wave'] },
    nayako: { name: 'عرض الشبكة', text: 'وحدات الزعيمة +25% سرعة هجوم و+10% هجوم، وتستخدم «جدار الهولوغرام» و«نبضة تشويش» كل جولة.', blessings: { asPct: 0.25, atkPct: 0.1 }, abilities: ['hologram_wall', 'glitch_pulse'] },
    thora: { name: 'زئير الدب', text: 'وحدات الزعيمة +30% صحة و+10% هجوم، وتستخدم «ازدهار الربيع» و«ضربة الفأس» كل جولة.', blessings: { hpPct: 0.3, atkPct: 0.1 }, abilities: ['spring_bloom', 'axe_cleave'] },
    sylvan: { name: 'جذور أزلية', text: 'وحدات الزعيم +20% صحة، ويستخدم «جدار الأشواك» في بداية كل جولة.', blessings: { hpPct: 0.2 }, abilities: ['thorn_wall'] },
  };

  const L = (id, world, hero, name, start, fights) => ({ id, world, hero, name, start, fights });
  const F = (id, name, power, units, extra) => Object.assign({ id, name, power, units }, extra || {});

  const LEVELS = [
    L('l1', 'ember', 'kagira', 'أطراف مملكة الجمر', { gold: 6, level: 2 }, [
      F('l1f1', 'دورية الرماد', 2.7, [['ash_ronin', 1, 'f1', 1], ['forge_bulwark', 1, 'f2', 1], ['pixel_sniper', 1, 'b1', 2]]),
      F('l1f2', 'حرّاس الأتون', 2.12, [['forge_bulwark', 1, 'f1', 1], ['ash_ronin', 1, 'f2', 1], ['thorn_fox', 1, 'f3', 2], ['pixel_sniper', 1, 'b1', 1]]),
      F('l1f3', 'كمين الشرر', 1.83, [['ash_ronin', 1, 'f1', 1], ['forge_bulwark', 1, 'f2', 1], ['spark_wraith', 1, 'b2', 1], ['pyre_archer', 1, 'b1', 2]]),
      F('l1f4', 'رماة المحرقة', 1.63, [['forge_bulwark', 1, 'f1', 1], ['ash_ronin', 1, 'f2', 1], ['coral_sentinel', 1, 'f3', 2], ['pyre_archer', 1, 'b1', 1], ['spark_wraith', 1, 'b2', 3]]),
      F('l1boss', 'الزعيم: سراج', 1.05, [['forge_bulwark', 1, 'f1', 1], ['ash_ronin', 2, 'f2', 1], ['pyre_archer', 1, 'b0', 1], ['caldera_seer', 1, 'b2', 2], ['spark_wraith', 1, 'b3', 4], ['forge_bulwark', 2, 'f3', 6]], { boss: true }),
    ]),
    L('l2', 'tide', 'merin', 'سواحل المدّ القمري', { gold: 8, level: 3 }, [
      F('l2f1', 'حرس المرجان', 2.31, [['coral_sentinel', 1, 'f1', 1], ['lunar_blade', 1, 'f2', 1], ['wave_caller', 1, 'b1', 1], ['pixel_sniper', 1, 'b2', 2]]),
      F('l2f2', 'سيوف القمر', 2.21, [['coral_sentinel', 1, 'f1', 1], ['lunar_blade', 1, 'f2', 1], ['lunar_blade', 1, 'f3', 2], ['wave_caller', 1, 'b1', 1], ['mist_witch', 1, 'b2', 3]]),
      F('l2f3', 'ضباب الساحرات', 1.34, [['coral_sentinel', 2, 'f1', 1], ['moss_warden', 1, 'f2', 1], ['mist_witch', 1, 'b1', 1], ['wave_caller', 1, 'b2', 1], ['kazehaya', 1, 'b3', 2]]),
      F('l2f4', 'موجة المدّ', 1.15, [['coral_sentinel', 2, 'f1', 1], ['lunar_blade', 2, 'f2', 1], ['thorn_fox', 1, 'f3', 1], ['mist_witch', 1, 'b1', 1], ['wave_caller', 1, 'b2', 2], ['pixel_sniper', 1, 'b3', 3]]),
      F('l2boss', 'الزعيم: غيث', 1.2, [['coral_sentinel', 2, 'f1', 1], ['lunar_blade', 1, 'f2', 1], ['wave_caller', 1, 'b0', 1], ['mist_witch', 1, 'b2', 1], ['tide_priest', 1, 'b3', 2], ['coral_sentinel', 2, 'f0', 4], ['lunar_blade', 2, 'f3', 6]], { boss: true }),
    ]),
    L('l3', 'neon', 'zerokai', 'شوارع نيون-٩', { gold: 10, level: 3 }, [
      F('l3f1', 'كلاب الشبكة', 1.87, [['firewall_unit', 1, 'f1', 1], ['grid_hound', 2, 'f2', 1], ['grid_hound', 1, 'f3', 1], ['pixel_sniper', 1, 'b1', 1], ['spectral_coder', 1, 'b2', 2]]),
      F('l3f2', 'قنّاصو البكسل', 1.97, [['firewall_unit', 1, 'f1', 1], ['chrome_ronin', 1, 'f2', 2], ['pixel_sniper', 2, 'b1', 1], ['pixel_sniper', 1, 'b2', 1], ['spectral_coder', 1, 'b3', 1]]),
      F('l3f3', 'جدار النار', 1.1, [['firewall_unit', 2, 'f1', 1], ['forge_bulwark', 1, 'f2', 1], ['grid_hound', 2, 'f3', 1], ['pixel_sniper', 1, 'b1', 1], ['spectral_coder', 1, 'b2', 2], ['spark_wraith', 1, 'b3', 3]]),
      F('l3f4', 'المبرمجة الطيفية', 1.34, [['firewall_unit', 2, 'f1', 1], ['chrome_ronin', 1, 'f2', 1], ['grid_hound', 2, 'f3', 1], ['pixel_sniper', 2, 'b1', 1], ['spectral_coder', 1, 'b2', 1], ['mist_witch', 1, 'b3', 2]]),
      F('l3boss', 'الزعيم: يزن', 0.95, [['firewall_unit', 2, 'f1', 1], ['chrome_ronin', 1, 'f2', 1], ['grid_hound', 2, 'f3', 1], ['pixel_sniper', 2, 'b0', 1], ['spectral_coder', 1, 'b2', 2], ['pixel_sniper', 2, 'b3', 4], ['firewall_unit', 2, 'f0', 6]], { boss: true }),
    ]),
    L('l4', 'sylvan', 'orath', 'قلب الغابة الأزلية', { gold: 12, level: 4 }, [
      F('l4f1', 'ثعالب الأشواك', 1.97, [['moss_warden', 2, 'f1', 1], ['thorn_fox', 2, 'f2', 1], ['thorn_fox', 1, 'f3', 1], ['kazehaya', 1, 'b1', 1], ['wave_caller', 1, 'b2', 1], ['root_shaman', 1, 'b3', 3]]),
      F('l4f2', 'عيون الصفصاف', 1.2, [['moss_warden', 2, 'f1', 1], ['thorn_fox', 2, 'f2', 1], ['coral_sentinel', 2, 'f3', 1], ['kazehaya', 2, 'b1', 1], ['kazehaya', 1, 'b2', 1], ['spectral_coder', 1, 'b3', 2]]),
      F('l4f3', 'المتربّص', 1.44, [['moss_warden', 2, 'f1', 1], ['thorn_fox', 2, 'f2', 1], ['wild_stalker', 1, 'f3', 1], ['kazehaya', 2, 'b1', 1], ['root_shaman', 1, 'b2', 1], ['wave_caller', 2, 'b3', 2]]),
      F('l4f4', 'شامان الجذور', 1.1, [['moss_warden', 2, 'f0', 1], ['thorn_fox', 2, 'f1', 1], ['firewall_unit', 2, 'f2', 1], ['wild_stalker', 1, 'f3', 1], ['kazehaya', 2, 'b1', 1], ['root_shaman', 1, 'b2', 1], ['tide_priest', 1, 'b3', 3]]),
      F('l4boss', 'الزعيم: راشد', 1, [['moss_warden', 2, 'f0', 1], ['thorn_fox', 2, 'f1', 1], ['wild_stalker', 1, 'f3', 1], ['kazehaya', 2, 'b0', 1], ['root_shaman', 2, 'b2', 1], ['tide_priest', 1, 'b3', 2], ['wild_stalker', 2, 'f2', 5]], { boss: true }),
    ]),
    L('l5', 'ember', 'rika', 'أتون الملكة', { gold: 12, level: 4 }, [
      F('l5f1', 'عمّال المطارق', 1.73, [['goka', 1, 'f1', 1], ['forge_bulwark', 2, 'f2', 1], ['ash_ronin', 2, 'f0', 1], ['pyre_archer', 1, 'b2', 1], ['natsuki', 1, 'b0', 2]]),
      F('l5f2', 'حرس السندان', 1.29, [['kurenai', 1, 'f1', 1], ['godo', 2, 'f2', 1], ['spark_wraith', 1, 'b3', 2], ['pyre_archer', 2, 'b1', 1], ['momo', 1, 'b2', 1]]),
      F('l5f3', 'قنّاصة الجمر', 1.34, [['forge_bulwark', 2, 'f1', 1], ['goka', 1, 'f2', 1], ['yuta', 2, 'b0', 1], ['pyre_archer', 2, 'b1', 1], ['caldera_seer', 1, 'b2', 2], ['tsubaki', 2, 'b3', 1]]),
      F('l5f4', 'مصهر الأتون', 0.81, [['kurenai', 2, 'f1', 1], ['goka', 2, 'f2', 1], ['godo', 2, 'f3', 1], ['natsuki', 2, 'b1', 1], ['caldera_seer', 1, 'b2', 1], ['spark_wraith', 2, 'b3', 2]]),
      F('l5boss', 'الزعيمة: جمانة', 0.71, [['kurenai', 2, 'f1', 1], ['goka', 2, 'f2', 1], ['godo', 2, 'f0', 1], ['caldera_seer', 2, 'b0', 1], ['momo', 2, 'b2', 2], ['spark_wraith', 2, 'b3', 4], ['natsuki', 2, 'f3', 6]], { boss: true }),
    ]),
    L('l6', 'tide', 'kairyu', 'عاصفة القبطان', { gold: 12, level: 4 }, [
      F('l6f1', 'بحّارة العاصفة', 1.44, [['coral_sentinel', 2, 'f1', 1], ['ryujin', 1, 'f2', 1], ['tomoe', 2, 'f0', 1], ['kota', 2, 'b1', 1], ['wave_caller', 2, 'b2', 1]]),
      F('l6f2', 'سيوف الموج', 1.24, [['seiji', 2, 'f1', 1], ['lunar_blade', 2, 'f2', 1], ['daikai', 1, 'f3', 1], ['haruka', 2, 'b0', 1], ['miyuki', 1, 'b2', 1], ['mizuki', 2, 'b3', 2]]),
      F('l6f3', 'ضباب الأرخبيل', 0.95, [['daikai', 2, 'f1', 1], ['ryujin', 1, 'f2', 1], ['coral_sentinel', 2, 'f3', 1], ['mist_witch', 2, 'b1', 1], ['haruka', 2, 'b2', 1], ['tide_priest', 1, 'b3', 2]]),
      F('l6f4', 'سفينة القمر', 0.95, [['daikai', 2, 'f1', 1], ['ryujin', 2, 'f2', 1], ['seiji', 2, 'f0', 1], ['mist_witch', 2, 'b1', 1], ['otohime', 1, 'b2', 1], ['kota', 2, 'b3', 2]]),
      F('l6boss', 'الزعيم: سالم', 0.71, [['daikai', 2, 'f1', 1], ['ryujin', 2, 'f2', 1], ['seiji', 2, 'f0', 1], ['haruka', 2, 'b0', 1], ['otohime', 1, 'b2', 2], ['mizuki', 2, 'b3', 4], ['lunar_blade', 2, 'f3', 6]], { boss: true }),
    ]),
    L('l7', 'neon', 'nayako', 'مسرح الشبكة', { gold: 14, level: 4 }, [
      F('l7f1', 'جمهور الهولوغرام', 1.58, [['firewall_unit', 2, 'f1', 1], ['juzo', 2, 'f2', 1], ['firewall_unit', 2, 'f0', 1], ['pixel_sniper', 2, 'b1', 1], ['mitsuki', 2, 'b2', 1]]),
      F('l7f2', 'كلاب الخوادم', 1.39, [['kogetsu', 1, 'f1', 1], ['firewall_unit', 2, 'f2', 1], ['grid_hound', 2, 'f3', 1], ['reiji', 2, 'b0', 1], ['spectral_coder', 2, 'b2', 1], ['grid_hound', 2, 'b3', 2]]),
      F('l7f3', 'عازفو البكسل', 1.49, [['chrome_ronin', 1, 'f1', 1], ['firewall_unit', 2, 'f2', 1], ['firewall_unit', 2, 'f3', 1], ['mugen', 1, 'b1', 1], ['pixel_sniper', 2, 'b2', 1], ['yozora', 1, 'b3', 2]]),
      F('l7f4', 'قلب الشبكة', 1.05, [['kogetsu', 2, 'f1', 1], ['chrome_ronin', 2, 'f2', 1], ['firewall_unit', 2, 'f0', 1], ['mugen', 2, 'b1', 1], ['spectral_coder', 2, 'b2', 1], ['reiji', 2, 'b3', 2]]),
      F('l7boss', 'الزعيمة: نجلاء', 0.76, [['kogetsu', 2, 'f1', 1], ['chrome_ronin', 2, 'f2', 1], ['firewall_unit', 2, 'f0', 1], ['mugen', 2, 'b0', 1], ['yozora', 2, 'b2', 2], ['grid_hound', 2, 'b3', 4], ['juzo', 2, 'f3', 6]], { boss: true }),
    ]),
    L('l8', 'sylvan', 'thora', 'عرين الدب الأزلي', { gold: 14, level: 5 }, [
      F('l8f1', 'صيّادو اللحاء', 1.54, [['taiju', 1, 'f1', 1], ['kashiwagi', 1, 'f2', 1], ['genzo', 2, 'f0', 1], ['kazehaya', 2, 'b1', 1], ['yoshino', 2, 'b2', 1]]),
      F('l8f2', 'حرّاس الغصن', 1.24, [['genzo', 2, 'f1', 1], ['kaito', 2, 'f2', 1], ['daigo', 2, 'f3', 1], ['gensai', 2, 'b0', 1], ['takashi', 2, 'b2', 1], ['hayate', 2, 'b3', 2]]),
      F('l8f3', 'همس الغابة', 1.24, [['taiju', 2, 'f1', 1], ['kashiwagi', 1, 'f2', 1], ['genzo', 2, 'f3', 1], ['shirayuki', 1, 'b1', 1], ['ibara', 2, 'b2', 1], ['hisui', 1, 'b3', 2]]),
      F('l8f4', 'قبضة الجذور', 0.81, [['taiju', 2, 'f1', 1], ['kashiwagi', 2, 'f2', 1], ['genzo', 2, 'f0', 1], ['shirayuki', 2, 'b1', 1], ['root_shaman', 2, 'b2', 1], ['wild_stalker', 2, 'b3', 2]]),
      F('l8boss', 'الزعيمة: ثريّا', 0.76, [['taiju', 2, 'f1', 1], ['kashiwagi', 2, 'f2', 1], ['genzo', 2, 'f0', 1], ['shirayuki', 2, 'b0', 1], ['hisui', 2, 'b2', 2], ['wild_stalker', 2, 'b3', 4], ['kaito', 2, 'f3', 6]], { boss: true }),
    ]),
  ];

  AMB.LEVELS = { CAMPAIGN, BOSS, LEVELS, DIFFICULTY };
})();
