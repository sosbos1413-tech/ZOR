#!/usr/bin/env node
/*
 * Shop sanity + pacing check (the 5-level shop).  node tools/shop-check.js [matches=200]
 *  - no shop slot ever shows a card above the player's shop level (except the merge reward, which is one above)
 *  - merges work from the team and from the bench; the upgraded card never merges again
 *  - a "focus on upgrades" player reaches level 5 around round 6-7
 *  - full 8-round matches run without errors; prints the level reached per round and the gold flow
 */
const path = require('path');
['config', 'data', 'util', 'synergy', 'combat', 'match', 'ai', 'telemetry'].forEach((f) => require(path.join(__dirname, '..', 'core', f + '.js')));
const AMB = globalThis.AMB, U = AMB.DATA.UNITS, SH = AMB.SHOP, N = +(process.argv[2] || 200);
let bad = 0; const fail = (m) => { bad++; if (bad < 12) console.log('FAIL', m); };
const heroes = Object.keys(AMB.DATA.HEROES);

// 1) never a card above the level, in every shop roll of AI matches
const lvlByRound = {}, goldBy = {}, rounds = {};
const stars = {};
for (let s = 1; s <= N; s++) {
  const m = new AMB.Match({ mode: 'sim', seed: s, players: [0, 1].map((i) => ({ heroId: heroes[(s + i * 3) % 8], isAI: true, aiStyle: ['mono', 'mixed', 'balanced'][(s + i) % 3], difficulty: ['normal', 'hard'][i] })) });
  while (!m.isOver) {
    m.startRound();
    m.players.forEach((p) => {
      p.shop.forEach((id) => { if (id && U[id].tier > p.level) fail(`seed ${s} round ${m.round}: ${id} is ${U[id].tier}* in a level ${p.level} shop`); });
      (lvlByRound[m.round] = lvlByRound[m.round] || []).push(p.level);
    });
    AMB.AI.prep(m, 0); AMB.AI.prep(m, 1);
    m.players.forEach((p) => { (goldBy[m.round] = goldBy[m.round] || []).push(p.gold); Object.values(p.board).forEach((u) => { const k = U[u.defId].tier + (u.star === 2 ? 'g' : ''); stars[k] = (stars[k] || 0) + 1; }); });
    m.resolveCombat(m.createCombat(false).runToEnd());
  }
  rounds[m.round] = (rounds[m.round] || 0) + 1;
}
const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
console.log('matches', N, 'rounds hist', JSON.stringify(rounds));
console.log('avg shop level by round :', Object.keys(lvlByRound).map((r) => r + ':' + avg(lvlByRound[r]).toFixed(2)).join('  '));
console.log('avg gold left after prep:', Object.keys(goldBy).map((r) => r + ':' + avg(goldBy[r]).toFixed(1)).join('  '));
console.log('cards on board by stars (g = upgraded):', JSON.stringify(stars));

// 2) an upgrade-focused player (buys the shop level whenever it can, spends the rest on cards)
{
  const reach = [];
  for (let s = 1; s <= 100; s++) {
    const m = new AMB.Match({ mode: 'sim', seed: 900 + s, players: [{ heroId: 'orath', isAI: true }, { heroId: 'merin', isAI: true }] });
    let at5 = null;
    while (!m.isOver) {
      m.startRound(); const p = m.players[0];
      for (let g = 0; g < 4 && p.level < 5; g++) if (!m.upgradeShop(0).ok) break;
      if (p.level === 5 && at5 == null) at5 = m.round;
      // spend what is left on cards (never above the level)
      for (let i = 0; i < 5; i++) if (p.shop[i] && m.canBuy(0, i).ok) m.buy(0, i);
      m.autoPickMerge(0);
      m.autoArrange(0); AMB.AI.prep(m, 1); m.resolveCombat(m.createCombat(false).runToEnd());
    }
    reach.push(at5 == null ? 9 : at5);
  }
  const h = {}; reach.forEach((r) => (h[r] = (h[r] || 0) + 1));
  console.log('upgrade-focused player reaches level 5 in round (9 = never):', JSON.stringify(h), 'avg', avg(reach).toFixed(2));
}

