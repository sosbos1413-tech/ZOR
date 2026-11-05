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
      shards: { name: 'شظايا', icon: 'gem', start: 300, max: 999999 },      // earned in missions/levels, spent on packs (new players start with 3 packs' worth)
    },
    // Card rarity. `power` and card levels only apply in progression fights (campaign, tower, events),
    // never in quick matches or same-device play, so those stay fair.
    //   copies[i] = duplicate copies needed to go from level i+1 to level i+2 (rarer = more copies).
    rarities: {
      common:    { name: 'كومن',     en: 'Common',    order: 1, color: '#9aa3ad', c2: '#5d6670', power: 1.00, copies: [2, 4, 8, 12] },
      rare:      { name: 'رير',      en: 'Rare',      order: 2, color: '#3d8ff0', c2: '#1b4f99', power: 1.04, copies: [3, 6, 10, 15] },
      epic:      { name: 'إيبك',     en: 'Epic',      order: 3, color: '#a855f7', c2: '#5b1d99', power: 1.08, copies: [4, 8, 14, 20] },
      legendary: { name: 'ليجندري', en: 'Legendary', order: 4, color: '#ff9f1a', c2: '#a34f00', power: 1.12, copies: [5, 10, 16, 25] },
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
    // album: own all 5 units of a world -> its reward (once); own all 20 -> the grand reward
    album: {
      worlds: {
        ember: { shards: 300, title: 'alb_ember', frame: 'alb_ember' },
        tide: { shards: 300, title: 'alb_tide', frame: 'alb_tide' },
        neon: { shards: 300, title: 'alb_neon', frame: 'alb_neon' },
        sylvan: { shards: 300, title: 'alb_sylvan', frame: 'alb_sylvan' },
      },
      all: { packs: 3, title: 'alb_all' },
    },
    cards: {
      levelBonus: 0.07,        // +7% hp & attack per card level above 1 (progression fights only)
      allUnlocked: false,      // true = every card owned (dev / testing)
      // what a new player owns: the starter roster (units flagged `starter` in core/data.js = the first 20)
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
    const known = (id) => { if (!ECONOMY.currencies[id]) throw new Error('عملة غير معروفة: ' + id); };
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
