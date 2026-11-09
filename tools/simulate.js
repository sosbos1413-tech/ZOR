#!/usr/bin/env node
/*
 * Headless balance simulator: AI vs AI full matches.
 *   node tools/simulate.js [matches=400] [seed=1]
 * Prints hero / style / unit / synergy win rates and pacing so values in
 * core/config.js and core/data.js can be tuned with evidence.
 */
const path = require('path');
const core = ['config', 'data', 'util', 'synergy', 'combat', 'match', 'ai', 'telemetry'];
core.forEach((f) => require(path.join(__dirname, '..', 'core', f + '.js')));
const AMB = globalThis.AMB;

// optional config overrides for experiments: OVR='{"copiesTo":{"2":3,"3":2}}' node tools/simulate.js 1500 1
const find = (o, k) => { for (const sec of Object.keys(o)) if (o[sec] && typeof o[sec] === 'object' && k in o[sec]) return o[sec]; return null; };
Object.entries(JSON.parse(process.env.OVR || '{}')).forEach(([k, v]) => { const sec = find(AMB.CONFIG, k); if (!sec) throw new Error('unknown config ' + k); sec[k] = v; });
const N = +(process.argv[2] || 400);
let seed = +(process.argv[3] || 1);
const rng = AMB.util.RNG(seed);
const heroes = Object.keys(AMB.DATA.HEROES);
const styles = ['mono', 'mixed', 'balanced'];
AMB.telemetry.reset();

let simSeconds = 0;
const comp = {};
const roundsHist = {};
let threeStarPlayers = 0, threeStarWins = 0, twoStarUnits = 0, finalUnits = 0;
for (let m = 0; m < N; m++) {
  const match = new AMB.Match({
    mode: 'sim', seed: rng.int(2 ** 31),
    players: [0, 1].map(() => ({ heroId: rng.pick(heroes), isAI: true, aiStyle: rng.pick(styles), difficulty: 'hard' })),
  });
  let secs = 0;
  while (!match.isOver) {
    match.startRound();
    AMB.AI.prep(match, 0);
    AMB.AI.prep(match, 1);
    const c = match.createCombat(false);
    const res = c.runToEnd();
    match.resolveCombat(res);
    secs += AMB.CONFIG.match.prepSeconds * 0.6 + res.duration / 2 + 4; // rough real-time estimate
  }
  simSeconds += secs;
  const last = match.history[match.history.length - 1];
  match.players.forEach((p, i) => {
    const b = last.players[i].board;
    const worlds = new Set(b.map((u) => AMB.DATA.UNITS[u.defId].world)).size;
    const heroW = AMB.DATA.HEROES[p.heroId].world;
    const share = b.length ? b.filter((u) => AMB.DATA.UNITS[u.defId].world === heroW).length / b.length : 0;
    if (b.some((u) => u.star === 3)) { threeStarPlayers++; if (match.winner === i) threeStarWins++; }
    b.forEach((u) => { finalUnits++; if (u.star === 2) twoStarUnits++; });
    const key = 'worlds=' + worlds;
    const k2 = 'heroWorldShare ' + (share >= 0.6 ? '>=60%' : share >= 0.3 ? '30-59%' : '<30%');
    [key, k2].forEach((k) => { comp[k] = comp[k] || { picks: 0, wins: 0 }; comp[k].picks++; if (match.winner === i) comp[k].wins++; });
  });
  roundsHist[match.round] = (roundsHist[match.round] || 0) + 1;
  AMB.telemetry.recordMatch(match, { seconds: Math.round(secs) });
}

const d = AMB.telemetry.load();
const pct = (w, p) => (p ? ((100 * (w || 0)) / p).toFixed(1) + '%' : '-');
const table = (title, obj, nameOf) => {
  console.log('\n== ' + title);
  Object.entries(obj).sort((a, b) => (b[1].wins || 0) / b[1].picks - (a[1].wins || 0) / a[1].picks)
    .forEach(([k, v]) => console.log(`  ${(nameOf ? nameOf(k) : k).padEnd(22)} picks ${String(v.picks).padStart(5)}  win ${pct(v.wins, v.picks).padStart(6)}` +
      (v.final != null ? `  final ${String(v.final).padStart(4)}  3★ ${v.threeStar || 0}` : '')));
};
console.log(`matches: ${d.matches}  draws: ${d.draws}  avg rounds: ${(d.totalRounds / d.matches).toFixed(2)}  est. real time: ${(simSeconds / d.matches / 60).toFixed(1)} min`);
console.log('rounds histogram:', JSON.stringify(roundsHist));
console.log(`3★ on the final board: ${pct(threeStarPlayers, 2 * d.matches)} of players (win ${pct(threeStarWins, threeStarPlayers)})  ·  2★ share of final units: ${pct(twoStarUnits, finalUnits)}`);
console.log(`summoned hero at least once: ${d.summons.used} players, win ${pct(d.summons.wins, d.summons.used)}`);
table('heroes', d.heroes, (k) => AMB.DATA.HEROES[k].name + ' ' + k);
table('AI styles', d.styles);
table('final-board composition', comp);
table('synergies (active at some point)', d.synergies);
table('units (fielded at some point)', d.units, (k) => k);
