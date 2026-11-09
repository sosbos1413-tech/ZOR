#!/usr/bin/env node
/*
 * Balance benchmark (audit 2.1): AI vs AI, hard, every hero gets the same number of games against random opponents.
 *   node tools/bench.js [gamesPerHero=300] [seed=1] [workers=4]
 * Prints hero win rates (+ spread). Use >=1000 per hero and two seeds before trusting a number (error ~ +-3).
 */
const path = require('path'), cp = require('child_process');
const G = +(process.argv[2] || 300), SEED = +(process.argv[3] || 1), W = +(process.argv[4] || 4);
if (process.argv[5] === 'child') {
  ['config', 'data', 'util', 'synergy', 'combat', 'match', 'ai', 'telemetry'].forEach((f) => require(path.join(__dirname, '..', 'core', f + '.js')));
  const AMB = globalThis.AMB, heroes = Object.keys(AMB.DATA.HEROES), styles = ['mono', 'mixed', 'balanced'];
  // optional config overrides for experiments: OVR='{"vanguardScale":0.4}' node tools/bench.js 1000 1 4
  const find = (o, k) => { for (const sec of Object.keys(o)) if (o[sec] && typeof o[sec] === 'object' && k in o[sec]) return o[sec]; return null; };
  Object.entries(JSON.parse(process.env.OVR || '{}')).forEach(([k, v]) => { const sec = find(AMB.CONFIG, k); if (!sec) throw new Error('unknown config ' + k); sec[k] = v; });
  const part = +process.argv[6], n = +process.argv[7], rng = AMB.util.RNG(SEED * 1000 + part);
  const out = {}; heroes.forEach((h) => (out[h] = [0, 0]));
  for (let g = 0; g < n; g++) heroes.forEach((h) => {
    const o = rng.pick(heroes.filter((x) => x !== h)), seat = rng.int(2), ids = seat ? [o, h] : [h, o];
    const m = new AMB.Match({ mode: 'sim', seed: rng.int(2 ** 31), players: ids.map((id) => ({ heroId: id, isAI: true, aiStyle: rng.pick(styles), difficulty: 'hard' })) });
    while (!m.isOver) { m.startRound(); AMB.AI.prep(m, 0); AMB.AI.prep(m, 1); m.resolveCombat(m.createCombat(false).runToEnd()); }
    const w = m.winner != null ? m.winner : (m.players[0].life >= m.players[1].life ? 0 : 1);
    out[h][1]++; if (w === seat) out[h][0]++;
  });
  process.stdout.write(JSON.stringify(out));
} else {
  const per = Math.ceil(G / W); let done = 0; const tot = {};
  for (let w = 0; w < W; w++) cp.execFile(process.execPath, [__filename, G, SEED, W, 'child', w, per], { maxBuffer: 1 << 24 }, (e, so) => {
    if (e) throw e; const r = JSON.parse(so);
    Object.keys(r).forEach((h) => { tot[h] = tot[h] || [0, 0]; tot[h][0] += r[h][0]; tot[h][1] += r[h][1]; });
    if (++done < W) return;
    const rows = Object.keys(tot).map((h) => [h, (100 * tot[h][0]) / tot[h][1], tot[h][1]]).sort((a, b) => b[1] - a[1]);
    rows.forEach(([h, p, n]) => console.log(h.padEnd(10), p.toFixed(1).padStart(5) + '%', n));
    console.log('spread', (rows[0][1] - rows[rows.length - 1][1]).toFixed(1));
  });
}
