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
      common:    { name: 'كومن',     en: 'Common',    order: 1, color: '#9aa3ad', c2: '#5d6670', power: 1.00, copies: [2, 4, 8, 12] },
      rare:      { name: 'رير',      en: 'Rare',      order: 2, color: '#3d8ff0', c2: '#1b4f99', power: 1.04, copies: [3, 6, 10, 15] },
      epic:      { name: 'إيبك',     en: 'Epic',      order: 3, color: '#a855f7', c2: '#5b1d99', power: 1.08, copies: [4, 7, 12, 17] },
      legendary: { name: 'ليجندري', en: 'Legendary', order: 4, color: '#ff9f1a', c2: '#a34f00', power: 1.12, copies: [5, 9, 14, 20] },
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
      power: [1.12,1.27,1.28,1.28,0.87,1.26,1.17,1.06,1.12,0.86,1.06,0.99,1.28,0.93,1.14,1.58,0.92,0.93,1.11,0.63,1.17,0.89,0.94,1.18,0.76,0.89,0.71,1.19,1.18,0.93],   // per floor, from tools/tune-tower.js
      start: [{ from: 1, gold: 8, level: 5 }, { from: 15, gold: 12, level: 6 }, { from: 25, gold: 14, level: 7 }],
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
      start: [{ gold: 10, level: 5 }, { gold: 12, level: 6 }, { gold: 14, level: 7 }],
      rewards: [{ shards: 40, passXp: 10 }, { shards: 60, passXp: 20, pack: 'basic' }, { shards: 100, passXp: 50, exclusive: true }],
      power: { ember: [1.09, 1.44, 0.8], tide: [1.0, 1.16, 1.06], neon: [1.16, 1.21, 0.8], sylvan: [1.02, 1.42, 0.92] },
    },
    // Guided first match: a fixed weak enemy (2 units, the 2nd joins in round 2), a little extra gold/level, a reward once
    tutorial: { start: { gold: 10, level: 4 }, enemy: [['thorn_fox', 1, 'f1', 1], ['pixel_sniper', 1, 'b1', 2], ['moss_warden', 1, 'f2', 3]], reward: { shards: 50 } },   // 3 rounds: 1 buy+place, 2 merge+refresh, 3 level up + send the hero
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
