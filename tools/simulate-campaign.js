#!/usr/bin/env node
/*
 * Campaign balance check: an AI plays each fight many times with a given collection.
 *   node tools/simulate-campaign.js [games=60] [cardLevel=1] [owned=starter|all]
 * Prints the win rate per fight. Targets (starter cards, level 1): early fights ~80-95%,
 * bosses ~40-60%, later levels need unlocked/upgraded cards.
 */
const path = require('path');
['config', 'data', 'util', 'synergy', 'combat', 'match', 'ai', 'telemetry', 'pass', 'save', 'economy', 'collection', 'packs', 'levels', 'campaign', 'daily', 'album', 'tower', 'events', 'tutorial', 'heroprog', 'profile']
  .forEach((f) => require(path.join(__dirname, '..', 'core', f + '.js')));
const AMB = globalThis.AMB;
const games = +(process.argv[2] || 60), cardLevel = +(process.argv[3] || 1), owned = process.argv[4] || 'starter';

const prof = AMB.Profile.boot(AMB.Save.memoryStorage());
const C = prof.collection;
if (owned === 'all') C.ids().forEach((id) => C.add(id, 1));
else { C.chooseStarter('orath'); prof.packs.gift(21); }   // starter units + the welcome gift
C.ids().forEach((id) => { if (!C.owned(id)) return; C.add(id, 999); while (C.level(id) < cardLevel && C.canUpgrade(id)) C.upgrade(id); });
C.autoBuild();
const heroes = Object.keys(AMB.DATA.HEROES);

for (const l of AMB.LEVELS.LEVELS) {
  const row = [];
  for (const f of l.fights) {
    let w = 0;
    for (let g = 0; g < games; g++) {
      const hero = heroes[g % heroes.length];
      if (owned !== 'all') { /* starter: one hero only, rotate to average out */ }
      const m = new AMB.Match(prof.campaign.matchOptions(f.id, hero, 1000 + g * 17));
      m.players[0].isAI = true; m.players[0].difficulty = 'normal';
      while (!m.isOver) { m.startRound(); AMB.AI.prep(m, 0); AMB.AI.prep(m, 1); m.resolveCombat(m.createCombat(false).runToEnd()); }
      if (m.winner === 0) w++;
    }
    row.push(`${f.id}${f.boss ? '★' : ''}:${Math.round((100 * w) / games)}%`);
  }
  console.log(l.id, row.join('  '));
}
