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
    return (1 + (def.tier - 1) * 0.5) * AMB.CONFIG.stars.mult[u.star] + u.items.length * 0.35;
  }

  function wantScore(match, p, defId) {
    const { UNITS, HEROES } = AMB.DATA;
    const def = UNITS[defId];
    const hero = HEROES[p.heroId];
    const owned = match.allUnits(p);
    let s = 0;
    const sameStar1 = owned.filter((u) => u.defId === defId && u.star === 1).length;
    const sameAny = owned.filter((u) => u.defId === defId).length;
    s += sameStar1 * 2.6 + (sameAny - sameStar1) * 1.2;
    const style = p.aiStyle;
    if (def.world === hero.world) s += style === 'mono' ? 3 : style === 'balanced' ? 1.4 : 0.4;
    const roles = {};
    const worlds = new Set();
    owned.forEach((u) => { const d = UNITS[u.defId]; roles[d.role] = (roles[d.role] || 0) + 1; worlds.add(d.world); });
    if (!roles[def.role]) s += style === 'mixed' ? 2 : 1;
    if (def.role === 'guardian' && (roles.guardian || 0) < 2) s += 1.2;
    if (style === 'mixed' && !worlds.has(def.world)) s += 1.2;
    s += def.tier * (p.level >= 6 ? 0.9 : 0.5);
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
      if (chosen.length >= p.level) break;
      if (seen.has(u.defId) && ranked.some((x) => !seen.has(x.defId) && !chosen.includes(x) && power(x) >= power(u) * 0.7)) continue;
      chosen.push(u); seen.add(u.defId);
    }
    for (const u of ranked) { if (chosen.length >= p.level) break; if (!chosen.includes(u)) chosen.push(u); }

    const front = chosen.filter((u) => ['guardian', 'fighter'].includes(UNITS[u.defId].role));
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
    front.forEach((u, i) => (p.board[FRONT[i]] = u));
    back.forEach((u, i) => (p.board[backSlots[i]] = u));
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

  function prep(match, pi) {
    const p = match.players[pi];
    if (p.lineup) return;   // scripted campaign enemy: its board is set by match.applyLineup
    const cfg = AMB.CONFIG.ai[p.difficulty] || AMB.CONFIG.ai.normal;
    const rng = AMB.util.RNG(match.seed + match.round * 7919 + pi * 31);
    const E = AMB.CONFIG.economy;
    const hero = AMB.DATA.HEROES[p.heroId];

    // --- leveling
    const reserve = reserveTarget(match, p);
    let guard = 0;
    while (guard++ < 6 && p.level < E.maxLevel && match.round >= 2) {
      const boardFull = match.boardCount(p) >= p.level || match.allUnits(p).length > p.level;
      const surplus = p.gold - E.xpCost - reserve * (1 / cfg.levelAggro);
      const almost = match.xpNeeded(p) - p.xp <= E.xpPerBuy;
      if (boardFull && (surplus >= 0 || (almost && p.gold - E.xpCost >= reserve * 0.5))) match.buyXp(pi); else break;
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
      const roomForMore = match.allUnits(p).length < p.level + E.benchSize - 1;
      const threshold = match.round <= 2 ? 1 : 3.2;
      if (best >= 0 && bestScore >= threshold && roomForMore) {
        const cost = AMB.DATA.UNITS[p.shop[best]].cost;
        const mustHave = bestScore >= 5.5;
        if (p.gold - cost >= reserve || mustHave) {
          if (rng.chance(cfg.mistakes * 0.3)) { p.shop[best] = p.shop[best]; } else { match.buy(pi, best); continue; }
        }
      }
      const canReroll = p.freeRerolls > 0 || p.gold - E.rerollCost >= reserve + 2;
      if (canReroll && rerolls < 6 && rng.chance(cfg.rerollGreed) && match.round >= 2) { match.reroll(pi); rerolls++; continue; }
      break;
    }

    // --- items
    p.itemShop.forEach((id, i) => {
      if (!id) return;
      const it = AMB.DATA.ITEMS[id];
      if (p.gold - it.cost >= reserve && match.boardCount(p) + p.bench.filter(Boolean).length >= 2 && rng.chance(0.7)) match.buyItem(pi, i);
    });

    // --- hero summon decision (before arranging so a slot is kept)
    const aggressive = hero.id === 'kagira';
    const wantSummon = match.round >= (aggressive ? 3 : 5) && p.life - AMB.CONFIG.combat.summonKnockout >= (aggressive ? 30 : 45);
    p.summoned = wantSummon && match.allUnits(p).length >= Math.min(p.level, 3) && p.level < 8;

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
        case 'essence': return 3.2;
        case 'item': return 3.5;
        default: return 0;
      }
    };
    let best = 0, bs = -1;
    o.options.forEach((id, i) => { const sc = score(id); if (sc > bs) { bs = sc; best = i; } });
    return match.claimReward(pi, best);
  }
  function claimRewards(match) { match.players.forEach((_, i) => { if (match.players[i].rewardOffer && !match.players[i].rewardOffer.claimed) claimReward(match, i); }); }

  AMB.AI = { prep, power, claimReward, claimRewards };
})();
