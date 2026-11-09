/*
 * The guided first match. A ring + a pointing hand show the next move, a small bar shows it as symbols, and everything
 * else is locked until the move is done (so a beginner cannot get lost). No sentences: only icons and numbers.
 * Core (match, scripted shop, reward): core/tutorial.js.
 */
(function () {
  const AMB = globalThis.AMB;
  const $ = (id) => document.getElementById(id);
  const TU = AMB.tutorial, C = AMB.collection;
  const { icon } = AMB.art;
  const UI = () => globalThis.AMB_UI;
  let active = false, idx = 0, replay = false, after = null, rerolled = 0, timer = 0, lastKey = '';
  let ring, hand, bar, point = null, xpBase = null;   // point = the element the hand points at now

  // ---------------------------------------------------------------- finding things on the screen
  const q = (sel) => document.querySelector(sel);
  const vis = (el) => el && el.offsetParent !== null && el.getBoundingClientRect().width > 4;
  const shopCard = (n) => { const defId = TU.SHOP[UI().S.match.round][n]; return q(`.shop-cards .tcard[data-idx="${n}"]`) || null; };
  const firstShopWith = (id) => { const p = UI().S.match.players[0]; const i = p.shop.findIndex((x) => x === id); return i < 0 ? null : q(`.shop-cards .tcard[data-idx="${i}"]`); };
  const benchUnit = () => q('#bench .bslot .tcard');
  const cell = (slot) => q(`#slots .cell.mine[data-slot="${slot}"]`);
  const ready = () => q('.ready-btn');
  const reroll = () => q('#shopbar [data-act="reroll"]');
  // the guard step points at what actually protects the hero: the shield counter (wide screens) or the front-row unit you just placed (phones)
  const guardEl = () => {
    const a = q('#panel-left .guard'); if (vis(a)) return a;
    const fr = [...document.querySelectorAll('#slots .cell.mine[data-slot^="f"]')].find((c) => c.querySelector('.tcard'));
    return fr || cell('f1');
  };
  const sel = () => UI().S.sel;
  const P = () => UI().S.match.players[0];
  const front = () => Object.keys(P().board).filter((s) => s[0] === 'f').length;
  const back = () => Object.keys(P().board).filter((s) => s[0] === 'b').length;
  const units = () => UI().S.match.allUnits(P()).length;

  const G = (n) => icon(n);
  const ARR = '<i class="tg-arr">➜</i>';
  const STEPS = [
    { id: 'buy1', round: 1, bar: [G('gold'), ARR, '🃏'], target: () => shopCard(0), done: () => units() >= 1 },
    { id: 'front', round: 1, bar: ['🃏', ARR, G('shield')], target: () => (sel() && sel().kind === 'unit' ? { point: cell('f1'), allow: [cell('f1'), benchUnit()] } : { point: benchUnit(), allow: [benchUnit(), cell('f1')] }), done: () => front() >= 1 },
    { id: 'buy2', round: 1, bar: [G('gold'), ARR, '🃏'], target: () => shopCard(2), done: () => units() >= 2 },
    { id: 'back', round: 1, bar: ['🃏', ARR, G('bow')], target: () => (sel() && sel().kind === 'unit' ? { point: cell('b1'), allow: [cell('b1'), benchUnit()] } : { point: benchUnit(), allow: [benchUnit(), cell('b1')] }), done: () => back() >= 1 },
    { id: 'guard', round: 1, ack: true, bar: [G('shield'), '=', G('check')], target: () => guardEl() },
    { id: 'ready1', round: 1, bar: [G('sword'), G('check')], target: () => ready(), done: () => UI().S.phase === 'combat' || UI().S.match.round > 1 },
    { id: 'merge', round: 2, bar: ['🃏', '🃏', '🃏', ARR, G('star')], target: () => { for (let i = 0; i < 3; i++) { const el = q(`.shop-cards .tcard[data-idx="${i}"]:not(.empty)`); if (el && P().shop[i]) return el; } return null; }, done: () => UI().S.match.allUnits(P()).some((u) => u.star >= 2) },
    { id: 'reroll', round: 2, bar: [G('gold'), G('refresh')], target: () => reroll(), done: () => P().stats.rerolls >= 1 },
    { id: 'ready2', round: 2, bar: [G('sword'), G('check')], target: () => ready(), done: () => UI().S.phase === 'combat' || UI().S.match.round > 2 },
    // round 3: the two things that decide real matches: spend gold on levels (more units on the board), and send the hero in
    { id: 'xp', round: 3, bar: [G('gold'), ARR, G('up')], target: () => q('#shopbar [data-act="xp"]') || q('[data-act="xp"]'), done: () => xpBase != null && P().level * 1000 + P().xp > xpBase },   // the round's free XP does not count: only a bought level-up
    { id: 'summon', round: 3, bar: [G('crown'), ARR, G('sword')], target: () => q('[data-act="summon"]'), done: () => P().summoned },
    { id: 'ready3', round: 3, bar: [G('sword'), G('check')], target: () => ready(), done: () => UI().S.phase === 'combat' },
  ];

  // ---------------------------------------------------------------- layers
  function mount() {
    if (ring) return;
    ring = document.createElement('div'); ring.className = 'tut-ring'; document.body.appendChild(ring);
    hand = document.createElement('div'); hand.className = 'tut-hand'; hand.innerHTML = icon('hand'); document.body.appendChild(hand);
    bar = document.createElement('div'); bar.className = 'tut-bar'; document.body.appendChild(bar);
    bar.addEventListener('click', (e) => { if (e.target.closest('[data-tut="ok"]')) { idx++; lastKey = ''; tick(); } else if (e.target.closest('[data-tut="skip"]')) skip(); });
    document.addEventListener('click', ackTap, true);
  }
  // a "look here" step (no move to make): tapping the thing the hand points at moves on, instead of opening/selecting it
  function ackTap(e) {
    const st = STEPS[idx];
    if (!active || !st || !st.ack || !point || !point.isConnected || !point.contains(e.target)) return;
    e.preventDefault(); e.stopPropagation();
    idx++; lastKey = ''; tick();
  }
  function hide() { point = null; if (ring) { ring.style.display = 'none'; hand.style.display = 'none'; bar.style.display = 'none'; } document.querySelectorAll('.tut-target').forEach((e) => e.classList.remove('tut-target')); document.body.classList.remove('tut-on'); }
  function unmount() { document.removeEventListener('click', ackTap, true); point = null; [ring, hand, bar].forEach((e) => e && e.remove()); ring = hand = bar = null; document.querySelectorAll('.tut-target').forEach((e) => e.classList.remove('tut-target')); document.body.classList.remove('tut-on'); }

  function place(targets, st) {
    const spec = targets && targets.point !== undefined ? targets : { point: targets, allow: [targets] };
    const list = [].concat(spec.allow).filter(Boolean).filter(vis);
    document.querySelectorAll('.tut-target').forEach((e) => { if (!list.includes(e)) e.classList.remove('tut-target'); });
    list.forEach((e) => e.classList.add('tut-target'));
    // the ring + hand mark the thing to tap now; the other allowed element stays clickable (e.g. to change the selected unit)
    const t = vis(spec.point) ? spec.point : null;
    point = t;
    if (!t) { ring.style.display = 'none'; hand.style.display = 'none'; return; }
    const row = t.closest('.shop-row'); if (row && t.closest('.shop-cards')) { const r = t.getBoundingClientRect(), rr = row.getBoundingClientRect(); if (r.left < rr.left || r.right > rr.right) t.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' }); }
    const r = t.getBoundingClientRect(), pad = 6;
    Object.assign(ring.style, { display: 'block', left: r.left - pad + 'px', top: r.top - pad + 'px', width: r.width + pad * 2 + 'px', height: r.height + pad * 2 + 'px' });
    const hx = r.right - Math.min(22, r.width * 0.3), hy = r.top + r.height * 0.5;   // at the edge: never over the card's name, price or numbers
    Object.assign(hand.style, { display: 'block', left: Math.min(innerWidth - 40, Math.max(4, hx - 4)) + 'px', top: Math.min(innerHeight - 50, hy) + 'px' });
  }

  // ---------------------------------------------------------------- the loop
  function tick() {
    if (!active) return;
    const ui = UI(), S = ui.S;
    if (S.screen !== 'match' || S.mode !== 'tutorial' || !S.match) { hide(); if (S.screen !== 'match' && S.screen !== 'results' && S.mode === 'tutorial') { /* left the match: stop the guide */ stop(); } return; }
    if (S.phase !== 'prep' || $('overlay').classList.contains('on') || $('modal-back').classList.contains('on')) { hide(); return; }
    const m = S.match;
    while (STEPS[idx] && STEPS[idx].round < m.round) idx++;                 // never get stuck on a past round
    while (STEPS[idx] && STEPS[idx].done && STEPS[idx].round === m.round && STEPS[idx].done()) { idx++; lastKey = ''; }
    const st = STEPS[idx];
    if (!st || st.round !== m.round) { hide(); return; }
    if (st.id === 'xp' && xpBase == null) xpBase = P().level * 1000 + P().xp;
    mount(); document.body.classList.add('tut-on');
    bar.style.display = 'flex'; ring.style.display = 'block'; hand.style.display = 'block';
    const key = idx + ':' + (sel() ? sel().kind : '') + ':' + m.round;
    if (key !== lastKey) {
      lastKey = key;
      bar.innerHTML = `<span class="tg-ic">${st.bar.join('')}</span>${st.ack ? `<button class="tg-ok" data-tut="ok">${icon('check')}</button>` : ''}<span class="tg-dots">${STEPS.map((x, i) => `<i class="${i < idx ? 'done' : i === idx ? 'now' : ''}"></i>`).join('')}</span>${replay ? `<button class="tg-skip" data-tut="skip">${icon('skip')}</button>` : ''}`;
    }
    place(st.target(), st);
  }
  function poke() { if (active) tick(); }
  function stop() { active = false; clearInterval(timer); unmount(); }

  // ---------------------------------------------------------------- start / finish
  function start(o) {
    o = o || {};
    const ui = UI(), S = ui.S;
    replay = !!o.replay || !TU.required(); after = o.after || null;
    if (o.replay && C.needsStarter()) { ui.toast('اختر بطلك أول', 'err'); return; }
    ui.closeOverlay(); ui.closeModal();
    S.mode = 'tutorial'; S.picks = [C.starterHero() || Object.keys(AMB.DATA.HEROES)[0], null]; S.pickIdx = 0;
    idx = 0; rerolled = 0; lastKey = ''; xpBase = null; active = true;
    clearInterval(timer); timer = setInterval(tick, 220);
    ui.startMatch();
  }
  function skip() {   // replays only
    stop(); const ui = UI(); ui.closeOverlay(); ui.show('menu');
  }
  /** called from ui.js when the guided match ends */
  function showResult(m, secs) {
    const ui = UI(); stop();
    const won = m.winner === 0, r = TU.complete();
    $('results').innerHTML = `<div class="res-stage victory" style="--wc:#ffd24a"><div class="res-rays"></div>
        <div class="res-hero">${ui.portrait(AMB.DATA.HEROES[m.players[0].heroId], { bare: true, k: 'tur' })}<i class="sheen"></i></div></div>
      <div class="res-banner tut-done"><div class="td-big">${icon('crown')}</div>
        ${r.shards ? `<div class="td-reward">${icon('gem')} +${r.shards}</div>` : `<div class="td-reward">${icon('check')}</div>`}</div>
      <div class="cam-btns"><button class="btn primary big" data-act="tutDone">${icon('sword')}</button>${replay ? `<button class="btn big ghost" data-act="again">${icon('refresh')}</button>` : ''}</div>`;
    ui.show('results'); ui.sfx('win');
    setTimeout(() => { const el = document.querySelector('.res-hero'); if (el) ['#ffd24a', '#ffffff', '#5fe3ff'].forEach((c) => ui.burst(el, c, 16, { r: 150, s: 8 })); }, 250);
  }
  function installActions() {
    const ui = UI(); if (!ui || ui.ACT.tutDone) return;
    Object.assign(ui.ACT, { tutDone: () => { const f = after; after = null; ['PacksUI', 'CampaignUI', 'CollectionUI'].forEach((k) => AMB[k] && AMB[k].refreshMenu && AMB[k].refreshMenu()); if (f) f(); else ui.show('menu'); } });
  }

  AMB.TutorialUI = { start, poke, showResult, installActions, active: () => active };
  if (UI()) installActions();
})();
