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
      lore: 'مملكة حدادين وساموراي، سيوفهم تشتعل من قلب بركان حي.' },
    tide: { id: 'tide', name: 'المدّ القمري', en: 'Moontide', color: '#3ec9ff', glyph: '水',
      lore: 'جزر يحكمها القمر، وأرواح الموج تحمي وتعالج.' },
    neon: { id: 'neon', name: 'نيون-٩', en: 'Neon-9', color: '#c45cff', glyph: '電',
      lore: 'مدينة إلكترونية ما تنام، والسرعة فيها هي العملة.' },
    sylvan: { id: 'sylvan', name: 'الغابة الأزلية', en: 'Elder Grove', color: '#52d67c', glyph: '森',
      lore: 'غابة أقدم من الزمن، جذورها جدران وأشجارها حراس.' },
  };

  const ROLES = {
    guardian: { side: 'front', kind: 'def', place: 'أمامي', id: 'guardian', name: 'حارس', en: 'Guardian', icon: 'shield', desc: 'تانك: صحة ضخمة ودفاع عالي وضرر قليل. يوقف قدّام ويسحب الضرب عن الفريق.' },
    fighter: { side: 'front', kind: 'off', place: 'أمامي', id: 'fighter', name: 'مقاتل', en: 'Fighter', icon: 'sword', desc: 'مهاجم قريب: ضرر وسرعة عالية ودفاع ضعيف. يضرب قوي بس ينكسر بسرعة.' },
    assassin: { side: 'any', kind: 'off', place: 'أمامي أو خلفي (يقفز للخلف)', id: 'assassin', name: 'قاتل', en: 'Assassin', icon: 'dagger', desc: 'قاتل زجاجي: ضرر وحرجة عالية وصحة قليلة. يقفز مبكر للصف الخلفي ويصطاد.' },
    mage: { side: 'back', kind: 'off', place: 'خلفي', id: 'mage', name: 'ساحر', en: 'Mage', icon: 'orb', desc: 'ساحر: صحة قليلة وقوته في مهاراته اللي تضرب منطقة.' },
    marksman: { side: 'back', kind: 'off', place: 'خلفي', id: 'marksman', name: 'قناص', en: 'Marksman', icon: 'bow', desc: 'قناص: ضرر ثابت من بعيد. ضعيف قدام القتلة.' },
    support: { side: 'back', kind: 'def', place: 'خلفي', id: 'support', name: 'دعم', en: 'Support', icon: 'wings', desc: 'دعم: صحة متينة وضرر قليل. يعالج ويعطي دروع ويقوّي الفريق.' },
  };

  // 1-star, tier-1 baseline per role. Tier multiplies hp & atk.
  // identities: guardian = TANK (huge hp, high defence, little damage) · fighter = ATTACKER (hits hard and fast, weak defence)
  // assassin = glass cannon that dives · marksman = steady damage from far · mage = fragile, strength lives in the skill · support = sturdy healer, almost no damage
  const ROLE_BASE = {
    guardian: { hp: 700, atk: 34, as: 0.55, range: 1, def: 0.28, crit: 0.03 },
    fighter: { hp: 480, atk: 72, as: 0.8, range: 1, def: 0.04, crit: 0.08 },
    assassin: { hp: 380, atk: 54, as: 0.9, range: 1, def: 0, crit: 0.28 },
    mage: { hp: 440, atk: 44, as: 0.6, range: 3, def: 0, crit: 0.05 },
    marksman: { hp: 400, atk: 76, as: 0.75, range: 4, def: 0, crit: 0.12 },
    support: { hp: 660, atk: 42, as: 0.55, range: 3, def: 0.08, crit: 0.03 },
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

  // event-exclusive legendaries are a collector's prize, not a power spike: keep them near the rest of the roster
  const EXCLUSIVE_NERF = 0.92;
  // ---- Emberreach (no support)
  unit('ash_ronin', 'رونين الرماد', 'Ash Ronin', 'ember', 'fighter', 1, 70,
    { type: 'cleave', name: 'قطع الرماد', dmg: [185, 310, 520], radius: 1.2,
      text: 'ضربة تلف وتصيب الهدف واللي حوله.' });
  unit('forge_bulwark', 'حامي الأتون', 'Forge Bulwark', 'ember', 'guardian', 1, 90,
    { type: 'taunt', name: 'تحدّي الحدّاد', shield: [200, 350, 600], radius: 2.2, dur: 3,
      text: 'يخلّي الأعداء القريبين منه يهجمون عليه هو، ويجيه درع.' });
  unit('spark_wraith', 'شبح الشرر', 'Spark Wraith', 'ember', 'assassin', 2, 60,
    { type: 'nuke', name: 'طعنة الشرر', dmg: [230, 390, 660],
      text: 'طعنة سريعة بضرر عالي على الهدف.' });
  unit('pyre_archer', 'رامية المحرقة', 'Pyre Archer', 'ember', 'marksman', 2, 70,
    { type: 'burn', name: 'سهم المحرقة', dps: [52, 88, 150], dur: 4,
      text: 'يحرق الهدف ويضره كل ثانية لمدة 4 ثواني.' });
  unit('caldera_seer', 'عرّافة البركان', 'Caldera Seer', 'ember', 'mage', 3, 90,
    { type: 'aoe', name: 'انفجار الفوهة', dmg: [340, 560, 960], radius: 1.6,
      text: 'انفجار يضرب منطقة واسعة حول الهدف.' });

  // ---- Moontide (no assassin / marksman)
  unit('wave_caller', 'مستدعية الموج', 'Wave Caller', 'tide', 'support', 1, 60,
    { type: 'healLowest', name: 'موجة شافية', heal: [230, 380, 640],
      text: 'تعالج أضعف واحد في فريقك.' });
  unit('coral_sentinel', 'حارس المرجان', 'Coral Sentinel', 'tide', 'guardian', 1, 80,
    { type: 'shieldSelf', name: 'قشرة المرجان', shield: [380, 620, 1000],
      text: 'ياخذ درع قوي.' });
  unit('lunar_blade', 'سيّاف القمر', 'Lunar Blade', 'tide', 'fighter', 2, 70,
    { type: 'drain', name: 'خسوف', dmg: [220, 360, 620],
      text: 'ضربة تسحب صحة الهدف وترجّعها له.' });
  unit('mist_witch', 'ساحرة الضباب', 'Mist Witch', 'tide', 'mage', 2, 80,
    { type: 'stunAoe', name: 'ضباب متجمّد', dmg: [120, 200, 350], stun: [1.5, 1.8, 2.2], radius: 1.2,
      text: 'تجمّد الهدف واللي حوله وتضرّهم.' });
  unit('tide_priest', 'كاهن المدّ العالي', 'High Tide Priest', 'tide', 'support', 3, 70,
    { type: 'healAll', name: 'مدّ عظيم', heal: [180, 300, 520],
      text: 'يعالج كل الفريق.' });

  // ---- Neon-9 (no mage)
  unit('grid_hound', 'كلب الشبكة', 'Grid Hound', 'neon', 'assassin', 1, 60,
    { type: 'nuke', name: 'عضّة البيانات', dmg: [150, 260, 450],
      text: 'عضّة سريعة بضرر عالي.' });
  unit('pixel_sniper', 'قنّاص البكسل', 'Pixel Sniper', 'neon', 'marksman', 1, 80,
    { type: 'snipe', name: 'تصويب دقيق', dmg: [200, 340, 580],
      text: 'تصيد العدو الأضعف في أي مكان.' });
  unit('firewall_unit', 'وحدة الجدار الناري', 'Firewall Unit', 'neon', 'guardian', 2, 90,
    { type: 'taunt', name: 'جدار ناري', shield: [260, 430, 720], radius: 2.6, dur: 3,
      text: 'تخلّي الأعداء القريبين منها يهجمون عليها، وياخذ درع.' });
  unit('spectral_coder', 'المبرمجة الطيفية', 'Spectral Coder', 'neon', 'support', 2, 80,
    { type: 'hasteAllies', name: 'رفع التردد', pct: [0.3, 0.45, 0.65], dur: 5,
      text: 'تسرّع هجوم كل الفريق لفترة قصيرة.' });
  unit('chrome_ronin', 'رونين الكروم', 'Chrome Ronin', 'neon', 'fighter', 3, 60,
    { type: 'execute', name: 'قطع نهائي', dmg: [250, 420, 740],
      text: 'ضربتها تتضاعف على اللي صحته أقل من 40%.' });

  // ---- Elder Grove (no support)
  unit('moss_warden', 'حارس الطحلب', 'Moss Warden', 'sylvan', 'guardian', 1, 70,
    { type: 'healSelf', name: 'تجدد الطحلب', heal: [240, 400, 680],
      text: 'يرجّع جزء كبير من صحته.' });
  unit('thorn_fox', 'ثعلب الأشواك', 'Thorn Fox', 'sylvan', 'fighter', 1, 70,
    { type: 'stunStrike', name: 'وخزة شائكة', dmg: [140, 240, 410], stun: [1.3, 1.5, 1.8],
      text: 'يضرب الهدف ويوقفه لحظات.' });
  unit('willow_eye', 'عين الصفصاف', 'Willow Eye', 'sylvan', 'marksman', 2, 80,
    { type: 'multishot', name: 'وابل الأوراق', dmg: [130, 220, 380], count: 3,
      text: 'ترمي ثلاثة سهام على أقرب ثلاثة أعداء.' });
  unit('root_shaman', 'شامان الجذور', 'Root Shaman', 'sylvan', 'mage', 3, 90,
    { type: 'stunAoe', name: 'قبضة الجذور', dmg: [220, 370, 650], stun: [1.2, 1.5, 2], radius: 1.6,
      text: 'جذور تمسك الأعداء في المنطقة وتضرّهم.' });
  unit('wild_stalker', 'المتربّص البري', 'Wild Stalker', 'sylvan', 'assassin', 3, 60,
    { type: 'execute', name: 'انقضاض', dmg: [300, 520, 900],
      text: 'انقضاض يتضاعف ضرره على اللي صحته قليلة.' });


  // ======== NEW ROSTER (45 characters, unlocked from packs / battle pass; the 20 above are the starter roster)
  const LEGACY_STARTERS = U.map((u) => u.id);   // the first 20 units: owned by everyone before the gift-pack start (kept for old saves)
  // ---- new roster: Elder Grove
  unit('taiju', 'تايجو', 'Taiju', 'sylvan', 'guardian', 3, 80,
    { type: 'shieldSelf', name: 'لحاء الدهر', shield: [550, 900, 1450],
      text: 'ياخذ درع قوي.' }, { rarity: 'legendary' });
  unit('kashiwagi', 'كاشيواغي', 'Kashiwagi', 'sylvan', 'fighter', 3, 70,
    { type: 'cleave', name: 'ضربة السنديان', dmg: [170, 290, 490], radius: 1.4,
      text: 'ضربة تلف وتصيب الهدف واللي حوله.' });
  unit('shirayuki', 'شيراويوكي', 'Shirayuki', 'sylvan', 'mage', 3, 85,
    { type: 'stunAoe', name: 'ندى الفجر', dmg: [140, 240, 420], stun: [1.4, 1.7, 2.1], radius: 1.5,
      text: 'يجمّد الهدف واللي حوله ويضرّهم.' });
  unit('kazehaya', 'كازيهايا', 'Kazehaya', 'sylvan', 'marksman', 2, 80,
    { type: 'snipe', name: 'سهم الريح', dmg: [240, 410, 700],
      text: 'يصيد العدو الأضعف في أي مكان.' });
  unit('kagemaru', 'كاجيمارو', 'Kagemaru', 'sylvan', 'assassin', 1, 60,
    { type: 'nuke', name: 'طعنة الظل', dmg: [150, 260, 450],
      text: 'طعنة سريعة بضرر عالي على الهدف.' });
  unit('hayate', 'هاياتي', 'Hayate', 'sylvan', 'assassin', 2, 60,
    { type: 'execute', name: 'عاصفة النصلين', dmg: [200, 350, 610],
      text: 'ضربتها تتضاعف على اللي صحته أقل من 40%.' });
  unit('yoshino', 'يوشينو', 'Yoshino', 'sylvan', 'support', 2, 90,
    { type: 'hasteAllies', name: 'لحن الورقة', pct: [0.4, 0.6, 0.82], dur: 5,
      text: 'يسرّع هجوم كل الفريق لفترة قصيرة.' });
  unit('kinoko', 'كينوكو', 'Kinoko', 'sylvan', 'support', 1, 60,
    { type: 'healLowest', name: 'بوغ الشفاء', heal: [230, 380, 640],
      text: 'يعالج أضعف واحد في فريقه.' });
  unit('genzo', 'جينزو', 'Genzo', 'sylvan', 'guardian', 2, 70,
    { type: 'healSelf', name: 'جذور الصمود', heal: [290, 480, 820],
      text: 'يرجّع جزء كبير من صحته.' });
  unit('takashi', 'تاكاشي', 'Takashi', 'sylvan', 'marksman', 1, 80,
    { type: 'multishot', name: 'ضربة الصقر', dmg: [110, 180, 320], count: 3,
      text: 'يرمي ثلاثة سهام على أقرب ثلاثة أعداء.' });
  unit('gensai', 'جينساي', 'Gensai', 'sylvan', 'mage', 2, 90,
    { type: 'aoe', name: 'كرة العاصفة', dmg: [340, 560, 940], radius: 1.6,
      text: 'انفجار يضرب المنطقة حول الهدف.' });
  unit('ibara', 'إيبارا', 'Ibara', 'sylvan', 'mage', 2, 85,
    { type: 'stunAoe', name: 'سجن الأشواك', dmg: [120, 200, 350], stun: [1.4, 1.7, 2.1], radius: 1.4,
      text: 'يجمّد الهدف واللي حوله ويضرّهم.' });
  unit('kaito', 'كايتو', 'Kaito', 'sylvan', 'fighter', 2, 70,
    { type: 'stunStrike', name: 'تاج الشوك', dmg: [120, 200, 360], stun: [1, 1.2, 1.5],
      text: 'يضرب الهدف ويوقفه لحظات.' });
  unit('hisui', 'هيسوي', 'Hisui', 'sylvan', 'support', 3, 80,
    { type: 'healAll', name: 'ريش الزمرد', heal: [170, 290, 510],
      text: 'يعالج كل الفريق.' });
  unit('daigo', 'دايغو', 'Daigo', 'sylvan', 'guardian', 1, 90,
    { type: 'taunt', name: 'درع الطحلب', shield: [200, 350, 600], radius: 2.2, dur: 3,
      text: 'يخلّي الأعداء القريبين منه يهجمون عليه هو، ويجيه درع.' });
  unit('wakaba', 'سوتا', 'Souta', 'sylvan', 'marksman', 1, 80,
    { type: 'burn', name: 'سهم السمّ الأخضر', dps: [50, 85, 145], dur: 4,
      text: 'يحرق الهدف ويضره كل ثانية لمدة 4 ثواني.' });

  // ---- new roster: Neon-9
  unit('gantetsu', 'غانتيتسو', 'Gantetsu', 'neon', 'guardian', 2, 80,
    { type: 'shieldSelf', name: 'جلد الحجر', shield: [460, 740, 1200],
      text: 'ياخذ درع قوي.' });
  unit('tetsuya', 'تيتسويا', 'Tetsuya', 'neon', 'guardian', 1, 90,
    { type: 'taunt', name: 'تحدّي الفولاذ', shield: [200, 350, 600], radius: 2.2, dur: 3,
      text: 'يخلّي الأعداء القريبين منه يهجمون عليه هو، ويجيه درع.' });
  unit('reiji', 'ريجي', 'Reiji', 'neon', 'mage', 2, 90,
    { type: 'aoe', name: 'ختم الرموز', dmg: [280, 460, 780], radius: 1.6,
      text: 'انفجار يضرب المنطقة حول الهدف.' });
  unit('mitsuki', 'ميتسوكي', 'Mitsuki', 'neon', 'support', 1, 60,
    { type: 'healLowest', name: 'بلّورة الشفاء', heal: [230, 380, 640],
      text: 'يعالج أضعف واحد في فريقه.' });
  unit('mugen', 'موغين', 'Mugen', 'neon', 'mage', 3, 85,
    { type: 'stunAoe', name: 'ثقب اللانهاية', dmg: [140, 240, 420], stun: [1.4, 1.7, 2.1], radius: 1.5,
      text: 'يجمّد الهدف واللي حوله ويضرّهم.' }, { rarity: 'legendary' });
  unit('juzo', 'جوزو', 'Juzo', 'neon', 'fighter', 2, 60,
    { type: 'execute', name: 'ضربة الجلّاد', dmg: [200, 350, 610],
      text: 'ضربتها تتضاعف على اللي صحته أقل من 40%.' });
  unit('kogetsu', 'كوغيتسو', 'Kogetsu', 'neon', 'fighter', 3, 70,
    { type: 'cleave', name: 'قطع التاج', dmg: [170, 290, 490], radius: 1.4,
      text: 'ضربة تلف وتصيب الهدف واللي حوله.' });
  unit('yozora', 'يوزورا', 'Yozora', 'neon', 'support', 3, 70,
    { type: 'healAll', name: 'مطر النجوم', heal: [215, 360, 640],
      text: 'يعالج كل الفريق.' });
  unit('nagi', 'ناغي', 'Nagi', 'neon', 'assassin', 1, 60,
    { type: 'nuke', name: 'خنجرا الظلام', dmg: [150, 260, 450],
      text: 'طعنة سريعة بضرر عالي على الهدف.' });

  // ---- new roster: Emberreach
  unit('goka', 'غوكا', 'Goka', 'ember', 'fighter', 3, 70,
    { type: 'cleave', name: 'نار العرش', dmg: [170, 290, 490], radius: 1.4,
      text: 'ضربة تلف وتصيب الهدف واللي حوله.' }, { rarity: 'legendary' });
  unit('ryuji', 'ريوجي', 'Ryuji', 'ember', 'fighter', 1, 70,
    { type: 'stunStrike', name: 'قبضة الجمر', dmg: [140, 240, 410], stun: [1.3, 1.5, 1.8],
      text: 'يضرب الهدف ويوقفه لحظات.' });
  unit('akane', 'أكاني', 'Akane', 'ember', 'assassin', 2, 60,
    { type: 'nuke', name: 'نصلا اللهب', dmg: [180, 310, 540],
      text: 'طعنة سريعة بضرر عالي على الهدف.' });
  unit('natsuki', 'ناتسوكي', 'Natsuki', 'ember', 'mage', 2, 80,
    { type: 'aoe', name: 'موجة الحمم', dmg: [280, 460, 780], radius: 1.6,
      text: 'انفجار يضرب المنطقة حول الهدف.' });
  unit('shiro', 'شيرو', 'Shiro', 'ember', 'mage', 1, 75,
    { type: 'aoe', name: 'شرارة مبتدئ', dmg: [290, 470, 800], radius: 1.5,
      text: 'انفجار يضرب المنطقة حول الهدف.' });
  unit('kurenai', 'كورينائي', 'Kurenai', 'ember', 'guardian', 3, 90,
    { type: 'taunt', name: 'قلعة القرمزي', shield: [290, 510, 870], radius: 2.4, dur: 3,
      text: 'يخلّي الأعداء القريبين منه يهجمون عليه هو، ويجيه درع.' });
  unit('tsubaki', 'تسوباكي', 'Tsubaki', 'ember', 'support', 1, 60,
    { type: 'healLowest', name: 'دفء الموقد', heal: [230, 380, 640],
      text: 'يعالج أضعف واحد في فريقه.' });
  unit('godo', 'غودو', 'Godo', 'ember', 'guardian', 2, 80,
    { type: 'shieldSelf', name: 'جلد الحمم', shield: [460, 740, 1200],
      text: 'ياخذ درع قوي.' });
  unit('yuta', 'يوتا', 'Yuta', 'ember', 'marksman', 1, 80,
    { type: 'burn', name: 'سهم الفحم', dps: [50, 85, 145], dur: 4,
      text: 'يحرق الهدف ويضره كل ثانية لمدة 4 ثواني.' });
  unit('momo', 'شينغو', 'Shingo', 'ember', 'support', 2, 90,
    { type: 'hasteAllies', name: 'خطة اللهب', pct: [0.25, 0.38, 0.55], dur: 5,
      text: 'يسرّع هجوم كل الفريق لفترة قصيرة.' });

  // ---- new roster: Moontide
  unit('seiji', 'سيجي', 'Seiji', 'tide', 'fighter', 2, 70,
    { type: 'drain', name: 'نصل الجزر', dmg: [220, 360, 610],
      text: 'ضربة تسحب صحة الهدف وترجّعها له.' });
  unit('ryujin', 'ريوجين', 'Ryujin', 'tide', 'fighter', 3, 70,
    { type: 'cleave', name: 'رمح المدّ', dmg: [170, 290, 490], radius: 1.4,
      text: 'ضربة تلف وتصيب الهدف واللي حوله.' });
  unit('mizuki', 'ميزوتو', 'Mizuto', 'tide', 'assassin', 1, 60,
    { type: 'nuke', name: 'شفرة الموج', dmg: [150, 260, 450],
      text: 'طعنة سريعة بضرر عالي على الهدف.' });
  unit('miyuki', 'ميوكي', 'Miyuki', 'tide', 'support', 2, 80,
    { type: 'healAll', name: 'ترنيمة القمر', heal: [140, 240, 420],
      text: 'يعالج كل الفريق.' });
  unit('shiori', 'شيوري', 'Shiori', 'tide', 'mage', 3, 85,
    { type: 'stunAoe', name: 'فقاعة مجمّدة', dmg: [150, 250, 440], stun: [1.5, 1.8, 2.2], radius: 1.5,
      text: 'يجمّد الهدف واللي حوله ويضرّهم.' }, { rarity: 'legendary' });
  unit('tomoe', 'تومويه', 'Tomoe', 'tide', 'guardian', 1, 80,
    { type: 'shieldSelf', name: 'درع اللؤلؤ', shield: [380, 620, 1000],
      text: 'ياخذ درع قوي.' });
  unit('otohime', 'أوتوهيمي', 'Otohime', 'tide', 'support', 3, 70,
    { type: 'healAll', name: 'حضن البحر', heal: [170, 290, 510],
      text: 'يعالج كل الفريق.' }, { rarity: 'legendary' });
  unit('haruka', 'هاروتو', 'Haruto', 'tide', 'mage', 2, 90,
    { type: 'aoe', name: 'دوّامة', dmg: [280, 460, 780], radius: 1.6,
      text: 'انفجار يضرب المنطقة حول الهدف.' });
  unit('daikai', 'دايكاي', 'Daikai', 'tide', 'guardian', 3, 90,
    { type: 'taunt', name: 'مرساة الأعماق', shield: [290, 510, 870], radius: 2.4, dur: 3,
      text: 'يخلّي الأعداء القريبين منه يهجمون عليه هو، ويجيه درع.' });
  unit('kota', 'كوتا', 'Kota', 'tide', 'marksman', 1, 80,
    { type: 'snipe', name: 'هربون الرمية', dmg: [200, 340, 580],
      text: 'يصيد العدو الأضعف في أي مكان.' });

  // ======== EVENT-EXCLUSIVE CARDS (weekly events only: never in packs, never in album sets). Art: assets/characters/<id>.jpg when added,
  // otherwise the role emblem is shown (see assets/characters/PROMPTS_EVENT.md)
  unit('hinotori', 'هينوتوري', 'Hinotori', 'ember', 'assassin', 3, 60,
    { type: 'nuke', name: 'ريشة الفينيكس', dmg: [220, 380, 650], text: 'طعنة سريعة بضرر عالي على الهدف.' }, { rarity: 'legendary', exclusive: true });
  unit('mikazuki', 'ميكازوكي', 'Mikazuki', 'tide', 'marksman', 3, 80,
    { type: 'snipe', name: 'سهم الهلال', dmg: [290, 490, 840], text: 'يصيد العدو الأضعف في أي مكان.' }, { rarity: 'legendary', exclusive: true });
  unit('kaminari', 'كاميناري', 'Kaminari', 'neon', 'fighter', 3, 60,
    { type: 'execute', name: 'صاعقة الحسم', dmg: [250, 420, 740], text: 'ضربتها تتضاعف على اللي صحته أقل من 40%.' }, { rarity: 'legendary', exclusive: true });
  unit('kodama', 'كوداما', 'Kodama', 'sylvan', 'support', 3, 80,
    { type: 'healAll', name: 'همس الأرواح', heal: [170, 290, 510], text: 'يعالج كل الفريق.' }, { rarity: 'legendary', exclusive: true });

  /*
   * Twists: cards of the same role and base skill used to play identically. Each repeated one now has its own
   * extra effect (see Combat._twist). The first card of every group keeps the plain version; the rest get a twist
   * and ~7% less base power to pay for it. Text is added to the skill description automatically.
   */
  const TWISTS = {
    daigo: 'thorns', tetsuya: 'chill', kinoko: 'haste', mitsuki: 'barrier', tsubaki: 'cleanse', tomoe: 'thorns', ibara: 'sunder',
    kagemaru: 'bleed', nagi: 'slow', mizuki: 'vampiric', kota: 'sunder', kaminari: 'rally', ryuji: 'bleed',
    kogetsu: 'sunder', goka: 'rally', ryujin: 'vampiric', mugen: 'slow', juzo: 'bleed', momo: 'bolster',
    reiji: 'bleed', natsuki: 'sunder', haruka: 'charge', yozora: 'barrier', otohime: 'bolster', kodama: 'cleanse',
    yuta: 'slow', godo: 'wall', daikai: 'bash',
  };
  const TWIST_TEXT = {
    bleed: 'وينزف الهدف بعدها 4 ثواني.', sunder: 'ويضعف دفاع الهدف 5 ثواني.', slow: 'ويبطّئ هجوم الهدف 4 ثواني.',
    vampiric: 'ويرجّع له نص الضرر صحة.', rally: 'وتزيد سرعة هجومه 4 ثواني.', ward: 'وياخذ درع صغير.',
    charge: 'وتزيد مانا أقرب حليفين.', barrier: { healAll: 'ويعطي الكل درع صغير.', _: 'ويعطيه درع صغير.' },
    haste: 'وتزيد سرعة هجومه 4 ثواني.', cleanse: { healAll: 'ويفك الشلل عن الفريق.', _: 'ويفك الشلل عنه.' },
    bolster: 'ويقلّل الضرر على الفريق 4 ثواني.', thorns: 'ويرد جزء من الضرر على اللي يضربه 4 ثواني.',
    wall: 'ويقلّل الضرر اللي ياخذه 4 ثواني.', chill: 'ويبطّئ الأعداء القريبين منه.', mend: 'ويرجّع جزء من صحته.', bash: 'ويوقف أقرب عدو لحظة.',
  };
  U.forEach((u) => {
    const tw = TWISTS[u.id]; if (!tw) return;
    const sk = u.skill, t = TWIST_TEXT[tw];
    sk.extra = tw;
    sk.text = sk.text.replace(/[.،]\s*$/, '') + ' ' + (typeof t === 'string' ? t : (t[sk.type] || t._));
    ['dmg', 'heal', 'shield', 'dps'].forEach((k) => { if (Array.isArray(sk[k])) sk[k] = sk[k].map((v) => Math.round(v * 0.93)); });
  });
  const UNITS = {};
  U.forEach((u) => { if (u.exclusive) { u.hp = Math.round(u.hp * EXCLUSIVE_NERF); u.atk = Math.round(u.atk * EXCLUSIVE_NERF); } UNITS[u.id] = u; });
  // ---- rarity ladder: common = the role's plain job · rare = +1 trait · epic = +2 traits · legendary = +2 traits and a signature mechanic of its own (core/combat.js)
  const TRAITS = {
    ironhide: { name: 'جلد حديدي', text: '+6% دفاع', mods: { dr: 0.06 } }, frenzy: { name: 'هيجان', text: '+10% سرعة هجوم', mods: { asPct: 0.1 } },
    keen: { name: 'حدة', text: '+8% فرصة حرجة', mods: { crit: 0.08 } }, steady: { name: 'ثبات اليد', text: '+8% هجوم', mods: { atkPct: 0.08 } },
    focus: { name: 'تركيز', text: '+20 مانا من البداية', mods: { startMana: 20 } }, gentle: { name: 'حنان', text: '+15% قوة المهارة', mods: { skillPower: 0.15 } },
    ironhide2: { name: 'جلد حديدي+', text: '+9% دفاع', mods: { dr: 0.09 } }, bulwark: { name: 'حصن', text: 'يبدأ بدرع 12% من صحته', mods: { startShieldPct: 0.12 } },
    frenzy2: { name: 'هيجان+', text: '+15% سرعة هجوم', mods: { asPct: 0.15 } }, bite: { name: 'عضّة', text: 'يسرق 8% من ضرره صحة', mods: { lifesteal: 0.08 } },
    keen2: { name: 'حدة+', text: '+12% فرصة حرجة', mods: { crit: 0.12 } }, razor: { name: 'نصل', text: '+30% ضرر الحرجة', mods: { critDmg: 0.3 } },
    steady2: { name: 'ثبات اليد+', text: '+12% هجوم', mods: { atkPct: 0.12 } }, farsight: { name: 'بعد نظر', text: '+6% فرصة حرجة', mods: { crit: 0.06 } },
    focus2: { name: 'تركيز+', text: '+30 مانا من البداية', mods: { startMana: 30 } }, arcane: { name: 'سحر خام', text: '+20% قوة المهارة', mods: { skillPower: 0.2 } },
    gentle2: { name: 'حنان+', text: '+22% قوة المهارة', mods: { skillPower: 0.22 } }, vital: { name: 'حيوية', text: 'يتجدد 1% من صحته كل ثانية', mods: { regenPct: 0.01 } },
  };
  const RARE_TRAIT = { guardian: ['ironhide'], fighter: ['frenzy'], assassin: ['keen'], marksman: ['steady'], mage: ['focus'], support: ['gentle'] };
  const EPIC_TRAITS = { guardian: ['ironhide2', 'bulwark'], fighter: ['frenzy2', 'bite'], assassin: ['keen2', 'razor'], marksman: ['steady2', 'farsight'], mage: ['focus2', 'arcane'], support: ['gentle2', 'vital'] };
  const SIGS = {   // legendary signatures: the mechanic lives in core/combat.js
    reflect: { name: 'مرآة الجدار', text: 'يرد 15% من أي ضرر ياخذه على اللي ضربه' },
    bloodrush: { name: 'اندفاع الدم', text: 'كل قتل: +20% سرعة هجوم (حتى 3 مرات)' },
    reaper: { name: 'الحاصد', text: 'كل قتل: مهارته تجهز فورًا (مانا كاملة)' },
    deadeye: { name: 'العين القاتلة', text: 'كل ضربة ثالثة حرجة مضمونة' },
    overload: { name: 'فرط الحمل', text: 'كل ضربة +3% سرعة هجوم (حتى 10 مرات)' },
    echo: { name: 'صدى', text: 'بعد مهارته يرجع له نص المانا فيعيدها أسرع' },
    frostaura: { name: 'هالة الصقيع', text: 'الأعداء القريبون منه يبطؤون 12%' },
    lifeline: { name: 'حبل النجاة', text: 'مرة وحدة: أول حليف يموت ينجو بـ20% صحة' },
    bloom: { name: 'ازدهار', text: 'كل 3 ثواني يعالج الفريق كله 3% من صحتهم' },
  };
  const SIG_OF = { taiju: 'reflect', goka: 'bloodrush', hinotori: 'reaper', mikazuki: 'deadeye', kaminari: 'overload', mugen: 'echo', shiori: 'frostaura', otohime: 'lifeline', kodama: 'bloom' };
  U.forEach((u) => {
    if (u.rarity === 'rare') u.traits = (RARE_TRAIT[u.role] || []).slice();
    else if (u.rarity === 'epic' || u.rarity === 'legendary') u.traits = (EPIC_TRAITS[u.role] || []).slice();
    else u.traits = [];
    if (u.rarity === 'legendary') { u.sig = SIG_OF[u.id] || null; }
  });
  // ---- role slots: every field slot belongs to a role; a card standing in a slot of its own role gets that role's bonus
  //  front: f1,f2 = guardians (the wall) · f0,f3 = fighters/assassins (the flanks)   back: b0,b3 = marksmen (the wings) · b1 = mage · b2 = support
  const SLOT_ROLES = { f0: ['fighter', 'assassin'], f1: ['guardian'], f2: ['guardian'], f3: ['fighter', 'assassin'], b0: ['marksman'], b1: ['mage'], b2: ['support'], b3: ['marksman'] };
  const ROLE_BONUS = {
    guardian: { mods: { hpPct: 0.15, dr: 0.05 }, text: '+15% صحة و+5% دفاع' }, fighter: { mods: { atkPct: 0.1, asPct: 0.05 }, text: '+10% هجوم و+5% سرعة' },
    assassin: { mods: { crit: 0.08, atkPct: 0.06 }, text: '+8% حرجة و+6% هجوم' }, marksman: { mods: { atkPct: 0.08 }, text: '+8% هجوم' },
    mage: { mods: { skillPower: 0.1, startMana: 10 }, text: '+10% قوة المهارة و+10 مانا' }, support: { mods: { skillPower: 0.15, regenPct: 0.005 }, text: '+15% قوة المهارة وتجدد 0.5%' },
  };
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
      id: 'kagira', name: 'كيرو', title: 'الجمر الهادئ', world: 'ember', style: 'هجومي: هادي وحسّابه، وإذا هجم ينفجر. ضغط من البداية وضرر قوي.',
      board: { atk: 85, as: 0.8, range: 1, def: 0.2, crit: 0.1 },
      vanguard: { name: 'الهجوم الكاسح', text: 'لما ينزل الساحة: الفريق +11% هجوم، وهو يضرب أقوى (+5% هجوم، +3% فرصة حرجة).', allyAtk: 0.22, heroAtk: 0.1, heroCrit: 0.06 },
      passive: { id: 'blazing_will', name: 'إرادة متقدة', text: 'لما يسقط الصف الأمامي، الفريق ياخذ +45% هجوم.' },
      abilities: [
        { id: 'inferno_banner', name: 'أمر الهجوم', cost: 3, type: 'buffAllies', atkPct: 0.42, dur: 6,
          text: '+42% هجوم لكل الفريق لمدة 6 ثواني.' },
        { id: 'meteor', name: 'نيزك الجمر', cost: 4, type: 'damageCluster', dmg: 240, scale: 25, radius: 1.6,
          text: 'نيزك ينزل على أكثر مكان فيه أعداء (240 + 25 مع كل جولة).' },
      ],
    },
    merin: {
      id: 'merin', name: 'ميران', title: 'حارس المدّ الصامت', world: 'tide', style: 'صمود: هادي ويحمي الفريق. دروع وعلاج ومعارك طويلة.',
      board: { atk: 86, as: 0.8, range: 3, def: 0.1, crit: 0.05 },
      vanguard: { name: 'درع المدّ', text: 'لما ينزل الساحة: الفريق يتجدد 0.15% من صحته كل ثانية، وهو ياخذ درع حياة وحدة ويصمد أطول بحياة قبل ما ينسحب.', allyRegen: 0.003, heroShield: 1, knockoutBonus: 1 },
      passive: { id: 'deep_reserve', name: 'مخزون عميق', text: '+2 جوهرة زيادة كل جولة.' },
      abilities: [
        { id: 'tidal_ward', name: 'حاجز المدّ', cost: 3, type: 'shieldAllies', amount: 150, scale: 25,
          text: 'درع لكل الفريق (150 + 25 مع كل جولة).' },
        { id: 'moon_spring', name: 'ينبوع القمر', cost: 4, type: 'healAllies', pct: 0.36,
          text: 'يعالج كل الفريق بنسبة 36% من صحتهم الكاملة.' },
      ],
    },
    zerokai: {
      id: 'zerokai', name: 'زيرو-كاي', title: 'الظلّ المشفّر', world: 'neon', style: 'سرعة: غامض وسابق خصمه بخطوة. اقتصاد مرن وحركة سريعة.',
      board: { atk: 74, as: 0.85, range: 4, def: 0.05, crit: 0.15 },
      vanguard: { name: 'نبض السرعة', text: 'لما ينزل الساحة: الفريق +10% سرعة هجوم، وهو أسرع بـ10%، وكل قدراته تتكلف نقطة أقل.', allyAs: 0.20, heroAs: 0.2, extraDiscount: 1 },
      passive: { id: 'free_reroll', name: 'وصول خلفي', text: 'أول تحديث للمتجر في كل جولة مجاني.' },
      abilities: [
        { id: 'overclock', name: 'كسر السرعة', cost: 3, type: 'buffAllies', asPct: 0.3, dur: 5,
          text: '+30% سرعة هجوم لكل الفريق لمدة 5 ثواني.' },
        { id: 'system_crash', name: 'انهيار النظام', cost: 5, type: 'stunEnemies', dur: 1.5,
          text: 'يوقف كل الأعداء لمدة 1.5 ثانية.' },
      ],
    },
    orath: {
      id: 'orath', name: 'أوراث', title: 'الحارس المحلّل', world: 'sylvan', style: 'دفاعي: هادي ويحلل، ويقرأ المعركة قبل لا تبدأ. خط أمامي قوي وسيطرة.',
      board: { atk: 75, as: 0.65, range: 1, def: 0.3, crit: 0.05 },
      vanguard: { name: 'الجدار الحي', text: 'لما ينزل الساحة: الصف الأمامي +11% صحة، وكل الفريق ياخذ ضرر أقل 2.5%، وهو أصلب (+7.5% دفاع).', frontHp: 0.22, allyDr: 0.05, heroDef: 0.15 },
      passive: { id: 'ancient_bark', name: 'لحاء صلب', text: 'وحدات الصف الأمامي تاخذ +6% صحة.' },
      abilities: [
        { id: 'thorn_wall', name: 'جدار الأشواك', cost: 3, type: 'frontDR', dr: 0.42, dur: 6,
          text: 'الصف الأمامي ياخذ ضرر أقل بـ 42% لمدة 6 ثواني.' },
        { id: 'rootbind', name: 'قيد الجذور', cost: 4, type: 'stunFront', dur: 2.4, dmg: 140, scale: 15,
          text: 'يوقف الصف الأمامي للعدو 2.4 ثانية ويضرّه (140 + 15 مع كل جولة).' },
      ],
    },
    rika: {
      id: 'rika', name: 'ريكا', title: 'ملكة الأتون', world: 'ember', style: 'قوة: ضربات ثقيلة وخط أمامي ناري. تحمي وتضرب بنفس الوقت.',
      board: { atk: 86, as: 0.7, range: 1, def: 0.2, crit: 0.1 },
      vanguard: { name: 'مطرقة الأتون', text: 'لما ينزل الساحة: الفريق +2% هجوم، والصف الأمامي +4% صحة، وهو أصلب (+5% دفاع) وأقوى بـ3%.', allyAtk: 0.04, frontHp: 0.08, heroDef: 0.1, heroAtk: 0.06 },
      passive: { id: 'forge_heart', name: 'قلب الأتون', text: 'وحدات الصف الأمامي تاخذ +4.5% هجوم.' },
      abilities: [
        { id: 'molten_hammer', name: 'مطرقة الحمم', cost: 4, type: 'damageCluster', dmg: 230, scale: 28, radius: 1.4,
          text: 'مطرقة تنزل على أكثر مكان فيه أعداء (230 + 28 مع كل جولة).' },
        { id: 'anvil_ward', name: 'حماية السندان', cost: 3, type: 'shieldAllies', amount: 150, scale: 20,
          text: 'درع لكل الفريق (150 + 20 مع كل جولة).' },
      ],
    },
    kairyu: {
      id: 'kairyu', name: 'كايريو', title: 'قبطان العاصفة', world: 'tide', style: 'قيادة: قبطان هادي يوزّع الأوامر. يقوّي الفريق ويثبّت الجبهة.',
      board: { atk: 80, as: 0.75, range: 2, def: 0.15, crit: 0.08 },
      vanguard: { name: 'أمر القبطان', text: 'لما ينزل الساحة: الفريق ياخذ ضرر أقل 2% ويتجدد 0.2% كل ثانية، وهو ياخذ درع 2 حياة.', allyDr: 0.04, allyRegen: 0.004, heroShield: 2 },
      passive: { id: 'sea_legs', name: 'ثبات البحّار', text: 'كل وحداتك تبدأ القتال بدرع 13% من صحتها.' },
      abilities: [
        { id: 'captains_order', name: 'أمر القبطان', cost: 3, type: 'buffAllies', atkPct: 0.1, asPct: 0.2, dur: 6,
          text: '+10% هجوم و+20% سرعة هجوم لكل الفريق لمدة 6 ثواني.' },
        { id: 'rogue_wave', name: 'موجة غادرة', cost: 4, type: 'stunFront', dur: 1.5, dmg: 120, scale: 20,
          text: 'يوقف الصف الأمامي للعدو 1.5 ثانية ويضرّه (120 + 20 مع كل جولة).' },
      ],
    },
    nayako: {
      id: 'nayako', name: 'ناياكو', title: 'نجمة الشبكة', world: 'neon', style: 'إيقاع: نجمة خفيفة تغيّر مجرى المعركة بنبضة. اقتصاد وتشويش.',
      board: { atk: 72, as: 0.9, range: 4, def: 0.05, crit: 0.18 },
      vanguard: { name: 'نبضة الإيقاع', text: 'لما ينزل الساحة: الفريق +5% سرعة هجوم، وهو يضرب حرجة أكثر (+5%)، وقدراته أرخص بنقطة.', allyAs: 0.10, heroCrit: 0.10, extraDiscount: 1 },
      passive: { id: 'data_stream', name: 'تدفق البيانات', text: '+1 ذهب إضافي كل جولة، وكل وحداتك +2% سرعة هجوم.' },
      abilities: [
        { id: 'hologram_wall', name: 'جدار الهولوغرام', cost: 3, type: 'shieldAllies', amount: 240, scale: 25,
          text: 'درع لكل الفريق (240 + 25 مع كل جولة).' },
        { id: 'glitch_pulse', name: 'نبضة تشويش', cost: 4, type: 'stunEnemies', dur: 1.6,
          text: 'يوقف كل الأعداء لمدة 1.6 ثانية.' },
      ],
    },
    thora: {
      id: 'thora', name: 'ثورا', title: 'ملكة الدب', world: 'sylvan', style: 'صمود: قوية وكريمة، تتحمل وترجّع. جلد الدب يحميها وفريقها.',
      board: { atk: 78, as: 0.7, range: 1, def: 0.25, crit: 0.06 },
      vanguard: { name: 'زئير الغابة', text: 'لما ينزل الساحة: الصف الأمامي +5% صحة، والفريق يتجدد 0.2% كل ثانية، وهي أصلب (+5% دفاع) وتصمد أطول بـ2 حياة.', frontHp: 0.1, allyRegen: 0.004, knockoutBonus: 2, heroDef: 0.1 },
      passive: { id: 'bear_hide', name: 'جلد الدب', text: 'كل وحداتك +12% صحة.' },
      abilities: [
        { id: 'spring_bloom', name: 'ازدهار الربيع', cost: 4, type: 'healAllies', pct: 0.28,
          text: 'يعالج كل الفريق بنسبة 28% من صحتهم الكاملة.' },
        { id: 'axe_cleave', name: 'ضربة الفأس', cost: 3, type: 'damageCluster', dmg: 200, scale: 26, radius: 1.2,
          text: 'ضربة فأس على أكثر مكان فيه أعداء (200 + 26 مع كل جولة).' },
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
      effects: [{ stat: 'hpPct', value: 0.3 }, { stat: 'dr', value: 0.05 }], text: '+30% صحة، و5% ضرر أقل عليه.' },
    swift_charm: { id: 'swift_charm', kind: 'equip', name: 'تميمة الريح', cost: 3, icon: 'wind',
      effects: [{ stat: 'asPct', value: 0.25 }], text: '+25% سرعة هجوم.' },
    mana_prism: { id: 'mana_prism', kind: 'equip', name: 'موشور المانا', cost: 3, icon: 'orb',
      effects: [{ stat: 'startMana', value: 40 }, { stat: 'skillPower', value: 0.1 }], text: '+40 مانا من البداية، و+10% قوة للمهارة.' },
    vamp_fang: { id: 'vamp_fang', kind: 'equip', name: 'ناب الظل', cost: 3, icon: 'fang',
      effects: [{ stat: 'lifesteal', value: 0.2 }], text: 'يسرق 20% من ضرره صحة.' },
    hawk_scope: { id: 'hawk_scope', kind: 'equip', name: 'منظار الصقر', cost: 3, icon: 'eye',
      effects: [{ stat: 'range', value: 1 }, { stat: 'crit', value: 0.15 }], text: '+1 مدى، و+15% فرصة ضربة حرجة.' },

    war_hymn: { id: 'war_hymn', kind: 'spell', name: 'ترنيمة الحرب', cost: 2, icon: 'note',
      spell: { type: 'buffAll', atkPct: 0.2 }, text: 'القتال الجاي: +20% هجوم لكل الفريق.' },
    rift_ward: { id: 'rift_ward', kind: 'spell', name: 'حاجز الصدع', cost: 2, icon: 'shield',
      spell: { type: 'shieldFront', amount: 260 }, text: 'القتال الجاي: درع 260 للصف الأمامي.' },
    dim_meteor: { id: 'dim_meteor', kind: 'spell', name: 'نيزك الأبعاد', cost: 3, icon: 'star',
      spell: { type: 'hitBack', dmg: 240, at: 3 }, text: 'القتال الجاي: بعد 3 ثواني يضرب الصف الخلفي للعدو بـ 240 ضرر.' },
    time_wind: { id: 'time_wind', kind: 'spell', name: 'ريح الزمن', cost: 2, icon: 'wind',
      spell: { type: 'hasteAll', asPct: 0.25, dur: 8 }, text: 'القتال الجاي: +25% سرعة هجوم أول 8 ثواني.' },
  };

  /*
   * Synergies. Counted by UNIQUE units on the board (duplicates don't stack).
   * World synergies affect members; role synergies mostly members.
   * `convergence` rewards mixing worlds so mixed teams are not weaker.
   */
  const SYNERGIES = {
    ember: { id: 'ember', kind: 'world', name: 'مملكة الجمر', tiers: [
      { n: 2, effects: [{ scope: 'members', stat: 'atkPct', value: 0.15 }], text: 'وحدات الجمر +15% هجوم' },
      { n: 4, effects: [{ scope: 'members', stat: 'atkPct', value: 0.35 }], text: 'وحدات الجمر +35% هجوم' }] },
    tide: { id: 'tide', kind: 'world', name: 'المدّ القمري', tiers: [
      { n: 2, effects: [{ scope: 'members', stat: 'startShieldPct', value: 0.22 }], text: 'وحدات المدّ تبدأ بدرع 22%' },
      { n: 4, effects: [{ scope: 'members', stat: 'startShieldPct', value: 0.4 }, { scope: 'members', stat: 'regenPct', value: 0.02 }], text: 'درع 40% + تجدد 2% كل ثانية' }] },
    neon: { id: 'neon', kind: 'world', name: 'نيون-٩', tiers: [
      { n: 2, effects: [{ scope: 'members', stat: 'asPct', value: 0.18 }], text: 'وحدات نيون +18% سرعة هجوم' },
      { n: 4, effects: [{ scope: 'members', stat: 'asPct', value: 0.4 }], text: 'وحدات نيون +40% سرعة هجوم' }] },
    sylvan: { id: 'sylvan', kind: 'world', name: 'الغابة الأزلية', tiers: [
      { n: 2, effects: [{ scope: 'members', stat: 'hpPct', value: 0.2 }], text: 'وحدات الغابة +20% صحة' },
      { n: 4, effects: [{ scope: 'members', stat: 'hpPct', value: 0.45 }], text: 'وحدات الغابة +45% صحة' }] },

    guardian: { id: 'guardian', kind: 'role', name: 'الحرّاس', tiers: [
      { n: 2, effects: [{ scope: 'members', stat: 'dr', value: 0.15 }], text: 'الحراس ياخذون 15% ضرر أقل' },
      { n: 4, effects: [{ scope: 'members', stat: 'dr', value: 0.25 }, { scope: 'all', stat: 'dr', value: 0.08 }], text: 'الحراس ياخذون 25% ضرر أقل، والباقي 8%' }] },
    fighter: { id: 'fighter', kind: 'role', name: 'المقاتلون', tiers: [
      { n: 2, effects: [{ scope: 'members', stat: 'lifesteal', value: 0.2 }], text: 'المقاتلون يسرقون 20% من ضررهم صحة' },
      { n: 4, effects: [{ scope: 'members', stat: 'lifesteal', value: 0.35 }, { scope: 'members', stat: 'atkPct', value: 0.1 }], text: 'يسرقون 35% صحة، و+10% هجوم' }] },
    assassin: { id: 'assassin', kind: 'role', name: 'القتلة', tiers: [
      { n: 2, effects: [{ scope: 'members', stat: 'crit', value: 0.12 }, { scope: 'members', stat: 'critDmg', value: 0.25 }, { scope: 'members', stat: 'atkPct', value: 0.25 }, { scope: 'members', stat: 'hpPct', value: 0.2 }], text: '+12% فرصة حرجة، و+25% ضرر الحرجة، و+25% هجوم، و+20% صحة' },
      { n: 3, effects: [{ scope: 'members', stat: 'crit', value: 0.2 }, { scope: 'members', stat: 'critDmg', value: 0.4 }, { scope: 'members', stat: 'atkPct', value: 0.5 }, { scope: 'members', stat: 'hpPct', value: 0.4 }], text: '+20% فرصة حرجة، و+40% ضرر الحرجة، و+50% هجوم، و+40% صحة' }] },
    mage: { id: 'mage', kind: 'role', name: 'السحرة', tiers: [
      { n: 2, effects: [{ scope: 'members', stat: 'skillPower', value: 0.45 }, { scope: 'members', stat: 'startMana', value: 30 }], text: '+45% قوة المهارة، و+30 مانا' },
      { n: 3, effects: [{ scope: 'members', stat: 'skillPower', value: 0.9 }, { scope: 'members', stat: 'startMana', value: 50 }], text: '+90% قوة المهارة، و+50 مانا' }] },
    marksman: { id: 'marksman', kind: 'role', name: 'القناصة', tiers: [
      { n: 2, effects: [{ scope: 'members', stat: 'atkPct', value: 0.15 }, { scope: 'members', stat: 'range', value: 1 }], text: '+15% هجوم، و+1 مدى' },
      { n: 3, effects: [{ scope: 'members', stat: 'atkPct', value: 0.35 }, { scope: 'members', stat: 'range', value: 1 }], text: '+35% هجوم، و+1 مدى' }] },
    support: { id: 'support', kind: 'role', name: 'الداعمون', tiers: [
      { n: 2, effects: [{ scope: 'all', stat: 'regenPct', value: 0.02 }], text: 'كل الفريق يتجدد 2% كل ثانية' },
      { n: 3, effects: [{ scope: 'all', stat: 'regenPct', value: 0.05 }], text: 'كل الفريق يتجدد 5% كل ثانية' }] },

    convergence: { id: 'convergence', kind: 'special', name: 'تقارب العوالم', countBy: 'worlds', tiers: [
      { n: 3, effects: [{ scope: 'all', stat: 'atkPct', value: 0.1 }, { scope: 'all', stat: 'hpPct', value: 0.1 }], text: '3 عوالم: الكل +10% هجوم وصحة' },
      { n: 4, effects: [{ scope: 'all', stat: 'atkPct', value: 0.2 }, { scope: 'all', stat: 'hpPct', value: 0.2 }], text: '4 عوالم: الكل +20% هجوم وصحة' }] },
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
  const HERO_STARTERS = ['kagira', 'merin', 'zerokai', 'orath'];   // the four heroes a new player can pick; the rest come from packs and the battle pass
  AMB.DATA = { SLOT_ROLES, ROLE_BONUS, TRAITS, SIGS, HERO_STARTERS, LEGACY_STARTERS, STARTER_IDS, REWARDS, REWARD_POOLS, WORLDS, ROLES, ROLE_BASE, TIER_MULT, TIER_RARITY, UNITS, HEROES, ITEMS, SYNERGIES, ABILITY_TRIGGERS };
})();
