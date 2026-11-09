#!/usr/bin/env node
/* audit 2.5: how often does the player who is far behind after round 2 still win? (and how decisive is round 1)
 *   node tools/bench-catchup.js [games=1500] [seed=1] */
const path = require('path');
['config', 'data', 'util', 'synergy', 'combat', 'match', 'ai', 'telemetry'].forEach((f) => require(path.join(__dirname, '..', 'core', f + '.js')));
const AMB = globalThis.AMB; if (process.env.NOCATCH) AMB.CONFIG.economy.catchUp = null;
const G = +(process.argv[2] || 1500), heroes = Object.keys(AMB.DATA.HEROES), rng = AMB.util.RNG(+(process.argv[3] || 1));
let big = 0, bigWin = 0, r1 = 0, r1w = 0, rounds = 0;
for (let g = 0; g < G; g++) {
  const m = new AMB.Match({ mode: 'sim', seed: rng.int(2 ** 31), players: [0, 1].map(() => ({ heroId: rng.pick(heroes), isAI: true, aiStyle: 'balanced', difficulty: 'hard' })) });
  let lead = null, first = null;
  while (!m.isOver) {
    m.startRound(); AMB.AI.prep(m, 0); AMB.AI.prep(m, 1); m.resolveCombat(m.createCombat(false).runToEnd());
    if (m.round === 1) first = m.players[0].lastWon ? 0 : m.players[1].lastWon ? 1 : null;
    if (m.round === 2 && lead == null) { const d = m.players[0].life - m.players[1].life; if (Math.abs(d) >= 10) lead = d > 0 ? 0 : 1; }
  }
  const w = m.winner != null ? m.winner : (m.players[0].life >= m.players[1].life ? 0 : 1); rounds += m.round;
  if (lead != null) { big++; if (w === lead) bigWin++; }
  if (first != null) { r1++; if (w === first) r1w++; }
}
console.log('leader after R2 (gap>=10) wins', (100 * bigWin / big).toFixed(1) + '%', 'n=' + big, '| round-1 winner wins', (100 * r1w / r1).toFixed(1) + '%', 'avg rounds', (rounds / G).toFixed(2));
