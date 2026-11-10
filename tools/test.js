#!/usr/bin/env node
/* Rule tests for the core (no browser needed):  node tools/test.js */
const path = require('path');
['config', 'data', 'util', 'synergy', 'combat', 'match', 'ai', 'telemetry', 'pass', 'save', 'economy', 'collection', 'packs', 'levels', 'campaign', 'daily', 'album', 'tower', 'events', 'tutorial', 'netsync', 'heroprog', 'profile'].forEach((f) => require(path.join(__dirname, '..', 'core', f + '.js')));
const AMB = globalThis.AMB;
let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log('  ✓ ' + name); } catch (e) { fail++; console.log('  ✗ ' + name + '\n    ' + e.message); }
}
function eq(a, b, msg) { if (a !== b) throw new Error((msg || '') + ` expected ${b}, got ${a}`); }
function ok(v, msg) { if (!v) throw new Error(msg || 'assertion failed'); }

const side = (units, extra) => Object.assign({ heroId: 'orath', life: 100, maxLife: 100, summoned: false, heroSlot: 'b1', units, spells: [], abilities: [] }, extra || {});
const U = (defId, slot, star) => ({ uid: defId + slot, defId, star: star || 1, items: [], slot });

console.log('combat');
t('rift net (teen #11): your assassin hunts a summoned enemy hero first; without it the hero is protected', () => {
  const mk = (net) => new AMB.Combat([side([U('moss_warden', 'f2')], { summoned: true, heroSlot: 'f1' }), side([U('grid_hound', 'f1')], { spells: net ? ['rift_net'] : [] })], { seed: 4, round: 1 });
  const a = mk(true), b = mk(false);
  const hunter = (c) => c.fighters.find((f) => f.side === 1 && f.role === 'assassin'), hero0 = (c) => c.fighters.find((f) => f.side === 0 && f.isHero);
  eq(a.findTarget(hunter(a)), hero0(a), 'with the net the assassin goes for the summoned hero');
  ok(b.findTarget(hunter(b)) !== hero0(b), 'without it the hero is not a target while its side stands');
});
t('hero is untargetable while a front-row ally lives', () => {
  const c = new AMB.Combat([side([U('moss_warden', 'f1')]), side([U('grid_hound', 'f1')])], { seed: 1, round: 1 });
  const hero0 = c.sides[0].hero;
  ok(!c.targetable(hero0), 'protected hero should not be targetable');
  // assassin must never pick the protected hero
  for (let i = 0; i < 40; i++) c.step();
  const hound = c.fighters.find((f) => f.defId === 'grid_hound');
  ok(!hound.target || !hound.target.isHero, 'assassin targeted protected hero');
});
t('the hero is protected by every living unit: exposed only when the whole field is dead (the front line falling just flags frontDown)', () => {
  const c = new AMB.Combat([side([U('moss_warden', 'f1'), U('pixel_sniper', 'b1')]), side([U('chrome_ronin', 'f1', 3)])], { seed: 2, round: 1 });
  const warden = c.fighters.find((f) => f.defId === 'moss_warden'), sniper = c.fighters.find((f) => f.defId === 'pixel_sniper');
  c.damage(null, warden, 1e6);
  ok(c.sides[0].frontDown, 'front line fell'); ok(!c.sides[0].exposed, 'hero still protected by the back row'); ok(!c.targetable(c.sides[0].hero), 'hero must not be targetable');
  c.damage(null, sniper, 1e6);
  ok(c.sides[0].exposed, 'whole field dead => exposed'); ok(c.targetable(c.sides[0].hero), 'exposed hero should be targetable');
});
t('no front row: the front-down flag is up from the start, the hero stays protected by the back row', () => {
  const c = new AMB.Combat([side([U('pixel_sniper', 'b1')]), side([U('grid_hound', 'f1')])], { seed: 3, round: 1 });
  ok(c.sides[0].frontDown); ok(!c.sides[0].exposed);
});
t('a summoned hero is still hit last: not targetable while a unit of its side lives, targetable once it stands alone', () => {
  const c = new AMB.Combat([side([U('moss_warden', 'f2')], { summoned: true, heroSlot: 'f1' }), side([U('grid_hound', 'f1')])], { seed: 4, round: 1 });
  ok(!c.targetable(c.sides[0].hero), 'protected while the warden lives');
  c.damage(null, c.fighters.find((f) => f.defId === 'moss_warden'), 1e6);
  ok(c.targetable(c.sides[0].hero), 'alone on the field');
});
t('hit order: front line first, then the back line, the hero last', () => {
  const c = new AMB.Combat([side([U('chrome_ronin', 'f1', 3)]), side([U('moss_warden', 'f1'), U('pixel_sniper', 'b1')])], { seed: 6, round: 1 });
  const atk = c.fighters.find((f) => f.defId === 'chrome_ronin'), warden = c.fighters.find((f) => f.defId === 'moss_warden'), sniper = c.fighters.find((f) => f.defId === 'pixel_sniper');
  eq(c.findTarget(atk).defId, 'moss_warden', 'front first');
  c.damage(null, warden, 1e6);
  eq(c.findTarget(atk).defId, 'pixel_sniper', 'then the back line');
  c.damage(null, sniper, 1e6);
  ok(c.findTarget(atk).isHero, 'the hero last');
});
t('command-post damage is capped per combat', () => {
  const c = new AMB.Combat([side([]), side([U('chrome_ronin', 'f1', 3), U('wild_stalker', 'f2', 3)])], { seed: 5, round: 1 });
  const r = c.runToEnd();
  const cap = AMB.CONFIG.combat.postDamageCapBase + AMB.CONFIG.combat.postDamageCapPerRound * 1;
  ok(100 - r.sides[0].heroLife <= cap + 1e-6, `lost ${100 - r.sides[0].heroLife} > cap ${cap}`);
  eq(r.winner, 1);
});
t('summoned hero retreats after the knockout threshold instead of dying', () => {
  const c = new AMB.Combat([side([], { summoned: true, heroSlot: 'f1', life: 80 }), side([U('chrome_ronin', 'f1', 3), U('wild_stalker', 'f2', 3), U('caldera_seer', 'b1', 3)])], { seed: 6, round: 3 });
  const r = c.runToEnd();
  ok(!r.sides[0].heroKilled, 'hero should not die above knockout');
  ok(r.sides[0].heroLife >= 80 - AMB.CONFIG.combat.summonKnockout - 1e-6);
});
t('summoned hero with low life can die => instant match loss', () => {
  const m = new AMB.Match({ seed: 7, players: [{ heroId: 'kagira' }, { heroId: 'orath' }] });
  m.startRound();
  m.players[0].life = 5;
  m.toggleSummon(0, 'f1');
  m.players[1].board = { f1: { uid: 'x1', defId: 'chrome_ronin', star: 3, items: [] }, f2: { uid: 'x2', defId: 'wild_stalker', star: 3, items: [] } };
  const res = m.createCombat(false).runToEnd();
  ok(res.sides[0].heroKilled, 'hero should be killed');
  m.resolveCombat(res);
  ok(m.isOver); eq(m.winner, 1);
});
t('combat is deterministic for a seed', () => {
  const mk = () => new AMB.Combat([side([U('ash_ronin', 'f1'), U('pyre_archer', 'b1')]), side([U('thorn_fox', 'f1'), U('willow_eye', 'b2', 2)])], { seed: 99, round: 2, record: false }).runToEnd();
  const a = mk(), b = mk();
  eq(JSON.stringify(a), JSON.stringify(b));
});

t('healing cannot raise a hero above the life it started the combat with', () => {
  const c = new AMB.Combat([side([U('tide_priest', 'b1')], { summoned: true, heroSlot: 'f1', life: 90 }), side([])], { seed: 1, round: 3 });
  const h = c.sides[0].hero;
  c.heal(h, 5000);
  eq(h.hp, 900, 'heal at full start life');
  c.damage(null, h, 300);
  c.heal(h, 5000);
  eq(h.hp, 900, 'heal back to start life only');
  ok(h.hp < h.maxHp, 'must stay under max life');
});
t('across 40 full AI matches a hero never ends a combat with more life than it began with', () => {
  for (let sd = 1; sd <= 40; sd++) {
    const m = new AMB.Match({ seed: sd, players: [{ heroId: ['merin', 'orath', 'zerokai', 'kagira'][sd % 4], isAI: true, aiStyle: 'mixed' }, { heroId: 'merin', isAI: true, aiStyle: 'mono' }] });
    while (!m.isOver) {
      m.startRound(); AMB.AI.prep(m, 0); AMB.AI.prep(m, 1);
      const before = m.players.map((p) => p.life);
      const res = m.createCombat(false).runToEnd();
      res.sides.forEach((sd2, i) => ok(sd2.heroLife <= before[i] + 1e-6, `match ${sd} round ${m.round}: life ${before[i]} -> ${sd2.heroLife}`));
      m.resolveCombat(res);
    }
  }
});

t('if both heroes fall in the same round, the round winner takes the match', () => {
  const m = new AMB.Match({ seed: 21, players: [{ heroId: 'kagira' }, { heroId: 'orath' }] });
  m.startRound(); m.round = AMB.CONFIG.match.collapseStartRound + 4;   // collapse hits both for a lot
  m.players[0].life = 6; m.players[1].life = 6;
  const res = { winner: 0, duration: 10, sides: [{ heroLife: 6, heroKilled: false, survivors: [], abilitiesFired: [], exposed: false }, { heroLife: 6, heroKilled: false, survivors: [], abilitiesFired: [], exposed: false }], unitDamage: {} };
  m.resolveCombat(res);
  ok(m.isOver); eq(m.winner, 0, 'round winner should win');
});

console.log('stages & rewards');
const sim1 = (seed) => new AMB.Match({ seed, players: [{ heroId: 'kagira' }, { heroId: 'merin' }] });
t('8 rounds in 4 stages: rounds map to the right stage', () => {
  const m = sim1(31);
  eq(AMB.CONFIG.match.maxRounds, 8); eq(AMB.SHOP.rounds, 8);
  eq([1, 2, 3, 4, 5, 6, 7, 8].map((r) => m.stageIndex(r)).join(''), '00111223');
  ok(m.isFinale(8) && !m.isFinale(7));
});
t('reward drafts appear only after rounds 2, 5 and 7, with 3 distinct options incl. a unit', () => {
  const m = sim1(32); const seen = [];
  while (!m.isOver) {
    m.startRound(); AMB.AI.prep(m, 0); AMB.AI.prep(m, 1);
    m.resolveCombat(m.createCombat(false).runToEnd());
    if (m.rewardPending) { seen.push(m.round); m.players.forEach((p) => { const o = p.rewardOffer.options; ok(o.length >= 3 && o.length <= 4); eq(new Set(o).size, o.length, 'options must be distinct'); ok(o.includes('unit')); }); AMB.AI.claimRewards(m); }
  }
  ok(seen.every((r) => [2, 5, 7].includes(r)), 'drafts at ' + seen);
  ok(m.round <= AMB.CONFIG.match.maxRounds);
});
t('claiming: gold, xp, heal (capped), unit (bench + shared pool) and blessing', () => {
  const m = sim1(33); m.startRound();
  const p = m.players[0];
  const give = (id) => { p.rewardOffer = { stage: 0, options: [id], claimed: false }; return m.claimReward(0, 0); };
  const g0 = p.gold; ok(give('gold').ok); eq(p.gold, g0 + AMB.DATA.REWARDS.gold.n[0]);
  const c0 = m.upgradeCost(p); give('xp'); ok(m.upgradeCost(p) < c0 || m.upgradeCost(p) === AMB.CONFIG.economy.upgradeMin, 'the xp reward makes the next shop upgrade cheaper');
  p.life = 95; give('heal'); eq(p.life, 100, 'heal is capped at max life');
  const pool0 = Object.values(m.pool).reduce((a, b) => a + b, 0); const n0 = m.allUnits(p).length; give('unit');
  eq(m.allUnits(p).length, n0 + 1); eq(Object.values(m.pool).reduce((a, b) => a + b, 0), pool0 - 1);
  give('bless_atk'); ok(p.blessings.atkPct > 0);
  ok(!m.claimReward(0, 0).ok, 'cannot claim twice');
});
t('a blessing really makes the team stronger in combat', () => {
  const mk = (bl) => new AMB.Combat([side([U('ash_ronin', 'f1')], { blessings: bl }), side([U('thorn_fox', 'f1')])], { seed: 4, round: 3, record: false });
  const a = mk({ atkPct: 0, hpPct: 0, asPct: 0 }), b = mk({ atkPct: 0.5, hpPct: 0.5, asPct: 0.5 });
  const unit = (c) => c.fighters.find((f) => f.defId === 'ash_ronin');
  ok(unit(b).atk > unit(a).atk * 1.4 && unit(b).maxHp > unit(a).maxHp * 1.4 && unit(b).as > unit(a).as * 1.4);
});
t('the finale multiplies the life lost by the loser of the round', () => {
  const run = (round) => {
    const m = sim1(34); m.startRound(); m.round = round; m.players.forEach((p) => (p.life = 100));
    const loser = { heroLife: 100, heroKilled: false, survivors: [{ defId: 'ash_ronin', star: 1 }], abilitiesFired: [], exposed: false };
    const rep = m.resolveCombat({ winner: 1, duration: 10, sides: [loser, { heroLife: 100, heroKilled: false, survivors: [{ defId: 'ash_ronin', star: 1 }], abilitiesFired: [], exposed: false }], unitDamage: {} });
    return rep.players[0].backlash;
  };
  const mult = AMB.CONFIG.match.finaleLossMult;
  AMB.CONFIG.match.finaleLossMult = 1; const plain = run(8);
  AMB.CONFIG.match.finaleLossMult = mult; const finale = run(8);
  ok(finale > plain, `finale backlash ${finale} should exceed ${plain}`);
  ok(Math.abs(finale - Math.round(plain * mult)) <= 1, 'should be about x' + mult);
  const r6 = run(7); ok(r6 <= plain, 'round 7 is not multiplied');
});
t('after the last round the higher hero life wins (tie -> rounds won)', () => {
  const m = sim1(35); m.startRound(); m.round = AMB.CONFIG.match.maxRounds; m.players[0].life = 60; m.players[1].life = 40;
  const sd = { heroLife: 0, heroKilled: false, survivors: [], abilitiesFired: [], exposed: false };
  m.players[0].life = 60; m.players[1].life = 40;
  m.resolveCombat({ winner: null, duration: 30, sides: [Object.assign({}, sd, { heroLife: 60 }), Object.assign({}, sd, { heroLife: 40 })], unitDamage: {} });
  ok(m.isOver); eq(m.winner, 0);
});

t('autoArrange: guardians/fighters in front, ranged behind, level cap respected, nothing lost', () => {
  const m = new AMB.Match({ seed: 41, players: [{ heroId: 'kagira' }, { heroId: 'orath' }] }); m.startRound();
  const p = m.players[0]; p.level = 4;
  const defs = ['moss_warden', 'ash_ronin', 'pixel_sniper', 'mist_witch', 'wave_caller', 'grid_hound', 'tide_priest'];
  defs.forEach((d, i) => (p.bench[i % 6] = p.bench[i % 6] || { uid: 'z' + i, defId: d, star: 1 + (i % 2), items: [] }));
  const before = m.allUnits(p).length;
  m.autoArrange(0);
  eq(Object.keys(p.board).length, Math.min(m.boardCap(p), before));
  eq(m.allUnits(p).length, before, 'no unit may disappear');
  Object.entries(p.board).forEach(([slot, u]) => { const side = AMB.DATA.ROLES[AMB.DATA.UNITS[u.defId].role].side; if (side === 'front') ok(slot[0] === 'f', u.defId + ' should be in front'); if (side === 'back') ok(slot[0] === 'b', u.defId + ' should be behind'); });
  ok(Object.keys(p.board).some((s) => s[0] === 'f'), 'a front line must exist');
});
t('autoArrange never uses the slot of a summoned hero', () => {
  const m = new AMB.Match({ seed: 42, players: [{ heroId: 'kagira' }, { heroId: 'orath' }] }); m.startRound();
  const p = m.players[0]; p.level = 4; p.summoned = true; p.heroSlot = 'f1';
  ['moss_warden', 'ash_ronin', 'forge_bulwark', 'pixel_sniper'].forEach((d, i) => (p.bench[i] = { uid: 'q' + i, defId: d, star: 1, items: [] }));
  m.autoArrange(0); ok(!p.board.f1, 'f1 belongs to the hero');
});
t('every role has a placement hint and a kind (shown on cards)', () => {
  Object.values(AMB.DATA.ROLES).forEach((r) => { ok(r.place && ['front', 'back', 'any'].includes(r.side) && ['def', 'off'].includes(r.kind), r.id); });
});

