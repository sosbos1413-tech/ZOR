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
