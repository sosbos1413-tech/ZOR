/*
 * Campaign progress: which fights are unlocked / cleared, building a fight's match,
 * and paying rewards (first win: shards + battle-pass XP; boss: more; whole level: a free pack;
 * replays: a little). Level data lives in core/levels.js.
 */
(function () {
  const AMB = globalThis.AMB;
  const LV = () => AMB.LEVELS;

  /** stars for one result: 0 = loss, 1 = win, 2 = no round lost, 3 = no round lost and full hero life */
  function rate(res) {
    if (!res || !res.won) return 0;
    const clean = (res.roundsLost || 0) === 0;
    return 1 + (clean ? 1 : 0) + (clean && (res.lifeLeft || 0) >= (res.maxLife || AMB.CONFIG.match.heroLife) ? 1 : 0);
  }

  AMB.Save.register('campaign', {
    version: 2,
    // cleared[fightId] = true; levelsDone[levelId] = true; stars[fightId] = best 1..3; chests = claimed chest ids;
    // stats per fight: { attempts, wins, best:{ lifeLeft, roundsLost } }
    defaults: () => ({ cleared: {}, levelsDone: {}, stats: {}, stars: {}, chests: [] }),
    // v1 had no stars: rate the best recorded result of every cleared fight (at least 1 star)
    migrate: (s) => {
      s.stars = s.stars || {};
      Object.keys(s.cleared || {}).forEach((id) => { const b = (s.stats[id] || {}).best; s.stars[id] = Math.max(1, b ? rate(Object.assign({ won: true }, b)) : 1); });
      return s;
    },
  });

  function Campaign(save, deps) {
    deps = deps || {};
    const st = () => save.get('campaign');
    const levels = () => LV().LEVELS;

    function find(fightId) {
      for (let li = 0; li < levels().length; li++) {
        const l = levels()[li], fi = l.fights.findIndex((f) => f.id === fightId);
        if (fi >= 0) return { level: l, li, fight: l.fights[fi], fi };
      }
      return null;
    }

    // one card of `minRarity` or rarer — prefer ones you don't own yet, then ones not at max level
    const grantCard = (minRarity) => deps.collection.grantRandom(minRarity, deps.rng);

    const api = {
      levels,
      find,
      isCleared: (fightId) => !!st().cleared[fightId],
      levelDone: (levelId) => !!st().levelsDone[levelId],
      progress(levelId) { const l = levels().find((x) => x.id === levelId); return { cleared: l.fights.filter((f) => api.isCleared(f.id)).length, total: l.fights.length }; },
      levelUnlocked(li) { return li === 0 || api.levelDone(levels()[li - 1].id); },
      isUnlocked(fightId) {
        const f = find(fightId); if (!f) return false;
        if (!api.levelUnlocked(f.li)) return false;
        return f.fi === 0 || api.isCleared(f.level.fights[f.fi - 1].id);
      },
      /** first unlocked fight not yet cleared (or null when everything is done) */
      next() { for (const l of levels()) for (const f of l.fights) if (api.isUnlocked(f.id) && !api.isCleared(f.id)) return f.id; return null; },
      stats: (fightId) => st().stats[fightId] || { attempts: 0, wins: 0, best: null },
      rate,
      stars: (fightId) => st().stars[fightId] || 0,
      levelStars(levelId) { const l = levels().find((x) => x.id === levelId); return l.fights.reduce((a, f) => a + api.stars(f.id), 0); },
      totalStars() { return levels().reduce((a, l) => a + api.levelStars(l.id), 0); },
      maxStars() { return levels().reduce((a, l) => a + l.fights.length * 3, 0); },
      /** chests with state: 'claimed' | 'ready' | 'locked' */
      chests() { const tot = api.totalStars(); return LV().CAMPAIGN.stars.chests.map((c) => Object.assign({}, c, { state: st().chests.includes(c.id) ? 'claimed' : tot >= c.need ? 'ready' : 'locked' })); },
      readyChests() { return api.chests().filter((c) => c.state === 'ready').length; },
      /** open a chest whose star total is reached; returns what it gave or null */
      claimChest(id) {
        const c = api.chests().find((x) => x.id === id);
        if (!c || c.state !== 'ready') return null;
        save.update('campaign', (s) => { s.chests.push(id); });
        const out = { id, shards: 0, packs: [], card: null }, rw = c.reward;
        if (rw.shards && deps.wallet) { deps.wallet.add('shards', rw.shards, 'chest'); out.shards = rw.shards; }
        for (let i = 0; i < (rw.packs || 0); i++) if (deps.packs) out.packs.push(deps.packs.open('basic', { free: true }));
        if (rw.card && deps.collection) out.card = grantCard(rw.card);
        if (deps.events) deps.events.emit('chestOpened', out);
        return out;
      },
      rewardsFor(fightId) {
        const f = find(fightId), R = LV().CAMPAIGN.rewards;
        if (api.isCleared(fightId)) return { replay: true, shards: R.replay.shards, passXp: 0 };
        const base = f.fight.boss ? R.boss : R.fight;
        const lastOfLevel = f.level.fights.filter((x) => !api.isCleared(x.id)).length === 1;
        return { replay: false, shards: base.shards, passXp: base.passXp, pack: lastOfLevel ? R.level.pack : null };
      },

      /** Options for new AMB.Match(...) for this fight. */
      matchOptions(fightId, heroId, seed) {
        const f = find(fightId); if (!f) throw new Error('قتال غير معروف: ' + fightId);
        const C = deps.collection, fight = f.fight, boss = fight.boss ? LV().BOSS[f.level.world] : null;
        const enemyPower = {};
        fight.units.forEach(([id]) => (enemyPower[id] = fight.power));
        enemyPower[f.level.hero] = fight.power;
        return {
          mode: 'campaign', seed, progression: true,
          rules: Object.assign({}, LV().CAMPAIGN.rules, { start: f.level.start }),
          players: [
            { heroId, name: 'أنت', cardPower: C ? C.powerMap() : null, allowedUnits: C ? C.ownedUnits() : null },
            { heroId: f.level.hero, name: fight.name, isAI: true, cardPower: enemyPower,
              lineup: { units: fight.units, summon: boss ? 'b1' : null, blessings: boss ? boss.blessings : null, abilities: boss ? boss.abilities : [] } },
          ],
        };
      },

      /** Record a finished fight (match.summary(0) + life left). Returns what was paid. */
      recordResult(fightId, res) {
        const f = find(fightId); if (!f) return null;
        const won = !!res.won;
        const pay = won ? api.rewardsFor(fightId) : null;
        const stars = rate(res), prevStars = api.stars(fightId);
        const out = { fightId, won, boss: !!f.fight.boss, first: !!(pay && !pay.replay), shards: 0, passXp: 0, pack: null, levelComplete: false,
          stars, prevStars, newBest: stars > prevStars, chestsBefore: api.readyChests() };
        save.update('campaign', (s) => {
          const x = (s.stats[fightId] = s.stats[fightId] || { attempts: 0, wins: 0, best: null });
          x.attempts++;
          if (!won) return;
          x.wins++;
          const cur = { lifeLeft: res.lifeLeft || 0, roundsLost: res.roundsLost || 0 };
          if (!x.best || cur.lifeLeft > x.best.lifeLeft) x.best = cur;
          s.cleared[fightId] = true;
          s.stars[fightId] = Math.max(s.stars[fightId] || 0, stars);
          if (f.level.fights.every((ff) => s.cleared[ff.id]) && !s.levelsDone[f.level.id]) { s.levelsDone[f.level.id] = true; out.levelComplete = true; }
        });
        if (pay) {
          if (pay.shards && deps.wallet) { deps.wallet.add('shards', pay.shards, 'campaign'); out.shards = pay.shards; }
          if (pay.passXp && deps.addPassXp) { deps.addPassXp(pay.passXp); out.passXp = pay.passXp; }
          if (out.levelComplete && pay.pack && deps.packs) out.pack = deps.packs.open(pay.pack, { free: true });
        }
        out.chestsReady = api.readyChests();
        if (deps.events) deps.events.emit('fightEnd', Object.assign({}, out, { summary: res }));
        return out;
      },
    };
    return api;
  }

  AMB.Campaign = Campaign;
})();