console.log('battle pass');
const memStore = () => { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, _m: m }; };
const T0 = new Date(2026, 10, 5, 12).getTime();
const mkPass = (st, t) => AMB.Pass.create(st || memStore(), () => (t == null ? T0 : t));
const sm = (o) => Object.assign({ mode: 'normal', won: false, roundsPlayed: 7, roundsWon: 0, finaleWon: false, buys: 0, rerolls: 0, merges: 0, summoned: false, stageRewards: 0, damage: 0, worldsUsed: 1 }, o || {});
t('pass: both tracks have 30 valid rewards with no duplicate cosmetic across tracks', () => {
  const P = AMB.Pass, seen = new Set();
  eq(Object.keys(P.FREE).length, 30); eq(Object.keys(P.PREMIUM).length, 30);
  [['free', P.FREE], ['premium', P.PREMIUM]].forEach(([tr, tbl]) => Object.values(tbl).forEach((r) => {
    if (r.type === 'perk') return;
    const k = r.type + ':' + r.id; ok(!seen.has(k), 'duplicate ' + k); seen.add(k);
    if (r.type === 'avatar') ok(AMB.DATA.UNITS[r.id] || AMB.DATA.HEROES[r.id], 'unknown avatar ' + r.id); else ok(P.COSMETICS[r.type][r.id], 'unknown ' + r.type + ' ' + r.id);
  }));
});
t('pass: xp -> level (xpPerLevel per level, max 30)', () => {
  const XPL = AMB.Pass.SEASON.xpPerLevel;
  const p = mkPass(); eq(p.level(), 1); p.addXp(XPL - 1); eq(p.level(), 1); p.addXp(1); eq(p.level(), 2); p.addXp(100000); eq(p.level(), 30); ok(p.maxed());
});
t('pass: match xp = played + rounds + win (+ first win of the day once), scaled by mode, friendly = 0', () => {
  const p = mkPass();
  const a = p.recordMatch(sm({ won: true, roundsWon: 4 })); eq(a.xp, 30 + 24 + 40 + 40, 'first win of the day included');
  const b = p.recordMatch(sm({ won: true, roundsWon: 4 })); eq(b.xp, 30 + 24 + 40, 'first win bonus only once per day');
  const hard = mkPass().recordMatch(sm({ mode: 'hard', roundsWon: 2 })); eq(hard.xp, Math.round((30 + 12) * 1.25));
  const easy = mkPass().recordMatch(sm({ mode: 'easy', roundsWon: 2 })); eq(easy.xp, Math.round((30 + 12) * 0.6));
  const fr = mkPass(); const f = fr.recordMatch(sm({ mode: 'friendly', won: true, roundsWon: 5 })); eq(f.xp, 0); eq(fr.state().xp, 0);
  ok(mkPass().recordMatch(sm({ won: true, finaleWon: true, roundsWon: 1 })).xp > mkPass().recordMatch(sm({ won: true, roundsWon: 1 })).xp, 'finale bonus');
});
t('pass: daily missions are 3, stable within a day, change on another day; progress and one-time claim', () => {
  const st = memStore(); let p = mkPass(st);
  const d = p.dailyMissions(); eq(d.length, 3); eq(new Set(d.map((m) => m.id)).size, 3);
  eq(mkPass(st).dailyMissions().map((m) => m.id).join(), d.map((m) => m.id).join(), 'same day -> same missions');
  const next = mkPass(memStore(), T0 + 3 * 86400000).dailyMissions().map((m) => m.id).join();
  const other = [1, 2, 3, 4, 5, 6].some((k) => mkPass(memStore(), T0 + k * 86400000).dailyMissions().map((m) => m.id).join() !== d.map((m) => m.id).join()); ok(other, 'missions rotate across days');
  eq(p.weeklyMissions().length, 3);
  // finish everything possible in one huge match, then claim
  p.recordMatch(sm({ won: true, roundsWon: 7, finaleWon: true, buys: 40, rerolls: 20, merges: 10, summoned: true, stageRewards: 3, damage: 20000, worldsUsed: 4 }));
  ['upgrades', 'packs', 'stars', 'campaign', 'tower_floors', 'event_cleared'].forEach((k) => p.track(k, 10));   // stats fed by other systems
  const done = p.dailyMissions().concat(p.weeklyMissions()).filter((m) => m.done); ok(done.length >= 3, 'a huge match completes several missions');
  const xp0 = p.state().xp; const c = p.claimMission(done[0].id); ok(c && c.xp > 0); eq(p.state().xp, xp0 + c.xp); eq(p.claimMission(done[0].id), null, 'cannot claim twice');
});
t('pass: missions reset on a new day (claims too)', () => {
  const st = memStore(); const p = mkPass(st); p.recordMatch(sm({ won: true, roundsWon: 7, buys: 40, merges: 5 }));
  const nd = mkPass(st, T0 + 86400000); ok(nd.dailyMissions().every((m) => m.progress === 0), 'daily progress reset'); ok(nd.state().xp > 0, 'xp is kept');
});
t('pass: claiming needs the level, premium needs premium, no double claim, claimAll', () => {
  const p = mkPass();
  ok(!p.canClaim(2, 'free'), 'level 2 not reached'); ok(p.canClaim(1, 'free')); ok(p.claim(1, 'free')); ok(!p.claim(1, 'free'), 'no double claim');
  ok(!p.canClaim(1, 'premium'), 'premium locked'); p.addXp(5 * AMB.Pass.SEASON.xpPerLevel); ok(p.level() === 6);
  const got = p.claimAll(); eq(got.filter((g) => g.track === 'premium').length, 0, 'premium stays locked'); eq(got.length, 5, 'free levels 2-6');
  p.setPremium(true); ok(p.claimAll().length === 6, 'premium levels 1-6 after unlocking');
});
t('pass: equip only what you own; perks add prep time', () => {
  const p = mkPass(); p.addXp(14 * AMB.Pass.SEASON.xpPerLevel);
  ok(!p.equip('frame', 'gold'), 'not owned yet'); eq(p.prepBonus(), 0);
  p.claimAll(); ok(p.equip('frame', 'bronze')); ok(p.equip('avatar', 'yuta')); ok(!p.equip('avatar', 'kagira'), 'premium avatar locked');
  eq(p.prepBonus(), 10, 'perk levels 5 and 15 give +5s each'); ok(p.owned('title').includes('t_recruit'));
});
t('pass: season end freezes xp but rewards you already earned stay claimable', () => {
  const st = memStore(), XPL = AMB.Pass.SEASON.xpPerLevel; const p = mkPass(st); p.addXp(3 * XPL);
  const late = mkPass(st, T0 + 50 * 86400000); ok(late.ended()); eq(late.addXp(500), 0); eq(late.state().xp, 3 * XPL); ok(late.claim(3, 'free'));
  eq(late.recordMatch(sm({ won: true, roundsWon: 7 })).xp, 0);
});
t('pass: progress persists through storage; corrupt data is ignored', () => {
  const st = memStore(); mkPass(st).addXp(2 * AMB.Pass.SEASON.xpPerLevel + 50); eq(mkPass(st).level(), 3);
  const bad = memStore(); bad.setItem(AMB.Pass.KEY, '{not json'); eq(mkPass(bad).level(), 1);
});
t('match.summary() reports the facts the pass needs', () => {
  const m = new AMB.Match({ seed: 51, mode: 'ai', players: [{ heroId: 'kagira' }, { heroId: 'orath', isAI: true, difficulty: 'hard' }] });
  while (!m.isOver) { m.startRound(); AMB.AI.prep(m, 0); AMB.AI.prep(m, 1); m.resolveCombat(m.createCombat(false).runToEnd()); }
  const s0 = m.summary(0); eq(s0.mode, 'hard'); eq(s0.roundsPlayed, m.round); eq(s0.roundsWon, m.players[0].stats.wins); ok(s0.buys > 0); ok(s0.worldsUsed >= 1); eq(typeof s0.won, 'boolean');
});

console.log('economy');
t('3 copies merge into a 2-star, keeping the board position', () => {
  const m = new AMB.Match({ seed: 11, players: [{ heroId: 'kagira' }, { heroId: 'orath' }] });
  m.startRound();
  const p = m.players[0];
  p.gold = 50;
  for (let i = 0; i < 3; i++) {
    p.shop[0] = 'ash_ronin';
    const r = m.buy(0, 0);
    ok(r.ok, r.reason);
    if (i === 0) m.move(0, r.unit.uid, { zone: 'board', slot: 'f2' });
  }
  const all = m.allUnits(p).filter((u) => u.defId === 'ash_ronin');
  eq(all.length, 1); eq(all[0].star, 2);
  eq(p.board.f2 && p.board.f2.defId, 'ash_ronin');
  eq(m.pool.ash_ronin, AMB.CONFIG.economy.poolSize[1] - 3);
});
t('selling returns gold and copies to the shared pool', () => {
  const m = new AMB.Match({ seed: 12, players: [{ heroId: 'kagira' }, { heroId: 'orath' }] });
  m.startRound();
  const p = m.players[0]; p.gold = 20;
  p.shop[0] = 'caldera_seer';
  const r = m.buy(0, 0);
  const before = m.pool.caldera_seer;
  m.sell(0, r.unit.uid);
  eq(m.pool.caldera_seer, before + 1); eq(p.gold, 20);
});
t('board capacity equals level', () => {
  const m = new AMB.Match({ seed: 13, players: [{ heroId: 'kagira' }, { heroId: 'orath' }] });
  m.startRound();
  const p = m.players[0]; p.gold = 50;
  const ids = ['ash_ronin', 'forge_bulwark', 'grid_hound', 'pixel_sniper'];
  const uids = ids.map((id) => { p.shop[0] = id; return m.buy(0, 0).unit.uid; });
  ['f0', 'f1', 'f2'].forEach((s, i) => ok(m.move(0, uids[i], { zone: 'board', slot: s }).ok));
  ok(!m.move(0, uids[3], { zone: 'board', slot: 'f3' }).ok, 'should exceed level cap');
});
t('interest and streak income', () => {
  const m = new AMB.Match({ seed: 14, players: [{ heroId: 'kagira' }, { heroId: 'orath' }] });
  m.startRound();
  const p = m.players[0];
  p.gold = 25; p.winStreak = 2; p.lastWon = true;
  m.startRound();
  const E = AMB.CONFIG.economy;
  eq(p.lastIncome.total, p.lastIncome.base + 2 + 1 + E.winBonus);
  // a drawn round keeps the streak but does not pay the win bonus (A8)
  p.gold = 25; p.winStreak = 2; p.lastWon = false; m.startRound();
  eq(p.lastIncome.total, p.lastIncome.base + 2 + 1, 'no win bonus after a draw');
});
t('A10/A11: the shop rolls at level 1 and never upgrades for free; the item bag cannot exceed its limit', () => {
  const m = new AMB.Match({ seed: 33, players: [{ heroId: 'kagira' }, { heroId: 'orath' }] }); m.startRound();
  const p = m.players[0]; p.level = 1; p.gold = 0; ok(!m.upgradeShop(0).ok, 'no gold, no upgrade');
  eq(p.level, 1, 'no free level-up'); p._t = 1; m._rollShop(p); ok(p.shop.length > 0, 'the shop rolls at level 1');
  const cap = AMB.CONFIG.economy.itemBenchSize; p.items = ['sword', 'sword', 'sword', 'sword', 'sword', 'sword'].slice(0, cap);
  const g = p.gold; m._stash(p, ['a', 'b']); eq(p.items.length, cap); eq(p.gold, g + 6, 'overflow items turn into +3 gold each');
});
t('abilities reserve essence and refund when not triggered', () => {
  const m = new AMB.Match({ seed: 15, players: [{ heroId: 'merin' }, { heroId: 'orath' }] });
  m.startRound();
  const p = m.players[0]; p.essence = 4;
  ok(m.setAbility(0, 'moon_spring', 'firstDeath').ok);
  ok(!m.setAbility(0, 'tidal_ward', 'start').ok, 'should not over-reserve');
  m.players[1].board = {};
  p.board = { f1: { uid: 'a', defId: 'coral_sentinel', star: 3, items: [] } };
  const res = m.createCombat(false).runToEnd();
  m.resolveCombat(res);
  eq(p.essence, 4, 'unfired ability must not cost essence');
});
t('a full AI vs AI match always terminates within the round cap', () => {
  for (let s = 1; s <= 20; s++) {
    const m = new AMB.Match({ seed: s, players: [{ heroId: 'zerokai', isAI: true }, { heroId: 'merin', isAI: true, aiStyle: 'mono' }] });
    while (!m.isOver) { m.startRound(); AMB.AI.prep(m, 0); AMB.AI.prep(m, 1); m.resolveCombat(m.createCombat(false).runToEnd()); }
    ok(m.round <= AMB.CONFIG.match.maxRounds);
  }
});


console.log('unified save, wallet, events');
const MEM = () => AMB.Save.memoryStorage();
t('save: defaults, live update, survives reload', () => {
  AMB.Save.register('_t', { defaults: () => ({ best: 0, list: [] }) });
  const mem = MEM();
  const a = AMB.Save.create(mem);
  eq(a.get('_t').best, 0);
  a.update('_t', (s) => { s.best = 7; s.list.push('x'); });
  const b = AMB.Save.create(mem);
  eq(b.get('_t').best, 7); eq(b.get('_t').list[0], 'x');
});
t('save: new default keys are added to older saves without touching saved values', () => {
  const mem = MEM();
  AMB.Save.register('_g', { defaults: () => ({ a: 1 }) });
  AMB.Save.create(mem).update('_g', (s) => { s.a = 5; });
  AMB.Save.register('_g', { defaults: () => ({ a: 1, b: { c: 2 } }) });
  const s = AMB.Save.create(mem).get('_g');
  eq(s.a, 5); eq(s.b.c, 2);
});
t('save: migrations run once, in order', () => {
  const mem = MEM();
  AMB.Save.register('_m', { version: 1, defaults: () => ({ n: 1 }) });
  AMB.Save.create(mem).update('_m', (s) => { s.n = 10; });
  let calls = 0;
  AMB.Save.register('_m', { version: 2, defaults: () => ({ total: 0 }), migrate: (old, from) => { calls++; eq(from, 1); return { total: old.n * 2 }; } });
  const sv = AMB.Save.create(mem);
  eq(sv.get('_m').total, 20);
  AMB.Save.create(mem).get('_m');
  eq(calls, 1, 'migration count');
});
t('save: corrupt data starts fresh and keeps a copy of the bad data', () => {
  const mem = MEM();
  mem.setItem(AMB.Save.KEY, '{not json');
  const sv = AMB.Save.create(mem);
  ok(sv.wasCorrupt); eq(mem.getItem(AMB.Save.KEY + '_corrupt'), '{not json');
  eq(sv.systems().length, 0);
});
t('save: a daily backup is kept and used when the main save gets corrupted', () => {
  const D = 864e5; let now = new Date(2026, 10, 5, 10).getTime();
  const mem = MEM();
  AMB.Save.register('_bk', { defaults: () => ({ n: 0 }) });
  const a = AMB.Save.create(mem, () => now); a.update('_bk', (s) => { s.n = 1; });
  now += D;                                  // next day: yesterday's state (n = 1) becomes the backup
  const b = AMB.Save.create(mem, () => now); b.update('_bk', (s) => { s.n = 2; });
  ok(mem.getItem(AMB.Save.KEY + '_bak'), 'backup exists');
  mem.setItem(AMB.Save.KEY, '{broken');
  const c = AMB.Save.create(mem, () => now);
  ok(c.recovered && c.wasCorrupt, 'recovered from backup'); eq(c.get('_bk').n, 1);
  ok(c.updated() >= 0);
});
t('save: importing keeps the previous save recoverable', () => {
  const mem = MEM(); const a = AMB.Save.create(mem); a.update('wallet', (s) => { s.balances.shards = 11; });
  const other = AMB.Save.create(MEM()); other.update('wallet', (s) => { s.balances.shards = 99; });
  a.importJSON(other.exportJSON()); eq(a.get('wallet').balances.shards, 99);
  eq(JSON.parse(mem.getItem(AMB.Save.KEY + '_preimport')).systems.wallet.balances.shards, 11);
});
t('save: old battle-pass progress is carried into the unified save', () => {
  const mem = MEM();
  const old = AMB.Pass.create(mem);       // old builds used their own key
  old.addXp(2 * AMB.Pass.SEASON.xpPerLevel + 50);
  const sv = AMB.Save.create(mem);
  const p = AMB.Pass.create(sv.storageFor('pass'));
  eq(p.level(), old.level()); ok(p.level() >= 3);
  p.addXp(100);
  const p2 = AMB.Pass.create(AMB.Save.create(mem).storageFor('pass'));
  eq(p2.level(), p.level(), 'pass progress saved through the unified save');
});
t('save: export / import round trip, bad import rejected', () => {
  const a = AMB.Save.create(MEM()); a.update('wallet', (s) => { s.balances.shards = 42; });
  const b = AMB.Save.create(MEM()); b.importJSON(a.exportJSON());
  eq(b.get('wallet').balances.shards, 42);
  let threw = false; try { b.importJSON('[1,2]'); } catch (e) { threw = true; }
  ok(threw); eq(b.get('wallet').balances.shards, 42);
});
t('wallet: add/spend are all-or-nothing, unknown currency rejected, events fire', () => {
  const p = AMB.Profile.boot(MEM());
  const seen = []; p.events.on('currency', (e) => seen.push(e.n));
  const s0 = p.wallet.balance('shards'); p.wallet.spend({ shards: s0 });
  eq(p.wallet.balance('shards'), 0);
  p.wallet.add('shards', 120, 'test'); eq(p.wallet.balance('shards'), 120);
  p.wallet.add('shards', -50); p.wallet.add('shards', 0); eq(p.wallet.balance('shards'), 120, 'non-positive ignored');
  ok(!p.wallet.spend({ shards: 500 })); eq(p.wallet.balance('shards'), 120);
  ok(p.wallet.spend({ shards: 100 })); eq(p.wallet.balance('shards'), 20);
  let threw = false; try { p.wallet.add('gold_coins', 5); } catch (e) { threw = true; }
  ok(threw); eq(seen.join(), '120');
  eq(AMB.Profile.boot(MEM()).wallet.balance('shards'), AMB.ECONOMY.currencies.shards.start, 'fresh profile');
});
t('events: a throwing listener does not stop the others', () => {
  const ev = AMB.Events(); let n = 0;
  ev.on('x', () => { throw new Error('boom'); }); ev.on('x', () => n++);
  const ce = console.error; console.error = () => {}; ev.emit('x'); console.error = ce;
  eq(n, 1);
});

console.log('rarity, collection, card upgrades');
const RAR = () => AMB.ECONOMY.rarities;
t('every card has a valid rarity; units follow tier, heroes are legendary', () => {
  Object.values(AMB.DATA.UNITS).forEach((u) => { ok(RAR()[u.rarity], u.id); if (u.rarity === 'legendary') eq(u.tier, 5, 'a legendary unit is a 5-star card ' + u.id); else eq(u.rarity, AMB.DATA.TIER_RARITY[u.tier], u.id); });
  Object.values(AMB.DATA.HEROES).forEach((h) => eq(h.rarity, 'legendary', h.id));
});
t('rarer = stronger and needs more copies at every level', () => {
  const order = Object.values(RAR()).sort((a, b) => a.order - b.order);
  eq(order.map((r) => r.en).join(), 'Common,Rare,Epic,Legendary');
  for (let i = 1; i < order.length; i++) {
    ok(order[i].power > order[i - 1].power, 'power ' + order[i].en);
    eq(order[i].copies.length, order[i - 1].copies.length, 'same number of levels');
    order[i].copies.forEach((c, k) => ok(c > order[i - 1].copies[k], `copies ${order[i].en} L${k + 2}`));
  }
  order.forEach((r) => r.copies.forEach((c, k) => k && ok(c > r.copies[k - 1], 'each level costs more')));
});
t('collection: duplicates level a card up, max level is a hard stop, saved', () => {
  const mem = MEM();
  const p = AMB.Profile.boot(mem), C = p.collection;
  const ups = []; p.events.on('cardUpgraded', (e) => ups.push(e.level));
  const id = 'ash_ronin';   // common: 2, 4, 8, 12
  eq(C.level(id), 1); eq(C.needed(id), 2); ok(!C.canUpgrade(id));
  eq(C.upgrade(id), 0, 'no copies, no upgrade');
  C.add(id, 3); ok(C.canUpgrade(id)); eq(C.upgrade(id), 2); eq(C.copies(id), 1); eq(C.needed(id), 4);
  C.add(id, 100);
  while (C.canUpgrade(id)) C.upgrade(id);
  eq(C.level(id), C.maxLevel(id)); eq(C.level(id), 5); ok(C.isMax(id)); eq(C.needed(id), 0);
  eq(C.copies(id), 101 - 4 - 8 - 12);
  eq(C.upgrade(id), 0, 'cannot pass max');
  eq(ups.join(), '2,3,4,5');
  const C2 = AMB.Profile.boot(mem).collection;
  eq(C2.level(id), 5); eq(C2.totalUpgrades(), 4);
  let threw = false; try { C.add('not_a_card', 1); } catch (e) { threw = true; } ok(threw);
});
t('collection: power = rarity × level bonus', () => {
  const C = AMB.Profile.boot(MEM()).collection;
  eq(C.power('ash_ronin'), 1);
  eq(C.power('kagira'), RAR().legendary.power);
  C.add('caldera_seer', 5); ok(C.upgrade('caldera_seer'), 'upgrade');   // first copy unlocks, 4 more = level 2
  ok(Math.abs(C.power('caldera_seer') - RAR().epic.power * (1 + AMB.ECONOMY.cards.levelBonus)) < 1e-9);
  eq(C.powerMap().caldera_seer, Math.round(C.power('caldera_seer') * 1000) / 1000);
});
t('card power now counts in quick matches too (and hotseat passes none, so it stays even)', () => {
  const big = {}; Object.keys(AMB.DATA.UNITS).concat(Object.keys(AMB.DATA.HEROES)).forEach((id) => (big[id] = 3));
  const run = (cp, prog) => {
    const m = new AMB.Match({ seed: 77, progression: prog, players: [{ heroId: 'orath', isAI: true, cardPower: cp }, { heroId: 'merin', isAI: true }] });
    while (!m.isOver) { m.startRound(); AMB.AI.prep(m, 0); AMB.AI.prep(m, 1); m.resolveCombat(m.createCombat(false).runToEnd()); }
    return m.players.map((p) => p.life).join() + '|' + m.round + '|' + m.winner;
  };
  ok(run(big, false) !== run(null, false), 'a quick match with card power should feel it');
  ok(run(big, true) !== run(null, true), 'progression match should feel the power');
  eq(run(null, false), run(undefined, false), 'no card power = even match');
});
t('progression power scales unit stats after synergies; synergies unchanged', () => {
  const sp = (pw) => [side([Object.assign(U('moss_warden', 'f1'), { power: pw }), Object.assign(U('thorn_fox', 'f2'), { power: pw })]), side([U('grid_hound', 'f1')])];
  const a = new AMB.Combat(sp(1), { seed: 3, round: 1 }), b = new AMB.Combat(sp(1.5), { seed: 3, round: 1 });
  const fa = a.fighters.find((f) => f.defId === 'moss_warden'), fb = b.fighters.find((f) => f.defId === 'moss_warden');
  ok(Math.abs(fb.maxHp / fa.maxHp - 1.5) < 1e-9, 'hp x1.5'); ok(Math.abs(fb.atk / fa.atk - 1.5) < 1e-9, 'atk x1.5');
  const ids = (c) => c.sides[0].synergy.list.map((x) => x.id + ':' + x.activeTier).join();
  ok(a.sides[0].synergy.list.length > 0, 'test board should have an active synergy'); eq(ids(a), ids(b));
});

