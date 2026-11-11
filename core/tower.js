/*
 * Challenge tower: 30 floors, each a short best-of-3 fight (same rules as the campaign) against an enemy
 * line-up GENERATED from the floor number (deterministic, so a floor is the same every time). Floors get
 * harder step by step; every 5th floor is a boss (the world's hero + a special, like the campaign bosses).
 * First clear of a floor pays shards + pass XP; boss floors a free pack; floor 30 a guaranteed epic+ card.
 * Retrying a lost floor costs nothing. The highest floor reached is saved. Settings: AMB.ECONOMY.tower.
 */
(function () {
  const AMB = globalThis.AMB;
  const T = () => AMB.ECONOMY.tower;
  const WORLD_ORDER = ['ember', 'tide', 'neon', 'sylvan'];

  AMB.Save.register('tower', {
    version: 1,
    defaults: () => ({ best: 0, attempts: {}, wins: {}, runs: 0 }),   // best = highest floor cleared
  });

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /** enemy stat multiplier on a floor */
  function powerFor(n) {
  const P = T().power;
  if (P.length >= T().floors) return P[n - 1];   // one value per floor (tools/tune-tower.js)
  const [a, b = 0, c = 0] = P; return a + b * n + c * n * n;   // or a + b*floor + c*floor^2
}
  const isBoss = (n) => n % T().bossEvery === 0;
  const bossIndex = (n) => n / T().bossEvery - 1;
  const bossWorld = (n) => WORLD_ORDER[bossIndex(n) % 4];
  function startFor(n) { let s = T().start[0]; T().start.forEach((x) => { if (n >= x.from) s = x; }); return { gold: s.gold, level: s.level }; }

  /**
   * Generates an enemy line-up (pure + deterministic for the same options). o = { n: difficulty position 1..30,
   * seed, boss, world, special?: boss special, name? }. Used by the tower (one fixed line-up per floor) and by weekly events.
   */
  function generate(o) {
    const n = o.n, rng = AMB.util.RNG(o.seed), boss = !!o.boss, world = o.world;
    const heroId = Object.values(AMB.DATA.HEROES).find((h) => h.world === world).id;
    const maxUnits = boss ? 7 : 8;                                   // a boss hero stands on slot b1
    const count = Math.min(maxUnits, 5 + Math.floor((n - 1) / 8));   // 5 units early .. 8 late (a player starts with 5 board slots)
    const k = (n - 1) / (T().floors - 1);
    const tierW = [65 - 45 * k, 28 + 7 * k, 7 + 38 * k];              // shop-like tier odds: weak early, strong late
    const starTwo = clamp((n - 10) / 50, 0, 0.35), starThree = clamp((n - 22) / 80, 0, 0.15);
    const all = Object.values(AMB.DATA.UNITS).filter((u) => !u.exclusive);
    const used = {};
    const pick = (roles) => {
      const tier = rng.weighted(tierW.map((w, i) => [i + 1, w]));
      let pool = all.filter((u) => roles.includes(u.role) && u.tier === tier && (used[u.id] || 0) < 2);
      const home = pool.filter((u) => u.world === world);
      pool = home.length && rng.chance(0.7) ? home : pool;
      if (!pool.length) pool = all.filter((u) => roles.includes(u.role) && (used[u.id] || 0) < 2);
      const u = pool[rng.int(pool.length)];
      used[u.id] = (used[u.id] || 0) + 1;
      return u;
    };
    const front = Math.max(1, Math.round(count * 0.4)), back = count - front;
    const picks = [];
    for (let i = 0; i < front; i++) picks.push(pick(i % 2 ? ['fighter'] : ['guardian']));
    for (let i = 0; i < back; i++) picks.push(pick([['marksman', 'mage'], ['support', 'mage'], ['marksman', 'assassin'], ['mage', 'marksman']][i % 4]));
    const fslots = ['f1', 'f2', 'f0', 'f3'], bslots = boss ? ['b0', 'b2', 'b3'] : ['b1', 'b2', 'b0', 'b3'];
    // an assassin counts as a back unit here; an assassin may also stand in front, but keep it simple: back
    let fi = 0, bi = 0;
    const units = picks.map((u, i) => {
      const isFront = i < front;
      const slot = isFront ? fslots[fi++] : bslots[bi++] || fslots[fi++] || 'b3';
      const star = rng.chance(starThree) ? 3 : rng.chance(starTwo) ? 2 : 1;
      const from = i < Math.ceil(count * 0.6) ? 1 : i < Math.ceil(count * 0.85) ? 2 : 3;
      return [u.id, star, slot, from];
    });
    const sp = boss ? (o.special || AMB.LEVELS.BOSS[world]) : null;
    const scale = boss && n >= 25 && !o.special ? 1.4 : 1;           // the last two tower bosses hit harder
    const blessings = sp ? Object.fromEntries(Object.entries(sp.blessings).map(([kk, v]) => [kk, +(v * scale).toFixed(2)])) : null;
    return { floor: n, world, heroId, boss, units, summon: boss ? 'b1' : null, blessings, abilities: sp ? sp.abilities : [], special: sp,
      name: o.name || (boss ? `زعيم الطابق ${n}: ${AMB.DATA.HEROES[heroId].name}` : `الطابق ${n}`) };
  }
  /** the generated enemy for a tower floor */
  function lineupFor(n) {
    const boss = isBoss(n);
    return generate({ n, seed: 7000 + n * 131, boss, world: boss ? bossWorld(n) : WORLD_ORDER[(n - 1) % 4] });
  }

  function rewardsFor(n) {
    const R = T().rewards, boss = isBoss(n);
    return { shards: R.shardsFirst + Math.round(((R.shardsLast - R.shardsFirst) * (n - 1)) / (T().floors - 1)), passXp: boss ? R.passXpBoss : R.passXp,
      pack: boss ? R.bossPack : null, card: n === T().floors ? R.finalCard : null };
  }

  function Tower(save, deps) {
    deps = deps || {};
    const st = () => save.get('tower');
    const api = {
      floors: () => T().floors, isBoss, bossWorld, lineupFor, powerFor, startFor, rewardsFor,
      best: () => st().best,
      next: () => Math.min(T().floors, st().best + 1),
      done: () => st().best >= T().floors,
      unlocked: () => !deps.campaign || deps.campaign.levelDone(T().unlock.campaignLevel),
      canPlay: (n) => api.unlocked() && n >= 1 && n <= Math.min(T().floors, st().best + 1),
      attempts: (n) => st().attempts[n] || 0,
      /** options for new AMB.Match(...) on a floor */
      matchOptions(n, heroId, seed) {
        const L = lineupFor(n), C = deps.collection, power = powerFor(n);
        const enemyPower = {}; L.units.forEach(([id]) => (enemyPower[id] = power)); enemyPower[L.heroId] = power;
        return {
          mode: 'tower', seed, progression: true,
          rules: Object.assign({}, AMB.LEVELS.CAMPAIGN.rules, { start: startFor(n) }),
          players: [
            { heroId, name: 'أنت', cardPower: C ? C.powerMap() : null, allowedUnits: C ? C.playableUnits() : null, heroLevel: (globalThis.AMB.heroes ? AMB.heroes.level(heroId) : 1) },
            { heroId: L.heroId, name: L.name, isAI: true, cardPower: enemyPower, lineup: { units: L.units, growth: 0.07, summon: L.summon, blessings: L.blessings, abilities: L.abilities } },
          ],
        };
      },
      /** record a finished fight (match.summary(0) fields + lifeLeft); pays rewards on the first clear of a floor */
      recordResult(n, res) {
        const won = !!res.won, first = won && n > st().best && n === st().best + 1;
        const out = { floor: n, won, boss: isBoss(n), first, shards: 0, passXp: 0, pack: null, card: null, best: st().best };
        save.update('tower', (s) => { s.attempts[n] = (s.attempts[n] || 0) + 1; s.runs++; if (won) { s.wins[n] = (s.wins[n] || 0) + 1; if (first) s.best = n; } });
        if (first) {
          const pay = rewardsFor(n);
          if (deps.wallet) { deps.wallet.add('shards', pay.shards, 'tower'); out.shards = pay.shards; }
          if (deps.addPassXp) { deps.addPassXp(pay.passXp); out.passXp = pay.passXp; }
          if (pay.pack && deps.packs) out.pack = deps.packs.open(pay.pack, { free: true });
          if (pay.card && deps.collection) out.card = deps.collection.grantRandom(pay.card, deps.rng);
        }
        out.best = st().best;
        if (deps.events) deps.events.emit('towerEnd', Object.assign({}, out, { summary: res }));
        return out;
      },
    };
    return api;
  }

  AMB.Tower = Tower;
  AMB.Tower.generate = generate; AMB.Tower.lineupFor = lineupFor; AMB.Tower.powerFor = powerFor; AMB.Tower.rewardsFor = rewardsFor;
})();
