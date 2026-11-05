#!/usr/bin/env node
/*
 * Fits the tower's enemy power curve (AMB.ECONOMY.tower.power = [a, b, c] for a + b*floor + c*floor^2).
 *   node tools/tune-tower.js [games=40]        tunes EVERY floor's power to the target win-rate curve and prints the table
 *   node tools/tune-tower.js check [games=40]  prints the win rate of every floor with the current settings
 * Reference player: starter units upgraded steadily (see PROFS). Target: 88% on floor 1 falling to 30% on floor 30.
 */
const path = require('path');
['config', 'data', 'util', 'synergy', 'combat', 'match', 'ai', 'telemetry', 'pass', 'save', 'economy', 'collection', 'packs', 'levels', 'campaign', 'daily', 'album', 'tower', 'events', 'profile']
  .forEach((f) => require(path.join(__dirname, '..', 'core', f + '.js')));
const AMB = globalThis.AMB;
const mode = process.argv[2] === 'check' ? 'check' : 'tune';
const games = +(process.argv[mode === 'check' ? 3 : 2] || 40);
const heroes = Object.keys(AMB.DATA.HEROES);
// reference player: a steady, casual one who keeps the 20 starter units and upgrades them as they climb:
// card level 1 on floors 1-8, 2 on 9-16, 3 on 17-24, 4 on 25-30. Players with packs/more upgrades go further.
function profile(owned, lvl) {
  const p = AMB.Profile.boot(AMB.Save.memoryStorage()), C = p.collection;
  if (owned === 'all') C.ids().forEach((id) => C.add(id, 1));
  C.ids().forEach((id) => { if (!C.owned(id)) return; C.add(id, 999); while (C.level(id) < lvl && C.canUpgrade(id)) C.upgrade(id); });
  return p;
}
const PROFS = [[8, profile('starter', 1)], [16, profile('starter', 2)], [24, profile('starter', 3)], [30, profile('starter', 4)]];
const profFor = (n) => PROFS.find((x) => n <= x[0])[1];
const target = (n) => 0.88 - 0.58 * ((n - 1) / 29);
function rate(n, power) {
  const T = AMB.ECONOMY.tower, old = T.power; if (power != null) T.power = [power];
  let w = 0;
  for (let g = 0; g < games; g++) {
    const m = new AMB.Match(profFor(n).tower.matchOptions(n, heroes[g % heroes.length], 9000 + g * 37)); m.players[0].isAI = true;
    while (!m.isOver) { m.startRound(); AMB.AI.prep(m, 0); m.resolveCombat(m.createCombat(false).runToEnd()); }
    if (m.winner === 0) w++;
  }
  T.power = old; return w / games;
}
if (mode === 'check') {
  const row = [];
  for (let n = 1; n <= 30; n++) row.push(`${n}${AMB.Tower.lineupFor(n).boss ? '★' : ''}:${Math.round(rate(n) * 100)}%(t${Math.round(target(n) * 100)})`);
  console.log(row.join('  ')); process.exit(0);
}
// every floor's line-up is generated once and fixed, so each floor gets its own power value (bisection on win rate)
const out = [];
for (let n = 1; n <= AMB.ECONOMY.tower.floors; n++) {
  const boss = AMB.Tower.lineupFor(n).boss, tgt = Math.max(0.15, target(n) - (boss ? 0.12 : 0));
  let lo = 0.3, hi = 3.5;
  for (let it = 0; it < 8; it++) { const mid = (lo + hi) / 2; if (rate(n, mid) > tgt) lo = mid; else hi = mid; }
  const pw = +(((lo + hi) / 2)).toFixed(2); out.push(pw);
  console.error('floor', n, boss ? '(boss)' : '', 'target', Math.round(tgt * 100) + '%', 'power', pw);
}
console.log('power: ' + JSON.stringify(out));