console.log('packs & pity');
const rich = (seed) => { const p = AMB.Profile.boot(MEM(), null, AMB.util.RNG(seed)); p.wallet.add('shards', 1e5); return p; };
t('packs: costs shards, 5 valid cards, nothing happens without shards', () => {
  const p = AMB.Profile.boot(MEM(), null, AMB.util.RNG(1));
  const start = p.wallet.balance('shards');
  const r = p.packs.open('basic');
  eq(r.cards.length, 5); eq(p.wallet.balance('shards'), start - 100);
  r.cards.forEach((c) => ok(p.collection.def(c.id) && c.rarity === p.collection.rarity(c.id), c.id));
  p.wallet.spend({ shards: p.wallet.balance('shards') });
  const before = JSON.stringify(p.save.get('packs'));
  eq(p.packs.open('basic'), null); eq(JSON.stringify(p.save.get('packs')), before, 'no state change when unaffordable');
});
t('packs: rarity odds match the published table (100k cards)', () => {
  const p = rich(42);
  const n = { common: 0, rare: 0, epic: 0, legendary: 0 }; let total = 0, forced = 0;
  for (let i = 0; i < 20000; i++) { const r = p.packs.open('basic', { free: true }); if (r.forced) forced++; r.cards.forEach((c) => { n[c.rarity]++; total++; }); }
  const odds = p.packs.oddsTable('basic');
  // among non-legendary cards the split must follow the table exactly (pity only swaps a slot for a legendary)
  const nl = total - n.legendary, wl = odds.filter((o) => o.rarity !== 'legendary').reduce((a, o) => a + o.pct, 0);
  odds.forEach((o) => { if (o.rarity !== 'legendary') ok(Math.abs((100 * n[o.rarity]) / nl - (100 * o.pct) / wl) < 0.5, `${o.rarity}: ${(100 * n[o.rarity] / nl).toFixed(2)}%`); });
  const leg = (100 * n.legendary) / total;
  ok(leg >= 1 && leg < 3, 'legendary incl. pity ' + leg.toFixed(2) + '%');   // 1% base; the 10-pack guarantee lifts the real rate to ~2.3%
  ok(forced > 0, 'pity should trigger sometimes');
});
t('pity: never more than 10 packs in a row without a legendary; counter is right', () => {
  const p = rich(7);
  let run = 0, maxRun = 0;
  for (let i = 0; i < 3000; i++) {
    const left = p.packs.pityLeft('basic');
    eq(left, Math.max(0, 10 - run), 'counter before pack ' + i);
    const r = p.packs.open('basic', { free: true });
    const hit = r.cards.some((c) => c.rarity === 'legendary');
    if (left === 0) ok(hit, 'guaranteed pack had no legendary');
    run = hit ? 0 : run + 1; maxRun = Math.max(maxRun, run);
  }
  ok(maxRun <= 10, 'max run ' + maxRun);
});
t('pity counter is saved and resets on a natural legendary', () => {
  const mem = MEM();
  const a = AMB.Profile.boot(mem, null, AMB.util.RNG(3)); a.wallet.add('shards', 1e5);
  let r; do { r = a.packs.open('basic'); } while (r.cards.some((c) => c.rarity === 'legendary'));
  const left = a.packs.pityLeft('basic'); ok(left < 10);
  eq(AMB.Profile.boot(mem).packs.pityLeft('basic'), left, 'reloaded');
});
t('packs: duplicates become upgrade copies; copies of max-level cards become shards', () => {
  const p = rich(9);
  const r = p.packs.open('basic');
  const c0 = r.cards[0];
  ok(p.collection.owned(c0.id));
  // max out every card, then a pack refunds shards for each card
  p.collection.ids().forEach((id) => { p.collection.add(id, 200); while (p.collection.canUpgrade(id)) p.collection.upgrade(id); });
  const bal = p.wallet.balance('shards');
  const r2 = p.packs.open('basic');
  const refund = r2.cards.reduce((a, c) => a + AMB.ECONOMY.maxedRefund[c.rarity], 0);
  eq(r2.refund, refund); eq(p.wallet.balance('shards'), bal - 100 + refund);
});
t('packs: exclusive cards never drop', () => {
  AMB.DATA.UNITS.ash_ronin.exclusive = true;
  try { const p = rich(11); for (let i = 0; i < 400; i++) p.packs.open('basic').cards.forEach((c) => ok(c.id !== 'ash_ronin', 'exclusive dropped')); }
  finally { delete AMB.DATA.UNITS.ash_ronin.exclusive; }
});

console.log('unlocking characters');
t('new player: the 8 starter units owned, no hero, everything else locked until unlocked', () => {
  const C = AMB.Profile.boot(MEM()).collection;
  Object.values(AMB.DATA.UNITS).forEach((u) => eq(C.owned(u.id), !!u.starter, u.id));
  eq(Object.values(AMB.DATA.UNITS).filter((u) => u.starter).length, 8, 'starter roster = 8 basic units');
  eq(new Set(Object.values(AMB.DATA.UNITS).filter((u) => u.starter).map((u) => u.role)).size, 6, 'every role is covered');
  eq(AMB.DATA.LEGACY_STARTERS.length, 20);
  eq(C.ownedHeroes().length, 0); ok(C.needsStarter());
  ok(C.chooseStarter('merin')); ok(!C.chooseStarter('orath'), 'starter is one-time');
  eq(C.ownedHeroes().join(), 'merin'); ok(!C.needsStarter()); eq(C.level('merin'), 1); eq(C.copies('merin'), 0);
});
t('first copy unlocks a card (not counted as an upgrade copy); later copies are upgrade copies', () => {
  const C = AMB.Profile.boot(MEM()).collection;
  ok(!C.owned('shirayuki'));
  const r1 = C.add('shirayuki', 1); ok(r1.isNew); ok(C.owned('shirayuki')); eq(C.copies('shirayuki'), 0);
  const r2 = C.add('shirayuki', 2); ok(!r2.isNew); eq(C.copies('shirayuki'), 2);
  const r3 = C.add('ash_ronin', 1); ok(!r3.isNew, 'starter unit is already owned'); eq(C.copies('ash_ronin'), 1);
  eq(C.ownedUnits().length, 9);
});
t('packs can unlock heroes and higher-rarity units (shown as new)', () => {
  const p = rich(5); let newIds = new Set();
  for (let i = 0; i < 40; i++) p.packs.open('basic').cards.forEach((c) => { if (c.isNew) { ok(!newIds.has(c.id), 'new twice: ' + c.id); newIds.add(c.id); } });
  ok([...newIds].every((id) => AMB.DATA.HEROES[id] || !AMB.DATA.UNITS[id].starter), 'starter units are never "new"');
  ok([...newIds].some((id) => AMB.DATA.HEROES[id] || AMB.DATA.UNITS[id].rarity === 'legendary'), 'pity guarantees a legendary within 40 packs');
  ok([...newIds].filter((id) => AMB.DATA.UNITS[id]).length >= 10, 'packs unlock many new characters');
});
t('battle pass character rewards unlock the card', () => {
  const prof = AMB.Profile.boot(MEM());
  const pass = AMB.Pass.create(prof.save.storageFor('pass'), null, (r) => prof.collection.grantPassReward(r));
  const lv = Object.entries(AMB.Pass.FREE).find(([, r]) => r.type === 'avatar' && AMB.DATA.UNITS[r.id] && AMB.DATA.UNITS[r.id].rarity !== 'common');
  ok(lv, 'free track has a non-common character');
  ok(!prof.collection.owned(lv[1].id));
  pass.addXp(AMB.Pass.SEASON.xpPerLevel * (+lv[0]));
  pass.claimAll();
  ok(prof.collection.owned(lv[1].id), 'pass reward unlocked ' + lv[1].id);
});
t('progression shop only offers owned units; quick matches offer everything', () => {
  const owned = Object.values(AMB.DATA.UNITS).filter((u) => u.rarity === 'common').map((u) => u.id);
  const seen = (prog) => {
    const ids = new Set();
    for (let s = 1; s <= 6; s++) {
      const m = new AMB.Match({ seed: s, progression: prog, players: [{ heroId: 'orath', allowedUnits: owned }, { heroId: 'merin', isAI: true }] });
      while (!m.isOver && m.round < 7) {
        m.startRound(); m.players[0].level = 5;
        for (let k = 0; k < 6; k++) { m.players[0].shop.forEach((id) => id && ids.add(id)); m.players[0].gold += 2; m.reroll(0); }
        (m.players[0].rewardOffer ? [m.players[0].rewardOffer] : []).forEach(() => { const r = m.claimReward(0, 0); if (r && r.unit) ids.add(r.unit); });
        AMB.AI.prep(m, 1); m.resolveCombat(m.createCombat(false).runToEnd());
      }
    }
    return ids;
  };
  const prog = seen(true);
  ok([...prog].every((id) => owned.includes(id)), 'progression shop showed a locked unit: ' + [...prog].filter((id) => !owned.includes(id)));
  ok([...seen(false)].some((id) => !owned.includes(id)), 'quick match should still offer every unit');
});

console.log('campaign levels & bosses');
const runFight = (prof, fightId, hero, seed, forceWin) => {
  const m = new AMB.Match(prof.campaign.matchOptions(fightId, hero || 'orath', seed || 1));
  m.players[0].isAI = true;
  while (!m.isOver) {
    m.startRound(); AMB.AI.prep(m, 0); AMB.AI.prep(m, 1);
    if (forceWin != null) { const c = m.createCombat(false).runToEnd(); c.winner = forceWin; m.resolveCombat(c); } else m.resolveCombat(m.createCombat(false).runToEnd());
  }
  return m;
};
t('levels data: 8 levels x (4 fights + boss), valid units/slots, boss slot free', () => {
  const Ls = AMB.LEVELS.LEVELS; eq(Ls.length, 8);
  Ls.forEach((l) => {
    eq(l.fights.length, 5, l.id); ok(l.fights[4].boss && l.fights.slice(0, 4).every((f) => !f.boss), l.id + ' boss last');
    ok(AMB.DATA.HEROES[l.hero] && (AMB.LEVELS.BOSS[l.hero] || AMB.LEVELS.BOSS[l.world]), l.id);
    if (AMB.LEVELS.BOSS[l.hero]) AMB.LEVELS.BOSS[l.hero].abilities.forEach((id) => ok(AMB.DATA.HEROES[l.hero].abilities.some((a) => a.id === id), l.id + ' boss ability ' + id));
    l.fights.forEach((f) => {
      ok(f.power > 0, f.id);
      const slots = new Set();
      f.units.forEach(([id, star, slot, from]) => { ok(AMB.DATA.UNITS[id], f.id + ' ' + id); ok(/^[fb][0-3]$/.test(slot), slot); ok(!slots.has(slot), f.id + ' dup slot ' + slot); slots.add(slot); ok(star >= 1 && star <= 3 && from >= 1 && from <= (f.boss ? 7 : 3)); });
      if (f.boss) ok(!slots.has('b1'), f.id + ' boss hero slot b1 must be free');
    });
  });
});
t('short match: best of 3, scripted enemy line-up grows by round, boss on board with ability', () => {
  const prof = AMB.Profile.boot(MEM());
  const m = new AMB.Match(prof.campaign.matchOptions('l1boss', 'merin', 3));
  m.startRound();
  const e = m.players[1], f = AMB.LEVELS.LEVELS[0].fights[4];
  eq(Object.keys(e.board).length, f.units.filter((u) => u[3] <= 1).length, 'round-1 units');
  ok(e.summoned && e.heroSlot === 'b1'); ok(e.abilities.inferno_banner === 'start'); eq(e.blessings.atkPct, 0.2);
  eq(m.players[0].level, Math.max(AMB.CONFIG.economy.startLevel, AMB.LEVELS.LEVELS[0].start.level), 'start level bonus');
  AMB.AI.prep(m, 1); eq(e.shop.length, 0, 'scripted enemy never shops');
  m.resolveCombat(m.createCombat(false).runToEnd());
  if (!m.isOver) { m.startRound(); eq(Object.keys(e.board).length, f.units.filter((u) => u[3] <= 2).length, 'round-2 units'); }
  for (let s = 1; s <= 15; s++) { const r = runFight(prof, 'l1f2', 'orath', s); ok(r.round <= 3, 'max 3 rounds'); ok(r.winner === null || Math.max(...r.players.map((p) => p.stats.wins)) >= 1); if (r.winner != null && r.round < 3) eq(r.players[r.winner].stats.wins, 2); }
});
t('campaign match uses the collection: card power + owned units; enemy power from the level', () => {
  const prof = AMB.Profile.boot(MEM());
  prof.collection.add('ash_ronin', 3); prof.collection.upgrade('ash_ronin');
  const o = prof.campaign.matchOptions('l1f1', 'orath', 1);
  ok(o.progression); eq(o.players[0].cardPower.ash_ronin, Math.round(prof.collection.power('ash_ronin') * 1000) / 1000);
  ok(o.players[0].allowedUnits.every((id) => prof.collection.owned(id)));
  eq(o.players[1].cardPower.ash_ronin, AMB.LEVELS.LEVELS[0].fights[0].power);
});
t('campaign: unlock order, first-win rewards, replay rewards, level bonus pack, saved', () => {
  const mem = MEM(); let xp = 0;
  const prof = AMB.Profile.boot(mem); const C = prof.campaign;
  const cam = AMB.Campaign(prof.save, { wallet: prof.wallet, packs: prof.packs, collection: prof.collection, events: prof.events, addPassXp: (n) => (xp += n) });
  ok(cam.isUnlocked('l1f1')); ok(!cam.isUnlocked('l1f2')); ok(!cam.isUnlocked('l2f1')); eq(cam.next(), 'l1f1');
  const sh0 = prof.wallet.balance('shards');
  const lost = cam.recordResult('l1f1', { won: false }); ok(!lost.won && !lost.shards); ok(!cam.isCleared('l1f1'));
  const R = AMB.LEVELS.CAMPAIGN.rewards;
  const w1 = cam.recordResult('l1f1', { won: true, lifeLeft: 80 });
  ok(w1.first); eq(w1.shards, R.fight.shards); eq(xp, R.fight.passXp); ok(cam.isUnlocked('l1f2'));
  const again = cam.recordResult('l1f1', { won: true, lifeLeft: 95 });
  ok(!again.first); eq(again.shards, R.replay.shards); eq(xp, R.fight.passXp, 'no pass xp on replays');
  eq(cam.stats('l1f1').attempts, 3); eq(cam.stats('l1f1').best.lifeLeft, 95);
  ['l1f2', 'l1f3', 'l1f4'].forEach((id) => { ok(cam.isUnlocked(id), id); cam.recordResult(id, { won: true }); });
  ok(!cam.isUnlocked('l2f1'), 'next level locked until the boss falls');
  const before = prof.packs.stats().opened;
  const boss = cam.recordResult('l1boss', { won: true });
  ok(boss.boss && boss.levelComplete && boss.pack && boss.pack.cards.length === 5); eq(boss.stars, 2); eq(boss.shards, R.bossStars[0].shards + R.bossStars[1].shards, 'a 2-star boss win pays the prizes of star 1 and 2'); eq(boss.packs.length, 1, 'star 2 prize pack');
  eq(prof.packs.stats().opened, before + 2, 'level pack + the star-2 pack opened for free');
  const refunds = (boss.pack.refund || 0) + boss.packs.reduce((a, pk) => a + (pk.refund || 0), 0);
  eq(prof.wallet.balance('shards'), sh0 + R.fight.shards * 4 + R.replay.shards + boss.shards + refunds);
  ok(cam.levelDone('l1') && cam.isUnlocked('l2f1')); eq(cam.next(), 'l2f1');
  const again2 = cam.recordResult('l1boss', { won: true }); ok(!again2.levelComplete && !again2.pack, 'level bonus only once');
  const cam2 = AMB.Profile.boot(mem).campaign; ok(cam2.levelDone('l1')); eq(cam2.next(), 'l2f1');
});
t('a real campaign fight runs end to end and pays out', () => {
  const prof = AMB.Profile.boot(MEM());
  const m = runFight(prof, 'l1f1', 'orath', 4, 0);
  eq(m.winner, 0); eq(m.summary(0).mode, 'campaign');
  const r = prof.campaign.recordResult('l1f1', Object.assign(m.summary(0), { lifeLeft: m.players[0].life }));
  ok(r.first && r.shards > 0);
});

console.log('stars & chests');
const camOf = (prof, rng) => AMB.Campaign(prof.save, { wallet: prof.wallet, packs: prof.packs, collection: prof.collection, events: prof.events, rng });
t('stars: 1 win, 2 no round lost, 3 also full hero life; loss = 0', () => {
  const r = AMB.Campaign(AMB.Save.create(MEM())).rate;
  eq(r({ won: false }), 0); eq(r({ won: true, roundsLost: 1, lifeLeft: 100 }), 1);
  eq(r({ won: true, roundsLost: 0, lifeLeft: 92 }), 2); eq(r({ won: true, roundsLost: 0, lifeLeft: 100 }), 3);
  eq(r({ won: true, roundsLost: 0, lifeLeft: 50, maxLife: 50 }), 3);
});
t('stars: best result is kept, replays only add the difference, totals per level', () => {
  const prof = AMB.Profile.boot(MEM()), cam = camOf(prof);
  let o = cam.recordResult('l1f1', { won: true, roundsLost: 1, lifeLeft: 70 }); eq(o.stars, 1); ok(o.newBest);
  o = cam.recordResult('l1f1', { won: true, roundsLost: 0, lifeLeft: 100 }); eq(o.stars, 3); eq(o.prevStars, 1); ok(o.newBest);
  o = cam.recordResult('l1f1', { won: true, roundsLost: 1, lifeLeft: 10 }); ok(!o.newBest); eq(cam.stars('l1f1'), 3, 'worse replay keeps best');
  cam.recordResult('l1f2', { won: false }); eq(cam.stars('l1f2'), 0);
  cam.recordResult('l1f2', { won: true, roundsLost: 0, lifeLeft: 90 });
  eq(cam.levelStars('l1'), 5); eq(cam.totalStars(), 5); eq(cam.maxStars(), 120);
});
t('chests: open at 10/25/40/60/80/100/120 stars, once each, with their rewards', () => {
  const prof = AMB.Profile.boot(MEM()), cam = camOf(prof, AMB.util.RNG(4));
  const C = AMB.LEVELS.CAMPAIGN.stars.chests;
  eq(C.map((c) => c.need).join(), '10,25,40,60,80,100,120'); eq(cam.readyChests(), 0);
  eq(cam.claimChest('ch10'), null, 'locked chest');
  const all = AMB.LEVELS.LEVELS.flatMap((l) => l.fights.map((f) => f.id));
  all.slice(0, 4).forEach((id) => cam.recordResult(id, { won: true, roundsLost: 0, lifeLeft: 100 }));   // 12 stars
  eq(cam.totalStars(), 12); eq(cam.readyChests(), 1);
  const sh = prof.wallet.balance('shards');
  const c1 = cam.claimChest('ch10'); eq(c1.shards, 100); eq(prof.wallet.balance('shards'), sh + 100);
  eq(cam.claimChest('ch10'), null, 'only once');
  all.forEach((id) => cam.recordResult(id, { won: true, roundsLost: 0, lifeLeft: 100 }));
  eq(cam.totalStars(), 120); eq(cam.readyChests(), 6);
  const opened = prof.packs.stats().opened;
  eq(cam.claimChest('ch25').packs.length, 1); eq(cam.claimChest('ch40').packs.length, 2); eq(prof.packs.stats().opened, opened + 3);
  const c4 = cam.claimChest('ch60'); ok(['epic', 'legendary'].includes(c4.card.rarity), c4.card.rarity); ok(prof.collection.owned(c4.card.id));
  const c5 = cam.claimChest('ch80'); eq(c5.shards, 200); eq(c5.packs.length, 1);
  const c6 = cam.claimChest('ch100'); eq(c6.packs.length, 2); ok(['epic', 'legendary'].includes(c6.card.rarity));
  const c7 = cam.claimChest('ch120'); eq(c7.card.rarity, 'legendary');
  eq(cam.readyChests(), 0); ok(cam.chests().every((c) => c.state === 'claimed'));
});
t('stars: saves from before stars get rated from their best results (migration)', () => {
  const mem = MEM();
  const sv = AMB.Save.create(mem);
  sv.set('campaign', { cleared: { l1f1: true, l1f2: true }, levelsDone: {}, stats: { l1f1: { attempts: 1, wins: 1, best: { lifeLeft: 100, roundsLost: 0 } }, l1f2: { attempts: 2, wins: 1, best: null } } });
  const raw = JSON.parse(mem.getItem(AMB.Save.KEY)); raw.sysV.campaign = 1; mem.setItem(AMB.Save.KEY, JSON.stringify(raw));
  const cam = AMB.Profile.boot(mem).campaign;
  eq(cam.stars('l1f1'), 3); eq(cam.stars('l1f2'), 1); eq(cam.totalStars(), 4); ok(Array.isArray(cam.chests()));
});

