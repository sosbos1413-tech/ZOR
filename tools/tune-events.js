#!/usr/bin/env node
/*
 * Fits the weekly events' enemy power (AMB.ECONOMY.events.power = { eventId: [stage1, stage2, stage3] }).
 *   node tools/tune-events.js [games=50]        tunes every event stage and prints the table
 *   node tools/tune-events.js check [games=50]  win rate of every stage with the current settings
 * Reference player: the 8 starter units + the welcome gift at card level 3, with the auto-built deck.
 * Targets: stage 1 ~75%, stage 2 ~58%, boss ~42%.
 */
const path = require('path');
['config', 'data', 'util', 'synergy', 'combat', 'match', 'ai', 'telemetry', 'pass', 'save', 'economy', 'collection', 'packs', 'levels', 'campaign', 'daily', 'album', 'tower', 'events', 'tutorial', 'heroprog', 'profile']
  .forEach((f) => require(path.join(__dirname, '..', 'core', f + '.js')));
const AMB = globalThis.AMB;
const check = process.argv[2] === 'check', games = +(process.argv[check ? 3 : 2] || 50);
const heroes = Object.keys(AMB.DATA.HEROES), TARGET = [0.75, 0.58, 0.42];
const prof = AMB.Profile.boot(AMB.Save.memoryStorage()), C = prof.collection;
C.chooseStarter('orath'); prof.packs.gift(21);   // starter units + the welcome gift
C.ids().forEach((id) => { if (!C.owned(id)) return; C.add(id, 999); while (C.level(id) < 3 && C.canUpgrade(id)) C.upgrade(id); });
C.autoBuild();
function rate(ev, stage, power) {
  const P = AMB.ECONOMY.events.power, old = P[ev.id][stage - 1]; if (power != null) P[ev.id][stage - 1] = power;
  let w = 0;
  for (let g = 0; g < games; g++) {
    // the event of the week is chosen by the clock, so build the options for the wanted event by hand
    const L = prof.weekly.lineupFor(ev.id, stage), pw = P[ev.id][stage - 1], ep = {}; L.units.forEach(([id]) => (ep[id] = pw)); ep[L.heroId] = pw;
    const m = new AMB.Match({ mode: 'event', seed: 12000 + g * 41, progression: true, rules: Object.assign({}, AMB.LEVELS.CAMPAIGN.rules, { start: prof.weekly.startFor(stage) }),
      players: [{ heroId: heroes[g % heroes.length], name: 'x', cardPower: C.powerMap(), allowedUnits: C.playableUnits(), isAI: true },
        { heroId: L.heroId, name: L.name, isAI: true, cardPower: ep, lineup: { units: L.units, summon: L.summon, blessings: L.blessings, abilities: L.abilities } }] });
    while (!m.isOver) { m.startRound(); AMB.AI.prep(m, 0); m.resolveCombat(m.createCombat(false).runToEnd()); }
    if (m.winner === 0) w++;
  }
  P[ev.id][stage - 1] = old; return w / games;
}
if (check) { AMB.WEEKLY.forEach((ev) => console.log(ev.id, [1, 2, 3].map((s) => Math.round(rate(ev, s) * 100) + '%(t' + Math.round(TARGET[s - 1] * 100) + ')').join('  '))); process.exit(0); }
const out = {};
AMB.WEEKLY.forEach((ev) => {
  out[ev.id] = [1, 2, 3].map((stage) => {
    let lo = 0.3, hi = 3.5;
    for (let it = 0; it < 8; it++) { const mid = (lo + hi) / 2; if (rate(ev, stage, mid) > TARGET[stage - 1]) lo = mid; else hi = mid; }
    const pw = +(((lo + hi) / 2)).toFixed(2); console.error(ev.id, 'stage', stage, 'power', pw); return pw;
  });
});
console.log('power: ' + JSON.stringify(out));