// 3) merge: 3 copies from the bench / from the team -> ONE upgraded card; the reward is 3 cards one star above the level
{
  const mk = () => { const m = new AMB.Match({ seed: 5, players: [{ heroId: 'orath' }, { heroId: 'merin' }] }); m.startRound(); const p = m.players[0]; p.gold = 99; p.level = 2; return [m, p]; };
  let [m, p] = mk();
  for (let i = 0; i < 3; i++) { p.shop[0] = 'ash_ronin'; const r = m.buy(0, 0); if (i === 2) { if (!r.merged.length) fail('3 bench copies did not merge'); } }
  const ups = m.allUnits(p).filter((u) => u.defId === 'ash_ronin');
  if (ups.length !== 1 || ups[0].star !== 2) fail('expected one upgraded card, got ' + JSON.stringify(ups));
  if (!p.mergePick || p.mergePick.options.length !== 3 || !p.mergePick.options.every((id) => U[id].tier === p.level + 1)) fail('bad merge reward ' + JSON.stringify(p.mergePick));
  const r = m.claimMerge(0, 1); if (!r.ok || p.mergePick) fail('claimMerge');
  // the upgraded card never merges again: three more copies make a SECOND upgraded card, never a third star
  for (let i = 0; i < 3; i++) { p.shop[0] = 'ash_ronin'; m.buy(0, 0); } m.autoPickMerge(0);
  const all = m.allUnits(p).filter((u) => u.defId === 'ash_ronin'); if (!(all.length === 2 && all.every((u) => u.star === 2))) fail('second trio should give a second upgraded card: ' + JSON.stringify(all.map((u) => u.star)));
  // from the team: 2 on the board + 1 on the bench
  [m, p] = mk();
  p.shop[0] = 'ash_ronin'; m.buy(0, 0); p.shop[0] = 'ash_ronin'; m.buy(0, 0);
  m.allUnits(p).forEach((u, i) => m.move(0, u.uid, { zone: 'board', slot: ['f0', 'f1'][i] }));
  p.shop[0] = 'ash_ronin'; const r3 = m.buy(0, 0);
  if (!r3.merged.length) fail('team + bench copies did not merge');
  if (Object.values(p.board).filter((u) => u.star === 2).length !== 1) fail('the upgraded card should keep its place on the team');
  if (U['ash_ronin'].tier !== 1) fail('ash_ronin should be 1 star');
  // reward at the top level stays at 5 stars
  [m, p] = mk(); p.level = 5; for (let i = 0; i < 3; i++) { p.shop[0] = 'ash_ronin'; m.buy(0, 0); }
  if (!p.mergePick || !p.mergePick.options.every((id) => U[id].tier === 5)) fail('top level reward must be 5 stars');
}
// 4) upgrade cost: rises per level, falls by 1 per idle round, never below the minimum
{
  const m = new AMB.Match({ seed: 6, players: [{ heroId: 'orath' }, { heroId: 'merin' }] }); m.startRound(); const p = m.players[0];
  const seq = []; for (let r = 1; r <= 6; r++) { seq.push(m.upgradeCost(p)); m.startRound(); }
  console.log('cost of level 2 over idle rounds:', seq.join(' '));
  if (Math.min(...seq) < SH.upgradeMin) fail('cost below minimum');
  p.gold = 99; const costs = [];
  for (let l = 2; l <= 5; l++) { costs.push(m.upgradeCost(p)); if (!m.upgradeShop(0).ok) fail('upgrade failed'); }
  console.log('fresh costs of levels 2-5:', costs.join(' '));
  if (m.upgradeCost(p) !== null) fail('level 5 should have no further upgrade');
}
console.log(bad ? 'FAILED ' + bad : 'ALL OK');
process.exit(bad ? 1 : 0);
