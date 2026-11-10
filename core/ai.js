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
