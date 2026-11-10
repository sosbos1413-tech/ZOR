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
    upgradeCost: { 2: 7, 3: 10, 4: 13, 5: 16 },
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
