/*
 * ZOR (Zones Of Rift) — tunable configuration.
 * Every number that shapes balance or pacing lives here, so it can be changed
 * and re-tested (tools/simulate.js) without touching the engine.
 * All values are prototype defaults, NOT final rules.
 */
(function () {
  const AMB = (globalThis.AMB = globalThis.AMB || {});

  AMB.CONFIG = {
    version: '0.1.0',

    match: {
      heroLifePerLevel: 1,   // +1 hero life per hero level above 1 (the profile's hero level; quick vs AI and progression fights, never online/hotseat)
      heroLife: 100,            // life total of every hero
      prepSeconds: 40,          // prep timer (shop + formation) vs AI
      hotseatPrepSeconds: 45,   // prep timer per player in same-device PvP
      maxRounds: 7,             // the whole match: 7 rounds in 4 stages. After round 7 the higher hero life wins
      collapseStartRound: 99,   // unused now (the finale replaces rift collapse); kept so old tuning still loads
      collapseDamage: [3, 6, 10, 15, 21, 28, 36, 45],
      roundResultSeconds: 2.5,
      // stages: the 7 rounds are grouped; a reward draft follows every stage except the last
      stages: [
        { id: 'spark', name: 'الشرارة', rounds: [1, 2] },
        { id: 'blaze', name: 'الاشتعال', rounds: [3, 4] },
        { id: 'rift', name: 'الصدع', rounds: [5, 6] },
        { id: 'finale', name: 'الحسم', rounds: [7, 7] },
      ],
      catchUpGap: 20,           // trailing by this much life (or more) at a reward draft => a 4th option
      catchUpExtraGold: 0,
      finaleLossMult: 1.5,      // life lost by the loser of the final round is multiplied
    },

    economy: {
      baseIncome: 5,
      interestPer: 10,          // +1 gold per 10 banked
      interestMax: 3,
      winBonus: 1,
      catchUp: { gap: 10, gold: 3 },   // behind by this much life (round 3+, PvP-style modes): +gold per round
      streakBonus: [[2, 1], [4, 2]], // [minStreak, bonus] win OR loss streak
      rerollCost: 1,
      xpCost: 4,
      xpPerBuy: 4,
      xpPerRound: 3,
      startLevel: 3,            // level == max units on the board
      maxLevel: 8,
      xpToLevel: { 3: 4, 4: 8, 5: 12, 6: 18, 7: 24 },
      shopSlots: 5,
      itemShopSlots: 2,
      benchSize: 6,
      itemBenchSize: 6,
      sellRefund: 1.0,          // fraction of total copies' cost returned
      // shop tier odds (%) by player level: [tier1, tier2, tier3]
      tierOdds: {
        3: [80, 20, 0],
        4: [65, 30, 5],
        5: [50, 38, 12],
        6: [38, 40, 22],
        7: [28, 40, 32],
        8: [20, 38, 42],
      },
      poolSize: { 1: 10, 2: 8, 3: 6 }, // copies per unit shared by both players
      essenceStart: 2,
      essencePerRound: 2,
      essenceMax: 10,
      maxItemsPerUnit: 2,
      maxArmedSpells: 2,
    },

    stars: {
      // stat multiplier per star (hp & attack). Capped at 3 stars on purpose:
      // a 3-star is strong but still loses to a well-built team (see DESIGN.md).
      mult: { 1: 1, 2: 1.8, 3: 3.0 },
      copiesPerStar: 3,
      copiesTo: { 2: 3, 3: 2 },   // same-star units that merge into the next star: 3×★ = ★★, 2×★★ = ★★★ (6 copies, reachable in a 7-round match)
      rewardHeldWeight: 10,        // the free-recruit reward favours units you already hold (weight per copy held)
      ownedShopWeight: 8,         // shop focus: a unit you hold (below ★★★) is this many times likelier to show up in your shop
      focusMinCopies: 2,          // ...once you hold at least this many copies of it
      focusFreshOnly: true,       // true: the focus only shapes the free shop at the start of a round (not paid rerolls)
      maxStar: 3,
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
      easy: { mistakes: 0.35, rerollGreed: 0.4, levelAggro: 0.6, maxLevel: 5, noSummon: true },
      normal: { mistakes: 0.12, rerollGreed: 0.7, levelAggro: 1.0 },
      hard: { mistakes: 0.0, rerollGreed: 1.0, levelAggro: 1.6, reserveCap: 10, summonFrom: 2, summonMinLife: 40 },
    },
  };
})();
