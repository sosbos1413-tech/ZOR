/*
 * Card album: every card in the game; missing ones show as shadows. Own every unit of a world
 * (5 each) to claim that world's set reward once: shards + a title + a frame in the world's colour.
 * Own all 20 units: bonus packs + the title "جامع الصدع". Heroes are listed but belong to no set
 * (they become playable characters in a later phase). Rewards: AMB.ECONOMY.album.
 */
(function () {
  const AMB = globalThis.AMB;

  AMB.Save.register('album', { version: 1, defaults: () => ({ claimed: {}, all: false }) });

  function Album(save, deps) {
    deps = deps || {};
    const st = () => save.get('album');
    const A = () => AMB.ECONOMY.album;
    const units = (world) => Object.values(AMB.DATA.UNITS).filter((u) => u.world === world && !u.exclusive).map((u) => u.id);
    const api = {
      worlds: () => Object.keys(AMB.DATA.WORLDS),
      units,
      /** { owned, total } for a world */
      progress(world) { const ids = units(world); return { owned: ids.filter((id) => deps.collection.owned(id)).length, total: ids.length }; },
      total() { const ids = Object.keys(AMB.DATA.UNITS).filter((id) => !AMB.DATA.UNITS[id].exclusive); return { owned: ids.filter((id) => deps.collection.owned(id)).length, total: ids.length }; },
      heroes: () => Object.keys(AMB.DATA.HEROES).map((id) => ({ id, owned: deps.collection.owned(id) })),
      reward: (world) => A().worlds[world],
      /** 'claimed' | 'ready' | 'locked' */
      state(world) { if (st().claimed[world]) return 'claimed'; const p = api.progress(world); return p.owned >= p.total ? 'ready' : 'locked'; },
      allState() { if (st().all) return 'claimed'; const t = api.total(); return t.owned >= t.total ? 'ready' : 'locked'; },
      readyCount() { return api.worlds().filter((w) => api.state(w) === 'ready').length + (api.allState() === 'ready' ? 1 : 0); },
      /** cosmetic ids the album gave (the pass lists them as owned) */
      ownedCosmetics(type) {
        const out = [];
        api.worlds().forEach((w) => { if (st().claimed[w] && A().worlds[w][type]) out.push(A().worlds[w][type]); });
        if (st().all && A().all[type]) out.push(A().all[type]);
        return out;
      },
      claim(world) {
        if (api.state(world) !== 'ready') return null;
        const rw = A().worlds[world];
        save.update('album', (s) => { s.claimed[world] = true; });
        if (rw.shards && deps.wallet) deps.wallet.add('shards', rw.shards, 'album');
        if (deps.events) deps.events.emit('albumClaimed', { world, reward: rw });
        return { world, reward: rw, packs: [] };
      },
      claimAll() {
        if (api.allState() !== 'ready') return null;
        const rw = A().all, out = { reward: rw, packs: [] };
        save.update('album', (s) => { s.all = true; });
        for (let i = 0; i < (rw.packs || 0); i++) if (deps.packs) out.packs.push(deps.packs.open('basic', { free: true }));
        if (rw.shards && deps.wallet) deps.wallet.add('shards', rw.shards, 'album');
        if (deps.events) deps.events.emit('albumClaimed', { world: '*', reward: rw });
        return out;
      },
    };
    return api;
  }

  AMB.Album = Album;
})();
