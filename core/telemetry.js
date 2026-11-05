/*
 * Balance telemetry: win rates per hero, unit usage / win rates, synergy
 * activation, match length. Stored in localStorage in the browser, in memory
 * for the headless simulator. Export as JSON from the Stats screen.
 */
(function () {
  const AMB = (globalThis.AMB = globalThis.AMB || {});
  const KEY = 'amb_telemetry_v1';

  function empty() {
    return { matches: 0, draws: 0, totalRounds: 0, totalSeconds: 0, heroes: {}, units: {}, synergies: {}, summons: { used: 0, wins: 0 }, styles: {}, recent: [] };
  }

  const memory = { data: empty() };
  const hasLS = () => { try { return typeof localStorage !== 'undefined' && localStorage !== null; } catch (e) { return false; } };

  function load() {
    if (!hasLS()) return memory.data;
    try { return JSON.parse(localStorage.getItem(KEY)) || empty(); } catch (e) { return empty(); }
  }
  function save(d) {
    if (!hasLS()) { memory.data = d; return; }
    try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* storage blocked: ignore */ }
  }

  function bump(obj, key, field, n) {
    obj[key] = obj[key] || {};
    obj[key][field] = (obj[key][field] || 0) + (n == null ? 1 : n);
  }

  /** Record a finished match. */
  function recordMatch(match, extra) {
    const d = load();
    d.matches++;
    if (match.winner === null) d.draws++;
    d.totalRounds += match.round;
    const secs = extra && extra.seconds != null ? extra.seconds : Math.round(((match.endedAt || Date.now()) - match.startedAt) / 1000);
    d.totalSeconds += secs;
    const last = match.history[match.history.length - 1];
    match.players.forEach((p, i) => {
      const won = match.winner === i;
      bump(d.heroes, p.heroId, 'picks');
      if (won) bump(d.heroes, p.heroId, 'wins');
      const styleKey = p.isAI ? 'ai:' + p.aiStyle : 'human';
      bump(d.styles, styleKey, 'picks');
      if (won) bump(d.styles, styleKey, 'wins');
      // units fielded at any point in the match (counted once per match)
      const fielded = new Set();
      match.history.forEach((r) => r.players[i].board.forEach((u) => fielded.add(u.defId)));
      fielded.forEach((id) => { bump(d.units, id, 'picks'); if (won) bump(d.units, id, 'wins'); });
      const finalBoard = last ? last.players[i].board : [];
      finalBoard.forEach((u) => { bump(d.units, u.defId, 'final'); if (u.star === 3) bump(d.units, u.defId, 'threeStar'); });
      const syns = new Set();
      match.history.forEach((r) => r.players[i].synergies.forEach((s) => syns.add(s)));
      syns.forEach((s) => { bump(d.synergies, s, 'picks'); if (won) bump(d.synergies, s, 'wins'); });
      const summoned = match.history.some((r) => r.players[i].summoned);
      if (summoned) { d.summons.used++; if (won) d.summons.wins++; }
    });
    d.recent.unshift({ at: Date.now(), mode: match.mode, heroes: match.players.map((p) => p.heroId), winner: match.winner, rounds: match.round, seconds: secs });
    d.recent = d.recent.slice(0, 20);
    save(d);
    return d;
  }

  function reset() { save(empty()); }

  AMB.telemetry = { load, save, recordMatch, reset, empty };
})();
