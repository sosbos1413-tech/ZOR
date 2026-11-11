/* core/config.js */
/*
 * ZOR (Zones Of Rift) — tunable configuration.
 * Every number that shapes balance or pacing lives here, so it can be changed
 * and re-tested (tools/simulate.js) without touching the engine.
 * All values are prototype defaults, NOT final rules.
 */
(function () {
  const AMB = (globalThis.AMB = globalThis.AMB || {});

  // ======================================================================================
  //  THE SHOP — every number of the 5-level shop lives in THIS ONE BLOCK. Edit freely, then run
  //  `node tools/test.js` and `node tools/simulate.js`.
  //   - level N sells cards of 1..N stars only (a card's price in gold = its stars)
  //   - upgrading costs more at every level; the price falls by `upgradeDecay` for each round you skip upgrading (never below `upgradeMin`)
  //   - 3 copies of one card (team or bench) merge into ONE upgraded card (stats x mult, gold frame); it never merges again
  //   - merge reward: pick 1 of 3 cards, each one star above your shop level (max 5)
  // ======================================================================================
  AMB.SHOP = {
    rounds: 8,                    // length of a normal match (rounds)
    levels: 5,                    // shop levels (= highest card star)
    startLevel: 1,

    // units allowed on the board at each shop level (index 0 = level 1)
    boardSize: [3, 4, 5, 6, 7],

    // shop odds (%) by shop level: [1 star, 2, 3, 4, 5]. Each upgrade adds one star above and lowers the lowest one step by step.
    odds: {
      1: [100, 0, 0, 0, 0],
      2: [75, 25, 0, 0, 0],
      3: [55, 33, 12, 0, 0],
      4: [38, 32, 22, 8, 0],
      5: [24, 28, 24, 16, 8],
    },

    // price to buy level N (key = the level you are buying)
    upgradeCost: { 2: 5, 3: 8, 4: 10, 5: 13 },
    upgradeDecay: 1,              // price drops by this much for every round that passes without an upgrade
    upgradeMin: 3,                // ...but never below this

    // base gold at the start of each round (index 0 = round 1); interest / streak / win bonuses come on top
    income: [6, 6, 7, 8, 8, 9, 9, 10],
    interestPer: 10,              // +1 gold per 10 banked
    interestMax: 2,
    winBonus: 1,

    // copies of each card in the shared pool, by the card's stars
    pool: { 1: 12, 2: 10, 3: 8, 4: 7, 5: 6 },

    shopSlots: 5,
    rerollCost: 1,

    merge: {
      copies: 3,                  // identical cards that merge
      mult: 2,                    // the upgraded card: hp and attack x this
      choices: 3,                 // cards offered as the merge reward
    },

    // card stars (1-5) by rarity; list a card id in `override` to place it by hand.
    // common 1 / rare 2 / epic 3 (lighter ones) or 4 / shop legendary 5. Heroes are never sold.
    rankByRarity: { common: 1, rare: 2, epic: 3, legendary: 5 },
    override: {
      chrome_ronin: 4, daikai: 4, kashiwagi: 4, kogetsu: 4, kurenai: 4, ryujin: 4, shirayuki: 4,
    },
    // hp & attack multiplier for a card's stars (1 star = baseline)
    statMult: { 1: 1, 2: 1.2, 3: 1.4, 4: 1.62, 5: 1.85 },
  };

  const SH = AMB.SHOP;
  AMB.CONFIG = {
    version: '0.1.0',

    match: {
      heroLifePerLevel: 1,   // +1 hero life per hero level above 1 (the profile's hero level; quick vs AI and progression fights, never online/hotseat)
      heroLife: 100,            // life total of every hero
      prepSeconds: 40,          // prep timer (shop + formation) vs AI
      hotseatPrepSeconds: 45,   // prep timer per player in same-device PvP
      maxRounds: SH.rounds,     // the whole match (see AMB.SHOP.rounds). After the last round the higher hero life wins
      collapseStartRound: 99,   // unused now (the finale replaces rift collapse); kept so old tuning still loads
      collapseDamage: [3, 6, 10, 15, 21, 28, 36, 45],
      roundResultSeconds: 2.5,
      // stages: the 7 rounds are grouped; a reward draft follows every stage except the last
      stages: [
        { id: 'spark', name: 'الشرارة', rounds: [1, 2] },
        { id: 'blaze', name: 'الاشتعال', rounds: [3, 5] },
        { id: 'rift', name: 'الصدع', rounds: [6, 7] },
        { id: 'finale', name: 'الحسم', rounds: [SH.rounds, SH.rounds] },
      ],
      catchUpGap: 20,           // trailing by this much life (or more) at a reward draft => a 4th option
      catchUpExtraGold: 0,
      finaleLossMult: 1.5,
      wagerMult: 1.6,           // teen #15: when either player wagers on the finale, its loser loses this much more again      // life lost by the loser of the final round is multiplied
    },

    economy: {
      baseIncome: SH.income[0],
      income: SH.income,
      interestPer: SH.interestPer,
      interestMax: SH.interestMax,
      winBonus: SH.winBonus,
      catchUp: { gap: 10, gold: 3 },   // behind by this much life (round 3+, PvP-style modes): +gold per round
      streakBonus: [[2, 1], [4, 2]], // [minStreak, bonus] win OR loss streak
      rerollCost: SH.rerollCost,
      startLevel: SH.startLevel,       // shop level (1-5); it also sets the board size
      maxLevel: SH.levels,
      boardSize: SH.boardSize,
      upgradeCost: SH.upgradeCost, upgradeDecay: SH.upgradeDecay, upgradeMin: SH.upgradeMin,
      shopSlots: SH.shopSlots,
      itemShopSlots: 2,
      benchSize: 6,
      itemBenchSize: 6,
      sellRefund: 1.0,          // fraction of total copies' cost returned
      shopOdds: SH.odds,
      poolSize: SH.pool, // copies per card shared by both players, by the card's stars
      essenceStart: 2,
      essencePerRound: 2,
      essenceMax: 10,
      maxItemsPerUnit: 2,
      maxArmedSpells: 2,
    },

    stars: {
      // a card is upgraded ONCE: 3 copies -> 1 upgraded card (stats x mult, gold frame). The upgraded card never merges again.
      mult: { 1: 1, 2: SH.merge.mult, 3: SH.merge.mult },
      copiesPerStar: SH.merge.copies,
      copiesTo: { 2: SH.merge.copies },
      mergeChoices: SH.merge.choices,
      rewardHeldWeight: 10,        // the free-recruit reward favours units you already hold (weight per copy held)
      ownedShopWeight: 1,         // 1 = no shop bias toward owned cards (the odds table decides)
      focusMinCopies: 2,
      focusFreshOnly: true,
      maxStar: 2,
    },

    combat: {
      dt: 0.05,                 // simulation tick (seconds)
      timeCap: 30,              // seconds before the round is a draw
      furyStart: 14,            // after this, all damage ramps up (anti-stall)
      furyPerSec: 0.18,
      assaultWindow: 4,         // seconds survivors get to hit an exposed command post
      heroHpScale: 10,          // 1 hero life = 10 battlefield HP
      commandPostFortify: 0.25, // damage multiplier vs a hero NOT summoned
      postDamageCapBase: 3,     // max life a command-post hero loses to hits in one combat
      postDamageCapPerRound: 1,
      summonKnockout: 9,       // a summoned hero retreats after losing this much life in one combat
      manaPerAttack: 10,
      manaPerHit: 3,
      meleeRange: 1.15,
      moveSpeed: 1.3,
      assassinMoveSpeed: 2.2,
      assassinLeapAt: 1.5,      // assassins jump to the enemy back line at this time
      critMult: 1.5,
      skillDefFactor: 0.5,      // skills ignore half of the target's defence
      maxDef: 0.7,
    },

    damage: {
      // damage the losing hero takes at the end of a lost round (on top of
      // any direct hits received in combat)
      lossBase: 3,
      lossPerRound: 0.6,
      perSurvivor: 1,           // + per surviving enemy unit (star counts)
      survivorCap: 6,           // ...but at most this much from survivors, so late rounds do not spiral
      drawBase: 2,
    },

    hero: {
      resonancePerAlly: 0.06,   // +6% hp/atk to every ally from the hero's world
      summonAuraAtk: 0,         // global +atk to allies while the hero is summoned (0 since audit phase 2: the per-hero vanguard bonuses do this job)
      summonAbilityDiscount: 1, // abilities cost less while the hero fights
      boardAtkPerRound: 5,      // summoned hero attack scales with the round
      boardPower: 0.22,            // overall strength of the summoned hero's own fighting (tuned so summoning is a real choice, not always best)
      vanguardScale: 0.4,        // strength of each hero's summoned-form bonuses
    },

    ai: {
      // difficulty knobs used by core/ai.js
      // easy holds its level at 5 and never summons; hard levels hard, keeps a small bank only and summons from round 2
      easy: { mistakes: 0.35, rerollGreed: 0.4, levelAggro: 0.6, maxLevel: 4, noSummon: true },
      normal: { mistakes: 0.12, rerollGreed: 0.7, levelAggro: 1.0 },
      hard: { mistakes: 0.0, rerollGreed: 1.0, levelAggro: 1.6, reserveCap: 10, summonFrom: 2, summonMinLife: 40 },
      // teen #14: expert plays the strongest known plan (fast levels, early hero, its world) and adapts: it levels harder against a greedy opponent
      expert: { mistakes: 0.0, rerollGreed: 1.0, levelAggro: 2.2, reserveCap: 4, summonFrom: 2, summonMinLife: 25, adaptive: true },
    },
  };
})();

;
/* core/data.js */
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
    ember: { id: 'ember', name: 'مملكة الجمر', en: 'Emberreach', color: '#ff7a45', glyph: '🔥',
      lore: 'مملكة حدادين وساموراي، سيوفهم تشتعل من قلب بركان حي.' },
    tide: { id: 'tide', name: 'المدّ القمري', en: 'Moontide', color: '#3ec9ff', glyph: '🌊',
      lore: 'جزر يحكمها القمر، وأرواح الموج تحمي وتعالج.' },
    neon: { id: 'neon', name: 'نيون-٩', en: 'Neon-9', color: '#c45cff', glyph: '⚡',
      lore: 'مدينة إلكترونية ما تنام، والسرعة فيها هي العملة.' },
    sylvan: { id: 'sylvan', name: 'الغابة الأزلية', en: 'Elder Grove', color: '#52d67c', glyph: '🌿',
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
  const TIER_RARITY = { 1: 'common', 2: 'rare', 3: 'epic', 4: 'epic', 5: 'legendary' };
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
  unit('ash_ronin', 'سيّاف الرماد', 'Ash Ronin', 'ember', 'fighter', 1, 70,
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
  unit('chrome_ronin', 'سيّاف الكروم', 'Chrome Ronin', 'neon', 'fighter', 3, 60,
    { type: 'execute', name: 'قطع نهائي', dmg: [250, 420, 740],
      text: 'ضربتها تتضاعف على اللي صحته أقل من 40%.' });

  // ---- Elder Grove (no support)
  unit('moss_warden', 'حارس الطحلب', 'Moss Warden', 'sylvan', 'guardian', 1, 70,
    { type: 'healSelf', name: 'تجدد الطحلب', heal: [240, 400, 680],
      text: 'يرجّع جزء كبير من صحته.' });
  unit('thorn_fox', 'ثعلب الأشواك', 'Thorn Fox', 'sylvan', 'fighter', 1, 70,
    { type: 'stunStrike', name: 'وخزة شائكة', dmg: [140, 240, 410], stun: [1.3, 1.5, 1.8],
      text: 'يضرب الهدف ويوقفه لحظات.' });
  unit('root_shaman', 'شامان الجذور', 'Root Shaman', 'sylvan', 'mage', 3, 90,
    { type: 'stunAoe', name: 'قبضة الجذور', dmg: [220, 370, 650], stun: [1.2, 1.5, 2], radius: 1.6,
      text: 'جذور تمسك الأعداء في المنطقة وتضرّهم.' });
  unit('zafir', 'ظافر', 'Zafir', 'sylvan', 'marksman', 2, 80,
    { type: 'multishot', name: 'وابل الأوراق', dmg: [130, 220, 380], count: 3,
      text: 'يرمي ثلاثة سهام على أقرب ثلاثة أعداء.' });
  unit('wild_stalker', 'المتربّص البري', 'Wild Stalker', 'sylvan', 'assassin', 3, 60,
    { type: 'execute', name: 'انقضاض', dmg: [300, 520, 900],
      text: 'انقضاض يتضاعف ضرره على اللي صحته قليلة.' });


  // ======== NEW ROSTER (45 characters, unlocked from packs / battle pass; the 20 above are the starter roster)
  const LEGACY_STARTERS = U.map((u) => u.id);   // the first 20 units: owned by everyone before the gift-pack start (kept for old saves)
  // ---- new roster: Elder Grove
  unit('taiju', 'الشيخ سدر', 'Taiju', 'sylvan', 'guardian', 3, 80,
    { type: 'shieldSelf', name: 'لحاء الدهر', shield: [550, 900, 1450],
      text: 'ياخذ درع قوي.' }, { rarity: 'legendary' });
  unit('kashiwagi', 'مهنّد', 'Kashiwagi', 'sylvan', 'fighter', 3, 70,
    { type: 'cleave', name: 'ضربة السنديان', dmg: [170, 290, 490], radius: 1.4,
      text: 'ضربة تلف وتصيب الهدف واللي حوله.' });
  unit('shirayuki', 'ندى', 'Shirayuki', 'sylvan', 'mage', 3, 85,
    { type: 'stunAoe', name: 'ندى الفجر', dmg: [140, 240, 420], stun: [1.4, 1.7, 2.1], radius: 1.5,
      text: 'يجمّد الهدف واللي حوله ويضرّهم.' });
  unit('kazehaya', 'نسيم', 'Kazehaya', 'sylvan', 'marksman', 2, 80,
    { type: 'snipe', name: 'سهم الريح', dmg: [240, 410, 700],
      text: 'يصيد العدو الأضعف في أي مكان.' });
  unit('kagemaru', 'حازم', 'Kagemaru', 'sylvan', 'assassin', 1, 60,
    { type: 'nuke', name: 'طعنة الظل', dmg: [150, 260, 450],
      text: 'طعنة سريعة بضرر عالي على الهدف.' });
  unit('hayate', 'عاصف', 'Hayate', 'sylvan', 'assassin', 2, 60,
    { type: 'execute', name: 'عاصفة النصلين', dmg: [200, 350, 610],
      text: 'ضربتها تتضاعف على اللي صحته أقل من 40%.' });
  unit('yoshino', 'سكينة', 'Yoshino', 'sylvan', 'support', 2, 90,
    { type: 'hasteAllies', name: 'لحن الورقة', pct: [0.4, 0.6, 0.82], dur: 5,
      text: 'يسرّع هجوم كل الفريق لفترة قصيرة.' });
  unit('kinoko', 'ياسمين', 'Kinoko', 'sylvan', 'support', 1, 60,
    { type: 'healLowest', name: 'بوغ الشفاء', heal: [230, 380, 640],
      text: 'يعالج أضعف واحد في فريقه.' });
  unit('genzo', 'صخر', 'Genzo', 'sylvan', 'guardian', 2, 70,
    { type: 'healSelf', name: 'جذور الصمود', heal: [290, 480, 820],
      text: 'يرجّع جزء كبير من صحته.' });
  unit('takashi', 'صقر', 'Takashi', 'sylvan', 'marksman', 1, 80,
    { type: 'multishot', name: 'ضربة الصقر', dmg: [110, 180, 320], count: 3,
      text: 'يرمي ثلاثة سهام على أقرب ثلاثة أعداء.' });
  unit('gensai', 'الحكيم مرزوق', 'Gensai', 'sylvan', 'mage', 2, 90,
    { type: 'aoe', name: 'كرة العاصفة', dmg: [340, 560, 940], radius: 1.6,
      text: 'انفجار يضرب المنطقة حول الهدف.' });
  unit('ibara', 'جُوري', 'Ibara', 'sylvan', 'mage', 2, 85,
    { type: 'stunAoe', name: 'سجن الأشواك', dmg: [120, 200, 350], stun: [1.4, 1.7, 2.1], radius: 1.4,
      text: 'يجمّد الهدف واللي حوله ويضرّهم.' });
  unit('kaito', 'وليد', 'Kaito', 'sylvan', 'fighter', 2, 70,
    { type: 'stunStrike', name: 'تاج الشوك', dmg: [120, 200, 360], stun: [1, 1.2, 1.5],
      text: 'يضرب الهدف ويوقفه لحظات.' });
  unit('hisui', 'ريم', 'Hisui', 'sylvan', 'support', 3, 80,
    { type: 'healAll', name: 'ريش الزمرد', heal: [170, 290, 510],
      text: 'يعالج كل الفريق.' });
  unit('daigo', 'منصور', 'Daigo', 'sylvan', 'guardian', 1, 90,
    { type: 'taunt', name: 'درع الطحلب', shield: [200, 350, 600], radius: 2.2, dur: 3,
      text: 'يخلّي الأعداء القريبين منه يهجمون عليه هو، ويجيه درع.' });
  unit('wakaba', 'ربيع', 'Souta', 'sylvan', 'marksman', 1, 80,
    { type: 'burn', name: 'سهم السمّ الأخضر', dps: [50, 85, 145], dur: 4,
      text: 'يحرق الهدف ويضره كل ثانية لمدة 4 ثواني.' });

  // ---- new roster: Neon-9
  unit('reiji', 'جاسر', 'Reiji', 'neon', 'mage', 2, 90,
    { type: 'aoe', name: 'ختم الرموز', dmg: [280, 460, 780], radius: 1.6,
      text: 'انفجار يضرب المنطقة حول الهدف.' });
  unit('hissa', 'حصّة', 'Hissa', 'neon', 'guardian', 2, 80,
    { type: 'shieldSelf', name: 'جلد الدوائر', shield: [460, 740, 1200],
      text: 'ياخذ درع قوي.' });
  unit('nawaf', 'نواف', 'Nawaf', 'neon', 'guardian', 1, 90,
    { type: 'taunt', name: 'تحدّي الفولاذ', shield: [200, 350, 600], radius: 2.2, dur: 3,
      text: 'يخلّي الأعداء القريبين منه يهجمون عليه هو، ويجيه درع.' });
  unit('lama', 'لمى', 'Lama', 'neon', 'assassin', 1, 60,
    { type: 'nuke', name: 'نصلا البرق', dmg: [150, 260, 450],
      text: 'طعنة سريعة بضرر عالي على الهدف.' });
  unit('mitsuki', 'نور', 'Mitsuki', 'neon', 'support', 1, 60,
    { type: 'healLowest', name: 'بلّورة الشفاء', heal: [230, 380, 640],
      text: 'يعالج أضعف واحد في فريقه.' });
  unit('mugen', 'المنير', 'Mugen', 'neon', 'mage', 3, 85,
    { type: 'stunAoe', name: 'ثقب اللانهاية', dmg: [140, 240, 420], stun: [1.4, 1.7, 2.1], radius: 1.5,
      text: 'يجمّد الهدف واللي حوله ويضرّهم.' }, { rarity: 'legendary' });
  unit('juzo', 'جابر', 'Juzo', 'neon', 'fighter', 2, 60,
    { type: 'execute', name: 'ضربة الجلّاد', dmg: [200, 350, 610],
      text: 'ضربتها تتضاعف على اللي صحته أقل من 40%.' });
  unit('kogetsu', 'زيد', 'Kogetsu', 'neon', 'fighter', 3, 70,
    { type: 'cleave', name: 'قطع التاج', dmg: [170, 290, 490], radius: 1.4,
      text: 'ضربة تلف وتصيب الهدف واللي حوله.' });
  unit('yozora', 'ليلى', 'Yozora', 'neon', 'support', 3, 70,
    { type: 'healAll', name: 'مطر النجوم', heal: [215, 360, 640],
      text: 'يعالج كل الفريق.' });

  // ---- new roster: Emberreach
  unit('goka', 'سلطان', 'Goka', 'ember', 'fighter', 3, 70,
    { type: 'cleave', name: 'نار العرش', dmg: [170, 290, 490], radius: 1.4,
      text: 'ضربة تلف وتصيب الهدف واللي حوله.' }, { rarity: 'legendary' });
  unit('ryuji', 'شهاب', 'Ryuji', 'ember', 'fighter', 1, 70,
    { type: 'stunStrike', name: 'قبضة الجمر', dmg: [140, 240, 410], stun: [1.3, 1.5, 1.8],
      text: 'يضرب الهدف ويوقفه لحظات.' });
  unit('natsuki', 'شروق', 'Natsuki', 'ember', 'mage', 2, 80,
    { type: 'aoe', name: 'موجة الحمم', dmg: [280, 460, 780], radius: 1.6,
      text: 'انفجار يضرب المنطقة حول الهدف.' });
  unit('shafaq', 'شفق', 'Shafaq', 'ember', 'assassin', 2, 60,
    { type: 'nuke', name: 'نصلا اللهب', dmg: [180, 310, 540],
      text: 'طعنة سريعة بضرر عالي على الهدف.' });
  unit('shiro', 'وضّاح', 'Shiro', 'ember', 'mage', 1, 75,
    { type: 'aoe', name: 'شرارة مبتدئ', dmg: [290, 470, 800], radius: 1.5,
      text: 'انفجار يضرب المنطقة حول الهدف.' });
  unit('kurenai', 'وهّاج', 'Kurenai', 'ember', 'guardian', 3, 90,
    { type: 'taunt', name: 'قلعة القرمزي', shield: [290, 510, 870], radius: 2.4, dur: 3,
      text: 'يخلّي الأعداء القريبين منه يهجمون عليه هو، ويجيه درع.' });
  unit('tsubaki', 'عزيزة', 'Tsubaki', 'ember', 'support', 1, 60,
    { type: 'healLowest', name: 'دفء الموقد', heal: [230, 380, 640],
      text: 'يعالج أضعف واحد في فريقه.' });
  unit('godo', 'قاسم', 'Godo', 'ember', 'guardian', 2, 80,
    { type: 'shieldSelf', name: 'جلد الحمم', shield: [460, 740, 1200],
      text: 'ياخذ درع قوي.' });
  unit('yuta', 'يوسف', 'Yuta', 'ember', 'marksman', 1, 80,
    { type: 'burn', name: 'سهم الفحم', dps: [50, 85, 145], dur: 4,
      text: 'يحرق الهدف ويضره كل ثانية لمدة 4 ثواني.' });
  unit('momo', 'سامر', 'Shingo', 'ember', 'support', 2, 90,
    { type: 'hasteAllies', name: 'خطة اللهب', pct: [0.25, 0.38, 0.55], dur: 5,
      text: 'يسرّع هجوم كل الفريق لفترة قصيرة.' });

  // ---- new roster: Moontide
  unit('seiji', 'عزّام', 'Seiji', 'tide', 'fighter', 2, 70,
    { type: 'drain', name: 'نصل الجزر', dmg: [220, 360, 610],
      text: 'ضربة تسحب صحة الهدف وترجّعها له.' });
  unit('ryujin', 'الملك مرجان', 'Ryujin', 'tide', 'fighter', 3, 70,
    { type: 'cleave', name: 'رمح المدّ', dmg: [170, 290, 490], radius: 1.4,
      text: 'ضربة تلف وتصيب الهدف واللي حوله.' });
  unit('mizuki', 'مازن', 'Mizuto', 'tide', 'assassin', 1, 60,
    { type: 'nuke', name: 'شفرة الموج', dmg: [150, 260, 450],
      text: 'طعنة سريعة بضرر عالي على الهدف.' });
  unit('miyuki', 'شهد', 'Miyuki', 'tide', 'support', 2, 80,
    { type: 'healAll', name: 'ترنيمة القمر', heal: [140, 240, 420],
      text: 'يعالج كل الفريق.' });
  unit('shiori', 'لجين', 'Shiori', 'tide', 'mage', 3, 85,
    { type: 'stunAoe', name: 'فقاعة مجمّدة', dmg: [150, 250, 440], stun: [1.5, 1.8, 2.2], radius: 1.5,
      text: 'يجمّد الهدف واللي حوله ويضرّهم.' }, { rarity: 'legendary' });
  unit('tomoe', 'غدير', 'Tomoe', 'tide', 'guardian', 1, 80,
    { type: 'shieldSelf', name: 'درع اللؤلؤ', shield: [380, 620, 1000],
      text: 'ياخذ درع قوي.' });
  unit('otohime', 'حورية', 'Otohime', 'tide', 'support', 3, 70,
    { type: 'healAll', name: 'حضن البحر', heal: [170, 290, 510],
      text: 'يعالج كل الفريق.' }, { rarity: 'legendary' });
  unit('haruka', 'لؤي', 'Haruto', 'tide', 'mage', 2, 90,
    { type: 'aoe', name: 'دوّامة', dmg: [280, 460, 780], radius: 1.6,
      text: 'انفجار يضرب المنطقة حول الهدف.' });
  unit('daikai', 'عبّاد', 'Daikai', 'tide', 'guardian', 3, 90,
    { type: 'taunt', name: 'مرساة الأعماق', shield: [290, 510, 870], radius: 2.4, dur: 3,
      text: 'يخلّي الأعداء القريبين منه يهجمون عليه هو، ويجيه درع.' });
  unit('kota', 'ماجد', 'Kota', 'tide', 'marksman', 1, 80,
    { type: 'snipe', name: 'هربون الرمية', dmg: [200, 340, 580],
      text: 'يصيد العدو الأضعف في أي مكان.' });

  // ======== EVENT-EXCLUSIVE CARDS (weekly events only: never in packs, never in album sets). Art: assets/characters/<id>.jpg when added,
  // otherwise the role emblem is shown (see assets/characters/PROMPTS_EVENT.md)
  unit('hinotori', 'عنقاء', 'Hinotori', 'ember', 'assassin', 3, 60,
    { type: 'nuke', name: 'ريشة الفينيكس', dmg: [220, 380, 650], text: 'طعنة سريعة بضرر عالي على الهدف.' }, { rarity: 'legendary', exclusive: true });
  unit('mikazuki', 'هلال', 'Mikazuki', 'tide', 'marksman', 3, 80,
    { type: 'snipe', name: 'سهم الهلال', dmg: [290, 490, 840], text: 'يصيد العدو الأضعف في أي مكان.' }, { rarity: 'legendary', exclusive: true });
  unit('kaminari', 'رعد', 'Kaminari', 'neon', 'fighter', 3, 60,
    { type: 'execute', name: 'صاعقة الحسم', dmg: [250, 420, 740], text: 'ضربتها تتضاعف على اللي صحته أقل من 40%.' }, { rarity: 'legendary', exclusive: true });
  unit('kodama', 'غزال', 'Kodama', 'sylvan', 'support', 3, 80,
    { type: 'healAll', name: 'همس الأرواح', heal: [170, 290, 510], text: 'يعالج كل الفريق.' }, { rarity: 'legendary', exclusive: true });

  /*
   * Twists: cards of the same role and base skill used to play identically. Each repeated one now has its own
   * extra effect (see Combat._twist). The first card of every group keeps the plain version; the rest get a twist
   * and ~7% less base power to pay for it. Text is added to the skill description automatically.
   */
  const TWISTS = {
    daigo: 'thorns', nawaf: 'chill', kinoko: 'haste', mitsuki: 'barrier', tsubaki: 'cleanse', tomoe: 'thorns', ibara: 'sunder',
    kagemaru: 'bleed', lama: 'slow', mizuki: 'vampiric', kota: 'sunder', kaminari: 'rally', ryuji: 'bleed',
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
  // card stars (1-5): from core/shopconfig.js. `tier` == stars == gold price == the lowest shop level that sells the card; stats follow the stars.
  const SH = AMB.SHOP;
  U.forEach((u) => {
    const rank = SH.override[u.id] || SH.rankByRarity[u.rarity];
    u.tier = rank; u.cost = rank;
    const base = ROLE_BASE[u.role], m = SH.statMult[rank];
    u.hp = Math.round(base.hp * m); u.atk = Math.round(base.atk * m);
  });
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
      id: 'kagira', name: 'سراج', title: 'الجمر الهادئ', world: 'ember', style: 'هجومي: هادي ويحسبها زين، وإذا هجم ينفجر. ضغط من البداية وضرر قوي.',
      board: { atk: 85, as: 0.8, range: 1, def: 0.2, crit: 0.1 },
      vanguard: { name: 'الهجوم الكاسح', text: 'لما ينزل الساحة: الفريق +8.8% هجوم، وهو يضرب أقوى (+4% هجوم، +2.4% فرصة حرجة).', allyAtk: 0.22, heroAtk: 0.1, heroCrit: 0.06 },
      passive: { id: 'blazing_will', name: 'إرادة متقدة', text: 'لما يسقط الصف الأمامي، الفريق ياخذ +45% هجوم.' },
      abilities: [
        { id: 'inferno_banner', name: 'أمر الهجوم', cost: 3, type: 'buffAllies', atkPct: 0.42, dur: 6,
          text: '+42% هجوم لكل الفريق لمدة 6 ثواني.' },
        { id: 'meteor', name: 'نيزك الجمر', cost: 4, type: 'damageCluster', dmg: 240, scale: 25, radius: 1.6,
          text: 'نيزك ينزل على أكثر مكان فيه أعداء (240 + 25 مع كل جولة).' },
      ],
    },
    merin: {
      id: 'merin', name: 'غيث', title: 'حارس المدّ الصامت', world: 'tide', style: 'صمود: هادي ويحمي الفريق. دروع وعلاج ومعارك طويلة.',
      board: { atk: 86, as: 0.8, range: 3, def: 0.1, crit: 0.05 },
      vanguard: { name: 'درع المدّ', text: 'لما ينزل الساحة: الفريق يتجدد 0.12% من صحته كل ثانية، وهو ياخذ درع حياة وحدة ويصمد أطول بحياة قبل ما ينسحب.', allyRegen: 0.003, heroShield: 1, knockoutBonus: 1 },
      passive: { id: 'deep_reserve', name: 'مخزون عميق', text: '+2 جوهرة زيادة كل جولة.' },
      abilities: [
        { id: 'tidal_ward', name: 'حاجز المدّ', cost: 3, type: 'shieldAllies', amount: 175, scale: 25,
          text: 'درع لكل الفريق (175 + 25 مع كل جولة).' },
        { id: 'moon_spring', name: 'ينبوع القمر', cost: 4, type: 'healAllies', pct: 0.36,
          text: 'يعالج كل الفريق بنسبة 36% من صحتهم الكاملة.' },
      ],
    },
    zerokai: {
      id: 'zerokai', name: 'يزن', title: 'الظلّ المشفّر', world: 'neon', style: 'سرعة: غامض وسابق خصمه بخطوة. اقتصاد مرن وحركة سريعة.',
      board: { atk: 74, as: 0.85, range: 4, def: 0.05, crit: 0.15 },
      vanguard: { name: 'نبض السرعة', text: 'لما ينزل الساحة: الفريق +8% سرعة هجوم، وهو أسرع بـ8%، وكل قدراته تتكلف نقطة أقل.', allyAs: 0.20, heroAs: 0.2, extraDiscount: 1 },
      passive: { id: 'free_reroll', name: 'وصول خلفي', text: 'أول تحديث للمتجر في كل جولة مجاني.' },
      abilities: [
        { id: 'overclock', name: 'كسر السرعة', cost: 3, type: 'buffAllies', asPct: 0.35, dur: 5,
          text: '+35% سرعة هجوم لكل الفريق لمدة 5 ثواني.' },
        { id: 'system_crash', name: 'انهيار النظام', cost: 5, type: 'stunEnemies', dur: 1.5,
          text: 'يوقف كل الأعداء لمدة 1.5 ثانية.' },
      ],
    },
    orath: {
      id: 'orath', name: 'راشد', title: 'الحارس المحلّل', world: 'sylvan', style: 'دفاعي: هادي ويحلل، ويقرأ المعركة قبل لا تبدأ. خط أمامي قوي وسيطرة.',
      board: { atk: 75, as: 0.65, range: 1, def: 0.3, crit: 0.05 },
      vanguard: { name: 'الجدار الحي', text: 'لما ينزل الساحة: الصف الأمامي +8.8% صحة، وكل الفريق ياخذ ضرر أقل 2%، وهو أصلب (+6% دفاع).', frontHp: 0.22, allyDr: 0.05, heroDef: 0.15 },
      passive: { id: 'ancient_bark', name: 'لحاء صلب', text: 'وحدات الصف الأمامي تاخذ +6% صحة.' },
      abilities: [
        { id: 'thorn_wall', name: 'جدار الأشواك', cost: 3, type: 'frontDR', dr: 0.42, dur: 6,
          text: 'الصف الأمامي ياخذ ضرر أقل بـ 42% لمدة 6 ثواني.' },
        { id: 'rootbind', name: 'قيد الجذور', cost: 4, type: 'stunFront', dur: 2.4, dmg: 140, scale: 15,
          text: 'يوقف الصف الأمامي للعدو 2.4 ثانية ويضرّه (140 + 15 مع كل جولة).' },
      ],
    },
    rika: {
      id: 'rika', name: 'جمانة', title: 'ملكة الأتون', world: 'ember', style: 'قوة: ضربات ثقيلة وخط أمامي ناري. تحمي وتضرب بنفس الوقت.',
      board: { atk: 86, as: 0.7, range: 1, def: 0.2, crit: 0.1 },
      vanguard: { name: 'مطرقة الأتون', text: 'لما ينزل الساحة: الفريق +1.6% هجوم، والصف الأمامي +3.2% صحة، وهو أصلب (+4% دفاع) وأقوى بـ2.4%.', allyAtk: 0.04, frontHp: 0.08, heroDef: 0.1, heroAtk: 0.06 },
      passive: { id: 'forge_heart', name: 'قلب الأتون', text: 'وحدات الصف الأمامي تاخذ +4.5% هجوم.' },
      abilities: [
        { id: 'molten_hammer', name: 'مطرقة الحمم', cost: 4, type: 'damageCluster', dmg: 230, scale: 28, radius: 1.4,
          text: 'مطرقة تنزل على أكثر مكان فيه أعداء (230 + 28 مع كل جولة).' },
        { id: 'anvil_ward', name: 'حماية السندان', cost: 3, type: 'shieldAllies', amount: 150, scale: 20,
          text: 'درع لكل الفريق (150 + 20 مع كل جولة).' },
      ],
    },
    kairyu: {
      id: 'kairyu', name: 'سالم', title: 'قبطان العاصفة', world: 'tide', style: 'قيادة: قبطان هادي يوزّع الأوامر. يقوّي الفريق ويثبّت الجبهة.',
      board: { atk: 80, as: 0.75, range: 2, def: 0.15, crit: 0.08 },
      vanguard: { name: 'أمر القبطان', text: 'لما ينزل الساحة: الفريق ياخذ ضرر أقل 1.6% ويتجدد 0.16% كل ثانية، وهو ياخذ درع 2 حياة.', allyDr: 0.04, allyRegen: 0.004, heroShield: 2 },
      passive: { id: 'sea_legs', name: 'ثبات البحّار', text: 'كل وحداتك تبدأ القتال بدرع 13% من صحتها.' },
      abilities: [
        { id: 'captains_order', name: 'أمر القبطان', cost: 3, type: 'buffAllies', atkPct: 0.1, asPct: 0.2, dur: 6,
          text: '+10% هجوم و+20% سرعة هجوم لكل الفريق لمدة 6 ثواني.' },
        { id: 'rogue_wave', name: 'موجة غادرة', cost: 4, type: 'stunFront', dur: 1.5, dmg: 120, scale: 20,
          text: 'يوقف الصف الأمامي للعدو 1.5 ثانية ويضرّه (120 + 20 مع كل جولة).' },
      ],
    },
    nayako: {
      id: 'nayako', name: 'نجلاء', title: 'نجمة الشبكة', world: 'neon', style: 'إيقاع: نجمة خفيفة تغيّر مجرى المعركة بنبضة. اقتصاد وتشويش.',
      board: { atk: 72, as: 0.9, range: 4, def: 0.05, crit: 0.18 },
      vanguard: { name: 'نبضة الإيقاع', text: 'لما ينزل الساحة: الفريق +2.4% سرعة هجوم، وهو يضرب حرجة أكثر (+4%)، وقدراته أرخص بنقطة.', allyAs: 0.06, heroCrit: 0.10, extraDiscount: 1 },
      passive: { id: 'data_stream', name: 'تدفق البيانات', text: '+1 ذهب إضافي كل جولة، وكل وحداتك +2% سرعة هجوم.' },
      abilities: [
        { id: 'hologram_wall', name: 'جدار الهولوغرام', cost: 3, type: 'shieldAllies', amount: 150, scale: 25,
          text: 'درع لكل الفريق (150 + 25 مع كل جولة).' },
        { id: 'glitch_pulse', name: 'نبضة تشويش', cost: 4, type: 'stunEnemies', dur: 1.15,
          text: 'يوقف كل الأعداء لمدة 1.15 ثانية.' },
      ],
    },
    thora: {
      id: 'thora', name: 'ثريّا', title: 'ملكة الدب', world: 'sylvan', style: 'صمود: قوية وكريمة، تتحمل وترجّع. جلد الدب يحميها وفريقها.',
      board: { atk: 78, as: 0.7, range: 1, def: 0.25, crit: 0.06 },
      vanguard: { name: 'زئير الغابة', text: 'لما ينزل الساحة: الصف الأمامي +4% صحة، والفريق يتجدد 0.16% كل ثانية، وهي أصلب (+4% دفاع) وتصمد أطول بـ2 حياة.', frontHp: 0.1, allyRegen: 0.004, knockoutBonus: 2, heroDef: 0.1 },
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
    // equipment: a real piece of power for its holder (it stays on the unit and moves with it on a merge)
    rift_blade: { id: 'rift_blade', kind: 'equip', name: 'نصل الصدع', cost: 3, icon: 'sword',
      effects: [{ stat: 'atkPct', value: 0.4 }], text: '+40% هجوم.' },
    star_plate: { id: 'star_plate', kind: 'equip', name: 'درع النجم', cost: 3, icon: 'shield',
      effects: [{ stat: 'hpPct', value: 0.5 }, { stat: 'dr', value: 0.1 }], text: '+50% صحة، و10% ضرر أقل عليه.' },
    swift_charm: { id: 'swift_charm', kind: 'equip', name: 'تميمة الريح', cost: 3, icon: 'wind',
      effects: [{ stat: 'asPct', value: 0.4 }], text: '+40% سرعة هجوم.' },
    mana_prism: { id: 'mana_prism', kind: 'equip', name: 'موشور المانا', cost: 3, icon: 'orb',
      effects: [{ stat: 'startMana', value: 60 }, { stat: 'skillPower', value: 0.25 }], text: '+60 مانا من البداية، و+25% قوة للمهارة.' },
    vamp_fang: { id: 'vamp_fang', kind: 'equip', name: 'ناب الظل', cost: 3, icon: 'fang',
      effects: [{ stat: 'lifesteal', value: 0.25 }, { stat: 'atkPct', value: 0.15 }], text: 'يسرق 25% من ضرره صحة، و+15% هجوم.' },
    hawk_scope: { id: 'hawk_scope', kind: 'equip', name: 'منظار الصقر', cost: 3, icon: 'eye',
      effects: [{ stat: 'range', value: 1 }, { stat: 'crit', value: 0.25 }], text: '+1 مدى، و+25% فرصة ضربة حرجة.' },

    war_hymn: { id: 'war_hymn', kind: 'spell', name: 'ترنيمة الحرب', cost: 2, icon: 'note',
      spell: { type: 'buffAll', atkPct: 0.2 }, text: 'القتال الجاي: +20% هجوم لكل الفريق.' },
    rift_ward: { id: 'rift_ward', kind: 'spell', name: 'حاجز الصدع', cost: 2, icon: 'shield',
      spell: { type: 'shieldFront', amount: 260 }, text: 'القتال الجاي: درع 260 للصف الأمامي.' },
    dim_meteor: { id: 'dim_meteor', kind: 'spell', name: 'نيزك الأبعاد', cost: 3, icon: 'star',
      spell: { type: 'hitBack', dmg: 240, at: 3 }, text: 'القتال الجاي: بعد 3 ثواني يضرب الصف الخلفي للعدو بـ 240 ضرر.' },
    time_wind: { id: 'time_wind', kind: 'spell', name: 'ريح الزمن', cost: 2, icon: 'wind',
      spell: { type: 'hasteAll', asPct: 0.25, dur: 8 }, text: 'القتال الجاي: +25% سرعة هجوم أول 8 ثواني.' },
    // teen #11: the counter to sending the hero in early: your assassins hunt a summoned enemy hero first, and it takes more damage
    rift_net: { id: 'rift_net', kind: 'spell', name: 'شبكة الصدع', cost: 2, icon: 'eye',
      spell: { type: 'heroNet', dmgPct: 0.5 }, text: 'القتال الجاي: لو الخصم نزّل بطله الساحة، كل فريقك يقدر يضربه (والقتلة يصطادونه أول) وياخذ ضرر +50%.' },
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
    unit:     { id: 'unit', icon: 'crown', name: 'مجنّد مجاني', tiers: [2, 3, 4], text: (v, st) => `وحدة بـ${['','نجمة','نجمتين','3 نجوم','4 نجوم','5 نجوم'][v.tiers[st]]} مجانًا (من عالم بطلك غالبًا)` },
    gold:     { id: 'gold', icon: 'coin', name: 'كنز', n: [5, 6, 8], text: (v, st) => `+${v.n[st]} ذهب فورًا` },
    xp:       { id: 'xp', icon: 'star', name: 'تخفيض الترقية', n: [2, 3, 4], text: (v, st) => `ترقية المتجر القادمة أرخص بـ${v.n[st]} ذهب` },
    essence:  { id: 'essence', icon: 'essence', name: 'جوهر نقي', n: [4, 4, 5], text: (v, st) => `+${v.n[st]} جوهر لقدرات البطل` },
    item:     { id: 'item', icon: 'shield', name: 'غنيمة', text: () => 'معدتين عشوائيتين تضعها على وحداتك' },
    bless_atk:{ id: 'bless_atk', icon: 'sword', name: 'بركة الغضب', pct: [0.12, 0.15, 0.18], text: (v, st) => `الفريق كله +${Math.round(v.pct[st] * 100)}% هجوم لبقية المباراة` },
    bless_hp: { id: 'bless_hp', icon: 'heart', name: 'بركة الحجر', pct: [0.15, 0.18, 0.22], text: (v, st) => `الفريق كله +${Math.round(v.pct[st] * 100)}% صحة لبقية المباراة` },
    bless_as: { id: 'bless_as', icon: 'wind', name: 'بركة الريح', pct: [0.14, 0.17, 0.2], text: (v, st) => `الفريق كله +${Math.round(v.pct[st] * 100)}% سرعة هجوم لبقية المباراة` },
    // teen #12: the slow plan that pays: gold now locked, paid back bigger at the start of the finale (round 7)
    invest:   { id: 'invest', icon: 'coin', name: 'استثمار الصدع', n: [12, 15, 0], text: (v, st) => `+${v.n[st]} ذهب يوصلك في جولة الحسم (الجولة ${AMB.SHOP.rounds})` },
    heal:     { id: 'heal', icon: 'cross', name: 'ماء الحياة', n: [10, 12, 15], text: (v, st) => `يستعيد بطلك ${v.n[st]} حياة` },
  };
  // which rewards can appear in each stage (one "unit" is always offered)
  const REWARD_POOLS = [
    ['gold', 'xp', 'item', 'bless_hp', 'invest'],
    ['item', 'essence', 'bless_atk', 'bless_hp', 'xp', 'invest'],
    ['bless_atk', 'bless_hp', 'bless_as', 'heal', 'xp', 'essence'],
  ];

  Object.values(HEROES).forEach((h) => { h.rarity = h.rarity || 'legendary'; });
  const HERO_STARTERS = ['kagira', 'merin', 'zerokai', 'orath'];   // the four heroes a new player can pick; the rest come from packs and the battle pass
  AMB.DATA = { SLOT_ROLES, ROLE_BONUS, TRAITS, SIGS, HERO_STARTERS, LEGACY_STARTERS, STARTER_IDS, REWARDS, REWARD_POOLS, WORLDS, ROLES, ROLE_BASE, TIER_MULT, TIER_RARITY, UNITS, HEROES, ITEMS, SYNERGIES, ABILITY_TRIGGERS };
})();

;
/* core/util.js */
(function () {
  const AMB = (globalThis.AMB = globalThis.AMB || {});

  // Seeded RNG (mulberry32): same seed => same shops and same combat.
  function RNG(seed) {
    let a = seed >>> 0 || 1;
    const next = () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    return {
      next,
      int: (n) => Math.floor(next() * n),
      pick: (arr) => arr[Math.floor(next() * arr.length)],
      chance: (p) => next() < p,
      weighted(entries) { // [[value, weight], ...]
        const total = entries.reduce((s, e) => s + e[1], 0);
        if (total <= 0) return null;
        let r = next() * total;
        for (const [v, w] of entries) { if ((r -= w) < 0) return v; }
        return entries[entries.length - 1][0];
      },
      fork: () => RNG(Math.floor(next() * 2 ** 31)),
    };
  }

  let uidCounter = 1;
  const uid = (p) => (p || 'u') + (uidCounter++).toString(36);

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const dist = (a, b) => Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y));

  AMB.util = { RNG, uid, clamp, dist };
})();

;
/* core/synergy.js */
/*
 * Synergy evaluation. Pure function of (board units, hero) so the UI, the AI
 * and the combat engine all agree on what is active.
 */
(function () {
  const AMB = (globalThis.AMB = globalThis.AMB || {});

  function evaluate(unitInstances, heroId) {
    const { UNITS, SYNERGIES, HEROES } = AMB.DATA;
    const unique = {}; // defId -> def
    unitInstances.forEach((u) => (unique[u.defId] = UNITS[u.defId]));
    const defs = Object.values(unique);

    const counts = {};
    defs.forEach((d) => {
      counts[d.world] = (counts[d.world] || 0) + 1;
      counts[d.role] = (counts[d.role] || 0) + 1;
    });
    const worldsPresent = new Set(defs.map((d) => d.world)).size;

    const list = [];
    Object.values(SYNERGIES).forEach((s) => {
      const count = s.countBy === 'worlds' ? worldsPresent : counts[s.id] || 0;
      if (!count) return;
      let active = -1;
      s.tiers.forEach((t, i) => { if (count >= t.n) active = i; });
      const next = s.tiers.find((t) => t.n > count);
      list.push({
        id: s.id, kind: s.kind, name: s.name, count, activeTier: active,
        tiers: s.tiers, nextN: next ? next.n : null,
        effects: active >= 0 ? s.tiers[active].effects : [],
        text: active >= 0 ? s.tiers[active].text : (s.tiers[0].text),
      });
    });
    list.sort((a, b) => (b.activeTier >= 0) - (a.activeTier >= 0) || b.count - a.count);

    const hero = heroId ? HEROES[heroId] : null;
    const resonance = hero ? defs.filter((d) => d.world === hero.world).length : 0;

    return { list, resonance, heroWorld: hero ? hero.world : null };
  }

  // Does a synergy effect apply to a given unit def + board row?
  function appliesTo(syn, eff, def, row) {
    switch (eff.scope) {
      case 'all': return true;
      case 'front': return row === 'front';
      case 'back': return row === 'back';
      case 'members':
        return syn.kind === 'world' ? def.world === syn.id : syn.kind === 'role' ? def.role === syn.id : true;
      default: return false;
    }
  }

  AMB.synergy = { evaluate, appliesTo };
})();

;
/* core/combat.js */
/*
 * Deterministic auto-combat simulation.
 *
 * Battlefield coordinates (side 0 is drawn at the bottom):
 *   y = -1  side-0 command post (hero when NOT summoned)
 *   y =  0  side-0 back row        y = 1  side-0 front row
 *   y =  3  side-1 front row       y = 4  side-1 back row
 *   y =  5  side-1 command post
 *   x = column 0..3 (side 1 is mirrored so both players see "their" left)
 *
 * Hero protection rule: a hero can only be targeted when its side has no
 * living non-hero unit deployed in the FRONT row ("defence line"), or when a
 * summoned hero stands in the front row itself. Area skills that splash onto
 * a summoned hero still hurt it (that is the risk of summoning).
 */
(function () {
  const AMB = (globalThis.AMB = globalThis.AMB || {});
  const { dist, clamp } = AMB.util;

  const EMPTY_MODS = () => ({ atkPct: 0, hpPct: 0, asPct: 0, dr: 0, lifesteal: 0, crit: 0, critDmg: 0,
    skillPower: 0, startMana: 0, range: 0, startShieldPct: 0, regenPct: 0 });

  function slotPos(side, slot) {
    const row = slot[0] === 'f' ? 'front' : 'back';
    const col = +slot[1];
    if (side === 0) return { row, x: col, y: row === 'front' ? 1 : 0 };
    return { row, x: 3 - col, y: row === 'front' ? 3 : 4 };
  }
  const postPos = (side) => ({ x: 1.5, y: side === 0 ? -1 : 5 });

  class Combat {
    /**
     * @param specs [sideSpec, sideSpec] — see Match.buildCombatSpec
     * @param opts { seed, round, record }
     */
    constructor(specs, opts) {
      this.C = AMB.CONFIG.combat;
      this.round = opts.round || 1;
      this.rng = AMB.util.RNG(opts.seed || 1);
      this.record = opts.record !== false;
      this.t = 0;
      this.events = [];
      this.fighters = [];
      this.sides = [0, 1].map((s) => ({
        spec: specs[s], deaths: 0, exposed: false, exposedAt: null, frontDown: false, frontDownAt: null, abilities: [], spellsTimed: [],
        hero: null, synergy: null, blazing: false,
      }));
      this.assault = null;
      this.over = false;
      this.result = null;
      this.nextId = 1;
      specs.forEach((spec, s) => this._setupSide(s, spec));
      this._updateExposure(true);
    }

    emit(e) { if (this.record) { e.t = this.t; this.events.push(e); } }
    drainEvents() { const e = this.events; this.events = []; return e; }

    _setupSide(s, spec) {
      const { UNITS, HEROES, ITEMS, SYNERGIES } = AMB.DATA;
      const HC = AMB.CONFIG.hero;
      const side = this.sides[s];
      const hero = HEROES[spec.heroId];
      // hero level (progression fights): stronger summoned body, stronger summoned form, stronger abilities
      const HL = Math.max(1, spec.heroLevel || 1) - 1;
      const lvAtk = 1 + 0.05 * HL, lvVan = 1 + 0.03 * HL, lvAb = 1 + 0.03 * HL;
      side.abilityPower = lvAb;
      const VS = (HC.vanguardScale == null ? 1 : HC.vanguardScale) * lvVan;
      const vg = (k) => (((hero.vanguard || {})[k]) || 0) * VS;
      const syn = AMB.synergy.evaluate(spec.units, spec.heroId);
      side.synergy = syn;
      const spells = (spec.spells || []).map((id) => ITEMS[id].spell);
      // world rules: an active world synergy also gives its members a signature mechanic (ignite / tide shield / jam / grow)
      side.rules = {};
      syn.list.forEach((sy) => { if (sy.kind === 'world' && sy.activeTier >= 0 && sy.tiers[sy.activeTier].rule) side.rules[sy.id] = sy.tiers[sy.activeTier].rule; });

      // --- units
      spec.units.forEach((u) => {
        const def = UNITS[u.defId];
        const pos = slotPos(s, u.slot);
        const mods = EMPTY_MODS();
        syn.list.forEach((sy) => sy.effects.forEach((eff) => {
          if (AMB.synergy.appliesTo(SYNERGIES[sy.id], eff, def, pos.row)) mods[eff.stat] += eff.value;
        }));
        (u.items || []).forEach((it) => ITEMS[it].effects.forEach((eff) => (mods[eff.stat] += eff.value)));
        const slotRoles = AMB.DATA.SLOT_ROLES[u.slot], rb = AMB.DATA.ROLE_BONUS[def.role], inPlace = !!(slotRoles && rb && slotRoles.includes(def.role));   // standing in its own role's slot
        if (inPlace) Object.keys(rb.mods).forEach((k) => (mods[k] += rb.mods[k]));
        (def.traits || []).forEach((id) => { const tr = AMB.DATA.TRAITS[id]; if (tr) Object.keys(tr.mods).forEach((k) => (mods[k] += tr.mods[k])); });   // rarity traits (rare 1, epic/legendary 2)
        if (def.world === hero.world) { mods.atkPct += HC.resonancePerAlly; mods.hpPct += HC.resonancePerAlly; }
        if (hero.passive.id === 'ancient_bark' && pos.row === 'front') mods.hpPct += 0.06;
        if (hero.passive.id === 'forge_heart' && pos.row === 'front') mods.atkPct += 0.045;
        if (hero.passive.id === 'sea_legs') mods.startShieldPct += 0.13;
        if (hero.passive.id === 'bear_hide') mods.hpPct += 0.12;
        if (hero.passive.id === 'data_stream') mods.asPct += 0.02;
        if (spec.summoned) {   // each hero leads differently once it stands on the board
          mods.atkPct += HC.summonAuraAtk + vg('allyAtk'); mods.asPct += vg('allyAs'); mods.dr += vg('allyDr'); mods.regenPct += vg('allyRegen');
          if (pos.row === 'front') mods.hpPct += vg('frontHp');
        }
        spells.forEach((sp) => { if (sp.type === 'buffAll') mods.atkPct += sp.atkPct; });
        const bl = spec.blessings || {};
        mods.atkPct += bl.atkPct || 0; mods.hpPct += bl.hpPct || 0; mods.asPct += bl.asPct || 0;   // stage-reward blessings

        const sm = AMB.CONFIG.stars.mult[u.star] * (u.power || 1);   // power: card level × rarity (progression fights only, else 1)
        const maxHp = def.hp * sm * (1 + mods.hpPct);
        const f = this._fighter(s, {
          uid: u.uid, defId: def.id, name: def.name, role: def.role, world: def.world, star: u.star,
          isHero: false, onBoard: true, slot: u.slot, row: pos.row, x: pos.x, y: pos.y,
          maxHp, hp: maxHp, atk: def.atk * sm * (1 + mods.atkPct), as: def.as * (1 + mods.asPct),
          range: def.range + mods.range, def: def.def + mods.dr, crit: def.crit + mods.crit,
          critDmg: this.C.critMult + mods.critDmg, lifesteal: mods.lifesteal, skillPower: 1 + mods.skillPower,
          regenPct: mods.regenPct, mana: mods.startMana, maxMana: def.mana, skill: def.skill, sig: def.sig || null, inPlace,
        });
        if (mods.startShieldPct) f.shield += maxHp * mods.startShieldPct;
        if (side.rules[def.world]) { f.wrule = side.rules[def.world]; f.atk0 = f.atk; f.maxHp0 = maxHp; f.growN = 0; f._gn = f.wrule.every || 0; }
      });

      // --- hero (summoned onto the board, or waiting at the command post)
      const scale = this.C.heroHpScale;
      const hMods = EMPTY_MODS();
      syn.list.forEach((sy) => sy.effects.forEach((eff) => { if (eff.scope === 'all') hMods[eff.stat] += eff.value; }));
      spells.forEach((sp) => { if (sp.type === 'buffAll') hMods.atkPct += sp.atkPct; });
      hMods.atkPct += (spec.blessings || {}).atkPct || 0; hMods.asPct += (spec.blessings || {}).asPct || 0;
      const hp = spec.life * scale;
      const base = { uid: 'hero' + s, defId: hero.id, name: hero.name, role: 'hero', world: hero.world, star: 0,
        isHero: true, maxHp: spec.maxLife * scale, hp, maxMana: Infinity, mana: 0, skill: null };
      let hf;
      if (spec.summoned) {
        const pos = slotPos(s, spec.heroSlot);
        hf = this._fighter(s, Object.assign(base, {
          onBoard: true, slot: spec.heroSlot, row: pos.row, x: pos.x, y: pos.y,
          atk: (hero.board.atk + HC.boardAtkPerRound * this.round) * (1 + hMods.atkPct + vg('heroAtk')) * (HC.boardPower == null ? 1 : HC.boardPower) * (spec.heroPower || 1) * lvAtk,
          as: hero.board.as * (1 + hMods.asPct + vg('heroAs')), range: hero.board.range, def: hero.board.def + hMods.dr + vg('heroDef'),
          crit: hero.board.crit + vg('heroCrit'), critDmg: this.C.critMult, lifesteal: 0, skillPower: 1, regenPct: hMods.regenPct,
        }));
      } else {
        const pos = postPos(s);
        hf = this._fighter(s, Object.assign(base, {
          onBoard: false, passive: true, row: 'post', x: pos.x, y: pos.y,
          atk: 0, as: 0, range: 0, def: 0, crit: 0, critDmg: 1, lifesteal: 0, skillPower: 1, regenPct: 0,
        }));
      }
      side.hero = hf;
      hf.startHp = hp;   // healing/regen can undo damage taken in THIS combat, but never raise a hero above the life it started with
      if (spec.summoned) {
        hf.floorHp = Math.max(0, hp - (this.C.summonKnockout + vg('knockoutBonus')) * scale);
        if (vg('heroShield')) hf.shield += vg('heroShield') * scale;
      } else {
        const cap = this.C.postDamageCapBase + this.C.postDamageCapPerRound * this.round;
        hf.floorHp = Math.max(0, hp - cap * scale);
      }

      // --- armed hero abilities & spells
      (spec.abilities || []).forEach((a) => {
        const def = hero.abilities.find((x) => x.id === a.id);
        if (def) side.abilities.push({ def, trigger: a.trigger, fired: false });
      });
      spells.forEach((sp, i) => {
        const id = spec.spells[i];
        if (sp.type === 'shieldFront') side.spellsTimed.push({ id, sp, at: 0, fired: false });
        if (sp.type === 'hitBack') side.spellsTimed.push({ id, sp, at: sp.at, fired: false });
        if (sp.type === 'hasteAll') side.spellsTimed.push({ id, sp, at: 0, fired: false });
        if (sp.type === 'heroNet') side.heroNet = Math.max(side.heroNet || 0, sp.dmgPct);   // rift net: hunt a summoned enemy hero
      });
    }

    _fighter(side, props) {
      const f = Object.assign({
        id: this.nextId++, side, alive: true, shield: 0, buffs: [], dots: [], stun: 0,
        target: null, tauntBy: null, tauntUntil: 0, atkCd: 0.2 + this.rng.next() * 0.3,
        dmgDealt: 0, healDone: 0, leaped: false, passive: false,
      }, props);
      f.moveSpeed = f.role === 'assassin' ? this.C.assassinMoveSpeed : this.C.moveSpeed;
      this.fighters.push(f);
      return f;
    }

    // ---------------------------------------------------------------- helpers
    enemiesOf(f) { return this.fighters.filter((e) => e.side !== f.side && e.alive); }
    alliesOf(f) { return this.fighters.filter((e) => e.side === f.side && e.alive && !e.passive); }
    sideFighters(s) { return this.fighters.filter((e) => e.side === s && e.alive && !e.passive); }

    buffSum(f, key) {
      let v = 0;
      for (const b of f.buffs) if (b[key]) v += b[key];
      return v;
    }

    targetable(e) {
      if (!e.alive) return false;
      if (!e.isHero) return true;
      if (e.sealed) return false;
      if (e.onBoard && this.sides[1 - e.side].heroNet) return true;   // rift net: a summoned hero can be hit by the whole enemy team
      return this.sides[e.side].exposed;   // the hero is hit last, even when it fights on the board: only after every other unit of its side is dead
    }

    // The hero is protected by EVERY living unit of its side: it can only be hit once the whole field is dead (or when it stands in the front row itself).
    // `frontDown` (the front row fell) is separate: it drives the "defence line fell" banner, the "when exposed" abilities and Kagira's blazing will.
    _updateExposure(initial) {
      [0, 1].forEach((s) => {
        const side = this.sides[s];
        // the front line = living front-row units (a summoned hero standing in front counts; an assassin that leaped to the enemy back line no longer does)
        const front = this.fighters.some((f) => f.side === s && f.alive && (!f.isHero || f.onBoard) && f.row === 'front' && !f.leaped);
        if (!front && !side.frontDown) {
          side.frontDown = true;
          side.frontDownAt = this.t;
          this.emit({ type: 'exposed', side: s });
          if (this.sides[s].spec && AMB.DATA.HEROES[this.sides[s].spec.heroId].passive.id === 'blazing_will' && !side.blazing) {
            side.blazing = true;
            this.sideFighters(s).forEach((a) => a.buffs.push({ atkPct: 0.45, until: Infinity }));
            this.emit({ type: 'heroAbility', side: s, name: 'إرادة متقدة' });
          }
        }
        if (!side.exposed && !this.fighters.some((f) => f.side === s && f.alive && !f.isHero)) {
          side.exposed = true;
          side.exposedAt = this.t;
          this.emit({ type: 'heroExposed', side: s });
        }
      });
    }

    effAtk(f) { return f.atk * (1 + this.buffSum(f, 'atkPct')); }
    effAs(f) { return f.as * (1 + this.buffSum(f, 'asPct')) * (f.jam && f.jam.until > this.t ? 1 - f.jam.pct : 1); }   // neon rule: a jammed unit attacks slower
    effDef(f) { return clamp(f.def + this.buffSum(f, 'dr'), 0, this.C.maxDef); }
    fury() { return this.t > this.C.furyStart ? 1 + this.C.furyPerSec * (this.t - this.C.furyStart) : 1; }

    findTarget(f) {
      let enemies = this.enemiesOf(f).filter((e) => this.targetable(e));
      if (!enemies.length) return null;
      // hit order: shields soak first (see damage()), then the front line, then the back line, and the hero last (even when it stands on the board)
      const live = enemies.filter((e) => !e.isHero);
      if (live.length) { const fr = live.filter((e) => e.row === 'front'); enemies = fr.length && f.role !== 'assassin' ? fr : live; }
      if (f.tauntBy && f.tauntUntil > this.t) {
        const tb = this.fighters.find((x) => x.id === f.tauntBy);
        if (tb && tb.alive) return tb;
      }
      if (f.role === 'assassin') {
        if (this.sides[f.side].heroNet) {   // rift net: a summoned enemy hero is hunted first, even while its side still stands
          const hh = this.enemiesOf(f).find((e) => e.isHero && e.onBoard && e.alive && !e.sealed);
          if (hh) return hh;
        }
        if (enemies.length === 1 && enemies[0].isHero) return enemies[0];
        if (this.sides[f.side].spec && this.sides[f.side].spec.hunt === 'weak') {   // teen #13: hunt the weakest enemy instead of the back line
          enemies.sort((a, b) => a.hp - b.hp || a.id - b.id); return enemies[0];
        }
        // back line first: farthest from own side
        const dir = f.side === 0 ? 1 : -1;
        enemies.sort((a, b) => (b.y - a.y) * dir || dist(f, a) - dist(f, b) || a.id - b.id);
        return enemies[0];
      }
      let best = null, bd = Infinity;
      for (const e of enemies) {
        const d = dist(f, e) + (e.isHero && !e.onBoard ? 0.5 : 0); // tiny bias: units before the post
        if (d < bd - 1e-6 || (Math.abs(d - bd) < 1e-6 && e.id < best.id)) { best = e; bd = d; }
      }
      return best;
    }

    // ---------------------------------------------------------------- damage
    damage(src, tgt, raw, opts) {
      if (!tgt.alive || raw <= 0) return 0;
      opts = opts || {};
      let def = this.effDef(tgt);
      if (opts.skill) def *= this.C.skillDefFactor;
      let dmg = raw * (1 - def) * this.fury();
      if (tgt.isHero && !tgt.onBoard) dmg *= this.C.commandPostFortify;
      if (tgt.isHero && tgt.onBoard && this.sides[1 - tgt.side].heroNet) dmg *= 1 + this.sides[1 - tgt.side].heroNet;   // rift net
      // legendary 'lifeline' (Otohime): once per fight the first ally that would die survives with 30% health
      if (!tgt.isHero && tgt.hp - Math.max(0, dmg - (tgt.shield || 0)) <= 0) {
        const ll = this.fighters.find((a) => a.side === tgt.side && a.alive && a.sig === 'lifeline' && !a._ll);
        if (ll) { ll._ll = true; tgt.shield = 0; tgt.hp = Math.max(1, tgt.maxHp * 0.2); this.emit({ type: 'heroAbility', side: tgt.side, name: 'حبل النجاة' }); return 0; }
      }
      if (tgt.shield > 0) {
        const absorbed = Math.min(tgt.shield, dmg);
        tgt.shield -= absorbed;
        dmg -= absorbed;
      }
      if (tgt.isHero && tgt.floorHp > 0 && tgt.hp - dmg <= tgt.floorHp) {
        dmg = Math.max(0, tgt.hp - tgt.floorHp);
        tgt.hp = tgt.floorHp;
        if (src) src.dmgDealt += dmg;
        if (dmg > 0) this.emit({ type: 'damage', id: tgt.id, amount: Math.round(dmg), crit: !!opts.crit, skill: !!opts.skill });
        this._heroFloor(tgt);
        return dmg;
      }
      tgt.hp -= dmg;
      if (src && src !== tgt && tgt.sig === 'reflect' && !opts.thorn && dmg > 0) this.damage(null, src, dmg * 0.15, { thorn: true, skill: true });   // legendary 'reflect' (Taiju)
      if (src && src !== tgt && tgt.thorns && tgt.thorns.until > this.t && !opts.dot && !opts.thorn) this.damage(null, src, dmg * tgt.thorns.pct, { thorn: true, skill: true });   // "thorns" twist: a share of the hit goes back
      if (src) {
        src.dmgDealt += dmg;
        if (src.lifesteal && !opts.dot) this.heal(src, dmg * src.lifesteal, true);
      }
      if (!opts.dot && !opts.thorn && !tgt.passive) tgt.mana = Math.min(tgt.maxMana, tgt.mana + this.C.manaPerHit);
      this.emit({ type: 'damage', id: tgt.id, amount: Math.round(dmg), crit: !!opts.crit, skill: !!opts.skill });
      if (tgt.hp <= 0) this.kill(tgt, src);
      return dmg;
    }

    heal(f, amount, quiet) {
      if (!f.alive || amount <= 0) return;
      const before = f.hp;
      f.hp = Math.min(f.isHero && f.startHp != null ? f.startHp : f.maxHp, f.hp + amount);
      const done = f.hp - before;
      if (done > 0.5 && !quiet) this.emit({ type: 'heal', id: f.id, amount: Math.round(done) });
    }

    // A hero hit its per-combat floor: a summoned hero retreats to the command
    // post (knockout), a command-post hero is "sealed" for the rest of combat.
    _heroFloor(h) {
      if (h.onBoard) {
        h.onBoard = false; h.passive = true; h.row = 'post';
        Object.assign(h, postPos(h.side));
        h.target = null; h.buffs = []; h.dots = []; h.stun = 0;
        this.emit({ type: 'retreat', id: h.id, side: h.side });
        this.fighters.forEach((f) => { if (f.target === h) f.target = null; });
      } else if (!h.sealed) {
        h.sealed = true;
        this.emit({ type: 'sealed', id: h.id, side: h.side });
      }
    }

    kill(f, src) {
      f.alive = false;
      f.hp = 0;
      this.sides[f.side].deaths += f.isHero ? 0 : 1;
      if (!f.isHero) this.fighters.forEach((a) => {   // tide rule: when an ally falls, the living tide units get a shield
        if (a.alive && a.side === f.side && a.wrule && a.wrule.type === 'tideShield') { a.shield += a.maxHp * a.wrule.pct; this.emit({ type: 'status', id: a.id, text: 'درع المدّ' }); }
      });
      if (src && src.alive && !src.isHero) {   // legendary kill triggers
        if (src.sig === 'bloodrush' && (src._br || 0) < 3) { src._br = (src._br || 0) + 1; src.buffs.push({ asPct: 0.2, until: Infinity }); }
        if (src.sig === 'reaper' && src.skill) src.mana = src.maxMana;
      }
      this.emit({ type: 'death', id: f.id, hero: f.isHero });
      this._updateExposure();
    }

    // ---------------------------------------------------------------- skills
    cast(f) {
      const sk = f.skill;
      const s = Math.max(0, f.star - 1);
      const p = f.skillPower;
      const tgt = f.target && f.target.alive ? f.target : this.findTarget(f);
      const needsTarget = ['nuke', 'cleave', 'aoe', 'stunAoe', 'stunStrike', 'burn', 'drain', 'execute'].includes(sk.type);
      if (needsTarget && !tgt) return false;
      f.mana = f.sig === 'echo' ? Math.floor(f.maxMana * 0.5) : 0;   // legendary 'echo': half the mana comes back
      this.emit({ type: 'cast', id: f.id, name: sk.name });
      // splash spreads sideways along the target's row (it no longer drags the squishy back row down with the front line)
      const enemiesNear = (c, r) => this.enemiesOf(f).filter((e) => this.targetable(e) && dist(e, c) <= r && (e === c || Math.abs(e.y - c.y) < 0.6));
      switch (sk.type) {
        case 'nuke': this.damage(f, tgt, sk.dmg[s] * p, { skill: true }); break;
        case 'cleave':
        case 'aoe': enemiesNear(tgt, sk.radius).forEach((e) => this.damage(f, e, sk.dmg[s] * p, { skill: true })); break;
        case 'stunAoe': enemiesNear(tgt, sk.radius).forEach((e) => { this.damage(f, e, sk.dmg[s] * p, { skill: true }); this.stun(e, sk.stun[s]); }); break;
        case 'stunStrike': this.damage(f, tgt, sk.dmg[s] * p, { skill: true }); this.stun(tgt, sk.stun[s]); break;
        case 'burn': tgt.dots.push({ dps: sk.dps[s] * p, until: this.t + sk.dur, src: f.id }); break;
        case 'drain': { const d = this.damage(f, tgt, sk.dmg[s] * p, { skill: true }); this.heal(f, d); break; }
        case 'execute': {
          const low = tgt.hp / tgt.maxHp < 0.4;
          this.damage(f, tgt, sk.dmg[s] * p * (low ? 2 : 1), { skill: true, crit: low });
          break;
        }
        case 'snipe': {
          const list = this.enemiesOf(f).filter((e) => this.targetable(e));
          if (!list.length) break;
          list.sort((a, b) => a.hp - b.hp || a.id - b.id);
          this.emit({ type: 'attack', from: f.id, to: list[0].id, ranged: true });
          this.damage(f, list[0], sk.dmg[s] * p, { skill: true });
          break;
        }
        case 'multishot': {
          const list = this.enemiesOf(f).filter((e) => this.targetable(e)).sort((a, b) => dist(f, a) - dist(f, b) || a.id - b.id).slice(0, sk.count);
          list.forEach((e) => { this.emit({ type: 'attack', from: f.id, to: e.id, ranged: true }); this.damage(f, e, sk.dmg[s] * p, { skill: true }); });
          break;
        }
        case 'taunt':
          this.enemiesOf(f).forEach((e) => { if (!e.passive && dist(e, f) <= sk.radius) { e.tauntBy = f.id; e.tauntUntil = this.t + sk.dur; e.target = f; } });
          f.shield += sk.shield[s] * p;
          break;
        case 'shieldSelf': f.shield += sk.shield[s] * p; break;
        case 'healSelf': this.heal(f, sk.heal[s] * p); break;
        case 'healLowest': {
          const list = this.alliesOf(f).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp || a.id - b.id);
          if (list.length) this.heal(list[0], sk.heal[s] * p);
          break;
        }
        case 'healAll': this.alliesOf(f).forEach((a) => this.heal(a, sk.heal[s] * p)); break;
        case 'hasteAllies': this.alliesOf(f).forEach((a) => a.buffs.push({ asPct: sk.pct[s], until: this.t + sk.dur })); break;
      }
      if (sk.extra) this._twist(f, sk, tgt, s, p);
      return true;
    }

    // A card's own twist on top of its basic skill (units of the same role no longer play the same):
    // bleed / sunder / slow / vampiric / rally / ward / charge · barrier / haste / cleanse / bolster · thorns / wall / chill / mend / bash
    _twist(f, sk, tgt, s, p) {
      const t = this.t, base = ((sk.dmg || sk.heal || sk.shield || sk.dps || [240, 400, 680])[s]) * p;
      const allies = () => this.alliesOf(f), lowest = () => this.alliesOf(f).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp || a.id - b.id)[0];
      switch (sk.extra) {
        case 'bleed': if (tgt && tgt.alive) tgt.dots.push({ dps: base * 0.12, until: t + 4, src: f.id }); break;
        case 'sunder': if (tgt && tgt.alive) tgt.buffs.push({ dr: -0.2, until: t + 5 }); break;
        case 'slow': if (tgt && tgt.alive) tgt.buffs.push({ asPct: -0.3, until: t + 4 }); break;
        case 'vampiric': this.heal(f, base * 0.5); break;
        case 'rally': f.buffs.push({ asPct: 0.3, until: t + 4 }); break;
        case 'ward': f.shield += base * 0.6; break;
        case 'charge': allies().filter((a) => a !== f && !a.passive).sort((a, b) => dist(f, a) - dist(f, b)).slice(0, 2).forEach((a) => { a.mana = Math.min(a.maxMana, a.mana + 25); }); break;
        case 'barrier': if (sk.type === 'healAll') allies().forEach((a) => { a.shield += base * 0.3; }); else { const l = lowest(); if (l) l.shield += base * 0.5; } break;
        case 'haste': { const l = lowest(); if (l) l.buffs.push({ asPct: 0.2, until: t + 4 }); break; }
        case 'cleanse': if (sk.type === 'healAll') allies().forEach((a) => { a.stun = 0; }); else { const l = lowest(); if (l) l.stun = 0; } break;
        case 'bolster': allies().forEach((a) => a.buffs.push({ dr: 0.12, until: t + 4 })); break;
        case 'thorns': f.thorns = { pct: 0.25, until: t + 4 }; break;
        case 'wall': f.buffs.push({ dr: 0.3, until: t + 4 }); break;
        case 'chill': this.enemiesOf(f).forEach((e) => { if (!e.passive && dist(e, f) <= 2.2) e.buffs.push({ asPct: -0.25, until: t + 4 }); }); break;
        case 'mend': this.heal(f, base * 0.4); break;
        case 'bash': { const e = this.enemiesOf(f).filter((x) => this.targetable(x)).sort((a, b) => dist(f, a) - dist(f, b) || a.id - b.id)[0]; if (e) this.stun(e, 0.8); break; }
        default: break;
      }
    }

    // world rules that ride on a basic attack: ember ignites the target, neon jams (slows) its attacks
    _worldHit(f, tgt) {
      const r = f.wrule;
      if (r.type === 'ignite') {
        if (!tgt.ignite || tgt.ignite.until <= this.t) this.emit({ type: 'status', id: tgt.id, text: 'حرق' });
        tgt.ignite = { dps: this.effAtk(f) * r.pct, until: this.t + r.dur, src: f.id };
      } else if (r.type === 'jam') {
        if (!tgt.jam || tgt.jam.until <= this.t) this.emit({ type: 'status', id: tgt.id, text: 'بطء' });
        tgt.jam = { pct: r.pct, until: this.t + r.dur };
      }
    }

    stun(f, dur) { if (f.alive && !f.passive) { f.stun = Math.max(f.stun, dur); this.emit({ type: 'stun', id: f.id }); } }

    // ---------------------------------------------------------------- hero abilities / spells
    _fireAbility(s, ab) {
      ab.fired = true;
      const a = ab.def;
      const allies = this.sideFighters(s);
      const enemies = this.sideFighters(1 - s);
      const P = this.sides[s].abilityPower || 1;   // hero level
      const heroCap = (f) => (f.isHero ? Math.min(f.maxHp, 500) : f.maxHp);
      this.emit({ type: 'heroAbility', side: s, name: a.name });
      switch (a.type) {
        case 'buffAllies': allies.forEach((f) => f.buffs.push({ atkPct: (a.atkPct || 0) * P, asPct: (a.asPct || 0) * P, until: this.t + a.dur })); break;
        case 'shieldAllies': allies.forEach((f) => (f.shield += (a.amount + a.scale * this.round) * P)); break;
        case 'healAllies': allies.forEach((f) => this.heal(f, heroCap(f) * a.pct * P)); break;
        case 'stunEnemies': enemies.forEach((f) => this.stun(f, a.dur)); break;
        case 'frontDR': allies.filter((f) => f.row === 'front').forEach((f) => f.buffs.push({ dr: Math.min(0.6, a.dr * P), until: this.t + a.dur })); break;
        case 'stunFront': enemies.filter((f) => f.row === 'front').forEach((f) => { this.stun(f, a.dur); this.damage(null, f, (a.dmg + a.scale * this.round) * P, { skill: true }); }); break;
        case 'damageCluster': {
          if (!enemies.length) break;
          let best = enemies[0], bn = -1;
          enemies.forEach((e) => { const n = enemies.filter((o) => dist(o, e) <= a.radius).length; if (n > bn) { bn = n; best = e; } });
          this.emit({ type: 'blast', x: best.x, y: best.y, r: a.radius });
          enemies.filter((o) => dist(o, best) <= a.radius).forEach((o) => this.damage(null, o, (a.dmg + a.scale * this.round) * P, { skill: true }));
          break;
        }
      }
    }

    _fireSpell(s, st) {
      st.fired = true;
      const sp = st.sp;
      const name = AMB.DATA.ITEMS[st.id].name;
      this.emit({ type: 'spell', side: s, name });
      if (sp.type === 'shieldFront') this.sideFighters(s).filter((f) => f.row === 'front').forEach((f) => (f.shield += sp.amount));
      if (sp.type === 'hasteAll') this.sideFighters(s).forEach((f) => f.buffs.push({ asPct: sp.asPct, until: this.t + sp.dur }));
      if (sp.type === 'hitBack') {
        const targets = this.sideFighters(1 - s).filter((f) => f.row === 'back');
        targets.forEach((f) => this.damage(null, f, sp.dmg, { skill: true }));
        if (targets.length) this.emit({ type: 'blast', x: 1.5, y: s === 0 ? 4 : 0, r: 2 });
      }
    }

    _triggers() {
      [0, 1].forEach((s) => {
        const side = this.sides[s];
        side.abilities.forEach((ab) => {
          if (ab.fired) return;
          const tr = ab.trigger;
          if ((tr === 'start') || (tr === 't5' && this.t >= 5) ||
              (tr === 'firstDeath' && side.deaths >= 1) || (tr === 'exposed' && side.frontDown)) this._fireAbility(s, ab);
        });
        side.spellsTimed.forEach((st) => { if (!st.fired && this.t >= st.at) this._fireSpell(s, st); });
      });
    }

    // ---------------------------------------------------------------- main loop
    step() {
      if (this.over) return;
      const dt = this.C.dt;
      this._triggers();

      // assassins leap over the defence line once
      if (this.t >= this.C.assassinLeapAt) {
        for (const f of this.fighters) {
          if (f.alive && f.role === 'assassin' && !f.leaped && f.stun <= 0) {
            f.leaped = true;
            const dir = f.side === 0 ? 1 : -1;
            const back = this.enemiesOf(f).filter((e) => !e.isHero || this.targetable(e))
              .sort((a, b) => (b.y - a.y) * dir || Math.abs(a.x - f.x) - Math.abs(b.x - f.x) || a.id - b.id)[0];
            if (back) {
              f.x = back.x + (f.x > back.x ? 0.35 : -0.35);
              f.y = back.y + dir * 0.55;
              f.target = back;
              this.emit({ type: 'leap', id: f.id });
            }
          }
        }
      }

      for (const f of this.fighters) {
        if (!f.alive) continue;
        f.buffs = f.buffs.filter((b) => b.until > this.t);
        if (f.sig === 'frostaura' && this.t >= (f._au || 0)) { f._au = this.t + 0.25; this.enemiesOf(f).forEach((e) => { if (!e.isHero && dist(e, f) <= 2.6) e.buffs.push({ asPct: -0.12, until: this.t + 0.4 }); }); }
        if (f.sig === 'bloom' && this.t >= (f._bl || 3)) { f._bl = this.t + 3; this.fighters.forEach((a) => { if (a.side === f.side && a.alive && !a.isHero) this.heal(a, a.maxHp * 0.03, true); }); }
        if (f.wrule && f.wrule.type === 'grow' && f.growN < f.wrule.max && this.t >= f._gn) {   // sylvan rule: the unit grows every few seconds
          f._gn += f.wrule.every; f.growN++;
          f.atk += f.atk0 * f.wrule.pct; const add = f.maxHp0 * f.wrule.pct; f.maxHp += add; f.hp += add;
          this.emit({ type: 'status', id: f.id, text: 'نمو' });
        }
        if (f.ignite) {   // ember rule: a burn that refreshes on every hit (one at a time, it does not stack)
          if (f.ignite.until <= this.t) f.ignite = null;
          else {
            const ig = f.ignite, src = this.fighters.find((x) => x.id === ig.src);
            this.damage(src && src.alive ? src : null, f, ig.dps * dt, { skill: true, dot: true });
            if (!f.alive) continue;
          }
        }
        if (f.dots.length) {
          f.dots = f.dots.filter((d) => d.until > this.t);
          for (const d of f.dots) {
            const src = this.fighters.find((x) => x.id === d.src);
            this.damage(src && src.alive ? src : null, f, d.dps * dt, { skill: true, dot: true });
            if (!f.alive) break;
          }
          if (!f.alive) continue;
        }
        if (f.regenPct) f.hp = Math.min(f.isHero && f.startHp != null ? f.startHp : f.maxHp, f.hp + (f.isHero ? Math.min(f.maxHp, 500) : f.maxHp) * f.regenPct * dt);
        if (f.passive) continue;
        if (f.stun > 0) { f.stun -= dt; continue; }

        if (!f.target || !f.target.alive || !this.targetable(f.target) || (f.tauntBy && f.tauntUntil > this.t && f.target.id !== f.tauntBy)) {
          f.target = this.findTarget(f);
        }
        if (f.skill && f.mana >= f.maxMana) { if (this.cast(f)) continue; }
        const tgt = f.target;
        if (!tgt) continue;
        const range = f.range <= 1 ? this.C.meleeRange : f.range + 0.15;
        const d = dist(f, tgt);
        if (d > range) {
          const step = Math.min(f.moveSpeed * dt, d - range + 0.01);
          f.x += ((tgt.x - f.x) / d) * step;
          f.y += ((tgt.y - f.y) / d) * step;
        } else {
          f.atkCd -= dt;
          if (f.atkCd <= 0) {
            f.atkCd += 1 / Math.max(0.1, this.effAs(f));
            f.atkN = (f.atkN || 0) + 1;
            const crit = this.rng.chance(f.crit) || (f.sig === 'deadeye' && f.atkN % 3 === 0);   // legendary 'deadeye': every third hit crits
            if (f.sig === 'overload' && (f.ov || 0) < 10) { f.ov = (f.ov || 0) + 1; f.as *= 1.03; }
            this.emit({ type: 'attack', from: f.id, to: tgt.id, ranged: f.range > 1 });
            this.damage(f, tgt, this.effAtk(f) * (crit ? f.critDmg : 1), { crit });
            if (f.wrule && tgt.alive && !tgt.passive) this._worldHit(f, tgt);
            if (f.skill) f.mana = Math.min(f.maxMana, f.mana + this.C.manaPerAttack);
          }
        }
      }

      this.t += dt;
      this._checkEnd();
    }

    _checkEnd() {
      const h0 = this.sides[0].hero, h1 = this.sides[1].hero;
      if (!h0.alive || !h1.alive) {
        const winner = !h0.alive && !h1.alive ? null : h0.alive ? 0 : 1;
        return this._finish(winner);
      }
      const a0 = this.sideFighters(0).length, a1 = this.sideFighters(1).length;
      if (!this.assault) {
        if (a0 === 0 && a1 === 0) return this._finish(null);
        if (a0 === 0 || a1 === 0) {
          const loser = a0 === 0 ? 0 : 1;
          this.assault = { side: loser, until: this.t + this.C.assaultWindow };
          this.emit({ type: 'assault', side: loser });
        }
      } else if (this.t >= this.assault.until || this.sides[this.assault.side].hero.sealed) {
        return this._finish(1 - this.assault.side);
      }
      if (this.t >= this.C.timeCap) {
        if (this.assault) return this._finish(1 - this.assault.side);
        return this._finish(null);
      }
    }

    _finish(winner) {
      this.over = true;
      const scale = this.C.heroHpScale;
      const sides = this.sides.map((sd, s) => ({
        heroLife: Math.max(0, sd.hero.hp / scale),
        heroKilled: !sd.hero.alive,
        survivors: this.fighters.filter((f) => f.side === s && f.alive && !f.isHero).map((f) => ({ defId: f.defId, star: f.star })),
        abilitiesFired: sd.abilities.filter((a) => a.fired).map((a) => a.def.id),
        exposed: !!sd.frontDown,
      }));
      const unitDamage = {};
      this.fighters.forEach((f) => { if (!f.isHero) unitDamage[f.uid] = Math.round(f.dmgDealt); });
      this.result = { winner, duration: this.t, sides, unitDamage };
      this.emit({ type: 'end', winner });
    }

    runToEnd() {
      let guard = 0;
      while (!this.over && guard++ < 100000) this.step();
      return this.result;
    }
  }

  AMB.Combat = Combat;
  AMB.combatGeom = { slotPos, postPos };
})();

;
/* core/match.js */
/*
 * Match state machine + economy. UI-independent: the browser UI, the AI and
 * the headless simulator all drive a Match through the same methods.
 *
 * Round phases: resources -> shop -> formation -> combat -> result
 * (shop and formation share one prep timer; the UI shows both steps.)
 */
(function () {
  const AMB = (globalThis.AMB = globalThis.AMB || {});
  const SLOTS = ['f0', 'f1', 'f2', 'f3', 'b0', 'b1', 'b2', 'b3'];

  function newPlayer(i, opts) {
    const E = AMB.CONFIG.economy;
    const hero = AMB.DATA.HEROES[opts.heroId];
    return {
      index: i, name: opts.name || `لاعب ${i + 1}`, heroId: hero.id, isAI: !!opts.isAI,
      aiStyle: opts.aiStyle || 'balanced', difficulty: opts.difficulty || 'normal',
      life: AMB.CONFIG.match.heroLife + Math.max(0, (opts.heroLevel || 1) - 1) * (AMB.CONFIG.match.heroLifePerLevel || 0), maxLife: AMB.CONFIG.match.heroLife + Math.max(0, (opts.heroLevel || 1) - 1) * (AMB.CONFIG.match.heroLifePerLevel || 0),
      gold: 0, level: E.startLevel, idle: 0, upgradeDiscount: 0, shownRanks: [], shopNew: [], mergePick: null, essence: E.essenceStart,
      bench: new Array(E.benchSize).fill(null),
      board: {},            // slot -> unit
      items: [],            // owned item ids (equipment not yet equipped + unarmed spells)
      armedSpells: [],
      abilities: {},        // abilityId -> trigger
      summoned: false, heroSlot: 'b1',
      shop: [], itemShop: [], shopLocked: false, freeRerolls: 0,
      winStreak: 0, lossStreak: 0, lastWon: false, lastIncome: null,
      stats: { damageDealt: 0, goldSpent: 0, rerolls: 0, unitsBought: 0, merges: 0, wins: 0, losses: 0, draws: 0 },
      alive: true,
      blessings: { atkPct: 0, hpPct: 0, asPct: 0 }, rewardOffer: null, rewardLog: [],
      lineup: opts.lineup || null,   // scripted enemy (campaign): { units:[[defId,star,slot,fromRound]], summon, blessings, abilities }
      cardPower: opts.cardPower || null,
      heroLevel: opts.heroLevel || 1,     // hero level from the profile (campaign, tower, events, quick vs AI; online and hotseat pass none = level 1)
      allowed: opts.allowedUnits ? new Set(opts.allowedUnits) : null,   // units this player owns — progression fights only
    };
  }

  class Match {
    constructor(opts) {
      this.mode = opts.mode || 'ai';
      this.seed = opts.seed || Math.floor(Math.random() * 2 ** 31);
      this.rng = AMB.util.RNG(this.seed);
      // card levels/rarity and hero level count in every mode that passes them (campaign, tower, events, quick vs AI); online and same-device (hotseat) pass none, so they stay even. The deck limit is progression-only.
      this.progression = !!opts.progression;
      this.rules = opts.rules || null;   // short-match rules (campaign): { maxRounds, winsNeeded, start: { gold, level } }
      this.weekly = opts.weekly && Match.WEEKLY[opts.weekly] ? opts.weekly : null;   // teen #19: the rule of the week (quick match, online, same device)
      this.players = opts.players.map((p, i) => newPlayer(i, this.progression ? p : Object.assign({}, p, { allowedUnits: null })));
      // online play: each player has their OWN random stream, unit pool and unit ids, so both phones can replay each other's moves and stay identical
      this.isolated = !!opts.isolated;
      this.round = 0;
      this.phase = 'idle';
      this.pool = {};
      Object.values(AMB.DATA.UNITS).forEach((u) => (this.pool[u.id] = AMB.CONFIG.economy.poolSize[u.tier]));
      if (this.isolated) this.players.forEach((p, i) => { p.rng = AMB.util.RNG(this.seed * 7 + i * 7919 + 13); p.pool = Object.assign({}, this.pool); p.uidN = 0; });
      this.history = [];       // per-round reports
      this.scout = [null, null]; // last board each player fought with
      this.winner = undefined;
      this.startedAt = Date.now();
      this.log = [];
    }

    _rng(p) { return this.isolated ? p.rng : this.rng; }
    _pool(p) { return this.isolated ? p.pool : this.pool; }

    /** senior #39: undo. snapshot() before a move, restore() to take it back. Only for moves that use no randomness (a reroll clears the history). */
    // fields that are fixed for the whole match (a Set, a random stream, the scripted line-up...) are never snapshotted or restored: JSON would turn a Set into {}
    static get FIXED() { return ['allowed', 'rng', 'pool', 'lineup', 'cardPower']; }
    snapshot(pi) { const p = this.players[pi], fixed = Match.FIXED, copy = {}; Object.keys(p).forEach((k) => { if (!fixed.includes(k)) copy[k] = p[k]; }); return JSON.stringify({ p: copy, pool: this._pool(p), uidN: this._uidN || 0 }); }
    restore(pi, snap) {
      const o = JSON.parse(snap), p = this.players[pi], fixed = Match.FIXED;
      Object.keys(p).forEach((k) => { if (!fixed.includes(k) && !(k in o.p)) delete p[k]; }); Object.assign(p, o.p);
      const pool = this._pool(p); Object.keys(pool).forEach((k) => delete pool[k]); Object.assign(pool, o.pool);
      this._uidN = o.uidN; return true;
    }
    _uid(p) { return this.isolated ? 'u' + p.index + '_' + (++p.uidN) : 'u' + (this._uidN = (this._uidN || 0) + 1); }   // per-match ids: a match rebuilt from its moves (continue after reload) gets the same ids

    // ================================================================ round flow
    startRound() {
      const E = AMB.CONFIG.economy;
      if (this.rewardPending && AMB.AI && AMB.AI.claimRewards) AMB.AI.claimRewards(this);   // never leave a draft open
      this.players.forEach((_, i) => this.autoPickMerge(i));   // a merge reward nobody picked is picked for them
      this.round++;
      this.phase = 'resources';
      // short-match start gold/level go in BEFORE the first shop is rolled (the first shop used to be rolled at level 3 whatever the start level was)
      if (this.rules && this.round === 1) this.players.forEach((p) => { const st = this.rules.start; if (!p.lineup && st) { p.gold += st.gold || 0; p.level = Math.max(p.level, st.level || 0); } });
      this.players.forEach((p) => {
        if (p.invest && this.isFinale(this.round)) { p.gold += p.invest; p.invest = 0; }   // the investment pays out at the start of the finale
        const rich = this.weekly === 'richInterest';
        const interest = Math.min(rich ? E.interestMax + 2 : E.interestMax, Math.floor(p.gold / (rich ? E.interestPer - 2 : E.interestPer)));
        const streak = Math.max(p.winStreak, p.lossStreak);
        let streakBonus = 0;
        E.streakBonus.forEach(([n, b]) => { if (streak >= n) streakBonus = b; });
        const win = this.round > 1 && p.lastWon ? E.winBonus : 0;   // the win bonus is for WINNING the last round (a drawn round does not pay it)
        const dataStream = AMB.DATA.HEROES[p.heroId].passive.id === 'data_stream' ? 1 : 0;   // Nayako: +1 gold every round
        // catch-up (PvP-style modes only; campaign/tower/events are tuned separately): far behind on life -> a little extra gold, so a bad start is not a lost game
        const foe = this.players[1 - this.players.indexOf(p)], cu = E.catchUp;
        const help = cu && foe && ['ai', 'hotseat', 'online', 'sim'].includes(this.mode) && this.round > 2 && foe.life - p.life >= cu.gap ? cu.gold : 0;
        const base = E.income[Math.min(this.round, E.income.length) - 1];
        const income = (this.round === 1 ? base : base + interest + streakBonus + win + help) + dataStream;
        p.lastIncome = { base, interest: this.round === 1 ? 0 : interest, streak: this.round === 1 ? 0 : streakBonus, win, help, total: income };
        p.gold += income;
        if (this.round > 1) p.idle++;   // one more round without a shop upgrade: the next upgrade gets cheaper
        const essGain = E.essencePerRound + (AMB.DATA.HEROES[p.heroId].passive.id === 'deep_reserve' ? 2 : 0);
        if (this.round > 1) p.essence = Math.max(p.essence, Math.min(E.essenceMax, p.essence + essGain));   // a 'pure essence' reward above the cap is kept (never clamped away)
        p.freeRerolls = (AMB.DATA.HEROES[p.heroId].passive.id === 'free_reroll' ? 1 : 0) + (this.weekly === 'freeReroll' ? 1 : 0);
        if (!p.shopLocked || !p.shop.length) this._rollShop(p, true);
        p.shopLocked = false;
        this._validateAbilities(p);
      });
      this.players.forEach((p, i) => { if (p.lineup) this.applyLineup(i); });
      this.phase = 'prep';
    }

    // ================================================================ economy
    /** put items into the bag; the bag holds itemBenchSize (6): the rest turns into gold (+3 each, like the 'item' reward) so the limit can never be bypassed */
    _stash(p, items) { const cap = AMB.CONFIG.economy.itemBenchSize; items.forEach((it) => { if (p.items.length < cap) p.items.push(it); else p.gold += 3; }); }
    /** board size at the player's shop level */
    boardCap(p) { return AMB.CONFIG.economy.boardSize[Math.max(1, Math.min(p.level, AMB.CONFIG.economy.boardSize.length)) - 1]; }
    /** price of the next shop upgrade (null at the top level): the level's base price, minus 1 per round without an upgrade, never below the minimum */
    upgradeCost(p) {
      const E = AMB.CONFIG.economy;
      if (p.level >= E.maxLevel) return null;
      const base = E.upgradeCost[p.level + 1];
      return Math.max(E.upgradeMin, base - (p.idle || 0) * E.upgradeDecay - (p.upgradeDiscount || 0));
    }
    xpNeeded() { return null; }

    _cardsOfRank(p, rank, needPool) {
      const mine = (u) => !p.allowed || p.allowed.has(u.id);   // progression: only cards the player owns
      return Object.values(AMB.DATA.UNITS).filter((u) => u.tier === rank && mine(u) && (!needPool || this._pool(p)[u.id] > 0));
    }
    /** draw a card for the shop: first the star by the level's odds, then a card of that star. Never a card above the shop level. */
    _drawUnit(p) {
      const E = AMB.CONFIG.economy, lvl = Math.max(1, Math.min(p.level, E.maxLevel));
      const odds = E.shopOdds[lvl];
      const rng = this._rng(p);
      let rank = rng.weighted(odds.map((w, i) => [i + 1, w]).filter((e) => e[1] > 0 && e[0] <= lvl));
      // that star is sold out, or you own no card of it (progression decks are small): try the lower stars, then the higher ones up to the shop level. Never above the level.
      const order = []; for (let r = rank; r >= 1; r--) order.push(r); for (let r = rank + 1; r <= lvl; r++) order.push(r);
      for (const r of order) {
        const list = this._cardsOfRank(p, r, true);
        if (list.length) return rng.weighted(list.map((u) => [u.id, this._pool(p)[u.id]]));
      }
      return null;
    }

    _rollShop(p, fresh) {
      const E = AMB.CONFIG.economy;
      p.shop = []; p.shopNew = [];
      for (let i = 0; i < E.shopSlots; i++) {
        const id = this._drawUnit(p, fresh); p.shop.push(id);
        const r = id ? AMB.DATA.UNITS[id].tier : 0;
        p.shopNew.push(!!(r > 1 && !p.shownRanks.includes(r)));   // the first time a star shows up in this player's shop it gets a special frame
        if (r && !p.shownRanks.includes(r)) p.shownRanks.push(r);
      }
      const items = Object.keys(AMB.DATA.ITEMS);
      p.itemShop = [];
      for (let i = 0; i < E.itemShopSlots; i++) p.itemShop.push(this._rng(p).pick(items));
    }

    reroll(pi) {
      const p = this.players[pi];
      const cost = AMB.CONFIG.economy.rerollCost;
      if (p.freeRerolls > 0) p.freeRerolls--;
      else if (p.gold < cost) return this._fail('ما عندك ذهب يكفي للتحديث');
      else { p.gold -= cost; p.stats.goldSpent += cost; }
      p.stats.rerolls++;
      this._rollShop(p);
      return { ok: true };
    }

    /** buy the next shop level: more card stars in the shop, a bigger board */
    upgradeShop(pi) {
      const p = this.players[pi], cost = this.upgradeCost(p);
      if (cost == null) return this._fail('المتجر وصل لأعلى مستوى');
      if (p.gold < cost) return this._fail('ما عندك ذهب يكفي للترقية');
      p.gold -= cost; p.stats.goldSpent += cost;
      p.level++; p.idle = 0; p.upgradeDiscount = 0;
      return { ok: true, level: p.level, cost };
    }
    buyXp(pi) { return this.upgradeShop(pi); }   // old name (online move log, UI shortcut)

    toggleLock(pi) { const p = this.players[pi]; p.shopLocked = !p.shopLocked; return { ok: true }; }

    allUnits(p) {
      return [...p.bench.filter(Boolean), ...Object.values(p.board)];
    }
    boardUnits(p) { return Object.values(p.board); }
    boardCount(p) { return Object.keys(p.board).length; }

    canBuy(pi, shopIdx) {
      const p = this.players[pi];
      const defId = p.shop[shopIdx];
      if (!defId) return { ok: false, reason: 'فارغ' };
      const def = AMB.DATA.UNITS[defId];
      if (p.gold < def.cost) return { ok: false, reason: 'ما عندك ذهب يكفي' };
      if (this._pool(p)[defId] <= 0) return { ok: false, reason: 'خلصت نسخ هالوحدة من المخزون' };
      const benchFree = p.bench.indexOf(null) >= 0;
      if (!benchFree) {
        const same = this.allUnits(p).filter((u) => u.defId === defId && u.star === 1).length;
        if (same < Match.copiesFor(2) - 1) return { ok: false, reason: 'الاحتياط مليان: بِع وحدة أو حطها في الساحة' };
      }
      return { ok: true };
    }

    buy(pi, shopIdx) {
      const chk = this.canBuy(pi, shopIdx);
      if (!chk.ok) return this._fail(chk.reason);
      const p = this.players[pi];
      const defId = p.shop[shopIdx];
      const def = AMB.DATA.UNITS[defId];
      p.gold -= def.cost; p.stats.goldSpent += def.cost; p.stats.unitsBought++;
      this._pool(p)[defId]--;
      p.shop[shopIdx] = null;
      const unit = { uid: this._uid(p), defId, star: 1, items: [] };
      const idx = p.bench.indexOf(null);
      if (idx >= 0) p.bench[idx] = unit;
      else p._overflow = unit; // will merge immediately
      const merged = this._merge(p, unit);
      return { ok: true, unit, merged };
    }

    /** Merge 3 copies of the same unit+star into one higher star unit (recursive). */
    _merge(p, newUnit) {
      const S = AMB.CONFIG.stars;
      const merges = [];
      let check = newUnit;
      while (check && check.star < S.maxStar) {
        const list = this.allUnits(p).filter((u) => u.defId === check.defId && u.star === check.star);
        if (p._overflow && p._overflow.defId === check.defId && p._overflow.star === check.star && !list.includes(p._overflow)) list.push(p._overflow);
        const need = Match.copiesFor(check.star + 1);
        if (list.length < need) break;
        const use = list.slice(0, need);
        // keep the position of a board copy if one exists
        const onBoard = use.map((u) => this._locate(p, u)).find((l) => l && l.zone === 'board');
        const keepLoc = onBoard || use.map((u) => this._locate(p, u)).find((l) => l) || null;
        const items = [];
        use.forEach((u) => { items.push(...u.items); this._remove(p, u); });
        if (p._overflow && use.includes(p._overflow)) p._overflow = null;
        const up = { uid: this._uid(p), defId: check.defId, star: check.star + 1, items: [] };
        const maxI = AMB.CONFIG.economy.maxItemsPerUnit;
        items.forEach((it) => (up.items.length < maxI ? up.items.push(it) : this._stash(p, [it])));
        if (keepLoc && keepLoc.zone === 'board') p.board[keepLoc.slot] = up;
        else {
          const bi = keepLoc && keepLoc.zone === 'bench' ? keepLoc.idx : p.bench.indexOf(null);
          if (bi >= 0) p.bench[bi] = up; else this._placeAnywhere(p, up);
        }
        merges.push(up); p.stats.merges++;
        check = up;
      }
      if (p._overflow) { // could not merge after all — refund
        p.gold += AMB.DATA.UNITS[p._overflow.defId].cost; this._pool(p)[p._overflow.defId]++; p._overflow = null;
      }
      if (merges.length && !p.lineup) this._offerMerge(p);
      return merges;
    }

    /** the merge reward: 3 cards, each one star above the shop level (max 5). The player picks one with claimMerge. */
    _offerMerge(p) {
      if (p.mergePick || p.giftRound === this.round) return;   // one reward at a time, and only the first merge of a round gives one (no snowball)
      p.giftRound = this.round;
      const E = AMB.CONFIG.economy, want = AMB.CONFIG.stars.mergeChoices || 3, rank = Math.min(E.maxLevel, p.level + 1), rng = this._rng(p);
      const options = [];
      for (let r = rank; r >= 1 && options.length < want; r--) {
        const list = this._cardsOfRank(p, r, true).filter((u) => !options.includes(u.id));
        while (list.length && options.length < want) options.push(list.splice(rng.int(list.length), 1)[0].id);
      }
      if (options.length) p.mergePick = { rank, options };
    }
    claimMerge(pi, idx) {
      const p = this.players[pi], mp = p.mergePick;
      if (!mp) return this._fail('ما فيه مكافأة دمج');
      const defId = mp.options[idx];
      if (!defId) return this._fail('هالخيار مو صحيح');
      p.mergePick = null;
      this._pool(p)[defId]--;
      const unit = { uid: this._uid(p), defId, star: 1, items: [] };
      const bi = p.bench.indexOf(null);
      if (bi >= 0) p.bench[bi] = unit; else this._placeAnywhere(p, unit);
      const merged = this._merge(p, unit);
      return { ok: true, unit, merged, defId };
    }
    /** when nobody picked (timer, AI, a new round): the first option is taken */
    autoPickMerge(pi) {
      const p = this.players[pi]; let guard = 0;
      while (p.mergePick && guard++ < 4) {
        const o = p.mergePick.options, W = AMB.AI && AMB.AI.pickMerge ? AMB.AI.pickMerge(this, pi) : 0;
        this.claimMerge(pi, W >= 0 && W < o.length ? W : 0);
      }
    }

    _placeAnywhere(p, u) {
      const bi = p.bench.indexOf(null);
      if (bi >= 0) { p.bench[bi] = u; return; }
      const slot = SLOTS.find((s) => !p.board[s] && !(p.summoned && p.heroSlot === s));
      if (slot) p.board[slot] = u;
    }

    _locate(p, u) {
      const bi = p.bench.indexOf(u);
      if (bi >= 0) return { zone: 'bench', idx: bi };
      for (const s of SLOTS) if (p.board[s] === u) return { zone: 'board', slot: s };
      return null;
    }
    _remove(p, u) {
      const loc = this._locate(p, u);
      if (!loc) return;
      if (loc.zone === 'bench') p.bench[loc.idx] = null; else delete p.board[loc.slot];
    }
    findUnit(p, uid) { return this.allUnits(p).find((u) => u.uid === uid) || null; }

    /** units of star-1 that merge into one unit of `star` (3 for ★★; ★★★ may need fewer, see CONFIG.stars.copiesTo) */
    /** teen #19: the rule of the week. Same for everyone; it changes every Monday-ish (week index since the epoch). */
    static get WEEKLY() { return {
      lateHero: { name: 'الأبطال يتأخرون', text: 'البطل ما ينزل الساحة قبل الجولة 4' },
      richInterest: { name: 'موسم الفوائد', text: 'الفايدة على الذهب أكبر: +1 لكل 8، لين 5' },
      freeReroll: { name: 'متجر كريم', text: 'أول تحديث للمتجر في كل جولة مجاني للكل' },
    }; }
    static weeklyNow(t) { const ids = Object.keys(Match.WEEKLY); return ids[Math.floor((t || Date.now()) / 604800000) % ids.length]; }
    static copiesFor(star) { const S = AMB.CONFIG.stars; return (S.copiesTo && S.copiesTo[star]) || S.copiesPerStar; }
    /** how many 1★ copies a unit is made of (sell value and pool refund) */
    copiesOf(u) { let n = 1; for (let s = 2; s <= u.star; s++) n *= Match.copiesFor(s); return n; }
    sellValue(u) { return Math.round(AMB.DATA.UNITS[u.defId].cost * this.copiesOf(u) * AMB.CONFIG.economy.sellRefund); }

    sell(pi, uid) {
      const p = this.players[pi];
      const u = this.findUnit(p, uid);
      if (!u) return this._fail('ما لقيت الوحدة');
      this._remove(p, u);
      p.gold += this.sellValue(u);
      this._pool(p)[u.defId] += this.copiesOf(u);
      this._stash(p, u.items);
      return { ok: true };
    }

    /** dest: {zone:'bench', idx} | {zone:'board', slot} — swaps if occupied. */
    move(pi, uid, dest) {
      // a friend's move arrives over the network: reject any destination the UI could never send (unknown slot, bench index out of range)
      if (!dest || typeof dest !== 'object') return this._fail('وجهة غلط');
      if (dest.zone === 'board' ? !SLOTS.includes(dest.slot) : dest.zone === 'bench' ? !(Number.isInteger(dest.idx) && dest.idx >= 0 && dest.idx < AMB.CONFIG.economy.benchSize) : true) return this._fail('وجهة غلط');
      const p = this.players[pi];
      const u = this.findUnit(p, uid);
      if (!u) return this._fail('ما لقيت الوحدة');
      const from = this._locate(p, u);
      if (dest.zone === 'board') {
        if (p.summoned && p.heroSlot === dest.slot) {
          if (from.zone !== 'board') return this._fail('البطل واقف في هالخانة');
          p.heroSlot = from.slot; delete p.board[from.slot]; p.board[dest.slot] = u; return { ok: true };
        }
        const other = p.board[dest.slot] || null;
        if (from.zone === 'bench' && !other && this.boardCount(p) >= this.boardCap(p)) return this._fail(`الساحة ممتلئة (${this.boardCap(p)}/${this.boardCap(p)}). بدّل مع وحدة في الساحة، أو بع وحدة، أو ارفع مستوى المتجر`);
        this._remove(p, u);
        if (other) { this._remove(p, other); this._put(p, other, from); }
        p.board[dest.slot] = u;
      } else {
        const other = p.bench[dest.idx] || null;
        this._remove(p, u);
        if (other) { p.bench[dest.idx] = null; this._put(p, other, from); }
        p.bench[dest.idx] = u;
      }
      return { ok: true };
    }
    _put(p, u, loc) { if (loc.zone === 'bench') p.bench[loc.idx] = u; else p.board[loc.slot] = u; }

    // ---------------------------------------------------------------- items & spells
    buyItem(pi, idx) {
      const p = this.players[pi];
      const id = p.itemShop[idx];
      if (!id) return this._fail('فارغ');
      const it = AMB.DATA.ITEMS[id];
      if (p.gold < it.cost) return this._fail('ما عندك ذهب يكفي');
      if (p.items.length >= AMB.CONFIG.economy.itemBenchSize) return this._fail('حقيبة المعدات ممتلئة');
      p.gold -= it.cost; p.stats.goldSpent += it.cost;
      p.items.push(id);
      p.itemShop[idx] = null;
      return { ok: true };
    }

    equip(pi, itemIdx, uid) {
      const p = this.players[pi];
      const id = p.items[itemIdx];
      if (!id || AMB.DATA.ITEMS[id].kind !== 'equip') return this._fail('هذي مو معدة تنلبس');
      const u = this.findUnit(p, uid);
      if (!u) return this._fail('اختر وحدة');
      if (u.items.length >= AMB.CONFIG.economy.maxItemsPerUnit) return this._fail('الوحدة ما تشيل معدات زيادة');
      p.items.splice(itemIdx, 1);
      u.items.push(id);
      return { ok: true };
    }

    unequip(pi, uid) {
      const p = this.players[pi];
      const u = this.findUnit(p, uid);
      if (!u || !u.items.length) return this._fail('ما فيه معدات');
      if (p.items.length + u.items.length > AMB.CONFIG.economy.itemBenchSize) return this._fail('الحقيبة ممتلئة');
      p.items.push(...u.items); u.items = [];
      return { ok: true };
    }

    sellItem(pi, itemIdx) {
      const p = this.players[pi];
      const id = p.items[itemIdx];
      if (!id) return this._fail('فارغ');
      p.items.splice(itemIdx, 1);
      p.gold += Math.floor(AMB.DATA.ITEMS[id].cost / 2);
      return { ok: true };
    }

    armSpell(pi, itemIdx) {
      const p = this.players[pi];
      const id = p.items[itemIdx];
      if (!id || AMB.DATA.ITEMS[id].kind !== 'spell') return this._fail('هذي مو تعويذة');
      if (p.armedSpells.length >= AMB.CONFIG.economy.maxArmedSpells) return this._fail('وصلت الحد الأقصى من التعاويذ');
      p.items.splice(itemIdx, 1);
      p.armedSpells.push(id);
      return { ok: true };
    }
    disarmSpell(pi, idx) {
      const p = this.players[pi];
      if (p.items.length >= AMB.CONFIG.economy.itemBenchSize) return this._fail('الحقيبة ممتلئة');
      const [id] = p.armedSpells.splice(idx, 1);
      if (id) p.items.push(id);
      return { ok: true };
    }

    // ---------------------------------------------------------------- hero
    abilityCost(p, ab) {
      const d = p.summoned ? AMB.CONFIG.hero.summonAbilityDiscount + (((AMB.DATA.HEROES[p.heroId] || {}).vanguard || {}).extraDiscount || 0) : 0;
      return Math.max(1, ab.cost - d);
    }
    reservedEssence(p) {
      const hero = AMB.DATA.HEROES[p.heroId];
      return Object.keys(p.abilities).reduce((s, id) => s + this.abilityCost(p, hero.abilities.find((a) => a.id === id)), 0);
    }
    setAbility(pi, abilityId, trigger) {
      const p = this.players[pi];
      const hero = AMB.DATA.HEROES[p.heroId];
      const ab = hero.abilities.find((a) => a.id === abilityId);
      if (!ab) return this._fail('ما أعرف هالقدرة');
      if (!trigger) { delete p.abilities[abilityId]; return { ok: true }; }
      const had = p.abilities[abilityId];
      if (!had) {
        if (this.reservedEssence(p) + this.abilityCost(p, ab) > p.essence) return this._fail('ما عندك جوهر يكفي');
      }
      p.abilities[abilityId] = trigger;
      return { ok: true };
    }
    _validateAbilities(p) {
      while (this.reservedEssence(p) > p.essence) {
        const k = Object.keys(p.abilities).pop();
        delete p.abilities[k];
      }
    }

    /** teen #15: "رهان الحسم": in the finale's prep a player may raise the stakes: the loser of the final round loses ×wagerMult more life (for both sides) */
    setWager(pi, on) {
      const p = this.players[pi];
      if (!this.isFinale(this.round) || this.phase !== 'prep') return this._fail('الرهان بس في جولة الحسم');
      p.wager = !!on; return { ok: true };
    }

    toggleSummon(pi, slot) {
      if (slot != null && !SLOTS.includes(slot)) return this._fail('خانة غلط');
      const p = this.players[pi];
      if (this.weekly === 'lateHero' && !p.summoned && this.round < 4) return this._fail('قاعدة الأسبوع: البطل ينزل من الجولة 4');
      if (p.summoned) { p.summoned = false; this._validateAbilities(p); return { ok: true }; }
      const s = slot || p.heroSlot;
      const target = !p.board[s] ? s : SLOTS.slice().reverse().find((x) => !p.board[x]);
      if (!target) return this._fail('ما فيه خانة فاضية تنزّل فيها البطل');
      p.heroSlot = target;
      p.summoned = true;
      return { ok: true };
    }
    moveHero(pi, slot) {
      if (!SLOTS.includes(slot)) return this._fail('خانة غلط');
      const p = this.players[pi];
      if (!p.summoned) return this._fail('البطل مو في الساحة');
      const other = p.board[slot];
      if (other) { delete p.board[slot]; p.board[p.heroSlot] = other; }
      p.heroSlot = slot;
      return { ok: true };
    }

    /** Smart arrangement: the strongest `level` units on the board, tanks in front, ranged behind, the rest on the bench. */
    /** put units into the given free slots: a unit goes to a slot of its own role first (that is where it gets its role bonus), the rest take what is left */
    static placeByRole(units, slots) {
      const U = AMB.DATA.UNITS, SR = AMB.DATA.SLOT_ROLES, free = slots.slice(), out = {}, rest = [];
      units.forEach((u) => { const s = free.find((x) => SR[x] && SR[x].includes(U[u.defId].role)); if (s) { out[s] = u; free.splice(free.indexOf(s), 1); } else rest.push(u); });
      const spill = []; rest.forEach((u) => { const s = free.shift(); if (s) out[s] = u; else spill.push(u); });
      return { out, spill, free };
    }
    autoArrange(pi) {
      const p = this.players[pi], U = AMB.DATA.UNITS, R = AMB.DATA.ROLES;
      const pw = (u) => (AMB.AI && AMB.AI.power ? AMB.AI.power(u) : U[u.defId].tier * AMB.CONFIG.stars.mult[u.star]);
      const all = this.allUnits(p).slice().sort((a, b) => pw(b) - pw(a));
      const want = all.slice(0, this.boardCap(p));
      let front = want.filter((u) => R[U[u.defId].role].side === 'front');
      let back = want.filter((u) => R[U[u.defId].role].side === 'back');
      const any = want.filter((u) => R[U[u.defId].role].side === 'any');
      any.forEach((u) => (front.length <= back.length ? front : back).push(u));
      if (!front.length && back.length > 1) { back.sort((a, b) => U[b.defId].hp * AMB.CONFIG.stars.mult[b.star] - U[a.defId].hp * AMB.CONFIG.stars.mult[a.star]); front.push(back.shift()); }   // somebody must hold the line
      while (front.length > 4) back.push(front.pop());
      while (back.length > 4) front.push(back.pop());
      const FR = ['f1', 'f2', 'f0', 'f3'], BK = ['b1', 'b2', 'b0', 'b3'];
      const skip = (arr) => arr.filter((x) => !(p.summoned && p.heroSlot === x));
      const fs = skip(FR), bs = skip(BK);
      p.board = {};
      const spill = [];   // units that found no slot go to the bench instead of vanishing
      const put = (u, first, second) => { const slot = first.shift() || second.shift(); if (slot) p.board[slot] = u; else spill.push(u); };
      const fr = Match.placeByRole(front, fs), bk = Match.placeByRole(back, bs);
      Object.assign(p.board, fr.out, bk.out);
      fr.spill.forEach((u) => put(u, bk.free, []));
      bk.spill.forEach((u) => put(u, fr.free, []));
      const rest = all.filter((u) => !Object.values(p.board).includes(u));
      p.bench = new Array(AMB.CONFIG.economy.benchSize).fill(null);
      rest.forEach((u) => { const bi = p.bench.indexOf(null); if (bi >= 0) p.bench[bi] = u; else this._placeAnywhere(p, u); });
      return { ok: true };
    }

    /** Fill empty board capacity from the bench (used when the timer expires). */
    autoFill(pi) {
      const p = this.players[pi];
      const free = () => SLOTS.filter((s) => !p.board[s] && !(p.summoned && p.heroSlot === s));
      const bench = p.bench.map((u, i) => [u, i]).filter((e) => e[0]);
      bench.sort((a, b) => b[0].star - a[0].star || AMB.DATA.UNITS[b[0].defId].tier - AMB.DATA.UNITS[a[0].defId].tier);
      for (const [u] of bench) {
        if (this.boardCount(p) >= this.boardCap(p)) break;
        const role = AMB.DATA.UNITS[u.defId].role;
        const pref = ['guardian', 'fighter'].includes(role) ? 'f' : 'b';
        const fs = free();
        const slot = fs.find((s) => s[0] === pref) || fs[0];
        if (!slot) break;
        this.move(pi, u.uid, { zone: 'board', slot });
      }
      // too many units on board (e.g. never possible, but be safe)
      while (this.boardCount(p) > this.boardCap(p)) {
        const s = Object.keys(p.board).pop();
        const bi = p.bench.indexOf(null);
        if (bi < 0) { this.sell(pi, p.board[s].uid); } else this.move(pi, p.board[s].uid, { zone: 'bench', idx: bi });
      }
    }

    // ================================================================ combat
    buildCombatSpec(pi) {
      const p = this.players[pi];
      const grow = p.lineup && p.lineup.growth ? 1 + p.lineup.growth * (this.round - 1) : 1;   // long boss fights: the scripted enemy gets stronger every round
      return {
        heroId: p.heroId, life: p.life, maxLife: p.maxLife, summoned: p.summoned, heroSlot: p.heroSlot,
        units: Object.entries(p.board).map(([slot, u]) => ({ uid: u.uid, defId: u.defId, star: u.star, items: u.items.slice(), slot, power: ((p.cardPower && p.cardPower[u.defId]) || 1) * grow })),
        heroPower: ((p.cardPower && p.cardPower[p.heroId]) || 1) * grow,
        heroLevel: p.heroLevel || 1,
        spells: p.armedSpells.slice(),
        blessings: Object.assign({}, p.blessings),
        abilities: Object.entries(p.abilities).map(([id, trigger]) => ({ id, trigger })),
        hunt: p.hunt || 'back',
      };
    }

    /** teen #13: what your assassins go for: 'back' (the back line, default) or 'weak' (the lowest-health enemy) */
    setHunt(pi, mode) {
      if (mode !== 'back' && mode !== 'weak') return this._fail('اختيار غلط');
      this.players[pi].hunt = mode; return { ok: true };
    }

    createCombat(record) {
      this.phase = 'combat';
      this.players.forEach((_, i) => { this.autoPickMerge(i); this.autoFill(i); });
      const specs = [this.buildCombatSpec(0), this.buildCombatSpec(1)];
      this.scout = specs.map((s) => JSON.parse(JSON.stringify(s)));
      this._combatSpecs = specs;
      return new AMB.Combat(specs, { seed: this.isolated ? ((this.seed * 31 + this.round * 104729) % 2147483647) : this.rng.int(2 ** 31), round: this.round, record });
    }

    /** Apply a finished combat result: hero damage, streaks, essence, spells. */
    resolveCombat(result) {
      const D = AMB.CONFIG.damage;
      const M = AMB.CONFIG.match;
      const report = { round: this.round, winner: result.winner, duration: result.duration, players: [] };
      this.players.forEach((p, i) => {
        const sr = result.sides[i];
        const before = p.life;
        p.life = sr.heroLife;
        const direct = before - p.life;
        let backlash = 0;
        const opp = result.sides[1 - i];
        if (result.winner === 1 - i && !sr.heroKilled) {
          backlash = D.lossBase + Math.floor(this.round * D.lossPerRound) + Math.min(D.survivorCap, opp.survivors.reduce((s, u) => s + u.star * D.perSurvivor, 0));
          if (this.isFinale()) backlash = Math.round(backlash * M.finaleLossMult * (this.players.some((x) => x.wager) ? M.wagerMult : 1));   // teen #15: a finale wager raises the stakes for both
        } else if (result.winner === null) backlash = D.drawBase + Math.floor(this.round / 3);
        let collapse = 0;
        if (this.round >= M.collapseStartRound) {
          const k = this.round - M.collapseStartRound;
          collapse = M.collapseDamage[Math.min(k, M.collapseDamage.length - 1)];
        }
        p.life = Math.max(0, p.life - backlash - collapse);
        if (sr.heroKilled) p.life = 0;
        // essence: pay for fired abilities only (unfired ones are refunded)
        const hero = AMB.DATA.HEROES[p.heroId];
        let spent = 0;
        sr.abilitiesFired.forEach((id) => (spent += this.abilityCost(p, hero.abilities.find((a) => a.id === id))));
        p.essence = Math.max(0, p.essence - spent);
        p.armedSpells = [];
        // streaks
        p.lastWon = result.winner === i;
        if (result.winner === i) { p.winStreak++; p.lossStreak = 0; p.stats.wins++; }
        else if (result.winner === 1 - i) { p.lossStreak++; p.winStreak = 0; p.stats.losses++; }
        else { p.stats.draws++; }
        const dmg = Object.values(p.board).reduce((s, u) => s + (result.unitDamage[u.uid] || 0), 0);
        p.stats.byUnit = p.stats.byUnit || {};   // teen #18: damage per unit type over the match (for the after-match analysis)
        Object.values(p.board).forEach((u) => { const d0 = result.unitDamage[u.uid] || 0; if (d0) p.stats.byUnit[u.defId] = Math.round((p.stats.byUnit[u.defId] || 0) + d0); });
        p.stats.damageDealt += dmg;
        report.players.push({ direct: Math.round(direct * 10) / 10, backlash, collapse, lifeAfter: p.life, heroKilled: sr.heroKilled,
          survivors: sr.survivors.length, essenceSpent: spent, abilities: sr.abilitiesFired, exposed: sr.exposed,
          board: Object.values(p.board).map((u) => ({ defId: u.defId, star: u.star, items: u.items.slice() })),
          synergies: AMB.synergy.evaluate(Object.values(p.board), p.heroId).list.filter((s) => s.activeTier >= 0).map((s) => s.id),
          summoned: p.summoned, damage: dmg });
        p._lastDirect = direct;
      });
      this.history.push(report);
      this.phase = 'result';

      // game over checks
      const dead = this.players.map((p) => p.life <= 0);
      if (dead[0] || dead[1]) {
        // both heroes fell in the same round (rift collapse): the round's winner takes the match; a drawn round is a draw
        this.winner = dead[0] && dead[1] ? (report.winner != null ? report.winner : null) : dead[0] ? 1 : 0;
      } else if (this.rules) {   // short match: first to winsNeeded round wins; after maxRounds more round wins, then more life
        const w = this.players.map((p) => p.stats.wins), need = this.rules.winsNeeded || 2;
        if (w[0] >= need || w[1] >= need) this.winner = w[0] >= need ? 0 : 1;
        else if (this.round >= this.rules.maxRounds) {
          const [a, b] = this.players.map((p) => p.life);
          this.winner = w[0] !== w[1] ? (w[0] > w[1] ? 0 : 1) : a !== b ? (a > b ? 0 : 1) : null;
        }
      } else if (this.round >= M.maxRounds) {
        const [a, b] = this.players.map((p) => p.life);
        if (a !== b) this.winner = a > b ? 0 : 1;
        else { const w = this.players.map((p) => p.stats.wins); this.winner = w[0] === w[1] ? null : w[0] > w[1] ? 0 : 1; }   // tie-break: rounds won
      }
      if (this.winner !== undefined) { this.phase = 'over'; this.endedAt = Date.now(); }
      else this.offerRewards();
      report.finale = this.isFinale(report.round);
      return report;
    }

    // ================================================================ stages & rewards
    stageIndex(round) { const st = AMB.CONFIG.match.stages; const r = round == null ? this.round : round; const i = st.findIndex((x) => r >= x.rounds[0] && r <= x.rounds[1]); return i < 0 ? st.length - 1 : i; }
    stageInfo(round) { return AMB.CONFIG.match.stages[this.stageIndex(round)]; }
    isFinale(round) { return this.stageInfo(round).id === 'finale'; }
    /** true while any player still has an unclaimed reward draft */
    get rewardPending() { return this.players.some((p) => p.rewardOffer && !p.rewardOffer.claimed); }

    /** Build 3 distinct offers per player after the last round of a stage (not the final stage). */
    offerRewards() {
      if (this.rules) return false;   // no reward drafts in short (campaign) matches
      const si = this.stageIndex(this.round);
      if (si >= AMB.CONFIG.match.stages.length - 1) return false;
      if (this.round !== AMB.CONFIG.match.stages[si].rounds[1]) return false;   // only at the end of a stage
      const R = AMB.DATA.REWARDS, M = AMB.CONFIG.match;
      this.players.forEach((p, pi) => {
        const trailing = this.players[1 - pi].life - p.life >= M.catchUpGap;   // comeback help: a 4th option
        const pool = AMB.DATA.REWARD_POOLS[si].filter((id) => id !== 'heal' || p.life < p.maxLife);
        const picks = ['unit'];
        const rest = pool.slice();
        while (picks.length < (trailing ? 4 : 3) && rest.length) picks.push(rest.splice(this._rng(p).int(rest.length), 1)[0]);
        for (let i = picks.length - 1; i > 0; i--) { const j = this._rng(p).int(i + 1); [picks[i], picks[j]] = [picks[j], picks[i]]; }
        p.rewardOffer = { stage: si, options: picks, claimed: false, trailing };
      });
      return true;
    }

    rewardText(id, stage) { const r = AMB.DATA.REWARDS[id]; return r.text(r, stage); }

    claimReward(pi, idx) {
      const p = this.players[pi], o = p.rewardOffer;
      if (!o || o.claimed) return this._fail('ما فيه مكافأة');
      const id = o.options[idx]; if (!id) return this._fail('هالخيار مو صحيح');
      const R = AMB.DATA.REWARDS[id], st = o.stage, out = { ok: true, id, text: R.name + ' — ' + this.rewardText(id, st) };
      switch (id) {
        case 'gold': p.gold += R.n[st]; break;
        case 'invest': p.invest = (p.invest || 0) + R.n[st]; break;
        case 'xp': p.upgradeDiscount = (p.upgradeDiscount || 0) + R.n[st]; break;
        case 'essence': p.essence = Math.min(AMB.CONFIG.economy.essenceMax + 3, p.essence + R.n[st]); break;
        case 'heal': p.life = Math.min(p.maxLife, p.life + R.n[st]); break;
        case 'item': { const ids = Object.keys(AMB.DATA.ITEMS); const pick = this._rng(p).pick(ids), pick2 = this._rng(p).pick(ids); this._stash(p, [pick, pick2]); out.item = pick; break; }
        case 'bless_atk': p.blessings.atkPct += R.pct[st]; break;
        case 'bless_hp': p.blessings.hpPct += R.pct[st]; break;
        case 'bless_as': p.blessings.asPct += R.pct[st]; break;
        case 'unit': {
          const tier = R.tiers[st], hero = AMB.DATA.HEROES[p.heroId];
          const mine = (u) => !p.allowed || p.allowed.has(u.id);
          // a unit you already hold below ★★★ is the likeliest pick (the free recruit doubles as a step toward the next star)
          const held = {}, F = AMB.CONFIG.stars.rewardHeldWeight || 0;
          if (F) this.allUnits(p).forEach((u) => { if (u.star < AMB.CONFIG.stars.maxStar) held[u.defId] = (held[u.defId] || 0) + this.copiesOf(u); });
          const entries = Object.values(AMB.DATA.UNITS).filter((u) => u.tier === tier && this._pool(p)[u.id] > 0 && mine(u)).map((u) => [u.id, (u.world === hero.world ? 2 : 1) + (held[u.id] ? F * held[u.id] : 0)]);
          const any = entries.length ? entries : Object.values(AMB.DATA.UNITS).filter((u) => this._pool(p)[u.id] > 0 && mine(u)).map((u) => [u.id, 1]);
          const defId = this._rng(p).weighted(any);
          if (defId) { out.unit = defId; out.text += ' → ' + AMB.DATA.UNITS[defId].name; this._grantUnit(p, defId); }
          break;
        }
      }
      o.claimed = true; o.chosen = id;
      p.rewardLog.push({ round: this.round, id, stage: st });
      return out;
    }

    /** a free unit goes to the bench (merging if it completes a trio); if there is no room it converts to its gold cost */
    _grantUnit(p, defId) {
      this._pool(p)[defId]--;
      const unit = { uid: this._uid(p), defId, star: 1, items: [] };
      const idx = p.bench.indexOf(null);
      if (idx >= 0) p.bench[idx] = unit; else p._overflow = unit;
      this._merge(p, unit);
    }

    /** compact facts about one player's match, for the battle pass (xp + missions) */
    summary(pi) {
      const p = this.players[pi], last = this.history[this.history.length - 1];
      const board = last ? last.players[pi].board : [];
      const worlds = new Set(board.map((u) => AMB.DATA.UNITS[u.defId].world));
      const opp = this.players[1 - pi];
      const mode = this.mode === 'short' ? 'short' : this.rules ? 'campaign' : this.mode === 'friendly' ? 'friendly' : this.mode === 'hotseat' ? 'hotseat' : (opp.difficulty || 'normal');
      return { mode, won: this.winner === pi, roundsPlayed: this.round, roundsWon: p.stats.wins,
        finaleWon: !!(last && last.round >= AMB.CONFIG.match.maxRounds && last.winner === pi),
        buys: p.stats.unitsBought, rerolls: p.stats.rerolls, merges: p.stats.merges, summoned: this.history.some((r) => r.players[pi].summoned),
        stageRewards: p.rewardLog.length, damage: p.stats.damageDealt, worldsUsed: worlds.size };
    }

    /** Scripted (campaign) opponent: put the fixed line-up on the board for this round. */
    applyLineup(pi) {
      const p = this.players[pi], L = p.lineup;
      p.board = {}; p.bench = p.bench.map(() => null); p.shop = []; p.itemShop = [];
      L.units.forEach(([defId, star, slot, from], k) => {
        if ((from || 1) > this.round) return;
        p.board[slot] = { uid: 'e' + k + defId, defId, star: Math.min(star || 1, AMB.CONFIG.stars.maxStar), items: [] };
      });
      { const n = Object.keys(p.board).length, bs = AMB.CONFIG.economy.boardSize; p.level = Math.max(1, bs.findIndex((x) => x >= n) + 1 || bs.length); }
      p.summoned = !!L.summon; if (L.summon) p.heroSlot = L.summon;
      p.blessings = Object.assign({ atkPct: 0, hpPct: 0, asPct: 0 }, L.blessings || {});
      p.essence = 99; p.abilities = {};
      (L.abilities || []).forEach((id) => (p.abilities[id] = 'start'));
    }

    get isOver() { return this.phase === 'over'; }

    _fail(reason) { return { ok: false, reason }; }
  }

  AMB.Match = Match;
  AMB.SLOTS = SLOTS;
})();

;
/* core/ai.js */
/*
 * Heuristic AI. Used for the "vs AI" mode and for headless balance testing.
 * Styles: 'mono' (chases the hero's world), 'mixed' (role coverage +
 * convergence), 'balanced' (in between). Difficulty only changes how many
 * mistakes it makes and how greedy it is — it never cheats (same shop, same
 * pool, same timer budget of actions).
 */
(function () {
  const AMB = (globalThis.AMB = globalThis.AMB || {});
  const FRONT = ['f1', 'f2', 'f0', 'f3'];
  const BACK = ['b1', 'b2', 'b0', 'b3'];
  const DEFAULT_TRIGGER = {
    buffAllies: 'start', damageCluster: 'start', shieldAllies: 'start', healAllies: 'firstDeath',
    stunEnemies: 'start', frontDR: 'start', stunFront: 'start',
  };

  function power(u) {
    const def = AMB.DATA.UNITS[u.defId];
    return AMB.SHOP.statMult[def.tier] * AMB.CONFIG.stars.mult[u.star] + u.items.length * 0.35;
  }

  function wantScore(match, p, defId) {
    const { UNITS, HEROES } = AMB.DATA;
    const def = UNITS[defId];
    const hero = HEROES[p.heroId];
    const owned = match.allUnits(p);
    let s = 0;
    const sameStar1 = owned.filter((u) => u.defId === defId && u.star === 1).length;
    const sameAny = owned.filter((u) => u.defId === defId).length;
    const sameStar2 = owned.filter((u) => u.defId === defId && u.star === 2).length;
    s += sameStar1 * 2.6 + (sameAny - sameStar1 - sameStar2) * 0.3;   // copies toward the 3-card merge are worth chasing
    const style = p.aiStyle;
    if (def.world === hero.world) s += style === 'mono' ? 3 : style === 'balanced' ? 1.4 : 0.4;
    const roles = {};
    const worlds = new Set();
    owned.forEach((u) => { const d = UNITS[u.defId]; roles[d.role] = (roles[d.role] || 0) + 1; worlds.add(d.world); });
    if (!roles[def.role]) s += style === 'mixed' ? 2 : 1;
    if (def.role === 'guardian' && (roles.guardian || 0) < 2) s += 1.2;
    if (style === 'mixed' && !worlds.has(def.world)) s += 1.2;
    s += def.tier * 0.55;
    if (match.round <= 3) s += 1.5; // early: any body helps
    return s;
  }

  function reserveTarget(match, p) {
    if (match.round <= 2) return 0;
    if (p.life < 35) return 0;
    if (match.round <= 4) return 10;
    return p.life > 60 ? 30 : 20;
  }

  function arrange(match, p, rng, cfg) {
    const { UNITS } = AMB.DATA;
    const all = match.allUnits(p);
    // a little foresight: prefer units that activate synergies with the rest
    const ranked = all.slice().sort((a, b) => power(b) - power(a) || UNITS[b.defId].tier - UNITS[a.defId].tier);
    const chosen = [];
    const seen = new Set();
    for (const u of ranked) {
      if (chosen.length >= match.boardCap(p)) break;
      if (seen.has(u.defId) && ranked.some((x) => !seen.has(x.defId) && !chosen.includes(x) && power(x) >= power(u) * 0.7)) continue;
      chosen.push(u); seen.add(u.defId);
    }
    for (const u of ranked) { if (chosen.length >= match.boardCap(p)) break; if (!chosen.includes(u)) chosen.push(u); }

    const front = chosen.filter((u) => ['guardian', 'fighter', 'assassin'].includes(UNITS[u.defId].role));
    const back = chosen.filter((u) => !front.includes(u));
    if (!front.length && back.length > 1) { // somebody has to hold the line
      back.sort((a, b) => UNITS[b.defId].hp * AMB.CONFIG.stars.mult[b.star] - UNITS[a.defId].hp * AMB.CONFIG.stars.mult[a.star]);
      front.push(back.shift());
    }
    while (front.length > 4) back.push(front.pop());
    while (back.length > 4) front.push(back.pop());

    p.board = {};
    const heroBack = p.summoned;
    const backSlots = BACK.slice();
    if (heroBack) { p.heroSlot = back.length < 4 ? backSlots.pop() : FRONT.find((s, i) => i >= front.length) || 'b3'; }
    const fr = AMB.Match.placeByRole(front, FRONT), bk = AMB.Match.placeByRole(back, backSlots);   // every unit in the slot of its own role = its role bonus
    Object.assign(p.board, fr.out, bk.out);
    if (cfg.mistakes && rng.chance(cfg.mistakes * 0.5) && front.length && back.length) { // occasional misplacement
      const f = FRONT[0], b = backSlots[0];
      const t = p.board[f]; p.board[f] = p.board[b]; p.board[b] = t;
      if (!p.board[f]) delete p.board[f];
      if (!p.board[b]) delete p.board[b];
    }
    if (heroBack && p.board[p.heroSlot]) p.summoned = false;

    const rest = all.filter((u) => !chosen.includes(u));
    p.bench = new Array(AMB.CONFIG.economy.benchSize).fill(null);
    rest.sort((a, b) => power(b) - power(a));
    rest.forEach((u, i) => {
      if (i < p.bench.length) p.bench[i] = u;
      else { p.gold += match.sellValue(u); match._pool(p)[u.defId] += match.copiesOf(u); match._stash(p, u.items); }
    });
  }

  // how well an equipment piece fits the current board (0 = no good holder)
  function itemFit(match, p, it) {
    const board = match.allUnits(p).filter((u) => u.items.length < AMB.CONFIG.economy.maxItemsPerUnit);
    if (!board.length) return 0;
    const tank = board.some((u) => ['guardian', 'fighter'].includes(AMB.DATA.UNITS[u.defId].role));
    if (it.id === 'star_plate') return tank ? 1 : 0.3;
    if (it.id === 'mana_prism') return board.some((u) => ['mage', 'support'].includes(AMB.DATA.UNITS[u.defId].role)) ? 1 : 0.4;
    return 1;
  }

  function prep(match, pi) {
    const p = match.players[pi];
    if (p.lineup) return;   // scripted campaign enemy: its board is set by match.applyLineup
    let cfg = AMB.CONFIG.ai[p.difficulty] || AMB.CONFIG.ai.normal;
    if (cfg.adaptive) {   // expert reads the opponent: a greedy opponent (big bank) gets punished with faster levels
      const foe0 = match.players[1 - pi];
      if (foe0 && foe0.gold >= 20) cfg = Object.assign({}, cfg, { levelAggro: cfg.levelAggro * 1.3, reserveCap: 2 });
    }
    const rng = AMB.util.RNG(match.seed + match.round * 7919 + pi * 31);
    const E = AMB.CONFIG.economy;
    const hero = AMB.DATA.HEROES[p.heroId];

    // --- leveling
    const reserve = cfg.reserveCap && match.round > 4 ? Math.min(cfg.reserveCap, reserveTarget(match, p)) : reserveTarget(match, p);
    let guard = 0;
    // the AI follows a level plan by round (levelAggro stretches it): it buys the next shop level when the plan says so and the price leaves it a little reserve
    const want = Math.min(cfg.maxLevel || E.maxLevel, 1 + Math.floor((match.round - 1) * 0.62 * cfg.levelAggro + 0.5));
    while (guard++ < 4 && p.level < (cfg.maxLevel || E.maxLevel) && match.round >= 2) {
      const cost = match.upgradeCost(p);
      if (p.level < want && p.gold - cost >= Math.min(2, reserve * 0.2)) match.buyXp(pi); else break;
    }

    // --- equipment first: it stays on the unit (and moves with it on a merge), so one piece every other round is a sound buy
    if (!cfg.noItems && match.round >= 2) {
      const owned = p.items.filter((id) => AMB.DATA.ITEMS[id].kind === 'equip').length + match.allUnits(p).reduce((n, u) => n + u.items.length, 0);
      const want = Math.floor(match.round / 2) + (cfg.itemGreed || 0);
      let best = -1, bs = 0;
      p.itemShop.forEach((id, i) => {
        const it = id && AMB.DATA.ITEMS[id];
        if (!it || it.kind !== 'equip' || p.gold < it.cost + (cfg.itemKeep == null ? 2 : cfg.itemKeep)) return;
        const sc = itemFit(match, p, it);
        if (sc > bs) { bs = sc; best = i; }
      });
      if (best >= 0 && owned < want) match.buyItem(pi, best);
    }

    // --- buying / rerolling
    let rerolls = 0;
    for (let iter = 0; iter < 25; iter++) {
      let best = -1, bestScore = -Infinity;
      p.shop.forEach((id, i) => {
        if (!id || !match.canBuy(pi, i).ok) return;
        const sc = wantScore(match, p, id) + rng.next() * 0.5;
        if (sc > bestScore) { bestScore = sc; best = i; }
      });
      const roomForMore = match.allUnits(p).length < match.boardCap(p) + E.benchSize - 1;
      const threshold = match.round <= 2 ? 1 : 3.2;
      if (best >= 0 && bestScore >= threshold && roomForMore) {
        const cost = AMB.DATA.UNITS[p.shop[best]].cost;
        const mustHave = bestScore >= 5.5;
        if (p.gold - cost >= reserve || mustHave) {
          if (rng.chance(cfg.mistakes * 0.3)) { p.shop[best] = p.shop[best]; } else { match.buy(pi, best); match.autoPickMerge(pi); continue; }
        }
      }
      const canReroll = p.freeRerolls > 0 || p.gold - E.rerollCost >= reserve + 2;
      if (canReroll && rerolls < 6 && rng.chance(cfg.rerollGreed) && match.round >= 2) { match.reroll(pi); rerolls++; continue; }
      break;
    }

    match.autoPickMerge(pi);

    // --- items: spells only with spare gold (they last one combat)
    const foe = match.players[1 - pi], hasAssassin = match.allUnits(p).some((u) => AMB.DATA.UNITS[u.defId].role === 'assassin');
    if (!cfg.noItems) p.itemShop.forEach((id, i) => {
      if (!id || AMB.DATA.ITEMS[id].kind !== 'spell') return;
      const it = AMB.DATA.ITEMS[id];
      if (id === 'rift_net') { if (foe && foe.summoned && p.gold >= it.cost) match.buyItem(pi, i); return; }   // the counter, only when it makes sense
      if (p.gold - it.cost >= reserve && match.boardCount(p) + p.bench.filter(Boolean).length >= 2 && rng.chance(0.7)) match.buyItem(pi, i);
    });

    // --- finale wager (teen #15): a player who is behind raises the stakes, a leader never does
    if (match.isFinale(match.round) && match.setWager) { const foe1 = match.players[1 - pi]; if (foe1 && foe1.life - p.life >= 15 && !cfg.noSummon) match.setWager(pi, true); }

    // --- hero summon decision (before arranging so a slot is kept)
    const aggressive = hero.id === 'kagira';
    const wantSummon = !cfg.noSummon && match.round >= (cfg.summonFrom || (aggressive ? 3 : 5)) && p.life - AMB.CONFIG.combat.summonKnockout >= (cfg.summonMinLife ? cfg.summonMinLife - AMB.CONFIG.combat.summonKnockout : aggressive ? 30 : 45);
    p.summoned = wantSummon && match.allUnits(p).length >= Math.min(match.boardCap(p), 3);

    arrange(match, p, rng, cfg);

    // --- equip: offensive items to the best carry, defensive to the best tank
    const board = match.boardUnits(p);
    for (let i = p.items.length - 1; i >= 0; i--) {
      const it = AMB.DATA.ITEMS[p.items[i]];
      if (it.kind !== 'equip') continue;
      const defensive = it.id === 'star_plate';
      const cands = board.filter((u) => u.items.length < E.maxItemsPerUnit)
        .filter((u) => defensive === ['guardian', 'fighter'].includes(AMB.DATA.UNITS[u.defId].role) || board.length < 3)
        .sort((a, b) => power(b) - power(a));
      if (cands.length) match.equip(pi, i, cands[0].uid);
    }
    for (let i = p.items.length - 1; i >= 0; i--) {
      if (AMB.DATA.ITEMS[p.items[i]].kind === 'spell' && p.armedSpells.length < E.maxArmedSpells) match.armSpell(pi, i);
    }

    // --- hero abilities
    p.abilities = {};
    const abil = hero.abilities.slice().sort((a, b) => b.cost - a.cost);
    abil.forEach((ab) => {
      let trig = DEFAULT_TRIGGER[ab.type] || 'start';
      if (rng.chance(cfg.mistakes)) trig = rng.pick(Object.keys(AMB.DATA.ABILITY_TRIGGERS));
      match.setAbility(pi, ab.id, trig);
    });
    match.autoFill(pi);
  }

  /** pick a reward for player pi (used by the AI player, by auto-play in tests, and as a safety net) */
  function claimReward(match, pi) {
    const p = match.players[pi], o = p.rewardOffer;
    if (!o || o.claimed) return null;
    const lvlRoom = p.level < AMB.CONFIG.economy.maxLevel;
    const score = (id) => {
      const board = Object.keys(p.board).length;
      switch (id) {
        case 'unit': return 6 + o.stage;
        case 'bless_atk': return 5.2 + (board >= 4 ? 0.8 : 0);
        case 'bless_hp': return 5 + (p.life < 70 ? 0.6 : 0);
        case 'bless_as': return 4.6;
        case 'heal': return p.life < 40 ? 9 : p.life < 60 ? 7 : p.life < 80 ? 4 : 1;   // a badly hurt hero heals before it recruits
        case 'xp': return lvlRoom ? 4.4 : 0.5;
        case 'gold': return 3.8;
        case 'invest': return p.life >= 60 ? 4.2 : 2;   // only a healthy player can afford to wait for the finale
        case 'essence': return 3.2;
        case 'item': return 3.5;
        default: return 0;
      }
    };
    let best = 0, bs = -1;
    o.options.forEach((id, i) => { const sc = score(id); if (sc > bs) { bs = sc; best = i; } });
    return match.claimReward(pi, best);
  }
  /** the merge reward: the AI takes the card it wants most */
  function pickMerge(match, pi) {
    const p = match.players[pi]; if (!p.mergePick) return 0;
    let best = 0, bs = -Infinity;
    p.mergePick.options.forEach((id, i) => { const sc = wantScore(match, p, id) + AMB.DATA.UNITS[id].tier * 0.4; if (sc > bs) { bs = sc; best = i; } });
    return best;
  }
  function claimRewards(match) { match.players.forEach((_, i) => { if (match.players[i].rewardOffer && !match.players[i].rewardOffer.claimed) claimReward(match, i); }); }

  AMB.AI = { prep, power, claimReward, claimRewards, pickMerge };
})();

;
/* core/telemetry.js */
/*
 * Balance telemetry: win rates per hero, unit usage / win rates, synergy
 * activation, match length. Stored in localStorage in the browser, in memory
 * for the headless simulator. Export as JSON from the Stats screen.
 */
(function () {
  const AMB = (globalThis.AMB = globalThis.AMB || {});
  const KEY = 'amb_telemetry_v1';

  function empty() {
    return { matches: 0, draws: 0, totalRounds: 0, totalSeconds: 0, heroes: {}, units: {}, synergies: {}, summons: { used: 0, wins: 0 }, styles: {}, recent: [] };
  }

  const memory = { data: empty() };
  const hasLS = () => { try { return typeof localStorage !== 'undefined' && localStorage !== null; } catch (e) { return false; } };

  function load() {
    if (!hasLS()) return memory.data;
    try { const d = JSON.parse(localStorage.getItem(KEY)); return d && typeof d === 'object' && !Array.isArray(d) ? Object.assign(empty(), d) : empty(); } catch (e) { return empty(); }   // missing fields of an older/partial record come from the defaults
  }
  function save(d) {
    if (!hasLS()) { memory.data = d; return; }
    try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* storage blocked: ignore */ }
  }

  function bump(obj, key, field, n) {
    obj[key] = obj[key] || {};
    obj[key][field] = (obj[key][field] || 0) + (n == null ? 1 : n);
  }

  /** Record a finished match. */
  function recordMatch(match, extra) {
    const d = load();
    d.matches++;
    if (match.winner === null) d.draws++;
    d.totalRounds += match.round;
    const secs = extra && extra.seconds != null ? extra.seconds : Math.round(((match.endedAt || Date.now()) - match.startedAt) / 1000);
    d.totalSeconds += secs;
    const last = match.history[match.history.length - 1];
    match.players.forEach((p, i) => {
      const won = match.winner === i;
      bump(d.heroes, p.heroId, 'picks');
      if (won) bump(d.heroes, p.heroId, 'wins');
      const styleKey = p.isAI ? 'ai:' + p.aiStyle : 'human';
      bump(d.styles, styleKey, 'picks');
      if (won) bump(d.styles, styleKey, 'wins');
      // units fielded at any point in the match (counted once per match)
      const fielded = new Set();
      match.history.forEach((r) => r.players[i].board.forEach((u) => fielded.add(u.defId)));
      fielded.forEach((id) => { bump(d.units, id, 'picks'); if (won) bump(d.units, id, 'wins'); });
      const finalBoard = last ? last.players[i].board : [];
      finalBoard.forEach((u) => { bump(d.units, u.defId, 'final'); if (u.star === 3) bump(d.units, u.defId, 'threeStar'); });
      const syns = new Set();
      match.history.forEach((r) => r.players[i].synergies.forEach((s) => syns.add(s)));
      syns.forEach((s) => { bump(d.synergies, s, 'picks'); if (won) bump(d.synergies, s, 'wins'); });
      const summoned = match.history.some((r) => r.players[i].summoned);
      if (summoned) { d.summons.used++; if (won) d.summons.wins++; }
    });
    d.recent.unshift({ at: Date.now(), mode: match.mode, heroes: match.players.map((p) => p.heroId), winner: match.winner, rounds: match.round, seconds: secs });
    d.recent = d.recent.slice(0, 20);
    save(d);
    return d;
  }

  function reset() { save(empty()); }

  AMB.telemetry = { load, save, recordMatch, reset, empty };
})();

;
/* core/save.js */
/*
 * One versioned save for every progression system (pass, collection, packs,
 * campaign, tower, daily, album…). Stored in the browser only.
 *
 *   const save = AMB.Save.create(localStorage);
 *   const st = save.get('tower');            // defaults filled in from the registry
 *   save.update('tower', (s) => { s.best = 3; });
 *
 * Adding a new system later = one AMB.Save.register(name, { defaults, migrate }) call;
 * older saves simply get that system's defaults the first time it is read.
 */
(function () {
  const AMB = (globalThis.AMB = globalThis.AMB || {});
  const KEY = 'amb_save_v1';
  const VERSION = 1;
  const LEGACY = { pass: 'amb_pass_v1' };          // per-system keys used before the unified save
  const REGISTRY = {};                              // name -> { defaults(now), version, migrate(old, fromVersion) }

  /** Describe a system's saved state. defaults() must return a fresh object every call. */
  function register(name, def) {
    if (!name || typeof def.defaults !== 'function') throw new Error('Save.register needs a name and defaults()');
    REGISTRY[name] = { version: def.version || 1, defaults: def.defaults, migrate: def.migrate || null };
  }

  // in-memory stand-in when localStorage is blocked (private mode, sandboxed previews…)
  function memoryStorage() { const m = {}; return { __mem: true, getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; } }; }
  function browserStorage() {
    try { const s = globalThis.localStorage, k = '__amb_t'; s.setItem(k, '1'); s.removeItem(k); return s; } catch (e) { return memoryStorage(); }
  }

  const clone = (o) => JSON.parse(JSON.stringify(o));
  const isObj = (o) => o && typeof o === 'object' && !Array.isArray(o);
  // fill keys missing from an older save with their default values (never overwrites saved values)
  function fill(dst, def) {
    for (const k of Object.keys(def)) {
      if (!(k in dst)) dst[k] = clone(def[k]);
      else if (isObj(dst[k]) && isObj(def[k])) fill(dst[k], def[k]);
    }
    return dst;
  }

  // hooks.onForeignWrite(cb): called when ANOTHER tab/window wrote our key. Default: the browser 'storage' event (it never fires in the tab that wrote).
  // a field whose saved type differs from its default's type (null where an object is expected, "x" where a number is expected, array vs object) is replaced by the default.
  // Unknown keys (from a newer game version) are kept; a default of null or an empty {} map accepts anything of an object kind.
  const kindOf = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);
  function repair(dst, def) {
    for (const k of Object.keys(def)) {
      const d = def[k], v = dst[k];
      if (d === null || d === undefined) continue;
      if (kindOf(v) !== kindOf(d)) { dst[k] = clone(d); continue; }
      if (isObj(d) && Object.keys(d).length) repair(v, d);
    }
    return dst;
  }

  function create(storage, nowFn, hooks) {
    const realStorage = !storage;
    storage = storage || browserStorage();
    const now = nowFn || (() => Date.now());
    let root = null, corrupt = false, recovered = false;
    const rawNow = (() => { try { return storage.getItem(KEY); } catch (e) { return null; } })();
    const dayOf = (t) => { const d = new Date(t); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
    try { root = JSON.parse(rawNow); } catch (e) { corrupt = true; }
    if (root !== null && (!isObj(root) || !isObj(root.systems))) { corrupt = true; root = null; }
    if (corrupt) {
      try { storage.setItem(KEY + '_corrupt', String(rawNow)); } catch (e) { /* ignore */ }
      // restore the automatic daily backup if there is one
      try { const bak = JSON.parse(storage.getItem(KEY + '_bak')); if (isObj(bak) && isObj(bak.systems)) { root = bak; recovered = true; } } catch (e) { /* no usable backup */ }
    } else if (root && root.bakDay !== dayOf(now())) {
      // automatic backup: once a day keep a copy of the save as it was before today's changes
      try { storage.setItem(KEY + '_bak', rawNow); } catch (e) { /* ignore */ }
    }
    if (!root) {
      root = { v: VERSION, created: now(), systems: {}, sysV: {} };
      // bring over data saved by older versions of the game (e.g. the battle pass)
      for (const [name, key] of Object.entries(LEGACY)) {
        try { const old = JSON.parse(storage.getItem(key)); if (isObj(old)) root.systems[name] = old; } catch (e) { /* ignore */ }
      }
    }
    root.sysV = root.sysV || {};
    root.bakDay = dayOf(now());
    let listeners = [];

    // every change is written to storage at once (nothing to "save" by hand); `updated` shows in the save screen
    // single writer: when another tab writes the save, this tab's copy is stale. It stops writing (so it can never overwrite the newer progress) and asks the player to reload.
    const checked = {};
    let locked = false, lockListeners = [];
    const lock = () => { if (locked) return; locked = true; lockListeners.forEach((f) => { try { f(); } catch (e) { /* ignore */ } }); };
    const hook = (hooks && hooks.onForeignWrite) || (realStorage && typeof window !== 'undefined' && window.addEventListener ? ((cb) => window.addEventListener('storage', (e) => { if (e.key === KEY || e.key === null) cb(); })) : null);
    if (hook) hook(lock);
    let failed = !!storage.__mem && realStorage, failListeners = [];   // memory fallback (private mode / blocked storage) means progress is lost on reload
    const noteFail = () => { if (failed) return; failed = true; failListeners.forEach((f) => { try { f(); } catch (e) { /* ignore */ } }); };
    const write = () => { if (locked) return false; try { root.updated = now(); storage.setItem(KEY, JSON.stringify(root)); failed = !!storage.__mem && realStorage; return true; } catch (e) { noteFail(); return false; } };
    write();

    /** State of one system: migrated + defaults filled. The returned object is live: change it, then call save.write(). */
    function get(name) {
      const reg = REGISTRY[name];
      let s = root.systems[name];
      if (!isObj(s)) s = root.systems[name] = reg ? reg.defaults(now()) : {};
      if (reg) {
        const from = root.sysV[name] || 1;
        if (reg.migrate && from < reg.version) { root.systems[name] = s = reg.migrate(s, from) || s; root.sysV[name] = reg.version; write(); }
        root.sysV[name] = reg.version;
        fill(s, reg.defaults(now()));
        if (!checked[name]) { checked[name] = true; repair(s, reg.defaults(now())); }
      }
      return s;
    }
    function set(name, data) { root.systems[name] = data; write(); emit(name); }
    function update(name, fn) { const s = get(name); const r = fn(s); write(); emit(name); return r; }
    function reset(name) { delete root.systems[name]; delete root.sysV[name]; write(); emit(name); }
    function emit(name) { listeners.forEach((f) => { try { f(name); } catch (e) { /* listener errors never break saving */ } }); }
    const onChange = (f) => { listeners.push(f); return () => { listeners = listeners.filter((x) => x !== f); }; };

    /** Adapter so modules written against a plain key/value store (pass.js) keep working inside the unified save. */
    function storageFor(name) {
      return {
        getItem: () => (root.systems[name] === undefined ? null : JSON.stringify(root.systems[name])),
        setItem: (k, v) => { try { root.systems[name] = JSON.parse(v); write(); emit(name); } catch (e) { /* ignore */ } },
        removeItem: () => reset(name),
      };
    }

    const exportJSON = () => JSON.stringify(root);
    function importJSON(text) {
      const r = JSON.parse(text);
      if (!isObj(r) || !isObj(r.systems)) throw new Error('ملف الحفظ مو صحيح');
      try { storage.setItem(KEY + '_preimport', JSON.stringify(root)); } catch (e) { /* ignore */ }   // the previous save stays recoverable
      const old = root; root = r; root.sysV = root.sysV || {}; root.bakDay = dayOf(now());
      Object.keys(checked).forEach((k) => delete checked[k]);   // re-validate every system against its defaults on next access
      if (!write()) { root = old; throw new Error('ما قدرت أحفظ: التبويب مقفول أو المتصفح يمنع الحفظ'); }
      emit('*'); return true;
    }
    /** the previous saves we keep: 'preimport' (before the last import), 'bak' (daily), 'corrupt' (the unreadable one) */
    function hasBackup(kind) { try { const r = JSON.parse(storage.getItem(KEY + '_' + kind)); return isObj(r) && isObj(r.systems); } catch (e) { return false; } }
    function restore(kind) {
      const r = JSON.parse(storage.getItem(KEY + '_' + kind));
      if (!isObj(r) || !isObj(r.systems)) throw new Error('ما فيه نسخة صالحة');
      try { storage.setItem(KEY + '_prerestore', JSON.stringify(root)); } catch (e) { /* ignore */ }
      root = r; root.sysV = root.sysV || {}; root.bakDay = dayOf(now());
      Object.keys(checked).forEach((k) => delete checked[k]);
      if (!write()) throw new Error('ما قدرت أحفظ: التبويب مقفول أو المتصفح يمنع الحفظ');
      emit('*'); return true;
    }

    return { get, set, update, reset, write, storageFor, hasBackup, restore, writeFailed: () => failed, onWriteFail: (f) => { failListeners.push(f); if (failed) f(); }, isLocked: () => locked, onLock: (f) => { lockListeners.push(f); if (locked) f(); }, onChange, exportJSON, importJSON, wasCorrupt: corrupt, recovered, updated: () => root.updated || 0, systems: () => Object.keys(root.systems), now };
  }

  AMB.Save = { create, register, KEY, VERSION, LEGACY, REGISTRY, memoryStorage, browserStorage };
})();

;
/* core/economy.js */
/*
 * Progression economy: every tunable number for the new systems lives here
 * (currencies now; packs, rarities, levels, tower… are added by later phases).
 * Plus two small shared helpers used by all progression systems:
 *   AMB.Wallet  – currency balances, saved in the unified save
 *   AMB.Events  – game events ("matchEnd", "cardUpgraded"…) that missions,
 *                 album, stars, etc. listen to, so systems don't call each other directly.
 * Nothing here can be bought with real money.
 */
(function () {
  const AMB = (globalThis.AMB = globalThis.AMB || {});

  const ECONOMY = {
    currencies: {
      shards: { name: 'شظايا', icon: 'gem', start: 100, max: 999999 },      // earned in missions/levels, spent on packs (new players start with 1 pack's worth, plus the gift packs)
    },
    // Card rarity. `power` and card levels only apply in progression fights (campaign, tower, events),
    // never in quick matches or same-device play, so those stay fair.
    //   copies[i] = duplicate copies needed to go from level i+1 to level i+2 (rarer = more copies).
    rarities: {
      common:    { name: 'عادي',     en: 'Common',    order: 1, color: '#9aa3ad', c2: '#5d6670', power: 1.00, copies: [2, 4, 8, 12] },
      rare:      { name: 'نادر',      en: 'Rare',      order: 2, color: '#3d8ff0', c2: '#1b4f99', power: 1.04, copies: [3, 6, 10, 15] },
      epic:      { name: 'ملحمي',     en: 'Epic',      order: 3, color: '#a855f7', c2: '#5b1d99', power: 1.08, copies: [4, 7, 12, 17] },
      legendary: { name: 'أسطوري', en: 'Legendary', order: 4, color: '#ff9f1a', c2: '#a34f00', power: 1.12, copies: [5, 9, 14, 20] },
    },
    // Packs. weights are % per card; pity guarantees `pity.rarity` in the pack after `pity.after` packs without one.
    // Duplicates of a card already at max level turn into shards (maxedRefund).
    packs: {
      basic: { id: 'basic', name: 'باكج الصدع', cost: { shards: 100 }, cards: 5,
        weights: { common: 70, rare: 22, epic: 7, legendary: 1 },
        pity: { rarity: 'legendary', after: 10 } },
    },
    maxedRefund: { common: 5, rare: 10, epic: 25, legendary: 60 },
    // 7-day login calendar: one reward per day you open the game. A missed day does not reset it;
    // after day 7 a new cycle starts. Day 7: a pack + a guaranteed card of this rarity or rarer.
    login: [
      { shards: 30 }, { shards: 40 }, { shards: 50 }, { shards: 60 }, { shards: 80 }, { shards: 100 },
      { packs: 1, card: 'rare', big: true },
    ],
    // Challenge tower: 30 floors, a short best-of-3 fight each (like the campaign), a boss every 5th floor.
    // Enemy line-ups are generated from the floor number (core/tower.js); `power` = enemy stat multiplier curve
    // one value per floor (a generated line-up is fixed, so each floor is calibrated alone) from tools/tune-tower.js:
    // a casual player with upgraded starter cards wins ~88% of floor 1 down to ~30% of floor 30 (bosses 12 points lower). More cards/upgrades go further.
    tower: {
      floors: 30, bossEvery: 5,
      unlock: { campaignLevel: 'l1' },                 // finish campaign level 1 first
      power: [1.76,2.24,1.91,2.31,1.36,1.99,1.94,2.09,1.74,1.51,1.89,1.69,2.04,1.81,1.61,2.61,1.46,1.46,1.94,1.31,1.44,1.34,1.14,1.14,0.96,1.91,0.89,1.19,1.56,2.04],   // per floor, from tools/tune-tower.js
      start: [{ from: 1, gold: 8, level: 3 }, { from: 15, gold: 12, level: 4 }, { from: 25, gold: 14, level: 5 }],
      rewards: { shardsFirst: 20, shardsLast: 50, passXp: 10, passXpBoss: 30, bossPack: 'basic', finalCard: 'epic' },   // first clear only
    },
    // Weekly event: a special 3-stage level (best-of-3 fights vs generated line-ups, the last is the event boss) that
    // changes every week (Monday to Sunday, local time) and cycles through the events in core/events.js. Each week's
    // first clears pay once; clearing the boss gives that event's EXCLUSIVE card (never in packs, kept forever).
    // `power`: enemy strength per event per stage, fitted by tools/tune-events.js.
    events: {
      epoch: [2026, 0, 5],                                   // a Monday: week 0
      unlock: { campaignLevel: 'l1' },
      stages: [{ n: 10 }, { n: 18 }, { n: 24, boss: true }],   // difficulty position (1..30, like tower floors)
      start: [{ gold: 10, level: 3 }, { gold: 12, level: 4 }, { gold: 14, level: 5 }],
      rewards: [{ shards: 40, passXp: 10 }, { shards: 60, passXp: 20, pack: 'basic' }, { shards: 100, passXp: 50, exclusive: true }],
      power: {ember: [1.72, 1.48, 1.46], tide: [1.99, 2.17, 1.68], neon: [1.71, 2.66, 1.44], sylvan: [1.71, 2.07, 1.54]},
    },
    // Guided first match: a fixed weak enemy (2 units, the 2nd joins in round 2), a little extra gold/level, a reward once
    tutorial: { start: { gold: 10, level: 1 }, enemy: [['thorn_fox', 1, 'f1', 1], ['pixel_sniper', 1, 'b1', 2], ['moss_warden', 1, 'f2', 3]], reward: { shards: 50 } },   // 3 rounds: 1 buy+place, 2 merge+refresh, 3 level up + send the hero
    // album: own all 5 units of a world -> its reward (once); own all 20 -> the grand reward
    album: {
      worlds: {
        ember: { shards: 300, title: 'alb_ember', frame: 'alb_ember' },
        tide: { shards: 300, title: 'alb_tide', frame: 'alb_tide' },
        neon: { shards: 300, title: 'alb_neon', frame: 'alb_neon' },
        sylvan: { shards: 300, title: 'alb_sylvan', frame: 'alb_sylvan' },
      },
      all: { packs: 3, title: 'alb_all' },
      card: { normal: 50, legendary: 100 },   // first time you get a character (starting roster excluded)
    },
    // Deck: progression fights (campaign / tower / events) draw their shop only from your deck of up to `size` units
    // (at least `min` to play); quick matches ignore it. Heroes are not part of the deck.
    deck: { size: 12, min: 8, roles: { guardian: 2, fighter: 2, assassin: 1, marksman: 2, mage: 2, support: 1 } },   // roles = auto-build quota
    // Welcome gift: 5 packs opened once by a new player (and once by old saves). `plan` = rarity of each card slot per pack
    // (c common, r rare, e epic; never legendary). The draw is re-rolled until the 25 cards cover every role and world.
    gift: {
      plan: ['cccrr', 'cccre', 'cccrr', 'cccre', 'cccrr'],
      need: { frontline: 5, ranged: 4, support: 2, assassin: 1, perWorld: 4 },   // minimums over the 25 cards: guardian+fighter, marksman+mage, support, assassin, cards per world
    },
    cards: {
      levelBonus: 0.07,        // +7% hp & attack per card level above 1 (progression fights only)
      allUnlocked: false,      // true = every card owned (dev / testing)
      // what a new player owns: the starter roster (8 basic units flagged `starter` in core/data.js) + the GIFT PACKS below
      // + ONE hero they pick at first play. Everything else (the 45 new characters, the other heroes) comes from
      // packs or the battle pass. Locks: hero choice in every mode (player 1), shop units only in progression fights;
      // quick/same-device matches keep every unit.
    },
  };

  // ---------------------------------------------------------------- wallet
  AMB.Save.register('wallet', {
    version: 1,
    defaults: () => {
      const b = {};
      for (const [id, c] of Object.entries(ECONOMY.currencies)) b[id] = c.start;
      return { balances: b, earned: {}, spent: {} };   // earned/spent totals feed stats and missions
    },
  });

  function Wallet(save, events) {
    const st = () => save.get('wallet');
    const known = (id) => { if (!ECONOMY.currencies[id]) throw new Error('ما أعرف هالعملة: ' + id); };
    const clampAdd = (id, v) => Math.min(ECONOMY.currencies[id].max, v);
    return {
      balance: (id) => { known(id); return st().balances[id] || 0; },
      canAfford: (cost) => Object.entries(cost || {}).every(([id, n]) => { known(id); return (st().balances[id] || 0) >= n; }),
      /** add currency; amount must be a positive integer. Returns the new balance. */
      add(id, n, why) {
        known(id); n = Math.floor(n);
        if (!(n > 0)) return this.balance(id);
        const r = save.update('wallet', (s) => { s.balances[id] = clampAdd(id, (s.balances[id] || 0) + n); s.earned[id] = (s.earned[id] || 0) + n; return s.balances[id]; });
        if (events) events.emit('currency', { id, n, why: why || '' });
        return r;
      },
      /** spend a cost like { shards: 100 }; all-or-nothing. Returns true when paid. */
      spend(cost, why) {
        if (!this.canAfford(cost)) return false;
        save.update('wallet', (s) => { for (const [id, n] of Object.entries(cost)) { s.balances[id] -= n; s.spent[id] = (s.spent[id] || 0) + n; } });
        if (events) events.emit('spend', { cost, why: why || '' });
        return true;
      },
    };
  }

  // ---------------------------------------------------------------- events
  function Events() {
    const map = {};
    return {
      on(name, fn) { (map[name] = map[name] || []).push(fn); return () => { map[name] = map[name].filter((f) => f !== fn); }; },
      emit(name, data) { (map[name] || []).slice().forEach((f) => { try { f(data); } catch (e) { if (globalThis.console) console.error('event ' + name, e); } }); },
    };
  }

  AMB.ECONOMY = ECONOMY;
  AMB.Wallet = Wallet;
  AMB.Events = Events;
})();

;
/* core/collection.js */
/*
 * Card collection: which cards the player owns, their level and spare duplicate copies.
 *  - every unit and hero is a card with a rarity (core/data.js) tuned in AMB.ECONOMY.rarities
 *  - duplicates (from packs, later phases) are spent to level a card up; rarer cards need more
 *  - power(id) = rarity power × level bonus. It is handed to a Match ONLY for progression fights
 *    (campaign / tower / events). Quick matches and same-device play never see it.
 */
(function () {
  const AMB = globalThis.AMB;
  const EC = () => AMB.ECONOMY;

  AMB.Save.register('collection', {
    version: 2,
    defaults: () => ({ cards: {}, upgrades: 0, starterHero: null, giftClaimed: false, deck: [] }),   // cards[id] = { owned, level, copies, got }
    // v1 -> v2 (gift-pack start): players who already had the 20 original units keep them, and may still claim the gift packs
    migrate: (s, from) => {
      if (from < 2 && s.starterHero) {
        s.cards = s.cards || {};
        (AMB.DATA.LEGACY_STARTERS || []).forEach((id) => { s.cards[id] = Object.assign({ owned: true, level: 1, copies: 0, got: 0 }, s.cards[id] || {}, { owned: true }); });
        s.giftClaimed = false; s.deck = [];
      }
      return s;
    },
  });

  const defOf = (id) => AMB.DATA.UNITS[id] || AMB.DATA.HEROES[id] || null;
  const allIds = () => Object.keys(AMB.DATA.HEROES).concat(Object.keys(AMB.DATA.UNITS));

  function Collection(save, events) {
    const st = () => save.get('collection');
    const rec = (s, id) => (s.cards[id] = s.cards[id] || { owned: false, level: 1, copies: 0, got: 0 });
    const R = (id) => { const d = defOf(id); if (!d) throw new Error('ما أعرف هالبطاقة: ' + id); return EC().rarities[d.rarity]; };
    const emit = (n, d) => events && events.emit(n, d);

    const api = {
      ids: allIds,
      def: defOf,
      rarity: (id) => defOf(id).rarity,
      rarityInfo: R,
      maxLevel: (id) => R(id).copies.length + 1,
      owned(id) {
        const d = defOf(id); if (!d) return false;
        if (EC().cards.allUnlocked) return true;
        if (st().cards[id] && st().cards[id].owned) return true;
        return !!d.role && !d.exclusive && !!d.starter;   // the original 20 units (flag set in core/data.js) are the starter roster
      },
      /** first-play hero choice (one time) */
      needsStarter: () => !st().starterHero,
      starterHero: () => st().starterHero,
      chooseStarter(heroId) {
        if (!AMB.DATA.HEROES[heroId] || st().starterHero || (AMB.DATA.HERO_STARTERS && !AMB.DATA.HERO_STARTERS.includes(heroId))) return false;
        save.update('collection', (s) => { s.starterHero = heroId; const c = rec(s, heroId); c.owned = true; });
        emit('cardAdded', { id: heroId, isNew: true, copies: 0, starter: true });
        return true;
      },
      ownedHeroes: () => Object.keys(AMB.DATA.HEROES).filter((id) => api.owned(id)),
      ownedUnits: () => Object.keys(AMB.DATA.UNITS).filter((id) => api.owned(id)),
      /** battle-pass character rewards give the card (unlock or +1 copy) */
      grantPassReward(r) { if (r && r.type === 'avatar' && defOf(r.id) && !AMB.DATA.HEROES[r.id]) return api.add(r.id, 1); return null; },   // a hero avatar from the pass is only a portrait: the hero itself is a campaign prize
      level: (id) => (st().cards[id] && st().cards[id].level) || 1,
      copies: (id) => (st().cards[id] && st().cards[id].copies) || 0,
      /** copies needed for the next level, or 0 when maxed */
      needed(id) { const lv = api.level(id); return lv >= api.maxLevel(id) ? 0 : R(id).copies[lv - 1]; },
      isMax: (id) => api.level(id) >= api.maxLevel(id),
      canUpgrade(id) { return api.owned(id) && !api.isMax(id) && api.copies(id) >= api.needed(id); },

      /** Give n copies of a card. The first copy of a card you don't own unlocks it. Returns what happened. */
      add(id, n) {
        n = Math.floor(n || 1); R(id);
        if (n <= 0) return null;
        const res = save.update('collection', (s) => {
          const c = rec(s, id); c.got += n;
          const isNew = !api.owned(id);   // starter units are owned without a record
          if (!c.owned) { c.owned = true; if (isNew) n -= 1; }
          c.copies += n;
          return { id, isNew, copies: n };
        });
        emit('cardAdded', res);
        return res;
      },
      /** Spend duplicates to raise a card one level. Returns the new level or 0. */
      upgrade(id) {
        if (!api.canUpgrade(id)) return 0;
        const need = api.needed(id);
        const lv = save.update('collection', (s) => { const c = rec(s, id); c.owned = true; c.copies -= need; c.level += 1; s.upgrades += 1; return c.level; });
        emit('cardUpgraded', { id, level: lv, rarity: api.rarity(id) });
        return lv;
      },
      // ---------------------------------------------------------------- deck + gift
      giftClaimed: () => !!st().giftClaimed,
      markGift() { save.update('collection', (s) => { s.giftClaimed = true; }); },
      deckLimits: () => ({ size: EC().deck.size, min: EC().deck.min }),
      /** the saved deck (only units you still own) */
      deck() { return (st().deck || []).filter((id) => AMB.DATA.UNITS[id] && api.owned(id)); },
      inDeck: (id) => api.deck().includes(id),
      deckValid: () => api.deck().length >= EC().deck.min,
      /** the units a progression fight may use: your deck, or every owned unit while no valid deck exists */
      playableUnits() { return api.deckValid() ? api.deck() : api.ownedUnits(); },
      roleCounts(ids) { const c = { guardian: 0, fighter: 0, assassin: 0, marksman: 0, mage: 0, support: 0 }; (ids || api.deck()).forEach((id) => { const d = AMB.DATA.UNITS[id]; if (d) c[d.role]++; }); return c; },
      setDeck(ids) {
        const out = []; (ids || []).forEach((id) => { if (AMB.DATA.UNITS[id] && api.owned(id) && !out.includes(id) && out.length < EC().deck.size) out.push(id); });
        save.update('collection', (s) => { s.deck = out; }); return out;
      },
      /** add/remove one unit; returns { ok, in, reason } */
      toggleDeck(id) {
        if (!AMB.DATA.UNITS[id] || !api.owned(id)) return { ok: false, reason: 'ما تملك هالوحدة' };
        const cur = api.deck();
        if (cur.includes(id)) { api.setDeck(cur.filter((x) => x !== id)); return { ok: true, in: false }; }
        if (cur.length >= EC().deck.size) return { ok: false, reason: `التشكيلة ممتلئة (${EC().deck.size})` };
        api.setDeck(cur.concat([id])); return { ok: true, in: true };
      },
      /** a balanced deck from what you own: role quotas first (strongest cards), then the best remaining, leaning on your two strongest worlds */
      autoBuild() {
        const D = EC().deck, R = EC().rarities;
        const owned = api.ownedUnits().map((id) => AMB.DATA.UNITS[id]);
        const score = (u) => u.tier * 10 + api.level(u.id) * 3 + R[u.rarity].order * 2;
        const byScore = (a, b) => score(b) - score(a) || (a.id < b.id ? -1 : 1);
        const wsum = {}; owned.forEach((u) => (wsum[u.world] = (wsum[u.world] || 0) + score(u)));
        const top = Object.keys(wsum).sort((a, b) => wsum[b] - wsum[a]).slice(0, 2);
        const sc = (u) => score(u) + (top.includes(u.world) ? 4 : 0);
        const chosen = [];
        Object.entries(D.roles).forEach(([role, n]) => owned.filter((u) => u.role === role).sort((a, b) => sc(b) - sc(a) || byScore(a, b)).slice(0, n).forEach((u) => chosen.push(u.id)));
        owned.filter((u) => !chosen.includes(u.id)).sort((a, b) => sc(b) - sc(a) || byScore(a, b)).forEach((u) => { if (chosen.length < D.size && api.roleCounts(chosen)[u.role] < 4) chosen.push(u.id); });
        owned.filter((u) => !chosen.includes(u.id)).sort(byScore).forEach((u) => { if (chosen.length < D.size) chosen.push(u.id); });
        return api.setDeck(chosen);
      },

      /** Unlock without copies (starter card, battle-pass reward…). */
      unlock(id) { R(id); return save.update('collection', (s) => { const c = rec(s, id); const was = c.owned; c.owned = true; return !was; }); },

      /** one random card of `minRarity` or rarer: prefers cards you don't own, then ones not at max level */
      grantRandom(minRarity, rng) {
        const R = EC().rarities; rng = rng || AMB.util.RNG(Math.floor(Math.random() * 2 ** 31));
        const all = allIds().filter((id) => !AMB.DATA.HEROES[id] && !defOf(id).exclusive && R[defOf(id).rarity].order >= R[minRarity].order);   // heroes come ONLY from finishing a campaign level on all three difficulties
        const pool = [all.filter((id) => !api.owned(id)), all.filter((id) => !api.isMax(id)), all].find((t) => t.length);
        const id = pool[rng.int(pool.length)];
        const res = api.add(id, 1);
        return { id, rarity: defOf(id).rarity, isNew: res.isNew };
      },
      /** stat multiplier of a card in progression fights */
      power(id) { return R(id).power * (1 + EC().cards.levelBonus * (api.level(id) - 1)); },
      /** { defId: multiplier } for every owned card — what a progression Match receives */
      powerMap() { const m = {}; allIds().forEach((id) => { if (api.owned(id)) m[id] = Math.round(api.power(id) * 1000) / 1000; }); return m; },
      ownedCount: () => allIds().filter((id) => api.owned(id)).length,
      totalUpgrades: () => st().upgrades,
    };
    return api;
  }

  AMB.Collection = Collection;
})();

;
/* core/packs.js */
/*
 * Card packs with a pity counter.
 *  - each card: roll a rarity by the pack's weights, then a random card of that rarity
 *    (cards marked `exclusive` — event rewards — never appear in packs)
 *  - pity: after `pity.after` packs in a row without a legendary, the next pack is guaranteed one
 *  - duplicates go to the collection as upgrade copies; copies of a max-level card become shards
 * Odds are shown to the player (oddsTable) — nothing is hidden.
 */
(function () {
  const AMB = globalThis.AMB;
  const EC = () => AMB.ECONOMY;

  AMB.Save.register('packs', {
    version: 1,
    defaults: () => ({ opened: 0, since: {}, found: { common: 0, rare: 0, epic: 0, legendary: 0 }, last: [], wish: null }),   // wish = the hero the guarantee brings (adult #25)   // since[packId] = packs since the pity rarity
  });

  function poolByRarity() {
    const pool = {};
    Object.values(AMB.DATA.UNITS).forEach((d) => {   // units only: heroes are campaign prizes
      if (d.exclusive) return;
      (pool[d.rarity] = pool[d.rarity] || []).push(d.id);
    });
    return pool;
  }

  function Packs(save, wallet, collection, events, rng) {
    rng = rng || AMB.util.RNG(Math.floor(Math.random() * 2 ** 31));
    const st = () => save.get('packs');
    const def = (id) => { const p = EC().packs[id || 'basic']; if (!p) throw new Error('باكج غير معروف: ' + id); return p; };

    function rollRarity(p) {
      const w = p.weights, total = Object.values(w).reduce((a, b) => a + b, 0);
      let r = rng.next() * total;
      for (const [k, v] of Object.entries(w)) { r -= v; if (r < 0) return k; }
      return 'common';
    }

    const api = {
      def,
      /** packs left before the guarantee kicks in; 0 = the next pack is guaranteed */
      pityLeft(id) { const p = def(id); return Math.max(0, p.pity.after - (st().since[p.id] || 0)); },
      canOpen(id) { return wallet.canAfford(def(id).cost); },
      oddsTable(id) { const p = def(id), total = Object.values(p.weights).reduce((a, b) => a + b, 0); return Object.entries(p.weights).map(([r, w]) => ({ rarity: r, pct: (100 * w) / total })); },
      stats: () => st(),
      wish: () => null,   // (removed: heroes are no longer in packs)
      setWish: () => false,

      /** Pay and open a pack. Returns { cards:[{id,rarity,isNew,refund,level,copies}], pity, shards } or null when unaffordable. */
      open(id, opts) {
        const p = def(id);
        if (!(opts && opts.free) && !wallet.spend(p.cost, 'pack:' + p.id)) return null;
        const pool = poolByRarity();
        const forced = api.pityLeft(p.id) === 0;
        const rar = [];
        for (let i = 0; i < p.cards; i++) rar.push(rollRarity(p));
        if (forced && !rar.includes(p.pity.rarity)) rar[rar.length - 1] = p.pity.rarity;   // the guarantee
        let refund = 0;
        const cards = rar.map((r) => {
          const list = pool[r] && pool[r].length ? pool[r] : pool.common;
          let cid = list[rng.int(list.length)];
          const rarity = AMB.DATA.UNITS[cid] ? AMB.DATA.UNITS[cid].rarity : AMB.DATA.HEROES[cid].rarity;
          if (collection.owned(cid) && collection.isMax(cid)) {
            const n = EC().maxedRefund[rarity] || 0; refund += n;
            return { id: cid, rarity, isNew: false, refund: n, level: collection.level(cid) };
          }
          const res = collection.add(cid, 1);
          return { id: cid, rarity, isNew: res.isNew, refund: 0, level: collection.level(cid), copies: collection.copies(cid), canUpgrade: collection.canUpgrade(cid) };
        });
        if (refund) wallet.add('shards', refund, 'pack-refund');
        const hit = cards.some((c) => c.rarity === p.pity.rarity);
        save.update('packs', (s) => {
          s.opened += 1;
          s.since[p.id] = hit ? 0 : (s.since[p.id] || 0) + 1;
          cards.forEach((c) => (s.found[c.rarity] = (s.found[c.rarity] || 0) + 1));
          s.last = cards.map((c) => c.id);
        });
        const out = { pack: p.id, cards, forced, refund, pityLeft: api.pityLeft(p.id) };
        if (events) events.emit('packOpened', out);
        return out;
      },
    };
    /**
     * The welcome gift: 5 packs opened once (collection.giftClaimed). Units only, no legendary/hero/exclusive, a fixed rarity plan
     * (EC.gift.plan) and a re-drawn deal until the 25 cards cover every role and every world (EC.gift.need), so a new player
     * can always build a playable first deck. Returns an array of pack-like results, or null when already claimed.
     */
    api.gift = function (seed) {
      if (collection.giftClaimed()) return null;
      const G = EC().gift, need = G.need, grng = AMB.util.RNG(seed != null ? seed : Math.floor(rng.next() * 2 ** 31));
      const units = Object.values(AMB.DATA.UNITS).filter((u) => !u.exclusive && !u.starter);
      const pool = { c: units.filter((u) => u.rarity === 'common'), r: units.filter((u) => u.rarity === 'rare'), e: units.filter((u) => u.rarity === 'epic') };
      const okDeal = (cards) => {
        const n = { frontline: 0, ranged: 0, support: 0, assassin: 0 }, wc = {};
        cards.forEach((u) => { if (u.role === 'guardian' || u.role === 'fighter') n.frontline++; else if (u.role === 'marksman' || u.role === 'mage') n.ranged++; else n[u.role]++; wc[u.world] = (wc[u.world] || 0) + 1; });
        return n.frontline >= need.frontline && n.ranged >= need.ranged && n.support >= need.support && n.assassin >= need.assassin && Object.keys(AMB.DATA.WORLDS).every((w) => (wc[w] || 0) >= need.perWorld);
      };
      let deal = null;
      for (let tries = 0; tries < 400 && !deal; tries++) {
        const cnt = {}, cards = [];
        G.plan.forEach((slots) => slots.split('').forEach((k) => {
          let u, guard = 0;
          do { u = pool[k][grng.int(pool[k].length)]; } while (((cnt[u.id] || 0) >= (k === 'c' ? 2 : 1)) && ++guard < 50);
          cnt[u.id] = (cnt[u.id] || 0) + 1; cards.push(u);
        }));
        if (okDeal(cards)) deal = cards;
      }
      if (!deal) throw new Error('gift deal failed');
      const results = G.plan.map((slots, i) => ({ pack: 'gift', cards: deal.slice(i * slots.length, (i + 1) * slots.length).map((u) => {
        const r = collection.add(u.id, 1);
        return { id: u.id, rarity: u.rarity, isNew: r.isNew, refund: 0, level: collection.level(u.id), copies: collection.copies(u.id), canUpgrade: collection.canUpgrade(u.id) };
      }), forced: false, refund: 0, pityLeft: api.pityLeft('basic') }));
      collection.markGift();
      if (events) events.emit('giftOpened', { packs: results });
      return results;
    };
    return api;
  }

  AMB.Packs = Packs;
  AMB.Packs.pool = poolByRarity;
})();

;
/* core/levels.js */
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
    rules: { maxRounds: 8, winsNeeded: 5 },          // up to 8 rounds: first to 5 round wins takes the fight (4-4 after 8: more life)
    // boss fights are long: best of 7 rounds. The boss line-up keeps growing (extra units join later, and everything gets `growth` stronger each round)
    bossRules: { maxRounds: 8, winsNeeded: 5, growth: 0.07 },
    rewards: {
      fight: { shards: 20, passXp: 20 },
      boss: { shards: 60, passXp: 40 },
      level: { pack: 'basic' },                       // bonus for clearing every fight of a level
      replay: { shards: 5 },
      // boss fights: EVERY star pays its own prize, once (the first time you reach that star)
      bossStars: [
        { shards: 310, passXp: 110, packs: 1, card: 'rare' },   // the boss's one star pays everything at once, once
      ],
    },
    // star per fight: 1 = a win. Star totals open chests (each once).
    stars: {
      rules: [
        { n: 1, text: 'فوز' },
      ],
      chests: [
        { id: 'ch10', need: 3, name: 'صندوق برونزي', reward: { shards: 100 } },
        { id: 'ch25', need: 8, name: 'صندوق فضي', reward: { packs: 1 } },
        { id: 'ch40', need: 13, name: 'صندوق ذهبي', reward: { packs: 2 } },
        { id: 'ch60', need: 20, name: 'صندوق الصدع', reward: { card: 'epic' } },   // one guaranteed card of this rarity or rarer
        { id: 'ch80', need: 27, name: 'صندوق الأتون الملكي', reward: { shards: 200, packs: 1 } },
        { id: 'ch100', need: 33, name: 'صندوق الزعماء', reward: { packs: 2, card: 'epic' } },
        { id: 'ch120', need: 40, name: 'صندوق الأسطورة', reward: { shards: 400, card: 'legendary' } },
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

;
/* core/campaign.js */
/*
 * Campaign progress: which fights are unlocked / cleared, building a fight's match and paying rewards.
 * Three difficulties (easy / medium / hard) each keep their OWN progress, stars, chests and boss prizes; the difficulty
 * you picked last is the current one and every call below defaults to it. Level data: core/levels.js.
 *
 *   easy   weaker enemies, smaller prizes          medium  the original campaign          hard  stronger enemies, bigger prizes
 *   Hard unlocks for a level once you have finished that level on medium.
 */
(function () {
  const AMB = globalThis.AMB;
  const LV = () => AMB.LEVELS;
  const DIFFS = ['easy', 'normal', 'hard'];
  const RARITY_ORDER = ['common', 'rare', 'epic', 'legendary'];

  /** stars for one result: 0 = loss, 1 = win, 2 = no round lost, 3 = no round lost and full hero life */
  function rate(res) {
    if (!res || !res.won) return 0;
    return 1;   // a fight is worth one star: a win (8-round fights made 'no round lost' stars unfair)
  }
  const blank = () => ({ cleared: {}, levelsDone: {}, stats: {}, stars: {}, chests: [], bossPaid: {} });
  // a guaranteed card one tier lower (easy) or higher (hard)
  const shiftCard = (r, by) => RARITY_ORDER[Math.max(0, Math.min(RARITY_ORDER.length - 1, RARITY_ORDER.indexOf(r) + by))];
  /** a prize scaled for a difficulty: shards/xp by their multipliers, packs rounded down, guaranteed card one tier up or down */
  function scaled(rw, d) {
    const x = LV().DIFFICULTY[d], o = {};
    if (rw.shards) o.shards = Math.round(rw.shards * x.shards);
    if (rw.passXp) o.passXp = Math.round(rw.passXp * x.xp);
    if (rw.packs) o.packs = Math.floor(rw.packs * x.packs + 1e-9);
    if (rw.card) o.card = shiftCard(rw.card, x.cardTier);
    return o;
  }

  AMB.Save.register('campaign', {
    version: 3,
    // d[difficulty] = { cleared[fightId], levelsDone[levelId], stats[fightId] = { attempts, wins, best }, stars[fightId] = best 1..3, chests = claimed ids, bossPaid[fightId] = highest boss star paid }
    defaults: () => ({ diff: 'normal', d: { easy: blank(), normal: blank(), hard: blank() } }),
    migrate: (s, from) => {
      if (s.cleared) {   // saves from before difficulties: everything played so far was the medium campaign
        if (from < 2) { s.stars = s.stars || {}; Object.keys(s.cleared).forEach((id) => { const b = (s.stats[id] || {}).best; s.stars[id] = Math.max(1, b ? rate(Object.assign({ won: true }, b)) : 1); }); }
        // a boss already beaten under the old rules was paid its first-win prize (= star 1): never pay it again (stars are NOT re-rated here; only the v1 saves above are)
        const bp = Object.assign({}, s.bossPaid || {}); Object.keys(s.cleared).forEach((id) => { if (/boss$/.test(id)) bp[id] = Math.max(bp[id] || 0, 1); });
        s.d = { easy: blank(), hard: blank(), normal: { cleared: s.cleared, levelsDone: s.levelsDone || {}, stats: s.stats || {}, stars: s.stars || {}, chests: s.chests || [], bossPaid: bp } };
        ['cleared', 'levelsDone', 'stats', 'stars', 'chests', 'bossPaid'].forEach((k) => delete s[k]);
        s.diff = 'normal';
      }
      return s;
    },
  });

  function Campaign(save, deps) {
    deps = deps || {};
    const st = () => save.get('campaign');
    const levels = () => LV().LEVELS;
    const diff = () => (DIFFS.includes(st().diff) ? st().diff : 'normal');
    const dd = (d) => (DIFFS.includes(d) ? d : diff());
    const P = (d) => st().d[dd(d)];

    function find(fightId) {
      for (let li = 0; li < levels().length; li++) {
        const l = levels()[li], fi = l.fights.findIndex((f) => f.id === fightId);
        if (fi >= 0) return { level: l, li, fight: l.fights[fi], fi };
      }
      return null;
    }
    const grantCard = (minRarity) => deps.collection.grantRandom(minRarity, deps.rng);
    const anyDiff = (fn) => DIFFS.some((d) => fn(d));

    const api = {
      levels, find, rate, DIFFS,
      diff, setDiff(d) { if (DIFFS.includes(d)) { save.update('campaign', (s) => { s.diff = d; }); } return diff(); },
      difficulty: (d) => LV().DIFFICULTY[dd(d)],
      /** hard needs the level finished on medium (and the previous hard level); easy and medium follow their own chain */
      isCleared: (fightId, d) => (d ? !!P(d).cleared[fightId] : anyDiff((x) => !!P(x).cleared[fightId])),   // no difficulty = on ANY difficulty (used by the other systems' unlocks)
      /** the hero of a level is a prize: finish ALL fights of that level on easy, medium AND hard */
      heroOf: (levelId) => { const l = levels().find((x) => x.id === levelId); return l ? l.hero : null; },
      levelDiffs: (levelId) => Object.fromEntries(DIFFS.map((x) => [x, !!P(x).levelsDone[levelId]])),
      levelAll: (levelId) => DIFFS.every((x) => !!P(x).levelsDone[levelId]),
      /** grants every hero whose level is finished on all three difficulties (safe to call any time). Returns the newly granted hero ids. */
      syncHeroes() {
        const got = [];
        levels().forEach((l) => { if (l.hero && api.levelAll(l.id) && deps.collection && !deps.collection.owned(l.hero)) { deps.collection.add(l.hero, 1); got.push(l.hero); } });
        return got;
      },
      levelDone: (levelId, d) => (d ? !!P(d).levelsDone[levelId] : anyDiff((x) => !!P(x).levelsDone[levelId])),
      progress(levelId, d) { const l = levels().find((x) => x.id === levelId); return { cleared: l.fights.filter((f) => P(d).cleared[f.id]).length, total: l.fights.length }; },
      // everything is open from the start: any level, any fight (boss included), any difficulty, in any order
      levelUnlocked() { return true; },
      isUnlocked(fightId) { return !!find(fightId); },
      /** first unlocked fight not yet cleared on this difficulty (or null when everything is done) */
      next(d) { for (const l of levels()) for (const f of l.fights) if (api.isUnlocked(f.id, d) && !P(d).cleared[f.id]) return f.id; return null; },
      stats: (fightId, d) => P(d).stats[fightId] || { attempts: 0, wins: 0, best: null },
      stars: (fightId, d) => Math.min(1, P(d).stars[fightId] || 0),
      levelStars(levelId, d) { const l = levels().find((x) => x.id === levelId); return l.fights.reduce((a, f) => a + api.stars(f.id, d), 0); },
      totalStars(d) { return levels().reduce((a, l) => a + api.levelStars(l.id, d), 0); },
      maxStars() { return levels().reduce((a, l) => a + l.fights.length, 0); },
      /** chests with state 'claimed' | 'ready' | 'locked'; rewards already scaled for the difficulty */
      chests(d) { d = dd(d); const tot = api.totalStars(d); return LV().CAMPAIGN.stars.chests.map((c) => Object.assign({}, c, { reward: scaled(c.reward, d), state: P(d).chests.includes(c.id) ? 'claimed' : tot >= c.need ? 'ready' : 'locked' })); },
      readyChests: (d) => api.chests(d).filter((c) => c.state === 'ready').length,
      claimChest(id, d) {
        d = dd(d);
        const c = api.chests(d).find((x) => x.id === id);
        if (!c || c.state !== 'ready') return null;
        save.update('campaign', (s) => { s.d[d].chests.push(id); });
        const out = { id, difficulty: d, shards: 0, packs: [], card: null }, rw = c.reward;
        if (rw.shards && deps.wallet) { deps.wallet.add('shards', rw.shards, 'chest'); out.shards = rw.shards; }
        for (let i = 0; i < (rw.packs || 0); i++) if (deps.packs) out.packs.push(deps.packs.open('basic', { free: true }));
        if (rw.card && deps.collection) out.card = grantCard(rw.card);
        if (deps.events) deps.events.emit('chestOpened', out);
        return out;
      },
      bossPaid: (fightId, d) => P(d).bossPaid[fightId] || 0,
      /** boss prizes per star (scaled for the difficulty) with their state: 'paid' | 'next' | 'locked' */
      bossPrizes(fightId, d) {
        d = dd(d); const paid = api.bossPaid(fightId, d), got = api.stars(fightId, d);
        return LV().CAMPAIGN.rewards.bossStars.map((p, i) => Object.assign({ star: i + 1 }, scaled(p, d), { state: i < paid ? 'paid' : i === paid ? 'next' : 'locked', reached: i < got }));
      },
      rewardsFor(fightId, d) {
        d = dd(d);
        const f = find(fightId), R = LV().CAMPAIGN.rewards, X = LV().DIFFICULTY[d];
        const lastOfLevel = f.level.fights.filter((x) => !P(d).cleared[x.id]).length === 1;
        const levelBonus = lastOfLevel ? { packs: X.levelPacks, shards: X.levelShards } : null;
        if (f.fight.boss) {   // a boss pays by star, not by "first win"
          const prizes = api.bossPrizes(fightId, d), left = prizes.filter((p) => p.state !== 'paid');
          return { boss: true, difficulty: d, replay: !left.length, shards: Math.max(1, Math.round(R.replay.shards * X.shards)), passXp: 0, prizes, levelBonus };
        }
        if (P(d).cleared[fightId]) return { replay: true, difficulty: d, shards: Math.max(1, Math.round(R.replay.shards * X.shards)), passXp: 0 };
        const base = scaled(R.fight, d);
        return { replay: false, difficulty: d, shards: base.shards, passXp: base.passXp, levelBonus };
      },

      /** Options for new AMB.Match(...) for this fight. */
      matchOptions(fightId, heroId, seed, d) {
        d = dd(d);
        const f = find(fightId); if (!f) throw new Error('ما أعرف هالقتال: ' + fightId);
        const C = deps.collection, fight = f.fight, X = LV().DIFFICULTY[d];
        const boss = fight.boss ? (LV().BOSS[f.level.hero] || LV().BOSS[f.level.world]) : null;
        const power = fight.power * X.power, enemyPower = {};
        fight.units.forEach(([id]) => (enemyPower[id] = power));
        enemyPower[f.level.hero] = power;
        return {
          mode: 'campaign', seed, progression: true, difficulty: d,
          rules: Object.assign({}, fight.boss ? LV().CAMPAIGN.bossRules : LV().CAMPAIGN.rules, { start: f.level.start }),
          players: [
            { heroId, name: 'أنت', cardPower: C ? C.powerMap() : null, allowedUnits: C ? C.playableUnits() : null, heroLevel: (globalThis.AMB.heroes ? AMB.heroes.level(heroId) : 1) },
            { heroId: f.level.hero, name: fight.name, isAI: true, cardPower: enemyPower,
              lineup: { units: fight.units, growth: X.growth, summon: boss ? 'b1' : null, blessings: boss ? boss.blessings : null, abilities: boss ? boss.abilities : [] } },
          ],
        };
      },

      /** Record a finished fight (match.summary(0) + life left). Returns what was paid. */
      recordResult(fightId, res, d) {
        d = dd(d);
        const f = find(fightId); if (!f) return null;
        const won = !!res.won, R = LV().CAMPAIGN.rewards;
        const pay = won ? api.rewardsFor(fightId, d) : null;
        const stars = rate(res), prevStars = api.stars(fightId, d);
        const isBoss = !!f.fight.boss, paidBefore = api.bossPaid(fightId, d);
        const newPrizes = isBoss && won ? R.bossStars.map((p, i) => Object.assign({ star: i + 1 }, scaled(p, d))).filter((p) => p.star > paidBefore && p.star <= stars) : [];
        const out = { fightId, difficulty: d, won, boss: isBoss, first: isBoss ? newPrizes.length > 0 : !!(pay && !pay.replay), shards: 0, passXp: 0, pack: null, packs: [], levelPacks: [], card: null, prizes: newPrizes, levelShards: 0,
          levelComplete: false, stars, prevStars, newBest: stars > prevStars, chestsBefore: api.readyChests(d) };
        save.update('campaign', (s) => {
          const q = s.d[d], x = (q.stats[fightId] = q.stats[fightId] || { attempts: 0, wins: 0, best: null });
          x.attempts++;
          if (!won) return;
          x.wins++;
          const cur = { lifeLeft: res.lifeLeft || 0, roundsLost: res.roundsLost || 0 };
          if (!x.best || cur.lifeLeft > x.best.lifeLeft) x.best = cur;
          q.cleared[fightId] = true;
          q.stars[fightId] = Math.max(q.stars[fightId] || 0, stars);
          if (isBoss) q.bossPaid[fightId] = Math.max(q.bossPaid[fightId] || 0, stars);
          if (f.level.fights.every((ff) => q.cleared[ff.id]) && !q.levelsDone[f.level.id]) { q.levelsDone[f.level.id] = true; out.levelComplete = true; }
        });
        const pay1 = (p) => {
          if (p.shards && deps.wallet) { deps.wallet.add('shards', p.shards, 'campaign'); out.shards += p.shards; }
          if (p.passXp && deps.addPassXp) { deps.addPassXp(p.passXp); out.passXp += p.passXp; }
          for (let i = 0; i < (p.packs || 0); i++) if (deps.packs) out.packs.push(deps.packs.open('basic', { free: true }));
          if (p.card && deps.collection) out.card = grantCard(p.card);
        };
        if (pay) {
          if (isBoss) {
            newPrizes.forEach(pay1);
            if (!newPrizes.length && deps.wallet) { deps.wallet.add('shards', pay.shards, 'campaign'); out.shards += pay.shards; }   // all prizes already paid: the small replay reward
          } else if (pay.shards || pay.passXp) {
            pay1({ shards: pay.shards, passXp: pay.passXp });
          }
          if (out.levelComplete && pay.levelBonus) {
            const lb = pay.levelBonus;
            for (let i = 0; i < (lb.packs || 0); i++) if (deps.packs) out.levelPacks.push(deps.packs.open(R.level.pack, { free: true }));
            if (lb.shards && deps.wallet) { deps.wallet.add('shards', lb.shards, 'campaign'); out.levelShards = lb.shards; out.shards += lb.shards; }
            out.pack = out.levelPacks[0] || null;
          }
        }
        out.chestsReady = api.readyChests(d);
        out.heroes = won ? api.syncHeroes() : [];   // a level finished on all three difficulties gives its hero
        if (deps.events) deps.events.emit('fightEnd', Object.assign({}, out, { summary: res }));
        return out;
      },
    };
    return api;
  }

  AMB.Campaign = Campaign;
})();

;
/* core/daily.js */
/*
 * Daily login calendar (7 days). Opening the game on a new day lets you claim the next reward;
 * missing days does not reset progress; after day 7 a new cycle starts. Rewards: AMB.ECONOMY.login.
 */
(function () {
  const AMB = globalThis.AMB;
  const dayKey = (t) => { const d = new Date(t); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };

  AMB.Save.register('login', {
    version: 1,
    defaults: () => ({ next: 0, lastKey: 0, claims: 0, cycles: 0 }),   // next = index (0..6) of the reward to claim
  });

  function Login(save, deps) {
    deps = deps || {};
    const now = deps.now || save.now || (() => Date.now());
    const st = () => save.get('login');
    const R = () => AMB.ECONOMY.login;
    const api = {
      rewards: R,
      today: () => dayKey(now()),
      canClaim: () => st().lastKey !== dayKey(now()),
      /** index (0..6) of today's reward if claimable, else of tomorrow's */
      nextIndex: () => st().next,
      claimedToday: () => st().lastKey === dayKey(now()),
      status() { const s = st(); return { next: s.next, canClaim: api.canClaim(), claims: s.claims, cycles: s.cycles }; },
      /** claim today's reward; returns what was given or null if already claimed today */
      claim() {
        if (!api.canClaim()) return null;
        const idx = st().next, rw = R()[idx], out = { day: idx + 1, shards: 0, packs: [], card: null };
        save.update('login', (s) => { s.lastKey = dayKey(now()); s.claims++; s.next = (s.next + 1) % R().length; if (s.next === 0) s.cycles++; });
        if (rw.shards && deps.wallet) { deps.wallet.add('shards', rw.shards, 'login'); out.shards = rw.shards; }
        for (let i = 0; i < (rw.packs || 0); i++) if (deps.packs) out.packs.push(deps.packs.open('basic', { free: true }));
        if (rw.card && deps.collection) out.card = deps.collection.grantRandom(rw.card, deps.rng);
        if (deps.events) deps.events.emit('loginClaimed', out);
        return out;
      },
    };
    return api;
  }

  AMB.Login = Login;
  AMB.Login.dayKey = dayKey;
})();

;
/* core/tower.js */
/*
 * Challenge tower: 30 floors, each a short best-of-3 fight (same rules as the campaign) against an enemy
 * line-up GENERATED from the floor number (deterministic, so a floor is the same every time). Floors get
 * harder step by step; every 5th floor is a boss (the world's hero + a special, like the campaign bosses).
 * First clear of a floor pays shards + pass XP; boss floors a free pack; floor 30 a guaranteed epic+ card.
 * Retrying a lost floor costs nothing. The highest floor reached is saved. Settings: AMB.ECONOMY.tower.
 */
(function () {
  const AMB = globalThis.AMB;
  const T = () => AMB.ECONOMY.tower;
  const WORLD_ORDER = ['ember', 'tide', 'neon', 'sylvan'];

  AMB.Save.register('tower', {
    version: 1,
    defaults: () => ({ best: 0, attempts: {}, wins: {}, runs: 0 }),   // best = highest floor cleared
  });

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /** enemy stat multiplier on a floor */
  function powerFor(n) {
  const P = T().power;
  if (P.length >= T().floors) return P[n - 1];   // one value per floor (tools/tune-tower.js)
  const [a, b = 0, c = 0] = P; return a + b * n + c * n * n;   // or a + b*floor + c*floor^2
}
  const isBoss = (n) => n % T().bossEvery === 0;
  const bossIndex = (n) => n / T().bossEvery - 1;
  const bossWorld = (n) => WORLD_ORDER[bossIndex(n) % 4];
  function startFor(n) { let s = T().start[0]; T().start.forEach((x) => { if (n >= x.from) s = x; }); return { gold: s.gold, level: s.level }; }

  /**
   * Generates an enemy line-up (pure + deterministic for the same options). o = { n: difficulty position 1..30,
   * seed, boss, world, special?: boss special, name? }. Used by the tower (one fixed line-up per floor) and by weekly events.
   */
  function generate(o) {
    const n = o.n, rng = AMB.util.RNG(o.seed), boss = !!o.boss, world = o.world;
    const heroId = Object.values(AMB.DATA.HEROES).find((h) => h.world === world).id;
    const maxUnits = boss ? 7 : 8;                                   // a boss hero stands on slot b1
    const count = Math.min(maxUnits, 5 + Math.floor((n - 1) / 8));   // 5 units early .. 8 late (a player starts with 5 board slots)
    const k = (n - 1) / (T().floors - 1);
    const tierW = [65 - 45 * k, 28 + 7 * k, 7 + 38 * k];              // shop-like tier odds: weak early, strong late
    const starTwo = clamp((n - 10) / 50, 0, 0.35), starThree = clamp((n - 22) / 80, 0, 0.15);
    const all = Object.values(AMB.DATA.UNITS).filter((u) => !u.exclusive);
    const used = {};
    const pick = (roles) => {
      const tier = rng.weighted(tierW.map((w, i) => [i + 1, w]));
      let pool = all.filter((u) => roles.includes(u.role) && u.tier === tier && (used[u.id] || 0) < 2);
      const home = pool.filter((u) => u.world === world);
      pool = home.length && rng.chance(0.7) ? home : pool;
      if (!pool.length) pool = all.filter((u) => roles.includes(u.role) && (used[u.id] || 0) < 2);
      const u = pool[rng.int(pool.length)];
      used[u.id] = (used[u.id] || 0) + 1;
      return u;
    };
    const front = Math.max(1, Math.round(count * 0.4)), back = count - front;
    const picks = [];
    for (let i = 0; i < front; i++) picks.push(pick(i % 2 ? ['fighter'] : ['guardian']));
    for (let i = 0; i < back; i++) picks.push(pick([['marksman', 'mage'], ['support', 'mage'], ['marksman', 'assassin'], ['mage', 'marksman']][i % 4]));
    const fslots = ['f1', 'f2', 'f0', 'f3'], bslots = boss ? ['b0', 'b2', 'b3'] : ['b1', 'b2', 'b0', 'b3'];
    // an assassin counts as a back unit here; an assassin may also stand in front, but keep it simple: back
    let fi = 0, bi = 0;
    const units = picks.map((u, i) => {
      const isFront = i < front;
      const slot = isFront ? fslots[fi++] : bslots[bi++] || fslots[fi++] || 'b3';
      const star = rng.chance(starThree) ? 3 : rng.chance(starTwo) ? 2 : 1;
      const from = i < Math.ceil(count * 0.6) ? 1 : i < Math.ceil(count * 0.85) ? 2 : 3;
      return [u.id, star, slot, from];
    });
    const sp = boss ? (o.special || AMB.LEVELS.BOSS[world]) : null;
    const scale = boss && n >= 25 && !o.special ? 1.4 : 1;           // the last two tower bosses hit harder
    const blessings = sp ? Object.fromEntries(Object.entries(sp.blessings).map(([kk, v]) => [kk, +(v * scale).toFixed(2)])) : null;
    return { floor: n, world, heroId, boss, units, summon: boss ? 'b1' : null, blessings, abilities: sp ? sp.abilities : [], special: sp,
      name: o.name || (boss ? `زعيم الطابق ${n}: ${AMB.DATA.HEROES[heroId].name}` : `الطابق ${n}`) };
  }
  /** the generated enemy for a tower floor */
  function lineupFor(n) {
    const boss = isBoss(n);
    return generate({ n, seed: 7000 + n * 131, boss, world: boss ? bossWorld(n) : WORLD_ORDER[(n - 1) % 4] });
  }

  function rewardsFor(n) {
    const R = T().rewards, boss = isBoss(n);
    return { shards: R.shardsFirst + Math.round(((R.shardsLast - R.shardsFirst) * (n - 1)) / (T().floors - 1)), passXp: boss ? R.passXpBoss : R.passXp,
      pack: boss ? R.bossPack : null, card: n === T().floors ? R.finalCard : null };
  }

  function Tower(save, deps) {
    deps = deps || {};
    const st = () => save.get('tower');
    const api = {
      floors: () => T().floors, isBoss, bossWorld, lineupFor, powerFor, startFor, rewardsFor,
      best: () => st().best,
      next: () => Math.min(T().floors, st().best + 1),
      done: () => st().best >= T().floors,
      unlocked: () => !deps.campaign || deps.campaign.levelDone(T().unlock.campaignLevel),
      canPlay: (n) => api.unlocked() && n >= 1 && n <= Math.min(T().floors, st().best + 1),
      attempts: (n) => st().attempts[n] || 0,
      /** options for new AMB.Match(...) on a floor */
      matchOptions(n, heroId, seed) {
        const L = lineupFor(n), C = deps.collection, power = powerFor(n);
        const enemyPower = {}; L.units.forEach(([id]) => (enemyPower[id] = power)); enemyPower[L.heroId] = power;
        return {
          mode: 'tower', seed, progression: true,
          rules: Object.assign({}, AMB.LEVELS.CAMPAIGN.rules, { start: startFor(n) }),
          players: [
            { heroId, name: 'أنت', cardPower: C ? C.powerMap() : null, allowedUnits: C ? C.playableUnits() : null, heroLevel: (globalThis.AMB.heroes ? AMB.heroes.level(heroId) : 1) },
            { heroId: L.heroId, name: L.name, isAI: true, cardPower: enemyPower, lineup: { units: L.units, growth: 0.07, summon: L.summon, blessings: L.blessings, abilities: L.abilities } },
          ],
        };
      },
      /** record a finished fight (match.summary(0) fields + lifeLeft); pays rewards on the first clear of a floor */
      recordResult(n, res) {
        const won = !!res.won, first = won && n > st().best && n === st().best + 1;
        const out = { floor: n, won, boss: isBoss(n), first, shards: 0, passXp: 0, pack: null, card: null, best: st().best };
        save.update('tower', (s) => { s.attempts[n] = (s.attempts[n] || 0) + 1; s.runs++; if (won) { s.wins[n] = (s.wins[n] || 0) + 1; if (first) s.best = n; } });
        if (first) {
          const pay = rewardsFor(n);
          if (deps.wallet) { deps.wallet.add('shards', pay.shards, 'tower'); out.shards = pay.shards; }
          if (deps.addPassXp) { deps.addPassXp(pay.passXp); out.passXp = pay.passXp; }
          if (pay.pack && deps.packs) out.pack = deps.packs.open(pay.pack, { free: true });
          if (pay.card && deps.collection) out.card = deps.collection.grantRandom(pay.card, deps.rng);
        }
        out.best = st().best;
        if (deps.events) deps.events.emit('towerEnd', Object.assign({}, out, { summary: res }));
        return out;
      },
    };
    return api;
  }

  AMB.Tower = Tower;
  AMB.Tower.generate = generate; AMB.Tower.lineupFor = lineupFor; AMB.Tower.powerFor = powerFor; AMB.Tower.rewardsFor = rewardsFor;
})();

;
/* core/events.js */
/*
 * Weekly event: a limited-time special level with a boss of one world; clearing it gives a card that cannot
 * come from packs. The event changes every week (Monday to Sunday, local time) and cycles through EVENTS,
 * so a missed one comes back after 4 weeks. Rewards are paid once per week's occurrence; an event's
 * exclusive card stays yours after the week ends. Settings: AMB.ECONOMY.events.
 */
(function () {
  const AMB = globalThis.AMB;
  const E = () => AMB.ECONOMY.events;
  const DAY = 864e5;

  // the rotation (order = week order). `exclusive` = a unit flagged exclusive in core/data.js.
  const EVENTS = [
    { id: 'ember', world: 'ember', name: 'عاصفة الجمر', exclusive: 'hinotori',
      boss: { name: 'سيّد الجمر المشتعل', text: 'وحدات الزعيم +30% هجوم و+10% صحة، ويستخدم «أمر الهجوم» و«نيزك الجمر» كل جولة.', blessings: { atkPct: 0.3, hpPct: 0.1 }, abilities: ['inferno_banner', 'meteor'] } },
    { id: 'tide', world: 'tide', name: 'مدّ القمر الأسود', exclusive: 'mikazuki',
      boss: { name: 'حارس المدّ الأبدي', text: 'وحدات الزعيم +30% صحة و+10% سرعة هجوم، ويستخدم «حاجز المدّ» و«ينبوع القمر» كل جولة.', blessings: { hpPct: 0.3, asPct: 0.1 }, abilities: ['tidal_ward', 'moon_spring'] } },
    { id: 'neon', world: 'neon', name: 'انقطاع نيون', exclusive: 'kaminari',
      boss: { name: 'عقل الشبكة المتمرّد', text: 'وحدات الزعيم +30% سرعة هجوم و+10% هجوم، ويستخدم «كسر السرعة» و«انهيار النظام» كل جولة.', blessings: { asPct: 0.3, atkPct: 0.1 }, abilities: ['overclock', 'system_crash'] } },
    { id: 'sylvan', world: 'sylvan', name: 'غضب الغابة', exclusive: 'kodama',
      boss: { name: 'قلب الغابة الأزلي', text: 'وحدات الزعيم +30% صحة و+10% هجوم، ويستخدم «جدار الأشواك» و«قيد الجذور» كل جولة.', blessings: { hpPct: 0.3, atkPct: 0.1 }, abilities: ['thorn_wall', 'rootbind'] } },
  ];

  AMB.Save.register('events', { version: 1, defaults: () => ({ weeks: {} }) });   // weeks[idx] = { stage: stages cleared 0..3, got: exclusive card given }

  const dayNum = (t) => { const d = new Date(t); return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY); };   // local calendar day number
  const baseDay = () => { const [y, m, d] = E().epoch; return Math.floor(Date.UTC(y, m, d) / DAY); };
  const weekIndex = (t) => Math.floor((dayNum(t) - baseDay()) / 7);
  const eventOfWeek = (idx) => EVENTS[((idx % EVENTS.length) + EVENTS.length) % EVENTS.length];
  /** local midnight that ends the week containing t (next Monday 00:00) */
  function weekEnd(t) { const d = new Date(t), dow = (d.getDay() + 6) % 7; return new Date(d.getFullYear(), d.getMonth(), d.getDate() + (7 - dow)).getTime(); }

  function Events(save, deps) {
    deps = deps || {};
    const now = deps.now || (() => Date.now());
    const st = () => save.get('events');
    const rec = (idx) => st().weeks[idx] || { stage: 0, got: false };
    const api = {
      EVENTS, weekIndex, eventOfWeek,
      unlocked: () => !deps.campaign || deps.campaign.levelDone(E().unlock.campaignLevel),
      /** this week's event: { idx, event, endsAt, msLeft, stage (cleared 0..3), done } */
      current() {
        const t = now(), idx = weekIndex(t), ev = eventOfWeek(idx), r = rec(idx);
        return { idx, event: ev, endsAt: weekEnd(t), msLeft: weekEnd(t) - t, stage: r.stage, done: r.stage >= 3, got: r.got };
      },
      nextEvent() { return eventOfWeek(weekIndex(now()) + 1); },
      stageCount: () => E().stages.length,
      lineupFor(eventId, stage) {
        const ev = EVENTS.find((x) => x.id === eventId), order = EVENTS.indexOf(ev), S = E().stages[stage - 1];
        return AMB.Tower.generate({ n: S.n, seed: 91000 + order * 100 + stage, boss: !!S.boss, world: ev.world, special: S.boss ? ev.boss : null,
          name: S.boss ? `${ev.boss.name}` : `${ev.name} · المرحلة ${stage}` });
      },
      powerFor: (eventId, stage) => E().power[eventId][stage - 1],
      startFor: (stage) => E().start[stage - 1],
      rewardsFor: (stage) => E().rewards[stage - 1],
      canPlay(stage) { const c = api.current(); return api.unlocked() && stage >= 1 && stage <= Math.min(api.stageCount(), c.stage + 1); },
      /** options for new AMB.Match(...); `idx` (the week) is returned so the result is credited to the week the fight started in */
      matchOptions(stage, heroId, seed) {
        const c = api.current(), L = api.lineupFor(c.event.id, stage), C = deps.collection, power = api.powerFor(c.event.id, stage);
        const enemyPower = {}; L.units.forEach(([id]) => (enemyPower[id] = power)); enemyPower[L.heroId] = power;
        return {
          mode: 'event', seed, progression: true, eventWeek: c.idx,
          rules: Object.assign({}, AMB.LEVELS.CAMPAIGN.rules, { start: api.startFor(stage) }),
          players: [
            { heroId, name: 'أنت', cardPower: C ? C.powerMap() : null, allowedUnits: C ? C.playableUnits() : null, heroLevel: (globalThis.AMB.heroes ? AMB.heroes.level(heroId) : 1) },
            { heroId: L.heroId, name: L.name, isAI: true, cardPower: enemyPower, lineup: { units: L.units, growth: 0.07, summon: L.summon, blessings: L.blessings, abilities: L.abilities } },
          ],
        };
      },
      /** record a finished stage fight for the week `idx` it started in (default: this week) */
      recordResult(stage, res, idx) {
        if (idx == null) idx = weekIndex(now());
        const ev = eventOfWeek(idx), before = rec(idx), won = !!res.won;
        const first = won && stage === before.stage + 1;
        const out = { week: idx, event: ev.id, stage, won, first, shards: 0, passXp: 0, pack: null, card: null, completed: false, cardIsNew: false };
        save.update('events', (s) => {
          const w = s.weeks[idx] = s.weeks[idx] || { stage: 0, got: false };
          if (first) w.stage = stage;
        });
        if (first) {
          const pay = rewardsFor(stage);
          if (deps.wallet && pay.shards) { deps.wallet.add('shards', pay.shards, 'event'); out.shards = pay.shards; }
          if (deps.addPassXp && pay.passXp) { deps.addPassXp(pay.passXp); out.passXp = pay.passXp; }
          if (pay.pack && deps.packs) out.pack = deps.packs.open(pay.pack, { free: true });
          if (pay.exclusive && deps.collection) {
            const r = deps.collection.add(ev.exclusive, 1);
            out.card = { id: ev.exclusive, rarity: deps.collection.rarity(ev.exclusive), isNew: r.isNew }; out.cardIsNew = r.isNew; out.completed = true;
            save.update('events', (s) => { s.weeks[idx].got = true; });
          }
        }
        if (deps.events) deps.events.emit('eventEnd', Object.assign({}, out, { summary: res }));
        return out;
      },
    };
    const rewardsFor = (stage) => E().rewards[stage - 1];
    return api;
  }

  AMB.WeeklyEvents = Events;
  AMB.WEEKLY = EVENTS;
})();

;
/* core/tutorial.js */
/*
 * Guided first match ("التدريب"): 3 short rounds against a fixed, weak enemy with a scripted shop, so a new player learns
 * buy -> place (front/back) -> ready -> merge -> refresh by DOING each move. Mandatory for brand-new players (they get a
 * reward once). The step-by-step guide itself is ui/tutorial-ui.js; this file holds the match, the scripted shop and the reward.
 */
(function () {
  const AMB = globalThis.AMB;
  const T = () => AMB.ECONOMY.tutorial;

  AMB.Save.register('tutorial', { version: 1, defaults: () => ({ done: false, rewarded: false, plays: 0 }) });

  // the shop of each round is fixed (round 2 has three copies of one unit so a merge to a star is guaranteed)
  const SHOP = { 1: ['forge_bulwark', 'ash_ronin', 'pixel_sniper', 'wave_caller', 'grid_hound'], 2: ['ash_ronin', 'ash_ronin', 'ash_ronin', 'thorn_fox', 'moss_warden'], 3: ['thorn_fox', 'moss_warden', 'pixel_sniper', 'wave_caller', 'grid_hound'] };

  /**
   * Practice fight ("جرّب"): try a hero before it is yours. A short best-of-3 against an easy computer, any hero allowed,
   * no card levels and no hero level. The UI runs it as mode 'practice' and saves nothing from it (no rewards, XP, stats, pass).
   */
  function practiceOptions(heroId, seed) {
    const s = seed || 1 + Math.floor(Math.random() * 2 ** 30);
    const others = Object.keys(AMB.DATA.HEROES).filter((h) => h !== heroId);
    return {
      mode: 'practice', practice: true, seed: s, progression: false,
      rules: { maxRounds: 8, winsNeeded: 5, start: T().start },
      players: [{ heroId, name: 'أنت' }, { heroId: others[s % others.length], name: 'تدريب', isAI: true, aiStyle: 'balanced', difficulty: 'easy' }],
    };
  }

  function Tutorial(save, deps) {
    deps = deps || {};
    const st = () => save.get('tutorial');
    const api = {
      SHOP, practiceOptions,
      done: () => !!st().done,
      rewarded: () => !!st().rewarded,
      /** a brand-new player must do it: nothing cleared in the campaign yet and the tutorial not finished */
      required() { return !st().done && !(deps.campaign && deps.campaign.isCleared('l1f1')); },
      /** options for new AMB.Match(...) */
      matchOptions(heroId, seed) {
        const enemyHero = heroId === 'merin' ? 'zerokai' : 'merin';
        return {
          mode: 'tutorial', seed: seed || 4242, progression: false,
          rules: { maxRounds: 3, winsNeeded: 3, start: T().start },   // always three rounds: the third teaches levelling up and sending the hero
          players: [{ heroId, name: 'أنت' },
            { heroId: enemyHero, name: 'دمية التدريب', isAI: true, lineup: { units: T().enemy, summon: null, blessings: { atkPct: -0.15, hpPct: -0.15, asPct: 0 }, abilities: [] } }],
        };
      },
      /** put the scripted shop in place (call right after match.startRound()) */
      onRound(match) {
        const p = match.players[0], s = SHOP[match.round];
        if (s) { p.shop = s.slice(); p.itemShop = []; p.shopLocked = false; }
      },
      /** finish: marks done, pays the reward once. Returns { shards, first } */
      complete() {
        const first = !st().rewarded;
        save.update('tutorial', (s) => { s.done = true; s.plays++; s.rewarded = true; });
        let shards = 0;
        if (first && deps.wallet && T().reward.shards) { deps.wallet.add('shards', T().reward.shards, 'tutorial'); shards = T().reward.shards; }
        if (deps.events) deps.events.emit('tutorialDone', { first, shards });
        return { shards, first };
      },
      /** skip without finishing (replays only): no reward */
      markSeen() { save.update('tutorial', (s) => { s.done = true; }); },
    };
    return api;
  }
  Tutorial.practiceOptions = practiceOptions;
  AMB.Tutorial = Tutorial;
})();

;
/* core/netsync.js */
/*
 * Online play, logic only (no network, no DOM, so it is testable in Node).
 *
 * Both phones run the SAME Match (same seed, `isolated: true` = every player has their own random stream,
 * unit pool and unit ids). A player only sends the list of moves they made during prep; the other phone replays
 * those moves on its copy of that player. Combat is deterministic, so both phones get the same fight and result.
 *
 *   const rec = AMB.NetSync.record(match, myIndex);   // start recording MY moves
 *   ...player plays...                                  // match.buy(myIndex, 2), match.move(...)
 *   const ops = rec.take();                             // -> [['buy', 2], ['move', 'u0_3', {...}], ...]  (send this)
 *   AMB.NetSync.replay(match, otherIndex, ops);         // the other phone applies them to the other player
 *
 * Checks: every incoming op is shape-checked (checkOp) before it touches the match; `hash` is compared after each prep and
 * reward step, `combatPrint` after each fight. Room codes, the broker id, the relay topic and the relay signing key are here too.
 */
(function () {
  const AMB = (globalThis.AMB = globalThis.AMB || {});
  // every call a player can make during prep or the reward draft
  const OPS = ['buy', 'reroll', 'buyXp', 'toggleLock', 'sell', 'move', 'buyItem', 'equip', 'unequip', 'sellItem', 'armSpell', 'disarmSpell', 'setAbility', 'toggleSummon', 'moveHero', 'autoArrange', 'claimReward', 'claimMerge', 'setWager', 'setHunt'];

  function record(match, idx) {
    const ops = []; let depth = 0;
    OPS.forEach((name) => {
      const orig = match[name]; if (typeof orig !== 'function' || orig.__net) return;
      const wrapped = function (pi, ...args) {
        const top = depth === 0;
        depth++;
        let r;
        try { r = orig.call(this, pi, ...args); } finally { depth--; }
        if (top && pi === idx && !(r && r.ok === false)) ops.push([name, ...JSON.parse(JSON.stringify(args))]);   // only my own successful top-level moves
        return r;
      };
      wrapped.__net = true; wrapped.__orig = orig;
      match[name] = wrapped;
    });
    // engine-driven steps call the move methods themselves (autoFill moves bench units onto the board): never record those
    ['autoFill', 'startRound', 'createCombat', 'resolveCombat', 'offerRewards'].forEach((name) => {
      const orig = match[name]; if (typeof orig !== 'function' || orig.__net) return;
      const wrapped = function (...args) { depth++; try { return orig.apply(this, args); } finally { depth--; } };
      wrapped.__net = true; wrapped.__orig = orig; match[name] = wrapped;
    });
    return { take() { const o = ops.splice(0, ops.length); return o; }, peek: () => ops.slice(), pop: () => ops.pop(), trim: (n) => { if (n >= 0 && n < ops.length) ops.length = n; } };   // pop: an undone move (senior #39)
  }

  // the shape of every op's arguments (after the player index). A friend's op is checked against this BEFORE it reaches the
  // match, so a malformed or hostile message is a reported failure, never an exception or a strange coercion
  // (e.g. disarmSpell('x') would act on slot 0, buy(1.5) reads shop[1.5]).  '?' = may be missing or null.
  const ARGS = {
    buy: ['int'], reroll: [], buyXp: [], toggleLock: [], sell: ['uid'], move: ['uid', 'dest'], buyItem: ['int'],
    equip: ['int', 'uid'], unequip: ['uid'], sellItem: ['int'], armSpell: ['int'], disarmSpell: ['int'],
    setAbility: ['id', 'trig?'], toggleSummon: ['slot?'], moveHero: ['slot'], autoArrange: [], claimReward: ['int'], claimMerge: ['int'], setWager: ['bool'], setHunt: ['id'],
  };
  const isInt = (v) => Number.isInteger(v) && v >= -1000 && v <= 1000;
  const isStr = (v, max) => typeof v === 'string' && v.length > 0 && v.length <= max;
  const CHECK = {
    bool: (v) => v === true || v === false, int: isInt, uid: (v) => isStr(v, 32), id: (v) => isStr(v, 40), slot: (v) => isStr(v, 4),
    trig: (v) => isStr(v, 20) && !!(AMB.DATA && Object.prototype.hasOwnProperty.call(AMB.DATA.ABILITY_TRIGGERS, v)),   // an ability trigger must be a known one
    dest: (v) => !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 2
      && (v.zone === 'board' ? isStr(v.slot, 4) : v.zone === 'bench' ? isInt(v.idx) : false),
  };
  /** null when the op is well formed, otherwise a short reason (the op is then never applied) */
  function checkOp(op) {
    if (!Array.isArray(op) || typeof op[0] !== 'string') return 'shape';
    const name = op[0], spec = OPS.includes(name) && Object.prototype.hasOwnProperty.call(ARGS, name) ? ARGS[name] : null;
    if (!spec) return 'unknown:' + name.slice(0, 20);
    const args = op.slice(1);
    if (args.length > spec.length) return name + ':args';
    for (let i = 0; i < spec.length; i++) {
      const t = spec[i], opt = t.endsWith('?'), v = args[i];
      if (opt && v == null) continue;
      if (!CHECK[opt ? t.slice(0, -1) : t](v)) return name + ':arg' + i;
    }
    return null;
  }

  function replay(match, pi, ops) {
    const failed = [];
    if (!Array.isArray(ops) || ops.length > 200) return ['ops'];
    for (const op of ops) {
      const bad = checkOp(op);
      if (bad) { failed.push(bad); continue; }
      const [name, ...args] = op;
      const fn = match[name] && (match[name].__orig || match[name]);
      if (typeof fn !== 'function') { failed.push(name); continue; }
      try {
        const r = fn.call(match, pi, ...args);
        if (r && r.ok === false) failed.push(name + ':' + r.reason);
      } catch (e) { failed.push(name + ':exception'); }   // a malformed op from the peer must never hang the match
    }
    return failed;   // should always be empty: a non-empty list means the two phones disagree
  }

  // a short fingerprint of everything that matters, to check both phones are still identical
  function hash(match) {
    const snap = match.players.map((p) => ({
      g: p.gold, l: p.life, lv: p.level, idle: p.idle, mp: p.mergePick && p.mergePick.options, ess: p.essence, shop: p.shop, bench: p.bench.map((u) => u && [u.uid, u.defId, u.star, u.items]),
      board: Object.keys(p.board).sort().map((k) => [k, p.board[k].uid, p.board[k].defId, p.board[k].star, p.board[k].items]), items: p.items,
      spells: p.armedSpells, ab: p.abilities, sum: p.summoned, hs: p.heroSlot, bl: p.blessings,
      pool: match.isolated ? p.pool : null,   // each phone's own unit pool (online): a pool drift changes future shops, so it must be part of the fingerprint
    }));
    const s = JSON.stringify([match.round, snap, match.isolated ? null : match.pool]);
    let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  }

  // B7: a short fingerprint of one round's fight (round, winner, both lives after it, the fight length). Both phones compute it
  // after every combat and compare: the prep hash proves both STARTED the fight the same, this proves both GOT the same result.
  function combatPrint(report) {
    if (!report || !Array.isArray(report.players)) return '';
    const lives = report.players.map((p) => Math.round((Number(p.lifeAfter) || 0) * 10)).join('/');
    return [report.round, report.winner == null ? 'd' : report.winner, lives, Math.round((Number(report.duration) || 0) * 10)].join('|');
  }

  // ------------------------------------------------------------------ room codes and relay message signing (4.3)
  // Pure JS SHA-256 / HMAC-SHA256 (synchronous: messages stay in order, works on file:// and plain-http test pages where
  // WebCrypto is missing, and Node can test it). Messages are tiny, so speed does not matter.
  const K = new Uint32Array([0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);
  const utf8 = (s) => (typeof s === 'string' ? new TextEncoder().encode(s) : s);
  function sha256(data) {
    const msg = utf8(data), len = msg.length, n = ((len + 9 + 63) >> 6) << 6, b = new Uint8Array(n);
    b.set(msg); b[len] = 0x80;
    const bits = len * 8; b[n - 4] = bits >>> 24; b[n - 3] = (bits >>> 16) & 255; b[n - 2] = (bits >>> 8) & 255; b[n - 1] = bits & 255;
    b[n - 5] = Math.floor(len / 0x20000000) & 255;
    const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]), W = new Uint32Array(64);
    const rotr = (x, r) => (x >>> r) | (x << (32 - r));
    for (let o = 0; o < n; o += 64) {
      for (let i = 0; i < 16; i++) W[i] = (b[o + i * 4] << 24) | (b[o + i * 4 + 1] << 16) | (b[o + i * 4 + 2] << 8) | b[o + i * 4 + 3];
      for (let i = 16; i < 64; i++) {
        const s0 = rotr(W[i - 15], 7) ^ rotr(W[i - 15], 18) ^ (W[i - 15] >>> 3), s1 = rotr(W[i - 2], 17) ^ rotr(W[i - 2], 19) ^ (W[i - 2] >>> 10);
        W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0;
      }
      let [a, bb, c, d, e, f, g, h] = H;
      for (let i = 0; i < 64; i++) {
        const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + W[i]) | 0;
        const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & bb) ^ (a & c) ^ (bb & c))) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = bb; bb = a; a = (t1 + t2) | 0;
      }
      H[0] += a; H[1] += bb; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
    }
    const out = new Uint8Array(32);
    for (let i = 0; i < 8; i++) { out[i * 4] = H[i] >>> 24; out[i * 4 + 1] = (H[i] >>> 16) & 255; out[i * 4 + 2] = (H[i] >>> 8) & 255; out[i * 4 + 3] = H[i] & 255; }
    return out;
  }
  function hmac(key, data) {
    let k = utf8(key); if (k.length > 64) k = sha256(k);
    const ip = new Uint8Array(64), op = new Uint8Array(64);
    for (let i = 0; i < 64; i++) { ip[i] = (k[i] || 0) ^ 0x36; op[i] = (k[i] || 0) ^ 0x5c; }
    const m = utf8(data), inner = new Uint8Array(64 + m.length); inner.set(ip); inner.set(m, 64);
    const outer = new Uint8Array(96); outer.set(op); outer.set(sha256(inner), 64);
    return sha256(outer);
  }
  const hex = (u8) => Array.from(u8, (x) => x.toString(16).padStart(2, '0')).join('');

  // room code: 10 characters from 32 easy-to-read ones (no I/O/0/1) = 50 bits, shown as XXXXX-XXXXX. 32 divides 256, so no bias.
  const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', CODE_LEN = 10;
  function newCode(randomBytes) {
    const r = randomBytes ? randomBytes(CODE_LEN) : globalThis.crypto.getRandomValues(new Uint8Array(CODE_LEN));
    return Array.from(r, (x) => CODE_CHARS[x & 31]).join('');
  }
  /** what the friend typed or pasted -> the canonical code, or null. Forgiving about spaces, dashes and lower case */
  function normCode(text) {
    const c = String(text || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    return c.length === CODE_LEN && [...c].every((ch) => CODE_CHARS.includes(ch)) ? c : null;
  }
  const showCode = (c) => c.slice(0, 5) + '-' + c.slice(5);
  // everything the network sees is DERIVED from the code with one-way hashes: the broker id and the relay topic do not reveal the
  // code, and the signing key cannot be computed from them. Someone who does not know the code cannot find, read the topic of,
  // or inject into the room.
  function room(code) {
    return {
      peerId: 'zor-' + hex(sha256('zor/peer/v2/' + code)).slice(0, 32),
      topic: 'zor-' + hex(sha256('zor/topic/v2/' + code)).slice(0, 40),
      key: sha256('zor/key/v2/' + code),
    };
  }
  /** relay message body: 64 hex chars of HMAC, then the JSON payload (no extra escaping: relay messages must stay small) */
  const seal = (key, obj) => { const p = JSON.stringify(obj); return hex(hmac(key, p)) + p; };
  /** the payload object when the signature is right, otherwise null (the caller drops it silently) */
  function open(key, body) {
    if (typeof body !== 'string' || body.length < 66 || body.length > 60000) return null;
    const sig = body.slice(0, 64), p = body.slice(64), want = hex(hmac(key, p));
    let diff = 0; for (let i = 0; i < 64; i++) diff |= want.charCodeAt(i) ^ sig.charCodeAt(i);
    if (diff) return null;
    try { const o = JSON.parse(p); return o && typeof o === 'object' ? o : null; } catch (x) { return null; }
  }

  AMB.NetSync = { OPS, ARGS, checkOp, record, replay, hash, combatPrint, sha256, hmac, hex, newCode, normCode, showCode, room, seal, open, CODE_LEN };
})();

;
/* core/heroprog.js */
/*
 * Hero levels: every hero gains experience from the matches you play with it (any mode) and levels up 1 → 20.
 * The power it gives grows step by step, and applies — like card levels — only in progression fights
 * (campaign, tower, weekly event). Quick matches, same-device and online stay even.
 *
 *   const H = AMB.HeroProg(save, events);   H.addXp('kagira', 60) -> { gained, level, levelsUp }
 *   H.power('kagira') -> { atk, vanguard, ability }   multipliers used by the combat engine
 */
(function () {
  const AMB = globalThis.AMB;
  const MAX = 20;
  const need = (lv) => 80 + 30 * (lv - 1);            // XP from level lv to lv+1 (it grows each level)
  const RANKS = [                                      // every 5 levels a new rank (shown as a badge)
    { from: 1, name: 'مبتدئ', color: '#b9b2a3' }, { from: 5, name: 'فضي', color: '#d8e2ee' },
    { from: 10, name: 'ذهبي', color: '#ffd24a' }, { from: 15, name: 'ماسي', color: '#7fe3ff' }, { from: 20, name: 'أسطوري', color: '#ff9f1a' },
  ];
  // what one level adds (multiplicative from level 1)
  const PER = { atk: 0.05, vanguard: 0.03, ability: 0.03 };
  // XP for a finished match with that hero
  function matchXp(o) { return Math.round((o.won ? 50 : 25) + 5 * (o.roundsWon || 0)) * (o.short ? 0.6 : 1); }

  AMB.Save.register('heroes', { defaults: () => ({ xp: {} }) });

  function HeroProg(save, events) {
    const st = () => save.get('heroes');
    const totalXp = (id) => st().xp[id] || 0;
    function levelOf(xp) { let lv = 1, left = xp; while (lv < MAX && left >= need(lv)) { left -= need(lv); lv++; } return { level: lv, inLevel: lv >= MAX ? 0 : left, need: lv >= MAX ? 0 : need(lv) }; }
    const api = {
      MAX, need, RANKS, PER, matchXp,
      xp: totalXp,
      level: (id) => levelOf(totalXp(id)).level,
      progress: (id) => Object.assign(levelOf(totalXp(id)), { max: levelOf(totalXp(id)).level >= MAX }),
      rank: (id) => { const lv = api.level(id); return RANKS.filter((r) => lv >= r.from).pop(); },
      power: (id, lvOverride) => { const lv = lvOverride || api.level(id), k = lv - 1; return { level: lv, atk: 1 + PER.atk * k, vanguard: 1 + PER.vanguard * k, ability: 1 + PER.ability * k }; },
      addXp(id, n) {
        if (!AMB.DATA.HEROES[id] || !(n > 0)) return { gained: 0, level: api.level(id), levelsUp: 0 };
        const before = api.level(id);
        save.update('heroes', (s) => { s.xp[id] = (s.xp[id] || 0) + Math.round(n); });
        const after = api.level(id);
        if (after > before && events) events.emit('heroLevelUp', { id, level: after });
        return { gained: Math.round(n), level: after, levelsUp: after - before };
      },
    };
    return api;
  }
  AMB.HeroProg = HeroProg;
})();

;
/* core/album.js */
/*
 * Card album: every card in the game; missing ones show as shadows. Own every unit of a world
 * (5 each) to claim that world's set reward once: shards + a title + a frame in the world's colour.
 * Own all 20 units: bonus packs + the title "جامع الصدع". Heroes are listed but belong to no set
 * (they become playable characters in a later phase). Rewards: AMB.ECONOMY.album.
 */
(function () {
  const AMB = globalThis.AMB;

  AMB.Save.register('album', { version: 2, defaults: () => ({ claimed: {}, all: false, cards: {} }) });   // cards[id] = true once its discovery prize was taken

  function Album(save, deps) {
    deps = deps || {};
    const st = () => save.get('album');
    const A = () => AMB.ECONOMY.album;
    const units = (world) => Object.values(AMB.DATA.UNITS).filter((u) => u.world === world && !u.exclusive).map((u) => u.id);
    const api = {
      worlds: () => Object.keys(AMB.DATA.WORLDS),
      units,
      /** { owned, total } for a world */
      progress(world) { const ids = units(world); return { owned: ids.filter((id) => deps.collection.owned(id)).length, total: ids.length }; },
      total() { const ids = Object.keys(AMB.DATA.UNITS).filter((id) => !AMB.DATA.UNITS[id].exclusive); return { owned: ids.filter((id) => deps.collection.owned(id)).length, total: ids.length }; },
      exclusives: () => Object.values(AMB.DATA.UNITS).filter((u) => u.exclusive).map((u) => u.id),
      heroes: () => Object.keys(AMB.DATA.HEROES).map((id) => ({ id, owned: deps.collection.owned(id) })),
      reward: (world) => A().worlds[world],
      /** 'claimed' | 'ready' | 'locked' */
      state(world) { if (st().claimed[world]) return 'claimed'; const p = api.progress(world); return p.owned >= p.total ? 'ready' : 'locked'; },
      allState() { if (st().all) return 'claimed'; const t = api.total(); return t.owned >= t.total ? 'ready' : 'locked'; },
      readyCount() { return api.worlds().filter((w) => api.state(w) === 'ready').length + (api.allState() === 'ready' ? 1 : 0) + api.worlds().concat(['heroes', 'exclusive']).filter((k) => api.pageReady(k).length).length; },
      /** cosmetic ids the album gave (the pass lists them as owned) */
      ownedCosmetics(type) {
        const out = [];
        api.worlds().forEach((w) => { if (st().claimed[w] && A().worlds[w][type]) out.push(A().worlds[w][type]); });
        if (st().all && A().all[type]) out.push(A().all[type]);
        return out;
      },
      // ---- discovery prizes: every character you get for the first time pays once (common 50, legendary 100); the starting roster pays nothing
      cardPrize(id) { const d = AMB.DATA.UNITS[id] || AMB.DATA.HEROES[id]; if (!d) return 0; const C = (A().card || { normal: 50, legendary: 100 }); return d.rarity === 'legendary' ? C.legendary : C.normal; },
      isStarterFree(id) { const d = AMB.DATA.UNITS[id]; if (d) return !!d.starter; return !!deps.collection.starterHero && deps.collection.starterHero() === id; },
      /** 'claimed' | 'ready' | 'free' (starting card) | 'locked' (not yours yet) */
      cardState(id) {
        if (st().cards[id]) return 'claimed';
        if (!deps.collection.owned(id)) return 'locked';
        return api.isStarterFree(id) ? 'free' : 'ready';
      },
      /** the characters on one album page: a world id, 'heroes' or 'exclusive' */
      pageIds(key) {
        if (key === 'heroes') return Object.keys(AMB.DATA.HEROES);
        if (key === 'exclusive') return api.exclusives();
        return units(key).sort((a, b) => AMB.DATA.UNITS[a].tier - AMB.DATA.UNITS[b].tier);
      },
      pageReady(key) { return api.pageIds(key).filter((id) => api.cardState(id) === 'ready'); },
      pagePrize(key) { return api.pageReady(key).reduce((n, id) => n + api.cardPrize(id), 0); },
      claimCard(id) {
        if (api.cardState(id) !== 'ready') return null;
        const n = api.cardPrize(id);
        save.update('album', (s) => { s.cards[id] = true; });
        if (n && deps.wallet) deps.wallet.add('shards', n, 'album');
        if (deps.events) deps.events.emit('albumCard', { id, shards: n });
        return { id, shards: n };
      },
      /** "claim all" at the end of a page */
      claimPage(key) {
        const ids = api.pageReady(key); if (!ids.length) return null;
        let total = 0; ids.forEach((id) => { const r = api.claimCard(id); if (r) total += r.shards; });
        return { key, count: ids.length, shards: total };
      },
      claim(world) {
        if (api.state(world) !== 'ready') return null;
        const rw = A().worlds[world];
        save.update('album', (s) => { s.claimed[world] = true; });
        if (rw.shards && deps.wallet) deps.wallet.add('shards', rw.shards, 'album');
        if (deps.events) deps.events.emit('albumClaimed', { world, reward: rw });
        return { world, reward: rw, packs: [] };
      },
      claimAll() {
        if (api.allState() !== 'ready') return null;
        const rw = A().all, out = { reward: rw, packs: [] };
        save.update('album', (s) => { s.all = true; });
        for (let i = 0; i < (rw.packs || 0); i++) if (deps.packs) out.packs.push(deps.packs.open('basic', { free: true }));
        if (rw.shards && deps.wallet) deps.wallet.add('shards', rw.shards, 'album');
        if (deps.events) deps.events.emit('albumClaimed', { world: '*', reward: rw });
        return out;
      },
    };
    return api;
  }

  AMB.Album = Album;
})();

;
/* core/profile.js */
/*
 * Player profile bootstrap: one save, one event bus, one wallet shared by
 * every progression system. In the browser it runs once on load and exposes
 * AMB.save / AMB.events / AMB.wallet. Tests call AMB.Profile.boot(memoryStorage).
 */
(function () {
  const AMB = globalThis.AMB;
  // player settings that travel with the save (export/import): big-text mode, combat speed, one-time hints already shown
  // comfort options (senior #31-33, #38): textSize 0/1/2, timer 'normal' | 'x2' | 'off' (vs the computer only), motion, vibration, sound volumes
  AMB.Save.register('settings', { version: 1, defaults: () => ({ bigText: false, speed: 0, seen: {}, fold: {}, textSize: 0, timer: 'normal', motion: true, vibe: true, sfx: 1, music: 1 }) });
  // adult #24/#30: small daily-capped rewards for quick matches and friend matches
  AMB.Save.register('dayPay', { version: 1, defaults: () => ({ day: '', qm: 0, online: 0 }) });
  const QM = { win: 10, loss: 5, cap: 60 }, ONLINE_XP_GAMES = 3;
  function DayPay(save, wallet, nowFn) {
    const today = () => { const d = new Date(nowFn ? nowFn() : Date.now()); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
    const fresh = () => { if (save.get('dayPay').day !== today()) save.update('dayPay', (s) => { s.day = today(); s.qm = 0; s.online = 0; }); return save.get('dayPay'); };
    return {
      QM, ONLINE_XP_GAMES,
      /** shards for a finished quick match vs the computer (not friendly): +10 win / +5 loss, at most 60 a day. Returns the amount paid. */
      quickMatch(won) { const st = fresh(), n = Math.max(0, Math.min(won ? QM.win : QM.loss, QM.cap - st.qm)); if (!n) return 0; save.update('dayPay', (s) => { s.qm += n; }); if (wallet) wallet.add('shards', n, 'quickMatch'); return n; },
      quickLeft() { return Math.max(0, QM.cap - fresh().qm); },
      /** the first 3 friend matches of the day give normal pass XP (never shards) */
      onlineCounts() { const st = fresh(); if (st.online >= ONLINE_XP_GAMES) return false; save.update('dayPay', (s) => { s.online++; }); return true; },
    };
  }
  AMB.DayPay = DayPay;
  const SPEEDS = [1, 2, 4];
  function Settings(save) {
    const st = () => save.get('settings');
    return {
      bigText: () => !!st().bigText || (st().textSize || 0) > 0,
      setBigText(on) { save.update('settings', (s) => { s.bigText = !!on; s.textSize = on ? Math.max(1, s.textSize || 0) : 0; }); return !!on; },
      textSize: () => Math.max(0, Math.min(2, st().textSize || (st().bigText ? 1 : 0))),
      setTextSize(v) { v = Math.max(0, Math.min(2, +v || 0)); save.update('settings', (s) => { s.textSize = v; s.bigText = v > 0; }); return v; },
      get: (k) => st()[k],
      set(k, v) { if (!['timer', 'motion', 'vibe', 'sfx', 'music'].includes(k)) return false; save.update('settings', (s) => { s[k] = v; }); return true; },
      /** combat speed: the last one the player picked; a new player starts at 1x */
      speed: () => (SPEEDS.includes(st().speed) ? st().speed : 1),
      setSpeed(v) { v = +v; if (!SPEEDS.includes(v)) return false; if (st().speed !== v) save.update('settings', (s) => { s.speed = v; }); return true; },
      /** one-time hints: seen(k) is false until markSeen(k) */
      seen: (k) => !!st().seen[k],
      markSeen(k) { if (!st().seen[k]) save.update('settings', (s) => { s.seen[k] = true; }); },
      /** folded (collapsed) sections; `dflt` is used until the player toggles that section once */
      folded: (k, dflt) => (k in st().fold ? !!st().fold[k] : !!dflt),
      setFolded(k, on) { save.update('settings', (s) => { s.fold[k] = !!on; }); },
    };
  }
  AMB.Settings = Settings;
  function boot(storage, nowFn, rng) {
    const save = AMB.Save.create(storage, nowFn);
    const events = AMB.Events();
    const wallet = AMB.Wallet(save, events);
    const collection = AMB.Collection(save, events);
    const heroes = AMB.HeroProg(save, events);
    AMB.heroes = heroes;   // the progression fights read the hero level from here
    const packs = AMB.Packs(save, wallet, collection, events, rng);
    // battle-pass XP from campaign rewards goes to the pass instance (created by the pass UI in the browser)
    const campaign = AMB.Campaign(save, { wallet, packs, collection, events, addPassXp: (n) => AMB.pass && AMB.pass.addXp(n) });
    const login = AMB.Login(save, { wallet, packs, collection, events, now: nowFn });
    const album = AMB.Album(save, { wallet, packs, collection, events });
    const tower = AMB.Tower(save, { wallet, packs, collection, events, campaign, addPassXp: (n) => AMB.pass && AMB.pass.addXp(n) });
    const weekly = AMB.WeeklyEvents(save, { wallet, packs, collection, events, campaign, now: nowFn, addPassXp: (n) => AMB.pass && AMB.pass.addXp(n) });
    const tutorial = AMB.Tutorial(save, { wallet, campaign, events });
    const settings = Settings(save);
    const dayPay = DayPay(save, wallet, nowFn);
    return { save, events, wallet, collection, packs, campaign, login, album, tower, weekly, tutorial, heroes, settings, dayPay };
  }
  /**
   * A one-time reset for everyone: when RESET_ID changes, every browser starts as a brand-new player on its next visit.
   * The old save is NOT deleted: it is moved to 'zor_before_reset' (the daily backups and resume data are dropped), so it can be brought back by hand.
   * Returns true when a reset happened.
   */
  const RESET_ID = 'fresh-2026-11-10';
  function resetOnce(storage, id) {
    id = id || RESET_ID;
    try {
      if (!storage || storage.__mem || storage.getItem('zor_reset_id') === id) return false;
      const main = storage.getItem(AMB.Save.KEY);
      if (main) storage.setItem('zor_before_reset', main);   // kept, never read by the game
      [AMB.Save.KEY, AMB.Save.KEY + '_bak', AMB.Save.KEY + '_preimport', AMB.Save.KEY + '_corrupt', AMB.Save.KEY + '_prerestore', 'amb_pass_v1', 'zor_resume_v1', 'amb_played', 'amb_tut', 'amb_telemetry_v1'].forEach((k) => storage.removeItem(k));
      Object.keys(storage).filter((k) => /^amb_(telemetry|tele)/.test(k)).forEach((k) => storage.removeItem(k));
      storage.setItem('zor_reset_id', id);
      return !!main;
    } catch (e) { return false; }
  }
  AMB.Profile = { boot, resetOnce, RESET_ID };
  if (typeof document !== 'undefined' && !AMB.save) {
    try { AMB.didReset = resetOnce(AMB.Save.browserStorage()); } catch (e) { AMB.didReset = false; }   // before anything reads the save
    const p = boot();
    AMB.save = p.save; AMB.events = p.events; AMB.wallet = p.wallet; AMB.collection = p.collection; AMB.packs = p.packs; AMB.campaign = p.campaign; AMB.login = p.login; AMB.album = p.album; AMB.tower = p.tower; AMB.weekly = p.weekly; AMB.tutorial = p.tutorial; AMB.settings = p.settings; AMB.dayPay = p.dayPay;
  }
})();

;
/* core/pass.js */
/*
 * Battle pass ("ممر الصدع"), season 1. Pure logic + data, no DOM, so it is testable.
 * Progress is stored in the player's browser (localStorage) — there is no server.
 *
 * Fairness: every reward is cosmetic except the small "prep time" perk (+5s / +10s on the
 * planning timer). Nothing changes card or hero strength.
 * The premium track is UI only: it stays locked (`premium=false`) until real payments exist. It is COSMETIC ONLY: its characters
 * are avatars (a portrait to show), never the card itself, so paying can never buy strength (ui/pass-ui.js grants cards for the free track only).
 */
(function () {
  const AMB = (globalThis.AMB = globalThis.AMB || {});
  const DAY = 86400000;

  const SEASON = {
    id: 's1', name: 'موسم الصدع الأول', days: 42, levels: 30, xpPerLevel: 500,   // 15,000 XP in all: about a month at 3 matches a day plus the missions (it was 3,000 = a week)
    xp: { played: 30, won: 40, perRoundWon: 6, finaleWon: 15, firstWinOfDay: 40 },
    modeMult: { easy: 0.6, normal: 1, hard: 1.25, expert: 1.4, short: 0.6, hotseat: 0.8, friendly: 0, campaign: 0 },   // friendly games give nothing (no farming)
  };

  // ------------------------------------------------------------- cosmetics registry (applied by the UI)
  const COSMETICS = {
    frame: {
      default: { name: 'بدون إطار' },
      bronze: { name: 'إطار برونزي', c1: '#d9a066', c2: '#7a4a1f' },
      alb_ember: { name: 'إطار الجمر', c1: '#ff7a45', c2: '#7a2208' }, alb_tide: { name: 'إطار المدّ', c1: '#3ec9ff', c2: '#12507a' }, alb_neon: { name: 'إطار النيون', c1: '#c45cff', c2: '#4a1d7a' }, alb_sylvan: { name: 'إطار الغابة', c1: '#52d67c', c2: '#1f5a2c' },
      silver: { name: 'إطار فضي', c1: '#e8eef7', c2: '#8794a8' },
      forest: { name: 'إطار الغابة', c1: '#8be07a', c2: '#2f7a2c' },
      ember: { name: 'إطار الجمر', c1: '#ffb347', c2: '#d9341c' },
      gold: { name: 'إطار ذهبي', c1: '#fff1a6', c2: '#e3a800' },
      diamond: { name: 'إطار ألماسي', c1: '#e0fbff', c2: '#3ec9ff' },
      aurora: { name: 'إطار الشفق', c1: '#c9a6ff', c2: '#3ee6ff' },
      crimson: { name: 'إطار قرمزي', c1: '#ff9aa2', c2: '#a5141b' },
    },
    arena: {
      default: { name: 'الساحة الأساسية' },
      tavern: { name: 'طاولة الخان' },
      gambler: { name: 'طاولة القمار' },
      warmap: { name: 'خريطة القائد' },
      dungeon: { name: 'زنزانة المشاعل' },
      temple: { name: 'المعبد المهجور' },
      stardust: { name: 'غبار النجوم' },
      neongrid: { name: 'شبكة النيون' },
      moonwaves: { name: 'أمواج القمر' },
      volcano: { name: 'مرجل البركان' },
      forge: { name: 'سندان الأقزام' },
      riftgold: { name: 'الصدع الذهبي' },
      inkwash: { name: 'حبر المانغا' },
      enchanted: { name: 'الغابة المسحورة' },
      storm: { name: 'العاصفة الكهربائية' },
      frost: { name: 'الجليد الأزرق' },
    },
    fx: {
      default: { name: 'احتفال عادي', colors: ['#ffd24a', '#ff4f8b', '#5fe3ff', '#7bd46a', '#ffffff'] },
      bluespark: { name: 'شرر أزرق', colors: ['#5fe3ff', '#3ea0ff', '#ffffff', '#a8f0ff'] },
      petals: { name: 'بتلات', colors: ['#ffb3c7', '#ff7aa2', '#ffe0ea', '#ffffff'] },
      goldrain: { name: 'مطر ذهبي', colors: ['#ffd24a', '#fff1a6', '#e3a800', '#ffffff'] },
      lightning: { name: 'برق', colors: ['#fff6a8', '#ffffff', '#b9a6ff', '#5fe3ff'] },
      inferno: { name: 'لهب', colors: ['#ff4f1a', '#ffb347', '#ffd24a', '#ffffff'] },
      emerald: { name: 'زمرد', colors: ['#52d67c', '#b8ffcf', '#ffffff', '#2f7a2c'] },
      violet: { name: 'بنفسج', colors: ['#c45cff', '#e6c8ff', '#ffffff', '#7a4dff'] },
      crystal: { name: 'كريستال', colors: ['#e0fbff', '#9fe8ff', '#ffffff', '#3ec9ff'] },
    },
    title: {
      default: { name: 'لاعب جديد' },
      t_recruit: { name: 'مجنّد الصدع' }, t_junior: { name: 'قائد صغير' }, t_formation: { name: 'ماهر التشكيلات' },
      t_stars: { name: 'جامع النجوم' }, t_stages: { name: 'سيّد المراحل' }, t_rift: { name: 'سيّد الصدع' },
      t_elite: { name: 'نخبة الصدع' }, t_legend: { name: 'أسطورة العوالم' }, t_finale: { name: 'صاحب الحسم' },
      // album rewards (core/album.js) — not part of the pass tracks
      alb_ember: { name: 'جامع الجمر' }, alb_tide: { name: 'جامع المدّ' }, alb_neon: { name: 'جامع النيون' }, alb_sylvan: { name: 'جامع الغابة' }, alb_all: { name: 'جامع الصدع' },
    },
  };

  // ------------------------------------------------------------- reward tracks (30 levels each)
  const mk = (type, id, extra) => Object.assign({ type, id }, extra || {});
  const FREE = {
    1: mk('title', 't_recruit'), 2: mk('frame', 'bronze'), 3: mk('avatar', 'yuta', { shards: 30 }), 4: mk('arena', 'tavern'),
    5: mk('perk', 'prep5', { sec: 5 }), 6: mk('arena', 'gambler', { shards: 40 }), 7: mk('avatar', 'mitsuki'), 8: mk('title', 't_junior'),
    9: mk('frame', 'silver', { shards: 40 }), 10: mk('arena', 'temple'), 11: mk('avatar', 'kinoko'), 12: mk('fx', 'petals', { shards: 50 }),
    13: mk('arena', 'stardust'), 14: mk('avatar', 'mizuki'), 15: mk('perk', 'prep10', { sec: 5 , shards: 50}), 16: mk('frame', 'forest'),
    17: mk('arena', 'dungeon'), 18: mk('title', 't_stars', { shards: 60 }), 19: mk('avatar', 'hayate'), 20: mk('fx', 'goldrain'),
    21: mk('frame', 'ember', { shards: 60 }), 22: mk('title', 't_stages'), 23: mk('avatar', 'miyuki'), 24: mk('arena', 'forge', { shards: 70 }),
    25: mk('fx', 'lightning'), 26: mk('fx', 'inferno'), 27: mk('frame', 'gold', { shards: 70 }), 28: mk('arena', 'warmap'),
    29: mk('arena', 'riftgold'), 30: mk('avatar', 'rika', { big: true , shards: 80}),
  };
  const PREMIUM = {
    1: mk('avatar', 'kagira'), 2: mk('frame', 'crimson'), 3: mk('title', 't_elite'), 4: mk('arena', 'inkwash'), 5: mk('fx', 'emerald'),
    6: mk('avatar', 'merin'), 7: mk('avatar', 'kota'), 8: mk('frame', 'diamond'), 9: mk('avatar', 'kazehaya'), 10: mk('arena', 'enchanted', { big: true }),
    11: mk('avatar', 'yozora'), 12: mk('fx', 'violet'), 13: mk('title', 't_finale'), 14: mk('avatar', 'kurenai'), 15: mk('avatar', 'shirayuki'),
    16: mk('frame', 'aurora'), 17: mk('arena', 'storm'), 18: mk('avatar', 'ryujin'), 19: mk('fx', 'crystal'), 20: mk('avatar', 'zerokai', { big: true }),
    21: mk('avatar', 'juzo'), 22: mk('arena', 'frost'), 23: mk('avatar', 'natsuki'), 24: mk('title', 't_legend'), 25: mk('avatar', 'seiji'),
    26: mk('avatar', 'ibara'), 27: mk('avatar', 'thorn_fox'), 28: mk('title', 't_rift'), 29: mk('avatar', 'ryuji'), 30: mk('avatar', 'orath', { big: true }),
  };

  function rewardName(r) {
    if (!r) return '';
    const sh = r.shards ? ` · +${r.shards} شظية` : '';
    return rewardBase(r) + sh;
  }
  function rewardBase(r) {
    if (r.type === 'perk') return `مؤقت التجهيز +${r.sec} ث`;
    if (r.type === 'avatar') return AMB.DATA ? ((AMB.DATA.UNITS[r.id] || AMB.DATA.HEROES[r.id] || {}).name || r.id) : r.id;
    return (COSMETICS[r.type] && COSMETICS[r.type][r.id] ? COSMETICS[r.type][r.id].name : r.id);
  }
  const TYPE_NAME = { title: 'لقب', frame: 'إطار', arena: 'ثيم ساحة', fx: 'تأثير فوز', avatar: 'شخصية', perk: 'ميزة' };

  // ------------------------------------------------------------- missions
  // Daily missions: 3 a day from this pool. Each gives battle-pass XP + shards (to buy packs).
  // Stats count in every mode (quick matches, same device, campaign) except friendly matches.
  const DAILY = [
    { id: 'd_play2', name: 'العب مباراتين أو قتالين', stat: 'matches', target: 2, xp: 50, shards: 30 },
    { id: 'd_win1', name: 'اكسب مباراة', stat: 'wins', target: 1, xp: 60, shards: 30 },
    { id: 'd_fights3', name: 'اكسب ٣ قتالات (أي نمط)', stat: 'fights_won', target: 3, xp: 60, shards: 50 },
    { id: 'd_rounds5', name: 'اكسب ٥ جولات', stat: 'rounds_won', target: 5, xp: 50, shards: 30 },
    { id: 'd_buy10', name: 'اشتر ١٠ وحدات', stat: 'buys', target: 10, xp: 40, shards: 30 },
    { id: 'd_merge1', name: 'طوّر وحدة (٣ نسخ ← نجمة)', stat: 'merges', target: 1, xp: 50, shards: 30 },
    { id: 'd_summon1', name: 'نزّل بطلك الساحة', stat: 'summons', target: 1, xp: 40, shards: 30 },
    { id: 'd_reroll8', name: 'حدّث المتجر ٨ مرات', stat: 'rerolls', target: 8, xp: 30, shards: 30 },
    { id: 'd_reward2', name: 'اختر مكافأة من مرحلتين', stat: 'stage_rewards', target: 2, xp: 40, shards: 30 },
    { id: 'd_finale', name: 'اكسب جولة الحسم', stat: 'finale_won', target: 1, xp: 70, shards: 40 },
    { id: 'd_dmg', name: 'اضرب ٥٠٠٠ ضرر بوحداتك', stat: 'damage', target: 5000, xp: 40, shards: 30 },
    { id: 'd_upgrade1', name: 'طوّر بطاقة', stat: 'upgrades', target: 1, xp: 40, shards: 40 },
    { id: 'd_pack1', name: 'افتح باكج', stat: 'packs', target: 1, xp: 30, shards: 30 },
    { id: 'd_stars3', name: 'اجمع ٣ نجوم جديدة في الحملة', stat: 'stars', target: 3, xp: 60, shards: 50 },
    { id: 'd_tower2', name: 'اصعد طابقين في البرج', stat: 'tower_floors', target: 2, xp: 50, shards: 50 },
    { id: 'd_campaign2', name: 'العب قتالين في الحملة', stat: 'campaign', target: 2, xp: 40, shards: 40 },
  ];
  const WEEKLY = [
    { id: 'w_win5', name: 'اكسب ٥ مباريات', stat: 'wins', target: 5, xp: 200 },
    { id: 'w_play10', name: 'العب ١٠ مباريات', stat: 'matches', target: 10, xp: 150 },
    { id: 'w_merge8', name: 'طوّر ٨ وحدات', stat: 'merges', target: 8, xp: 180 },
    { id: 'w_rounds30', name: 'اكسب ٣٠ جولة', stat: 'rounds_won', target: 30, xp: 200 },
    { id: 'w_worlds', name: 'ادخل مباراة بوحدات من ٤ عوالم', stat: 'four_worlds', target: 1, xp: 150 },
    { id: 'w_event', name: 'أكمل الحدث الأسبوعي', stat: 'event_cleared', target: 1, xp: 150 },
    { id: 'w_finale3', name: 'اكسب ٣ جولات حسم', stat: 'finale_won', target: 3, xp: 180 },
  ];

  const dayKey = (t) => { const d = new Date(t); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
  // weeks run Monday-Sunday like the weekly event (core/events.js), counted from Monday 1 Jan 2024; no break at New Year. (The key changed once: weekly mission progress reset once when this shipped.)
  const weekKey = (t) => { const d = new Date(t); return Math.floor((Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY) - 19723) / 7); };
  const hash = (s) => {   // murmur-style mixing so neighbouring days give unrelated orders
    let h = 2166136261;
    for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
    h ^= h >>> 16; h = Math.imul(h, 2246822507); h ^= h >>> 13; h = Math.imul(h, 3266489909); h ^= h >>> 16;
    return h >>> 0;
  };
  function pick3(pool, key) {
    const idx = pool.map((_, i) => i).sort((a, b) => (hash(key + ':' + a) - hash(key + ':' + b)) || a - b);
    return idx.slice(0, 3).map((i) => pool[i]);
  }

  // ------------------------------------------------------------- state
  const KEY = 'amb_pass_v1';
  const blank = (now) => ({ v: 1, season: SEASON.id, start: now, xp: 0, premium: false, claimed: { free: [], premium: [] }, claimedMissions: [], daily: { key: 0, p: {} }, weekly: { key: 0, p: {} },
    firstWinDay: 0, matches: 0, equip: { title: 'default', frame: 'default', arena: 'default', fx: 'default', avatar: null } });

  function create(storage, nowFn, onReward, extraOwned) {
    const now = nowFn || (() => Date.now());
    let st;
    try { st = JSON.parse(storage.getItem(KEY)); } catch (e) { st = null; }
    if (!st || st.season !== SEASON.id) st = blank(now());
    const save = () => { try { storage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* storage blocked */ } };
    const roll = () => {   // new day / new week -> fresh mission progress
      const dk = dayKey(now()), wk = weekKey(now());
      if (st.daily.key !== dk) {
        // adult #28: yesterday's finished-but-unclaimed daily missions stay claimable for one more day (missing a day does not lose them)
        let carry = [];
        try { if (st.daily.key) carry = pick3(DAILY, 'd' + st.daily.key).map((m) => (st.daily.swap && st.daily.swap[m.id] ? DAILY.find((x) => x.id === st.daily.swap[m.id]) || m : m)).filter((m) => Math.min(m.target, st.daily.p[m.stat] || 0) >= m.target && !st.claimedMissions.includes(m.id)).map((m) => m.id); } catch (e) { carry = []; }
        st.daily = { key: dk, p: {}, carry, swap: {} }; st.claimedMissions = st.claimedMissions.filter((id) => !id.startsWith('d_') && !id.startsWith('c_'));
      }
      if (st.weekly.key !== wk) { st.weekly = { key: wk, p: {} }; st.claimedMissions = st.claimedMissions.filter((id) => !id.startsWith('w_')); }
    };
    roll();
    function bumpAll(sm) {
      const bump = (p, k, n) => { if (n) p[k] = (p[k] || 0) + n; };
      [st.daily.p, st.weekly.p].forEach((p) => {
        bump(p, 'matches', 1); if (sm.won) { bump(p, 'wins', 1); bump(p, 'fights_won', 1); }
        bump(p, 'rounds_won', sm.roundsWon || 0); bump(p, 'buys', sm.buys || 0); bump(p, 'rerolls', sm.rerolls || 0);
        bump(p, 'merges', sm.merges || 0); bump(p, 'summons', sm.summoned ? 1 : 0); bump(p, 'stage_rewards', sm.stageRewards || 0); bump(p, 'damage', Math.round(sm.damage || 0));
        bump(p, 'finale_won', sm.finaleWon ? 1 : 0); bump(p, 'four_worlds', sm.worldsUsed >= 4 ? 1 : 0);
      });
    }

    const api = {
      SEASON, COSMETICS, FREE, PREMIUM, TYPE_NAME, rewardName,
      state: () => st,
      level: () => Math.min(SEASON.levels, 1 + Math.floor(st.xp / SEASON.xpPerLevel)),
      /** adult #23: at the pace so far, in how many days the last level is reached (null = not enough data yet) */
      etaDays() { const days = Math.max(1, (now() - st.start) / DAY), rate = st.xp / days, left = (SEASON.levels - 1) * SEASON.xpPerLevel - st.xp; if (left <= 0) return 0; if (rate < 1 || days < 0.5) return null; return Math.ceil(left / rate); },
      xpInLevel: () => (api.level() >= SEASON.levels ? SEASON.xpPerLevel : st.xp % SEASON.xpPerLevel),
      maxed: () => api.level() >= SEASON.levels,
      daysLeft: () => Math.max(0, Math.ceil((st.start + SEASON.days * DAY - now()) / DAY)),
      ended: () => now() >= st.start + SEASON.days * DAY,
      isPremium: () => !!st.premium,
      setPremium: (v) => { st.premium = !!v; save(); },        // dev / future payment hook only
      addXp(n) { if (api.ended() || n <= 0) return 0; const b = api.level(); st.xp += Math.round(n); save(); return api.level() - b; },

      dailyMissions() { roll(); return pick3(DAILY, 'd' + st.daily.key).map((m) => (st.daily.swap && st.daily.swap[m.id] ? DAILY.find((x) => x.id === st.daily.swap[m.id]) || m : m)).map((m) => api._m(m, st.daily.p)); },
      /** adult #28: missions carried over from yesterday (finished, not claimed yet) */
      carriedMissions() { roll(); return (st.daily.carry || []).map((id) => DAILY.find((x) => x.id === id)).filter(Boolean).map((m) => Object.assign({}, m, { progress: m.target, done: true, claimed: st.claimedMissions.includes('c_' + m.id), carry: true, id: 'c_' + m.id })); },
      /** adult #28: swap one of today's daily missions for another, once a day, free */
      canSwap() { roll(); return !st.daily.swap || !Object.keys(st.daily.swap).length; },
      swapMission(id) {
        if (!api.canSwap()) return null;
        const today = api.dailyMissions(), cur = today.find((m) => m.id === id); if (!cur || cur.claimed) return null;
        const used = today.map((m) => m.id), alt = DAILY.filter((x) => !used.includes(x.id) && (st.daily.p[x.stat] || 0) < x.target);
        if (!alt.length) return null;
        const pickAlt = alt[hash(st.daily.key + ':swap:' + id) % alt.length];
        st.daily.swap = st.daily.swap || {}; st.daily.swap[id] = pickAlt.id; save(); return pickAlt;
      },
      weeklyMissions() { roll(); return pick3(WEEKLY, 'w' + st.weekly.key).map((m) => api._m(m, st.weekly.p)); },
      _m(m, prog) { const v = Math.min(m.target, prog[m.stat] || 0); return Object.assign({}, m, { progress: v, done: v >= m.target, claimed: st.claimedMissions.includes(m.id) }); },
      claimMission(id) {
        const m = api.dailyMissions().concat(api.weeklyMissions(), api.carriedMissions()).find((x) => x.id === id);
        if (!m || !m.done || m.claimed) return null;
        st.claimedMissions.push(id); const before = api.level(); if (!api.ended()) st.xp += m.xp; save();   // no XP after the season closed (the shards still pay)
        if (m.shards && onReward) { try { onReward({ type: 'shards', n: m.shards, mission: id }); } catch (e) { /* never blocks claiming */ } }
        return { xp: m.xp, shards: m.shards || 0, levelUp: api.level() - before > 0 };
      },
      /** add progress to a mission stat (daily + weekly), e.g. track('upgrades', 1) */
      track(stat, n) { if (!(n > 0)) return; roll(); [st.daily.p, st.weekly.p].forEach((p) => { p[stat] = (p[stat] || 0) + n; }); save(); },
      /** mission stats from a finished match/fight summary, without the match XP (campaign pays its own) */
      recordStats(sm) { roll(); bumpAll(sm); save(); },

      /** summary: { mode, won, roundsPlayed, roundsWon, finaleWon, buys, rerolls, merges, summoned, stageRewards, damage, worldsUsed } */
      recordMatch(sm) {
        roll();
        const X = SEASON.xp, mult = SEASON.modeMult[sm.mode] != null ? SEASON.modeMult[sm.mode] : 1;
        const lines = [['مباراة', X.played], ['جولات فزت بها', X.perRoundWon * sm.roundsWon]];
        if (sm.won) lines.push(['فوز بالمباراة', X.won]);
        if (sm.finaleWon) lines.push(['جولة الحسم', X.finaleWon]);
        const today = dayKey(now());
        if (sm.won && st.firstWinDay !== today && mult > 0) { lines.push(['أول فوز اليوم', X.firstWinOfDay]); st.firstWinDay = today; }
        let xp = Math.round(lines.reduce((s, l) => s + l[1], 0) * mult);
        const beforeLevel = api.level();
        const added = api.ended() ? 0 : xp;
        if (mult > 0) { bumpAll(sm); st.matches++; }
        st.xp += added; save();
        const doneNow = [];   // missions that are complete but unclaimed (the UI shows a dot)
        return { xp: added, mult, lines: lines.map((l) => [l[0], Math.round(l[1] * mult)]), levelBefore: beforeLevel, levelAfter: api.level(), ended: api.ended(),
          missionsReady: api.dailyMissions().concat(api.weeklyMissions()).filter((m) => m.done && !m.claimed).map((m) => m.id), doneNow };
      },

      // ---- rewards
      reward(level, track) { return (track === 'premium' ? PREMIUM : FREE)[level] || null; },
      canClaim(level, track) {
        if (level > api.level() || level < 1) return false;
        if (track === 'premium' && !st.premium) return false;
        return !st.claimed[track].includes(level) && !!api.reward(level, track);
      },
      claim(level, track) { if (!api.canClaim(level, track)) return null; st.claimed[track].push(level); save(); const r = api.reward(level, track); if (onReward) { try { onReward(r, level, track); } catch (e) { /* reward hook never blocks claiming */ } } return r; },
      claimAll() { const got = []; for (let l = 1; l <= api.level(); l++) ['free', 'premium'].forEach((t) => { const r = api.claim(l, t); if (r) got.push({ level: l, track: t, reward: r }); }); return got; },
      isClaimed: (level, track) => st.claimed[track].includes(level),
      unclaimedCount() { let n = 0; for (let l = 1; l <= api.level(); l++) ['free', 'premium'].forEach((t) => { if (api.canClaim(l, t)) n++; }); return n + api.dailyMissions().concat(api.weeklyMissions(), api.carriedMissions()).filter((m) => m.done && !m.claimed).length; },

      // ---- owned cosmetics + equip
      owned(type) {
        const base = { title: ['default'], frame: ['default'], arena: ['default'], fx: ['default'], avatar: [] }[type].slice();
        ['free', 'premium'].forEach((t) => st.claimed[t].forEach((l) => { const r = api.reward(l, t); if (r && r.type === type && !base.includes(r.id)) base.push(r.id); }));
        if (extraOwned) (extraOwned(type) || []).forEach((id) => { if (!base.includes(id)) base.push(id); });   // e.g. album rewards
        return base;
      },
      equipped: (type) => st.equip[type],
      equip(type, id) { if (id !== null && !api.owned(type).includes(id)) return false; st.equip[type] = id; save(); return true; },
      prepBonus() { let s = 0; ['free', 'premium'].forEach((t) => st.claimed[t].forEach((l) => { const r = api.reward(l, t); if (r && r.type === 'perk') s += r.sec; })); return s; },
    };
    return api;
  }

  /** connect a pass to the game event bus so missions count upgrades, packs, campaign fights and stars */
  function wire(pass, events) {
    events.on('cardUpgraded', () => pass.track('upgrades', 1));
    events.on('packOpened', () => pass.track('packs', 1));
    events.on('towerEnd', (r) => {   // tower fights count as fights won / matches; each new floor counts toward "climb 2 floors"
      if (r.summary) pass.recordStats(Object.assign({}, r.summary, { won: r.won }));
      if (r.first) pass.track('tower_floors', 1);
    });
    events.on('eventEnd', (r) => {   // weekly-event fights count as fights won; finishing the event counts for the weekly mission
      if (r.summary) pass.recordStats(Object.assign({}, r.summary, { won: r.won }));
      if (r.completed) pass.track('event_cleared', 1);
    });
    events.on('fightEnd', (r) => {
      if (r.summary) pass.recordStats(Object.assign({}, r.summary, { won: r.won }));
      pass.track('campaign', 1);
      if (r.newBest) pass.track('stars', r.stars - (r.prevStars || 0));
    });
  }

  AMB.Pass = { create, wire, KEY, SEASON, COSMETICS, FREE, PREMIUM, DAILY, WEEKLY, dayKey, weekKey, rewardName };
})();

;
/* core/meta.js */
/* generated by tools/meta-snapshot.js on 2026-11-10: AI-vs-AI win rates (hero: 1000 games x2 seeds; synergy: 1500 games x2 seeds) */
(function () { globalThis.AMB = globalThis.AMB || {}; AMB.META = {"date":"2026-11-10","heroes":{"zerokai":59.2,"kagira":52.2,"kairyu":52.8,"rika":51,"orath":48.7,"nayako":46.2,"merin":48.2,"thora":44.8},"synergies":{"mage":53.2,"neon":51.1,"guardian":51,"marksman":51.7,"convergence":50.1,"ember":49.2,"fighter":48.9,"tide":49.6,"sylvan":49.4,"assassin":47,"support":47.7}}; })();

;
/* assets/characters/manifest.js */
/* Generated by tools/scan-images.js — maps character id -> image file. Empty = built-in SVG art is used. */
globalThis.AMB = globalThis.AMB || {};
AMB.IMAGES = {
  "ash_ronin": "assets/characters/ash_ronin.b91304d25a.jpg",
  "caldera_seer": "assets/characters/caldera_seer.8efcbc0994.jpg",
  "chrome_ronin": "assets/characters/chrome_ronin.91da853ee1.jpg",
  "coral_sentinel": "assets/characters/coral_sentinel.b6ddec339c.jpg",
  "daigo": "assets/characters/daigo.08a2d698ae.webp",
  "daikai": "assets/characters/daikai.89877901ea.webp",
  "firewall_unit": "assets/characters/firewall_unit.2394f02d73.jpg",
  "forge_bulwark": "assets/characters/forge_bulwark.39dc9480d6.jpg",
  "gensai": "assets/characters/gensai.5375936f1c.webp",
  "genzo": "assets/characters/genzo.b06f2b639e.webp",
  "godo": "assets/characters/godo.fea17a8563.webp",
  "goka": "assets/characters/goka.d81f99f74f.webp",
  "grid_hound": "assets/characters/grid_hound.97bbae0b7a.jpg",
  "haruka": "assets/characters/haruka.d69b8da8c8.webp",
  "hayate": "assets/characters/hayate.b7c7d089e4.webp",
  "hinotori": "assets/characters/hinotori.b7e884eda4.webp",
  "hissa": "assets/characters/hissa.7bc8ff617d.webp",
  "hisui": "assets/characters/hisui.8c9f0da55a.webp",
  "ibara": "assets/characters/ibara.dac124e21d.webp",
  "juzo": "assets/characters/juzo.ada3fc8f86.webp",
  "kagemaru": "assets/characters/kagemaru.69ad44557d.webp",
  "kagira": "assets/characters/kagira.c83f24f3ba.jpg",
  "kairyu": "assets/characters/kairyu.c7633242cd.webp",
  "kaito": "assets/characters/kaito.0d2e300029.jpg",
  "kaminari": "assets/characters/kaminari.678baf1626.webp",
  "kashiwagi": "assets/characters/kashiwagi.508a062623.webp",
  "kazehaya": "assets/characters/kazehaya.68be552367.webp",
  "kinoko": "assets/characters/kinoko.d75acf9083.webp",
  "kodama": "assets/characters/kodama.87a073cc46.webp",
  "kogetsu": "assets/characters/kogetsu.f348c1f57a.webp",
  "kota": "assets/characters/kota.906dd3b782.webp",
  "kurenai": "assets/characters/kurenai.cc51bf83d4.webp",
  "lama": "assets/characters/lama.5b910764c1.webp",
  "lunar_blade": "assets/characters/lunar_blade.126fa30053.jpg",
  "merin": "assets/characters/merin.ebcfd77e4e.jpg",
  "mikazuki": "assets/characters/mikazuki.0f892aed18.webp",
  "mist_witch": "assets/characters/mist_witch.f98a2be0d7.jpg",
  "mitsuki": "assets/characters/mitsuki.ac032286a3.webp",
  "miyuki": "assets/characters/miyuki.c945cf7be9.webp",
  "mizuki": "assets/characters/mizuki.a6c48e33e2.webp",
  "momo": "assets/characters/momo.067e7c5726.webp",
  "moss_warden": "assets/characters/moss_warden.e168290347.jpg",
  "mugen": "assets/characters/mugen.407cdaacec.webp",
  "natsuki": "assets/characters/natsuki.a6d680522b.webp",
  "nawaf": "assets/characters/nawaf.e91ad9fbd8.webp",
  "nayako": "assets/characters/nayako.79b1dbfc41.webp",
  "orath": "assets/characters/orath.6416dc3076.jpg",
  "otohime": "assets/characters/otohime.a1e3855475.webp",
  "pixel_sniper": "assets/characters/pixel_sniper.51b8a1f42d.jpg",
  "pyre_archer": "assets/characters/pyre_archer.2217e7a133.jpg",
  "reiji": "assets/characters/reiji.1ef4b9a400.webp",
  "rika": "assets/characters/rika.bcfc8d890a.webp",
  "root_shaman": "assets/characters/root_shaman.dc642bfab8.jpg",
  "ryuji": "assets/characters/ryuji.42eab13134.webp",
  "ryujin": "assets/characters/ryujin.6b329f2366.webp",
  "seiji": "assets/characters/seiji.b67cac30bb.webp",
  "shafaq": "assets/characters/shafaq.3d5f1b187f.webp",
  "shiori": "assets/characters/shiori.002cfc272d.webp",
  "shirayuki": "assets/characters/shirayuki.88cba58a04.webp",
  "shiro": "assets/characters/shiro.1b01e151e3.webp",
  "spark_wraith": "assets/characters/spark_wraith.f1f843dfe0.jpg",
  "spectral_coder": "assets/characters/spectral_coder.6e74c78da5.jpg",
  "taiju": "assets/characters/taiju.66ae071064.webp",
  "takashi": "assets/characters/takashi.082538169a.webp",
  "thora": "assets/characters/thora.ff10c49722.webp",
  "thorn_fox": "assets/characters/thorn_fox.5596e5dee5.jpg",
  "tide_priest": "assets/characters/tide_priest.d374228355.jpg",
  "tomoe": "assets/characters/tomoe.3d629605d4.webp",
  "tsubaki": "assets/characters/tsubaki.b28051f82c.webp",
  "wakaba": "assets/characters/wakaba.0030e8ead8.webp",
  "wave_caller": "assets/characters/wave_caller.10d7340319.jpg",
  "wild_stalker": "assets/characters/wild_stalker.a68ac5344e.jpg",
  "yoshino": "assets/characters/yoshino.377a38f2f3.webp",
  "yozora": "assets/characters/yozora.8c147f95e6.webp",
  "yuta": "assets/characters/yuta.25492bcded.webp",
  "zafir": "assets/characters/zafir.3554883f0c.webp",
  "zerokai": "assets/characters/zerokai.0a7cf4d51e.jpg"
};

;
/* ui/art.js */
/*
 * Procedural SVG art: every unit/hero gets an original emblem built from its
 * world colour, world glyph, role icon and tier ring. No external images.
 */
(function () {
  // Portraits are plain URLs (docs/: content-hashed files under assets/, cached by the service worker); the browser
  // only downloads one when a screen actually shows it. Only the optional single-file build (dist/zor.html) carries
  // base64 data URIs: re-parsing those long strings on every re-render is slow, so there (and only there) each one
  // becomes a blob: URL once at start-up.
  try {
    const IM = globalThis.AMB && globalThis.AMB.IMAGES;
    if (IM && Object.keys(IM).some((id) => /^data:/.test(IM[id] || '')) && typeof Blob !== 'undefined' && typeof URL !== 'undefined' && URL.createObjectURL) {
      Object.keys(IM).forEach((id) => {
        const m = /^data:([^;,]+);base64,(.*)$/s.exec(IM[id] || ''); if (!m) return;
        const bin = atob(m[2]), bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        IM[id] = URL.createObjectURL(new Blob([bytes], { type: m[1] }));
      });
    }
  } catch (e) { /* keep the data URIs */ }
  const AMB = (globalThis.AMB = globalThis.AMB || {});

  const ICONS = {
    shield: '<path d="M12 2.5l7.5 3v5.8c0 4.8-3.2 8.6-7.5 10.2-4.3-1.6-7.5-5.4-7.5-10.2V5.5z" fill="currentColor" opacity=".9"/>',
    sword: '<path d="M19.5 3.5l1 1-10 10 1.6 1.6-1.4 1.4-1.6-1.6-3.6 3.6-1.4-1.4 3.6-3.6-1.6-1.6 1.4-1.4 1.6 1.6z" fill="currentColor"/>',
    dagger: '<path d="M20.5 3.5l-3 7.5-5 5-3.5-3.5 5-5zM8 14.5l1.5 1.5-4.5 4.5-1.5-1.5z" fill="currentColor"/>',
    orb: '<circle cx="12" cy="12" r="6.5" fill="currentColor" opacity=".85"/><circle cx="9.5" cy="9.5" r="2" fill="#fff" opacity=".7"/><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="1.2" stroke-dasharray="2 2.5"/>',
    bow: '<path d="M6 2.5c9 3 9 16 0 19" fill="none" stroke="currentColor" stroke-width="2"/><path d="M6 2.5v19" stroke="currentColor" stroke-width="1"/><path d="M3 12h16m-3-3l3 3-3 3" fill="none" stroke="currentColor" stroke-width="2"/>',
    cross: '<path d="M9.5 3h5v6.5H21v5h-6.5V21h-5v-6.5H3v-5h6.5z" fill="currentColor"/>',
    wings: '<path d="M11.4 2.6C6.6 3.6 2.6 7.6 1.6 14.2c2-1.6 4-2.2 5.8-1.8-1.8 1.5-2.4 3.9-2 6 1.6-1.7 3.4-2.3 5-1.9-.8 1.5-.6 3.4.6 4.8.9-2.3 1.2-9.6 0-18.7z" fill="currentColor"/><path d="M11.4 2.6C6.6 3.6 2.6 7.6 1.6 14.2c2-1.6 4-2.2 5.8-1.8-1.8 1.5-2.4 3.9-2 6 1.6-1.7 3.4-2.3 5-1.9-.8 1.5-.6 3.4.6 4.8.9-2.3 1.2-9.6 0-18.7z" transform="matrix(-1 0 0 1 24 0)" fill="currentColor"/>',
    crown: '<path d="M3 18.5l1.6-11 5 4.6L12 4.5l2.4 7.6 5-4.6 1.6 11z" fill="currentColor"/><rect x="3" y="19.3" width="18" height="2" rx="1" fill="currentColor"/>',
    wind: '<path d="M3 8h11a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    fang: '<path d="M5 4h14l-3 9-2-4-2 11-2-11-2 4z" fill="currentColor"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3.2" fill="currentColor"/>',
    note: '<path d="M9 18V5l11-2v13" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="6.5" cy="18" r="2.5" fill="currentColor"/><circle cx="17.5" cy="16" r="2.5" fill="currentColor"/>',
    star: '<path d="M12 2.5l2.8 6.3 6.7.6-5.1 4.5 1.5 6.6L12 17l-5.9 3.5 1.5-6.6-5.1-4.5 6.7-.6z" fill="currentColor"/>',
    gold: '<circle cx="12" cy="12" r="8.5" fill="#ffc94a"/><circle cx="12" cy="12" r="5.8" fill="none" stroke="#b9851a" stroke-width="1.6"/>',
    essence: '<path d="M12 2.5l6 9.5-6 9.5-6-9.5z" fill="#8ff0ff"/><path d="M12 6l3.6 6L12 18l-3.6-6z" fill="#3aa9e0"/>',
    flame: '<path d="M12 2.2c1.2 3.6 5.3 5.6 5.3 10.4a5.3 5.3 0 0 1-10.6 0c0-2.1 1-3.4 2.1-4.4.2 1.7.9 2.5 1.8 2.8C10.1 7.9 10.4 5 12 2.2z" fill="currentColor"/>',
    moon: '<path d="M15.6 3A9.2 9.2 0 1 0 21 14.2 7.6 7.6 0 0 1 15.6 3z" fill="currentColor"/>',
    bolt: '<path d="M13.6 1.8L5 13.6h5.6L9.4 22.2 19 9.6h-5.9z" fill="currentColor"/>',
    leaf: '<path d="M20.5 3.5C10.5 3.5 4.5 8.6 4.5 15.4c0 1.6.4 3 1.1 4C6.8 14.6 10 11.6 14.6 9.6 11 12.2 8.6 15.2 7.8 20c1.2.7 2.5 1 3.8 1C18 21 20.5 13 20.5 3.5z" fill="currentColor"/>',
    burst: '<path d="M12 1.5l2.2 6.3 6.3-2.2-2.2 6.3 6.2 2.4-6.2 2.4 2.2 6.3-6.3-2.2L12 22.5l-2.2-6.3-6.3 2.2 2.2-6.3L1.5 12l6.2-2.4-2.2-6.3 6.3 2.2z" fill="currentColor"/>',
    blast: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M12 5.5l1.8 4.7 4.7 1.8-4.7 1.8L12 18.5l-1.8-4.7L5.5 12l4.7-1.8z" fill="currentColor"/>',
    slash: '<path d="M4.5 3l5.5 18M10.5 3l5.5 18M16.5 3l4 13" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/>',
    snow: '<path d="M12 2v20M3.4 7l17.2 10M3.4 17L20.6 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="12" r="2.6" fill="currentColor"/>',
    drop: '<path d="M12 2.4C8 8 5.4 11 5.4 14.6a6.6 6.6 0 0 0 13.2 0C18.6 11 16 8 12 2.4z" fill="currentColor"/>',
    skull: '<path fill-rule="evenodd" d="M12 3a8 8 0 0 0-8 8c0 2.7 1.3 4.5 3 5.6V20h3v-2h4v2h3v-3.4c1.7-1.1 3-2.9 3-5.6a8 8 0 0 0-8-8zM9 9.4a1.9 1.9 0 1 0 .01 0zm6 0a1.9 1.9 0 1 0 .01 0z" fill="currentColor"/>',
    target: '<circle cx="12" cy="12" r="6.8" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M12 1.5v6M12 16.5v6M1.5 12h6M16.5 12h6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="12" r="1.9" fill="currentColor"/>',
    arrows: '<path d="M3.5 19L20 5M3.5 12H20.5M3.5 5L20 19" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M20.5 3.5v5h-5zM21.5 12l-4.5-3v6zM20.5 20.5v-5h-5z" fill="currentColor"/>',
    taunt: '<path d="M12 2.5l7.5 3v5.8c0 4.8-3.2 8.6-7.5 10.2-4.3-1.6-7.5-5.4-7.5-10.2V5.5z" fill="currentColor"/><path d="M12 7.5v6.2" stroke="#000" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="17" r="1.4" fill="#000"/>',
    healall: '<circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><path d="M10 6h4v4h4v4h-4v4h-4v-4H6v-4h4z" fill="currentColor"/>',
    gem: '<path d="M12 2l8 9-8 11-8-11z" fill="currentColor"/><path d="M4 11h16M12 2l-3 9 3 11 3-11z" fill="none" stroke="#000" stroke-width=".9" opacity=".45"/>',
    coin: '<circle cx="12" cy="12" r="9" fill="currentColor"/><circle cx="12" cy="12" r="6" fill="none" stroke="#000" stroke-width="1.4" opacity=".45"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10.5" rx="2" fill="currentColor"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2.4"/>',
    unlock: '<rect x="5" y="10.5" width="14" height="10.5" rx="2" fill="currentColor"/><path d="M8 10.5V7.5a4 4 0 0 1 7.6-1.7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
    up: '<path d="M12 3l8 9h-5v9H9v-9H4z" fill="currentColor"/>',
    box: '<path d="M3 8l9-5 9 5v9l-9 5-9-5z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/><path d="M3 8l9 5 9-5M12 13v9" fill="none" stroke="currentColor" stroke-width="2"/>',
    play: '<path d="M7 4l13 8-13 8z" fill="currentColor"/>',
    pause: '<path d="M6 4h4v16H6zM14 4h4v16h-4z" fill="currentColor"/>',
    skip: '<path d="M4 4l10 8-10 8zM15 4l7 8-7 8z" fill="currentColor"/>',
    check: '<path d="M4 12.5l5.2 5.2L20 6.5" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>',
    warn: '<path d="M12 2.8l10 17.7H2z" fill="currentColor"/><path d="M12 9v5.4M12 17.2v.6" stroke="#000" stroke-width="2.2" stroke-linecap="round"/>',
    hand: '<path d="M9 11V4.6a1.6 1.6 0 0 1 3.2 0V11l5.1 1.4c1.2.3 1.9 1.4 1.7 2.6l-.8 4.7c-.2 1.2-1.2 2.1-2.4 2.1H11c-.8 0-1.5-.4-1.9-1.1L5.5 15c-.5-.9 0-2 1-2.3 1-.3 1.9.3 2.5 1.1z" fill="#fff" stroke="#000" stroke-width="1.4" stroke-linejoin="round"/>',
    swap: '<path d="M4 8h14l-3.5-3.5M20 16H6l3.5 3.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
    wand: '<path d="M4 20L16 8l2 2L6 22z" fill="currentColor"/><path d="M17 2l1 3 3 1-3 1-1 3-1-3-3-1 3-1zM6 3l.6 1.7L8.3 5l-1.7.6L6 7.3l-.6-1.7L3.7 5l1.7-.3z" fill="currentColor"/>',
    flag: '<path d="M5 22V3M5 4h13l-3 4.5 3 4.5H5" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
    heart: '<path d="M12 20.5S3 15 3 8.8A4.6 4.6 0 0 1 12 6.6a4.6 4.6 0 0 1 9 2.2C21 15 12 20.5 12 20.5z" fill="currentColor"/>',
  };
  const ROLE_ICON = { guardian: 'shield', fighter: 'sword', assassin: 'dagger', mage: 'orb', marksman: 'bow', support: 'wings', hero: 'crown' };
  const TIER_RING = { 1: '#d9cfbd', 2: '#3d9bf0', 3: '#ffc21a' };

  function icon(name, cls) {
    return `<svg class="ic ${cls || ''}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ICONS.star}</svg>`;
  }

  function hash(str) { let h = 0; for (const c of str) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); }

  /** Emblem portrait for a unit def or hero def. */
  function portrait(def, opts) {
    opts = opts || {};
    const W = AMB.DATA.WORLDS[def.world];
    const isHero = !def.role;
    const role = isHero ? 'hero' : def.role;
    const ring = isHero ? '#ffe28a' : TIER_RING[def.tier];
    const h = hash(def.id);
    const gid = 'g' + def.id + (opts.k || '');
    const rot = h % 360;
    // a few deterministic "rift shards" per character for a unique silhouette
    let shards = '';
    for (let i = 0; i < 4; i++) {
      const a = ((h >> (i * 3)) % 360) * Math.PI / 180;
      const r1 = 18 + ((h >> i) % 10), r2 = 40 + ((h >> (i + 2)) % 8);
      const x1 = 50 + Math.cos(a) * r1, y1 = 50 + Math.sin(a) * r1;
      const x2 = 50 + Math.cos(a + 0.25) * r2, y2 = 50 + Math.sin(a + 0.25) * r2;
      const x3 = 50 + Math.cos(a - 0.2) * r2, y3 = 50 + Math.sin(a - 0.2) * r2;
      shards += `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}L${x3.toFixed(1)} ${y3.toFixed(1)}z" fill="${W.color}" opacity=".35"/>`;
    }
    // manga-panel frame: cut corners for units, octagon for heroes
    const imgSrc = AMB.IMAGES && AMB.IMAGES[def.id];
    const hasChar = !!imgSrc;
    const art = imgSrc ? `<image href="${imgSrc}" x="0" y="0" width="100" height="100" preserveAspectRatio="xMidYMin slice"/>`
      : `<g transform="translate(26 24) scale(2.0)" color="#fff" style="filter:drop-shadow(2px 2px 0 #000)">${ICONS[ROLE_ICON[role]]}</g>`;
    // small role badge (units only) so the role stays readable now that the art is a face
    const badge = !isHero && hasChar
      ? `<g transform="translate(8 66)"><circle cx="11" cy="11" r="11" fill="#000"/><circle cx="11" cy="11" r="9" fill="${ring}"/><g transform="translate(4 4) scale(.58)" color="#121010">${ICONS[ROLE_ICON[role]]}</g></g>`
      : '';
    const frame = isHero ? 'M30 3H70L97 30V70L70 97H30L3 70V30Z' : 'M3 20L20 3H97V80L80 97H3Z';
    if (opts.bare) {
      return `<svg class="portrait bare" viewBox="0 0 100 100" preserveAspectRatio="${imgSrc ? 'xMidYMid' : 'xMidYMin'} slice" aria-label="${def.name}">
      <defs><linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${W.color}"/><stop offset="1" stop-color="#1a1412"/></linearGradient>
      <pattern id="${gid}h" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(${rot % 90})"><circle cx="2.5" cy="2.5" r="1.1" fill="#000" opacity=".28"/></pattern></defs>
      <rect width="100" height="100" fill="url(#${gid})"/><rect width="100" height="100" fill="url(#${gid}h)"/>
      <g transform="rotate(${rot} 50 50)">${shards.replace(/opacity=".35"/g, 'opacity=".5" stroke="#000" stroke-width="1"').replace(new RegExp(W.color, 'g'), '#fff6dc')}</g>
      <text x="50" y="72" text-anchor="middle" font-size="58" fill="#000" opacity=".2" font-weight="900">${W.glyph}</text>${art}</svg>`;
    }
    return `<svg class="portrait ${opts.cls || ''}" viewBox="0 0 100 100" aria-label="${def.name}">
      <defs>
        <linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${W.color}"/><stop offset="1" stop-color="#1a1412"/></linearGradient>
        <pattern id="${gid}h" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(${rot % 90})"><circle cx="2.5" cy="2.5" r="1.1" fill="#000" opacity=".28"/></pattern>
        <clipPath id="${gid}c"><path d="${frame}"/></clipPath>
      </defs>
      <g clip-path="url(#${gid}c)">
        <rect width="100" height="100" fill="url(#${gid})"/>
        <rect width="100" height="100" fill="url(#${gid}h)"/>
        <g transform="rotate(${rot} 50 50)">${shards.replace(/opacity=".35"/g, 'opacity=".55" stroke="#000" stroke-width="1"').replace(new RegExp(W.color, 'g'), '#fff6dc')}</g>
        <text x="50" y="72" text-anchor="middle" font-size="58" fill="#000" opacity=".22" font-weight="900">${W.glyph}</text>
        ${art}
      </g>
      ${badge}
      <path d="${frame}" fill="none" stroke="#000" stroke-width="6" stroke-linejoin="round"/>
      <path d="${frame}" fill="none" stroke="${ring}" stroke-width="2.5" stroke-linejoin="round" transform="translate(50 50) scale(.9) translate(-50 -50)"/>
    </svg>`;
  }

  function stars(n) { return n ? `<span class="stars s${n}">${'★'.repeat(n)}</span>` : ''; }

  const WORLD_ICON = { ember: 'flame', tide: 'moon', neon: 'bolt', sylvan: 'leaf' };
  const SKILL_ICON = { nuke: 'burst', cleave: 'slash', aoe: 'blast', stunAoe: 'snow', stunStrike: 'bolt', burn: 'flame', drain: 'drop', execute: 'skull',
    snipe: 'target', multishot: 'arrows', taunt: 'taunt', shieldSelf: 'shield', healSelf: 'heart', healLowest: 'cross', healAll: 'healall', hasteAllies: 'wind' };
  const STAT_ICON = { atkPct: 'sword', hpPct: 'heart', dr: 'shield', asPct: 'wind', startMana: 'orb', skillPower: 'burst', lifesteal: 'drop', range: 'target', crit: 'dagger' };
  AMB.art = { icon, portrait, stars, ROLE_ICON, TIER_RING, ICONS, WORLD_ICON, SKILL_ICON, STAT_ICON };
})();

;
/* ui/ui.js */
/*
 * Browser UI. Drives core/match.js; holds no game rules of its own.
 */
(function () {
  const AMB = globalThis.AMB;
  const { UNITS, HEROES, WORLDS, ROLES, ITEMS, SYNERGIES, ABILITY_TRIGGERS } = AMB.DATA;
  const CFG = AMB.CONFIG;
  const { icon, portrait, stars } = AMB.art;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = (n, d) => (Math.round(n * Math.pow(10, d || 0)) / Math.pow(10, d || 0)).toLocaleString('en-US');
  const lifeStr = (l) => Math.ceil(Math.max(0, l - 1e-6));

  const S = {
    screen: 'menu', mode: 'ai', difficulty: 'normal', picks: [null, null], pickIdx: 0,
    match: null, v: 0, sel: null, phase: 'idle', deadline: 0, paused: false, pausedLeft: 0,
    combat: null, speed: 2, raf: 0, queue: [], aiFirst: false, codexF: { world: '', role: '' },
    tokenEls: {}, startTs: 0, lastReport: null,
  };

  // ======================================================================= helpers
  // Less text on screen: short label + an ⓘ button that opens the full explanation.
  // Any module can register a tip:  AMB.TIPS.key = () => ({ title, html });  then  ibtn('key')
  AMB.TIPS = AMB.TIPS || {};
  const ibtn = (k, extra) => `<button class="ibtn" data-act="info" data-k="${k}" ${extra || ''} title="شرح">ⓘ</button>`;
  // beginners (fewer than 2 finished matches) get the extra hints, then they disappear
  const coach = () => { try { return +(localStorage.getItem('amb_played') || 0) < 2; } catch (e) { return false; } };
  // senior #34: signed numbers and fractions keep left-to-right order inside Arabic text («+5», «−9», «1/7» never flip to «5+» or «7/ 1»)
  function bidiNums(html) { return String(html).split(/(<[^>]+>)/).map((part) => (part[0] === '<' ? part : part.replace(/([+\-−]\s?\d[\d.,]*%?|\d+\s?\/\s?\d+)/g, '<bdi dir="ltr">$1</bdi>'))).join(''); }
  const toastQ = [];   // QA: a toast never sits on top of an open dialog: it waits until the dialog closes (errors still show at once)
  function toast(msg, kind, html) {
    const mb = $('modal-back');
    if (kind !== 'err' && mb && mb.classList.contains('on') && !toast._flush) { if (toastQ.length < 3) toastQ.push([msg, kind, html]); return; }
    const box = $('toasts');
    // never pile up: the same message just restarts its timer, and at most 2 toasts show at once
    const same = [...box.children].find((x) => (x._m || x.textContent) === msg);
    if (same) { same.style.animation = 'none'; void same.offsetWidth; same.style.animation = ''; clearTimeout(same._t); same._t = setTimeout(() => same.remove(), kind === 'err' ? 4200 : 2500); return; }
    while (box.children.length >= 2) box.firstChild.remove();
    const el = document.createElement('div');
    el.className = 'toast ' + (kind || '');
    el._m = msg; if (html) el.innerHTML = bidiNums(msg); else el.innerHTML = bidiNums(esc(msg));
    box.appendChild(el);
    el._t = setTimeout(() => el.remove(), kind === 'err' ? 4200 : 2500);
  }
  function show(screen) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === 'scr-' + screen));
    S.screen = screen;
    document.body.classList.toggle('in-match', screen === 'match');
    document.body.dataset.nav = ['menu', 'cards', 'packs', 'pass', 'campaign', 'tower', 'event', 'mode', 'codex', 'stats'].includes(screen) ? '1' : '0';
    document.body.classList.remove('more-open');
    document.querySelectorAll('#bnav button').forEach((b) => b.classList.toggle('on', b.dataset.n === screen));
    if (screen === 'menu') { try { fillMenu(); } catch (err) { reportErr(err); } }   // page scroll is locked only during a match
    if (screen === 'mode') { const wr = $('weekly-rule'); if (wr) { const W0 = AMB.Match.WEEKLY[AMB.Match.weeklyNow()]; wr.innerHTML = `📅 <b>قاعدة الأسبوع: ${W0.name}</b> · ${W0.text}`; } }
    window.scrollTo(0, 0);
    // every screen refreshes on its own: one that fails must never stop the others (or leave the player stuck)
    const T = (f) => { try { f(); } catch (err) { reportErr(err); } };
    const A = globalThis.AMB, menu = screen === 'menu';
    if (A && A.PassUI) { if (menu) T(() => A.PassUI.refreshMenu()); if (screen === 'pass') T(() => A.PassUI.render()); }
    if (A && A.CollectionUI) { if (menu) T(() => A.CollectionUI.refreshMenu()); if (screen === 'cards') T(() => A.CollectionUI.render()); }
    if (A && A.PacksUI) { if (menu) T(() => A.PacksUI.refreshMenu()); if (screen === 'packs') T(() => A.PacksUI.render()); }
    if (A && A.EventUI) { if (screen === 'event') T(() => A.EventUI.render()); if (menu) T(() => A.EventUI.refreshMenu()); }
    if (A && A.TowerUI) { if (screen === 'tower') T(() => A.TowerUI.render()); if (menu) T(() => A.TowerUI.refreshMenu()); }
    if (A && A.CampaignUI) { if (screen === 'campaign') T(() => A.CampaignUI.render()); if (menu) T(() => A.CampaignUI.refreshMenu()); }
    if (A && A.GiftUI && menu) T(() => A.GiftUI.onMenu());
    if (A && A.DailyUI && menu) T(() => A.DailyUI.onMenu());
  }
  // errors are shown on screen (short) so a problem on a real phone can be reported and fixed, instead of a button silently doing nothing
  let lastErr = '';
  function reportErr(err) {
    const msg = String((err && err.message) || err || 'خطأ').slice(0, 90);
    try { console.error(err); } catch (e) { /* ignore */ }
    if (msg === lastErr) return; lastErr = msg; setTimeout(() => { lastErr = ''; }, 4000);
    try { toast('⚠ ' + msg + (err && err.stack ? ' · ' + (String(err.stack).split('\n')[1] || '').trim().slice(-40) : ''), 'err'); } catch (e) { /* ignore */ }
  }
  window.addEventListener('error', (ev) => reportErr(ev.error || ev.message));
  window.addEventListener('unhandledrejection', (ev) => reportErr(ev.reason));
  function modal(html) { $('modal').innerHTML = `<button class="btn small ghost x" data-act="closeModal">✕</button>` + html; $('modal-back').classList.add('on');
    // opening any details window stops the prep timer so you can read in peace
    if (S.phase === 'prep' && !S.paused && S.mode !== 'online') { S.paused = true; S.pausedLeft = S.deadline - Date.now(); S._mp = true; renderTop(); }
  }
  function closeModal() {
    $('modal-back').classList.remove('on');
    if (toastQ.length) { const q = toastQ.splice(0, toastQ.length); setTimeout(() => q.forEach((a) => toast(...a)), 250); }
    if (S._mp) { S._mp = false; if (S.paused && S.phase === 'prep') { S.paused = false; S.deadline = Date.now() + S.pausedLeft; renderTop(); } }   // resume the prep timer
  }
  function overlay(html) { $('overlay').innerHTML = html; $('overlay').classList.add('on'); }
  function closeOverlay() { $('overlay').classList.remove('on'); $('overlay').innerHTML = ''; }

  const mySeat = () => (S.mode === 'online' && S.net ? S.net.idx : 0);
  const me = () => S.match.players[S.v];
  const opp = () => S.match.players[1 - S.v];
  const res = (r) => { if (!r.ok) toast(r.reason, 'err'); return r.ok; };

  // hero ownership (core/collection.js): player 1 picks among owned heroes; a brand-new player first picks a starter.
  // Player 2 on the same device is a guest and may use any hero.
  const starterPick = () => S.pickIdx === 0 && AMB.collection && AMB.collection.needsStarter();
  // teen #16: against a friend (online) and on the same device every hero is open: those matches are pure skill (no card power, no hero ownership)
  const heroLocked = (id) => (S.mode === 'online' && AMB.NetUI && AMB.NetUI.usedInSeries(id)) || S.mode !== 'online' && S.mode !== 'hotseat' && S.pickIdx === 0 && AMB.collection && (starterPick() ? !AMB.DATA.HERO_STARTERS.includes(id) : !AMB.collection.owned(id));
  // one compact hero card, shared by the quick-match picker and the campaign's first-hero picker (same look in both)
  function heroPickHTML(h, o) {
    o = o || {};
    const W = WORLDS[h.world];
    const lock = o.locked ? '<span class="hp-lock">🔒</span>' : '';
    const lv = o.level && AMB.heroes ? `<span class="hp-lv">مستوى ${AMB.heroes.level(h.id)}</span>` : '';
    return `<div class="hpick ${o.sel ? 'sel' : ''} ${o.locked ? 'locked' : ''}" style="--wc:${W.color}" data-act="${o.act || 'pickHero'}" data-id="${h.id}" role="button" aria-pressed="${o.sel ? 'true' : 'false'}">${o.badge || ''}${lock}
      <div class="hp-pic">${portrait(h, { k: 'hp' + (o.k || '') + h.id })}</div>
      <b class="hp-name">${h.name}</b><span class="hp-world">${W.name}</span>${lv}
      <p class="hp-style">${esc(String(h.style).split('—')[0])}</p>
      <div class="hp-btns"><button class="btn small ghost hp-info" data-act="heroInfo" data-id="${h.id}">ⓘ تفاصيل</button>${o.trial ? `<button class="btn small hp-try" data-act="heroTry" data-id="${h.id}">▶ جرّب</button>` : ''}</div>
    </div>`;
  }
  function renderHeroSelect() {
    const first = starterPick();
    const who = first ? 'اختر بطلك الأول'
      : S.mode === 'hotseat' ? `اللاعب ${S.pickIdx + 1}: اختر بطلك` : 'اختر بطلك';
    const sub = first ? 'ما تقدر تغيّره بعدين. جرّب أي واحد بقتال تدريب قبل لا تختار، والباقين تفتحهم من الحملة (كل بطل بمستواه، بالثلاث صعوبات).'
      : S.mode === 'hotseat' && S.pickIdx === 1 ? 'ضيف: كل الأبطال متاحين' : '';
    $('hero-title').textContent = who;
    if (S.picks[S.pickIdx] && heroLocked(S.picks[S.pickIdx])) S.picks[S.pickIdx] = null;
    const cur = S.picks[S.pickIdx];
    const list = Object.values(HEROES).filter((h) => !first || AMB.DATA.HERO_STARTERS.includes(h.id));   // a new player only sees the four they can pick
    $('hero-grid').innerHTML = (sub ? `<p class="hp-sub">${sub}</p>` : '') + list.map((h) => heroPickHTML(h, {
      sel: cur === h.id, locked: heroLocked(h.id), trial: first, level: S.mode !== 'hotseat' && S.mode !== 'online' && !first,
      badge: S.mode === 'hotseat' && S.pickIdx === 1 && S.picks[0] === h.id ? '<span class="pick-badge">اللاعب 1</span>' : '',
    })).join('');
    $('hero-confirm').disabled = !cur;
    $('hero-confirm').textContent = first ? (cur ? `خذ ${HEROES[cur].name} بطلي الأول` : 'اختر بطل') : S.mode === 'hotseat' && S.pickIdx === 0 ? 'تمام، دور اللاعب 2' : 'ابدأ المباراة';
  }

  // ---- hero trial (practice fight): try a starter before choosing it. Nothing from it is saved (no rewards, XP, stats, pass).
  function startPractice(heroId, from) {
    S.practice = { from, prevMode: S.mode, picks: S.picks.slice(), pickIdx: S.pickIdx };
    S.mode = 'practice'; S.picks = [heroId, null]; S.pickIdx = 0;
    closeModal(); startMatch();
  }
  function endPractice() {
    const pr = S.practice || { from: 'hero', prevMode: 'ai', picks: [null, null], pickIdx: 0 };
    closeOverlay(); closeModal(); cancelAnimationFrame(S.raf); S.phase = 'idle'; S.match = null; S.paused = false;
    S.mode = pr.prevMode; S.picks = pr.picks; S.pickIdx = pr.pickIdx; S.practice = null;
    if (pr.from === 'campaign') show('campaign');
    else { renderHeroSelect(); show('hero'); }
  }
  function practiceResult(m, secs) {
    const won = m.winner === 0, h = HEROES[m.players[0].heroId];
    $('results').innerHTML = `<div class="res-stage ${won ? 'victory' : m.winner == null ? 'draw' : 'defeat'}" style="--wc:${WORLDS[h.world].color}"><div class="res-rays"></div>
        <div class="res-hero">${portrait(h, { bare: true, k: 'prh' })}<i class="sheen"></i></div><div class="res-hname">${h.name}</div></div>
      <div class="res-banner"><h1>${won ? 'فزت بالتدريب!' : m.winner == null ? 'تعادل' : 'خسرت التدريب'}</h1>
        <p class="hint">النتيجة ${m.players[0].stats.wins} – ${m.players[1].stats.wins} · ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')} دقيقة</p>
        <p class="hint">قتال تدريب: ما ينحسب ولا يعطي جوائز. ${HEROES[m.players[0].heroId].name} للحين مو بطلك.</p></div>
      <div class="cam-btns"><button class="btn primary big" data-act="practiceBack">ارجع واختر بطلك</button>
        <button class="btn big ghost" data-act="again">جرّب مرة ثانية</button></div>`;
    show('results');
    sfx(won ? 'win' : 'lose');
  }

  const maxR = () => (S.match && S.match.rules ? S.match.rules.maxRounds : CFG.match.maxRounds);
  // rotate button: lock the screen to landscape / portrait (Android Chrome and the installed app; iPhones can't be locked from a web page)
  function rotateScreen() {
    const land = innerWidth > innerHeight;
    const want = land ? 'portrait' : 'landscape';
    const done = () => { try { toast(want === 'landscape' ? 'دوّرت لك الشاشة عرضي' : 'رجعت للطول', 'good'); } catch (e) { /* ignore */ } };
    const lock = () => screen.orientation.lock(want).then(done).catch(() => toast('جوالك ما يسمح بالتدوير من اللعبة، دوّره بنفسك أو شغّل التدوير التلقائي', 'err'));
    try {
      if (!(screen.orientation && screen.orientation.lock)) throw new Error('no lock');
      const fs = document.documentElement.requestFullscreen;
      if (!document.fullscreenElement && fs && !(matchMedia('(display-mode: standalone)').matches)) fs.call(document.documentElement).then(lock).catch(lock); else lock();
    } catch (e) { toast('جوالك ما يسمح بالتدوير من اللعبة، دوّره بنفسك أو شغّل التدوير التلقائي', 'err'); }
  }
  // closing/reloading in the middle of a match loses it: ask first (the browser shows its own wording)
  window.addEventListener('beforeunload', (e) => { if (S.match && S.screen === 'match' && S.mode !== 'tutorial' && !S.match.isOver) { e.preventDefault(); e.returnValue = ''; } });
  function startMatch() {
    S.panels = false; $('scr-match').classList.remove('show-panels');
    const heroIds = Object.keys(HEROES);
    let players;
    if (S.mode === 'hotseat') {
      players = [{ heroId: S.picks[0], name: 'لاعب 1' }, { heroId: S.picks[1], name: 'لاعب 2' }];
    } else {
      const ch = S.mode === 'ai' ? S.challenge : null;   // adult #29: a friend's challenge replays the exact same match (same seed, same computer), with no card power for either side
      const aiHero = ch ? ch.a : heroIds[Math.floor(Math.random() * heroIds.length)];
      const styles = ['mono', 'mixed', 'balanced'];
      const aiStyle = ch ? ch.st : S.difficulty === 'hard' || S.difficulty === 'expert' ? 'mono' : styles[Math.floor(Math.random() * 3)];
      if (ch) { S.picks = [ch.h, null]; S.difficulty = ch.d; }
      players = [
        { heroId: S.picks[0], name: 'أنت', cardPower: !ch && AMB.collection ? AMB.collection.powerMap() : null, heroLevel: !ch && AMB.heroes ? AMB.heroes.level(S.picks[0]) : 1 },
        { heroId: aiHero, name: 'الكمبيوتر', isAI: true, aiStyle, difficulty: S.mode === 'friendly' ? 'easy' : S.difficulty },   // hard/expert always use the strongest style (their hero's world)
      ];
    }
    // campaign fight (ui/campaign-ui.js): fixed enemy line-up, short best-of-3 rules, your card levels count
    S.match = S.mode === 'campaign' ? new AMB.Match(AMB.campaign.matchOptions(S.campaign.fightId, S.picks[0]))
      : S.mode === 'tower' ? new AMB.Match(AMB.tower.matchOptions(S.tower.floor, S.picks[0]))
      : S.mode === 'event' ? new AMB.Match(AMB.weekly.matchOptions(S.event.stage, S.picks[0]))
      : S.mode === 'tutorial' ? new AMB.Match(AMB.tutorial.matchOptions(S.picks[0]))
      : S.mode === 'practice' ? new AMB.Match(AMB.Tutorial.practiceOptions(S.picks[0]))
      : S.mode === 'online' ? AMB.NetUI.makeMatch()
      // adult #22: a short match: 4 rounds, first to 3 round wins, starts at shop level 2 with more gold (about 3 minutes)
      : S.mode === 'short' ? new AMB.Match({ mode: 'short', players, rules: { maxRounds: 8, winsNeeded: 5, start: { gold: 8, level: 2 } } })
      : new AMB.Match({ mode: S.mode, players, seed: S.mode === 'ai' && S.challenge ? S.challenge.s : undefined, weekly: S.mode === 'ai' && S.challenge ? (AMB.Match.WEEKLY[S.challenge.w] ? S.challenge.w : null) : S.mode === 'ai' || S.mode === 'hotseat' ? AMB.Match.weeklyNow() : null });
    // same hero on both sides (e.g. your Kiro vs the Ember boss Kiro): the enemy becomes its "shadow"
    const mirror = S.match.players[0].heroId === S.match.players[1].heroId;
    document.body.classList.toggle('mirror-foe', mirror);
    if (mirror && S.mode === 'campaign') { const hn = HEROES[S.match.players[1].heroId].name, e = S.match.players[1]; if (e.name.includes(hn)) e.name = e.name.replace(hn, 'ظلّ ' + hn); }
    resumeStart(players);
    undoInstall();
    if (S.match.weekly) { const W0 = AMB.Match.WEEKLY[S.match.weekly]; setTimeout(() => toast(`📅 قاعدة الأسبوع: ${W0.name} · ${W0.text}`, 'good'), 900); }
    S.startTs = Date.now();
    S.speed = AMB.settings ? AMB.settings.speed() : 1;   // the last speed the player picked (1x for a new player)
    show('match');
    nextRound();
  }

  // ======================================================================= round flow
  function prepSeconds() {
    if (S.mode === 'tutorial') return 9999;   // no clock while you learn
    const bonus = AMB.pass ? AMB.pass.prepBonus() : 0;   // battle-pass perk (+ a few seconds, never stats)
    // senior #33: "on your own pace" against the computer: double time or no clock (online and same-device keep the normal clock)
    const tm = AMB.settings && S.mode !== 'online' && S.mode !== 'hotseat' ? AMB.settings.get('timer') : 'normal';
    if (tm === 'off') return 9999;
    return (prepBase() + bonus) * (tm === 'x2' ? 2 : 1);
  }
  function prepBase() {
    const learn = S.match && S.match.round <= 2 ? 20 : 0;   // first two rounds: +20s to learn the screen
    if (S.mode === 'hotseat') return CFG.match.hotseatPrepSeconds + learn;
    if (S.mode === 'friendly' || S.mode === 'practice') return CFG.match.prepSeconds * 2 + learn;
    return CFG.match.prepSeconds + learn;
  }

  function nextRound() {
    const m = S.match;
    resumeSaveRound();
    m.startRound();
    if (S.mode === 'tutorial') AMB.tutorial.onRound(m);   // fixed shop for the guided match
    S.combat = null;
    if (S.mode === 'online') { beginPrep(mySeat()); return; }   // no computer opponent: your friend's moves arrive when they press ready
    if (S.mode === 'hotseat') {
      S.queue = m.round % 2 ? [0, 1] : [1, 0]; // alternate who shops first (shared pool)
      handoff(S.queue.shift());
    } else {
      S.aiFirst = m.round % 2 === 0;       // alternate first pick from the shared pool
      if (S.aiFirst) AMB.AI.prep(m, 1);
      beginPrep(0);
      // first quick match ever: two short lines on what decides matches (shown once; the modal pauses the prep timer)
      const ST = AMB.settings;
      if (S.mode === 'ai' && m.round === 1 && ST && !ST.seen('qmTips')) setTimeout(function qm() {
        if (S.screen !== 'match' || S.mode !== 'ai') return;
        if (S.phase !== 'prep') { setTimeout(qm, 200); return; }   // wait for the prep timer to run, so opening the modal pauses it
        ST.markSeen('qmTips');
        modal(`<h2>قبل ما تبدأ</h2><p>${icon('crown')} <b>مستوى المتجر ١–٥</b>: كل مستوى يفتح بطاقات بنجمة زيادة ويكبّر الساحة. ارفعه بزر الترقية ${icon('up')} (سعره ينزل 1 كل جولة ما رقّيت فيها). ٣ نسخ من نفس البطاقة تندمج في وحدة مطوّرة.</p>
          <p>${icon('sword')} <b>نزّل البطل</b> 👑 لما تكون حياتك زينة: يقاتل معك ويقوّي فريقك.</p>
          <div style="text-align:center;margin-top:10px"><button class="btn primary big" data-act="closeModal">فهمت</button></div>`);
      }, 300);
    }
  }

  // ---- quick-start guide: shown once automatically, reopen with "؟"
  function showTutorial() {
    const steps = [
      ['crown', 'اشترِ', 'اضغط بطاقة المتجر'],
      ['shield', 'ضعها في الساحة', '<b>حارس ومقاتل</b> قدّام · <b>ساحر وقناص ودعم</b> ورا'],
      ['star', 'غيّر رأيك', 'اضغط الوحدة: بيع أو تبديل'],
      ['burst', 'الترقية ★', '٣ نسخ متطابقة = نجمة'],
      ['sword', 'جاهز', 'القتال تلقائي · ' + (S.match && S.match.rules ? 'لين ٨ جولات' : '٨ جولات')],
    ];
    modal(`<h2>دليل سريع</h2><div class="tut">${steps.map((st, i) => `<div class="tut-step"><span class="tut-n">${i + 1}</span><span class="tut-ic">${icon(st[0])}</span><div><b>${st[1]}</b><p>${st[2]}</p></div></div>`).join('')}</div>
      <p class="hint" style="text-align:center;margin:8px 0 0">لو احتجت شرح أكثر اضغط ⓘ في أي مكان</p>
      <div style="text-align:center;margin-top:10px"><button class="btn primary big" data-act="closeModal">فهمت</button></div>`);
    try { localStorage.setItem('amb_tut', '1'); } catch (e) { /* ignore */ }
  }

  // ---- stage rewards (draft 1 of 3)
  function rewardHTML(id, stage) {
    const R = AMB.DATA.REWARDS[id], m = S.match;
    const unit = id === 'unit' ? `<span class="rw-tag">فئة ${R.tiers[stage]}</span>` : '';
    const bless = id.startsWith('bless') ? '<span class="rw-tag perm">دائمة</span>' : '';
    return { R, text: m.rewardText(id, stage), tags: unit + bless };
  }
  function showRewards(pi) {
    const m = S.match, p = m.players[pi], o = p.rewardOffer, st = AMB.CONFIG.match.stages[o.stage];
    S.rewardFor = pi;
    overlay(`<div class="ov-card rw"><h2>🎁 مكافأة مرحلة «${st.name}»</h2>
      <p class="hint">${S.mode === 'hotseat' ? esc(p.name) + ': ' : ''}اختر مكافأة واحدة.${o.trailing ? ' <b style="color:var(--red)">خيار زيادة لأنك متأخر بالحياة.</b>' : ''}</p>
      <div class="rw-grid">${o.options.map((id, i) => { const r = rewardHTML(id, o.stage); return `<button class="rw-card ${id.startsWith('bless') ? 'bless' : id}" data-act="claimReward" data-idx="${i}"><span class="rw-ic">${icon(r.R.icon)}</span><b>${r.R.name}</b><span class="rw-tx">${r.text}</span>${r.tags}</button>`; }).join('')}</div></div>`);
  }
  function rewardHandoff(pi) {
    const p = S.match.players[pi];
    overlay(`<div class="ov-card"><h2>دور ${esc(p.name)}</h2><p class="hint">عطِ الجهاز لـ ${esc(p.name)} عشان يختار المكافأة.</p>
      <button class="btn primary big" data-act="rewardGo" data-pi="${pi}">أنا جاهز</button></div>`);
  }
  function afterReward() {
    const m = S.match;
    if (S.mode === 'hotseat' && S.rewardQueue.length) { rewardHandoff(S.rewardQueue.shift()); return; }
    closeOverlay();
    if (S.mode !== 'hotseat') { /* AI already picked */ }
    nextRound();
  }

  function handoff(pi) {
    const p = S.match.players[pi];
    S.v = pi;
    S.phase = 'handoff';
    renderMatch();
    overlay(`<div class="ov-card"><h2>دور ${esc(p.name)}</h2>
      <p class="hint">الجولة ${S.match.round}. عطِ الجهاز لـ ${esc(p.name)}، والخصم لا يطالع وقت التجهيز.</p>
      <p>${portrait(HEROES[p.heroId], { k: 'ho' }).replace('class="portrait', 'style="width:80px;height:80px" class="portrait')}</p>
      <button class="btn primary big" data-act="handoffGo" data-pi="${pi}">أنا جاهز</button></div>`);
  }

  function beginPrep(pi) {
    closeOverlay();
    const ctr = document.querySelector('.center'); if (ctr) ctr.scrollTop = 0;
    S.v = pi;
    S.sel = null;
    S.phase = 'resources';
    S.paused = false;
    S.shopOpen = S.mode !== 'tutorial';   // the drawer opens at the start of every prep (shop first), close it to arrange
    renderMatch();
    // the first-run guide opens in a moment: skip the round banner and income toast so nothing stacks on it
    const tutNext = false;
    if (!tutNext) { const st = S.match.stageInfo(), first = st.rounds[0] === S.match.round;
      if (S.match.rules) banner(`${icon('flag')} <bdi dir="ltr">${S.match.round}<small>/${maxR()}</small></bdi>`, S.match.round === 1 ? '' : 'fight');
      else if (st.id === 'finale') banner(`${icon('sword')}${icon('sword')} <bdi dir="ltr">${S.match.round}<small>/${CFG.match.maxRounds}</small></bdi>`, 'fight');
      else banner(`${icon('flag')} <bdi dir="ltr">${S.match.round}<small>/${CFG.match.maxRounds}</small></bdi>`); }
    const p = me();
    const inc = p.lastIncome;
    if (inc && !tutNext) {
      const ess = S.match.round > 1 ? CFG.economy.essencePerRound + (HEROES[p.heroId].passive.id === 'deep_reserve' ? 2 : 0) : 0;
      toast(`+${inc.total} ${icon('gold')}${ess ? ` &nbsp; +${ess} ${icon('essence')}` : ''}`, 'good', true);
    }
    setTimeout(() => {
      if (S.phase !== 'resources') return;
      S.phase = 'prep';
      S.deadline = Date.now() + prepSeconds() * 1000;
      renderMatch();
      if (AMB.TutorialUI) AMB.TutorialUI.poke();
    }, 900);
  }

  function endPrep() {
    if (S.phase !== 'prep' && S.phase !== 'resources') return;
    commitDrag();
    const m = S.match;
    m.autoFill(S.v);
    S.sel = null;
    if (S.mode === 'online') { AMB.NetUI.iAmReady(); return; }
    if (S.mode === 'hotseat' && S.queue.length) { handoff(S.queue.shift()); return; }
    if (S.rs) S.rs.cur = { aiFirst: !!S.aiFirst, prep: S.rs.rec.take() };   // adult #21: this round's moves, for "continue your match"
    if (S.mode !== 'hotseat' && !S.aiFirst) AMB.AI.prep(m, 1);
    startCombat();
  }

  // ---- senior #39: "↶ تراجع": take back the last move of this prep (buy, sell, move, items, XP, hero). Not online, not same-device, never across a reroll.
  const UNDOABLE = ['buy', 'sell', 'move', 'buyItem', 'equip', 'unequip', 'sellItem', 'buyXp', 'toggleSummon', 'moveHero', 'autoArrange', 'armSpell', 'disarmSpell', 'toggleLock', 'setAbility', 'setWager', 'setHunt'];
  function undoInstall() {
    S.undo = [];
    const m = S.match; if (!m || S.mode === 'online' || S.mode === 'hotseat' || S.mode === 'tutorial') return;
    UNDOABLE.forEach((name) => {
      const fn = m[name]; if (typeof fn !== 'function') return;
      m[name] = function (pi, ...args) {
        if (pi !== 0 || S._undoDepth || S.phase !== 'prep' && S.phase !== 'resources') return fn.call(this, pi, ...args);
        const snap = this.snapshot(0), recLen = S.rs && S.rs.rec ? S.rs.rec.peek().length : -1; S._undoDepth = (S._undoDepth || 0) + 1;
        let r; try { r = fn.call(this, pi, ...args); } finally { S._undoDepth--; }
        if (!r || r.ok !== false) { S.undo.push({ snap, recLen }); if (S.undo.length > 20) S.undo.shift(); }
        return r;
      };
    });
    const rr = m.reroll; m.reroll = function (...a) { const r = rr.apply(this, a); if (r && r.ok !== false) S.undo = []; return r; };   // randomness: no going back past a reroll
    ['buy', 'claimMerge'].forEach((n) => { const f = m[n]; m[n] = function (...a) { const r = f.apply(this, a); if (r && r.ok !== false && ((r.merged && r.merged.length) || this.players[0].mergePick)) S.undo = []; return r; }; });   // a merge draws its reward cards at random: no going back past it
    const sr = m.startRound; m.startRound = function (...a) { S.undo = []; return sr.apply(this, a); };
  }
  // ---- adult #21: continue an unfinished quick match after a reload (the match is rebuilt by replaying the recorded moves; it is deterministic)
  const RS_KEY = 'zor_resume_v1';
  function resumeStart(players) {
    S.rs = null;
    if (S.mode !== 'ai') return;
    S.rs = { opts: { mode: 'ai', seed: S.match.seed, players, weekly: S.match.weekly }, rounds: [], cur: null, rec: AMB.NetSync.record(S.match, 0), diff: S.difficulty, picks: S.picks.slice() };
  }
  function resumeSaveRound() {
    if (!S.rs || !S.rs.cur) return;
    S.rs.cur.reward = S.rs.rec.take(); S.rs.rounds.push(S.rs.cur); S.rs.cur = null;
    try { localStorage.setItem(RS_KEY, JSON.stringify({ opts: S.rs.opts, rounds: S.rs.rounds, hash: AMB.NetSync.hash(S.match), diff: S.rs.diff, picks: S.rs.picks, at: Date.now(), t: Date.now() - (S.startTs || Date.now()) })); } catch (e) { /* ignore */ }
  }
  function resumeClear() { if (S.rs) S.rs = null; try { localStorage.removeItem(RS_KEY); } catch (e) { /* ignore */ } }
  function resumeSaved() { try { const v = JSON.parse(localStorage.getItem(RS_KEY)); return v && v.opts && Array.isArray(v.rounds) && v.rounds.length ? v : null; } catch (e) { return null; } }
  function resumeRebuild(sv) {
    const m = new AMB.Match(sv.opts);
    for (const r of sv.rounds) {
      m.startRound();
      if (r.aiFirst) AMB.AI.prep(m, 1);
      if (AMB.NetSync.replay(m, 0, r.prep).length) return null;
      m.autoFill(0);
      if (!r.aiFirst) AMB.AI.prep(m, 1);
      m.resolveCombat(m.createCombat(false).runToEnd());
      if (AMB.NetSync.replay(m, 0, r.reward || []).length) return null;
      if (m.players[1].rewardOffer && !m.players[1].rewardOffer.claimed) AMB.AI.claimReward(m, 1);
      if (m.isOver) return null;
    }
    return AMB.NetSync.hash(m) === sv.hash ? m : null;
  }
  function resumeMatch() {
    const sv = resumeSaved(); if (!sv) return;
    let m = null; try { m = resumeRebuild(sv); } catch (e) { m = null; }
    if (!m) { resumeClear(); toast('ما قدرت أرجّع المباراة، نبدأ من جديد', 'err'); fillMenu(); return; }
    S.mode = 'ai'; S.difficulty = sv.diff || S.difficulty; S.picks = sv.picks || [m.players[0].heroId, null]; S.match = m; S.v = 0; S.sel = null; S.combat = null;
    S.rs = { opts: sv.opts, rounds: sv.rounds, cur: null, rec: AMB.NetSync.record(m, 0), diff: sv.diff, picks: S.picks };
    undoInstall();
    document.body.classList.toggle('mirror-foe', m.players[0].heroId === m.players[1].heroId);
    S.startTs = Date.now() - (sv.t || 0); S.speed = AMB.settings ? AMB.settings.speed() : 1;
    show('match'); toast(`كمّلنا مباراتك: الجولة ${m.round + 1} من ${CFG.match.maxRounds}`, 'good');
    nextRound();
  }

  setInterval(() => {
    if (S.screen !== 'match' || S.phase !== 'prep') { if (document.querySelector('.drag-ghost')) cancelDrag(); return; }
    const el = document.querySelector('.timer');
    if (S.paused) return;
    const left = Math.max(0, S.deadline - Date.now());
    if (el) { el.textContent = S.mode === 'tutorial' || left > 3600000 ? '∞' : Math.ceil(left / 1000) + 'ث'; el.classList.toggle('warn', left < 6000 && S.mode !== 'tutorial'); }
    if (left <= 0) endPrep();
  }, 200);

  // ======================================================================= combat playback
  function startCombat() {
    const m = S.match;
    cancelDrag();
    closeOverlay();
    S.combatViewer = mySeat();
    S.v = mySeat();
    S.combat = m.createCombat(true);
    S.phase = 'combat';
    renderMatch();
    buildTokens();
    banner(`${icon('sword')}`, 'fight');
    let last = performance.now(), acc = 0;
    const step = (ts) => {
      if (S.phase !== 'combat') return;
      const dt = Math.min(0.1, (ts - last) / 1000);
      last = ts;
      if (!S.paused) {
        acc += dt * S.speed;
        while (acc >= CFG.combat.dt && !S.combat.over) { S.combat.step(); acc -= CFG.combat.dt; }
      }
      drawCombat();
      if (S.combat.over) { setTimeout(finishCombat, 700); return; }
      S.raf = requestAnimationFrame(step);
    };
    S.raf = requestAnimationFrame(step);
  }

  function skipCombat() {
    if (S.phase !== 'combat') return;
    S.combat.runToEnd();
    S.combat.drainEvents();
    drawCombat(true);
  }

  function finishCombat() {
    if (S.phase !== 'combat') return;
    cancelDrag();
    cancelAnimationFrame(S.raf);
    S.phase = 'result';
    const m = S.match;
    const rep = m.resolveCombat(S.combat.result);
    S.lastReport = rep;
    renderMatch(true);
    const mi = mySeat();
    if (rep.winner != null) sfx(S.mode === 'hotseat' || rep.winner === mi ? 'win' : 'lose');
    const over = m.isOver;
    const decider = over && m.winner != null ? m.winner : rep.winner;   // the last round can be lost by the player who still wins the match on total life
    let cls;
    if (decider === null || decider === undefined) cls = 'draw';
    else if (S.mode === 'hotseat') cls = 'win';
    else cls = decider === mi ? 'win' : 'lose';
    const side = (i) => { const r = rep.players[i], pl = m.players[i]; return `<div class="rr-side ${rep.winner === i ? 'won' : ''}">${portrait(r.heroKilled ? HEROES[pl.heroId] : HEROES[pl.heroId], { k: 'rr' + i })}
        <small class="rr-who">${S.mode === 'hotseat' ? esc(pl.name) : i === mi ? 'أنت' : esc(pl.name)}</small><div class="rr-life">${icon(r.heroKilled ? 'skull' : 'heart')} <b>${lifeStr(r.lifeAfter)}</b></div>${(r.backlash + r.direct) > 0 ? `<div class="rr-dmg"><bdi dir="ltr">−${Math.round(r.backlash + r.direct)}</bdi></div>` : '<div class="rr-dmg">&nbsp;</div>'}</div>`; };
    const me0 = rep.players[mi];
    const why = S.mode !== 'hotseat' && rep.winner === 1 - mi ? (me0.exposed ? `<div class="rr-why">${icon('shield')}<i>✗</i> ➜ ${icon('warn')}</div>` : `<div class="rr-why">${icon('star')} ➜ ${icon('sword')}</div>`) : '';
    const title = rep.winner === null ? `الجولة ${m.round}: تعادل`
      : S.mode === 'hotseat' ? `الجولة ${m.round}: فاز ${esc(m.players[rep.winner].name)}`
      : over ? (decider === mi ? 'فزت بالمباراة! 🎉' : 'خسرت المباراة')
      : `الجولة ${m.round}: ${rep.winner === mi ? 'فزت' : 'خسرت'}`;
    const whyTxt = S.mode !== 'hotseat' && rep.winner === 1 - mi ? (me0.exposed ? 'سقط خط الدفاع عندك' : 'العدو كان أقوى هالجولة') : '';
    let whyNums = '';
    if (S.mode !== 'hotseat' && rep.winner === 1 - mi && S.combat) {   // "ليش خسرت؟" in three numbers: units on each side, when your front row fell, gold left unspent
      const sd = S.combat.sides, mine = (sd[mi].spec.units || []).length, theirs = (sd[1 - mi].spec.units || []).length, fd = sd[mi].frontDownAt, gold = m.players[mi].gold;
      whyNums = `<div class="rr-nums"><span>${icon('shield')} <b>${mine}</b> ضد <b>${theirs}</b></span>${mine ? `<span>${icon('warn')} ${fd != null ? `سقط الصف الأمامي <b>${fd.toFixed(1)}ث</b>` : 'الصف الأمامي صمد'}</span>` : ''}${gold > 0 ? `<span>${icon('gold')} <b>${gold}</b> ذهب ما صرفته</span>` : ''}</div>`;
    }
    overlay(`<div class="ov-card rr ${cls}"><div class="rr-title">${title}</div><div class="rr-big">${icon(cls === 'draw' ? 'swap' : cls === 'lose' ? 'shield' : 'crown')}</div>
      <div class="rr-row">${side(0)}<div class="rr-vs">${icon('sword')}</div>${side(1)}</div>${why}${whyTxt ? `<div class="rr-note">${whyTxt}</div>` : ''}${whyNums}${rep.finale ? `<div class="rr-why">${icon('flame')} ×${CFG.match.finaleLossMult}</div>` : ''}
      <button class="btn primary big rr-go" data-act="${over ? 'toResults' : m.rewardPending ? 'rewards' : 'nextRound'}">${over ? 'النتيجة' : m.rewardPending ? 'اختر مكافأتك' : 'الجولة الجاية'}</button></div>`);
  }

  // ---- card helpers shared by shop / bench / field / codex
  function cardStats(def, star) {
    const sm = CFG.stars.mult[star || 1];
    return { hp: Math.round(def.hp * sm), atk: Math.round(def.atk * sm) };
  }
  // Icon language: every fact on a card is a symbol, only numbers (and one short name) remain as text.
  const ART = AMB.art;
  const disc = (cls, iconName, title, tip) => `<span class="bd ${cls}" title="${esc(title || '')}" ${tip ? `data-act="tip" data-k="${tip[0]}" data-id="${tip[1]}"${tip[2] ? ` data-x="${tip[2]}"` : ''}` : ''}>${icon(iconName)}</span>`;
  const gems = (n) => `<span class="gems t${n}">${'★'.repeat(n)}</span>`;
  const sv = (ic, v, cls) => `<span class="sv ${cls || ''}">${icon(ic)}<b>${v}</b></span>`;

  /** Fantasy-card look. 'full' = shop/codex card; 'mini' = board minion (oval portrait + attack/health discs). */
  // ---- merge: a clear moment (flash + burst + sound) and the reward pick (1 of 3, one star above the shop level)
  function mergeFx(uid, merged) {
    sfx('merge');
    if (merged && !(S.match.players[S.v] && S.match.players[S.v].mergePick)) merged.forEach((u) => toast(`🎉 اندمجت! ${UNITS[u.defId].name}: بطاقة مطوّرة ×${CFG.stars.mult[2]}`, 'good'));
    S.pop = { uid, merged: true };
    setTimeout(() => {
      const el = document.querySelector(`[data-drag="unit:${uid}"]`);
      const fl = document.createElement('div'); fl.className = 'merge-flash'; document.body.appendChild(fl); setTimeout(() => fl.remove(), 1000);
      if (el) { burst(el, '#ffd24a', 30, { r: 80, s: 8 }); burst(el, '#ffffff', 14, { r: 50 }); burst(el, '#ff5aa0', 10, { r: 100, s: 6 }); el.classList.add('merge-boom'); setTimeout(() => el.classList.remove('merge-boom'), 1100); }
      banner(`${icon('star')}${icon('up')}`, 'merge');
    }, 60);
    setTimeout(() => { S.pop = null; }, 900);
  }
  function mergePickIfAny() {
    const p = S.match && S.match.players[S.v];
    if (!p || !p.mergePick || !prepActive()) return;
    const mp = p.mergePick;
    const cards = mp.options.map((id, i) => `<button class="mp-card" data-act="pickMerge" data-idx="${i}">${cardHTML(UNITS[id], { size: 'mini', k: 'mp' + i })}<span class="mp-st">${'★'.repeat(UNITS[id].tier)}</span></button>`).join('');
    modal(`<h2>🎉 دمج! اختر هديتك</h2><p class="mp-sub">اختر بطاقة تنضاف لفريقك، والبطاقة المطوّرة تبقى معك. نجومها ${'★'.repeat(mp.rank)} (أعلى من مستوى متجرك بنجمة). الهدية مرة وحدة بكل جولة.</p><div class="mp-row">${cards}</div>`);
    const x = document.querySelector('#modal .x'); if (x) x.style.display = 'none';   // the choice is part of the merge: no closing without picking
  }
  // card frame v5 (phones): the approved gold frame with a rarity-coloured side strip. The overlay carries the power, the role socket, the rarity word and the card's star level.
  const artVar = (id) => (AMB.IMAGES && AMB.IMAGES[id] ? `--artimg:url('${AMB.IMAGES[id]}');` : '');   // the card's own picture, used as a blurred fill behind the whole (uncropped) portrait
  const powerOf = (hp, atk) => Math.round(hp / 8 + atk * 2);
  function fr4HTML(def, atk, hp) {
    const RA = AMB.ECONOMY && AMB.ECONOMY.rarities[def.rarity], ro = ROLES[def.role];
    return `<i class="fr4-img"></i><span class="fr4-pw" title="القوة">${powerOf(hp, atk)}</span><span class="fr4-role" title="${esc(ro.name)}">${icon(ART.ROLE_ICON[def.role])}</span><span class="fr4-rar">${RA ? RA.name : ''}</span><span class="fr4-st" title="نجوم البطاقة">${def.tier}</span><span class="fr4-rt">${esc(ro.name)}</span>`;
  }
  function cardHTML(def, o) {
    o = o || {};
    const W = WORLDS[def.world];
    const isHero = !def.role;
    const tier = isHero ? 'hero' : 't' + def.tier;
    const star = o.star || 1;
    const sc = isHero ? '' : ' s' + star;
    const sel = o.sel ? ' sel' : '';
    const attrs = o.attrs || '';
    // card level / rarity (and hero level) power only exists in progression fights: show the real numbers where they count
    let pw = o.pow;
    if (pw == null && !isHero && S.screen === 'match' && S.match && S.match.players && S.match.players[S.v] && S.match.players[S.v].cardPower) pw = S.match.players[S.v].cardPower[def.id];
    pw = pw || 1;
    // a hero card outside a match shows the profile's hero level: life +1 per level, summoned attack +5% per level
    const hLv = isHero && o.life == null && S.screen !== 'match' && S.mode !== 'hotseat' && S.mode !== 'online' && AMB.heroes ? AMB.heroes.level(def.id) : 1;
    if (isHero && hLv > 1) pw = pw * AMB.heroes.power(def.id).atk;
    const atk = isHero ? Math.round(def.board.atk * pw) : Math.round(cardStats(def, star).atk * pw);
    const hp = isHero ? (o.life != null ? o.life : CFG.match.heroLife + (hLv - 1) * (CFG.match.heroLifePerLevel || 0)) : Math.round(cardStats(def, star).hp * pw);
    const upCls = pw > 1.001 ? ' up' : '';
    const numCls = (n) => (String(n).length > 3 ? ' class="sm"' : '');
    const tp = (k, id, x) => (o.size === 'mini' ? '' : ` data-act="tip" data-k="${k}" data-id="${id}"${x ? ` data-x="${x}"` : ''}`);   // full cards: every badge explains itself when tapped
    const atkBd = `<span class="hc-atk${upCls}"${tp('atk', def.id, star)}>${icon('sword')}<b${numCls(atk)}>${atk}</b></span>`;
    const hpBd = `<span class="hc-hp${isHero ? (hLv > 1 ? ' up' : '') : upCls}"${tp('hp', def.id, star)}>${icon('heart')}<b${numCls(hp)}>${hp}</b></span>`;
    const T3 = (k, id) => (o.size === 'mini' ? null : [k, id]);
    const roleD = isHero ? disc('role hero', 'crown', 'بطل', T3('herorole', def.id)) : disc('role', ART.ROLE_ICON[def.role], ROLES[def.role].name, T3('role', def.id));
    if (o.size === 'mini') {
      const items = (o.items || []).map((it) => `<i title="${esc(ITEMS[it].name)}">${icon(ITEMS[it].icon)}</i>`).join('');
      const mid = o.live ? `<div class="hc-bar"><div class="hpb"><b></b><i></i></div>${isHero ? '' : '<div class="mpb"><i></i></div>'}</div>` : (items ? `<div class="hc-its">${items}</div>` : '');
      return `<div class="tcard hc cv3 mini fr-${def.world} ${tier}${sc}${sel} r-${def.rarity || 'common'} ${isHero ? '' : 'fr4'} ${o.cls || ''}" style="--wc:${W.color};${isHero ? '' : artVar(def.id)}" title="${esc(def.name)}" ${attrs}>
        <i class="hc-halo"></i><div class="hc-frame"></div><div class="hc-art">${portrait(def, { bare: true, k: o.k })}<i class="sheen"></i></div><div class="hc-ring"></div>
        ${roleD}${isHero ? '' : stars(star)}${o.prog ? `<span class="hc-prog" title="نسخ متطابقة: واحدة إضافية وتترقى">${o.prog}</span>` : ''}<i class="hc-sbar"></i>${atkBd}${hpBd}${mid}${isHero ? '' : fr4HTML(def, atk, hp)}</div>`;
    }
    const own = o.own ? `<span class="hc-own ${o.own.pair ? 'up' : ''}" data-act="tip" data-k="own" data-id="${def.id}" data-x="${o.own.pair ? 'up' : o.own.n}">${o.own.s1 ? `<i class="cp-dots">${'●'.repeat(Math.min(2, o.own.s1))}${'○'.repeat(Math.max(1, 3 - Math.min(2, o.own.s1)))}</i>` : '×' + o.own.n}</span>` : '';   // kid #6: copies toward the next star as dots (●●○ = one more and it evolves)
    const rolePill = isHero ? '' : `<span class="rolepill ${ROLES[def.role].kind}" data-act="tip" data-k="role" data-id="${def.id}">${icon(ART.ROLE_ICON[def.role])}${ROLES[def.role].name}</span>`;
    const iconsRow = isHero
      ? disc('world', ART.WORLD_ICON[def.world], W.name, ['world', def.id]) + roleD
      : disc('world', ART.WORLD_ICON[def.world], W.name, ['world', def.id]) + rolePill + disc('skill', ART.SKILL_ICON[def.skill.type] || 'star', def.skill.name, ['skill', def.id, star]);
    const RA = AMB.ECONOMY && AMB.ECONOMY.rarities[def.rarity];
    const rar = RA ? `<span class="hc-rar" data-act="tip" data-k="rar" data-id="${def.id}">${RA.name}</span>` : '';
    const lvl = o.lvl ? `<span class="hc-lvl" data-act="tip" data-k="lvl" data-id="${def.id}" data-x="${o.lvl}">مستوى ${o.lvl}</span>` : '';
    const gemN = RA ? RA.order : 1;
    return `<div class="tcard hc cv3 full fr-${def.world} ${tier}${sc} r-${def.rarity || 'common'} ${o.cls || ''}" style="--wc:${W.color}" ${attrs}>
      <div class="hc-frame"><i class="sheen"></i></div>${rar}${lvl}
      <div class="hc-art">${portrait(def, { bare: true, k: o.k })}</div><div class="hc-ring"></div>
      <div class="hc-name ${def.name.length > 14 ? 'ln2' : def.name.length > 10 ? 'ln1' : ''}" data-act="tip" data-k="all" data-id="${def.id}" data-x="${star}"><b>${def.name}</b></div>
      <div class="hc-icons" data-act="tip" data-k="all" data-id="${def.id}" data-x="${star}">${iconsRow}</div>
      ${isHero ? '' : gems(gemN).replace('class="gems', 'data-act="tip" data-k="rar" data-id="' + def.id + '" class="hc-gems gems')}
      ${isHero ? '' : `<span class="hc-cost" data-act="tip" data-k="cost" data-id="${def.id}"><i></i><b>${def.cost}</b></span>`}
      <i class="hc-sbar"></i>${atkBd}${hpBd}${own}
      <span class="hc-info" data-act="${isHero ? 'heroInfo' : 'detail'}" data-id="${def.id}" title="تفاصيل">i</span></div>`;
  }

  const fmtStat = (stat, v) => (['startMana', 'range'].includes(stat) ? '+' + v : '+' + Math.round(v * 100) + '%');
  function itemChips(it) {
    if (it.kind === 'equip') return it.effects.map((e) => `<span class="sv">${icon(ART.STAT_ICON[e.stat] || 'star')}<b>${fmtStat(e.stat, e.value)}</b></span>`).join('');
    const sp = it.spell;
    const map = { buffAll: ['sword', '+' + Math.round(sp.atkPct * 100) + '%'], shieldFront: ['shield', sp.amount], hitBack: ['burst', sp.dmg], hasteAll: ['wind', '+' + Math.round(sp.asPct * 100) + '%'] }[sp.type];
    return map ? `<span class="sv">${icon(map[0])}<b>${map[1]}</b></span>` : '';
  }
  function itemCardHTML(it, o) {
    o = o || {};
    return `<div class="tcard hc cv3 full item ${it.kind} ${o.cls || ''}" ${o.attrs || ''} title="${esc(it.name + ': ' + it.text)}">
      <div class="hc-frame"></div>
      <div class="hc-art iconart">${icon(it.icon, 'big-ic')}</div><div class="hc-ring"></div>
      <div class="hc-name"><b>${it.name}</b></div>
      <i class="hc-sbar"></i><div class="hc-chips">${itemChips(it)}</div>
      <span class="hc-cost"><i></i><b>${it.cost}</b></span></div>`;
  }

  // ---- combat field: same grid as the prep field, cards stay in their cells
  function buildTokens() {
    renderField(true);
    const ctr = document.querySelector('.center'); if (ctr) ctr.scrollTop = 0;
    window.scrollTo(0, 0);
    const f = $('field');
    $('fx').setAttribute('viewBox', `0 0 ${f.clientWidth} ${f.clientHeight}`);
    $('fx').innerHTML = '';
    $('floats').innerHTML = '';
    S.cardEls = {};
    S.combat.fighters.forEach((fi) => {
      const el = document.querySelector(`[data-fid="${fi.id}"]`);
      if (el) S.cardEls[fi.id] = { el, hp: el.querySelector('.hpb i'), lag: el.querySelector('.hpb b'), mp: el.querySelector('.mpb i'), hpn: el.querySelector('.hc-hp b'), lagW: 100, last: -1 };
    });
  }

  const viewerSide = () => (S.combat && (S.phase === 'combat' || S.phase === 'result') ? S.combatViewer : S.v);
  const postEl = (side) => $(side === viewerSide() ? 'post-bottom' : 'post-top');
  const anchorEl = (fi) => (S.cardEls[fi.id] ? S.cardEls[fi.id].el : postEl(fi.side));
  function center(el) {
    const fr = $('field').getBoundingClientRect(), r = el.getBoundingClientRect();
    return { x: r.left - fr.left + r.width / 2, y: r.top - fr.top + r.height / 2 };
  }
  function addFloat(left, top, text, cls) {
    const fl = $('floats');
    if (fl.childElementCount > 40) fl.firstElementChild.remove();
    const el = document.createElement('div');
    el.className = 'float ' + (cls || '');
    el.style.left = left + '%';
    el.style.top = top + '%';
    el.textContent = text;
    fl.appendChild(el);
    setTimeout(() => el.remove(), cls && cls.includes('big') ? 1600 : 900);
  }
  function floatAt(el, text, cls, dy) {
    const f = $('field'), c = center(el);
    addFloat((c.x / f.clientWidth) * 100 + (Math.random() * 6 - 3), ((c.y + (dy || 0)) / f.clientHeight) * 100, text, cls);
  }
  function flash(el, cls, ms) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); setTimeout(() => el.classList.remove(cls), ms); }

  // ---- sound (synthesised with WebAudio; starts after the first tap/click)
  const SND = { ctx: null, on: true, last: {} };
  try { SND.on = localStorage.getItem('amb_sound') !== '0'; } catch (e) { /* storage blocked */ }
  function audio() {
    if (!SND.on) return null;
    try {
      if (!SND.ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; SND.ctx = new AC(); }
      if (SND.ctx.state === 'suspended') SND.ctx.resume();
      return SND.ctx;
    } catch (e) { return null; }
  }
  function tone(c, o) {
    const t0 = c.currentTime + (o.at || 0), osc = c.createOscillator(), g = c.createGain();
    osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(o.f, t0);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t0 + o.d);
    const vol = AMB.settings ? Math.max(0.05, +AMB.settings.get('sfx') || 0) : 1;   // senior #38: effects volume
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime((o.v || 0.15) * vol, t0 + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.d);
    osc.connect(g); g.connect(c.destination); osc.start(t0); osc.stop(t0 + o.d + 0.02);
  }
  function noise(c, d, v, hp) {
    const n = Math.floor(c.sampleRate * d), buf = c.createBuffer(1, n, c.sampleRate), ch = buf.getChannelData(0);
    for (let i = 0; i < n; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = c.createBufferSource(), g = c.createGain(), f = c.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = hp || 800; g.gain.value = v * (AMB.settings ? Math.max(0.05, +AMB.settings.get('sfx') || 0) : 1);
    src.buffer = buf; src.connect(f); f.connect(g); g.connect(c.destination); src.start();
  }

  // --- sound building blocks: a swooshing "air" sound (band-passed noise gliding between two pitches) and metal (ringing partials)
  function swoosh(c, o) {
    const n = Math.floor(c.sampleRate * o.d), buf = c.createBuffer(1, n, c.sampleRate), ch = buf.getChannelData(0);
    for (let i = 0; i < n; i++) { const x = i / n; ch[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * Math.min(1, x * (o.sharp || 1))) * (1 - x * 0.3); }
    const t0 = c.currentTime + (o.at || 0), src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    f.type = 'bandpass'; f.Q.value = o.q || 2.2; f.frequency.setValueAtTime(o.f1, t0); f.frequency.exponentialRampToValueAtTime(o.f2, t0 + o.d);
    g.gain.value = o.v || 0.1; src.buffer = buf; src.connect(f); f.connect(g); g.connect(c.destination); src.start(t0);
  }
  function clang(c, o) {   // struck metal: inharmonic partials that die away at different speeds
    [[1, 1], [2.76, 0.7], [5.4, 0.5], [8.93, 0.3]].forEach(([r, a], i) => tone(c, { f: o.f * r, d: (o.d || 0.28) / (1 + i * 0.7), v: (o.v || 0.07) * a, type: i % 2 ? 'triangle' : 'sine', at: o.at || 0 }));
    noise(c, 0.04, (o.v || 0.07) * 0.8, 3000);
  }
  function thud(c, o) { tone(c, { f: o.f || 120, to: (o.f || 120) * 0.45, d: o.d || 0.14, v: o.v || 0.16, type: 'sine', at: o.at || 0 }); noise(c, 0.05, (o.v || 0.16) * 0.5, 250); }
  const SFX = {
    click: (c) => tone(c, { f: 520, to: 780, d: 0.06, v: 0.08, type: 'triangle' }),
    buy: (c) => { tone(c, { f: 660, d: 0.07, v: 0.1, type: 'square' }); tone(c, { f: 990, d: 0.12, v: 0.1, type: 'square', at: 0.06 }); },
    reroll: (c) => noise(c, 0.18, 0.06, 2500),
    hit: (c) => { thud(c, { f: 170, d: 0.07, v: 0.1 }); noise(c, 0.05, 0.07, 1500); },
    crit: (c) => { noise(c, 0.14, 0.2, 700); tone(c, { f: 300, to: 60, d: 0.18, v: 0.18, type: 'sawtooth' }); tone(c, { f: 1200, d: 0.08, v: 0.08, type: 'triangle' }); },
    cast: (c) => { tone(c, { f: 300, to: 900, d: 0.3, v: 0.1, type: 'sawtooth' }); tone(c, { f: 600, to: 1800, d: 0.3, v: 0.05, type: 'triangle', at: 0.04 }); },
    heal: (c) => { tone(c, { f: 660, d: 0.12, v: 0.08 }); tone(c, { f: 880, d: 0.16, v: 0.08, at: 0.09 }); tone(c, { f: 1320, d: 0.2, v: 0.06, at: 0.18 }); },
    death: (c) => { noise(c, 0.3, 0.14, 300); tone(c, { f: 220, to: 40, d: 0.35, v: 0.16, type: 'sawtooth' }); },
    levelup: (c) => { [392, 523, 659, 784, 1047].forEach((f, i) => tone(c, { f, d: 0.16, v: 0.1, type: 'square', at: i * 0.06 })); tone(c, { f: 196, to: 392, d: 0.3, v: 0.08, type: 'sawtooth' }); noise(c, 0.2, 0.05, 3000); },
    merge: (c) => { [523, 659, 784, 1047].forEach((f, i) => tone(c, { f, d: 0.22, v: 0.12, type: 'triangle', at: i * 0.07 })); noise(c, 0.25, 0.06, 4000); },
    v_fighter: (c) => { swoosh(c, { d: 0.14, f1: 900, f2: 3200, q: 1.6, v: 0.13 }); clang(c, { f: 640, d: 0.3, v: 0.07, at: 0.1 }); thud(c, { f: 150, v: 0.1, at: 0.1 }); },
    v_assassin: (c) => { swoosh(c, { d: 0.09, f1: 2600, f2: 7000, q: 2.8, v: 0.1, sharp: 3 }); swoosh(c, { d: 0.08, f1: 2200, f2: 6200, q: 2.8, v: 0.08, at: 0.07, sharp: 3 }); tone(c, { f: 3300, to: 2400, d: 0.1, v: 0.025, type: 'sine', at: 0.05 }); },
    v_mage: (c) => { tone(c, { f: 420, to: 1400, d: 0.2, v: 0.05, type: 'sine' }); tone(c, { f: 630, to: 2100, d: 0.2, v: 0.025, type: 'triangle', at: 0.03 }); swoosh(c, { d: 0.22, f1: 600, f2: 4200, q: 3, v: 0.05 }); [1568, 2093].forEach((f, i) => tone(c, { f, d: 0.16, v: 0.03, type: 'sine', at: 0.19 + i * 0.05 })); },
    v_marksman: (c) => { tone(c, { f: 190, to: 140, d: 0.1, v: 0.12, type: 'triangle' }); tone(c, { f: 520, to: 300, d: 0.07, v: 0.05, type: 'square' }); swoosh(c, { d: 0.18, f1: 5200, f2: 1600, q: 2.4, v: 0.1, at: 0.04 }); thud(c, { f: 220, d: 0.08, v: 0.06, at: 0.2 }); },
    v_guardian: (c) => { thud(c, { f: 100, d: 0.2, v: 0.2 }); clang(c, { f: 420, d: 0.34, v: 0.09, at: 0.01 }); swoosh(c, { d: 0.09, f1: 500, f2: 1400, q: 1.2, v: 0.07 }); },
    v_support: (c) => { [784, 988, 1319].forEach((f, i) => tone(c, { f, d: 0.28, v: 0.04, type: 'sine', at: i * 0.07 })); swoosh(c, { d: 0.25, f1: 1800, f2: 5200, q: 4, v: 0.025 }); },
    c_fighter: (c) => { swoosh(c, { d: 0.22, f1: 500, f2: 2600, q: 1.4, v: 0.16 }); thud(c, { f: 90, d: 0.34, v: 0.22, at: 0.16 }); clang(c, { f: 520, d: 0.5, v: 0.1, at: 0.16 }); noise(c, 0.3, 0.07, 400); },
    c_assassin: (c) => { swoosh(c, { d: 0.12, f1: 2800, f2: 8000, q: 2.8, v: 0.1, sharp: 3 }); swoosh(c, { d: 0.12, f1: 8000, f2: 2400, q: 2.8, v: 0.09, at: 0.1, sharp: 3 }); noise(c, 0.26, 0.05, 3500); tone(c, { f: 900, to: 180, d: 0.3, v: 0.05, type: 'sine', at: 0.06 }); },
    c_mage: (c) => { tone(c, { f: 260, to: 1300, d: 0.45, v: 0.07, type: 'sine' }); tone(c, { f: 390, to: 1950, d: 0.45, v: 0.03, type: 'triangle', at: 0.04 }); swoosh(c, { d: 0.4, f1: 400, f2: 5200, q: 3, v: 0.07 }); [1319, 1760, 2349].forEach((f, i) => tone(c, { f, d: 0.3, v: 0.035, type: 'sine', at: 0.34 + i * 0.06 })); thud(c, { f: 80, v: 0.12, d: 0.3, at: 0.36 }); },
    c_marksman: (c) => { [0, 0.13, 0.26].forEach((t) => { tone(c, { f: 180, to: 130, d: 0.09, v: 0.1, type: 'triangle', at: t }); swoosh(c, { d: 0.14, f1: 5200, f2: 1800, q: 2.4, v: 0.08, at: t + 0.03 }); thud(c, { f: 210, d: 0.07, v: 0.05, at: t + 0.15 }); }); },
    c_guardian: (c) => { thud(c, { f: 80, d: 0.45, v: 0.24 }); clang(c, { f: 330, d: 0.6, v: 0.11, at: 0.02 }); clang(c, { f: 495, d: 0.5, v: 0.07, at: 0.12 }); noise(c, 0.3, 0.06, 600); },
    c_support: (c) => { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(c, { f, d: 0.4, v: 0.045, type: 'sine', at: i * 0.07 })); swoosh(c, { d: 0.5, f1: 1200, f2: 5800, q: 4, v: 0.03 }); },
    land1: (c) => noise(c, 0.07, 0.05, 700),
    land2: (c) => { tone(c, { f: 130, to: 70, d: 0.16, v: 0.14, type: 'sine' }); noise(c, 0.12, 0.07, 500); },
    land3: (c) => { tone(c, { f: 100, to: 45, d: 0.3, v: 0.2, type: 'sawtooth' }); tone(c, { f: 60, to: 35, d: 0.35, v: 0.2, type: 'sine' }); noise(c, 0.26, 0.12, 300); },
    land4: (c) => { tone(c, { f: 64, to: 36, d: 0.9, v: 0.16, type: 'sine' }); noise(c, 0.5, 0.05, 140); [659, 880].forEach((f, i) => tone(c, { f, d: 0.5, v: 0.035, type: 'sine', at: 0.2 + i * 0.12 })); },
    charge: (c) => { tone(c, { f: 60, to: 300, d: 1.4, v: 0.07, type: 'sine' }); tone(c, { f: 120, to: 600, d: 1.4, v: 0.03, type: 'triangle' }); },
    epicCharge: (c) => { tone(c, { f: 100, to: 380, d: 0.6, v: 0.1, type: 'sawtooth' }); },
    epicHit: (c) => { tone(c, { f: 90, to: 40, d: 0.4, v: 0.22, type: 'sine' }); noise(c, 0.3, 0.12, 400); [523, 659, 784, 988].forEach((f, i) => tone(c, { f, d: 0.3, v: 0.1, type: 'triangle', at: 0.05 + i * 0.07 })); },
    legend: (c) => { tone(c, { f: 58, to: 34, d: 1.1, v: 0.16, type: 'sine' }); noise(c, 0.5, 0.05, 140); [392, 523, 659, 784].forEach((f, i) => tone(c, { f, d: 0.9, v: 0.05, type: 'sine', at: 0.1 + i * 0.12 })); },
    banner: (c) => { tone(c, { f: 90, to: 50, d: 0.35, v: 0.2, type: 'sawtooth' }); noise(c, 0.25, 0.08, 500); },
    win: (c) => { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(c, { f, d: 0.28, v: 0.13, type: 'triangle', at: i * 0.11 })); },
    lose: (c) => { [392, 330, 262, 196].forEach((f, i) => tone(c, { f, d: 0.34, v: 0.13, type: 'sawtooth', at: i * 0.16 })); },
  };
  function sfx(name) {
    const c = audio(); if (!c || !SFX[name]) return;
    const now = performance.now(), gap = { hit: 70, crit: 120, heal: 150, cast: 120, death: 120, v_fighter: 90, v_assassin: 90, v_mage: 110, v_marksman: 90, v_guardian: 110, v_support: 140, c_fighter: 120, c_assassin: 120, c_mage: 120, c_marksman: 120, c_guardian: 120, c_support: 120 }[name] || 0;
    if (gap && now - (SND.last[name] || 0) < gap) return;   // many hits in one tick = one sound
    SND.last[name] = now;
    try { SFX[name](c); } catch (e) { /* ignore */ }
  }
  function soundBtn() { return `<button class="btn small" data-act="sound" title="الصوت">${SND.on ? '🔊' : '🔇'}</button>`; }

  // ---- visual effects (pure presentation)
  function burst(el, color, n, o) {
    o = o || {};
    if (!el || document.querySelectorAll('.fxp').length > 120) return;
    const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, d = (o.r || 26) * (0.5 + Math.random());
      const q = document.createElement('i');
      q.className = 'fxp' + (o.cls ? ' ' + o.cls : '');
      q.style.left = cx + 'px'; q.style.top = cy + 'px';
      q.style.setProperty('--tx', Math.cos(a) * d + 'px');
      q.style.setProperty('--ty', (o.up ? -d * 1.3 : Math.sin(a) * d) + 'px');
      q.style.setProperty('--c', color);
      q.style.setProperty('--s', (o.s || 4 + Math.random() * 4) + 'px');
      document.body.appendChild(q);
      setTimeout(() => q.remove(), 750);
    }
  }
  function banner(text, cls) {
    const b = document.createElement('div');
    b.className = 'round-banner ' + (cls || '');
    b.innerHTML = '<span>' + text + '</span>';
    document.body.appendChild(b);
    sfx(cls === 'merge' ? 'merge' : 'banner');
    setTimeout(() => b.remove(), 1500);
  }

  // UI v2: a hero ability fired: its name bursts over that hero's half of the field (one element, CSS transform/opacity only, gone in 1.2 s)
  function abilityBurst(name, side, color) {
    const fl = $('floats'); if (!fl) return;
    const mine = S.combatViewer == null ? side === S.v : side === S.combatViewer;
    const old = fl.querySelector('.ab-burst.' + (mine ? 'me' : 'foe')); if (old) old.remove();
    const el = document.createElement('div');
    el.className = 'ab-burst ' + (mine ? 'me' : 'foe');
    el.style.setProperty('--bc', color || '#ffd24a');
    el.innerHTML = '<i class="abr"></i><i class="abr two"></i><b></b>';
    el.querySelector('b').textContent = name;
    fl.appendChild(el);
    sfx('cast');
    setTimeout(() => el.remove(), 1250);
  }

  function drawCombat(skipFx) {
    const c = S.combat;
    const byId = {};
    c.fighters.forEach((f) => (byId[f.id] = f));
    for (const f of c.fighters) {
      const t = S.cardEls[f.id];
      if (!t) continue;
      const pct = Math.max(0, (f.hp / f.maxHp) * 100);
      t.hp.style.width = pct + '%';
      t.lagW = Math.max(pct, t.lagW - 1.2);
      t.lag.style.width = t.lagW + '%';
      if (t.mp) t.mp.style.width = Math.min(100, (f.mana / f.maxMana) * 100) + '%';
      if (t.hpn) { const v = Math.max(0, Math.ceil(f.isHero ? f.hp / CFG.combat.heroHpScale : f.hp)); if (v !== t.last) { t.hpn.textContent = v; t.hpn.className = v > 999 ? 'sm' : ''; t.last = v; } }
      const cl = t.el.classList;
      cl.toggle('dead', !f.alive);
      cl.toggle('retreated', f.alive && f.isHero && !f.onBoard);
      cl.toggle('stunned', f.stun > 0);
      cl.toggle('shielded', f.shield > 1);
    }
    renderPosts();
    // clock + fury: written only when the text changes (this runs every frame)
    const clock = document.querySelector('.combat-ctrl .clock'), ct = fmt(c.t, 1) + 'ث';
    if (clock && clock._t !== ct) { clock._t = ct; clock.textContent = ct; }
    const fury = document.querySelector('.combat-ctrl .fury');
    const fh = c.t > CFG.combat.furyStart ? `${icon('flame')}×${fmt(c.fury(), 2)}` : (c.assault ? icon('warn') : '');
    if (fury && fury._h !== fh) { fury._h = fh; fury.innerHTML = fh; }

    const events = c.drainEvents();
    if (skipFx) return;
    const fx = $('fx');
    for (const e of events) {
      const f = e.id != null ? byId[e.id] : null;
      const el = f ? anchorEl(f) : null;
      if (e.type === 'damage' && f && el) {
        if (e.amount >= 4 || e.crit) floatAt(el, e.amount, e.crit ? 'crit' : e.skill ? 'skill' : '');
        flash(el, 'hit', 110);
        if (e.amount >= 4 || e.crit) burst(el, e.crit ? '#ffd24a' : e.skill ? '#ff6b73' : '#ffffff', e.crit ? 12 : e.skill ? 8 : 3, { r: e.crit ? 34 : 22 });
        if (e.crit || f.isHero) flash($('field'), 'shake', 260);
        sfx(e.crit ? 'crit' : 'hit');
      } else if (e.type === 'death' && f && el) {
        burst(el, '#a9a9a9', 16, { r: 38, s: 7 }); burst(el, '#ff6b73', 6, { r: 30 }); sfx('death');
        if (f.isHero) flash($('field'), 'shake', 400);
      } else if (e.type === 'heal' && f && el) {
        floatAt(el, '+' + e.amount, 'heal');
        burst(el, '#5bf08b', 5, { up: true, cls: 'plus', r: 22, s: 7 }); sfx('heal');
      } else if (e.type === 'cast' && f && el) {
        flash(el, 'cast', 500); floatAt(el, e.name, 'label', 26);
        if (AMB.VFX && f.role) AMB.VFX.cast(f, el, { sfx });
        else { burst(el, (WORLDS[f.world] || {}).color || '#ffd24a', 14, { r: 44, s: 6 }); sfx('cast'); }
      } else if (e.type === 'attack' && byId[e.from] && byId[e.to]) {
        const ea = anchorEl(byId[e.from]), eb = anchorEl(byId[e.to]);
        if (!ea || !eb) continue;
        const a = center(ea), b = center(eb);
        const L = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        ea.style.setProperty('--dx', ((b.x - a.x) / L) * 9 + 'px');
        ea.style.setProperty('--dy', ((b.y - a.y) / L) * 9 + 'px');
        ea.style.setProperty('--bx', (-(b.x - a.x) / L) * 4 + 'px'); ea.style.setProperty('--by', (-(b.y - a.y) / L) * 4 + 'px');
        flash(ea, 'atk', 230);
        if (AMB.VFX && AMB.VFX.attack(byId[e.from], byId[e.to], ea, eb, { sfx })) continue;
        if (!e.ranged) { const ring = document.createElement('i'); ring.className = 'impact'; const rb = eb.getBoundingClientRect(); ring.style.left = rb.left + rb.width / 2 + 'px'; ring.style.top = rb.top + rb.height / 2 + 'px'; document.body.appendChild(ring); setTimeout(() => ring.remove(), 330); }
        const ln = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        ln.setAttribute('x1', a.x); ln.setAttribute('y1', a.y); ln.setAttribute('x2', b.x); ln.setAttribute('y2', b.y);
        ln.setAttribute('stroke', byId[e.from].side === S.combatViewer ? '#5fe3ff' : '#ff8a90');
        ln.setAttribute('stroke-width', e.ranged ? 2 : 4); ln.setAttribute('stroke-linecap', 'round');
        ln.setAttribute('opacity', 0.85); ln.style.transition = 'opacity .25s';
        fx.appendChild(ln);
        requestAnimationFrame(() => (ln.style.opacity = 0));
        setTimeout(() => ln.remove(), 280);
      } else if (e.type === 'heroAbility') {
        const hh = HEROES[S.match.players[e.side].heroId];
        abilityBurst(e.name, e.side, WORLDS[hh.world].color);
      } else if (e.type === 'spell') {
        addFloat(50, e.side === S.combatViewer ? 62 : 38, '✦ ' + e.name, 'big');
      } else if (e.type === 'exposed') {
        addFloat(50, e.side === S.combatViewer ? 84 : 16, 'سقط خط الدفاع!', 'big');
      } else if (e.type === 'assault') {
        addFloat(50, e.side === S.combatViewer ? 80 : 20, 'يهجمون على البطل!', 'big');
      } else if (e.type === 'retreat') {
        addFloat(50, e.side === S.combatViewer ? 80 : 20, 'البطل رجع لمركزه', 'big');
      } else if (e.type === 'sealed') {
        addFloat(50, e.side === S.combatViewer ? 88 : 12, 'البطل تحصّن (ضرر محدود)', 'label');
      } else if (e.type === 'leap' && f && el) {
        floatAt(el, 'قفزة!', 'label', 26);
      } else if (e.type === 'stun' && f && el) {
        floatAt(el, 'شلل', 'label', 20);
      }
    }
  }

  // ======================================================================= match rendering
  function renderMatch(keepTokens) {
    if (!S.match) return;
    // UI v2: the screen knows the phase, so CSS can hide the shop and the prep buttons while the fight plays
    const scr = $('scr-match'), ph = S.phase === 'combat' || S.phase === 'result' ? 'fight' : 'prep';
    if (scr && scr.dataset.ph !== ph) scr.dataset.ph = ph;
    // during prep the opponent's half is hidden so your own cards get the room (it comes back for the fight; the opponent panel + 🔍 stay)
    const sm = $('scr-match'); if (sm) sm.classList.toggle('prep-focus', S.mode !== 'tutorial' && (S.phase === 'prep' || S.phase === 'resources' || S.phase === 'handoff'));   // the guided tutorial keeps the classic layout its hand points at
    renderTop();
    renderOpp();
    renderSlots();
    if (S.phase !== 'combat' && !keepTokens) { $('fx').innerHTML = ''; $('floats').innerHTML = ''; }
    renderPosts();
    renderBench();
    renderShop();
    renderLeft();
    renderRight();
    renderCombatCtrl();
    if (AMB.FX) AMB.FX.watch();
    dupHint();
    fitMatch();
  }
  // the first time a copy of a card that is already on the board gets placed: explain why the synergy number did not move
  function dupHint() {
    if (!S.match || S.phase !== 'prep' || S.mode === 'tutorial') return;
    const p = me(), n = dupCount(p), key = S.match.round + ':' + S.v;
    if (S.dupSeen == null || S.dupKey !== key) { S.dupKey = key; S.dupSeen = n; return; }
    if (n > S.dupSeen && !S.dupToldMatch) { S.dupToldMatch = S.match; toast('نفس الشخصية مرتين: التآزر يحسبها مرة وحدة. حط شخصيات مختلفة عشان يزيد', ''); }
    S.dupSeen = n;
  }
  // Phones: the browser's real usable height can be smaller than what the CSS assumes (address bar, gesture bar, PWA window).
  // If the shop would end below the screen, shrink the field a little until everything fits.
  function fitMatch() {
    const fw = document.querySelector('#scr-match .field-wrap'), shop = $('shopbar');
    if (!fw || !shop || S.screen !== 'match' || !matchMedia('(max-width: 860px) and (orientation: portrait)').matches) return;
    fw.style.removeProperty('--cwv'); shop.style.removeProperty('height');
    if (shop.scrollHeight > shop.clientHeight + 1) shop.style.height = shop.scrollHeight + 2 + 'px';   // the cards are taller than the shop box: grow the box, never cut a card
    const scr = $('scr-match'), vv = (globalThis.visualViewport && visualViewport.height) || innerHeight;
    const vh = Math.min(vv, innerHeight, scr ? scr.getBoundingClientRect().bottom : 1e5);   // whichever ends first: the window or the match screen itself
    const overlap = () => Math.max(shop.getBoundingClientRect().bottom - (vh - 2), sm_prep ? $('bench').getBoundingClientRect().bottom - shop.getBoundingClientRect().top + 6 : -1);   // prep layout: the field + bench must end above the always-visible shop strip
    const sm_prep = scr && scr.classList.contains('prep-focus');
    let over = overlap();
    if (over <= 0) return;
    let cw = fw.querySelector('#slots') ? fw.querySelector('#slots .cell').getBoundingClientRect().width : 80;
    if (sm_prep) {   // bisection: the biggest cell width whose field + bench still end above the shop strip
      let lo = 34, hi = Math.min(150, (Math.min(innerWidth, 520) - 30) / 4);
      for (let i = 0; i < 8; i++) { const mid = (lo + hi) / 2; fw.style.setProperty('--cwv', mid + 'px'); if (overlap() > 0) hi = mid; else lo = mid; }
      fw.style.setProperty('--cwv', Math.floor(lo) + 'px'); return;
    }
    for (let i = 0; i < 4 && over > 0; i++) {
      cw = Math.max(44, cw - over / (sm_prep ? 3.4 : 4.4) - 0.5);
      fw.style.setProperty('--cwv', cw + 'px');
      over = overlap();
    }
  }
  // the visible height changes while the page is open (Chrome's address bar hides, the phone rotates, the app comes back from the background):
  // keep one CSS variable in step with the real visible height and re-fit the match whenever it changes
  let lastAppH = 0;
  function syncViewport() {
    try {
      const h = Math.round((globalThis.visualViewport && visualViewport.height) || innerHeight);
      if (h !== lastAppH) { lastAppH = h; document.documentElement.style.setProperty('--app-h', h + 'px'); }
      if (S.match && S.screen === 'match') fitMatch();
    } catch (e) { /* ignore */ }
  }
  ['resize', 'orientationchange', 'pageshow', 'focus', 'scroll'].forEach((ev) => window.addEventListener(ev, syncViewport, { passive: true }));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { syncViewport(); setTimeout(syncViewport, 300); } });
  if (globalThis.visualViewport) { visualViewport.addEventListener('resize', syncViewport); visualViewport.addEventListener('scroll', syncViewport); }
  setInterval(() => { if (S.screen === 'match') syncViewport(); }, 800);   // safety net for browsers that skip the events
  syncViewport();

  function renderTop() {
    const m = S.match, p = me(), o = opp();
    const ph = S.phase;
    const left = ph === 'prep' ? (S.mode === 'tutorial' ? '∞' : Math.ceil(Math.max(0, S.deadline - Date.now()) / 1000) + 'ث') : '—';
    const avail = p.essence - m.reservedEssence(p);
    const lc = (pl, hid, k, me) => `<span class="lifechip ${me ? 'me' : ''}">${portrait(hid, { k })}${icon('heart')} <b>${lifeStr(pl.life)}</b><i class="lc-st"></i></span>`;
    $('topbar').innerHTML = `
      <span class="tb-round" title="${icon('flag').replace(/<[^>]+>/g, '')}">${icon('flag')} <bdi dir="ltr">${m.round}<small>/${maxR()}</small></bdi></span>
      ${m.rules ? `<span class="stagechip"><b>${p.stats.wins} – ${o.stats.wins}</b><span class="pips">${Array.from({ length: m.rules.winsNeeded || 2 }, (_, k) => k).map((k) => `<i class="pip ${k < p.stats.wins ? 'done' : ''}"></i>`).join('')}</span></span>`
        : `<span class="stagechip"><span class="pips">${Array.from({ length: CFG.match.maxRounds }, (_, k) => k + 1).map((r) => `<i class="pip ${r < m.round ? 'done' : r === m.round ? 'now' : ''} ${CFG.match.stages.some((st) => st.rounds[1] === r && r < CFG.match.maxRounds) ? 'gap' : ''}"></i>`).join('')}</span></span>`}
      <span class="timer">${S.paused ? icon('pause') : left}</span>
      <span class="tb-spacer"></span>
      ${lc(p, myAvatar(p, 0), 'tb0', true)}${lc(o, HEROES[o.heroId], 'tb1', false)}
      <span class="res gold" data-act="info" data-k="interest" title="الفايدة">${icon('gold')} ${p.gold}${m.rules ? '' : (() => { const E0 = CFG.economy, rich = m.weekly === 'richInterest', n = Math.min(rich ? E0.interestMax + 2 : E0.interestMax, Math.floor(p.gold / (rich ? E0.interestPer - 2 : E0.interestPer))); return n ? `<small class="int-n">+${n}</small>` : ''; })()}</span>
      <span class="res ess">${icon('essence')} ${avail}/${p.essence}</span>
      <span class="lvl" title="مستوى المتجر">${icon('crown')} <b>${p.level}</b> <span class="lvstars">${'★'.repeat(p.level)}</span></span>
      <button class="btn small mob-only ibtn2" data-act="panels">${S.panels ? '✕' : icon('crown')}</button>
      <button class="btn small ibtn2" data-act="pause">${S.paused ? icon('play') : icon('pause')}</button>
      ${soundBtn()}
      <button class="btn small ibtn2 rot-btn" data-act="rotate">تدوير</button>
      <button class="btn small ibtn2" data-act="menuMatch">☰</button>`;
  }

  // UI v2: the opponent panel above the field (hero, name, level, life). Built once per render; in combat only the life changes (oppLife)
  function renderOpp() {
    const el = $('opp-panel'); if (!el) return;
    const m = S.match, v = viewerSide(), o = m.players[1 - v], h = HEROES[o.heroId];
    el.style.setProperty('--ow', WORLDS[h.world].color);
    el.innerHTML = `${portrait(h, { k: 'opp' })}<span class="op-n">${esc(o.name)}</span>
      <span class="op-lv" title="المستوى">${icon('crown')}<b>${o.level}</b></span>
      <span class="op-life"><span class="op-bar"><i></i></span>${icon('heart')}<b>${lifeStr(o.life)}</b></span>${S.phase === 'prep' && S.mode !== 'hotseat' ? '<button class="op-scout" data-act="scout" aria-label="استكشاف الخصم">🔍</button>' : ''}`;
    S.oppUi = { bar: el.querySelector('.op-bar i'), num: el.querySelector('.op-life b'), txt: '', pct: -1 };
    oppLife(o.life, o.maxLife);
  }
  function oppLife(life, max) { barLife(S.oppUi, life, max); }
  function dockLife(life, max) { barLife(S.dockUi, life, max); }
  function barLife(u, life, max) {   // called every combat frame: writes to the DOM only when the shown value changes
    if (!u || !u.bar) return;
    const txt = String(lifeStr(life)), pct = Math.round(Math.max(0, Math.min(1, life / (max || 1))) * 200) / 200;
    if (txt !== u.txt) { u.txt = txt; u.num.textContent = txt; }
    if (pct !== u.pct) { u.pct = pct; u.bar.style.transform = `scaleX(${pct})`; }
  }
  // UI v2: each half of the field gets its owner's world floor (CSS gradients only). Bottom = you (or your arena cosmetic), top = the opponent:
  // the campaign level's world against a boss line-up, otherwise the opponent's hero world (random for a random computer hero, your friend's hero online)
  function foeWorld(v) {
    const o = S.match.players[1 - v];
    if (S.mode === 'campaign' && S.campaign && AMB.campaign && AMB.campaign.find) {
      try { const x = AMB.campaign.find(S.campaign.fightId); if (x && x.level && WORLDS[x.level.world]) return x.level.world; } catch (e) { /* fall back to the hero */ }
    }
    if (o.arenaWorld && WORLDS[o.arenaWorld]) return o.arenaWorld;
    return HEROES[o.heroId].world;
  }
  function setFloors(fe, mine, foe) {
    const bg = fe.querySelector('.field-bg'); if (!bg) return;
    const key = foe + '|' + mine;
    if (bg.dataset.fl === key) return;
    bg.dataset.fl = key;
    bg.innerHTML = `<i class="fl top w-${foe}"></i><i class="fl bot w-${mine}"></i><div class="rift-line"></div>`;
    fe.classList.add('v2f');
  }

  // Field = a CSS grid of cards:  enemy post / enemy back / enemy front / rift / my front / my back / my post
  function renderSlots() {
    if (S.phase === 'combat' || S.phase === 'result') return; // combat view is built by buildTokens()
    renderField(false);
  }

  function renderField(inCombat) {
    const m = S.match;
    const v = inCombat ? S.combatViewer : S.v;
    const p = m.players[v];
    // campaign enemies are scripted and known: show this round's line-up instead of the last one seen
    const sc = m.players[1 - v].lineup ? m.buildCombatSpec(1 - v) : m.scout[1 - v];
    const cell = (side, slot, mine) => {
      let inner = '', cls = mine ? 'mine' : 'enemy', fid = '';
      if (inCombat) {
        const f = S.combat.fighters.find((x) => x.side === side && x.slot === slot);
        if (f) {
          const def = f.isHero ? HEROES[f.defId] : UNITS[f.defId];
          inner = cardHTML(def, { size: 'mini', star: f.star, live: true, k: 'c' + f.id, attrs: `data-fid="${f.id}"`, cls: mine ? 'ally' : 'foe' });
        }
      } else if (mine) {
        const u = p.board[slot];
        if (u) inner = pieceHTML(u, { sel: S.sel && S.sel.kind === 'unit' && S.sel.uid === u.uid });
        else if (p.summoned && p.heroSlot === slot) inner = heroPieceHTML(p);
      } else if (sc) {
        const u = sc.units.find((x) => x.slot === slot);
        if (u) inner = cardHTML(UNITS[u.defId], { size: 'mini', star: u.star, items: u.items, k: 'sc' + slot, cls: 'ghost' });
        else if (sc.summoned && sc.heroSlot === slot) inner = cardHTML(HEROES[sc.heroId], { size: 'mini', k: 'sch', cls: 'ghost' });
      }
      const SR = AMB.DATA.SLOT_ROLES[slot], srName = SR ? SR.map((r) => ROLES[r].name).join(' / ') : '';
      let inPlace = false;   // a card standing in a slot of its own role gets that role's bonus
      if (inCombat) { const ff = S.combat.fighters.find((x) => x.side === side && x.slot === slot); inPlace = !!(ff && ff.inPlace); }
      else if (mine) { const uu = p.board[slot]; inPlace = !!(uu && SR && SR.includes(UNITS[uu.defId].role)); }
      else if (sc) { const uu = sc.units.find((x) => x.slot === slot); inPlace = !!(uu && SR && SR.includes(UNITS[uu.defId].role)); }
      const act = mine && !inCombat ? `data-act="slot" data-slot="${slot}" data-drop="board:${slot}"` : '';
      let rec = '';
      if (mine && !inCombat && S.sel && S.sel.kind === 'unit') { const su = m.findUnit(p, S.sel.uid); if (su) { const sd = ROLES[UNITS[su.defId].role].side; if (sd === 'any' || (sd === 'front') === (slot[0] === 'f')) rec = ' rec'; } }
      if (!inner && mine && !inCombat) inner = `<i class="rowic">${icon(SR ? ART.ROLE_ICON[SR[0]] : (slot[0] === 'f' ? 'shield' : 'bow'))}</i>`;   // empty cell shows the role this slot is for
      return `<div class="cell ${cls}${rec}${inPlace ? ' inplace' : ''}" ${act} title="${esc(srName)}${SR && !inCombat ? ' — ' + esc(AMB.DATA.ROLE_BONUS[SR[0]].text) : ''}" data-sr="${SR ? SR[0] : ''}">${inner}</div>`;
    };
    const row = (side, ch, mine) => [0, 1, 2, 3].map((k) => cell(side, ch + (mine ? k : 3 - k), mine)).join('');
    const o = 1 - v;
    const fe = $('field');
    if (AMB.PassUI) { const ac = (v === 0 && S.mode !== 'hotseat') ? AMB.PassUI.arenaClass() : ''; [...fe.classList].filter((c) => c.startsWith('ar-')).forEach((c) => fe.classList.remove(c)); if (ac) fe.classList.add(ac); }
    fe.style.setProperty('--mw', WORLDS[HEROES[p.heroId].world].color);
    fe.style.setProperty('--ew', WORLDS[HEROES[m.players[o].heroId].world].color);
    setFloors(fe, HEROES[p.heroId].world, foeWorld(v));
    $('slots').innerHTML =
      row(o, 'b', false) + row(o, 'f', false) +
      `<div class="divider"><span>${inCombat ? '' : icon('eye')}</span></div>` +
      row(v, 'f', true) + row(v, 'b', true);
  }

  function renderPosts() {
    const m = S.match;
    const inCombat = S.combat && (S.phase === 'combat' || S.phase === 'result');
    const viewer = inCombat ? S.combatViewer : S.v;
    [viewer, 1 - viewer].forEach((side) => {
      const el = postEl(side);
      if (!el) return;
      const p = m.players[side];
      const h = HEROES[p.heroId];
      let life = p.life, onBoard = p.summoned, exposed = false, safe = true, front = null;
      if (inCombat) {
        const hf = S.combat.sides[side].hero;
        life = hf.hp / CFG.combat.heroHpScale;
        onBoard = hf.onBoard;
        exposed = S.combat.sides[side].exposed;
        safe = onBoard ? !S.combat.targetable(hf) : !exposed;
      } else {
        const board = side === S.v ? p.board : null;
        front = board ? Object.keys(board).filter((x) => x[0] === 'f').length : null;
        safe = !onBoard && front !== 0;
      }
      // a shield with the number of front-row defenders (green) or a red warning (exposed); a crown when the hero fights on the field
      const st = onBoard && !inCombat ? `<span class="st">${icon('crown')}</span>` : safe ? `<span class="st safe">${icon('shield')}${front ? `<b>${front}</b>` : ''}</span>` : `<span class="st risk">${icon('warn')}</span>`;
      el.style.setProperty('--wc', WORLDS[h.world].color);
      el.className = 'post' + (onBoard && !inCombat ? ' empty-hero' : '') + (exposed && !onBoard ? ' exposed' : '') + (safe ? '' : ' risk');
      const shown = S.phase === 'result' ? p.life : life;   // after the fight: the life after the round's damage
      if (side !== viewer) oppLife(shown, p.maxLife); else dockLife(shown, p.maxLife);
      const chip = document.querySelectorAll('#topbar .lifechip')[side === viewer ? 0 : 1];   // the phone shows hero life + safety in the top bar (the posts are hidden there)
      // per-frame in combat: touch the chip only when what it shows changes
      const csig = lifeStr(shown) + '|' + (onBoard && !inCombat ? 'c' : safe ? 's' : 'w');
      if (chip && chip._sig !== csig) { chip._sig = csig; const b = chip.querySelector('b'); if (b) b.textContent = lifeStr(shown); const ls = chip.querySelector('.lc-st'); if (ls) ls.innerHTML = onBoard && !inCombat ? icon('crown') : safe ? icon('shield') : icon('warn'); chip.classList.toggle('risk', !safe && !(onBoard && !inCombat)); }
      // rebuilding the post (portrait + icons) every animation frame was the most expensive thing in combat: rebuild it only when something but the life changed
      const sig = [side, p.heroId, onBoard, inCombat, safe, exposed, front].join('|');
      if (el.dataset.sig !== sig || !el.querySelector('.lifebar i')) {
        el.dataset.sig = sig;
        el.innerHTML = `${portrait(h, { k: 'post' + side })}
        <div class="pl"><div class="lifebar"><i style="width:${Math.max(0, (life / p.maxLife) * 100)}%"></i></div>
        <div class="st">${icon('heart')} <b>${lifeStr(life)}</b></div></div>${st}`;
      } else {
        const bar = el.querySelector('.lifebar i'); if (bar) bar.style.width = Math.max(0, (life / p.maxLife) * 100) + '%';
        const lb = el.querySelector('.pl .st b'); if (lb) lb.textContent = lifeStr(life);
      }
    });
  }

  function pieceHTML(u, o) {
    const def = UNITS[u.defId];
    const same = me().bench.concat(Object.values(me().board)).filter((x) => x && x.defId === u.defId && x.star === u.star).length;
    return cardHTML(def, { size: 'mini', star: u.star, items: u.items, sel: o && o.sel, k: u.uid, prog: same >= 2 && u.star < CFG.stars.maxStar ? same + '/' + CFG.stars.copiesPerStar : '', cls: S.pop && S.pop.uid === u.uid ? (S.pop.merged ? 'pop merged' : 'pop') : '',
      attrs: `draggable="true" data-drag="unit:${u.uid}" title="${esc(def.name)} ${'★'.repeat(u.star)} — ${ROLES[def.role].name} / ${WORLDS[def.world].name}"` });
  }
  function heroPieceHTML(p) {
    const sel = S.sel && S.sel.kind === 'hero';
    return cardHTML(HEROES[p.heroId], { size: 'mini', life: lifeStr(p.life), sel, k: 'hb', attrs: `draggable="true" data-drag="hero" title="البطل ${esc(HEROES[p.heroId].name)} — في الساحة"` });
  }

  // a bench unit shows its real numbers (with card level power) so you can judge it before putting it on the field
  function benchStats(u) {
    const d = UNITS[u.defId], p = me(), st = cardStats(d, u.star), pw = (p.cardPower && p.cardPower[u.defId]) || 1;
    return `<span class="bm-n"><b class="a">${Math.round(st.atk * pw)}</b><b class="h">${Math.round(st.hp * pw)}</b></span>`;
  }
  // after a purchase the unit goes straight to the field when there is room (its own role's slot first); nothing to hunt for
  function autoPlace(uid) {
    const m = S.match, p = me(); if (!m || m.boardCount(p) >= m.boardCap(p)) return false;
    const u = m.findUnit(p, uid); if (!u || m.players[S.v].bench.indexOf(u) < 0) return false;
    const role = UNITS[u.defId].role, side = ROLES[role].side;
    const FR = ['f1', 'f2', 'f0', 'f3'], BK = ['b1', 'b2', 'b0', 'b3'], free = (x) => !p.board[x] && !(p.summoned && p.heroSlot === x);
    const own = Object.keys(AMB.DATA.SLOT_ROLES).filter((x) => AMB.DATA.SLOT_ROLES[x].includes(role) && free(x));
    const fc = Object.keys(p.board).filter((x) => x[0] === 'f').length, bc = Object.keys(p.board).length - fc;
    const order = side === 'front' ? FR.concat(BK) : side === 'back' ? BK.concat(FR) : (fc <= bc ? FR.concat(BK) : BK.concat(FR));
    const slot = own[0] || order.find(free); if (!slot) return false;
    return m.move(S.v, uid, { zone: 'board', slot }).ok;
  }
  function renderBench() {
    const p = me();
    const lbl = `<span class="lbl">${icon('box')}</span>`;
    if (S.phase === 'combat' || S.phase === 'result') {
      $('bench').innerHTML = lbl + p.bench.map((u) => `<div class="bslot">${u ? cardHTML(UNITS[u.defId], { size: 'mini', star: u.star, items: u.items, k: 'bc' + u.uid, cls: 'ghost' }) : ''}</div>`).join('');
      return;
    }
    $('bench').innerHTML = lbl + p.bench.map((u, i) =>
      `<div class="bslot" data-act="bench" data-idx="${i}" data-drop="bench:${i}">${u ? `<span class="bmed ${S.sel && S.sel.kind === 'unit' && S.sel.uid === u.uid ? 'sel' : ''}" draggable="true" data-drag="unit:${u.uid}" title="${esc(UNITS[u.defId].name)}">${portrait(UNITS[u.defId], { bare: true, k: 'bm' + u.uid })}<i class="bm-st">${'★'.repeat(u.star)}</i></span>${benchStats(u)}` + pieceHTML(u, { sel: S.sel && S.sel.kind === 'unit' && S.sel.uid === u.uid }) : ''}</div>`).join('');
  }

  function fitPrep() {
    const sm = $('scr-match'), fw = document.querySelector('#scr-match .field-wrap'), grid = document.querySelector('#scr-match .match-grid'), opp = $('opp-panel'), side = $('side');
    if (!sm || !fw || !grid || !sm.classList.contains('prep-focus')) return;
    const w = Math.min(innerWidth, 520), scw = Math.max(56, Math.min(86, Math.floor((w - 14 - 4 * 4) / 5)));
    sm.style.setProperty('--scw', scw + 'px');
    fitMatch();   // the shrink-to-fit of the field lives there
  }
  function renderShop() {
    const m = S.match, p = me();
    const prep = S.phase === 'prep' || S.phase === 'resources';
    const E = CFG.economy;
    if (!prep) {
      $('shopbar').innerHTML = `<div class="shop-closed">${icon(S.phase === 'combat' ? 'sword' : 'lock')}</div>`;
      return;
    }
    const owned = {};
    m.allUnits(p).forEach((u) => { owned[u.defId] = owned[u.defId] || { n: 0, s1: 0 }; owned[u.defId].n++; if (u.star === 1) owned[u.defId].s1++; });
    // new arena layout: the shop is a leather drawer with big framed cards (gold frame, rarity gem, coin price, health/attack)
    const RAR = AMB.ECONOMY.rarities;
    const bigCards = p.shop.map((id, i) => {
      if (!id) return `<div class="sc empty"><i class="sc-frame"></i></div>`;
      const d = UNITS[id], ok = m.canBuy(S.v, i).ok, ow = owned[id], st = cardStats(d, 1), rc = (RAR[d.rarity || 'common'] || RAR.common).color;
      const isNew = p.shopNew && p.shopNew[i], stars = '★'.repeat(d.tier);
      const dots = ow && ow.s1 ? `<span class="sc-dots">${'●'.repeat(Math.min(2, ow.s1))}${'○'.repeat(Math.max(1, 3 - Math.min(2, ow.s1)))}</span>` : '';
      return `<div class="sc r${d.tier} rc-${d.rarity || 'common'} ${ok ? '' : 'cant'} ${isNew ? 'newstar' : ''} ${ow && ow.s1 ? 'owned' : ''}" data-act="buy" data-idx="${i}" style="--rc:${rc};--wc:${WORLDS[d.world].color};${artVar(d.id)}" title="${esc(d.name)}: ${esc(d.skill.name)}">
        ${isNew ? `<span class="sc-new">جديد!</span>` : ''}<span class="sc-stars">${stars}</span><span class="sc-pw">${powerOf(st.hp, st.atk)}</span><span class="sc-price" title="السعر بالذهب">${icon('gold')}<b>${d.cost}</b></span><span class="sc-rt">${esc(ROLES[d.role].name)}</span><span class="sc-rar">${(RAR[d.rarity || 'common'] || RAR.common).name}</span>
        <span class="sc-art">${portrait(d, { bare: true, k: 'sca' + i })}</span><i class="sc-frame"></i>
        <span class="sc-gem"></span><b class="sc-cost">${d.cost}</b><b class="sc-hp">${st.hp}</b><b class="sc-atk">${st.atk}</b>
        <span class="sc-role">${icon(ART.ROLE_ICON[d.role] || 'star')}</span>${dots}
        <span class="sc-name">${esc(d.name)}</span><button class="sc-info" data-act="detail" data-id="${d.id}" aria-label="تفاصيل">ⓘ</button></div>`;
    }).join('');
    const cards = p.shop.map((id, i) => {
      if (!id) return `<div class="tcard hc full empty"></div>`;
      const d = UNITS[id];
      const ok = m.canBuy(S.v, i).ok;
      const ow = owned[id];
      const pair = ow && ow.s1 >= 2;
      return cardHTML(d, { cls: `${ok ? '' : 'cant'} ${pair ? 'pair' : ''} ${p.shopNew && p.shopNew[i] ? 'newstar' : ''}`, k: 'sh' + i,
        own: ow ? { n: ow.n, pair, s1: ow.s1 } : null,
        attrs: `data-act="buy" data-idx="${i}" title="${esc(d.skill.name)}: ${esc(d.skill.text)}"` });
    }).join('');
    const items = p.itemShop.map((id, i) => {
      if (!id) return `<div class="tcard hc full empty"></div>`;
      const it = ITEMS[id];
      return itemCardHTML(it, { cls: p.gold >= it.cost ? '' : 'cant', attrs: `data-act="buyItem" data-idx="${i}"` });
    }).join('');
    const freeR = p.freeRerolls > 0, maxed = p.level >= E.maxLevel, upC = m.upgradeCost(p);
    const lvStrip = `<div class="lv-strip" data-act="shopInfo"><span class="ls-lv">${icon('crown')} مستوى المتجر <b>${p.level}</b></span><span class="ls-st">أعلى نجمة <b>${'★'.repeat(p.level)}</b></span>${maxed ? '<span class="ls-up">أعلى مستوى</span>' : `<span class="ls-up ${p.gold >= upC ? 'ok' : ''}">الترقية ${icon('gold')}<b>${upC}</b>${upC < E.upgradeCost[p.level + 1] ? ` <s>${E.upgradeCost[p.level + 1]}</s>` : ''}</span>`}</div>`;
    const rCost = freeR ? 0 : E.rerollCost;
    const price = (n, ok) => `<span class="pr ${ok ? '' : 'no'}">${icon('gold')}<b>${n}</b></span>`;
    // UI v2 dock: «جاهز» next to your hero, then round icon buttons (refresh / lock / XP / upgrades) with their prices
    $('shopbar').innerHTML = `
      <div class="shop-dock">
        <button class="btn primary ready-btn" data-act="ready" title="Enter"><span class="lb">جاهز</span></button>
        <button class="dock-hero" data-act="heroDock" title="قدرات البطل" aria-label="قدرات البطل" style="--wc:${WORLDS[HEROES[p.heroId].world].color}">${portrait(myAvatar(p, 0), { k: 'dock' })}<span class="dh-lv">${icon('crown')}${p.level}</span></button>
        <button class="shop-toggle ${S.shopOpen ? 'on' : ''}" data-act="shopToggle" aria-label="المتجر">🛒<span>${S.shopOpen ? 'سكّر' : 'المتجر'}</span></button>
        <span class="dock-sp"></span>
        <button class="sb-ic" data-act="reroll" title="تحديث المتجر (D)" aria-label="تحديث المتجر">${icon('refresh')}${price(rCost, p.gold >= rCost)}<span class="sb-lb">تحديث</span></button>
        <button class="sb-ic ${p.shopLocked ? 'on' : ''}" data-act="lock" title="${p.shopLocked ? 'المتجر مثبّت' : 'ثبّت المتجر للجولة الجاية'}" aria-label="تثبيت المتجر">${icon(p.shopLocked ? 'lock' : 'unlock')}<span class="sb-lb">تثبيت</span></button>
        <button class="sb-ic xp" data-act="xp" ${maxed ? 'disabled' : ''} title="ترقية المتجر (F)" aria-label="ترقية المتجر">${icon('up')}${maxed ? '' : price(upC, p.gold >= upC)}<i class="xpm lvpips">${Array.from({ length: E.maxLevel }, (_, k) => `<i class="${k < p.level ? 'on' : ''}"></i>`).join('')}</i><span class="sb-lb">${maxed ? 'الأعلى' : 'ترقية'}</span></button>
        <button class="sb-ic" data-act="upgrades" title="شاشة التطوير" aria-label="شاشة التطوير">${icon('star')}<span class="sb-lb">تطوير</span></button>
      </div>
      <div class="shop-row">${lvStrip}<div class="shop-cards">${cards}</div>
      <div class="item-cards">${items}</div></div>
      <div class="shop-drawer open">
        <button class="sd-handle" data-act="shopToggle" aria-label="سكّر المتجر"><i></i></button>
        <div class="sd-head">
          <button class="sd-btn up ${!maxed && p.gold >= upC ? 'can' : ''}" data-act="xp" ${maxed ? 'disabled' : ''} aria-label="ترقية المتجر">${icon('up')}${maxed ? '' : `<b>${upC}</b>`}</button>
          <div class="sd-title"><b>المتجر</b><span class="sd-lv">مستوى ${p.level}</span><span class="sd-stars">${'◆'.repeat(p.level)}<i>${'◇'.repeat(E.maxLevel - p.level)}</i></span></div>
          <div class="sd-items">${p.itemShop.map((id, i) => id ? `<button class="sd-eq ${p.gold >= ITEMS[id].cost ? '' : 'cant'}" data-act="buyItem" data-idx="${i}" title="${esc(ITEMS[id].name)}: ${esc(ITEMS[id].text)}">${icon(ITEMS[id].icon)}<b>${ITEMS[id].cost}</b></button>` : '<span class="sd-eq empty"></span>').join('')}</div>
          <button class="sd-btn lk ${p.shopLocked ? 'on' : ''}" data-act="lock" aria-label="تثبيت المتجر">${icon(p.shopLocked ? 'lock' : 'unlock')}</button>
          <button class="sd-btn rr" data-act="reroll" aria-label="تحديث المتجر">${icon('refresh')}<b>${rCost}</b></button>
        </div>
        <div class="sd-cards">${bigCards}</div>
      </div>`;
    // the shop strip sits above the dock; five cards share the width, and the field takes whatever height is left
    requestAnimationFrame(fitPrep); setTimeout(fitPrep, 350);
  }

  const SYN_ICON = (s) => (s.kind === 'world' ? ART.WORLD_ICON[s.id] : s.kind === 'special' ? 'star' : ART.ROLE_ICON[s.id]);
  // synergy counts DIFFERENT characters: a second copy of the same card does not add. Say it, so nobody is surprised.
  const dupCount = (p) => { const b = Object.values(p.board), u = new Set(b.map((x) => x.defId)); return b.length - u.size; };
  function synergyHTML(list, dups) {
    if (!list.length && !dups) return `<div class="syn-empty">${icon('star')}</div>`;
    AMB.TIPS.syn = () => ({ title: 'كل التآزرات', html: '<p class="hint"><b>التآزر يحسب الشخصيات المختلفة.</b> نسختين من نفس البطاقة في الساحة تحسب مرة وحدة. النسخ المكررة فايدتها إنها تتدمج لنجمة أقوى (٣ نسخ = ★).</p>' + list.map((s) => `<div class="syn-full"><b>${s.name}</b> <small>(${s.count}${s.nextN ? '/' + s.nextN : ''})</small>${s.tiers.map((t) => `<div class="hint">• ${t.n}: ${t.text}</div>`).join('')}</div>`).join('') });
    // one chip per synergy: its icon + how many units you have / the next step; lit when active. Tap = the full list.
    return `<div class="synchips">${list.map((s) => {
      const color = s.kind === 'world' ? WORLDS[s.id].color : s.kind === 'special' ? '#ffcf4a' : '#3ee6ff', on = s.activeTier >= 0;
      return `<button class="schip ${on ? 'on' : ''}" style="--sc:${color}" data-act="info" data-k="syn">${icon(SYN_ICON(s))}<b>${s.count}</b>${s.nextN ? `<small>/${s.nextN}</small>` : ''}</button>`;
    }).join('')}${dups ? `<button class="schip dup" data-act="info" data-k="syn" title="نسخ مكررة ما تزيد التآزر">${icon('swap')}<b>${dups}</b><small>مكرر</small></button>` : ''}</div>`;
  }

  function renderLeft() {
    const m = S.match, p = me(), o = opp();
    const board = Object.values(p.board);
    const ev = AMB.synergy.evaluate(board, p.heroId);
    const front = Object.keys(p.board).filter((x) => x[0] === 'f').length;
    const heroFront = p.summoned && p.heroSlot[0] === 'f';
    const hw = WORLDS[HEROES[p.heroId].world];
    const sc = m.players[1 - S.v].lineup ? m.buildCombatSpec(1 - S.v) : m.scout[1 - S.v];
    const oppSyn = sc ? AMB.synergy.evaluate(sc.units, sc.heroId).list.filter((x) => x.activeTier >= 0) : [];
    const timeline = m.history.map((r) => `<span class="${r.winner === null ? 'wd' : r.winner === S.v ? 'w0' : 'w1'}">${r.round}</span>`).join('');
    AMB.TIPS.guard = () => ({ title: 'حماية البطل', html: '<p>طول ما عندك <b>أي وحدة حية على الساحة</b>، العدو ما يقدر يضرب بطلك. وإذا سقطت كلها ينكشف البطل ويتضرر. (سقوط الصف الأمامي بس يفعّل قدراتك «عند انكشاف الخط».)</p><p>القتلة يقفزون للصف الخلفي بس ما يقدرون يضربون البطل وهو محمي. وإذا نزّلت بطلك الساحة ياخذ الضرر كامل.</p>' });
    const guard = heroFront || front === 0 ? `<button class="guard risk" data-act="info" data-k="guard">${icon('warn')}</button>` : `<button class="guard safe" data-act="info" data-k="guard">${icon('shield')}<b>${front}</b></button>`;
    $('panel-left').innerHTML = `
      <section class="rail-guard">${guard}</section>
      <section><div class="rail-title">${icon('star')}<small>${board.length}/${m.boardCap(p)}</small></div>
        <div class="synchips"><button class="schip ${ev.resonance ? 'on' : ''}" style="--sc:${hw.color}" data-act="info" data-k="syn">${icon(ART.WORLD_ICON[HEROES[p.heroId].world])}<b>${ev.resonance}</b><small>♥</small></button></div>
        ${synergyHTML(ev.list)}</section>
      <section><div class="rail-title">${icon('skull')}</div>
        <div class="opp-mini">${portrait(HEROES[o.heroId], { k: 'lo' })}<div class="om-n"><span>${icon('crown')} ${o.level}</span><span>${icon('heart')} ${lifeStr(o.life)}</span></div></div>
        ${oppSyn.length ? `<div class="synchips">${oppSyn.slice(0, 4).map((x) => `<span class="schip on" style="--sc:${x.kind === 'world' ? WORLDS[x.id].color : '#3ee6ff'}">${icon(SYN_ICON(x))}<b>${x.count}</b></span>`).join('')}</div>` : ''}</section>
      <section><div class="timeline">${timeline || '<span class="wd">·</span>'}</div></section>`;
  }

  const ABILITY_ICON = { buffAllies: 'sword', damageCluster: 'blast', shieldAllies: 'shield', healAllies: 'healall', stunEnemies: 'bolt', frontDR: 'taunt', stunFront: 'snow' };
  function renderRight() {
    const m = S.match, p = me();
    const h = HEROES[p.heroId];
    const prep = S.phase === 'prep' || S.phase === 'resources';
    const avail = p.essence - m.reservedEssence(p);
    const TR = { start: '▶', t5: '⏱', firstDeath: '☠', exposed: '⚠' };   // when the ability fires: start / after 5 s / first ally dies / hero exposed
    const abil = h.abilities.map((a) => {
      const cost = m.abilityCost(p, a);
      const trig = p.abilities[a.id] || '';
      const fired = S.combat && S.phase !== 'prep' && S.combat.sides[S.v] && S.combat.sides[S.v].abilities.find((x) => x.def.id === a.id && x.fired);
      const trigs = Object.values(ABILITY_TRIGGERS).map((t) => `<button class="trg ${trig === t.id ? 'on' : ''}" title="${esc(t.name)}" aria-label="${esc(t.name)}" data-act="abTrig" data-ab="${a.id}" data-t="${t.id}" ${prep ? '' : 'disabled'}>${TR[t.id] || '•'}</button>`).join('');
      return `<div class="ab ${trig ? 'armed' : ''} ${fired ? 'fired' : ''}"><button class="ab-ic" data-act="info" data-k="hero" data-id="${h.id}">${icon(ABILITY_ICON[a.type] || 'burst')}<span class="ab-cost">${icon('essence')}${cost}</span></button><div class="ab-trg">${trigs}</div></div>`;
    }).join('');
    const bag = [];
    for (let i = 0; i < CFG.economy.itemBenchSize; i++) {
      const id = p.items[i];
      if (!id) { bag.push('<div class="bagslot"></div>'); continue; }
      const it = ITEMS[id];
      const sel = S.sel && S.sel.kind === 'item' && S.sel.idx === i;
      bag.push(`<div class="bagslot ${it.kind} ${sel ? 'sel' : ''}" data-act="bagSel" data-idx="${i}">${icon(it.icon)}</div>`);
    }
    const armed = p.armedSpells.map((id, i) => `<span class="chip" data-act="disarm" data-idx="${i}">${icon(ITEMS[id].icon)} ✕</span>`).join('');
    AMB.TIPS.summon = () => ({ title: 'استدعاء البطل', html: `<p>${p.summoned ? 'بطلك الحين يقاتل في الساحة (اسحبه عشان تغيّر مكانه).' : 'بطلك الحين واقف خلف صفوفك.'}</p>
      ${h.vanguard ? `<p><b>👑 ${h.vanguard.name}:</b> ${h.vanguard.text}</p>` : ''}
      <p><b>الفايدة:</b> يهجم بقوة ${Math.round((h.board.atk + CFG.hero.boardAtkPerRound * m.round) * (CFG.hero.boardPower == null ? 1 : CFG.hero.boardPower))}، ${CFG.hero.summonAuraAtk ? `والحلفاء +${CFG.hero.summonAuraAtk * 100}% هجوم، ` : ''}${CFG.hero.summonAbilityDiscount ? `وقدراته أرخص بـ${CFG.hero.summonAbilityDiscount}.` : 'وتأثير القيادة الخاص بالبطل (انظر تفاصيله).'}</p>
      <p><b>المخاطرة:</b> ما ينضرب إلا لما تموت كل وحداتك، وبعدها ياخذ الضرر كامل بدون حماية مركز القيادة، وينسحب بعد ما تخسر ${CFG.combat.summonKnockout} حياة، وإذا وصلت حياته صفر تخسر المباراة على طول.</p>` });
    $('panel-right').innerHTML = `
      <section class="hero-card-mini">${portrait(h, { k: 'rh' })}
        <div class="hcm-r"><div class="lifebar-big"><i style="width:${(p.life / p.maxLife) * 100}%"></i></div><div class="hcm-n">${icon('heart')} <b>${lifeStr(p.life)}</b></div></div>
        <button class="chip-ic" data-act="info" data-k="hero" data-id="${h.id}">${icon('star')}</button></section>
      ${prep ? `<section><div class="summon-row"><button class="btn summon-btn ${p.summoned ? 'on' : ''}" data-act="summon">${icon('crown')}${icon('swap')}${icon('sword')}</button><button class="ibtn" data-act="info" data-k="summon">ⓘ</button></div></section>` : ''}
      <section><div class="rail-title">${icon('essence')}<small>${avail}</small></div><div class="abils">${abil}</div></section>
      <section><div class="bag">${bag.join('')}</div>${armed ? `<div class="armed-spells">${armed}</div>` : ''}</section>
      <section class="selbox">${selectionHTML()}</section>`;
  }

  function selectionHTML() {
    const m = S.match, p = me();
    const prep = S.phase === 'prep' || S.phase === 'resources';
    if (!S.sel || !prep) return '';
    if (S.sel.kind === 'unit') {
      const u = m.findUnit(p, S.sel.uid);
      if (!u) return '';
      const d = UNITS[u.defId], sm = CFG.stars.mult[u.star];
      return `<div class="selinfo">${portrait(d, { k: 'sel' })}<div class="si-r">${stars(u.star)}
        <span>${icon('sword')} ${fmt(d.atk * sm)}</span><span>${icon('heart')} ${fmt(d.hp * sm)}</span><span>${icon('target')} ${d.range}</span><span>${icon(ART.SKILL_ICON[d.skill.type] || 'star')}</span></div></div>`;
    }
    if (S.sel.kind === 'item') { const it = ITEMS[p.items[S.sel.idx]]; return it ? `<div class="selinfo item">${icon(it.icon, 'big-ic')}</div>` : ''; }
    return '';
  }

  // one row under the field: your selection's actions, or a default row with auto-arrange
  function prepBarHTML() {
    const m = S.match, p = me(), sel = S.sel, E = CFG.economy;
    const cnt = `${Object.keys(p.board).length}/${S.match.boardCap(p)}`;
    if (sel && sel.kind === 'unit') {
      const u = m.findUnit(p, sel.uid);
      if (u) {
        const d = UNITS[u.defId], R = ROLES[d.role], onBoard = Object.values(p.board).includes(u);
        return `<div class="pb sel"><span class="pb-name">${stars(u.star)} <span class="rolepill ${R.kind}">${icon(ART.ROLE_ICON[d.role])}</span></span>
          <span class="pb-btns"><button class="btn small danger ib" data-act="sell">بيع ${icon('gold')}+${m.sellValue(u)}</button>
          <button class="btn small ib" data-act="${onBoard ? 'toBench' : 'toBoard'}">${onBoard ? 'للاحتياط' : 'للساحة'}</button>
          <button class="btn small ib" data-act="detail" data-id="${d.id}" data-star="${u.star}">تفاصيل</button>
          ${u.items.length ? `<button class="btn small ib" data-act="unequip">نزع المعدة</button>` : ''}
          <button class="btn small ghost ib" data-act="deselect">إلغاء</button></span></div>`;
      }
    }
    if (sel && sel.kind === 'item') {
      const it = ITEMS[p.items[sel.idx]];
      if (it) return `<div class="pb sel"><span class="pb-name">${icon(it.icon)}</span>
        <span class="pb-btns">${it.kind === 'spell' ? `<button class="btn small ib" data-act="arm">تفعيل</button>` : ''}<button class="btn small danger ib" data-act="sellItem">بيع ${icon('gold')}+${Math.floor(it.cost / 2)}</button><button class="btn small ghost ib" data-act="deselect">إلغاء</button></span></div>`;
    }
    if (sel && sel.kind === 'hero') return `<div class="pb sel"><span class="pb-name">${icon('crown')}</span><span class="pb-btns"><button class="btn small ghost ib" data-act="deselect">✕</button></span></div>`;
    const bag = p.items.map((id, i) => `<button class="bagchip" data-act="bagSel" data-idx="${i}">${icon(ITEMS[id].icon)}</button>`).join('');
    const sev = AMB.synergy.evaluate(Object.values(p.board), p.heroId), dups = dupCount(p);
    const synStrip = sev.list.length || dups ? `<span class="pb-syn">${synergyHTML(sev.list.slice(0, 4), dups)}</span>` : '';
    const armedChips = p.armedSpells.length ? `<span class="pb-armed">${p.armedSpells.map((id, i) => `<button class="chip" data-act="disarm" data-idx="${i}" title="${esc(ITEMS[id].name)}: ${esc(ITEMS[id].text)}. اضغط لإلغاء التفعيل">${icon(ITEMS[id].icon)} ✕</button>`).join('')}</span>` : '';
    return `<div class="pb"><span class="pb-count">${icon('shield')} ${cnt}${p.summoned ? ' +' + icon('crown') : ''}</span>${armedChips}${synStrip}${bag ? `<span class="pb-bag">${bag}</span>` : ''}
      <span class="pb-btns"><button class="btn small ib ${p.summoned ? 'on' : ''} ${!p.summoned && S.match.round >= 2 && p.life >= 30 && S.mode !== 'online' ? 'can-summon' : ''}" data-act="summon">${p.summoned ? '👑 رجّع البطل' : '👑 نزّل البطل'}</button><button class="btn small ib" data-act="autoArrange">تلقائي</button>${S.undo && S.undo.length ? '<button class="btn small ib" data-act="undo" aria-label="تراجع">↶</button>' : ''}${S.match.isFinale(S.match.round) && S.mode !== 'hotseat' ? `<button class="btn small ib ${p.wager ? 'on' : ''}" data-act="wager" title="الخاسر في الجولة الأخيرة يخسر حياة أكثر (للطرفين)">🎲 ${p.wager ? 'راهنت' : 'رهان'}</button>` : ''}</span></div>`;
  }

  // the synergy chips stay visible during the fight, so you can see WHY your board is strong (same chips as the prep bar; no new panels)
  function combatSynHTML() {
    try {
      const pl = S.match && S.match.players[S.v]; if (!pl) return '';
      const sev = AMB.synergy.evaluate(Object.values(pl.board).filter(Boolean), pl.heroId);
      return sev.list.length ? `<span class="pb-syn cc-syn">${synergyHTML(sev.list.slice(0, 4), 0)}</span>` : '';
    } catch (e) { return ''; }
  }
  // teen #18: after-match analysis: the life of both sides round by round, the turning point, your best unit, and a share button
  function analysisHTML(m) {
    const mi = mySeat(), H = m.history; if (!H.length) return '';
    const pts = (i) => [m.players[i].maxLife].concat(H.map((r) => r.players[i].lifeAfter));
    const a = pts(mi), b = pts(1 - mi), max = Math.max(...a, ...b, 1), W = 300, Ht = 90, n = a.length - 1 || 1;
    const line = (arr) => arr.map((v, k) => `${Math.round((k / n) * W)},${Math.round(Ht - (Math.max(0, v) / max) * Ht)}`).join(' ');
    let swing = null, sw = 0;
    H.forEach((r, k) => { const d = Math.abs((r.players[mi].lifeAfter - r.players[1 - mi].lifeAfter) - ((k ? H[k - 1].players[mi].lifeAfter - H[k - 1].players[1 - mi].lifeAfter : 0))); if (d > sw) { sw = d; swing = r.round; } });
    const bu = Object.entries(m.players[mi].stats.byUnit || {}).sort((x, y) => y[1] - x[1])[0];
    const share = `ZOR · ${m.winner === mi ? 'فزت' : m.winner == null ? 'تعادلت' : 'خسرت'} ${H.filter((r) => r.winner === mi).length}–${H.filter((r) => r.winner === 1 - mi).length}${bu ? ` · نجمي: ${UNITS[bu[0]].name}` : ''}`;
    S.shareText = share;
    if (S.mode === 'ai' && !m.rules) {   // adult #29: a link that lets a friend play the very same match (full matches only: a short match has its own rules)
      const p0 = m.players[mi], p1 = m.players[1 - mi];
      const ch = { s: m.seed, h: p0.heroId, a: p1.heroId, st: p1.aiStyle, d: p1.difficulty, w: m.weekly, r: [H.filter((r) => r.winner === mi).length, H.filter((r) => r.winner === 1 - mi).length], l: Math.max(0, Math.round(p0.life)) };
      try { S.shareText = share + '\nتقدر تغلبني؟ نفس المباراة بالضبط: ' + location.origin + location.pathname + '?ch=' + btoa(unescape(encodeURIComponent(JSON.stringify(ch)))); } catch (e) { /* ignore */ }
    }
    return `<div class="res-analysis"><h3>📈 تحليل المباراة</h3>
      <svg viewBox="-4 -4 ${W + 8} ${Ht + 8}" class="ra-graph" role="img" aria-label="حياة الطرفين جولة بجولة"><polyline points="${line(b)}" class="ra-foe"/><polyline points="${line(a)}" class="ra-me"/></svg>
      <div class="ra-legend"><span class="me">— أنت</span><span class="foe">— الخصم</span></div>
      ${swing ? `<p>🔄 نقطة التحول: <b>الجولة ${swing}</b> (تغيّر الفرق ${Math.round(sw)} حياة)</p>` : ''}
      ${bu ? `<p>⭐ أقوى وحدة عندك: <b>${UNITS[bu[0]].name}</b> · ${fmt(bu[1])} ضرر</p>` : ''}
      <button class="btn small" data-act="shareRes">📤 شارك النتيجة</button></div>`;
  }
  // senior #31/#32/#38: one place for comfort; text size zooms the WHOLE game (cards, buttons, numbers), not just paragraphs
  function applyComfort() {
    const ST = AMB.settings; if (!ST) return;
    const z = [1, 1.12, 1.25][ST.textSize()] || 1;
    document.documentElement.style.zoom = '';
    document.documentElement.style.setProperty('--z', String(z));   // applied by CSS to the screens (not the match screen, not the bottom bar)
    document.body.classList.toggle('big-text', ST.textSize() > 0);
    document.body.classList.toggle('reduce-motion', ST.get('motion') === false);
    document.body.classList.toggle('no-vibe', ST.get('vibe') === false);
    try { requestAnimationFrame(() => { if (typeof fitMatch === 'function') fitMatch(); }); } catch (e) { /* ignore */ }
  }
  function settingsModal() {
    const ST = AMB.settings; if (!ST) return;
    const seg = (k, opts, cur) => `<div class="seg">${opts.map(([v, n]) => `<button class="${String(cur) === String(v) ? 'on' : ''}" data-act="setOpt" data-k="${k}" data-v="${v}">${n}</button>`).join('')}</div>`;
    modal(`<h2>⚙️ الإعدادات والراحة</h2>
      <h3>حجم الخط</h3>${seg('textSize', [[0, 'عادي'], [1, 'كبير'], [2, 'كبير جدًا']], ST.textSize())}
      <h3>العدّاد ضد الكمبيوتر</h3>${seg('timer', [['normal', 'عادي'], ['x2', 'وقت ×2'], ['off', 'بدون']], ST.get('timer') || 'normal')}
      <p class="hint">ضد صاحبك يبقى العدّاد عادي.</p>
      <h3>الحركة</h3>${seg('motion', [[true, 'كاملة'], [false, 'أقل']], ST.get('motion') !== false)}
      <h3>الاهتزاز</h3>${seg('vibe', [[true, 'شغّال'], [false, 'طافي']], ST.get('vibe') !== false)}
      <h3>صوت المؤثرات</h3>${seg('sfx', [[0.3, 'واطي'], [0.65, 'وسط'], [1, 'عالي']], ST.get('sfx') == null ? 1 : ST.get('sfx'))}`);
  }
  // kid #9: one friendly tip after a lost match, picked from what actually happened
  function lossTip(m) {
    const p = m.players[0];
    let everSummoned = p.summoned; try { everSummoned = everSummoned || m.summary(0).summoned; } catch (e) { /* ignore */ }
    if (!everSummoned) return 'نزّل بطلك 👑 لما تكون حياتك زينة، يقاتل معك ويقوّي فريقك';
    if (p.gold >= 10) return 'لا تخلي الذهب يتجمع: اشترِ وحدات أو رقِّ المتجر عشان تنزّل وحدات أقوى وأكثر';
    if (p.level < 5) return 'رقِّ المتجر ⬆ عشان تظهر بطاقات بنجمة أعلى وتنزّل وحدات أكثر في الساحة';
    return 'حط الحراس والمقاتلين قدّام، والقناصة والسحرة ورا';
  }
  function renderCombatCtrl() {
    const el = $('combat-ctrl');
    S.dockUi = null;
    if (S.phase === 'combat' || S.phase === 'result') {
      // UI v2 combat dock: your hero + life on one side, clock / speed / skip on the other, synergy chips under them
      const p = me(), h = HEROES[p.heroId];
      el.innerHTML = `<div class="cc-dock"><span class="cc-hero" style="--wc:${WORLDS[h.world].color}">${portrait(myAvatar(p, 0), { k: 'ccd' })}<span class="cc-life"><span class="op-bar"><i></i></span>${icon('heart')}<b>${lifeStr(p.life)}</b></span></span>
        <span class="cc-sp"></span>
        ${S.phase === 'combat' ? `<span class="clock">0.0ث</span><span class="fury"></span><button class="btn small cc-speed" data-act="speed" data-v="${S.speed >= 4 ? 1 : S.speed * 2}" title="السرعة" aria-label="السرعة">${icon('play')}<b>${S.speed}x</b></button>
        <button class="btn small ib cc-skip" data-act="skip">${icon('skip')}تخطي</button>` : ''}</div>${combatSynHTML()}`;
      S.dockUi = { bar: el.querySelector('.cc-life .op-bar i'), num: el.querySelector('.cc-life b'), txt: '', pct: -1 };
      dockLife(p.life, p.maxLife);
    } else if (S.phase === 'prep' || S.phase === 'resources') {
      el.innerHTML = prepBarHTML();
    } else el.innerHTML = '';
  }

  // ======================================================================= modals
  function unitDetail(id, star) {
    const d = UNITS[id];
    const W = WORLDS[d.world], R = ROLES[d.role];
    const SM = CFG.stars.mult;
    const rows = [
      ['الصحة', (s) => d.hp * SM[s]], ['الهجوم', (s) => d.atk * SM[s]], ['سرعة الهجوم (ضربة في الثانية)', () => d.as, 2],
      ['الضرر في الثانية', (s) => d.atk * SM[s] * d.as], ['المدى', () => d.range], ['الدفاع (ضرر أقل)', () => d.def * 100, 0, '%'],
      ['فرصة الحرجة', () => d.crit * 100, 0, '%'], ['المانا للمهارة', () => d.mana],
    ];
    const sk = d.skill;
    const vals = [['dmg', 'الضرر'], ['heal', 'العلاج'], ['shield', 'الدرع'], ['dps', 'ضرر/ث'], ['stun', 'الشلل (ث)'], ['pct', 'سرعة الهجوم %']];
    const skRows = vals.filter(([k]) => sk[k]).map(([k, n]) => `<tr><td>${n}</td>${sk[k].map((v, i) => `<td>${k === 'pct' ? Math.round(v * 100) + '%' : v}${i ? `<div class="delta">+${Math.round(((v - sk[k][0]) / sk[k][0]) * 100)}%</div>` : ''}</td>`).join('')}</tr>`).join('');
    const synOf = (sid) => SYNERGIES[sid].tiers.map((t) => `<div class="hint">• ${t.n}: ${t.text}</div>`).join('');
    let match = '';
    if (S.match) {
      const p = me();
      const ow = S.match.allUnits(p).filter((u) => u.defId === id);
      match = `<div class="hint">في هالمباراة عندك: ${ow.length ? ow.map((u) => '★'.repeat(u.star)).join(' ، ') : 'ولا وحدة'} · المتبقي في المخزون المشترك: ${S.match._pool(me())[id]}/${CFG.economy.poolSize[d.tier]}</div>`;
    }
    modal(`<div class="detail-head">${portrait(d, { k: 'md' })}<div><h2>${d.name} ${star ? stars(star) : ''}</h2><div class="hint" style="direction:ltr;text-align:right">${d.en}</div>
      <span class="pill" style="--pc:${W.color}">${W.name}</span><span class="pill">${R.name}</span><span class="pill" style="--pc:var(--t${d.tier})">فئة ${d.tier} · تكلفة ${d.cost}</span>
      <div class="hint">${R.desc} ${d.role === 'assassin' ? 'يقفز للصف الخلفي في بداية القتال.' : ''}</div></div></div>
      <table><tr><th>الخاصية</th><th>★</th><th>★★</th><th>★★★</th></tr>
      ${rows.map(([n, f, dg, suf]) => `<tr><td>${n}</td>${[1, 2, 3].map((s) => { const v = f(s), b = f(1); return `<td>${fmt(v, dg || 0)}${suf || ''}${s > 1 && v !== b ? `<div class="delta">+${Math.round(((v - b) / b) * 100)}%</div>` : ''}</td>`; }).join('')}</tr>`).join('')}</table>
      <div class="skillbox"><b>المهارة — ${sk.name}:</b> ${sk.text}
        ${skRows ? `<table><tr><th></th><th>★</th><th>★★</th><th>★★★</th></tr>${skRows}</table>` : ''}</div>
      ${(d.traits && d.traits.length) || d.sig ? `<div class="skillbox rar-box"><b>صفات ${AMB.ECONOMY.rarities[d.rarity] ? AMB.ECONOMY.rarities[d.rarity].name : ''}:</b>${(d.traits || []).map((id) => `<div>• ${AMB.DATA.TRAITS[id].name}: ${AMB.DATA.TRAITS[id].text}</div>`).join('')}${d.sig ? `<div class="sig-line">★ <b>${AMB.DATA.SIGS[d.sig].name}</b>: ${AMB.DATA.SIGS[d.sig].text}</div>` : ''}</div>` : `<div class="hint">عادي: يسوي دور ${ROLES[d.role].name} الأساسي بدون صفات إضافية.</div>`}
      <div class="hint"><b>الدمج:</b> ${CFG.stars.copiesPerStar} نسخ ★ = بطاقة مطوّرة واحدة بإطار ذهبي، الصحة والهجوم ×${SM[2]}؛ السرعة والمدى ما تتغير. تندمج مرة وحدة فقط.</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px">
        <div><span class="wtag" style="--w:${W.color}">${SYNERGIES[d.world].name}</span>${synOf(d.world)}</div>
        <div><b>${SYNERGIES[d.role].name}</b>${synOf(d.role)}</div></div>
      <p class="hint">${W.lore}</p>${match}`);
  }

  function heroDetail(id) {
    const h = HEROES[id], W = WORLDS[h.world];
    modal(`<div class="detail-head">${portrait(h, { k: 'mh' })}<div><h2>${h.name}</h2><div class="hint">${h.title}</div>
      <span class="pill" style="--pc:${W.color}">${W.name}</span><div class="hint">${h.style}</div></div></div>
      ${heroLevelHTML(id)}<div class="hint" style="margin:-2px 0 6px">كل مباراة تلعبها بالبطل تعطيه خبرة. قوته من المستوى تنحسب في كل الأطوار ما عدا «على نفس الجهاز» و«ضد صاحبك».</div>
      <div class="skillbox"><b>سلبية: ${h.passive.name}</b> — ${h.passive.text}</div>
      ${h.abilities.map((a) => `<div class="skillbox"><b>${a.name}</b> — <span style="color:var(--ess)">${a.cost} جوهر</span><br>${a.text}</div>`).join('')}
      ${h.vanguard ? `<div class="skillbox vg"><b>👑 ${h.vanguard.name}</b> (لما ينزل الساحة)<br>${h.vanguard.text}</div>` : ''}
      <table><tr><th>عند الاستدعاء</th><th></th></tr>
      <tr><td>الصحة</td><td>الحياة × ${CFG.combat.heroHpScale}</td></tr><tr><td>الهجوم</td><td>${h.board.atk} + ${CFG.hero.boardAtkPerRound} لكل جولة</td></tr>
      <tr><td>سرعة الهجوم</td><td>${h.board.as}</td></tr><tr><td>المدى</td><td>${h.board.range}</td></tr><tr><td>الدفاع</td><td>${Math.round(h.board.def * 100)}%</td></tr></table>
      <p class="hint">${W.lore}</p>`);
  }

  function upgradesModal() {
    const m = S.match, p = me();
    const groups = {};
    m.allUnits(p).forEach((u) => { (groups[u.defId] = groups[u.defId] || []).push(u); });
    const need = CFG.stars.copiesPerStar;
    const rows = Object.entries(groups).sort((a, b) => UNITS[b[0]].tier - UNITS[a[0]].tier).map(([id, list]) => {
      const d = UNITS[id];
      const byStar = [1, 2, 3].map((s) => list.filter((u) => u.star === s).length);
      const maxed = byStar[2] > 0 && byStar[0] === 0 && byStar[1] === 0;
      const target = byStar[0] > 0 || byStar[1] === 0 ? 1 : 2;
      const have = byStar[target - 1];
      const SM = CFG.stars.mult;
      const preview = maxed ? 'وصلت لأعلى مستوى ★★★' : `عند <bdi dir="ltr">${'★'.repeat(target + 1)}</bdi>: صحة ${fmt(d.hp * SM[target])} → <b>${fmt(d.hp * SM[target + 1])}</b>، هجوم ${fmt(d.atk * SM[target])} → <b>${fmt(d.atk * SM[target + 1])}</b>${d.skill.dmg ? `، ${d.skill.name} ${d.skill.dmg[target - 1]} → <b>${d.skill.dmg[target]}</b>` : d.skill.heal ? `، علاج ${d.skill.heal[target - 1]} → <b>${d.skill.heal[target]}</b>` : d.skill.shield ? `، درع ${d.skill.shield[target - 1]} → <b>${d.skill.shield[target]}</b>` : ''}`;
      const inShop = p.shop.map((x, i) => [x, i]).filter((e) => e[0] === id);
      const btn = inShop.length && !maxed ? `<button class="btn small primary" data-act="buyFromUpg" data-idx="${inShop[0][1]}">شراء من المتجر (${d.cost})</button>` : `<span class="hint">${maxed ? '' : 'غير متوفر في المتجر الآن'}</span>`;
      return `<div class="upg-row">${portrait(d, { k: 'up' + id })}<div><b>${d.name}</b> <span class="hint"><bdi dir="ltr">★×${byStar[0]} · ★★×${byStar[1]} · ★★★×${byStar[2]}</bdi> · المخزون <bdi dir="ltr">${m._pool(me())[id]}</bdi></span>
        ${maxed ? '' : `<div class="hint">نسخ <bdi dir="ltr">${'★'.repeat(target)}</bdi>: <bdi dir="ltr">${have}/${need}</bdi> للترقية</div><div class="prog"><i style="width:${(have / need) * 100}%"></i></div>`}
        <div class="hint">${preview}</div></div>${btn}</div>`;
    }).join('');
    modal(`<h2>شاشة التطوير</h2><p class="hint">اجمع ${need} نسخ متطابقة بنفس النجوم وتندمج لوحدة أقوى لحالها (والمعدات تنتقل معها). أعلى مستوى ★★★.
      المخزون مشترك بين اللاعبين، فإذا خصمك جمع نفس الوحدة تصير أصعب عليك.</p>${rows || '<p class="hint">ما عندك وحدات للحين.</p>'}`);
  }

  // senior #40: plain words for the game's terms, and the interest explained with the player's own numbers
  AMB.TIPS = AMB.TIPS || {};
  AMB.TIPS.interest = () => { const E0 = CFG.economy, p = S.match && me(); const n = p ? Math.min(E0.interestMax, Math.floor(p.gold / E0.interestPer)) : 0;
    return { title: 'الفايدة على الذهب', html: `<p>كل ${E0.interestPer} ذهب تخليها معك = +1 ذهب زيادة في الجولة الجاية، لين ${E0.interestMax}.</p>${p ? `<p>معك <b>${p.gold}</b> ذهب، يعني فايدتك الجاية <b>+${n}</b>.</p>` : ''}` }; };
  const GLOSSARY = [['ذهب', 'تشتري فيه البطاقات وترقّي فيه المتجر. يجيك كل جولة.'], ['جوهر', 'تشغّل فيه قدرات بطلك وقت القتال.'], ['شظايا 💎', 'عملة برا المباراة: تفتح فيها الباكجات.'],
    ['مستوى المتجر', 'من ١ إلى ٥: كل مستوى يفتح بطاقات بنجمة زيادة ويكبّر الساحة. ترفعه بزر الترقية.'], ['تآزر', 'وحدات من نفس العالم أو نفس الدور مع بعض = قوة زيادة.'], ['رنين', 'وحدات من عالم بطلك تاخذ قوة زيادة.'],
    ['نجمة ★', 'نسخ متطابقة تندمج وتصير الوحدة أقوى.'], ['الغضب', 'بعد وقت من القتال الكل يضرب أقوى، عشان القتال يخلص.'], ['إنزال البطل 👑', 'بطلك يقاتل في الساحة ويقوّي فريقك، بس ممكن يخسر حياة.']];
  function howto(fromMenu) {
    modal(`<h2>كيف ألعب؟</h2>${fromMenu && AMB.TutorialUI ? '<p><button class="btn primary" data-act="tutReplay">🎓 جرّب الدرس</button></p>' : ''}
      <details class="glossary"><summary>📖 قاموس الكلمات</summary>${GLOSSARY.map(([w, d]) => `<p><b>${w}:</b> ${d}</p>`).join('')}</details>
      <div class="skillbox"><b>الهدف:</b> نزّل حياة بطل الخصم لين تصير صفر. كل جولة: موارد ← شراء وتطوير ← ترتيب وقدرات ← قتال تلقائي ← نتيجة.</div>
      <div class="skillbox"><b>المتجر:</b> اشتر الوحدات بالذهب، وحدّث العروض (${CFG.economy.rerollCost} ذهب)، ورقِّ المتجر (من ١ إلى ٥): المستوى N يبيع بطاقات من ١ إلى N نجوم، وسعر البطاقة = نجومها. الترقية تغلى مع كل مستوى وتنزل 1 كل جولة ما رقّيت فيها. والفايدة: +1 عن كل ${CFG.economy.interestPer} ذهب موفّر (لين ${CFG.economy.interestMax}). وسلسلة الفوز أو الخسارة تعطيك ذهب زيادة.</div>
      <div class="skillbox"><b>الدمج:</b> ${CFG.stars.copiesPerStar} نسخ متطابقة (في الفريق أو الاحتياط) تندمج في بطاقة واحدة مطوّرة بإطار ذهبي وقوة ×${CFG.stars.mult[2]}، وتاخذ هدية: اختيار بطاقة من ${CFG.stars.mergeChoices} نجومها أعلى من مستوى متجرك بنجمة. البطاقة المطوّرة ما تندمج مرة ثانية.</div>
      <div class="skillbox"><b>الساحة:</b> صف أمامي (خط الدفاع) وصف خلفي. الحراس والمقاتلين قدّام، والسحرة والقناصة والدعم ورا. القتلة يقفزون للصف الخلفي عند العدو.</div>
      <div class="skillbox"><b>البطل:</b> يبقى خلف صفوفك وما أحد يقدر يضربه طول ما عندك أي وحدة حية على الساحة. وإذا سقطت كلها ينكشف. تقدر تنزّله الساحة يقاتل بنفسه، وهذا مكسب كبير بس فيه مخاطرة.</div>
      <div class="skillbox"><b>القدرات:</b> جهّز قدرات البطل واختر متى تشتغل (بداية القتال، بعد 5 ثواني، لما يسقط أول واحد من فريقك، أو لما ينكشف البطل). وتخسّر جوهر.</div>
      <div class="skillbox"><b>التآزر:</b> وحدات من نفس العالم أو نفس الدور تعطيك مكافآت. ووحدات عالم بطلك تاخذ رنين. وإذا جمعت 3 أو 4 عوالم مختلفة يشتغل «تقارب العوالم» عشان التشكيلة المختلطة ما تكون أضعف.</div>
      <div class="skillbox"><b>المراحل والمكافآت:</b> المباراة ${CFG.match.maxRounds} جولات في 4 مراحل: ${CFG.match.stages.map((x) => x.name + ' (' + (x.rounds[0] === x.rounds[1] ? 'الجولة ' + x.rounds[0] : 'الجولتان ' + x.rounds[0] + '–' + x.rounds[1]) + ')').join('، ')}. بعد كل مرحلة (عدا الأخيرة) تختار <b>مكافأة من 3</b>: وحدة مجانية، ذهب، تخفيض الترقية، جوهر، معدة، <b>بركة دائمة</b> للفريق، أو شفاء للبطل. جولة الحسم تضاعف خسارة الحياة ×${CFG.match.finaleLossMult}. وإذا ما سقط أي بطل قبلها يفوز اللي حياته أعلى. وداخل القتال الضرر يزيد بعد ${CFG.combat.furyStart} ثانية (الغضب).</div>`);
  }

  function matchMenu() {
    const wasPaused = S.paused, canPause = S.mode !== 'online';   // online: the menu never freezes the prep clock (the friend is waiting)
    if (canPause) { S.paused = true; S.pausedLeft = S.phase === 'prep' ? S.deadline - Date.now() : null; }   // only a running prep timer has time left to restore
    S._resumeAfterMenu = canPause && !wasPaused;
    modal(`<h2>القائمة</h2><div style="display:grid;gap:10px;margin-top:12px">
      <button class="btn" data-act="resumeMenu">متابعة</button>
      <button class="btn" data-act="rotate">تدوير الشاشة (طول / عرض)</button>
      <button class="btn" data-act="tutorial">دليل سريع</button>
      <button class="btn" data-act="rules">كل القواعد</button>
      <button class="btn danger" data-act="surrender">انسحب (${esc(me().name)})</button>
      <button class="btn ghost" data-act="abandon">الخروج للقائمة (ما تنحسب)</button></div>`);
  }

  // hero experience: every finished match (except the guided tutorial and same-device play) levels up the hero you played
  // a match counts for progression only if at least one combat was actually fought (an instant surrender pays nothing)
  const fought = (m) => m.history.length >= 1;
  function awardHeroXp(m) {
    if (!AMB.heroes || m._heroXp || S.mode === 'tutorial' || S.mode === 'practice' || S.mode === 'hotseat' || S.mode === 'friendly' || S.mode === 'online' || !fought(m)) return;
    if (S.challenge && AMB.collection && !AMB.collection.owned(m.players[0].heroId)) return;   // a friend's challenge with a hero you do not own gives that hero no XP
    m._heroXp = true;
    const seat = mySeat(), p = m.players[seat], won = m.winner === seat;
    const roundsWon = m.history.filter((r) => r.winner === seat).length;
    const r = AMB.heroes.addXp(p.heroId, AMB.heroes.matchXp({ won, roundsWon, short: !!m.rules }));
    const h = HEROES[p.heroId];
    setTimeout(() => {
      if (r.levelsUp > 0) { sfx('win'); toast(`⬆ ${h.name} صار مستوى ${r.level}! أقوى في كل الأطوار`, 'good'); }
      else toast(`+${r.gained} خبرة لـ${h.name}`, 'good');
    }, 900);
  }
  // little level badge + bar for a hero (hero select, hero details)
  function heroLevelHTML(id) {
    if (!AMB.heroes) return '';
    const pr = AMB.heroes.progress(id), rk = AMB.heroes.rank(id), pw = AMB.heroes.power(id);
    return `<div class="hlv" style="--rk:${rk.color}"><b>مستوى ${pr.level}</b><span class="hlv-rank">${rk.name}</span>
      <span class="hlv-bar"><i style="width:${pr.max ? 100 : Math.round(100 * pr.inLevel / pr.need)}%"></i></span><small>${pr.max ? 'أعلى مستوى' : `${pr.inLevel}/${pr.need}`}</small>
      ${pr.level > 1 ? `<div class="hlv-pw">حياته +${pr.level - 1} · نزوله للساحة +${Math.round((pw.atk - 1) * 100)}% هجوم · شكله +${Math.round((pw.vanguard - 1) * 100)}% · قدراته +${Math.round((pw.ability - 1) * 100)}%</div>` : ''}</div>`;
  }

  // ======================================================================= results / stats / codex
  function myAvatar(p, i) {   // equipped battle-pass avatar replaces only the picture of your own hero chip (never stats)
    if (i !== 0 || S.mode === 'hotseat' || !AMB.PassUI) return HEROES[p.heroId];
    const id = AMB.PassUI.avatarId();
    return (id && AMB.PassUI.avatarDef(id)) || HEROES[p.heroId];
  }
  function showResults() {
    const m = S.match;
    closeOverlay();
    cancelAnimationFrame(S.raf);
    S.phase = 'over';
    const secs = Math.round((Date.now() - S.startTs) / 1000);
    if (S.mode === 'practice') return practiceResult(m, secs);   // hero trial: no XP, rewards, stats, pass or play count
    awardHeroXp(m);
    if (S.mode === 'ai') resumeClear();   // the match is over: nothing to continue
    if (S.mode === 'campaign') return AMB.CampaignUI.showResult(m, secs);   // campaign and tower have their own results screens
    if (S.mode === 'tower') return AMB.TowerUI.showResult(m, secs);
    if (S.mode === 'event') return AMB.EventUI.showResult(m, secs);
    if (S.mode === 'tutorial') return AMB.TutorialUI.showResult(m, secs);
    if (S.mode !== 'friendly' && S.mode !== 'online' && !m._recorded) { try { AMB.telemetry.recordMatch(m, { seconds: secs }); } catch (e) { reportErr(e); } m._recorded = true; /* analytics must never block the results screen */ }
    if (!m._counted) { m._counted = true; try { localStorage.setItem('amb_played', String(+(localStorage.getItem('amb_played') || 0) + 1)); } catch (e) { /* ignore */ } }
    // adult #24: a quick match vs the computer pays a few shards (daily cap); adult #30: the first 3 friend matches a day give pass XP (never shards)
    if (!m._dayPaid && AMB.dayPay && fought(m)) { m._dayPaid = true; if (S.mode === 'ai' || S.mode === 'short') S.qmShards = AMB.dayPay.quickMatch(m.winner === mySeat()); else S.qmShards = 0; S.onlineXp = S.mode === 'online' && AMB.dayPay.onlineCounts(); }
    if (!m._passDone && (S.mode !== 'online' || S.onlineXp) && fought(m)) { m._passDone = true; try { S.passResult = AMB.pass.recordMatch(m.summary(0)); } catch (e) { S.passResult = null; } }
    let title;
    if (m.winner === null || m.winner === undefined) title = 'تعادل';
    else if (S.mode === 'hotseat') title = `فاز ${esc(m.players[m.winner].name)}!`;
    else title = m.winner === mySeat() ? 'نصر!' : (() => { const a = m.players[mySeat()], b = m.players[1 - mySeat()]; return b.life - Math.max(0, a.life) <= 30 || a.stats.wins >= 3 ? 'قربت! جرّب مرة ثانية' : 'هالمرة صعبة، جرّب مرة ثانية'; })();
    const last = m.history[m.history.length - 1];
    const cols = m.players.map((p, i) => {
      const h = HEROES[p.heroId];
      const b = last ? last.players[i].board : [];
      const syn = last ? last.players[i].synergies.map((s) => SYNERGIES[s].name).join('، ') : '';
      return `<div class="res-col ${m.winner === i ? 'won' : ''}"><div class="hero-box">${portrait(h, { k: 'res' + i })}<div><div class="nm">${esc(p.name)} ${m.winner === i ? '🏆' : ''}</div><div class="ti">${h.name} · ${WORLDS[h.world].name}${p.isAI ? ' · ذكاء اصطناعي (' + p.aiStyle + ')' : ''}</div></div></div>
        <div class="kv"><span>الحياة المتبقية</span><b>${lifeStr(p.life)}</b></div>
        <div class="kv"><span>جولات فاز/خسر/تعادل</span><b>${p.stats.wins}/${p.stats.losses}/${p.stats.draws}</b></div>
        <div class="kv"><span>الضرر الكلي للوحدات</span><b>${fmt(p.stats.damageDealt)}</b></div>
        <div class="kv"><span>الذهب المنفق</span><b>${p.stats.goldSpent}</b></div>
        <div class="kv"><span>الوحدات المشتراة / التحديثات</span><b>${p.stats.unitsBought} / ${p.stats.rerolls}</b></div>
        <div class="kv"><span>المستوى النهائي</span><b>${p.level}</b></div>
        <div class="hint" style="margin-top:6px">التآزر النهائي: ${syn || '—'}</div>
        <div class="hint">المكافآت: ${p.rewardLog.length ? p.rewardLog.map((r) => AMB.DATA.REWARDS[r.id].name).join('، ') : '—'}</div>
        <div class="mini-board">${b.map((u, k) => `<div class="mini">${portrait(UNITS[u.defId], { k: 'rb' + i + k })}<div>${stars(u.star)}</div></div>`).join('')}</div></div>`;
    }).join('');
    const tl = m.history.map((r) => `<span class="${r.winner === null ? 'wd' : r.winner === 0 ? 'w0' : 'w1'}" title="الجولة ${r.round}">${r.round}<i>${r.winner === null ? '=' : r.winner === mySeat() ? '✓' : '✗'}</i></span>`).join('');   // senior #37: ✓/✗ too, not only colour
    const myWin = S.mode === 'hotseat' ? m.winner != null : m.winner === 0;
    const wi = S.mode === 'hotseat' && m.winner != null ? m.winner : 0;   // vs AI: always show your own hero
    const heroDef = HEROES[m.players[wi].heroId];
    const own = S.mode !== 'hotseat' && wi === 0;
    const avDef = own ? myAvatar(m.players[0], 0) : heroDef;
    const ptitle = own && AMB.PassUI ? AMB.PassUI.titleName() : '';
    const stage = `<div class="res-stage ${m.winner == null ? 'draw' : myWin ? 'victory' : 'defeat'}" style="--wc:${WORLDS[heroDef.world].color}"><div class="res-rays"></div><div class="res-hero">${portrait(avDef, { bare: true, k: 'resh' })}<i class="sheen"></i></div><div class="res-hname">${avDef.name}</div>${ptitle ? `<div class="res-title">${ptitle}</div>` : ''}</div>`;
    $('results').innerHTML = `${stage}<div class="res-banner"><h1>${title}</h1><p class="hint">${m.round} جولات · ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')} دقيقة ${S.mode === 'friendly' ? '· مباراة ودية (ما تنحسب)' : ''}</p>
      <div class="timeline">${tl}</div>${(S.mode === 'ai' || S.mode === 'short') && S.qmShards ? `<p class="hint">${icon('gem')} +${S.qmShards} شظية من المباراة</p>` : ''}${S.mode === 'online' ? `<p class="hint">${S.onlineXp ? 'انحسبت في ممر الصدع ✓' : `أول ${AMB.dayPay ? AMB.dayPay.ONLINE_XP_GAMES : 3} مباريات مع الأصحاب كل يوم تنحسب في الممر`}</p>` : ''}${S.mode !== 'hotseat' && m.winner != null && !myWin ? `<p class="res-tip">💡 ${lossTip(m)}</p>` : ''}</div>
      ${AMB.PassUI ? AMB.PassUI.resultPanel(S.passResult) : ''}
      <div class="res-quick">${m.players.map((p, i) => `<div class="rq ${m.winner === i ? 'won' : ''}"><b>${esc(p.name)}</b><span>${icon('heart')} ${lifeStr(p.life)}</span><span>${icon('sword')} ${p.stats.wins}–${p.stats.losses}</span><span>${fmt(p.stats.damageDealt)} ضرر</span></div>`).join('')}</div>
      ${S.mode === 'ai' && S.challenge ? (() => { const ch = S.challenge, mi0 = mySeat(), me0 = m.history.filter((r) => r.winner === mi0).length, them0 = m.history.filter((r) => r.winner === 1 - mi0).length, mine = me0 * 1000 + Math.max(0, m.players[mi0].life), his = ch.r[0] * 1000 + ch.l; return `<div class="series-box"><b>⚔ تحدي صاحبك</b><br>صاحبك: ${ch.r[0]}–${ch.r[1]} (حياة ${ch.l}) · أنت: ${me0}–${them0} (حياة ${Math.max(0, Math.round(m.players[mi0].life))})<br><b>${mine > his ? '🏆 غلبته!' : mine === his ? 'تعادلتوا' : 'هو أحسن هالمرة'}</b></div>`; })() : ''}
      ${S.mode === 'online' && AMB.NetUI ? AMB.NetUI.seriesNote(m) : ''}${S.mode !== 'hotseat' ? analysisHTML(m) : ''}
      <details class="res-details"><summary>تفاصيل المباراة</summary><div class="res-cols">${cols}</div></details>
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-bottom:30px">
        <button class="btn primary big" data-act="again">مباراة جديدة</button>
        <button class="btn big" data-act="go" data-to="stats">الإحصائيات</button>
        <button class="btn big ghost" data-act="go" data-to="menu">القائمة الرئيسية</button></div>`;
    show('results');
    if (m.winner != null) { sfx(myWin ? 'win' : 'lose'); }
    if (myWin) setTimeout(() => { const h = document.querySelector('.res-hero'); if (h) (own && AMB.PassUI ? AMB.PassUI.fxColors() : ['#ffd24a', '#ff4f8b', '#5fe3ff', '#7bd46a', '#ffffff']).forEach((c) => burst(h, c, 14, { r: 150, s: 8 })); }, 250);
  }

  // teen #20: the meta, in plain Arabic: which heroes and synergies win most right now (simulation, refreshed with tools/meta-snapshot.js)
  function metaHTML() {
    const M = AMB.META; if (!M) return '';
    const rows = (o, nameOf) => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<tr><td>${nameOf(k)}</td><td>${v}%</td><td><div class="bar"><i style="width:${v}%"></i></div></td></tr>`).join('');
    return `<div class="box" style="grid-column:1/-1"><h3>📊 الميتا الحين</h3><p class="hint">نسبة الفوز من آلاف المباريات بين الكمبيوتر (${M.date}). 50% = متوازن.</p>
      <div class="meta-cols"><table><tr><th>البطل</th><th>فوز</th><th></th></tr>${rows(M.heroes, (k) => (HEROES[k] ? HEROES[k].name : k))}</table>
      <table><tr><th>التآزر</th><th>فوز</th><th></th></tr>${rows(M.synergies, (k) => (SYNERGIES[k] ? SYNERGIES[k].name : k))}</table></div></div>`;
  }
  function renderStats() {
    const d = AMB.telemetry.load();
    const pct = (w, p) => (p ? Math.round(((w || 0) / p) * 100) : 0);
    const tbl = (obj, nameOf, extra) => {
      const rows = Object.entries(obj).sort((a, b) => b[1].picks - a[1].picks);
      if (!rows.length) return '<p class="hint">ما فيه بيانات للحين، العب مباراة.</p>';
      return `<table><tr><th>الاسم</th><th>مرات</th><th>نسبة الفوز</th><th></th>${extra ? '<th>نهائي</th><th>★★★</th>' : ''}</tr>${rows.map(([k, v]) =>
        `<tr><td>${nameOf(k)}</td><td>${v.picks}</td><td>${pct(v.wins, v.picks)}%</td><td><div class="bar"><i style="width:${pct(v.wins, v.picks)}%"></i></div></td>${extra ? `<td>${v.final || 0}</td><td>${v.threeStar || 0}</td>` : ''}</tr>`).join('')}</table>`;
    };
    const recent = d.recent.map((r) => `<tr><td>${new Date(r.at).toLocaleString('ar')}</td><td>${({ ai: 'ضد الكمبيوتر', short: 'قصيرة', hotseat: 'نفس الجهاز', online: 'ضد صاحبك', friendly: 'ودية', campaign: 'الحملة', tower: 'البرج', event: 'الحدث' })[r.mode] || r.mode}</td><td>${r.heroes.map((h) => HEROES[h] ? HEROES[h].name : h).join(' ضد ')}</td><td>${r.winner === null ? 'تعادل' : r.winner === 0 ? 'أنت' : r.mode === 'hotseat' ? 'لاعب 2' : r.mode === 'online' ? 'صاحبك' : 'الكمبيوتر'}</td><td>${r.rounds}</td><td>${Math.round(r.seconds / 60 * 10) / 10}د</td></tr>`).join('');
    $('stats').innerHTML = `
      <div class="box"><h3>نظرة عامة</h3>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;text-align:center">
          <div><div class="big-num">${d.matches}</div><div class="hint">مباراة</div></div>
          <div><div class="big-num">${d.matches ? fmt(d.totalRounds / d.matches, 1) : 0}</div><div class="hint">متوسط الجولات</div></div>
          <div><div class="big-num">${d.matches ? fmt(d.totalSeconds / d.matches / 60, 1) : 0}</div><div class="hint">متوسط الدقائق</div></div></div>
        <p class="hint">تعادلات: ${d.draws} · استدعاء البطل: ${d.summons.used} لاعب، فوز ${pct(d.summons.wins, d.summons.used)}%</p>

        <div style="display:flex;gap:8px"><button class="btn small" data-act="statsExport">تصدير JSON</button><button class="btn small danger" data-act="statsReset">مسح البيانات</button></div></div>
      <div class="box"><h3>الأبطال</h3>${tbl(d.heroes, (k) => HEROES[k] ? HEROES[k].name : k)}</div>
      ${metaHTML()}
      <div class="box"><h3>أنماط اللاعبين</h3>${tbl(d.styles, (k) => k === 'human' ? 'بشري' : k.replace('ai:mono', 'كمبيوتر: عالم واحد').replace('ai:mixed', 'كمبيوتر: متنوّع').replace('ai:balanced', 'كمبيوتر: متوازن').replace('ai:', 'كمبيوتر: '))}</div>
      <div class="box"><h3>التآزر</h3>${tbl(d.synergies, (k) => SYNERGIES[k] ? SYNERGIES[k].name : k)}</div>
      <div class="box" style="grid-column:1/-1"><h3>الوحدات (استخدام ونسبة فوز)</h3>${tbl(d.units, (k) => UNITS[k] ? UNITS[k].name : k, true)}</div>
      <div class="box" style="grid-column:1/-1"><h3>آخر المباريات</h3>${recent ? `<table><tr><th>الوقت</th><th>النمط</th><th>الأبطال</th><th>الفائز</th><th>جولات</th><th>المدة</th></tr>${recent}</table>` : '<p class="hint">—</p>'}</div>`;
  }

  function renderCodex() {
    if (AMB.AlbumUI) { AMB.AlbumUI.render(); return; }
    const f = S.codexF;
    const fb = (kind, id, name) => `<button class="btn small ${f[kind] === id ? 'on' : ''}" data-act="codexF" data-k="${kind}" data-v="${id}">${name}</button>`;
    const units = Object.values(UNITS).filter((u) => (!f.world || u.world === f.world) && (!f.role || u.role === f.role)).sort((a, b) => a.tier - b.tier);
    $('codex').innerHTML = `
      <h3>الأبطال</h3>
      <div class="codex-grid">${Object.values(HEROES).map((h) => cardHTML(h, { k: 'cx', attrs: `data-act="heroInfo" data-id="${h.id}"` })).join('')}</div>
      <h3>الوحدات (${units.length})</h3>
      <div class="filters">${fb('world', '', 'كل العوالم')}${Object.values(WORLDS).map((w) => fb('world', w.id, w.name)).join('')}</div>
      <div class="filters">${fb('role', '', 'كل الأدوار')}${Object.values(ROLES).map((r) => fb('role', r.id, r.name)).join('')}</div>
      <div class="codex-grid">${units.map((d) => cardHTML(d, { k: 'cu', attrs: `data-act="detail" data-id="${d.id}"` })).join('')}</div>
      <h3>المعدات والتعاويذ</h3>
      <div class="codex-grid">${Object.values(ITEMS).map((it) => itemCardHTML(it)).join('')}</div>`;
  }

  // ======================================================================= input
  function clickSlot(slot) {
    const m = S.match, p = me(), v = S.v;
    const occ = p.board[slot];
    const heroHere = p.summoned && p.heroSlot === slot;
    const sel = S.sel;
    if (sel && sel.kind === 'item') {
      if (occ && res(m.equip(v, sel.idx, occ.uid))) { toast('جهّزتها', 'good'); S.sel = null; }
      else if (!occ) toast('اختر وحدة تجهّزها', 'err');
    } else if (sel && sel.kind === 'unit') {
      if (occ && occ.uid === sel.uid) S.sel = null;
      else if (res(m.move(v, sel.uid, { zone: 'board', slot }))) S.sel = null;
    } else if (sel && sel.kind === 'hero') {
      if (!heroHere) res(m.moveHero(v, slot));
      S.sel = null;
    } else if (occ) S.sel = { kind: 'unit', uid: occ.uid };
    else if (heroHere) S.sel = { kind: 'hero' };
    renderMatch();
  }

  function clickBench(idx) {
    const m = S.match, p = me(), v = S.v;
    const occ = p.bench[idx];
    const sel = S.sel;
    if (sel && sel.kind === 'item') {
      if (occ && res(m.equip(v, sel.idx, occ.uid))) { toast('جهّزتها', 'good'); S.sel = null; }
    } else if (sel && sel.kind === 'unit') {
      if (occ && occ.uid === sel.uid) S.sel = null;
      else if (res(m.move(v, sel.uid, { zone: 'bench', idx }))) S.sel = null;
    } else if (sel && sel.kind === 'hero') {
      toast('لإعادة البطل استخدم زر "إعادة البطل إلى مركز القيادة"', 'err'); S.sel = null;
    } else if (occ) S.sel = { kind: 'unit', uid: occ.uid };
    renderMatch();
  }

  const prepActive = () => S.screen === 'match' && (S.phase === 'prep' || S.phase === 'resources');

  const ACT = {
    go: (d) => { if (S.net && S.screen === 'hero') AMB.NetUI.leave(); show(d.to); if (d.to === 'stats') renderStats(); if (d.to === 'codex') renderCodex(); },
    howto: () => howto(true),   // senior #36: the written rules first; the guided match is one button inside
    tutReplay: () => { closeModal(); if (AMB.TutorialUI) AMB.TutorialUI.start({ replay: true }); },
    rules: () => howto(),   // inside a match: just the rules text (never restarts the tutorial / throws the match away)
    tutorial: () => showTutorial(),
    diff: (d) => { S.difficulty = d.v; document.querySelectorAll('#diff-seg button').forEach((b) => b.classList.toggle('on', b.dataset.v === d.v)); },
    mode: (d) => { S.mode = d.v; S.challenge = null; S.picks = [null, null]; S.pickIdx = 0; renderHeroSelect(); show('hero'); },
    pickHero: (d, el, e) => {
      if (e.target.closest('[data-act="heroInfo"], [data-act="heroTry"]')) return;
      if (S.mode === 'online' && AMB.NetUI && AMB.NetUI.usedInSeries(d.id)) { toast('لعبت بهالبطل في السلسلة، اختر غيره', 'err'); return; }
      if (heroLocked(d.id)) { toast('هالبطل مقفل: تفتحه لما تخلّص مستواه في الحملة بالثلاث صعوبات', 'err'); return; }
      S.picks[S.pickIdx] = d.id; renderHeroSelect();
    },
    heroInfo: (d, el, e) => { e.stopPropagation(); heroDetail(d.id); },
    heroTry: (d, el, e) => { if (e) e.stopPropagation(); if (!HEROES[d.id]) return; startPractice(d.id, S.screen === 'campaign' ? 'campaign' : 'hero'); },
    practiceBack: () => endPractice(),
    heroConfirm: () => {
      if (!S.picks[S.pickIdx] || heroLocked(S.picks[S.pickIdx])) return;
      if (starterPick()) {   // one-time starter choice, then continue to the match as usual
        if (!AMB.collection.chooseStarter(S.picks[0])) return;
        sfx('merge'); toast(`${HEROES[S.picks[0]].name} صار بطلك! الباقين تفتحهم من الحملة`, 'good');
        renderHeroSelect(); return;
      }
      if (S.mode === 'hotseat' && S.pickIdx === 0) { S.pickIdx = 1; renderHeroSelect(); return; }
      if (S.mode === 'online') { AMB.NetUI.heroChosen(S.picks[0]); return; }
      startMatch();
    },
    handoffGo: (d) => beginPrep(+d.pi),
    slot: (d) => prepActive() && clickSlot(d.slot),
    bench: (d) => prepActive() && clickBench(+d.idx),
    buy: (d, el, e) => {
      if (!prepActive() || e.target.closest('[data-act="detail"]')) return;
      const m0 = S.match;
      const r = S.match.buy(S.v, +d.idx);
      S.pop = null;
      if (res(r)) {
        sfx('buy');
        if (r.merged && r.merged.length) {
          mergeFx(r.merged[r.merged.length - 1].uid, r.merged);
        } else {
          S.pop = { uid: r.unit.uid };
          if (S.mode !== 'tutorial' && autoPlace(r.unit.uid)) { if (!S._autoHint) { S._autoHint = 1; toast('نزلت الوحدة الساحة تلقائي. اسحبها أو اضغطها لتغيير مكانها', 'good'); } }
          const have = m0.allUnits(m0.players[S.v]).filter((x) => x.defId === r.unit.defId && x.star === 1).length;
          if (have === 2) toast(`عندك نسختين من «${UNITS[r.unit.defId].name}»: اشتر ثالثة وتتطور ★ لحالها`, 'good');
        }
      }
      renderMatch();
      if (S.pop) {
        const pe = document.querySelector(`[data-drag="unit:${S.pop.uid}"]`);
        if (pe) { if (S.pop.merged) { burst(pe, '#ffd24a', 26, { r: 60, s: 7 }); burst(pe, '#ffffff', 10, { r: 40 }); banner(`${icon('star')}${icon('up')}`, 'merge'); } else burst(pe, '#ffffff', 6, { r: 26 }); }
        setTimeout(() => { S.pop = null; }, 800);
      }
      mergePickIfAny();
    },
    buyFromUpg: (d) => { const r = S.match.buy(S.v, +d.idx); if (res(r) && r.merged && r.merged.length) mergeFx(r.merged[r.merged.length - 1].uid, r.merged); renderMatch(); if (me().mergePick) mergePickIfAny(); else upgradesModal(); },
    buyItem: (d) => { if (prepActive() && res(S.match.buyItem(S.v, +d.idx))) renderMatch(); },
    reroll: () => { if (prepActive() && res(S.match.reroll(S.v))) { sfx('reroll'); renderMatch(); } },
    rotate: () => rotateScreen(),
    sound: () => { SND.on = !SND.on; try { localStorage.setItem('amb_sound', SND.on ? '1' : '0'); } catch (e) { /* ignore */ } if (SND.on) sfx('click'); document.querySelectorAll('[data-act="sound"]').forEach((b) => { if (b.id === 'menu-sound') b.querySelector('.mt-ic').textContent = SND.on ? '🔊' : '🔇'; else b.textContent = SND.on ? '🔊' : '🔇'; }); },
    xp: () => {
      if (!prepActive()) return;
      const lv = me().level;
      if (!res(S.match.upgradeShop(S.v))) return;
      sfx('levelup'); const nl = me().level;
      S.lvFx = nl; renderMatch(); S.lvFx = 0;
      toast(`المتجر صار مستوى ${nl}: تظهر فيه بطاقات حتى ${'★'.repeat(nl)} · الساحة ${S.match.boardCap(me())} وحدات`, 'good');
      const btn = document.querySelector('.dock-hero') || document.querySelector('.shop-dock');
      if (btn) { burst(btn, '#ffd24a', 22, { r: 70, s: 7, up: true }); burst(btn, '#ffffff', 10, { r: 40 }); }
      banner(`${icon('crown')} ${nl}`, 'merge');
      const fl = document.createElement('div'); fl.className = 'lv-flash'; document.body.appendChild(fl); setTimeout(() => fl.remove(), 900);
    },
    pickMerge: (d) => {
      const r = S.match.claimMerge(S.v, +d.idx);
      if (!res(r)) return;
      closeModal(); sfx('buy');
      toast(`أخذت «${UNITS[r.defId].name}» ${'★'.repeat(UNITS[r.defId].tier)} هدية الدمج`, 'good');
      if (r.merged && r.merged.length) mergeFx(r.merged[r.merged.length - 1].uid, r.merged);
      renderMatch(); mergePickIfAny();
    },
    lock: () => { if (prepActive()) { S.match.toggleLock(S.v); renderMatch(); } },
    ready: () => {
      if (!prepActive()) return;
      if (me().mergePick) { mergePickIfAny(); return; }   // pick the merge gift first
      // a new player's most common mistake: pressing "ready" with gold still in the pocket
      const m = S.match, p = me();
      if (S.mode !== 'tutorial' && S.mode !== 'hotseat' && S.warnedRound !== m.round + ':' + S.v) {
        const can = (p.shop || []).filter((c) => c && UNITS[c] && p.gold >= UNITS[c].cost).length;
        if (p.gold >= 3 && can && p.bench.some((x) => !x) ) {
          S.warnedRound = m.round + ':' + S.v;
          modal(`<h2>💰 عندك ذهب!</h2><p class="hint">معك <b>${p.gold}</b> ذهب. اشترِ بطاقة من المتجر وحطها في الساحة، فريقك يصير أقوى.</p>
            <div style="display:flex;gap:8px;justify-content:center;margin-top:12px"><button class="btn primary big" data-act="closeModal">أرجع أشتري</button><button class="btn" data-act="readyForce">ابدأ القتال</button></div>`);
          return;
        }
      }
      endPrep();
    },
    readyForce: () => { closeModal(); if (prepActive()) endPrep(); },
    deselect: () => { S.sel = null; renderMatch(); },
    autoArrange: () => { if (!prepActive()) return; S.match.autoArrange(S.v); S.sel = null; toast('رتبت لك أقوى وحداتك: الحراس قدّام والباقي ورا', 'good'); renderMatch(); },
    toBench: () => {
      const m = S.match, p = me(); if (!S.sel || S.sel.kind !== 'unit') return;
      const bi = p.bench.indexOf(null); if (bi < 0) { toast('الاحتياط ممتلئ: بع وحدة أو بدّل معها', 'err'); return; }
      if (res(m.move(S.v, S.sel.uid, { zone: 'bench', idx: bi }))) { S.sel = null; renderMatch(); }
    },
    toBoard: () => {
      const m = S.match, p = me(); if (!S.sel || S.sel.kind !== 'unit') return;
      const u = m.findUnit(p, S.sel.uid); if (!u) return;
      const sd = ROLES[UNITS[u.defId].role].side, F = ['f1', 'f2', 'f0', 'f3'], B = ['b1', 'b2', 'b0', 'b3'];
      const order = (sd === 'back' ? B.concat(F) : sd === 'front' ? F.concat(B) : F.concat(B)).filter((x) => !p.board[x] && !(p.summoned && p.heroSlot === x));
      if (!order.length || Object.keys(p.board).length >= S.match.boardCap(p)) { toast(`الساحة ممتلئة (${S.match.boardCap(p)}/${S.match.boardCap(p)}). اضغط وحدة في الساحة تبدّل معها، أو بع وحدة، أو رقِّ المتجر`, 'err'); return; }
      if (res(m.move(S.v, u.uid, { zone: 'board', slot: order[0] }))) { S.sel = null; renderMatch(); }
    },
    sell: () => { if (prepActive() && S.sel && S.sel.kind === 'unit' && res(S.match.sell(S.v, S.sel.uid))) { S.sel = null; renderMatch(); } },
    unequip: () => { if (S.sel && S.sel.kind === 'unit' && res(S.match.unequip(S.v, S.sel.uid))) renderMatch(); },
    bagSel: (d) => { if (!prepActive()) return; const i = +d.idx; S.sel = S.sel && S.sel.kind === 'item' && S.sel.idx === i ? null : { kind: 'item', idx: i }; renderMatch(); },
    arm: () => { if (S.sel && S.sel.kind === 'item' && res(S.match.armSpell(S.v, S.sel.idx))) { S.sel = null; toast('التعويذة جاهزة للقتال الجاي', 'good'); renderMatch(); } },
    disarm: (d) => { if (prepActive() && res(S.match.disarmSpell(S.v, +d.idx))) renderMatch(); },
    sellItem: () => { if (S.sel && S.sel.kind === 'item' && res(S.match.sellItem(S.v, S.sel.idx))) { S.sel = null; renderMatch(); } },
    // teen #13: scout the opponent before pressing ready, and choose what your assassins hunt
    scout: () => {
      const m = S.match, v = S.v, o = m.players[1 - v], me0 = m.players[v], last = m.history[m.history.length - 1];
      const lp = last ? last.players[1 - v] : null;
      const syn = lp && lp.synergies.length ? lp.synergies.map((id) => SYNERGIES[id].name).join('، ') : '—';
      const hunt = me0.hunt || 'back';
      modal(`<h2>🔍 ${esc(o.name)}</h2>
        <div class="kv"><span>مستوى المتجر</span><b>${o.level}</b></div>
        <div class="kv"><span>ذهبه الحين</span><b>${o.gold}</b></div>
        <div class="kv"><span>تآزره الجولة اللي فاتت</span><b>${syn}</b></div>
        <div class="kv"><span>بطله الجولة اللي فاتت</span><b>${lp ? (lp.summoned ? '👑 نزل الساحة' : 'ما نزل') : '—'}</b></div>
        ${o.wager ? '<div class="kv"><span>رهان الحسم</span><b>🎲 راهن</b></div>' : ''}
        <h3 style="margin-top:12px">قتلتك يصطادون</h3>
        <div class="seg"><button class="${hunt === 'back' ? 'on' : ''}" data-act="hunt" data-v="back">الصف الخلفي</button><button class="${hunt === 'weak' ? 'on' : ''}" data-act="hunt" data-v="weak">الأضعف</button></div>
        <p class="hint">💡 لو بطله ينزل بدري، «شبكة الصدع» من متجر المعدات تخلي فريقك كله يضربه.</p>`);
    },
    hunt: (d) => { if (!prepActive()) return; if (res(S.match.setHunt(S.v, d.v))) { toast(d.v === 'weak' ? 'القتلة يصطادون الأضعف' : 'القتلة يصطادون الصف الخلفي', 'good'); ACT.scout(); } },
    shareRes: () => { const t = S.shareText || 'ZOR'; try { if (navigator.share) { navigator.share({ text: t }).catch(() => {}); return; } } catch (e) { /* ignore */ } try { navigator.clipboard.writeText(t); toast('نسخت النص 📋 الصقه لصاحبك', 'good'); } catch (e) { toast(t); } },
    settings: () => settingsModal(),
    // adult #27: one gift box: claim every ready reward (login, pass levels, missions, album, campaign star chests) in one tap
    dayGoals: () => {
      const PS = AMB.pass; if (!PS) return;
      const list = PS.carriedMissions().filter((x) => !x.claimed).concat(PS.dailyMissions());
      modal(`<h2>🎯 أهداف اليوم</h2>${list.map((x) => `<div class="dg-m ${x.done ? 'done' : ''} ${x.claimed ? 'claimed' : ''}"><span>${x.carry ? '⏳ من أمس: ' : ''}${esc(x.name)}<small> · +${x.xp} خبرة${x.shards ? ` · ${x.shards}💎` : ''}</small></span><b><bdi dir="ltr">${x.claimed ? '✓' : `${x.progress}/${x.target}`}</bdi></b>${x.done && !x.claimed ? `<button class="btn small primary" data-act="dgClaim" data-id="${x.id}">استلم</button>` : !x.done && !x.carry && PS.canSwap() ? `<button class="dg-sw" data-act="dgSwap" data-id="${x.id}" aria-label="بدّل المهمة">↻ بدّل</button>` : ''}</div>`).join('')}
        <p class="hint">تقدر تبدّل مهمة وحدة كل يوم. والمهام اللي خلصتها وما استلمتها تنتظرك يوم زيادة.</p>`);
    },
    dgClaim: (d) => { const r = AMB.pass && AMB.pass.claimMission(d.id); if (r) { sfx('merge'); toast(`+${r.xp} خبرة${r.shards ? ` · +${r.shards} 💎` : ''}`, 'good'); fillMenu(); if (AMB.PassUI && AMB.PassUI.refreshMenu) AMB.PassUI.refreshMenu(); ACT.dayGoals(); } },
    dgSwap: (d) => { const r = AMB.pass && AMB.pass.swapMission(d.id); if (r) { toast(`↻ مهمة جديدة: ${r.name}`, 'good'); fillMenu(); ACT.dayGoals(); } else toast('التبديل مرة وحدة باليوم', 'err'); },
    takeChallenge: () => { const ch = S.pendingChallenge; if (!ch) return; closeModal(); S.mode = 'ai'; S.challenge = ch; S.pickIdx = 0; startMatch(); },
    undo: () => {
      if (!prepActive() || !S.undo || !S.undo.length) { toast('ما فيه حركة ترجع لها', ''); return; }
      const u0 = S.undo.pop(); S.match.restore(0, u0.snap); if (S.rs && S.rs.rec && u0.recLen >= 0) S.rs.rec.trim(u0.recLen);   // the saved moves go back to the same point as the board
      S.sel = null; sfx('click'); toast('↶ رجعت آخر حركة', ''); renderMatch();
    },
    inboxAll: () => {
      const got = []; let shards = 0;
      try { if (AMB.login && AMB.login.canClaim()) { const r = AMB.login.claim(); if (r) got.push('الدخول اليومي'); } } catch (e) { /* ignore */ }
      try { if (AMB.pass) { const l = AMB.pass.claimAll(); if (l.length) got.push(`${l.length} من الممر`); AMB.pass.dailyMissions().concat(AMB.pass.weeklyMissions(), AMB.pass.carriedMissions()).forEach((m) => { if (m.done && !m.claimed) { const r = AMB.pass.claimMission(m.id); if (r) { shards += r.shards; got.push('مهمة'); } } }); } } catch (e) { /* ignore */ }
      try { if (AMB.album) AMB.album.worlds().concat(['heroes', 'exclusive']).forEach((k) => { const r = AMB.album.claimPage(k); if (r) { shards += r.shards; got.push('الألبوم'); } }); } catch (e) { /* ignore */ }
      try { if (AMB.campaign) ['easy', 'normal', 'hard'].forEach((d) => AMB.campaign.chests(d).filter((c) => c.state === 'ready').forEach((c) => { const r = AMB.campaign.claimChest(c.id, d); if (r) got.push('صندوق نجوم'); })); } catch (e) { /* ignore */ }
      if (!got.length) { toast('ما فيه جوائز جاهزة الحين', ''); return; }
      sfx('merge'); toast(`🎁 استلمت: ${[...new Set(got)].join('، ')}${shards ? ` · +${shards} 💎` : ''}`, 'good');
      ['PacksUI', 'PassUI', 'CampaignUI', 'CollectionUI', 'AlbumUI', 'DailyUI'].forEach((k) => AMB[k] && AMB[k].refreshMenu && AMB[k].refreshMenu()); fillMenu();
    },
    setOpt: (d) => { const ST = AMB.settings; if (!ST) return; if (d.k === 'textSize') ST.setTextSize(+d.v); else ST.set(d.k, d.v === 'true' ? true : d.v === 'false' ? false : isNaN(+d.v) ? d.v : +d.v); applyComfort(); sfx('click'); settingsModal(); },
    bigAsk: (d) => { const ST = AMB.settings; if (ST) { ST.markSeen('askBig'); if (d.v === '1') ST.setTextSize(1); applyComfort(); } closeModal(); },
    shopToggle: () => { S.shopOpen = !S.shopOpen; sfx('click'); renderShop(); },
    resumeMatch: () => resumeMatch(),
    resumeDrop: () => { resumeClear(); fillMenu(); },
    wager: () => { if (!prepActive()) return; const p = me(); if (res(S.match.setWager(S.v, !p.wager))) { toast(p.wager ? '🎲 راهنت: الخاسر في الحسم يخسر أكثر' : 'لغيت الرهان', p.wager ? 'good' : ''); renderMatch(); } },
    summon: () => { if (prepActive() && res(S.match.toggleSummon(S.v))) { S.sel = null; toast(me().summoned ? 'البطل نزل الساحة' : 'البطل رجع لمركزه', 'good'); renderMatch();
      // kid #5: the very first summon gets a short entrance line
      const ST = AMB.settings; if (me().summoned && ST && !ST.seen('firstSummon')) { ST.markSeen('firstSummon'); try { abilityBurst('أنا جاهز! 👑', S.v, WORLDS[HEROES[me().heroId].world].color); } catch (e) { /* ignore */ } } } },
    detail: (d, el, e) => { e.stopPropagation(); unitDetail(d.id, d.star ? +d.star : 0); },
    upgrades: () => upgradesModal(),
    more: () => { document.body.classList.toggle('more-open'); sfx('click'); },
    closeModal: () => { closeModal(); if (S._resumeAfterMenu) { ACT.resumeMenu(); } },
    pause: () => {
      if (S.mode === 'online') { toast('ما يصير توقف وأنت تلعب مع صاحبك', 'err'); return; }
      if (S.phase === 'prep') {
        if (!S.paused) { S.paused = true; S.pausedLeft = S.deadline - Date.now(); }
        else { S.paused = false; S.deadline = Date.now() + S.pausedLeft; }
      } else if (S.phase === 'combat') S.paused = !S.paused;
      renderTop();
    },
    panels: () => { S.panels = !S.panels; $('scr-match').classList.toggle('show-panels', S.panels); renderTop(); },
    // your hero in the bottom dock: opens the abilities layer where the phone has one (portrait), otherwise the hero card
    heroDock: () => { if (matchMedia('(max-width: 860px) and (orientation: portrait)').matches) ACT.panels(); else heroDetail(me().heroId); },
    menuMatch: () => matchMenu(),
    resumeMenu: () => {
      closeModal();
      if (S._resumeAfterMenu) { S.paused = false; if (S.phase === 'prep') S.deadline = Date.now() + (S.pausedLeft != null ? S.pausedLeft : prepSeconds() * 1000); }   // menu opened during the 0.9s 'resources' phase: prep starts fresh instead of ending at once
      S._resumeAfterMenu = false;
      renderTop();
    },
    surrender: () => {
      const m = S.match;
      if (S.net) AMB.NetUI.leave();
      closeModal(); S._resumeAfterMenu = false; S.paused = false;
      cancelAnimationFrame(S.raf);
      m.winner = 1 - S.v; m.phase = 'over'; m.endedAt = Date.now();
      me().life = 0;
      showResults();
    },
    abandon: () => { if (S.mode === 'practice') { endPractice(); return; } if (S.mode === 'ai') resumeClear(); if (S.net) AMB.NetUI.leave(); closeModal(); closeOverlay(); S._resumeAfterMenu = false; S.paused = false; cancelAnimationFrame(S.raf); S.phase = 'idle'; S.match = null; show('menu'); },
    speed: (d) => { S.speed = +d.v; if (AMB.settings) AMB.settings.setSpeed(S.speed); renderCombatCtrl(); },
    skip: () => skipCombat(),
    nextRound: () => { closeOverlay(); if (S.match.isOver) showResults(); else nextRound(); },
    rewards: () => {
      const m = S.match; closeOverlay();
      if (S.mode === 'hotseat') { S.rewardQueue = [1]; rewardHandoff(0); }
      else { S.rewardQueue = []; showRewards(mySeat()); }
    },
    rewardGo: (d) => showRewards(+d.pi),
    claimReward: (d) => {
      const m = S.match, pi = S.rewardFor, r = m.claimReward(pi, +d.idx);
      if (!r.ok) { toast(r.reason, 'err'); return; }
      sfx('merge');
      let msg = 'استلمت: ' + r.text; if (r.item) msg += ' — ' + AMB.DATA.ITEMS[r.item].name;
      if (S.mode !== 'hotseat') toast(msg, 'good');   // same-device: the other player must not see this choice
      if (S.mode === 'online') { AMB.NetUI.rewardClaimed(); return; }
      if (S.mode !== 'hotseat') { const a = AMB.AI.claimReward(m, 1); if (a && a.ok) setTimeout(() => toast('الخصم اختار: ' + AMB.DATA.REWARDS[a.id].name, ''), 700); }
      afterReward();
    },
    toResults: () => showResults(),
    abTrig: (d) => { if (!prepActive()) return; const cur = S.match.players[S.v].abilities[d.ab]; if (cur !== d.t && ABILITY_TRIGGERS[d.t]) toast('⏵ ' + ABILITY_TRIGGERS[d.t].name); res(S.match.setAbility(S.v, d.ab, cur === d.t ? null : d.t)); renderMatch(); },
    info: (d, el, e) => { if (e) e.stopPropagation(); if (d.k === 'hero') { heroDetail(d.id); return; } const t = AMB.TIPS[d.k]; if (!t) return; const x = t(); modal(`<h2>${x.title}</h2><div class="tip-body">${x.html}</div>`); },
    again: () => { if (S.mode === 'online') { if (S.net) AMB.NetUI.leave(); show('menu'); return; } if (S.mode === 'tutorial') { AMB.TutorialUI.start(); return; } if (S.mode === 'practice') { startMatch(); return; } if (S.mode === 'campaign' || S.mode === 'tower' || S.mode === 'event') { startMatch(); return; } S.picks = [S.picks[0], S.picks[1]]; S.pickIdx = 0; renderHeroSelect(); show('hero'); },
    statsExport: () => {
      const blob = new Blob([JSON.stringify(AMB.telemetry.load(), null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'multiverse-telemetry.json'; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    },
    statsReset: () => { if (confirm('تبي تمسح كل الإحصائيات؟')) { AMB.telemetry.reset(); renderStats(); } },
    codexF: (d) => { S.codexF[d.k] = d.v; renderCodex(); },
  };

  document.addEventListener('click', (e) => {
    if (e.target.closest && e.target.closest('.btn') && !e.target.closest('[data-act="sound"]')) sfx('click');
    if (e.target === $('modal-back')) { ACT.closeModal(); return; }
    const el = e.target.closest('[data-act]');
    if (!el) { if (S.sel && S.screen === 'match' && !e.target.closest('.panel,.shopbar,.field,.bench-row,.modal')) { S.sel = null; renderMatch(); } return; }
    const fn = ACT[el.dataset.act];
    if (fn) { try { fn(el.dataset, el, e); } catch (err) { reportErr(err); } }
  });
  document.addEventListener('change', (e) => {
    const sel = e.target.closest('select[data-ab]');
    if (sel && prepActive()) { res(S.match.setAbility(S.v, sel.dataset.ab, sel.value || null)); renderMatch(); }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { if ($('modal-back').classList.contains('on')) ACT.closeModal(); else if (S.sel) { S.sel = null; if (S.match) renderMatch(); } return; }
    if (!prepActive() || $('modal-back').classList.contains('on') || $('overlay').classList.contains('on')) return;
    if (e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT') return;
    const k = e.key.toLowerCase();
    if (k === 'd') ACT.reroll();
    else if (k === 'f') ACT.xp();
    else if (k === 'e') ACT.sell();
    else if (e.key === 'Enter') { e.preventDefault(); ACT.ready(); }
  });

  // drag & drop (desktop); click-to-move works everywhere
  document.addEventListener('dragstart', (e) => {
    const el = e.target.closest('[data-drag]');
    if (!el || !prepActive()) { e.preventDefault(); return; }
    const v = el.dataset.drag;
    S.sel = v === 'hero' ? { kind: 'hero' } : { kind: 'unit', uid: v.slice(5) };
    e.dataTransfer.setData('text/plain', v);
    e.dataTransfer.effectAllowed = 'move';
  });
  document.addEventListener('dragover', (e) => {
    const t = e.target.closest('[data-drop], .shopbar');
    if (t && prepActive()) { e.preventDefault(); t.classList.add('drop'); }
  });
  document.addEventListener('dragleave', (e) => { const t = e.target.closest('[data-drop], .shopbar'); if (t) t.classList.remove('drop'); });
  document.addEventListener('drop', (e) => {
    const t = e.target.closest('[data-drop], .shopbar');
    if (!t || !prepActive()) return;
    e.preventDefault();
    t.classList.remove('drop');
    if (t.classList.contains('shopbar')) { if (S.sel && S.sel.kind === 'unit') ACT.sell(); return; }
    const [zone, key] = t.dataset.drop.split(':');
    if (zone === 'board') clickSlot(key); else clickBench(+key);
  });

  // touch drag (phones/tablets): hold a board/bench card, move it, drop it on a cell, the bench, or the shop to sell
  let TD = null;
  document.addEventListener('click', (e) => { if (S.noClick) { e.stopPropagation(); e.preventDefault(); } }, true);
  document.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' || !prepActive()) return;
    const el = e.target.closest('[data-drag]');
    if (el) TD = { el, id: e.pointerId, x: e.clientX, y: e.clientY, v: el.dataset.drag, ghost: null, started: false };
  });
  const dropTarget = (x, y) => { const t = document.elementFromPoint(x, y); return t ? t.closest('[data-drop], .shopbar') : null; };
  document.addEventListener('pointermove', (e) => {
    if (!TD || e.pointerId !== TD.id) return;
    if (!TD.started) {
      if (Math.hypot(e.clientX - TD.x, e.clientY - TD.y) < 10) return;
      TD.started = true;
      S.sel = TD.v === 'hero' ? { kind: 'hero' } : { kind: 'unit', uid: TD.v.slice(5) };
      const r = TD.el.getBoundingClientRect();
      TD.w = r.width; TD.h = r.height;
      TD.ghost = TD.el.cloneNode(true);
      TD.ghost.removeAttribute('data-drag'); TD.ghost.removeAttribute('draggable');
      Object.assign(TD.ghost.style, { position: 'fixed', width: r.width + 'px', height: r.height + 'px', zIndex: 60, pointerEvents: 'none', opacity: '.9', transform: 'scale(1.15)', filter: 'drop-shadow(0 6px 8px #000a)' });
      TD.ghost.classList.add('drag-ghost');
      document.body.appendChild(TD.ghost);
      TD.el.style.opacity = '.3';
      try { document.body.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }   // keep receiving moves/up even if the card is re-rendered
    }
    TD.lx = e.clientX; TD.ly = e.clientY;
    TD.ghost.style.left = e.clientX - TD.w / 2 + 'px';
    TD.ghost.style.top = e.clientY - TD.h * 0.8 + 'px';   // above the finger so it stays visible
    document.querySelectorAll('.drop').forEach((n) => n.classList.remove('drop'));
    const t = dropTarget(e.clientX, e.clientY); if (t) t.classList.add('drop');
  });
  // drop the dragged card where the finger is (cell / bench / shop = sell)
  function applyDrop(x, y) {
    const t = dropTarget(x, y);
    if (t && t.classList.contains('shopbar')) ACT.sell();
    else if (t && t.dataset.drop) { const [zone, key] = t.dataset.drop.split(':'); if (zone === 'board') clickSlot(key); else clickBench(+key); }
  }
  // time ran out mid-drag: put the card down where the finger is, then clean up
  function commitDrag() {
    if (TD && TD.started && TD.lx != null) { try { applyDrop(TD.lx, TD.ly); } catch (err) { /* ignore */ } S.sel = null; S.noClick = true; setTimeout(() => { S.noClick = false; }, 350); }
    cancelDrag();
  }
  // called whenever the screen changes under the finger (timer ends, combat starts, overlays)
  function cancelDrag() {
    if (TD) { if (TD.el) TD.el.style.opacity = ''; try { document.body.releasePointerCapture(TD.id); } catch (err) { /* ignore */ } TD = null; }
    document.querySelectorAll('.drag-ghost').forEach((n) => n.remove());
    document.querySelectorAll('.drop').forEach((n) => n.classList.remove('drop'));
  }
  const endTouch = (e, cancel) => {
    if (!TD || e.pointerId !== TD.id) { if (!TD) document.querySelectorAll('.drag-ghost').forEach((n) => n.remove()); return; }
    const d = TD; TD = null;
    try { document.body.releasePointerCapture(d.id); } catch (err) { /* ignore */ }
    if (!d.started) return;
    document.querySelectorAll('.drop').forEach((n) => n.classList.remove('drop'));
    d.ghost.remove(); d.el.style.opacity = '';
    S.noClick = true; setTimeout(() => { S.noClick = false; }, 350);
    if (!cancel) applyDrop(e.clientX, e.clientY);
    S.sel = null; renderMatch();
  };
  document.addEventListener('pointerup', (e) => endTouch(e, false));
  document.addEventListener('pointercancel', (e) => endTouch(e, true));

  // card tilt + glare under the mouse
  document.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const c = e.target.closest && e.target.closest('.tcard.hc.full:not(.empty)');
    if (S.tilt && S.tilt !== c) { S.tilt.style.removeProperty('--rx'); S.tilt.style.removeProperty('--ry'); S.tilt = null; }
    if (!c) return;
    const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    c.style.setProperty('--ry', (x - 0.5) * 18 + 'deg'); c.style.setProperty('--rx', (0.5 - y) * 18 + 'deg');
    c.style.setProperty('--gx', x * 100 + '%'); c.style.setProperty('--gy', y * 100 + '%');
    S.tilt = c;
  });
  // the main menu shows your hero big, on their world's colours
  function fillMenu() {
    const el = $('menu-heroes');
    if (el) {
      const A = globalThis.AMB, id = (A.collection && A.collection.starterHero && A.collection.starterHero()) || A.DATA.HERO_STARTERS[0], h = HEROES[id] || HEROES[A.DATA.HERO_STARTERS[0]];
      el.innerHTML = `<div class="mv2-hero">${portrait(h, { bare: true, k: 'mhero' })}</div>`;
      const bg = $('mv2-bg'), W = WORLDS[h.world];
      if (bg) { bg.className = 'mv2-bg' + (h.world === 'tide' ? ' tide' : ''); bg.style.setProperty('--wc', W.color); }
    }
    const ms = $('menu-sound'); if (ms) ms.querySelector('.mt-ic').textContent = SND.on ? '🔊' : '🔇';
    // adult #28: today's goals on the home screen (progress at a glance, one free swap a day)
    let dg = $('day-goals');
    if (!dg) { dg = document.createElement('div'); dg.id = 'day-goals'; const host1 = document.querySelector('#scr-menu .mv2') || document.querySelector('#scr-menu'); if (host1) host1.appendChild(dg); }
    try {
      const PS = AMB.pass; const list = PS ? PS.carriedMissions().filter((x) => !x.claimed).concat(PS.dailyMissions()) : [];
      const done = list.filter((x) => x.claimed || x.done).length, claim = list.some((x) => x.done && !x.claimed);
      dg.innerHTML = list.length ? `<button class="dg-pill ${claim ? 'has' : ''}" data-act="dayGoals" aria-label="أهداف اليوم">🎯 <bdi dir="ltr">${done}/${list.length}</bdi></button>` : '';
    } catch (e) { dg.innerHTML = ''; }
    // adult #27: the gift box on the menu
    let ib = $('inbox-btn');
    if (!ib) { ib = document.createElement('button'); ib.id = 'inbox-btn'; ib.dataset.act = 'inboxAll'; ib.setAttribute('aria-label', 'استلم كل الجوائز'); const host0 = document.querySelector('#scr-menu .mv2') || document.querySelector('#scr-menu'); if (host0) host0.appendChild(ib); }
    let ready = 0; try { ready = (AMB.login && AMB.login.canClaim() ? 1 : 0) + (AMB.pass ? AMB.pass.unclaimedCount() : 0) + (AMB.album ? AMB.album.readyCount() : 0) + (AMB.campaign ? ['easy', 'normal', 'hard'].reduce((n, d) => n + AMB.campaign.readyChests(d), 0) : 0); } catch (e) { ready = 0; }
    ib.innerHTML = `🎁${ready ? '<i></i>' : ''}`; ib.classList.toggle('has', !!ready);
    // adult #21: an unfinished quick match waits on the menu
    let rb = $('resume-card'); const sv = resumeSaved();
    if (sv && !rb) { rb = document.createElement('div'); rb.id = 'resume-card'; const host = document.querySelector('#scr-menu .mv2') || document.querySelector('#scr-menu'); if (host) host.appendChild(rb); }
    if (rb) rb.innerHTML = sv ? `<button class="btn primary" data-act="resumeMatch">▶ كمّل مباراتك (الجولة ${sv.rounds.length + 1} من ${CFG.match.maxRounds})</button><button class="btn ghost small" data-act="resumeDrop" aria-label="انسَ المباراة">✕</button>` : '';
  }
  fillMenu();
  setTimeout(() => { if (S.screen === 'menu') fillMenu(); }, 400);   // the pass/album load after this file: refresh the menu once they exist
  applyComfort();
  // adult #29: opened from a friend's challenge link: offer the same match
  (function challengeFromUrl() {
    let ch = null;
    try { const q = new URLSearchParams(location.search).get('ch'); if (q) ch = JSON.parse(decodeURIComponent(escape(atob(q)))); } catch (e) { ch = null; }
    if (!ch || !Number.isInteger(ch.s) || !HEROES[ch.h] || !HEROES[ch.a] || !CFG.ai[ch.d] || !Array.isArray(ch.r)) return;
    try { history.replaceState(history.state, '', location.pathname); } catch (e) { /* ignore */ }
    S.pendingChallenge = ch;
    setTimeout(() => modal(`<h2>⚔ تحدي من صاحبك</h2><p>صاحبك لعب بـ<b>${HEROES[ch.h].name}</b> ضد الكمبيوتر (${ch.d === 'expert' ? 'خبير' : ch.d === 'hard' ? 'صعب' : ch.d === 'easy' ? 'سهل' : 'عادي'}) وخلّص ${ch.r[0]}–${ch.r[1]}.</p><p class="hint">نفس البداية ونفس الكمبيوتر. أنت تلعبها بدون قوة بطاقات (صاحبك لعبها ببطاقاته). تقدر تغلبه؟</p><div class="net-btns"><button class="btn primary" data-act="takeChallenge">⚔ اقبل التحدي</button><button class="btn ghost" data-act="closeModal">بعدين</button></div>`), 900);
  })();
  setTimeout(() => { const ST = AMB.settings; if (ST && !ST.seen('askBig') && S.screen === 'menu' && !$('modal-back').classList.contains('on')) { ST.markSeen('askBig');
    modal(`<h2>🔠 تبي الخط أكبر؟</h2><p class="hint">تقدر تغيّره بعدين من «المزيد» ← «الإعدادات».</p><div class="net-btns"><button class="btn primary" data-act="bigAsk" data-v="1">إيه، كبّره</button><button class="btn ghost" data-act="bigAsk" data-v="0">لا، كذا زين</button></div>`); } }, 1500);
  // adult #21: leaving the app (call, notification) pauses the prep timer in every mode except online (the friend is waiting)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && S.screen === 'match' && S.phase === 'prep' && !S.paused && S.mode !== 'online') { S.paused = true; S.pausedLeft = S.deadline - Date.now(); S._hidPause = true; }
    else if (document.visibilityState === 'visible' && S._hidPause) { S._hidPause = false; if (S.paused && S.phase === 'prep') { S.paused = false; S.deadline = Date.now() + S.pausedLeft; renderTop(); } }
  });

  // phone back button: step back inside the game instead of leaving it
  (function backNav() {
    let armedAt = 0;
    try { history.replaceState({ zor: 0 }, ''); history.pushState({ zor: 1 }, ''); } catch (e) { return; }
    window.addEventListener('popstate', () => {
      let exiting = false;
      try {
        if ($('modal-back').classList.contains('on')) { ACT.closeModal(); }
        else if ($('overlay').classList.contains('on')) { closeOverlay(); }
        else if (document.body.classList.contains('more-open')) { document.body.classList.remove('more-open'); }
        else if (S.screen === 'match') { if (S.phase === 'over') show('menu'); else matchMenu(); }
        else if (S.screen !== 'menu') { show('menu'); }
        else if (Date.now() - armedAt < 2500) { exiting = true; }
        else { armedAt = Date.now(); toast('اضغط رجوع مرة ثانية للخروج'); }
      } catch (err) { reportErr(err); }
      if (exiting) { try { history.back(); } catch (e) { /* ignore */ } } else { try { history.pushState({ zor: 1 }, ''); } catch (e) { /* ignore */ } }
    });
  })();

  // accessibility: icon-only buttons get an accessible name (their title, or a known Arabic label by action)
  (function a11y() {
    const NAMES = { menuMatch: 'القائمة', pause: 'إيقاف مؤقت', closeModal: 'إغلاق', rotate: 'تدوير الشاشة', sound: 'الصوت', info: 'شرح', summon: 'نزّل البطل', tg: 'التالي' };
    const fix = (root) => (root.querySelectorAll ? root : document).querySelectorAll('button:not([aria-label])').forEach((b) => {
      const t = (b.textContent || '').trim(), name = b.getAttribute('title') || NAMES[b.dataset.act];
      if (name && (!t || t.length <= 2 || b.dataset.act === 'info')) b.setAttribute('aria-label', name);
    });
    try { fix(document); new MutationObserver((ms) => { let again = false; ms.forEach((m) => { if (m.addedNodes.length) again = true; }); if (again) fix(document); }).observe(document.body, { childList: true, subtree: true }); } catch (e) { /* ignore */ }
  })();

  // debug / testing hook
  globalThis.AMB_UI = { renderHeroSelect, heroPickHTML, startPractice, startCombat, afterReward, showResults, S, ACT, itemsHTML: () => Object.values(ITEMS).map((it) => itemCardHTML(it)).join(''), renderMatch, cardHTML, itemCardHTML, show, toast, sfx, burst, modal, closeModal, overlay, closeOverlay, startMatch, portrait, stars };
  globalThis.AMB_UI.abilityBurst = abilityBurst; globalThis.AMB_UI.lossTip = lossTip;   // UI v2 (match screens)
  if (AMB.PassUI) { AMB.PassUI.installActions(); AMB.PassUI.applyCosmetics(); AMB.PassUI.refreshMenu(); }
})();

;
/* ui/pass-ui.js */
/*
 * Battle pass screen ("ممر الصدع"): track, missions, profile; plus the cosmetics applied in the match UI.
 * Logic lives in core/pass.js. Progress is saved in this browser only.
 */
(function () {
  const AMB = globalThis.AMB;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const store = AMB.save.storageFor('pass');   // battle pass lives inside the unified save (core/save.js)
  // character rewards also give the card (unlock or +1 copy) — see core/collection.js
  const pass = (AMB.pass = AMB.Pass.create(store, null, (r, level, track) => {
    if (r.type === 'shards') { if (AMB.wallet) AMB.wallet.add('shards', r.n, 'mission'); return; }   // daily-mission shards
    if (r.shards && AMB.wallet) AMB.wallet.add('shards', r.shards, 'pass');   // some free-track levels also pay shards
    // adult #26: the premium track is cosmetic only: its characters are portraits (avatars) to show, never the card itself (no power for money)
    if (AMB.collection && track !== 'premium') AMB.collection.grantPassReward(r);
  }, (type) => (AMB.album ? AMB.album.ownedCosmetics(type) : [])));
  if (AMB.events) AMB.Pass.wire(pass, AMB.events);   // missions also count campaign fights, upgrades, packs and stars
  // rewards claimed before characters could be unlocked: make sure those characters are owned
  if (AMB.collection) ['free'].forEach((t) => (pass.state().claimed[t] || []).forEach((l) => { const r = pass.reward(l, t); if (r && r.type === 'avatar' && !AMB.collection.owned(r.id)) AMB.collection.grantPassReward(r); }));
  const P = AMB.Pass, C = P.COSMETICS, TYPE = pass.TYPE_NAME;
  const { icon, portrait } = AMB.art;
  const UI = () => globalThis.AMB_UI;
  let tab = 'track';

  const avatarDef = (id) => AMB.DATA.UNITS[id] || AMB.DATA.HEROES[id] || null;
  const SLOTS = [['title', 'اللقب'], ['frame', 'إطار البطل'], ['arena', 'ثيم الساحة'], ['fx', 'تأثير الفوز'], ['avatar', 'الصورة الرمزية']];

  // ---------------------------------------------------------------- where does an item come from?
  function source(type, id) {
    for (const [tr, tbl] of [['free', P.FREE], ['premium', P.PREMIUM]]) {
      for (const [lv, r] of Object.entries(tbl)) if (r.type === type && r.id === id) return { track: tr, level: +lv };
    }
    return null;
  }

  // ---------------------------------------------------------------- previews
  function preview(type, id, extra) {
    if (type === 'frame') { const f = C.frame[id] || {}; return `<span class="pv frame" style="--c1:${f.c1 || '#555'};--c2:${f.c2 || '#222'}">${icon('crown')}</span>`; }
    if (type === 'arena') return `<span class="pv arena ar-${id}"></span>`;
    if (type === 'fx') return `<span class="pv fxsw">${((C.fx[id] || {}).colors || []).map((c) => `<i style="background:${c}"></i>`).join('')}</span>`;
    if (type === 'title') return `<span class="pv title">${esc((C.title[id] || {}).name || id)}</span>`;
    if (type === 'perk') return `<span class="pv perk">${icon('wind')}<b>+${(extra && extra.sec) || 5}ث</b></span>`;
    if (type === 'avatar') { const d = avatarDef(id); return `<span class="pv avatar">${d ? portrait(d, { bare: true, k: 'pv' + id }) : ''}</span>`; }
    return '';
  }

  // ---------------------------------------------------------------- applied in the match UI
  function applyCosmetics() {
    const el = document.documentElement, f = pass.equipped('frame'), fr = C.frame[f];
    el.dataset.frame = f || 'default';
    if (fr && fr.c1) { el.style.setProperty('--frame-c1', fr.c1); el.style.setProperty('--frame-c2', fr.c2); }
  }
  const arenaClass = () => { const a = pass.equipped('arena'); return a && a !== 'default' ? 'ar-' + a : ''; };
  const fxColors = () => (C.fx[pass.equipped('fx')] || C.fx.default).colors;
  const avatarId = () => pass.equipped('avatar');
  const titleName = () => (C.title[pass.equipped('title')] || C.title.default).name;

  // ---------------------------------------------------------------- results panel (xp gained)
  function resultPanel(r) {
    if (!r) return '';
    if (r.mult === 0) return `<div class="xp-panel"><div class="xp-h"><b>ممر الصدع</b></div><p class="hint">المباراة الودية ما تعطي خبرة، جرّب «ضد الكمبيوتر» عشان تتقدم في الممر.</p></div>`;
    const lv = pass.level(), pct = pass.maxed() ? 100 : Math.round((100 * pass.xpInLevel()) / P.SEASON.xpPerLevel);
    const up = r.levelAfter > r.levelBefore;
    return `<div class="xp-panel"><div class="xp-h"><b>ممر الصدع</b><span class="xp-gain">+${r.xp} خبرة</span></div>
      ${r.ended ? '<p class="hint">انتهى الموسم، ما تنضاف خبرة جديدة.</p>' : ''}
      <ul class="xp-lines">${r.lines.map((l) => `<li><span>${l[0]}</span><b>+${l[1]}</b></li>`).join('')}</ul>
      <div class="xp-bar"><i style="width:${pct}%"></i></div>
      <div class="xp-lv">المستوى <b>${lv}</b>${up ? ` <span class="xp-up">ارتفعت من ${r.levelBefore} ← ${r.levelAfter} 🎉</span>` : ''}</div>
      ${pass.unclaimedCount() ? `<button class="btn primary" data-act="go" data-to="pass">عندك ${pass.unclaimedCount()} مكافأة أو مهمة جاهزة تستلمها</button>` : ''}</div>`;
  }

  function refreshMenu() {
    const b = $('menu-pass'); if (!b) return;
    const n = pass.unclaimedCount();
    (b.querySelector('.mt-l') || b).innerHTML = `ممر الصدع <small>${pass.level()}</small>${n ? `<span class="dot">${n}</span>` : ''}`;
  }

  // ---------------------------------------------------------------- tips (ⓘ)
  const ibtnP = (k) => `<button class="ibtn" data-act="info" data-k="${k}" title="شرح">ⓘ</button>`;
  AMB.TIPS = AMB.TIPS || {};
  AMB.TIPS.passinfo = () => ({ title: 'مكافآت الممر', html: '<p>كل المكافآت <b>للشكل بس</b> (ألقاب، إطارات، ثيمات، تأثيرات، صور)، والشخصيات تفتح بطاقاتها.</p><p>الوحيد المختلف «مؤقت التجهيز»: وقت زيادة تفكر فيه بس. <b>ما فيه شي يقوّي الوحدات.</b></p><p>المسار المميز للعرض بس الحين (قريب).</p>' });
  AMB.TIPS.missinfo = () => ({ title: 'المهام', html: '<p>مهام اليوم تعطي <b>خبرة ممر + شظايا</b> تشتري فيها باكجات.</p><p>تنحسب المباريات السريعة وعلى نفس الجهاز وقتالات الحملة، وتطوير البطاقات وفتح الباكجات. المباراة الودية ما تنحسب.</p>' });

  // ---------------------------------------------------------------- screen
  function cellHTML(level, track) {
    const r = pass.reward(level, track); if (!r) return '<div class="pcell empty"></div>';
    const claimed = pass.isClaimed(level, track), can = pass.canClaim(level, track), reached = level <= pass.level();
    const premLock = track === 'premium' && !pass.isPremium();
    const cls = claimed ? 'claimed' : can ? 'can' : premLock ? 'premlock' : reached ? '' : 'locked';
    const act = can ? 'passClaim' : claimed && r.type !== 'perk' ? 'passEquipReward' : premLock && reached ? 'passPremium' : '';
    return `<div class="pcell ${cls} ${r.big ? 'big' : ''}" ${act ? `data-act="${act}"` : ''} data-level="${level}" data-track="${track}" title="${esc((track === 'premium' && r.type === 'avatar' ? 'صورة رمزية (شكل بس)' : TYPE[r.type]) + ': ' + pass.rewardName(r))}">
      ${preview(r.type, r.id, r)}<span class="pc-name">${esc(pass.rewardName(r))}</span>
      <span class="pc-state">${claimed ? '✓' : can ? 'استلم' : premLock ? '🔒' : ''}</span></div>`;
  }

  function trackHTML() {
    const cols = [];
    for (let l = 1; l <= P.SEASON.levels; l++) {
      cols.push(`<div class="pcol ${l === pass.level() ? 'now' : ''} ${l <= pass.level() ? 'reached' : ''}" data-col="${l}"><div class="plv">${l}</div>${cellHTML(l, 'free')}</div>`);
    }
    const n = [];
    for (let l = 1; l <= pass.level(); l++) ['free', 'premium'].forEach((t) => { if (pass.canClaim(l, t)) n.push(1); });
    return `<div class="ptools"><button class="btn primary" data-act="passClaimAll" ${n.length ? '' : 'disabled'}>استلم الكل (${n.length})</button>
      ${ibtnP('passinfo')}</div>
      <div class="ptrack-wrap"><div class="prow-labels"><span></span><b>مجاني</b><b>بريميوم 🔒</b></div><div class="ptrack" id="ptrack">${cols.join('')}</div></div>`;
  }

  function missionHTML(m) {
    const pct = Math.round((m.progress / m.target) * 100);
    return `<div class="mission ${m.done ? 'done' : ''} ${m.claimed ? 'claimed' : ''}"><div class="m-top"><b>${esc(m.name)}</b><span class="m-xp">+${m.xp} خبرة${m.shards ? ` · ${icon('gem')} ${m.shards}` : ''}</span></div>
      <div class="xp-bar"><i style="width:${pct}%"></i></div>
      <div class="m-bot"><span>${m.progress.toLocaleString('en-US')} / ${m.target.toLocaleString('en-US')}</span>
      ${m.claimed ? '<span class="m-ok">✓ تم الاستلام</span>' : m.done ? `<button class="btn small primary" data-act="passClaimMission" data-id="${m.id}">استلم</button>` : '<span class="m-wait">جارية</span>'}</div></div>`;
  }
  function missionsHTML() {
    const d = new Date(), mid = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1), hrs = Math.max(1, Math.ceil((mid - d) / 3600000));
    return `<h3>مهام اليوم <small>تتجدد بعد ${hrs} ساعة</small></h3><div class="missions">${pass.dailyMissions().map(missionHTML).join('')}</div>
      <h3>مهام الأسبوع</h3><div class="missions">${pass.weeklyMissions().map(missionHTML).join('')}</div>
      <p class="hint">${ibtnP('missinfo')} المباراة الودية ما تنحسب</p>`;
  }

  function optionHTML(type, id) {
    const owned = pass.owned(type).includes(id), on = pass.equipped(type) === id;
    const src = source(type, id);
    const hint = owned ? '' : src ? `${src.track === 'premium' ? 'بريميوم' : 'مجاني'} · مستوى ${src.level}` : '—';
    const name = type === 'avatar' ? ((avatarDef(id) || {}).name || id) : ((C[type][id] || {}).name || id);
    return `<button class="opt ${on ? 'on' : ''} ${owned ? '' : 'locked'}" ${owned ? `data-act="passEquip" data-type="${type}" data-id="${id}"` : 'disabled'} title="${esc(name)}">
      ${preview(type, id)}<span class="o-name">${esc(name)}</span>${on ? '<span class="o-on">✓</span>' : ''}${hint ? `<span class="o-hint">${hint}</span>` : ''}</button>`;
  }
  function profileHTML() {
    const av = avatarId(), def = av ? avatarDef(av) : null;
    const prevHero = def ? portrait(def, { bare: true, k: 'prof' }) : `<span class="no-av">${icon('crown')}</span>`;
    const sections = SLOTS.map(([type, label]) => {
      let ids;
      if (type === 'avatar') { const all = Object.values(P.FREE).concat(Object.values(P.PREMIUM)).filter((r) => r.type === 'avatar').map((r) => r.id); ids = all; }
      else ids = Object.keys(C[type]);
      const noneOpt = type === 'avatar' ? `<button class="opt ${av ? '' : 'on'}" data-act="passEquip" data-type="avatar" data-id=""><span class="pv avatar none">${icon('crown')}</span><span class="o-name">بطلك الافتراضي</span>${av ? '' : '<span class="o-on">✓</span>'}</button>` : '';
      return `<h3>${label}</h3><div class="opts">${noneOpt}${ids.map((id) => optionHTML(type, id)).join('')}</div>`;
    }).join('');
    return `<div class="prof-card"><span class="prof-av">${prevHero}</span><div><b class="prof-title">${esc(titleName())}</b>
      ${pass.prepBonus() ? `<div class="hint">⏱ +${pass.prepBonus()} ث تجهيز</div>` : ''}</div></div>${sections}`;
  }

  function render() {
    const root = $('pass'); if (!root) return;
    const lv = pass.level(), pct = pass.maxed() ? 100 : Math.round((100 * pass.xpInLevel()) / P.SEASON.xpPerLevel);   // percent of the level, not raw XP
    const days = pass.daysLeft();
    // kid #10: no season countdown and no premium teaser until the player has finished the campaign's first level
    const fresh = !(AMB.campaign && AMB.campaign.isCleared('l1boss'));
    root.innerHTML = `<div class="pass-head"><div class="ph-lv"><small>المستوى</small><b>${lv}</b></div>
      <div class="ph-mid"><div class="ph-name">${P.SEASON.name}</div><div class="xp-bar big"><i style="width:${pct}%"></i></div>
        <div class="ph-sub">${pass.maxed() ? 'وصلت لأعلى مستوى 🎉' : `${pass.xpInLevel()} / ${P.SEASON.xpPerLevel} خبرة للمستوى ${lv + 1}`} ${fresh ? '' : ` · ${pass.ended() ? '<b style="color:var(--red)">انتهى الموسم</b>' : `باقي ${days} يوم`}`}</div>${(() => { const e = pass.etaDays && pass.etaDays(); return e == null || pass.maxed() || fresh ? '' : `<div class="ph-eta">⏱ بوتيرتك توصل المستوى ${P.SEASON.levels} بعد <b>${e}</b> يوم${e > days ? ' · العب شوي أكثر عشان تلحق الموسم' : ' ✓ تلحق قبل نهاية الموسم'}</div>`; })()}</div>
      ${fresh ? '' : `<button class="btn ph-prem" data-act="passPremium" title="مو متاح للحين">${pass.isPremium() ? '✓ بريميوم' : '👑 بريميوم · قريب'}</button>`}</div>
      <div class="ptabs">${[['track', 'المسار'], ['missions', 'المهام'], ['profile', 'ملفي']].map(([k, n]) => `<button class="${tab === k ? 'on' : ''}" data-act="passTab" data-v="${k}">${n}${k === 'missions' && pass.dailyMissions().concat(pass.weeklyMissions()).some((m) => m.done && !m.claimed) ? ' <span class="dot sm"></span>' : ''}</button>`).join('')}</div>
      <div class="pbody">${tab === 'track' ? trackHTML() : tab === 'missions' ? missionsHTML() : profileHTML()}</div>`;
    if (tab === 'track') { const tr = $('ptrack'); if (tr) { const col = tr.querySelector(`[data-col="${Math.max(1, lv - 1)}"]`); if (col) tr.scrollLeft = col.offsetLeft - 8; } }
    refreshMenu();
  }

  // ---------------------------------------------------------------- actions
  const toast = (m, k) => UI() && UI().toast(m, k);
  function after() { applyCosmetics(); render(); }
  function installActions() {
    const ACT = UI().ACT;
    Object.assign(ACT, {
      passTab: (d) => { tab = d.v; render(); },
      passClaim: (d) => {
        const lvl = +d.level, tr = d.track, r = pass.claim(lvl, tr);
        if (!r) return;
        UI().sfx('merge');
        if (r.type !== 'perk' && pass.equipped(r.type) === (r.type === 'avatar' ? null : 'default')) pass.equip(r.type, r.id);   // first item of a kind is equipped for you
        toast(`استلمت: ${pass.rewardName(r)} (${TYPE[r.type]})`, 'good'); after();
      },
      passClaimAll: () => {
        const got = pass.claimAll(); if (!got.length) return;
        got.forEach((g) => { const r = g.reward; if (r.type !== 'perk' && pass.equipped(r.type) === (r.type === 'avatar' ? null : 'default')) pass.equip(r.type, r.id); });
        UI().sfx('merge'); toast(`استلمت ${got.length} مكافأة`, 'good'); after();
      },
      passEquipReward: (d) => { const r = pass.reward(+d.level, d.track); if (r && pass.equip(r.type, r.id)) { UI().sfx('click'); toast(`جهّزت: ${pass.rewardName(r)}`, 'good'); after(); } },
      passEquip: (d) => { if (pass.equip(d.type, d.id === '' ? null : d.id)) { UI().sfx('click'); after(); } },
      passClaimMission: (d) => { const r = pass.claimMission(d.id); if (r) { UI().sfx('merge'); toast(`+${r.xp} خبرة${r.shards ? ` و +${r.shards} شظية` : ''}${r.levelUp ? ' — ارتفع مستواك!' : ''}`, 'good'); after(); } },
      passPremium: () => toast('المسار المميز قريب · والمجاني متاح لك كله', ''),
    });
  }

  AMB.PassUI = { render, refreshMenu, resultPanel, applyCosmetics, arenaClass, fxColors, avatarId, avatarDef, titleName, preview, installActions };
  // the match UI loads first and exposes AMB_UI; hook up once it exists
  if (UI()) { installActions(); }
  applyCosmetics(); refreshMenu();
})();

;
/* ui/collection-ui.js */
/*
 * "مجموعتي" screen: every card with its rarity, level and duplicate copies, and the upgrade button.
 * Logic lives in core/collection.js. Card levels only count in progression fights (campaign, tower, events).
 */
(function () {
  const AMB = globalThis.AMB;
  const $ = (id) => document.getElementById(id);
  const C = AMB.collection, RAR = AMB.ECONOMY.rarities;
  const { icon } = AMB.art;
  const UI = () => globalThis.AMB_UI;
  let firstVisit = null;   // null until the screen is first drawn in this session
  let worldF = '';   // collection world map: '' = the four-arm hub, otherwise one world's cards
  let justUp = '', filter = '', roleF = '', deckOnly = false, upOnly = false;   // rarity filter ('' = all), role filter, show only the deck

  const pct = (a, b) => (b ? Math.min(100, Math.round((a / b) * 100)) : 100);

  // where can a locked card come from?
  function unlockHint(id) {
    const P = AMB.Pass; let src = '';
    if (P) for (const [lv, r] of Object.entries(P.FREE)) if (!src && r.type === 'avatar' && r.id === id) src = `الباتل باس: مستوى ${lv}`;   // the premium track is not available yet, so it is not advertised
    if (AMB.DATA.UNITS[id] && AMB.DATA.UNITS[id].exclusive) return 'حصرية: الحدث الأسبوعي';
    if (AMB.DATA.HEROES[id] && AMB.LEVELS) { const li = AMB.LEVELS.LEVELS.findIndex((l) => l.hero === id); if (li >= 0) return `الحملة: خلّص المستوى ${li + 1} بالثلاث صعوبات`; }
    return src ? `باكجات · ${src}` : 'من الباكجات';
  }
  function tile(id) {
    const d = C.def(id), owned = C.owned(id), lv = C.level(id), need = C.needed(id), have = C.copies(id), max = C.isMax(id);
    const card = UI().cardHTML(d, { k: 'col' + id, lvl: owned ? (d.role || !AMB.heroes ? lv : AMB.heroes.level(id)) : 0, pow: owned && d.role ? C.power(id) : 1, cls: owned ? '' : 'unowned', attrs: `data-act="${d.role ? 'detail' : 'heroInfo'}" data-id="${id}"` });
    const bar = max ? '<div class="cp-bar max"><i style="width:100%"></i><span>المستوى الأقصى ✓</span></div>'
      : `<div class="cp-bar ${have >= need ? 'ready' : ''}"><i style="width:${pct(have, need)}%"></i><span>نسخ ${have}/${need}</span></div>`;
    const gain = Math.round(AMB.ECONOMY.cards.levelBonus * 100);
    const btn = !owned ? `<span class="cp-lock">🔒 ${unlockHint(id)}</span>`
      : max ? '' : C.canUpgrade(id) ? `<button class="btn small primary" data-act="colUpgrade" data-id="${id}">⬆ طوّر +${gain}%</button>`
      : `<span class="cp-need">تحتاج ${need - have} نسخة ${need - have === 1 ? 'زيادة' : 'زيادة'} من الباكجات</span>`;
    const bonus = Math.round((C.power(id) - 1) * 100);
    const inDeck = d.role && owned && C.inDeck(id);
    const dk = d.role && owned ? `<button class="btn small dk ${inDeck ? 'on' : ''}" data-act="colDeck" data-id="${id}">${inDeck ? '✓ في التشكيلة' : '＋ للتشكيلة'}</button>` : '';
    return `<div class="cp-tile ${inDeck ? 'indeck' : ''}" data-card="${id}">${card}${owned ? bar : ''}<div class="cp-foot">${btn}<span class="cp-pow" title="قوة البطاقة في الحملة والبرج">${bonus > 0 ? '+' + bonus + '%' : '±0%'}</span></div>${dk ? `<div class="cp-foot">${dk}</div>` : ''}</div>`;
  }

  AMB.TIPS = AMB.TIPS || {};
  AMB.TIPS.colinfo = () => ({ title: 'تطوير البطاقات', html: `<p>كل مستوى +${Math.round(AMB.ECONOMY.cards.levelBonus * 100)}% صحة وهجوم، والندرة الأعلى أقوى بس تحتاج نسخ أكثر.</p>
    <p>النسخ المطلوبة للمستويات 2 إلى 5:</p>${Object.entries(RAR).map(([k, r]) => `<div class="hint">• <b style="color:${r.color}">${r.name}</b>: ${r.copies.join(' / ')}</div>`).join('')}
    <p><b>المستويات والندرة تنحسب في كل الأطوار</b> (الحملة والبرج والأحداث والمباراة السريعة وضد صاحبك)، إلا «على نفس الجهاز» فالاثنين متساويين.</p>` });
  // the deck strip: your 12 slots, role counts, auto-build. Progression fights shop only from this deck.
  function deckBar() {
    const L = C.deckLimits(), deck = C.deck(), rc = C.roleCounts(deck), ROLE = AMB.DATA.ROLES, ui = UI();
    const slots = []; for (let i = 0; i < L.size; i++) slots.push(deck[i] ? `<button class="dslot" data-act="colDeck" data-id="${deck[i]}" title="${C.def(deck[i]).name}: اضغط للإزالة">${ui.portrait(C.def(deck[i]), { k: 'dk' + i + deck[i] })}</button>` : `<i class="dslot empty"></i>`);
    const ok = deck.length >= L.min;
    return `<div class="deck-bar ${ok ? '' : 'bad'}"><div class="db-top"><b>🃏 تشكيلتك <span>${deck.length}/${L.size}</span></b>
        <span class="db-btns"><button class="btn small primary" data-act="colAuto">ترتيب تلقائي</button><button class="btn small ghost" data-act="colClear">تفريغ</button><button class="ibtn" data-act="info" data-k="deckinfo" title="شرح">ⓘ</button></span></div>
      <div class="db-slots">${slots.join('')}</div>
      <div class="db-roles">${Object.entries(rc).map(([r, n]) => `<span class="${n ? '' : 'z'}">${icon(AMB.art.ROLE_ICON[r])}${ROLE[r].name} ${n}</span>`).join('')}</div>
      ${ok ? '' : `<div class="db-warn">تحتاج ${L.min} وحدات على الأقل في التشكيلة (وإلا تدخل بكل وحداتك)</div>`}</div>`;
  }
  AMB.TIPS.deckinfo = () => ({ title: 'التشكيلة', html: `<p>التشكيلة هي <b>الوحدات اللي تطلع لك في المتجر</b> أثناء الحملة والبرج والأحداث (حتى ${C.deckLimits().size} وحدة، والحد الأدنى ${C.deckLimits().min}). اختر الأدوار والعوالم اللي تكمّل بعض عشان التآزر.</p>
    <p>المباراة السريعة وعلى نفس الجهاز ما تستخدم التشكيلة: الكل يلعب بكل الوحدات. والأبطال خارج التشكيلة.</p><p>«ترتيب تلقائي» تختار لك تشكيلة متوازنة من أقوى بطاقاتك.</p>` });
  const WORLDS = AMB.DATA.WORLDS;
  // collection world map: four arms; each shows how many of that world's cards you own
  function worldHub() {
    const arm = (w, pos) => {
      const all = C.ids().filter((id) => C.def(id).world === w), own = all.filter((id) => C.owned(id)).length, up = all.filter((id) => C.canUpgrade(id)).length, wd = WORLDS[w];
      return `<button class="wm-arm wm-${pos} ${own ? '' : 'locked'}" style="--wc:${wd.color}" data-act="colWorld" data-w="${w}" aria-label="${wd.name}">
        <span class="wm-ic">${icon(AMB.art.WORLD_ICON[w])}</span><b>${wd.name}</b><small><bdi dir="ltr">${own}/${all.length}</bdi> بطاقة</small>${up ? `<i class="wm-go">⬆ ${up}</i>` : ''}</button>`;
    };
    const ids = C.ids(), own = ids.filter((id) => C.owned(id)).length;
    return `<div class="wm wm-col"><div class="wm-lines"><i></i><i></i></div>${arm('sylvan', 'top')}${arm('ember', 'left')}${arm('neon', 'right')}${arm('tide', 'bottom')}
      <div class="wm-core"><svg viewBox="0 0 100 100" aria-hidden="true"><polygon points="50,4 58,34 90,24 66,46 96,60 62,62 70,94 50,70 30,94 38,62 4,60 34,46 10,24 42,34" fill="#f2c94c" stroke="#a87a12" stroke-width="1.5"/></svg><b><bdi dir="ltr">${own}/${ids.length}</bdi></b></div></div>`;
  }

  function render() {
    const root = $('collection'); if (!root) return;
    const hub = !worldF && !deckOnly && !upOnly && !filter && !roleF;
    const ids = C.ids().filter((id) => (!worldF || C.def(id).world === worldF) && (!filter || C.rarity(id) === filter) && (!roleF || C.def(id).role === roleF) && (!deckOnly || C.inDeck(id)) && (!upOnly || C.canUpgrade(id) || id === justUp))
      .sort((a, b) => RAR[C.rarity(b)].order - RAR[C.rarity(a)].order || (C.def(a).role ? 1 : 0) - (C.def(b).role ? 1 : 0));
    const ready = C.ids().filter((id) => C.canUpgrade(id)).length;
    const fb = (v, n, col) => `<button class="btn small ${filter === v ? 'on' : ''}" data-act="colFilter" data-v="${v}" ${col ? `style="--rc:${col}"` : ''}>${n}</button>`;
    // the deck and the "how to upgrade" box fold away so the cards show up sooner: open on the first visit, folded after that (each remembers the player's choice)
    const ST = AMB.settings;
    if (firstVisit === null) { firstVisit = !(ST && ST.seen('colVisited')); if (ST) ST.markSeen('colVisited'); }
    const isOpen = (k) => !(ST ? ST.folded(k, !firstVisit) : false);
    const L = C.deckLimits(), dn = C.deck().length;
    root.innerHTML = `<div class="col-head">
        ${C.needsStarter() ? '' : `<details class="col-fold" data-fold="colDeck" ${isOpen('colDeck') ? 'open' : ''}><summary><b>🃏 تشكيلتك <span class="${dn >= L.min ? '' : 'bad'}">${dn}/${L.size}</span></b><small>للحملة والبرج والأحداث</small></summary>${deckBar()}</details>`}
        ${C.needsStarter() ? '<div class="col-starter">ما اخترت بطلك الأول للحين: اضغط «العب» واختر واحد من الأربعة.</div>' : ''}
        <div>${(() => { const at = AMB.album ? AMB.album.total() : null, hs = Object.keys(AMB.DATA.HEROES), ho = hs.filter((h) => C.owned(h)).length; return at ? `<b>${at.owned} / ${at.total}</b> وحدة · <b>${ho} / ${hs.length}</b> أبطال` : `<b>${C.ownedCount()} / ${C.ids().length}</b> بطاقة`; })()} · ${ready ? `<span class="col-ready">${ready} جاهزة للتطوير</span>` : 'ما فيه ترقيات جاهزة'}</div>
        <details class="col-fold" data-fold="colHow" ${isOpen('colHow') ? 'open' : ''}><summary><b>كيف أطوّر بطاقاتي؟</b>${ready ? `<small class="col-ready">⬆ ${ready} جاهزة</small>` : ''}</summary>
        <div class="up-how">كل نسخة <u>مكررة</u> من باكج تروح لبطاقتها. لما يكتمل شريط النسخ يطلع زر <b>⬆ طوّر</b> ويرفع قوتها <b>+${Math.round(AMB.ECONOMY.cards.levelBonus * 100)}%</b> في الحملة والبرج والأحداث.
          ${ready ? `<button class="btn small primary" data-act="colRole" data-v="up">⬆ ${ready} جاهزة الحين</button>` : '<span class="hint">ما فيه بطاقة جاهزة الحين، افتح باكجات.</span>'} <button class="ibtn" data-act="info" data-k="colinfo" title="شرح">ⓘ</button></div>
        <div class="rar-legend">${Object.entries(RAR).map(([k, r]) => `<span class="rl r-${k}"><i></i>${r.name} <small>+${Math.round((r.power - 1) * 100)}%</small></span>`).join('')}</div>
        <button class="btn primary small" data-act="go" data-to="packs">افتح باكجات للحصول على نسخ</button></details>
        ${hub ? '' : `<div class="filters">${fb('', 'الكل')}${Object.entries(RAR).map(([k, r]) => fb(k, r.name, r.color)).join('')}</div>
        <div class="filters"><button class="btn small ${roleF === '' && !deckOnly && !upOnly ? 'on' : ''}" data-act="colRole" data-v="">كل الأدوار</button><button class="btn small ${upOnly ? 'on' : ''}" data-act="colRole" data-v="up">⬆ جاهزة للتطوير</button><button class="btn small ${deckOnly ? 'on' : ''}" data-act="colRole" data-v="deck">التشكيلة فقط</button>${Object.entries(AMB.DATA.ROLES).map(([k, r]) => `<button class="btn small ${roleF === k ? 'on' : ''}" data-act="colRole" data-v="${k}">${r.name}</button>`).join('')}</div>
`}
      </div>
      ${hub ? worldHub() : `<div class="wm-back"><button class="btn small ghost" data-act="colWorld" data-w="">‹ خريطة العوالم</button><b style="color:${worldF ? WORLDS[worldF].color : 'inherit'}">${worldF ? `${AMB.art.icon(AMB.art.WORLD_ICON[worldF])} ${WORLDS[worldF].name}` : deckOnly ? '🃏 التشكيلة' : upOnly ? '⬆ جاهزة للتطوير' : 'البطاقات'}</b></div><div class="col-grid">${ids.map(tile).join('')}</div>`}`;
    refreshMenu();
  }

  function refreshMenu() {
    const b = $('menu-cards'); if (!b) return;
    const n = C.ids().filter((id) => C.canUpgrade(id)).length;
    (b.querySelector('.mt-l') || b).innerHTML = `مجموعتي${n ? `<span class="dot">${n}</span>` : ''}`;
  }

  function installActions() {
    const ui = UI(); if (!ui || ui.ACT.colUpgrade) return;
    Object.assign(ui.ACT, {
      colWorld: (d) => { justUp = ''; worldF = d.w || ''; filter = ''; roleF = ''; deckOnly = false; upOnly = false; ui.sfx('click'); render(); window.scrollTo(0, 0); },
      colFilter: (d) => { justUp = ''; filter = d.v || ''; render(); },
      colRole: (d) => { justUp = ''; deckOnly = d.v === 'deck'; upOnly = d.v === 'up'; roleF = deckOnly || upOnly ? '' : (d.v || ''); render(); },
      colDeck: (d) => { const r = C.toggleDeck(d.id); if (!r.ok) { ui.toast(r.reason, 'err'); return; } ui.sfx('click'); const y = window.scrollY; render(); window.scrollTo(0, y); },
      colAuto: () => { C.autoBuild(); ui.sfx('merge'); ui.toast('رتبت لك تشكيلة متوازنة', 'good'); render(); },
      colClear: () => { C.setDeck([]); render(); },
      deckEdit: () => { ui.closeModal(); ui.show('cards'); },
      colUpgrade: (d) => {
        const id = d.id, d0 = C.def(id), before = C.level(id), p0 = C.power(id);
        const lv = C.upgrade(id); if (!lv) return;
        justUp = id;
        ui.sfx('merge');
        const g = (v, p) => Math.round(v * p), p1 = C.power(id), c = AMB.ECONOMY.cards.levelBonus;
        const row = (n, a, b) => `<div class="up-row"><span>${n}</span><b>${a}</b><i>←</i><b class="new">${b}</b></div>`;
        const rows = (d0.hp ? row('❤️ الصحة', g(d0.hp, p0), g(d0.hp, p1)) + row('⚔️ الهجوم', g(d0.atk, p0), g(d0.atk, p1)) : '') + row('📈 القوة في الحملة', '+' + Math.round((p0 - 1) * 100) + '%', '+' + Math.round((p1 - 1) * 100) + '%');
        const nx = C.isMax(id) ? 'وصلت المستوى الأقصى ✓' : `للمستوى التالي: ${C.copies(id)}/${C.needed(id)} نسخ`;
        ui.modal(`<h2>تطوّرت ${d0.name}!</h2><div class="up-card">${ui.cardHTML(d0, { k: 'up' + id, lvl: lv, pow: C.power(id) })}</div>
          <div class="up-lv">المستوى ${before} ← <b>${lv}</b></div><div class="up-rows">${rows}</div>
          <p class="hint">كل مستوى يزيد الصحة والهجوم +${Math.round(c * 100)}%. السرعة والمدى ما تتغير. ينحسب في كل الأطوار ما عدا «على نفس الجهاز».</p><p class="hint">${nx}</p>`);
        render();
        const el = document.querySelector('#modal .tcard');
        if (el && ui.burst) [RAR[C.rarity(id)].color, '#ffffff', '#ffd24a'].forEach((cc) => ui.burst(el, cc, 14, { r: 100, s: 6 }));
      },
    });
  }

  // used before a progression fight: no valid deck -> build one for you; and a one-line summary for the fight previews
  AMB.DeckGate = {
    ensure() { if (!C.deckValid()) { C.autoBuild(); if (UI()) UI().toast('رتبت لك تشكيلة تلقائيًا', 'good'); } return true; },
    line() { const L = C.deckLimits(), n = C.deck().length; return `<div class="deck-line ${n >= L.min ? '' : 'bad'}">🃏 تشكيلتك: <b>${n}/${L.size}</b>${n >= L.min ? '' : ' (ناقص: يرتّب لك تلقائيًا)'} <button class="btn small" data-act="deckEdit">عدّل</button></div>`; },
  };
  // remember each folded section (the toggle event does not bubble: listen in the capture phase)
  document.addEventListener('toggle', (e) => { const d = e.target; if (d && d.dataset && d.dataset.fold && AMB.settings) AMB.settings.setFolded(d.dataset.fold, !d.open); }, true);
  AMB.CollectionUI = { render, refreshMenu, installActions, unlockHint };
  if (UI()) installActions();
  refreshMenu();
})();

;
/* ui/packs-ui.js */
/*
 * "الباكجات" screen: buy/open packs with shards, see the odds and the legendary pity counter,
 * and a card-by-card reveal. Logic lives in core/packs.js.
 */
(function () {
  const AMB = globalThis.AMB;
  const $ = (id) => document.getElementById(id);
  const P = AMB.packs, C = AMB.collection, W = AMB.wallet, RAR = AMB.ECONOMY.rarities;
  const { icon } = AMB.art;
  const UI = () => globalThis.AMB_UI;
  const PACK = 'basic';
  let busy = false;

  const shardsHTML = (n) => `<span class="shards">${icon('gem')}<b>${n.toLocaleString('en-US')}</b></span>`;

  AMB.TIPS = AMB.TIPS || {};
  AMB.TIPS.pity = () => { const d = P.def(PACK), R = RAR[d.pity.rarity]; return { title: 'ضمان ' + R.name, html: `<p>إذا فتحت ${d.pity.after} باكجات بدون ${R.name}، الباكج اللي بعدها يحتوي ${R.name} أكيد. العدّاد يرجع للصفر كلما طلعت لك ${R.name}.</p>` }; };
  AMB.TIPS.shards = () => ({ title: 'الشظايا', html: '<p>الشظايا تجيك من الحملة والمهام اليومية والدخول اليومي.</p><p>اللعبة ما تبيع شي بفلوس حقيقية.</p>' });
  AMB.TIPS.odds = () => ({ title: 'النسب', html: `<p>مع الضمان، المعدل الفعلي للـ${RAR.legendary.name} تقريبًا بطاقة كل 8–9 باكجات.</p><p>النسخة المكررة تطوّر البطاقة، ونسخة بطاقة وصلت لأعلى مستوى تتحوّل إلى شظايا.</p>` });
  // adult #25: the wish: pick the hero you want; the legendary guarantee brings it
  function wishHTML() {
    const missing = Object.values(AMB.DATA.HEROES).filter((h) => !h.exclusive && !(AMB.collection && AMB.collection.owned(h.id)));
    if (!missing.length) return '';
    const w = P.wish && P.wish(), h = w ? AMB.DATA.HEROES[w] : null;
    return `<div class="pk-wish"><span>🎯 أمنيتي: <b>${h ? h.name : 'ما اخترت'}</b></span><button class="btn small" data-act="wishPick">${h ? 'غيّر' : 'اختر بطل'}</button>
      <small>لما يشتغل ضمان الأسطوري، يجيك البطل اللي اخترته.</small></div>`;
  }
  function pityHTML() {
    const d = P.def(PACK), left = P.pityLeft(PACK), done = d.pity.after - left;
    const segs = Array.from({ length: d.pity.after }, (_, i) => `<i class="${i < done ? 'on' : ''}"></i>`).join('');
    const R = RAR[d.pity.rarity];
    // kid #10: the guarantee counter is folded behind a small "ⓘ الضمان" line (no countdown pushing to open more)
    return `<details class="pity-fold"><summary>ⓘ الضمان</summary><div class="pity ${left === 0 ? 'ready' : ''}" style="--rc:${R.color}">
      <div class="pity-t">${left === 0 ? `🎉 الباكج الجاي فيه <b>${R.name}</b> مضمون!` : `باقي <b>${left}</b> على ضمان <b>${R.name}</b>`} <button class="ibtn" data-act="info" data-k="pity" title="شرح">ⓘ</button></div>
      <div class="pity-bar">${segs}</div>
      </div></details>`;
  }

  function render() {
    const root = $('packs'); if (!root) return;
    const d = P.def(PACK), cost = d.cost.shards, st = P.stats();
    const odds = P.oddsTable(PACK).map((o) => `<li class="r-${o.rarity}"><i></i>${RAR[o.rarity].name}<b>${o.pct.toFixed(o.pct < 1 ? 1 : 0)}%</b></li>`).join('');
    root.innerHTML = `<div class="pk-top">${shardsHTML(W.balance('shards'))}<button class="ibtn" data-act="info" data-k="shards" title="شرح">ⓘ</button></div>
      <div class="pk-main">
        <div class="pk-pack"><div class="pk-art"><span class="pk-logo">ZOR</span><span class="pk-name">${d.name}</span><span class="pk-n">${d.cards} بطاقات</span></div>
          <button class="btn primary big" data-act="packOpen" ${W.canAfford(d.cost) ? '' : 'disabled'}>افتح · ${icon('gem')} ${cost}</button>
          ${W.canAfford({ shards: cost * 2 }) ? `<button class="btn" data-act="packOpen5">افتح ×${Math.min(5, Math.floor(W.balance ? W.balance('shards') / cost : 5))} مرة وحدة</button>` : ''}
          ${W.canAfford(d.cost) ? '' : `<div class="hint">تحتاج ${cost - W.balance('shards')} شظية إضافية</div>`}</div>
        <div class="pk-side">${pityHTML()}
          <div class="pk-odds"><b>نسبة ظهور كل بطاقة</b><ul>${odds}</ul>
            <button class="ibtn" data-act="info" data-k="odds" title="شرح">ⓘ</button></div>
          <div class="pk-stats hint">فتحت ${st.opened} باكج · ${Object.keys(RAR).map((r) => `${RAR[r].name}: ${st.found[r] || 0}`).join(' · ')}</div>
          <button class="btn" data-act="go" data-to="cards">مجموعتي ←</button></div>
      </div>`;
    refreshMenu();
  }

  function refreshMenu() {
    const b = $('menu-packs'); if (!b) return;
    const n = Math.floor(W.balance('shards') / P.def(PACK).cost.shards);
    (b.querySelector('.mt-l') || b).innerHTML = `الباكجات${n ? `<span class="dot">${n}</span>` : ''}`;
  }

  function tagFor(c) {
    if (c.refund) return `<span class="rv-tag gold">+${c.refund} ${icon('gem')}</span>`;
    if (c.isNew) return '<span class="rv-tag new">جديدة!</span>';
    if (c.canUpgrade) return '<span class="rv-tag up">↑ جاهزة للتطوير</span>';
    return `<span class="rv-tag">+1 نسخة · ${c.copies}/${C.needed(c.id) || '—'}</span>`;
  }

  function reveal(res) {
    const ui = UI(), FX = AMB.FX;
    const best = res.cards.reduce((b, c) => (RAR[c.rarity].order > RAR[b.rarity].order ? c : b), res.cards[0]);
    // the rarest cards turn last, after a build-up
    const order = res.cards.map((c, i) => ({ c, i })).sort((a, b) => RAR[a.c.rarity].order - RAR[b.c.rarity].order || a.i - b.i).map((x) => x.c);
    const T = FX ? FX.revealTimes(order) : order.map((_, i) => 0.35 + i * 0.45);
    const cards = order.map((c, i) => `<div class="rv" style="--d:${T[i].toFixed(2)}s;--rc:${RAR[c.rarity].color}" data-r="${c.rarity}">
        ${RAR[c.rarity].order >= 3 ? '<i class="rv-rays"></i>' : ''}<div class="rv-in"><div class="rv-back"><span>ZOR</span></div><div class="rv-front">${ui.cardHTML(C.def(c.id), { k: 'rv' + i + c.id, lvl: c.level })}${tagFor(c)}</div></div></div>`).join('');
    // UI v2: bigger cards (3 + 2 on phones), the rarest last with a longer build-up, and a «تخطي» button that turns the rest at once
    ui.overlay(`<div class="rv-wrap rv2 ${'best-' + best.rarity}"><h2>${res.forced ? 'الضمان اشتغل! ' : ''}${RAR[best.rarity].name === RAR.legendary.name ? '✨ أسطوري! ✨' : 'باكج الصدع'}</h2>
      <div class="rv-row">${cards}</div>
      ${res.refund ? `<p class="hint">نسخ بطاقات بالمستوى الأقصى تحوّلت إلى ${res.refund} شظية.</p>` : ''}
      <div class="rv-btns"><button class="btn rv-skip" data-act="rvSkip">${icon('skip')} تخطي</button><button class="btn primary big" data-act="packDone" data-to="cards">${res.cards.some((c) => c.isNew) ? '🎉 شوف شخصياتك الجديدة' : '📚 شوف مجموعتك'}</button>
        <button class="btn ghost" data-act="packOpen" ${W.canAfford(P.def(PACK).cost) ? '' : 'disabled'}>باكج ثاني · ${icon('gem')} ${P.def(PACK).cost.shards}</button><button class="btn ghost" data-act="packDone">تم</button></div></div>`);
    const wrap = document.querySelector('.rv-wrap');
    const timers = [];
    const at = (fn, ms) => timers.push(setTimeout(fn, ms));
    const live = () => $('overlay').classList.contains('on') && wrap.isConnected;
    order.forEach((c, i) => {
      const L = RAR[c.rarity].order;
      if (FX && L >= 3) at(() => { if (live()) FX.charge(wrap, c.rarity); }, Math.max(0, T[i] * 1000 - (L === 4 ? 1300 : 600)));
      at(() => {
        if (!live()) return;
        const el = wrap.querySelectorAll('.rv')[i];
        if (FX) FX.reveal(el, c.rarity, wrap, c); else ui.sfx(L >= 3 ? 'merge' : 'click');
        if (i === order.length - 1) wrap.classList.add('rv-done');
      }, T[i] * 1000 + 300);
    });
    // skip: stop the remaining timers, turn every card now, and give the best card its effect once
    wrap._skip = () => {
      if (wrap.classList.contains('rv-done')) return;
      timers.forEach(clearTimeout); timers.length = 0;
      ['rv-charge-3', 'rv-charge-4'].forEach((k) => wrap.classList.remove(k));
      wrap.classList.add('rv-skipped', 'rv-done');
      const els = wrap.querySelectorAll('.rv');
      els.forEach((el) => el.classList.add('hit'));
      const bi = order.indexOf(best);
      if (FX && els[bi]) FX.reveal(els[bi], best.rarity, wrap, best); else ui.sfx('click');
    };
  }

  function installActions() {
    const ui = UI(); if (!ui || ui.ACT.packOpen) return;
    Object.assign(ui.ACT, {
      wishPick: () => {
        const missing = Object.values(AMB.DATA.HEROES).filter((h) => !h.exclusive && !(AMB.collection && AMB.collection.owned(h.id)));
        ui.modal(`<h2>🎯 أي بطل تبي؟</h2><div class="hero-grid wish-grid">${missing.map((h) => `<button class="wish-h" data-act="wishSet" data-id="${h.id}">${ui.portrait(h, { k: 'wsh' + h.id })}<b>${h.name}</b></button>`).join('')}</div>`);
      },
      wishSet: (d) => { if (P.setWish(d.id)) { ui.closeModal(); ui.toast(`🎯 ${AMB.DATA.HEROES[d.id].name} صار أمنيتك`, 'good'); render(); } },
      packOpen: () => {
        if (busy) return; busy = true; setTimeout(() => (busy = false), 600);
        const res = P.open(PACK);
        if (!res) { ui.toast('ما عندك شظايا كافية', 'err'); return; }
        render(); reveal(res);
      },
      // adult #27: open several packs at once, one summary (new characters first)
      packOpen5: () => {
        if (busy) return; busy = true; setTimeout(() => (busy = false), 600);
        const all = []; let n = 0, refund = 0;
        while (n < 5 && P.canOpen(PACK)) { const r = P.open(PACK); if (!r) break; n++; refund += r.refund || 0; all.push(...r.cards); }
        if (!n) { ui.toast('ما عندك شظايا كافية', 'err'); return; }
        render(); ui.sfx('merge');
        all.sort((a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0) || RAR[b.rarity].order - RAR[a.rarity].order);
        ui.overlay(`<div class="rv-wrap"><h2>📦 ×${n} باكجات</h2><p class="hint">${all.filter((c) => c.isNew).length} شخصية جديدة${refund ? ` · ${refund} شظية من النسخ الزايدة` : ''}</p>
          <div class="cam-pack-row">${all.map((c, i) => `<div class="cu">${ui.portrait(C.def(c.id), { k: 'p5' + i + c.id })}<small style="color:${RAR[c.rarity].color}">${RAR[c.rarity].name}${c.isNew ? ' · جديدة!' : ''}</small></div>`).join('')}</div>
          <div class="rv-btns"><button class="btn primary big" data-act="packDone" data-to="cards">${all.some((c) => c.isNew) ? '🎉 شوف شخصياتك الجديدة' : '📚 شوف مجموعتك'}</button><button class="btn ghost" data-act="packDone">تم</button></div></div>`);
      },
      rvSkip: () => { const w = document.querySelector('#overlay .rv-wrap'); if (w && w._skip) w._skip(); },
      packDone: (d) => { ui.closeOverlay(); if (d.to) ui.show(d.to); else render(); },
    });
  }

  AMB.PacksUI = { render, refreshMenu, installActions, reveal };
  if (UI()) installActions();
  refreshMenu();
})();

;
/* ui/campaign-ui.js */
/*
 * "الحملة" screen: 4 levels (one per world), each a path of 4 fights + a boss.
 * A fight preview shows the enemy line-up, the boss special and the rewards; then a short
 * best-of-3 match starts (ui.js startMatch with S.mode = 'campaign'). Logic: core/campaign.js, data: core/levels.js.
 */
(function () {
  const AMB = globalThis.AMB;
  const $ = (id) => document.getElementById(id);
  const CAM = AMB.campaign, LV = AMB.LEVELS, C = AMB.collection;
  const { icon } = AMB.art;
  const UI = () => globalThis.AMB_UI;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let hero = null;   // hero used for campaign fights (remembered while the page is open)
  let starterSel = null;   // first-hero picker: the card selected before confirming
  let camWorld = null;     // the world map: null = the four-arm hub, otherwise one world's levels

  const W = (id) => AMB.DATA.WORLDS[id];
  const pickHero = () => {
    const owned = C.ownedHeroes();
    if (hero && owned.includes(hero)) return hero;
    return (hero = C.starterHero() && owned.includes(C.starterHero()) ? C.starterHero() : owned[0] || null);
  };

  const starRow = (n, cls) => `<span class="cstars ${cls || ''}">${[1].map((k) => `<i class="${k <= n ? 'on' : ''}">★</i>`).join('')}</span>`;

  function chestsHTML() {
    const tot = CAM.totalStars(), max = CAM.maxStars();
    // chests keep a minimum gap so the low thresholds (10★, 25★) never overlap: position = the real share, pushed right just enough
    let lastAt = -100; const MIN = 14;
    const items = CAM.chests().map((c) => { let at = (100 * c.need) / max; if (at < lastAt + MIN) at = lastAt + MIN; lastAt = at; c._at = Math.min(at, 100); return c; }).map((c) => `<button class="chest ${c.state}" style="--at:${c._at}%" ${c.state === 'ready' ? `data-act="camChest" data-id="${c.id}"` : 'disabled'} title="${esc(c.name)}: ${rewardText(c.reward)}">
        <span class="ch-ic">${c.state === 'claimed' ? '✓' : '🎁'}</span><b>${c.need}★</b></button>`).join('');
    return `<div class="cam-chests"><div class="cc-top"><span class="cc-total">★ <bdi dir="ltr">${tot}<small>/${max}</small></bdi></span>
        <span class="hint">${LV.CAMPAIGN.stars.rules.map((r) => '★'.repeat(r.n)).join(' · ')} <button class="ibtn" data-act="info" data-k="caminfo" title="شرح">ⓘ</button></span></div>
      <div class="cc-track"><i style="width:${(100 * tot) / max}%"></i>${items}</div></div>`;
  }
  function rewardText(rw) {
    const R = AMB.ECONOMY.rarities;
    return [rw.shards ? `${rw.shards} شظية` : '', rw.packs ? `${rw.packs === 1 ? 'باكج' : rw.packs + ' باكجات'}` : '', rw.card ? `بطاقة ${R[rw.card].name} أو أندر أكيد` : ''].filter(Boolean).join(' + ');
  }

  function node(l, f, i) {
    const cleared = CAM.isCleared(f.id, CAM.diff()), open = CAM.isUnlocked(f.id), next = CAM.next() === f.id;
    const cls = ['cnode', f.boss ? 'boss' : '', cleared ? 'cleared' : '', open ? 'open' : 'locked', next ? 'next' : ''].join(' ');
    const inner = f.boss ? UI().portrait(AMB.DATA.HEROES[l.hero], { bare: true, k: 'cb' + l.id }) : `<b>${i + 1}</b>`;
    return `<button class="${cls}" ${open ? `data-act="camFight" data-id="${f.id}"` : 'disabled'} title="${esc(f.name)}">${inner}${cleared ? starRow(CAM.stars(f.id), 'mini') : open ? '' : '<i class="lk">🔒</i>'}<span class="cn-name">${esc(f.name)}</span></button>`;
  }

  function render() {
    const root = $('campaign'); if (!root) return;
    const R = LV.CAMPAIGN.rewards;
    if (C.needsStarter()) {   // brand-new player: pick the first hero right here (same picker as the quick match), then straight to fight 1
      const ui = UI(), list = AMB.DATA.HERO_STARTERS.filter((id) => AMB.DATA.HEROES[id]);
      if (!list.includes(starterSel)) starterSel = null;
      root.innerHTML = `<div class="cam-starter"><h3>اختر بطلك الأول</h3><p class="hint">اضغط «جرّب» وشوف كل بطل يقاتل قبل لا تختار. والباقين تفتحهم بعدين من الحملة 🎁</p>
        <div class="hero-grid hp-grid">${list.map((id) => ui.heroPickHTML(AMB.DATA.HEROES[id], { act: 'camPick', sel: starterSel === id, trial: true, k: 'cst' })).join('')}</div>
        <div class="hero-foot cam-foot" ${starterSel ? '' : 'hidden'}><button class="btn primary big" data-act="camStarter" data-id="${starterSel || ''}" ${starterSel ? '' : 'disabled'}>${starterSel ? `خذ ${esc(AMB.DATA.HEROES[starterSel].name)} بطلي الأول` : 'اختر بطل'}</button></div></div>`;
      return;
    }
    if (AMB.tutorial && AMB.tutorial.required()) {   // brand-new player: the guided match comes first
      root.innerHTML = `<div class="cam-starter"><div class="tut-cta"><button class="btn primary big" data-act="tutGo">${icon('sword')} ${icon('hand')}</button></div></div>`; return;
    }
    AMB.TIPS = AMB.TIPS || {};
    AMB.TIPS.caminfo = () => ({ title: 'كيف تشتغل الحملة', html: `<p>كل قتال <b>لين 8 جولات، واللي يكسب 5 جولات أول يفوز</b> ضد تشكيلة ثابتة. مستويات بطاقاتك وندرتها <b>تنحسب هنا</b>، والمتجر يعرض الوحدات اللي تملكها فقط.</p>
      <p>الفوز الأول: ${icon('gem')} ${R.fight.shards} + ${R.fight.passXp} خبرة ممر<br><b>3 صعوبات:</b> سهل (أضعف وجوائز أصغر)، متوسط، صعب (أقوى وجوائز مضاعفة، ينفتح بعد ما تخلص المستوى في متوسط). لكل صعوبة تقدمها ونجومها وصناديقها.<br>الزعيم: <b>جائزة وحدة كبيرة</b> أول مرة تفوز فيه: ${icon('gem')} ${R.bossStars[0].shards} + باكج + بطاقة نادرة أو أعلى<br>إنهاء المستوى: باكج مجاني<br>الإعادة: ${icon('gem')} ${R.replay.shards}</p>
      <h4>النجوم</h4>${LV.CAMPAIGN.stars.rules.map((r) => `<div>${'★'.repeat(r.n)} ${r.text}</div>`).join('')}` });
    const DF = LV.DIFFICULTY, cd = CAM.diff();
    const tabs = `<div class="cam-diff">${CAM.DIFFS.map((k) => `<button class="cd ${k === cd ? 'on' : ''}" style="--dc:${DF[k].color}" data-act="camDiff" data-v="${k}"><b>${DF[k].name}</b><small>★ ${CAM.totalStars(k)}/${CAM.maxStars()}</small></button>`).join('')}</div>
      <div class="hint cam-dnote">${cd === 'easy' ? 'أعداء أضعف وجوائز أصغر، لقصة مريحة' : cd === 'normal' ? 'الحملة الأساسية' : 'أعداء أقوى بـ30% وجوائز أكبر: باكجات مضاعفة وبطاقات أندر. كل مستوى ينفتح بعد ما تخلصه في «متوسط»'}</div>`;
    // ---- world map: a compass with four arms; tapping a world shows only that world's levels (Neon -> Neon-9 street + Network stage)
    const WORLD_ORDER = ['ember', 'sylvan', 'neon', 'tide'];   // left, top, right, bottom
    const worldLevels = (w) => LV.LEVELS.map((l, li) => ({ l, li })).filter((x) => x.l.world === w);
    const nextId = CAM.next(), nextF = nextId && CAM.find(nextId);
    if (camWorld && !worldLevels(camWorld).length) camWorld = null;
    if (!camWorld) {
      const arm = (w, pos) => {
        const ls = worldLevels(w), wd = W(w), total = ls.reduce((n, x) => n + x.l.fights.length, 0), cleared = ls.reduce((n, x) => n + CAM.progress(x.l.id).cleared, 0);
        const stars = ls.reduce((n, x) => n + CAM.levelStars(x.l.id), 0), maxS = total, open = ls.some((x) => CAM.levelUnlocked(x.li)), here = nextF && nextF.level.world === w;
        return `<button class="wm-arm wm-${pos} ${open ? '' : 'locked'} ${here ? 'here' : ''} ${cleared >= total ? 'done' : ''}" style="--wc:${wd.color}" data-act="camWorld" data-w="${w}" aria-label="${esc(wd.name)}">
          <span class="wm-ic">${icon(AMB.art.WORLD_ICON[w])}</span><b>${esc(wd.name)}</b><small><bdi dir="ltr">${cleared}/${total}</bdi> · ★ <bdi dir="ltr">${stars}/${maxS}</bdi></small>${open ? '' : '<i class="wm-lock">🔒</i>'}${here ? '<i class="wm-go">▶ كمّل</i>' : ''}</button>`;
      };
      const totalAll = LV.LEVELS.reduce((n, l) => n + l.fights.length, 0), doneAll = LV.LEVELS.reduce((n, l) => n + CAM.progress(l.id).cleared, 0);
      root.innerHTML = tabs + `<div class="wm"><div class="wm-lines"><i></i><i></i></div>
        ${arm('sylvan', 'top')}${arm('ember', 'left')}${arm('neon', 'right')}${arm('tide', 'bottom')}
        <div class="wm-core"><svg viewBox="0 0 100 100" aria-hidden="true"><polygon points="50,4 58,34 90,24 66,46 96,60 62,62 70,94 50,70 30,94 38,62 4,60 34,46 10,24 42,34" fill="#f2c94c" stroke="#a87a12" stroke-width="1.5"/></svg><b><bdi dir="ltr">${doneAll}/${totalAll}</bdi></b></div></div>
        ${chestsHTML()}`;
      refreshMenu(); return;
    }
    const wd = W(camWorld);
    root.innerHTML = tabs + `<div class="wm-back"><button class="btn small ghost" data-act="camWorld" data-w="">‹ خريطة العوالم</button><b style="color:${wd.color}">${icon(AMB.art.WORLD_ICON[camWorld])} ${esc(wd.name)}</b></div>` + `<div class="cam-note">⚔️ لين 8 جولات، واللي يكسب 5 منها أول يفوز · ⭐ كل فوز نجمة، والنجوم تفتح صناديق · 👑 الزعيم له جائزة كبيرة <button class="ibtn" data-act="info" data-k="caminfo" title="شرح">ⓘ</button></div>
      ${chestsHTML()}
      <div class="cam-levels">${LV.LEVELS.map((l, li) => ({ l, li })).filter((x) => x.l.world === camWorld).map(({ l, li }) => {
        const pr = CAM.progress(l.id), unlocked = CAM.levelUnlocked(li);
        const lockMsg = cd === 'hard' && !CAM.levelDone(l.id, 'normal') ? '🔒 خلّصه في «متوسط» أول' : '🔒 خلّص المستوى اللي قبله';
        return `<section class="cam-level ${unlocked ? '' : 'locked'} ${CAM.levelDone(l.id, cd) ? 'done' : ''}" style="--wc:${W(l.world).color}">
          <header><span class="cl-n">${li + 1}</span><div><h3>${esc(l.name)}</h3><small>${W(l.world).name} · ${pr.cleared}/${pr.total} · ★ ${CAM.levelStars(l.id)}/${l.fights.length}${CAM.levelDone(l.id, cd) ? ' · ✓ مكتمل' : ''}</small></div>
          ${unlocked ? '' : `<span class="cl-lock">${lockMsg}</span>`}</header>
          ${(() => { const hd = AMB.DATA.HEROES[l.hero], dd = CAM.levelDiffs(l.id), has = AMB.collection && AMB.collection.owned(l.hero); return hd ? `<div class="cl-hero ${has ? 'got' : ''}" style="--wc:${W(l.world).color}"><span class="clh-p">${UI().portrait(hd, { k: 'clh' + l.id })}</span><div><b>${has ? '✓ ' : '🔒 '}${esc(hd.name)}</b><small>${has ? 'عندك هذا البطل' : 'جائزة المستوى: خلّص كل قتالاته على الثلاث صعوبات'}</small></div><span class="clh-d">${CAM.DIFFS.map((x) => `<i class="${dd[x] ? 'on' : ''}" style="--dc:${LV.DIFFICULTY[x].color}" title="${LV.DIFFICULTY[x].name}">${LV.DIFFICULTY[x].name}${dd[x] ? ' ✓' : ''}</i>`).join('')}</span></div>` : ''; })()}
          <div class="cpath">${l.fights.map((f, i) => node(l, f, i)).join('<i class="cline"></i>')}</div></section>`;
      }).join('')}</div>`;
    refreshMenu();
  }

  /** a player who has not won a campaign fight yet (and never played before): keep the menu simple */
  const isNewbie = () => !CAM.isCleared('l1f1') && !(AMB.pass && AMB.pass.state().xp > 0) && AMB.packs.stats().opened === 0;
  function refreshMenu() {
    document.body.classList.toggle('newbie', isNewbie());
    const b = $('menu-campaign'); if (!b) return;
    if (isNewbie()) { b.innerHTML = 'ابدأ المغامرة'; return; }
    const n = CAM.next(), f = n && CAM.find(n);
    const ch = CAM.readyChests();
    b.innerHTML = `الحملة${f ? ` <small>${f.li + 1}-${f.fi + 1}</small>` : '<small>✓</small>'}${ch ? `<span class="dot">${ch}</span>` : ''}`;
  }

  // what finishing the whole level pays on this difficulty
  function levelHint(pay, inline) {
    const lb = pay && pay.levelBonus; if (!lb || (!lb.packs && !lb.shards)) return '';
    const t = [lb.packs ? `${lb.packs === 1 ? 'باكج مجاني' : lb.packs + ' باكجات مجانية'}` : '', lb.shards ? `${icon('gem')} ${lb.shards} شظية` : ''].filter(Boolean).join(' + ');
    return inline ? ` · <b>${t}</b> لإنهاء المستوى` : `<div class="hint">+ <b>${t}</b> لإنهاء المستوى</div>`;
  }

  function preview(fightId) {
    const ui = UI(), x = CAM.find(fightId), f = x.fight, l = x.level, boss = f.boss ? (LV.BOSS[l.hero] || LV.BOSS[l.world]) : null;
    const pay = CAM.rewardsFor(fightId), st = CAM.stats(fightId);
    const h = pickHero();
    const unitsHTML = f.units.map(([id, star, , from], k) => `<div class="cu">${ui.portrait(AMB.DATA.UNITS[id], { k: 'cpv' + k + id })}${ui.stars(star)}${from > 1 ? `<small>من الجولة ${from}</small>` : ''}</div>`).join('');
    const heroes = C.ownedHeroes().map((id) => `<button class="hchip ${id === h ? 'on' : ''}" data-act="camHero" data-id="${id}" data-f="${fightId}">${ui.portrait(AMB.DATA.HEROES[id], { k: 'cph' + id })}<span>${AMB.DATA.HEROES[id].name}</span></button>`).join('');
    const prizeTxt = (p) => [p.shards ? `${icon('gem')} ${p.shards}` : '', p.passXp ? `+${p.passXp} خبرة` : '', p.packs ? '📦 باكج' : '', p.card ? `🃏 بطاقة ${AMB.ECONOMY.rarities[p.card].name}+` : ''].filter(Boolean).join(' · ');
    const reward = pay.boss
      ? `<div class="hint" style="margin-bottom:4px">قتال طويل: لين 8 جولات (تكسب 5 أول) والزعيم يقوى كل جولة. جائزة الزعيم تنصرف مرة وحدة عند أول فوز.</div>${pay.prizes.map((p) => `<div class="bp ${p.state}"><span class="bp-s">${'★'.repeat(p.star)}</span><span>${prizeTxt(p)}</span><i>${p.state === 'paid' ? '✓ استلمتها' : ''}</i></div>`).join('')}${levelHint(pay)}`
      : pay.replay ? `إعادة: ${icon('gem')} ${pay.shards}` : `${icon('gem')} ${pay.shards} شظية · +${pay.passXp} خبرة ممر${levelHint(pay, true)}`;
    ui.modal(`<div class="cam-pv" style="--wc:${W(l.world).color}">
      <h2>${f.boss ? '👑 ' : ''}${esc(f.name)}</h2><div class="hint">${esc(l.name)} · ${x.fi + 1}/${l.fights.length}</div>
      ${boss ? `<div class="boss-box">${ui.portrait(AMB.DATA.HEROES[l.hero], { k: 'cpb' })}<div><b>قدرة الزعيم: ${boss.name}</b><p>${boss.text}</p></div></div>` : ''}
      ${h === l.hero ? `<div class="hint">ستواجه <b>ظلّ ${AMB.DATA.HEROES[h].name}</b></div>` : ''}
      <h4>تشكيلة الخصم</h4><div class="cam-units">${unitsHTML}</div>
      <h4>الجائزة</h4><div class="cam-reward">${reward}</div>
      <h4>بطلك</h4><div class="hchips">${heroes}</div>${AMB.DeckGate ? AMB.DeckGate.line() : ''}${x.li >= 2 && C.ownedCount() < 40 ? '<div class="db-warn">⚠ هالمستوى أصعب: افتح باكجات وطوّر بطاقاتك أول عشان ترتاح فيه</div>' : ''}
      <h4>النجوم ${starRow(CAM.stars(fightId))} <button class="ibtn" data-act="info" data-k="caminfo" title="شرح">ⓘ</button></h4>
      ${st.attempts ? `<div class="hint">محاولات: ${st.attempts} · فوز: ${st.wins}</div>` : ''}
      <div class="cam-go"><button class="btn primary big" data-act="camGo" data-id="${fightId}" ${h ? '' : 'disabled'}>قاتل!</button></div></div>`);
  }

  function start(fightId) {
    if (AMB.DeckGate && !AMB.DeckGate.ensure()) return;
    const ui = UI(), S = ui.S;
    S.mode = 'campaign'; S.campaign = { fightId, diff: CAM.diff() }; S.picks = [pickHero(), null]; S.pickIdx = 0;
    ui.closeModal(); ui.startMatch();
  }

  /** results screen for a finished campaign fight (called from ui.js showResults) */
  function showResult(m, secs) {
    const ui = UI(), S = ui.S, fightId = S.campaign.fightId, x = CAM.find(fightId);
    if (!m._camDone) { m._camDone = true; S.camResult = CAM.recordResult(fightId, Object.assign(m.summary(0), { lifeLeft: m.players[0].life, maxLife: m.players[0].maxLife, roundsLost: m.players[0].stats.losses })); }
    // a new player starts on easy: after 3 easy wins, move up to medium once (they can switch back any time)
    try { const ST = AMB.settings; if (ST && !ST.seen('autoNormal') && CAM.diff() === 'easy' && m.winner === 0) { const won = ['l1f1', 'l1f2', 'l1f3', 'l1f4', 'l1boss'].filter((id) => CAM.isCleared(id, 'easy')).length; if (won >= 3) { ST.markSeen('autoNormal'); setTimeout(() => UI().toast('💪 صرت قوي! لو تبي جوائز أكبر جرّب «متوسط» من أعلى الحملة', 'good'), 1200); } } } catch (e) { /* ignore */ }
    const r = S.camResult, won = r.won, next = CAM.next(), nx = next && CAM.find(next);
    // why the 3rd star was missed: the hero loses life in a round you win too (the front line fell, or a drawn round), and the star needs it full
    const lifePct = Math.round(100 * m.players[0].life / m.players[0].maxLife);
    const whyNo3 = '';
    const score = `${m.players[0].stats.wins} – ${m.players[1].stats.wins}`;
    const pay = won ? [r.shards ? `${icon('gem')} +${r.shards} شظية` : '', r.passXp ? `+${r.passXp} خبرة ممر` : ''].filter(Boolean).join(' · ') : '';
    const bossPrizes = won && r.boss && r.prizes && r.prizes.length ? `<div class="cam-pack"><b>🏆 جوائز النجوم:</b>${r.prizes.map((p) => `<div class="bp paid"><span class="bp-s">${'★'.repeat(p.star)}</span><span>${[p.shards ? `${icon('gem')} ${p.shards}` : '', p.passXp ? `+${p.passXp} خبرة` : '', p.packs ? '📦 باكج مجاني' : '', p.card ? '🃏 بطاقة ' + AMB.ECONOMY.rarities[p.card].name + ' أو أندر' : ''].filter(Boolean).join(' · ')}</span></div>`).join('')}
      <div class="cam-pack-row">${(r.packs || []).map((pk) => pk.cards.map((c, i) => `<div class="cu">${ui.portrait(C.def(c.id), { k: 'bpk' + i + c.id })}<small class="r-${c.rarity}">${c.isNew ? 'جديدة!' : c.refund ? '+' + c.refund + ' شظية' : '+1 نسخة'}</small></div>`).join('')).join('')}${r.card ? `<div class="cu">${ui.portrait(C.def(r.card.id), { k: 'bcd' + r.card.id })}<small class="r-${r.card.rarity}">${r.card.isNew ? 'جديدة!' : '+1 نسخة'}</small></div>` : ''}</div></div>` : '';
    const lp = r.levelPacks || [];
    const heroWon = (r.heroes || []).map((id) => AMB.DATA.HEROES[id]).filter(Boolean).map((h) => `<div class="cam-pack hero-win"><b>👑 فتحت بطل جديد!</b><div class="cam-pack-row"><div class="cu">${ui.portrait(h, { k: 'hw' + h.id })}<small>${esc(h.name)}</small></div></div><p class="hint">لقيته في «ابدأ المباراة» وفي مجموعتي.</p></div>`).join('');
    const pack = lp.length || r.levelShards ? `<div class="cam-pack"><b>🎁 خلّصت المستوى!${lp.length ? ` ${lp.length === 1 ? 'باكج مجاني' : lp.length + ' باكجات مجانية'}` : ''}${r.levelShards ? ` · ${icon('gem')} +${r.levelShards} شظية` : ''}</b><div class="cam-pack-row">${lp.map((pk) => pk.cards.map((c, i) => `<div class="cu">${ui.portrait(C.def(c.id), { k: 'crp' + i + c.id })}<small class="r-${c.rarity}">${c.isNew ? 'جديدة!' : c.refund ? '+' + c.refund + ' شظية' : '+1 نسخة'}</small></div>`).join('')).join('')}</div></div>` : '';
    $('results').innerHTML = `<div class="res-stage ${won ? 'victory' : 'defeat'}" style="--wc:${W(x.level.world).color}"><div class="res-rays"></div>
        <div class="res-hero">${ui.portrait(AMB.DATA.HEROES[m.players[0].heroId], { bare: true, k: 'crh' })}<i class="sheen"></i></div>
        <div class="res-hname">${esc(x.fight.name)}</div></div>
      <div class="res-banner"><h1>${won ? (x.fight.boss ? 'هزمت الزعيم!' : 'فوز!') : m.players[0].stats.wins ? 'قربت! جرّب مرة ثانية' : 'هالمرة صعبة، جرّب مرة ثانية'}</h1><p class="hint">النتيجة ${score} · ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')} دقيقة</p>
        ${won ? `<div class="res-stars">${[1].map((k) => `<i class="${k <= r.stars ? 'on' : ''}" style="--d:${0.3 + k * 0.35}s">★</i>`).join('')}</div>
          <p class="hint">${r.newBest ? 'نجمة جديدة!' : 'خلّصت هالقتال من قبل'}</p>` : ''}
        ${r.chestsReady > r.chestsBefore ? '<button class="btn primary" data-act="go" data-to="campaign">🎁 صندوق نجوم جاهز! افتحه من خريطة الحملة</button>' : ''}
        ${won ? `<p class="cam-pay">${r.first ? pay : `إعادة: ${pay || 'بدون جائزة'}`}</p>` : `<p class="res-tip">💡 ${UI().lossTip ? UI().lossTip(m) : 'طوّر بطاقاتك وجرّب مرة ثانية'}</p>`}</div>
      ${heroWon}${bossPrizes}${pack}
      ${r.first && fightId === 'l1f1' ? '<div class="cam-unlock">🔓 انفتح: الباكجات · مجموعتي · الممر · الدخول اليومي</div>' : ''}
      <div class="cam-btns">
        ${won && nx ? `<button class="btn primary big" data-act="camGo" data-id="${next}">القتال التالي: ${esc(nx.fight.name)}</button>` : ''}
        <button class="btn ${won ? '' : 'primary'} big" data-act="camGo" data-id="${fightId}">${won ? 'أعد القتال' : 'حاول مرة ثانية'}</button>
        <button class="btn big ghost" data-act="go" data-to="campaign">خريطة الحملة</button>
        ${won ? '' : '<button class="btn big ghost" data-act="go" data-to="cards">طوّر بطاقاتي</button>'}</div>`;
    ui.show('results');
    ui.sfx(won ? 'win' : 'lose');
    if (won) setTimeout(() => { const el = document.querySelector('.res-hero'); if (el) ['#ffd24a', '#ffffff', W(x.level.world).color].forEach((c) => ui.burst(el, c, 14, { r: 150, s: 8 })); }, 250);
  }

  function installActions() {
    const ui = UI(); if (!ui || ui.ACT.camFight) return;
    Object.assign(ui.ACT, {
      camWorld: (d) => { camWorld = d.w || null; ui.sfx('click'); render(); window.scrollTo(0, 0); },
      camFight: (d) => preview(d.id),
      camHero: (d) => { hero = d.id; preview(d.f); },
      camGo: (d) => start(d.id),
      camDiff: (d) => { CAM.setDiff(d.v); ui.sfx('click'); render(); },
      tutGo: () => AMB.TutorialUI.start({ after: () => { render(); preview(CAM.next()); } }),
      camPick: (d, el, e) => { if (e && e.target.closest('[data-act="heroInfo"], [data-act="heroTry"]')) return; starterSel = d.id; ui.sfx('click'); render(); },
      camStarter: (d) => {
        if (!d.id || !C.chooseStarter(d.id)) return;
        CAM.setDiff('easy');   // a brand-new player starts the campaign on easy; after 3 easy wins it moves up to medium once
        hero = d.id; ui.sfx('merge'); ui.toast(`${AMB.DATA.HEROES[d.id].name} صار بطلك!`, 'good');
        render();
        const afterTut = () => { render(); preview(CAM.next()); };
        const goTut = () => (AMB.tutorial.required() ? AMB.TutorialUI.start({ after: afterTut }) : afterTut());
        if (!C.giftClaimed() && AMB.GiftUI) setTimeout(() => AMB.GiftUI.intro(goTut), 250);
        else setTimeout(goTut, 250);
      },
      camChest: (d) => {
        const r = CAM.claimChest(d.id); if (!r) return;
        ui.sfx('merge');
        const C2 = AMB.collection, R = AMB.ECONOMY.rarities;
        const cards = r.packs.flatMap((p) => p.cards).concat(r.card ? [Object.assign({ isNew: r.card.isNew }, r.card)] : []);
        ui.overlay(`<div class="rv-wrap"><h2>🎁 ${esc(LV.CAMPAIGN.stars.chests.find((c) => c.id === d.id).name)}</h2>
          ${r.shards ? `<p class="cam-pay">${icon('gem')} +${r.shards} شظية</p>` : ''}
          ${cards.length ? `<div class="cam-pack-row">${cards.map((c, i) => `<div class="cu">${ui.portrait(C2.def(c.id), { k: 'chs' + i + c.id })}<small style="color:${R[c.rarity].color}">${R[c.rarity].name}${c.isNew ? ' · جديدة!' : ''}</small></div>`).join('')}</div>` : ''}
          <div class="rv-btns"><button class="btn primary" data-act="packDone">تم</button></div></div>`);
        render();
      },
    });
  }

  AMB.CampaignUI = { render, refreshMenu, showResult, installActions, isNewbie };
  if (UI()) installActions();
  refreshMenu();
})();

;
/* ui/fx-ui.js */
/*
 * Rarity-scaled "weight" effects (presentation only, nothing here touches the game rules):
 *   - pack reveal: the rarer the card, the bigger the build-up, flash, rays, rings, screen shake and sound
 *   - landing on the battlefield: the rarer the card, the harder the ground shakes
 * Rarity order: 1 common (almost nothing) … 4 legendary (the whole screen shakes).
 */
(function () {
  const AMB = globalThis.AMB;
  const UI = () => globalThis.AMB_UI;
  const RAR = () => AMB.ECONOMY.rarities;
  const calm = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  const buzz = (p) => { try { if (document.body.classList.contains('no-vibe')) return; if (navigator.vibrate) navigator.vibrate(p); } catch (e) { /* ignore */ } };   // senior #38: vibration can be turned off
  const ord = (r) => (RAR()[r] ? RAR()[r].order : 1);
  const col = (r) => (RAR()[r] ? RAR()[r].color : '#fff');

  function shake(el, level) {   // level 1..4 → how far and how long the ground moves
    if (!el || calm()) return;
    const amp = [0, 0, 2, 3.5, 5][level] || 0, ms = [0, 0, 200, 320, 520][level] || 0;   // heavy but calm: a deep, short tremor, never a jolt if (!amp) return;
    el.style.setProperty('--amp', amp + 'px'); el.style.setProperty('--ms', ms + 'ms');
    el.classList.remove('fx-shake'); void el.offsetWidth; el.classList.add('fx-shake');
    setTimeout(() => el.classList.remove('fx-shake'), ms + 40);
  }
  function tint(color, level, ms) {   // a flash over the whole screen
    if (calm()) return;
    const d = document.createElement('div'); d.className = 'fx-flash'; d.style.setProperty('--c', color); d.style.setProperty('--a', [0, 0, 0.08, 0.14, 0.26][level] || 0.1); d.style.setProperty('--ms', (ms || 520) + 'ms');
    document.body.appendChild(d); setTimeout(() => d.remove(), (ms || 520) + 60);
  }
  function rings(el, color, n, size) {   // shock-waves spreading from an element
    if (!el || calm()) return;
    const r = el.getBoundingClientRect();
    for (let i = 0; i < n; i++) {
      const q = document.createElement('i'); q.className = 'fx-ring'; q.style.setProperty('--c', color); q.style.setProperty('--sz', size + 'px'); q.style.setProperty('--dl', i * 130 + 'ms');
      q.style.left = r.left + r.width / 2 + 'px'; q.style.top = r.top + r.height / 2 + 'px';
      document.body.appendChild(q); setTimeout(() => q.remove(), 1100 + i * 130);
    }
  }
  function cracks(el, color) {   // cracks in the ground around a legendary landing
    if (!el || calm()) return;
    const r = el.getBoundingClientRect(), q = document.createElement('i'); q.className = 'fx-crack'; q.style.setProperty('--c', color);
    q.style.left = r.left + r.width / 2 + 'px'; q.style.top = r.top + r.height * 0.85 + 'px';
    document.body.appendChild(q); setTimeout(() => q.remove(), 1500);
  }

  /** A card was just placed on the battlefield. */
  function land(el, rarity) {
    const ui = UI(), L = ord(rarity), c = col(rarity); if (!el || !ui) return;
    ui.sfx('land' + L);
    if (L >= 2 && ui.burst) ui.burst(el, c, [0, 6, 10, 14, 22][L], { r: [0, 30, 42, 56, 84][L], s: L >= 4 ? 8 : 6 });
    if (L === 1 && ui.burst) ui.burst(el, '#d8cfb8', 5, { r: 22, s: 4 });
    if (L >= 2) rings(el, c, L >= 4 ? 2 : 1, [0, 0, 110, 160, 240][L]);
    if (L >= 3) tint(c, L, L === 4 ? 900 : 600);
    if (L >= 4) cracks(el, c);
    shake(L >= 4 ? document.getElementById('scr-match') : document.getElementById('field'), L);
    if (L >= 3 && !calm()) { const t = el.querySelector('.tcard') || el; t.classList.remove('fx-slam'); void t.offsetWidth; t.classList.add('fx-slam'); if (L >= 4) t.classList.add('big'); setTimeout(() => t.classList.remove('fx-slam', 'big'), 700); }
    buzz([0, 0, 10, 20, [30, 30, 50]][L] || 0);
  }

  // called after every match render: any of my cards that just arrived on the field gets its landing
  let seen = null;
  function watch() {
    const S = ui_S(); if (!S || !S.match) { seen = null; return; }
    const p = S.match.players[S.v];
    const now = new Set(Object.values(p.board || {}).filter(Boolean).map((u) => u.uid));
    if (!seen || seen.m !== S.match || seen.v !== S.v) { seen = { m: S.match, v: S.v, ids: now }; return; }
    const fresh = [...now].filter((id) => !seen.ids.has(id)); seen.ids = now;
    if (S.phase === 'combat' || !fresh.length) return;
    fresh.forEach((id, i) => {
      const u = Object.values(p.board).find((x) => x && x.uid === id); if (!u) return;
      const el = document.querySelector(`#slots [data-drag="unit:${id}"]`) || document.querySelector(`[data-drag="unit:${id}"]`);
      if (el) setTimeout(() => land(el, AMB.collection ? AMB.collection.rarity(u.defId) : 'common'), 40 + i * 120);
    });
  }
  const ui_S = () => (UI() && UI().S) || null;

  /** Pack reveal: timing + effects for the card at position `i` of the (rarity-ascending) row. */
  function revealTimes(cards) {
    let t = 0.35; const out = [];
    cards.forEach((c) => { const L = ord(c.rarity); t += L === 4 ? 1.5 : L === 3 ? 0.7 : 0.4; out.push(t); });
    return out;
  }
  function reveal(el, rarity, wrap, card) {
    const ui = UI(), L = ord(rarity), c = col(rarity); if (!el || !ui) return;
    el.classList.add('hit');
    if (L === 1) { ui.sfx('click'); return; }
    if (L === 2) { ui.sfx('merge'); ui.burst && ui.burst(el, c, 14, { r: 100, s: 7 }); rings(el, c, 1, 220); return; }
    const ov = document.getElementById('overlay');
    ui.sfx(L === 3 ? 'epicHit' : 'legend');
    ui.burst && [c, '#ffd24a'].forEach((cc, k) => ui.burst(el, cc, L === 4 ? 18 : 12, { r: L === 4 ? 120 + k * 20 : 100, s: L === 4 ? 8 : 7 }));
    rings(el, c, L === 4 ? 2 : 1, L === 4 ? 420 : 280);
    tint(c, L, L === 4 ? 1100 : 700);
    shake(ov && ov.firstElementChild, L === 4 ? 4 : 3);
    buzz(L === 4 ? [40, 40, 80] : [25, 25, 40]);
    if (wrap) { wrap.classList.add('rv-hit-' + rarity); setTimeout(() => wrap.classList.remove('rv-hit-' + rarity), 1500); }
  }
  /** Build-up before a rare card turns: the screen darkens and a rumble grows. */
  function charge(wrap, rarity) {
    const ui = UI(), L = ord(rarity); if (!ui || L < 3) return;
    wrap && wrap.classList.add('rv-charge-' + L);
    ui.sfx(L === 4 ? 'charge' : 'epicCharge'); buzz(L === 4 ? [30, 30, 40, 30, 60, 30, 90] : [30, 30, 40]);
    setTimeout(() => wrap && wrap.classList.remove('rv-charge-' + L), L === 4 ? 1500 : 700);
  }

  AMB.FX = { land, watch, reveal, charge, revealTimes, shake, tint, rings, ord };
})();

;
/* ui/vfx-ui.js */
/*
 * Role effects in combat (presentation only): every role attacks and casts with its own look and sound.
 *   fighter  heavy crossing slash          assassin  violet dash + two thin cuts
 *   mage     glowing orb + rune circle     marksman  fast tracer + crosshair
 *   guardian metal shockwave + sparks      support   soft light pulse
 * Called from the combat event loop in ui.js; nothing here touches the game rules.
 */
(function () {
  const AMB = globalThis.AMB;
  const calm = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  const COL = { fighter: '#ffb347', assassin: '#b66bff', mage: '#5fe3ff', marksman: '#fff0a0', guardian: '#8fd4ff', support: '#6dffa0' };
  let live = 0;

  function ctr(el) { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }; }
  function mk(cls, css, ms) {
    if (live > 70) return null;
    const d = document.createElement('i'); d.className = 'vf ' + cls;
    Object.entries(css || {}).forEach(([k, v]) => (k.startsWith('--') ? d.style.setProperty(k, v) : (d.style[k] = v)));
    document.body.appendChild(d); live++;
    setTimeout(() => { d.remove(); live--; }, ms || 600);
    return d;
  }
  const ang = (a, b) => Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
  const dst = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);

  const ATTACK = {
    fighter(a, b, c) {   // two heavy strokes crossing on the target
      [-38, 38].forEach((r, i) => mk('vf-slash', { left: b.x + 'px', top: b.y + 'px', '--r': r + 'deg', '--c': c, '--d': i * 55 + 'ms', '--w': Math.max(40, b.w * 0.95) + 'px' }, 520));
      mk('vf-flashdot', { left: b.x + 'px', top: b.y + 'px', '--c': c, '--s': b.w * 0.8 + 'px' }, 320);
    },
    assassin(a, b, c) {   // a streak across the gap, two thin cuts, and the attacker blinks
      mk('vf-dash', { left: a.x + 'px', top: a.y + 'px', '--len': dst(a, b) + 'px', '--r': ang(a, b) + 'deg', '--c': c }, 340);
      [-14, 22].forEach((r, i) => mk('vf-cut', { left: b.x + 'px', top: b.y + 'px', '--r': r + 'deg', '--c': i ? '#ff5b82' : '#e7d2ff', '--d': 90 + i * 70 + 'ms', '--w': Math.max(34, b.w * 0.9) + 'px' }, 520));
    },
    mage(a, b, c) {   // an orb travels, then opens into a ring of light
      mk('vf-rune small', { left: a.x + 'px', top: a.y + 'px', '--c': c }, 520);
      const o = mk('vf-orb', { left: a.x + 'px', top: a.y + 'px', '--c': c }, 520);
      if (o) { requestAnimationFrame(() => requestAnimationFrame(() => { o.style.left = b.x + 'px'; o.style.top = b.y + 'px'; })); setTimeout(() => { o.style.opacity = '0'; }, 230); }
      setTimeout(() => {
        mk('vf-ring', { left: b.x + 'px', top: b.y + 'px', '--c': c, '--s': b.w * 1.5 + 'px' }, 520);
        for (let k = 0; k < 6; k++) mk('vf-star', { left: b.x + 'px', top: b.y + 'px', '--c': c, '--a': k * 60 + 'deg', '--dd': 26 + (k % 2) * 12 + 'px' }, 600);
      }, 210);
    },
    marksman(a, b, c) {   // a thin fast tracer with a crosshair on the target
      mk('vf-muzzle', { left: a.x + 'px', top: a.y + 'px', '--c': c, '--r': ang(a, b) + 'deg' }, 200);
      mk('vf-bolt', { left: a.x + 'px', top: a.y + 'px', '--len': dst(a, b) + 'px', '--r': ang(a, b) + 'deg', '--c': c }, 300);
      setTimeout(() => mk('vf-cross', { left: b.x + 'px', top: b.y + 'px', '--c': c, '--s': b.w * 0.9 + 'px' }, 420), 90);
    },
    guardian(a, b, c) {   // a flat metal shockwave with sparks
      mk('vf-wave', { left: b.x + 'px', top: b.y + 'px', '--c': c, '--s': b.w * 1.7 + 'px' }, 520);
      for (let k = 0; k < 5; k++) mk('vf-spark', { left: b.x + 'px', top: b.y + 'px', '--a': -80 + k * 40 + 'deg', '--c': '#fff', '--dd': 22 + (k % 2) * 10 + 'px' }, 420);
    },
    support(a, b, c) {   // a soft pulse and a few sparkles
      mk('vf-ring soft', { left: b.x + 'px', top: b.y + 'px', '--c': c, '--s': b.w * 1.3 + 'px' }, 600);
      for (let k = 0; k < 4; k++) mk('vf-mote', { left: b.x + (k - 1.5) * 10 + 'px', top: b.y + 'px', '--c': c, '--d': k * 60 + 'ms' }, 800);
    },
  };

  const CAST = {
    fighter(a, c) { mk('vf-quake', { left: a.x + 'px', top: a.y + a.h * 0.35 + 'px', '--c': c, '--s': a.w * 3.2 + 'px' }, 700); },
    assassin(a, c) { mk('vf-smoke', { left: a.x + 'px', top: a.y + 'px', '--c': c, '--s': a.w * 2 + 'px' }, 700); for (let k = 0; k < 8; k++) mk('vf-star dark', { left: a.x + 'px', top: a.y + 'px', '--c': c, '--a': k * 45 + 'deg', '--dd': 36 + 'px' }, 600); },
    mage(a, c) { mk('vf-rune', { left: a.x + 'px', top: a.y + 'px', '--c': c, '--s': a.w * 2.6 + 'px' }, 900); mk('vf-ring', { left: a.x + 'px', top: a.y + 'px', '--c': c, '--s': a.w * 2.2 + 'px' }, 600); },
    marksman(a, c) { mk('vf-cross big', { left: a.x + 'px', top: a.y + 'px', '--c': c, '--s': a.w * 1.8 + 'px' }, 600); },
    guardian(a, c) { mk('vf-dome', { left: a.x + 'px', top: a.y + 'px', '--c': c, '--s': a.w * 2.6 + 'px' }, 800); },
    support(a, c) { mk('vf-ring soft big', { left: a.x + 'px', top: a.y + 'px', '--c': c, '--s': a.w * 3 + 'px' }, 800); for (let k = 0; k < 6; k++) mk('vf-mote', { left: a.x + (k - 2.5) * 12 + 'px', top: a.y + 'px', '--c': c, '--d': k * 70 + 'ms' }, 900); },
  };

  function attack(from, to, elFrom, elTo, ui) {
    if (calm() || !from || !to || !elFrom || !elTo) return false;
    const role = from.role || (from.isHero ? 'fighter' : null), fn = ATTACK[role]; if (!fn) return false;
    const a = ctr(elFrom), b = ctr(elTo);
    fn(a, b, COL[role]);
    if (ui && ui.sfx) ui.sfx('v_' + role);
    if (role === 'assassin') { elFrom.classList.add('vf-blink'); setTimeout(() => elFrom.classList.remove('vf-blink'), 260); }
    return true;
  }
  function cast(f, el, ui) {
    if (calm() || !f || !el) return;
    const role = f.role || null, fn = CAST[role]; if (!fn) return;
    const col = role === 'mage' ? ((AMB.DATA.WORLDS[f.world] || {}).color || COL.mage) : COL[role];
    fn(ctr(el), col);
    if (ui && ui.sfx) ui.sfx('c_' + role);
  }
  AMB.VFX = { attack, cast, COL };
})();

;
/* ui/net-ui.js */
/*
 * Play against a friend, each on their own phone (ui side of core/netsync.js).
 *   host: "سوّ غرفة" -> a room code (XXXXX-XXXXX, 50 random bits) -> the friend types it in "ادخل غرفة" -> both pick a hero -> same match, same seed.
 * The two phones talk directly (WebRTC through the free PeerJS broker, loaded only when you open a room); when that fails,
 * through the ntfy.sh relay (topic and HMAC key derived from the code: strangers can neither find the room nor inject messages).
 * Only the moves of each prep round are sent; both phones replay them and get the identical fight.
 */
(function () {
  const AMB = globalThis.AMB;
  const UI = () => globalThis.AMB_UI;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const N = AMB.NetSync;
  // room codes: 10 characters (50 bits, crypto random) from an alphabet without I/O/0/1, shown as XXXXX-XXXXX. See core/netsync.js
  const randCode = () => N.newCode();
  const PEER_SRC = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
  // Subresource Integrity of that exact file: sha384 of dist/peerjs.min.js inside the npm tarball peerjs-1.5.4.tgz (tarball checked
  // against the registry's sha512 integrity; unpkg serves the tarball's files byte for byte). If it ever fails to load, play falls back to the relay.
  const PEER_SRI = 'sha384-nlUQ8ZqCbvStErob+biJNzSgltf6urV3VGqhfIfzhmg9RXmpeRm76ELw0pYnKlTR';
  const useLocal = () => /[?&]nettest=1/.test(location.search);   // two tabs of the same browser (for testing without internet)

  // ------------------------------------------------------------------ transports: both give a "link" { send(obj), onmessage, onclose, close() }
  function makeLink(raw) { return { raw, onmessage: null, onclose: null, send: null, close: null }; }
  function loadPeerJS() {
    return new Promise((res, rej) => {
      if (globalThis.Peer) return res();
      const s = document.createElement('script'); s.src = PEER_SRC; s.integrity = PEER_SRI; s.crossOrigin = 'anonymous'; s.onload = () => res(); s.onerror = () => rej(Object.assign(new Error('load'), { type: 'load' }));
      document.head.appendChild(s); setTimeout(() => rej(Object.assign(new Error('load'), { type: 'load' })), 15000);
    });
  }
  // STUN finds your public address; TURN relays the game when two phones cannot reach each other directly (mobile networks usually need it)
  const ICE = { iceServers: [
    { urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:global.stun.twilio.com:3478' },
    { urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443', 'turn:openrelay.metered.ca:443?transport=tcp'], username: 'openrelayproject', credential: 'openrelayproject' },
  ] };
  function openPeer(id) {
    return new Promise((res, rej) => {
      const p = id ? new Peer(id, { debug: 0, config: ICE }) : new Peer({ debug: 0, config: ICE });
      const to = setTimeout(() => rej(Object.assign(new Error('broker'), { type: 'broker' })), 15000);
      p.on('open', () => { clearTimeout(to); res(p); }); p.on('error', (e) => { clearTimeout(to); rej(e); });
      // the broker drops idle phones (screen off, app in background): reconnect so the room code keeps working
      p.on('disconnected', () => { try { p.reconnect(); } catch (e) { /* ignore */ } });
    });
  }
  function wrapConn(conn) {
    const link = makeLink(conn);
    link.send = (o) => { try { conn.send(JSON.stringify(o)); } catch (e) { /* closed */ } };
    link.close = () => { try { conn.close(); } catch (e) { /* ignore */ } };
    conn.on('data', (d) => { try { link.onmessage && link.onmessage(JSON.parse(d)); } catch (e) { /* ignore bad message */ } });
    conn.on('close', () => link.onclose && link.onclose());
    conn.on('error', () => link.onclose && link.onclose());
    return link;
  }
  const Peers = {
    async host() {
      await loadPeerJS();
      for (let i = 0; i < 6; i++) {
        const code = randCode();
        try {
          const peer = await openPeer(N.room(code).peerId);   // a one-way hash of the code: the broker never sees the code itself
          const linked = new Promise((res) => peer.on('connection', (c) => { c.on('open', () => res(wrapConn(c))); }));
          return { code, linked, close: () => { try { peer.destroy(); } catch (e) { /* ignore */ } } };
        } catch (e) { if (!e || e.type !== 'unavailable-id') throw e; }
      }
      throw new Error('no id');
    },
    async join(code, step, ms) {
      step = step || (() => {});
      await loadPeerJS(); step('٢/٣ الاتصال بخدمة الغرف…');
      const peer = await openPeer(); step('٣/٣ أبحث عن الغرفة وأربط الجوالين… (قد تاخذ نص دقيقة)');
      return new Promise((res, rej) => {
        const conn = peer.connect(N.room(code).peerId, { reliable: true });
        const to = setTimeout(() => rej(Object.assign(new Error('connect'), { type: 'connect' })), ms || 25000);   // found the room but cannot link the two phones
        peer.on('error', (e) => { clearTimeout(to); rej(e); });
        conn.on('error', () => { clearTimeout(to); rej(Object.assign(new Error('connect'), { type: 'connect' })); });
        conn.on('open', () => { clearTimeout(to); res(wrapConn(conn)); });
      });
    },
  };
  const Locals = {   // BroadcastChannel: lets two tabs of one browser play each other
    async host() {
      const code = randCode(), id = 'h' + Math.random(), ch = new BroadcastChannel('zor-' + code);
      const linked = new Promise((res) => { ch.onmessage = (ev) => { if (ev.data.t === 'join') { const link = mkLocal(ch, id, ev.data.id); ch.postMessage({ t: 'welcome', from: id, to: ev.data.id }); res(link); } }; });
      return { code, linked, close: () => {} };
    },
    async join(code) {
      const id = 'g' + Math.random(), ch = new BroadcastChannel('zor-' + code);
      return new Promise((res, rej) => {
        const to = setTimeout(() => rej(new Error('timeout')), 4000);
        ch.onmessage = (ev) => { if (ev.data.t === 'welcome' && ev.data.to === id) { clearTimeout(to); res(mkLocal(ch, id, ev.data.from)); } };
        ch.postMessage({ t: 'join', id });
      });
    },
  };
  function mkLocal(ch, me, other) {
    const link = makeLink(ch);
    link.send = (o) => ch.postMessage({ t: 'msg', from: me, to: other, d: JSON.stringify(o) });
    link.close = () => { ch.postMessage({ t: 'bye', from: me, to: other }); };
    ch.onmessage = (ev) => { const m = ev.data; if (m.to !== me || m.from !== other) return; if (m.t === 'msg') link.onmessage && link.onmessage(JSON.parse(m.d)); else if (m.t === 'bye') link.onclose && link.onclose(); };
    return link;
  }
  // ---- fallback: relay the messages through a free public pub/sub service (ntfy.sh). Slower than a direct link but it works on any network
  // that can open a web page (mobile carriers often block direct phone-to-phone links). Messages are tiny: only each player's moves.
  // the relay may be changed from the link only to ntfy itself or a local test server (a shared link must not be able to redirect every game message to a stranger's server)
  const RELAY = (() => { const m = /[?&]relay=([^&]+)/.exec(location.search); if (!m) return 'https://ntfy.sh'; try { const u = new URL(decodeURIComponent(m[1])); return (/(^|\.)ntfy\.sh$/.test(u.hostname) && u.protocol === 'https:') || /^(localhost|127\.0\.0\.1)$/.test(u.hostname) ? u.origin : 'https://ntfy.sh'; } catch (e) { return 'https://ntfy.sh'; } })();
  // Security (4.3): the topic is a one-way hash of the room code (unguessable, does not reveal the code), and every message is
  // signed with HMAC-SHA256 under a key also derived from the code. A message that fails the check (a stranger, an old build,
  // a tampered relay) is dropped without a word. Both phones run the same build anyway (version handshake on the hero step).
  const relayGet = (R, ev) => { try { return N.open(R.key, JSON.parse(ev.data).message); } catch (e) { return null; } };
  const relayPost = (R, obj) => fetch(`${RELAY}/${R.topic}`, { method: 'POST', body: N.seal(R.key, obj) });
  function relayLink(code, me, other) {
    const R = N.room(code), link = makeLink(null), seen = new Set(), pending = []; let seq = 0, sending = false, closed = false, es = null;
    const open = () => {
      es = new EventSource(`${RELAY}/${R.topic}/sse?since=10m`);
      es.onmessage = (ev) => {
        const m = relayGet(R, ev);
        if (!m || m.to !== me || m.from !== other || (m.t !== 'msg' && m.t !== 'bye') || seen.has(m.seq)) return;   // only my friend's messages, each once (a reconnect replays recent ones)
        seen.add(m.seq); if (m.t === 'bye') { link.onclose && link.onclose(); return; }
        link.onmessage && link.onmessage(m.o);
      };
    };
    const flush = async () => {
      if (sending) return; sending = true;
      while (pending.length && !closed) { try { const r = await relayPost(R, pending[0]); if (!r.ok) throw new Error('http ' + r.status); pending.shift(); } catch (e) { await new Promise((res) => setTimeout(res, 1500)); } }
      sending = false;
    };
    link.send = (o) => { pending.push({ t: 'msg', from: me, to: other, seq: ++seq, o }); flush(); };
    link.close = () => { pending.push({ t: 'bye', from: me, to: other, seq: ++seq }); flush(); closed = true; setTimeout(() => { try { es && es.close(); } catch (e) { /* ignore */ } }, 1500); };
    link.start = open; link.kind = 'relay';
    return link;
  }
  const Relays = {
    async host(code) {
      const R = N.room(code), id = 'h' + N.newCode().slice(0, 8);
      let es; const linked = new Promise((res, rej) => {
        es = new EventSource(`${RELAY}/${R.topic}/sse?since=10m`);
        es.onmessage = async (ev) => {
          const m = relayGet(R, ev);
          if (!m || m.t !== 'hello' || typeof m.id !== 'string') return;
          es.close(); const link = relayLink(code, id, m.id); link.start();
          await relayPost(R, { t: 'welcome', from: id, to: m.id }).catch(() => {});
          res(link);
        };
      });
      return { code, linked, close: () => { try { es.close(); } catch (e) { /* ignore */ } } };
    },
    async join(code, step) {
      const R = N.room(code), id = 'g' + N.newCode().slice(0, 8);
      step && step('أتصل عن طريق الخدمة الاحتياطية…');
      return new Promise((res, rej) => {
        const es = new EventSource(`${RELAY}/${R.topic}/sse?since=1m`); let tries = 0;
        const hello = () => relayPost(R, { t: 'hello', id }).catch(() => {});
        es.onopen = () => hello();
        const iv = setInterval(() => { if (++tries > 8) { clearInterval(iv); es.close(); rej(Object.assign(new Error('relay'), { type: 'relay' })); } else hello(); }, 5000);
        es.onmessage = (ev) => { const m = relayGet(R, ev); if (m && m.t === 'welcome' && m.to === id && typeof m.from === 'string') { clearInterval(iv); es.close(); const link = relayLink(code, id, m.from); link.start(); res(link); } };
        es.onerror = () => { /* EventSource retries by itself; the tries counter ends the wait */ };
      });
    },
  };
  // host: open BOTH kinds of room with the same code (the first friend to arrive wins). join: try the direct link, then fall back to the relay.
  const Both = {
    async host() {
      let direct = null, relay;
      try { direct = await Peers.host(); } catch (e) { direct = null; }
      const code = direct ? direct.code : randCode();
      relay = await Relays.host(code);
      const linked = new Promise((res) => { if (direct) direct.linked.then((l) => { relay.close(); res(l); }); relay.linked.then((l) => { if (direct) direct.close(); res(l); }); });
      return { code, linked, close: () => { relay.close(); if (direct) direct.close(); } };
    },
    async join(code, step) {
      try { return await Peers.join(code, step, 12000); }
      catch (e) { return Relays.join(code, step); }   // any failure of the direct link: use the relay
    },
  };
  const RelayOnly = { host: () => { const code = randCode(); return Relays.host(code); }, join: (code, step) => Relays.join(code, step) };
  const transport = () => (useLocal() ? Locals : /[?&]forcerelay=1/.test(location.search) ? RelayOnly : Both);

  // ------------------------------------------------------------------ lobby
  let room = null;   // { code, close } while waiting for a friend
  const ui = () => UI();
  function fresh(idx, link) { return { idx, link, theirHero: null, theirStart: null, myHero: null, inbox: null, sentReady: false, peerReady: null, iClaimed: false, peerReward: null, rec: null, over: false }; }

  function openMenu() {
    ui().modal(`<h2>العب ضد صاحبك</h2><p class="hint">كل واحد من جواله. واحد يسوّي غرفة ويعطي صاحبه الرمز، والثاني يدخلها.</p>
      <div class="net-btns"><button class="btn primary big" data-act="netHost">سوّ غرفة</button><button class="btn big" data-act="netJoin">ادخل غرفة</button></div>
      <p class="hint">تحتاج نت للاثنين. أول 3 مباريات مع أصحابك كل يوم تنحسب في ممر الصدع (بدون شظايا)، والأبطال كلهم مفتوحين.</p>`);
  }
  async function host() {
    ui().modal(`<h2>جاري تجهيز الغرفة…</h2><p class="hint">لحظة</p>`);
    try {
      room = await transport().host();
    } catch (e) { ui().modal(`<h2>ما قدرت أسوّي الغرفة</h2><p class="hint">${explain(e)}</p><div class="net-btns"><button class="btn" data-act="closeModal">تمام</button></div>`); return; }
    const code = room.code; keepAwake();
    ui().modal(`<h2>غرفتك جاهزة</h2><p class="hint">أعطِ صاحبك هالرمز، وخلّه يضغط «ادخل غرفة»:</p>
      <div class="net-code" dir="ltr">${N.showCode(code)}</div>
      <div class="net-btns"><button class="btn" data-act="netCopy">نسخ الرمز</button><button class="btn" data-act="netShare">إرسال</button><button class="btn ghost" data-act="netCancel">إلغاء</button></div>
      <div class="net-btns"><button class="btn small" data-act="netDiag">فحص الاتصال</button></div><div class="hint" id="net-diag" dir="rtl" style="text-align:right"></div>
      <p class="hint" id="net-status">ننتظر صاحبك… <b>لا تطفّي الشاشة ولا تطلع من اللعبة</b> لين يدخل</p>`);
    const myRoom = room;
    myRoom.linked.then((link) => { if (room !== myRoom) { link.close(); return; } room = null; connected(0, link); });
  }
  function joinForm() {
    ui().modal(`<h2>ادخل غرفة</h2><p class="hint">اكتب الرمز اللي عطاك إياه صاحبك:</p>
      <input id="net-in" class="net-input" dir="ltr" maxlength="16" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="XXXXX-XXXXX">
      <div class="net-btns"><button class="btn primary big" data-act="netJoinGo">دخول</button><button class="btn ghost" data-act="closeModal">إلغاء</button></div><p class="hint" id="net-status"></p>
      <div class="net-btns"><button class="btn small" data-act="netDiag">فحص الاتصال</button></div><div class="hint" id="net-diag" dir="rtl" style="text-align:right"></div>`);
    setTimeout(() => { const i = document.getElementById('net-in'); if (i) i.focus(); }, 100);
  }
  async function join() {
    const input = document.getElementById('net-in'), code = N.normCode(input && input.value);
    const st = document.getElementById('net-status');
    if (!code) { if (st) st.textContent = 'الرمز ١٠ حروف وأرقام (مثل ABCDE-23456). تأكد منه واكتبه كامل'; return; }
    const step = (t) => { const e = document.getElementById('net-status'); if (e) e.textContent = t; };
    step('١/٣ تحميل خدمة الاتصال…');
    try { const link = await transport().join(code, step); connected(1, link); }
    catch (e) { if (st) st.textContent = explain(e); }
  }

  // connection check: tells you which of the three needed things works on THIS phone / network
  async function diagnose(out) {
    const line = (ok, t) => { out.innerHTML += `<div>${ok === null ? '⏳' : ok ? '✅' : '❌'} ${t}</div>`; };
    const time = async (fn) => { const t0 = Date.now(); try { const r = await fn(); return [true, Date.now() - t0, r]; } catch (e) { return [false, Date.now() - t0, e]; } };
    out.innerHTML = '';
    let r2;
    let r = await time(() => loadPeerJS()); line(r[0], `خدمة الاتصال (تحميل المكتبة): ${r[0] ? r[1] + ' ms' : 'فشل'}`);
    r = await time(() => new Promise((res, rej) => { const w = new WebSocket('wss://0.peerjs.com/peerjs?key=peerjs&id=zorchk' + Math.random().toString(36).slice(2, 8) + '&token=x'); const to = setTimeout(() => { try { w.close(); } catch (e) { /* ignore */ } rej(new Error('timeout')); }, 9000); w.onopen = () => { clearTimeout(to); w.close(); res(); }; w.onerror = () => { clearTimeout(to); rej(new Error('error')); }; }));
    line(r[0], `خدمة الغرف (الوسيط): ${r[0] ? r[1] + ' ms' : 'ما وصلت'}`);
    r = await time(() => new Promise((res) => {
      const types = new Set(); const pc = new RTCPeerConnection(ICE); pc.createDataChannel('x');
      pc.onicecandidate = (e) => { if (e.candidate) { const m = / typ (\w+)/.exec(e.candidate.candidate); if (m) types.add(m[1]); } else { pc.close(); res(types); } };
      pc.createOffer().then((o) => pc.setLocalDescription(o)); setTimeout(() => { try { pc.close(); } catch (e) { /* ignore */ } res(types); }, 9000);
    }));
    r2 = await time(() => new Promise((res, rej) => { const to = setTimeout(() => { try { es.close(); } catch (e) { /* ignore */ } rej(new Error('timeout')); }, 9000); const es = new EventSource(`${RELAY}/zor-check-${Math.random().toString(36).slice(2, 8)}/sse`); es.onopen = () => { clearTimeout(to); es.close(); res(); }; }));
    line(r2[0], `الخدمة الاحتياطية (ترحيل الرسائل): ${r2[0] ? r2[1] + ' ms' : 'ما وصلت'}`);
    const T = [...r[2]]; line(T.includes('srflx') || T.includes('relay'), `ربط الجوالين: ${T.length ? T.join(' + ') : 'ما وصلت أي إشارة'}${T.includes('relay') ? ' (فيه ترحيل)' : T.includes('srflx') ? '' : ' ← الشبكة تمنع الربط المباشر'}`);
    out.innerHTML += '<div class="hint" style="margin-top:6px">صوّر هالنتيجة وارسلها لي</div>';
  }

  // say WHAT failed, so a bad code is not confused with a blocked network
  function explain(e) {
    const t = (e && (e.type || e.message)) || '';
    if (t === 'peer-unavailable' || t === 'timeout') return 'ما لقيت الغرفة. تأكد من الرمز، وإن صاحبك فاتح نافذة «غرفتك جاهزة» وما طفى الشاشة';
    if (t === 'relay') return 'ما لقيت الغرفة. تأكد من الرمز، وإن صاحبك فاتح نافذة «غرفتك جاهزة»، والنت شغّال عند الاثنين';
    if (t === 'load') return 'ما قدرت أحمّل خدمة الاتصال. النت عندك ممكن يحجبها، جرّب واي فاي أو شبكة ثانية';
    if (t === 'broker' || t === 'network' || t === 'server-error' || t === 'socket-error' || t === 'socket-closed') return 'ما قدرت أوصل لخدمة الغرف. تأكد من النت، أو جرّب شبكة ثانية';
    if (t === 'connect' || t === 'webrtc') return 'لقيت الغرفة بس ما قدرت أربط الجوالين. جرّبوا الاثنين على نفس الواي فاي، أو غيّروا الشبكة';
    return 'ما قدرت أتصل (' + t + '). جرّب مرة ثانية';
  }
  // keep the phone awake while waiting in the room
  let wake = null;
  const keepAwake = async () => { try { if (navigator.wakeLock) wake = await navigator.wakeLock.request('screen'); } catch (e) { /* ignore */ } };
  const letSleep = () => { try { if (wake) wake.release(); } catch (e) { /* ignore */ } wake = null; };

  function connected(idx, link) {
    letSleep();
    const S = ui().S;
    S.net = fresh(idx, link);
    link.onmessage = onMessage;
    link.onclose = onClose;
    S.mode = 'online'; S.picks = [null, null]; S.pickIdx = 0;
    ui().closeModal();
    ui().toast('اتصلت مع صاحبك ✓', 'good');
    ui().renderHeroSelect(); ui().show('hero');
  }

  // after "confirm" on the hero screen
  function heroChosen(hero) {
    const S = ui().S, n = S.net; if (!n) return;
    n.myHero = hero;
    // online matches are always equal: card power and hero level are never sent or applied (progress is for the campaign/tower/events only)
    n.link.send({ t: 'hero', hero, ver: buildOf() });
    waiting('ننتظر صاحبك يختار بطله…');
    tryStart();
  }
  function tryStart() {
    const S = ui().S, n = S.net; if (!n || !n.myHero || !n.theirHero) return;
    if (n.idx === 0) {   // the host decides the seed
      const seed = 1 + Math.floor(Math.random() * 2 ** 30);
      const weekly = AMB.Match.weeklyNow();   // the host's rule of the week, so both phones play the same rule
      n.link.send({ t: 'start', seed, heroes: [n.myHero, n.theirHero], weekly });
      n.weekly = weekly; begin(seed, [n.myHero, n.theirHero]);
    } else if (n.theirStart) { n.weekly = AMB.Match.WEEKLY[n.theirStart.weekly] ? n.theirStart.weekly : null; begin(n.theirStart.seed, n.theirStart.heroes); }
  }
  function begin(seed, heroes) {
    const S = ui().S, n = S.net;
    n.seed = seed; n.heroes = heroes; n.started = true;
    ui().closeOverlay();
    ui().startMatch();
  }
  /** called by ui.js startMatch() when S.mode === 'online' */
  function makeMatch() {
    const S = ui().S, n = S.net, i = n.idx;
    const players = n.heroes.map((h, k) => ({ heroId: h, name: k === i ? 'أنت' : 'صاحبك', cardPower: null, heroLevel: 1 }));
    const m = new AMB.Match({ mode: 'online', seed: n.seed, isolated: true, players, weekly: n.weekly || null });
    n.rec = AMB.NetSync.record(m, i);
    n.sentReady = false; n.peerReady = null; n.iClaimed = false; n.peerReward = null; n.over = false;
    // B7: after every fight both phones compare who won, both lives and the fight length (same channel as the state hash)
    const resolve = m.resolveCombat;
    m.resolveCombat = function (result) { const rep = resolve.call(this, result); if (S.net === n) shareValue('c' + rep.round, AMB.NetSync.combatPrint(rep)); return rep; };
    return m;
  }

  // ------------------------------------------------------------------ in the match
  function waiting(text, ms) {
    const n0 = ui().S.net; if (n0) { clearTimeout(n0.waitT); n0.waitT = null; }
    // a friend who never answers (closed the app, frozen) must not hold the match forever
    if (n0 && ms) n0.waitT = setTimeout(() => { const n1 = ui().S.net; if (n1 === n0 && !n1.over && document.querySelector('.net-wait')) netProblem('صاحبك ما رد من فترة طويلة. ممكن انقطع. ارجعوا للقائمة وجرّبوا من جديد.'); }, ms);
    ui().overlay(`<div class="ov-card net-wait"><h2>${esc(text)}</h2><div class="net-dots"><i></i><i></i><i></i></div>
      <div class="net-btns"><button class="btn ghost" data-act="netLeave">اخرج</button></div></div>`);
  }
  function iAmReady() {
    const S = ui().S, n = S.net, m = S.match;
    const ops = n.rec.take();
    n.sentReady = true;
    n.link.send({ t: 'ready', round: m.round, ops });
    S.phase = 'waiting';
    ui().renderMatch(true);
    if (!n.peerReady || n.peerReady.round !== m.round) waiting('جاهز! ننتظر صاحبك…', 150000);
    pump();
  }
  function rewardClaimed() {
    const S = ui().S, n = S.net, m = S.match;
    n.iClaimed = true;
    n.link.send({ t: 'reward', round: m.round, ops: n.rec.take() });
    if (!n.peerReward || n.peerReward.round !== m.round) waiting('ننتظر صاحبك يختار مكافأته…', 150000);
    pump();
  }
  // the two phones disagree (bad message, different versions): end the match cleanly instead of hanging on "waiting for your friend"
  function netProblem(text) {
    const S = ui().S, n = S.net; if (!n || n.over) return;
    n.over = true; try { n.link.send({ t: 'leave' }); } catch (e) { /* ignore */ }
    ui().closeOverlay();
    ui().modal(`<h2>اختلفت المباراة بين الجوالين</h2><p class="hint">${text}</p><div class="net-btns"><button class="btn primary" data-act="abandon">للقائمة</button></div>`);
  }
  const buildOf = () => { const m = document.querySelector('meta[name="zor-build"]'); return m ? m.content : 'dev'; };
  // desync check: after both phones applied everybody's moves they must hold the SAME state; each sends a fingerprint and compares it with the other's
  // keys: 'p<round>' after prep, 'r<round>' after the reward draft (state hash), 'c<round>' after the fight (combat fingerprint)
  function shareHash(key) {
    const S = ui().S, m = S.match; if (!S.net || !m) return;
    shareValue(key, AMB.NetSync.hash(m));
  }
  function shareValue(key, h) {
    const n = ui().S.net; if (!n) return;
    n.myHash = n.myHash || {}; n.peerHash = n.peerHash || {};
    n.myHash[key] = h;
    try { n.link.send({ t: 'sync', key, h }); } catch (e) { /* ignore */ }
    checkHash(key);
  }
  function checkHash(key) {
    const n = ui().S.net; if (!n || !n.myHash || !n.peerHash) return;
    if (n.myHash[key] == null || n.peerHash[key] == null || n.myHash[key] === n.peerHash[key]) return;
    if (key[0] === 'c') { console.warn('online: fight result differs', n.myHash[key], n.peerHash[key]); netProblem('نتيجة القتال طلعت غير عند صاحبك. غالبًا النسختين مختلفتين، حدّثوا الاثنين وابدأوا من جديد.'); }
    else netProblem('حالة اللعبة ما تطابقت بين الجوالين (غالبًا نسختين مختلفتين). حدّثوا الاثنين وابدأوا من جديد.');
  }
  function pump() {
    try { pumpInner(); } catch (e) { netProblem('صار خطأ في الاتصال. جرّبوا مباراة جديدة وتأكدوا إن الاثنين على آخر نسخة.'); }
  }
  function pumpInner() {
    const S = ui().S, n = S.net; if (!n || !S.match) return;
    const m = S.match, other = 1 - n.idx;
    if (n.sentReady && n.peerReady && n.peerReady.round === m.round && S.phase === 'waiting') {
      const bad = AMB.NetSync.replay(m, other, n.peerReady.ops);
      if (bad.length) { console.warn('online: replay problems', bad); netProblem('حركة صاحبك ما انطبقت عندك. غالبًا النسختين مختلفتين، حدّثوا الاثنين.'); return; }
      shareHash('p' + m.round);
      n.sentReady = false; n.peerReady = null;
      ui().closeOverlay();
      ui().startCombat();
    }
    if (n.iClaimed && n.peerReward && n.peerReward.round === m.round && S.phase === 'result') {
      const bad = AMB.NetSync.replay(m, other, n.peerReward.ops);
      if (bad.length) { console.warn('online: reward replay problems', bad); netProblem('جائزة صاحبك ما انطبقت عندك. حدّثوا الاثنين.'); return; }
      shareHash('r' + m.round);
      n.iClaimed = false; n.peerReward = null;
      ui().closeOverlay();
      ui().afterReward();
    }
  }
  const isHero = (h) => typeof h === 'string' && Object.prototype.hasOwnProperty.call(AMB.DATA.HEROES, h);
  function onMessage(msg) {
    const S = ui().S, n = S.net; if (!n || !msg) return;
    // teen #17: the friend already started the next game of the series while I am still on the results screen: keep its messages for later
    if (n.done && (msg.t === 'hero' || msg.t === 'start' || msg.t === 'again')) { (n.later = n.later || []).push(msg); return; }
    switch (msg.t) {
      case 'again': break;
      case 'hero': if (!isHero(msg.hero)) { netProblem('البطل اللي وصلنا من صاحبك مو معروف عندي. حدّثوا الاثنين.'); break; }
        if (msg.ver && buildOf() !== 'dev' && msg.ver !== 'dev' && msg.ver !== buildOf()) { netProblem('نسخة اللعبة عندك مختلفة عن صاحبك. حدّثوا الصفحة عند الاثنين وجرّبوا من جديد.'); break; }
        n.theirHero = msg.hero; tryStart(); break;
      case 'start': if (!Number.isInteger(msg.seed) || !Array.isArray(msg.heroes) || msg.heroes.length !== 2 || !msg.heroes.every(isHero)) { netProblem('بداية المباراة اللي وصلت من صاحبك مو مفهومة. حدّثوا الاثنين.'); break; }
        n.theirStart = msg; tryStart(); break;
      case 'ready': n.peerReady = msg; pump(); break;
      case 'reward': n.peerReward = msg; pump(); break;
      case 'sync': if (typeof msg.key !== 'string' || !/^[prc]\d{1,3}$/.test(msg.key) || typeof msg.h !== 'string' || msg.h.length > 80) break;
        n.peerHash = n.peerHash || {}; n.peerHash[msg.key] = msg.h; checkHash(msg.key); break;
      case 'leave': peerLeft(); break;
      default: break;
    }
  }
  function onClose() {
    const S = ui().S, n = S.net; if (!n || n.over || n.closing) return;
    if (S.match && !S.match.isOver) {
      n.over = true;
      ui().modal(`<h2>انقطع الاتصال</h2><p class="hint">صاحبك طلع أو النت انقطع.</p><div class="net-btns"><button class="btn primary" data-act="abandon">للقائمة</button></div>`);
    } else if (S.screen === 'hero' || S.phase === 'idle') {
      n.over = true; ui().closeOverlay();
      ui().modal(`<h2>انقطع الاتصال</h2><p class="hint">صاحبك طلع قبل ما تبدأ المباراة.</p><div class="net-btns"><button class="btn primary" data-act="abandon">للقائمة</button></div>`);
    }
  }
  function peerLeft() {
    const S = ui().S, n = S.net, m = S.match; if (!n || n.over) return;
    n.over = true;
    if (m && !m.isOver) {
      m.players[1 - n.idx].life = 0; m.winner = n.idx; m.phase = 'over';
      ui().closeModal(); ui().closeOverlay();
      ui().toast('صاحبك انسحب، فزت!', 'good');
      ui().showResults();
    } else {
      ui().closeOverlay();
      ui().modal(`<h2>صاحبك طلع</h2><p class="hint">طلع قبل ما تبدأ المباراة.</p><div class="net-btns"><button class="btn primary" data-act="abandon">للقائمة</button></div>`);
    }
  }
  function leave() {   // I leave: tell the friend, drop the link
    const S = ui().S, n = S.net; if (!n) return;
    n.closing = true;
    try { n.link.send({ t: 'leave' }); } catch (e) { /* ignore */ }
    setTimeout(() => { try { n.link.close(); } catch (e) { /* ignore */ } }, 250);
    S.net = null;
  }
  function cancelRoom() { letSleep(); if (room) { room.close(); room = null; } ui().closeModal(); }

  function installActions() {
    const u = ui(); if (!u || u.ACT.netHost) return;
    Object.assign(u.ACT, {
      netMenu: () => openMenu(),
      netAgain: () => rematch(),
      netHost: () => host(),
      netJoin: () => joinForm(),
      netJoinGo: () => join(),
      netCancel: () => cancelRoom(),
      netDiag: () => { const o = document.getElementById('net-diag'); if (o) { o.textContent = 'جاري الفحص…'; diagnose(o); } },
      netCopy: () => { const c = room && N.showCode(room.code); if (!c) return; try { navigator.clipboard.writeText(c); u.toast('نسخت الرمز', 'good'); } catch (e) { u.toast('الرمز: ' + c, ''); } },
      netShare: () => { const c = room && N.showCode(room.code); if (!c) return; const text = `تعال العب ضدي في ZOR! ادخل «ادخل غرفة» واكتب الرمز: ${c}\n${location.href.split('?')[0]}`; if (navigator.share) navigator.share({ text }).catch(() => {}); else { try { navigator.clipboard.writeText(text); u.toast('نسخت الدعوة', 'good'); } catch (e) { u.toast('الرمز: ' + c, ''); } } },
      netLeave: () => { leave(); u.ACT.abandon(); },
    });
  }

  // teen #17: a best-of-3 series with the same friend on the same link: the score carries over, and you cannot pick a hero you already used in it
  function seriesNote(m) {
    const S = ui().S, n = S.net; if (!n || !m || !m.isOver) return '';
    if (!n.done) {
      n.done = true; n.series = n.series || { me: 0, them: 0, used: [] };
      if (n.series.me >= 2 || n.series.them >= 2) n.series = { me: 0, them: 0, used: [] };   // a finished series: the next game starts a new one
      if (m.winner === n.idx) n.series.me++; else if (m.winner === 1 - n.idx) n.series.them++;
      if (n.myHero && !n.series.used.includes(n.myHero)) n.series.used.push(n.myHero);
    }
    const s = n.series, end = s.me >= 2 ? '🏆 فزت بالسلسلة!' : s.them >= 2 ? 'صاحبك فاز بالسلسلة' : 'سلسلة أفضل من 3';
    return `<div class="series-box"><b>${end}</b> · أنت <b>${s.me}</b> – <b>${s.them}</b> صاحبك${S.net && !n.over ? '<br><button class="btn primary" data-act="netAgain">⚔ المباراة الجاية مع صاحبك</button>' : ''}<small>في السلسلة ما تقدر تعيد نفس البطل</small></div>`;
  }
  function rematch() {
    const S = ui().S, n = S.net; if (!n || n.over) { ui().toast('الاتصال انقطع', 'err'); return; }
    const nx = fresh(n.idx, n.link); nx.series = n.series; S.net = nx;
    try { n.link.send({ t: 'again' }); } catch (e) { /* ignore */ }
    S.mode = 'online'; S.picks = [null, null]; S.pickIdx = 0; S.match = null;
    ui().renderHeroSelect(); ui().show('hero');
    (n.later || []).forEach((msg) => onMessage(msg));   // what the friend already sent for this game
  }
  const usedInSeries = (id) => { const n = ui().S.net; return !!(n && n.series && !(n.series.me >= 2 || n.series.them >= 2) && n.series.used.includes(id)); };

  AMB.NetUI = { seriesNote, rematch, usedInSeries, installActions, heroChosen, makeMatch, iAmReady, rewardClaimed, pump, leave, openMenu, useLocal };
  if (UI()) installActions();
})();

;
/* ui/tips-ui.js */
/*
 * Tap any badge on a card (world, role, skill, attack, health, rarity, cost, level, copies) and a small pop-up explains it.
 * The pop-up is NOT a window: it points at the badge, closes on the next tap / scroll, and never buys or selects the card.
 */
(function () {
  const AMB = globalThis.AMB, D = AMB.DATA;
  const { icon } = AMB.art;
  const UI = () => globalThis.AMB_UI;
  let pop = null, timer = 0;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const def = (id) => D.UNITS[id] || D.HEROES[id];
  const SM = () => AMB.CONFIG.stars.mult;
  const LABEL = { dmg: 'ضرر', heal: 'علاج', shield: 'درع', dps: 'ضرر/ث', stun: 'شلل (ث)', pct: 'نسبة' };
  const synLines = (sid) => (D.SYNERGIES[sid] ? D.SYNERGIES[sid].tiers.map((t) => `<div class="tp-l">• <b>${t.n}</b>: ${esc(t.text)}</div>`).join('') : '');

  function content(k, id, x) {
    const d = def(id); if (!d) return null;
    const isHero = !d.role;
    if (k === 'all') {   // small cards (phones): the icon strip opens ONE pop-up that explains world + role + skill together
      const parts = ['world', isHero ? 'herorole' : 'role'].concat(isHero ? [] : ['skill']).map((kk) => content(kk, id, x));
      return { ic: AMB.art.WORLD_ICON[d.world], title: d.name, color: D.WORLDS[d.world].color, html: parts.map((c) => `<div class="tp-sec"><div class="tp-sh">${icon(c.ic)}<b>${esc(c.title)}</b></div>${c.html.replace(/<div class="tp-s">التآزر[^<]*<\/div>/, '')}</div>`).join('') };
    }
    switch (k) {
      case 'world': { const W = D.WORLDS[d.world]; return { ic: AMB.art.WORLD_ICON[d.world], title: W.name, color: W.color, html: `<div class="tp-s">التآزر: كل ما جمعت وحدات أكثر من هالعالم يقوّون:</div>${synLines(d.world)}` }; }
      case 'role': { const R = D.ROLES[d.role]; return { ic: AMB.art.ROLE_ICON[d.role], title: R.name, html: `<div class="tp-l">${esc(R.desc)}</div><div class="tp-s">مكانه: <b>${esc(R.place)}</b></div>${synLines(d.role)}` }; }
      case 'herorole': return { ic: 'crown', title: 'بطل', html: `<div class="tp-l"><b>${esc(d.passive.name)}</b>: ${esc(d.passive.text)}</div><div class="tp-s">هو قائدك: حياته هي حياتك، وإذا سقط تخسر.</div>` };
      case 'skill': {
        const s = d.skill, st = +x || 1, rows = [];
        Object.keys(s).forEach((key) => { if (Array.isArray(s[key]) && s[key].length === 3 && LABEL[key]) rows.push(`<div class="tp-l"><b>${LABEL[key]}</b>: <span class="tp-v ${st === 1 ? 'on' : ''}">★ ${s[key][0]}</span> <span class="tp-v ${st === 2 ? 'on' : ''}">★★ ${s[key][1]}</span> <span class="tp-v ${st === 3 ? 'on' : ''}">★★★ ${s[key][2]}</span></div>`); });
        return { ic: AMB.art.SKILL_ICON[s.type] || 'star', title: s.name, html: `<div class="tp-l">${esc(s.text)}</div>${rows.join('')}<div class="tp-s">تشتغل لما تمتلئ المانا (${d.mana}).</div>` };
      }
      case 'atk': case 'hp': {
        const lab = k === 'atk' ? 'الهجوم' : 'الصحة', base = isHero ? (k === 'atk' ? d.board.atk : 100) : (k === 'atk' ? d.atk : d.hp), m = SM();
        const v = (s) => Math.round(base * (isHero ? 1 : m[s]));
        return { ic: k === 'atk' ? 'sword' : 'heart', title: lab, html: isHero ? `<div class="tp-l">${k === 'atk' ? 'هجومه لما تنزّله الساحة (ويزيد كل جولة).' : 'حياة البطل = حياتك في المباراة.'}</div>` : `<div class="tp-l"><span class="tp-v">★ ${v(1)}</span> <span class="tp-v">★★ ${v(2)}</span> <span class="tp-v">★★★ ${v(3)}</span></div><div class="tp-s">كل نجمة ترفع القوة. ٣ نسخ متطابقة = نجمة.</div>` };
      }
      case 'rar': { const R = AMB.ECONOMY.rarities[d.rarity]; return { ic: 'gem', title: R.name, color: R.color, html: `<div class="tp-l">قوة إضافية <b>+${Math.round((R.power - 1) * 100)}%</b> في كل الأطوار (ما عدا «على نفس الجهاز»).</div><div class="tp-s">نسخ التطوير للمستويات 2–5: ${R.copies.join(' / ')}</div>` }; }
      case 'lvl': return { ic: 'up', title: 'مستوى ' + x, html: `<div class="tp-l">كل مستوى <b>+${Math.round(AMB.ECONOMY.cards.levelBonus * 100)}%</b> صحة وهجوم، في كل الأطوار ما عدا «على نفس الجهاز».</div><div class="tp-s">تطوّره بالنسخ المكررة من «مجموعتي».</div>` };
      case 'cost': return { ic: 'gold', title: d.cost + ' ذهب', html: `<div class="tp-l">سعر الشراء (فئة ${d.tier}).</div><div class="tp-s">البيع يرجّع نفس السعر.</div>` };
      case 'own': return { ic: 'star', title: x === 'up' ? '↑' : '×' + x, html: x === 'up' ? '<div class="tp-l">عندك نسختين: لو اشتريتها تتطور لنجمة أقوى!</div>' : `<div class="tp-l">عندك ${x} نسخة منها. ٣ نسخ متطابقة تندمج لنجمة.</div>` };
    }
    return null;
  }

  function close() { if (pop) { pop.remove(); pop = null; } clearTimeout(timer); }
  function open(el, c) {
    close();
    pop = document.createElement('div'); pop.className = 'tip-pop';
    pop.innerHTML = `<div class="tp-h" style="${c.color ? `--c:${c.color}` : ''}">${icon(c.ic)}<b>${esc(c.title)}</b></div>${c.html}<i class="tp-arrow"></i>`;
    document.body.appendChild(pop);
    const r = el.getBoundingClientRect(), pw = pop.offsetWidth, ph = pop.offsetHeight, vw = innerWidth, vh = innerHeight;
    let left = r.left + r.width / 2 - pw / 2; left = Math.max(6, Math.min(vw - pw - 6, left));
    const above = r.top - ph - 12 > 4, top = above ? r.top - ph - 10 : Math.min(vh - ph - 6, r.bottom + 10);
    pop.style.left = left + 'px'; pop.style.top = top + 'px';
    const ar = pop.querySelector('.tp-arrow'); ar.style.left = Math.max(10, Math.min(pw - 22, r.left + r.width / 2 - left - 6)) + 'px'; ar.classList.toggle('dn', !above);
    timer = setTimeout(close, 7000);
  }

  function installActions() {
    const ui = UI(); if (!ui || ui.ACT.tip) return;
    ui.ACT.tip = (d, el, e) => { if (e) e.stopPropagation(); const c = content(d.k, d.id, d.x); if (c) { ui.sfx && ui.sfx('click'); open(el, c); } };
  }
  // any other tap or a scroll closes it (capture phase so the tap still does its normal job)
  document.addEventListener('click', (e) => { if (pop && !e.target.closest('[data-act="tip"]') && true) close(); }, true);
  window.addEventListener('scroll', close, true);
  window.addEventListener('resize', close);

  AMB.TipsUI = { open, close, content, installActions };
  if (UI()) installActions();
})();

;
/* ui/gift-ui.js */
/*
 * Welcome gift: 5 packs opened one by one (new players right after choosing their first hero; old saves get an offer
 * on the main menu). Afterwards a first deck is built for you. Logic: AMB.packs.gift() in core/packs.js.
 */
(function () {
  const AMB = globalThis.AMB;
  const $ = (id) => document.getElementById(id);
  const C = AMB.collection, P = AMB.packs, RAR = AMB.ECONOMY.rarities;
  const { icon } = AMB.art;
  const UI = () => globalThis.AMB_UI;
  let results = null, step = 0, after = null;

  const tag = (c) => (c.isNew ? '<span class="rv-tag new">جديدة!</span>' : `<span class="rv-tag">+1 نسخة</span>`);

  function intro(onDone) {
    after = onDone || null;
    UI().overlay(`<div class="rv-wrap"><h2>🎁 هدية البداية</h2>
      <p class="gift-sub">٥ باكجات هدية تبني منها تشكيلتك الأولى</p>
      <div class="gift-packs">${[1, 2, 3, 4, 5].map((i) => `<div class="gift-pack" style="--d:${i * 0.12}s"><b>ZOR</b><small>${i}</small></div>`).join('')}</div>
      <p class="hint">كل باكج فيه 5 وحدات. مضمون إن عندك كل الأدوار وكل العوالم عشان تقدر تبني تشكيلة.</p>
      <div class="rv-btns"><button class="btn primary big" data-act="giftOpen">افتح الباكج الأول</button></div></div>`);
  }

  function showPack(i) {
    const ui = UI(), res = results[i];
    const best = res.cards.reduce((b, c) => (RAR[c.rarity].order > RAR[b.rarity].order ? c : b), res.cards[0]);
    const cards = res.cards.map((c, k) => `<div class="rv" style="--d:${k * 0.35}s;--rc:${RAR[c.rarity].color}" data-r="${c.rarity}">
        <div class="rv-in"><div class="rv-back"><span>ZOR</span></div><div class="rv-front">${ui.cardHTML(C.def(c.id), { k: 'gf' + i + k + c.id, lvl: c.level })}${tag(c)}</div></div></div>`).join('');
    ui.overlay(`<div class="rv-wrap best-${best.rarity}"><h2>🎁 هدية ${i + 1} من ${results.length}</h2><div class="rv-row">${cards}</div>
      <div class="gift-dots">${results.map((_, k) => `<i class="${k <= i ? 'on' : ''}"></i>`).join('')}</div>
      <div class="rv-btns">${i + 1 < results.length ? '<button class="btn primary big" data-act="giftNext">الباكج التالي</button>' : '<button class="btn primary big" data-act="giftNext">خلصت! رتّب تشكيلتك</button>'}
        <button class="btn ghost" data-act="giftNext" data-all="1">افتح الباقي</button></div></div>`);
    res.cards.forEach((c, k) => setTimeout(() => {
      if (!$('overlay').classList.contains('on')) return;
      ui.sfx(RAR[c.rarity].order >= 2 ? 'merge' : 'click');
      const el = document.querySelectorAll('.rv')[k];
      if (el && RAR[c.rarity].order >= 2 && ui.burst) [RAR[c.rarity].color, '#ffffff'].forEach((col) => ui.burst(el, col, 12, { r: 100, s: 6 }));
    }, 350 * k + 300));
  }

  function summary() {
    const ui = UI(), deck = C.autoBuild(), rc = C.roleCounts(deck);
    const ROLE = AMB.DATA.ROLES;
    ui.overlay(`<div class="rv-wrap"><h2>🃏 تشكيلتك الأولى جاهزة</h2><p class="gift-sub">رتبت لك ${deck.length} وحدات متوازنة من اللي طلع لك</p>
      <div class="deck-mini">${deck.map((id, i) => `<div class="dm" title="${C.def(id).name}">${ui.portrait(C.def(id), { k: 'gd' + i + id })}</div>`).join('')}</div>
      <div class="deck-roles">${Object.entries(rc).map(([r, n]) => `<span>${icon(AMB.art.ROLE_ICON[r])}${ROLE[r].name} ${n}</span>`).join('')}</div>
      <p class="hint">التشكيلة هي الوحدات اللي تطلع لك في متجر الحملة والبرج والأحداث. عدّله من «مجموعتي» متى ما بغيت.</p>
      <div class="rv-btns"><button class="btn primary big" data-act="giftDone">${after ? 'ابدأ أول قتال' : 'تمام'}</button><button class="btn" data-act="giftDeck">عدّل التشكيلة</button></div></div>`);
  }

  function offer() {   // old saves: the gift is waiting
    UI().overlay(`<div class="rv-wrap"><h2>🎁 هدية للجميع</h2><p class="gift-sub">٥ باكجات هدية وتشكيلة تتحكم في وحداتك بالحملة</p>
      <p class="hint">بطاقاتك الحالية كلها باقية، والباكجات تنضاف لها.</p>
      <div class="rv-btns"><button class="btn primary big" data-act="giftStart">استلم الهدية</button><button class="btn ghost" data-act="giftLater">لاحقًا</button></div></div>`);
  }

  function installActions() {
    const ui = UI(); if (!ui || ui.ACT.giftOpen) return;
    Object.assign(ui.ACT, {
      giftStart: () => intro(null),
      giftLater: () => ui.closeOverlay(),
      giftOpen: () => { results = P.gift(); if (!results) { ui.closeOverlay(); return; } step = 0; showPack(0); },
      giftNext: (d) => {
        step = d.all ? results.length : step + 1;
        if (step >= results.length) { summary(); return; }
        showPack(step);
      },
      giftDone: () => { ui.closeOverlay(); ['PacksUI', 'CollectionUI', 'AlbumUI'].forEach((k) => AMB[k] && AMB[k].refreshMenu && AMB[k].refreshMenu()); const f = after; after = null; if (f) f(); else ui.show('menu'); },
      giftDeck: () => { ui.closeOverlay(); after = null; ui.show('cards'); },
    });
  }

  /** called when the main menu shows: offer the gift to a player who has a hero but has not claimed it */
  let offered = false;
  function onMenu() {
    if (offered || !C.starterHero() || C.giftClaimed() || $('overlay').classList.contains('on')) return;
    offered = true; setTimeout(() => { if (document.querySelector('#scr-menu.active') && !$('overlay').classList.contains('on') && !C.giftClaimed()) offer(); }, 500);
  }

  AMB.GiftUI = { intro, onMenu, installActions };
  if (UI()) installActions();
  if (document.querySelector('#scr-menu.active')) onMenu();
})();

;
/* ui/tutorial-ui.js */
/*
 * The guided first match. A ring + a pointing hand show the next move, a small bar shows it as symbols, and everything
 * else is locked until the move is done (so a beginner cannot get lost). No sentences: only icons and numbers.
 * Core (match, scripted shop, reward): core/tutorial.js.
 */
(function () {
  const AMB = globalThis.AMB;
  const $ = (id) => document.getElementById(id);
  const TU = AMB.tutorial, C = AMB.collection;
  const { icon } = AMB.art;
  const UI = () => globalThis.AMB_UI;
  let active = false, idx = 0, replay = false, after = null, rerolled = 0, timer = 0, lastKey = '';
  let ring, hand, bar, point = null, xpBase = null;   // point = the element the hand points at now

  // ---------------------------------------------------------------- finding things on the screen
  const q = (sel) => document.querySelector(sel);
  const vis = (el) => el && el.offsetParent !== null && el.getBoundingClientRect().width > 4;
  const shopCard = (n) => { const defId = TU.SHOP[UI().S.match.round][n]; return q(`.shop-cards .tcard[data-idx="${n}"]`) || null; };
  const firstShopWith = (id) => { const p = UI().S.match.players[0]; const i = p.shop.findIndex((x) => x === id); return i < 0 ? null : q(`.shop-cards .tcard[data-idx="${i}"]`); };
  const benchUnit = () => q('#bench .bslot .tcard');
  const cell = (slot) => q(`#slots .cell.mine[data-slot="${slot}"]`);
  const ready = () => q('.ready-btn');
  const reroll = () => q('#shopbar [data-act="reroll"]');
  // the guard step points at what actually protects the hero: the shield counter (wide screens) or the front-row unit you just placed (phones)
  const guardEl = () => {
    const a = q('#panel-left .guard'); if (vis(a)) return a;
    const fr = [...document.querySelectorAll('#slots .cell.mine[data-slot^="f"]')].find((c) => c.querySelector('.tcard'));
    return fr || cell('f1');
  };
  const sel = () => UI().S.sel;
  const P = () => UI().S.match.players[0];
  const front = () => Object.keys(P().board).filter((s) => s[0] === 'f').length;
  const back = () => Object.keys(P().board).filter((s) => s[0] === 'b').length;
  const units = () => UI().S.match.allUnits(P()).length;

  const G = (n) => icon(n);
  const ARR = '<i class="tg-arr">➜</i>';
  const STEPS = [
    { id: 'buy1', say: 'اشترِ هالبطاقة بالذهب!', round: 1, bar: [G('gold'), ARR, '🃏'], target: () => shopCard(0), done: () => units() >= 1 },
    { id: 'front', say: 'حطها قدّام، تحميني 🛡', round: 1, bar: ['🃏', ARR, G('shield')], target: () => (sel() && sel().kind === 'unit' ? { point: cell('f1'), allow: [cell('f1'), benchUnit()] } : { point: benchUnit(), allow: [benchUnit(), cell('f1')] }), done: () => front() >= 1 },
    { id: 'buy2', say: 'خذ وحدة ثانية!', round: 1, bar: [G('gold'), ARR, '🃏'], target: () => shopCard(2), done: () => units() >= 2 },
    { id: 'back', say: 'هذي حطها ورا، تضرب من بعيد 🏹', round: 1, bar: ['🃏', ARR, G('bow')], target: () => (sel() && sel().kind === 'unit' ? { point: cell('b1'), allow: [cell('b1'), benchUnit()] } : { point: benchUnit(), allow: [benchUnit(), cell('b1')] }), done: () => back() >= 1 },
    { id: 'guard', say: 'اللي قدّام يحموني. اضغط عليه', round: 1, ack: true, bar: [G('shield'), '=', G('check')], target: () => guardEl() },
    { id: 'ready1', say: 'جاهزين؟ اضغط «جاهز»!', round: 1, bar: [G('sword'), G('check')], target: () => ready(), done: () => UI().S.phase === 'combat' || UI().S.match.round > 1 },
    { id: 'merge', say: 'ثلاث نسخ متشابهة = نجمة ⭐ اشترِها', round: 2, bar: ['🃏', '🃏', '🃏', ARR, G('star')], target: () => { for (let i = 0; i < 3; i++) { const el = q(`.shop-cards .tcard[data-idx="${i}"]:not(.empty)`); if (el && P().shop[i]) return el; } return null; }, done: () => UI().S.match.allUnits(P()).some((u) => u.star >= 2) },
    { id: 'reroll', say: 'جرّب تحدّث المتجر 🔄', round: 2, bar: [G('gold'), G('refresh')], target: () => reroll(), done: () => P().stats.rerolls >= 1 },
    { id: 'ready2', say: 'يلا للقتال!', round: 2, bar: [G('sword'), G('check')], target: () => ready(), done: () => UI().S.phase === 'combat' || UI().S.match.round > 2 },
    // round 3: the two things that decide real matches: spend gold on levels (more units on the board), and send the hero in
    { id: 'xp', say: 'ارفع مستوى المتجر: بطاقات أقوى ووحدات أكثر في الساحة', round: 3, bar: [G('gold'), ARR, G('up')], target: () => q('#shopbar [data-act="xp"]') || q('[data-act="xp"]'), done: () => xpBase != null && P().level > xpBase },   // only a bought shop upgrade counts
    { id: 'summon', say: 'نزّلني الساحة! 👑 أقاتل معك', round: 3, bar: [G('crown'), ARR, G('sword')], target: () => q('[data-act="summon"]'), done: () => P().summoned },
    { id: 'ready3', say: 'آخر جولة، يلا نفوز!', round: 3, bar: [G('sword'), G('check')], target: () => ready(), done: () => UI().S.phase === 'combat' },
  ];

  // ---------------------------------------------------------------- layers
  function mount() {
    if (ring) return;
    ring = document.createElement('div'); ring.className = 'tut-ring'; document.body.appendChild(ring);
    hand = document.createElement('div'); hand.className = 'tut-hand'; hand.innerHTML = icon('hand'); document.body.appendChild(hand);
    bar = document.createElement('div'); bar.className = 'tut-bar'; document.body.appendChild(bar);
    bar.addEventListener('click', (e) => { if (e.target.closest('[data-tut="ok"]')) { idx++; lastKey = ''; tick(); } else if (e.target.closest('[data-tut="skip"]')) skip(); });
    document.addEventListener('click', ackTap, true);
  }
  // a "look here" step (no move to make): tapping the thing the hand points at moves on, instead of opening/selecting it
  function ackTap(e) {
    const st = STEPS[idx];
    if (!active || !st || !st.ack || !point || !point.isConnected || !point.contains(e.target)) return;
    e.preventDefault(); e.stopPropagation();
    idx++; lastKey = ''; tick();
  }
  function hide() { point = null; if (ring) { ring.style.display = 'none'; hand.style.display = 'none'; bar.style.display = 'none'; } document.querySelectorAll('.tut-target').forEach((e) => e.classList.remove('tut-target')); document.body.classList.remove('tut-on'); }
  function unmount() { document.removeEventListener('click', ackTap, true); point = null; [ring, hand, bar].forEach((e) => e && e.remove()); ring = hand = bar = null; document.querySelectorAll('.tut-target').forEach((e) => e.classList.remove('tut-target')); document.body.classList.remove('tut-on'); }

  function place(targets, st) {
    const spec = targets && targets.point !== undefined ? targets : { point: targets, allow: [targets] };
    const list = [].concat(spec.allow).filter(Boolean).filter(vis);
    document.querySelectorAll('.tut-target').forEach((e) => { if (!list.includes(e)) e.classList.remove('tut-target'); });
    list.forEach((e) => e.classList.add('tut-target'));
    // the ring + hand mark the thing to tap now; the other allowed element stays clickable (e.g. to change the selected unit)
    const t = vis(spec.point) ? spec.point : null;
    point = t;
    if (!t) { ring.style.display = 'none'; hand.style.display = 'none'; return; }
    const row = t.closest('.shop-row'); if (row && t.closest('.shop-cards')) { const r = t.getBoundingClientRect(), rr = row.getBoundingClientRect(); if (r.left < rr.left || r.right > rr.right) t.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' }); }
    const r = t.getBoundingClientRect(), pad = 6;
    Object.assign(ring.style, { display: 'block', left: r.left - pad + 'px', top: r.top - pad + 'px', width: r.width + pad * 2 + 'px', height: r.height + pad * 2 + 'px' });
    const hx = r.right - Math.min(22, r.width * 0.3), hy = r.top + r.height * 0.5;   // at the edge: never over the card's name, price or numbers
    Object.assign(hand.style, { display: 'block', left: Math.min(innerWidth - 40, Math.max(4, hx - 4)) + 'px', top: Math.min(innerHeight - 50, hy) + 'px' });
  }

  // ---------------------------------------------------------------- the loop
  function tick() {
    if (!active) return;
    const ui = UI(), S = ui.S;
    if (S.screen !== 'match' || S.mode !== 'tutorial' || !S.match) { hide(); if (S.screen !== 'match' && S.screen !== 'results' && S.mode === 'tutorial') { /* left the match: stop the guide */ stop(); } return; }
    if (S.phase !== 'prep' || $('overlay').classList.contains('on') || $('modal-back').classList.contains('on')) { hide(); return; }
    const m = S.match;
    while (STEPS[idx] && STEPS[idx].round < m.round) idx++;                 // never get stuck on a past round
    while (STEPS[idx] && STEPS[idx].done && STEPS[idx].round === m.round && STEPS[idx].done()) { idx++; lastKey = ''; }
    const st = STEPS[idx];
    if (!st || st.round !== m.round) { hide(); return; }
    if (st.id === 'xp' && xpBase == null) xpBase = P().level;
    mount(); document.body.classList.add('tut-on');
    bar.style.display = 'flex'; ring.style.display = 'block'; hand.style.display = 'block';
    const key = idx + ':' + (sel() ? sel().kind : '') + ':' + m.round;
    if (key !== lastKey) {
      lastKey = key;
      bar.innerHTML = `${st.say ? `<span class="tg-say">${ui.portrait(AMB.DATA.HEROES[P().heroId], { k: 'tsay' })}<b>${st.say}</b></span>` : ''}<span class="tg-ic">${st.bar.join('')}</span>${st.ack ? `<button class="tg-ok" data-tut="ok">${icon('check')}</button>` : ''}<span class="tg-dots">${STEPS.map((x, i) => `<i class="${i < idx ? 'done' : i === idx ? 'now' : ''}"></i>`).join('')}</span>${replay ? `<button class="tg-skip" data-tut="skip">${icon('skip')}</button>` : ''}`;
    }
    place(st.target(), st);
  }
  function poke() { if (active) tick(); }
  function stop() { active = false; clearInterval(timer); unmount(); }

  // ---------------------------------------------------------------- start / finish
  function start(o) {
    o = o || {};
    const ui = UI(), S = ui.S;
    replay = !!o.replay || !TU.required(); after = o.after || null;
    if (o.replay && C.needsStarter()) { ui.toast('اختر بطلك أول', 'err'); return; }
    ui.closeOverlay(); ui.closeModal();
    S.mode = 'tutorial'; S.picks = [C.starterHero() || Object.keys(AMB.DATA.HEROES)[0], null]; S.pickIdx = 0;
    idx = 0; rerolled = 0; lastKey = ''; xpBase = null; active = true;
    clearInterval(timer); timer = setInterval(tick, 220);
    ui.startMatch();
  }
  function skip() {   // replays only
    stop(); const ui = UI(); ui.closeOverlay(); ui.show('menu');
  }
  /** called from ui.js when the guided match ends */
  function showResult(m, secs) {
    const ui = UI(); stop();
    const won = m.winner === 0, r = TU.complete();
    $('results').innerHTML = `<div class="res-stage victory" style="--wc:#ffd24a"><div class="res-rays"></div>
        <div class="res-hero">${ui.portrait(AMB.DATA.HEROES[m.players[0].heroId], { bare: true, k: 'tur' })}<i class="sheen"></i></div></div>
      <div class="res-banner tut-done"><div class="td-big">${icon('crown')}</div>
        ${r.shards ? `<div class="td-reward">${icon('gem')} +${r.shards}</div>` : `<div class="td-reward">${icon('check')}</div>`}</div>
      <div class="cam-btns"><button class="btn primary big" data-act="tutDone">${icon('sword')}</button>${replay ? `<button class="btn big ghost" data-act="again">${icon('refresh')}</button>` : ''}</div>`;
    ui.show('results'); ui.sfx('win');
    setTimeout(() => { const el = document.querySelector('.res-hero'); if (el) ['#ffd24a', '#ffffff', '#5fe3ff'].forEach((c) => ui.burst(el, c, 16, { r: 150, s: 8 })); }, 250);
  }
  function installActions() {
    const ui = UI(); if (!ui || ui.ACT.tutDone) return;
    Object.assign(ui.ACT, { tutDone: () => { const f = after; after = null; ['PacksUI', 'CampaignUI', 'CollectionUI'].forEach((k) => AMB[k] && AMB[k].refreshMenu && AMB[k].refreshMenu()); if (f) f(); else ui.show('menu'); } });
  }

  AMB.TutorialUI = { start, poke, showResult, installActions, active: () => active };
  if (UI()) installActions();
})();

;
/* ui/daily-ui.js */
/*
 * Daily login calendar popup (7 days). Shown once per session on the main menu when today's
 * reward is waiting; also opened from the menu button. Logic: core/daily.js, rewards: AMB.ECONOMY.login.
 */
(function () {
  const AMB = globalThis.AMB;
  const $ = (id) => document.getElementById(id);
  const L = AMB.login, RAR = AMB.ECONOMY.rarities;
  const { icon } = AMB.art;
  const UI = () => globalThis.AMB_UI;
  let shown = false;

  const rewardHTML = (rw) => [rw.shards ? `<b>${icon('gem')} ${rw.shards}</b>` : '', rw.packs ? `<b>📦 باكج</b>` : '', rw.card ? `<b style="color:${RAR[rw.card].color}">+ بطاقة ${RAR[rw.card].name}+</b>` : ''].filter(Boolean).join('');

  function calendarHTML(got) {
    const st = L.status(), R = L.rewards();
    const tiles = R.map((rw, i) => {
      const past = got ? i < (got.day - 1) || (got.day - 1 === i) : i < st.next;
      const today = !got && st.canClaim && i === st.next;
      const justNow = got && i === got.day - 1;
      return `<div class="lday ${past ? 'got' : ''} ${today ? 'today' : ''} ${justNow ? 'now' : ''} ${rw.big ? 'big' : ''}"><small>اليوم ${i + 1}</small>${rewardHTML(rw)}${past ? '<i class="lck">✓</i>' : ''}</div>`;
    }).join('');
    let body;
    if (got) {
      const cards = got.packs.flatMap((p) => p.cards).concat(got.card ? [got.card] : []);
      body = `<p class="cam-pay">استلمت جائزة اليوم ${got.day}${got.shards ? ` · ${icon('gem')} +${got.shards} شظية` : ''}</p>
        ${cards.length ? `<div class="cam-pack-row">${cards.map((c, i) => `<div class="cu">${UI().portrait(AMB.collection.def(c.id), { k: 'lg' + i + c.id })}<small style="color:${RAR[c.rarity].color}">${RAR[c.rarity].name}${c.isNew ? ' · جديدة!' : ''}</small></div>`).join('')}</div>` : ''}
        <div class="rv-btns"><button class="btn primary" data-act="loginClose">تم</button></div>`;
    } else {
      body = st.canClaim ? `<div class="rv-btns"><button class="btn primary big" data-act="loginClaim">استلم جائزة اليوم ${st.next + 1}</button><button class="btn ghost" data-act="loginClose">لاحقًا</button></div>`
        : `<p class="hint">استلمت جائزة اليوم. ارجع بكرة لجائزة اليوم ${st.next + 1}.</p><div class="rv-btns"><button class="btn" data-act="loginClose">تم</button></div>`;
    }
    return `<div class="login-wrap"><h2>🎁 الدخول اليومي</h2><p class="hint">ادخل كل يوم واستلم جائزة تكبر يومًا بعد يوم. لو فاتك يوم ما يرجع العدّاد، وبعد اليوم السابع تبدأ دورة جديدة.</p>
      <div class="lcal">${tiles}</div>${body}</div>`;
  }

  function open() { UI().overlay(calendarHTML(null)); }
  function refreshMenu() {
    const b = $('menu-login'); if (!b) return;
    (b.querySelector('.mt-l') || b).innerHTML = `الدخول اليومي${L.canClaim() ? '<span class="dot">1</span>' : ''}`;
  }
  /** called when the main menu shows: open the calendar once per session if a reward waits */
  function onMenu() {
    refreshMenu();
    if (shown || !L.canClaim() || $('overlay').classList.contains('on')) return;
    if (AMB.CampaignUI && AMB.CampaignUI.isNewbie()) return;   // first visit: no popups before the first fight
    shown = true; setTimeout(() => { if (L.canClaim() && !(AMB.CampaignUI && AMB.CampaignUI.isNewbie()) && document.querySelector('#scr-menu.active') && !$('overlay').classList.contains('on')) open(); }, 600);
  }

  function installActions() {
    const ui = UI(); if (!ui || ui.ACT.loginOpen) return;
    Object.assign(ui.ACT, {
      loginOpen: () => open(),
      loginClaim: () => {
        const got = L.claim(); if (!got) return;
        ui.sfx('merge'); ui.overlay(calendarHTML(got));
        const el = document.querySelector('.lday.now'); if (el && ui.burst) ['#ffd24a', '#5fe3ff', '#ffffff'].forEach((c) => ui.burst(el, c, 12, { r: 90, s: 6 }));
        refreshMenu(); ['PacksUI', 'CollectionUI', 'PassUI', 'CampaignUI'].forEach((k) => AMB[k] && AMB[k].refreshMenu && AMB[k].refreshMenu());
      },
      loginClose: () => ui.closeOverlay(),
    });
  }

  AMB.DailyUI = { open, refreshMenu, onMenu, installActions };
  if (UI()) installActions();
  // the game opens on the menu: offer today's reward right away
  if (document.querySelector('#scr-menu.active')) onMenu(); else refreshMenu();
})();

;
/* ui/album-ui.js */
/*
 * "الألبوم": every card of the game. Cards you don't own are shadows. Own all 5 units of a world
 * to claim its set reward; own all 20 for the grand reward. Logic: core/album.js.
 */
(function () {
  const AMB = globalThis.AMB;
  const $ = (id) => document.getElementById(id);
  const A = AMB.album, C = AMB.collection, RAR = AMB.ECONOMY.rarities, P = AMB.Pass;
  const { icon } = AMB.art;
  const UI = () => globalThis.AMB_UI;
  const W = (id) => AMB.DATA.WORLDS[id];
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const hint = (id) => (AMB.CollectionUI ? AMB.CollectionUI.unlockHint(id) : 'من الباكجات');

  // the album is a storybook: one page per world, then the heroes, the event exclusives and the gear
  const PAGES = ['ember', 'tide', 'neon', 'sylvan', 'heroes', 'exclusive', 'items'];
  let page = 0, dir = 0, hub = true;   // the album opens on the world map (a compass); a world opens its storybook page
  const pageName = (k) => (W(k) ? W(k).name : k === 'heroes' ? 'الأبطال' : k === 'exclusive' ? '🌟 حصريات الأحداث' : 'المعدات والتعاويذ');
  const pageColor = (k) => (W(k) ? W(k).color : k === 'heroes' ? '#ff5a64' : k === 'exclusive' ? '#ffd24a' : '#b8a89a');

  function cardTile(id) {
    const d = C.def(id), owned = C.owned(id), s = A.cardState(id);
    const card = UI().cardHTML(d, { k: 'alb' + id, lvl: owned ? C.level(id) : 0, cls: owned ? '' : 'unowned', attrs: `data-act="${d.role ? 'detail' : 'heroInfo'}" data-id="${id}"` });
    const chip = s === 'ready' ? `<button class="al-claim" data-act="albCard" data-id="${id}">+${A.cardPrize(id)} ${icon('gem')}</button>` : s === 'claimed' ? '<span class="al-got">✓</span>' : '';
    // kid #8: a sticker book: every owned character gets a one-line "who am I" caption (role + home world)
    const who = owned && d.role && AMB.DATA.ROLES[d.role] && W(d.world) ? `<small class="al-who">${AMB.DATA.ROLES[d.role].name} من ${W(d.world).name}</small>` : '';
    return `<div class="al-tile ${owned ? '' : 'miss'} ${s}">${card}${who}${owned ? chip : `<small class="al-hint">🔒 ${hint(id)}</small>`}</div>`;
  }

  function rewardText(rw) {
    const bits = [];
    if (rw.shards) bits.push(`${icon('gem')} ${rw.shards}`);
    if (rw.packs) bits.push(`📦 ${rw.packs === 1 ? 'باكج' : rw.packs + ' باكجات'}`);
    if (rw.title) bits.push(`لقب «${P.COSMETICS.title[rw.title].name}»`);
    if (rw.frame) bits.push(`إطار`);
    return bits.join(' · ');
  }

  function pageHTML(k) {
    if (k === 'items') return `<div class="codex-grid">${UI().itemsHTML()}</div>`;
    const ids = A.pageIds(k), owned = ids.filter((id) => C.owned(id)).length, ready = A.pageReady(k), prize = A.pagePrize(k);
    let setRow = '';
    if (W(k)) {
      const st = A.state(k), rw = A.reward(k), p = A.progress(k);
      setRow = `<div class="al-set ${st}"><span>جائزة إكمال العالم: ${rewardText(rw)}</span><b>${p.owned}/${p.total}</b>${st === 'ready' ? `<button class="btn small primary" data-act="albClaim" data-w="${k}">استلم</button>` : st === 'claimed' ? '<span class="al-done">✓</span>' : ''}</div>`;
    }
    const allBtn = ready.length ? `<button class="btn big primary al-all" data-act="albPage" data-k="${k}">استلام الكل · +${prize} ${icon('gem')} <small>(${ready.length} ${ready.length === 1 ? 'شخصية' : 'شخصيات'})</small></button>`
      : `<div class="al-all done">${owned === ids.length ? '✓ كل جوائز الصفحة مستلمة' : 'اجمع شخصيات جديدة وتجيك جوائزها هنا'}</div>`;
    return `${setRow}<div class="al-grid">${ids.map(cardTile).join('')}</div>${allBtn}`;
  }

  function hubHTML(t) {
    const arm = (w, pos) => { const p = A.progress(w), wd = W(w), rd = A.pageReady(w).length + (A.state(w) === 'ready' ? 1 : 0);
      return `<button class="wm-arm wm-${pos} ${p.owned ? '' : 'locked'} ${p.owned >= p.total ? 'done' : ''}" style="--wc:${wd.color}" data-act="albOpen" data-p="${PAGES.indexOf(w)}" aria-label="${esc(wd.name)}">
        <span class="wm-ic">${icon(AMB.art.WORLD_ICON[w])}</span><b>${esc(wd.name)}</b><small><bdi dir="ltr">${p.owned}/${p.total}</bdi> وحدة</small>${rd ? `<i class="wm-go">🎁 ${rd}</i>` : ''}</button>`; };
    const side = (key, label) => { const rd = key === 'items' ? 0 : A.pageReady(key).length; return `<button class="btn small" data-act="albOpen" data-p="${PAGES.indexOf(key)}">${label}${rd ? ` <span class="dot">${rd}</span>` : ''}</button>`; };
    return `<div class="wm wm-col"><div class="wm-lines"><i></i><i></i></div>${arm('sylvan', 'top')}${arm('ember', 'left')}${arm('neon', 'right')}${arm('tide', 'bottom')}
      <div class="wm-core"><svg viewBox="0 0 100 100" aria-hidden="true"><polygon points="50,4 58,34 90,24 66,46 96,60 62,62 70,94 50,70 30,94 38,62 4,60 34,46 10,24 42,34" fill="#f2c94c" stroke="#a87a12" stroke-width="1.5"/></svg><b><bdi dir="ltr">${t.owned}/${t.total}</bdi></b></div></div>
      <div class="al-side">${side('heroes', '🛡 الأبطال')}${side('exclusive', '🌟 حصريات الأحداث')}${side('items', '⚔ المعدات والتعاويذ')}</div>`;
  }

  function render() {
    const root = $('codex'); if (!root) return;
    const t = A.total(), as = A.allState(), rwAll = AMB.ECONOMY.album.all, k = PAGES[page];
    const readyOn = (key) => key !== 'items' && A.pageReady(key).length;
    root.innerHTML = `<div class="al-head"><div class="al-total"><b>${t.owned}/${t.total}</b> وحدة<div class="al-bar big"><i style="width:${(100 * t.owned) / t.total}%"></i></div></div>
        <div class="al-grand ${as}">${as === 'claimed' ? '✓ ' : '🏆 '}كل الوحدات: ${rewardText(rwAll)}
          ${as === 'ready' ? '<button class="btn primary" data-act="albClaimAll">استلم</button>' : ''}</div>
        <button class="ibtn" data-act="info" data-k="albinfo" title="شرح">ⓘ</button></div>
      ${hub ? hubHTML(t) : `<div class="al-top"><button class="btn small ghost" data-act="albOpen" data-p="-1">‹ خريطة العوالم</button></div>`}
      ${hub ? '' : `<div class="al-book" style="--wc:${pageColor(k)}">
        <div class="al-pagehead"><button class="al-flip" data-act="albGo" data-d="1" ${page >= PAGES.length - 1 ? 'disabled' : ''}>›</button>
          <div class="al-title"><small>الصفحة ${page + 1} من ${PAGES.length}</small><h3>${pageName(k)}</h3>${W(k) && W(k).lore ? `<p class="al-lore">${W(k).lore}</p>` : ''}</div>
          <button class="al-flip" data-act="albGo" data-d="-1" ${page <= 0 ? 'disabled' : ''}>‹</button></div>
        <div class="al-sheet ${dir > 0 ? 'in-r' : dir < 0 ? 'in-l' : ''}">${pageHTML(k)}</div>
        <div class="al-dots">${PAGES.map((key, i) => `<button class="${i === page ? 'on' : ''}" data-act="albGoTo" data-i="${i}" title="${pageName(key)}">${readyOn(key) ? '<i></i>' : ''}</button>`).join('')}</div>
      </div>`}`;
    dir = 0;
    refreshMenu();
  }

  function refreshMenu() {
    const b = $('menu-album'); if (!b) return;
    const n = A.readyCount(), l = b.querySelector('.mt-l');
    l.innerHTML = `الألبوم${n ? `<span class="dot">${n}</span>` : ''}`;
  }

  function celebrate(res, packs) {
    const ui = UI();
    ui.sfx('merge');
    const cards = (packs || []).flatMap((p) => p.cards);
    ui.overlay(`<div class="rv-wrap"><h2>🏆 كمّلت الصفحة!</h2><p class="cam-pay">${rewardText(res.reward)}</p>
      ${cards.length ? `<div class="cam-pack-row">${cards.map((c, i) => `<div class="cu">${ui.portrait(C.def(c.id), { k: 'alr' + i + c.id })}<small style="color:${RAR[c.rarity].color}">${RAR[c.rarity].name}${c.isNew ? ' · جديدة!' : ''}</small></div>`).join('')}</div>` : ''}
      ${res.reward.title ? `<p class="hint">جهّز اللقب والإطار من «ممر الصدع» ← «ملفي»</p>` : ''}
      <div class="rv-btns"><button class="btn primary" data-act="packDone">تم</button></div></div>`);
    // kid #8: a completed page is a party: confetti in the world's colours
    setTimeout(() => { const h = document.querySelector('#overlay .rv-wrap h2'); if (h && ui.burst) ['#ffd24a', '#ff5aa0', '#5fe3ff', '#ffffff'].forEach((c, i) => setTimeout(() => ui.burst(h, c, 18, { r: 160, s: 8 }), i * 120)); }, 200);
  }

  AMB.TIPS = AMB.TIPS || {};
  AMB.TIPS.albinfo = () => ({ title: 'الألبوم', html: `<p>كل بطاقات اللعبة هنا. البطاقة اللي ما تملكها تطلع ظل مع طريقة الحصول عليها.</p>
    <p>الألبوم كتاب: كل صفحة عالم، وتقلبها بالأسهم أو بسحبة. كل شخصية تحصل عليها لأول مرة تعطيك <b>٥٠ شظية</b> (والأسطوري <b>١٠٠</b>)، وفي نهاية الصفحة زر <b>استلام الكل</b>. شخصيات البداية ما تعطي جائزة.</p>
    <p>وإكمال كل شخصيات عالم يعطيك جائزة العالم (شظايا + لقب + إطار)، وكل الوحدات = باكجات + لقب «جامع الصدع».</p>` });

  function installActions() {
    const ui = UI(); if (!ui || ui.ACT.albClaim) return;
    Object.assign(ui.ACT, {
      albOpen: (d) => { const i = +d.p; if (i < 0) { hub = true; } else { hub = false; dir = i > page ? 1 : i < page ? -1 : 0; page = i; } ui.sfx('click'); render(); window.scrollTo(0, 0); },
      albGo: (d) => { page = Math.max(0, Math.min(PAGES.length - 1, page + +d.d)); dir = +d.d; ui.sfx('click'); render(); },
      albGoTo: (d) => { const i = +d.i; dir = i > page ? 1 : -1; page = i; ui.sfx('click'); render(); },
      albCard: (d) => { const r = A.claimCard(d.id); if (!r) return; ui.sfx('merge'); ui.toast(`+${r.shards} شظية`, 'good'); render(); ['PacksUI', 'PassUI'].forEach((k) => AMB[k] && AMB[k].refreshMenu && AMB[k].refreshMenu()); },
      albPage: (d) => { const r = A.claimPage(d.k); if (!r) return; ui.sfx('merge'); ui.toast(`+${r.shards} شظية من ${r.count} ${r.count === 1 ? 'شخصية' : 'شخصيات'}`, 'good'); render(); ['PacksUI', 'PassUI'].forEach((k) => AMB[k] && AMB[k].refreshMenu && AMB[k].refreshMenu()); },
      albClaim: (d) => { const r = A.claim(d.w); if (!r) return; celebrate(r); render(); ['PacksUI', 'PassUI'].forEach((k) => AMB[k] && AMB[k].refreshMenu && AMB[k].refreshMenu()); },
      albClaimAll: () => { const r = A.claimAll(); if (!r) return; celebrate(r, r.packs); render(); ['PacksUI', 'CollectionUI'].forEach((k) => AMB[k] && AMB[k].refreshMenu && AMB[k].refreshMenu()); },
    });
  }

  // swipe between pages
  (function swipe() {
    let x0 = null;
    document.addEventListener('touchstart', (e) => { x0 = e.target.closest && e.target.closest('#codex .al-book') ? e.touches[0].clientX : null; }, { passive: true });
    document.addEventListener('touchend', (e) => {
      if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null;
      if (Math.abs(dx) < 70) return;
      // RTL book: swipe right = next page
      const d = dx > 0 ? 1 : -1, np = page + d; if (np < 0 || np >= PAGES.length || !UI()) return;
      page = np; dir = d; render();
    }, { passive: true });
  })();
  AMB.AlbumUI = { render, refreshMenu, installActions };
  if (UI()) installActions();
  refreshMenu();
})();

;
/* ui/tower-ui.js */
/*
 * "البرج" screen: a ladder of 30 floors. Climb one floor at a time (best-of-3 fight, like the campaign),
 * every 5th floor is a boss. Logic: core/tower.js, settings: AMB.ECONOMY.tower.
 */
(function () {
  const AMB = globalThis.AMB;
  const $ = (id) => document.getElementById(id);
  const TW = AMB.tower, C = AMB.collection, CAM = AMB.campaign;
  const { icon } = AMB.art;
  const UI = () => globalThis.AMB_UI;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const W = (id) => AMB.DATA.WORLDS[id];
  let hero = null;

  const pickHero = () => { const owned = C.ownedHeroes(); if (hero && owned.includes(hero)) return hero; return (hero = (C.starterHero() && owned.includes(C.starterHero()) ? C.starterHero() : owned[0]) || null); };
  const rewardHTML = (n) => { const r = TW.rewardsFor(n); return `${icon('gem')} ${r.shards}${r.pack ? ' · 📦' : ''}${r.card ? ' · 🃏' : ''}`; };

  function row(n) {
    const L = TW.lineupFor(n), cleared = n <= TW.best(), cur = n === TW.next() && !TW.done(), open = TW.canPlay(n);
    const art = L.boss ? UI().portrait(AMB.DATA.HEROES[L.heroId], { bare: true, k: 'tw' + n }) : `<b>${n}</b>`;
    return `<button class="twrow ${L.boss ? 'boss' : ''} ${cleared ? 'cleared' : ''} ${cur ? 'cur' : ''} ${open ? '' : 'locked'}" style="--wc:${W(L.world).color}" ${open ? `data-act="towFloor" data-n="${n}"` : 'disabled'}>
      <span class="tw-n">${art}</span>
      <span class="tw-mid"><b>${L.boss ? '👑 زعيم · ' : ''}الطابق ${n}</b><small>${W(L.world).name}${L.boss ? ' · ' + esc(L.special.name) : ''}</small></span>
      <span class="tw-rw">${cleared ? (n === TW.best() ? '✓' : '✓') : rewardHTML(n)}</span>
      ${cur ? '<span class="tw-go">قاتل</span>' : open ? '' : '<span class="tw-lock">🔒</span>'}</button>`;
  }

  function render() {
    const root = $('tower'); if (!root) return;
    if (C.needsStarter()) { root.innerHTML = '<div class="cam-note">اختر بطلك الأول من «الحملة» أول.</div>'; return; }
    if (!TW.unlocked()) { root.innerHTML = `<div class="cam-note">🔒 البرج يفتح بعد ما تخلّص <b>المستوى الأول من الحملة</b> (${CAM.progress('l1').cleared}/${CAM.progress('l1').total}).</div>`; return; }
    const best = TW.best(), N = TW.floors();
    const floors = []; for (let n = N; n >= 1; n--) floors.push(row(n));
    root.innerHTML = `<div class="tw-head"><div class="tw-best"><small>أعلى طابق</small><b><bdi dir="ltr">${best}</bdi></b><span><bdi dir="ltr">/ ${N}</bdi></span></div>
        <div class="tw-prog"><i style="width:${(100 * best) / N}%"></i></div>
        <div class="hint">${TW.done() ? '🏆 أكملت البرج!' : `الجاي: الطابق ${TW.next()}`} <button class="ibtn" data-act="info" data-k="towinfo" title="شرح">ⓘ</button></div></div>
      <div class="twlist">${floors.join('')}</div>`;
    refreshMenu();
    const cur = root.querySelector('.twrow.cur'); if (cur && cur.scrollIntoView) setTimeout(() => cur.scrollIntoView({ block: 'center' }), 50);
  }

  function refreshMenu() {
    const b = $('menu-tower'); if (!b) return;
    const l = b.querySelector('.mt-l');
    l.innerHTML = TW.unlocked() ? `البرج <small>${TW.best()}/${TW.floors()}</small>` : 'البرج 🔒';
  }

  function preview(n) {
    const ui = UI(), L = TW.lineupFor(n), h = pickHero(), R = TW.rewardsFor(n), first = n > TW.best();
    const units = L.units.map(([id, star, , from], k) => `<div class="cu">${ui.portrait(AMB.DATA.UNITS[id], { k: 'twp' + k + id })}${ui.stars(star)}${from > 1 ? `<small>من الجولة ${from}</small>` : ''}</div>`).join('');
    const heroes = C.ownedHeroes().map((id) => `<button class="hchip ${id === h ? 'on' : ''}" data-act="towHero" data-id="${id}" data-n="${n}">${ui.portrait(AMB.DATA.HEROES[id], { k: 'twh' + id })}<span>${AMB.DATA.HEROES[id].name}</span></button>`).join('');
    const reward = first ? `${icon('gem')} ${R.shards} شظية · +${R.passXp} خبرة ممر${R.pack ? ' · <b>باكج مجاني</b>' : ''}${R.card ? ' · <b>بطاقة ملحمية أو أندر مضمونة</b>' : ''}` : 'خلّصت هالطابق: بدون جائزة (تدريب)';
    ui.modal(`<div class="cam-pv" style="--wc:${W(L.world).color}"><h2>${L.boss ? '👑 ' : ''}${esc(L.name)}</h2><div class="hint">${W(L.world).name} · لين 8 جولات، واللي يكسب 5 جولات أول يفوز${TW.attempts(n) ? ' · محاولات: ' + TW.attempts(n) : ''}</div>
      ${L.boss ? `<div class="boss-box">${ui.portrait(AMB.DATA.HEROES[L.heroId], { k: 'twb' })}<div><b>قدرة الزعيم: ${esc(L.special.name)}</b><p>${esc(L.special.text)}</p></div></div>` : ''}
      <h4>تشكيلة الخصم</h4><div class="cam-units">${units}</div>
      <h4>الجائزة</h4><div class="cam-reward">${reward}</div>
      <h4>بطلك</h4><div class="hchips">${heroes}</div>${AMB.DeckGate ? AMB.DeckGate.line() : ''}
      <div class="cam-go"><button class="btn primary big" data-act="towGo" data-n="${n}" ${h ? '' : 'disabled'}>قاتل!</button></div></div>`);
  }

  function start(n) {
    if (AMB.DeckGate && !AMB.DeckGate.ensure()) return;
    const ui = UI(), S = ui.S;
    S.mode = 'tower'; S.tower = { floor: n }; S.picks = [pickHero(), null]; S.pickIdx = 0;
    ui.closeModal(); ui.startMatch();
  }

  function showResult(m, secs) {
    const ui = UI(), S = ui.S, n = S.tower.floor, L = TW.lineupFor(n);
    if (!m._towDone) { m._towDone = true; S.towResult = TW.recordResult(n, Object.assign(m.summary(0), { lifeLeft: m.players[0].life, roundsLost: m.players[0].stats.losses })); }
    const r = S.towResult, won = r.won, score = `${m.players[0].stats.wins} – ${m.players[1].stats.wins}`;
    const pay = won && r.first ? [r.shards ? `${icon('gem')} +${r.shards} شظية` : '', r.passXp ? `+${r.passXp} خبرة ممر` : ''].filter(Boolean).join(' · ') : '';
    const cards = (r.pack ? r.pack.cards : []).concat(r.card ? [r.card] : []);
    const gift = cards.length ? `<div class="cam-pack"><b>${r.card ? '🏆 جائزة البرج' : '🎁 باكج مجاني'}:</b><div class="cam-pack-row">${cards.map((c, i) => `<div class="cu">${ui.portrait(C.def(c.id), { k: 'twr' + i + c.id })}<small class="r-${c.rarity}">${c.isNew ? 'جديدة!' : c.refund ? '+' + c.refund + ' شظية' : (c.rarity === 'legendary' || c.rarity === 'epic') && r.card ? AMB.ECONOMY.rarities[c.rarity].name : '+1 نسخة'}</small></div>`).join('')}</div></div>` : '';
    const next = won && TW.canPlay(n + 1) ? n + 1 : null;
    $('results').innerHTML = `<div class="res-stage ${won ? 'victory' : 'defeat'}" style="--wc:${W(L.world).color}"><div class="res-rays"></div>
        <div class="res-hero">${ui.portrait(won ? AMB.DATA.HEROES[m.players[0].heroId] : AMB.DATA.HEROES[L.heroId], { bare: true, k: 'twrh' })}<i class="sheen"></i></div>
        <div class="res-hname">${esc(L.name)}</div></div>
      <div class="res-banner"><h1>${won ? (L.boss ? 'هزمت الزعيم!' : 'فوز!') : 'خسارة'}</h1><p class="hint">النتيجة ${score} · ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')} دقيقة</p>
        ${won ? `<p class="cam-pay">${r.first ? pay : 'تدريب: بدون جائزة'}</p>${r.first ? `<p class="hint">أعلى طابق: <bdi dir="ltr">${r.best}</bdi> من <bdi dir="ltr">${TW.floors()}</bdi></p>` : ''}` : '<p class="hint">ما خسرت شي. طوّر بطاقاتك وجرّب نفس الطابق مرة ثانية</p>'}</div>
      ${gift}
      <div class="cam-btns">
        ${next ? `<button class="btn primary big" data-act="towGo" data-n="${next}">الطابق التالي ${next}</button>` : ''}
        <button class="btn ${won ? '' : 'primary'} big" data-act="towGo" data-n="${n}">${won ? 'أعد الطابق' : 'حاول مرة ثانية'}</button>
        <button class="btn big ghost" data-act="go" data-to="tower">البرج</button>
        ${won ? '' : '<button class="btn big ghost" data-act="go" data-to="cards">طوّر بطاقاتي</button>'}</div>`;
    ui.show('results'); ui.sfx(won ? 'win' : 'lose');
    if (won) setTimeout(() => { const el = document.querySelector('.res-hero'); if (el) ['#ffd24a', '#ffffff', W(L.world).color].forEach((c) => ui.burst(el, c, 14, { r: 150, s: 8 })); }, 250);
  }

  AMB.TIPS = AMB.TIPS || {};
  AMB.TIPS.towinfo = () => { const R = AMB.ECONOMY.tower.rewards; return { title: 'برج التحدي', html: `<p>${TW.floors()} طابقًا، كل طابق قتال <b>لين 8 جولات، واللي يكسب 5 جولات أول يفوز</b> ضد تشكيلة تصعب كل ما صعدت. كل 5 طوابق زعيم بقدرة خاصة.</p>
    <p>أول مرة تعدّي طابق: ${icon('gem')} ${R.shardsFirst}–${R.shardsLast} شظية + خبرة ممر. الزعيم: باكج مجاني. الطابق ${TW.floors()}: بطاقة ملحمية أو أندر مضمونة.</p>
    <p>لو خسرت تعيد نفس الطابق بدون أي عقوبة، وأعلى طابق وصلت له محفوظ. مستويات بطاقاتك تنحسب هنا، وتقدر تعيد أي طابق سابق للتدريب بدون جائزة.</p>` }; };

  function installActions() {
    const ui = UI(); if (!ui || ui.ACT.towFloor) return;
    Object.assign(ui.ACT, {
      towFloor: (d) => preview(+d.n),
      towHero: (d) => { hero = d.id; preview(+d.n); },
      towGo: (d) => start(+d.n),
    });
  }

  AMB.TowerUI = { render, refreshMenu, showResult, installActions };
  if (UI()) installActions();
  refreshMenu();
})();

;
/* ui/event-ui.js */
/*
 * "الحدث" screen: this week's special level (3 stages, the last is the event boss). The boss gives an
 * exclusive card that packs never drop. Logic: core/events.js, settings: AMB.ECONOMY.events.
 */
(function () {
  const AMB = globalThis.AMB;
  const $ = (id) => document.getElementById(id);
  const WK = AMB.weekly, C = AMB.collection;
  const { icon } = AMB.art;
  const UI = () => globalThis.AMB_UI;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const W = (id) => AMB.DATA.WORLDS[id];
  let hero = null, timer = 0;

  const pickHero = () => { const owned = C.ownedHeroes(); if (hero && owned.includes(hero)) return hero; return (hero = (C.starterHero() && owned.includes(C.starterHero()) ? C.starterHero() : owned[0]) || null); };
  function left(ms) { const h = Math.max(0, Math.floor(ms / 36e5)), d = Math.floor(h / 24); return d >= 1 ? `${d} يوم و ${h % 24} ساعة` : `${h} ساعة`; }
  const rewardHTML = (stage) => { const r = WK.rewardsFor(stage); return `${icon('gem')} ${r.shards}${r.pack ? ' · 📦' : ''}${r.exclusive ? ' · 🌟 بطاقة حصرية' : ''}`; };

  function stageRow(c, stage) {
    const L = WK.lineupFor(c.event.id, stage), cleared = stage <= c.stage, cur = stage === c.stage + 1, open = WK.canPlay(stage);
    const art = L.boss ? UI().portrait(AMB.DATA.HEROES[L.heroId], { bare: true, k: 'ev' + stage }) : `<b>${stage}</b>`;
    return `<button class="twrow ${L.boss ? 'boss' : ''} ${cleared ? 'cleared' : ''} ${cur ? 'cur' : ''} ${open ? '' : 'locked'}" style="--wc:${W(c.event.world).color}" ${open ? `data-act="evStage" data-n="${stage}"` : 'disabled'}>
      <span class="tw-n">${art}</span><span class="tw-mid"><b>${L.boss ? '👑 ' : ''}${esc(L.boss ? L.special.name : 'المرحلة ' + stage)}</b><small>${L.boss ? 'زعيم الحدث' : 'قتال ' + stage + ' من ' + WK.stageCount()}</small></span>
      <span class="tw-rw">${cleared ? '✓' : rewardHTML(stage)}</span>${cur ? '<span class="tw-go">قاتل</span>' : open ? '' : '<span class="tw-lock">🔒</span>'}</button>`;
  }

  function render() {
    const root = $('event'); if (!root) return;
    clearInterval(timer);
    if (C.needsStarter()) { root.innerHTML = '<div class="cam-note">اختر بطلك الأول من «الحملة» أول.</div>'; return; }
    if (!WK.unlocked()) { const c0 = WK.current(), ev0 = c0.event, ex0 = AMB.DATA.UNITS[ev0.exclusive];
      root.innerHTML = `<div class="cam-note">🔒 الحدث الأسبوعي يفتح بعد ما تخلّص <b>المستوى الأول من الحملة</b>.</div>
        <div class="ev-peek"><h3>حدث هالأسبوع: ${esc(ev0.name)}</h3><p class="hint">زعيم بقدرتين، وبطاقة حصرية ما تطلع من الباكجات: <b>${esc(ex0.name)}</b></p>
        <div class="ev-peek-card">${UI().cardHTML(ex0, { k: 'evp', cls: 'unowned', attrs: `data-act="detail" data-id="${ev0.exclusive}"` })}</div></div>`; return; }
    const c = WK.current(), ev = c.event, ex = AMB.DATA.UNITS[ev.exclusive], owned = C.owned(ev.exclusive), next = WK.nextEvent();
    const card = UI().cardHTML(ex, { k: 'evx', lvl: owned ? C.level(ev.exclusive) : 0, cls: owned ? '' : 'unowned', attrs: `data-act="detail" data-id="${ev.exclusive}"` });
    const rows = []; for (let s = WK.stageCount(); s >= 1; s--) rows.push(stageRow(c, s));
    root.innerHTML = `<div class="ev-banner" style="--wc:${W(ev.world).color}"><div class="ev-world">${W(ev.world).name}</div><h3>${esc(ev.name)}</h3>
        <div class="ev-time">⏳ باقي <b id="ev-left">${left(c.msLeft)}</b> · القادم: ${esc(next.name)}</div></div>
      <div class="ev-prize"><div class="ev-card">${card}</div><div class="ev-ptxt"><b>🌟 الجائزة الحصرية</b><p>${esc(ex.name)} <small>${esc(ex.en)}</small></p>
        <div class="hint">${owned ? '✓ تملكها (تعيد الحدث وتاخذ نسخة تطوير)' : 'ما تطلع من الباكجات، بس من هالحدث'} <button class="ibtn" data-act="info" data-k="evinfo" title="شرح">ⓘ</button></div>
        ${c.done ? '<div class="ev-done">✓ خلّصت حدث هذا الأسبوع</div>' : ''}</div></div>
      <div class="twlist">${rows.join('')}</div>`;
    refreshMenu();
    timer = setInterval(() => { const e = $('ev-left'); if (!e || UI().S.screen !== 'event') { clearInterval(timer); return; } e.textContent = left(WK.current().msLeft); }, 30000);
  }

  function refreshMenu() {
    const b = $('menu-event'); if (!b) return;
    const l = b.querySelector('.mt-l'), c = WK.current();
    l.innerHTML = `الحدث${WK.unlocked() && !c.done ? '<span class="dot">!</span>' : ''}`;
  }

  function preview(stage) {
    const ui = UI(), c = WK.current(), L = WK.lineupFor(c.event.id, stage), h = pickHero(), R = WK.rewardsFor(stage), first = stage === c.stage + 1;
    const units = L.units.map(([id, star, , from], k) => `<div class="cu">${ui.portrait(AMB.DATA.UNITS[id], { k: 'evp' + k + id })}${ui.stars(star)}${from > 1 ? `<small>من الجولة ${from}</small>` : ''}</div>`).join('');
    const heroes = C.ownedHeroes().map((id) => `<button class="hchip ${id === h ? 'on' : ''}" data-act="evHero" data-id="${id}" data-n="${stage}">${ui.portrait(AMB.DATA.HEROES[id], { k: 'evh' + id })}<span>${AMB.DATA.HEROES[id].name}</span></button>`).join('');
    const reward = first ? `${icon('gem')} ${R.shards} شظية · +${R.passXp} خبرة ممر${R.pack ? ' · <b>باكج مجاني</b>' : ''}${R.exclusive ? ` · <b>🌟 ${esc(AMB.DATA.UNITS[c.event.exclusive].name)} (حصرية)</b>` : ''}` : 'خلّصت هالمرحلة هالأسبوع: تدريب بدون جائزة';
    ui.modal(`<div class="cam-pv" style="--wc:${W(c.event.world).color}"><h2>${L.boss ? '👑 ' : ''}${esc(L.name)}</h2><div class="hint">${esc(c.event.name)} · لين 8 جولات، واللي يكسب 5 جولات أول يفوز</div>
      ${L.boss ? `<div class="boss-box">${ui.portrait(AMB.DATA.HEROES[L.heroId], { k: 'evb' })}<div><b>قدرة الزعيم: ${esc(L.special.name)}</b><p>${esc(L.special.text)}</p></div></div>` : ''}
      <h4>تشكيلة الخصم</h4><div class="cam-units">${units}</div><h4>الجائزة</h4><div class="cam-reward">${reward}</div>
      <h4>بطلك</h4><div class="hchips">${heroes}</div>${AMB.DeckGate ? AMB.DeckGate.line() : ''}
      <div class="cam-go"><button class="btn primary big" data-act="evGo" data-n="${stage}" ${h ? '' : 'disabled'}>قاتل!</button></div></div>`);
  }

  function start(stage) {
    if (AMB.DeckGate && !AMB.DeckGate.ensure()) return;
    const ui = UI(), S = ui.S;
    S.mode = 'event'; S.event = { stage, week: WK.current().idx }; S.picks = [pickHero(), null]; S.pickIdx = 0;
    ui.closeModal(); ui.startMatch();
  }

  function showResult(m, secs) {
    const ui = UI(), S = ui.S, stage = S.event.stage;
    if (!m._evDone) { m._evDone = true; S.evResult = WK.recordResult(stage, Object.assign(m.summary(0), { lifeLeft: m.players[0].life, roundsLost: m.players[0].stats.losses }), S.event.week); }
    const r = S.evResult, ev = AMB.WEEKLY.find((e) => e.id === r.event), L = WK.lineupFor(ev.id, stage), won = r.won, score = `${m.players[0].stats.wins} – ${m.players[1].stats.wins}`;
    const pay = won && r.first ? [r.shards ? `${icon('gem')} +${r.shards} شظية` : '', r.passXp ? `+${r.passXp} خبرة ممر` : ''].filter(Boolean).join(' · ') : '';
    const ex = AMB.DATA.UNITS[ev.exclusive];
    const gift = (r.pack ? `<div class="cam-pack"><b>🎁 باكج مجاني:</b><div class="cam-pack-row">${r.pack.cards.map((c, i) => `<div class="cu">${ui.portrait(C.def(c.id), { k: 'evr' + i + c.id })}<small class="r-${c.rarity}">${c.isNew ? 'جديدة!' : c.refund ? '+' + c.refund + ' شظية' : '+1 نسخة'}</small></div>`).join('')}</div></div>` : '')
      + (r.card ? `<div class="cam-pack ev-gift"><b>🌟 بطاقة حصرية!</b><div class="cam-pack-row"><div class="cu big">${ui.portrait(ex, { k: 'evxr' })}<small class="r-legendary">${esc(ex.name)} · ${r.cardIsNew ? 'جديدة!' : '+1 نسخة'}</small></div></div></div>` : '');
    const nextStage = won && WK.canPlay(stage + 1) ? stage + 1 : null;
    $('results').innerHTML = `<div class="res-stage ${won ? 'victory' : 'defeat'}" style="--wc:${W(ev.world).color}"><div class="res-rays"></div>
        <div class="res-hero">${ui.portrait(won ? AMB.DATA.HEROES[m.players[0].heroId] : AMB.DATA.HEROES[L.heroId], { bare: true, k: 'evrh' })}<i class="sheen"></i></div><div class="res-hname">${esc(L.name)}</div></div>
      <div class="res-banner"><h1>${won ? (L.boss ? 'هزمت زعيم الحدث!' : 'فوز!') : 'خسارة'}</h1><p class="hint">النتيجة ${score} · ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')} دقيقة</p>
        ${won ? `<p class="cam-pay">${r.first ? pay : 'تدريب: بدون جائزة'}</p>` : '<p class="hint">طوّر بطاقاتك وجرّب مرة ثانية</p>'}</div>${gift}
      <div class="cam-btns">${nextStage ? `<button class="btn primary big" data-act="evGo" data-n="${nextStage}">المرحلة التالية</button>` : ''}
        <button class="btn ${won ? '' : 'primary'} big" data-act="evGo" data-n="${stage}">${won ? 'أعد المرحلة' : 'حاول مرة ثانية'}</button>
        <button class="btn big ghost" data-act="go" data-to="event">الحدث</button>${won ? '' : '<button class="btn big ghost" data-act="go" data-to="cards">طوّر بطاقاتي</button>'}</div>`;
    ui.show('results'); ui.sfx(won ? 'win' : 'lose');
    if (won) setTimeout(() => { const el = document.querySelector('.res-hero'); if (el) ['#ffd24a', '#ffffff', W(ev.world).color].forEach((c) => ui.burst(el, c, 14, { r: 150, s: 8 })); }, 250);
  }

  AMB.TIPS = AMB.TIPS || {};
  AMB.TIPS.evinfo = () => { const R = AMB.ECONOMY.events.rewards; return { title: 'الحدث الأسبوعي', html: `<p>كل أسبوع (من الاثنين للأحد) حدث جديد من عالم مختلف: <b>${WK.stageCount()} مراحل</b> لين 8 جولات، واللي يكسب 5 جولات أول يفوز، والأخيرة زعيم الحدث بقدرتين.</p>
    <p>كل مرحلة تعطي شظايا وخبرة ممر (والثانية باكج مجاني) مرة واحدة في الأسبوع. هزيمة الزعيم تعطيك <b>بطاقة حصرية</b> ما تطلع في الباكجات ولا تضيع بعد انتهاء الحدث.</p>
    <p>الأحداث الأربعة تدور، فلو فاتك حدث يرجع بعد 4 أسابيع (وتاخذ نسخة تطوير إضافية للبطاقة لو عندك). الخسارة بدون عقوبة وتقدر تعيد.</p>` }; };

  function installActions() {
    const ui = UI(); if (!ui || ui.ACT.evStage) return;
    Object.assign(ui.ACT, { evStage: (d) => preview(+d.n), evHero: (d) => { hero = d.id; preview(+d.n); }, evGo: (d) => start(+d.n) });
  }

  AMB.EventUI = { render, refreshMenu, showResult, installActions };
  if (UI()) installActions();
  refreshMenu();
})();

;
/* ui/save-ui.js */
/*
 * "الحفظ" screen: progress is written to this browser after EVERY change (nothing to press). Here you see that,
 * ask the browser not to clear it, and move it between links/devices with a backup file.
 */
(function () {
  const AMB = globalThis.AMB;
  const $ = (id) => document.getElementById(id);
  const UI = () => globalThis.AMB_UI;
  let persisted = null;

  // ask the browser to keep our storage (it may otherwise clear it when the device is low on space)
  function askPersist() {
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().then((ok) => { persisted = !!ok; }); } catch (e) { /* ignore */ }
  }
  const fmt = (t) => { if (!t) return '—'; const d = new Date(t); return d.toLocaleDateString('ar') + ' ' + d.toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' }); };
  const sizeKB = () => { try { return Math.max(1, Math.round((localStorage.getItem(AMB.Save.KEY) || '').length / 1024)); } catch (e) { return 0; } };

  function open() {
    const sv = AMB.save;
    UI().modal(`<h2>💾 الحفظ</h2>
      ${sv.writeFailed() ? '<div class="save-box" style="border-color:#e0262f;color:#e0262f">⚠ <b>التقدم ما ينحفظ في هالمتصفح</b>: التخزين مقفل أو ممتلئ (أو وضع خاص). نزّل نسخة احتياطية بالزر تحت بعد كل جلسة.</div>' : '<div class="save-box ok">✓ <b>الحفظ تلقائي</b>: تقدمك ينحفظ لحاله مع كل تغيير، ما تحتاج تضغط شي.</div>'}
      <div class="save-kv"><span>آخر حفظ</span><b>${fmt(sv.updated())}</b></div>
      <div class="save-kv"><span>حجم البيانات</span><b style="direction:ltr">${sizeKB()} KB</b></div>
      <div class="save-kv"><span>الحماية من المسح التلقائي</span><b>${persisted === null ? 'غير معروفة' : persisted ? 'مفعّلة ✓' : 'يقرّرها المتصفح'}</b></div>
      <div class="save-kv"><span>نسخة احتياطية يومية</span><b>تلقائية ✓</b></div>
      ${sv.recovered ? '<div class="save-box warn">رجّعنا تقدمك من النسخة الاحتياطية بعد ما صار خلل في الحفظ.</div>' : ''}
      <h3>العرض</h3>
      <div class="save-btns"><button class="btn ${AMB.settings && AMB.settings.bigText() ? 'primary' : 'ghost'}" data-act="bigText">⚙️ حجم الخط وباقي الإعدادات</button></div>
      <h3>نقل التقدّم</h3>
      <p class="hint">الحفظ مربوط بهالمتصفح وهالرابط. لو فتحت اللعبة من رابط أو جهاز ثاني ما يطلع تقدمك، انقله بملف.</p>
      <div class="save-btns">
        <button class="btn primary" data-act="saveExport">⬇ نزّل نسخة احتياطية</button>
        <button class="btn" data-act="saveImport">⬆ استرجع من ملف</button>
        ${sv.hasBackup('preimport') ? '<button class="btn ghost" data-act="saveRestore" data-k="preimport">↩ ارجع للنسخة قبل آخر استيراد</button>' : ''}
        ${sv.hasBackup('bak') ? '<button class="btn ghost" data-act="saveRestore" data-k="bak">↩ ارجع للنسخة اليومية التلقائية</button>' : ''}
        <input type="file" id="save-file" accept="application/json,.json" hidden>
      </div>`);
    const f = $('save-file');
    if (f) f.onchange = () => {
      const file = f.files && f.files[0]; if (!file) return;
      const rd = new FileReader();
      rd.onload = () => {
        try { AMB.save.importJSON(String(rd.result)); UI().toast('رجع تقدمك ✓ جاري إعادة التحميل', 'good'); setTimeout(() => location.reload(), 900); }
        catch (e) { UI().toast('الملف غير صالح', 'err'); }
      };
      rd.readAsText(file);
    };
  }

  function installActions() {
    const ui = UI(); if (!ui || ui.ACT.saveOpen) return;
    Object.assign(ui.ACT, {
      bigText: () => { if (!AMB.settings) return; ui.closeModal(); if (ui.ACT.settings) ui.ACT.settings(); },   // the text size now lives in «الإعدادات»
      saveOpen: () => open(),
      saveExport: () => {
        const blob = new Blob([AMB.save.exportJSON()], { type: 'application/json' });
        const a = document.createElement('a'), d = new Date();
        a.href = URL.createObjectURL(blob);
        a.download = `zor-save-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.json`;
        document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
        ui.toast('نزلت النسخة الاحتياطية', 'good');
      },
      saveImport: () => { const f = $('save-file'); if (f) f.click(); },
      saveRestore: (d) => { try { AMB.save.restore(d.k); ui.toast('رجعت النسخة ✓ جاري إعادة التحميل', 'good'); setTimeout(() => location.reload(), 900); } catch (e) { ui.toast('ما قدرت أرجّع النسخة', 'err'); } },
    });
  }

  // (no flush on pagehide/hidden: a write with nothing new made the reloading page think another tab had written, and it showed the lock overlay)
  document.addEventListener('pointerdown', function once() { askPersist(); document.removeEventListener('pointerdown', once); }, { once: true });

  if (AMB.save && AMB.save.onWriteFail) AMB.save.onWriteFail(() => { try { UI().toast('⚠ التقدم ما ينحفظ في هالمتصفح. نزّل نسخة احتياطية من «الحفظ»', 'err'); } catch (e) { /* ignore */ } });
  // another tab wrote the save: this one is stale and has stopped writing; the player must reload (the newest tab wins)
  if (AMB.save && AMB.save.onLock) AMB.save.onLock(() => {
    const d = document.createElement('div'); d.id = 'save-lock';
    d.innerHTML = '<div class="sl-box"><h2>اللعبة مفتوحة في تبويب ثاني</h2><p>تقدمك انحفظ في التبويب الجديد. هذا التبويب ما يحفظ حتى ما يمسح عليه. حدّث الصفحة وكمّل.</p><button class="btn big primary" onclick="location.reload()">حدّث الصفحة</button></div>';
    document.body.appendChild(d);
  });
  try { if (AMB.settings && AMB.settings.bigText()) document.body.classList.add('big-text'); } catch (e) { /* ignore */ }   // big-text mode from the save
  AMB.SaveUI = { open, installActions };
  if (UI()) installActions();
})();

;
/* ui/update-ui.js */
/*
 * Automatic updates. The built game (docs/index.html, dist/zor.html) carries a build id in
 * <meta name="zor-build"> and is published next to version.json. While the game is open it checks
 * that file (at start, when you come back to the tab, and every 5 minutes). A new version is applied
 * by itself when you are NOT in a match (progress is saved instantly, nothing is lost); during a match
 * a small banner waits until you are back at the menus. Only runs when served over http(s).
 */
(function () {
  const AMB = globalThis.AMB;
  const meta = document.querySelector('meta[name="zor-build"]');
  if (!meta || !/^https?:$/.test(location.protocol)) return;
  const mine = meta.content;
  let pending = null, banner = null;
  const ss = { get: (k) => { try { return sessionStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) { /* ignore */ } }, del: (k) => { try { sessionStorage.removeItem(k); } catch (e) { /* ignore */ } } };
  const UI = () => globalThis.AMB_UI;
  const busy = () => { const u = UI(); return !u || u.S.screen === 'match' || u.S.screen === 'hero' || document.getElementById('overlay').classList.contains('on') || document.getElementById('modal-back').classList.contains('on') || !!u.S.net; };

  // the notice comes, stays ~2 seconds and goes (it never sits on top of the cards); it is not repeated for the same message
  let hideT = 0, lastMsg = '';
  function showBanner(text, withBtn, ms) {
    if (text === lastMsg && !withBtn) return;
    lastMsg = text;
    if (!banner) { banner = document.createElement('div'); banner.className = 'upd-banner'; document.body.appendChild(banner); }
    const inMatch = UI() && UI().S.screen === 'match';
    banner.innerHTML = `<span>${text}</span>${withBtn && !inMatch ? '<button class="btn small primary" id="upd-now">حدّث الآن</button>' : ''}`;
    banner.style.pointerEvents = withBtn && !inMatch ? '' : 'none';
    banner.classList.remove('gone'); void banner.offsetWidth;
    const b = banner.querySelector('#upd-now'); if (b) b.onclick = () => apply(pending);
    clearTimeout(hideT); hideT = setTimeout(() => { if (banner) banner.classList.add('gone'); }, ms || 2000);
  }
  function apply(v) { ss.set('zor_upd', v); location.replace(location.pathname + '?v=' + encodeURIComponent(v)); }   // the query string skips a stale cached copy

  function tick() {
    if (!pending) return;
    if (busy()) { showBanner('🔄 فيه تحديث جديد، ينزل بعد المباراة'); return; }
    if (ss.get('zor_upd') === pending) { showBanner('🔄 فيه تحديث جديد', true, 6000); return; }   // already tried once for this version: let the player decide
    const v = pending; pending = null;
    showBanner('🔄 جاري تحديث اللعبة… تقدمك محفوظ');
    setTimeout(() => apply(v), 1200);
  }
  async function check() {
    try {
      const r = await fetch('version.json?' + Date.now(), { cache: 'no-store' });
      if (!r.ok) return;
      const j = await r.json();
      if (j && j.v && j.v !== mine) { pending = j.v; tick(); }
    } catch (e) { /* offline: try later */ }
  }

  // after an update: say so once
  if (ss.get('zor_upd') === mine) { ss.del('zor_upd'); window.addEventListener('load', () => setTimeout(() => UI() && UI().toast('حدّثنا اللعبة ✓', 'good'), 800)); }
  // installable app: register the service worker (offline play + the "install app" prompt); updates still arrive through version.json
  // files this page loaded before the worker took over (first visit) are handed to it, so the game also starts offline next time
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(() => {});
    const handOver = () => navigator.serviceWorker.ready.then((reg) => {
      const urls = performance.getEntriesByType('resource').map((r) => r.name).concat([...document.querySelectorAll('svg image')].map((i) => i.href.baseVal ? new URL(i.href.baseVal, location.href).href : ''));
      if (reg.active) reg.active.postMessage({ cache: [...new Set(urls)].filter(Boolean) });
    }).catch(() => {});
    if (document.readyState === 'complete') setTimeout(handOver, 1500); else window.addEventListener('load', () => setTimeout(handOver, 1500));
  }
  setTimeout(check, 2500);
  setInterval(check, 5 * 60 * 1000);
  setInterval(tick, 3000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
  AMB.Update = { check, build: mine };
})();
