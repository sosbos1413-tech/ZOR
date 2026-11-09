#!/usr/bin/env node
/*
 * Do items matter? (audit 3.4) hard AI that buys items vs the same hard AI that never buys them (items from stage rewards still count for both).
 *   node tools/bench-items.js [games=800] [seed=1]
 * Target: the item buyer wins a modest ~53-58% (items help, they do not decide the match).
 */
const path = require('path');
['config', 'data', 'util', 'synergy', 'combat', 'match', 'ai', 'telemetry'].forEach((f) => require(path.join(__dirname, '..', 'core', f + '.js')));
const AMB = globalThis.AMB, G = +(process.argv[2] || 800), SEED = +(process.argv[3] || 1);
const find = (o, k) => { for (const sec of Object.keys(o)) if (o[sec] && typeof o[sec] === 'object' && k in o[sec]) return o[sec]; return null; };
Object.entries(JSON.parse(process.env.OVR || '{}')).forEach(([k, v]) => { const sec = find(AMB.CONFIG, k); if (!sec) throw new Error('unknown config ' + k); sec[k] = v; });
AMB.CONFIG.ai.hardNI = Object.assign({}, AMB.CONFIG.ai.hard, { noItems: true });
const heroes = Object.keys(AMB.DATA.HEROES), styles = ['mono', 'mixed', 'balanced'], rng = AMB.util.RNG(SEED);
let wins = 0, bought = 0, equipped = 0;
for (let g = 0; g < G; g++) {
  const seat = rng.int(2), ids = [rng.pick(heroes), rng.pick(heroes)], st = rng.pick(styles);
  const m = new AMB.Match({ mode: 'sim', seed: rng.int(2 ** 31), players: [0, 1].map((i) => ({ heroId: ids[i], isAI: true, aiStyle: st, difficulty: i === seat ? 'hard' : 'hardNI' })) });
  const orig = m.buyItem.bind(m);
  m.buyItem = (pi, idx) => { const r = orig(pi, idx); if (r.ok && pi === seat) bought++; return r; };
  while (!m.isOver) { m.startRound(); AMB.AI.prep(m, 0); AMB.AI.prep(m, 1); m.resolveCombat(m.createCombat(false).runToEnd()); }
  equipped += m.allUnits(m.players[seat]).reduce((s, u) => s + u.items.length, 0);
  const w = m.winner != null ? m.winner : (m.players[0].life >= m.players[1].life ? 0 : 1);
  if (w === seat) wins++;
}
console.log('item buyer win rate', ((100 * wins) / G).toFixed(1) + '%', 'n=' + G, '| items bought/match', (bought / G).toFixed(2), '| equipped at the end', (equipped / G).toFixed(2));
