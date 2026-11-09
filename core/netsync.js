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
 *
 * Checks: every incoming op is shape-checked (checkOp) before it touches the match; `hash` is compared after each prep and
 * reward step, `combatPrint` after each fight. Room codes, the broker id, the relay topic and the relay signing key are here too.
 */
(function () {
  const AMB = (globalThis.AMB = globalThis.AMB || {});
  // every call a player can make during prep or the reward draft
  const OPS = ['buy', 'reroll', 'buyXp', 'toggleLock', 'sell', 'move', 'buyItem', 'equip', 'unequip', 'sellItem', 'armSpell', 'disarmSpell', 'setAbility', 'toggleSummon', 'moveHero', 'autoArrange', 'claimReward', 'setWager', 'setHunt'];

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

  // the shape of every op's arguments (after the player index). A friend's op is checked against this BEFORE it reaches the
  // match, so a malformed or hostile message is a reported failure, never an exception or a strange coercion
  // (e.g. disarmSpell('x') would act on slot 0, buy(1.5) reads shop[1.5]).  '?' = may be missing or null.
  const ARGS = {
    buy: ['int'], reroll: [], buyXp: [], toggleLock: [], sell: ['uid'], move: ['uid', 'dest'], buyItem: ['int'],
    equip: ['int', 'uid'], unequip: ['uid'], sellItem: ['int'], armSpell: ['int'], disarmSpell: ['int'],
    setAbility: ['id', 'trig?'], toggleSummon: ['slot?'], moveHero: ['slot'], autoArrange: [], claimReward: ['int'], setWager: ['bool'], setHunt: ['id'],
  };
  const isInt = (v) => Number.isInteger(v) && v >= -1000 && v <= 1000;
  const isStr = (v, max) => typeof v === 'string' && v.length > 0 && v.length <= max;
  const CHECK = {
    bool: (v) => v === true || v === false, int: isInt, uid: (v) => isStr(v, 32), id: (v) => isStr(v, 40), slot: (v) => isStr(v, 4),
    trig: (v) => isStr(v, 20) && !!(AMB.DATA && Object.prototype.hasOwnProperty.call(AMB.DATA.ABILITY_TRIGGERS, v)),   // an ability trigger must be a known one
    dest: (v) => !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 2
      && (v.zone === 'board' ? isStr(v.slot, 4) : v.zone === 'bench' ? isInt(v.idx) : false),
  };
  /** null when the op is well formed, otherwise a short reason (the op is then never applied) */
  function checkOp(op) {
    if (!Array.isArray(op) || typeof op[0] !== 'string') return 'shape';
    const name = op[0], spec = OPS.includes(name) && Object.prototype.hasOwnProperty.call(ARGS, name) ? ARGS[name] : null;
    if (!spec) return 'unknown:' + name.slice(0, 20);
    const args = op.slice(1);
    if (args.length > spec.length) return name + ':args';
    for (let i = 0; i < spec.length; i++) {
      const t = spec[i], opt = t.endsWith('?'), v = args[i];
      if (opt && v == null) continue;
      if (!CHECK[opt ? t.slice(0, -1) : t](v)) return name + ':arg' + i;
    }
    return null;
  }

  function replay(match, pi, ops) {
    const failed = [];
    if (!Array.isArray(ops) || ops.length > 200) return ['ops'];
    for (const op of ops) {
      const bad = checkOp(op);
      if (bad) { failed.push(bad); continue; }
      const [name, ...args] = op;
      const fn = match[name] && (match[name].__orig || match[name]);
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

  // B7: a short fingerprint of one round's fight (round, winner, both lives after it, the fight length). Both phones compute it
  // after every combat and compare: the prep hash proves both STARTED the fight the same, this proves both GOT the same result.
  function combatPrint(report) {
    if (!report || !Array.isArray(report.players)) return '';
    const lives = report.players.map((p) => Math.round((Number(p.lifeAfter) || 0) * 10)).join('/');
    return [report.round, report.winner == null ? 'd' : report.winner, lives, Math.round((Number(report.duration) || 0) * 10)].join('|');
  }

  // ------------------------------------------------------------------ room codes and relay message signing (4.3)
  // Pure JS SHA-256 / HMAC-SHA256 (synchronous: messages stay in order, works on file:// and plain-http test pages where
  // WebCrypto is missing, and Node can test it). Messages are tiny, so speed does not matter.
  const K = new Uint32Array([0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);
  const utf8 = (s) => (typeof s === 'string' ? new TextEncoder().encode(s) : s);
  function sha256(data) {
    const msg = utf8(data), len = msg.length, n = ((len + 9 + 63) >> 6) << 6, b = new Uint8Array(n);
    b.set(msg); b[len] = 0x80;
    const bits = len * 8; b[n - 4] = bits >>> 24; b[n - 3] = (bits >>> 16) & 255; b[n - 2] = (bits >>> 8) & 255; b[n - 1] = bits & 255;
    b[n - 5] = Math.floor(len / 0x20000000) & 255;
    const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]), W = new Uint32Array(64);
    const rotr = (x, r) => (x >>> r) | (x << (32 - r));
    for (let o = 0; o < n; o += 64) {
      for (let i = 0; i < 16; i++) W[i] = (b[o + i * 4] << 24) | (b[o + i * 4 + 1] << 16) | (b[o + i * 4 + 2] << 8) | b[o + i * 4 + 3];
      for (let i = 16; i < 64; i++) {
        const s0 = rotr(W[i - 15], 7) ^ rotr(W[i - 15], 18) ^ (W[i - 15] >>> 3), s1 = rotr(W[i - 2], 17) ^ rotr(W[i - 2], 19) ^ (W[i - 2] >>> 10);
        W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0;
      }
      let [a, bb, c, d, e, f, g, h] = H;
      for (let i = 0; i < 64; i++) {
        const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + W[i]) | 0;
        const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & bb) ^ (a & c) ^ (bb & c))) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = bb; bb = a; a = (t1 + t2) | 0;
      }
      H[0] += a; H[1] += bb; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
    }
    const out = new Uint8Array(32);
    for (let i = 0; i < 8; i++) { out[i * 4] = H[i] >>> 24; out[i * 4 + 1] = (H[i] >>> 16) & 255; out[i * 4 + 2] = (H[i] >>> 8) & 255; out[i * 4 + 3] = H[i] & 255; }
    return out;
  }
  function hmac(key, data) {
    let k = utf8(key); if (k.length > 64) k = sha256(k);
    const ip = new Uint8Array(64), op = new Uint8Array(64);
    for (let i = 0; i < 64; i++) { ip[i] = (k[i] || 0) ^ 0x36; op[i] = (k[i] || 0) ^ 0x5c; }
    const m = utf8(data), inner = new Uint8Array(64 + m.length); inner.set(ip); inner.set(m, 64);
    const outer = new Uint8Array(96); outer.set(op); outer.set(sha256(inner), 64);
    return sha256(outer);
  }
  const hex = (u8) => Array.from(u8, (x) => x.toString(16).padStart(2, '0')).join('');

  // room code: 10 characters from 32 easy-to-read ones (no I/O/0/1) = 50 bits, shown as XXXXX-XXXXX. 32 divides 256, so no bias.
  const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', CODE_LEN = 10;
  function newCode(randomBytes) {
    const r = randomBytes ? randomBytes(CODE_LEN) : globalThis.crypto.getRandomValues(new Uint8Array(CODE_LEN));
    return Array.from(r, (x) => CODE_CHARS[x & 31]).join('');
  }
  /** what the friend typed or pasted -> the canonical code, or null. Forgiving about spaces, dashes and lower case */
  function normCode(text) {
    const c = String(text || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    return c.length === CODE_LEN && [...c].every((ch) => CODE_CHARS.includes(ch)) ? c : null;
  }
  const showCode = (c) => c.slice(0, 5) + '-' + c.slice(5);
  // everything the network sees is DERIVED from the code with one-way hashes: the broker id and the relay topic do not reveal the
  // code, and the signing key cannot be computed from them. Someone who does not know the code cannot find, read the topic of,
  // or inject into the room.
  function room(code) {
    return {
      peerId: 'zor-' + hex(sha256('zor/peer/v2/' + code)).slice(0, 32),
      topic: 'zor-' + hex(sha256('zor/topic/v2/' + code)).slice(0, 40),
      key: sha256('zor/key/v2/' + code),
    };
  }
  /** relay message body: 64 hex chars of HMAC, then the JSON payload (no extra escaping: relay messages must stay small) */
  const seal = (key, obj) => { const p = JSON.stringify(obj); return hex(hmac(key, p)) + p; };
  /** the payload object when the signature is right, otherwise null (the caller drops it silently) */
  function open(key, body) {
    if (typeof body !== 'string' || body.length < 66 || body.length > 60000) return null;
    const sig = body.slice(0, 64), p = body.slice(64), want = hex(hmac(key, p));
    let diff = 0; for (let i = 0; i < 64; i++) diff |= want.charCodeAt(i) ^ sig.charCodeAt(i);
    if (diff) return null;
    try { const o = JSON.parse(p); return o && typeof o === 'object' ? o : null; } catch (x) { return null; }
  }

  AMB.NetSync = { OPS, ARGS, checkOp, record, replay, hash, combatPrint, sha256, hmac, hex, newCode, normCode, showCode, room, seal, open, CODE_LEN };
})();