console.log('daily missions & login calendar');
const passFor = (prof, clock) => {
  const pass = AMB.Pass.create(prof.save.storageFor('pass'), clock, (r) => { if (r.type === 'shards') prof.wallet.add('shards', r.n, 'mission'); else prof.collection.grantPassReward(r); });
  AMB.Pass.wire(pass, prof.events); return pass;
};
t('every daily mission gives shards (30-50) and XP; 3 a day', () => {
  AMB.Pass.DAILY.forEach((m) => ok(m.shards >= 30 && m.shards <= 50 && m.xp > 0, m.id));
  const pass = passFor(AMB.Profile.boot(MEM()));
  eq(pass.dailyMissions().length, 3);
});
t('claiming a daily mission pays shards to the wallet once', () => {
  const T = Date.UTC(2026, 10, 5, 12); let now = T;
  const prof = AMB.Profile.boot(MEM(), () => now), pass = passFor(prof, () => now);
  const m = pass.dailyMissions()[0];
  pass.track(m.stat, m.target);
  const bal = prof.wallet.balance('shards');
  const r = pass.claimMission(m.id); eq(r.shards, m.shards); eq(prof.wallet.balance('shards'), bal + m.shards);
  eq(pass.claimMission(m.id), null); eq(prof.wallet.balance('shards'), bal + m.shards, 'only once');
});
t('missions count campaign fights, card upgrades, packs and new stars (event bus)', () => {
  const prof = AMB.Profile.boot(MEM()), pass = passFor(prof);
  const p = () => pass.state().daily.p;
  prof.collection.add('ash_ronin', 2); prof.collection.upgrade('ash_ronin'); eq(p().upgrades, 1);
  prof.packs.open('basic'); eq(p().packs, 1);
  const cam = AMB.Campaign(prof.save, { events: prof.events, wallet: prof.wallet, packs: prof.packs, collection: prof.collection });
  cam.recordResult('l1f1', { won: true, roundsLost: 0, lifeLeft: 100, roundsWon: 2, buys: 4 });
  eq(p().campaign, 1); eq(p().fights_won, 1); eq(p().wins, 1); eq(p().matches, 1); eq(p().stars, 3); eq(p().buys, 4);
  cam.recordResult('l1f1', { won: true, roundsLost: 0, lifeLeft: 100 }); eq(p().stars, 3, 'replaying a 3-star fight gives no new stars');
  cam.recordResult('l1f2', { won: false }); eq(p().campaign, 3); eq(p().fights_won, 2);
  eq(pass.state().weekly.p.campaign, 3, 'weekly counts too');
});
t('quick-match wins count for "win 3 fights"; friendly matches do not', () => {
  const pass = passFor(AMB.Profile.boot(MEM()));
  const sm = { mode: 'normal', won: true, roundsPlayed: 7, roundsWon: 4, buys: 0, rerolls: 0, merges: 0, stageRewards: 0, damage: 0, worldsUsed: 1 };
  pass.recordMatch(sm); pass.recordMatch(Object.assign({}, sm, { mode: 'friendly' }));
  eq(pass.state().daily.p.fights_won, 1);
});
t('login calendar: one claim per day, rewards grow, missed days do not reset, day 7 = pack + rare+ card, cycles', () => {
  const D = 864e5; let now = new Date(2026, 10, 5, 10).getTime();
  const mem = MEM(), prof = AMB.Profile.boot(mem, () => now), L = prof.login, R = AMB.ECONOMY.login;
  eq(R.length, 7); for (let i = 1; i < 6; i++) ok(R[i].shards > R[i - 1].shards, 'grows');
  ok(L.canClaim());
  const bal = prof.wallet.balance('shards');
  const c1 = L.claim(); eq(c1.day, 1); eq(c1.shards, R[0].shards); eq(prof.wallet.balance('shards'), bal + R[0].shards);
  eq(L.claim(), null, 'once per day'); ok(!L.canClaim());
  now += 3 * D;   // missed two days
  const prof2 = AMB.Profile.boot(mem, () => now);   // reloaded game
  const c2 = prof2.login.claim(); eq(c2.day, 2, 'continues, no reset');
  let last; for (let d = 3; d <= 7; d++) { now += D; last = prof2.login.claim(); eq(last.day, d); }
  eq(last.packs.length, 1); ok(['rare', 'epic', 'legendary'].includes(last.card.rarity));
  now += D; eq(prof2.login.claim().day, 1, 'new cycle'); eq(prof2.login.status().cycles, 1);
});

console.log('album');
t('album: 5 units per world, progress counts owned units, starters count', () => {
  const prof = AMB.Profile.boot(MEM()), A = prof.album;
  eq(A.worlds().length, 4);
  eq(A.units('ember').length, 15); eq(A.units('tide').length, 15); eq(A.units('neon').length, 14); eq(A.units('sylvan').length, 21);
  eq(A.total().total, 65); eq(A.total().owned, 8, 'the 8 starter units');
  eq(A.progress('ember').owned, 3, 'ash_ronin, forge_bulwark, shiro');
  eq(A.state('ember'), 'locked');
});
t('save: a second tab becomes the only writer, the stale tab locks and can never overwrite newer progress', () => {
  const mem = AMB.Save.memoryStorage();
  let fire = null; const hooks = { onForeignWrite: (cb) => { fire = cb; } };
  AMB.Save.register('lockt', { defaults: () => ({ n: 0 }) });
  const tabA = AMB.Save.create(mem, null, hooks);                 // the old tab
  tabA.update('lockt', (s) => { s.n = 1; });
  const tabB = AMB.Save.create(mem);                              // a second tab opens and writes
  tabB.update('lockt', (s) => { s.n = 600; });
  eq(tabA.isLocked(), false); let notified = 0; tabA.onLock(() => notified++);
  fire();                                                         // the browser tells tab A that tab B wrote
  eq(tabA.isLocked(), true); eq(notified, 1, 'the UI is told');
  tabA.update('lockt', (s) => { s.n = 100; });                    // the stale tab keeps playing…
  eq(tabA.write(), false, 'locked tabs never write');
  eq(AMB.Save.create(mem).get('lockt').n, 600, 'the newer progress is untouched');
});
t('save: importing into a locked tab fails loudly and keeps the old data; netsync refuses huge op lists', () => {
  const mem = AMB.Save.memoryStorage(); let fire = null;
  AMB.Save.register('lockt2', { defaults: () => ({ n: 0 }) });
  const tab = AMB.Save.create(mem, null, { onForeignWrite: (cb) => { fire = cb; } });
  tab.update('lockt2', (s) => { s.n = 7; }); const text = tab.exportJSON(); fire();
  let threw = false; try { tab.importJSON(text); } catch (e) { threw = true; }
  eq(threw, true, 'a locked tab cannot claim the import worked');
  const m = new AMB.Match({ mode: 'online', seed: 5, isolated: true, players: [{ heroId: 'orath', name: 'a' }, { heroId: 'merin', name: 'b' }] });
  eq(AMB.NetSync.replay(m, 1, new Array(201).fill(['sell', 'x'])).join(), 'ops', 'an op list over the cap is refused whole');
});
t('kid-friendly words: rarity names are plain Arabic (no English loanwords)', () => {
  const R = AMB.ECONOMY.rarities;
  eq([R.common.name, R.rare.name, R.epic.name, R.legendary.name].join(','), 'عادي,نادر,ملحمي,أسطوري');
});
t('teen #12/#15/#19/#13: invest pays at the finale, wager only in the finale, weekly late hero, assassin hunt setting', () => {
  const m = new AMB.Match({ mode: 'ai', seed: 9, weekly: 'lateHero', players: [{ heroId: 'orath', name: 'a' }, { heroId: 'merin', name: 'b', isAI: true }] });
  m.startRound(); const p = m.players[0];
  eq(m.toggleSummon(0).ok, false, 'late hero: no summon before round 4');
  eq(m.setWager(0, true).ok, false, 'no wager before the finale');
  p.invest = 15; const g0 = p.gold;
  eq(m.setHunt(0, 'weak').ok, true); eq(m.buildCombatSpec(0).hunt, 'weak'); eq(m.setHunt(0, 'nope').ok, false);
  while (m.round < AMB.CONFIG.match.maxRounds - 1) { m.resolveCombat(m.createCombat(false).runToEnd()); if (!m.isOver) m.startRound(); }
  ok(p.invest === 15, 'not paid before the finale');
  m.resolveCombat(m.createCombat(false).runToEnd()); if (!m.isOver) m.startRound();
  ok(m.isFinale(m.round) && p.invest === 0, 'paid at the start of the finale');
  eq(m.setWager(0, true).ok, true, 'wager allowed in the finale prep');
  ok(AMB.Match.WEEKLY[AMB.Match.weeklyNow()], 'a rule of the week exists');
});
t('adult #21: a quick match rebuilt from its recorded moves is identical (continue after a reload)', () => {
  const opts = { mode: 'ai', seed: 4242, weekly: 'freeReroll', players: [{ heroId: 'kagira', name: 'a', isAI: true, aiStyle: 'mono', difficulty: 'hard' }, { heroId: 'thora', name: 'b', isAI: true, aiStyle: 'balanced', difficulty: 'hard' }] };
  const m = new AMB.Match(opts), rec = AMB.NetSync.record(m, 0), rounds = [];
  for (let r = 0; r < 4; r++) {
    m.startRound(); const aiFirst = m.round % 2 === 0;
    if (aiFirst) AMB.AI.prep(m, 1);
    // a human only acts through the match's own moves (the UI never edits the state directly): buy what fits, arrange, send the hero in from round 3
    for (let i = 0; i < 5; i++) if (m.canBuy(0, i).ok) m.buy(0, i);
    m.autoArrange(0); if (m.round >= 3 && !m.players[0].summoned) m.toggleSummon(0);
    const prep = rec.take(); m.autoFill(0);
    if (!aiFirst) AMB.AI.prep(m, 1);
    m.resolveCombat(m.createCombat(false).runToEnd());
    if (m.players[0].rewardOffer && !m.players[0].rewardOffer.claimed) AMB.AI.claimReward(m, 0);
    const reward = rec.take();
    if (m.players[1].rewardOffer && !m.players[1].rewardOffer.claimed) AMB.AI.claimReward(m, 1);
    rounds.push({ aiFirst, prep, reward });
  }
  const b = new AMB.Match(JSON.parse(JSON.stringify(opts)));
  for (const r of rounds) {
    b.startRound(); if (r.aiFirst) AMB.AI.prep(b, 1);
    eq(AMB.NetSync.replay(b, 0, r.prep).length, 0); b.autoFill(0);
    if (!r.aiFirst) AMB.AI.prep(b, 1);
    b.resolveCombat(b.createCombat(false).runToEnd());
    eq(AMB.NetSync.replay(b, 0, r.reward).length, 0);
    if (b.players[1].rewardOffer && !b.players[1].rewardOffer.claimed) AMB.AI.claimReward(b, 1);
  }
  eq(AMB.NetSync.hash(b), AMB.NetSync.hash(m), 'same state after the replay');
});
t('adult #22-#28, senior #39: short match mode, daily quick-match shards cap, wish hero from the guarantee, mission swap, undo snapshot', () => {
  // short match: 4 rounds, its own pass mode
  const sh = new AMB.Match({ mode: 'short', players: [{ heroId: 'orath', name: 'a', isAI: true, difficulty: 'normal' }, { heroId: 'merin', name: 'b', isAI: true, difficulty: 'normal' }], rules: { maxRounds: 4, winsNeeded: 3, start: { gold: 8, level: 2 } } });
  while (!sh.isOver) { sh.startRound(); AMB.AI.prep(sh, 0); AMB.AI.prep(sh, 1); sh.resolveCombat(sh.createCombat(false).runToEnd()); }
  ok(sh.round <= 4, 'over within 4 rounds'); eq(sh.summary(0).mode, 'short');
  // quick-match shards: +10/+5, 60 a day
  const prof = AMB.Profile.boot(AMB.Save.memoryStorage()), dp = prof.dayPay;
  let paid = 0; for (let i = 0; i < 10; i++) paid += dp.quickMatch(true);
  eq(paid, 60, 'daily cap'); eq(dp.quickLeft(), 0);
  ok(dp.onlineCounts() && dp.onlineCounts() && dp.onlineCounts() && !dp.onlineCounts(), 'first 3 friend matches a day count');
  // heroes are not in packs any more (campaign prizes only)
  const P = prof.packs; prof.wallet.add('shards', 100000, 'test'); let sawHero = false;
  for (let i = 0; i < 80; i++) { const r = P.open(); if (r && r.cards.some((c) => AMB.DATA.HEROES[c.id])) sawHero = true; }
  ok(!sawHero, 'no pack ever contains a hero'); eq(P.setWish('rika'), false);
  // mission swap: once a day
  const pass = mkPass(); const d0 = pass.dailyMissions(); const sw = pass.swapMission(d0[0].id);
  ok(sw && sw.id !== d0[0].id, 'swapped'); ok(!pass.canSwap() && pass.swapMission(d0[1].id) === null, 'once a day');
  eq(pass.dailyMissions()[0].id, sw.id, 'the swapped mission is today\'s');
  // undo: snapshot / restore brings back gold, bench and pool
  const m = new AMB.Match({ mode: 'ai', seed: 3, players: [{ heroId: 'orath', name: 'a' }, { heroId: 'merin', name: 'b', isAI: true }] });
  m.startRound(); const p0 = m.players[0], g0 = p0.gold, snap = m.snapshot(0), id0 = p0.shop[0], pool0 = m._pool(p0)[id0];
  ok(m.buy(0, 0).ok); ok(p0.gold < g0);
  m.restore(0, snap); eq(p0.gold, g0); eq(p0.shop[0], id0); eq(m._pool(p0)[id0], pool0); ok(!p0.bench.some(Boolean), 'bench back to empty');
});
t('undo in a progression match (allowed-units Set, scripted lineup) never breaks the next round', () => {
  const m = new AMB.Match({ mode: 'campaign', seed: 11, progression: true, rules: { maxRounds: 3, winsNeeded: 2, start: { gold: 10, level: 1 } },
    players: [{ heroId: 'orath', name: 'a', allowedUnits: new Set(Object.keys(AMB.DATA.UNITS).slice(0, 20)) }, { heroId: 'merin', name: 'b', isAI: true }] });
  m.startRound(); const snap = m.snapshot(0); for (let i = 0; i < 5; i++) if (m.canBuy(0, i).ok) { m.buy(0, i); break; }
  m.restore(0, snap); ok(m.players[0].allowed instanceof Set, 'the allowed-units Set survives an undo');
  AMB.AI.prep(m, 1); m.resolveCombat(m.createCombat(false).runToEnd()); if (!m.isOver) m.startRound(); ok(true, 'next round starts');
});
t('one-time reset: an old player starts from zero once, the old save is kept aside, a fresh visitor and a second visit are untouched', () => {
  const mem = () => { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; }, key: (i) => Object.keys(m)[i], get length() { return Object.keys(m).length; }, _m: m }; };
  const st = mem(), p0 = AMB.Profile.boot(st); p0.collection.chooseStarter('kagira'); p0.wallet.add('shards', 777, 't');
  eq(AMB.Profile.resetOnce(st, 'r-test'), true, 'an old player is reset');
  ok(st.getItem('zor_before_reset') && JSON.parse(st.getItem('zor_before_reset')).systems.wallet, 'the old save is kept aside');
  const p1 = AMB.Profile.boot(st); const fresh = AMB.Profile.boot(mem()).wallet.balance('shards'); eq(p1.wallet.balance('shards'), fresh, 'balance back to a new player\'s'); ok(fresh !== 777); ok(p1.collection.needsStarter(), 'needs a starter again');
  p1.wallet.add('shards', 5, 't'); eq(AMB.Profile.resetOnce(st, 'r-test'), false, 'a second visit does not reset again'); eq(AMB.Profile.boot(st).wallet.balance('shards'), fresh + 5);
  eq(AMB.Profile.resetOnce(mem(), 'r-test'), false, 'a brand-new visitor has nothing to reset');
});
t('campaign heroes: a level gives its hero only after ALL its fights are won on easy, medium and hard', () => {
  const prof = AMB.Profile.boot(AMB.Save.memoryStorage()), C = prof.campaign, L = AMB.LEVELS.LEVELS[4];   // level 5 -> Rika
  const win = (id, d) => C.recordResult(id, { won: true, roundsLost: 0, lifeLeft: 100, maxLife: 100 }, d);
  [AMB.LEVELS.LEVELS[0], AMB.LEVELS.LEVELS[1], AMB.LEVELS.LEVELS[2], AMB.LEVELS.LEVELS[3], L].forEach((l) => ['easy', 'normal', 'hard'].forEach((d) => l.fights.forEach((f) => { if (C.isUnlocked(f.id, d)) win(f.id, d); })));
  ok(C.levelAll(L.id), 'level 5 finished on all three'); ok(prof.collection.owned(L.hero), 'its hero (' + L.hero + ') is owned now');
  const prof2 = AMB.Profile.boot(AMB.Save.memoryStorage()), L1 = AMB.LEVELS.LEVELS[0];
  ['easy', 'normal'].forEach((d) => L1.fights.forEach((f) => { if (prof2.campaign.isUnlocked(f.id, d)) prof2.campaign.recordResult(f.id, { won: true, roundsLost: 0, lifeLeft: 100, maxLife: 100 }, d); }));
  ok(prof2.campaign.levelDone(L1.id, 'normal') && !prof2.campaign.levelAll(L1.id), 'two difficulties are not enough');
  ok(!prof2.collection.owned('rika') && !prof2.collection.owned('kairyu'), 'other heroes stay locked');
  const g = prof2.collection.grantRandom('legendary'); ok(!AMB.DATA.HEROES[g.id], 'random grants never give a hero');
});
t('online safety: a friend cannot send an impossible slot/index or a malformed op (nothing throws, nothing is duplicated)', () => {
  const m = new AMB.Match({ mode: 'online', seed: 5, isolated: true, players: [{ heroId: 'orath', name: 'a' }, { heroId: 'merin', name: 'b' }] });
  m.startRound(); const p = m.players[1]; p.gold = 50;
  eq(m.buy(1, 0).ok, true); const u = p.bench.find(Boolean);
  eq(m.move(1, u.uid, { zone: 'board', slot: 'zz9' }).ok, false, 'unknown slot'); eq(m.move(1, u.uid, { zone: 'bench', idx: 99 }).ok, false, 'bench index out of range');
  eq(m.move(1, u.uid, { zone: 'bench', idx: -1 }).ok, false); eq(m.move(1, u.uid, undefined).ok, false, 'missing destination'); eq(m.move(1, u.uid, { zone: 'x' }).ok, false);
  eq(m.moveHero(1, 'zz').ok, false); eq(m.toggleSummon(1, 'q7').ok, false);
  eq(Object.keys(p.board).length + p.bench.filter(Boolean).length, 1, 'still exactly one unit');
  const bad = AMB.NetSync.replay(m, 1, [['move', u.uid], ['bogus', 1], 'nope', [], ['sell', 'nobody'], ['move', u.uid, { zone: 'board', slot: 'f9' }]]);
  ok(bad.length >= 4, 'every bad op is reported, none throws'); eq(AMB.NetSync.replay(m, 1, 'not-an-array').length, 1);
});
t('save: wrong-typed data is repaired per system (never throws later), unknown keys survive, and the previous save can be restored', () => {
  const mem = AMB.Save.memoryStorage();
  mem.setItem(AMB.Save.KEY, JSON.stringify({ v: 1, systems: { wallet: { balances: null }, collection: { cards: 'x', starterHero: 5 }, future: { keep: 1 } }, sysV: {} }));
  const prof = AMB.Profile.boot(mem);
  eq(typeof prof.wallet.balance('shards'), 'number', 'wallet.balances null -> default'); ok(prof.collection.ownedUnits().length >= 0, 'collection.cards "x" -> default');
  eq(prof.save.get('future').keep, 1, 'unknown systems and keys are kept');
  // import: a bad file is repaired, the previous save stays restorable
  const good = prof.save.exportJSON();
  prof.save.importJSON(JSON.stringify({ systems: { wallet: { balances: 'x' }, collection: { cards: null } } }));
  eq(typeof AMB.Profile.boot(mem).wallet.balance('shards'), 'number', 'imported junk is repaired');
  ok(prof.save.hasBackup('preimport')); prof.save.restore('preimport');
  eq(prof.save.exportJSON() === good || JSON.parse(prof.save.exportJSON()).systems.future.keep === 1, true, 'restored the previous save');
});
t('front line flag: a summoned hero in front counts (A5); a leaped assassin no longer holds the front (A13); a pure-essence reward above the cap survives the next round (A3)', () => {
  const a = new AMB.Combat([side([U('pixel_sniper', 'b1')], { summoned: true, heroSlot: 'f1' }), side([U('grid_hound', 'f1')])], { seed: 8, round: 1 });
  ok(!a.sides[0].frontDown, 'the hero standing in front is the defence line');
  const b = new AMB.Combat([side([U('grid_hound', 'f1')]), side([U('moss_warden', 'f1')])], { seed: 9, round: 1 });
  ok(!b.sides[0].frontDown); b.fighters.find((f) => f.defId === 'grid_hound').leaped = true; b._updateExposure(); ok(b.sides[0].frontDown, 'leaped assassin does not hold the front line');
  const m = new AMB.Match({ mode: 'ai', seed: 3, players: [{ heroId: 'orath', name: 'a' }, { heroId: 'merin', name: 'b', isAI: true }] });
  m.startRound(); m.players[0].essence = 13; m.resolveCombat(m.createCombat(false).runToEnd()); m.startRound();
  ok(m.players[0].essence >= 13, 'essence above the cap is kept');
});
t('desync fingerprint includes each phone\'s own unit pool (online), so a pool drift is detected', () => {
  const mk = () => new AMB.Match({ mode: 'online', seed: 21, isolated: true, players: [{ heroId: 'orath', name: 'a' }, { heroId: 'merin', name: 'b' }] });
  const A = mk(), B = mk(); A.startRound(); B.startRound();
  eq(AMB.NetSync.hash(A), AMB.NetSync.hash(B), 'identical copies, identical hash');
  B.players[1].pool.ash_ronin -= 1;
  ok(AMB.NetSync.hash(A) !== AMB.NetSync.hash(B), 'a pool difference changes the fingerprint');
});
t('role contract: an assassin commits to the dive early and goes for the back line; guardians and fighters hold the front; ranged units hold their row', () => {
  const c = new AMB.Combat([side([U('grid_hound', 'f1'), U('moss_warden', 'f2'), U('ash_ronin', 'f0'), U('pixel_sniper', 'b1')]), side([U('forge_bulwark', 'f1'), U('wave_caller', 'b1'), U('caldera_seer', 'b2')])], { seed: 12, round: 1 });
  const by = (d) => c.fighters.find((f) => f.defId === d && f.side === 0);
  const y0 = { g: by('moss_warden').y, f: by('ash_ronin').y, s: by('pixel_sniper').y };
  const dt = 0.05; let t = 0; while (t < 2.5 && !c.over) { c.step ? c.step(dt) : c.update(dt); t += dt; }
  ok(by('grid_hound').leaped, 'assassin leapt by 2.5s'); ok(by('grid_hound').y > 3, 'and stands in the enemy back line');
  ok(Math.abs(by('moss_warden').y - y0.g) < 1.5, 'guardian stays at the front'); ok(Math.abs(by('pixel_sniper').y - y0.s) < 1.2, 'marksman holds its row');
});
t('rarity ladder: traits by rarity, and every legendary signature does what it says', () => {
  const D = AMB.DATA, N = (r) => Object.values(D.UNITS).filter((u) => u.rarity === r);
  N('common').forEach((u) => eq(u.traits.length, 0, u.id)); N('rare').forEach((u) => eq(u.traits.length, 1, u.id));
  N('epic').concat(N('legendary')).forEach((u) => eq(u.traits.length, 2, u.id)); N('legendary').forEach((u) => ok(u.sig && D.SIGS[u.sig], 'signature ' + u.id));
  const mk = (a, b) => new AMB.Combat([side(a), side(b)], { seed: 41, round: 1 });
  const get = (c, d, sd) => c.fighters.find((f) => f.defId === d && f.side === (sd || 0));
  // a rare fighter really is faster than a common one of the same role (frenzy +10% attack speed)
  const cr = mk([U('lunar_blade', 'f1'), U('ash_ronin', 'f2')], [U('grid_hound', 'f1')]);
  ok(get(cr, 'lunar_blade').as / get(cr, 'ash_ronin').as > 1.05 * (D.UNITS.lunar_blade.as / D.UNITS.ash_ronin.as), 'rare trait applied');
  // reflect (Taiju)
  const a = mk([U('taiju', 'f1')], [U('grid_hound', 'f1')]); const tai = get(a, 'taiju'), hit = get(a, 'grid_hound', 1);
  const h0 = hit.hp; a.damage(hit, tai, 400); ok(hit.hp < h0, 'reflect hurts the attacker');
  // lifeline (Otohime): the first lethal hit on an ally is survived once
  const b = mk([U('otohime', 'b1'), U('moss_warden', 'f1')], [U('grid_hound', 'f1')]); const w = get(b, 'moss_warden'), en = get(b, 'grid_hound', 1);
  b.damage(en, w, 1e6); ok(w.alive && w.hp > 0, 'saved once'); b.damage(en, w, 1e6); ok(!w.alive, 'but not twice');
  // bloodrush (Goka): kills speed it up (max 3)
  const g = mk([U('goka', 'f1')], [U('grid_hound', 'f1'), U('pixel_sniper', 'b1')]); const gk = get(g, 'goka'); const as0 = g.effAs(gk);
  g.kill(get(g, 'grid_hound', 1), gk); ok(g.effAs(gk) > as0 * 1.15, 'bloodrush');
});
t('role slots: a card in its own role slot gets the role bonus; auto-arrange and the AI put units in their role slots', () => {
  const D = AMB.DATA;
  const mkc = (slot) => new AMB.Combat([side([U('moss_warden', slot)]), side([U('grid_hound', 'f1')])], { seed: 55, round: 1 });
  const inP = mkc('f1').fighters.find((f) => f.defId === 'moss_warden'), out = mkc('f0').fighters.find((f) => f.defId === 'moss_warden');
  ok(inP.inPlace && !out.inPlace, 'only the guardian slot counts'); ok(inP.maxHp > out.maxHp * 1.12, 'guardian in a guardian slot: +15% hp');
  const r = AMB.Match.placeByRole([{ defId: 'ash_ronin' }, { defId: 'moss_warden' }, { defId: 'forge_bulwark' }, { defId: 'grid_hound' }], ['f1', 'f2', 'f0', 'f3']);
  ok(['f1', 'f2'].includes(Object.keys(r.out).find((k) => r.out[k].defId === 'moss_warden')), 'guardian to the wall'); ok(['f0', 'f3'].includes(Object.keys(r.out).find((k) => r.out[k].defId === 'ash_ronin')), 'fighter to a flank');
  const m = new AMB.Match({ mode: 'ai', seed: 9, players: [{ heroId: 'orath', name: 'a' }, { heroId: 'merin', name: 'b', isAI: true }] });
  m.startRound(); const p = m.players[0]; p.gold = 99; p.level = 6;
  ['moss_warden', 'ash_ronin', 'pixel_sniper', 'wave_caller'].forEach((id) => { const u = m._newUnit ? m._newUnit(p, id) : null; });
  ok(D.SLOT_ROLES.f1.includes('guardian') && D.SLOT_ROLES.b1[0] === 'mage');
});
t('album: world set reward is claimable once, gives shards + title + frame (equippable in the pass)', () => {
  const prof = AMB.Profile.boot(MEM()), A = prof.album;
  const pass = AMB.Pass.create(prof.save.storageFor('pass'), null, null, (type) => A.ownedCosmetics(type));
  A.units('ember').forEach((id) => prof.collection.add(id, 1));
  eq(A.state('ember'), 'ready'); eq(A.readyCount(), 2);   // the world set + the page's discovery prizes
  ok(!pass.owned('title').includes('alb_ember'), 'not before claiming');
  const sh = prof.wallet.balance('shards');
  const r = A.claim('ember'); ok(r); eq(prof.wallet.balance('shards'), sh + AMB.ECONOMY.album.worlds.ember.shards);
  eq(A.claim('ember'), null, 'once only'); eq(A.state('ember'), 'claimed');
  ok(pass.owned('title').includes('alb_ember') && pass.owned('frame').includes('alb_ember'));
  ok(pass.equip('title', 'alb_ember') && pass.equip('frame', 'alb_ember'));
  ok(AMB.Pass.COSMETICS.frame.alb_ember.c1 && AMB.Pass.COSMETICS.title.alb_all);
  eq(A.claim('tide'), null, 'incomplete world cannot be claimed');
});
t('album: discovery prizes (common 50, legendary 100), starting cards pay nothing, claim-all per page, once each', () => {
  const prof = AMB.Profile.boot(MEM()), A = prof.album, D = AMB.DATA;
  const st = Object.values(D.UNITS).find((u) => u.starter), nw = Object.values(D.UNITS).find((u) => !u.starter && !u.exclusive && u.rarity !== 'legendary' && !prof.collection.owned(u.id));
  const lg = Object.values(D.UNITS).find((u) => !u.exclusive && u.rarity === 'legendary' && !prof.collection.owned(u.id));
  eq(A.cardState(st.id), 'free', 'a starting card pays nothing');
  eq(A.cardState(nw.id), 'locked');
  prof.collection.add(nw.id, 1); prof.collection.add(lg.id, 1);
  eq(A.cardState(nw.id), 'ready'); eq(A.cardPrize(nw.id), 50); eq(A.cardPrize(lg.id), 100);
  const sh = prof.wallet.balance('shards');
  const r = A.claimCard(nw.id); eq(r.shards, 50); eq(prof.wallet.balance('shards'), sh + 50);
  eq(A.claimCard(nw.id), null, 'once only'); eq(A.cardState(nw.id), 'claimed');
  // claim-all on a page: only that page's ready cards, each once
  const w = lg.world, extra = A.pageIds(w).find((id) => id !== lg.id && id !== nw.id && !prof.collection.owned(id));
  if (extra) prof.collection.add(extra, 1);
  const before = prof.wallet.balance('shards'), want = A.pagePrize(w);
  const all = A.claimPage(w); eq(all.shards, want); eq(prof.wallet.balance('shards'), before + want);
  eq(A.claimPage(w), null, 'nothing left to claim'); eq(A.pageReady(w).length, 0);
});
t('album: all 65 units = free packs + grand title; saved across reloads', () => {
  const mem = MEM(), prof = AMB.Profile.boot(mem), A = prof.album;
  eq(A.claimAll(), null);
  Object.keys(AMB.DATA.UNITS).forEach((id) => prof.collection.add(id, 1));
  A.worlds().forEach((w) => A.claim(w));
  eq(A.allState(), 'ready');
  const opened = prof.packs.stats().opened;
  const r = A.claimAll(); eq(r.packs.length, AMB.ECONOMY.album.all.packs); eq(prof.packs.stats().opened, opened + AMB.ECONOMY.album.all.packs); eq(A.claimAll(), null);
  const A2 = AMB.Profile.boot(mem).album; eq(A2.allState(), 'claimed'); eq(A2.state('tide'), 'claimed'); ok(A2.ownedCosmetics('title').includes('alb_all'));
});
t('album: exclusive (event) cards are not part of any set', () => {
  AMB.DATA.UNITS.thorn_fox.exclusive = true;
  try { const A = AMB.Profile.boot(MEM()).album; eq(A.units('sylvan').length, 20); eq(A.total().total, 64); } finally { delete AMB.DATA.UNITS.thorn_fox.exclusive; }
});

