#!/usr/bin/env node
/*
 * Is summoning the hero a real choice? hard AI that never summons vs hard AI that does (audit 2.3).
 *   OVR='{"combat.vanguardScale":0.5}' node tools/bench-summon.js [games=800] [seed=1]
 * "no-summon" win rate should land near 36-42% (not ~24%: then summoning is a forced move).
 */
const path = require('path');
['config', 'data', 'util', 'synergy', 'combat', 'match', 'ai', 'telemetry'].forEach((f) => require(path.join(__dirname, '..', 'core', f + '.js')));
const AMB = globalThis.AMB, G = +(process.argv[2] || 800), SEED = +(process.argv[3] || 1);
const find = (o, k) => { for (const sec of Object.keys(o)) if (o[sec] && typeof o[sec] === 'object' && k in o[sec]) return o[sec]; return null; };
Object.entries(JSON.parse(process.env.OVR || '{}')).forEach(([k, v]) => { const sec = find(AMB.CONFIG, k); if (!sec) throw new Error('unknown config ' + k); sec[k] = v; });
AMB.CONFIG.ai.hardNS = Object.assign({}, AMB.CONFIG.ai.hard, { noSummon: true });
const heroes = Object.keys(AMB.DATA.HEROES), rng = AMB.util.RNG(SEED);
let ns = 0;
for (let g = 0; g < G; g++) {
  const seat = rng.int(2), ids = [rng.pick(heroes), rng.pick(heroes)];
  const m = new AMB.Match({ mode: 'sim', seed: rng.int(2 ** 31), players: [0, 1].map((i) => ({ heroId: ids[i], isAI: true, aiStyle: 'balanced', difficulty: i === seat ? 'hardNS' : 'hard' })) });
  while (!m.isOver) { m.startRound(); AMB.AI.prep(m, 0); AMB.AI.prep(m, 1); m.resolveCombat(m.createCombat(false).runToEnd()); }
  const w = m.winner != null ? m.winner : (m.players[0].life >= m.players[1].life ? 0 : 1);
  if (w === seat) ns++;
}
console.log('no-summon win rate', ((100 * ns) / G).toFixed(1) + '%', 'n=' + G);
