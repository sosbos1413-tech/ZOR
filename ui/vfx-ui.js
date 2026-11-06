/*
 * Role effects in combat (presentation only): every role attacks and casts with its own look and sound.
 *   fighter  heavy crossing slash          assassin  violet dash + two thin cuts
 *   mage     glowing orb + rune circle     marksman  fast tracer + crosshair
 *   guardian metal shockwave + sparks      support   soft light pulse
 * Called from the combat event loop in ui.js; nothing here touches the game rules.
 */
(function () {
  const AMB = globalThis.AMB;
  const calm = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  const COL = { fighter: '#ffb347', assassin: '#b66bff', mage: '#5fe3ff', marksman: '#fff0a0', guardian: '#8fd4ff', support: '#6dffa0' };
  let live = 0;

  function ctr(el) { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }; }
  function mk(cls, css, ms) {
    if (live > 70) return null;
    const d = document.createElement('i'); d.className = 'vf ' + cls;
    Object.entries(css || {}).forEach(([k, v]) => (k.startsWith('--') ? d.style.setProperty(k, v) : (d.style[k] = v)));
    document.body.appendChild(d); live++;
    setTimeout(() => { d.remove(); live--; }, ms || 600);
    return d;
  }
  const ang = (a, b) => Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
  const dst = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);

  const ATTACK = {
    fighter(a, b, c) {   // two heavy strokes crossing on the target
      [-38, 38].forEach((r, i) => mk('vf-slash', { left: b.x + 'px', top: b.y + 'px', '--r': r + 'deg', '--c': c, '--d': i * 55 + 'ms', '--w': Math.max(40, b.w * 0.95) + 'px' }, 520));
      mk('vf-flashdot', { left: b.x + 'px', top: b.y + 'px', '--c': c, '--s': b.w * 0.8 + 'px' }, 320);
    },
    assassin(a, b, c) {   // a streak across the gap, two thin cuts, and the attacker blinks
      mk('vf-dash', { left: a.x + 'px', top: a.y + 'px', '--len': dst(a, b) + 'px', '--r': ang(a, b) + 'deg', '--c': c }, 340);
      [-14, 22].forEach((r, i) => mk('vf-cut', { left: b.x + 'px', top: b.y + 'px', '--r': r + 'deg', '--c': i ? '#ff5b82' : '#e7d2ff', '--d': 90 + i * 70 + 'ms', '--w': Math.max(34, b.w * 0.9) + 'px' }, 520));
    },
    mage(a, b, c) {   // an orb travels, then opens into a ring of light
      mk('vf-rune small', { left: a.x + 'px', top: a.y + 'px', '--c': c }, 520);
      const o = mk('vf-orb', { left: a.x + 'px', top: a.y + 'px', '--c': c }, 520);
      if (o) { requestAnimationFrame(() => requestAnimationFrame(() => { o.style.left = b.x + 'px'; o.style.top = b.y + 'px'; })); setTimeout(() => { o.style.opacity = '0'; }, 230); }
      setTimeout(() => {
        mk('vf-ring', { left: b.x + 'px', top: b.y + 'px', '--c': c, '--s': b.w * 1.5 + 'px' }, 520);
        for (let k = 0; k < 6; k++) mk('vf-star', { left: b.x + 'px', top: b.y + 'px', '--c': c, '--a': k * 60 + 'deg', '--dd': 26 + (k % 2) * 12 + 'px' }, 600);
      }, 210);
    },
    marksman(a, b, c) {   // a thin fast tracer with a crosshair on the target
      mk('vf-muzzle', { left: a.x + 'px', top: a.y + 'px', '--c': c, '--r': ang(a, b) + 'deg' }, 200);
      mk('vf-bolt', { left: a.x + 'px', top: a.y + 'px', '--len': dst(a, b) + 'px', '--r': ang(a, b) + 'deg', '--c': c }, 300);
      setTimeout(() => mk('vf-cross', { left: b.x + 'px', top: b.y + 'px', '--c': c, '--s': b.w * 0.9 + 'px' }, 420), 90);
    },
    guardian(a, b, c) {   // a flat metal shockwave with sparks
      mk('vf-wave', { left: b.x + 'px', top: b.y + 'px', '--c': c, '--s': b.w * 1.7 + 'px' }, 520);
      for (let k = 0; k < 5; k++) mk('vf-spark', { left: b.x + 'px', top: b.y + 'px', '--a': -80 + k * 40 + 'deg', '--c': '#fff', '--dd': 22 + (k % 2) * 10 + 'px' }, 420);
    },
    support(a, b, c) {   // a soft pulse and a few sparkles
      mk('vf-ring soft', { left: b.x + 'px', top: b.y + 'px', '--c': c, '--s': b.w * 1.3 + 'px' }, 600);
      for (let k = 0; k < 4; k++) mk('vf-mote', { left: b.x + (k - 1.5) * 10 + 'px', top: b.y + 'px', '--c': c, '--d': k * 60 + 'ms' }, 800);
    },
  };

  const CAST = {
    fighter(a, c) { mk('vf-quake', { left: a.x + 'px', top: a.y + a.h * 0.35 + 'px', '--c': c, '--s': a.w * 3.2 + 'px' }, 700); },
    assassin(a, c) { mk('vf-smoke', { left: a.x + 'px', top: a.y + 'px', '--c': c, '--s': a.w * 2 + 'px' }, 700); for (let k = 0; k < 8; k++) mk('vf-star dark', { left: a.x + 'px', top: a.y + 'px', '--c': c, '--a': k * 45 + 'deg', '--dd': 36 + 'px' }, 600); },
    mage(a, c) { mk('vf-rune', { left: a.x + 'px', top: a.y + 'px', '--c': c, '--s': a.w * 2.6 + 'px' }, 900); mk('vf-ring', { left: a.x + 'px', top: a.y + 'px', '--c': c, '--s': a.w * 2.2 + 'px' }, 600); },
    marksman(a, c) { mk('vf-cross big', { left: a.x + 'px', top: a.y + 'px', '--c': c, '--s': a.w * 1.8 + 'px' }, 600); },
    guardian(a, c) { mk('vf-dome', { left: a.x + 'px', top: a.y + 'px', '--c': c, '--s': a.w * 2.6 + 'px' }, 800); },
    support(a, c) { mk('vf-ring soft big', { left: a.x + 'px', top: a.y + 'px', '--c': c, '--s': a.w * 3 + 'px' }, 800); for (let k = 0; k < 6; k++) mk('vf-mote', { left: a.x + (k - 2.5) * 12 + 'px', top: a.y + 'px', '--c': c, '--d': k * 70 + 'ms' }, 900); },
  };

  function attack(from, to, elFrom, elTo, ui) {
    if (calm() || !from || !to || !elFrom || !elTo) return false;
    const role = from.role || (from.isHero ? 'fighter' : null), fn = ATTACK[role]; if (!fn) return false;
    const a = ctr(elFrom), b = ctr(elTo);
    fn(a, b, COL[role]);
    if (ui && ui.sfx) ui.sfx('v_' + role);
    if (role === 'assassin') { elFrom.classList.add('vf-blink'); setTimeout(() => elFrom.classList.remove('vf-blink'), 260); }
    return true;
  }
  function cast(f, el, ui) {
    if (calm() || !f || !el) return;
    const role = f.role || null, fn = CAST[role]; if (!fn) return;
    const col = role === 'mage' ? ((AMB.DATA.WORLDS[f.world] || {}).color || COL.mage) : COL[role];
    fn(ctr(el), col);
    if (ui && ui.sfx) ui.sfx('c_' + role);
  }
  AMB.VFX = { attack, cast, COL };
})();