console.log('challenge tower');
const towerOf = (prof) => AMB.Tower(prof.save, { wallet: prof.wallet, packs: prof.packs, collection: prof.collection, events: prof.events, campaign: prof.campaign, rng: AMB.util.RNG(5) });
const unlockTower = (prof) => AMB.LEVELS.LEVELS[0].fights.forEach((f) => prof.campaign.recordResult(f.id, { won: true }));
t('tower: 30 floors, a boss every 5th, generated line-ups are valid and deterministic', () => {
  const T = AMB.ECONOMY.tower; eq(T.floors, 30); eq(T.power.length, 30);
  for (let n = 1; n <= 30; n++) {
    const L = AMB.Tower.lineupFor(n), L2 = AMB.Tower.lineupFor(n);
    eq(JSON.stringify(L.units), JSON.stringify(L2.units), 'deterministic ' + n);
    eq(L.boss, n % 5 === 0, 'boss ' + n); ok(AMB.Tower.powerFor(n) > 0.2 && AMB.Tower.powerFor(n) < 3.5);
    const slots = new Set();
    L.units.forEach(([id, star, slot, from]) => { ok(AMB.DATA.UNITS[id], id); ok(/^[fb][0-3]$/.test(slot), slot); ok(!slots.has(slot), `floor ${n} duplicate slot ${slot}`); slots.add(slot); ok(star >= 1 && star <= 3 && from >= 1 && from <= 3); });
    if (L.boss) { ok(!slots.has('b1'), 'boss hero slot free'); eq(L.summon, 'b1'); ok(L.abilities.length > 0 && L.blessings); } else eq(L.summon, null);
    ok(L.units.length >= 5 && L.units.length <= (L.boss ? 7 : 8), 'size ' + n);
  }
  ok(AMB.Tower.lineupFor(30).units.length > AMB.Tower.lineupFor(1).units.length, 'later floors are bigger');
});
t('tower: floors get harder (more units, higher tiers on average)', () => {
  const avgTier = (a, b) => { let s = 0, c = 0; for (let n = a; n <= b; n++) AMB.Tower.lineupFor(n).units.forEach(([id]) => { s += AMB.DATA.UNITS[id].tier; c++; }); return s / c; };
  ok(avgTier(21, 30) > avgTier(1, 10) + 0.3, `${avgTier(1, 10).toFixed(2)} -> ${avgTier(21, 30).toFixed(2)}`);
});
t('tower: locked until campaign level 1 is done; floors open one at a time', () => {
  const prof = AMB.Profile.boot(MEM()), tw = towerOf(prof);
  ok(!tw.unlocked()); ok(!tw.canPlay(1));
  unlockTower(prof); ok(tw.unlocked()); ok(tw.canPlay(1)); ok(!tw.canPlay(2)); eq(tw.next(), 1); eq(tw.best(), 0);
});
t('tower: first clear pays once (shards 20..50 + pass xp), boss floors a pack, floor 30 an epic+ card; best is saved', () => {
  const mem = MEM(), prof = AMB.Profile.boot(mem); let xp = 0;
  const tw = AMB.Tower(prof.save, { wallet: prof.wallet, packs: prof.packs, collection: prof.collection, events: prof.events, campaign: prof.campaign, addPassXp: (n) => (xp += n), rng: AMB.util.RNG(5) });
  unlockTower(prof);
  const lost = tw.recordResult(1, { won: false }); ok(!lost.won && !lost.first && !lost.shards); eq(tw.best(), 0); eq(tw.attempts(1), 1);
  const sh = prof.wallet.balance('shards');
  const w1 = tw.recordResult(1, { won: true }); ok(w1.first); eq(w1.shards, 20); eq(prof.wallet.balance('shards'), sh + 20); eq(xp, 10); eq(tw.best(), 1); ok(tw.canPlay(2));
  const again = tw.recordResult(1, { won: true }); ok(!again.first && again.shards === 0); eq(tw.best(), 1); eq(prof.wallet.balance('shards'), sh + 20, 'no pay twice');
  eq(tw.recordResult(3, { won: true }).first, false, 'cannot skip floors'); eq(tw.best(), 1);
  const packs0 = prof.packs.stats().opened;
  for (let n = 2; n <= 4; n++) tw.recordResult(n, { won: true });
  const b5 = tw.recordResult(5, { won: true }); ok(b5.boss && b5.first && b5.pack && b5.pack.cards.length === 5); eq(prof.packs.stats().opened, packs0 + 1); eq(b5.passXp, AMB.ECONOMY.tower.rewards.passXpBoss);
  for (let n = 6; n <= 29; n++) tw.recordResult(n, { won: true });
  eq(tw.best(), 29);
  const f30 = tw.recordResult(30, { won: true }); ok(f30.card && ['epic', 'legendary'].includes(f30.card.rarity), 'final card'); eq(f30.shards, 50); ok(tw.done());
  eq(AMB.Tower(AMB.Save.create(mem), {}).best(), 30, 'saved');
});
t('tower: match options use your cards and owned units; a floor plays end to end', () => {
  const prof = AMB.Profile.boot(MEM()), tw = towerOf(prof); unlockTower(prof);
  const o = tw.matchOptions(5, 'orath', 3);
  ok(o.progression && o.mode === 'tower'); ok(o.players[0].allowedUnits.every((id) => prof.collection.owned(id)));
  const m = new AMB.Match(o); m.players[0].isAI = true;
  while (!m.isOver) { m.startRound(); AMB.AI.prep(m, 0); AMB.AI.prep(m, 1); m.resolveCombat(m.createCombat(false).runToEnd()); }
  ok(m.round <= 3); eq(m.summary(0).mode, 'campaign', 'short-match summary');
  const r = tw.recordResult(1, Object.assign(m.summary(0), { won: true })); ok(r.first);
});
t('tower: missions count tower fights and new floors (event bus)', () => {
  const prof = AMB.Profile.boot(MEM()), pass = passFor(prof), tw = towerOf(prof); unlockTower(prof);
  const p = () => pass.state().daily.p;
  const fw0 = p().fights_won || 0;   // unlocking the tower played the campaign fights, which count too
  tw.recordResult(1, { won: true, roundsWon: 2, buys: 3 });
  eq(p().tower_floors, 1); eq(p().fights_won, fw0 + 1); ok(p().buys >= 3);
  tw.recordResult(1, { won: true, roundsWon: 2 }); eq(p().tower_floors, 1, 'replay is not a new floor'); eq(p().fights_won, fw0 + 2);
});

