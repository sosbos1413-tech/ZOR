/*
 * Campaign progress: which fights are unlocked / cleared, building a fight's match and paying rewards.
 * Three difficulties (easy / medium / hard) each keep their OWN progress, stars, chests and boss prizes; the difficulty
 * you picked last is the current one and every call below defaults to it. Level data: core/levels.js.
 *
 *   easy   weaker enemies, smaller prizes          medium  the original campaign          hard  stronger enemies, bigger prizes
 *   Hard unlocks for a level once you have finished that level on medium.
 */
(function () {
  const AMB = globalThis.AMB;
  const LV = () => AMB.LEVELS;
  const DIFFS = ['easy', 'normal', 'hard'];
  const RARITY_ORDER = ['common', 'rare', 'epic', 'legendary'];

  /** stars for one result: 0 = loss, 1 = win, 2 = no round lost, 3 = no round lost and full hero life */
  function rate(res) {
    if (!res || !res.won) return 0;
    const clean = (res.roundsLost || 0) === 0;
    return 1 + (clean ? 1 : 0) + (clean && (res.lifeLeft || 0) >= (res.maxLife || AMB.CONFIG.match.heroLife) ? 1 : 0);
  }
  const blank = () => ({ cleared: {}, levelsDone: {}, stats: {}, stars: {}, chests: [], bossPaid: {} });
  // a guaranteed card one tier lower (easy) or higher (hard)
  const shiftCard = (r, by) => RARITY_ORDER[Math.max(0, Math.min(RARITY_ORDER.length - 1, RARITY_ORDER.indexOf(r) + by))];
  /** a prize scaled for a difficulty: shards/xp by their multipliers, packs rounded down, guaranteed card one tier up or down */
  function scaled(rw, d) {
    const x = LV().DIFFICULTY[d], o = {};
    if (rw.shards) o.shards = Math.round(rw.shards * x.shards);
    if (rw.passXp) o.passXp = Math.round(rw.passXp * x.xp);
    if (rw.packs) o.packs = Math.floor(rw.packs * x.packs + 1e-9);
    if (rw.card) o.card = shiftCard(rw.card, x.cardTier);
    return o;
  }

  AMB.Save.register('campaign', {
    version: 3,
    // d[difficulty] = { cleared[fightId], levelsDone[levelId], stats[fightId] = { attempts, wins, best }, stars[fightId] = best 1..3, chests = claimed ids, bossPaid[fightId] = highest boss star paid }
    defaults: () => ({ diff: 'normal', d: { easy: blank(), normal: blank(), hard: blank() } }),
    migrate: (s, from) => {
      if (s.cleared) {   // saves from before difficulties: everything played so far was the medium campaign
        if (from < 2) { s.stars = s.stars || {}; Object.keys(s.cleared).forEach((id) => { const b = (s.stats[id] || {}).best; s.stars[id] = Math.max(1, b ? rate(Object.assign({ won: true }, b)) : 1); }); }
        // a boss already beaten under the old rules was paid its first-win prize (= star 1): never pay it again (stars are NOT re-rated here; only the v1 saves above are)
        const bp = Object.assign({}, s.bossPaid || {}); Object.keys(s.cleared).forEach((id) => { if (/boss$/.test(id)) bp[id] = Math.max(bp[id] || 0, 1); });
        s.d = { easy: blank(), hard: blank(), normal: { cleared: s.cleared, levelsDone: s.levelsDone || {}, stats: s.stats || {}, stars: s.stars || {}, chests: s.chests || [], bossPaid: bp } };
        ['cleared', 'levelsDone', 'stats', 'stars', 'chests', 'bossPaid'].forEach((k) => delete s[k]);
        s.diff = 'normal';
      }
      return s;
    },
  });

  function Campaign(save, deps) {
    deps = deps || {};
    const st = () => save.get('campaign');
    const levels = () => LV().LEVELS;
    const diff = () => (DIFFS.includes(st().diff) ? st().diff : 'normal');
    const dd = (d) => (DIFFS.includes(d) ? d : diff());
    const P = (d) => st().d[dd(d)];

    function find(fightId) {
      for (let li = 0; li < levels().length; li++) {
        const l = levels()[li], fi = l.fights.findIndex((f) => f.id === fightId);
        if (fi >= 0) return { level: l, li, fight: l.fights[fi], fi };
      }
      return null;
    }
    const grantCard = (minRarity) => deps.collection.grantRandom(minRarity, deps.rng);
    const anyDiff = (fn) => DIFFS.some((d) => fn(d));

    const api = {
      levels, find, rate, DIFFS,
      diff, setDiff(d) { if (DIFFS.includes(d)) { save.update('campaign', (s) => { s.diff = d; }); } return diff(); },
      difficulty: (d) => LV().DIFFICULTY[dd(d)],
      /** hard needs the level finished on medium (and the previous hard level); easy and medium follow their own chain */
      isCleared: (fightId, d) => (d ? !!P(d).cleared[fightId] : anyDiff((x) => !!P(x).cleared[fightId])),   // no difficulty = on ANY difficulty (used by the other systems' unlocks)
      levelDone: (levelId, d) => (d ? !!P(d).levelsDone[levelId] : anyDiff((x) => !!P(x).levelsDone[levelId])),
      progress(levelId, d) { const l = levels().find((x) => x.id === levelId); return { cleared: l.fights.filter((f) => P(d).cleared[f.id]).length, total: l.fights.length }; },
      levelUnlocked(li, d) {
        d = dd(d);
        const prev = li === 0 || !!P(d).levelsDone[levels()[li - 1].id];
        return d === 'hard' ? prev && !!P('normal').levelsDone[levels()[li].id] : prev;
      },
      isUnlocked(fightId, d) {
        const f = find(fightId); if (!f) return false;
        if (!api.levelUnlocked(f.li, d)) return false;
        return f.fi === 0 || !!P(d).cleared[f.level.fights[f.fi - 1].id];
      },
      /** first unlocked fight not yet cleared on this difficulty (or null when everything is done) */
      next(d) { for (const l of levels()) for (const f of l.fights) if (api.isUnlocked(f.id, d) && !P(d).cleared[f.id]) return f.id; return null; },
      stats: (fightId, d) => P(d).stats[fightId] || { attempts: 0, wins: 0, best: null },
      stars: (fightId, d) => P(d).stars[fightId] || 0,
      levelStars(levelId, d) { const l = levels().find((x) => x.id === levelId); return l.fights.reduce((a, f) => a + api.stars(f.id, d), 0); },
      totalStars(d) { return levels().reduce((a, l) => a + api.levelStars(l.id, d), 0); },
      maxStars() { return levels().reduce((a, l) => a + l.fights.length * 3, 0); },
      /** chests with state 'claimed' | 'ready' | 'locked'; rewards already scaled for the difficulty */
      chests(d) { d = dd(d); const tot = api.totalStars(d); return LV().CAMPAIGN.stars.chests.map((c) => Object.assign({}, c, { reward: scaled(c.reward, d), state: P(d).chests.includes(c.id) ? 'claimed' : tot >= c.need ? 'ready' : 'locked' })); },
      readyChests: (d) => api.chests(d).filter((c) => c.state === 'ready').length,
      claimChest(id, d) {
        d = dd(d);
        const c = api.chests(d).find((x) => x.id === id);
        if (!c || c.state !== 'ready') return null;
        save.update('campaign', (s) => { s.d[d].chests.push(id); });
        const out = { id, difficulty: d, shards: 0, packs: [], card: null }, rw = c.reward;
        if (rw.shards && deps.wallet) { deps.wallet.add('shards', rw.shards, 'chest'); out.shards = rw.shards; }
        for (let i = 0; i < (rw.packs || 0); i++) if (deps.packs) out.packs.push(deps.packs.open('basic', { free: true }));
        if (rw.card && deps.collection) out.card = grantCard(rw.card);
        if (deps.events) deps.events.emit('chestOpened', out);
        return out;
      },
      bossPaid: (fightId, d) => P(d).bossPaid[fightId] || 0,
      /** boss prizes per star (scaled for the difficulty) with their state: 'paid' | 'next' | 'locked' */
      bossPrizes(fightId, d) {
        d = dd(d); const paid = api.bossPaid(fightId, d), got = api.stars(fightId, d);
        return LV().CAMPAIGN.rewards.bossStars.map((p, i) => Object.assign({ star: i + 1 }, scaled(p, d), { state: i < paid ? 'paid' : i === paid ? 'next' : 'locked', reached: i < got }));
      },
      rewardsFor(fightId, d) {
        d = dd(d);
        const f = find(fightId), R = LV().CAMPAIGN.rewards, X = LV().DIFFICULTY[d];
        const lastOfLevel = f.level.fights.filter((x) => !P(d).cleared[x.id]).length === 1;
        const levelBonus = lastOfLevel ? { packs: X.levelPacks, shards: X.levelShards } : null;
        if (f.fight.boss) {   // a boss pays by star, not by "first win"
          const prizes = api.bossPrizes(fightId, d), left = prizes.filter((p) => p.state !== 'paid');
          return { boss: true, difficulty: d, replay: !left.length, shards: Math.max(1, Math.round(R.replay.shards * X.shards)), passXp: 0, prizes, levelBonus };
        }
        if (P(d).cleared[fightId]) return { replay: true, difficulty: d, shards: Math.max(1, Math.round(R.replay.shards * X.shards)), passXp: 0 };
        const base = scaled(R.fight, d);
        return { replay: false, difficulty: d, shards: base.shards, passXp: base.passXp, levelBonus };
      },

      /** Options for new AMB.Match(...) for this fight. */
      matchOptions(fightId, heroId, seed, d) {
        d = dd(d);
        const f = find(fightId); if (!f) throw new Error('ما أعرف هالقتال: ' + fightId);
        const C = deps.collection, fight = f.fight, X = LV().DIFFICULTY[d];
        const boss = fight.boss ? (LV().BOSS[f.level.hero] || LV().BOSS[f.level.world]) : null;
        const power = fight.power * X.power, enemyPower = {};
        fight.units.forEach(([id]) => (enemyPower[id] = power));
        enemyPower[f.level.hero] = power;
        return {
          mode: 'campaign', seed, progression: true, difficulty: d,
          rules: Object.assign({}, fight.boss ? LV().CAMPAIGN.bossRules : LV().CAMPAIGN.rules, { start: f.level.start }),
          players: [
            { heroId, name: 'أنت', cardPower: C ? C.powerMap() : null, allowedUnits: C ? C.playableUnits() : null, heroLevel: (globalThis.AMB.heroes ? AMB.heroes.level(heroId) : 1) },
            { heroId: f.level.hero, name: fight.name, isAI: true, cardPower: enemyPower,
              lineup: { units: fight.units, growth: boss ? X.growth : 0, summon: boss ? 'b1' : null, blessings: boss ? boss.blessings : null, abilities: boss ? boss.abilities : [] } },
          ],
        };
      },

      /** Record a finished fight (match.summary(0) + life left). Returns what was paid. */
      recordResult(fightId, res, d) {
        d = dd(d);
        const f = find(fightId); if (!f) return null;
        const won = !!res.won, R = LV().CAMPAIGN.rewards;
        const pay = won ? api.rewardsFor(fightId, d) : null;
        const stars = rate(res), prevStars = api.stars(fightId, d);
        const isBoss = !!f.fight.boss, paidBefore = api.bossPaid(fightId, d);
        const newPrizes = isBoss && won ? R.bossStars.map((p, i) => Object.assign({ star: i + 1 }, scaled(p, d))).filter((p) => p.star > paidBefore && p.star <= stars) : [];
        const out = { fightId, difficulty: d, won, boss: isBoss, first: isBoss ? newPrizes.length > 0 : !!(pay && !pay.replay), shards: 0, passXp: 0, pack: null, packs: [], levelPacks: [], card: null, prizes: newPrizes, levelShards: 0,
          levelComplete: false, stars, prevStars, newBest: stars > prevStars, chestsBefore: api.readyChests(d) };
        save.update('campaign', (s) => {
          const q = s.d[d], x = (q.stats[fightId] = q.stats[fightId] || { attempts: 0, wins: 0, best: null });
          x.attempts++;
          if (!won) return;
          x.wins++;
          const cur = { lifeLeft: res.lifeLeft || 0, roundsLost: res.roundsLost || 0 };
          if (!x.best || cur.lifeLeft > x.best.lifeLeft) x.best = cur;
          q.cleared[fightId] = true;
          q.stars[fightId] = Math.max(q.stars[fightId] || 0, stars);
          if (isBoss) q.bossPaid[fightId] = Math.max(q.bossPaid[fightId] || 0, stars);
          if (f.level.fights.every((ff) => q.cleared[ff.id]) && !q.levelsDone[f.level.id]) { q.levelsDone[f.level.id] = true; out.levelComplete = true; }
        });
        const pay1 = (p) => {
          if (p.shards && deps.wallet) { deps.wallet.add('shards', p.shards, 'campaign'); out.shards += p.shards; }
          if (p.passXp && deps.addPassXp) { deps.addPassXp(p.passXp); out.passXp += p.passXp; }
          for (let i = 0; i < (p.packs || 0); i++) if (deps.packs) out.packs.push(deps.packs.open('basic', { free: true }));
          if (p.card && deps.collection) out.card = grantCard(p.card);
        };
        if (pay) {
          if (isBoss) {
            newPrizes.forEach(pay1);
            if (!newPrizes.length && deps.wallet) { deps.wallet.add('shards', pay.shards, 'campaign'); out.shards += pay.shards; }   // all prizes already paid: the small replay reward
          } else if (pay.shards || pay.passXp) {
            pay1({ shards: pay.shards, passXp: pay.passXp });
          }
          if (out.levelComplete && pay.levelBonus) {
            const lb = pay.levelBonus;
            for (let i = 0; i < (lb.packs || 0); i++) if (deps.packs) out.levelPacks.push(deps.packs.open(R.level.pack, { free: true }));
            if (lb.shards && deps.wallet) { deps.wallet.add('shards', lb.shards, 'campaign'); out.levelShards = lb.shards; out.shards += lb.shards; }
            out.pack = out.levelPacks[0] || null;
          }
        }
        out.chestsReady = api.readyChests(d);
        if (deps.events) deps.events.emit('fightEnd', Object.assign({}, out, { summary: res }));
        return out;
      },
    };
    return api;
  }

  AMB.Campaign = Campaign;
})();
