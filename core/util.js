(function () {
  const AMB = (globalThis.AMB = globalThis.AMB || {});

  // Seeded RNG (mulberry32): same seed => same shops and same combat.
  function RNG(seed) {
    let a = seed >>> 0 || 1;
    const next = () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    return {
      next,
      int: (n) => Math.floor(next() * n),
      pick: (arr) => arr[Math.floor(next() * arr.length)],
      chance: (p) => next() < p,
      weighted(entries) { // [[value, weight], ...]
        const total = entries.reduce((s, e) => s + e[1], 0);
        if (total <= 0) return null;
        let r = next() * total;
        for (const [v, w] of entries) { if ((r -= w) < 0) return v; }
        return entries[entries.length - 1][0];
      },
      fork: () => RNG(Math.floor(next() * 2 ** 31)),
    };
  }

  let uidCounter = 1;
  const uid = (p) => (p || 'u') + (uidCounter++).toString(36);

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  AMB.util = { RNG, uid, clamp, dist };
})();
