/*
 * Game content: worlds, roles, units, heroes, equipment, spells, synergies.
 * Everything here is ORIGINAL placeholder content for the prototype and is
 * meant to be edited. Numbers are interpreted by core/combat.js.
 *
 * Effect objects (used by synergies, equipment, passives):
 *   { scope: 'members'|'all'|'front'|'back'|'self', stat, value }
 *   stats: atkPct hpPct asPct dr lifesteal crit critDmg skillPower
 *          startMana range startShieldPct regenPct
 */
(function () {
  const AMB = (globalThis.AMB = globalThis.AMB || {});

  const WORLDS = {
    ember: { id: 'ember', name: 'مملكة الجمر', en: 'Emberreach', color: '#ff7a45', glyph: '火',
      lore: 'إمبراطورية حدادين وساموراي تُشعل سيوفها من قلب بركان حيّ.' },
    tide: { id: 'tide', name: 'المدّ القمري', en: 'Moontide', color: '#3ec9ff', glyph: '水',
      lore: 'أرخبيل يحكمه القمر؛ أرواح الموج تحمي وتُشفي.' },
    neon: { id: 'neon', name: 'نيون-٩', en: 'Neon-9', color: '#c45cff', glyph: '電',
      lore: 'مدينة سيبرانية لا تنام؛ السرعة فيها عملة.' },
    sylvan: { id: 'sylvan', name: 'الغابة الأزلية', en: 'Elder Grove', color: '#52d67c', glyph: '森',
      lore: 'غابة أقدم من الزمن، جذورها جدران وأشجارها حرّاس.' },
  };

  const ROLES = {
    guardian: { side: 'front', kind: 'def', place: 'أمامي', id: 'guardian', name: 'حارس', en: 'Guardian', icon: 'shield', desc: 'وحدة دفاعية تحمي الخط الأمامي وتشتت العدو.' },
    fighter: { side: 'front', kind: 'off', place: 'أمامي', id: 'fighter', name: 'مقاتل', en: 'Fighter', icon: 'sword', desc: 'التحام متوازن بين التحمل والضرر.' },
    assassin: { side: 'any', kind: 'off', place: 'أمامي أو خلفي (يقفز للخلف)', id: 'assassin', name: 'قاتل', en: 'Assassin', icon: 'dagger', desc: 'يقفز فوق خط الدفاع إلى الصف الخلفي للخصم.' },
    mage: { side: 'back', kind: 'off', place: 'خلفي', id: 'mage', name: 'ساحر', en: 'Mage', icon: 'orb', desc: 'مهارات منطقة قوية، صحة منخفضة.' },
    marksman: { side: 'back', kind: 'off', place: 'خلفي', id: 'marksman', name: 'قناص', en: 'Marksman', icon: 'bow', desc: 'ضرر مستمر من مدى بعيد.' },
    support: { side: 'back', kind: 'def', place: 'خلفي', id: 'support', name: 'دعم', en: 'Support', icon: 'wings', desc: 'علاج ودروع وتعزيز للحلفاء.' },
  };

  // 1-star, tier-1 baseline per role. Tier multiplies hp & atk.
  const ROLE_BASE = {
    guardian: { hp: 620, atk: 44, as: 0.6, range: 1, def: 0.25, crit: 0.05 },
    fighter: { hp: 540, atk: 60, as: 0.75, range: 1, def: 0.12, crit: 0.05 },
    assassin: { hp: 420, atk: 68, as: 0.85, range: 1, def: 0.05, crit: 0.25 },
    mage: { hp: 420, atk: 38, as: 0.6, range: 3, def: 0, crit: 0.05 },
    marksman: { hp: 370, atk: 60, as: 0.75, range: 4, def: 0, crit: 0.1 },
    support: { hp: 450, atk: 32, as: 0.6, range: 3, def: 0.05, crit: 0.05 },
  };
  const TIER_MULT = { 1: 1, 2: 1.22, 3: 1.5 };

  /*
   * Skill types understood by the combat engine:
   *  nuke        dmg to current target
   *  cleave/aoe  dmg to target + enemies within radius
   *  stunAoe     aoe dmg + stun
   *  stunStrike  dmg + stun on target
   *  burn        damage over time on target (dps for dur)
   *  drain       dmg + heal self for the same amount
   *  execute     dmg, doubled vs targets under 40% hp
   *  snipe       dmg to the lowest-hp targetable enemy (ignores range)
   *  multishot   dmg to up to `count` nearest enemies
   *  taunt       nearby enemies must attack this unit for dur + shield self
   *  shieldSelf  shield self
   *  healSelf    heal self
   *  healLowest  heal the most wounded ally
   *  healAll     heal all allies
   *  hasteAllies all allies +attack speed for dur
   * Arrays are per star [1★, 2★, 3★].
   */
  const U = [];
  // collectible rarity (see AMB.ECONOMY.rarities). Units follow their tier, heroes are legendary.
  const TIER_RARITY = { 1: 'common', 2: 'rare', 3: 'epic' };
  function unit(id, name, en, world, role, tier, mana, skill, over) {
    const base = ROLE_BASE[role];
    const m = TIER_MULT[tier];
    U.push(Object.assign({
      id, name, en, world, role, tier, cost: tier, rarity: TIER_RARITY[tier],
      hp: Math.round(base.hp * m), atk: Math.round(base.atk * m),
      as: base.as, range: base.range, def: base.def, crit: base.crit,
      mana, skill,
    }, over || {}));
  }

  // ---- Emberreach (no support)
  unit('ash_ronin', 'رونين الرماد', 'Ash Ronin', 'ember', 'fighter', 1, 70,
    { type: 'cleave', name: 'قطع الرماد', dmg: [120, 200, 340], radius: 1.2,
      text: 'ضربة دائرية تصيب الهدف ومن حوله.' });
  unit('forge_bulwark', 'حامي الأتون', 'Forge Bulwark', 'ember', 'guardian', 1, 90,
    { type: 'taunt', name: 'تحدّي الحدّاد', shield: [200, 350, 600], radius: 2.2, dur: 3,
      text: 'يجبر الأعداء القريبين على مهاجمته ويكتسب درعًا.' });
  unit('spark_wraith', 'شبح الشرر', 'Spark Wraith', 'ember', 'assassin', 2, 60,
    { type: 'nuke', name: 'طعنة الشرر', dmg: [230, 390, 660],
      text: 'طعنة خاطفة بضرر هائل للهدف.' });
  unit('pyre_archer', 'رامية المحرقة', 'Pyre Archer', 'ember', 'marksman', 2, 80,
    { type: 'burn', name: 'سهم المحرقة', dps: [60, 100, 170], dur: 4,
      text: 'يحرق الهدف ضررًا متواصلًا لمدة 4 ثوانٍ.' });
  unit('caldera_seer', 'عرّاف البركان', 'Caldera Seer', 'ember', 'mage', 3, 90,
    { type: 'aoe', name: 'انفجار الفوهة', dmg: [340, 560, 960], radius: 1.6,
      text: 'انفجار بركاني يصيب منطقة واسعة حول الهدف.' });

  // ---- Moontide (no assassin / marksman)
  unit('wave_caller', 'مستدعية الموج', 'Wave Caller', 'tide', 'support', 1, 60,
    { type: 'healLowest', name: 'موجة شافية', heal: [230, 380, 640],
      text: 'تعالج الحليف الأكثر جرحًا.' });
  unit('coral_sentinel', 'حارس المرجان', 'Coral Sentinel', 'tide', 'guardian', 1, 80,
    { type: 'shieldSelf', name: 'قشرة المرجان', shield: [380, 620, 1000],
      text: 'يكتسب درعًا مرجانيًا سميكًا.' });
  unit('lunar_blade', 'سيّاف القمر', 'Lunar Blade', 'tide', 'fighter', 2, 70,
    { type: 'drain', name: 'خسوف', dmg: [220, 360, 620],
      text: 'ضربة تمتص الحياة وتعالجه بقيمة الضرر.' });
  unit('mist_witch', 'ساحرة الضباب', 'Mist Witch', 'tide', 'mage', 2, 80,
    { type: 'stunAoe', name: 'ضباب متجمّد', dmg: [120, 200, 350], stun: [1.5, 1.8, 2.2], radius: 1.2,
      text: 'تجمّد الهدف ومن حوله وتصيبهم بضرر.' });
  unit('tide_priest', 'كاهن المدّ العالي', 'High Tide Priest', 'tide', 'support', 3, 80,
    { type: 'healAll', name: 'مدّ عظيم', heal: [180, 300, 520],
      text: 'يعالج جميع الحلفاء.' });

  // ---- Neon-9 (no mage)
  unit('grid_hound', 'كلب الشبكة', 'Grid Hound', 'neon', 'assassin', 1, 60,
    { type: 'nuke', name: 'عضّة البيانات', dmg: [150, 260, 450],
      text: 'عضة إلكترونية بضرر عالٍ.' });
  unit('pixel_sniper', 'قناصة البكسل', 'Pixel Sniper', 'neon', 'marksman', 1, 80,
    { type: 'snipe', name: 'تصويب دقيق', dmg: [200, 340, 580],
      text: 'تقنص العدو الأقل صحة أينما كان (ضمن الأهداف المسموحة).' });
  unit('firewall_unit', 'وحدة الجدار الناري', 'Firewall Unit', 'neon', 'guardian', 2, 90,
    { type: 'taunt', name: 'جدار ناري', shield: [260, 430, 720], radius: 2.6, dur: 3,
      text: 'تجذب انتباه الأعداء في نطاق واسع وتكتسب درعًا.' });
  unit('spectral_coder', 'المبرمجة الطيفية', 'Spectral Coder', 'neon', 'support', 2, 90,
    { type: 'hasteAllies', name: 'رفع التردد', pct: [0.3, 0.45, 0.65], dur: 5,
      text: 'تزيد سرعة هجوم جميع الحلفاء مؤقتًا.' });
  unit('chrome_ronin', 'رونين الكروم', 'Chrome Ronin', 'neon', 'fighter', 3, 60,
    { type: 'execute', name: 'قطع نهائي', dmg: [250, 420, 740],
      text: 'ضربة تتضاعف ضد الأهداف تحت 40% صحة.' });

  // ---- Elder Grove (no support)
  unit('moss_warden', 'حارس الطحلب', 'Moss Warden', 'sylvan', 'guardian', 1, 70,
    { type: 'healSelf', name: 'تجدد الطحلب', heal: [240, 400, 680],
      text: 'يستعيد جزءًا كبيرًا من صحته.' });
  unit('thorn_fox', 'ثعلب الأشواك', 'Thorn Fox', 'sylvan', 'fighter', 1, 70,
    { type: 'stunStrike', name: 'وخزة شائكة', dmg: [100, 170, 300], stun: [1, 1.2, 1.5],
      text: 'يصيب الهدف ويشلّه لفترة قصيرة.' });
  unit('willow_eye', 'عين الصفصاف', 'Willow Eye', 'sylvan', 'marksman', 2, 80,
    { type: 'multishot', name: 'وابل الأوراق', dmg: [130, 220, 380], count: 3,
      text: 'تطلق ثلاثة أسهم على أقرب ثلاثة أعداء.' });
  unit('root_shaman', 'شامان الجذور', 'Root Shaman', 'sylvan', 'mage', 3, 90,
    { type: 'stunAoe', name: 'قبضة الجذور', dmg: [220, 370, 650], stun: [1.2, 1.5, 2], radius: 1.6,
      text: 'جذور تقيّد الأعداء في منطقة وتؤذيهم.' });
  unit('wild_stalker', 'المتربّص البري', 'Wild Stalker', 'sylvan', 'assassin', 3, 60,
    { type: 'execute', name: 'انقضاض', dmg: [300, 520, 900],
      text: 'انقضاض قاتل يتضاعف ضد الأهداف الجريحة.' });


  // ======== NEW ROSTER (45 characters, unlocked from packs / battle pass; the 20 above are the starter roster)
  const LEGACY_STARTERS = U.map((u) => u.id);   // the first 20 units: owned by everyone before the gift-pack start (kept for old saves)
  // ---- new roster: Elder Grove
  unit('taiju', 'تايجو', 'Taiju', 'sylvan', 'guardian', 3, 80,
    { type: 'shieldSelf', name: 'لحاء الدهر', shield: [550, 900, 1450],
      text: 'يكتسب درعًا سميكًا.' }, { rarity: 'legendary' });
  unit('kashiwagi', 'كاشيواغي', 'Kashiwagi', 'sylvan', 'fighter', 3, 70,
    { type: 'cleave', name: 'ضربة السنديان', dmg: [170, 290, 490], radius: 1.4,
      text: 'ضربة دائرية تصيب الهدف ومن حوله.' });
  unit('shirayuki', 'شيراويوكي', 'Shirayuki', 'sylvan', 'mage', 3, 85,
    { type: 'stunAoe', name: 'ندى الفجر', dmg: [140, 240, 420], stun: [1.4, 1.7, 2.1], radius: 1.5,
      text: 'يجمّد الهدف ومن حوله ويصيبهم بضرر.' });
  unit('kazehaya', 'كازيهايا', 'Kazehaya', 'sylvan', 'marksman', 2, 80,
    { type: 'snipe', name: 'سهم الريح', dmg: [240, 410, 700],
      text: 'يقنص العدو الأقل صحة أينما كان.' });
  unit('kagemaru', 'كاجيمارو', 'Kagemaru', 'sylvan', 'assassin', 1, 60,
    { type: 'nuke', name: 'طعنة الظل', dmg: [150, 260, 450],
      text: 'طعنة خاطفة بضرر هائل للهدف.' });
  unit('hayate', 'هاياتي', 'Hayate', 'sylvan', 'assassin', 2, 60,
    { type: 'execute', name: 'عاصفة النصلين', dmg: [200, 350, 610],
      text: 'ضربة تتضاعف ضد الأهداف تحت 40% صحة.' });
  unit('yoshino', 'يوشينو', 'Yoshino', 'sylvan', 'support', 2, 90,
    { type: 'hasteAllies', name: 'لحن الورقة', pct: [0.25, 0.38, 0.55], dur: 5,
      text: 'يزيد سرعة هجوم جميع الحلفاء مؤقتًا.' });
  unit('kinoko', 'كينوكو', 'Kinoko', 'sylvan', 'support', 1, 60,
    { type: 'healLowest', name: 'بوغ الشفاء', heal: [230, 380, 640],
      text: 'يعالج الحليف الأكثر جرحًا.' });
  unit('genzo', 'جينزو', 'Genzo', 'sylvan', 'guardian', 2, 70,
    { type: 'healSelf', name: 'جذور الصمود', heal: [290, 480, 820],
      text: 'يستعيد جزءًا كبيرًا من صحته.' });
  unit('takashi', 'تاكاشي', 'Takashi', 'sylvan', 'marksman', 1, 80,
    { type: 'multishot', name: 'ضربة الصقر', dmg: [110, 180, 320], count: 3,
      text: 'يطلق ثلاثة أسهم على أقرب ثلاثة أعداء.' });
  unit('gensai', 'جينساي', 'Gensai', 'sylvan', 'mage', 2, 90,
    { type: 'aoe', name: 'كرة العاصفة', dmg: [280, 460, 780], radius: 1.6,
      text: 'انفجار يصيب منطقة حول الهدف.' });
  unit('ibara', 'إيبارا', 'Ibara', 'sylvan', 'mage', 2, 85,
    { type: 'stunAoe', name: 'سجن الأشواك', dmg: [120, 200, 350], stun: [1.4, 1.7, 2.1], radius: 1.4,
      text: 'يجمّد الهدف ومن حوله ويصيبهم بضرر.' });
  unit('kaito', 'كايتو', 'Kaito', 'sylvan', 'fighter', 2, 70,
    { type: 'stunStrike', name: 'تاج الشوك', dmg: [120, 200, 360], stun: [1, 1.2, 1.5],
      text: 'يصيب الهدف ويشلّه لفترة قصيرة.' });
  unit('hisui', 'هيسوي', 'Hisui', 'sylvan', 'support', 3, 80,
    { type: 'healAll', name: 'ريش الزمرد', heal: [170, 290, 510],
      text: 'يعالج جميع الحلفاء.' });
  unit('daigo', 'دايغو', 'Daigo', 'sylvan', 'guardian', 1, 90,
    { type: 'taunt', name: 'درع الطحلب', shield: [200, 350, 600], radius: 2.2, dur: 3,
      text: 'يجبر الأعداء القريبين على مهاجمته ويكتسب درعًا.' });
  unit('wakaba', 'واكابا', 'Wakaba', 'sylvan', 'marksman', 1, 80,
    { type: 'burn', name: 'سهم السمّ الأخضر', dps: [50, 85, 145], dur: 4,
      text: 'يحرق الهدف ضررًا متواصلًا لمدة 4 ثوانٍ.' });

  // ---- new roster: Neon-9
  unit('gantetsu', 'غانتيتسو', 'Gantetsu', 'neon', 'guardian', 2, 80,
    { type: 'shieldSelf', name: 'جلد الحجر', shield: [460, 740, 1200],
      text: 'يكتسب درعًا سميكًا.' });
  unit('tetsuya', 'تيتسويا', 'Tetsuya', 'neon', 'guardian', 1, 90,
    { type: 'taunt', name: 'تحدّي الفولاذ', shield: [200, 350, 600], radius: 2.2, dur: 3,
      text: 'يجبر الأعداء القريبين على مهاجمته ويكتسب درعًا.' });
  unit('reiji', 'ريجي', 'Reiji', 'neon', 'mage', 2, 90,
    { type: 'aoe', name: 'ختم الرموز', dmg: [280, 460, 780], radius: 1.6,
      text: 'انفجار يصيب منطقة حول الهدف.' });
  unit('mitsuki', 'ميتسوكي', 'Mitsuki', 'neon', 'support', 1, 60,
    { type: 'healLowest', name: 'بلّورة الشفاء', heal: [230, 380, 640],
      text: 'يعالج الحليف الأكثر جرحًا.' });
  unit('mugen', 'موغين', 'Mugen', 'neon', 'mage', 3, 85,
    { type: 'stunAoe', name: 'ثقب اللانهاية', dmg: [140, 240, 420], stun: [1.4, 1.7, 2.1], radius: 1.5,
      text: 'يجمّد الهدف ومن حوله ويصيبهم بضرر.' }, { rarity: 'legendary' });
  unit('juzo', 'جوزو', 'Juzo', 'neon', 'fighter', 2, 60,
    { type: 'execute', name: 'ضربة الجلّاد', dmg: [200, 350, 610],
      text: 'ضربة تتضاعف ضد الأهداف تحت 40% صحة.' });
  unit('kogetsu', 'كوغيتسو', 'Kogetsu', 'neon', 'fighter', 3, 70,
    { type: 'cleave', name: 'قطع التاج', dmg: [170, 290, 490], radius: 1.4,
      text: 'ضربة دائرية تصيب الهدف ومن حوله.' });
  unit('yozora', 'يوزورا', 'Yozora', 'neon', 'support', 3, 80,
    { type: 'healAll', name: 'مطر النجوم', heal: [170, 290, 510],
      text: 'يعالج جميع الحلفاء.' });
  unit('nagi', 'ناغي', 'Nagi', 'neon', 'assassin', 1, 60,
    { type: 'nuke', name: 'خنجرا الظلام', dmg: [150, 260, 450],
      text: 'طعنة خاطفة بضرر هائل للهدف.' });

  // ---- new roster: Emberreach
  unit('goka', 'غوكا', 'Goka', 'ember', 'fighter', 3, 70,
    { type: 'cleave', name: 'نار العرش', dmg: [170, 290, 490], radius: 1.4,
      text: 'ضربة دائرية تصيب الهدف ومن حوله.' }, { rarity: 'legendary' });
  unit('ryuji', 'ريوجي', 'Ryuji', 'ember', 'fighter', 1, 70,
    { type: 'stunStrike', name: 'قبضة الجمر', dmg: [100, 170, 300], stun: [1, 1.2, 1.5],
      text: 'يصيب الهدف ويشلّه لفترة قصيرة.' });
  unit('akane', 'أكاني', 'Akane', 'ember', 'assassin', 2, 60,
    { type: 'nuke', name: 'نصلا اللهب', dmg: [180, 310, 540],
      text: 'طعنة خاطفة بضرر هائل للهدف.' });
  unit('natsuki', 'ناتسوكي', 'Natsuki', 'ember', 'mage', 2, 90,
    { type: 'aoe', name: 'موجة الحمم', dmg: [280, 460, 780], radius: 1.6,
      text: 'انفجار يصيب منطقة حول الهدف.' });
  unit('shiro', 'شيرو', 'Shiro', 'ember', 'mage', 1, 90,
    { type: 'aoe', name: 'شرارة مبتدئ', dmg: [230, 380, 650], radius: 1.5,
      text: 'انفجار يصيب منطقة حول الهدف.' });
  unit('kurenai', 'كورينائي', 'Kurenai', 'ember', 'guardian', 3, 90,
    { type: 'taunt', name: 'قلعة القرمزي', shield: [290, 510, 870], radius: 2.4, dur: 3,
      text: 'يجبر الأعداء القريبين على مهاجمته ويكتسب درعًا.' });
  unit('tsubaki', 'تسوباكي', 'Tsubaki', 'ember', 'support', 1, 60,
    { type: 'healLowest', name: 'دفء الموقد', heal: [230, 380, 640],
      text: 'يعالج الحليف الأكثر جرحًا.' });
  unit('godo', 'غودو', 'Godo', 'ember', 'guardian', 2, 80,
    { type: 'shieldSelf', name: 'جلد الحمم', shield: [460, 740, 1200],
      text: 'يكتسب درعًا سميكًا.' });
  unit('yuta', 'يوتا', 'Yuta', 'ember', 'marksman', 1, 80,
    { type: 'burn', name: 'سهم الفحم', dps: [50, 85, 145], dur: 4,
      text: 'يحرق الهدف ضررًا متواصلًا لمدة 4 ثوانٍ.' });
  unit('momo', 'مومو', 'Momo', 'ember', 'support', 2, 90,
    { type: 'hasteAllies', name: 'خطة اللهب', pct: [0.25, 0.38, 0.55], dur: 5,
      text: 'يزيد سرعة هجوم جميع الحلفاء مؤقتًا.' });

  // ---- new roster: Moontide
  unit('seiji', 'سيجي', 'Seiji', 'tide', 'fighter', 2, 70,
    { type: 'drain', name: 'نصل الجزر', dmg: [220, 360, 610],
      text: 'ضربة تمتص الحياة وتعالجه بقيمة الضرر.' });
  unit('ryujin', 'ريوجين', 'Ryujin', 'tide', 'fighter', 3, 70,
    { type: 'cleave', name: 'رمح المدّ', dmg: [170, 290, 490], radius: 1.4,
      text: 'ضربة دائرية تصيب الهدف ومن حوله.' });
  unit('mizuki', 'ميزوكي', 'Mizuki', 'tide', 'assassin', 1, 60,
    { type: 'nuke', name: 'شفرة الموج', dmg: [150, 260, 450],
      text: 'طعنة خاطفة بضرر هائل للهدف.' });
  unit('miyuki', 'ميوكي', 'Miyuki', 'tide', 'support', 2, 80,
    { type: 'healAll', name: 'ترنيمة القمر', heal: [140, 240, 420],
      text: 'يعالج جميع الحلفاء.' });
  unit('shiori', 'شيوري', 'Shiori', 'tide', 'mage', 1, 85,
    { type: 'stunAoe', name: 'فقاعة مجمّدة', dmg: [100, 160, 290], stun: [1.4, 1.7, 2.1], radius: 1.3,
      text: 'يجمّد الهدف ومن حوله ويصيبهم بضرر.' });
  unit('tomoe', 'تومويه', 'Tomoe', 'tide', 'guardian', 1, 80,
    { type: 'shieldSelf', name: 'درع اللؤلؤ', shield: [380, 620, 1000],
      text: 'يكتسب درعًا سميكًا.' });
  unit('otohime', 'أوتوهيمي', 'Otohime', 'tide', 'support', 3, 80,
    { type: 'healAll', name: 'حضن البحر', heal: [170, 290, 510],
      text: 'يعالج جميع الحلفاء.' }, { rarity: 'legendary' });
  unit('haruka', 'هاروكا', 'Haruka', 'tide', 'mage', 2, 90,
    { type: 'aoe', name: 'دوّامة', dmg: [280, 460, 780], radius: 1.6,
      text: 'انفجار يصيب منطقة حول الهدف.' });
  unit('daikai', 'دايكاي', 'Daikai', 'tide', 'guardian', 3, 90,
    { type: 'taunt', name: 'مرساة الأعماق', shield: [290, 510, 870], radius: 2.4, dur: 3,
      text: 'يجبر الأعداء القريبين على مهاجمته ويكتسب درعًا.' });
  unit('kota', 'كوتا', 'Kota', 'tide', 'marksman', 1, 80,
    { type: 'snipe', name: 'هربون الرمية', dmg: [200, 340, 580],
      text: 'يقنص العدو الأقل صحة أينما كان.' });

  // ======== EVENT-EXCLUSIVE CARDS (weekly events only: never in packs, never in album sets). Art: assets/characters/<id>.jpg when added,
  // otherwise the role emblem is shown (see assets/characters/PROMPTS_EVENT.md)
  unit('hinotori', 'هينوتوري', 'Hinotori', 'ember', 'assassin', 3, 60,
    { type: 'nuke', name: 'ريشة الفينيكس', dmg: [220, 380, 650], text: 'طعنة خاطفة بضرر هائل للهدف.' }, { rarity: 'legendary', exclusive: true });
  unit('mikazuki', 'ميكازوكي', 'Mikazuki', 'tide', 'marksman', 3, 80,
    { type: 'snipe', name: 'سهم الهلال', dmg: [290, 490, 840], text: 'يقنص العدو الأقل صحة أينما كان.' }, { rarity: 'legendary', exclusive: true });
  unit('kaminari', 'كاميناري', 'Kaminari', 'neon', 'fighter', 3, 60,
    { type: 'execute', name: 'صاعقة الحسم', dmg: [250, 420, 740], text: 'ضربة تتضاعف ضد الأهداف تحت 40% صحة.' }, { rarity: 'legendary', exclusive: true });
  unit('kodama', 'كوداما', 'Kodama', 'sylvan', 'support', 3, 80,
    { type: 'healAll', name: 'همس الأرواح', heal: [170, 290, 510], text: 'يعالج جميع الحلفاء.' }, { rarity: 'legendary', exclusive: true });

  const UNITS = {};
  U.forEach((u) => (UNITS[u.id] = u));
  // The starter roster: 8 basic units (every role covered). Everything else comes from the gift packs, packs, the pass or events.
  const STARTER_IDS = ['ash_ronin', 'forge_bulwark', 'wave_caller', 'grid_hound', 'pixel_sniper', 'moss_warden', 'thorn_fox', 'shiro'];
  STARTER_IDS.forEach((id) => (UNITS[id].starter = true));

  /*
   * Heroes. `board` = stats when summoned onto the field (hp comes from life).
   * Ability effect types: buffAllies, damageCluster, shieldAllies, healAllies,
   * stunEnemies, frontDR, stunFront. `scale` adds value per round.
   */
  const HEROES = {
    kagira: {
      id: 'kagira', name: 'كيرو', title: 'الجمر الهادئ', world: 'ember', style: 'هجومي — هادئ ومحسوب، ينفجر عند الهجوم: ضغط مبكر وضرر متفجر',
      board: { atk: 85, as: 0.8, range: 1, def: 0.2, crit: 0.1 },
      passive: { id: 'blazing_will', name: 'إرادة متقدة', text: 'عندما يصبح البطل مكشوفًا يكتسب الحلفاء +25% هجوم.' },
      abilities: [
        { id: 'inferno_banner', name: 'أمر الهجوم', cost: 3, type: 'buffAllies', atkPct: 0.3, dur: 6,
          text: '+30% هجوم لجميع الحلفاء لمدة 6 ثوانٍ.' },
        { id: 'meteor', name: 'نيزك الجمر', cost: 4, type: 'damageCluster', dmg: 200, scale: 25, radius: 1.6,
          text: 'نيزك على أكثف تجمع للأعداء (200 + 25 لكل جولة).' },
      ],
    },
    merin: {
      id: 'merin', name: 'ميران', title: 'حارس المدّ الصامت', world: 'tide', style: 'صمود — ظلّ هادئ يحمي الفريق: دروع وعلاج ومعارك طويلة',
      board: { atk: 86, as: 0.8, range: 3, def: 0.1, crit: 0.05 },
      passive: { id: 'deep_reserve', name: 'مخزون عميق', text: '+1 جوهر إضافي كل جولة.' },
      abilities: [
        { id: 'tidal_ward', name: 'حاجز المدّ', cost: 3, type: 'shieldAllies', amount: 200, scale: 25,
          text: 'درع لجميع الحلفاء (200 + 25 لكل جولة).' },
        { id: 'moon_spring', name: 'ينبوع القمر', cost: 4, type: 'healAllies', pct: 0.36,
          text: 'يعالج جميع الحلفاء بنسبة 36% من صحتهم القصوى.' },
      ],
    },
    zerokai: {
      id: 'zerokai', name: 'زيرو-كاي', title: 'الظلّ المشفّر', world: 'neon', style: 'إيقاع — غامض يسبق خصمه بخطوة، اقتصاد مرن وسرعة',
      board: { atk: 74, as: 0.85, range: 4, def: 0.05, crit: 0.15 },
      passive: { id: 'free_reroll', name: 'وصول خلفي', text: 'أول تحديث للمتجر في كل جولة مجاني.' },
      abilities: [
        { id: 'overclock', name: 'كسر السرعة', cost: 3, type: 'buffAllies', asPct: 0.25, dur: 5,
          text: '+25% سرعة هجوم لجميع الحلفاء لمدة 5 ثوانٍ.' },
        { id: 'system_crash', name: 'انهيار النظام', cost: 5, type: 'stunEnemies', dur: 1.5,
          text: 'يشلّ جميع الأعداء لمدة 1.5 ثانية.' },
      ],
    },
    orath: {
      id: 'orath', name: 'أوراث', title: 'الحارس المحلّل', world: 'sylvan', style: 'دفاعي — هادئ وتحليلي يقرأ المعركة قبل أن تبدأ: خط أمامي صلب وتحكم',
      board: { atk: 75, as: 0.65, range: 1, def: 0.3, crit: 0.05 },
      passive: { id: 'ancient_bark', name: 'لحاء صلب', text: 'وحدات الصف الأمامي تكتسب +15% صحة قصوى.' },
      abilities: [
        { id: 'thorn_wall', name: 'جدار الأشواك', cost: 3, type: 'frontDR', dr: 0.35, dur: 6,
          text: 'الصف الأمامي يتلقى ضررًا أقل بـ 35% لمدة 6 ثوانٍ.' },
        { id: 'rootbind', name: 'قيد الجذور', cost: 4, type: 'stunFront', dur: 2, dmg: 100, scale: 15,
          text: 'يقيّد الصف الأمامي للعدو ثانيتين ويصيبه (100 + 15 لكل جولة).' },
      ],
    },
  };

  const ABILITY_TRIGGERS = {
    start: { id: 'start', name: 'بداية القتال' },
    t5: { id: 't5', name: 'بعد 5 ثوانٍ' },
    firstDeath: { id: 'firstDeath', name: 'عند سقوط أول حليف' },
    exposed: { id: 'exposed', name: 'عند انكشاف البطل' },
  };

  // Equipment (attached to a unit) and spells (armed for the next combat).
  const ITEMS = {
    rift_blade: { id: 'rift_blade', kind: 'equip', name: 'نصل الصدع', cost: 3, icon: 'sword',
      effects: [{ stat: 'atkPct', value: 0.25 }], text: '+25% هجوم.' },
    star_plate: { id: 'star_plate', kind: 'equip', name: 'درع النجم', cost: 3, icon: 'shield',
      effects: [{ stat: 'hpPct', value: 0.3 }, { stat: 'dr', value: 0.05 }], text: '+30% صحة، +5% تقليل ضرر.' },
    swift_charm: { id: 'swift_charm', kind: 'equip', name: 'تميمة الريح', cost: 3, icon: 'wind',
      effects: [{ stat: 'asPct', value: 0.25 }], text: '+25% سرعة هجوم.' },
    mana_prism: { id: 'mana_prism', kind: 'equip', name: 'موشور المانا', cost: 3, icon: 'orb',
      effects: [{ stat: 'startMana', value: 40 }, { stat: 'skillPower', value: 0.1 }], text: '+40 مانا ابتدائية، +10% قوة مهارة.' },
    vamp_fang: { id: 'vamp_fang', kind: 'equip', name: 'ناب الظل', cost: 3, icon: 'fang',
      effects: [{ stat: 'lifesteal', value: 0.2 }], text: '20% سرقة حياة.' },
    hawk_scope: { id: 'hawk_scope', kind: 'equip', name: 'منظار الصقر', cost: 3, icon: 'eye',
      effects: [{ stat: 'range', value: 1 }, { stat: 'crit', value: 0.15 }], text: '+1 مدى، +15% فرصة ضربة حرجة.' },

    war_hymn: { id: 'war_hymn', kind: 'spell', name: 'ترنيمة الحرب', cost: 2, icon: 'note',
      spell: { type: 'buffAll', atkPct: 0.2 }, text: 'القتال القادم: +20% هجوم لجميع الحلفاء.' },
    rift_ward: { id: 'rift_ward', kind: 'spell', name: 'حاجز الصدع', cost: 2, icon: 'shield',
      spell: { type: 'shieldFront', amount: 260 }, text: 'القتال القادم: درع 260 للصف الأمامي.' },
    dim_meteor: { id: 'dim_meteor', kind: 'spell', name: 'نيزك الأبعاد', cost: 3, icon: 'star',
      spell: { type: 'hitBack', dmg: 240, at: 3 }, text: 'القتال القادم: بعد 3 ثوانٍ يصيب الصف الخلفي للعدو بـ 240 ضرر.' },
    time_wind: { id: 'time_wind', kind: 'spell', name: 'ريح الزمن', cost: 2, icon: 'wind',
      spell: { type: 'hasteAll', asPct: 0.25, dur: 8 }, text: 'القتال القادم: +25% سرعة هجوم أول 8 ثوانٍ.' },
  };

  /*
   * Synergies. Counted by UNIQUE units on the board (duplicates don't stack).
   * World synergies affect members; role synergies mostly members.
   * `convergence` rewards mixing worlds so mixed teams are not weaker.
   */
  const SYNERGIES = {
    ember: { id: 'ember', kind: 'world', name: 'مملكة الجمر', tiers: [
      { n: 2, effects: [{ scope: 'members', stat: 'atkPct', value: 0.15 }], text: 'أعضاء الجمر +15% هجوم' },
      { n: 4, effects: [{ scope: 'members', stat: 'atkPct', value: 0.35 }], text: 'أعضاء الجمر +35% هجوم' }] },
    tide: { id: 'tide', kind: 'world', name: 'المدّ القمري', tiers: [
      { n: 2, effects: [{ scope: 'members', stat: 'startShieldPct', value: 0.22 }], text: 'أعضاء المدّ يبدؤون بدرع 22%' },
      { n: 4, effects: [{ scope: 'members', stat: 'startShieldPct', value: 0.4 }, { scope: 'members', stat: 'regenPct', value: 0.02 }], text: 'درع 40% + تجدد 2%/ث' }] },
    neon: { id: 'neon', kind: 'world', name: 'نيون-٩', tiers: [
      { n: 2, effects: [{ scope: 'members', stat: 'asPct', value: 0.18 }], text: 'أعضاء نيون +18% سرعة هجوم' },
      { n: 4, effects: [{ scope: 'members', stat: 'asPct', value: 0.4 }], text: 'أعضاء نيون +40% سرعة هجوم' }] },
    sylvan: { id: 'sylvan', kind: 'world', name: 'الغابة الأزلية', tiers: [
      { n: 2, effects: [{ scope: 'members', stat: 'hpPct', value: 0.2 }], text: 'أعضاء الغابة +20% صحة' },
      { n: 4, effects: [{ scope: 'members', stat: 'hpPct', value: 0.45 }], text: 'أعضاء الغابة +45% صحة' }] },

    guardian: { id: 'guardian', kind: 'role', name: 'الحرّاس', tiers: [
      { n: 2, effects: [{ scope: 'members', stat: 'dr', value: 0.15 }], text: 'الحراس +15% تقليل ضرر' },
      { n: 4, effects: [{ scope: 'members', stat: 'dr', value: 0.25 }, { scope: 'all', stat: 'dr', value: 0.08 }], text: 'الحراس +25%، الجميع +8% تقليل ضرر' }] },
    fighter: { id: 'fighter', kind: 'role', name: 'المقاتلون', tiers: [
      { n: 2, effects: [{ scope: 'members', stat: 'lifesteal', value: 0.15 }], text: 'المقاتلون 15% سرقة حياة' },
      { n: 4, effects: [{ scope: 'members', stat: 'lifesteal', value: 0.3 }, { scope: 'members', stat: 'atkPct', value: 0.1 }], text: '30% سرقة حياة +10% هجوم' }] },
    assassin: { id: 'assassin', kind: 'role', name: 'القتلة', tiers: [
      { n: 2, effects: [{ scope: 'members', stat: 'crit', value: 0.15 }, { scope: 'members', stat: 'critDmg', value: 0.3 }], text: '+15% حرجة، +30% ضرر حرج' },
      { n: 3, effects: [{ scope: 'members', stat: 'crit', value: 0.3 }, { scope: 'members', stat: 'critDmg', value: 0.6 }], text: '+30% حرجة، +60% ضرر حرج' }] },
    mage: { id: 'mage', kind: 'role', name: 'السحرة', tiers: [
      { n: 2, effects: [{ scope: 'members', stat: 'skillPower', value: 0.35 }, { scope: 'members', stat: 'startMana', value: 30 }], text: '+35% قوة مهارة، +30 مانا' },
      { n: 3, effects: [{ scope: 'members', stat: 'skillPower', value: 0.7 }, { scope: 'members', stat: 'startMana', value: 50 }], text: '+70% قوة مهارة، +50 مانا' }] },
    marksman: { id: 'marksman', kind: 'role', name: 'القناصة', tiers: [
      { n: 2, effects: [{ scope: 'members', stat: 'atkPct', value: 0.15 }, { scope: 'members', stat: 'range', value: 1 }], text: '+15% هجوم، +1 مدى' },
      { n: 3, effects: [{ scope: 'members', stat: 'atkPct', value: 0.35 }, { scope: 'members', stat: 'range', value: 1 }], text: '+35% هجوم، +1 مدى' }] },
    support: { id: 'support', kind: 'role', name: 'الداعمون', tiers: [
      { n: 2, effects: [{ scope: 'all', stat: 'regenPct', value: 0.015 }], text: 'جميع الحلفاء يتجددون 1.5%/ث' },
      { n: 3, effects: [{ scope: 'all', stat: 'regenPct', value: 0.03 }], text: 'جميع الحلفاء يتجددون 3%/ث' }] },

    convergence: { id: 'convergence', kind: 'special', name: 'تقارب العوالم', countBy: 'worlds', tiers: [
      { n: 3, effects: [{ scope: 'all', stat: 'atkPct', value: 0.1 }, { scope: 'all', stat: 'hpPct', value: 0.1 }], text: '3 عوالم: الجميع +10% هجوم وصحة' },
      { n: 4, effects: [{ scope: 'all', stat: 'atkPct', value: 0.2 }, { scope: 'all', stat: 'hpPct', value: 0.2 }], text: '4 عوالم: الجميع +20% هجوم وصحة' }] },
  };

  /*
   * Stage rewards: after each of the first 3 stages every player drafts 1 of 3 offers.
   * values are per stage [stage 1, stage 2, stage 3]. kind -> effect in core/match.js (claimReward).
   */
  const REWARDS = {
    unit:     { id: 'unit', icon: 'crown', name: 'مجنّد مجاني', tiers: [1, 2, 3], text: (v, st) => `وحدة فئة ${v.tiers[st]} مجانًا (من عالم بطلك غالبًا)` },
    gold:     { id: 'gold', icon: 'coin', name: 'كنز', n: [6, 8, 10], text: (v, st) => `+${v.n[st]} ذهب فورًا` },
    xp:       { id: 'xp', icon: 'star', name: 'تدريب مكثّف', n: [6, 8, 10], text: (v, st) => `+${v.n[st]} خبرة` },
    essence:  { id: 'essence', icon: 'essence', name: 'جوهر نقي', n: [3, 3, 4], text: (v, st) => `+${v.n[st]} جوهر لقدرات البطل` },
    item:     { id: 'item', icon: 'shield', name: 'غنيمة', text: () => 'معدة عشوائية تضعها على أي وحدة' },
    bless_atk:{ id: 'bless_atk', icon: 'sword', name: 'بركة الغضب', pct: [0.08, 0.1, 0.12], text: (v, st) => `الفريق كله +${Math.round(v.pct[st] * 100)}% هجوم لبقية المباراة` },
    bless_hp: { id: 'bless_hp', icon: 'heart', name: 'بركة الحجر', pct: [0.1, 0.12, 0.15], text: (v, st) => `الفريق كله +${Math.round(v.pct[st] * 100)}% صحة لبقية المباراة` },
    bless_as: { id: 'bless_as', icon: 'wind', name: 'بركة الريح', pct: [0.08, 0.1, 0.12], text: (v, st) => `الفريق كله +${Math.round(v.pct[st] * 100)}% سرعة هجوم لبقية المباراة` },
    heal:     { id: 'heal', icon: 'cross', name: 'ماء الحياة', n: [10, 12, 15], text: (v, st) => `يستعيد بطلك ${v.n[st]} حياة` },
  };
  // which rewards can appear in each stage (one "unit" is always offered)
  const REWARD_POOLS = [
    ['gold', 'xp', 'item', 'bless_hp'],
    ['item', 'essence', 'bless_atk', 'bless_hp', 'xp'],
    ['bless_atk', 'bless_hp', 'bless_as', 'heal', 'xp', 'essence'],
  ];

  Object.values(HEROES).forEach((h) => { h.rarity = h.rarity || 'legendary'; });
  AMB.DATA = { LEGACY_STARTERS, STARTER_IDS, REWARDS, REWARD_POOLS, WORLDS, ROLES, ROLE_BASE, TIER_MULT, TIER_RARITY, UNITS, HEROES, ITEMS, SYNERGIES, ABILITY_TRIGGERS };
})();
