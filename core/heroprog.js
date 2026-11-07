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
