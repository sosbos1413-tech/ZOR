#!/usr/bin/env node
/*
 * Are the stage-reward choices balanced? (audit 3.4) The test seat picks a RANDOM option at every reward draft
 * (so no choice is tied to the game state); the opponent is the normal hard AI. Prints the test seat's match
 * win rate by the option it took (all stages, and per stage). Choices should land within ~±3 points of each other.
 *   node tools/bench-rewards.js [games=6000] [seed=1]
 */
const path = require('path');
['config', 'data', 'util', 'synergy', 'combat', 'match', 'ai', 'telemetry'].forEach((f) => require(path.join(__dirname, '..', 'core', f + '.js')));
const AMB = globalThis.AMB, G = +(process.argv[2] || 6000), SEED = +(process.argv[3] || 1);
const find = (o, k) => { for (const sec of Object.keys(o)) if (o[sec] && typeof o[sec] === 'object' && k in o[sec]) return o[sec]; return null; };
Object.entries(JSON.parse(process.env.OVR || '{}')).forEach(([k, v]) => { const sec = find(AMB.CONFIG, k); if (!sec) throw new Error('unknown config ' + k); sec[k] = v; });
const heroes = Object.keys(AMB.DATA.HEROES), styles = ['mono', 'mixed', 'balanced'], rng = AMB.util.RNG(SEED);
const all = {}, byStage = [{}, {}, {}];
const add = (o, k, w) => { o[k] = o[k] || [0, 0]; o[k][1]++; if (w) o[k][0]++; };
let total = 0;
for (let g = 0; g < G; g++) {
  const seat = rng.int(2), st = rng.pick(styles);
  const m = new AMB.Match({ mode: 'sim', seed: rng.int(2 ** 31), players: [0, 1].map(() => ({ heroId: rng.pick(heroes), isAI: true, aiStyle: st, difficulty: 'hard' })) });
  const took = [];
  while (!m.isOver) {
    const o = m.players[seat].rewardOffer;
    if (o && !o.claimed) { const i = rng.int(o.options.length); took.push([o.stage, o.options[i]]); m.claimReward(seat, i); }
    m.startRound(); AMB.AI.prep(m, 0); AMB.AI.prep(m, 1); m.resolveCombat(m.createCombat(false).runToEnd());
  }
  const w = (m.winner != null ? m.winner : (m.players[0].life >= m.players[1].life ? 0 : 1)) === seat;
  if (w) total++;
  took.forEach(([s, id]) => { add(all, id, w); add(byStage[s], id, w); });
}
const show = (o) => Object.entries(o).sort((a, b) => b[1][0] / b[1][1] - a[1][0] / a[1][1]).map(([k, [w, n]]) => `${k} ${((100 * w) / n).toFixed(1)}% (${n})`).join('  ');
console.log('test seat (random picks) overall', ((100 * total) / G).toFixed(1) + '%', 'n=' + G);
console.log('all stages:', show(all));
byStage.forEach((o, s) => console.log('stage ' + (s + 1) + ':', show(o)));