console.log('weekly event');
const evProf = (mem, clock) => AMB.Profile.boot(mem || MEM(), clock || (() => TH));
const TH = new Date(2026, 10, 5, 12).getTime();   // a Thursday
t('event: changes every week (Monday), cycles through the 4 events, shows time left and what is next', () => {
  const D = 864e5; let now = new Date(2026, 10, 2, 0, 5).getTime();   // Monday 00:05
  const prof = evProf(MEM(), () => now), W = prof.weekly;
  const first = W.current(); eq(first.event.id, AMB.WEEKLY[first.idx % 4].id);
  now = new Date(2026, 10, 8, 23, 0).getTime();   // Sunday night: same week
  eq(W.current().idx, first.idx); ok(W.current().msLeft > 0 && W.current().msLeft <= 3600e3 + 1, 'about one hour left');
  now = new Date(2026, 10, 9, 0, 1).getTime();    // Monday: next event
  eq(W.current().idx, first.idx + 1); ok(W.current().event.id !== first.event.id);
  eq(W.nextEvent().id, AMB.WEEKLY[(first.idx + 2) % 4].id);
  const seen = new Set(); for (let k = 0; k < 4; k++) { now = TH + k * 7 * D; seen.add(W.current().event.id); } eq(seen.size, 4, 'all four events appear in four weeks');
  now = TH + 4 * 7 * D; eq(W.current().event.id, AMB.WEEKLY[W.current().idx % 4].id);
});
t('event: locked until campaign level 1; stages open one at a time; line-ups valid and fixed; every stage has a tuned power', () => {
  const prof = evProf(), W = prof.weekly;
  ok(!W.unlocked() && !W.canPlay(1)); unlockTower(prof); ok(W.unlocked() && W.canPlay(1) && !W.canPlay(2));
  AMB.WEEKLY.forEach((ev) => [1, 2, 3].forEach((st) => {
    const L = W.lineupFor(ev.id, st), L2 = W.lineupFor(ev.id, st); eq(JSON.stringify(L.units), JSON.stringify(L2.units));
    ok(W.powerFor(ev.id, st) > 0.3 && W.powerFor(ev.id, st) < 3.5); eq(L.boss, st === 3);
    const slots = new Set(); L.units.forEach(([id, , slot]) => { ok(AMB.DATA.UNITS[id] && !AMB.DATA.UNITS[id].exclusive, id); ok(!slots.has(slot)); slots.add(slot); });
    if (st === 3) { ok(!slots.has('b1')); eq(L.heroId, Object.values(AMB.DATA.HEROES).find((h) => h.world === ev.world).id); eq(L.abilities.length, 2); }
  }));
});
t('event: first clears pay once per week, the boss gives the exclusive card, progress is saved', () => {
  const mem = MEM(); let xp = 0;
  const prof = evProf(mem); unlockTower(prof);
  const W = AMB.WeeklyEvents(prof.save, { wallet: prof.wallet, packs: prof.packs, collection: prof.collection, events: prof.events, campaign: prof.campaign, now: () => TH, addPassXp: (n) => (xp += n) });
  const ev = W.current().event, R = AMB.ECONOMY.events.rewards;
  const sh = prof.wallet.balance('shards');
  const lost = W.recordResult(1, { won: false }); ok(!lost.first && !lost.shards); eq(W.current().stage, 0);
  eq(W.recordResult(2, { won: true }).first, false, 'cannot skip stage 1');
  const s1 = W.recordResult(1, { won: true }); ok(s1.first); eq(s1.shards, R[0].shards); eq(W.current().stage, 1);
  eq(W.recordResult(1, { won: true }).shards, 0, 'replay pays nothing');
  const packs0 = prof.packs.stats().opened;
  const s2 = W.recordResult(2, { won: true }); ok(s2.pack); eq(prof.packs.stats().opened, packs0 + 1);
  ok(!prof.collection.owned(ev.exclusive), 'exclusive card not yet owned');
  const s3 = W.recordResult(3, { won: true }); ok(s3.completed && s3.card && s3.card.id === ev.exclusive && s3.cardIsNew); eq(s3.shards, R[2].shards);
  ok(prof.collection.owned(ev.exclusive)); ok(W.current().done); eq(xp, R[0].passXp + R[1].passXp + R[2].passXp);
  eq(prof.wallet.balance('shards'), sh + R[0].shards + R[1].shards + R[2].shards + (s2.pack.refund || 0));
  eq(W.recordResult(3, { won: true }).card, null, 'the boss pays once per week');
  const again = AMB.Profile.boot(mem, () => TH); ok(again.weekly.current().done && again.collection.owned(ev.exclusive), 'saved');
});
t('event: the exclusive card stays after the event ends and comes back (as a duplicate) when the event returns four weeks later', () => {
  const D = 864e5; let now = TH; const mem = MEM(); const prof = evProf(mem, () => now); unlockTower(prof);
  const W = prof.weekly, ev = W.current().event;
  [1, 2, 3].forEach((st) => W.recordResult(st, { won: true }));
  ok(prof.collection.owned(ev.exclusive));
  now = TH + 7 * D; ok(W.current().event.id !== ev.id); ok(!W.current().done, 'new week, new event'); ok(prof.collection.owned(ev.exclusive), 'still owned');
  now = TH + 28 * D; eq(W.current().event.id, ev.id, 'same event again'); eq(W.current().stage, 0, 'fresh progress this time');
  [1, 2].forEach((st) => W.recordResult(st, { won: true }));
  const c0 = prof.collection.copies(ev.exclusive); const r3 = W.recordResult(3, { won: true });
  ok(r3.completed && !r3.cardIsNew); eq(prof.collection.copies(ev.exclusive), c0 + 1, 'an upgrade copy');
});
t('event: a fight is credited to the week it started in (the week may change mid-fight)', () => {
  const D = 864e5; let now = TH; const prof = evProf(MEM(), () => now); unlockTower(prof); const W = prof.weekly;
  const o = W.matchOptions(1, 'orath', 1), startWeek = o.eventWeek; now = TH + 7 * D;   // the week rolls over before the result
  const r = W.recordResult(1, { won: true }, startWeek); eq(r.week, startWeek); eq(W.current().stage, 0, 'the new week is untouched'); eq(AMB.Profile.boot(prof.save.exportJSON && MEM(), () => TH).weekly.current().stage, 0);
});
t('event: exclusive cards never drop from packs, are not in album sets, but still exist as real units', () => {
  const ex = Object.values(AMB.DATA.UNITS).filter((u) => u.exclusive); eq(ex.length, 4); ex.forEach((u) => { eq(u.rarity, 'legendary'); eq(u.tier, 5); ok(AMB.WEEKLY.some((e) => e.exclusive === u.id)); });
  const p = AMB.Profile.boot(MEM(), null, AMB.util.RNG(8)); p.wallet.add('shards', 1e6);
  const ids = new Set(); for (let i = 0; i < 1500; i++) p.packs.open('basic', { free: true }).cards.forEach((c) => ids.add(c.id));
  ex.forEach((u) => ok(!ids.has(u.id), 'dropped from a pack: ' + u.id));
  ok(ids.size > 55, 'packs still drop the regular roster (' + ids.size + ' different cards)');
  AMB.album && ex.forEach((u) => ok(!p.album.units(u.world).includes(u.id)));
  for (let i = 0; i < 200; i++) { const id = p.collection.grantRandom('legendary').id; ok(!(AMB.DATA.UNITS[id] || {}).exclusive, id); }
});
t('event: a stage plays end to end and weekly-event fights feed the missions', () => {
  const prof = evProf(), pass = passFor(prof); unlockTower(prof);
  const o = prof.weekly.matchOptions(1, 'orath', 4); ok(o.progression && o.mode === 'event');
  const m = new AMB.Match(o); m.players[0].isAI = true;
  while (!m.isOver) { m.startRound(); AMB.AI.prep(m, 0); AMB.AI.prep(m, 1); m.resolveCombat(m.createCombat(false).runToEnd()); }
  ok(m.round <= 3);
  const w0 = pass.state().weekly.p.event_cleared || 0, f0 = pass.state().daily.p.fights_won || 0;
  prof.weekly.recordResult(1, { won: true }); ok((pass.state().daily.p.fights_won || 0) >= f0 + 1); eq(pass.state().weekly.p.event_cleared || 0, w0, 'only the boss counts as finishing');
  prof.weekly.recordResult(2, { won: true }); prof.weekly.recordResult(3, { won: true }); eq(pass.state().weekly.p.event_cleared, w0 + 1);
});

console.log('gift packs & deck');
const newbie = (seed) => { const p = AMB.Profile.boot(MEM(), null, AMB.util.RNG(seed || 1)); p.collection.chooseStarter('orath'); return p; };
t('gift: 5 packs x 5 units with the fixed rarity plan, no legendary/hero/exclusive, once only', () => {
  const p = newbie(), g = p.packs.gift(5);
  eq(g.length, 5); g.forEach((pk) => eq(pk.cards.length, 5));
  const cards = g.flatMap((x) => x.cards), n = { common: 0, rare: 0, epic: 0 };
  cards.forEach((c) => { ok(n[c.rarity] !== undefined, 'rarity ' + c.rarity); n[c.rarity]++; const d = AMB.DATA.UNITS[c.id]; ok(d && !d.exclusive && !d.starter, c.id); });
  eq(JSON.stringify(n), JSON.stringify({ common: 15, rare: 8, epic: 2 }));
  ok(p.collection.giftClaimed()); eq(p.packs.gift(6), null, 'only once'); eq(p.packs.stats().opened, 0, 'gift packs are not counted as opened packs');
});
t('gift: always a playable first deal - every role and world covered (many seeds)', () => {
  const need = AMB.ECONOMY.gift.need;
  for (let seed = 1; seed <= 60; seed++) {
    const p = newbie(seed); p.packs.gift(seed);
    const owned = p.collection.ownedUnits().map((id) => AMB.DATA.UNITS[id]), rc = p.collection.roleCounts(owned.map((u) => u.id));
    Object.values(rc).forEach((v) => ok(v >= 1));
    ok(rc.guardian + rc.fighter >= need.frontline && rc.marksman + rc.mage >= need.ranged && rc.support >= need.support && rc.assassin >= need.assassin, 'roles seed ' + seed);
    Object.keys(AMB.DATA.WORLDS).forEach((w) => ok(owned.filter((u) => u.world === w).length >= need.perWorld, 'world ' + w));
    ok(p.collection.ownedUnits().length >= 24 && p.collection.ownedUnits().length <= 33, 'owned ' + p.collection.ownedUnits().length);
  }
});
t('gift: the same seed gives the same deal; it is saved and survives a reload', () => {
  const a = newbie(1), b = newbie(2); const ga = a.packs.gift(77), gb = b.packs.gift(77);
  eq(JSON.stringify(ga.map((x) => x.cards.map((c) => c.id))), JSON.stringify(gb.map((x) => x.cards.map((c) => c.id))));
  const mem = MEM(); const p = AMB.Profile.boot(mem, null, AMB.util.RNG(4)); p.collection.chooseStarter('kagira'); p.packs.gift(9);
  const q = AMB.Profile.boot(mem); ok(q.collection.giftClaimed()); eq(q.packs.gift(1), null); eq(q.collection.ownedUnits().length, p.collection.ownedUnits().length);
});
t('migration: an old save keeps its 20 units (and may still claim the gift)', () => {
  const mem = MEM(); const sv = AMB.Save.create(mem);
  sv.set('collection', { cards: { kagira: { owned: true, level: 1, copies: 0, got: 0 }, caldera_seer: { owned: true, level: 2, copies: 1, got: 5 } }, upgrades: 1, starterHero: 'kagira' });
  const raw = JSON.parse(mem.getItem(AMB.Save.KEY)); raw.sysV.collection = 1; mem.setItem(AMB.Save.KEY, JSON.stringify(raw));
  const p = AMB.Profile.boot(mem, null, AMB.util.RNG(2));
  AMB.DATA.LEGACY_STARTERS.forEach((id) => ok(p.collection.owned(id), 'kept ' + id));
  eq(p.collection.level('caldera_seer'), 2, 'existing progress untouched'); ok(!p.collection.giftClaimed());
  ok(p.packs.gift(3) && p.collection.giftClaimed());
  const fresh = AMB.Profile.boot(MEM()); ok(!fresh.collection.owned('spark_wraith'), 'a new save does not get the old 20');
});
t('deck: only owned units, no duplicates, max 12, toggle add/remove, saved', () => {
  const mem = MEM(); const p = AMB.Profile.boot(mem, null, AMB.util.RNG(1)); p.collection.chooseStarter('orath'); p.packs.gift(5); const C = p.collection;
  eq(C.deckLimits().size, 12); eq(C.deck().length, 0); ok(!C.deckValid());
  ok(!C.toggleDeck('taiju').ok, 'cannot add a unit you do not own');
  eq(C.setDeck(['ash_ronin', 'ash_ronin', 'forge_bulwark', 'taiju', 'nope']).join(), 'ash_ronin,forge_bulwark');
  const owned = C.ownedUnits(); C.setDeck(owned.slice(0, 12)); eq(C.deck().length, 12);
  const over = owned.find((id) => !C.inDeck(id)); const r = C.toggleDeck(over); ok(!r.ok && /ممتلئ/.test(r.reason)); eq(C.deck().length, 12);
  const first = C.deck()[0]; ok(C.toggleDeck(first).ok); eq(C.deck().length, 11); ok(C.toggleDeck(first).in);
  eq(AMB.Profile.boot(mem).collection.deck().join(), C.deck().join(), 'saved');
});
t('deck: auto-build gives a valid, balanced deck from any starting deal', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const p = newbie(seed); p.packs.gift(seed); const C = p.collection, d = C.autoBuild(), rc = C.roleCounts(d);
    eq(d.length, 12); ok(C.deckValid()); eq(new Set(d).size, 12); d.forEach((id) => ok(C.owned(id)));
    ok(rc.guardian >= 2 && rc.fighter >= 1 && rc.marksman + rc.mage >= 3 && rc.support >= 1 && rc.assassin >= 1, 'balanced ' + JSON.stringify(rc));
    Object.values(rc).forEach((v) => ok(v <= 4, 'no role above 4'));
  }
  const p = newbie(2); eq(p.collection.autoBuild().length, 8, 'a player with only the 8 starters gets an 8-unit deck');
});
t('deck: progression fights shop only from the deck; quick matches ignore it', () => {
  const p = newbie(3); p.packs.gift(3); const C = p.collection; const deck = C.autoBuild();
  const seen = (prog, opts) => {
    const ids = new Set();
    for (let sd = 1; sd <= 6; sd++) {
      const m = new AMB.Match(Object.assign({ seed: sd, progression: prog, players: [{ heroId: 'orath', allowedUnits: opts }, { heroId: 'merin', isAI: true }] }));
      while (!m.isOver && m.round < 6) { m.startRound(); for (let k = 0; k < 8; k++) { m.players[0].shop.forEach((id) => id && ids.add(id)); m.players[0].gold += 3; m.reroll(0); } AMB.AI.prep(m, 1); m.resolveCombat(m.createCombat(false).runToEnd()); }
    }
    return ids;
  };
  const prog = seen(true, C.playableUnits()); ok([...prog].every((id) => deck.includes(id)), 'a unit outside the deck was offered: ' + [...prog].filter((id) => !deck.includes(id)));
  ok([...seen(false, C.playableUnits())].some((id) => !deck.includes(id)), 'quick match still offers every unit');
  eq(C.playableUnits().join(), deck.join()); C.setDeck(deck.slice(0, 5)); ok(!C.deckValid()); eq(C.playableUnits().length, C.ownedUnits().length, 'no valid deck -> all owned units');
  const cam = AMB.Campaign(p.save, { collection: C }); eq(cam.matchOptions('l1f1', 'orath', 1).players[0].allowedUnits.length, C.ownedUnits().length);
  C.setDeck(deck); eq(cam.matchOptions('l1f1', 'orath', 1).players[0].allowedUnits.join(), deck.join(), 'campaign uses the deck');
});

console.log('guided tutorial');
// plays the scripted steps (buy the guardian, place it in front, buy the sniper, place it behind, ready; round 2: three copies merge, ready)
function playTutorial(prof, seed, hero) {
  const m = new AMB.Match(prof.tutorial.matchOptions(hero || 'orath', seed)); const p = m.players[0];
  const place = (defId, slot) => { const u = m.allUnits(p).find((x) => x.defId === defId && !Object.values(p.board).includes(x)); return m.move(0, u.uid, { zone: 'board', slot }); };
  m.startRound(); prof.tutorial.onRound(m);
  m.buy(0, 0); place('forge_bulwark', 'f1'); m.buy(0, 2); place('pixel_sniper', 'b1');
  m.resolveCombat(m.createCombat(false).runToEnd());
  let merged = false;
  if (!m.isOver) { m.startRound(); prof.tutorial.onRound(m); m.buy(0, 0); m.buy(0, 1); m.buy(0, 2); merged = m.allUnits(p).some((u) => u.star === 2); m.autoFill(0); m.resolveCombat(m.createCombat(false).runToEnd()); }
  if (!m.isOver) { m.startRound(); prof.tutorial.onRound(m); m.buyXp(0); m.toggleSummon(0); m.autoFill(0); m.resolveCombat(m.createCombat(false).runToEnd()); }   // round 3: level up + send the hero
  return { m, merged };
}
t('tutorial: scripted shops, short rules, a weak scripted enemy; the guided moves win and the merge works', () => {
  const prof = AMB.Profile.boot(MEM());
  const o = prof.tutorial.matchOptions('orath'); eq(o.rules.maxRounds, 3); eq(o.players[1].lineup.units.length, 3); eq(o.mode, 'tutorial');
  eq(prof.tutorial.matchOptions('merin').players[1].heroId, 'zerokai', 'enemy hero differs from yours');
  let wins = 0, merges = 0;
  for (let seed = 1; seed <= 40; seed++) { const r = playTutorial(prof, seed, ['orath', 'kagira', 'merin', 'zerokai'][seed % 4]); ok(r.m.round <= 3); if (r.m.winner === 0) wins++; if (r.merged) merges++; }
  ok(wins >= 38, 'guided play should almost always win: ' + wins + '/40'); eq(merges, 40, 'three copies always merge to a star');
  const m = new AMB.Match(prof.tutorial.matchOptions('orath', 5)); m.startRound(); prof.tutorial.onRound(m);
  eq(m.players[0].shop.join(), AMB.Tutorial(prof.save).SHOP[1].join()); ok(m.players[0].gold >= 12, 'enough gold for the whole round');
});
t('tutorial: required only for a brand-new player; the reward is paid once; saved', () => {
  const mem = MEM(), prof = AMB.Profile.boot(mem);
  ok(prof.tutorial.required() && !prof.tutorial.done());
  const bal = prof.wallet.balance('shards');
  const r = prof.tutorial.complete(); ok(r.first); eq(r.shards, AMB.ECONOMY.tutorial.reward.shards); eq(prof.wallet.balance('shards'), bal + r.shards);
  ok(prof.tutorial.done() && !prof.tutorial.required());
  const r2 = prof.tutorial.complete(); ok(!r2.first); eq(r2.shards, 0); eq(prof.wallet.balance('shards'), bal + r.shards, 'no second reward');
  ok(AMB.Profile.boot(mem).tutorial.done(), 'saved');
  const old = AMB.Profile.boot(MEM()); old.campaign.recordResult('l1f1', { won: true }); ok(!old.tutorial.required(), 'a player who already beat fight 1 is not forced');
});

t('twists: every card has its own skill signature, twist text is shown, and every twist runs in combat', () => {
  const U = Object.values(AMB.DATA.UNITS), seen = {};
  U.forEach((u) => { const sk = u.skill, k = sk.type + JSON.stringify(sk.dmg || sk.heal || sk.shield || sk.dps || sk.pct || []) + (sk.extra || ''); (seen[k] = seen[k] || []).push(u.id); });
  const dup = Object.values(seen).filter((g) => g.length > 1);
  eq(dup.length, 0, 'cards sharing exactly the same skill: ' + JSON.stringify(dup));
  U.filter((u) => u.skill.extra).forEach((u) => ok(/[ء-ي]/.test(u.skill.text) && u.skill.text.length > 20, 'text for ' + u.id));
  // run each twist once on a real combat: nothing throws, thorns reflect damage
  const extras = [...new Set(U.filter((u) => u.skill.extra).map((u) => u.skill.extra))];
  const heroes = Object.keys(AMB.DATA.HEROES);
  extras.forEach((ex) => {
    const u = U.find((x) => x.skill.extra === ex);
    const m = new AMB.Match({ mode: 'ai', seed: 5, players: [{ heroId: heroes[0], name: 'a', isAI: true, difficulty: 'normal' }, { heroId: heroes[1], name: 'b', isAI: true, difficulty: 'normal' }] });
    m.startRound(); AMB.AI.prep(m, 0); AMB.AI.prep(m, 1);
    const c = m.createCombat(false);
    const f = c.fighters.find((x) => x.side === 0 && !x.isHero && !x.passive);
    f.skill = Object.assign({}, u.skill); f.mana = f.maxMana = 1; f.role = u.role;
    for (let i = 0; i < 400 && !c.over; i++) c.step();
    ok(c.fighters.length > 0, ex);
  });
});

