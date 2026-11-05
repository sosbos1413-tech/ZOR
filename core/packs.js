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
    defaults: () => ({ opened: 0, since: {}, found: { common: 0, rare: 0, epic: 0, legendary: 0 }, last: [] }),   // since[packId] = packs since the pity rarity
  });

  function poolByRarity() {
    const pool = {};
    Object.values(AMB.DATA.HEROES).concat(Object.values(AMB.DATA.UNITS)).forEach((d) => {
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
          const cid = list[rng.int(list.length)];
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
