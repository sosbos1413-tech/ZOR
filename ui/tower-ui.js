/*
 * "البرج" screen: a ladder of 30 floors. Climb one floor at a time (best-of-3 fight, like the campaign),
 * every 5th floor is a boss. Logic: core/tower.js, settings: AMB.ECONOMY.tower.
 */
(function () {
  const AMB = globalThis.AMB;
  const $ = (id) => document.getElementById(id);
  const TW = AMB.tower, C = AMB.collection, CAM = AMB.campaign;
  const { icon } = AMB.art;
  const UI = () => globalThis.AMB_UI;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const W = (id) => AMB.DATA.WORLDS[id];
  let hero = null;

  const pickHero = () => { const owned = C.ownedHeroes(); if (hero && owned.includes(hero)) return hero; return (hero = (C.starterHero() && owned.includes(C.starterHero()) ? C.starterHero() : owned[0]) || null); };
  const rewardHTML = (n) => { const r = TW.rewardsFor(n); return `${icon('gem')} ${r.shards}${r.pack ? ' · 📦' : ''}${r.card ? ' · 🃏' : ''}`; };

  function row(n) {
    const L = TW.lineupFor(n), cleared = n <= TW.best(), cur = n === TW.next() && !TW.done(), open = TW.canPlay(n);
    const art = L.boss ? UI().portrait(AMB.DATA.HEROES[L.heroId], { bare: true, k: 'tw' + n }) : `<b>${n}</b>`;
    return `<button class="twrow ${L.boss ? 'boss' : ''} ${cleared ? 'cleared' : ''} ${cur ? 'cur' : ''} ${open ? '' : 'locked'}" style="--wc:${W(L.world).color}" ${open ? `data-act="towFloor" data-n="${n}"` : 'disabled'}>
      <span class="tw-n">${art}</span>
      <span class="tw-mid"><b>${L.boss ? '👑 زعيم · ' : ''}الطابق ${n}</b><small>${W(L.world).name}${L.boss ? ' · ' + esc(L.special.name) : ''}</small></span>
      <span class="tw-rw">${cleared ? (n === TW.best() ? '✓' : '✓') : rewardHTML(n)}</span>
      ${cur ? '<span class="tw-go">قاتل</span>' : open ? '' : '<span class="tw-lock">🔒</span>'}</button>`;
  }

  function render() {
    const root = $('tower'); if (!root) return;
    if (C.needsStarter()) { root.innerHTML = '<div class="cam-note">اختر بطلك الأول من «الحملة» أول.</div>'; return; }
    if (!TW.unlocked()) { root.innerHTML = `<div class="cam-note">🔒 البرج يفتح بعد ما تنهي <b>المستوى الأول من الحملة</b> (${CAM.progress('l1').cleared}/${CAM.progress('l1').total}).</div>`; return; }
    const best = TW.best(), N = TW.floors();
    const floors = []; for (let n = N; n >= 1; n--) floors.push(row(n));
    root.innerHTML = `<div class="tw-head"><div class="tw-best"><small>أعلى طابق</small><b>${best}</b><span>/ ${N}</span></div>
        <div class="tw-prog"><i style="width:${(100 * best) / N}%"></i></div>
        <div class="hint">${TW.done() ? '🏆 أكملت البرج!' : `الجاي: الطابق ${TW.next()}`} <button class="ibtn" data-act="info" data-k="towinfo" title="شرح">ⓘ</button></div></div>
      <div class="twlist">${floors.join('')}</div>`;
    refreshMenu();
    const cur = root.querySelector('.twrow.cur'); if (cur && cur.scrollIntoView) setTimeout(() => cur.scrollIntoView({ block: 'center' }), 50);
  }

  function refreshMenu() {
    const b = $('menu-tower'); if (!b) return;
    const l = b.querySelector('.mt-l');
    l.innerHTML = TW.unlocked() ? `البرج <small>${TW.best()}/${TW.floors()}</small>` : 'البرج 🔒';
  }

  function preview(n) {
    const ui = UI(), L = TW.lineupFor(n), h = pickHero(), R = TW.rewardsFor(n), first = n > TW.best();
    const units = L.units.map(([id, star, , from], k) => `<div class="cu">${ui.portrait(AMB.DATA.UNITS[id], { k: 'twp' + k + id })}${ui.stars(star)}${from > 1 ? `<small>من الجولة ${from}</small>` : ''}</div>`).join('');
    const heroes = C.ownedHeroes().map((id) => `<button class="hchip ${id === h ? 'on' : ''}" data-act="towHero" data-id="${id}" data-n="${n}">${ui.portrait(AMB.DATA.HEROES[id], { k: 'twh' + id })}<span>${AMB.DATA.HEROES[id].name}</span></button>`).join('');
    const reward = first ? `${icon('gem')} ${R.shards} شظية · +${R.passXp} خبرة ممر${R.pack ? ' · <b>باكج مجاني</b>' : ''}${R.card ? ' · <b>بطاقة إيبك أو أندر مضمونة</b>' : ''}` : 'أنهيت هذا الطابق: بدون جائزة (تدريب)';
    ui.modal(`<div class="cam-pv" style="--wc:${W(L.world).color}"><h2>${L.boss ? '👑 ' : ''}${esc(L.name)}</h2><div class="hint">${W(L.world).name} · أفضل من 3 جولات${TW.attempts(n) ? ' · محاولات: ' + TW.attempts(n) : ''}</div>
      ${L.boss ? `<div class="boss-box">${ui.portrait(AMB.DATA.HEROES[L.heroId], { k: 'twb' })}<div><b>قدرة الزعيم: ${esc(L.special.name)}</b><p>${esc(L.special.text)}</p></div></div>` : ''}
      <h4>تشكيلة الخصم</h4><div class="cam-units">${units}</div>
      <h4>الجائزة</h4><div class="cam-reward">${reward}</div>
      <h4>بطلك</h4><div class="hchips">${heroes}</div>
      <div class="cam-go"><button class="btn primary big" data-act="towGo" data-n="${n}" ${h ? '' : 'disabled'}>قاتل!</button></div></div>`);
  }

  function start(n) {
    const ui = UI(), S = ui.S;
    S.mode = 'tower'; S.tower = { floor: n }; S.picks = [pickHero(), null]; S.pickIdx = 0;
    ui.closeModal(); ui.startMatch();
  }

  function showResult(m, secs) {
    const ui = UI(), S = ui.S, n = S.tower.floor, L = TW.lineupFor(n);
    if (!m._towDone) { m._towDone = true; S.towResult = TW.recordResult(n, Object.assign(m.summary(0), { lifeLeft: m.players[0].life, roundsLost: m.players[0].stats.losses })); }
    const r = S.towResult, won = r.won, score = `${m.players[0].stats.wins} – ${m.players[1].stats.wins}`;
    const pay = won && r.first ? [r.shards ? `${icon('gem')} +${r.shards} شظية` : '', r.passXp ? `+${r.passXp} خبرة ممر` : ''].filter(Boolean).join(' · ') : '';
    const cards = (r.pack ? r.pack.cards : []).concat(r.card ? [r.card] : []);
    const gift = cards.length ? `<div class="cam-pack"><b>${r.card ? '🏆 جائزة البرج' : '🎁 باكج مجاني'}:</b><div class="cam-pack-row">${cards.map((c, i) => `<div class="cu">${ui.portrait(C.def(c.id), { k: 'twr' + i + c.id })}<small class="r-${c.rarity}">${c.isNew ? 'جديدة!' : c.refund ? '+' + c.refund + ' شظية' : (c.rarity === 'legendary' || c.rarity === 'epic') && r.card ? AMB.ECONOMY.rarities[c.rarity].name : '+1 نسخة'}</small></div>`).join('')}</div></div>` : '';
    const next = won && TW.canPlay(n + 1) ? n + 1 : null;
    $('results').innerHTML = `<div class="res-stage ${won ? 'victory' : 'defeat'}" style="--wc:${W(L.world).color}"><div class="res-rays"></div>
        <div class="res-hero">${ui.portrait(won ? AMB.DATA.HEROES[m.players[0].heroId] : AMB.DATA.HEROES[L.heroId], { bare: true, k: 'twrh' })}<i class="sheen"></i></div>
        <div class="res-hname">${esc(L.name)}</div></div>
      <div class="res-banner"><h1>${won ? (L.boss ? 'هزمت الزعيم!' : 'فوز!') : 'خسارة'}</h1><p class="hint">النتيجة ${score} · ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')} دقيقة</p>
        ${won ? `<p class="cam-pay">${r.first ? pay : 'تدريب: بدون جائزة'}</p>${r.first ? `<p class="hint">أعلى طابق: ${r.best} من ${TW.floors()}</p>` : ''}` : '<p class="hint">ما خسرت شي. طوّر بطاقاتك وجرّب نفس الطابق مرة ثانية</p>'}</div>
      ${gift}
      <div class="cam-btns">
        ${next ? `<button class="btn primary big" data-act="towGo" data-n="${next}">الطابق التالي ${next}</button>` : ''}
        <button class="btn ${won ? '' : 'primary'} big" data-act="towGo" data-n="${n}">${won ? 'أعد الطابق' : 'حاول مرة ثانية'}</button>
        <button class="btn big ghost" data-act="go" data-to="tower">البرج</button>
        ${won ? '' : '<button class="btn big ghost" data-act="go" data-to="cards">طوّر بطاقاتي</button>'}</div>`;
    ui.show('results'); ui.sfx(won ? 'win' : 'lose');
    if (won) setTimeout(() => { const el = document.querySelector('.res-hero'); if (el) ['#ffd24a', '#ffffff', W(L.world).color].forEach((c) => ui.burst(el, c, 14, { r: 150, s: 8 })); }, 250);
  }

  AMB.TIPS = AMB.TIPS || {};
  AMB.TIPS.towinfo = () => { const R = AMB.ECONOMY.tower.rewards; return { title: 'برج التحدي', html: `<p>${TW.floors()} طابقًا، كل طابق قتال <b>أفضل من 3 جولات</b> ضد تشكيلة تصعب كل ما صعدت. كل 5 طوابق زعيم بقدرة خاصة.</p>
    <p>أول مرة تجتاز طابقًا: ${icon('gem')} ${R.shardsFirst}–${R.shardsLast} شظية + خبرة ممر. الزعيم: باكج مجاني. الطابق ${TW.floors()}: بطاقة إيبك أو أندر مضمونة.</p>
    <p>لو خسرت تعيد نفس الطابق بدون أي عقوبة، وأعلى طابق وصلت له محفوظ. مستويات بطاقاتك تُحتسب هنا، وتقدر تعيد أي طابق سابق للتدريب بدون جائزة.</p>` }; };

  function installActions() {
    const ui = UI(); if (!ui || ui.ACT.towFloor) return;
    Object.assign(ui.ACT, {
      towFloor: (d) => preview(+d.n),
      towHero: (d) => { hero = d.id; preview(+d.n); },
      towGo: (d) => start(+d.n),
    });
  }

  AMB.TowerUI = { render, refreshMenu, showResult, installActions };
  if (UI()) installActions();
  refreshMenu();
})();