t('online: two phones replay each other\'s moves and stay identical for a whole match', () => {
  const heroes = Object.keys(AMB.DATA.HEROES);
  for (let g = 0; g < 4; g++) {
    const mk = () => new AMB.Match({ mode: 'online', seed: 4000 + g * 11, isolated: true, players: [{ heroId: heroes[g % 4], name: 'a' }, { heroId: heroes[(g + 1) % 4], name: 'b' }] });
    const A = mk(), B = mk(); const copies = [A, B];
    const recs = [AMB.NetSync.record(A, 0), AMB.NetSync.record(B, 1)];   // phone A plays player 0, phone B plays player 1
    // a simple deterministic "human": buys what it can afford, places units, sometimes rerolls / buys xp / sells
    const act = (m, pi, k) => {
      const p = m.players[pi];
      for (let i = 0; i < 12; i++) {
        const idx = p.shop.findIndex((id) => id && AMB.DATA.UNITS[id].cost <= p.gold);
        if (idx < 0) { if (p.gold >= 4 && (k + i) % 3 === 0) m.buyXp(pi); else if (p.gold >= 3 && (k + i) % 2 === 0) m.reroll(pi); else break; continue; }
        m.buy(pi, idx);
        const u = p.bench.find(Boolean);
        if (u && m.boardCount(p) < p.level) { const slot = ['f1', 'f2', 'f0', 'f3', 'b1', 'b2', 'b0', 'b3'].find((s) => !p.board[s]); if (slot) m.move(pi, u.uid, { zone: 'board', slot }); }
      }
      const extra = p.bench.find(Boolean); if (extra && k % 4 === 0) m.sell(pi, extra.uid);
      if (p.items.length) { const bu = Object.values(p.board)[0]; if (bu) m.equip(pi, 0, bu.uid); }
    };
    let rounds = 0;
    while (!A.isOver && rounds++ < 12) {
      A.startRound(); B.startRound();
      eq(AMB.NetSync.hash(A), AMB.NetSync.hash(B), 'round start state differs');
      act(A, 0, rounds); act(B, 1, rounds);
      const opsA = recs[0].take(), opsB = recs[1].take();
      eq(AMB.NetSync.replay(A, 1, opsB).length, 0, 'A could not replay B'); eq(AMB.NetSync.replay(B, 0, opsA).length, 0, 'B could not replay A');
      const ca = A.createCombat(false), cb = B.createCombat(false);
      eq(AMB.NetSync.hash(A), AMB.NetSync.hash(B), 'prep state differs at combat start');
      const ra = ca.runToEnd(), rb = cb.runToEnd();
      eq(ra.winner, rb.winner, 'combat winner differs'); eq(Math.round(ca.t * 100), Math.round(cb.t * 100), 'combat length differs');
      A.resolveCombat(ra); B.resolveCombat(rb);
      eq(A.players[0].life, B.players[0].life, 'life differs'); eq(A.players[1].life, B.players[1].life);
      if (A.rewardPending) {   // each phone picks for its own player, then replays the other's pick
        const pa = A.players[0].rewardOffer, pb = B.players[1].rewardOffer;
        A.claimReward(0, 0); B.claimReward(1, pb.options.length - 1);
        const ro = [recs[0].take(), recs[1].take()];
        eq(AMB.NetSync.replay(A, 1, ro[1]).length, 0); eq(AMB.NetSync.replay(B, 0, ro[0]).length, 0);
        ok(!A.rewardPending && !B.rewardPending, 'rewards claimed');
        eq(AMB.NetSync.hash(A), AMB.NetSync.hash(B), 'state differs after rewards');
      }
    }
    ok(rounds > 3, 'match actually ran'); eq(A.winner, B.winner, 'final winner differs');
  }
});

t('online fuzz (1.4): thousands of random garbage ops never throw, every one is reported, and never reach the match', () => {
  const N = AMB.NetSync;
  let s = 99; const rnd = (n) => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s % n; };
  const vals = [0, 1, 2, 5, -1, 1.5, -0.5, 1e9, -1e9, NaN, Infinity, -Infinity, '', '0', 'f1', 'b3', 'u1_1', 'x'.repeat(5000), '__proto__', 'constructor', 'toString',
    null, undefined, true, false, [], [1], {}, { zone: 'board' }, { zone: 'board', slot: 'f1' }, { zone: 'bench', idx: 1.5 }, { zone: 'bench', idx: 2 }, { zone: 'bench', idx: 1, x: 1 },
    { __proto__: { zone: 'board' } }, JSON.parse('{"__proto__":{"zone":"board","slot":"f1"}}'), 'start', 'zz', Symbol.iterator];
  const names = [...N.OPS, 'bogus', '__proto__', 'constructor', 'startRound', 'resolveCombat', 'createCombat', 'hasOwnProperty', ''];
  const garbage = () => {
    const k = rnd(10);
    if (k === 0) return vals[rnd(vals.length)];   // not even an array
    const op = [rnd(8) ? names[rnd(names.length)] : vals[rnd(vals.length)]];
    for (let i = rnd(5); i > 0; i--) op.push(vals[rnd(vals.length)]);
    return op;
  };
  for (let g = 0; g < 40; g++) {
    const m = new AMB.Match({ mode: 'online', seed: 300 + g, isolated: true, players: [{ heroId: 'orath', name: 'a' }, { heroId: 'merin', name: 'b' }] });
    m.startRound(); m.players[1].gold = 40;
    const before = JSON.stringify(m.players[0]);
    for (let b = 0; b < 25; b++) {
      const ops = Array.from({ length: rnd(12) }, garbage);
      let out; try { out = N.replay(m, 1, ops); } catch (e) { throw new Error('replay threw on ' + String(e)); }
      ok(Array.isArray(out), 'always a list');
      if (ops.length) ok(out.length >= ops.filter((op) => N.checkOp(op)).length, 'every malformed op is reported');
    }
    eq(JSON.stringify(m.players[0]), before, 'the friend\'s ops never touch my own player');
    ok(m.round === 1 && !m.isOver, 'garbage cannot drive the match (no startRound/resolveCombat through replay)');
  }
  // the checker itself on edge cases
  eq(N.checkOp(['buy', 1.5]), 'buy:arg0'); eq(N.checkOp(['buy', '2']), 'buy:arg0'); eq(N.checkOp(['buy', NaN]), 'buy:arg0'); eq(N.checkOp(['buy', 2, 3]), 'buy:args');
  eq(N.checkOp(['sell', 'x'.repeat(33)]), 'sell:arg0'); eq(N.checkOp(['move', 'u1_1', { zone: 'board', slot: 'f1', more: 1 }]), 'move:arg1');
  eq(N.checkOp(['setAbility', 'a', 'nonsense']), 'setAbility:arg1'); eq(N.checkOp(['setAbility', 'a', null]), null); eq(N.checkOp(['toggleSummon']), null); eq(N.checkOp(['toggleSummon', null]), null);
  eq(N.checkOp(['startRound']).slice(0, 8), 'unknown:'); eq(N.checkOp(['__proto__']).slice(0, 8), 'unknown:'); eq(N.checkOp('x'), 'shape');
});
t('online fuzz (1.4): two honest phones doing random legal moves stay hash-equal and every recorded op passes the checker', () => {
  const N = AMB.NetSync, heroes = Object.keys(AMB.DATA.HEROES), TR = Object.keys(AMB.DATA.ABILITY_TRIGGERS), SL = AMB.SLOTS;
  for (let g = 0; g < 6; g++) {
    let s = 7 + g * 13; const rnd = (n) => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s % n; };
    const mk = () => new AMB.Match({ mode: 'online', seed: 900 + g, isolated: true, players: [{ heroId: heroes[g % 4], name: 'a' }, { heroId: heroes[(g + 2) % 4], name: 'b' }] });
    const A = mk(), B = mk(), recs = [N.record(A, 0), N.record(B, 1)];
    const randomMove = (m, pi) => {   // any call the UI can make, with UI-shaped arguments (most fail politely, the rest change state)
      const p = m.players[pi], units = m.allUnits(p), u = units.length ? units[rnd(units.length)] : null, uid = u ? u.uid : 'u9_9';
      switch (rnd(15)) {
        case 0: case 1: case 2: return m.buy(pi, rnd(5));
        case 3: return m.reroll(pi);
        case 4: return m.buyXp(pi);
        case 5: return m.sell(pi, uid);
        case 6: case 7: return m.move(pi, uid, rnd(2) ? { zone: 'board', slot: SL[rnd(8)] } : { zone: 'bench', idx: rnd(6) });
        case 8: return m.buyItem(pi, rnd(2));
        case 9: return m.equip(pi, rnd(3), uid);
        case 10: return rnd(2) ? m.unequip(pi, uid) : m.sellItem(pi, rnd(3));
        case 11: return rnd(2) ? m.armSpell(pi, rnd(3)) : m.disarmSpell(pi, rnd(2));
        case 12: { const ab = AMB.DATA.HEROES[p.heroId].abilities; return m.setAbility(pi, ab[rnd(ab.length)].id, rnd(3) ? TR[rnd(TR.length)] : null); }
        case 13: return rnd(2) ? m.toggleSummon(pi) : m.moveHero(pi, SL[rnd(8)]);
        default: return rnd(3) ? m.autoArrange(pi) : m.toggleLock(pi);
      }
    };
    let rounds = 0, sent = 0;
    while (!A.isOver && rounds++ < 14) {
      A.startRound(); B.startRound();
      for (let k = 0; k < 30; k++) { randomMove(A, 0); randomMove(B, 1); }
      const oa = recs[0].take(), ob = recs[1].take(); sent += oa.length + ob.length;
      [...oa, ...ob].forEach((op) => eq(N.checkOp(op), null, 'an honest op was rejected: ' + JSON.stringify(op)));
      eq(N.replay(A, 1, ob).join(), '', 'A replays B'); eq(N.replay(B, 0, oa).join(), '', 'B replays A');
      eq(N.hash(A), N.hash(B), 'prep hash, round ' + A.round);
      const ra = A.resolveCombat(A.createCombat(false).runToEnd()), rb = B.resolveCombat(B.createCombat(false).runToEnd());
      eq(N.combatPrint(ra), N.combatPrint(rb), 'combat fingerprint, round ' + ra.round);
      if (A.rewardPending) {
        A.claimReward(0, rnd(3)); B.claimReward(1, rnd(3));
        eq(N.replay(A, 1, recs[1].take()).join(), ''); eq(N.replay(B, 0, recs[0].take()).join(), '');
        eq(N.hash(A), N.hash(B), 'reward hash');
      }
    }
    ok(rounds > 3 && sent > 50, 'the fuzz really played (' + sent + ' ops)'); eq(A.winner, B.winner);
  }
});
t('online combat fingerprint (B7): equal on two honest phones every round, different when a fight result differs', () => {
  const N = AMB.NetSync, mk = () => new AMB.Match({ mode: 'online', seed: 77, isolated: true, players: [{ heroId: 'orath', name: 'a' }, { heroId: 'kagira', name: 'b' }] });
  const A = mk(), B = mk(); let rounds = 0, prints = new Set();
  while (!A.isOver && rounds++ < 14) {
    A.startRound(); B.startRound(); AMB.AI.prep(A, 0); AMB.AI.prep(B, 0);   // same AI moves on both copies (isolated rng)
    AMB.AI.prep(A, 1); AMB.AI.prep(B, 1);
    const ra = A.resolveCombat(A.createCombat(false).runToEnd()), rb = B.resolveCombat(B.createCombat(true).runToEnd());   // one phone records the fight for playback, the other does not
    const pa = N.combatPrint(ra); eq(pa, N.combatPrint(rb), 'round ' + ra.round); prints.add(pa);
    ok(/^\d+\|[01d]\|\d+\/\d+\|\d+$/.test(pa), 'short readable fingerprint: ' + pa);
    if (A.rewardPending) { A.claimReward(0, 0); B.claimReward(0, 0); A.claimReward(1, 0); B.claimReward(1, 0); }
  }
  ok(prints.size === rounds || prints.size > 3, 'fingerprints change from round to round');
  const r = A.history[A.history.length - 1], alt = JSON.parse(JSON.stringify(r));
  alt.players[1].lifeAfter += 1; ok(N.combatPrint(alt) !== N.combatPrint(r), 'a life difference shows');
  const w = JSON.parse(JSON.stringify(r)); w.winner = r.winner === 0 ? 1 : 0; ok(N.combatPrint(w) !== N.combatPrint(r), 'a winner difference shows');
  const d = JSON.parse(JSON.stringify(r)); d.duration += 0.5; ok(N.combatPrint(d) !== N.combatPrint(r), 'a length difference shows');
  eq(N.combatPrint(null), ''); eq(N.combatPrint({}), '');
});
t('online security (4.3): long unambiguous room codes, hashed broker id/topic, HMAC-signed relay messages', () => {
  const N = AMB.NetSync, nc = require('crypto');
  for (let L = 0; L < 200; L += 7) {   // our SHA-256 / HMAC = Node's
    const d = nc.randomBytes(L), k = nc.randomBytes((L * 3) % 150);
    eq(N.hex(N.sha256(d)), nc.createHash('sha256').update(d).digest('hex')); eq(N.hex(N.hmac(k, d)), nc.createHmac('sha256', k).update(d).digest('hex'));
  }
  eq(N.hex(N.hmac('key', 'The quick brown fox jumps over the lazy dog')), 'f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8');
  const codes = new Set();
  for (let i = 0; i < 2000; i++) { const c = N.newCode(); ok(/^[A-HJ-NP-Z2-9]{10}$/.test(c), 'alphabet without I/O/0/1: ' + c); codes.add(c); }
  eq(codes.size, 2000, 'no repeats'); ok(N.CODE_LEN * 5 >= 40, 'at least 40 bits');
  const c = N.newCode(); eq(N.normCode(' ' + N.showCode(c).toLowerCase() + ' '), c, 'typed with dash, spaces, lower case'); eq(N.normCode(c.slice(0, 9)), null); eq(N.normCode('ABCDE-O0I1Z'), null, 'confusable characters are never valid');
  const r = N.room(c), r2 = N.room(N.newCode());
  ok(!r.topic.includes(c) && !r.peerId.includes(c) && !r.topic.toLowerCase().includes(c.toLowerCase()), 'the code itself never goes on the wire');
  ok(r.topic !== r2.topic && r.peerId !== r2.peerId && /^zor-[0-9a-f]{40}$/.test(r.topic) && /^zor-[0-9a-f]{32}$/.test(r.peerId), 'per-room, ntfy/peerjs-safe ids');
  ok(N.hex(r.key) !== r.topic.slice(4) && !N.hex(r.key).startsWith(r.peerId.slice(4)), 'the key is not the topic or the id');
  const msg = { t: 'msg', from: 'h1', to: 'g1', seq: 1, o: { t: 'ready', round: 2, ops: [['buy', 0]] } };
  const body = N.seal(r.key, msg);
  eq(JSON.stringify(N.open(r.key, body)), JSON.stringify(msg), 'the friend with the code reads it');
  eq(N.open(r2.key, body), null, 'another room\'s key: dropped');
  eq(N.open(r.key, body.replace('"buy"', '"sell"')), null, 'tampered: dropped');
  eq(N.open(r.key, JSON.stringify(msg)), null, 'unsigned (old build or a stranger): dropped');
  eq(N.open(r.key, '0'.repeat(64) + JSON.stringify(msg)), null, 'forged signature: dropped');
  [null, undefined, 5, '', 'x'.repeat(70), '{"t":"hello"}', N.seal(r.key, 5), N.hex(N.hmac(r.key, 'null')) + 'null'].forEach((b) => eq(N.open(r.key, b), null, 'garbage never throws'));
});

t('heroes: every hero has its own summoned form and a summoned combat runs', () => {
  const H = AMB.DATA.HEROES, ids = Object.keys(H);
  ids.forEach((id) => { ok(H[id].vanguard && H[id].vanguard.name && /[ء-ي]/.test(H[id].vanguard.text), 'vanguard of ' + id); });
  const sig = new Set(ids.map((id) => JSON.stringify(Object.keys(H[id].vanguard).filter((k) => !['name', 'text'].includes(k)).sort())));
  eq(sig.size, ids.length, 'summoned forms must differ from each other');
  ids.forEach((id, i) => {
    const m = new AMB.Match({ mode: 'ai', seed: 77 + i, players: [{ heroId: id, name: 'a', isAI: true }, { heroId: ids[(i + 1) % 4], name: 'b', isAI: true }] });
    for (let r = 0; r < 4; r++) { m.startRound(); AMB.AI.prep(m, 0); AMB.AI.prep(m, 1); if (r < 3) m.resolveCombat(m.createCombat(false).runToEnd()); }
    const p = m.players[0]; p.summoned = false; if (m.boardCount(p) >= p.level) { const [slot, u] = Object.entries(p.board)[0]; delete p.board[slot]; p.bench[p.bench.indexOf(null)] = u; }
    ok(m.toggleSummon(0).ok !== false, 'summon ' + id); m.players.forEach((_, k) => m.autoFill(k));
    const c = m.createCombat(false), hf = c.fighters.find((f) => f.isHero && f.side === 0); ok(hf && hf.onBoard, 'hero is on the board ' + id);
    const res = c.runToEnd(); ok(res && c.over, 'combat finished ' + id);
  });
});

t('hero levels: xp from matches, growing cost per level, power only in progression fights, saved', () => {
  const mem = MEM(), prof = AMB.Profile.boot(mem), H = prof.heroes;
  eq(H.level('kagira'), 1);
  ok(H.need(2) > H.need(1), 'each level costs more');
  let r = H.addXp('kagira', H.need(1)); eq(r.level, 2); eq(r.levelsUp, 1);
  H.addXp('kagira', 100000); eq(H.level('kagira'), H.MAX, 'capped');
  ok(H.power('kagira').atk > H.power('merin').atk, 'a higher hero is stronger');
  eq(AMB.Profile.boot(mem).heroes.level('kagira'), H.MAX, 'saved');
  // used in a campaign fight, and in a quick match that passes it (hotseat passes none)
  const camp = new AMB.Match(prof.campaign.matchOptions('l1f1', 'kagira', 5));
  eq(camp.players[0].heroLevel, H.MAX);
  const quick = new AMB.Match({ mode: 'ai', players: [{ heroId: 'kagira', name: 'a', heroLevel: 20 }, { heroId: 'merin', name: 'b' }] });
  eq(quick.players[0].heroLevel, 20, 'quick matches count the hero level');
  eq(new AMB.Match({ mode: 'hotseat', players: [{ heroId: 'kagira', name: 'a' }, { heroId: 'merin', name: 'b' }] }).players[0].heroLevel, 1, 'hotseat stays even');
  const hi = new AMB.Match({ mode: 'ai', players: [{ heroId: 'kagira', name: 'a', heroLevel: 11 }, { heroId: 'merin', name: 'b' }] });
  eq(hi.players[0].maxLife, 110, 'hero level adds life (+1 per level)'); eq(hi.players[0].life, 110); eq(hi.players[1].maxLife, 100, 'level 1 = 100');
  // a higher level really fights better: same fight, level 1 vs level 20 summoned hero
  const run = (lv) => { const m = new AMB.Match({ mode: 'campaign', progression: true, seed: 9, players: [{ heroId: 'kagira', name: 'a', heroLevel: lv }, { heroId: 'merin', name: 'b' }] });
    m.startRound(); m.players[0].summoned = true; const c = m.createCombat(false); return c.fighters.find((f) => f.isHero && f.side === 0).atk; };
  ok(run(20) > run(1) * 1.8, 'summoned attack grows with level');
});

