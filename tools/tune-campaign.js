#!/usr/bin/env node
/*
 * Finds each campaign fight's enemy `power` that gives a target AI win rate for a reference
 * player profile per level (cards owned + card level). Prints values to paste into core/levels.js.
 *   node tools/tune-campaign.js [games=40]
 */
const path = require('path');
['config', 'data', 'util', 'synergy', 'combat', 'match', 'ai', 'telemetry', 'pass', 'save', 'economy', 'collection', 'packs', 'levels', 'campaign', 'daily', 'album', 'tower', 'profile']
  .forEach((f) => require(path.join(__dirname, '..', 'core', f + '.js')));
const AMB = globalThis.AMB;
const games = +(process.argv[2] || 40);
const only = process.argv[3] || null;   // optional: tune just one level, e.g. l1
// reference player per level: what a player plausibly has when reaching it
const REF = { l1: { lvl: 1, owned: 'starter', t: [0.95, 0.8, 0.72, 0.65, 0.4] }, l2: { lvl: 2, owned: 'starter', t: [0.85, 0.8, 0.75, 0.7, 0.5] },
  l3: { lvl: 3, owned: 'all', t: [0.8, 0.75, 0.7, 0.65, 0.45] }, l4: { lvl: 4, owned: 'all', t: [0.75, 0.7, 0.65, 0.6, 0.4] } };
const heroes = Object.keys(AMB.DATA.HEROES);
function profile(lvl, owned) {
  const p = AMB.Profile.boot(AMB.Save.memoryStorage()), C = p.collection;
  if (owned === 'all') C.ids().forEach((id) => C.add(id, 1));
  C.ids().forEach((id) => { if (!C.owned(id)) return; C.add(id, 999); while (C.level(id) < lvl && C.canUpgrade(id)) C.upgrade(id); });
  return p;
}
function rate(prof, f, power) {
  f.power = power; let w = 0;
  for (let g = 0; g < games; g++) {
    const m = new AMB.Match(prof.campaign.matchOptions(f.id, heroes[g % heroes.length], 5000 + g * 31));
    m.players[0].isAI = true;
    while (!m.isOver) { m.startRound(); AMB.AI.prep(m, 0); m.resolveCombat(m.createCombat(false).runToEnd()); }
    if (m.winner === 0) w++;
  }
  return w / games;
}
for (const l of AMB.LEVELS.LEVELS) {
  if (only && l.id !== only) continue;
  const R = REF[l.id], prof = profile(R.lvl, R.owned), out = [];
  l.fights.forEach((f, i) => {
    let lo = 0.3, hi = 2.6;
    for (let it = 0; it < 7; it++) { const mid = (lo + hi) / 2; if (rate(prof, f, mid) > R.t[i]) lo = mid; else hi = mid; }
    f.power = Math.round(((lo + hi) / 2) * 100) / 100;
    out.push(`${f.id}=${f.power} (${Math.round(rate(prof, f, f.power) * 100)}%)`);
  });
  console.log(l.id, out.join('  '));
}
