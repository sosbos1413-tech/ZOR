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
    rules: { maxRounds: 3, winsNeeded: 2 },          // best of 3 rounds
    rewards: {
      fight: { shards: 20, passXp: 20 },
      boss: { shards: 60, passXp: 40 },
      level: { pack: 'basic' },                       // bonus for clearing every fight of a level
      replay: { shards: 5 },
    },
    // star rating per fight (best result is kept): 1 = win, 2 = win without losing a round,
    // 3 = that, and your hero ended at full life. Star totals open chests (each once).
    stars: {
      rules: [
        { n: 1, text: 'فوز' },
        { n: 2, text: 'فوز بدون خسارة أي جولة' },
        { n: 3, text: 'فوز بدون خسارة جولة وبطلك بكامل حياته' },
      ],
      chests: [
        { id: 'ch10', need: 10, name: 'صندوق برونزي', reward: { shards: 100 } },
        { id: 'ch25', need: 25, name: 'صندوق فضي', reward: { packs: 1 } },
        { id: 'ch40', need: 40, name: 'صندوق ذهبي', reward: { packs: 2 } },
        { id: 'ch60', need: 60, name: 'صندوق الصدع', reward: { card: 'epic' } },   // one guaranteed card of this rarity or rarer
      ],
    },
  };

  // boss specials: stat blessings + hero abilities fired at the start of every round
  const BOSS = {
    ember: { name: 'غضب الجمر', text: 'وحدات الزعيم +20% هجوم، ويطلق «أمر الهجوم» مع بداية كل جولة.', blessings: { atkPct: 0.2 }, abilities: ['inferno_banner'] },
    tide: { name: 'مدّ الحماية', text: 'وحدات الزعيم +25% صحة، ويطلق «حاجز المدّ» مع بداية كل جولة.', blessings: { hpPct: 0.25 }, abilities: ['tidal_ward'] },
    neon: { name: 'كسر السرعة', text: 'وحدات الزعيم +20% سرعة هجوم، ويطلق «كسر السرعة» مع بداية كل جولة.', blessings: { asPct: 0.2 }, abilities: ['overclock'] },
    sylvan: { name: 'جذور أزلية', text: 'وحدات الزعيم +20% صحة، ويطلق «جدار الأشواك» مع بداية كل جولة.', blessings: { hpPct: 0.2 }, abilities: ['thorn_wall'] },
  };

  const L = (id, world, hero, name, start, fights) => ({ id, world, hero, name, start, fights });
  const F = (id, name, power, units, extra) => Object.assign({ id, name, power, units }, extra || {});

  const LEVELS = [
    L('l1', 'ember', 'kagira', 'أطراف مملكة الجمر', { gold: 6, level: 4 }, [
      F('l1f1', 'دورية الرماد', 1.8, [['ash_ronin', 1, 'f1', 1], ['forge_bulwark', 1, 'f2', 1], ['pixel_sniper', 1, 'b1', 2]]),
      F('l1f2', 'حرّاس الأتون', 1.42, [['forge_bulwark', 1, 'f1', 1], ['ash_ronin', 1, 'f2', 1], ['thorn_fox', 1, 'f3', 2], ['pixel_sniper', 1, 'b1', 1]]),
      F('l1f3', 'كمين الشرر', 1.17, [['ash_ronin', 1, 'f1', 1], ['forge_bulwark', 1, 'f2', 1], ['spark_wraith', 1, 'b2', 1], ['pyre_archer', 1, 'b1', 2]]),
      F('l1f4', 'رماة المحرقة', 1.32, [['forge_bulwark', 1, 'f1', 1], ['ash_ronin', 1, 'f2', 1], ['coral_sentinel', 1, 'f3', 2], ['pyre_archer', 1, 'b1', 1], ['spark_wraith', 1, 'b2', 3]]),
      F('l1boss', 'الزعيم: كيرو', 0.92, [['forge_bulwark', 1, 'f1', 1], ['ash_ronin', 2, 'f2', 1], ['pyre_archer', 1, 'b0', 1], ['caldera_seer', 1, 'b2', 2]], { boss: true }),
    ]),
    L('l2', 'tide', 'merin', 'سواحل المدّ القمري', { gold: 8, level: 5 }, [
      F('l2f1', 'حرس المرجان', 1.66, [['coral_sentinel', 1, 'f1', 1], ['lunar_blade', 1, 'f2', 1], ['wave_caller', 1, 'b1', 1], ['pixel_sniper', 1, 'b2', 2]]),
      F('l2f2', 'سيوف القمر', 1.35, [['coral_sentinel', 1, 'f1', 1], ['lunar_blade', 1, 'f2', 1], ['lunar_blade', 1, 'f3', 2], ['wave_caller', 1, 'b1', 1], ['mist_witch', 1, 'b2', 3]]),
      F('l2f3', 'ضباب الساحرات', 1.08, [['coral_sentinel', 2, 'f1', 1], ['moss_warden', 1, 'f2', 1], ['mist_witch', 1, 'b1', 1], ['wave_caller', 1, 'b2', 1], ['willow_eye', 1, 'b3', 2]]),
      F('l2f4', 'موجة المدّ', 0.78, [['coral_sentinel', 2, 'f1', 1], ['lunar_blade', 2, 'f2', 1], ['thorn_fox', 1, 'f3', 1], ['mist_witch', 1, 'b1', 1], ['wave_caller', 1, 'b2', 2], ['pixel_sniper', 1, 'b3', 3]]),
      F('l2boss', 'الزعيم: ميران', 0.78, [['coral_sentinel', 2, 'f1', 1], ['lunar_blade', 1, 'f2', 1], ['wave_caller', 1, 'b0', 1], ['mist_witch', 1, 'b2', 1], ['tide_priest', 1, 'b3', 2]], { boss: true }),
    ]),
    L('l3', 'neon', 'zerokai', 'شوارع نيون-٩', { gold: 10, level: 5 }, [
      F('l3f1', 'كلاب الشبكة', 0.99, [['firewall_unit', 1, 'f1', 1], ['grid_hound', 2, 'f2', 1], ['grid_hound', 1, 'f3', 1], ['pixel_sniper', 1, 'b1', 1], ['spectral_coder', 1, 'b2', 2]]),
      F('l3f2', 'قناصة البكسل', 1.14, [['firewall_unit', 1, 'f1', 1], ['chrome_ronin', 1, 'f2', 2], ['pixel_sniper', 2, 'b1', 1], ['pixel_sniper', 1, 'b2', 1], ['spectral_coder', 1, 'b3', 1]]),
      F('l3f3', 'جدار النار', 0.76, [['firewall_unit', 2, 'f1', 1], ['forge_bulwark', 1, 'f2', 1], ['grid_hound', 2, 'f3', 1], ['pixel_sniper', 1, 'b1', 1], ['spectral_coder', 1, 'b2', 2], ['spark_wraith', 1, 'b3', 3]]),
      F('l3f4', 'المبرمجة الطيفية', 0.74, [['firewall_unit', 2, 'f1', 1], ['chrome_ronin', 1, 'f2', 1], ['grid_hound', 2, 'f3', 1], ['pixel_sniper', 2, 'b1', 1], ['spectral_coder', 1, 'b2', 1], ['mist_witch', 1, 'b3', 2]]),
      F('l3boss', 'الزعيم: زيرو-كاي', 0.61, [['firewall_unit', 2, 'f1', 1], ['chrome_ronin', 1, 'f2', 1], ['grid_hound', 2, 'f3', 1], ['pixel_sniper', 2, 'b0', 1], ['spectral_coder', 1, 'b2', 2]], { boss: true }),
    ]),
    L('l4', 'sylvan', 'orath', 'قلب الغابة الأزلية', { gold: 12, level: 6 }, [
      F('l4f1', 'ثعالب الأشواك', 1.23, [['moss_warden', 2, 'f1', 1], ['thorn_fox', 2, 'f2', 1], ['thorn_fox', 1, 'f3', 1], ['willow_eye', 1, 'b1', 1], ['wave_caller', 1, 'b2', 1], ['root_shaman', 1, 'b3', 3]]),
      F('l4f2', 'عيون الصفصاف', 0.85, [['moss_warden', 2, 'f1', 1], ['thorn_fox', 2, 'f2', 1], ['coral_sentinel', 2, 'f3', 1], ['willow_eye', 2, 'b1', 1], ['willow_eye', 1, 'b2', 1], ['spectral_coder', 1, 'b3', 2]]),
      F('l4f3', 'المتربّص', 0.85, [['moss_warden', 2, 'f1', 1], ['thorn_fox', 2, 'f2', 1], ['wild_stalker', 1, 'f3', 1], ['willow_eye', 2, 'b1', 1], ['root_shaman', 1, 'b2', 1], ['wave_caller', 2, 'b3', 2]]),
      F('l4f4', 'شامان الجذور', 0.69, [['moss_warden', 2, 'f0', 1], ['thorn_fox', 2, 'f1', 1], ['firewall_unit', 2, 'f2', 1], ['wild_stalker', 1, 'f3', 1], ['willow_eye', 2, 'b1', 1], ['root_shaman', 1, 'b2', 1], ['tide_priest', 1, 'b3', 3]]),
      F('l4boss', 'الزعيم: أوراث', 0.72, [['moss_warden', 2, 'f0', 1], ['thorn_fox', 2, 'f1', 1], ['wild_stalker', 1, 'f3', 1], ['willow_eye', 2, 'b0', 1], ['root_shaman', 2, 'b2', 1], ['tide_priest', 1, 'b3', 2]], { boss: true }),
    ]),
  ];

  AMB.LEVELS = { CAMPAIGN, BOSS, LEVELS };
})();
