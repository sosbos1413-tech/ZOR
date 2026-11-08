/*
 * Online play, logic only (no network, no DOM, so it is testable in Node).
 *
 * Both phones run the SAME Match (same seed, `isolated: true` = every player has their own random stream,
 * unit pool and unit ids). A player only sends the list of moves they made during prep; the other phone replays
 * those moves on its copy of that player. Combat is deterministic, so both phones get the same fight and result.
 *
 *   const rec = AMB.NetSync.record(match, myIndex);   // start recording MY moves
 *   ...player plays...                                  // match.buy(myIndex, 2), match.move(...)
 *   const ops = rec.take();                             // -> [['buy', 2], ['move', 'u0_3', {...}], ...]  (send this)
 *   AMB.NetSync.replay(match, otherIndex, ops);         // the other phone applies them to the other player
 */
(function () {
  const AMB = (globalThis.AMB = globalThis.AMB || {});
  // every call a player can make during prep or the reward draft
  const OPS = ['buy', 'reroll', 'buyXp', 'toggleLock', 'sell', 'move', 'buyItem', 'equip', 'unequip', 'sellItem', 'armSpell', 'disarmSpell', 'setAbility', 'toggleSummon', 'moveHero', 'autoArrange', 'claimReward'];

  function record(match, idx) {
    const ops = []; let depth = 0;
    OPS.forEach((name) => {
      const orig = match[name]; if (typeof orig !== 'function' || orig.__net) return;
      const wrapped = function (pi, ...args) {
        const top = depth === 0;
        depth++;
        let r;
        try { r = orig.call(this, pi, ...args); } finally { depth--; }
        if (top && pi === idx && !(r && r.ok === false)) ops.push([name, ...JSON.parse(JSON.stringify(args))]);   // only my own successful top-level moves
        return r;
      };
      wrapped.__net = true; wrapped.__orig = orig;
      match[name] = wrapped;
    });
    // engine-driven steps call the move methods themselves (autoFill moves bench units onto the board): never record those
    ['autoFill', 'startRound', 'createCombat', 'resolveCombat', 'offerRewards'].forEach((name) => {
      const orig = match[name]; if (typeof orig !== 'function' || orig.__net) return;
      const wrapped = function (...args) { depth++; try { return orig.apply(this, args); } finally { depth--; } };
      wrapped.__net = true; wrapped.__orig = orig; match[name] = wrapped;
    });
    return { take() { const o = ops.splice(0, ops.length); return o; }, peek: () => ops.slice() };
  }

  function replay(match, pi, ops) {
    const failed = [];
    if (!Array.isArray(ops) || ops.length > 200) return ['ops'];
    for (const op of ops) {
      if (!Array.isArray(op) || typeof op[0] !== 'string') { failed.push('shape'); continue; }
      const [name, ...args] = op;
      const fn = OPS.includes(name) && match[name] && (match[name].__orig || match[name]);
      if (typeof fn !== 'function') { failed.push(name); continue; }
      try {
        const r = fn.call(match, pi, ...args);
        if (r && r.ok === false) failed.push(name + ':' + r.reason);
      } catch (e) { failed.push(name + ':exception'); }   // a malformed op from the peer must never hang the match
    }
    return failed;   // should always be empty: a non-empty list means the two phones disagree
  }

  // a short fingerprint of everything that matters, to check both phones are still identical
  function hash(match) {
    const snap = match.players.map((p) => ({
      g: p.gold, l: p.life, lv: p.level, xp: p.xp, ess: p.essence, shop: p.shop, bench: p.bench.map((u) => u && [u.uid, u.defId, u.star, u.items]),
      board: Object.keys(p.board).sort().map((k) => [k, p.board[k].uid, p.board[k].defId, p.board[k].star, p.board[k].items]), items: p.items,
      spells: p.armedSpells, ab: p.abilities, sum: p.summoned, hs: p.heroSlot, bl: p.blessings,
      pool: match.isolated ? p.pool : null,   // each phone's own unit pool (online): a pool drift changes future shops, so it must be part of the fingerprint
    }));
    const s = JSON.stringify([match.round, snap, match.isolated ? null : match.pool]);
    let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  }

  AMB.NetSync = { OPS, record, replay, hash };
})();
