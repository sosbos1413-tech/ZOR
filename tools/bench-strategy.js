#!/usr/bin/env node
/*
 * teen #20: is one play STYLE dominant? Four style profiles (no mistakes) play a round robin; prints each style's win rate
 * and WARNS when any style wins more than 55% overall.   node tools/bench-strategy.js [gamesPerPair=600] [seed=7]
 */
const path = require('path');
['config', 'data', 'util', 'synergy', 'combat', 'match', 'ai', 'telemetry'].forEach((f) => require(path.join(__dirname, '..', 'core', f + '.js')));
const AMB = globalThis.AMB, C = AMB.CONFIG.ai, N = +(process.argv[2] || 600), rng = AMB.util.RNG(+(process.argv[3] || 7));
const S = {
  aggressive: { style: 'mono', cfg: { mistakes: 0, rerollGreed: 1, levelAggro: 2.2, reserveCap: 4, summonFrom: 2, summonMinLife: 25 } },
  balanced: { style: 'balanced', cfg: { mistakes: 0, rerollGreed: 0.8, levelAggro: 1.4, reserveCap: 12, summonFrom: 3, summonMinLife: 45 } },
  greedy: { style: 'mono', cfg: { mistakes: 0, rerollGreed: 0.4, levelAggro: 0.8, reserveCap: 20, summonFrom: 5, summonMinLife: 60 } },
  noHero: { style: 'mixed', cfg: { mistakes: 0, rerollGreed: 1, levelAggro: 1.6, reserveCap: 10, noSummon: true } },
};
Object.entries(S).forEach(([k, v]) => (C['st_' + k] = v.cfg));
const ids = Object.keys(S), heroes = Object.keys(AMB.DATA.HEROES), rec = {}; ids.forEach((k) => (rec[k] = [0, 0]));
for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) for (let g = 0; g < N; g++) {
  const who = g % 2 ? [ids[j], ids[i]] : [ids[i], ids[j]];
  const m = new AMB.Match({ mode: 'sim', seed: rng.int(2 ** 31), players: who.map((k) => ({ heroId: rng.pick(heroes), isAI: true, aiStyle: S[k].style, difficulty: 'st_' + k })) });
  while (!m.isOver) { m.startRound(); AMB.AI.prep(m, 0); AMB.AI.prep(m, 1); m.resolveCombat(m.createCombat(false).runToEnd()); }
  const w = m.winner != null ? m.winner : (m.players[0].life >= m.players[1].life ? 0 : 1);
  who.forEach((k, x) => { rec[k][1]++; if (w === x) rec[k][0]++; });
}
let warn = false;
ids.forEach((k) => { const p = (100 * rec[k][0]) / rec[k][1]; if (p > 55) warn = true; console.log(k.padEnd(11), p.toFixed(1) + '%', rec[k][1]); });
console.log(warn ? '⚠ a style wins more than 55%: the game rewards one plan too much' : 'ok: no style above 55%');
