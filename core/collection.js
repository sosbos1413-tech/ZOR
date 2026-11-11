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
