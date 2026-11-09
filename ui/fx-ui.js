/*
 * Rarity-scaled "weight" effects (presentation only, nothing here touches the game rules):
 *   - pack reveal: the rarer the card, the bigger the build-up, flash, rays, rings, screen shake and sound
 *   - landing on the battlefield: the rarer the card, the harder the ground shakes
 * Rarity order: 1 common (almost nothing) … 4 legendary (the whole screen shakes).
 */
(function () {
  const AMB = globalThis.AMB;
  const UI = () => globalThis.AMB_UI;
  const RAR = () => AMB.ECONOMY.rarities;
  const calm = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  const buzz = (p) => { try { if (document.body.classList.contains('no-vibe')) return; if (navigator.vibrate) navigator.vibrate(p); } catch (e) { /* ignore */ } };   // senior #38: vibration can be turned off
  const ord = (r) => (RAR()[r] ? RAR()[r].order : 1);
  const col = (r) => (RAR()[r] ? RAR()[r].color : '#fff');

  function shake(el, level) {   // level 1..4 → how far and how long the ground moves
    if (!el || calm()) return;
    const amp = [0, 0, 2, 3.5, 5][level] || 0, ms = [0, 0, 200, 320, 520][level] || 0;   // heavy but calm: a deep, short tremor, never a jolt if (!amp) return;
    el.style.setProperty('--amp', amp + 'px'); el.style.setProperty('--ms', ms + 'ms');
    el.classList.remove('fx-shake'); void el.offsetWidth; el.classList.add('fx-shake');
    setTimeout(() => el.classList.remove('fx-shake'), ms + 40);
  }
  function tint(color, level, ms) {   // a flash over the whole screen
    if (calm()) return;
    const d = document.createElement('div'); d.className = 'fx-flash'; d.style.setProperty('--c', color); d.style.setProperty('--a', [0, 0, 0.08, 0.14, 0.26][level] || 0.1); d.style.setProperty('--ms', (ms || 520) + 'ms');
    document.body.appendChild(d); setTimeout(() => d.remove(), (ms || 520) + 60);
  }
  function rings(el, color, n, size) {   // shock-waves spreading from an element
    if (!el || calm()) return;
    const r = el.getBoundingClientRect();
    for (let i = 0; i < n; i++) {
      const q = document.createElement('i'); q.className = 'fx-ring'; q.style.setProperty('--c', color); q.style.setProperty('--sz', size + 'px'); q.style.setProperty('--dl', i * 130 + 'ms');
      q.style.left = r.left + r.width / 2 + 'px'; q.style.top = r.top + r.height / 2 + 'px';
      document.body.appendChild(q); setTimeout(() => q.remove(), 1100 + i * 130);
    }
  }
  function cracks(el, color) {   // cracks in the ground around a legendary landing
    if (!el || calm()) return;
    const r = el.getBoundingClientRect(), q = document.createElement('i'); q.className = 'fx-crack'; q.style.setProperty('--c', color);
    q.style.left = r.left + r.width / 2 + 'px'; q.style.top = r.top + r.height * 0.85 + 'px';
    document.body.appendChild(q); setTimeout(() => q.remove(), 1500);
  }

  /** A card was just placed on the battlefield. */
  function land(el, rarity) {
    const ui = UI(), L = ord(rarity), c = col(rarity); if (!el || !ui) return;
    ui.sfx('land' + L);
    if (L >= 2 && ui.burst) ui.burst(el, c, [0, 6, 10, 14, 22][L], { r: [0, 30, 42, 56, 84][L], s: L >= 4 ? 8 : 6 });
    if (L === 1 && ui.burst) ui.burst(el, '#d8cfb8', 5, { r: 22, s: 4 });
    if (L >= 2) rings(el, c, L >= 4 ? 2 : 1, [0, 0, 110, 160, 240][L]);
    if (L >= 3) tint(c, L, L === 4 ? 900 : 600);
    if (L >= 4) cracks(el, c);
    shake(L >= 4 ? document.getElementById('scr-match') : document.getElementById('field'), L);
    if (L >= 3 && !calm()) { const t = el.querySelector('.tcard') || el; t.classList.remove('fx-slam'); void t.offsetWidth; t.classList.add('fx-slam'); if (L >= 4) t.classList.add('big'); setTimeout(() => t.classList.remove('fx-slam', 'big'), 700); }
    buzz([0, 0, 10, 20, [30, 30, 50]][L] || 0);
  }

  // called after every match render: any of my cards that just arrived on the field gets its landing
  let seen = null;
  function watch() {
    const S = ui_S(); if (!S || !S.match) { seen = null; return; }
    const p = S.match.players[S.v];
    const now = new Set(Object.values(p.board || {}).filter(Boolean).map((u) => u.uid));
    if (!seen || seen.m !== S.match || seen.v !== S.v) { seen = { m: S.match, v: S.v, ids: now }; return; }
    const fresh = [...now].filter((id) => !seen.ids.has(id)); seen.ids = now;
    if (S.phase === 'combat' || !fresh.length) return;
    fresh.forEach((id, i) => {
      const u = Object.values(p.board).find((x) => x && x.uid === id); if (!u) return;
      const el = document.querySelector(`#slots [data-drag="unit:${id}"]`) || document.querySelector(`[data-drag="unit:${id}"]`);
      if (el) setTimeout(() => land(el, AMB.collection ? AMB.collection.rarity(u.defId) : 'common'), 40 + i * 120);
    });
  }
  const ui_S = () => (UI() && UI().S) || null;

  /** Pack reveal: timing + effects for the card at position `i` of the (rarity-ascending) row. */
  function revealTimes(cards) {
    let t = 0.35; const out = [];
    cards.forEach((c) => { const L = ord(c.rarity); t += L === 4 ? 1.5 : L === 3 ? 0.7 : 0.4; out.push(t); });
    return out;
  }
  function reveal(el, rarity, wrap, card) {
    const ui = UI(), L = ord(rarity), c = col(rarity); if (!el || !ui) return;
    el.classList.add('hit');
    if (L === 1) { ui.sfx('click'); return; }
    if (L === 2) { ui.sfx('merge'); ui.burst && ui.burst(el, c, 14, { r: 100, s: 7 }); rings(el, c, 1, 220); return; }
    const ov = document.getElementById('overlay');
    ui.sfx(L === 3 ? 'epicHit' : 'legend');
    ui.burst && [c, '#ffd24a'].forEach((cc, k) => ui.burst(el, cc, L === 4 ? 18 : 12, { r: L === 4 ? 120 + k * 20 : 100, s: L === 4 ? 8 : 7 }));
    rings(el, c, L === 4 ? 2 : 1, L === 4 ? 420 : 280);
    tint(c, L, L === 4 ? 1100 : 700);
    shake(ov && ov.firstElementChild, L === 4 ? 4 : 3);
    buzz(L === 4 ? [40, 40, 80] : [25, 25, 40]);
    if (wrap) { wrap.classList.add('rv-hit-' + rarity); setTimeout(() => wrap.classList.remove('rv-hit-' + rarity), 1500); }
  }
  /** Build-up before a rare card turns: the screen darkens and a rumble grows. */
  function charge(wrap, rarity) {
    const ui = UI(), L = ord(rarity); if (!ui || L < 3) return;
    wrap && wrap.classList.add('rv-charge-' + L);
    ui.sfx(L === 4 ? 'charge' : 'epicCharge'); buzz(L === 4 ? [30, 30, 40, 30, 60, 30, 90] : [30, 30, 40]);
    setTimeout(() => wrap && wrap.classList.remove('rv-charge-' + L), L === 4 ? 1500 : 700);
  }

  AMB.FX = { land, watch, reveal, charge, revealTimes, shake, tint, rings, ord };
})();
