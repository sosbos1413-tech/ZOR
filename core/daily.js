/*
 * Daily login calendar (7 days). Opening the game on a new day lets you claim the next reward;
 * missing days does not reset progress; after day 7 a new cycle starts. Rewards: AMB.ECONOMY.login.
 */
(function () {
  const AMB = globalThis.AMB;
  const dayKey = (t) => { const d = new Date(t); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };

  AMB.Save.register('login', {
    version: 1,
    defaults: () => ({ next: 0, lastKey: 0, claims: 0, cycles: 0 }),   // next = index (0..6) of the reward to claim
  });

  function Login(save, deps) {
    deps = deps || {};
    const now = deps.now || save.now || (() => Date.now());
    const st = () => save.get('login');
    const R = () => AMB.ECONOMY.login;
    const api = {
      rewards: R,
      today: () => dayKey(now()),
      canClaim: () => st().lastKey !== dayKey(now()),
      /** index (0..6) of today's reward if claimable, else of tomorrow's */
      nextIndex: () => st().next,
      claimedToday: () => st().lastKey === dayKey(now()),
      status() { const s = st(); return { next: s.next, canClaim: api.canClaim(), claims: s.claims, cycles: s.cycles }; },
      /** claim today's reward; returns what was given or null if already claimed today */
      claim() {
        if (!api.canClaim()) return null;
        const idx = st().next, rw = R()[idx], out = { day: idx + 1, shards: 0, packs: [], card: null };
        save.update('login', (s) => { s.lastKey = dayKey(now()); s.claims++; s.next = (s.next + 1) % R().length; if (s.next === 0) s.cycles++; });
        if (rw.shards && deps.wallet) { deps.wallet.add('shards', rw.shards, 'login'); out.shards = rw.shards; }
        for (let i = 0; i < (rw.packs || 0); i++) if (deps.packs) out.packs.push(deps.packs.open('basic', { free: true }));
        if (rw.card && deps.collection) out.card = deps.collection.grantRandom(rw.card, deps.rng);
        if (deps.events) deps.events.emit('loginClaimed', out);
        return out;
      },
    };
    return api;
  }

  AMB.Login = Login;
  AMB.Login.dayKey = dayKey;
})();