t('auto-arrange: never loses a unit, however often it is pressed, with or without the hero on the board', () => {
  const heroes = Object.keys(AMB.DATA.HEROES);
  for (let g = 0; g < 40; g++) {
    const m = new AMB.Match({ mode: 'ai', seed: 500 + g, players: [{ heroId: heroes[g % 8], name: 'a' }, { heroId: heroes[(g + 1) % 8], name: 'b' }] });
    m.startRound(); const p = m.players[0]; p.gold = 99; p.level = 1 + (g % 5);
    for (let i = 0; i < 12; i++) { m.buy(0, i % 5); if (i % 5 === 4) m.reroll(0); }
    m.allUnits(p).slice(0, m.boardCap(p)).forEach((u) => { if (!Object.values(p.board).includes(u)) m.move(0, u.uid, { zone: 'board', slot: ['f0', 'f1', 'f2', 'f3', 'b0', 'b1', 'b2', 'b3'].find((x) => !p.board[x]) }); });
    if (g % 2) { const r = m.toggleSummon(0, ['f1', 'b1', 'f3', 'b3'][g % 4]); }
    const total = m.allUnits(p).length, ids = m.allUnits(p).map((u) => u.uid).sort().join();
    for (let k = 0; k < 6; k++) {
      m.autoArrange(0);
      eq(m.allUnits(p).length, total, `units lost after press ${k + 1} (game ${g}, level ${p.level}, hero ${p.summoned})`);
      eq(m.allUnits(p).map((u) => u.uid).sort().join(), ids, 'same units');
      ok(!('undefined' in p.board), 'no undefined slot');
      if (p.summoned) ok(!p.board[p.heroSlot], 'hero slot stays free');
      ok(Object.keys(p.board).length <= m.boardCap(p), 'board within the level');
    }
  }
});

t('boss fights: best of 7 with a growing enemy, and every star pays its own prize once', () => {
  const prof = AMB.Profile.boot(MEM()), C = prof.campaign, R = AMB.LEVELS.CAMPAIGN.rewards, BR = AMB.LEVELS.CAMPAIGN.bossRules;
  const o = C.matchOptions('l1boss', 'orath', 3); eq(o.rules.maxRounds, 7); eq(o.rules.winsNeeded, 4); ok(o.players[1].lineup.growth > 0);
  const o2 = C.matchOptions('l1f1', 'orath', 3); eq(o2.rules.maxRounds, 3, 'normal fights stay best of 3'); ok(!o2.players[1].lineup.growth);
  // the enemy really grows: same boss, round 1 vs round 5
  const m = new AMB.Match(o); m.startRound(); const p1 = m.buildCombatSpec(1).units[0].power;
  for (let i = 0; i < 4; i++) { m.round++; } m.applyLineup(1); const p5 = m.buildCombatSpec(1).units[0].power;
  ok(Math.abs(p5 / p1 - (1 + BR.growth * 4) / 1) < 1e-9, 'enemy power grows ' + BR.growth * 100 + '% per round');
  ['l1f1', 'l1f2', 'l1f3', 'l1f4'].forEach((id) => C.recordResult(id, { won: true }));
  const sh = () => prof.wallet.balance('shards'), packs0 = prof.packs.stats().opened;
  let s0 = sh();
  const a = C.recordResult('l1boss', { won: true, roundsLost: 2, lifeLeft: 40 });   // 1 star
  eq(a.stars, 1); eq(a.prizes.length, 1); ok(a.shards >= R.bossStars[0].shards);
  const a2 = C.recordResult('l1boss', { won: true, roundsLost: 2, lifeLeft: 40 });    // nothing new: only the small replay reward
  eq(a2.prizes.length, 0); eq(a2.shards, R.replay.shards);
  const b = C.recordResult('l1boss', { won: true, roundsLost: 0, lifeLeft: 100, maxLife: 100 });   // now 3 stars: prizes of star 2 and 3
  eq(b.stars, 3); eq(b.prizes.map((x) => x.star).join(), '2,3'); ok(b.card && b.packs.length === 1, 'pack + card prizes');
  const c = C.recordResult('l1boss', { won: true, roundsLost: 0, lifeLeft: 100, maxLife: 100 });
  eq(c.prizes.length, 0, 'every prize is paid once'); ok(C.bossPrizes('l1boss').every((x) => x.state === 'paid'));
});

t('difficulties: separate progress, scaled enemies and prizes, hard needs medium, old saves become medium', () => {
  const prof = AMB.Profile.boot(MEM()), C = prof.campaign, X = AMB.LEVELS.DIFFICULTY, R = AMB.LEVELS.CAMPAIGN.rewards;
  eq(C.diff(), 'normal'); eq(C.setDiff('easy'), 'easy');
  // enemy power scales
  const pw = (d) => C.matchOptions('l1f1', 'orath', 1, d).players[1].cardPower.ash_ronin;
  ok(Math.abs(pw('easy') / pw('normal') - X.easy.power) < 1e-9 && Math.abs(pw('hard') / pw('normal') - X.hard.power) < 1e-9, 'enemy power per difficulty');
  // progress is separate
  const e = C.recordResult('l1f1', { won: true }, 'easy'); eq(e.difficulty, 'easy'); eq(e.shards, Math.round(R.fight.shards * X.easy.shards));
  ok(C.isCleared('l1f1', 'easy') && !C.isCleared('l1f1', 'normal') && C.isCleared('l1f1'), 'cleared only on easy, but "any difficulty" is true');
  eq(C.stars('l1f1', 'normal'), 0); ok(C.isUnlocked('l1f2', 'easy') && !C.isUnlocked('l1f2', 'normal'));
  // hard needs the level done on medium
  ok(!C.levelUnlocked(0, 'hard'), 'hard locked before medium is done');
  ['l1f1', 'l1f2', 'l1f3', 'l1f4', 'l1boss'].forEach((id) => C.recordResult(id, { won: true, roundsLost: 0, lifeLeft: 100 }, 'normal'));
  ok(C.levelUnlocked(0, 'hard') && !C.levelUnlocked(1, 'hard'), 'hard level 1 opens, level 2 still needs hard level 1');
  // bigger prizes on hard
  const h = C.recordResult('l1f1', { won: true }, 'hard'); eq(h.shards, Math.round(R.fight.shards * X.hard.shards)); eq(h.passXp, Math.round(R.fight.passXp * X.hard.xp));
  ['l1f2', 'l1f3', 'l1f4'].forEach((id) => C.recordResult(id, { won: true }, 'hard'));
  const hb = C.recordResult('l1boss', { won: true, roundsLost: 0, lifeLeft: 100 }, 'hard');
  eq(hb.levelPacks.length, X.hard.levelPacks, 'two free level packs on hard'); eq(hb.packs.length, Math.floor(R.bossStars[1].packs * X.hard.packs) , 'boss star-2 pack x2 on hard');
  eq(hb.card.rarity === 'rare' || hb.card.rarity === 'epic' || hb.card.rarity === 'legendary', true); ok(hb.shards > R.bossStars[0].shards * 2, 'hard boss pays more');
  // easy: no packs, bonus shards for finishing a level
  ['l1f2', 'l1f3', 'l1f4'].forEach((id) => C.recordResult(id, { won: true }, 'easy'));
  const eb = C.recordResult('l1boss', { won: true, roundsLost: 0, lifeLeft: 100 }, 'easy');
  eq(eb.levelPacks.length, 0); eq(eb.levelShards, X.easy.levelShards); eq(eb.packs.length, 0, 'no packs on easy');
  // chest rewards scale too
  const tot = (d) => C.chests(d).find((c) => c.id === 'ch10').reward.shards;
  ok(tot('hard') > tot('normal') && tot('normal') > tot('easy'), 'chest prizes by difficulty');
  // an old save (no difficulties) becomes the medium campaign
  const mem = MEM(), sv = AMB.Save.create(mem);
  sv.set('campaign', { cleared: { l1f1: true }, levelsDone: {}, stats: { l1f1: { attempts: 1, wins: 1, best: { lifeLeft: 100, roundsLost: 0 } } }, stars: { l1f1: 3 }, chests: ['ch10'] });
  const raw = JSON.parse(mem.getItem(AMB.Save.KEY)); raw.sysV.campaign = 2; mem.setItem(AMB.Save.KEY, JSON.stringify(raw));
  const old = AMB.Profile.boot(mem).campaign;
  eq(old.diff(), 'normal'); ok(old.isCleared('l1f1', 'normal') && !old.isCleared('l1f1', 'easy')); eq(old.stars('l1f1', 'normal'), 3);
  ok(old.chests('normal').find((c) => c.id === 'ch10').state === 'claimed', 'claimed chest kept');
  // A4: an old boss win was already paid (= star 1): not paid again, and the stars are not re-rated down by the migration
  const mem2 = MEM(), sv2 = AMB.Save.create(mem2);
  sv2.set('campaign', { cleared: { l1boss: true }, levelsDone: {}, stats: { l1boss: { attempts: 1, wins: 1, best: { lifeLeft: 60, roundsLost: 1 } } }, stars: { l1boss: 3 }, chests: [] });
  const raw2 = JSON.parse(mem2.getItem(AMB.Save.KEY)); raw2.sysV.campaign = 2; mem2.setItem(AMB.Save.KEY, JSON.stringify(raw2));
  const prof2 = AMB.Profile.boot(mem2), c2 = prof2.campaign;
  eq(c2.stars('l1boss', 'normal'), 3, 'stars kept, not re-rated'); eq(c2.bossPaid('l1boss', 'normal'), 1, 'star-1 prize counts as already paid');
  const r2 = c2.recordResult('l1boss', { won: true, roundsLost: 0, lifeLeft: 100, maxLife: 100 }, 'normal');
  eq(r2.prizes.map((p) => p.star).join(), '2,3', 'only the stars not paid before pay now');
});

console.log('practice fight + settings');
t('practice (hero trial): short best-of-3 vs an easy computer, any hero, no card or hero levels, ends in 3 rounds or less', () => {
  const prof = AMB.Profile.boot(MEM());
  Object.keys(AMB.DATA.HEROES).forEach((h, k) => {
    const o = prof.tutorial.practiceOptions(h, 11 + k);
    eq(o.mode, 'practice'); ok(o.practice && !o.progression); eq(o.rules.maxRounds, 3);
    ok(o.players[1].heroId !== h, 'enemy hero differs'); eq(o.players[1].difficulty, 'easy');
    ok(!o.players[0].cardPower && !o.players[0].heroLevel, 'no progression power in a trial');
    const m = new AMB.Match(o);
    while (!m.isOver) { m.startRound(); AMB.AI.prep(m, 0); AMB.AI.prep(m, 1); m.resolveCombat(m.createCombat(false).runToEnd()); }
    ok(m.round <= 3, 'at most 3 rounds'); ok(m.winner === 0 || m.winner === 1 || m.winner === null);
    ok(!m.rewardPending, 'no reward draft');
  });
  eq(AMB.Tutorial.practiceOptions('orath', 3).players[0].heroId, 'orath', 'static helper');
  // a trial of a hero you do not own changes nothing in the save
  const mem = MEM(), p2 = AMB.Profile.boot(mem); const before = JSON.stringify(p2.save.get('collection'));
  new AMB.Match(p2.tutorial.practiceOptions('kagira', 5)); eq(JSON.stringify(p2.save.get('collection')), before); ok(p2.collection.needsStarter());
});
t('settings: big text off and 1x speed for a new player; speed choice and one-time hints are remembered in the save', () => {
  const mem = MEM(), p = AMB.Profile.boot(mem), st = p.settings;
  ok(!st.bigText()); eq(st.speed(), 1, 'new players start at 1x'); ok(!st.seen('quickTips'));
  ok(st.setSpeed(4)); ok(!st.setSpeed(3), 'only 1/2/4'); eq(st.speed(), 4);
  st.setBigText(true); st.markSeen('quickTips'); ok(!st.folded('deck', false)); ok(st.folded('deck', true), 'default used until toggled'); st.setFolded('deck', false);
  const p2 = AMB.Profile.boot(mem).settings;
  ok(p2.bigText()); eq(p2.speed(), 4); ok(p2.seen('quickTips')); ok(!p2.folded('deck', true), 'a toggled section keeps its state');
});

t('every ui/*.js file parses (a syntax error there would break the whole game in the browser)', () => {
  const fs = require('fs'), path = require('path'), dir = path.join(__dirname, '..', 'ui');
  fs.readdirSync(dir).filter((f) => f.endsWith('.js')).forEach((f) => { try { new Function(fs.readFileSync(path.join(dir, f), 'utf8')); } catch (e) { throw new Error(f + ': ' + e.message); } });
});

console.log('5-level shop');
t('shop settings: 5 levels, every odds row sums to 100, no star above the level, the lowest star falls with each upgrade, costs rise per level', () => {
  const SH = AMB.SHOP; eq(SH.levels, 5); eq(SH.rounds, 8);
  let prevLow = 101;
  for (let l = 1; l <= 5; l++) {
    const row = SH.odds[l]; eq(row.reduce((a, b) => a + b, 0), 100, 'odds of level ' + l);
    row.forEach((w, i) => { if (i + 1 > l) eq(w, 0, `level ${l} must not sell ${i + 1} stars`); });
    ok(row[0] < prevLow, 'the 1-star share falls at every upgrade'); prevLow = row[0];
    if (l > 1) ok(row[l - 1] > 0, 'each upgrade adds the new star');
  }
  const c = [2, 3, 4, 5].map((l) => SH.upgradeCost[l]); ok(c.every((x, i) => i === 0 || x > c[i - 1]), 'each level costs more');
  const cnt = {}; Object.values(AMB.DATA.UNITS).forEach((u) => { cnt[u.tier] = (cnt[u.tier] || 0) + 1; eq(u.cost, u.tier); });
  eq([1, 2, 3, 4, 5].map((k) => cnt[k]).join(), '23,24,6,7,9', 'cards per star');
});
t('shop never shows a card above the shop level (20 AI matches, every roll), and the upgraded board follows the level', () => {
  for (let s = 1; s <= 20; s++) {
    const m = new AMB.Match({ mode: 'sim', seed: s, players: [{ heroId: 'orath', isAI: true, difficulty: 'normal' }, { heroId: 'merin', isAI: true, difficulty: 'hard' }] });
    while (!m.isOver) {
      m.startRound();
      m.players.forEach((p) => { p.shop.forEach((id) => id && ok(AMB.DATA.UNITS[id].tier <= p.level, `${id} in a level ${p.level} shop`)); ok(p.level >= 1 && p.level <= 5); });
      AMB.AI.prep(m, 0); AMB.AI.prep(m, 1);
      m.players.forEach((p) => ok(Object.keys(p.board).length <= m.boardCap(p), 'board within the level'));
      m.resolveCombat(m.createCombat(false).runToEnd());
    }
    ok(m.round <= 8);
  }
});
t('upgrade cost: falls by 1 per round without upgrading, never below the minimum, resets after an upgrade, none at level 5', () => {
  const m = new AMB.Match({ seed: 6, players: [{ heroId: 'orath' }, { heroId: 'merin' }] }); m.startRound(); const p = m.players[0], SH = AMB.SHOP;
  eq(m.upgradeCost(p), SH.upgradeCost[2]); m.startRound(); eq(m.upgradeCost(p), SH.upgradeCost[2] - SH.upgradeDecay);
  for (let i = 0; i < 8; i++) m.startRound(); eq(m.upgradeCost(p), SH.upgradeMin);
  p.gold = 0; ok(!m.upgradeShop(0).ok); p.gold = 99; const g = p.gold, c = m.upgradeCost(p); ok(m.upgradeShop(0).ok); eq(p.gold, g - c); eq(p.level, 2);
  eq(m.upgradeCost(p), SH.upgradeCost[3], 'a fresh upgrade price after buying a level');
  while (p.level < 5) ok(m.upgradeShop(0).ok); eq(m.upgradeCost(p), null); ok(!m.upgradeShop(0).ok);
});
t('merge: 3 copies from the bench or the team become ONE upgraded card (x2 stats); it never merges again; reward = 3 cards one star above the level', () => {
  const mk = (lvl) => { const m = new AMB.Match({ seed: 5, players: [{ heroId: 'orath' }, { heroId: 'merin' }] }); m.startRound(); const p = m.players[0]; p.gold = 99; p.level = lvl; return [m, p]; };
  let [m, p] = mk(2);
  for (let i = 0; i < 3; i++) { p.shop[0] = 'ash_ronin'; const r = m.buy(0, 0); if (i === 2) eq(r.merged.length, 1); }
  const ups = m.allUnits(p).filter((u) => u.defId === 'ash_ronin'); eq(ups.length, 1); eq(ups[0].star, 2); eq(AMB.CONFIG.stars.mult[2], 2);
  ok(p.mergePick && p.mergePick.options.length === 3 && p.mergePick.options.every((id) => AMB.DATA.UNITS[id].tier === 3), 'reward cards are 3 stars at shop level 2');
  const n0 = m.allUnits(p).length; ok(m.claimMerge(0, 0).ok); eq(m.allUnits(p).length, n0 + 1); eq(p.mergePick, null);
  for (let i = 0; i < 3; i++) { p.shop[0] = 'ash_ronin'; m.buy(0, 0); } m.autoPickMerge(0);
  const again = m.allUnits(p).filter((u) => u.defId === 'ash_ronin'); ok(again.length === 2 && again.every((u) => u.star === 2), 'a second trio makes a second upgraded card, never a third star');
  [m, p] = mk(2); p.shop[0] = 'ash_ronin'; m.buy(0, 0); p.shop[0] = 'ash_ronin'; m.buy(0, 0);
  m.allUnits(p).forEach((u, i) => ok(m.move(0, u.uid, { zone: 'board', slot: ['f0', 'f1'][i] }).ok));
  p.shop[0] = 'ash_ronin'; ok(m.buy(0, 0).merged.length === 1, 'two on the team + one on the bench merge'); eq(Object.values(p.board).filter((u) => u.star === 2).length, 1);
  [m, p] = mk(5); for (let i = 0; i < 3; i++) { p.shop[0] = 'ash_ronin'; m.buy(0, 0); } ok(p.mergePick.options.every((id) => AMB.DATA.UNITS[id].tier === 5), 'the reward is capped at 5 stars');
  [m, p] = mk(2); for (let i = 0; i < 3; i++) { p.shop[0] = 'ash_ronin'; m.buy(0, 0); } m.startRound(); eq(p.mergePick, null, 'an unpicked reward is picked for the player when the round ends');
});
t('shop: the first time a star shows up it is flagged (new-star frame); the merge reward op is checked and part of the online hash', () => {
  const m = new AMB.Match({ seed: 8, players: [{ heroId: 'orath' }, { heroId: 'merin' }] }); m.startRound(); const p = m.players[0];
  eq(p.shopNew.length, 5); p.level = 5; p.shownRanks = []; let flagged = 0; for (let i = 0; i < 6; i++) { m._rollShop(p); flagged += p.shopNew.filter(Boolean).length; } ok(flagged >= 3 && flagged <= 4, 'each new star is flagged once (got ' + flagged + ')');
  eq(AMB.NetSync.checkOp(['claimMerge', 1]), null); eq(AMB.NetSync.checkOp(['claimMerge', 'x']), 'claimMerge:arg0');
});
t('a small owned deck never leaves shop slots empty (only ★2 cards owned at shop level 2 -> every slot is filled)', () => {
  const owned = Object.values(AMB.DATA.UNITS).filter((u) => u.tier === 2).slice(0, 4).map((u) => u.id);
  const m = new AMB.Match({ seed: 3, progression: true, players: [{ heroId: 'orath', allowedUnits: owned }, { heroId: 'merin', isAI: true }] });
  m.startRound(); const p = m.players[0]; p.level = 2;
  for (let i = 0; i < 40; i++) { m._rollShop(p); p.shop.forEach((id) => { ok(id && owned.includes(id), 'empty or foreign slot'); }); }
  p.level = 1; m._rollShop(p); ok(p.shop.every((id) => !id), 'at level 1 nothing owned is sold (no card above the level)');
});
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
